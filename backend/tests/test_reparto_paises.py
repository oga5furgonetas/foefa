# -*- coding: utf-8 -*-
"""El reparto fuera de España (04-10-2026): país y zona horaria de la cuenta,
«hoy» y la hora en su zona, direcciones buscadas en su país."""
from datetime import datetime
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

import reparto
import server
from base_de_mentira import Col, Db


def test_pais_de_la_zona_horaria_del_movil():
    assert server._region_alta("America/Mexico_City", None) == ("mx", "America/Mexico_City")
    assert server._region_alta("America/Argentina/Cordoba", "") == ("ar", "America/Argentina/Cordoba")
    assert server._region_alta("Atlantic/Canary", None) == ("es", "Atlantic/Canary")
    assert server._region_alta("America/Sao_Paulo", "br") == ("br", "America/Sao_Paulo")     # Brasil (11-10)
    assert server._region_alta("America/Manaus", None) == ("br", "America/Manaus")
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


def test_coordenadas_chinas_gcj02_ida_y_vuelta():
    # Tiananmen en WGS-84; en GCJ-02 se desplaza unos cientos de metros.
    lat, lng = 39.9087, 116.3975
    glat, glng = reparto.wgs84_a_gcj02(lat, lng)
    assert 0.0005 < abs(glat - lat) + abs(glng - lng) < 0.01
    wlat, wlng = reparto.gcj02_a_wgs84(glat, glng)
    assert abs(wlat - lat) < 1e-6 and abs(wlng - lng) < 1e-6


@pytest.mark.asyncio(loop_scope="session")
async def test_en_china_con_clave_de_amap_se_ubica_alli(monkeypatch):
    monkeypatch.setenv("AMAP_KEY", "k")
    glat, glng = reparto.wgs84_a_gcj02(31.2397, 121.4998)

    class R:
        status_code = 200
        def json(self):
            return {"status": "1", "geocodes": [{"location": f"{glng},{glat}"}]}

    class C:
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def get(self, url, params=None):
            assert "amap.com" in url and params["address"].startswith("上海")
            return R()

    import httpx
    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **k: C())
    tok = server._region_actual.set(("cn", "Asia/Shanghai"))
    try:
        lat, lng = await server._rep_ubicar("上海市黄浦区南京东路 100 号")
    finally:
        server._region_actual.reset(tok)
    assert abs(lat - 31.2397) < 1e-5 and abs(lng - 121.4998) < 1e-5


@pytest.mark.asyncio(loop_scope="session")
async def test_alta_desde_china_pide_consentimiento_de_transferencia(monkeypatch):
    """PIPL: sin el consentimiento aparte no se crea la cuenta (y no se toca la base)."""
    g = Db()
    monkeypatch.setattr(server, "global_db", g)
    req = SimpleNamespace(headers={}, client=SimpleNamespace(host="203.0.113.9"))
    datos = server.RegisterRequest(org_name="李师傅", username="li@example.cn", password="12345678", slug="reparto-ab12",
                                   sector="autonomo", zona_horaria="Asia/Shanghai", pais="cn")
    with pytest.raises(HTTPException) as e:
        await server.register_dsp(datos, req)
    assert e.value.status_code == 400 and "China" in e.value.detail
    assert not g["organizations"].docs and not g["admin_users"].docs


@pytest.mark.asyncio(loop_scope="session")
async def test_alta_no_crea_colecciones_vacias(monkeypatch):
    """Atlas tiene tope de 500 colecciones: los índices de una empresa nueva
    no deben crear colecciones (solo se ponen donde ya hay datos)."""
    creadas = []

    class Col:
        def __init__(self, n): self.name = n
        async def create_index(self, *a, **k): creadas.append(self.name)
        async def drop_index(self, *a, **k): return None

    class BdNueva:
        async def list_collection_names(self): return ["vehicles"]
        def __getitem__(self, n): return Col(n)
        def __getattr__(self, n): return Col(n)

    monkeypatch.setattr(server, "client", {"dsp_nueva": BdNueva()})
    await server._ensure_tenant_indexes("dsp_nueva")
    assert creadas and set(creadas) == {"vehicles"}


@pytest.mark.asyncio(loop_scope="session")
async def test_si_nominatim_no_encuentra_photon_da_la_calle_aproximada(monkeypatch):
    """«Avenida de mahia 2 1b, 15220 bertamirans»: Nominatim no la encuentra;
    Photon da un punto de la Avenida da Mahía (15220) -> aproximada. Una calle
    con el mismo nombre en otro código postal no vale."""
    monkeypatch.setattr(server, "_REP_GEO_ULTIMA", [0.0])

    class R:
        def __init__(self, j): self.status_code, self._j = 200, j
        def json(self): return self._j

    otra = {"type": "Feature", "geometry": {"coordinates": [-8.40, 43.37]},
            "properties": {"countrycode": "ES", "type": "street", "name": "Avenida da Mahía", "postcode": "15001"}}
    buena = {"type": "Feature", "geometry": {"coordinates": [-8.6434, 42.8627]},
             "properties": {"countrycode": "ES", "type": "house", "name": "O Lar de Pepe", "street": "Avenida da Mahía",
                            "housenumber": "95", "postcode": "15220"}}

    class C:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def get(self, url, params=None, **k):
            if "nominatim" in url:
                return R([])
            return R({"features": [otra, buena]})

    import httpx
    monkeypatch.setattr(httpx, "AsyncClient", C)
    async def sin_espera(*a, **k): return None
    monkeypatch.setattr(server, "_geo_pide", lambda c, url, params=None, intentos=1: c.get(url, params=params))
    monkeypatch.setattr(server.asyncio, "sleep", sin_espera)
    pt = await server._rep_ubicar("Avenida de mahia 2 1b, 15220,bertamirans, ames, A coruña")
    assert pt == (42.8627, -8.6434, "aprox")
