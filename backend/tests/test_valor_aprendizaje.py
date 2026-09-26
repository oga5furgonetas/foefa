import random
from datetime import datetime, timedelta, timezone

import pytest

from valor import aprendizaje
from valor.nucleo.modelo import Evento, Oportunidad
from valor.registro import Registro

AHORA = datetime(2026, 9, 27, 12, 0, tzinfo=timezone.utc)


def _siembra(reg, casa, n, clv_medio, ruido=0.03, cuota=1.85, semilla=1):
    rnd = random.Random(semilla)
    for i in range(n):
        eid = f"{casa}-{i}"
        reg.db.execute("INSERT OR IGNORE INTO eventos VALUES (?,?,?,?,?,?,?)",
                       (eid, "futbol", "L", "A", "B", AHORA.isoformat(), 0))
        reg.db.execute(
            "INSERT INTO oportunidades (detectada, evento_id, mercado, linea, seleccion, casa, cuota,"
            " prob_justa, ev, importe, en_vivo, motivos, avisos, clv) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (AHORA.isoformat(), eid, "1x2", None, "local", casa, cuota, 0.6, 0.05, 10, 0, "[]", "[]",
             clv_medio + rnd.gauss(0, ruido)))
        # el mismo aviso repetido en otra vuelta NO cuenta dos veces
        reg.db.execute(
            "INSERT INTO oportunidades (detectada, evento_id, mercado, linea, seleccion, casa, cuota,"
            " prob_justa, ev, importe, en_vivo, motivos, avisos, clv) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (AHORA.isoformat(), eid, "1x2", None, "local", casa, cuota, 0.6, 0.05, 10, 0, "[]", "[]", 0.5))
    reg.db.commit()


def _op(casa, cuota=1.85):
    e = Evento("x", "futbol", "L", "A", "B", AHORA + timedelta(hours=2))
    return Oportunidad(e, "1x2", None, "local", casa, cuota, 0.6, 1.66, 0.05, 10, ["pinnacle"], {}, 5, ["base"])


def test_segmentos_deciden_con_datos_y_no_con_suerte(tmp_path):
    reg = Registro(str(tmp_path / "v.db"))
    _siembra(reg, "mala", 60, -0.03)          # sus chollos no baten el cierre
    _siembra(reg, "buena", 60, +0.03)
    _siembra(reg, "pocas", 10, -0.10)         # muy negativa, pero 10 avisos no dicen nada
    est = {s.clave[0]: s for s in aprendizaje.segmentos(reg)}
    assert est["mala"].n == 60                # los repetidos no cuentan
    assert est["mala"].estado == "apagado"
    assert est["buena"].estado == "de confianza"
    assert est["pocas"].estado == "aprendiendo"


def test_aplicar_apaga_y_marca(tmp_path):
    reg = Registro(str(tmp_path / "v.db"))
    _siembra(reg, "mala", 60, -0.03)
    _siembra(reg, "buena", 60, +0.03)
    descartes = {}
    quedan = aprendizaje.aplicar(reg, [_op("mala"), _op("buena"), _op("nueva")], descartes)
    assert [o.casa for o in quedan] == ["buena", "nueva"]
    assert descartes["segmento que no bate el cierre"] == 1
    assert quedan[0].motivos[0].startswith("DE CONFIANZA")
    # otro rango de cuota es otro segmento: no se apaga por lo de 1,70-1,99
    assert aprendizaje.aplicar(reg, [_op("mala", cuota=2.3)], {})


def test_apuesta_manual(tmp_path):
    reg = Registro(str(tmp_path / "v.db"))
    ap = reg.apuesta_manual("Sevilla gana al Getafe", "Bet365", 1.85, 100)
    reg.liquida(ap, "ganada")
    b = reg.balance()
    assert b["beneficio"] == pytest.approx(85) and b["apuestas"] == 1
    with pytest.raises(ValueError):
        reg.apuesta_manual("", "bet365", 1.85, 100)
    with pytest.raises(ValueError):
        reg.apuesta_manual("x", "bet365", 0.9, 100)
