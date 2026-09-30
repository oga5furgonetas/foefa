# -*- coding: utf-8 -*-
"""Días libres conectados con el cuadrante (30-09-2026, Dani):
  · «que si lo apruebo aparezca en el cuadrante y bloqueado, aunque yo lo
    pueda desbloquear»;
  · «a los conductores añádeles cancelar peticiones enviadas o cambiarlas, y
    que esto nos salte una notificación».
Contra una base de mentira pequeña, con los flujos del servidor enteros."""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Db

HOY = "2026-10-01"
DANI = {"sub": "a1", "role": "admin", "name": "Dani", "sa": True}
SIN_APROBAR = {"sub": "a2", "role": "admin", "name": "Luis", "permissions": ["turnos", "cuadrante"]}
ANA = {"sub": "d1", "role": "driver", "name": "ANA"}


@pytest.fixture
def base(monkeypatch):
    db = Db()
    db["drivers"] = Col([{"id": "d1", "name": "ANA PÉREZ", "center": "OGA5", "active": True}])
    avisos = []

    async def push_centro(center, titulo, cuerpo, url):
        avisos.append((center, titulo, cuerpo))

    async def push_usuarios(*a, **k):
        return None

    async def sin_bloqueos(*a, **k):
        return []

    monkeypatch.setattr(server, "db", db)
    monkeypatch.setattr(server, "push_center_event", push_centro)
    monkeypatch.setattr(server, "send_web_push_to_users", push_usuarios)
    monkeypatch.setattr(server, "_bloqueos_que_afectan", sin_bloqueos)
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)
    return SimpleNamespace(db=db, avisos=avisos)


def _peticion(db, rid, fecha, estado="pendiente", grupo="g1", tipo="libre"):
    db["shift_requests"].docs.append({
        "id": rid, "grupo": grupo, "center": "OGA5", "driver_id": "d1", "driver_name": "ANA PÉREZ",
        "date": fecha, "type": tipo, "status": estado, "motivo": "asuntos", "motivo_label": "Asuntos propios",
        "note": "boda de mi prima"})


def _turno(db, fecha):
    return next((d for d in db["shifts"].docs if d["driver_id"] == "d1" and d["date"] == fecha), None)


# ── APROBAR: EN EL CUADRANTE Y CON CANDADO; DESAPROBAR: COMO ESTABA ──────────

@pytest.mark.asyncio(loop_scope="session")
async def test_al_aprobar_entra_con_candado_y_al_desaprobar_vuelve_lo_que_habia(base):
    db = base.db
    db["shifts"].docs.append({"driver_id": "d1", "date": "2026-10-05", "center": "OGA5", "cod": "1",
                              "type": "trabaja", "extra": True})
    _peticion(db, "r1", "2026-10-05")
    await server.resolve_shift_request("r1", {"action": "aprobar"}, DANI)
    t = _turno(db, "2026-10-05")
    assert t["cod"] == "N/T APROB" and t["fijada"] is True and t["extra"] is False and t["aprobado_req"] == "r1"
    await server.resolve_shift_request("r1", {"action": "rechazar", "motivo": "al final no hay gente"}, DANI)
    t = _turno(db, "2026-10-05")
    assert t["cod"] == "1" and t["extra"] is True
    assert "fijada" not in t and "aprobado_req" not in t and "antes_aprob" not in t


@pytest.mark.asyncio(loop_scope="session")
async def test_un_dia_vacio_aprobado_y_desaprobado_se_queda_vacio(base):
    db = base.db
    _peticion(db, "r1", "2026-10-06")
    await server.resolve_shift_request("r1", {"action": "aprobar"}, DANI)
    assert _turno(db, "2026-10-06")["cod"] == "N/T APROB"
    await server.resolve_shift_request("r1", {"action": "rechazar", "motivo": "no se puede"}, DANI)
    assert _turno(db, "2026-10-06") is None


@pytest.mark.asyncio(loop_scope="session")
async def test_un_aprobado_antiguo_sin_lo_de_antes_no_se_queda_con_el_aprob(base):
    db = base.db
    _peticion(db, "r1", "2026-10-07", estado="aprobado")
    db["shifts"].docs.append({"driver_id": "d1", "date": "2026-10-07", "center": "OGA5", "cod": "N/T APROB",
                              "type": "libre", "aprobado_req": "r1"})
    await server.resolve_shift_request("r1", {"action": "rechazar", "motivo": "cambio de planes"}, DANI)
    t = _turno(db, "2026-10-07")
    assert t["cod"] == "N/T" and "aprobado_req" not in t and "fijada" not in t


# ── EL CANDADO EN LA REJILLA ─────────────────────────────────────────────────

async def _celdas(cambios, user):
    return await server.cuadrante_celdas({"center": "OGA5", "cambios": cambios}, user)


@pytest.mark.asyncio(loop_scope="session")
async def test_con_candado_no_se_cambia_y_el_candado_lo_quita_quien_aprueba(base):
    db = base.db
    _peticion(db, "r1", "2026-10-05")
    await server.resolve_shift_request("r1", {"action": "aprobar"}, DANI)
    r = await _celdas([{"driver_id": "d1", "fecha": "2026-10-05", "cod": "1"}], DANI)
    assert r["guardadas"] == 0 and "candado" in r["bloqueadas"][0]["motivo"]
    r = await _celdas([{"driver_id": "d1", "fecha": "2026-10-05", "desbloquear": True}], SIN_APROBAR)
    assert r["guardadas"] == 0 and "solo quien aprueba" in r["bloqueadas"][0]["motivo"]
    assert _turno(db, "2026-10-05")["fijada"] is True
    r = await _celdas([{"driver_id": "d1", "fecha": "2026-10-05", "desbloquear": True}], DANI)
    assert r["guardadas"] == 1 and "fijada" not in _turno(db, "2026-10-05")
    # Sin candado, quien aprueba lo cambia; deja de ser «el de la petición».
    r = await _celdas([{"driver_id": "d1", "fecha": "2026-10-05", "cod": "1"}], DANI)
    t = _turno(db, "2026-10-05")
    assert r["guardadas"] == 1 and t["cod"] == "1" and "aprobado_req" not in t and "antes_aprob" not in t


@pytest.mark.asyncio(loop_scope="session")
async def test_una_peticion_cancelada_no_se_puede_aprobar(base):
    _peticion(base.db, "r1", "2026-10-05", estado="cancelado")
    with pytest.raises(HTTPException) as e:
        await server.resolve_shift_request("r1", {"action": "aprobar"}, DANI)
    assert e.value.status_code == 409


# ── EL CONDUCTOR CANCELA O CAMBIA ────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_cancela_pendientes_y_un_aprobado_futuro_que_vuelve_al_cuadrante(base):
    db = base.db
    _peticion(db, "p1", "2026-10-03", grupo="g1")
    _peticion(db, "p2", "2026-10-04", grupo="g1")
    db["shifts"].docs.append({"driver_id": "d1", "date": "2026-10-09", "center": "OGA5", "cod": "1", "type": "trabaja"})
    _peticion(db, "a1", "2026-10-09", grupo="g2")
    await server.resolve_shift_request("a1", {"action": "aprobar"}, DANI)
    r = await server.cancelar_mis_peticiones({"ids": ["p1", "p2", "a1"]}, ANA)
    assert r["canceladas"] == ["2026-10-03", "2026-10-04", "2026-10-09"] and r["no"] == []
    estados = {x["id"]: x["status"] for x in db["shift_requests"].docs}
    assert estados == {"p1": "cancelado", "p2": "cancelado", "a1": "cancelado"}
    t = _turno(db, "2026-10-09")
    assert t["cod"] == "1" and "aprobado_req" not in t and "fijada" not in t   # como estaba
    assert len(base.avisos) == 1 and "cancela 3 días" in base.avisos[0][1] and "aprobado" in base.avisos[0][2]


@pytest.mark.asyncio(loop_scope="session")
async def test_no_se_cancela_lo_pasado_ni_el_aprobado_de_hoy_ni_lo_de_otro(base):
    db = base.db
    _peticion(db, "viejo", "2026-09-28")
    _peticion(db, "hoy", HOY, estado="aprobado")
    db["shift_requests"].docs.append({"id": "otra", "driver_id": "d9", "date": "2026-10-10", "status": "pendiente"})
    r = await server.cancelar_mis_peticiones({"ids": ["viejo", "hoy", "otra"]}, ANA)
    assert r["canceladas"] == [] and len(r["no"]) == 2          # la de otra persona ni se ve
    assert {x["id"]: x["status"] for x in db["shift_requests"].docs} == {
        "viejo": "pendiente", "hoy": "aprobado", "otra": "pendiente"}
    assert base.avisos == []


@pytest.mark.asyncio(loop_scope="session")
async def test_cambiar_una_peticion_la_mantiene_como_una_y_avisa_de_lo_que_cambia(base):
    db = base.db
    for rid, f in (("p1", "2026-10-16"), ("p2", "2026-10-17"), ("p3", "2026-10-18")):
        _peticion(db, rid, f)
    r = await server.cambiar_mi_peticion({"grupo": "g1", "dates": ["2026-10-17", "2026-10-18", "2026-10-19"],
                                          "motivo": "asuntos", "note": "boda de mi prima"}, ANA)
    assert r["anadidos"] == ["2026-10-19"] and r["quitados"] == ["2026-10-16"]
    vivas = sorted(x["date"] for x in db["shift_requests"].docs if x["status"] == "pendiente" and x["grupo"] == "g1")
    assert vivas == ["2026-10-17", "2026-10-18", "2026-10-19"]
    assert next(x for x in db["shift_requests"].docs if x["id"] == "p1")["status"] == "cancelado"
    assert len(base.avisos) == 1 and "cambia su petición" in base.avisos[0][1]
    assert "añade 19/10" in base.avisos[0][2] and "quita 16/10" in base.avisos[0][2]


@pytest.mark.asyncio(loop_scope="session")
async def test_cambiar_sin_cambiar_nada_o_ya_contestada_no_hace_nada(base):
    db = base.db
    _peticion(db, "p1", "2026-10-16")
    with pytest.raises(HTTPException) as e:
        await server.cambiar_mi_peticion({"grupo": "g1", "dates": ["2026-10-16"], "motivo": "asuntos",
                                          "note": "boda de mi prima"}, ANA)
    assert e.value.status_code == 400
    db["shift_requests"].docs[0]["status"] = "aprobado"
    with pytest.raises(HTTPException) as e:
        await server.cambiar_mi_peticion({"grupo": "g1", "dates": ["2026-10-17"], "motivo": "asuntos",
                                          "note": "boda de mi prima"}, ANA)
    assert e.value.status_code == 409
    assert base.avisos == []
