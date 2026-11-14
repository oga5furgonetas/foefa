# -*- coding: utf-8 -*-
"""Segunda pasada de verdad (14-11-2026), lo del repaso en el servidor:

· GET /api/repaso/pendientes: el número del menú «Repaso» sin pedir el día entero. Tiene que dar EXACTAMENTE
  `sin_repasar + a_medias` de /repaso/dia de hoy, con las mismas reglas de centro, y solo para administradores.
· `ya_apuntado[]` de /repaso/dia trae `foto_url` y `box_2d` (la foto y la caja con las que se marcó el golpe), o null.
· La migración de UNA vez que pone «repaso» a las empresas con lista de módulos propia.

Con la base de mentira (base_de_mentira.py), sin MongoDB. Matrículas y nombres inventados.
"""
import inspect
import re
from pathlib import Path

import pytest

import server
from base_de_mentira import Col, Db
from test_perito_repaso import MARTA, PUERTA, falla, marca, marcar, mundo_base, revision

DIA = "2026-11-12"


@pytest.fixture
def t(monkeypatch):
    base = mundo_base()
    monkeypatch.setattr(server, "db", base)
    monkeypatch.setattr(server, "_dia_negocio", lambda: DIA)
    return base


async def _las_dos(center=None, user=MARTA):
    dia = await server.repaso_del_dia(fecha=None, center=center, user=user)
    pen = await server.repaso_pendientes(center=center, user=user)
    return dia, pen


async def _coinciden(center=None, user=MARTA):
    dia, pen = await _las_dos(center, user)
    c = dia["cuentas"]
    # `avisar` (R7, tercera tanda) va aparte: lo prueba test_tanda3_servidor_flota.py.
    assert isinstance(pen.pop("avisar"), bool)
    assert pen == {"fecha": DIA, "pendientes": c["sin_repasar"] + c["a_medias"]}, (pen, c)
    return pen["pendientes"]


# ── /repaso/pendientes ────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_pendientes_coincide_con_el_dia_en_cada_estado(t):
    assert await _coinciden() == 0                                   # sin revisiones hoy
    t["inspections"].docs += [
        revision("ayer", "veh-5678", "drv-ana", marca(11)),          # de ayer: no cuenta (no es deuda)
        revision("a", "veh-5678", "drv-ana", marca(12)),
        revision("b", "veh-9012", "drv-luis", marca(12, "08:00:00")),
        revision("c", "veh-1234", "drv-rosa", marca(12, "09:00:00")),
        # Sin roles ni vistas: sin lados, no está pendiente.
        {"id": "sin-lados", "vehicle_id": "veh-1234", "driver_id": "drv-rosa", "created_at": marca(12, "10:00:00"),
         "photos": ["/fotos/x.jpg"], "analysis_status": "ok", "analysis": None},
        # Borrada: no cuenta.
        revision("borrada", "veh-9012", "drv-luis", marca(12, "11:00:00"), deleted=True),
    ]
    assert await _coinciden() == 3
    await marcar("a", 1, "igual")                                    # a medias: sigue pendiente
    assert await _coinciden() == 3
    for pi in (2, 3, 4):
        await marcar("a", pi, "igual")                               # repasada
    assert await _coinciden() == 2
    await marcar("b", 1, "no_se_ve")
    await marcar("b", 2, "golpe", **PUERTA)
    assert await _coinciden() == 2
    for pi in (1, 2, 3, 4):
        await marcar("c", pi, "igual")
    for pi in (3, 4):
        await marcar("b", pi, "igual")
    assert await _coinciden() == 0
    dia, _ = await _las_dos()
    assert dia["cuentas"]["repasadas"] == 3 and dia["cuentas"]["sin_lados"] == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_pendientes_respeta_el_centro_y_los_centros_permitidos(t):
    t["inspections"].docs += [revision("oga", "veh-5678", "drv-ana", marca(12)),
                              revision("dga", "veh-1234", "drv-rosa", marca(12, "08:00:00")),
                              # Furgoneta de DGA1 que llevó alguien de OGA5: la ven los dos centros.
                              revision("cruzada", "veh-1234", "drv-ana", marca(12, "09:00:00"))]
    assert await _coinciden() == 3
    assert await _coinciden(center="OGA5") == 2
    assert await _coinciden(center="DGA1") == 2
    assert await _coinciden(center="Todos") == 3
    solo_dga = {**MARTA, "allowed_centers": ["DGA1"]}
    assert await _coinciden(user=solo_dga) == 2
    with falla(403, "No tienes acceso a ese centro"):
        await server.repaso_pendientes(center="OGA5", user=solo_dga)
    with falla(400, "Código de centro inválido"):
        await server.repaso_pendientes(center="OGA5;drop", user=MARTA)


@pytest.mark.asyncio(loop_scope="session")
async def test_pendientes_solo_para_administradores():
    rutas = [r for r in server.api_router.routes if getattr(r, "path", "") == "/api/repaso/pendientes"]
    assert len(rutas) == 1 and rutas[0].methods == {"GET"}
    deps = [d.call for d in rutas[0].dependant.dependencies]
    assert server.require_admin in deps
    for quien in ({"sub": "drv-ana", "role": "driver"}, {"sub": "x", "role": "dispatcher"}):
        with falla(403, "Acceso restringido a administradores"):
            await server.require_admin(quien)


def test_pendientes_no_busca_las_anteriores_ni_el_libro():
    """Es barata: ni la foto anterior de cada lado, ni el libro, ni las fichas."""
    fuente = inspect.getsource(server.repaso_pendientes)
    for caro in ("_repaso_anteriores", "vehicle_damage_ledger", "_repaso_fichas", "daily_assignments"):
        assert caro not in fuente, caro


# ── ya_apuntado: la foto y la caja con las que se marcó ───────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_ya_apuntado_trae_la_foto_y_la_caja_del_golpe(t):
    t["inspections"].docs += [revision("r11", "veh-5678", "drv-ana", marca(11)),
                              revision("r12", "veh-5678", "drv-ana", marca(12))]
    # Uno de «Revisión rápida» en otra pieza: sin foto ni caja guardadas en el libro.
    t["vehicle_damage_ledger"].docs.append(
        {"vehicle_id": "veh-5678", "panel": "retrovisor", "status": "open", "source": "human",
         "part": "Retrovisor derecho", "severity": "leve", "first_seen": "2026-11-03",
         "first_seen_inspection": "r11"})
    await marcar("r12", 3, "golpe", **PUERTA)
    dia = await server.repaso_del_dia(fecha=DIA, center=None, user=MARTA)
    por_origen = {a["origen"]: a for a in dia["revisiones"][0]["ya_apuntado"]}
    assert por_origen["repaso"]["foto_url"] == "/fotos/r12-lateral_izq.jpg"
    assert por_origen["repaso"]["box_2d"] == PUERTA["box_2d"]
    assert por_origen["revision_rapida"]["foto_url"] is None and por_origen["revision_rapida"]["box_2d"] is None
    # Los campos de antes, igual.
    assert por_origen["repaso"]["de_esta_revision"] is True and por_origen["repaso"]["vista"] == "lateral_izq"


@pytest.mark.asyncio(loop_scope="session")
async def test_ya_apuntado_sin_su_revision_no_inventa_foto(t):
    t["inspections"].docs += [revision("r11", "veh-5678", "drv-ana", marca(11)),
                              revision("r12", "veh-5678", "drv-ana", marca(12))]
    await marcar("r11", 3, "golpe", **PUERTA)
    next(d for d in t["inspections"].docs if d["id"] == "r11")["deleted"] = True      # su revisión se borró
    dia = await server.repaso_del_dia(fecha=DIA, center=None, user=MARTA)
    (ap,) = dia["revisiones"][0]["ya_apuntado"]
    assert ap["foto_url"] is None and ap["box_2d"] is None


# ── La migración de «repaso» para las listas propias ──────────────────────────

@pytest.fixture
def g(monkeypatch):
    base = Db()
    base["organizations"] = Col([
        # Lista propia con inspecciones y sin repaso: lo gana justo después de «vehiculos».
        {"id": "o-propia", "account_type": "dsp",
         "modulos": ["dashboard", "vehiculos", "inspecciones", "chat", "configuracion"]},
        # Sin «vehiculos»: al final.
        {"id": "o-sin-veh", "account_type": "dsp", "modulos": ["dashboard", "inspecciones", "configuracion"]},
        # Sin «inspecciones»: no cambia.
        {"id": "o-sin-insp", "account_type": "dsp", "modulos": ["dashboard", "vehiculos", "configuracion"]},
        # Ya lo tiene: no cambia.
        {"id": "o-ya", "account_type": "dsp", "modulos": ["dashboard", "vehiculos", "repaso", "inspecciones"]},
        # Sin lista propia (el estándar), «todos» o sin campo: no cambian.
        {"id": "o-estandar", "account_type": "dsp", "modulos": "estandar"},
        {"id": "o-todos", "account_type": "dsp", "modulos": "todos"},
        {"id": "o-nada", "account_type": "dsp"},
    ])
    base["app_meta"] = Col([])
    monkeypatch.setattr(server, "global_db", base)
    return base


def _mods(g, oid):
    return next(o for o in g["organizations"].docs if o["id"] == oid).get("modulos", "(sin campo)")


@pytest.mark.asyncio(loop_scope="session")
async def test_la_migracion_pone_repaso_una_sola_vez(g):
    antes = {o["id"]: o.get("modulos", "(sin campo)") for o in g["organizations"].docs}
    r = await server._migrar_repaso_a_listas_propias()
    assert r == {"hecha_antes": False, "empresas": 2}
    assert _mods(g, "o-propia") == ["dashboard", "vehiculos", "repaso", "inspecciones", "chat", "configuracion"]
    assert _mods(g, "o-sin-veh") == ["dashboard", "inspecciones", "configuracion", "repaso"]
    for oid in ("o-sin-insp", "o-ya", "o-estandar", "o-todos", "o-nada"):
        assert _mods(g, oid) == antes[oid], oid
    # Con la lista nueva, la empresa ve «Repaso» (y nada más de lo que no tenía).
    vistos = server.org_modulos({"account_type": "dsp", "plan": "operacion", "modulos": _mods(g, "o-propia")})
    assert "repaso" in vistos and "origen-danos" not in vistos
    (marca_meta,) = g["app_meta"].docs
    assert marca_meta["_id"] == "migracion_modulo_repaso" and sorted(marca_meta["empresas"]) == ["o-propia", "o-sin-veh"]

    # El super-admin se lo quita: el siguiente arranque NO lo vuelve a poner.
    g["organizations"].docs[0]["modulos"] = ["dashboard", "vehiculos", "inspecciones", "chat", "configuracion"]
    r = await server._migrar_repaso_a_listas_propias()
    assert r == {"hecha_antes": True, "empresas": 0}
    assert "repaso" not in _mods(g, "o-propia")


@pytest.mark.asyncio(loop_scope="session")
async def test_el_arranque_lanza_la_migracion_y_no_rompe_si_falla(g, monkeypatch):
    fuente = Path(server.__file__).read_text(encoding="utf-8-sig")
    assert re.search(r'@app\.on_event\("startup"\)\r?\nasync def migrar_modulo_repaso\(\)', fuente)
    await server.migrar_modulo_repaso()
    assert "repaso" in _mods(g, "o-propia")

    async def rompe():
        raise RuntimeError("sin base")
    monkeypatch.setattr(server, "_migrar_repaso_a_listas_propias", rompe)
    await server.migrar_modulo_repaso()                              # se apunta en el registro y sigue


def test_modulos_con_repaso_no_toca_lo_que_no_es_una_lista():
    assert server._modulos_con_repaso(None) is None
    assert server._modulos_con_repaso("todos") is None
    assert server._modulos_con_repaso([]) is None
    assert server._modulos_con_repaso(["inspecciones"]) == ["inspecciones", "repaso"]
