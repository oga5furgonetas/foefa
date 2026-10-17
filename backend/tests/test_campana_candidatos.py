# -*- coding: utf-8 -*-
"""Campaña «10 € con la app» a los candidatos (17-10-2026): a quién se escribe, una vez, con baja de un clic,
de día y dejando cuota para los correos de la propia app."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

import campana_candidatos as cc
import server
from base_de_mentira import Col, Db


def test_destinatarios_una_vez_por_persona_y_sin_quien_no_quiere():
    fichas = [
        {"email": "Ana@X.es ", "nombre": ""}, {"email": "ana@x.es", "nombre": "Ana López"},   # la misma persona
        {"email": "luis@x.es", "nombre": "Luis"},
        {"email": "no@x.es", "nombre": "No", "novedades_fds": False},                         # dijo que no
        {"email": "no@x.es", "nombre": "No otra vez"},                                         # …en cualquiera de sus fichas
        {"email": "baja@x.es", "baja_comercial": True},
        {"email": "malo-sin-arroba", "nombre": "X"}, {"email": "", "nombre": "Sin"},
        {"email": "cuenta@x.es", "nombre": "Ya usa la app"}, {"email": "ya@x.es"}, {"email": "lista@x.es"},
    ]
    d = cc.destinatarios(fichas, excluir=["CUENTA@x.es"], ya=["ya@x.es"], bajas=["lista@x.es"])
    assert d == [{"email": "ana@x.es", "nombre": "Ana López"}, {"email": "luis@x.es", "nombre": "Luis"}]


def test_el_correo_dice_por_que_llega_y_lleva_la_baja():
    c = cc.correo("Ana López", "https://flotadsp.com/repartidores?utm_content=bono10", "https://api.x/baja?e=a&t=b")
    assert c["asunto"] == "10 € para ti con FDS, la app para repartir"
    t = c["texto"]
    assert t.startswith("Hola Ana:") and "enviaste tu candidatura" in t and "20 entregas" in t and "31 de diciembre" in t
    assert "date de baja con un clic: https://api.x/baja?e=a&t=b" in t
    assert "Darme de baja" in c["html"] and 'href="https://api.x/baja?e=a&amp;t=b"' in c["html"]
    assert "Probar la app gratis" in c["html"]
    assert cc.correo("", "https://x", "https://b")["texto"].startswith("Hola:")


class _Cliente(dict):
    def __getitem__(self, k):
        return self.setdefault(k, Db())


@pytest.fixture
def campana(monkeypatch):
    g = Db()
    g["organizations"] = Col([{"id": "owner", "account_type": "owner", "db_name": "flota", "email": "dani@x.es"},
                              {"id": "o1", "sector": "autonomo", "email": "usa.la.app@x.es"}])
    g["admin_users"] = Col([{"username": "dani"}])
    g["correos_enviados"] = Col([])
    g["correos_bajas"] = Col([])
    cli = _Cliente()
    odb = cli["flota"]
    odb["candidatos"] = Col([{"email": f"c{i}@x.es", "nombre": f"C{i}"} for i in range(8)]
                            + [{"email": "usa.la.app@x.es", "nombre": "Ya"}, {"email": "no@x.es", "novedades_fds": False}])
    odb["candidatos_campana_envios"] = Col([])
    odb["candidatos_campanas"] = Col([{"id": "k1", "tipo": "bono10", "activa": True, "por_dia": 5}])
    enviados = []

    async def enviar(to, subject, html, responder_a="", copia=None, texto="", cabeceras=None):
        enviados.append(SimpleNamespace(to=to, subject=subject, cabeceras=cabeceras, texto=texto))
        return True
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "client", cli)
    monkeypatch.setattr(server, "_enviar_email", enviar)
    monkeypatch.setattr(server, "SECRET_KEY", "secreto-de-prueba")
    monkeypatch.setattr(server, "CORREO_CONTACTO", "contacto@x.es")
    monkeypatch.setenv("RESEND_API_KEY", "x")
    monkeypatch.delenv("CORREO_RESPUESTAS", raising=False)
    server._EMAIL_CUOTA_DIA.clear()
    return SimpleNamespace(g=g, odb=odb, enviados=enviados)


A_LAS_12 = datetime(2026, 10, 17, 10, 0, tzinfo=timezone.utc)          # 12:00 en Madrid


@pytest.mark.asyncio(loop_scope="session")
async def test_la_campana_sale_por_tandas_de_dia_una_vez_y_se_apaga_sola(campana):
    assert await server._campana_bono_vuelta(A_LAS_12.replace(hour=4)) == 0          # 6:00 en Madrid: no
    assert await server._campana_bono_vuelta(A_LAS_12) == 5                          # por_dia: 5
    assert await server._campana_bono_vuelta(A_LAS_12 + timedelta(minutes=20)) == 0  # ya hecho el cupo de hoy
    para = [e.to for e in campana.enviados]
    assert len(set(para)) == 5 and "usa.la.app@x.es" not in para and "no@x.es" not in para
    e = campana.enviados[0]
    assert e.cabeceras["List-Unsubscribe"].startswith("<") and "/api/correo/baja-email?e=" in e.cabeceras["List-Unsubscribe"]
    assert e.cabeceras["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    # Al día siguiente, los 3 que quedan; y la campaña se apaga sola.
    assert await server._campana_bono_vuelta(A_LAS_12 + timedelta(days=1)) == 3
    assert await server._campana_bono_vuelta(A_LAS_12 + timedelta(days=1, hours=1)) == 0
    assert campana.odb["candidatos_campanas"].docs[0]["activa"] is False
    assert len({e.to for e in campana.enviados}) == len(campana.enviados) == 8


@pytest.mark.asyncio(loop_scope="session")
async def test_deja_cuota_para_los_correos_de_la_app(campana):
    campana.odb["candidatos_campanas"].docs[0]["por_dia"] = 60
    hoy = A_LAS_12.date().isoformat()
    campana.g["correos_enviados"].docs.extend(
        [{"at": f"{hoy}T06:00:00+00:00", "ok": True, "por": "ciclo:primer_dia"}] * 82)   # la app ya ha mandado 82
    assert await server._campana_bono_vuelta(A_LAS_12) == 3                          # 100 - 15 de reserva - 82


@pytest.mark.asyncio(loop_scope="session")
async def test_baja_de_un_clic_y_no_se_le_vuelve_a_escribir(campana):
    url = server._baja_email_url("c0@x.es")
    t = url.split("t=")[1]
    mala = await server.correo_baja_email("c0@x.es", "falsa")
    assert b"no es v" in mala.body
    await server.correo_baja_email("C0@x.es", t)                                     # en mayúsculas, la misma
    assert campana.g["correos_bajas"].docs[0]["email"] == "c0@x.es"
    assert campana.odb["candidatos"].docs[0]["baja_comercial"] is True
    await server._campana_bono_vuelta(A_LAS_12)
    assert "c0@x.es" not in [e.to for e in campana.enviados]
