# -*- coding: utf-8 -*-
"""Demo comercial «Paquetería del Noroeste» y el cobro mensual (06-10-2026)."""
from collections import Counter
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

import demo_comercial as dc
import server
from base_de_mentira import Col, Db

AHORA = datetime(2026, 10, 6, 10, 0, tzinfo=timezone.utc)


@pytest.fixture(scope="module")
def datos():
    return dc.generar(AHORA)


def test_es_siempre_la_misma_con_la_misma_fecha(datos):
    otra = dc.generar(AHORA)
    assert [v["license_plate"] for v in otra["vehicles"]] == [v["license_plate"] for v in datos["vehicles"]]
    assert len(otra["inspections"]) == len(datos["inspections"])


def test_cinco_delegaciones_y_150_furgonetas(datos):
    por_centro = Counter(v["center"] for v in datos["vehicles"])
    assert por_centro == Counter(dc.CENTROS) and sum(por_centro.values()) == 150
    assert len({v["license_plate"] for v in datos["vehicles"]}) == 150          # matrículas sin repetir
    gente = Counter(c["center"] for c in datos["drivers"])
    assert all(gente[c] >= n for c, n in dc.CENTROS.items())                   # más conductores que furgonetas


def test_sin_datos_de_nadie(datos):
    """Ni teléfonos ni correos ni DNI: podrían ser de una persona real."""
    for c in datos["drivers"]:
        assert c["phone"] is None and c["email"] is None and c["dni"] is None
    assert all(not t["phone"] and not t["email"] for t in datos["workshops"])


def test_todo_casa_entre_si(datos):
    veh = {v["id"]: v for v in datos["vehicles"]}
    cond = {c["id"]: c for c in datos["drivers"]}
    insp = {i["id"]: i for i in datos["inspections"]}
    assert len(insp) > 3000                                                    # un mes de verdad
    for i in datos["inspections"]:
        assert veh[i["vehicle_id"]]["center"] == cond[i["driver_id"]]["center"] == i["center"]
        assert datetime.fromisoformat(i["created_at"]) <= AHORA                # nada en el futuro
    for g in datos["vehicle_damage_ledger"]:
        assert g["first_seen_inspection"] in insp
        assert insp[g["first_seen_inspection"]]["analysis"]["new_damages_count"] == 1
    for o in datos["ordenes_trabajo"]:
        assert veh[o["vehicle_id"]]["status"] == "taller"


def test_quien_causa_los_golpes_se_ve(datos):
    """Tres conductores con muchos más golpes: la pantalla de origen de daños tiene algo que enseñar."""
    insp = {i["id"]: i for i in datos["inspections"]}
    por_conductor = Counter(insp[g["first_seen_inspection"]]["driver_id"] for g in datos["vehicle_damage_ledger"])
    top3 = sum(n for _, n in por_conductor.most_common(3))
    assert len(datos["vehicle_damage_ledger"]) >= 15
    assert top3 / len(datos["vehicle_damage_ledger"]) > 0.3


def test_lo_de_cada_manana_existe(datos):
    """ITV a punto de caducar, furgonetas en el taller y el reparto de hoy."""
    assert sum(1 for v in datos["vehicles"] if v["status"] == "taller") == 5
    proximas = [v for v in datos["vehicles"] if "2026-10-06" <= v["itv_date"] <= "2026-10-20"]
    assert len(proximas) >= 6
    assert {a["center"] for a in datos["daily_assignments"]} == set(dc.CENTROS)


@pytest.fixture
def mundo(monkeypatch):
    g = Db()
    g["organizations"] = Col([])
    g["cobros"] = Col([])
    t = Db()
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "client", {server._DEMO_COM_DB: t})

    async def sin_indices(_):
        return None
    monkeypatch.setattr(server, "_ensure_tenant_indexes", sin_indices)
    return SimpleNamespace(g=g, t=t)


@pytest.mark.asyncio(loop_scope="session")
async def test_sembrar_crea_la_empresa_interna_una_vez(mundo):
    r = await server.demo_comercial_sembrar()
    assert r["creada"] is True and r["vehicles"] == 150
    org = mundo.g["organizations"].docs[0]
    assert org["id"] == dc.ORG_ID and org["interna"] is True and org["plan"] == "completo"
    assert org["db_name"] == server._DEMO_COM_DB and org["centers"] == list(dc.CENTROS)
    assert (await server.demo_comercial_sembrar())["creada"] is False          # no la duplica al reiniciar
    assert len(mundo.g["organizations"].docs) == 1
    r = await server.demo_comercial_sembrar(forzar=True)                        # regenerar: no se duplica nada
    assert len(mundo.t["vehicles"].docs) == 150 and len(mundo.g["organizations"].docs) == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_el_cobro_no_factura_demos_y_aplica_el_volumen(monkeypatch):
    g = Db()
    g["cobros"] = Col([])
    g["organizations"] = Col([
        {"id": "demo", "name": "Demo", "account_type": "dsp", "status": "active", "plan": "pro"},
        {"id": "demo-reparto", "name": "Súper", "account_type": "dsp", "status": "active", "plan": "completo", "demo": True},
        {"id": dc.ORG_ID, "name": dc.NOMBRE, "account_type": "dsp", "status": "active", "plan": "completo", "interna": True},
        {"id": "o1", "name": "Cliente", "account_type": "dsp", "status": "active", "plan": "completo", "db_name": "dsp_o1"},
    ])
    t = Db()
    t["vehicles"] = Col([{"id": f"v{i}", "status": "active"} for i in range(150)])
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "db", t)

    async def cat(forzar=False):
        return server._catalogo_por_defecto()
    monkeypatch.setattr(server, "_catalogo_planes", cat)
    cobros = await server._cobros_del_mes("2026-10")
    assert [c["org_id"] for c in cobros] == ["o1"]
    assert cobros[0]["base"] == 1147.5                                         # 150 x 9 € − 15 %
