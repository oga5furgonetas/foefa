# -*- coding: utf-8 -*-
"""Tanda 2 de la flota propia, zona «horas» (11-11-2026): el selector de semana de
Horas (H2, «horas_dnr-3», lo que faltaba).

La pantalla deja abrir el plan de semanas anteriores para meterle las excepciones.
Un plan SIN fechas en el texto se guardaba siempre en la semana de HOY: al
«Recalcular» el de la semana pasada, se copiaba en la en curso. Ahora /whc/analizar
acepta `week` (opcional): solo cuenta cuando el texto no dice su semana.

Sin MongoDB: la base de mentira de las pruebas vecinas (`base_de_mentira`).
"""
from datetime import datetime, timedelta, timezone

import pytest

import server
from base_de_mentira import Col, Db

DB_ACTUAL = server._current_db_name.get()

_HOY_REAL = datetime.now(timezone.utc).date()
DOM = _HOY_REAL - timedelta(days=(_HOY_REAL.weekday() + 1) % 7)
SEMANA = DOM.isoformat()
PASADA = (DOM - timedelta(days=7)).isoformat()
SIGUIENTE = (DOM + timedelta(days=7)).isoformat()

NOMBRES = ["LAURA PEREZ CASTRO", "MARTA RIAL SOUTO", "PEDRO LOPEZ VARELA",
           "IRENE OTERO DIAZ", "BRAIS GOMEZ SILVA", "NURIA CASAL PENA"]


def _conductor(nombre, horas="20h 10m"):
    return "%s\nEstándar\n%s / 54h 30m\n\n9:00am - 6:10pm\nStandard Parcel\n\n" % (nombre, horas)


# Sin cabecera ni días: de este texto no se puede sacar la semana.
# Como lo deja `_texto_cuerpo`, que es como se guarda (y con lo que se compara).
SIN_FECHAS = server._texto_cuerpo("Buscar asociados\n" + "".join(_conductor(n) for n in NOMBRES), 400_000)


@pytest.fixture
def mundo(monkeypatch):
    t = Db()
    t["whc_planes"] = Col([])
    t["drivers"] = Col([{"id": "d%d" % i, "name": n, "center": "DGA1", "active": True}
                        for i, n in enumerate(NOMBRES)])
    g = Db()
    g["organizations"] = Col([{"db_name": DB_ACTUAL, "account_type": "owner",
                               "centers": ["OGA5", "DGA1", "DGA2"]}])
    monkeypatch.setattr(server, "db", t)
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "_dia_negocio", lambda: (DOM + timedelta(days=4)).isoformat())   # jueves
    return t


async def _analizar(**cuerpo):
    return await server.whc_analizar({"limite_horas": 54.5, **cuerpo}, None)


def _semanas(t):
    return sorted((d["center"], d["week"]) for d in t["whc_planes"].docs)


@pytest.mark.asyncio(loop_scope="session")
async def test_recalcular_un_plan_sin_fechas_de_la_semana_pasada_se_queda_en_la_pasada(mundo):
    # El plan sin fechas que se pegó la semana pasada (guardado allí entonces).
    mundo["whc_planes"].docs.append({
        "center": "DGA1", "week": PASADA, "texto": SIN_FECHAS, "n_conductores": len(NOMBRES),
        "pegado_en": (DOM - timedelta(days=5)).isoformat() + "T08:00:00+00:00",
        "updated_at": (DOM - timedelta(days=5)).isoformat() + "T08:00:00+00:00"})
    # Abrirlo desde el selector: es el guardado, pegado aquel día.
    r0 = await _analizar(texto=SIN_FECHAS, center="DGA1", guardar=False, week=PASADA)
    assert r0["es_el_guardado"] is True
    assert r0["pegado_hoy"] is False
    # «Recalcular» con sus excepciones: se guarda en la semana PASADA, no en la de hoy.
    r = await _analizar(texto=SIN_FECHAS, center="DGA1", excepciones=1, recalcular=True, week=PASADA)
    assert r["guardado"] is True
    assert r["semana_guardada"] == PASADA
    assert _semanas(mundo) == [("DGA1", PASADA)]
    assert mundo["whc_planes"].docs[0]["excepciones"] == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_week_un_plan_sin_fechas_va_a_la_semana_de_hoy_como_siempre(mundo):
    r = await _analizar(texto=SIN_FECHAS, center="DGA1")
    assert r["guardado"] is True
    assert r["semana_guardada"] == SEMANA
    assert _semanas(mundo) == [("DGA1", SEMANA)]


_MESES = {1: "ene", 2: "feb", 3: "mar", 4: "abr", 5: "may", 6: "jun",
          7: "jul", 8: "ago", 9: "sep", 10: "oct", 11: "nov", 12: "dic"}


@pytest.mark.asyncio(loop_scope="session")
async def test_las_fechas_del_texto_mandan_sobre_week(mundo):
    # Los días del texto, de una semana que NUNCA es la que se manda en `week`
    # (11-11-2026): con «nov. 01» escrito a mano, la semana después del 1 de
    # noviembre las dos coincidían y la prueba pasaba aunque mandara `week`.
    otra = DOM - timedelta(days=21)
    dias = "".join("%s., %s. %02d\n\n" % (d, _MESES[f.month], f.day)
                   for d, f in zip(("dom", "lun", "mar"), (otra + timedelta(days=k) for k in range(3))))
    plan = "Buscar asociados\n" + dias + "".join(_conductor(n) for n in NOMBRES)
    semana_texto = server._whc_semana_del_plan(plan)
    assert semana_texto == otra.isoformat()
    assert semana_texto != PASADA
    r = await _analizar(texto=plan, center="DGA1", week=PASADA)
    assert r["semana_guardada"] == semana_texto
    assert _semanas(mundo) == [("DGA1", semana_texto)]


@pytest.mark.asyncio(loop_scope="session")
async def test_week_futura_o_mal_escrita_no_cuenta(mundo):
    r = await _analizar(texto=SIN_FECHAS, center="DGA1", week=SIGUIENTE)
    assert r["semana_guardada"] == SEMANA
    r2 = await _analizar(texto=SIN_FECHAS, center="DGA1", week="la pasada")
    assert r2["semana_guardada"] == SEMANA
    assert _semanas(mundo) == [("DGA1", SEMANA)]


@pytest.mark.asyncio(loop_scope="session")
async def test_un_plan_sin_fechas_de_una_semana_acabada_va_al_dia_7(mundo, monkeypatch):
    # U8 (11-11-2026): pegado HOY (miércoles) mirando la semana pasada, el plan se
    # guarda allí, pero el día salía del de hoy: «día 4 de 7», el ritmo con 4
    # jornadas y quien hizo 45 h en esa semana cerrada, en «peligro».
    monkeypatch.setattr(server, "_dia_negocio", lambda: (DOM + timedelta(days=3)).isoformat())
    plan = server._texto_cuerpo(
        "Buscar asociados\n" + _conductor(NOMBRES[0], "45h 00m")
        + "".join(_conductor(n) for n in NOMBRES[1:]), 400_000)
    r = await _analizar(texto=plan, center="DGA1", week=PASADA)
    assert r["semana_guardada"] == PASADA
    assert r["ritmo"]["dia_semana"] == 7
    assert r["ritmo"]["bloques_ref"] == server._WHC_BLOQUES_SEMANA
    assert r["ritmo"]["peligro"] == 0 and r["ritmo"]["pasados"] == 0
    # Al volver a abrirlo (pegado hoy, fuera de esa semana), lo mismo.
    r2 = await _analizar(texto=plan, center="DGA1", guardar=False, week=PASADA)
    assert r2["es_el_guardado"] is True
    assert r2["ritmo"]["dia_semana"] == 7
    # La semana de ahora, sin `week`, sigue contando con el día de hoy (miércoles = 4).
    r3 = await _analizar(texto=plan, center="DGA1", guardar=False)
    assert r3["ritmo"]["dia_semana"] == 4


@pytest.mark.asyncio(loop_scope="session")
async def test_un_plan_sin_fechas_pegado_en_su_semana_conserva_su_dia(mundo):
    # El que se pegó el martes de la semana pasada sigue siendo «día 3», no el 7.
    mundo["whc_planes"].docs.append({
        "center": "DGA1", "week": PASADA, "texto": SIN_FECHAS, "n_conductores": len(NOMBRES),
        "pegado_en": (DOM - timedelta(days=5)).isoformat() + "T08:00:00+00:00",
        "updated_at": (DOM - timedelta(days=5)).isoformat() + "T08:00:00+00:00"})
    r = await _analizar(texto=SIN_FECHAS, center="DGA1", guardar=False, week=PASADA)
    assert r["es_el_guardado"] is True
    assert r["ritmo"]["dia_semana"] == 3


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_guardar_no_hay_semana_guardada(mundo):
    r = await _analizar(texto=SIN_FECHAS, center="DGA1", guardar=False, week=PASADA)
    assert r["guardado"] is False
    assert r["semana_guardada"] is None
    assert mundo["whc_planes"].docs == []
