# -*- coding: utf-8 -*-
"""Quién lleva qué furgoneta: la puntuación, el reparto óptimo y la fila de OGA5.

Todo contra `afinidad.py` de verdad, sin base de datos."""
import random
import time
from datetime import date, timedelta

import afinidad as af
from afinidad import Contexto, Fija, Fila

HOY = date(2026, 9, 28)


def ctx(fijas=None, pares=(), **k):
    return Contexto(fijas=fijas or {}, hist=af.historial(pares, HOY), **k)


def por_fila(res):
    return {p.fila: p for p in res["propuestas"]}


def dia(n):
    return (HOY - timedelta(days=n)).isoformat()


# ── LO BÁSICO ────────────────────────────────────────────────────────────────

def test_la_principal_va_a_su_dueno():
    c = ctx({"juan": Fija(principal="X")})
    r = por_fila(af.repartir([Fila(0, "juan")], ["W", "X", "Y"], c))
    assert r[0].furgo == "X" and r[0].tipo == "principal" and r[0].aplicar
    assert "su furgoneta principal" in r[0].motivos


def test_dos_con_la_misma_principal_el_titular_se_la_queda_y_el_otro_va_a_su_secundaria():
    c = ctx({"juan": Fija(principal="X", secundaria="Y"),
             "paco": Fija(principal="X", secundaria="Z", titular=True)})
    r = por_fila(af.repartir([Fila(0, "juan"), Fila(1, "paco")], ["X", "Y", "Z"], c))
    assert r[1].furgo == "X"
    assert r[0].furgo == "Y" and r[0].tipo == "secundaria" and r[0].aplicar


def test_sin_titular_se_la_queda_quien_mas_la_ha_llevado():
    pares = [(dia(k), "paco", "X") for k in range(1, 8)] + [(dia(k), "juan", "Q") for k in range(1, 8)]
    c = ctx({"juan": Fija(principal="X", secundaria="Y"), "paco": Fija(principal="X", secundaria="Z")}, pares)
    r = por_fila(af.repartir([Fila(0, "juan"), Fila(1, "paco")], ["X", "Y", "Z"], c))
    assert r[1].furgo == "X" and r[0].furgo == "Y"


def test_el_reparto_es_optimo_no_el_primero_que_llega():
    """Fila a fila, Juan (primero) se quedaría la X y Paco sin nada. Óptimo: Paco
    la X (su única) y Juan su secundaria."""
    c = ctx({"juan": Fija(principal="X", secundaria="Y"), "paco": Fija(principal="X")})
    r = por_fila(af.repartir([Fila(0, "juan"), Fila(1, "paco")], ["X", "Y"], c))
    assert r[1].furgo == "X" and r[0].furgo == "Y"
    assert r[0].aplicar and r[1].aplicar


def test_lo_puesto_a_mano_manda_y_ocupa_su_furgoneta():
    c = ctx({"juan": Fija(principal="X", secundaria="Y")})
    res = af.repartir([Fila(0, "paco", furgo="X"), Fila(1, "juan")], ["X", "Y"], c)
    r = por_fila(res)
    assert 0 not in r                          # la fila a mano no se toca
    assert r[1].furgo == "Y"


def test_furgoneta_en_taller_no_se_asigna_y_pasa_a_la_secundaria():
    c = ctx({"juan": Fija(principal="X", secundaria="Y")})
    r = por_fila(af.repartir([Fila(0, "juan")], ["Y", "Z"], c))   # X no está operativa
    assert r[0].furgo == "Y" and r[0].tipo == "secundaria"


def test_el_historial_solo_sugiere_y_completar_lo_rellena():
    pares = [(dia(k), "juan", "Y") for k in range(1, 10)]
    c = ctx({}, pares)
    r = por_fila(af.repartir([Fila(0, "juan")], ["X", "Y"], c))
    assert r[0].furgo == "Y" and r[0].tipo == "historial" and not r[0].aplicar
    r = por_fila(af.repartir([Fila(0, "juan")], ["X", "Y"], c, completar=True))
    assert r[0].aplicar


def test_sin_furgoneta_fija_nunca_se_le_rellena_aunque_tenga_principal():
    c = ctx({"juan": Fija(principal="X", sin_auto=True)})
    res = af.repartir([Fila(0, "juan")], ["X"], c, completar=True)
    assert not por_fila(res)[0].aplicar and res["sin_furgo"] == [0]


def test_una_vetada_no_sale_ni_de_sugerencia():
    c = ctx({"juan": Fija(vetadas=("X",))})
    res = af.repartir([Fila(0, "juan")], ["X"], c, completar=True)
    assert res["propuestas"] == [] and res["sin_furgo"] == [0]


def test_nombre_que_no_casa_con_nadie_no_recibe_nada():
    res = af.repartir([Fila(0, None)], ["X"], ctx({}))
    assert res["propuestas"] == [] and res["sin_furgo"] == []


def test_hora():
    assert af.hora_min("11:40") == 700 and af.hora_min("9.05") == 545 and af.hora_min("25:00") is None


# ── LA FILA DE OGA5 ──────────────────────────────────────────────────────────

def test_fila_da_otra_a_mano_antes_que_mover_una():
    """V1 delante de V2. Juan sale a las 11:00 y su principal es V2 (detrás);
    Paco sale a las 12:40 con V1 (delante). Hay V3 suelta: Juan no se lleva la
    suya hoy (sugerida la V3) y NO se mueve nada."""
    c = ctx({"juan": Fija(principal="V2"), "paco": Fija(principal="V1")})
    filas = [Fila(0, "juan", salida=660), Fila(1, "paco", salida=760)]
    res = af.repartir(filas, ["V1", "V2", "V3"], c, filas_aparcamiento=[["V1", "V2"]])
    r = por_fila(res)
    assert r[1].furgo == "V1" and r[1].aplicar
    assert r[0].furgo == "V3" and not r[0].aplicar
    assert res["mover"] == []


def test_fila_con_una_en_taller_delante_dice_que_hay_que_moverla():
    c = ctx({"juan": Fija(principal="V1")})
    res = af.repartir([Fila(0, "juan", salida=660)], ["V1"], c,
                      filas_aparcamiento=[["T", "V1"]], no_operativas=["T"])
    assert por_fila(res)[0].furgo == "V1"
    assert res["mover"] == [{"furgo": "T", "antes_de": 660, "motivo": "no sale hoy"}]


def test_fila_intercambia_si_asi_nadie_queda_tapado():
    """Sin más furgonetas: la que sale antes se lleva la de delante."""
    c = ctx({})
    filas = [Fila(0, "tarde", salida=760), Fila(1, "pronto", salida=660)]
    res = af.repartir(filas, ["V1", "V2"], c, completar=True, filas_aparcamiento=[["V1", "V2"]])
    r = por_fila(res)
    assert r[1].furgo == "V1" and r[0].furgo == "V2" and res["mover"] == []


def test_conflictos_de_la_plantilla_tal_como_esta():
    filas = [Fila(0, "a", "A", 760), Fila(1, "b", "B", 660), Fila(2, "d", "D", 700)]
    conf = af.conflictos_fila(filas, [["A", "B"], ["C", "D"]])
    assert {"fila": 0, "tapa": "A", "a": "B", "hora": 660, "hora_tapa": 760, "motivo": "sale_despues"} in conf
    assert {"fila": 1, "tapa": "C", "a": "D", "hora": 700, "motivo": "no_sale"} in conf
    assert len(conf) == 2


def test_fila_de_tamano_real_resuelve_rapido_y_sin_tapar_a_nadie():
    """OGA5 de verdad: 36 conductores, 37 furgonetas en 4 filas, 4 tandas."""
    rnd = random.Random(7)
    furgos = ["F%02d" % k for k in range(37)]
    orden = furgos[:]
    rnd.shuffle(orden)
    carriles = [orden[0:10], orden[10:20], orden[20:29], orden[29:37]]
    tandas = [660, 700, 720, 760]
    fijas = {}
    for k in range(36):
        fijas["c%d" % k] = Fija(principal=rnd.choice(furgos), secundaria=rnd.choice(furgos))
    filas = [Fila(k, "c%d" % k, salida=rnd.choice(tandas)) for k in range(36)]
    t0 = time.time()
    res = af.repartir(filas, furgos, ctx(fijas), completar=True, filas_aparcamiento=carriles)
    assert time.time() - t0 < 20
    asignadas = {p.fila: p.furgo for p in res["propuestas"] if p.aplicar}
    assert len(set(asignadas.values())) == len(asignadas)
    final = [Fila(r.i, r.conductor, asignadas.get(r.i), r.salida) for r in filas]
    movidas = {m["furgo"] for m in res["mover"]}
    quedan = [c for c in af.conflictos_fila(final, carriles) if c["tapa"] not in movidas]
    assert quedan == [], quedan[:3]


# ── EL CUIDADO: HECHOS, Y SOLO CUENTA SI PREDICE ─────────────────────────────

def test_cuidado_suavizado_con_pocos_dias_nadie_es_malo_ni_bueno():
    cu = af.cuidado({"nuevo": 2, "limpio": 60, "golpes": 60, "resto": 600},
                    {"nuevo": 1, "golpes": 3, "resto": 6}, {})
    assert cu["nuevo"].indice is None
    assert cu["limpio"].indice > 0 > cu["golpes"].indice


def test_cuidado_predice_solo_si_de_verdad_predice():
    dias_lista = ["2026-%02d-%02d" % (m, d) for m in (6, 7, 8) for d in range(1, 29)]
    dias = {"c%d" % k: dias_lista[:] for k in range(30)}
    mitad = dias_lista[len(dias_lista) // 2]
    # Los 10 primeros dan golpes SIEMPRE (antes y después): sí predice.
    ev = [(d, "c%d" % k, 1.0) for k in range(10) for d in dias_lista[::6]]
    ok, por = af.cuidado_predice(ev, dias)
    assert ok, por
    # Golpes al azar antes y después: no predice. Se mide la tasa de falsos
    # positivos con 200 repartos al azar: tiene que quedar cerca del 5 %.
    falsos = 0
    for semilla in range(200):
        rnd = random.Random(semilla)
        ev = [(rnd.choice(dias_lista), "c%d" % rnd.randrange(30), 1.0) for _ in range(80)]
        falsos += af.cuidado_predice(ev, dias)[0]
    assert falsos <= 14, falsos                # ≤ 7 %
    # Como hoy en Flota: poquísimos golpes seguros después del corte.
    ev = [(d, "c1", 1.0) for d in dias_lista if d < mitad][:10]
    ok, por = af.cuidado_predice(ev, dias)
    assert not ok and "segunda mitad" in por


def test_sin_cuidado_activo_no_cambia_el_reparto():
    cu = {"limpio": af.Cuidado(60, 0, 0, 1.0), "golpes": af.Cuidado(60, 5, 2, -1.0)}
    c = ctx({}, (), cuidado=cu, cuidado_activo=False, valor={"NUEVA": 1.0})
    s1, _ = af.puntos("limpio", "NUEVA", c)
    s2, _ = af.puntos("golpes", "NUEVA", c)
    assert s1 == s2 == 0
    c.cuidado_activo = True
    assert af.puntos("limpio", "NUEVA", c)[0] > 0 > af.puntos("golpes", "NUEVA", c)[0]


def test_la_nota_de_responsabilidad_cuenta_siempre_y_pesa_mas_en_una_nueva():
    c = ctx({"formal": Fija(responsabilidad=9), "flojo": Fija(responsabilidad=2)}, (),
            cuidado_activo=False, valor={"NUEVA": 1.0, "VIEJA": 0.4})
    assert af.puntos("formal", "NUEVA", c)[0] > af.puntos("formal", "VIEJA", c)[0] > 0
    assert af.puntos("flojo", "NUEVA", c)[0] < af.puntos("flojo", "VIEJA", c)[0] < 0
    # Dos sin fija y una nueva y una vieja: la nueva va al de más nota.
    r = por_fila(af.repartir([Fila(0, "flojo"), Fila(1, "formal")], ["NUEVA", "VIEJA"], c, completar=True))
    assert r[1].furgo == "NUEVA" and r[0].furgo == "VIEJA"
    assert "furgoneta cuidada para alguien de confianza" in r[1].motivos


def test_nota_y_golpes_se_promedian():
    cu = {"x": af.Cuidado(60, 0, 0, -1.0)}
    c = ctx({"x": Fija(responsabilidad=10)}, (), cuidado=cu, cuidado_activo=True)
    assert af.indice_cuidado("x", c) == 0.0
    c.cuidado_activo = False
    assert af.indice_cuidado("x", c) == 1.0


def test_valor_de_la_furgoneta():
    assert af.valor_furgo("nueva", "2026-09-01", None, 0, HOY)[0] == 1.0
    assert af.valor_furgo(None, None, "2026-09-20", 0, HOY) == (0.8, "recién salida del taller")
    assert af.valor_furgo(None, None, "2026-06-01", 4, HOY)[0] == 0.2
    assert af.valor_furgo(None, None, None, 0, HOY)[0] == 0.4


# ── APRENDE: PROPONE, NO CAMBIA SOLO ─────────────────────────────────────────

def test_sugiere_fija_a_quien_lleva_la_misma_4_de_6_dias():
    pares = [(dia(1), "juan", "Y"), (dia(2), "juan", "Y"), (dia(3), "juan", "Z"),
             (dia(4), "juan", "Y"), (dia(5), "juan", "Y"), (dia(6), "juan", "Q")]
    c = ctx({"juan": Fija(principal="X")}, pares)
    s = af.sugerir_fijas(["juan"], c, {"X", "Y", "Z"})
    assert s == [{"conductor": "juan", "furgo": "Y", "veces": 4, "de": 6, "tenia": "X"}]
    c = ctx({"juan": Fija(principal="Y")}, pares)
    assert af.sugerir_fijas(["juan"], c, {"X", "Y", "Z"}) == []


def test_propuesta_inicial_comparte_solo_entre_quien_no_coincide():
    lunes_miercoles = {dia(k) for k in range(1, 29) if k % 2}
    martes_jueves = {dia(k) for k in range(1, 29) if not k % 2}
    pares = [(d, "a", "X") for d in lunes_miercoles] + [(d, "b", "X") for d in martes_jueves] \
        + [(d, "c", "X") for d in lunes_miercoles]
    h = af.historial(pares, HOY)
    trab = {"a": lunes_miercoles, "b": martes_jueves, "c": set(lunes_miercoles)}
    p = af.propuesta_inicial(["a", "b", "c"], ["X", "Y"], h, trab, {})
    assert p["a"]["principal"] == "X" and p["b"]["principal"] == "X"   # no coinciden nunca
    assert p["c"]["principal"] == "Y"                                   # coincide con «a» siempre
    assert p["b"]["comparte_con"] == ["a"]


def test_propuesta_inicial_un_solo_titular_por_furgoneta_el_que_mas_la_lleva():
    lun = {dia(k) for k in range(1, 29) if k % 3 == 0}
    mar = {dia(k) for k in range(1, 29) if k % 3 == 1}
    mie = {dia(k) for k in range(1, 29) if k % 3 == 2}
    pares = [(d, "poco", "X") for d in list(lun)[:2]] + [(d, "mucho", "X") for d in mar]         + [(d, "medio", "X") for d in list(mie)[:5]]
    h = af.historial(pares, HOY)
    trab = {"poco": lun, "mucho": mar, "medio": mie}
    p = af.propuesta_inicial(["poco", "mucho", "medio"], ["X"], h, trab, {}, carga_max=1.2)
    titulares = [c for c, x in p.items() if x["principal"] == "X" and x["titular"]]
    assert titulares == ["mucho"], p


def test_la_secundaria_es_la_que_suele_estar_libre_sus_dias():
    """Ana y Gema trabajan todos los días: la principal de Gema (Y) no le sirve a
    Ana de secundaria aunque la haya llevado; la Z, que no es de nadie, sí."""
    todos = {dia(k) for k in range(1, 29)}
    pares = [(d, "ana", "X") for d in list(todos)[:20]] + [(d, "ana", "Y") for d in list(todos)[20:]]         + [(d, "gema", "Y") for d in list(todos)[:20]]
    h = af.historial(pares, HOY)
    p = af.propuesta_inicial(["ana", "gema"], ["X", "Y", "Z"], h, {"ana": todos, "gema": todos}, {})
    assert p["ana"]["principal"] == "X" and p["gema"]["principal"] == "Y"
    assert p["ana"]["secundaria"] == "Z"


def test_a_quien_la_nueva_por_hechos():
    cu = {"limpio": af.Cuidado(60, 0, 0), "posible": af.Cuidado(60, 0, 2),
          "seguro": af.Cuidado(60, 2, 0), "poco": af.Cuidado(3, 0, 0)}
    c = ctx({"limpio": Fija(principal="Q")}, (), cuidado=cu)
    orden = [x["conductor"] for x in af.a_quien("NUEVA", cu.keys(), c)]
    assert orden == ["limpio", "posible", "seguro"]        # «poco»: menos de 5 días, fuera
    # La nota de la oficina va por delante de los hechos.
    c.fijas["seguro"] = Fija(responsabilidad=9)
    assert [x["conductor"] for x in af.a_quien("NUEVA", cu.keys(), c)][0] == "seguro"
