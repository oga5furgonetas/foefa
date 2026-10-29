# -*- coding: utf-8 -*-
"""Una persona con dos fichas (mismo correo) tiene dos cuentas: cambiar la contraseña y entrar con la nueva.

29-10-2026: Karim, Xenxo y Gago cambiaron su contraseña temporal desde la app y al volver a entrar «incorrecta».
La importación duplicaba fichas; las cuentas en bloque se crearon una por ficha, las dos con la misma temporal.
El login entraba por la primera cuenta del correo (find_one) y la sesión iba con la ficha ACTIVA (_ficha_activa_de),
así que cambiar la contraseña escribía en la otra cuenta. La nueva no abría; la temporal, sí.
"""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Db

CORREO = "karim@empresa.es"
TEMPORAL = "temporal-de-todos-1"


@pytest.fixture
def base(monkeypatch):
    tenant = Db()
    # Dos fichas de la misma persona: la vieja de baja y la activa.
    tenant["drivers"] = Col([
        {"id": "f-vieja", "name": "KARIM", "email": CORREO, "active": False, "created_at": "2026-05-01"},
        {"id": "f-activa", "name": "KARIM", "email": CORREO, "active": True, "created_at": "2026-09-01"},
    ])
    tenant["driver_accounts"] = Col([
        {"id": "c1", "driver_id": "f-vieja", "email": CORREO, "hashed_password": server.hash_password(TEMPORAL),
         "active": True, "creada_en_bloque": True, "must_change_password": True, "created_at": "2026-10-28"},
        {"id": "c2", "driver_id": "f-activa", "email": CORREO, "hashed_password": server.hash_password(TEMPORAL),
         "active": True, "creada_en_bloque": True, "must_change_password": True, "created_at": "2026-10-28"},
    ])
    tenant["driver_recovery_emails"] = Col([])
    globales = Db()
    globales["organizations"] = Col([{"id": "o1", "slug": "oga5", "name": "OGA5", "account_type": "dsp",
                                      "db_name": "dsp_o1", "status": "active"}])
    globales["admin_users"] = Col([])
    monkeypatch.setattr(server, "db", tenant)
    monkeypatch.setattr(server, "global_db", globales)

    # Solo la base de esta empresa tiene las cuentas; la base por defecto (que el login tambien mira) esta vacia.
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
    return tenant


def _peticion():
    return SimpleNamespace(headers={}, client=SimpleNamespace(host="10.0.0.1"), url=SimpleNamespace(path="/api/auth/driver-login"))


async def _entrar(clave):
    return await server.driver_login(server.DriverLoginRequest(email=CORREO, password=clave), _peticion())


@pytest.mark.asyncio(loop_scope="session")
async def test_cambiar_la_contrasena_desde_la_ficha_activa_y_entrar_con_la_nueva(base):
    s = await _entrar(TEMPORAL)
    assert s.role == "driver" and s.configurar_cuenta is True
    # La sesión va con la ficha activa (get_current_user → _ficha_activa_de), aunque el login entrara por la vieja.
    assert await server._ficha_activa_de("f-vieja") == "f-activa"
    yo = {"sub": "f-activa", "role": "driver", "org_id": "o1", "db_name": "dsp_o1"}
    r = await server.change_my_password({"current_password": "", "new_password": "la-mia-nueva-1"}, yo)
    assert r == {"success": True}
    # Las DOS cuentas llevan la nueva y ya no son temporales.
    for c in base["driver_accounts"].docs:
        assert server.verify_password("la-mia-nueva-1", c["hashed_password"])
        assert "must_change_password" not in c and "creada_en_bloque" not in c and c["password_changed_at"]
    s2 = await _entrar("la-mia-nueva-1")
    assert s2.role == "driver" and s2.configurar_cuenta is False
    with pytest.raises(HTTPException) as e:
        await _entrar(TEMPORAL)
    assert e.value.status_code == 401


@pytest.mark.asyncio(loop_scope="session")
async def test_con_una_cuenta_ya_cambiada_la_temporal_de_la_otra_no_abre(base):
    """Lo que les pasó: la nueva solo está en una cuenta. Con el arreglo entra la nueva; la temporal, no."""
    base["driver_accounts"].docs[1].update(hashed_password=server.hash_password("mi-clave-propia-1"),
                                            password_changed_at="2026-10-29T16:00:00+00:00")
    for k in ("must_change_password", "creada_en_bloque"):
        base["driver_accounts"].docs[1].pop(k)
    s = await _entrar("mi-clave-propia-1")
    assert s.id == "f-activa" and s.configurar_cuenta is False
    with pytest.raises(HTTPException) as e:
        await _entrar(TEMPORAL)                      # la temporal de la cuenta vieja ya no es suya
    assert e.value.status_code == 401
    # Y cambiarla otra vez desde la ficha activa (con la actual) la pone en las dos.
    yo = {"sub": "f-activa", "role": "driver", "org_id": "o1", "db_name": "dsp_o1"}
    with pytest.raises(HTTPException) as e:
        await server.change_my_password({"current_password": "mala", "new_password": "otra-mas-nueva-1"}, yo)
    assert e.value.status_code == 400
    await server.change_my_password({"current_password": "mi-clave-propia-1", "new_password": "otra-mas-nueva-1"}, yo)
    assert all(server.verify_password("otra-mas-nueva-1", c["hashed_password"]) for c in base["driver_accounts"].docs)


@pytest.mark.asyncio(loop_scope="session")
async def test_una_sola_cuenta_sigue_igual(base):
    base["driver_accounts"].docs.pop(0)
    base["drivers"].docs.pop(0)
    s = await _entrar(TEMPORAL)
    assert s.id == "f-activa"
    yo = {"sub": "f-activa", "role": "driver", "org_id": "o1", "db_name": "dsp_o1"}
    await server.change_my_password({"current_password": "", "new_password": "solo-una-1"}, yo)
    assert (await _entrar("solo-una-1")).id == "f-activa"
    with pytest.raises(HTTPException):
        await _entrar("lo-que-sea-1")
