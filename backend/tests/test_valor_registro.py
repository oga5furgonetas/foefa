from datetime import datetime, timedelta, timezone

import pytest

from valor.nucleo.detector import detectar
from valor.nucleo.modelo import Cuota, Evento
from valor.registro import Registro

AHORA = datetime.now(timezone.utc).replace(microsecond=0)


@pytest.fixture(autouse=True)
def _ahora_de_cada_prueba():
    """«Ahora» al empezar cada prueba, no al importar: en la batería entera llegaba viejo (ver test_valor_senales)."""
    global AHORA
    AHORA = datetime.now(timezone.utc).replace(microsecond=0)


def _c(casa, sel, cuota, ts, mercado="1x2"):
    return Cuota("e1", casa, mercado, None, sel, cuota, ts, "prueba")


def test_del_aviso_a_la_apuesta_y_al_clv(tmp_path):
    reg = Registro(str(tmp_path / "v.db"))
    ev = Evento("e1", "futbol", "LaLiga", "Betis", "Sevilla", AHORA + timedelta(hours=2))
    t0 = AHORA - timedelta(seconds=20)
    cuotas = [_c("pinnacle", "local", 2.10, t0), _c("pinnacle", "empate", 3.45, t0),
              _c("pinnacle", "visitante", 3.70, t0), _c("bet365", "local", 2.30, t0)]
    reg.guarda_lectura([ev], cuotas)
    reg.guarda_lectura([ev], cuotas)            # la misma lectura dos veces no duplica
    assert reg.db.execute("SELECT COUNT(*) FROM cuotas").fetchone()[0] == 4

    r = detectar({"e1": ev}, cuotas, 1000, AHORA)
    (op_id,) = reg.guarda_oportunidades(r.oportunidades)
    ap = reg.apuesta_desde_oportunidad(op_id, cuota=2.28)

    # Justo antes de empezar Pinnacle baja al local: el mercado nos dio la razón.
    t1 = AHORA + timedelta(hours=1, minutes=59)
    reg.guarda_lectura([ev], [_c("pinnacle", "local", 1.98, t1), _c("pinnacle", "empate", 3.55, t1),
                              _c("pinnacle", "visitante", 4.00, t1)])
    # El partido empieza: se mueve el reloj cambiando el inicio al pasado.
    reg.db.execute("UPDATE eventos SET inicio=?", ((AHORA - timedelta(minutes=1)).isoformat(),))
    reg.db.execute("UPDATE cuotas SET ts=? WHERE cuota IN (1.98, 3.55, 4.00)",
                   ((AHORA - timedelta(minutes=2)).isoformat(),))
    assert reg.calcula_clv() == 2          # la apuesta y el aviso del que salió
    a = reg.apuestas()[0]
    assert a["cuota_justa_cierre"] < 2.28 and a["clv"] > 0

    reg.liquida(ap, "perdida")
    b = reg.balance()
    assert b["beneficio"] == -a["importe"] and b["clv_medio"] > 0 and b["cerradas"] == 1


def test_liquidar_con_resultado_raro_falla(tmp_path):
    reg = Registro(str(tmp_path / "v.db"))
    with pytest.raises(ValueError):
        reg.liquida(1, "casi")
