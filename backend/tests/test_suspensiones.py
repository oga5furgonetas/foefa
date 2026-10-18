# -*- coding: utf-8 -*-
"""Suspensiones (18-10-2026): la oficina suspende a alguien de un día a otro. Lo que se vigila: que esos días pasen a
SUSP con candado sin pisar vacaciones ni bajas; que nada pueda volver a ponerle a trabajar esos días sin levantarla
(la rejilla, el Excel, el asistente); que no audite ni le avise un refuerzo; que sus días extra de esas fechas se le
contesten; y que al levantarla el cuadrante vuelva a como estaba (lo ya cumplido se queda)."""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Db

OFI = {"sub": "a1", "role": "admin", "name": "Oficina", "org_id": "owner"}
OFI_DGA1 = {"sub": "a2", "role": "admin", "name": "Jefe DGA1", "org_id": "owner", "allowed_centers": ["DGA1"]}
SOLO_VER = {"sub": "a3", "role": "admin", "name": "Mira", "org_id": "owner", "permissions": ["turnos"]}
SEMANA = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]


@pytest.fixture
def nave(monkeypatch):
    t = Db()
    t["drivers"] = Col([{"id": "d1", "name": "Pepe", "center": "OGA5", "active": True},
                        {"id": "d2", "name": "Ana", "center": "OGA5", "active": True}])
    # Pepe trabaja de lunes a viernes, libra el sábado y el domingo está de vacaciones.
    turnos = [{"driver_id": "d1", "date": f, "type": "trabaja", "cod": "1", "center": "OGA5"} for f in SEMANA[:5]]
    turnos += [{"driver_id": "d1", "date": SEMANA[5], "type": "libre", "cod": "N/T", "center": "OGA5"},
               {"driver_id": "d1", "date": SEMANA[6], "type": "libre", "cod": "V", "center": "OGA5"},
               {"driver_id": "d2", "date": SEMANA[5], "type": "libre", "cod": "N/T", "center": "OGA5"}]
    t["shifts"] = Col(turnos)
    t["shift_requests"] = Col([])
    t["refuerzos"] = Col([])
    t["suspensiones"] = Col([])
    t["daily_assignments"] = Col([{"date": SEMANA[0], "center": "OGA5", "slots": [{"driver_id": "d1", "vehicle_id": "v1"}]}])
    t["vehicles"] = Col([{"id": "v1", "license_plate": "1111 AAA", "center": "OGA5", "status": "active"}])
    hoy = {"d": SEMANA[0]}

    async def nada(*a, **k):
        return None
    monkeypatch.setattr(server, "db", t)
    monkeypatch.setattr(server, "_dia_negocio", lambda: hoy["d"])
    monkeypatch.setattr(server, "send_web_push_to_users", nada)
    monkeypatch.setattr(server, "push_center_event", nada)
    return SimpleNamespace(t=t, hoy=hoy)


def celda(t, did, fecha):
    return next((s for s in t.shifts.docs if s["driver_id"] == did and s["date"] == fecha), None)


async def _suspender(desde=SEMANA[0], hasta=SEMANA[6], quien=OFI, motivo="Sanción por la carta del 15-10"):
    return await server.crear_suspension({"driver_id": "d1", "desde": desde, "hasta": hasta, "motivo": motivo}, quien)


@pytest.mark.asyncio(loop_scope="session")
async def test_suspender_pone_susp_y_respeta_vacaciones(nave):
    r = await _suspender()
    assert r["dias_trabajo"] == SEMANA[:5] and r["dias_libres"] == [SEMANA[5]]
    assert r["respetados"] == [{"date": SEMANA[6], "cod": "V", "etiqueta": "Vacaciones"}]
    for f in SEMANA[:6]:
        c = celda(nave.t, "d1", f)
        assert (c["cod"], c["type"], c["fijada"], c["suspension_id"]) == ("SUSP", "libre", True, r["suspension"]["id"])
    assert celda(nave.t, "d1", SEMANA[6])["cod"] == "V"               # las vacaciones no se tocan


@pytest.mark.asyncio(loop_scope="session")
async def test_lo_que_no_se_puede(nave):
    for quien, cuerpo, codigo in (
        (SOLO_VER, {}, 403), (OFI_DGA1, {}, 403),
        (OFI, {"driver_id": "nadie"}, 404),
        (OFI, {"desde": "2026-10-18"}, 400),                             # hacia atrás
        (OFI, {"hasta": "2026-10-18"}, 400),                             # al revés
        (OFI, {"hasta": "2026-12-31"}, 400),                             # más de 60 días
        (OFI, {"motivo": "x"}, 400),
        (OFI, {"desde": SEMANA[6], "hasta": SEMANA[6]}, 409),            # solo vacaciones: nada que suspender
    ):
        datos = {"driver_id": "d1", "desde": SEMANA[0], "hasta": SEMANA[4], "motivo": "Sanción", **cuerpo}
        with pytest.raises(HTTPException) as e:
            await server.crear_suspension(datos, quien)
        assert e.value.status_code == codigo, cuerpo
    await _suspender(SEMANA[0], SEMANA[2])
    with pytest.raises(HTTPException) as e:                              # se pisa con la que ya tiene
        await _suspender(SEMANA[2], SEMANA[4])
    assert e.value.status_code == 409


@pytest.mark.asyncio(loop_scope="session")
async def test_nada_le_vuelve_a_poner_a_trabajar(nave):
    await _suspender()
    # La rejilla de Turnos se guarda entera: un 1 encima de un día suspendido no entra, ni con permiso.
    r = await server.save_shifts_bulk({"items": [
        {"driver_id": "d1", "driver_name": "Pepe", "center": "OGA5", "date": SEMANA[1], "type": "trabaja", "cod": "1"},
        {"driver_id": "d1", "driver_name": "Pepe", "center": "OGA5", "date": SEMANA[2], "type": "libre", "cod": "SUSP"},
        {"driver_id": "d2", "driver_name": "Ana", "center": "OGA5", "date": SEMANA[1], "type": "trabaja", "cod": "1"},
    ]}, OFI)
    assert [(b["date"], b["type"]) for b in r["bloqueados"]] == [(SEMANA[1], "suspendido")]
    assert celda(nave.t, "d1", SEMANA[1])["cod"] == "SUSP" and celda(nave.t, "d2", SEMANA[1])["cod"] == "1"
    # El Excel del mes tampoco.
    limpios, respetados = await server._respeta_aprobados([
        {"driver_id": "d1", "driver_name": "Pepe", "date": SEMANA[3], "type": "trabaja", "cod": "1"},
        {"driver_id": "d2", "driver_name": "Ana", "date": SEMANA[3], "type": "trabaja", "cod": "1"}])
    assert [it["driver_id"] for it in limpios] == ["d2"] and respetados[0]["type"] == "suspendido"
    # Ningún refuerzo le avisa aunque ese día libraba.
    assert set(await server._refuerzo_libres("OGA5", SEMANA[5])) == {"d2"}


@pytest.mark.asyncio(loop_scope="session")
async def test_no_audita_y_lo_ve_en_sus_turnos(nave):
    await _suspender()
    r = await server.get_vehicles_portal({"sub": "d1", "role": "driver"})
    assert r["puede_auditar"] is False and r["motivo"] == "suspendido" and r["vehicles"] == []
    mio = await server.get_my_shifts(None, None, {"sub": "d1", "role": "driver"})
    assert mio["suspension"] == {"desde": SEMANA[0], "hasta": SEMANA[6]}
    assert "motivo" not in mio["suspension"]                            # el motivo es de la oficina


@pytest.mark.asyncio(loop_scope="session")
async def test_sus_dias_extra_de_esas_fechas_se_contestan(nave):
    nave.t.refuerzos.docs.append({"id": "r1", "center": "OGA5", "date": SEMANA[3], "plazas": 1, "estado": "cubierto"})
    nave.t.shift_requests.docs.append({"id": "q1", "driver_id": "d1", "date": SEMANA[3], "type": "extra",
                                       "status": "aprobado", "refuerzo_id": "r1", "center": "OGA5"})
    r = await _suspender()
    assert r["extras_contestados"] == 1
    assert nave.t.shift_requests.docs[0]["status"] == "rechazado"
    assert nave.t.refuerzos.docs[0]["estado"] == "abierto"              # queda la plaza libre otra vez


@pytest.mark.asyncio(loop_scope="session")
async def test_levantar_antes_de_empezar_lo_deja_todo_como_estaba(nave):
    nave.hoy["d"] = "2026-10-18"
    sid = (await _suspender())["suspension"]["id"]
    r = await server.levantar_suspension(sid, OFI)
    assert r["dias_devueltos"] == 6
    assert [celda(nave.t, "d1", f)["cod"] for f in SEMANA] == ["1", "1", "1", "1", "1", "N/T", "V"]
    assert all("suspension_id" not in celda(nave.t, "d1", f) and "fijada" not in celda(nave.t, "d1", f) for f in SEMANA[:6])
    assert nave.t.suspensiones.docs[0]["estado"] == "levantada"
    assert set(await server._refuerzo_libres("OGA5", SEMANA[5])) == {"d1", "d2"}


@pytest.mark.asyncio(loop_scope="session")
async def test_levantar_a_mitad_deja_lo_cumplido(nave):
    sid = (await _suspender())["suspension"]["id"]
    nave.hoy["d"] = SEMANA[2]                                            # miércoles
    await server.levantar_suspension(sid, OFI)
    assert [celda(nave.t, "d1", f)["cod"] for f in SEMANA] == ["SUSP", "SUSP", "1", "1", "1", "N/T", "V"]
    s = nave.t.suspensiones.docs[0]
    assert (s["estado"], s["hasta"], s["hasta_original"]) == ("levantada", SEMANA[1], SEMANA[6])
    with pytest.raises(HTTPException):
        await server.levantar_suspension(sid, OFI)                      # ya levantada


@pytest.mark.asyncio(loop_scope="session")
async def test_la_lista(nave):
    await _suspender()
    r = await server.listar_suspensiones("", OFI)
    assert len(r["suspensiones"]) == 1 and r["suspensiones"][0]["en_curso"] is True and r["puede"] is True
    assert (await server.listar_suspensiones("", OFI_DGA1))["suspensiones"] == []


@pytest.mark.asyncio(loop_scope="session")
async def test_no_se_pide_ni_se_aprueba_un_dia_suspendido(nave):
    """Pedir (o aprobar) un día extra o libre en plena suspensión la pisaría en el cuadrante al aprobarlo."""
    nave.t.shift_requests.docs.append({"id": "q9", "driver_id": "d1", "date": SEMANA[2], "type": "libre",
                                       "status": "pendiente", "center": "OGA5", "driver_name": "Pepe"})
    await _suspender()
    for tipo in ("extra", "libre"):
        with pytest.raises(HTTPException) as e:
            await server.create_shift_request({"dates": [SEMANA[3]], "type": tipo, "motivo": "otro", "note": "quiero ir"},
                                              {"sub": "d1", "role": "driver"})
        assert e.value.status_code == 409
    with pytest.raises(HTTPException) as e:
        await server.resolve_shift_request("q9", {"action": "aprobar"}, OFI)
    assert e.value.status_code == 409
    assert celda(nave.t, "d1", SEMANA[2])["cod"] == "SUSP"
    # Rechazarla sí se puede (con motivo, como siempre).
    await server.resolve_shift_request("q9", {"action": "rechazar", "motivo": "Estás suspendido esos días"}, OFI)
