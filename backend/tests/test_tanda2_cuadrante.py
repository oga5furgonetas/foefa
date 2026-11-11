# -*- coding: utf-8 -*-
"""Tanda 2 (11-11-2026), zona del cuadrante, la parte del servidor (cuadrante-3): los avisos a la oficina de
peticiones de días y de refuerzos llevan su centro en la dirección (`/panel/turnos?centro=OGA5`), para que al tocarlos
el panel abra ESE centro y no el último guardado en el navegador. Sin centro, la dirección es la de siempre.
Contra la base de mentira, con los flujos del servidor enteros."""
from types import SimpleNamespace

import pytest

import server
from base_de_mentira import Col, Db

HOY = "2026-10-18"          # domingo
MAN = "2026-10-19"          # lunes
OFI = {"sub": "a1", "role": "admin", "name": "Oficina", "org_id": "owner"}
ANA = {"sub": "d1", "role": "driver", "name": "ANA"}


@pytest.fixture
def base(monkeypatch):
    t = Db()
    t["drivers"] = Col([
        {"id": "d1", "name": "Ana", "center": "OGA5", "active": True},
        {"id": "d2", "name": "Luis", "center": "OGA5", "active": True},
        {"id": "d3", "name": "Pepe", "center": "OGA5", "active": True},
    ])
    turno = lambda did, tipo, cod, fecha=MAN: {  # noqa: E731
        "driver_id": did, "date": fecha, "type": tipo, "cod": cod, "center": "OGA5"}
    t["shifts"] = Col([turno("d1", "libre", "N/T"), turno("d2", "libre", "L"), turno("d3", "trabaja", "1")])
    t["shift_requests"] = Col([])
    t["refuerzos"] = Col([])
    t["shift_blocks"] = Col([])
    oficina = []

    async def push(ids, titulo, cuerpo, url="/panel"):
        return None

    async def push_oficina(center, titulo, cuerpo, url, exclude_id=None):
        oficina.append(SimpleNamespace(center=center, titulo=titulo, url=url))

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
    return SimpleNamespace(t=t, oficina=oficina)


def test_la_direccion_lleva_el_centro_y_sin_centro_es_la_de_siempre():
    assert server._url_con_centro("/panel/turnos", "OGA5") == "/panel/turnos?centro=OGA5"
    assert server._url_con_centro("/panel/turnos?vista=refuerzos", "DGA1") == "/panel/turnos?vista=refuerzos&centro=DGA1"
    # Un nombre de centro con espacios o signos no rompe la dirección.
    assert server._url_con_centro("/panel/turnos", " OGA5 Getafe ") == "/panel/turnos?centro=OGA5%20Getafe"
    assert server._url_con_centro("/panel/turnos", "A&B") == "/panel/turnos?centro=A%26B"
    for vacio in ("", None, "   "):
        assert server._url_con_centro("/panel/turnos", vacio) == "/panel/turnos"


@pytest.mark.asyncio(loop_scope="session")
async def test_los_avisos_de_peticiones_abren_su_centro(base):
    await server.create_shift_request({"dates": ["2026-11-16", "2026-11-17"], "type": "libre",
                                       "motivo": "asuntos", "note": "boda de mi prima"}, ANA)
    grupo = base.t.shift_requests.docs[0]["grupo"]
    await server.create_shift_request({"dates": ["2026-11-20"], "type": "libre",
                                       "motivo": "asuntos", "note": "médico por la mañana"}, ANA)
    otra = next(q["id"] for q in base.t.shift_requests.docs if q["date"] == "2026-11-20")
    await server.cancelar_mis_peticiones({"ids": [otra]}, ANA)
    await server.cambiar_mi_peticion({"grupo": grupo, "dates": ["2026-11-16"], "note": "boda de mi prima"}, ANA)
    assert [a.titulo.split(" ")[0] for a in base.oficina] == ["📅", "📅", "↩️", "✏️"]
    assert {a.url for a in base.oficina} == {"/panel/turnos?centro=OGA5"}


@pytest.mark.asyncio(loop_scope="session")
async def test_los_avisos_de_refuerzos_abren_su_centro_y_su_pestana(base):
    rid = (await server.crear_refuerzo({"center": "OGA5", "date": MAN, "plazas": 1, "nota": ""}, OFI))["refuerzo"]["id"]
    await server.apuntarme_refuerzo(rid, {}, {"sub": "d1", "role": "driver"})
    await server.desapuntarme_refuerzo(rid, {"sub": "d1", "role": "driver"})
    assert [a.url for a in base.oficina] == ["/panel/turnos?vista=refuerzos&centro=OGA5"] * 2


@pytest.mark.asyncio(loop_scope="session")
async def test_un_conductor_sin_centro_manda_la_direccion_de_siempre(base):
    base.t.drivers.docs[0]["center"] = ""
    await server.create_shift_request({"dates": ["2026-11-16"], "type": "libre",
                                       "motivo": "asuntos", "note": "boda de mi prima"}, ANA)
    [aviso] = base.oficina
    assert aviso.url == "/panel/turnos"
