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
    # Con varias naves no se adivina: queda sin centro (y sale en el bloque «Sin centro» de la pantalla).
    r = await server.onb_alta({"nombre": "OTRO", "telefono": "611111113"}, DANI)
    assert r["persona"]["centro"] == ""


@pytest.mark.asyncio(loop_scope="session")
async def test_la_lista_de_un_centro_es_la_de_main_solo_su_gente(base):
    """G3/G6 (revisión final, 11-11-2026): con un centro elegido, SOLO la gente de ese centro, como en main. Los sin
    centro salían en los tres centros: en sus contadores, en sus tandas de WhatsApp y en su CSV."""
    base["incorporaciones"].docs.append({"id": "p-espacios", "nombre": "PACO ESPACIOS", "telefono": "600000006",
                                         "clave": "tel:600000006", "centro": "  "})
    # El mismo filtro que main (`q["centro"] = {"$regex": ..., "$options": "i"}`), y lo comparten lista y CSV.
    assert server._onb_filtro_centro("OGA5") == {"centro": {"$regex": "OGA5", "$options": "i"}}
    assert server._onb_filtro_centro(None) == {} and server._onb_filtro_centro("") == {}
    r = await server.onb_listar("OGA5", DANI)
    assert {p["nombre"] for p in r["personas"]} == {"ANA OGA5"}
    # Los contadores son solo de su gente: una persona en total.
    assert sum(r["por_columna"].values()) == 1 and sum(r["por_fase"].values()) == 1
    # Con «Todos» (sin center), como en main: todos menos los archivados, también los sin centro.
    r = await server.onb_listar(None, DANI)
    assert {p["nombre"] for p in r["personas"]} == {"ANA OGA5", "LUIS DGA1", "EVA SIN NAVE", "IVAN SIN CAMPO",
                                                    "PACO ESPACIOS"}


@pytest.mark.asyncio(loop_scope="session")
async def test_los_sin_centro_se_piden_aparte(base):
    """G3/G6: el parámetro nuevo y opcional `sin_centro` da SOLO a quien no tiene centro (vacío, sin el campo o solo
    espacios), con o sin centro elegido; nunca a los archivados."""
    base["incorporaciones"].docs.append({"id": "p-espacios", "nombre": "PACO ESPACIOS", "telefono": "600000006",
                                         "clave": "tel:600000006", "centro": "  "})
    base["incorporaciones"].docs.append({"id": "p-sc-dentro", "nombre": "SARA DENTRO", "telefono": "600000007",
                                         "clave": "tel:600000007", "centro": "", "archivada": True})
    for center in ("OGA5", None):
        r = await server.onb_listar(center, DANI, sin_centro=True)
        assert {p["nombre"] for p in r["personas"]} == {"EVA SIN NAVE", "IVAN SIN CAMPO", "PACO ESPACIOS"}


@pytest.mark.asyncio(loop_scope="session")
async def test_recien_dada_de_alta_se_ve_en_su_centro(base):
    await server.onb_alta({"nombre": "NUEVO DGA2", "telefono": "611111119", "centro": "DGA2"}, DANI)
    assert "NUEVO DGA2" in {p["nombre"] for p in (await server.onb_listar("DGA2", DANI))["personas"]}
    assert "NUEVO DGA2" not in {p["nombre"] for p in (await server.onb_listar("DGA2", DANI, sin_centro=True))["personas"]}


@pytest.mark.asyncio(loop_scope="session")
async def test_ya_esta_en_la_lista_dice_donde_esta(base):
    # «sin centro», la palabra del panel (corrección del 10-11-2026, R38; antes decía «sin nave»).
    for tel, donde in (("600000002", "en DGA1"), ("600000003", "sin centro"),
                       ("600000005", "«Ya está dentro»")):
        with pytest.raises(HTTPException) as e:
            await server.onb_alta({"nombre": "REPETIDA", "telefono": tel, "centro": "OGA5"}, DANI)
        assert e.value.status_code == 409
        assert e.value.detail.startswith("Esa persona ya está en la lista")
        assert donde in e.value.detail, e.value.detail


@pytest.mark.asyncio(loop_scope="session")
async def test_el_csv_de_un_centro_saca_lo_mismo_que_la_lista(base):
    """R34 y G3: el CSV de un centro es lo que enseña su lista, y como en main: solo la gente de ese centro (el CSV
    se manda a la ETT o a Coordinación; los sin centro iban en el de los tres)."""
    r = await server.onb_export("OGA5", DANI)
    csv = r.body.decode("utf-8")
    assert "ANA OGA5" in csv
    for nombre in ("EVA SIN NAVE", "IVAN SIN CAMPO", "LUIS DGA1", "OLGA DENTRO"):
        assert nombre not in csv, nombre
    lista = {p["nombre"] for p in (await server.onb_listar("OGA5", DANI))["personas"]}
    assert lista == {"ANA OGA5"}
    # Con «Todos», todos (menos los archivados), como en main.
    csv = (await server.onb_export(None, DANI)).body.decode("utf-8")
    for nombre in ("ANA OGA5", "LUIS DGA1", "EVA SIN NAVE", "IVAN SIN CAMPO"):
        assert nombre in csv, nombre


@pytest.mark.asyncio(loop_scope="session")
async def test_se_le_puede_poner_el_centro_a_quien_no_lo_tiene(base):
    """R36: el PATCH admite `centro`, limpio como en el alta; después sale solo en su centro."""
    r = await server.onb_editar("p-vacia", {"centro": " amzl dga1 santiago "}, DANI)
    assert r["centro"] == "DGA1"
    eva = next(p for p in base["incorporaciones"].docs if p["id"] == "p-vacia")
    assert eva["centro"] == "DGA1"
    assert "EVA SIN NAVE" not in {p["nombre"] for p in (await server.onb_listar("OGA5", DANI))["personas"]}
    assert "EVA SIN NAVE" in {p["nombre"] for p in (await server.onb_listar("DGA1", DANI))["personas"]}
    assert "EVA SIN NAVE" not in {p["nombre"] for p in (await server.onb_listar(None, DANI, sin_centro=True))["personas"]}
    # Sin `centro` en el cuerpo, el centro no se toca.
    await server.onb_editar("p-oga5", {"nota": "llamar"}, DANI)
    assert next(p for p in base["incorporaciones"].docs if p["id"] == "p-oga5")["centro"] == "OGA5"


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
    # G7 (revisión final): la pantalla vieja solo pinta `aviso`; dice a cuántos no se les ha cambiado.
    assert r["aviso"].startswith("La contraseña anterior de las cuentas cambiadas queda invalidada.")
    assert r["aviso"].endswith("A 2 que ya tenían su contraseña no se les ha cambiado: siguen entrando con la suya.")


@pytest.mark.asyncio(loop_scope="session")
async def test_el_aviso_dice_a_cuantos_se_les_respeto_la_suya(base):
    """G7: con uno respetado, en singular; con la casilla (nadie respetado), el aviso no dice nada de eso."""
    r = await server.generar_accesos_conductores(_peticion(center="OGA5"), DANI)
    assert r["respetadas"] == 1
    assert r["aviso"].endswith(" A 1 que ya tenía su contraseña no se le ha cambiado: sigue entrando con la suya.")
    r = await server.generar_accesos_conductores(_peticion(center="OGA5", incluir_propias=True), DANI)
    assert r["respetadas"] == 0
    assert r["aviso"] == ("La contraseña anterior de las cuentas cambiadas queda invalidada. "
                          "Todos ellos comparten la contraseña temporal hasta cambiarla. "
                          "El portal obliga a elegir una contraseña personal en el siguiente acceso.")


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


@pytest.mark.asyncio(loop_scope="session")
async def test_la_previa_dice_cuantos_sin_centro_se_quedan_fuera(base):
    """R40/R42: la lista de un centro enseña a los «sin centro», pero la temporal de ese centro no los toca: la previa
    (y el resultado) dicen cuántos se quedan fuera. Con «Todos» entran, y no queda nadie fuera."""
    base["drivers"].docs += [
        {"id": "d-sc1", "name": "SIN CENTRO 1", "email": "sc1@empresa.es", "center": "", "active": True},
        {"id": "d-sc2", "name": "SIN CENTRO 2", "email": "sc2@empresa.es", "active": True},
        {"id": "d-sc3", "name": "SIN CENTRO 3", "email": "sc3@empresa.es", "center": "  ", "active": True},
        {"id": "d-sc-baja", "name": "SIN CENTRO BAJA", "email": "scb@empresa.es", "center": "", "active": False},
    ]
    p = await server.previa_accesos_conductores("OGA5", False, DANI)
    assert p["sin_centro_fuera"] == 3 and p["actualizadas"] == 2 and p["naves"] == {"OGA5": 2}
    p = await server.previa_accesos_conductores(None, False, DANI)
    assert p["sin_centro_fuera"] == 0 and p["naves"] == {"OGA5": 2, "sin centro": 3}
    r = await server.generar_accesos_conductores(_peticion(center="OGA5"), DANI)
    assert r["sin_centro_fuera"] == 3 and _cuenta(base, "d-sc1") is None


@pytest.mark.asyncio(loop_scope="session")
async def test_los_sin_centro_fuera_son_solo_los_que_todos_si_tocaria(base):
    """Segunda revisión S7: los «sin centro» sin correo, con el acceso desactivado o con la suya (salvo la casilla)
    tampoco los tocaría «Todos»: no cuentan como «fuera». Y `con_todos_entran` dice si «Todos» los incluiría: a un
    usuario limitado a sus centros, no, ni con «Todos»."""
    base["drivers"].docs += [
        {"id": "d-sc-ok", "name": "SIN CENTRO SIN CUENTA", "email": "scok@empresa.es", "center": "", "active": True},
        {"id": "d-sc-nomail", "name": "SIN CENTRO SIN CORREO", "email": "", "active": True},
        {"id": "d-sc-off", "name": "SIN CENTRO DESACTIVADA", "email": "scoff@empresa.es", "center": "", "active": True},
        {"id": "d-sc-suya", "name": "SIN CENTRO CON LA SUYA", "email": "scsuya@empresa.es", "active": True},
    ]
    base["driver_accounts"].docs += [
        {"id": "c-sc-off", "driver_id": "d-sc-off", "email": "scoff@empresa.es", "hashed_password": "h",
         "active": False, "created_at": "2026-10-28T10:00:00+00:00"},
        {"id": "c-sc-suya", "driver_id": "d-sc-suya", "email": "scsuya@empresa.es", "hashed_password": "h",
         "active": True, "password_changed_at": "2026-10-29T10:00:00+00:00", "created_at": "2026-10-28T10:00:00+00:00"},
    ]
    p = await server.previa_accesos_conductores("OGA5", False, DANI)
    assert p["sin_centro_fuera"] == 1 and p["con_todos_entran"] is True
    # Lo que dice coincide con lo que «Todos» les cambiaría de verdad.
    assert (await server.previa_accesos_conductores(None, False, DANI))["naves"].get("sin centro") == 1
    p = await server.previa_accesos_conductores("OGA5", True, DANI)
    assert p["sin_centro_fuera"] == 2
    assert (await server.previa_accesos_conductores(None, True, DANI))["naves"].get("sin centro") == 2
    # Un usuario limitado a DGA1, ya en «Todos»: siguen fuera y «Todos» no los incluiría.
    p = await server.previa_accesos_conductores("Todos", False, MERY)
    assert p["sin_centro_fuera"] == 1 and p["con_todos_entran"] is False
    # Con «Todos» y sin límites no hay nadie fuera.
    p = await server.previa_accesos_conductores(None, False, DANI)
    assert p["sin_centro_fuera"] == 0 and p["con_todos_entran"] is True


@pytest.mark.asyncio(loop_scope="session")
async def test_el_desglose_agrupa_por_el_codigo_del_centro(base):
    """R43: 'AMZL OGA5 SANTIAGO XPT', 'oga5' y 'OGA5 ' son OGA5, no tres centros distintos en la confirmación."""
    base["drivers"].docs += [
        {"id": "d-largo", "name": "LARGO", "email": "largo@empresa.es", "center": "AMZL OGA5 SANTIAGO XPT", "active": True},
        {"id": "d-minus", "name": "MINUS", "email": "minus@empresa.es", "center": "oga5", "active": True},
        {"id": "d-hueco", "name": "HUECO", "email": "hueco@empresa.es", "center": "OGA5 ", "active": True},
    ]
    p = await server.previa_accesos_conductores("OGA5", False, DANI)
    assert p["naves"] == {"OGA5": 5} and p["actualizadas"] == 5


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
