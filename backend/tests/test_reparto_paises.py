# -*- coding: utf-8 -*-
"""El reparto fuera de España (04-10-2026): país y zona horaria de la cuenta,
«hoy» y la hora en su zona, direcciones buscadas en su país."""
from datetime import datetime
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

import server
from base_de_mentira import Col, Db


def test_pais_de_la_zona_horaria_del_movil():
    assert server._region_alta("America/Mexico_City", None) == ("mx", "America/Mexico_City")
    assert server._region_alta("America/Argentina/Cordoba", "") == ("ar", "America/Argentina/Cordoba")
    assert server._region_alta("Atlantic/Canary", None) == ("es", "Atlantic/Canary")
    assert server._region_alta("Zona/Inventada", "zz") == ("es", "Europe/Madrid")       # basura: España
    assert server._region_alta("America/Bogota", "cl") == ("cl", "America/Bogota")      # el país que manda la app manda
    assert server._region_alta(None, None) == ("es", "Europe/Madrid")
    # China: desde un móvil en Shanghái, o con el país que manda la app.
    assert server._region_alta("Asia/Shanghai", None) == ("cn", "Asia/Shanghai")
    assert server._region_alta("Asia/Shanghai", "cn") == ("cn", "Asia/Shanghai")


def test_hoy_y_la_hora_en_la_zona_de_la_cuenta():
    t = server._region_actual.set(("mx", "America/Mexico_City"))
    try:
        assert server._dia_negocio() == datetime.now(ZoneInfo("America/Mexico_City")).strftime("%Y-%m-%d")
        minutos, dia = server._rep_ahora_local()
        ahora = datetime.now(ZoneInfo("America/Mexico_City"))
        assert abs(minutos - (ahora.hour * 60 + ahora.minute)) <= 1 and dia == ahora.weekday()
    finally:
        server._region_actual.reset(t)
    # Fuera del reparto (sin fijar región), Madrid como siempre.
    assert server._dia_negocio() == datetime.now(ZoneInfo("Europe/Madrid")).strftime("%Y-%m-%d")


@pytest.mark.asyncio(loop_scope="session")
async def test_las_direcciones_se_buscan_en_el_pais_de_la_cuenta(monkeypatch):
    pedidas = []

    async def geo(c, url, params=None, intentos=2):
        pedidas.append(params)
        return SimpleNamespace(status_code=200, json=lambda: respuesta[0])
    monkeypatch.setattr(server, "_geo_pide", geo)
    server._REP_GEO_ULTIMA[0] = 0
    respuesta = [[{"lat": "19.4326", "lon": "-99.1332", "address": {"country_code": "mx"}}]]
    t = server._region_actual.set(("mx", "America/Mexico_City"))
    try:
        assert await server._rep_ubicar("Av. Reforma 222, Ciudad de México") == (19.4326, -99.1332)
        assert pedidas[-1]["countrycodes"] == "mx"
        # Un resultado de otro país no vale.
        respuesta[0] = [{"lat": "40.4", "lon": "-3.7", "address": {"country_code": "es"}}]
        server._REP_GEO_ULTIMA[0] = 0
        assert await server._rep_ubicar("Calle Mayor 1") is None
    finally:
        server._region_actual.reset(t)
    # En España, con la caja de siempre.
    respuesta[0] = [{"lat": "19.4", "lon": "-99.1", "address": {"country_code": "es"}}]
    server._REP_GEO_ULTIMA[0] = 0
    assert await server._rep_ubicar("Calle rara 3, Madrid") is None
    assert pedidas[-1]["countrycodes"] == "es"


@pytest.fixture
def cuentas(monkeypatch):
    g = Db()
    g["organizations"] = Col([
        {"id": "m1", "name": "Juan", "account_type": "dsp", "status": "active", "plan": "autonomo",
         "sector": "autonomo", "pais": "mx", "zona_horaria": "America/Mexico_City"},
        {"id": "v1", "name": "Viejo", "account_type": "dsp", "status": "active", "plan": "completo"},
    ])
    monkeypatch.setattr(server, "global_db", g)

    async def org(_id):
        return await g.organizations.find_one({"id": _id}, {"_id": 0})
    monkeypatch.setattr(server, "get_org", org)

    async def ficha(sub):
        return sub
    monkeypatch.setattr(server, "_ficha_activa_de", ficha)
    server._REGION_CACHE.clear()
    return g


@pytest.mark.asyncio(loop_scope="session")
async def test_cada_peticion_del_reparto_usa_la_region_de_su_cuenta(cuentas):
    def peticion(ruta):
        return SimpleNamespace(method="GET", url=SimpleNamespace(path=ruta), headers={}, client=None)

    async def region_de(org_id, ruta):
        token = server.create_token("d1", "driver", "X", org_id=org_id, db_name="dsp_x", account_type="dsp")
        cred = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        ctx = server.contextvars.copy_context()

        async def dentro():
            await server.get_current_user(peticion(ruta), cred)
            return server._region_actual.get()
        import asyncio
        return await asyncio.get_running_loop().create_task(dentro(), context=ctx)

    assert await region_de("m1", "/api/reparto/mi-ruta") == ("mx", "America/Mexico_City")
    assert await region_de("v1", "/api/reparto/mi-ruta") == ("es", "Europe/Madrid")      # cuentas de antes: España
    assert await region_de("m1", "/api/vehicles") == ("es", "Europe/Madrid")             # fuera del reparto no cambia nada


@pytest.mark.asyncio(loop_scope="session")
async def test_cambiar_pais_desde_ajustes(cuentas, monkeypatch):
    async def ajustes():
        return {"id": "ajustes", "zonas": [], "base": None}
    monkeypatch.setattr(server, "_rep_ajustes", ajustes)

    class Col2:
        async def replace_one(self, *a, **k):
            return None

        async def update_one(self, *a, **k):
            return None
    monkeypatch.setattr(server, "db", SimpleNamespace(reparto_ajustes=Col2()))
    yo = {"sub": "a1", "role": "admin", "org_id": "v1", "db_name": "dsp_v1"}
    try:
        await server.reparto_ajustes_put({"pais": "ar", "zona_horaria": "America/Argentina/Buenos_Aires"}, yo)
    except Exception:                                    # noqa: BLE001  (lo de después de guardar no importa aquí)
        pass
    o = cuentas["organizations"].docs[1]
    assert o["pais"] == "ar" and o["zona_horaria"] == "America/Argentina/Buenos_Aires"
    with pytest.raises(HTTPException) as e:
        await server.reparto_ajustes_put({"pais": "zz"}, yo)
    assert e.value.status_code == 400
