"""Señal ≠ apuesta, caducidad visible, exposición y casas donde se apuesta.

Lo que pidió la revisión de la pantalla (27-09-2026): que una señal diga de
cuándo son sus datos y hasta cuándo vale, que una caducada no se apunte sin
querer, que lo que se apostó de verdad no pise lo que avisó el sistema, que el
tope del 4 % por partido cuente lo ya apostado, y que solo se recomiende en
casas donde se puede apostar desde España.
"""
from dataclasses import replace
from datetime import datetime, timedelta, timezone

import pytest

from valor import aprendizaje
from valor.nucleo.detector import PREPARTIDO, detectar
from valor.nucleo.modelo import Cuota, Evento
from valor.registro import CASAS_DANI, CASAS_ESPANA, Registro, SenalCaducada

AHORA = datetime.now(timezone.utc).replace(microsecond=0)
EV1 = Evento("e1", "futbol", "LaLiga", "Betis", "Sevilla", AHORA + timedelta(hours=2))
ABIERTO = replace(PREPARTIDO, prob_minima=0.0)


def _c(casa, sel, cuota, ts, ev="e1"):
    return Cuota(ev, casa, "1x2", None, sel, cuota, ts, "prueba")


def _lectura(t, blanda=2.30, casa="bet365.es"):
    return [_c("pinnacle", "local", 2.10, t), _c("pinnacle", "empate", 3.45, t),
            _c("pinnacle", "visitante", 3.70, t), _c(casa, "local", blanda, t)]


def _senal(reg, t=None, blanda=2.30, banca=1000, expuesto=None):
    t = t or AHORA - timedelta(seconds=20)
    cuotas = _lectura(t, blanda)
    reg.guarda_lectura([EV1], cuotas)
    r = detectar({"e1": EV1}, cuotas, banca, t + timedelta(seconds=20), ABIERTO, expuesto=expuesto)
    (op,) = r.oportunidades
    (op_id,) = reg.guarda_oportunidades([op])
    return op_id, op


def _fila(reg, op_id):
    return dict(reg.db.execute("SELECT o.*, e.inicio FROM oportunidades o JOIN eventos e ON e.id=o.evento_id "
                               "WHERE o.id=?", (op_id,)).fetchone())


def test_la_senal_guarda_de_cuando_son_sus_datos_y_contra_que_se_midio(tmp_path):
    reg = Registro(str(tmp_path / "v.db"))
    op_id, op = _senal(reg)
    (item,) = reg.vigentes(False, 60, banca=1000)
    assert item["estado"] == "valida" and item["ts_cuota"] == op.ts_cuota.isoformat()
    assert item["detalle"]["referencias"] == {"pinnacle": 2.10}
    assert set(item["detalle"]["por_metodo"]) and item["detalle"]["edad_max"] == 600
    # Vale hasta 10 min después de la cuota MÁS VIEJA de las que usó.
    assert item["valida_hasta"] == (op.ts_cuota + timedelta(minutes=10)).isoformat()


def test_caduca_a_los_10_minutos_y_no_desaparece(tmp_path):
    reg = Registro(str(tmp_path / "v.db"))
    op_id, op = _senal(reg)
    f = _fila(reg, op_id)
    assert reg.estado_senal(f, op.ts_cuota + timedelta(minutes=9))["estado"] == "valida"
    e = reg.estado_senal(f, op.ts_cuota + timedelta(minutes=10, seconds=1))
    assert e["estado"] == "caducada" and "10 min" in e["motivo"]


def test_cuota_cambiada_si_una_lectura_posterior_da_otra(tmp_path):
    reg = Registro(str(tmp_path / "v.db"))
    op_id, op = _senal(reg)
    reg.guarda_lectura([EV1], [_c("bet365.es", "local", 1.91, AHORA)])
    (item,) = reg.vigentes(False, 60)
    assert item["estado"] == "cambiada" and item["ultima_cuota"] == 1.91
    assert "2.30" in item["motivo"] and "1.91" in item["motivo"]


def test_misma_cuota_leida_despues_sin_senal_nueva_ya_no_vale(tmp_path):
    reg = Registro(str(tmp_path / "v.db"))
    _senal(reg)
    reg.guarda_lectura([EV1], [_c("bet365.es", "local", 2.30, AHORA)])
    (item,) = reg.vigentes(False, 60)
    assert item["estado"] == "caducada" and "ya no la da" in item["motivo"]


def test_las_validas_primero_y_las_caducadas_detras(tmp_path):
    reg = Registro(str(tmp_path / "v.db"))
    viejo = AHORA - timedelta(minutes=30)
    ev2 = Evento("e2", "futbol", "LaLiga", "Getafe", "Osasuna", AHORA + timedelta(hours=3))
    cuotas = [_c(c, s, v, viejo, "e2") for c, s, v in (("pinnacle", "local", 2.1), ("pinnacle", "empate", 3.45),
                                                       ("pinnacle", "visitante", 3.7), ("bet365.es", "local", 2.4))]
    reg.guarda_lectura([ev2], cuotas)
    reg.guarda_oportunidades(detectar({"e2": ev2}, cuotas, 1000, viejo, ABIERTO).oportunidades)
    _senal(reg)
    items = reg.vigentes(False, 60)
    assert [i["estado"] for i in items] == ["valida", "caducada"]


def test_una_caducada_no_se_apunta_sin_querer(tmp_path):
    reg = Registro(str(tmp_path / "v.db"))
    op_id, _ = _senal(reg, t=AHORA - timedelta(minutes=15))
    with pytest.raises(SenalCaducada):
        reg.apuesta_desde_oportunidad(op_id, cuota=2.25, importe=10)
    assert reg.apuestas() == []
    ap = reg.apuesta_desde_oportunidad(op_id, cuota=2.25, importe=10, aun_caducada=True)
    assert reg.db.execute("SELECT fuera_de_plazo FROM apuestas WHERE id=?", (ap,)).fetchone()[0] == 1


def test_la_apuesta_real_no_pisa_la_senal(tmp_path):
    """El sistema vio 2,30; me la dieron a 2,20 y metí menos: quedan las dos cosas."""
    reg = Registro(str(tmp_path / "v.db"))
    op_id, op = _senal(reg)
    ap = reg.apuesta_desde_oportunidad(op_id, cuota=2.20, importe=5, limitada=True)
    a = dict(reg.db.execute("SELECT * FROM apuestas WHERE id=?", (ap,)).fetchone())
    assert (a["cuota"], a["importe"], a["cuota_senal"], a["importe_senal"]) == (2.20, 5, 2.30, op.importe)
    assert a["ev"] == pytest.approx(op.prob_justa * 2.20 - 1) and a["limitada"] == 1 and a["fuera_de_plazo"] == 0
    s = reg.db.execute("SELECT cuota, importe FROM oportunidades WHERE id=?", (op_id,)).fetchone()
    assert (s["cuota"], s["importe"]) == (2.30, op.importe)
    assert aprendizaje.limitaciones(reg) == [{"casa": "bet365.es", "apuestas": 1, "limitadas": 1,
                                              "ultima_limitada": a["creada"]}]


def test_el_tope_por_partido_cuenta_lo_ya_apostado(tmp_path):
    reg = Registro(str(tmp_path / "v.db"))
    op_id, op = _senal(reg, blanda=2.60)              # mucho valor: pide el tope del 2 %
    assert op.importe == 20
    reg.apuesta_desde_oportunidad(op_id, importe=35)
    assert reg.expuesto_por_evento() == {"e1": 35}
    # Con 35 € ya puestos en el partido, el 4 % de 1000 deja sitio para 5.
    (item,) = reg.vigentes(False, 60, banca=1000)
    assert item["importe_max"] == 5 and item["ya_apostado"] == 35
    _, op2 = _senal(reg, blanda=2.60, expuesto=reg.expuesto_por_evento())
    assert op2.importe == 5
    expo = reg.exposicion(1000)
    assert expo["total"] == 35 and expo["pct"] == 0.035
    assert expo["partidos"][0]["partido"] == "Betis – Sevilla" and expo["partidos"][0]["queda"] == 5


def test_solo_se_recomienda_donde_se_puede_apostar(tmp_path, monkeypatch):
    t = AHORA - timedelta(seconds=20)
    cuotas = _lectura(t, casa="unibet_fr")
    reglas = replace(ABIERTO, apostables=CASAS_ESPANA)
    r = detectar({"e1": EV1}, cuotas, 1000, AHORA, reglas)
    assert r.oportunidades == [] and r.descartes["casa donde no apuestas"] == 1

    monkeypatch.delenv("VALOR_CASAS", raising=False)
    reg = Registro(str(tmp_path / "v.db"))
    assert reg.casas_apostables() == list(CASAS_DANI) == ["codere.es", "pokerstars.es", "gamdom"]
    monkeypatch.setenv("VALOR_CASAS", "*")
    assert reg.casas_apostables() is None
    reg.pon_ajuste("casas_apostables", ["bet365.es"])            # lo que elijas en pantalla manda
    assert reg.casas_apostables() == ["bet365.es"]


def test_el_historial_solo_tiene_lecturas_reales(tmp_path):
    reg = Registro(str(tmp_path / "v.db"))
    antes = AHORA - timedelta(minutes=50)
    reg.guarda_lectura([EV1], [_c("pinnacle", "local", 2.30, antes), _c("bet365.es", "local", 2.30, antes)])
    op_id, _ = _senal(reg)
    h = reg.historial_senal(op_id)
    # Por hora; a la misma hora, primero la casa y luego la referencia.
    assert [(x["casa"], x["cuota"], x["referencia"]) for x in h["lecturas"]] == [
        ("bet365.es", 2.30, False), ("pinnacle", 2.30, True), ("bet365.es", 2.30, False), ("pinnacle", 2.10, True)]
    assert reg.historial_senal(9999) is None


def _avisos_con_clv(reg, n, clv):
    for i in range(n):
        reg.db.execute(
            "INSERT INTO oportunidades (detectada, evento_id, mercado, linea, seleccion, casa, cuota, prob_justa,"
            " ev, importe, en_vivo, motivos, avisos, sospechosa, fallo, clv) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            ((AHORA - timedelta(days=n - i)).isoformat(), f"ev{i}", "1x2", None, "local", "bet365.es", 1.85,
             0.58, 0.07, 10, 0, "[]", "[]", 0, "valor", clv(i)))
    reg.db.commit()


@pytest.mark.parametrize("n,estado", [(29, "aprendiendo"), (30, "de confianza")])
def test_con_29_avisos_no_se_decide_nada_y_con_30_si(tmp_path, n, estado):
    reg = Registro(str(tmp_path / "v.db"))
    _avisos_con_clv(reg, n, lambda i: 0.02 + (0.01 if i % 2 else -0.01))
    (s,) = aprendizaje.segmentos(reg)
    assert s.n == n and s.estado == estado
    d = s.dict()
    assert d["clv_mediana"] == pytest.approx(0.02, abs=0.011) and d["pct_bate"] == 1.0


def test_resumen_mediana_porcentaje_y_semanas(tmp_path):
    reg = Registro(str(tmp_path / "v.db"))
    _avisos_con_clv(reg, 5, lambda i: [0.10, -0.02, 0.01, 0.03, -0.01][i])
    r = aprendizaje.resumen(reg)
    assert r["avisos"] == 5 and r["clv_mediana"] == 0.01 and r["pct_bate"] == 0.6
    assert r["clv_medio"] == pytest.approx(0.022) and r["acumulado"][-1]["clv"] == pytest.approx(0.11)
    assert sum(s["n"] for s in r["semanas"]) == 5



def test_lo_que_se_queda_cerca_se_guarda_aparte_y_no_se_recomienda(tmp_path):
    """Rice +14,5 en Gamdom (27-09): +2,8 % pero sale el 59 %. No es apuesta con
    tus reglas; se enseña en «lo más cerca» diciendo por qué, y nada más."""
    reg = Registro(str(tmp_path / "v.db"))
    t = AHORA - timedelta(seconds=20)
    ev = Evento("e9", "americanfootball", "NCAA", "Fresno State", "Rice", AHORA + timedelta(hours=3))
    cuotas = [Cuota("e9", "pinnacle", "handicap", -14.5, "local", 2.30, t, "oddspapi"),
              Cuota("e9", "pinnacle", "handicap", -14.5, "visitante", 1.64, t, "oddspapi"),
              Cuota("e9", "gamdom", "handicap", -14.5, "visitante", 1.75, t, "oddspapi"),
              Cuota("e9", "gamdom", "handicap", -14.5, "local", 2.05, t, "oddspapi")]
    reg.guarda_lectura([ev], cuotas)
    reglas = replace(PREPARTIDO, prob_minima=0.60, cuota_minima=1.70, apostables=("gamdom",))
    r = detectar({"e9": ev}, cuotas, 1000, AHORA, reglas)
    assert r.oportunidades == [] and r.sospechosas == []
    (c,) = r.casi                                   # el local a 2,05 no tiene ventaja: no sale
    assert (c.casa, c.seleccion, c.cuota) == ("gamdom", "visitante", 1.75) and c.ev > 0
    assert c.avisos[0].startswith("Sale el 5") and "." in c.avisos[0].split("%")[0] and "mínimo es el 60" in c.avisos[0]
    reg.guarda_oportunidades(r.casi, casi=True)
    assert reg.vigentes(False, 60) == []            # no aparece como apuesta
    (x,) = reg.casi_recientes()
    assert x["casa"] == "gamdom" and x["avisos"][0] == c.avisos[0]
    assert aprendizaje.segmentos(reg) == [] and aprendizaje.resumen(reg)["avisos"] == 0


def test_sin_ventaja_o_con_la_escalera_rota_no_es_casi(tmp_path):
    t = AHORA - timedelta(seconds=20)
    ev = Evento("e8", "americanfootball", "NFL", "Chicago Bears", "Philadelphia Eagles", AHORA + timedelta(hours=3))
    c = [Cuota("e8", "pinnacle", "handicap", 4.5, "local", 1.74, t), Cuota("e8", "pinnacle", "handicap", 4.5, "visitante", 2.20, t),
         Cuota("e8", "pinnacle", "handicap", 3.5, "local", 1.862, t), Cuota("e8", "pinnacle", "handicap", 3.5, "visitante", 2.05, t),
         Cuota("e8", "pokerstars.es", "handicap", 3.5, "local", 1.80, t),
         Cuota("e8", "pokerstars.es", "handicap", 4.5, "local", 1.91, t)]
    r = detectar({"e8": ev}, c, 1000, AHORA, replace(PREPARTIDO, prob_minima=0.60))
    # El +4,5 a 1,91 sale el 56 % y tendría «+6,6 %», pero su escalera no cuadra.
    assert r.casi == [] and r.oportunidades == []



def test_lo_mas_cerca_es_solo_lo_de_la_ultima_lectura(tmp_path):
    """Cada lectura sustituye a la anterior: lo que ya no sale (o sale ahora
    como sospechoso) no se queda horas en pantalla."""
    reg = Registro(str(tmp_path / "v.db"))
    reg.db.execute("CREATE TABLE IF NOT EXISTS uso (fuente TEXT, ts TEXT, coste INTEGER, error TEXT)")
    reg.guarda_lectura([EV1], [])
    _, op = _senal(reg)
    op.fuente = "oddspapi"
    reg.db.execute("INSERT INTO uso VALUES ('oddspapi', ?, 2, NULL)", ((AHORA - timedelta(minutes=5)).isoformat(),))
    reg.guarda_oportunidades([op], casi=True)
    assert len(reg.casi_recientes()) == 1
    # Una lectura nueva de esa fuente, en la que ya no sale:
    reg.db.execute("INSERT INTO uso VALUES ('oddspapi', ?, 2, NULL)",
                   ((datetime.now(timezone.utc) + timedelta(seconds=5)).isoformat(),))
    assert reg.casi_recientes() == []
