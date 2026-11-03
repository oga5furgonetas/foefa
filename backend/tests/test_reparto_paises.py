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
    # 11-10-2026: Lisboa ya no queda como España (y el buscador busca en Portugal); Estados Unidos, también.
    assert server._region_alta("Europe/Lisbon", None) == ("pt", "Europe/Lisbon")
    assert server._region_alta("America/Chicago", "us") == ("us", "America/Chicago")
    assert server._region_alta("Europe/London", None) == ("gb", "Europe/London")
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


class _RedFalsa:
    """La red del geocodificador de mentira (02-11-2026, geocodificador.RedHttp): Nominatim contesta `nominatim`,
    Photon `photon` y CartoCiudad nada (204). Apunta lo que se le pide."""

    def __init__(self, nominatim=None, photon=None):
        self.nominatim, self.photon, self.pedidas = nominatim or [], photon or {"features": []}, []

    async def get(self, srv, url, params, tope, idioma=None):
        self.pedidas.append((srv, dict(params)))
        if srv == "nominatim":
            return {"status": 200, "json": self.nominatim}
        if srv == "photon":
            return {"status": 200, "json": self.photon}
        return {"status": 204, "json": None}


@pytest.mark.asyncio(loop_scope="session")
async def test_las_direcciones_se_buscan_en_el_pais_de_la_cuenta(monkeypatch):
    """02-11-2026, con la cadena nueva (geocodificador.py): Nominatim con countrycodes del país, un resultado de otro
    país no vale y en España, la caja de siempre. Y el portal solo si es ESE número en ESA calle."""
    # En España, con CartoCiudad (para una cuenta de empresa, desde CARTOCIUDAD_EMPRESAS_DESDE: test_geocodificador).
    monkeypatch.setenv("CARTOCIUDAD_EMPRESAS_DESDE", "2000-01-01")
    red = _RedFalsa(nominatim=[{"lat": "19.4326", "lon": "-99.1332", "class": "building",
                                "address": {"country_code": "mx", "house_number": "222", "road": "Avenida Reforma",
                                            "city": "Ciudad de México"}}])
    monkeypatch.setattr(server, "_REP_GEO_RED", red)
    server._REP_GEO_HECHOS.clear()
    t = server._region_actual.set(("mx", "America/Mexico_City"))
    try:
        assert await server._rep_ubicar("Av. Reforma 222, Ciudad de México") == (19.4326, -99.1332)
        nominatim = [p for s, p in red.pedidas if s == "nominatim"]
        assert nominatim[-1]["countrycodes"] == "mx" and nominatim[-1]["street"] == "222 Avenida Reforma"
        assert not [s for s, _ in red.pedidas if s == "cartociudad"]          # el callejero oficial es solo de España
        # Un resultado de otro país no vale (ni como portal ni como zona).
        red.nominatim = [{"lat": "40.4", "lon": "-3.7", "class": "building",
                          "address": {"country_code": "es", "house_number": "1", "road": "Calle Mayor",
                                      "city": "Ciudad de México"}}]
        assert await server._rep_ubicar("Calle Mayor 1, Ciudad de México") is None
    finally:
        server._region_actual.reset(t)
    # En España, con la caja de siempre: un punto en México no vale aunque diga «es».
    red.nominatim = [{"lat": "19.4", "lon": "-99.1", "class": "building",
                      "address": {"country_code": "es", "house_number": "3", "road": "Calle Rara", "city": "Madrid"}}]
    red.pedidas.clear()
    assert await server._rep_ubicar("Calle rara 3, Madrid") is None
    assert [p for s, p in red.pedidas if s == "nominatim"][-1]["countrycodes"] == "es"
    assert [s for s, _ in red.pedidas][0] == "cartociudad"                # en España, primero el callejero oficial


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


def test_el_piso_fuera_del_buscador_sin_comerse_la_calle():
    """02-11-2026: «der», «of» e «int» solo con su punto (sin él son de la calle); el piso pegado al número («1ºB»,
    «3ºA», «2ºIzq»); y en la calle solo cuenta lo que va detrás del número («Puerta del Sol 1», «Calle de la Torre 5»)."""
    casos = {
        "Rúa Real 2, 1ºB, 15003 A Coruña": "Rúa Real 2, 15003 A Coruña",
        "Calle Mayor 5 3ºA, Madrid": "Calle Mayor 5, Madrid",
        "Calle Mayor 5 2ºIzq": "Calle Mayor 5",
        "An der Alster 12": "An der Alster 12",
        "Hotel Atlantic, An der Alster 72, 20099 Hamburg": "Hotel Atlantic, An der Alster 72, 20099 Hamburg",
        "1211 Avenue of the Americas, New York, NY 10036": "1211 Avenue of the Americas, New York, NY 10036",
        "Platz der Republik 1, 11011 Berlin": "Platz der Republik 1, 11011 Berlin",
        "Av. Insurgentes Sur 1602 Int. 4, CDMX": "Av. Insurgentes Sur 1602, CDMX",
        "Calle Real 1 der., Madrid": "Calle Real 1, Madrid",
        "Puerta del Sol 1, Madrid": "Puerta del Sol 1, Madrid",
        "Calle de la Torre 5 bajo, Madrid": "Calle de la Torre 5, Madrid",
        "Portal de Belén 3 1ºA": "Portal de Belén 3",
        "Calle X 3, 29740 Torre del Mar": "Calle X 3, 29740 Torre del Mar",
        # Lo de siempre.
        "Rúa Real 2, 1º B": "Rúa Real 2",
        "123 Main St Apt 4B, Springfield": "123 Main St, Springfield",
        "Rua das Flores, 123 - Apto 45, Bairro X": "Rua das Flores, 123, Bairro X",
        "Calle Mayor 5 2 B, Madrid": "Calle Mayor 5, Madrid",
        "2 rue de la Paix, 3e étage, Paris": "2 rue de la Paix, Paris",
    }
    for escrita, buscada in casos.items():
        assert reparto.direccion_para_buscar(escrita) == buscada, escrita


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
    """«Avenida de mahia 2 1b, 15220,bertamirans, ames, A coruña»: ni el callejero oficial ni Nominatim la encuentran;
    Photon da una casa de la Avenida da Mahía (15220) con otro número -> la calle, aproximada (nunca como el portal).
    Una calle con el mismo nombre en otro código postal no vale."""
    otra = {"type": "Feature", "geometry": {"coordinates": [-8.40, 43.37]},
            "properties": {"countrycode": "ES", "type": "street", "name": "Avenida da Mahía", "postcode": "15001"}}
    buena = {"type": "Feature", "geometry": {"coordinates": [-8.6434, 42.8627]},
             "properties": {"countrycode": "ES", "type": "house", "name": "O Lar de Pepe", "street": "Avenida da Mahía",
                            "housenumber": "95", "postcode": "15220"}}
    monkeypatch.setattr(server, "_REP_GEO_RED", _RedFalsa(photon={"features": [otra, buena]}))
    server._REP_GEO_HECHOS.clear()
    pt = await server._rep_ubicar("Avenida de mahia 2 1b, 15220,bertamirans, ames, A coruña")
    assert pt == (42.8627, -8.6434, "aprox")
