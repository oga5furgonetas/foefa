# -*- coding: utf-8 -*-
"""La contraseña inicial de los conductores nuevos (30-10-2026).

Dani: «haz que cada vez que creemos una cuenta tenga por defecto una contraseña y, cuando entren, les salte cambiarla;
hoy se la he tenido que poner yo a mano a un conductor». La oficina la define una vez por empresa (solo se guarda el
hash); el alta de un conductor con correo y sin contraseña propia le crea la cuenta con ella, temporal: entra con la
inicial y el login le dice `configurar_cuenta`, como con la temporal en bloque.
"""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Db

INICIAL = "inicial-de-prueba-1"
ADMIN = {"sub": "a1", "role": "admin", "name": "Dani", "org_id": "o1", "account_type": "dsp"}


@pytest.fixture
def base(monkeypatch):
    tenant = Db()
    tenant["drivers"] = Col([])
    tenant["driver_accounts"] = Col([])
    tenant["driver_recovery_emails"] = Col([])
    globales = Db()
    globales["organizations"] = Col([{"id": "o1", "slug": "oga5", "name": "OGA5", "account_type": "dsp",
                                      "db_name": "dsp_o1", "status": "active", "centers": ["OGA5", "DGA1"]}])
    globales["admin_users"] = Col([])
    monkeypatch.setattr(server, "db", tenant)
    monkeypatch.setattr(server, "global_db", globales)

    class _Cliente(dict):
        def __missing__(self, nombre):
            self[nombre] = Db()
            return self[nombre]
    monkeypatch.setattr(server, "client", _Cliente({"dsp_o1": tenant}))

    async def org(oid):
        return await globales["organizations"].find_one({"id": oid}, {"_id": 0})
    monkeypatch.setattr(server, "get_org", org)
    server._login_fails.clear()
    server._FICHA_ACTIVA_CACHE.clear()
    return tenant, globales


def _peticion():
    return SimpleNamespace(headers={}, client=SimpleNamespace(host="10.0.0.1"),
                           url=SimpleNamespace(path="/api/auth/driver-login"))


async def _definir(clave):
    return await server.poner_contrasena_inicial(server.ContrasenaInicialRequest(password=clave), admin=ADMIN)


async def _alta(**campos):
    return await server.create_driver(server.DriverCreate(**campos), admin=ADMIN)


async def _entrar(correo, clave):
    return await server.driver_login(server.DriverLoginRequest(email=correo, password=clave), _peticion())


@pytest.mark.asyncio(loop_scope="session")
async def test_el_nuevo_entra_con_la_inicial_y_tiene_que_cambiarla(base):
    tenant, globales = base
    assert (await server.ver_contrasena_inicial(admin=ADMIN))["definida"] is False
    r = await _definir(INICIAL)
    assert r["definida"] is True and r["por"] == "Dani"
    org = await globales["organizations"].find_one({"id": "o1"})
    assert org["contrasena_inicial_hash"] and INICIAL not in str(org)      # solo el hash, nunca la contraseña
    assert (await server.ver_contrasena_inicial(admin=ADMIN))["definida"] is True

    d = await _alta(name="Nuevo Conductor", email="Nuevo@Empresa.es")
    cuenta = await tenant["driver_accounts"].find_one({"driver_id": d.id})
    assert cuenta and cuenta["email"] == "nuevo@empresa.es"
    assert cuenta["must_change_password"] is True and cuenta["contrasena_inicial"] is True
    assert cuenta["password_temp_created_at"]
    assert server.verify_password(INICIAL, cuenta["hashed_password"])

    s = await _entrar("nuevo@empresa.es", INICIAL)
    assert s.role == "driver" and s.id == d.id and s.configurar_cuenta is True
    with pytest.raises(HTTPException) as e:
        await _entrar("nuevo@empresa.es", "otra-cualquiera-9")
    assert e.value.status_code == 401


@pytest.mark.asyncio(loop_scope="session")
async def test_con_contrasena_propia_en_el_alta_manda_la_del_alta(base):
    tenant, _ = base
    await _definir(INICIAL)
    d = await _alta(name="Con Propia", email="propia@empresa.es", password="propia-del-alta-1")
    cuenta = await tenant["driver_accounts"].find_one({"driver_id": d.id})
    assert server.verify_password("propia-del-alta-1", cuenta["hashed_password"])
    assert not server.verify_password(INICIAL, cuenta["hashed_password"])
    assert not cuenta.get("must_change_password") and not cuenta.get("contrasena_inicial")
    assert len(await tenant["driver_accounts"].find({}).to_list(10)) == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_inicial_definida_o_sin_correo_no_hay_cuenta(base):
    tenant, _ = base
    d = await _alta(name="Sin Nada", email="sinnada@empresa.es")
    assert await tenant["driver_accounts"].find_one({"driver_id": d.id}) is None
    await _definir(INICIAL)
    d2 = await _alta(name="Sin Correo")
    assert await tenant["driver_accounts"].find_one({"driver_id": d2.id}) is None
    assert await tenant["driver_accounts"].find({}).to_list(10) == []


@pytest.mark.asyncio(loop_scope="session")
async def test_quitarla_y_lo_que_no_vale(base):
    _, globales = base
    await _definir(INICIAL)
    with pytest.raises(HTTPException) as e:
        await _definir("corta")
    assert e.value.status_code == 400
    assert (await server.ver_contrasena_inicial(admin=ADMIN))["definida"] is True   # la corta no la pisó
    r = await _definir("")
    assert r["definida"] is False
    org = await globales["organizations"].find_one({"id": "o1"})
    assert "contrasena_inicial_hash" not in org and "contrasena_inicial_desde" not in org
    assert (await server.ver_contrasena_inicial(admin=ADMIN))["definida"] is False
    with pytest.raises(HTTPException) as e:
        await server.poner_contrasena_inicial(server.ContrasenaInicialRequest(password=INICIAL), admin={**ADMIN, "demo": True})
    assert e.value.status_code == 403


def test_la_cuenta_inicial_es_temporal_y_el_correo_va_en_minusculas():
    c = server._cuenta_inicial("f1", "  Alguien@Empresa.ES ", "hash", "2026-10-30T20:00:00+00:00")
    assert c["email"] == "alguien@empresa.es" and c["driver_id"] == "f1" and c["hashed_password"] == "hash"
    assert c["must_change_password"] is True and c["contrasena_inicial"] is True and c["active"] is True
    assert c["password_temp_created_at"] == c["created_at"] == "2026-10-30T20:00:00+00:00"
