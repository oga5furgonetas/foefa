# -*- coding: utf-8 -*-
"""Tanda 2, zona «inicio» (11-11-2026): lo que el Inicio del panel necesita del servidor para «Todos».

- portal_inicio-6 / -1: /stats/hoy devuelve además `por_centro` (salidas, revisadas, golpes y checklist de cada
  sede). Todo lo de antes sigue igual: la web vieja (en caché) no lo lee.
- portal_inicio-6 / -2, historia-6, dia-10: la ruta nueva /stats/centros-hoy dice, por cada centro que esa persona
  ve, si la plantilla de hoy está guardada (y quién), si el plan de horas es de esta semana, el último día de DNR y
  hasta qué día hay cuadrante y máximas. Sin ninguna cifra de Amazon.

Contra el servidor de verdad (server.app) con la base de mentira en memoria. «Hoy» está fijado (el 11-11-2026, un
miércoles): nada depende del reloj.
"""
import time

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

import server
from base_de_mentira import Db

pytestmark = pytest.mark.asyncio(loop_scope="session")

HOY = "2026-11-11"            # miércoles: su semana (de domingo a sábado) empieza el 2026-11-08
CENTROS = ["OGA5", "DGA1", "DGA2"]


@pytest_asyncio.fixture(loop_scope="session")
async def cliente():
    async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://testserver") as c:
        yield c


@pytest.fixture
def base(monkeypatch):
    b = Db()
    g = Db()
    g.organizations.docs.append({"id": "o1", "account_type": "owner", "db_name": server._current_db_name.get(),
                                 "centers": list(CENTROS)})
    monkeypatch.setattr(server, "db", b)
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "_hoy_madrid", lambda: HOY)
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)
    server._ADMIN_EXISTS_CACHE.clear()
    yield b
    server._ADMIN_EXISTS_CACHE.clear()


def _cab(uid, nombre, centros=None, cuenta="owner"):
    """Un usuario de oficina que existe (la caché de _admin_cacheado hace de base)."""
    server._ADMIN_EXISTS_CACHE[uid] = (time.time() + 600, True, centros, None, None)
    tok = server.create_token(uid, "admin", nombre, org_id="o1", account_type=cuenta)
    return {"Authorization": f"Bearer {tok}"}


# ── /stats/hoy · por_centro ───────────────────────────────────────────────────────

def _salidas(base):
    # OGA5 con el centro escrito largo, como llega a veces de la hoja: tiene que casar igual.
    base.daily_assignments.docs += [
        {"center": "AMZL OGA5 SANTIAGO", "date": HOY, "slots": [
            {"vehicle_id": "v1", "vehicle_plate": "1111 AAA", "driver_name": "ANA", "route": "CX1"},
            {"vehicle_id": "v2", "vehicle_plate": "2222 BBB", "driver_name": "LUIS", "route": "CX2"}]},
        {"center": "DGA1", "date": HOY, "slots": [
            {"vehicle_id": "v3", "vehicle_plate": "3333 CCC", "driver_name": "EVA", "route": "CX3"}]},
    ]
    base.inspections.docs.append({"id": "i1", "vehicle_id": "v1", "created_at": f"{HOY}T07:10:00+00:00",
                                  "analysis": {"severity": "sin_danos"}})


async def test_stats_hoy_con_todos_dice_las_salidas_de_cada_centro(cliente, base):
    _salidas(base)
    r = await cliente.get("/api/stats/hoy", headers=_cab("u-dani", "Dani"))
    assert r.status_code == 200, r.text
    j = r.json()
    # Lo de siempre, igual.
    assert j["salidas"]["total"] == 3 and j["salidas"]["revisadas"] == 1
    por = {x["centro"]: x for x in j["por_centro"]}
    assert set(por) == set(CENTROS)
    assert (por["OGA5"]["salidas"], por["OGA5"]["revisadas"]) == (2, 1)
    assert (por["DGA1"]["salidas"], por["DGA1"]["revisadas"]) == (1, 0)
    assert (por["DGA2"]["salidas"], por["DGA2"]["revisadas"]) == (0, 0)


async def test_stats_hoy_con_un_centro_solo_trae_ese(cliente, base):
    _salidas(base)
    r = await cliente.get("/api/stats/hoy?center=DGA1", headers=_cab("u-dani", "Dani"))
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["salidas"]["total"] == 1
    assert [(x["centro"], x["salidas"]) for x in j["por_centro"]] == [("DGA1", 1)]


async def test_stats_hoy_por_centro_lleva_el_checklist_de_cada_sede(cliente, base):
    base.daily_checklists.docs += [
        {"center": "OGA5", "date": HOY, "shift": "manana", "items": [{"text": "a", "done": True}, {"text": "b", "done": False}]},
        {"center": "DGA1", "date": HOY, "shift": "manana", "items": [{"text": "a", "done": True}]},
    ]
    r = await cliente.get("/api/stats/hoy", headers=_cab("u-dani", "Dani"))
    j = r.json()
    assert j["checklist"] == [{"turno": "manana", "hechas": 2, "total": 3}]
    por = {x["centro"]: x for x in j["por_centro"]}
    assert por["OGA5"]["checklist"] == [{"turno": "manana", "hechas": 1, "total": 2}]
    assert por["DGA1"]["checklist"] == [{"turno": "manana", "hechas": 1, "total": 1}]
    assert por["DGA2"]["checklist"] == []


# ── /stats/centros-hoy ────────────────────────────────────────────────────────────

def _datos_de_cada_centro(base):
    base.plantillas_diarias.docs += [
        # OGA5: guardada hoy por María (la fecha va como la escribe la hoja).
        {"id": "p1", "center": "OGA5", "date": "11/11/2026", "uploaded_at": f"{HOY}T06:40:00+00:00", "by": "María",
         "xlsx": b"..."},
        {"id": "p0", "center": "OGA5", "date": "10/11/2026", "uploaded_at": "2026-11-10T06:40:00+00:00", "by": "Jefe"},
        # DGA1: solo la de ayer. La de hoy no se guardó (o solo se descargó): no cuenta.
        {"id": "p2", "center": "DGA1", "date": "10/11/2026", "uploaded_at": "2026-11-10T07:00:00+00:00", "by": "Jefe"},
    ]
    base.whc_planes.docs += [
        {"center": "OGA5", "week": "2026-11-08", "texto": "…", "n_conductores": 30},
        {"center": "OGA5", "week": "2026-11-01", "texto": "…"},
        {"center": "DGA1", "week": "2026-11-01", "texto": "…"},
    ]
    base.daily_reports.docs += [
        {"center": "OGA5", "fecha_dnr": "2026-11-08"}, {"center": "OGA5", "fecha_dnr": "2026-11-09"},
        {"center": "DGA1", "fecha_dnr": "2026-10-30"},
    ]
    base.shifts.docs += [
        {"driver_id": "d1", "center": "OGA5", "date": "2026-12-17", "type": "trabaja"},
        {"driver_id": "d1", "center": "OGA5", "date": "2026-11-12", "type": "trabaja"},
        {"driver_id": "d2", "center": "DGA1", "date": "2026-11-05", "type": "libre"},
    ]
    base.route_demand.docs += [
        {"center": "OGA5", "date": "2026-11-30", "maximo": 9},
        # Un día con solo «rutas que piden» y sin máxima no cuenta como máxima.
        {"center": "OGA5", "date": "2026-12-20", "objetivo": 9},
    ]


async def test_centros_hoy_dice_que_esta_y_de_cuando_por_centro(cliente, base):
    _datos_de_cada_centro(base)
    r = await cliente.get("/api/stats/centros-hoy", headers=_cab("u-dani", "Dani"))
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["dia"] == HOY and j["semana"] == "2026-11-08"
    por = {x["centro"]: x for x in j["centros"]}
    assert [x["centro"] for x in j["centros"]] == CENTROS

    assert por["OGA5"]["plantilla"]["por"] == "María"
    assert por["OGA5"]["horas"] == {"semana": "2026-11-08", "al_dia": True}
    assert por["OGA5"]["dnr_ultimo"] == "2026-11-09"
    assert por["OGA5"]["cuadrante_hasta"] == "2026-12-17"
    assert por["OGA5"]["maximas_hasta"] == "2026-11-30"

    assert por["DGA1"]["plantilla"] is None, "la de ayer no es la de hoy"
    assert por["DGA1"]["horas"] == {"semana": "2026-11-01", "al_dia": False}
    assert por["DGA1"]["dnr_ultimo"] == "2026-10-30"
    assert por["DGA1"]["cuadrante_hasta"] == "2026-11-05"
    assert por["DGA1"]["maximas_hasta"] is None

    assert por["DGA2"] == {"centro": "DGA2", "plantilla": None, "horas": None, "dnr_ultimo": None,
                           "cuadrante_hasta": None, "maximas_hasta": None}
    # Ni una cifra de Amazon: solo si está y de cuándo.
    assert "n_conductores" not in str(j) and "texto" not in str(j)


async def test_centros_hoy_entiende_la_fecha_de_la_hoja_escrita_corta(cliente, base):
    base.plantillas_diarias.docs.append({"id": "p9", "center": "DGA2", "date": "11/11/26",
                                         "uploaded_at": f"{HOY}T08:00:00+00:00", "by": "Eva"})
    r = await cliente.get("/api/stats/centros-hoy", headers=_cab("u-dani", "Dani"))
    por = {x["centro"]: x for x in r.json()["centros"]}
    assert por["DGA2"]["plantilla"]["por"] == "Eva"


async def test_centros_hoy_solo_trae_los_centros_de_esa_persona_aunque_sea_de_la_cuenta_duena(cliente, base):
    _datos_de_cada_centro(base)
    # Un jefe de DGA1 de la empresa dueña: el panel le fija DGA1 arriba, y aquí no le sale OGA5 ni DGA2.
    r = await cliente.get("/api/stats/centros-hoy", headers=_cab("u-jefe", "Jefe DGA1", centros=["DGA1"]))
    assert r.status_code == 200, r.text
    assert [x["centro"] for x in r.json()["centros"]] == ["DGA1"]
    # Con dos centros marcados, esos dos.
    r = await cliente.get("/api/stats/centros-hoy", headers=_cab("u-ofi", "Oficina", centros=["OGA5", "DGA2"]))
    assert [x["centro"] for x in r.json()["centros"]] == ["OGA5", "DGA2"]


async def test_centros_hoy_de_una_empresa_cliente_con_un_centro(cliente, base):
    r = await cliente.get("/api/stats/centros-hoy", headers=_cab("u-cli", "Cliente", centros=["DGA2"], cuenta="dsp"))
    assert r.status_code == 200, r.text
    assert [x["centro"] for x in r.json()["centros"]] == ["DGA2"]


async def test_centros_hoy_pide_sesion(cliente, base):
    r = await cliente.get("/api/stats/centros-hoy")
    assert r.status_code in (401, 403)
