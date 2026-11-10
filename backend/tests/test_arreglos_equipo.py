# -*- coding: utf-8 -*-
"""Arreglos del equipo (10-11-2026, docs/REVISION-FLOTA-PROPIA-10-11.md, zona «equipo»).

· equipo-4: «Añadir una persona» en Incorporaciones la dejaba sin nave y, con una nave elegida arriba, no salía.
· equipo-1: la «contraseña temporal común» pisaba a TODA la empresa, también a quien ya se había puesto la suya.
· equipo-12: la contraseña que la oficina pone en una ficha pedía 6 caracteres en la pantalla y ninguno en el servidor.

Con la base de mentira (base_de_mentira.py): sin MongoDB.
"""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

import server
from base_de_mentira import Col, Db

TEMPORAL = "temporal-de-la-nave-1"
PROPIA = "la-mia-de-siempre-1"
VIEJA = "vieja-1"
DANI = {"sub": "u1", "name": "Dani", "role": "admin", "account_type": "owner"}
MERY = {"sub": "u2", "name": "Mery", "role": "admin", "account_type": "dsp", "allowed_centers": ["DGA1"]}


class _ColUnica(Col):
    """Como el índice único de `clave` de incorporaciones (server.py, _idx_unico): la segunda alta da DuplicateKeyError."""

    async def insert_one(self, doc):
        if any(d.get("clave") == doc.get("clave") for d in self.docs):
            raise DuplicateKeyError("clave repetida")
        return await super().insert_one(doc)


@pytest.fixture
def base(monkeypatch):
    tenant = Db()
    tenant["incorporaciones"] = _ColUnica([
        {"id": "p-oga5", "nombre": "ANA OGA5", "telefono": "600000001", "clave": "tel:600000001", "centro": "OGA5"},
        {"id": "p-dga1", "nombre": "LUIS DGA1", "telefono": "600000002", "clave": "tel:600000002", "centro": "DGA1"},
        {"id": "p-vacia", "nombre": "EVA SIN NAVE", "telefono": "600000003", "clave": "tel:600000003", "centro": ""},
        {"id": "p-falta", "nombre": "IVAN SIN CAMPO", "telefono": "600000004", "clave": "tel:600000004"},
        {"id": "p-dentro", "nombre": "OLGA DENTRO", "telefono": "600000005", "clave": "tel:600000005",
         "centro": "DGA2", "archivada": True},
    ])
    tenant["drivers"] = Col([
        {"id": "d-nueva", "name": "NUEVA OGA5", "email": "nueva@empresa.es", "center": "OGA5", "active": True},
        {"id": "d-temp", "name": "TEMPORAL OGA5", "email": "temp@empresa.es", "center": "OGA5", "active": True},
        {"id": "d-propia", "name": "PROPIA OGA5", "email": "propia@empresa.es", "center": "OGA5", "active": True},
        {"id": "d-off", "name": "SIN ACCESO OGA5", "email": "off@empresa.es", "center": "OGA5", "active": True},
        {"id": "d-sincorreo", "name": "SIN CORREO OGA5", "email": "", "center": "OGA5", "active": True},
        {"id": "d-dga1", "name": "PROPIA DGA1", "email": "dga1@empresa.es", "center": "DGA1", "active": True},
        {"id": "d-dga1-sc", "name": "SIN CORREO DGA1", "email": "", "center": "DGA1", "active": True},
        {"id": "d-baja", "name": "DE BAJA", "email": "baja@empresa.es", "center": "OGA5", "active": False},
    ])
    tenant["driver_accounts"] = Col([
        # La temporal de antes: nunca eligió la suya.
        {"id": "c-temp", "driver_id": "d-temp", "email": "temp@empresa.es", "hashed_password": "h-vieja-temp",
         "active": True, "creada_en_bloque": True, "must_change_password": True,
         "password_temp_created_at": "2026-10-28T10:00:00+00:00", "created_at": "2026-10-28T10:00:00+00:00"},
        # Ya eligió la suya (la usa en la app).
        {"id": "c-propia", "driver_id": "d-propia", "email": "propia@empresa.es", "hashed_password": "h-propia",
         "active": True, "password_changed_at": "2026-10-29T10:00:00+00:00", "created_at": "2026-10-28T10:00:00+00:00"},
        # La oficina le quitó el acceso.
        {"id": "c-off", "driver_id": "d-off", "email": "off@empresa.es", "hashed_password": "h-off",
         "active": False, "created_at": "2026-10-28T10:00:00+00:00"},
        {"id": "c-dga1", "driver_id": "d-dga1", "email": "dga1@empresa.es", "hashed_password": "h-dga1",
         "active": True, "password_changed_at": "2026-10-30T10:00:00+00:00", "created_at": "2026-10-28T10:00:00+00:00"},
    ])
    globales = Db()
    globales["organizations"] = Col([{"id": "o1", "account_type": "owner", "db_name": server._DEFAULT_DB_NAME,
                                      "centers": ["OGA5", "DGA1", "DGA2"]}])
    monkeypatch.setattr(server, "db", tenant)
    monkeypatch.setattr(server, "global_db", globales)
    server._login_fails.clear()
    return tenant


def _cuenta(base, driver_id):
    return next((c for c in base["driver_accounts"].docs if c["driver_id"] == driver_id), None)


# ── equipo-4: el alta a mano de Incorporaciones ─────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_alta_a_mano_guarda_la_nave_que_llega(base):
    r = await server.onb_alta({"nombre": "NUEVO", "telefono": "611111111", "centro": "DGA2"}, DANI)
    assert r["persona"]["centro"] == "DGA2"


@pytest.mark.asyncio(loop_scope="session")
async def test_alta_sin_nave_usa_la_unica_de_quien_la_da_de_alta(base):
    """Un panel viejo (o sin nave elegida) no la manda: quien solo tiene DGA1 la da de alta en DGA1."""
    r = await server.onb_alta({"nombre": "NUEVO", "telefono": "611111112"}, MERY)
    assert r["persona"]["centro"] == "DGA1"
    # Con varias naves no se adivina: queda sin nave (y la lista la enseña marcada).
    r = await server.onb_alta({"nombre": "OTRO", "telefono": "611111113"}, DANI)
    assert r["persona"]["centro"] == ""


@pytest.mark.asyncio(loop_scope="session")
async def test_la_lista_de_una_nave_saca_tambien_a_quien_no_tiene_nave(base):
    r = await server.onb_listar("OGA5", DANI)
    nombres = {p["nombre"] for p in r["personas"]}
    assert nombres == {"ANA OGA5", "EVA SIN NAVE", "IVAN SIN CAMPO"}
    # Con «Todos» (sin center), como antes: todos menos los archivados.
    r = await server.onb_listar(None, DANI)
    assert {p["nombre"] for p in r["personas"]} == {"ANA OGA5", "LUIS DGA1", "EVA SIN NAVE", "IVAN SIN CAMPO"}


@pytest.mark.asyncio(loop_scope="session")
async def test_ya_esta_en_la_lista_dice_donde_esta(base):
    for tel, donde in (("600000002", "en DGA1"), ("600000003", "sin nave"),
                       ("600000005", "«Ya está dentro»")):
        with pytest.raises(HTTPException) as e:
            await server.onb_alta({"nombre": "REPETIDA", "telefono": tel, "centro": "OGA5"}, DANI)
        assert e.value.status_code == 409
        assert e.value.detail.startswith("Esa persona ya está en la lista")
        assert donde in e.value.detail, e.value.detail


# ── equipo-1: la contraseña temporal común ──────────────────────────────────

def _peticion(**k):
    return server.DriverBulkPasswordRequest(password=TEMPORAL, **k)


@pytest.mark.asyncio(loop_scope="session")
async def test_temporal_solo_a_la_nave_elegida_y_respeta_a_quien_tiene_la_suya(base):
    r = await server.generar_accesos_conductores(_peticion(center="OGA5"), DANI)
    assert r["actualizadas"] == 2 and r["naves"] == {"OGA5": 2}
    assert r["respetadas"] == 1 and r["sin_email"] == 1 and r["cuentas_inactivas"] == 1
    # La nueva (sin cuenta) y la que tenía otra temporal entran con la temporal nueva.
    assert server.verify_password(TEMPORAL, _cuenta(base, "d-nueva")["hashed_password"])
    assert server.verify_password(TEMPORAL, _cuenta(base, "d-temp")["hashed_password"])
    # La suya no se toca, ni la de DGA1, ni la desactivada.
    assert _cuenta(base, "d-propia")["hashed_password"] == "h-propia"
    assert _cuenta(base, "d-dga1")["hashed_password"] == "h-dga1"
    assert _cuenta(base, "d-off")["hashed_password"] == "h-off" and _cuenta(base, "d-off")["active"] is False
    assert _cuenta(base, "d-baja") is None


@pytest.mark.asyncio(loop_scope="session")
async def test_temporal_con_la_casilla_incluye_a_quien_ya_tenia_la_suya(base):
    r = await server.generar_accesos_conductores(_peticion(center="OGA5", incluir_propias=True), DANI)
    assert r["actualizadas"] == 3 and r["respetadas"] == 0
    c = _cuenta(base, "d-propia")
    assert server.verify_password(TEMPORAL, c["hashed_password"]) and c["must_change_password"] is True
    assert _cuenta(base, "d-off")["hashed_password"] == "h-off"      # la desactivada, tampoco con la casilla


@pytest.mark.asyncio(loop_scope="session")
async def test_temporal_sin_nave_es_todas_como_antes_pero_respetando_la_suya(base):
    """Un panel viejo solo manda la contraseña: todas las naves, como antes, pero sin pisar a quien ya tiene la suya."""
    r = await server.generar_accesos_conductores(server.DriverBulkPasswordRequest(password=TEMPORAL), DANI)
    assert r["actualizadas"] == 2 and r["respetadas"] == 2 and r["sin_email"] == 2
    assert _cuenta(base, "d-dga1")["hashed_password"] == "h-dga1"
    assert _cuenta(base, "d-propia")["hashed_password"] == "h-propia"


@pytest.mark.asyncio(loop_scope="session")
async def test_temporal_nunca_va_mas_alla_de_las_naves_de_quien_la_aplica(base):
    """En una empresa cliente, alguien solo de DGA1 con «Todos» toca solo DGA1, y no puede pedir OGA5."""
    r = await server.generar_accesos_conductores(_peticion(center="Todos", incluir_propias=True), MERY)
    assert r["naves"] == {"DGA1": 1} and r["sin_email"] == 1
    assert _cuenta(base, "d-temp")["hashed_password"] == "h-vieja-temp"
    with pytest.raises(HTTPException) as e:
        await server.generar_accesos_conductores(_peticion(center="OGA5"), MERY)
    assert e.value.status_code == 403


@pytest.mark.asyncio(loop_scope="session")
async def test_la_previa_cuenta_lo_mismo_y_no_cambia_nada(base):
    antes = [dict(c) for c in base["driver_accounts"].docs]
    p = await server.previa_accesos_conductores("OGA5", False, DANI)
    assert (p["actualizadas"], p["respetadas"], p["sin_email"], p["cuentas_inactivas"]) == (2, 1, 1, 1)
    assert p["naves"] == {"OGA5": 2}
    p = await server.previa_accesos_conductores(None, True, DANI)
    assert p["actualizadas"] == 4 and p["naves"] == {"DGA1": 1, "OGA5": 3} and p["sin_email"] == 2
    assert base["driver_accounts"].docs == antes


@pytest.mark.asyncio(loop_scope="session")
async def test_la_suya_cuenta_tambien_por_el_correo(base):
    """Con dos fichas, la cuenta con la suya puede ir con el id de la otra: se le respeta igual (mismo criterio que
    _entrar_con_la_inicial)."""
    base["drivers"].docs.append({"id": "d-dup", "name": "PROPIA OGA5", "email": "Propia@Empresa.es",
                                 "center": "OGA5", "active": True})
    r = await server.generar_accesos_conductores(_peticion(center="OGA5"), DANI)
    assert r["respetadas"] == 2 and _cuenta(base, "d-dup") is None


# ── equipo-12: la contraseña de la ficha pide 8 ─────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_la_contrasena_de_la_ficha_pide_ocho_caracteres(base):
    with pytest.raises(HTTPException) as e:
        await server.set_driver_password(server.SetDriverPasswordRequest(driver_id="d-temp", password="corta12"), DANI)
    assert e.value.status_code == 400 and "8" in e.value.detail
    assert _cuenta(base, "d-temp")["hashed_password"] == "h-vieja-temp"
    r = await server.set_driver_password(server.SetDriverPasswordRequest(driver_id="d-temp", password="larga123"), DANI)
    assert r["success"] is True
    assert server.verify_password("larga123", _cuenta(base, "d-temp")["hashed_password"])


@pytest.mark.asyncio(loop_scope="session")
async def test_quien_ya_tiene_una_corta_sigue_entrando(monkeypatch, base):
    """El mínimo es solo al ponerla: una contraseña de 6 que ya existía sigue abriendo."""
    base["driver_accounts"].docs.append({
        "id": "c-corta", "driver_id": "d-nueva", "email": "nueva@empresa.es",
        "hashed_password": server.hash_password(VIEJA), "active": True,
        "password_changed_at": "2026-10-01T10:00:00+00:00", "created_at": "2026-09-01T10:00:00+00:00"})
    base["driver_recovery_emails"] = Col([])
    base["driver_clave_codes"] = Col([])
    base.globales = server.global_db
    server.global_db["organizations"].docs[0].update({"slug": "flota", "name": "Flota", "status": "active"})
    server.global_db["admin_users"] = Col([])

    class _Cliente(dict):
        def __missing__(self, nombre):
            self[nombre] = Db()
            return self[nombre]
    monkeypatch.setattr(server, "client", _Cliente({server._DEFAULT_DB_NAME: base}))

    async def org(oid):
        return await server.global_db["organizations"].find_one({"id": oid}, {"_id": 0})
    monkeypatch.setattr(server, "get_org", org)

    async def sin_espera(_s):
        return None
    monkeypatch.setattr(server.asyncio, "sleep", sin_espera)
    server._public_actions.clear()
    server._FICHA_ACTIVA_CACHE.clear()
    pet = SimpleNamespace(headers={}, client=SimpleNamespace(host="10.0.0.9"),
                          url=SimpleNamespace(path="/api/auth/driver-login"), method="POST")
    s = await server.driver_login(server.DriverLoginRequest(email="nueva@empresa.es", password=VIEJA), pet)
    assert s.id == "d-nueva"
