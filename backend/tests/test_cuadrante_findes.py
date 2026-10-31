# -*- coding: utf-8 -*-
"""Los fines de semana se reparten (31-10-2026, Dani: «la misma persona tiene 3 findes seguidos libres y otro no
pilla un finde libre en 3 semanas»). Contra `cuadrante_motor.py`, sin base."""
import datetime as dt

import cuadrante_motor as cm

LUNES = dt.date(2026, 11, 2)


def dia(n, base=LUNES):
    return (base + dt.timedelta(days=n)).isoformat()


def entrada(conductores, dias=28, maxima=6, **k):
    e = {
        "fecha_inicio": dia(0), "fecha_fin": dia(dias - 1), "colchon": 2,
        "maximas": {dia(i): maxima for i in range(dias)},
        "conductores": conductores, "celdas": {}, "bloqueadas": [], "segundos": 30,
    }
    e.update(k)
    return e


def gente(n, prefijo="c", **k):
    return [dict({"id": f"{prefijo}{i}", "nombre": f"Persona {i}"}, **k) for i in range(n)]


def trabaja(res, cid, fecha):
    return res["celdas"][f"{cid}|{fecha}"]["valor"] in cm.TRABAJO


def findes(res, cid, semanas):
    """'T' si trabaja el sábado o el domingo de esa semana, '.' si libra los dos."""
    return "".join("T" if (trabaja(res, cid, dia(7 * s + 5)) or trabaja(res, cid, dia(7 * s + 6))) else "."
                   for s in range(semanas))


def dias_finde(res, cid, semanas):
    return sum(1 for s in range(semanas) for d in (5, 6) if trabaja(res, cid, dia(7 * s + d)))


def racha(patron):
    return max((len(x) for x in patron.split(".")), default=0)


def test_en_cuatro_semanas_todos_libran_algun_finde_y_nadie_trabaja_tres_seguidos():
    # 12 personas, 8 al día: cada finde libran 4. Antes, 5 de 12 se quedaban sin ningún finde libre.
    res = cm.generar_cuadrante(entrada(gente(12)))
    assert res["deficit"] == 0 and res["extras"] == 0
    patrones = {c["id"]: findes(res, c["id"], 4) for c in gente(12)}
    assert all("." in p for p in patrones.values()), patrones
    assert max(racha(p) for p in patrones.values()) <= 2, patrones
    dias = [dias_finde(res, c["id"], 4) for c in gente(12)]
    assert max(dias) - min(dias) <= 2, dias


def test_quien_viene_de_trabajar_findes_seguidos_libra_el_primero():
    # Dos semanas. c0 viene de trabajar los 4 findes anteriores (8 días); c1 de librarlos todos. Sobra gente:
    # el primer finde libra c0, y en las dos semanas no hace más días de finde que c1.
    conds = gente(12)
    conds[0].update(findes_previos=[1, 1, 1, 1], findes_recientes=8)
    conds[1].update(findes_previos=[0, 0, 0, 0], findes_recientes=0)
    res = cm.generar_cuadrante(entrada(conds, dias=14))
    assert res["deficit"] == 0
    assert findes(res, "c0", 2)[0] == "."
    assert dias_finde(res, "c0", 2) <= dias_finde(res, "c1", 2)


def test_el_reparto_de_findes_nunca_deja_un_dia_corto():
    # Solo c0 puede trabajar el finde (los demás tienen el finde como día que no) y viene de 8 días de finde
    # seguidos: trabaja el sábado y el domingo igual. Primero la ruta.
    conds = [{"id": "c0", "nombre": "Persona 0", "findes_previos": [1, 1, 1, 1], "findes_recientes": 8}]
    conds += gente(5, prefijo="d", dias_no=[5, 6])
    res = cm.generar_cuadrante(entrada(conds, dias=7, maxima=1, colchon=0))
    assert res["deficit"] == 0
    assert trabaja(res, "c0", dia(5)) and trabaja(res, "c0", dia(6))


def test_la_semana_en_curso_no_se_reordena_por_los_findes():
    # Una semana ya puesta que cumple (8 al día con máxima 6: c0..c7 trabajan el finde, c8..c11 lo libran y
    # trabajan 4 días): el motor no la toca aunque el reparto de findes preferiría otra cosa.
    conds = gente(12)
    libres = {d: {(4 * d + j) % 12 for j in range(4)} for d in range(5)}       # 4 libres cada día laborable
    celdas = {}
    for i in range(12):
        for d in range(7):
            trabaja_hoy = (i not in libres[d]) if d < 5 else (i < 8)
            celdas[f"c{i}|{dia(d)}"] = "1" if trabaja_hoy else "N/T"
    res = cm.generar_cuadrante(entrada(conds, dias=7, celdas=celdas))
    assert res["deficit"] == 0
    cambiados = [k for k, v in res["celdas"].items() if v["cambiado"]]
    assert cambiados == [], cambiados


def test_a_quien_tiene_el_horario_marcado_no_se_le_reparten_los_findes():
    # El de empresa (L-V) nunca trabaja el finde; el de solo finde los trabaja todos: no entran en el reparto.
    conds = gente(10) + [{"id": "emp", "nombre": "Empresa", "tipo": "empresa"},
                         {"id": "fin", "nombre": "Finde", "tipo": "finde"}]
    res = cm.generar_cuadrante(entrada(conds, dias=14, maxima=5))
    assert findes(res, "emp", 2) == ".."
    assert findes(res, "fin", 2) == "TT"
