import pytest
from datetime import datetime, timedelta, timezone

from valor.escaner import Escaner, Presupuesto, texto_aviso
from valor.fuentes.base import Fuente, Lectura
from valor.fuentes.nombres import id_evento
from valor.nucleo.modelo import Cuota, Evento
from valor.registro import Registro

AHORA = datetime(2026, 9, 27, 12, 0, tzinfo=timezone.utc)



@pytest.fixture(autouse=True)
def _modo_antiguo(monkeypatch):
    # Estas pruebas usan una apuesta del 46 % y una segura: se abren los filtros.
    monkeypatch.setenv("VALOR_PROB_MINIMA", "0")
    monkeypatch.setenv("VALOR_SEGURAS", "1")
    # Estas pruebas no van de en qué casas se apuesta: todas valen.
    monkeypatch.setenv("VALOR_CASAS", "*")


class Falsa(Fuente):
    nombre = "falsa"

    def __init__(self, cruce):
        self.cruce, self.lecturas = cruce, 0

    def leer(self, deportes):
        self.lecturas += 1
        inicio = AHORA + timedelta(hours=3)
        e = self.cruce.registra(Evento(id_evento("futbol", "Betis", "Sevilla", inicio), "futbol",
                                       "LaLiga", "Betis", "Sevilla", inicio))
        t = AHORA - timedelta(seconds=30)
        c = [Cuota(e.id, "pinnacle", "1x2", None, s, v, t) for s, v in
             (("local", 2.10), ("empate", 3.45), ("visitante", 3.70))]
        c.append(Cuota(e.id, "bet365", "1x2", None, "local", 2.30, t))
        return Lectura([e], c)


def _escaner(tmp_path, avisos):
    reg = Registro(str(tmp_path / "v.db"))
    esc = Escaner(reg, 1000, fuentes={}, aviso=avisos.append)
    f = Falsa(esc.cruce)
    # 100 al día, 25 por vuelta → 4 vueltas al día, una cada 6 h
    esc.fuentes = {f: Presupuesto("falsa", 100, timedelta(days=1), 25)}
    return esc, f, reg


def test_vuelta_guarda_y_avisa_una_vez(tmp_path):
    avisos = []
    esc, f, reg = _escaner(tmp_path, avisos)
    r = esc.vuelta(AHORA)
    assert len(r.oportunidades) == 1 and len(avisos) == 1
    assert "meter" in avisos[0] and "bet365" in avisos[0]
    assert reg.oportunidades_recientes()[0]["casa"] == "bet365"
    esc._ultima.clear()
    esc.vuelta(AHORA + timedelta(hours=7))
    assert len(avisos) == 1                     # misma oportunidad: no se repite el aviso


def test_respeta_el_presupuesto(tmp_path):
    esc, f, _ = _escaner(tmp_path, [])
    esc.vuelta(AHORA)
    assert esc.vuelta(AHORA + timedelta(hours=1)) is None      # aún no toca (cada 6 h)
    esc.vuelta(AHORA + timedelta(hours=6))
    esc.vuelta(AHORA + timedelta(hours=12))
    esc.vuelta(AHORA + timedelta(hours=18))
    assert f.lecturas == 4
    # 4 × 25 = 100: una quinta vuelta dentro de las 24 h se pasaría del cupo
    esc._ultima.clear()
    assert esc.vuelta(AHORA + timedelta(hours=23)) is None


def test_intervalo():
    assert Presupuesto("x", 500, timedelta(days=30), 6).intervalo() == timedelta(days=30) / 83


def test_texto_aviso_totales():
    e = Evento("e", "futbol", "L", "A", "B", AHORA)
    from valor.nucleo.modelo import Oportunidad
    o = Oportunidad(e, "totales", 2.5, "mas", "bwin", 2.1, 0.5, 2.0, 0.05, 10, ["pinnacle"], {}, 5)
    assert "más de 2.5" in texto_aviso(o)


def test_tipster_favorito_con_la_linea_movida(tmp_path, monkeypatch):
    """El caso bueno: Pinnacle baja al Sevilla de 1,90 a 1,62; Bet365 sigue a 1,80."""
    monkeypatch.setenv("VALOR_PROB_MINIMA", "0.60")
    monkeypatch.setenv("VALOR_SEGURAS", "0")
    reg = Registro(str(tmp_path / "v.db"))
    esc = Escaner(reg, 6000, fuentes={})
    inicio = AHORA + timedelta(hours=2)
    e = esc.cruce.registra(Evento(id_evento("futbol", "Getafe", "Sevilla", inicio), "futbol",
                                  "LaLiga", "Getafe", "Sevilla", inicio))

    def lectura(t, ref, blanda):
        c = [Cuota(e.id, "pinnacle", "1x2", None, s, v, t) for s, v in zip(("local", "empate", "visitante"), ref)]
        c.append(Cuota(e.id, "bet365", "1x2", None, "visitante", blanda, t))
        return Lectura([e], c)

    class Dos(Fuente):
        nombre = "dos"
        def __init__(self):
            self.n = 0
        def leer(self, d):
            self.n += 1
            return (lectura(AHORA - timedelta(minutes=40), (4.60, 3.70, 1.90), 1.80) if self.n == 1
                    else lectura(AHORA - timedelta(seconds=20), (6.00, 4.30, 1.62), 1.80))

    esc.fuentes = {Dos(): Presupuesto("dos", 1000, timedelta(days=1), 1)}
    r1 = esc.vuelta(AHORA - timedelta(minutes=40))
    assert r1.oportunidades == []                          # a 1,90 Bet365 no tenía valor
    r2 = esc.vuelta(AHORA)
    (o,) = r2.oportunidades
    assert (o.casa, o.seleccion, o.cuota) == ("bet365", "visitante", 1.80)
    assert o.prob_justa >= 0.60 and 1.6 < o.cuota_justa < 1.7
    assert o.fallo == "casa lenta"
    assert o.motivos[0].startswith("CASA LENTA") and "de 1.90 a 1.62" in o.motivos[0]
    assert r2.descartes.get("poca probabilidad de acertar", 0) == 0
    assert o.importe > 0


def test_poca_probabilidad_se_descarta(tmp_path, monkeypatch):
    monkeypatch.setenv("VALOR_PROB_MINIMA", "0.60")
    reg = Registro(str(tmp_path / "v.db"))
    esc = Escaner(reg, 1000, fuentes={})
    f = Falsa(esc.cruce)
    esc.fuentes = {f: Presupuesto("falsa", 100, timedelta(days=1), 25)}
    r = esc.vuelta(AHORA)
    assert r.oportunidades == [] and r.descartes["poca probabilidad de acertar"] == 1


def _fuente_fija(esc, pinnacle, blanda):
    inicio = AHORA + timedelta(hours=2)
    e = esc.cruce.registra(Evento(id_evento("futbol", "Getafe", "Sevilla", inicio), "futbol",
                                  "LaLiga", "Getafe", "Sevilla", inicio))

    class Fija(Fuente):
        nombre = "fija"
        def __init__(self):
            pass
        def leer(self, d):
            t = AHORA - timedelta(seconds=20)
            c = [Cuota(e.id, "pinnacle", "1x2", None, s, v, t)
                 for s, v in zip(("local", "empate", "visitante"), pinnacle)]
            c.append(Cuota(e.id, "bet365", "1x2", None, "visitante", blanda, t))
            return Lectura([e], c)
    esc.fuentes = {Fija(): Presupuesto("fija", 1000, timedelta(days=1), 1)}


def test_cuota_baja_solo_con_mucho_valor(tmp_path, monkeypatch):
    monkeypatch.setenv("VALOR_PROB_MINIMA", "0.60")
    # Pinnacle 1,45 (justa ~1,48). Bet365 1,52: +2,7 %, poco para una cuota baja → fuera.
    esc = Escaner(Registro(str(tmp_path / "a.db")), 6000, fuentes={})
    _fuente_fija(esc, (8.50, 5.00, 1.45), 1.52)
    r = esc.vuelta(AHORA)
    assert r.oportunidades == [] and r.descartes["cuota baja sin valor suficiente"] == 1
    # Bet365 1,60: +8 % → sí, aunque esté por debajo de 1,70.
    esc = Escaner(Registro(str(tmp_path / "b.db")), 6000, fuentes={})
    _fuente_fija(esc, (8.50, 5.00, 1.45), 1.60)
    (o,) = esc.vuelta(AHORA).oportunidades
    assert o.cuota == 1.60 and o.ev >= 0.05
    # Y por debajo de 1,50, nunca.
    esc = Escaner(Registro(str(tmp_path / "c.db")), 6000, fuentes={})
    _fuente_fija(esc, (15.0, 7.00, 1.25), 1.45)
    r = esc.vuelta(AHORA)
    assert r.oportunidades == [] and r.descartes["cuota fuera de rango"] == 1


def test_freno_de_perdidas(tmp_path, monkeypatch):
    monkeypatch.setenv("VALOR_PROB_MINIMA", "0.60")
    reg = Registro(str(tmp_path / "v.db"))
    esc = Escaner(reg, 6000, fuentes={})
    _fuente_fija(esc, (6.00, 4.30, 1.62), 1.80)
    # Hoy ya se han perdido 400 € (tope: 6 % de 6000 = 360 €)
    from datetime import datetime as _dt
    reg.db.execute("INSERT INTO apuestas (creada, evento_id, mercado, seleccion, casa, cuota, importe,"
                   " prob_justa, ev, resultado) VALUES (?,?,?,?,?,?,?,?,?,?)",
                   (_dt.now(timezone.utc).isoformat(), "x", "1x2", "local", "bwin", 1.9, 400, 0.55, 0.04, "perdida"))
    avisos = []
    esc.aviso = avisos.append
    (o,) = esc.vuelta(AHORA).oportunidades
    assert o.importe == 0 and o.avisos[0].startswith("FRENO") and avisos == []


def test_el_estado_de_cada_fuente_para_la_pantalla(tmp_path):
    """Cuándo leyó, cuánto cupo le queda y si falló: sin esto, una pantalla sin
    chollos no dice si es que no hay o que no está leyendo."""
    import httpx
    esc, f, reg = _escaner(tmp_path, [])
    lectura_buena = f.leer

    def con_cupo(d):
        l = lectura_buena(d)
        l.cupo_restante = 431
        return l
    f.leer = con_cupo
    esc.vuelta(AHORA)
    est = esc.estado["falsa"]
    assert est["ultima"] == AHORA.isoformat() and est["cupo_restante"] == 431 and est["error"] is None
    assert est["cuotas"] == 4 and est["partidos"] == 1 and est["cada_min"] == 360   # 100/día, 25 por vuelta

    def cae(d):
        raise httpx.ConnectError("sin red")
    f.leer = cae
    esc._ultima.clear()
    esc.vuelta(AHORA + timedelta(hours=7))
    assert "sin red" in esc.estado["falsa"]["error"]


# ── El cupo, donde hay partido ────────────────────────────────────────────
from valor.fuentes.the_odds_api import TheOddsApi  # noqa: E402


def test_espera_segun_lo_que_falta_para_el_partido():
    p = Presupuesto("x", 500, timedelta(days=30), 2, rapido=timedelta(minutes=40))
    assert p.espera(timedelta(hours=2)) == timedelta(minutes=40)
    assert p.espera(timedelta(hours=10)) == timedelta(minutes=120)
    assert p.espera(timedelta(days=3)) == max(p.intervalo(), timedelta(minutes=480))
    assert p.espera(None) == p.intervalo()                  # sin calendario: el cupo repartido
    # Sin ritmo rápido, como siempre.
    assert Presupuesto("x", 100, timedelta(days=1), 25).espera(timedelta(hours=1)) == timedelta(hours=6)


def test_tope_de_rafaga():
    # 500 al mes: un día puede gastar hasta 3 veces su parte (50), no el mes entero.
    assert Presupuesto("x", 500, timedelta(days=30), 2).tope_rafaga() == (timedelta(days=1), 50.0)
    # 100 al día: una hora, hasta 3 veces su parte (12,5); nunca menos que una lectura.
    assert Presupuesto("x", 100, timedelta(days=1), 25).tope_rafaga() == (timedelta(hours=1), 25.0)


class CalendarioFalso(TheOddsApi):
    """The Odds API de mentira: /events dice qué ligas juegan pronto."""

    def __init__(self, cruce, calendario):
        self.clave, self.cruce, self.calendario, self.leidas = "x", cruce, calendario, []

    def proximos(self, deportes):
        return {d: self.calendario.get(d, []) for d in deportes}

    def leer(self, deportes):
        self.leidas.append(list(deportes))
        return Lectura(coste=2 * len(deportes), detalle=", ".join(deportes))


def _con_calendario(tmp_path, calendario):
    reg = Registro(str(tmp_path / "v.db"))
    esc = Escaner(reg, 1000, fuentes={})
    f = CalendarioFalso(esc.cruce, calendario)
    esc.deportes = {"the_odds_api": ["liga_a", "liga_b", "liga_c"]}
    esc.fuentes = {f: Presupuesto("the_odds_api", 500, timedelta(days=30), 6, rapido=timedelta(minutes=40))}
    return esc, f, reg


def test_the_odds_api_solo_lee_las_ligas_con_partido_y_apunta_lo_gastado(tmp_path):
    esc, f, reg = _con_calendario(tmp_path, {"liga_a": [AHORA + timedelta(hours=2)],
                                             "liga_b": [AHORA + timedelta(days=5)], "liga_c": []})
    esc.vuelta(AHORA)
    assert f.leidas == [["liga_a"]]
    assert reg.db.execute("SELECT SUM(coste) FROM uso").fetchone()[0] == 2     # lo gastado de verdad
    est = esc.estado["the_odds_api"]
    assert est["cada_min"] == 40 and est["leido"] == "liga_a" and est["gastado"] == 2
    assert est["proxima"] == (AHORA + timedelta(minutes=40)).isoformat()
    # A los 20 min aún no toca: no se pide dos veces lo mismo.
    esc.vuelta(AHORA + timedelta(minutes=20))
    assert len(f.leidas) == 1
    esc.vuelta(AHORA + timedelta(minutes=41))
    assert len(f.leidas) == 2


def test_sin_partido_en_24_horas_no_gasta_nada(tmp_path):
    esc, f, reg = _con_calendario(tmp_path, {"liga_a": [AHORA + timedelta(days=4)]})
    assert esc.vuelta(AHORA) is None and f.leidas == []
    assert esc.estado["the_odds_api"]["sin_partido"] is True


def test_un_dia_no_se_come_el_mes(tmp_path):
    # Un partido cada hora en las tres ligas: siempre toca el ritmo rápido.
    cada_hora = [AHORA + timedelta(hours=1 + k) for k in range(24)]
    esc, f, reg = _con_calendario(tmp_path, {"liga_a": cada_hora, "liga_b": cada_hora, "liga_c": cada_hora})
    for i in range(20):
        esc.vuelta(AHORA + timedelta(minutes=41 * i))
    # 6 créditos por vuelta y 50 al día como mucho: 8 lecturas, no 20.
    assert len(f.leidas) == 8
    assert reg.db.execute("SELECT SUM(coste) FROM uso").fetchone()[0] == 48


def test_lo_que_dice_la_api_que_queda_manda(tmp_path):
    esc, f, reg = _con_calendario(tmp_path, {"liga_a": [AHORA + timedelta(hours=2)]})
    esc.estado["the_odds_api"] = {"cupo_restante": 1}
    assert esc.vuelta(AHORA) is None and f.leidas == []


def test_el_error_de_una_fuente_se_guarda_sin_la_clave(tmp_path):
    esc, f, reg = _escaner(tmp_path, [])

    def cae(d):
        import httpx
        raise httpx.HTTPError("Client error '401' for url 'https://x.io/v4/odds?apiKey=SECRETO123&a=1'")
    f.leer = cae
    esc.vuelta(AHORA)
    assert "SECRETO123" not in esc.estado["falsa"]["error"]
