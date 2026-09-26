from datetime import datetime, timedelta, timezone

from valor import puntos_flacos as pf
from valor.nucleo.modelo import Cuota, Evento, Oportunidad
from valor.registro import Registro

AHORA = datetime(2026, 9, 27, 12, 0, tzinfo=timezone.utc)
EV = Evento("e1", "futbol", "LaLiga", "Getafe", "Sevilla", AHORA + timedelta(hours=2))
AFILADAS = ("pinnacle", "betfair_ex_eu")


def _op(casa="bet365", cuota=1.80, mercado="1x2", linea=None, sel="visitante"):
    return Oportunidad(EV, mercado, linea, sel, casa, cuota, 0.61, 1.65, 0.09, 50, ["pinnacle"], {}, 5, ["base"])


def _c(casa, cuota, sel="visitante", hace=20, mercado="1x2", linea=None):
    return Cuota("e1", casa, mercado, linea, sel, cuota, AHORA - timedelta(seconds=hace))


def _reg(tmp_path, cuotas):
    reg = Registro(str(tmp_path / "v.db"))
    reg.guarda_lectura([EV], cuotas)
    return reg


# ── casa lenta ─────────────────────────────────────────────────────────────

def test_casa_lenta(tmp_path):
    reg = _reg(tmp_path, [_c("pinnacle", 1.90, hace=1800), _c("bet365", 1.80, hace=1800),
                          _c("pinnacle", 1.62, hace=20), _c("bet365", 1.80, hace=20)])
    txt = pf.casa_lenta(_op(), reg, AHORA)
    assert txt.startswith("CASA LENTA") and "1.90 a 1.62" in txt and "29 min" in txt


def test_no_es_lenta_si_la_casa_tambien_se_movio(tmp_path):
    # Bet365 bajó a la vez (1,95 → 1,80): no está dormida, simplemente paga más.
    reg = _reg(tmp_path, [_c("pinnacle", 1.90, hace=1800), _c("bet365", 1.95, hace=1800),
                          _c("pinnacle", 1.62, hace=20), _c("bet365", 1.80, hace=20)])
    txt = pf.casa_lenta(_op(), reg, AHORA)
    assert txt is None or not txt.startswith("CASA LENTA")


def test_no_es_lenta_si_la_referencia_no_se_movio(tmp_path):
    reg = _reg(tmp_path, [_c("pinnacle", 1.64, hace=1800), _c("pinnacle", 1.62, hace=20),
                          _c("bet365", 1.80, hace=1800), _c("bet365", 1.80, hace=20)])
    assert pf.casa_lenta(_op(), reg, AHORA) is None


# ── casa desalineada ───────────────────────────────────────────────────────

def test_desalineada():
    cuotas = [_c("bet365", 1.80), _c("codere", 1.64), _c("bwin", 1.66), _c("williamhill", 1.65),
              _c("pinnacle", 1.62)]
    txt = pf.desalineada(_op(), cuotas, AFILADAS)
    assert txt.startswith("CASA DESALINEADA") and "1.64 y 1.66" in txt


def test_no_desalineada_si_otras_pagan_parecido():
    cuotas = [_c("bet365", 1.80), _c("codere", 1.78), _c("bwin", 1.66)]
    assert pf.desalineada(_op(), cuotas, AFILADAS) is None


def test_no_desalineada_con_una_sola_casa_para_comparar():
    assert pf.desalineada(_op(), [_c("bet365", 1.80), _c("codere", 1.60)], AFILADAS) is None


# ── incoherencia interna ───────────────────────────────────────────────────

def test_incoherencia_en_la_escalera_de_goles():
    t = lambda linea, sel, v: _c("bet365", v, sel=sel, mercado="totales", linea=linea)
    # «más de 2,5» a 1,75 (57 %) y «más de 1,5» a 1,95 (50 %): imposible
    cuotas = [t(1.5, "mas", 1.95), t(1.5, "menos", 1.85), t(2.5, "mas", 1.75), t(2.5, "menos", 2.05)]
    txt = pf.incoherente(_op(mercado="totales", linea=1.5, sel="mas", cuota=1.95), cuotas)
    assert txt.startswith("INCOHERENCIA INTERNA")


def test_escalera_normal_no_es_incoherente():
    t = lambda linea, sel, v: _c("bet365", v, sel=sel, mercado="totales", linea=linea)
    cuotas = [t(1.5, "mas", 1.30), t(1.5, "menos", 3.40), t(2.5, "mas", 1.95), t(2.5, "menos", 1.85)]
    assert pf.incoherente(_op(mercado="totales", linea=2.5, sel="mas", cuota=1.95), cuotas) is None


# ── juntos ─────────────────────────────────────────────────────────────────

def test_analizar_pone_la_causa_y_la_explica_primero(tmp_path):
    reg = _reg(tmp_path, [_c("pinnacle", 1.90, hace=1800), _c("bet365", 1.80, hace=1800),
                          _c("pinnacle", 1.62, hace=20), _c("bet365", 1.80, hace=20)])
    cuotas = [_c("bet365", 1.80), _c("codere", 1.64), _c("bwin", 1.66), _c("pinnacle", 1.62)]
    o = _op()
    pf.analizar(o, cuotas, reg, AHORA, AFILADAS)
    assert o.fallo == pf.LENTA
    assert o.motivos[0] == "2 puntos flacos a la vez en esta cuota."
    assert o.motivos[1].startswith("CASA LENTA") and o.motivos[2].startswith("CASA DESALINEADA")
    assert o.motivos[-1] == "base"


def test_sin_punto_flaco_queda_como_valor(tmp_path):
    o = _op()
    pf.analizar(o, [_c("bet365", 1.80)], _reg(tmp_path, []), AHORA, AFILADAS)
    assert o.fallo == pf.VALOR and o.motivos == ["base"]
