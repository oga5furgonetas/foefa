# -*- coding: utf-8 -*-
"""Tanda 3, zona «usuarios» (11-11-2026, docs/REVISION-FLOTA-PROPIA-10-11.md).

· equipo-2: un jefe de centro limitado daba «todos los centros», ampliaba naves que no tiene y tocaba (editar, cambiar
  la contraseña, borrar) a usuarios con acceso total. Un jefe sin restricción sigue pudiendo con cualquier no-jefe.
· equipo-10: añadir naves solo el super-admin y quien tenga «Admin completo»; quitar una nave vacía; la vista previa
  de las importaciones, con las naves que ve quien importa.

Con la base de mentira (base_de_mentira.py): sin MongoDB.
"""
import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Db

ORG = "o1"
SA = {"sub": "sa", "name": "Dani", "role": "admin", "org_id": ORG, "account_type": "owner", "sa": True,
      "admin_role": None, "allowed_centers": None}
JEFE_DGA1 = {"sub": "jefe1", "name": "Jefe DGA1", "role": "admin", "org_id": ORG, "account_type": "owner",
             "admin_role": "center_manager", "allowed_centers": ["DGA1"], "permissions": None}
JEFE_TODAS = {"sub": "jefe0", "name": "Jefe todas", "role": "admin", "org_id": ORG, "account_type": "owner",
              "admin_role": "center_manager", "allowed_centers": None, "permissions": None}
DISPATCHER = {"sub": "disp1", "name": "Disp", "role": "admin", "org_id": ORG, "account_type": "owner",
              "admin_role": "dispatcher", "allowed_centers": ["DGA1"], "permissions": None}


def _usuario(uid, centros, rol=None, **extra):
    return {"id": uid, "username": uid, "name": uid.upper(), "role": "admin", "org_id": ORG,
            "admin_role": rol, "allowed_centers": centros, "permissions": None, "hashed_password": "h", **extra}


@pytest.fixture
def base(monkeypatch):
    globales = Db()
    globales["admin_users"] = Col([
        _usuario("sa", None, super_admin=True),
        _usuario("jefe1", ["DGA1"], "center_manager"),
        _usuario("jefe0", None, "center_manager"),
        _usuario("disp1", ["DGA1"], "dispatcher"),
        _usuario("todo", None),                       # «Admin completo» de todas las naves (oficina de OGA5)
        _usuario("oga5", ["OGA5"], "dispatcher"),
        _usuario("dga1-completo", ["DGA1"]),          # «Admin completo» limitado a DGA1, creado antes del arreglo
        _usuario("vacio", [], "dispatcher"),           # [] también es «todas»
    ])
    monkeypatch.setattr(server, "global_db", globales)
    monkeypatch.setattr(server, "hash_password", lambda p: "h:" + p)
    return globales


def _doc(base, uid):
    return next((d for d in base["admin_users"].docs if d["id"] == uid), None)


async def _crear(actor, centros, rol=None, username="nuevo"):
    return await server.create_admin(server.CreateAdminRequest(
        username=username, password="123456", name="Nuevo", allowed_centers=centros, admin_role=rol), _admin=actor)


async def _no_puede(corutina):
    with pytest.raises(HTTPException) as e:
        await corutina
    assert e.value.status_code == 403, e.value.detail
    return e.value.detail


# ── equipo-2 · crear ────────────────────────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_jefe_limitado_no_crea_usuarios_de_todas_las_naves(base):
    await _no_puede(_crear(JEFE_DGA1, None, "dispatcher"))
    await _no_puede(_crear(JEFE_DGA1, [], "dispatcher"))
    assert _doc(base, "nuevo") is None


@pytest.mark.asyncio(loop_scope="session")
async def test_jefe_limitado_no_crea_usuarios_de_otra_nave(base):
    await _no_puede(_crear(JEFE_DGA1, ["OGA5"], "dispatcher"))
    await _no_puede(_crear(JEFE_DGA1, ["DGA1", "OGA5"], "dispatcher"))


@pytest.mark.asyncio(loop_scope="session")
async def test_jefe_limitado_crea_en_su_nave_y_siempre_como_dispatcher(base):
    r = await _crear(JEFE_DGA1, ["DGA1"], None)          # el formulario sale con el rol vacío
    assert r["success"]
    nuevo = _doc(base, r["id"])
    assert nuevo["allowed_centers"] == ["DGA1"]
    assert nuevo["admin_role"] == "dispatcher"


@pytest.mark.asyncio(loop_scope="session")
async def test_jefe_no_crea_otros_jefes(base):
    await _no_puede(_crear(JEFE_DGA1, ["DGA1"], "center_manager"))


@pytest.mark.asyncio(loop_scope="session")
async def test_jefe_sin_restriccion_crea_en_cualquier_nave_o_en_todas(base):
    r = await _crear(JEFE_TODAS, ["OGA5"], "dispatcher", username="a")
    assert _doc(base, r["id"])["allowed_centers"] == ["OGA5"]
    r = await _crear(JEFE_TODAS, None, "dispatcher", username="b")
    assert _doc(base, r["id"])["allowed_centers"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_super_admin_crea_como_hoy(base):
    r = await _crear(SA, None, None)
    d = _doc(base, r["id"])
    assert d["allowed_centers"] is None and d["admin_role"] is None
    r = await _crear(SA, ["OGA5"], "center_manager", username="otro")
    assert _doc(base, r["id"])["admin_role"] == "center_manager"


@pytest.mark.asyncio(loop_scope="session")
async def test_dispatcher_sigue_sin_crear(base):
    detalle = await _no_puede(_crear(DISPATCHER, ["DGA1"], "dispatcher"))
    assert detalle == "Sin permisos para crear usuarios"


# ── equipo-2 · editar, contraseña y borrar ──────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_jefe_limitado_no_amplia_las_naves_de_un_dispatcher_suyo(base):
    await _no_puede(server.update_admin_permissions("disp1", {"allowed_centers": None}, _admin=JEFE_DGA1))
    await _no_puede(server.update_admin_permissions("disp1", {"allowed_centers": ["OGA5"]}, _admin=JEFE_DGA1))
    await _no_puede(server.update_admin_permissions("disp1", {"allowed_centers": []}, _admin=JEFE_DGA1))
    assert _doc(base, "disp1")["allowed_centers"] == ["DGA1"]


@pytest.mark.asyncio(loop_scope="session")
async def test_jefe_limitado_guarda_como_hoy_dentro_de_sus_naves(base):
    # Lo que manda la pantalla al «Guardar permisos»: permisos, naves y el rol actual.
    r = await server.update_admin_permissions(
        "disp1", {"permissions": ["chat"], "allowed_centers": ["DGA1"], "admin_role": "dispatcher"}, _admin=JEFE_DGA1)
    assert r == {"success": True}
    assert _doc(base, "disp1")["permissions"] == ["chat"]


@pytest.mark.asyncio(loop_scope="session")
async def test_jefe_limitado_no_toca_a_quien_ve_todas_las_naves(base):
    for uid in ("todo", "vacio"):
        await _no_puede(server.update_admin_permissions(uid, {"permissions": ["chat"]}, _admin=JEFE_DGA1))
        await _no_puede(server.update_admin_permissions(uid, {"new_password": "otra-123"}, _admin=JEFE_DGA1))
        await _no_puede(server.delete_admin(uid, _admin=JEFE_DGA1))
        assert _doc(base, uid)["hashed_password"] == "h"
    await _no_puede(server.update_admin_permissions("oga5", {"permissions": []}, _admin=JEFE_DGA1))


@pytest.mark.asyncio(loop_scope="session")
async def test_jefe_no_sube_a_admin_completo_a_un_dispatcher(base):
    await _no_puede(server.update_admin_permissions(
        "disp1", {"permissions": ["chat"], "allowed_centers": ["DGA1"], "admin_role": None}, _admin=JEFE_DGA1))
    assert _doc(base, "disp1")["admin_role"] == "dispatcher"


@pytest.mark.asyncio(loop_scope="session")
async def test_jefe_no_toca_a_un_admin_completo_de_su_nave(base):
    # Corrección P16/P17 (11-11-2026): antes se le guardaba (la regla de naves sola lo dejaba). Un jefe solo gestiona
    # dispatchers: a un «Admin completo», aunque sea de su nave, ni los permisos.
    await _no_puede(server.update_admin_permissions(
        "dga1-completo", {"permissions": ["chat"], "allowed_centers": ["DGA1"], "admin_role": None}, _admin=JEFE_DGA1))
    d = _doc(base, "dga1-completo")
    assert d["permissions"] is None and d["admin_role"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_jefe_sin_restriccion_gestiona_a_cualquier_dispatcher(base):
    # Corrección P16/P17: «cualquier no-jefe» pasa a ser «cualquier dispatcher»; el «Admin completo» ya no.
    for uid in ("oga5", "disp1"):
        r = await server.update_admin_permissions(uid, {"permissions": ["chat"]}, _admin=JEFE_TODAS)
        assert r == {"success": True}
    r = await server.update_admin_permissions("oga5", {"allowed_centers": None}, _admin=JEFE_TODAS)
    assert r == {"success": True} and _doc(base, "oga5")["allowed_centers"] is None
    assert (await server.delete_admin("vacio", _admin=JEFE_TODAS)) == {"success": True}
    await _no_puede(server.update_admin_permissions("jefe1", {"permissions": []}, _admin=JEFE_TODAS))
    await _no_puede(server.update_admin_permissions("todo", {"permissions": ["chat"]}, _admin=JEFE_TODAS))


@pytest.mark.asyncio(loop_scope="session")
async def test_super_admin_edita_y_borra_como_hoy(base):
    r = await server.update_admin_permissions(
        "disp1", {"allowed_centers": None, "admin_role": None}, _admin=SA)
    assert r == {"success": True}
    d = _doc(base, "disp1")
    assert d["allowed_centers"] is None and d["admin_role"] is None
    assert (await server.delete_admin("todo", _admin=SA)) == {"success": True}


# ── equipo-2 · la lista ─────────────────────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_jefe_limitado_ve_lo_de_siempre_con_botones_solo_en_quien_gestiona(base):
    # Corrección P16/P17: la lista no esconde a nadie que se viera antes (sus naves y los de «todas»); a quien no
    # puede gestionar le llega `puede_gestionar: False` y la pantalla no le pone ni «Editar» ni la papelera.
    lista = {a["id"]: a for a in await server.list_admins(_admin=JEFE_DGA1)}
    assert set(lista) == {"jefe1", "disp1", "dga1-completo", "sa", "jefe0", "todo", "vacio"}
    assert {i for i, a in lista.items() if a["puede_gestionar"]} == {"disp1"}


@pytest.mark.asyncio(loop_scope="session")
async def test_jefe_sin_restriccion_ve_los_de_todas_y_los_dispatchers_que_gestiona(base):
    lista = {a["id"]: a for a in await server.list_admins(_admin=JEFE_TODAS)}
    assert set(lista) == {"sa", "jefe0", "todo", "vacio", "disp1", "oga5"}
    assert {i for i, a in lista.items() if a["puede_gestionar"]} == {"disp1", "oga5", "vacio"}


@pytest.mark.asyncio(loop_scope="session")
async def test_super_admin_ve_a_todos_como_hoy(base):
    lista = await server.list_admins(_admin=SA)
    assert len(lista) == len(base["admin_users"].docs)
    assert all("hashed_password" not in a for a in lista)
    assert all("puede_gestionar" not in a for a in lista)      # el campo nuevo solo va a los jefes


# ── equipo-10 · añadir y quitar naves ───────────────────────────────────────────────────────────────────────────────

COMPLETO = {"sub": "todo", "name": "Oficina", "role": "admin", "org_id": ORG, "account_type": "owner",
            "admin_role": None, "allowed_centers": None, "permissions": None}


@pytest.fixture
def naves(monkeypatch):
    tenant = Db()
    tenant["drivers"] = Col([
        {"id": "d1", "name": "ANA", "center": "AMZL OGA5 SANTIAGO XPT", "active": True},
        {"id": "d2", "name": "LUIS", "center": "DGA1", "active": True},
        {"id": "d3", "name": "DE BAJA", "center": "OGA9", "active": False},
        {"id": "d4", "name": "BORRADO", "center": "OGA9", "status": "deleted"},
        {"id": "d5", "name": "OTRA NAVE", "center": "DGA10", "active": True},
    ])
    tenant["vehicles"] = Col([
        {"id": "v1", "license_plate": "1111AAA", "center": "OGA5", "status": "active"},
        {"id": "v2", "license_plate": "2222BBB", "center": "dga2 ", "status": "active"},
        {"id": "v3", "license_plate": "3333CCC", "center": "OGA9", "status": "deleted"},
    ])
    globales = Db()
    globales["organizations"] = Col([{"id": ORG, "account_type": "owner",
                                      "centers": ["OGA5", "DGA1", "DGA2", "OGA9", "XYZ1"]}])
    globales["admin_users"] = Col([
        _usuario("todo", None),
        _usuario("disp-dga2", ["DGA2"], "dispatcher"),
        _usuario("de-otra-empresa", ["XYZ1"], org_id="o2"),
    ])
    monkeypatch.setattr(server, "db", tenant)
    monkeypatch.setattr(server, "global_db", globales)
    return globales


def _naves_de(globales):
    return globales["organizations"].docs[0]["centers"]


@pytest.mark.asyncio(loop_scope="session")
async def test_jefes_y_dispatchers_no_anaden_naves(naves):
    for actor in (DISPATCHER, JEFE_DGA1, JEFE_TODAS):
        detalle = await _no_puede(server.add_org_center({"name": "zzz9"}, user=actor))
        assert detalle == "Solo un administrador completo puede añadir centros"
    assert "ZZZ9" not in _naves_de(naves)


@pytest.mark.asyncio(loop_scope="session")
async def test_admin_completo_y_super_admin_anaden_como_hoy(naves):
    r = await server.add_org_center({"name": "zzz9"}, user=COMPLETO)
    assert r["ok"] and "ZZZ9" in r["centers"]
    await server.add_org_center({"name": "zzz8"}, user=SA)
    assert "ZZZ8" in _naves_de(naves)
    with pytest.raises(HTTPException) as e:
        await server.add_org_center({"name": "oga5"}, user=COMPLETO)
    assert e.value.status_code == 409


@pytest.mark.asyncio(loop_scope="session")
async def test_quitar_una_nave_vacia(naves):
    # OGA9: un conductor de baja, uno borrado y una furgoneta borrada no cuentan.
    r = await server.quitar_org_center("oga9", user=COMPLETO)
    assert r == {"ok": True, "centers": ["OGA5", "DGA1", "DGA2", "XYZ1"]}
    assert naves["audit_log"].docs[-1]["action"] == "centro_quitado"
    assert naves["audit_log"].docs[-1]["detail"] == {"centro": "OGA9"}
    # El usuario con «XYZ1» es de otra empresa: no cuenta. Y con espacios y en minúsculas, la encuentra.
    r = await server.quitar_org_center(" xyz1 ", user=SA)
    assert "XYZ1" not in r["centers"]


@pytest.mark.asyncio(loop_scope="session")
async def test_no_se_quita_una_nave_con_conductores_furgonetas_o_usuarios(naves):
    with pytest.raises(HTTPException) as e:
        await server.quitar_org_center("OGA5", user=COMPLETO)       # escrita sucia en la ficha: «AMZL OGA5 …»
    assert e.value.status_code == 409
    assert e.value.detail == {"mensaje": "OGA5 tiene 1 conductor y 1 furgoneta: muévelos a otro centro antes de quitarlo.",
                              "conductores": 1, "furgonetas": 1, "usuarios": 0, "traslados": 0}
    with pytest.raises(HTTPException) as e:
        await server.quitar_org_center("dga2", user=COMPLETO)       # «dga2 » en la furgoneta y un usuario con DGA2
    assert e.value.status_code == 409
    assert (e.value.detail["conductores"], e.value.detail["furgonetas"], e.value.detail["usuarios"]) == (0, 1, 1)
    with pytest.raises(HTTPException) as e:
        await server.quitar_org_center("DGA1", user=COMPLETO)       # «DGA10» es otra nave: solo cuenta LUIS
    assert e.value.detail["conductores"] == 1
    assert _naves_de(naves) == ["OGA5", "DGA1", "DGA2", "OGA9", "XYZ1"]


@pytest.mark.asyncio(loop_scope="session")
async def test_quitar_pide_lo_mismo_que_anadir_y_que_exista(naves):
    for actor in (DISPATCHER, JEFE_DGA1):
        await _no_puede(server.quitar_org_center("OGA9", user=actor))
    with pytest.raises(HTTPException) as e:
        await server.quitar_org_center("NADA1", user=COMPLETO)
    assert e.value.status_code == 404
    assert "OGA9" in _naves_de(naves)


@pytest.mark.asyncio(loop_scope="session")
async def test_no_se_quita_la_ultima_nave(naves):
    naves["organizations"].docs[0]["centers"] = ["OGA9"]
    with pytest.raises(HTTPException) as e:
        await server.quitar_org_center("OGA9", user=COMPLETO)
    assert e.value.status_code == 409
    assert _naves_de(naves) == ["OGA9"]


# ── equipo-10 · las importaciones, con las naves de quien importa ───────────────────────────────────────────────────

CLIENTE_DGA1 = {"sub": "c1", "name": "Jefa DGA1", "role": "admin", "org_id": "o2", "account_type": "dsp",
                "admin_role": "center_manager", "allowed_centers": ["DGA1"]}
CLIENTE_TODAS = {**CLIENTE_DGA1, "allowed_centers": None, "admin_role": None}
OWNER_DGA1 = {**CLIENTE_DGA1, "account_type": "owner"}       # en la cuenta dueña las naves no recortan el servidor
CSV = ("Nombre,Email,Centro\nAna Ruiz,ana@x.es,AMZL OGA5 SANTIAGO XPT\n"
       "Marta Gil,marta@x.es,AMZL DGA1 CORUNA\n").encode()


def _fichero():
    import io
    from starlette.datastructures import UploadFile
    return UploadFile(file=io.BytesIO(CSV), filename="plantilla.csv")


@pytest.fixture
def importar(monkeypatch):
    tenant = Db()
    tenant["drivers"] = Col([])
    globales = Db()
    globales["organizations"] = Col([{"id": "o2", "account_type": "dsp", "centers": ["OGA5", "DGA1"]}])
    monkeypatch.setattr(server, "db", tenant)
    monkeypatch.setattr(server, "global_db", globales)

    async def _naves():
        return ["OGA5", "DGA1"]
    monkeypatch.setattr(server, "_centros_de_la_empresa", _naves)
    return tenant


@pytest.mark.asyncio(loop_scope="session")
async def test_la_vista_previa_solo_ofrece_las_naves_de_quien_importa(importar):
    r = await server.drivers_importar_prev(file=_fichero(), center="", user=CLIENTE_DGA1)
    assert r["centros_empresa"] == ["DGA1"]
    por_clave = {g["clave"]: g for g in r["centros"]}
    assert por_clave["AMZL DGA1 CORUNA"]["conocido"] is True
    assert por_clave["AMZL OGA5 SANTIAGO XPT"]["conocido"] is False     # no sale marcada ni con destino


@pytest.mark.asyncio(loop_scope="session")
async def test_la_vista_previa_sigue_igual_sin_naves_asignadas_y_en_la_cuenta_duena(importar):
    for actor in (CLIENTE_TODAS, OWNER_DGA1, SA):
        r = await server.drivers_importar_prev(file=_fichero(), center="", user=actor)
        assert r["centros_empresa"] == ["DGA1", "OGA5"]
        assert all(g["conocido"] for g in r["centros"])


@pytest.mark.asyncio(loop_scope="session")
async def test_importar_a_una_nave_que_no_ve_se_rechaza(importar):
    import json
    eleccion = dict(centros=json.dumps(["AMZL OGA5 SANTIAGO XPT"]), mapa=json.dumps({"AMZL OGA5 SANTIAGO XPT": "OGA5"}))
    with pytest.raises(HTTPException) as e:
        await server.drivers_importar(file=_fichero(), center="", user=CLIENTE_DGA1, **eleccion)
    assert e.value.status_code == 403 and "OGA5" in e.value.detail
    assert importar["drivers"].docs == []
    # La misma elección en la cuenta dueña entra, como hoy.
    await server.drivers_importar(file=_fichero(), center="", user=OWNER_DGA1, **eleccion)
    assert [d["center"] for d in importar["drivers"].docs] == ["OGA5"]


@pytest.mark.asyncio(loop_scope="session")
async def test_los_destinos_de_las_furgonetas_tambien(importar):
    with pytest.raises(HTTPException) as e:
        server._destinos_que_ve(CLIENTE_DGA1, {"AMZL OGA5": "OGA5", "AMZL DGA1": "DGA1"})
    assert e.value.status_code == 403
    assert server._destinos_que_ve(CLIENTE_DGA1, {"AMZL DGA1": "DGA1"}) is None
    assert server._destinos_que_ve(OWNER_DGA1, {"AMZL OGA5": "OGA5"}) is None
    assert server._destinos_que_ve(CLIENTE_TODAS, {"AMZL OGA5": "OGA5"}) is None


# ══ CORRECCIONES de la primera revisión (11-11-2026) ════════════════════════════════════════════════════════════════

# Los mismos actores en una empresa cliente (account_type «dsp»): las reglas de gestionar usuarios no miran la cuenta.
def _en_cliente(actor):
    return {**actor, "account_type": "dsp"}


CUENTAS = [pytest.param(lambda a: a, id="cuenta-duena"), pytest.param(_en_cliente, id="empresa-cliente")]


async def _reset(actor, uid, clave="otra-1234"):
    return await server.reset_admin_password({"username": uid, "password": clave}, _admin=actor)


# ── P4 · POST /auth/reset-admin-password pide lo mismo que cambiar la contraseña por PATCH ──────────────────────────

@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("cuenta", CUENTAS)
async def test_p4_un_dispatcher_no_cambia_contrasenas_ajenas(base, cuenta):
    for uid in ("todo", "oga5", "sa", "jefe1"):
        await _no_puede(_reset(cuenta(DISPATCHER), uid))
        assert _doc(base, uid)["hashed_password"] == "h"


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("cuenta", CUENTAS)
async def test_p4_un_jefe_no_cambia_la_de_un_admin_completo_otro_jefe_ni_el_dueno(base, cuenta):
    for jefe in (JEFE_DGA1, JEFE_TODAS):
        for uid in ("todo", "dga1-completo", "jefe1", "jefe0", "sa"):
            await _no_puede(_reset(cuenta(jefe), uid))
            assert _doc(base, uid)["hashed_password"] == "h"


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("cuenta", CUENTAS)
async def test_p4_un_jefe_si_cambia_la_de_un_dispatcher_suyo(base, cuenta):
    assert await _reset(cuenta(JEFE_DGA1), "disp1") == {"success": True}
    assert _doc(base, "disp1")["hashed_password"] == "h:otra-1234"
    await _no_puede(_reset(cuenta(JEFE_DGA1), "oga5"))          # dispatcher de otra nave
    assert await _reset(cuenta(JEFE_TODAS), "oga5") == {"success": True}


@pytest.mark.asyncio(loop_scope="session")
async def test_p4_el_super_admin_si_y_nunca_sobre_un_super_admin(base):
    for uid in ("todo", "jefe1", "disp1"):
        assert await _reset(SA, uid) == {"success": True}
        assert _doc(base, uid)["hashed_password"] == "h:otra-1234"
    await _no_puede(_reset(SA, "sa"))
    assert _doc(base, "sa")["hashed_password"] == "h"


@pytest.mark.asyncio(loop_scope="session")
async def test_p4_sigue_igual_lo_de_antes(base):
    # Cuerpo incompleto: 400; usuario que no existe o de otra empresa: 404, como hoy.
    for cuerpo in ({"username": "disp1", "password": "123"}, {"password": "123456"}):
        with pytest.raises(HTTPException) as e:
            await server.reset_admin_password(cuerpo, _admin=SA)
        assert e.value.status_code == 400
    with pytest.raises(HTTPException) as e:
        await _reset(SA, "nadie")
    assert e.value.status_code == 404
    with pytest.raises(HTTPException) as e:
        await _reset({**SA, "org_id": "o2"}, "disp1")
    assert e.value.status_code == 404
    assert _doc(base, "disp1")["hashed_password"] == "h"


# ── P16 + P17 · un jefe de centro solo gestiona dispatchers (permisos, contraseña, borrar y foto) ────────────────────

def _foto():
    import io
    from starlette.datastructures import UploadFile
    return UploadFile(file=io.BytesIO(b"\xff\xd8foto"), filename="cara.jpg")


def _las_cuatro(actor, uid):
    """Las cuatro rutas de gestionar a otro usuario, como corutinas."""
    return [server.update_admin_permissions(uid, {"permissions": ["chat"]}, _admin=actor),
            server.update_admin_permissions(uid, {"new_password": "otra-123"}, _admin=actor),
            server.subir_foto_admin(uid, file=_foto(), _admin=actor),
            server.delete_admin(uid, _admin=actor)]                 # la última: si entra, ya no está


@pytest.fixture
def con_foto(base, monkeypatch):
    async def _guarda(content, nombre):
        return "/fotos/%s.jpg" % nombre, content
    monkeypatch.setattr(server, "process_and_save_image", _guarda)
    return base


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("cuenta", CUENTAS)
async def test_p16_un_jefe_no_gestiona_a_un_admin_completo_de_su_nave(con_foto, cuenta):
    for corutina in _las_cuatro(cuenta(JEFE_DGA1), "dga1-completo"):
        await _no_puede(corutina)
    d = _doc(con_foto, "dga1-completo")
    assert d["hashed_password"] == "h" and d["permissions"] is None and "photo_url" not in d


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("cuenta", CUENTAS)
async def test_p17_un_jefe_sin_naves_tampoco_con_admin_completo_ni_otro_jefe(con_foto, cuenta):
    for uid in ("todo", "dga1-completo", "jefe1"):
        for corutina in _las_cuatro(cuenta(JEFE_TODAS), uid):
            await _no_puede(corutina)
        assert _doc(con_foto, uid) is not None and _doc(con_foto, uid)["hashed_password"] == "h"


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("cuenta", CUENTAS)
async def test_p16_un_jefe_si_gestiona_a_sus_dispatchers(con_foto, cuenta):
    jefe = cuenta(JEFE_DGA1)
    assert await server.update_admin_permissions("disp1", {"permissions": ["chat"]}, _admin=jefe) == {"success": True}
    assert await server.update_admin_permissions("disp1", {"new_password": "otra-123"}, _admin=jefe) == {"success": True}
    r = await server.subir_foto_admin("disp1", file=_foto(), _admin=jefe)
    assert r["success"] and _doc(con_foto, "disp1")["photo_url"] == r["photo_url"]
    assert await server.delete_admin("disp1", _admin=jefe) == {"success": True}
    assert _doc(con_foto, "disp1") is None
    # Su propia foto la sigue poniendo él (es uno mismo, no gestionar a otro).
    assert (await server.subir_foto_admin("jefe1", file=_foto(), _admin=jefe))["success"]


@pytest.mark.asyncio(loop_scope="session")
async def test_p16_el_super_admin_y_el_dispatcher_como_hoy(con_foto):
    for corutina in _las_cuatro(SA, "todo"):
        assert (await corutina)["success"]
    for corutina in _las_cuatro(DISPATCHER, "oga5"):
        await _no_puede(corutina)


# ── P15 + P32 · quitar una nave: los cambios de centro programados a ella, y verla para poder quitarla ──────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_p15_no_se_quita_una_nave_con_un_cambio_de_centro_programado_a_ella(naves):
    # LUIS (DGA1, vivo) pasa a OGA9 un día de estos; el de baja con otro a OGA9 no cuenta. El día no importa: el bucle
    # de traslados lo aplica en cuanto llega, y si OGA9 ya no es de la empresa se queda en una nave fantasma.
    fichas = {d["id"]: d for d in server.db["drivers"].docs}
    fichas["d2"]["traslado"] = {"centro": "OGA9", "desde": "2030-01-01", "por": "Oficina"}
    fichas["d3"]["traslado"] = {"centro": "oga9", "desde": "2030-01-01"}
    with pytest.raises(HTTPException) as e:
        await server.quitar_org_center("OGA9", user=COMPLETO)
    assert e.value.status_code == 409
    d = e.value.detail
    assert (d["conductores"], d["furgonetas"], d["usuarios"], d["traslados"]) == (0, 0, 0, 1)
    assert "1 conductor con un cambio de centro programado a él" in d["mensaje"]
    assert "OGA9" in _naves_de(naves)
    # Escrito sucio en el traslado también cuenta; sin ninguno, se quita como antes.
    fichas["d2"]["traslado"] = {"centro": "amzl oga9 lugo", "desde": "2030-01-01"}
    with pytest.raises(HTTPException) as e:
        await server.quitar_org_center("OGA9", user=COMPLETO)
    assert e.value.detail["traslados"] == 1
    del fichas["d2"]["traslado"]
    assert "OGA9" not in (await server.quitar_org_center("OGA9", user=COMPLETO))["centers"]


COMPLETO_DGA1_CLIENTE = {**COMPLETO, "account_type": "dsp", "allowed_centers": ["DGA1"]}


@pytest.mark.asyncio(loop_scope="session")
async def test_p32_para_quitar_una_nave_hay_que_verla(naves):
    detalle = await _no_puede(server.quitar_org_center("OGA9", user=COMPLETO_DGA1_CLIENTE))
    assert detalle == "No tienes acceso a ese centro"
    assert "OGA9" in _naves_de(naves)
    # La que sí ve sigue el camino de siempre (aquí, 409 porque tiene a LUIS).
    with pytest.raises(HTTPException) as e:
        await server.quitar_org_center("DGA1", user=COMPLETO_DGA1_CLIENTE)
    assert e.value.status_code == 409
    # En la cuenta dueña las naves asignadas no recortan el servidor: igual que antes.
    r = await server.quitar_org_center("OGA9", user={**COMPLETO_DGA1_CLIENTE, "account_type": "owner"})
    assert "OGA9" not in r["centers"]


# ── P33 · las importaciones: ninguna fila acaba en una nave que quien importa no ve ─────────────────────────────────

def _csv(texto, nombre="plantilla.csv"):
    import io
    from starlette.datastructures import UploadFile
    return UploadFile(file=io.BytesIO(texto.encode()), filename=nombre)


async def _importar_conductores(user, texto=None, center="", centros=None, mapa=None):
    return await server.drivers_importar(file=_csv(texto or CSV.decode()), center=center, centros=centros, mapa=mapa,
                                         user=user)


@pytest.mark.asyncio(loop_scope="session")
async def test_p33_conductores_por_su_propia_columna_sin_vista_previa(importar):
    # Sin vista previa (la web vieja, o una pestaña de antes): el centro sale de la columna de cada fila.
    detalle = await _no_puede(_importar_conductores(CLIENTE_DGA1))
    assert "OGA5" in detalle and "DGA1" not in detalle
    assert importar["drivers"].docs == []                          # ni la fila de DGA1: antes de escribir nada


@pytest.mark.asyncio(loop_scope="session")
async def test_p33_conductores_con_el_centro_del_formulario(importar):
    sin_columna = "Nombre,Email\nAna Ruiz,ana@x.es\n"
    detalle = await _no_puede(_importar_conductores(CLIENTE_DGA1, sin_columna, center="OGA5"))
    assert "OGA5" in detalle and importar["drivers"].docs == []
    r = await _importar_conductores(CLIENTE_DGA1, sin_columna, center="DGA1")
    assert r["importados"] == 1 and importar["drivers"].docs[0]["center"] == "DGA1"


@pytest.mark.asyncio(loop_scope="session")
async def test_p33_conductores_eligiendo_solo_su_nave_entran(importar):
    import json
    r = await _importar_conductores(CLIENTE_DGA1, centros=json.dumps(["AMZL DGA1 CORUNA"]), mapa=json.dumps({}))
    assert r["importados"] == 1 and r["fuera_seleccion"] == 1
    assert [d["center"] for d in importar["drivers"].docs] == ["DGA1"]


@pytest.mark.asyncio(loop_scope="session")
async def test_p33_conductores_ya_dados_de_alta_no_cuentan(importar):
    # La de OGA5 ya está: no se escribe nada en OGA5, así que no hay nada que rechazar.
    importar["drivers"].docs.append({"id": "x", "name": "ANA RUIZ", "email": "ana@x.es", "center": "OGA5",
                                     "active": True})
    r = await _importar_conductores(CLIENTE_DGA1)
    assert r["importados"] == 1 and r["ya_estaban"] == 1


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("actor", [CLIENTE_TODAS, OWNER_DGA1, SA], ids=["sin-naves", "cuenta-duena", "super-admin"])
async def test_p33_conductores_igual_que_antes_sin_naves_en_la_cuenta_duena_y_el_super_admin(importar, actor):
    r = await _importar_conductores(actor)
    assert r["importados"] == 2
    assert sorted(d["center"] for d in importar["drivers"].docs) == ["DGA1", "OGA5"]


FLOTA = "Matrícula,Centro\n1111AAA,AMZL OGA5 SANTIAGO XPT\n2222BBB,AMZL DGA1 CORUNA\n"


async def _importar_furgonetas(user, texto=FLOTA, center_filter=None, crear=True, centros=None, mapa=None):
    return await server.import_vehicles(file=_csv(texto), center_filter=center_filter, crear=crear, centros=centros,
                                        mapa=mapa, columnas=None, user=user)


@pytest.mark.asyncio(loop_scope="session")
async def test_p33_furgonetas_por_su_propia_columna_y_por_el_filtro(importar):
    detalle = await _no_puede(_importar_furgonetas(CLIENTE_DGA1))
    assert "OGA5" in detalle and importar["vehicles"].docs == []
    await _no_puede(_importar_furgonetas(CLIENTE_DGA1, center_filter="OGA5"))
    assert importar["vehicles"].docs == []
    r = await _importar_furgonetas(CLIENTE_DGA1, center_filter="DGA1")
    assert r["imported"] == 1 and [v["center"] for v in importar["vehicles"].docs] == ["DGA1"]


@pytest.mark.asyncio(loop_scope="session")
async def test_p33_furgonetas_mover_una_que_ya_esta_a_otra_nave_tampoco(importar):
    importar["vehicles"].docs.append({"id": "v1", "license_plate": "1111AAA", "center": "DGA1", "status": "active"})
    await _no_puede(_importar_furgonetas(CLIENTE_DGA1, texto="Matrícula,Centro\n1111AAA,OGA5\n", crear=False))
    assert importar["vehicles"].docs[0]["center"] == "DGA1"
    # Sin dar de alta, una de OGA5 que no está no se escribe: no hay nada que rechazar.
    r = await _importar_furgonetas(CLIENTE_DGA1, texto="Matrícula,Centro\n9999ZZZ,OGA5\n", crear=False)
    assert r["no_estaban"] == 1


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("actor", [CLIENTE_TODAS, OWNER_DGA1, SA], ids=["sin-naves", "cuenta-duena", "super-admin"])
async def test_p33_furgonetas_igual_que_antes_sin_naves_en_la_cuenta_duena_y_el_super_admin(importar, actor):
    r = await _importar_furgonetas(actor)
    assert r["imported"] == 2
    assert sorted(v["center"] for v in importar["vehicles"].docs) == ["DGA1", "OGA5"]
