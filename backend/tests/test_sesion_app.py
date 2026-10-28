"""LA APP NATIVA DE ANDROID (25-10-2026): la sesión de quien reparte por su cuenta dura un mes y se renueva al
usarla; y desde la app se puede pedir borrar la cuenta (Google Play lo exige). Sin Mongo: base de mentira."""
from datetime import datetime, timezone

from jose import jwt
import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Db


@pytest.fixture
def base(monkeypatch):
    g = Db()
    g["admin_users"] = Col([
        {"id": "u1", "username": "ana@x.es", "name": "Ana", "role": "admin", "org_id": "o1",
         "hashed_password": server.hash_password("secreta123")},
        {"id": "u2", "username": "jefe@empresa.es", "name": "Jefe", "role": "admin", "org_id": "o2",
         "hashed_password": server.hash_password("secreta123")},
    ])
    g["organizations"] = Col([
        {"id": "o1", "name": "Ana", "plan": "autonomo", "sector": "autonomo", "db_name": "dsp_o1", "status": "trial"},
        {"id": "o2", "name": "Empresa", "plan": "completo", "db_name": "dsp_o2", "status": "active"},
    ])
    monkeypatch.setattr(server, "global_db", g)

    async def org(oid):
        return await g["organizations"].find_one({"id": oid}, {"_id": 0})
    monkeypatch.setattr(server, "get_org", org)
    monkeypatch.setattr(server, "CORREO_CONTACTO", "")
    server._RL_PUBLIC.clear() if hasattr(server, "_RL_PUBLIC") else None
    return g


def _dias(token):
    exp = jwt.decode(token, server.SECRET_KEY, algorithms=[server.JWT_ALGORITHM])["exp"]
    return (datetime.fromtimestamp(exp, timezone.utc) - datetime.now(timezone.utc)).total_seconds() / 86400


def _claims(token):
    return jwt.decode(token, server.SECRET_KEY, algorithms=[server.JWT_ALGORITHM])


@pytest.mark.asyncio(loop_scope="session")
async def test_la_sesion_del_autonomo_dura_un_mes_y_la_de_empresa_no(base):
    ana = await base["admin_users"].find_one({"id": "u1"}, {"_id": 0})
    jefe = await base["admin_users"].find_one({"id": "u2"}, {"_id": 0})
    assert 29 < _dias((await server._sesion_de_admin(ana)).access_token) <= 30
    assert _dias((await server._sesion_de_admin(jefe)).access_token) <= server.JWT_EXPIRE_HOURS / 24 + 0.01


@pytest.mark.asyncio(loop_scope="session")
async def test_renovar_solo_el_autonomo_y_con_la_cuenta_activa(base):
    ana = _claims((await server._sesion_de_admin(await base["admin_users"].find_one({"id": "u1"}, {"_id": 0}))).access_token)
    r = await server.renovar_sesion(ana)
    assert r.id == "u1" and 29 < _dias(r.access_token) <= 30
    # La de una empresa, «entrar como» o una demo, no.
    jefe = _claims((await server._sesion_de_admin(await base["admin_users"].find_one({"id": "u2"}, {"_id": 0}))).access_token)
    for u in (jefe, {**ana, "imp": True}, {**ana, "demo": True}, {**ana, "role": "driver"}):
        with pytest.raises(HTTPException) as e:
            await server.renovar_sesion(u)
        assert e.value.status_code == 403
    # Desactivada, no se renueva.
    await base["admin_users"].update_one({"id": "u1"}, {"$set": {"disabled": True}})
    with pytest.raises(HTTPException) as e:
        await server.renovar_sesion(ana)
    assert e.value.status_code == 401


@pytest.mark.asyncio(loop_scope="session")
async def test_borrar_la_cuenta_pide_la_contrasena_desactiva_y_no_borra_datos(base):
    ana = _claims((await server._sesion_de_admin(await base["admin_users"].find_one({"id": "u1"}, {"_id": 0}))).access_token)
    with pytest.raises(HTTPException) as e:
        await server.borrar_cuenta({"password": "mala"}, ana)
    assert e.value.status_code == 400          # no 401: con un 401 la app cierra la sesión
    assert not (await base["admin_users"].find_one({"id": "u1"}, {"_id": 0})).get("disabled")
    assert await server.borrar_cuenta({"password": "secreta123"}, ana) == {"ok": True}
    u = await base["admin_users"].find_one({"id": "u1"}, {"_id": 0})
    assert u["disabled"] is True and u["baja_solicitada_en"]
    assert (await base["organizations"].find_one({"id": "o1"}, {"_id": 0}))["baja_solicitada_en"]
    assert base["bajas_cuentas"].docs[0]["org_id"] == "o1" and base["bajas_cuentas"].docs[0]["borrada"] is False
    # La empresa sigue ahí: no se borra nada.
    assert len(base["organizations"].docs) == 2 and len(base["admin_users"].docs) == 2
    # Una cuenta de empresa no se borra desde la app.
    jefe = _claims((await server._sesion_de_admin(await base["admin_users"].find_one({"id": "u2"}, {"_id": 0}))).access_token)
    with pytest.raises(HTTPException) as e:
        await server.borrar_cuenta({"password": "secreta123"}, jefe)
    assert e.value.status_code == 403
