# -*- coding: utf-8 -*-
"""El aviso de la mañana (11-10-2026): una notificación a las 8 de su hora, de lunes a sábado, a quien
reparte solo, la ha pedido y aún no ha metido paquetes ese día. Una por día; nunca si ya tiene paquetes."""
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

import server
from base_de_mentira import Col, Db


@pytest.fixture
def mundo(monkeypatch):
    bases = {}

    class Cliente(dict):
        def __getitem__(self, nombre):
            return bases.setdefault(nombre, Db())

    g = Db()
    g["organizations"] = Col([
        {"id": "o1", "name": "Pepe", "sector": "autonomo", "pais": "es", "zona_horaria": "Europe/Madrid",
         "db_name": "dsp_o1", "created_at": "2026-10-10T20:00:00+00:00"},
        {"id": "o2", "name": "Lupe", "sector": "autonomo", "pais": "mx", "zona_horaria": "America/Mexico_City",
         "db_name": "dsp_o2", "created_at": "2026-10-10T20:00:00+00:00"},
    ])
    g["push_subscriptions"] = Col([
        {"endpoint": "e1", "subscription": {"endpoint": "e1"}, "user_id": "u1", "org_id": "o1"},
        {"endpoint": "e2", "subscription": {"endpoint": "e2"}, "user_id": "u2", "org_id": "o2"},
    ])
    mandados = []

    async def push(usuarios, titulo, cuerpo, url="/panel"):
        mandados.append(SimpleNamespace(usuarios=list(usuarios), titulo=titulo, cuerpo=cuerpo, url=url))
    monkeypatch.setattr(server, "client", Cliente())
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "_push_enabled", True)
    monkeypatch.setattr(server, "send_web_push_to_users", push)
    return SimpleNamespace(g=g, bases=bases, mandados=mandados)


@pytest.mark.asyncio(loop_scope="session")
async def test_a_las_8_de_su_hora_una_vez_y_solo_sin_paquetes(mundo):
    lunes_8_madrid = datetime(2026, 10, 12, 6, 10, tzinfo=timezone.utc)          # 08:10 en Madrid (CEST)
    assert await server._aviso_manana_vuelta(lunes_8_madrid) == 1
    assert mundo.mandados[0].usuarios == ["u1"] and mundo.mandados[0].titulo == "¿Empezamos la ruta?"
    assert "utm_source=push" in mundo.mandados[0].url
    assert await server._aviso_manana_vuelta(lunes_8_madrid.replace(minute=40)) == 0     # una vez al día
    # En México (UTC-6 todo el año desde 2022) las 8:10 son las 14:10 UTC; a las 13:10 aún no.
    assert await server._aviso_manana_vuelta(datetime(2026, 10, 12, 13, 10, tzinfo=timezone.utc)) == 0
    assert await server._aviso_manana_vuelta(datetime(2026, 10, 12, 14, 10, tzinfo=timezone.utc)) == 1
    assert mundo.mandados[-1].usuarios == ["u2"]
    # El martes, con paquetes ya metidos, no hace falta avisar.
    server.client["dsp_o1"]["reparto_pedidos"].docs.append({"id": "p1", "fecha": "2026-10-13", "estado": "pendiente"})
    assert await server._aviso_manana_vuelta(datetime(2026, 10, 13, 6, 10, tzinfo=timezone.utc)) == 0


@pytest.mark.asyncio(loop_scope="session")
async def test_ni_en_domingo_ni_a_otra_hora_ni_sin_avisos(mundo, monkeypatch):
    assert await server._aviso_manana_vuelta(datetime(2026, 10, 11, 6, 10, tzinfo=timezone.utc)) == 0   # domingo
    assert await server._aviso_manana_vuelta(datetime(2026, 10, 12, 9, 10, tzinfo=timezone.utc)) == 0   # 11:10
    # Las paradas de ejemplo no cuentan como «ya tiene paquetes».
    server.client["dsp_o1"]["reparto_pedidos"].docs.append({"id": "e", "fecha": "2026-10-12", "ejemplo": True})
    monkeypatch.setattr(server, "_push_enabled", False)
    assert await server._aviso_manana_vuelta(datetime(2026, 10, 12, 6, 10, tzinfo=timezone.utc)) == 0   # sin claves
    monkeypatch.setattr(server, "_push_enabled", True)
    assert await server._aviso_manana_vuelta(datetime(2026, 10, 12, 6, 10, tzinfo=timezone.utc)) == 1
