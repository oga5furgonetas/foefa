# -*- coding: utf-8 -*-
"""La campaña «tu primera ruta ahora vale 25 €» (29-10-2026): a quién se escribe (toda cuenta de quien reparte
solo con el bono pendiente y sin primera ruta, tenga la edad que tenga), una sola vez, con la cuota del día."""
from datetime import datetime, timedelta, timezone

import pytest

import server
from base_de_mentira import Col, Db

AHORA = datetime(2026, 10, 30, 11, 0, tzinfo=timezone.utc)       # 12:00 en Madrid


def _org(i, **extra):
    o = {"id": f"o{i}", "name": f"Rep {i}", "account_type": "dsp", "db_name": f"dsp_o{i}", "status": "trial",
         "plan": "autonomo", "sector": "autonomo", "email": f"r{i}@x.es", "pais": "es",
         "created_at": (AHORA - timedelta(days=20)).isoformat(), "trial_ends": (AHORA - timedelta(days=13)).isoformat()}
    o.update(extra)
    return o


@pytest.fixture
def mundo(monkeypatch):
    g = Db()
    g["organizations"] = Col([
        _org(1),                                                                       # le toca
        _org(2, created_at=(AHORA - timedelta(days=60)).isoformat(), status="active"),  # vieja, viva: también
        _org(3, bono_pagado=True),                                                     # ya cobró
        _org(4, correos_baja=True),                                                    # se dio de baja
        _org(5, ciclo_correos={"bono25": {"at": "2026-10-29T10:00:00+00:00", "ok": True}}),   # ya lo recibió
        _org(6, sector="empresa", plan="pro"),                                         # no reparte solo
        _org(7, email=""),
        _org(8),                                                                       # con la primera ruta hecha (uso)
    ])
    g["admin_users"] = Col([{"id": f"a{i}", "org_id": f"o{i}", "username": f"r{i}@x.es"} for i in range(1, 9)])
    g["correos_enviados"] = Col([])
    g["pases_movil"] = Col([])
    monkeypatch.setattr(server, "global_db", g)

    async def uso(org):
        hecha = org["id"] == "o8"
        return {"paradas": 30 if hecha else 0, "entregadas": 22 if hecha else 0, "entregadas_reales": 20 if hecha else 0}
    monkeypatch.setattr(server, "_ciclo_uso", uso)
    enviados = []

    async def enviar(to, subject, html, responder_a="", copia=None, texto="", cabeceras=None, solo=""):
        enviados.append({"para": to, "asunto": subject, "texto": texto, "html": html, "cabeceras": cabeceras or {}})
        return True
    monkeypatch.setattr(server, "_enviar_email", enviar)
    monkeypatch.setattr(server, "_email_proveedores", lambda: ["brevo"])
    monkeypatch.setattr(server, "_PORTAL_BASE_FRONT", "https://flotadsp.com")
    monkeypatch.setenv("CAMPANA_BONO25", "1")
    monkeypatch.setenv("EMAIL_FROM", "FDS <contacto@flotadsp.com>")       # la marca que ve el repartidor
    return g, enviados


@pytest.mark.asyncio
async def test_a_quien_le_toca(mundo):
    pend = await server._campana_bono25_pendientes(AHORA)
    assert [o["id"] for o, _, _ in pend] == ["o1", "o2"]            # la más reciente primero
    assert all(not b["pagado"] and b["cent"] == server._BONO_CENT for _, _, b in pend)


@pytest.mark.asyncio
async def test_una_vuelta_manda_una_vez_con_play_qr_y_baja(mundo):
    g, enviados = mundo
    assert await server._campana_bono25_vuelta(AHORA) == 2
    assert sorted(e["para"] for e in enviados) == ["r1@x.es", "r2@x.es"]
    e = enviados[0]
    assert e["asunto"] == "¡Enhorabuena! Tu primera ruta con FDS ahora vale 25 €"
    assert "play.google.com/store/apps/details?id=com.flotadsp.flota&referrer=utm_source%3Dcorreo" in e["texto"]
    assert 'src="https://flotadsp.com/qr-play-correo.png"' in e["html"]
    assert "/api/correo/baja?o=o" in e["cabeceras"]["List-Unsubscribe"]
    assert "#p=" in e["texto"]                                       # entra sin contraseña
    # Queda apuntado (una vez por cuenta) y la copia guardada no lleva el pase.
    o1 = await g["organizations"].find_one({"id": "o1"})
    assert o1["ciclo_correos"]["bono25"]["ok"] and o1["ciclo_correos"]["bono25"]["idioma"] == "es"
    copia = await g["correos_enviados"].find_one({"org_id": "o1"})
    assert copia["por"] == "ciclo:bono25" and "#p=…" in copia["cuerpo"]
    # La segunda vuelta no repite a nadie.
    assert await server._campana_bono25_vuelta(AHORA) == 0 and len(enviados) == 2


@pytest.mark.asyncio
async def test_apagada_o_sin_proveedor_o_de_noche_no_manda(mundo, monkeypatch):
    g, enviados = mundo
    monkeypatch.setenv("CAMPANA_BONO25", "0")
    assert await server._campana_bono25_vuelta(AHORA) == 0
    monkeypatch.setenv("CAMPANA_BONO25", "1")
    monkeypatch.setattr(server, "_email_proveedores", lambda: [])
    assert await server._campana_bono25_vuelta(AHORA) == 0
    monkeypatch.setattr(server, "_email_proveedores", lambda: ["resend"])
    assert await server._campana_bono25_vuelta(AHORA.replace(hour=23)) == 0     # 0:00 en Madrid
    assert enviados == []


@pytest.mark.asyncio
async def test_con_resend_deja_cuota_para_los_correos_de_la_app(mundo, monkeypatch):
    g, enviados = mundo
    monkeypatch.setattr(server, "_email_proveedores", lambda: ["resend"])
    hoy = AHORA.date().isoformat()
    for i in range(server._CAMPANA_BONO_TOPE_DIA - server._CAMPANA_BONO_RESERVA - 1):
        await g["correos_enviados"].insert_one({"id": str(i), "para": "x", "por": "alta", "ok": True, "at": f"{hoy}T08:00:00+00:00"})
    assert await server._campana_bono25_vuelta(AHORA) == 1          # solo cabe uno más hoy
    assert await server._campana_bono25_vuelta(AHORA) == 0
