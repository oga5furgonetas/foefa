# -*- coding: utf-8 -*-
"""El motor del cuadrante: +2 sobre la máxima, 5+2, 6 seguidos como mucho y
lo que no es suyo no se toca. Todo contra `cuadrante_motor.py`, sin base."""
import datetime as dt
import random
import time

import pytest

import cuadrante_motor as cm

LUNES = dt.date(2026, 10, 5)


def dia(n, base=LUNES):
    return (base + dt.timedelta(days=n)).isoformat()


def entrada(conductores, dias=7, maxima=3, **k):
    e = {
        "fecha_inicio": dia(0), "fecha_fin": dia(dias - 1), "colchon": 2,
        "maximas": {dia(i): maxima for i in range(dias)},
        "conductores": conductores, "celdas": {}, "bloqueadas": [], "segundos": 20,
    }
    e.update(k)
    return e


def gente(n, prefijo="c", **k):
    return [dict({"id": f"{prefijo}{i}", "nombre": f"Persona {i}"}, **k) for i in range(n)]


def trabaja(res, cid, fecha):
    return res["celdas"][f"{cid}|{fecha}"]["valor"] in cm.TRABAJO


def rutas(res, fecha):
    return next(r["planificadas"] for r in res["resumen_dias"] if r["fecha"] == fecha)


def racha_maxima(valores):
    run = mejor = 0
    for v in valores:
        run = run + 1 if v in cm.TRABAJO else 0
        mejor = max(mejor, run)
    return mejor


# ── EL OBJETIVO: MÁXIMA + COLCHÓN ────────────────────────────────────────────

def test_con_gente_de_sobra_cada_dia_queda_justo_a_mas_dos():
    # 10 personas × 5 días = 50 turnos; hacen falta 5 × 7 = 35.
    res = cm.generar_cuadrante(entrada(gente(10), maxima=3))
    for i in range(7):
        assert rutas(res, dia(i)) == 5
        assert next(r for r in res["resumen_dias"] if r["fecha"] == dia(i))["diferencia"] == 2
    assert res["extras"] == 0


def test_nadie_pasa_de_cinco_dias_si_no_hace_falta_y_libra_dos():
    res = cm.generar_cuadrante(entrada(gente(10), maxima=3))
    for c in gente(10):
        n = sum(trabaja(res, c["id"], dia(i)) for i in range(7))
        assert n <= 5


def test_si_no_llega_con_cinco_dias_pone_el_sexto_marcado_como_extra():
    # 6 personas × 5 = 30 turnos; hacen falta 5 × 7 = 35: faltan 5 → 5 extras.
    res = cm.generar_cuadrante(entrada(gente(6), maxima=3))
    for i in range(7):
        assert rutas(res, dia(i)) == 5
    assert res["extras"] == 5
    extras = [k for k, v in res["celdas"].items() if v["extra"]]
    assert len(extras) == 5
    # Cada extra es un 6º día: esa persona trabaja 6 esa semana, nunca 7.
    for k in extras:
        cid = k.split("|")[0]
        assert sum(trabaja(res, cid, dia(i)) for i in range(7)) == 6


def test_sin_permitir_extra_se_queda_corto_y_lo_dice():
    res = cm.generar_cuadrante(entrada(gente(6), maxima=3, permitir_extra=False))
    assert res["extras"] == 0
    assert sum(r["planificadas"] for r in res["resumen_dias"]) == 30
    assert any("colchón" in a or "Falta gente" in a for a in res["avisos"])
    assert res["faltan_conductores"] >= 1


def test_colchon_por_dia_cambia_solo_ese_dia():
    res = cm.generar_cuadrante(entrada(gente(12), maxima=3, colchon_por_dia={dia(4): 3}))
    assert rutas(res, dia(4)) == 6
    assert rutas(res, dia(3)) == 5


# ── LA LEY: 6 DÍAS SEGUIDOS COMO MUCHO ───────────────────────────────────────

def test_cuenta_los_dias_de_antes_del_periodo():
    # Ya lleva 6 días seguidos antes del lunes: el lunes tiene que librar
    # aunque haga falta gente.
    celdas = {f"c0|{dia(-i)}": "1" for i in range(1, 7)}
    res = cm.generar_cuadrante(entrada(gente(3), maxima=3, celdas=celdas))
    assert not trabaja(res, "c0", dia(0))


def test_el_cambio_de_mes_no_rompe_la_cuenta():
    # Del 25 al 30 de septiembre trabajando: el 1 de octubre no puede.
    base = dt.date(2026, 10, 1)
    celdas = {f"c0|{(base - dt.timedelta(days=i)).isoformat()}": "1" for i in range(1, 7)}
    e = {"fecha_inicio": base.isoformat(), "fecha_fin": (base + dt.timedelta(days=4)).isoformat(),
         "maximas": {(base + dt.timedelta(days=i)).isoformat(): 1 for i in range(5)},
         "conductores": gente(2), "celdas": celdas, "segundos": 20}
    res = cm.generar_cuadrante(e)
    assert res["celdas"][f"c0|{base.isoformat()}"]["valor"] != "1"


def test_nadie_trabaja_siete_seguidos_en_dos_semanas_con_mucha_demanda():
    res = cm.generar_cuadrante(entrada(gente(8), dias=14, maxima=6))
    for c in gente(8):
        vals = [res["celdas"][f"{c['id']}|{dia(i)}"]["valor"] for i in range(14)]
        assert racha_maxima(vals) <= 6


# ── LO QUE NO ES SUYO NO LO TOCA ─────────────────────────────────────────────

@pytest.mark.parametrize("cod", ["V", "BAJA", "APROBADO", "N/T APROB", "N/D", "N/P", "COMP", "S", "BKP", "RA", "XYZ"])
def test_los_codigos_protegidos_se_quedan_como_estan(cod):
    celdas = {f"c0|{dia(i)}": cod for i in range(7)}
    res = cm.generar_cuadrante(entrada(gente(8), maxima=3, celdas=celdas))
    for i in range(7):
        c = res["celdas"][f"c0|{dia(i)}"]
        assert c["valor"] == cod and not c["cambiado"]


def test_la_reserva_trabaja_pero_no_cuenta_como_ruta():
    # c0 de reserva toda la semana: cuenta para sus días seguidos, no para el +2.
    celdas = {f"c0|{dia(i)}": "BKP" for i in range(7)}
    res = cm.generar_cuadrante(entrada(gente(12), maxima=3, celdas=celdas))
    for i in range(7):
        assert rutas(res, dia(i)) == 5
        rut = sum(1 for c in gente(12)
                  if res["celdas"][f"{c['id']}|{dia(i)}"]["valor"] in cm.RUTA)
        assert rut == 5


def test_una_celda_fijada_a_mano_se_respeta():
    celdas = {f"c0|{dia(2)}": "N/T", f"c1|{dia(2)}": "1"}
    bloq = [f"c0|{dia(2)}", f"c1|{dia(2)}"]
    res = cm.generar_cuadrante(entrada(gente(10), maxima=3, celdas=celdas, bloqueadas=bloq))
    assert res["celdas"][f"c0|{dia(2)}"]["valor"] == "N/T"
    assert res["celdas"][f"c1|{dia(2)}"]["valor"] == "1"


def test_demasiadas_celdas_fijadas_no_rompen_el_calculo_y_avisa():
    # Seis fijadas a trabajar un día con máxima 1 (objetivo 3): antes no tenía
    # solución; ahora se respeta lo fijado y se avisa de que sobra gente.
    celdas = {f"c{i}|{dia(0)}": "1" for i in range(6)}
    bloq = list(celdas)
    res = cm.generar_cuadrante(entrada(gente(10), maxima=1, celdas=celdas, bloqueadas=bloq))
    assert rutas(res, dia(0)) == 6
    assert any("por encima" in a for a in res["avisos"])


# ── TIPOS DE PERSONA ─────────────────────────────────────────────────────────

def test_empresa_rellena_su_patron_y_respeta_lo_que_ya_tiene():
    conds = gente(8) + [{"id": "e0", "nombre": "Empresa", "tipo": "empresa"},
                        {"id": "e1", "nombre": "Jose Jorge", "tipo": "empresa", "patron": [0, 1, 3, 4, 5]}]
    celdas = {f"e0|{dia(3)}": "N/T"}           # el jueves se lo dio la oficina
    res = cm.generar_cuadrante(entrada(conds, maxima=3, celdas=celdas))
    assert [trabaja(res, "e0", dia(i)) for i in range(7)] == [1, 1, 1, 0, 1, 0, 0]
    assert [trabaja(res, "e1", dia(i)) for i in range(7)] == [1, 1, 0, 1, 1, 1, 0]


def test_finde_solo_sabado_y_domingo():
    conds = gente(8) + [{"id": "f0", "nombre": "Finde", "tipo": "finde"}]
    res = cm.generar_cuadrante(entrada(conds, maxima=3))
    for i in range(5):
        assert not trabaja(res, "f0", dia(i))


def test_inactivo_desde_no_se_planifica_y_sus_unos_pasan_a_nd():
    conds = gente(8) + [{"id": "x0", "nombre": "Se va", "inactivo_desde": dia(3)}]
    celdas = {f"x0|{dia(i)}": "1" for i in range(7)}
    res = cm.generar_cuadrante(entrada(conds, maxima=3, celdas=celdas))
    for i in range(3, 7):
        assert res["celdas"][f"x0|{dia(i)}"]["valor"] == "N/D"


def test_alta_desde_no_trabaja_antes_de_empezar():
    conds = gente(6) + [{"id": "n0", "nombre": "Nuevo", "alta_desde": dia(4)}]
    res = cm.generar_cuadrante(entrada(conds, maxima=3))
    for i in range(4):
        assert res["celdas"][f"n0|{dia(i)}"]["valor"] == ""
    assert any(trabaja(res, "n0", dia(i)) for i in range(4, 7))


def test_regla_fija_nunca_los_martes():
    conds = gente(8) + [{"id": "k0", "nombre": "Kevin", "dias_no": [1]}]
    res = cm.generar_cuadrante(entrada(conds, dias=14, maxima=4))
    assert not trabaja(res, "k0", dia(1)) and not trabaja(res, "k0", dia(8))
    assert res["celdas"][f"k0|{dia(1)}"]["valor"] == "N/T"


def test_limite_de_semana():
    conds = gente(6) + [{"id": "a0", "nombre": "Alex"}]
    res = cm.generar_cuadrante(entrada(conds, maxima=4, limites_semana=[
        {"conductor_id": "a0", "lunes": dia(0), "max_dias": 4}]))
    assert sum(trabaja(res, "a0", dia(i)) for i in range(7)) <= 4


# ── LAS NOTAS DE CADA PERSONA ────────────────────────────────────────────────

def test_nota_solo_cuatro_dias_y_sin_extra_aunque_falte_gente():
    # Falta gente (hace falta el 6º día), pero quien trabaja 4 no pasa de 4.
    conds = gente(6) + [{"id": "q0", "nombre": "Cuatro", "dias_semana": 4}]
    res = cm.generar_cuadrante(entrada(conds, maxima=4))
    assert sum(trabaja(res, "q0", dia(i)) for i in range(7)) == 4
    assert res["extras"] > 0
    assert not any(v["extra"] for k, v in res["celdas"].items() if k.startswith("q0|"))


def test_nota_dias_alternos_nunca_dos_seguidos():
    conds = gente(8) + [{"id": "al", "nombre": "Alterno", "max_seguidos": 1}]
    res = cm.generar_cuadrante(entrada(conds, dias=14, maxima=5))
    vals = [res["celdas"][f"al|{dia(i)}"]["valor"] for i in range(14)]
    assert racha_maxima(vals) <= 1
    assert sum(1 for v in vals if v in cm.TRABAJO) >= 6    # sigue trabajando lo que puede


def test_nota_sin_extra():
    conds = gente(5) + [{"id": "s0", "nombre": "Sin extra", "sin_extra": True}]
    res = cm.generar_cuadrante(entrada(conds, maxima=4))
    assert sum(trabaja(res, "s0", dia(i)) for i in range(7)) <= 5
    assert not any(v["extra"] for k, v in res["celdas"].items() if k.startswith("s0|"))


# ── REPARTO JUSTO ────────────────────────────────────────────────────────────

def test_los_extras_se_reparten_nadie_repite_si_otro_no_tiene():
    # 2 semanas, 6 personas, 5 al día: 10 extras que repartir entre 6.
    res = cm.generar_cuadrante(entrada(gente(6), dias=14, maxima=3))
    por = {}
    for k, v in res["celdas"].items():
        if v["extra"]:
            por[k.split("|")[0]] = por.get(k.split("|")[0], 0) + 1
    assert res["extras"] == 10
    assert max(por.values()) - min(por.get(c["id"], 0) for c in gente(6)) <= 1


def _extras_de(res, cid):
    return sum(1 for k, v in res["celdas"].items() if v["extra"] and k.startswith(cid + "|"))


def test_quien_hizo_extras_hace_poco_nunca_hace_mas_por_ello():
    # Con historial de extras, a esa persona le tocan los mismos o menos, y los
    # días siguen a +2. Es un desempate: donde solo puede cubrir ella, cubre.
    sin, con = [], []
    for semilla in range(3):
        conds = gente(9)
        base = entrada(conds, dias=14, maxima=5)
        base["celdas"] = {f"c{i}|{dia(-1)}": ("1" if (i + semilla) % 2 else "N/T") for i in range(9)}
        r0 = cm.generar_cuadrante(base)
        conds[0]["extras_recientes"] = 3
        r1 = cm.generar_cuadrante(dict(base, conductores=conds))
        assert r1["deficit"] == r0["deficit"] == 0
        sin.append(_extras_de(r0, "c0"))
        con.append(_extras_de(r1, "c0"))
    assert all(b <= a for a, b in zip(sin, con)) and sum(con) <= sum(sin)


def test_el_reparto_justo_nunca_deja_un_dia_corto():
    # El caso que cazó los pesos altos: solo c0 puede cubrir un día y ya lleva
    # muchos extras. Se le pone igual: primero la ruta.
    conds = gente(6)
    conds[0]["extras_recientes"] = 6
    conds[0]["findes_recientes"] = 8
    res = cm.generar_cuadrante(entrada(conds, maxima=3))
    assert res["extras"] == 5 and res["deficit"] == 0


def test_los_findes_rotan_hacia_quien_menos_lleva():
    # Sobra gente: 12 personas, 5 al día. Quien lleva 8 findes seguidos
    # trabajando no debería caer en este.
    conds = gente(12)
    conds[0]["findes_recientes"] = 8
    res = cm.generar_cuadrante(entrada(conds, maxima=3))
    assert not trabaja(res, "c0", dia(5)) and not trabaja(res, "c0", dia(6))


# ── CAMBIAR LO MÍNIMO ────────────────────────────────────────────────────────

def test_un_cuadrante_que_ya_cumple_no_se_toca():
    # 7 personas, 5 al día a +2 con máxima 3: se construye uno que cumple y el
    # motor no debería mover nada.
    conds = gente(7)
    celdas = {}
    for i, c in enumerate(conds):
        for j in range(7):
            celdas[f"{c['id']}|{dia(j)}"] = "N/T" if j in (i % 7, (i + 1) % 7) else "1"
    res = cm.generar_cuadrante(entrada(conds, maxima=3, celdas=celdas))
    assert all(not v["cambiado"] for v in res["celdas"].values())


def test_faltan_maximas_es_un_error_claro():
    e = entrada(gente(3))
    del e["maximas"][dia(2)]
    with pytest.raises(ValueError) as err:
        cm.generar_cuadrante(e)
    assert "07/10" in str(err.value)


# ── TAMAÑO REAL: UN CENTRO COMO OGA5 ─────────────────────────────────────────

def _centro_grande(semilla=7):
    rnd = random.Random(semilla)
    ini = dt.date(2026, 9, 30)
    fin = dt.date(2026, 10, 12)
    conds = []
    for i in range(62):
        c = {"id": f"p{i}", "nombre": f"Persona {i}"}
        if i < 5:
            c["tipo"] = "empresa"
        elif i < 8:
            c["tipo"] = "finde"
        elif i < 10:
            c["inactivo_desde"] = "2026-10-01"
        conds.append(c)
    celdas = {}
    for c in conds:
        paso = rnd.randrange(7)
        for k in range(-8, 8):
            d = ini + dt.timedelta(days=k)
            celdas[f"{c['id']}|{d}"] = "N/T" if (k + paso) % 7 in (0, 1) else "1"
    for c in rnd.sample(conds[10:], 4):
        for k in range(3, 9):
            celdas[f"{c['id']}|{ini + dt.timedelta(days=k)}"] = "V"
    for c in rnd.sample(conds[10:], 2):
        for k in range(-3, 14):
            celdas[f"{c['id']}|{ini + dt.timedelta(days=k)}"] = "BAJA"
    maximas = {}
    d = ini
    while d <= fin:
        maximas[d.isoformat()] = 34 if d.weekday() == 6 else 36 if d.weekday() == 5 else 44
        d += dt.timedelta(days=1)
    return {"fecha_inicio": ini.isoformat(), "fecha_fin": fin.isoformat(), "colchon": 2,
            "maximas": maximas, "conductores": conds, "celdas": celdas, "segundos": 60}


def test_centro_grande_cumple_todo_y_tarda_poco():
    e = _centro_grande()
    t0 = time.time()
    res = cm.generar_cuadrante(e)
    tarda = time.time() - t0
    assert tarda < 60, tarda
    # +2 donde se puede: nunca por encima
    for r in res["resumen_dias"]:
        assert r["planificadas"] <= r["objetivo"]
    # nadie 7 seguidos, contando los días de antes
    ini = dt.date(2026, 9, 30)
    for c in e["conductores"]:
        vals = []
        for k in range(-6, 13):
            f = (ini + dt.timedelta(days=k)).isoformat()
            vals.append(res["celdas"][f"{c['id']}|{f}"]["valor"] if k >= 0
                        else e["celdas"].get(f"{c['id']}|{f}", ""))
        assert racha_maxima(vals) <= 6, c["id"]
    # lo protegido, igual
    for k, v in e["celdas"].items():
        if v in ("V", "BAJA") and k in res["celdas"]:
            assert res["celdas"][k]["valor"] == v
