from datetime import datetime, timedelta, timezone

import pytest

from valor.nucleo.modelo import Cuota, Evento
from valor.nucleo.seguras import ReglasSeguras, buscar, repartir

AHORA = datetime(2026, 9, 27, 12, 0, tzinfo=timezone.utc)
EV = {"e1": Evento("e1", "futbol", "LaLiga", "Betis", "Sevilla", AHORA + timedelta(hours=3))}


def _c(casa, sel, cuota, hace=10, mercado="1x2", linea=None):
    return Cuota("e1", casa, mercado, linea, sel, cuota, AHORA - timedelta(seconds=hace))


def test_segura_1x2_gana_pase_lo_que_pase():
    cuotas = [_c("bet365", "local", 2.30), _c("codere", "empate", 3.60), _c("bwin", "visitante", 4.00),
              _c("bwin", "local", 2.10), _c("bet365", "empate", 3.30)]
    (s,) = buscar(EV, cuotas, total=100, ahora=AHORA)
    assert {(p.seleccion, p.casa) for p in s.patas} == {
        ("local", "bet365"), ("empate", "codere"), ("visitante", "bwin")}
    # Cobro en CADA resultado mayor que lo apostado
    for p in s.patas:
        assert p.importe * p.cuota > s.total
    assert s.beneficio > 0 and 0.02 < s.rendimiento < 0.045
    assert s.patas[0].cuota == 4.00            # la más alta primero


def test_sin_margen_a_favor_no_hay_segura():
    cuotas = [_c("bet365", "local", 2.00), _c("codere", "empate", 3.40), _c("bwin", "visitante", 3.80)]
    assert buscar(EV, cuotas, 100, AHORA) == []


def test_cuota_vieja_rompe_la_segura():
    cuotas = [_c("bet365", "local", 2.30), _c("codere", "empate", 3.60),
              _c("bwin", "visitante", 4.00, hace=600)]
    assert buscar(EV, cuotas, 100, AHORA) == []


def test_exchange_con_comision():
    # 2,02 y 2,02: suma 0,990 → segura (+1 %); con el 5 % de Betfair (2,02 → 1,969) deja de serlo
    cuotas = [_c("bet365", "mas", 2.02, mercado="totales", linea=2.5),
              _c("betfair_ex_eu", "menos", 2.02, mercado="totales", linea=2.5)]
    assert buscar(EV, cuotas, 100, AHORA) == []
    cuotas[1] = _c("codere", "menos", 2.02, mercado="totales", linea=2.5)
    assert len(buscar(EV, cuotas, 100, AHORA)) == 1


def test_casas_excluidas_no_cuentan():
    cuotas = [_c("pinnacle", "local", 2.30), _c("codere", "empate", 3.60), _c("bwin", "visitante", 4.00)]
    assert buscar(EV, cuotas, 100, AHORA, ReglasSeguras(excluir=("pinnacle",))) == []


def test_demasiado_buena_avisa():
    cuotas = [_c("bet365", "local", 3.00), _c("codere", "empate", 3.60), _c("bwin", "visitante", 4.00)]
    (s,) = buscar(EV, cuotas, 100, AHORA)
    assert any("Demasiado buena" in a for a in s.avisos)


@pytest.mark.parametrize("cuotas", [[2.30, 3.60, 4.00], [1.05, 25.0], [2.06, 2.06], [1.5, 4.1, 7.9]])
def test_repartir_redondeado_nunca_rompe_la_garantia(cuotas):
    if sum(1 / c for c in cuotas) >= 1:
        pytest.skip("no es segura")
    imp = repartir(cuotas, 100)
    assert all(i == int(i) for i in imp)
    assert all(i * c > sum(imp) for i, c in zip(imp, cuotas))
