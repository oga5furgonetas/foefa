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
async def test_jefe_guarda_a_un_admin_completo_suyo_sin_cambiarle_el_rol(base):
    # La pantalla manda el rol que ya tiene (null): no puede quedarse sin guardar.
    r = await server.update_admin_permissions(
        "dga1-completo", {"permissions": ["chat"], "allowed_centers": ["DGA1"], "admin_role": None}, _admin=JEFE_DGA1)
    assert r == {"success": True}
    d = _doc(base, "dga1-completo")
    assert d["permissions"] == ["chat"] and d["admin_role"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_jefe_sin_restriccion_gestiona_a_cualquier_no_jefe(base):
    for uid in ("todo", "oga5", "disp1"):
        r = await server.update_admin_permissions(uid, {"permissions": ["chat"]}, _admin=JEFE_TODAS)
        assert r == {"success": True}
    r = await server.update_admin_permissions("oga5", {"allowed_centers": None}, _admin=JEFE_TODAS)
    assert r == {"success": True} and _doc(base, "oga5")["allowed_centers"] is None
    assert (await server.delete_admin("vacio", _admin=JEFE_TODAS)) == {"success": True}
    await _no_puede(server.update_admin_permissions("jefe1", {"permissions": []}, _admin=JEFE_TODAS))


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
async def test_jefe_limitado_no_ve_a_los_usuarios_de_todas_las_naves(base):
    ids = {a["id"] for a in await server.list_admins(_admin=JEFE_DGA1)}
    assert ids == {"jefe1", "disp1", "dga1-completo"}


@pytest.mark.asyncio(loop_scope="session")
async def test_jefe_sin_restriccion_ve_a_todos(base):
    ids = {a["id"] for a in await server.list_admins(_admin=JEFE_TODAS)}
    assert ids == {d["id"] for d in base["admin_users"].docs}


@pytest.mark.asyncio(loop_scope="session")
async def test_super_admin_ve_a_todos_como_hoy(base):
    lista = await server.list_admins(_admin=SA)
    assert len(lista) == len(base["admin_users"].docs)
    assert all("hashed_password" not in a for a in lista)


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
                              "conductores": 1, "furgonetas": 1, "usuarios": 0}
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
