# -*- coding: utf-8 -*-
"""La demo de reparto: se prepara sola cada día, deja entrar a la oficina y a
tres repartidores, y solo permite escribir en lo del reparto."""
from types import SimpleNamespace

import pytest

import server
from base_de_mentira import Db


class _Peticion:
    def __init__(self, path="/api/auth/demo-reparto", method="POST"):
        self.url = SimpleNamespace(path=path)
        self.method = method
        self.headers = {}
        self.client = SimpleNamespace(host="1.2.3.4")


@pytest.fixture
def base(monkeypatch):
    bases = {}

    class Cliente(dict):
        def __getitem__(self, nombre):
            return bases.setdefault(nombre, Db())

    dia = {"hoy": "2026-10-03"}
    monkeypatch.setattr(server, "client", Cliente())
    monkeypatch.setattr(server, "global_db", Db())
    monkeypatch.setattr(server, "_dia_negocio", lambda: dia["hoy"])
    monkeypatch.setattr(server, "_rl_public_action", lambda *a, **k: None)
    return SimpleNamespace(bases=bases, dia=dia)


@pytest.mark.asyncio(loop_scope="session")
async def test_la_demo_se_prepara_una_vez_al_dia(base):
    r = await server.demo_reparto_login(_Peticion(), {})
    assert r["role"] == "admin" and r["demo"]
    ddb = base.bases["dsp_demo_reparto"]
    assert len(ddb["reparto_pedidos"].docs) == len(server._DEMO_REP_PEDIDOS)
    assert len(ddb["drivers"].docs) == 3
    org = await server.global_db.organizations.find_one({"id": "demo-reparto"})
    assert "reparto" in org["modulos"] and org["sector"] == "supermercado"
    # Lo que haga un visitante se queda hasta el día siguiente...
    ddb["reparto_pedidos"].docs[0]["estado"] = "entregado"
    await server.demo_reparto_login(_Peticion(), {"rol": "conductor", "n": 2})
    assert ddb["reparto_pedidos"].docs[0]["estado"] == "entregado"
    # ...y al cambiar de día vuelve a empezar.
    base.dia["hoy"] = "2026-10-04"
    await server.demo_reparto_login(_Peticion(), {})
    assert {p["estado"] for p in ddb["reparto_pedidos"].docs} == {"pendiente"}
    assert {p["fecha"] for p in ddb["reparto_pedidos"].docs} == {"2026-10-04"}


@pytest.mark.asyncio(loop_scope="session")
async def test_el_repartidor_de_prueba_lleva_su_token(base):
    r = await server.demo_reparto_login(_Peticion(), {"rol": "conductor", "n": 3})
    p = server.decode_token(r["access_token"])
    assert p["role"] == "driver" and p["sub"] == "demo-r3" and p["demo"]
    assert p["db_name"] == "dsp_demo_reparto"


@pytest.mark.asyncio(loop_scope="session")
async def test_cada_visitante_autonomo_tiene_su_ruta_y_se_borra_al_dia_siguiente(base):
    a = await server.demo_reparto_login(_Peticion(), {"rol": "autonomo"})
    b = await server.demo_reparto_login(_Peticion(), {"rol": "autonomo"})
    ida, idb = a["driver"]["id"], b["driver"]["id"]
    assert ida != idb and ida.startswith("demo-a-")
    ddb = base.bases["dsp_demo_reparto"]
    assert {ida, idb} <= {d["id"] for d in ddb["drivers"].docs}
    # Cada uno con sus 8 paradas de ejemplo, que no se cruzan con las del otro.
    suyas = [p for p in ddb["reparto_pedidos"].docs if p["conductor_id"] == ida]
    assert len(suyas) == 8 and all(p["lat"] is not None for p in suyas)
    assert not {p["codigo"] for p in suyas} & {p["codigo"] for p in ddb["reparto_pedidos"].docs if p["conductor_id"] == idb}
    base.dia["hoy"] = "2026-10-05"
    await server.demo_reparto_login(_Peticion(), {})
    assert not any(d["id"].startswith("demo-a-") for d in ddb["drivers"].docs)



@pytest.mark.asyncio(loop_scope="session")
async def test_la_demo_pone_las_paradas_en_una_ciudad_del_pais_del_visitante(base):
    """11-10-2026: quien llega de México ve paquetes en Ciudad de México, a su hora y saliendo de allí;
    de Venezuela, en Bogotá; de España (o sin país), en A Coruña como siempre."""
    mx = await server.demo_reparto_login(_Peticion(), {"rol": "autonomo", "pais": "mx", "zona_horaria": "America/Mexico_City"})
    assert mx["ciudad"] == "Ciudad de México"
    ddb = base.bases["dsp_demo_reparto"]
    suyas = [p for p in ddb["reparto_pedidos"].docs if p["conductor_id"] == mx["driver"]["id"]]
    assert len(suyas) == 8 and all(p["direccion"].endswith("Ciudad de México") for p in suyas)
    assert all(19.3 < p["lat"] < 19.5 and -99.2 < p["lng"] < -99.1 for p in suyas)
    assert "Calle Colima 150, Col. Roma, Ciudad de México" in {p["direccion"] for p in suyas}
    assert suyas[0]["fecha"] == server._hoy_en("America/Mexico_City")
    tok = server.decode_token(mx["access_token"])
    assert tok["rg"] == ["mx", "America/Mexico_City", "mx"] and tok["demo"]
    # Con su ciudad puesta, el almacén (de donde sale la ruta sin GPS) está allí, no en A Coruña.
    marca = server._demo_ciudad.set("mx")
    try:
        assert 19.3 < server._rep_base(await server._rep_ajustes())[0] < 19.5
    finally:
        server._demo_ciudad.reset(marca)
    ve = await server.demo_reparto_login(_Peticion(), {"rol": "autonomo", "pais": "ve", "zona_horaria": "America/Caracas"})
    assert ve["ciudad"] == "Bogotá"
    assert server.decode_token(ve["access_token"])["rg"] == ["ve", "America/Caracas", "co"]
    # Una zona que no existe no rompe: usa la de la ciudad.
    co = await server.demo_reparto_login(_Peticion(), {"rol": "autonomo", "pais": "co", "zona_horaria": "Marte/Base"})
    assert server.decode_token(co["access_token"])["rg"] == ["co", "America/Bogota", "co"]
    es = await server.demo_reparto_login(_Peticion(), {"rol": "autonomo", "pais": "es"})
    assert es["ciudad"] == "A Coruña" and "rg" not in server.decode_token(es["access_token"])
    br = await server.demo_reparto_login(_Peticion(), {"rol": "autonomo", "pais": "br", "zona_horaria": "America/Sao_Paulo"})
    suyas = [p for p in ddb["reparto_pedidos"].docs if p["conductor_id"] == br["driver"]["id"]]
    assert suyas[0]["cliente"] == "Cliente 1 (teste)" and suyas[2]["contenido"] == "2 pacotes"


def test_las_paradas_de_ejemplo_sin_gps_caen_en_su_pais():
    marca = server._region_actual.set(("ar", "America/Argentina/Buenos_Aires"))
    try:
        assert server._rep_centro_pais()[0] < -34
    finally:
        server._region_actual.reset(marca)
    marca = server._region_actual.set(("uy", "America/Montevideo"))     # sin ciudad propia: Buenos Aires
    try:
        assert server._rep_centro_pais()[0] < -34
    finally:
        server._region_actual.reset(marca)
    assert server._rep_centro_pais() is None                            # España: el almacén o Madrid, como antes


def test_cada_sector_nace_con_lo_suyo():
    S = server.SECTORES_REGISTRO
    dsp = set(S["dsp_amazon"])
    # La DSP de Amazon lo tiene TODO lo suyo (lo que a Dani «le desapareció»).
    for k in ("plantilla", "diarios", "horas", "cuadrante", "turnos", "asignacion", "checklist-operativo", "reparto"):
        assert k in dsp, k
    assert S["paqueteria"] == S["dsp_amazon"]
    # Un súper no carga con la operación por turnos ni con lo de Amazon.
    sup = set(S["supermercado"])
    assert "reparto" in sup and not {"diarios", "horas", "plantilla", "cuadrante", "turnos"} & sup
    # El autónomo, sin equipo.
    assert "conductores" not in S["autonomo"] and "reparto" in S["autonomo"]
    assert not {"vehiculos", "talleres", "inspecciones"} & set(S["autonomo"])   # solo reparto
    # La mensajería: reparto con escaneo Y turnos, sin lo de Amazon.
    men = set(S["mensajeria"])
    assert {"reparto", "turnos", "cuadrante"} <= men and not {"diarios", "horas"} & men
    # Todas las claves existen de verdad en el catálogo de pantallas.
    todas = set(server._MODULOS_CLAVES)
    for nombre, mods in S.items():
        assert mods is None or set(mods) <= todas, nombre


def test_plan_autonomo_precio_fijo_y_siete_dias():
    assert server._precio_mensual("autonomo", 1) == 9.99
    assert server._precio_mensual("autonomo", 40) == 9.99          # no es por vehículo
    assert server._precio_mensual("operacion", 10) == 50           # los demás, por vehículo (Esencial, mínimo 10)
    assert server.PLAN_LIMITS["autonomo"]["max_drivers"] == 1
    cat = server._catalogo_por_defecto()
    aut = next(p for p in cat["planes"] if p["clave"] == "autonomo")
    assert aut["mensual"] == 9.99 and aut["dias_prueba"] == 7 and aut["anual"] == 99


@pytest.mark.asyncio(loop_scope="session")
async def test_el_catalogo_de_la_base_no_borra_el_plan_autonomo(base, monkeypatch):
    server.global_db["plan_catalog"].docs.append({"_id": "vigente", "planes": [
        {"clave": "operacion", "nombre": "Operación", "por_vehiculo": 6, "minimo_vehiculos": 20}]})
    server._CATALOGO_CACHE.update({"ts": 0, "datos": None})
    cat = await server._catalogo_planes(forzar=True)
    claves = [p["clave"] for p in cat["planes"]]
    assert claves == ["autonomo", "completo", "operacion"] or claves[0] == "autonomo"
    assert next(p for p in cat["planes"] if p["clave"] == "operacion")["por_vehiculo"] == 6
    server._CATALOGO_CACHE.update({"ts": 0, "datos": None})
