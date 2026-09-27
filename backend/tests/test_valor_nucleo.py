from datetime import datetime, timedelta, timezone

import pytest

from valor.nucleo import margen as mg
from valor.nucleo.detector import EN_VIVO, PREPARTIDO, detectar
from valor.nucleo.modelo import Cuota, Evento
from valor.nucleo.stake import ReglasStake, importe, kelly

AHORA = datetime(2026, 9, 27, 12, 0, tzinfo=timezone.utc)


# ── margen ────────────────────────────────────────────────────────────────

def test_margen_simetrico_da_mitad_y_mitad_con_todos_los_metodos():
    for nombre, p in mg.justas([1.90, 1.90]).items():
        assert p == pytest.approx([0.5, 0.5], abs=1e-9), nombre


def test_todos_los_metodos_suman_uno():
    for cuotas in ([1.45, 4.6, 7.5], [1.05, 12.0], [2.1, 3.3, 3.6], [1.01, 30.0]):
        for nombre, p in mg.justas(cuotas).items():
            assert sum(p) == pytest.approx(1.0, abs=1e-9), (nombre, cuotas)
            assert all(0 < x < 1 for x in p), (nombre, cuotas)


def test_shin_y_potencia_cargan_mas_margen_al_tapado():
    """Sesgo favorito/tapado: el tapado vale MENOS de lo que dice el proporcional."""
    cuotas = [1.25, 4.20]
    prop = mg.proporcional(cuotas)[1]
    assert mg.shin(cuotas)[1] < prop
    assert mg.potencia(cuotas)[1] < prop


def test_cuota_no_valida():
    with pytest.raises(ValueError):
        mg.margen([1.0, 2.0])


# ── stake ─────────────────────────────────────────────────────────────────

def test_kelly_de_libro():
    # p = 0,55 a cuota 2,00: f = (1,10 − 1) / 1 = 0,10
    assert kelly(0.55, 2.0) == pytest.approx(0.10)
    assert kelly(0.45, 2.0) == 0.0


def test_importe_fraccion_topes_y_redondeo():
    r = ReglasStake(fraccion_kelly=0.25, tope_apuesta=0.02, tope_evento=0.04, minimo=2, redondeo=1)
    # ¼ de 10 % = 2,5 % → tope 2 % de 1000 = 20
    assert importe(0.55, 2.0, 1000, r) == 20.0
    # con 30 ya puestos en el partido solo quedan 10 hasta el 4 %
    assert importe(0.55, 2.0, 1000, r, ya_en_evento=30) == 10.0
    # ventaja mínima: ¼ de Kelly da céntimos → no se apuesta
    assert importe(0.501, 2.0, 1000, r) == 0.0


# ── detector ──────────────────────────────────────────────────────────────

def _evento(en_vivo=False, dentro=timedelta(hours=3)):
    return Evento("e1", "futbol", "LaLiga", "Betis", "Sevilla", AHORA + dentro, en_vivo)


def _c(casa, sel, cuota, hace=10, mercado="1x2", linea=None):
    return Cuota("e1", casa, mercado, linea, sel, cuota, AHORA - timedelta(seconds=hace))


PINNACLE = [_c("pinnacle", "local", 2.10), _c("pinnacle", "empate", 3.45),
            _c("pinnacle", "visitante", 3.70)]


def test_detecta_valor_y_explica_por_que():
    cuotas = PINNACLE + [_c("bet365", "local", 2.30), _c("bet365", "empate", 3.30),
                         _c("bet365", "visitante", 3.40)]
    r = detectar({"e1": _evento()}, cuotas, banca=1000, ahora=AHORA)
    assert len(r.oportunidades) == 1
    op = r.oportunidades[0]
    assert (op.casa, op.seleccion) == ("bet365", "local")
    # Pinnacle 2,10/3,45/3,70: suma 1,0363 → proporcional 0,4762/1,0363 = 45,95 %
    assert op.prob_justa == pytest.approx(0.4595, abs=5e-4)
    assert op.ev == pytest.approx(op.prob_justa * 2.30 - 1)
    assert op.ev == pytest.approx(0.0569, abs=1e-3)
    assert op.importe > 0
    assert any("Cuota justa" in m for m in op.motivos)
    assert any("Meter" in m for m in op.motivos)


def test_usa_el_metodo_menos_favorable():
    cuotas = PINNACLE + [_c("bet365", "local", 2.30)]
    op = detectar({"e1": _evento()}, cuotas, 1000, AHORA).oportunidades[0]
    assert op.prob_justa == min(op.por_metodo.values())


def test_sin_referencia_no_hay_apuesta():
    cuotas = [_c("bet365", "local", 5.0), _c("codere", "local", 2.0)]
    r = detectar({"e1": _evento()}, cuotas, 1000, AHORA)
    assert r.oportunidades == []
    assert r.descartes.get("sin referencia afilada") == 1


def test_referencia_incompleta_no_vale():
    cuotas = PINNACLE[:2] + [_c("bet365", "local", 2.30)]
    assert detectar({"e1": _evento()}, cuotas, 1000, AHORA).oportunidades == []


def test_cuota_vieja_no_cuenta():
    cuotas = PINNACLE + [_c("bet365", "local", 2.30, hace=900)]
    r = detectar({"e1": _evento()}, cuotas, 1000, AHORA)
    assert r.oportunidades == [] and r.descartes["cuota vieja"] == 1


def test_referencia_vieja_no_cuenta():
    viejas = [_c("pinnacle", s, c, hace=900) for s, c in
              (("local", 2.10), ("empate", 3.45), ("visitante", 3.70))]
    r = detectar({"e1": _evento()}, viejas + [_c("bet365", "local", 2.30)], 1000, AHORA)
    assert r.oportunidades == []


def test_ev_enorme_va_a_sospechosas_no_a_recomendadas():
    cuotas = PINNACLE + [_c("bet365", "local", 3.20)]
    r = detectar({"e1": _evento()}, cuotas, 1000, AHORA)
    assert r.oportunidades == []
    assert len(r.sospechosas) == 1


def test_lineas_distintas_no_se_mezclan():
    ref = [_c("pinnacle", "mas", 1.95, mercado="totales", linea=2.5),
           _c("pinnacle", "menos", 1.95, mercado="totales", linea=2.5)]
    blanda = [_c("bet365", "mas", 2.40, mercado="totales", linea=3.0)]
    r = detectar({"e1": _evento()}, ref + blanda, 1000, AHORA)
    assert r.oportunidades == []


def test_partido_empezado_sin_marcar_en_vivo_se_descarta():
    cuotas = PINNACLE + [_c("bet365", "local", 2.30)]
    r = detectar({"e1": _evento(dentro=timedelta(minutes=-5))}, cuotas, 1000, AHORA)
    assert r.oportunidades == [] and r.descartes["ya empezado"] == 1


def test_en_vivo_exige_cuotas_de_segundos():
    ev = _evento(en_vivo=True, dentro=timedelta(minutes=-30))
    frescas = [_c("pinnacle", s, c, hace=3) for s, c in
               (("local", 2.10), ("empate", 3.45), ("visitante", 3.70))]
    assert detectar({"e1": ev}, frescas + [_c("bet365", "local", 2.30, hace=3)],
                    1000, AHORA).oportunidades
    assert not detectar({"e1": ev}, frescas + [_c("bet365", "local", 2.30, hace=30)],
                        1000, AHORA).oportunidades


def test_exchange_descuenta_comision_y_no_se_mide_contra_si_mismo():
    ref = PINNACLE + [_c("betfair_ex_eu", "local", 2.30), _c("betfair_ex_eu", "empate", 3.50),
                      _c("betfair_ex_eu", "visitante", 3.75)]
    r = detectar({"e1": _evento()}, ref, 1000, AHORA)
    # 2,30 con 5 % de comisión = 2,235 efectiva; contra Pinnacle sigue habiendo valor
    op = next(o for o in r.oportunidades if o.casa == "betfair_ex_eu")
    assert op.referencia == ["pinnacle"]
    assert op.ev == pytest.approx(op.prob_justa * (1 + 1.30 * 0.95) - 1)


def test_referencias_que_no_coinciden_anulan_el_mercado():
    otra = [_c("matchbook", "local", 1.80), _c("matchbook", "empate", 3.80),
            _c("matchbook", "visitante", 4.80)]
    r = detectar({"e1": _evento()}, PINNACLE + otra + [_c("bet365", "local", 2.30)], 1000, AHORA)
    assert r.oportunidades == [] and r.descartes["referencias no coinciden"] == 1


def test_tope_por_evento_reparte_entre_apuestas_del_mismo_partido():
    cuotas = PINNACLE + [_c("bet365", "local", 2.30), _c("codere", "local", 2.28),
                         _c("bwin", "local", 2.27)]
    r = detectar({"e1": _evento()}, cuotas, 1000, AHORA)
    total = sum(o.importe for o in r.oportunidades)
    assert total <= PREPARTIDO.stake.tope_evento * 1000
    assert EN_VIVO.ev_minimo > PREPARTIDO.ev_minimo


def test_lineas_con_devolucion_no_se_usan():
    ref = [_c("pinnacle", "mas", 1.95, mercado="totales", linea=2.0),
           _c("pinnacle", "menos", 1.95, mercado="totales", linea=2.0),
           _c("bet365", "mas", 2.15, mercado="totales", linea=2.0)]
    r = detectar({"e1": _evento()}, ref, 1000, AHORA)
    assert r.oportunidades == [] and r.descartes["línea con devolución"] == 1



def test_escalera_de_handicap_rota_va_a_sospechosas():
    """PokerStars, Bears–Eagles (27-09-2026): pagaba 1,80 al Bears +3,5 y 1,91 al
    +4,5. Con más puntos a favor la cuota no puede subir: dato cruzado, no un
    «+6,6 %». La de Gamdom, que baja como debe, sí vale."""
    from dataclasses import replace
    from valor.nucleo.detector import escalera_rota
    ahora = datetime(2026, 9, 27, 12, 0, tzinfo=timezone.utc)
    ev = Evento("nfl", "americanfootball", "NFL", "Chicago Bears", "Philadelphia Eagles", ahora + timedelta(hours=5))
    t = ahora - timedelta(seconds=20)
    c = [Cuota("nfl", "pinnacle", "handicap", 4.5, "local", 1.74, t), Cuota("nfl", "pinnacle", "handicap", 4.5, "visitante", 2.20, t),
         Cuota("nfl", "pinnacle", "handicap", 3.5, "local", 1.862, t), Cuota("nfl", "pinnacle", "handicap", 3.5, "visitante", 2.05, t),
         Cuota("nfl", "pokerstars.es", "handicap", 3.5, "local", 1.80, t),
         Cuota("nfl", "pokerstars.es", "handicap", 3.5, "visitante", 1.91, t),
         Cuota("nfl", "pokerstars.es", "handicap", 4.5, "local", 1.91, t)]
    # (Sin el otro lado del +4,5: si lo tuviera, lo pararía antes el desvío frente
    # a Pinnacle; aquí se prueba la escalera sola.)
    r = detectar({"nfl": ev}, c, 1000, ahora, replace(PREPARTIDO, prob_minima=0.0))
    assert r.oportunidades == []
    (s,) = r.sospechosas
    assert (s.casa, s.linea, s.seleccion) == ("pokerstars.es", 4.5, "local")
    assert "escalera" in s.avisos[-1] and r.descartes["hándicap con la escalera rota"] == 1
    # La de Gamdom en el Dolphins–Chiefs: de +9,5 a +14 la cuota del local baja.
    gamdom = {9.5: {"local": 2.12}, 11.5: {"local": 1.84}, 13.5: {"local": 1.70}, 14.5: {"local": 1.61}}
    assert escalera_rota(gamdom, 13.5) is None
    # Y la del visitante al revés: con más línea del local, la suya no puede bajar.
    assert escalera_rota({2.5: {"visitante": 1.85}, 3.5: {"visitante": 1.70}}, 3.5)



def test_casa_que_no_habla_de_la_misma_apuesta_va_a_sospechosas():
    """Números REALES del 27-09. PokerStars, Bears +4,5: 1,91 / 1,80 (sin margen,
    49 %) contra Pinnacle 1,74 / 2,20 (56 %): 7 puntos, dato cruzado aunque su
    «+6,6 %» no pase del 20 %. Gamdom, Dolphins +13,5: 1,70 / 2,22 (57 %) contra
    Pinnacle 1,602 / 2,41 (60 %): 3,5 puntos, apuesta buena."""
    from dataclasses import replace
    ahora = datetime(2026, 9, 27, 12, 0, tzinfo=timezone.utc)
    t = ahora - timedelta(seconds=20)
    ev1 = Evento("b", "americanfootball", "NFL", "Chicago Bears", "Philadelphia Eagles", ahora + timedelta(hours=5))
    ev2 = Evento("d", "americanfootball", "NFL", "Miami Dolphins", "Kansas City Chiefs", ahora + timedelta(hours=5))
    c = [Cuota("b", "pinnacle", "handicap", 4.5, "local", 1.74, t), Cuota("b", "pinnacle", "handicap", 4.5, "visitante", 2.20, t),
         Cuota("b", "pokerstars.es", "handicap", 4.5, "local", 1.91, t),
         Cuota("b", "pokerstars.es", "handicap", 4.5, "visitante", 1.80, t),
         Cuota("d", "pinnacle", "handicap", 13.5, "local", 1.602, t), Cuota("d", "pinnacle", "handicap", 13.5, "visitante", 2.41, t),
         Cuota("d", "gamdom", "handicap", 13.5, "local", 1.70, t), Cuota("d", "gamdom", "handicap", 13.5, "visitante", 2.22, t)]
    reglas = replace(PREPARTIDO, prob_minima=0.0)
    r = detectar({"b": ev1, "d": ev2}, c, 1000, ahora, reglas)
    assert [(o.casa, o.linea) for o in r.oportunidades] == [("gamdom", 13.5)]
    (s,) = r.sospechosas
    assert (s.casa, s.linea, s.seleccion) == ("pokerstars.es", 4.5, "local") and "otro mercado" in s.avisos[-1]
    assert r.casi == [] and r.descartes["la casa y la referencia no hablan de la misma apuesta"] == 2

