"""OddsPapi: la fuente de las casas españolas (bet365.es, codere.es...).

Las respuestas de aquí tienen la forma EXACTA de la API real (llamada del
27-09-2026: LaLiga con Pinnacle), recortadas a un partido y cuatro mercados.
Los precios de Pinnacle son los de aquella lectura; los de bet365.es, inventados.
"""
import json
import logging
from datetime import datetime, timedelta, timezone

import httpx
import pytest

from valor.fuentes.base import FalloFuente, limpia
from valor.fuentes.nombres import Cruce
from valor.fuentes.oddspapi import OddsPapi
from valor.nucleo.detector import PREPARTIDO, detectar
from dataclasses import replace

AHORA = datetime(2026, 10, 9, 17, 0, tzinfo=timezone.utc)      # dos horas antes del partido
CLAVE = "clave-secreta-de-prueba-123"
EQUIPOS = {"2830": "Malaga CF", "2814": "Espanyol Barcelona", "1": "Otro"}


@pytest.fixture(autouse=True)
def _sin_pausas(monkeypatch):
    """La pausa entre peticiones (la API real da 429 si van seguidas) aquí sobra."""
    import valor.fuentes.oddspapi as mod
    monkeypatch.setattr(mod, "PAUSA", 0.0)


def _jugador(precio, activo=True, limite=500.0):
    return {"players": {"0": {"active": activo, "price": precio, "limit": limite,
                              "changedAt": "2026-09-22T05:12:16.909Z", "mainLine": True}}}


def _fixture(casa, precios, suspendida=False, inicio="2026-10-09T19:00:00.000Z", equipo2=2814):
    unox2, tot, ah = precios
    return {
        "fixtureId": "id1000000872478616", "participant1Id": 2830, "participant2Id": equipo2,
        "sportId": 10, "tournamentId": 8, "seasonId": 142176, "statusId": 0, "hasOdds": True,
        "startTime": inicio, "trueStartTime": None, "trueEndTime": None,
        "updatedAt": "2026-09-17T13:09:10.203Z",
        "bookmakerOdds": {casa: {
            "bookmakerFixtureId": "x", "bookmakerIsActive": True, "fixturePath": "x", "suspended": suspendida,
            "markets": {
                "101": {"bookmakerMarketId": "m", "marketActive": True, "outcomes": {
                    "101": _jugador(unox2[0]), "102": _jugador(unox2[1]), "103": _jugador(unox2[2])}},
                "1010": {"marketActive": True, "outcomes": {"1010": _jugador(tot[0]), "1011": _jugador(tot[1])}},
                "1068": {"marketActive": True, "outcomes": {"1068": _jugador(ah[0]), "1069": _jugador(ah[1])}},
                # Línea de cuarto (3,25) y mercado de la primera parte: no se usan.
                "10176": {"marketActive": True, "outcomes": {"10176": _jugador(2.9), "10177": _jugador(1.4)}},
                "10208": {"marketActive": True, "outcomes": {"10208": _jugador(3.5)}},
            }}},
    }


PINNACLE = _fixture("pinnacle", ((2.67, 3.25, 2.73), (2.05, 1.787), (2.66, 1.492)))
BET365 = _fixture("bet365.es", ((3.05, 3.10, 2.45), (1.95, 1.80), (2.70, 1.45)))


def _fuente(**k):
    f = OddsPapi(clave=CLAVE, cruce=Cruce(), **k)
    f.equipos = dict(EQUIPOS)
    return f


def test_traduce_mercados_equipos_y_limites():
    lec = _fuente().traducir([PINNACLE, BET365], AHORA)
    (e,) = lec.eventos
    assert (e.local, e.visitante, e.liga, e.en_vivo) == ("Malaga CF", "Espanyol Barcelona", "LaLiga", False)
    por = {(c.casa, c.mercado, c.linea, c.seleccion): c for c in lec.cuotas}
    assert por[("pinnacle", "1x2", None, "local")].cuota == 2.67
    assert por[("pinnacle", "1x2", None, "empate")].cuota == 3.25
    assert por[("pinnacle", "totales", 2.5, "mas")].cuota == 2.05
    assert por[("pinnacle", "totales", 2.5, "menos")].cuota == 1.787
    # El hándicap va con la línea del LOCAL: −0,5 del local = que gane.
    assert por[("pinnacle", "handicap", -0.5, "local")].cuota == 2.66
    assert por[("pinnacle", "handicap", -0.5, "visitante")].cuota == 1.492
    assert por[("bet365.es", "1x2", None, "local")].limite == 500.0
    # Ni la línea de cuarto ni la primera parte: 7 cuotas por casa.
    assert len(lec.cuotas) == 14
    assert all(c.fuente == "oddspapi" and c.ts == AHORA for c in lec.cuotas)


def test_no_usa_lo_suspendido_lo_inactivo_ni_lo_empezado():
    f = _fuente()
    apagada = json.loads(json.dumps(BET365))
    apagada["bookmakerOdds"]["bet365.es"]["markets"]["101"]["outcomes"]["101"]["players"]["0"]["active"] = False
    apagada["bookmakerOdds"]["bet365.es"]["markets"]["1010"]["marketActive"] = False
    lec = f.traducir([PINNACLE, apagada], AHORA)
    b = [c for c in lec.cuotas if c.casa == "bet365.es"]
    assert {(c.mercado, c.seleccion) for c in b} == {("1x2", "empate"), ("1x2", "visitante"),
                                                    ("handicap", "local"), ("handicap", "visitante")}
    assert not [c for c in _fuente().traducir([_fixture("bet365.es", ((2, 3, 4), (2, 2), (2, 2)),
                                                        suspendida=True)], AHORA).cuotas]
    # Empezado: con una foto cada hora no se puede cumplir la regla de 8 s en vivo.
    empezado = _fixture("pinnacle", ((2, 3, 4), (2, 2), (2, 2)), inicio="2026-10-09T16:00:00.000Z")
    assert _fuente().traducir([empezado], AHORA).eventos == []


def test_equipo_sin_nombre_no_se_usa_y_lo_dice():
    lec = _fuente().traducir([_fixture("pinnacle", ((2, 3, 4), (2, 2), (2, 2)), equipo2=999)], AHORA)
    assert lec.eventos == [] and lec.cuotas == [] and "sin nombre" in lec.avisos[0]


def test_el_detector_encuentra_valor_en_la_casa_espanola():
    lec = _fuente().traducir([PINNACLE, BET365], AHORA)
    reglas = replace(PREPARTIDO, prob_minima=0.0, apostables=("bet365.es",))
    r = detectar({e.id: e for e in lec.eventos}, lec.cuotas, 1000, AHORA, reglas)
    (o,) = [o for o in r.oportunidades if o.mercado == "1x2"]
    assert (o.casa, o.seleccion, o.cuota) == ("bet365.es", "local", 3.05)
    assert o.ref_cuotas == {"pinnacle": 2.67} and o.fuente == "oddspapi" and o.ts_cuota == AHORA


def _cliente(pedidas, estado=200):
    def manejar(req):
        pedidas.append(req)
        if estado != 200:
            return httpx.Response(estado, json={"error": "x"})
        if req.url.path.endswith("/participants"):
            return httpx.Response(200, json=EQUIPOS)
        casa = req.url.params["bookmaker"]
        return httpx.Response(200, json=[PINNACLE if casa == "pinnacle" else _fixture(
            casa, ((3.05, 3.10, 2.45), (1.95, 1.80), (2.70, 1.45)))])
    return httpx.Client(transport=httpx.MockTransport(manejar))


def test_leer_una_casa_por_peticion_rota_y_guarda_los_equipos(tmp_path):
    pedidas = []
    cache = tmp_path / "oddspapi_equipos.json"
    f = OddsPapi(clave=CLAVE, cliente=_cliente(pedidas), torneos=[8, 17, 7],
                 casas=["bet365.es", "codere.es"], cache=str(cache))
    lec = f.leer([])
    cuotas = [r for r in pedidas if r.url.path.endswith("/odds-by-tournaments")]
    assert [r.url.params["bookmaker"] for r in cuotas] == ["pinnacle", "bet365.es"]
    assert {r.url.params["tournamentIds"] for r in cuotas} == {"8,17,7"}
    # La primera vez pide también los equipos (1 petición más) y los guarda.
    assert lec.coste == 3 and cache.exists() and lec.detalle == "pinnacle + bet365.es"
    assert {c.casa for c in lec.cuotas} == {"pinnacle", "bet365.es"}

    pedidas.clear()
    g = OddsPapi(clave=CLAVE, cliente=_cliente(pedidas), casas=["bet365.es", "codere.es"], cache=str(cache))
    g.vueltas_previas = 1                     # la segunda lectura le toca a la segunda casa
    lec = g.leer([])
    assert lec.coste == 2 and [r.url.params["bookmaker"] for r in pedidas] == ["pinnacle", "codere.es"]


@pytest.mark.parametrize("estado,error", [(401, PermissionError), (500, FalloFuente)])
def test_los_errores_no_llevan_la_clave(tmp_path, estado, error):
    f = OddsPapi(clave=CLAVE, cliente=_cliente([], estado), cache=str(tmp_path / "c.json"))
    with pytest.raises(error) as e:
        f.leer([])
    assert CLAVE not in str(e.value) and "apiKey" not in str(e.value)


def test_limpia_quita_claves_de_cualquier_texto():
    t = ("Client error '401' for url 'https://api.oddspapi.io/v4/odds?apiKey=%s&bookmaker=x' "
         "y https://api.the-odds-api.com/v4/sports?apiKey=%s" % (CLAVE, CLAVE))
    assert CLAVE not in limpia(t) and "apiKey=***" in limpia(t) and "bookmaker=x" in limpia(t)


def test_httpx_no_escribe_urls_en_el_log():
    """Con el log en INFO, httpx escribiría cada URL, con su ?apiKey=, en los logs de Fly."""
    import valor.fuentes.base  # noqa: F401 - importarlo es lo que lo ajusta
    assert not logging.getLogger("httpx").isEnabledFor(logging.INFO)


def test_la_cache_rota_no_tumba_la_fuente(tmp_path):
    cache = tmp_path / "c.json"
    cache.write_text("{no es json", encoding="utf-8")
    f = OddsPapi(clave=CLAVE, cache=str(cache))
    assert f.equipos == {} and f._equipos_de == 0.0


def test_renueva_los_equipos_como_mucho_una_vez_al_dia(tmp_path):
    pedidas = []
    f = OddsPapi(clave=CLAVE, cliente=_cliente(pedidas))
    f.equipos, f._equipos_de = {"2830": "Malaga CF"}, datetime.now(timezone.utc).timestamp() - 3600
    f._llamadas = 0
    f._asegura_equipos([PINNACLE])            # falta un equipo, pero la lista es de hace 1 h
    assert f._llamadas == 0
    f._equipos_de -= timedelta(days=1).total_seconds()
    f._asegura_equipos([PINNACLE])            # de hace más de un día: ahora sí
    assert f._llamadas == 1 and f.equipos["2814"] == "Espanyol Barcelona"


def test_espera_entre_peticiones_y_reintenta_un_429(tmp_path, monkeypatch):
    """La API real contestó 429 a dos peticiones separadas por menos de un segundo."""
    import valor.fuentes.oddspapi as mod
    monkeypatch.setattr(mod, "PAUSA", 1.2)
    pedidas, dormido = [], []
    primera = {"hecha": False}

    def manejar(req):
        pedidas.append(req.url.params.get("bookmaker"))
        if req.url.params.get("bookmaker") == "codere.es" and not primera["hecha"]:
            primera["hecha"] = True
            return httpx.Response(429, json={"error": {"code": "RATE_LIMITED",
                                                       "details": "Please wait 0.59 seconds before making another"}})
        if req.url.path.endswith("/participants"):
            return httpx.Response(200, json=EQUIPOS)
        return httpx.Response(200, json=[PINNACLE])
    f = OddsPapi(clave=CLAVE, cliente=httpx.Client(transport=httpx.MockTransport(manejar)),
                 casas=["codere.es"], cache=str(tmp_path / "c.json"))
    f._dormir = dormido.append
    lec = f.leer([])
    assert pedidas == ["pinnacle", "codere.es", "codere.es", None]      # el 429 se reintenta una vez
    assert lec.coste == 4 and len(dormido) >= 3 and all(0 < d <= 10 for d in dormido)


def test_como_mucho_5_torneos_por_peticion(tmp_path):
    """La API real contesta 400 con más de 5: «Please provide a maximum of 5
    tournament IDs». Con 7 torneos, dos tandas por casa."""
    tandas = []

    def manejar(req):
        if req.url.path.endswith("/participants"):
            return httpx.Response(200, json=EQUIPOS)
        ids = req.url.params["tournamentIds"].split(",")
        if len(ids) > 5:
            return httpx.Response(400, json={"error": {"code": "INVALID_PARAMETER"}})
        tandas.append((req.url.params["bookmaker"], len(ids)))
        return httpx.Response(200, json=[PINNACLE] if req.url.params["bookmaker"] == "pinnacle" else [BET365])
    f = OddsPapi(clave=CLAVE, cliente=httpx.Client(transport=httpx.MockTransport(manejar)),
                 torneos=[8, 54, 17, 7, 679, 34480, 23755], casas=["bet365.es"], cache=str(tmp_path / "c.json"))
    lec = f.leer([])
    assert tandas == [("pinnacle", 5), ("pinnacle", 2), ("bet365.es", 5), ("bet365.es", 2)]
    assert f.peticiones_por_lectura() == 4 and lec.coste == 5          # + la lista de equipos
    assert OddsPapi(clave=CLAVE, torneos=[8, 54, 17, 7, 23755]).peticiones_por_lectura() == 2


def test_por_defecto_caben_en_una_peticion(monkeypatch):
    from valor.fuentes.oddspapi import de_entorno
    monkeypatch.delenv("ODDSPAPI_TORNEOS", raising=False)
    f = de_entorno(Cruce(), None)
    assert len(f.torneos) <= 5 and f.peticiones_por_lectura() == 2
