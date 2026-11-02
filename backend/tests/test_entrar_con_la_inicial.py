# -*- coding: utf-8 -*-
"""La contraseña inicial de la empresa vale para TODOS los que aún no tienen la suya (02-11-2026).

Dani: «quiero que todos tengan la contraseña inicial; si la bloquean, que les salga que deben esperar; que la puedan
cambiar y, una vez la cambien, que cada uno tenga la suya». María (oficina de OGA5): «no les deja… me intenté meter yo
desde una y tampoco». La inicial se definió el 02-11 y solo se ponía a los conductores dados de alta DESPUÉS: los que ya
estaban tenían otra temporal, otra contraseña o ninguna cuenta, y con la inicial les salía «contraseña incorrecta».
"""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Db

INICIAL = "inicial-de-la-empresa-1"
OTRA_TEMPORAL = "temporal-de-octubre-1"
PROPIA = "la-mia-de-siempre-1"


@pytest.fixture
def base(monkeypatch):
    tenant = Db()
    tenant["drivers"] = Col([
        {"id": "f-sin", "name": "SIN CUENTA", "email": "sin.cuenta@empresa.es", "active": True, "created_at": "2026-09-01"},
        {"id": "f-temp", "name": "TEMPORAL", "email": "temporal@empresa.es", "active": True, "created_at": "2026-09-01"},
        {"id": "f-propia", "name": "PROPIA", "email": "propia@empresa.es", "active": True, "created_at": "2026-09-01"},
        {"id": "f-baja", "name": "DE BAJA", "email": "baja@empresa.es", "active": False, "created_at": "2026-09-01"},
        {"id": "f-off", "name": "SIN ACCESO", "email": "desactivada@empresa.es", "active": True, "created_at": "2026-09-01"},
    ])
    tenant["driver_accounts"] = Col([
        # La temporal común de octubre (en bloque): nunca eligió la suya.
        {"id": "c-temp", "driver_id": "f-temp", "email": "temporal@empresa.es", "hashed_password": server.hash_password(OTRA_TEMPORAL),
         "active": True, "creada_en_bloque": True, "must_change_password": True,
         "password_temp_created_at": "2026-10-28T10:00:00+00:00", "created_at": "2026-10-28T10:00:00+00:00"},
        # Ya eligió la suya.
        {"id": "c-propia", "driver_id": "f-propia", "email": "propia@empresa.es", "hashed_password": server.hash_password(PROPIA),
         "active": True, "password_changed_at": "2026-10-29T10:00:00+00:00", "created_at": "2026-10-28T10:00:00+00:00"},
        # La oficina le quitó el acceso.
        {"id": "c-off", "driver_id": "f-off", "email": "desactivada@empresa.es", "hashed_password": server.hash_password(OTRA_TEMPORAL),
         "active": False, "must_change_password": True, "created_at": "2026-10-28T10:00:00+00:00"},
    ])
    tenant["driver_recovery_emails"] = Col([])
    tenant["driver_clave_codes"] = Col([])
    globales = Db()
    globales["organizations"] = Col([{"id": "o1", "slug": "oga5", "name": "OGA5", "account_type": "dsp",
                                      "db_name": "dsp_o1", "status": "active",
                                      "contrasena_inicial_hash": server.hash_password(INICIAL)}])
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

    async def sin_espera(_s):
        return None
    monkeypatch.setattr(server.asyncio, "sleep", sin_espera)
    server._login_fails.clear()
    server._public_actions.clear()
    server._FICHA_ACTIVA_CACHE.clear()
    tenant.globales = globales
    return tenant


def _peticion(ip="10.0.0.1"):
    return SimpleNamespace(headers={}, client=SimpleNamespace(host=ip), url=SimpleNamespace(path="/api/auth/driver-login"),
                           method="POST")


async def _entrar(correo, clave, ip="10.0.0.1"):
    return await server.driver_login(server.DriverLoginRequest(email=correo, password=clave), _peticion(ip))


def _cuenta(base, driver_id):
    return next(c for c in base["driver_accounts"].docs if c["driver_id"] == driver_id)


@pytest.mark.asyncio(loop_scope="session")
async def test_quien_no_tenia_cuenta_entra_con_la_inicial_y_tiene_que_elegir_la_suya(base):
    s = await _entrar("Sin.Cuenta@Empresa.es ", INICIAL)
    assert s.role == "driver" and s.id == "f-sin" and s.configurar_cuenta is True
    c = _cuenta(base, "f-sin")
    assert c["must_change_password"] and c["contrasena_inicial"] and server.verify_password(INICIAL, c["hashed_password"])


@pytest.mark.asyncio(loop_scope="session")
async def test_quien_tenia_otra_temporal_entra_tambien_con_la_inicial(base):
    s = await _entrar("temporal@empresa.es", INICIAL)
    assert s.id == "f-temp" and s.configurar_cuenta is True
    assert server.verify_password(INICIAL, _cuenta(base, "f-temp")["hashed_password"])


@pytest.mark.asyncio(loop_scope="session")
async def test_quien_ya_eligio_la_suya_no_entra_con_la_inicial_y_se_le_dice_por_que(base):
    with pytest.raises(HTTPException) as e:
        await _entrar("propia@empresa.es", INICIAL)
    assert e.value.status_code == 401 and e.value.detail == server._MSG_INICIAL_YA_CAMBIADA
    assert server.verify_password(PROPIA, _cuenta(base, "f-propia")["hashed_password"])   # su contraseña no se toca
    assert (await _entrar("propia@empresa.es", PROPIA)).id == "f-propia"


@pytest.mark.asyncio(loop_scope="session")
async def test_desde_la_app_tambien_llega_el_porque(base):
    with pytest.raises(HTTPException) as e:
        await server.app_login(server.AppLoginRequest(identifier="propia@empresa.es", password=INICIAL), _peticion())
    assert e.value.detail == server._MSG_INICIAL_YA_CAMBIADA
    # Y una contraseña cualquiera sigue sin decir nada de la cuenta.
    with pytest.raises(HTTPException) as e:
        await server.app_login(server.AppLoginRequest(identifier="propia@empresa.es", password="cualquiera-1"), _peticion())
    assert e.value.detail == "Correo/usuario o contraseña incorrectos"
    s = await server.app_login(server.AppLoginRequest(identifier="sin.cuenta@empresa.es", password=INICIAL), _peticion())
    assert s["app_destino"] == "conductor" and s["configurar_cuenta"] is True


@pytest.mark.asyncio(loop_scope="session")
async def test_la_inicial_no_reabre_una_ficha_de_baja_ni_un_acceso_quitado(base):
    for correo in ("baja@empresa.es", "desactivada@empresa.es", "nadie@empresa.es"):
        with pytest.raises(HTTPException) as e:
            await _entrar(correo, INICIAL)
        assert e.value.status_code in (401, 403) and e.value.detail != server._MSG_INICIAL_YA_CAMBIADA
    assert _cuenta(base, "f-off")["active"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_inicial_definida_todo_sigue_como_antes(base):
    base.globales["organizations"].docs[0].pop("contrasena_inicial_hash")
    with pytest.raises(HTTPException) as e:
        await _entrar("sin.cuenta@empresa.es", INICIAL)
    assert e.value.detail == "Email o contraseña incorrectos"
    assert not [c for c in base["driver_accounts"].docs if c["driver_id"] == "f-sin"]


@pytest.mark.asyncio(loop_scope="session")
async def test_el_ciclo_entero_entra_con_la_inicial_elige_la_suya_y_la_inicial_deja_de_valer(base):
    s = await _entrar("sin.cuenta@empresa.es", INICIAL)
    yo = {"sub": s.id, "role": "driver", "org_id": "o1", "db_name": "dsp_o1"}
    # La pantalla obligatoria no pide la actual: es temporal.
    assert await server.change_my_password({"current_password": "", "new_password": "la-de-ana-1"}, yo) == {"success": True}
    s2 = await _entrar("sin.cuenta@empresa.es", "la-de-ana-1")
    assert s2.id == "f-sin" and s2.configurar_cuenta is False
    with pytest.raises(HTTPException) as e:
        await _entrar("sin.cuenta@empresa.es", INICIAL)
    assert e.value.detail == server._MSG_INICIAL_YA_CAMBIADA


@pytest.mark.asyncio(loop_scope="session")
async def test_bloqueado_por_probar_dice_que_espere_y_la_oficina_lo_desbloquea(base):
    for _ in range(server._LOGIN_MAX_FAILS):
        with pytest.raises(HTTPException):
            await _entrar("temporal@empresa.es", "mal-escrita-1")
    with pytest.raises(HTTPException) as e:
        await _entrar("temporal@empresa.es", INICIAL)
    assert e.value.status_code == 429 and "Espera" in e.value.detail
    oficina = {"sub": "u1", "role": "admin", "org_id": "o1", "name": "María"}
    await server.set_driver_password(server.SetDriverPasswordRequest(driver_id="f-temp", password="puesta-por-la-oficina-1"), oficina)
    assert (await _entrar("temporal@empresa.es", "puesta-por-la-oficina-1")).id == "f-temp"


@pytest.mark.asyncio(loop_scope="session")
async def test_veinte_compañeros_en_la_misma_wifi_no_bloquean_la_nave(base):
    # Diez se equivocan una vez cada uno desde la misma IP: el resto sigue entrando.
    for i in range(20):
        with pytest.raises(HTTPException):
            await _entrar(f"no.existe{i}@empresa.es", "lo-que-sea-1", ip="80.1.1.1")
    assert server._LOGIN_MAX_FAILS_IP >= 50
    assert (await _entrar("sin.cuenta@empresa.es", INICIAL, ip="80.1.1.1")).id == "f-sin"
