# -*- coding: utf-8 -*-
"""«Antes del perito», arreglos tras la revisión (14-11-2026): permisos, módulos y la IA apagada de verdad.

· Las rutas del repaso y del expediente comprueban en el servidor lo mismo que sus pantallas: que la empresa tenga
  el módulo (`repaso`; el expediente, `vehiculos`) y que el usuario pueda ver esa pantalla (su casilla en
  Usuarios). Antes solo pedían ser administrador: un usuario sin la casilla «Repaso», o un autónomo, marcaba golpes
  en el libro llamando a la API.
· A quien ya tiene su lista de pantallas con «Inspecciones» se le añade «Repaso» una sola vez.
· «Identificar el modelo» (el botón del visor 3D) manda fotos de la empresa a Gemini: sin la IA, 403.
"""
import pytest

import server
from base_de_mentira import Col, Db
from test_perito_repaso import MARTA, falla, marca, marcar, revision, t  # noqa: F401

V = "veh-5678"


def empresa(monkeypatch, org):
    async def get_org(_org_id):
        return org
    monkeypatch.setattr(server, "get_org", get_org)


async def las_cuatro(user):
    """Las rutas del repaso, en orden: el día, el número del menú, marcar y deshacer."""
    await server.repaso_del_dia(fecha="2026-11-12", center=None, user=user)
    await server.repaso_pendientes(center=None, user=user)
    await server.repaso_marcar_lado("r12", {"photo_index": 1, "veredicto": "igual"}, user=user)
    await server.repaso_deshacer_lado("r12", "1", user=user)


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_la_casilla_de_repaso_no_se_entra_por_la_api(t):
    t["inspections"].docs.append(revision("r12", V, "drv-ana", marca(12)))
    sin = {**MARTA, "permissions": ["vehiculos", "inspecciones"]}
    for ruta in (lambda: server.repaso_del_dia(fecha="2026-11-12", center=None, user=sin),
                 lambda: server.repaso_pendientes(center=None, user=sin),
                 lambda: marcar("r12", 1, "igual", user=sin),
                 lambda: server.repaso_deshacer_lado("r12", "1", user=sin)):
        with falla(403, "No tienes permiso para esa pantalla"):
            await ruta()
    assert "repaso" not in next(d for d in t["inspections"].docs if d["id"] == "r12")
    # Con la casilla, sí; y sin lista de permisos (los usuarios de siempre), también.
    await las_cuatro({**MARTA, "permissions": ["repaso"]})
    await las_cuatro(MARTA)
    # El expediente va con la pantalla de Vehículos.
    with falla(403, "No tienes permiso para esa pantalla"):
        await server.expediente_antes_del_perito(V, user={**MARTA, "permissions": ["repaso"]})
    await server.expediente_antes_del_perito(V, user={**MARTA, "permissions": ["vehiculos"]})


@pytest.mark.asyncio(loop_scope="session")
async def test_una_cuenta_sin_el_modulo_no_entra(t, monkeypatch):
    t["inspections"].docs.append(revision("r12", V, "drv-ana", marca(12)))
    de_la_empresa = {**MARTA, "org_id": "o1"}
    # Un autónomo (sin flota): ni repaso ni vehículos.
    empresa(monkeypatch, {"id": "o1", "account_type": "dsp", "plan": "operacion",
                          "modulos": list(server.SECTORES_REGISTRO["autonomo"])})
    with falla(403, "Tu cuenta no tiene esa pantalla"):
        await server.repaso_del_dia(fecha="2026-11-12", center=None, user=de_la_empresa)
    with falla(403, "Tu cuenta no tiene esa pantalla"):
        await marcar("r12", 1, "igual", user=de_la_empresa)
    with falla(403, "Tu cuenta no tiene esa pantalla"):
        await server.expediente_antes_del_perito(V, user=de_la_empresa)
    # Una empresa con Esencial y los módulos de siempre: sí (el repaso va en todos los planes).
    empresa(monkeypatch, {"id": "o1", "account_type": "dsp", "plan": "operacion"})
    await las_cuatro(de_la_empresa)
    await server.expediente_antes_del_perito(V, user=de_la_empresa)


@pytest.mark.asyncio(loop_scope="session")
async def test_identificar_el_modelo_sin_ia_no_manda_fotos(t, monkeypatch):
    empresa(monkeypatch, {"id": "o-nueva", "account_type": "dsp", "ia_danos": False})
    monkeypatch.delenv("IA_DANOS_DE_PAGO", raising=False)

    def no_llamar(*a, **k):
        raise AssertionError("ha llamado a Gemini")
    monkeypatch.setattr(server, "_gemini_client_plantilla", no_llamar)
    t["inspections"].docs.append(revision("r12", V, "drv-ana", marca(12)))
    with falla(403, "Esta cuenta no tiene el análisis automático de fotos."):
        await server.identify_vehicle_model(V, _admin={**MARTA, "org_id": "o-nueva"})


@pytest.fixture
def g(monkeypatch):
    base = Db()
    base["admin_users"] = Col([
        {"id": "u-ve-inspecciones", "permissions": ["vehiculos", "inspecciones", "chat"]},
        {"id": "u-ya-lo-tiene", "permissions": ["inspecciones", "repaso"]},
        {"id": "u-sin-inspecciones", "permissions": ["vehiculos", "chat"]},
        {"id": "u-de-siempre"},                                     # sin lista: lo ve todo, no se toca
        {"id": "u-lista-vacia", "permissions": []},
    ])
    base["app_meta"] = Col([])
    base["organizations"] = Col([])
    monkeypatch.setattr(server, "global_db", base)
    return base


def _permisos(g, uid):
    return next(u for u in g["admin_users"].docs if u["id"] == uid).get("permissions", "(sin lista)")


@pytest.mark.asyncio(loop_scope="session")
async def test_quien_ve_inspecciones_recibe_repaso_una_sola_vez(g):
    r = await server._migrar_repaso_a_permisos()
    assert r == {"hecha_antes": False, "usuarios": 1}
    assert _permisos(g, "u-ve-inspecciones") == ["vehiculos", "inspecciones", "chat", "repaso"]
    assert _permisos(g, "u-ya-lo-tiene") == ["inspecciones", "repaso"]
    assert _permisos(g, "u-sin-inspecciones") == ["vehiculos", "chat"]
    assert _permisos(g, "u-de-siempre") == "(sin lista)" and _permisos(g, "u-lista-vacia") == []
    assert server._puede({"permissions": _permisos(g, "u-ve-inspecciones")}, "repaso")
    (marca_meta,) = g["app_meta"].docs
    assert marca_meta["_id"] == "migracion_permiso_repaso" and marca_meta["usuarios"] == 1
    # Si después se lo quitan, el siguiente arranque no lo vuelve a poner.
    g["admin_users"].docs[0]["permissions"] = ["vehiculos", "inspecciones", "chat"]
    assert (await server._migrar_repaso_a_permisos()) == {"hecha_antes": True, "usuarios": 0}
    assert "repaso" not in _permisos(g, "u-ve-inspecciones")


@pytest.mark.asyncio(loop_scope="session")
async def test_el_arranque_hace_las_dos_migraciones_y_una_que_falla_no_para_la_otra(g, monkeypatch):
    async def rompe():
        raise RuntimeError("sin base")
    monkeypatch.setattr(server, "_migrar_repaso_a_listas_propias", rompe)
    await server.migrar_modulo_repaso()
    assert "repaso" in _permisos(g, "u-ve-inspecciones")
