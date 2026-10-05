# -*- coding: utf-8 -*-
"""Las pantallas que se enseñan en una reunión, con los datos de la demo comercial
(06-10-2026): que ninguna salga vacía ni falle. Se llaman las mismas funciones del
servidor que usa el panel, con los datos de demo_comercial.generar() en la base de
mentira."""
from datetime import datetime, timezone

import pytest

import demo_comercial as dc
import server
from base_de_mentira import Col, Db

YO = {"sub": "u1", "role": "admin", "name": "Jefe", "org_id": dc.ORG_ID, "db_name": "dsp_demo_noroeste",
      "account_type": "dsp"}


@pytest.fixture
def demo(monkeypatch):
    datos = dc.generar(datetime.now(timezone.utc))
    t = Db()
    for col, docs in datos.items():
        t[col] = Col([dict(d) for d in docs])
    for col in ("alerts", "workshops_extra", "maintenance_log", "fleet_appointments", "gastos", "app_meta",
                "inspection_ai_results", "ai_feedback", "shift_requests", "taller_enlaces"):
        if col not in datos:
            t[col] = Col([])
    g = Db()
    org = {"id": dc.ORG_ID, "name": dc.NOMBRE, "account_type": "dsp", "plan": "completo", "status": "active",
           "db_name": "dsp_demo_noroeste", "centers": list(dc.CENTROS), "modulos": dc.MODULOS, "interna": True}
    g["organizations"] = Col([org])
    monkeypatch.setattr(server, "db", t)
    monkeypatch.setattr(server, "global_db", g)

    async def get_org(_id):
        return org
    monkeypatch.setattr(server, "get_org", get_org)
    return datos


@pytest.mark.asyncio(loop_scope="session")
async def test_quien_causa_los_golpes_tiene_ranking(demo):
    r = await server.danos_atribucion(center="", dias=120, solo_alta=False, _=YO)
    texto = str(r)
    top = max((i["driver_id"] for i in demo["inspections"] if i["analysis"]["new_damages_count"]),
              key=lambda d: sum(1 for i in demo["inspections"] if i["driver_id"] == d and i["analysis"]["new_damages_count"]))
    nombre = next(c["name"] for c in demo["drivers"] if c["id"] == top)
    assert nombre in texto, "el conductor con más golpes no sale en la atribución"


@pytest.mark.asyncio(loop_scope="session")
async def test_itv_a_punto_de_caducar(demo):
    r = await server.get_itv_alerts(center=None, user=YO)
    assert str(r).count("dn-v") >= 6 or len(r if isinstance(r, list) else r.get("alerts", r.get("items", []))) >= 6

# Inicio, Hoy, taller y disponibilidad usan agregaciones de Mongo que la base de mentira no
# tiene: se comprobaron contra una base prueba_* del clúster el 06-10 (script en ESTADO.md).
