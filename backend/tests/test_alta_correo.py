# -*- coding: utf-8 -*-
"""El correo de bienvenida del alta de una empresa (14-11-2026). Decía «Completo» cuando la web dice «Pro», llevaba
un párrafo en inglés, prometía «sin límites» y la pantalla final decía «Hemos enviado un email…» aunque no saliera
ninguno. Ahora: solo en español, el plan con el nombre de la web, lo que pasa de verdad, y el alta dice si el correo
salió (`correo_bienvenida`). Sin Mongo: base de mentira y Resend simulado."""
import asyncio
import re
from types import SimpleNamespace

import httpx
import pytest

import server
from base_de_mentira import Col, Db

REQ = SimpleNamespace(headers={"user-agent": "Mozilla/5.0"}, client=SimpleNamespace(host="198.51.100.9"))
EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿\U0001F1E6-\U0001F1FF]")


async def _nada(*a, **k):
    return None


@pytest.fixture
def mundo(monkeypatch):
    bases = {}

    class Cliente(dict):
        def __getitem__(self, nombre):
            return bases.setdefault(nombre, Db())

    g = Db()
    for col in ("organizations", "admin_users"):
        g[col] = Col([])
    monkeypatch.setattr(server, "client", Cliente())
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "_ensure_tenant_indexes", _nada)
    monkeypatch.setattr(server, "_meta_enviar", lambda *a, **k: None)
    monkeypatch.setattr(server, "_PORTAL_BASE_FRONT", "https://flotadsp.com")
    monkeypatch.setattr(server, "CORREO_CONTACTO", "hola@ejemplo.es")
    monkeypatch.setenv("RESEND_API_KEY", "re_de_mentira")
    server._public_actions.clear()
    estado = SimpleNamespace(codigo=200, falla=False, enviados=[], g=g)

    class ClienteHttp:
        def __init__(self, *a, **k):
            pass

        async def post(self, url, headers=None, json=None, timeout=None):
            if estado.falla:
                raise httpx.ConnectError("sin red")
            estado.enviados.append(json)
            return SimpleNamespace(status_code=estado.codigo)
    monkeypatch.setattr(httpx, "AsyncClient", ClienteHttp)

    async def ciclo(org_id, cual):
        estado.enviados.append({"ciclo": cual})
        return True
    monkeypatch.setattr(server, "_ciclo_enviar", ciclo)
    yield estado
    server._public_actions.clear()


async def _alta(mundo, nombre="Transportes Pérez", **kw):
    server._public_actions.clear()
    base = dict(org_name=nombre, username="perez-" + str(len(mundo.g["organizations"].docs)),
                slug="perez-%d" % len(mundo.g["organizations"].docs), email="dueno@ejemplo.es",
                sector="otra", password="12345678")
    base.update(kw)
    r = await server.register_dsp(server.RegisterRequest(**base), REQ)
    for _ in range(3):
        await asyncio.sleep(0)
    return r


def _correo(mundo):
    [c] = [e for e in mundo.enviados if "html" in e]
    return c


@pytest.mark.asyncio(loop_scope="session")
async def test_el_correo_dice_lo_que_hay_en_espanol_y_sin_adornos(mundo):
    r = await _alta(mundo, plan="completo")
    assert r.correo_bienvenida is True
    c = _correo(mundo)
    assert c["to"] == ["dueno@ejemplo.es"] and c["subject"] == "Tu cuenta de FDS está lista"
    html, texto = c["html"], c["text"]
    for prohibido in ("Welcome", "Completo", "sin límites", "verific", "¡", "gratuita", "linear-gradient", "🇬🇧"):
        assert prohibido not in html and prohibido not in texto and prohibido not in c["subject"], prohibido
    assert not EMOJI.search(html + texto + c["subject"])
    assert "Tu cuenta está creada con el plan Pro y 14 días de prueba. No hace falta tarjeta: al acabar la prueba " \
           "eliges tú si seguir." in texto
    assert "Hola, Transportes Pérez:" in texto and "Entras al panel con el usuario perez-0." in texto
    assert "pega las matrículas de tus furgonetas, apunta a tus conductores con su móvil y mándales su acceso por " \
           "WhatsApp" in texto
    assert "¿Dudas? Escríbenos a hola@ejemplo.es." in texto
    assert 'href="https://flotadsp.com/panel"' in html and ">Entrar al panel</a>" in html
    assert "#14E7D8" in html and "#10181A" in html and "#F5F6F3" in html                   # tinta, papel y el cian


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("plan,nombre", [("completo", "Pro"), ("pro", "Pro"), ("flota", "Pro"), ("basico", "Esencial"),
                                         ("operacion", "Esencial"), ("holding", "Empresa"), ("reparto", "Reparto")])
async def test_el_plan_se_llama_como_en_la_web(mundo, plan, nombre):
    await _alta(mundo, plan=plan)
    assert f"con el plan {nombre} y 14 días de prueba" in _correo(mundo)["text"]


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_plan_no_se_nombra_ninguno(mundo):
    r = await _alta(mundo)
    texto = _correo(mundo)["text"]
    assert r.correo_bienvenida is True
    assert "Tu cuenta está creada con 14 días de prueba." in texto and "plan" not in texto


@pytest.mark.asyncio(loop_scope="session")
async def test_lo_que_escribe_quien_se_da_de_alta_va_escapado(mundo):
    await _alta(mundo, nombre="<b>Pérez & Hijos</b>")
    html = _correo(mundo)["html"]
    assert "<b>Pérez" not in html and "&lt;b&gt;Pérez &amp; Hijos&lt;/b&gt;" in html


@pytest.mark.asyncio(loop_scope="session")
async def test_correo_bienvenida_solo_es_true_si_resend_lo_acepta(mundo, monkeypatch):
    mundo.codigo = 422
    assert (await _alta(mundo, plan="pro")).correo_bienvenida is False
    mundo.codigo, mundo.falla = 200, True
    assert (await _alta(mundo, plan="pro")).correo_bienvenida is False
    mundo.falla = False
    monkeypatch.delenv("RESEND_API_KEY")
    mundo.enviados.clear()
    assert (await _alta(mundo, plan="pro")).correo_bienvenida is False and mundo.enviados == []
    monkeypatch.setenv("RESEND_API_KEY", "re_de_mentira")
    assert (await _alta(mundo, plan="pro", email="")).correo_bienvenida is False
    assert (await _alta(mundo, plan="pro", desde_ios=True)).correo_bienvenida is False
    assert (await _alta(mundo, plan="pro")).correo_bienvenida is True


@pytest.mark.asyncio(loop_scope="session")
async def test_quien_reparte_solo_recibe_la_del_ciclo_y_cuenta_como_enviada(mundo):
    r = await _alta(mundo, sector="autonomo", plan="autonomo")
    assert r.correo_bienvenida is True and {"ciclo": "bienvenida"} in mundo.enviados
    assert not [e for e in mundo.enviados if "html" in e]
