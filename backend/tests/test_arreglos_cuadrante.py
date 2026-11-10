# -*- coding: utf-8 -*-
"""Arreglos del cuadrante (10-11-2026, revisión de la flota propia):
  · cuadrante-7: contestar una petición de varios días manda UN aviso al conductor, con las fechas como se leen, y
    el aviso a la oficina dice de qué nave es;
  · cuadrante-6: «Bajan de otros centros» cuenta en Refuerzos y en «Trabajar más», como en el Cuadrante, sin
    contar dos veces a quien ya tiene aquí su turno y sin mezclar naves;
  · cuadrante-11: «Días cerrados» enseña por defecto solo los vigentes o futuros, los próximos primero.
Contra la base de mentira, con los flujos del servidor enteros."""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Db

HOY = "2026-10-18"          # domingo
MAN = "2026-10-19"          # lunes
OFI = {"sub": "a1", "role": "admin", "name": "Oficina", "org_id": "owner"}
SOLO_VER = {"sub": "a3", "role": "admin", "name": "Mira", "org_id": "owner", "permissions": ["turnos"]}
ANA = {"sub": "d1", "role": "driver", "name": "ANA"}


@pytest.fixture
def base(monkeypatch):
    t = Db()
    t["drivers"] = Col([
        {"id": "d1", "name": "Ana", "center": "OGA5", "active": True},
        {"id": "d2", "name": "Luis", "center": "OGA5", "active": True},
        {"id": "d3", "name": "Pepe", "center": "OGA5", "active": True},
        {"id": "d9", "name": "Diego", "center": "DGA1", "active": True},
    ])
    turno = lambda did, tipo, cod, centro="OGA5", fecha=MAN: {  # noqa: E731
        "driver_id": did, "date": fecha, "type": tipo, "cod": cod, "center": centro}
    t["shifts"] = Col([turno("d1", "libre", "N/T"), turno("d2", "libre", "L"), turno("d3", "trabaja", "1")])
    t["shift_requests"] = Col([])
    t["refuerzos"] = Col([])
    t["shift_blocks"] = Col([])
    conductores, oficina = [], []

    async def push(ids, titulo, cuerpo, url="/panel"):
        conductores.append(SimpleNamespace(ids=sorted(ids), titulo=titulo, cuerpo=cuerpo, url=url))

    async def push_oficina(center, titulo, cuerpo, url, exclude_id=None):
        oficina.append(SimpleNamespace(center=center, titulo=titulo, cuerpo=cuerpo, url=url))

    async def sin_fcm(docs):
        return 0

    async def sin_bloqueos(*a, **k):
        return []

    monkeypatch.setattr(server, "db", t)
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)
    monkeypatch.setattr(server, "send_web_push_to_users", push)
    monkeypatch.setattr(server, "push_center_event", push_oficina)
    monkeypatch.setattr(server, "_fcm_enviar", sin_fcm)
    monkeypatch.setattr(server, "_bloqueos_que_afectan", sin_bloqueos)
    return SimpleNamespace(t=t, conductores=conductores, oficina=oficina)


def _peticion(t, rid, fecha, estado="pendiente", grupo="g1", tipo="libre", did="d1"):
    t["shift_requests"].docs.append({
        "id": rid, "grupo": grupo, "center": "OGA5", "driver_id": did, "driver_name": "Ana",
        "date": fecha, "type": tipo, "status": estado, "motivo": "asuntos", "motivo_label": "Asuntos propios",
        "note": "boda de mi prima"})


def _turno(t, did, fecha):
    return next((d for d in t["shifts"].docs if d["driver_id"] == did and d["date"] == fecha), None)


# ── cuadrante-7: un aviso por petición, con las fechas legibles ──────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_aprobar_un_grupo_manda_un_solo_aviso_con_las_fechas_legibles(base):
    for i, f in enumerate(("2026-11-16", "2026-11-17", "2026-11-18")):
        _peticion(base.t, f"r{i}", f)
    r = await server.resolver_grupo_peticiones({"ids": ["r0", "r1", "r2"], "action": "aprobar"}, OFI)
    assert r["resueltas"] == ["r0", "r1", "r2"] and r["canceladas"] == [] and r["saltadas"] == []
    # UNO, no tres; y con 16/11, no con 2026-11-16.
    assert len(base.conductores) == 1
    aviso = base.conductores[0]
    assert aviso.ids == ["d1"] and aviso.titulo == "Tus días 16/11, 17/11 y 18/11: aprobados"
    assert aviso.url == "/conductor"
    # Cada día, igual que contestándolo suelto: al cuadrante con candado y aprobado.
    for f in ("2026-11-16", "2026-11-17", "2026-11-18"):
        assert _turno(base.t, "d1", f)["cod"] == "N/T APROB"
    assert {q["status"] for q in base.t.shift_requests.docs} == {"aprobado"}


@pytest.mark.asyncio(loop_scope="session")
async def test_un_dia_cancelado_a_mitad_no_para_el_resto(base):
    _peticion(base.t, "r0", "2026-11-16")
    _peticion(base.t, "r1", "2026-11-17", estado="cancelado")
    _peticion(base.t, "r2", "2026-11-18")
    r = await server.resolver_grupo_peticiones(
        {"ids": ["r0", "r1", "r2"], "action": "rechazar", "motivo": "No hay gente esa semana"}, OFI)
    assert r["resueltas"] == ["r0", "r2"] and r["canceladas"] == ["r1"]
    assert [q["status"] for q in base.t.shift_requests.docs] == ["rechazado", "cancelado", "rechazado"]
    [aviso] = base.conductores
    assert aviso.titulo == "Tus días 16/11 y 18/11: rechazados" and aviso.cuerpo == "No hay gente esa semana"


@pytest.mark.asyncio(loop_scope="session")
async def test_resolver_un_grupo_pide_lo_mismo_que_un_dia(base):
    _peticion(base.t, "r0", "2026-11-16")
    for quien, cuerpo, codigo in (
        (OFI, {"ids": ["r0"], "action": "borrar"}, 400),
        (OFI, {"ids": [], "action": "aprobar"}, 400),
        (OFI, {"ids": ["r0"], "action": "rechazar"}, 400),          # rechazar sin motivo
        (SOLO_VER, {"ids": ["r0"], "action": "aprobar"}, 403),      # ver no es decidir
    ):
        with pytest.raises(HTTPException) as e:
            await server.resolver_grupo_peticiones(cuerpo, quien)
        assert e.value.status_code == codigo, cuerpo
    assert base.t.shift_requests.docs[0]["status"] == "pendiente" and base.conductores == []


@pytest.mark.asyncio(loop_scope="session")
async def test_un_dia_suelto_tambien_lleva_la_fecha_legible(base):
    _peticion(base.t, "r0", "2026-11-16")
    r = await server.resolve_shift_request("r0", {"action": "aprobar"}, OFI)
    assert r == {"success": True, "status": "aprobado"}
    [aviso] = base.conductores
    assert aviso.titulo == "Tu petición del 16/11: aprobada"


@pytest.mark.asyncio(loop_scope="session")
async def test_el_aviso_a_la_oficina_dice_la_nave_y_las_fechas_legibles(base):
    await server.create_shift_request({"dates": ["2026-11-18", "2026-11-16", "2026-11-17"], "type": "libre",
                                       "motivo": "asuntos", "note": "boda de mi prima"}, ANA)
    [aviso] = base.oficina
    assert aviso.center == "OGA5"
    assert aviso.titulo == "📅 Ana pide 3 días · OGA5"
    assert aviso.cuerpo == "Asuntos propios · 16/11, 17/11 y 18/11"


def test_fechas_dias_dice_lo_que_dice_su_comentario():
    assert server._fechas_dias(["2026-10-18", "2026-10-16", "2026-10-17"]) == "16/10, 17/10 y 18/10"


# ── cuadrante-6: los que bajan de otros centros cuentan ─────────────────────────────────────────────────────────

def _maximas(t, **por_dia):
    t["route_demand"] = Col([{"center": "OGA5", "date": f, "maximo": m} for f, m in por_dia.items()])


def _bajan(t, n, centro="OGA5", fecha=MAN):
    t["cuadrante_ajustes"].docs.append({"center": centro, "tipo": "refuerzo_dia", "fecha": fecha, "refuerzo": n})


@pytest.mark.asyncio(loop_scope="session")
async def test_los_que_bajan_de_otros_centros_restan_de_lo_que_falta(base):
    _maximas(base.t, **{MAN: 5})
    base.t["cuadrante_ajustes"] = Col([])
    _bajan(base.t, 3)
    _bajan(base.t, 9, centro="DGA1")                               # lo de otra nave no cuenta aquí
    m = (await server._maximas_y_ruta("OGA5", MAN, MAN))[MAN]
    # Máxima 5, en ruta Pepe, bajan 3: falta 1 (antes decía 4).
    assert (m["maximo"], m["en_ruta"], m["bajan"], m["falta"]) == (5, 1, 3, 1)
    f = (await server.refuerzos_faltas("OGA5", 14, OFI))["faltas"]
    assert [(x["date"], x["en_ruta"], x["bajan"], x["falta"]) for x in f] == [(MAN, 1, 3, 1)]


@pytest.mark.asyncio(loop_scope="session")
async def test_quien_ya_baja_con_su_turno_no_se_cuenta_dos_veces(base):
    _maximas(base.t, **{MAN: 5})
    base.t["cuadrante_ajustes"] = Col([])
    _bajan(base.t, 3)
    # Diego es de DGA1 y ya tiene puesto su turno en OGA5 ese día: es uno de los 3 que bajan.
    base.t.shifts.docs.append({"driver_id": "d9", "date": MAN, "type": "trabaja", "cod": "1", "center": "OGA5"})
    m = (await server._maximas_y_ruta("OGA5", MAN, MAN))[MAN]
    assert (m["en_ruta"], m["bajan"], m["falta"]) == (2, 2, 1)


@pytest.mark.asyncio(loop_scope="session")
async def test_la_nave_escrita_de_otra_manera_casa_y_manda_la_exacta(base):
    _maximas(base.t, **{MAN: 5})
    base.t["cuadrante_ajustes"] = Col([])
    _bajan(base.t, 1, centro="OGA5 Getafe")
    # Pedido con la nave de la ficha («OGA5 Getafe») o con la del Cuadrante («OGA5»): el ajuste se encuentra.
    assert (await server._maximas_y_ruta("OGA5", MAN, MAN))[MAN]["bajan"] == 1
    _bajan(base.t, 2, centro="OGA5")
    assert (await server._maximas_y_ruta("OGA5", MAN, MAN))[MAN]["bajan"] == 2
    assert (await server._maximas_y_ruta("OGA5 Getafe", MAN, MAN))[MAN]["bajan"] == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_trabajar_mas_no_ensena_vacantes_que_cubren_los_que_bajan(base):
    _maximas(base.t, **{MAN: 4})
    base.t["cuadrante_ajustes"] = Col([])
    # Sin nadie que baje faltan 3 y a Ana (libra) le salen.
    assert [(v["date"], v["quedan"]) for v in (await server.trabajar_mas(ANA))["vacantes"]] == [(MAN, 3)]
    _bajan(base.t, 3)
    assert (await server.trabajar_mas(ANA))["vacantes"] == []
    with pytest.raises(HTTPException) as e:
        await server.solicitar_trabajar_mas(MAN, {}, ANA)
    assert e.value.status_code == 409 and "completo" in e.value.detail


# ── cuadrante-11: Días cerrados, los vigentes primero ────────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_dias_cerrados_por_defecto_solo_los_vigentes_y_los_proximos_primero(base):
    base.t["shift_blocks"] = Col([
        {"id": "b1", "center": "OGA5", "desde": "2025-12-20", "hasta": "2026-01-06", "motivo": "Navidad 25", "driver_id": None},
        {"id": "b2", "center": "OGA5", "desde": "2026-12-20", "hasta": "2027-01-06", "motivo": "Navidad 26", "driver_id": None},
        {"id": "b3", "center": "OGA5", "desde": "2026-10-15", "hasta": "2026-10-18", "motivo": "Hasta hoy", "driver_id": None},
        {"id": "b4", "center": "OGA5", "desde": "2026-07-01", "hasta": "2026-07-15", "motivo": "Prime Day", "driver_id": "d1"},
        {"id": "b5", "center": "DGA1", "desde": "2026-11-01", "hasta": "2026-11-02", "motivo": "Otra nave", "driver_id": None},
    ])
    r = await server.listar_bloqueos(center="OGA5", admin=OFI)
    # El que acaba hoy sigue vigente; los de antes no salen, pero se cuentan.
    assert [b["id"] for b in r["bloqueos"]] == ["b3", "b2"]
    assert (r["total"], r["n_pasados"]) == (2, 2) and "pasados" not in r
    r = await server.listar_bloqueos(center="OGA5", pasados=True, admin=OFI)
    assert [b["id"] for b in r["bloqueos"]] == ["b3", "b2"]
    assert [b["id"] for b in r["pasados"]] == ["b4", "b1"]          # el último primero
    assert r["pasados"][0]["driver_name"] == "Ana"
