# -*- coding: utf-8 -*-
"""La cuenta del repartidor (06-10-2026): con qué entra, cambiar el correo (y el usuario si
entra con él) y la contraseña; y que desde «entrar como» la plataforma no pueda tocarlos."""
import pytest

import server
from base_de_mentira import Col, Db


def _base(monkeypatch, admins, orgs=None):
    g = Db()
    g["admin_users"] = Col(admins)
    g["organizations"] = Col(orgs or [])
    g["audit_log"] = Col([])
    monkeypatch.setattr(server, "global_db", g)
    return g


def _repartidor(**extra):
    return {"id": "a1", "username": "dani@correo.es", "email": "dani@correo.es", "name": "Dani",
            "org_id": "o1", "hashed_password": server.hash_password("clave-buena"), **extra}


YO = {"sub": "a1", "role": "admin", "name": "Dani", "org_id": "o1"}


@pytest.mark.asyncio(loop_scope="session")
async def test_quien_entra_con_su_correo_lo_cambia_y_entra_con_el_nuevo(monkeypatch):
    g = _base(monkeypatch, [_repartidor()], [{"id": "o1", "email": "dani@correo.es"}])
    r = await server.set_my_email({"email": "Nuevo@Correo.es", "tambien_usuario": True, "password": "clave-buena"}, YO)
    assert r == {"success": True, "email": "nuevo@correo.es", "username": "nuevo@correo.es"}
    doc = await g.admin_users.find_one({"id": "a1"})
    assert doc["username"] == "nuevo@correo.es" and doc["email"] == "nuevo@correo.es"
    # Los avisos de la cuenta van al correo nuevo.
    assert (await g.organizations.find_one({"id": "o1"}))["email"] == "nuevo@correo.es"
    # Y con el nuevo encuentra la cuenta el login.
    assert (await server._admin_por_usuario("nuevo@correo.es"))["id"] == "a1"


@pytest.mark.asyncio(loop_scope="session")
async def test_cambiar_el_usuario_pide_la_contrasena_y_no_pisa_otra_cuenta(monkeypatch):
    otro = {"id": "a2", "username": "ocupado@correo.es", "email": "ocupado@correo.es", "hashed_password": "x"}
    g = _base(monkeypatch, [_repartidor(), otro])
    with pytest.raises(server.HTTPException) as e:
        await server.set_my_email({"email": "libre@correo.es", "tambien_usuario": True, "password": "mala"}, YO)
    assert e.value.status_code == 401
    with pytest.raises(server.HTTPException) as e:
        await server.set_my_email({"email": "ocupado@correo.es", "tambien_usuario": True, "password": "clave-buena"}, YO)
    assert e.value.status_code == 409
    assert (await g.admin_users.find_one({"id": "a1"}))["username"] == "dani@correo.es"


@pytest.mark.asyncio(loop_scope="session")
async def test_si_el_usuario_no_es_el_correo_solo_cambia_el_correo(monkeypatch):
    g = _base(monkeypatch, [_repartidor(username="dani")])
    with pytest.raises(server.HTTPException) as e:
        await server.set_my_email({"email": "x@correo.es", "tambien_usuario": True, "password": "clave-buena"}, YO)
    assert e.value.status_code == 400
    # Sin `tambien_usuario`, como siempre: el correo de recuperación, el usuario no se toca.
    r = await server.set_my_email({"email": "x@correo.es"}, YO)
    assert r["email"] == "x@correo.es"
    doc = await g.admin_users.find_one({"id": "a1"})
    assert doc["username"] == "dani" and doc["email"] == "x@correo.es"


@pytest.mark.asyncio(loop_scope="session")
async def test_desde_entrar_como_no_se_toca_ni_correo_ni_contrasena(monkeypatch):
    g = _base(monkeypatch, [_repartidor()])
    plataforma = {**YO, "imp": True}
    for llamada in (server.set_my_email({"email": "mio@plataforma.es"}, plataforma),
                    server.change_my_password({"current_password": "clave-buena", "new_password": "otra-clave"}, plataforma)):
        with pytest.raises(server.HTTPException) as e:
            await llamada
        assert e.value.status_code == 403 and "propio cliente" in e.value.detail
    assert (await g.admin_users.find_one({"id": "a1"}))["email"] == "dani@correo.es"


@pytest.mark.asyncio(loop_scope="session")
async def test_la_tarjeta_y_el_plan_dicen_por_que_no_desde_entrar_como():
    for f in (server.stripe_portal(user={**YO, "imp": True}),
              server.stripe_cambiar_plan({"plan": "anual"}, user={**YO, "imp": True})):
        with pytest.raises(server.HTTPException) as e:
            await f
        assert e.value.status_code == 403 and "plataforma" in e.value.detail
