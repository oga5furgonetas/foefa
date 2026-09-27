from datetime import datetime, timezone

import httpx
import pytest

from valor.fuentes.api_football import ApiFootball
from valor.fuentes.base import SinClave
from valor.fuentes.nombres import Cruce, parecido
from valor.fuentes.the_odds_api import TheOddsApi
from valor.nucleo.detector import detectar

AHORA = datetime(2026, 9, 27, 12, 0, tzinfo=timezone.utc)

# Respuesta escrita según la documentación v4 de The Odds API.
ODDS_API = [{
    "id": "abc", "sport_key": "soccer_spain_la_liga", "sport_title": "La Liga - Spain",
    "commence_time": "2026-09-27T19:00:00Z", "home_team": "Real Betis", "away_team": "Sevilla",
    "bookmakers": [
        {"key": "pinnacle", "title": "Pinnacle", "last_update": "2026-09-27T11:59:50Z",
         "markets": [
             {"key": "h2h", "last_update": "2026-09-27T11:59:50Z", "outcomes": [
                 {"name": "Real Betis", "price": 2.10}, {"name": "Sevilla", "price": 3.70},
                 {"name": "Draw", "price": 3.45}]},
             {"key": "totals", "last_update": "2026-09-27T11:59:50Z", "outcomes": [
                 {"name": "Over", "price": 1.95, "point": 2.5},
                 {"name": "Under", "price": 1.95, "point": 2.5}]},
             {"key": "spreads", "last_update": "2026-09-27T11:59:50Z", "outcomes": [
                 {"name": "Real Betis", "price": 1.90, "point": -0.5},
                 {"name": "Sevilla", "price": 2.00, "point": 0.5}]}]},
        {"key": "williamhill", "title": "William Hill", "last_update": "2026-09-27T11:59:40Z",
         "markets": [
             {"key": "h2h", "last_update": "2026-09-27T11:59:40Z", "outcomes": [
                 {"name": "Real Betis", "price": 2.30}, {"name": "Sevilla", "price": 3.30},
                 {"name": "Draw", "price": 3.30}]}]}]}]

# Respuestas escritas según la documentación v3 de API-Football.
AF_PARTIDOS = [{"fixture": {"id": 7, "date": "2026-09-27T19:00:00+00:00", "status": {"short": "NS"}},
                "league": {"name": "La Liga"},
                "teams": {"home": {"name": "Betis"}, "away": {"name": "Sevilla"}}}]
AF_CUOTAS = [{"fixture": {"id": 7, "date": "2026-09-27T19:00:00+00:00"},
              "update": "2026-09-27T11:59:30+00:00",
              "bookmakers": [{"id": 8, "name": "Bet365", "bets": [
                  {"id": 1, "name": "Match Winner", "values": [
                      {"value": "Home", "odd": "2.28"}, {"value": "Draw", "odd": "3.30"},
                      {"value": "Away", "odd": "3.40"}]},
                  {"id": 5, "name": "Goals Over/Under", "values": [
                      {"value": "Over 2.5", "odd": "2.05"}, {"value": "Under 2.5", "odd": "1.80"}]},
                  {"id": 4, "name": "Asian Handicap", "values": [
                      {"value": "Home -0.5", "odd": "1.95"}, {"value": "Away +0.5", "odd": "1.90"}]}]},
                  {"id": 99, "name": "Casa Rara", "bets": []}]}]


def test_parecido_nombres():
    assert parecido("Real Betis Balompié", "Betis") >= 0.82
    assert parecido("Man Utd", "Manchester United FC") == 1.0
    assert parecido("Real Madrid", "Real Sociedad") < 0.82
    assert parecido("Sevilla", "Villarreal") < 0.82


def test_cruce_no_junta_partidos_distintos():
    cr = Cruce()
    t = TheOddsApi(clave="x", cruce=cr)
    t.traducir("soccer_spain_la_liga", ODDS_API, ahora=AHORA)
    assert cr.buscar("futbol", "Real Madrid", "Sevilla", datetime(2026, 9, 27, 19, tzinfo=timezone.utc)) is None
    # mismo partido, 3 h después: es otro
    assert cr.buscar("futbol", "Betis", "Sevilla", datetime(2026, 9, 27, 22, tzinfo=timezone.utc)) is None


def test_the_odds_api_traduce_mercados():
    lec = TheOddsApi(clave="x").traducir("soccer_spain_la_liga", ODDS_API, ahora=AHORA)
    assert len(lec.eventos) == 1 and not lec.eventos[0].en_vivo
    por = {(c.casa, c.mercado, c.linea, c.seleccion): c.cuota for c in lec.cuotas}
    assert por[("pinnacle", "1x2", None, "empate")] == 3.45
    assert por[("pinnacle", "totales", 2.5, "mas")] == 1.95
    assert por[("pinnacle", "handicap", -0.5, "visitante")] == 2.00
    assert por[("williamhill", "1x2", None, "local")] == 2.30


def test_dos_fuentes_se_cruzan_y_el_detector_las_compara():
    cr = Cruce()
    a = TheOddsApi(clave="x", cruce=cr).traducir("soccer_spain_la_liga", ODDS_API, ahora=AHORA)
    b = ApiFootball(clave="x", cruce=cr).traducir(AF_PARTIDOS, AF_CUOTAS)
    assert a.eventos[0].id == b.eventos[0].id          # «Real Betis» de una = «Betis» de otra
    eventos = {e.id: e for e in cr.todos()}
    r = detectar(eventos, a.cuotas + b.cuotas, 1000, AHORA)
    casas = {(o.casa, o.mercado, o.seleccion) for o in r.oportunidades}
    assert ("williamhill", "1x2", "local") in casas
    assert ("bet365", "1x2", "local") in casas
    # Bet365 más 2,5 a 2,05 contra Pinnacle 1,95/1,95 (justa 2,00): +2,5 %
    assert ("bet365", "totales", "mas") in casas


def test_api_football_ignora_casas_desconocidas_y_traduce_handicap():
    lec = ApiFootball(clave="x").traducir(AF_PARTIDOS, AF_CUOTAS)
    assert {c.casa for c in lec.cuotas} == {"bet365"}
    h = {(c.linea, c.seleccion) for c in lec.cuotas if c.mercado == "handicap"}
    assert h == {(-0.5, "local"), (-0.5, "visitante")}


def test_sin_clave_avisa_claro(monkeypatch):
    monkeypatch.delenv("ODDS_API_KEY", raising=False)
    with pytest.raises(SinClave):
        TheOddsApi().leer(["soccer_epl"])


def test_the_odds_api_lee_cupo_de_la_cabecera():
    def responde(req):
        assert req.url.params["regions"] == "eu,uk"
        return httpx.Response(200, json=ODDS_API, headers={"x-requests-remaining": "12"})
    cli = httpx.Client(transport=httpx.MockTransport(responde))
    lec = TheOddsApi(clave="x", cliente=cli).leer(["soccer_spain_la_liga"])
    assert lec.cupo_restante == 12 and lec.avisos


def test_the_odds_api_apunta_lo_gastado_y_el_calendario_es_gratis():
    """Comprobado contra la API real el 27-09: /odds de una liga con h2h+totals
    gasta 2 (x-requests-last); /events, 0."""
    pedidas = []

    def responde(req):
        pedidas.append(req.url.path)
        if req.url.path.endswith("/events"):
            return httpx.Response(200, json=[{"commence_time": "2026-10-09T19:00:00Z"}],
                                  headers={"x-requests-last": "0"})
        return httpx.Response(200, json=ODDS_API, headers={"x-requests-remaining": "496",
                                                           "x-requests-last": "2"})
    f = TheOddsApi(clave="x", cliente=httpx.Client(transport=httpx.MockTransport(responde)),
                   regiones="eu", mercados="h2h,totals")
    cal = f.proximos(["soccer_spain_la_liga"])
    assert cal == {"soccer_spain_la_liga": [datetime(2026, 10, 9, 19, 0, tzinfo=timezone.utc)]}
    lec = f.leer(["soccer_spain_la_liga", "soccer_epl"])
    assert lec.coste == 4 and lec.cupo_restante == 496
    assert pedidas[0].endswith("/soccer_spain_la_liga/events")


def test_the_odds_api_error_sin_url_ni_clave():
    cli = httpx.Client(transport=httpx.MockTransport(lambda req: httpx.Response(500)))
    with pytest.raises(httpx.HTTPError) as e:
        TheOddsApi(clave="CLAVE-SECRETA", cliente=cli).leer(["soccer_epl"])
    assert "CLAVE-SECRETA" not in str(e.value) and "500" in str(e.value)


def test_api_football_casas_de_la_respuesta_real():
    """Betano, BetVictor y SBO salieron en la respuesta real del 27-09-2026."""
    cuotas = [dict(AF_CUOTAS[0], bookmakers=[
        {"id": 32, "name": n, "bets": [{"id": 1, "name": "Match Winner", "values": [
            {"value": "Home", "odd": "2.28"}, {"value": "Draw", "odd": "3.30"}, {"value": "Away", "odd": "3.40"}]}]}
        for n in ("Betano", "BetVictor", "SBO")])]
    lec = ApiFootball(clave="x", cruce=Cruce()).traducir(AF_PARTIDOS, cuotas)
    assert {c.casa for c in lec.cuotas} == {"betano", "betvictor", "sbobet"}


def test_api_football_cuenta_sus_llamadas():
    def responde(req):
        if req.url.path.endswith("/fixtures"):
            return httpx.Response(200, json={"response": AF_PARTIDOS, "errors": []})
        return httpx.Response(200, json={"response": AF_CUOTAS, "paging": {"current": 1, "total": 1},
                                         "errors": []}, headers={"x-ratelimit-requests-remaining": "88"})
    f = ApiFootball(clave="x", cliente=httpx.Client(transport=httpx.MockTransport(responde)))
    lec = f.leer([])
    assert lec.coste == 2 and lec.cupo_restante == 88 and "1 de 1" in lec.detalle
