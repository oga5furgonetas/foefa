# -*- coding: utf-8 -*-
"""El pase al móvil (10-10-2026): quien se da de alta dentro del navegador de TikTok abre
Chrome para instalar la app sin volver a entrar. Un pase sirve una vez, 10 minutos, y la
plataforma «entrando como» el cliente no puede sacarlo."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

import server
from base_de_mentira import Col, Db


def _req(ip="1.2.3.4"):
    return SimpleNamespace(headers={"x-forwarded-for": ip}, client=None)


def _base(monkeypatch):
    g = Db()
    g["admin_users"] = Col([{"id": "a1", "username": "rosa@correo.es", "name": "Rosa", "role": "admin",
                             "org_id": "o1", "hashed_password": "x"}])
    g["organizations"] = Col([{"id": "o1", "slug": "rosa", "account_type": "dsp"}])
    g["pases_movil"] = Col([])
    monkeypatch.setattr(server, "global_db", g)
    server._login_fails.clear()
    return g


YO = {"sub": "a1", "role": "admin", "name": "Rosa", "org_id": "o1"}


@pytest.mark.asyncio(loop_scope="session")
async def test_el_pase_da_la_misma_sesion_una_sola_vez(monkeypatch):
    g = _base(monkeypatch)
    r = await server.crear_pase_movil(YO)
    assert r["minutos"] == 10 and len(r["pase"]) >= 30
    # Se guarda la huella, nunca el pase.
    assert all(r["pase"] not in str(d) for d in g.pases_movil.docs)
    s = await server.canjear_pase_movil({"pase": r["pase"]}, _req())
    assert s.id == "a1" and s.role == "admin" and s.slug == "rosa" and s.access_token
    with pytest.raises(server.HTTPException) as e:
        await server.canjear_pase_movil({"pase": r["pase"]}, _req())
    assert e.value.status_code == 401


@pytest.mark.asyncio(loop_scope="session")
async def test_un_pase_caducado_o_inventado_no_entra(monkeypatch):
    g = _base(monkeypatch)
    r = await server.crear_pase_movil(YO)
    g.pases_movil.docs[0]["expira"] = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    for pase in (r["pase"], "inventado", ""):
        with pytest.raises(server.HTTPException) as e:
            await server.canjear_pase_movil({"pase": pase}, _req())
        assert e.value.status_code == 401


@pytest.mark.asyncio(loop_scope="session")
async def test_entrando_como_el_cliente_no_se_saca_pase(monkeypatch):
    _base(monkeypatch)
    for quien in ({**YO, "imp": True}, {**YO, "demo": True}, {**YO, "role": "driver"}):
        with pytest.raises(server.HTTPException) as e:
            await server.crear_pase_movil(quien)
        assert e.value.status_code == 403
