# -*- coding: utf-8 -*-
"""TELEGRAM SIN DATOS DE NADIE (03-11-2026): lo que FDS manda por su cuenta a Telegram no lleva datos de personas.

Telegram (api.telegram.org) no es un encargado nuestro con contrato ni está en el DPF. Recibe dos cosas:
  · la integración que activa cada empresa en su panel con su propio bot (POST /telegram/config, en su base): los
    avisos y resúmenes de su panel (daños, depósito, aceite, cierre de turno, resumen del día y de la semana, taller),
    con datos de su gente, a su grupo. Esa se queda como está;
  · lo que mandamos nosotros con el bot de la base de la petición: sin empresa (el formulario de contacto, la reserva
    fundador, entrar) es el de la base por defecto (el del dueño), y en un error, el de quien lo sufre. Eso no puede
    llevar datos de personas: dice qué ha pasado y dónde mirar (la Bandeja, Negocio o el registro del servidor).
Los correos, nombres, teléfonos e IP de estas pruebas son inventados (ejemplo.test y las IP de documentación).
"""
import logging
import re
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient

import server
from base_de_mentira import Col, Db

CORREO = "persona.inventada@ejemplo.test"
NOMBRE = "Persona Inventada"
TELEFONO = "600000007"
IP = "203.0.113.7"


def _peticion(ip=IP):
    return SimpleNamespace(headers={"user-agent": "Navegador de prueba"}, client=SimpleNamespace(host=ip))


@pytest.fixture
def avisos(monkeypatch):
    """Lo que sale por Telegram: lo que pasa por _telegram_aviso y por send_telegram_alert."""
    salida = []

    async def aviso(texto):
        salida.append(texto)
        return True

    async def alerta(title, message, severity="critico"):
        salida.append(f"{title}\n{message}")

    monkeypatch.setattr(server, "_telegram_aviso", aviso)
    monkeypatch.setattr(server, "send_telegram_alert", alerta)
    monkeypatch.setattr(server, "global_db", Db())
    server._public_actions.clear()
    server._err_alerted.clear()
    yield salida
    server._public_actions.clear()
    server._err_alerted.clear()


def _sin_datos(texto, *datos):
    bajo = texto.lower()
    return not any(str(d).lower() in bajo for d in datos)


# ── El formulario de contacto ──────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_el_aviso_del_formulario_no_lleva_ni_el_correo_ni_el_nombre(avisos):
    r = await server.capture_lead({"email": CORREO.upper(), "name": NOMBRE, "company": "Transportes Inventados SL",
                                   "plan": f"Llamadme al {TELEFONO}, somos 12 furgonetas"}, request=None)
    assert r["ok"] is True
    assert avisos == [f"📩 Nuevo mensaje en {server._DOMINIO_FRONT}: léelo en la Bandeja del panel."]
    assert _sin_datos(avisos[0], CORREO, "persona", "inventad", TELEFONO, "furgonetas")
    # El mensaje se guarda entero en la Bandeja, como siempre, y el interesado en el CRM.
    m = server.global_db["inbox_messages"].docs
    assert len(m) == 1 and (m[0]["email"], m[0]["name"], m[0]["body"]) == (
        CORREO, NOMBRE, f"Llamadme al {TELEFONO}, somos 12 furgonetas")
    assert server.global_db["leads"].docs[0]["email"] == CORREO


# ── Entrar: el tipo de acceso, sin la cuenta ni la IP ─────────────────────────

class _Sesion:
    def __init__(self, enviados):
        self.enviados = enviados

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, url, json=None, timeout=None):
        self.enviados.append((url, json))
        return SimpleNamespace(status=200)


@pytest.mark.asyncio(loop_scope="session")
async def test_la_alerta_de_entrar_dice_el_tipo_de_acceso_sin_la_cuenta_ni_la_ip(monkeypatch, caplog):
    enviados = []
    db = Db()
    db["telegram_config"] = Col([{"enabled": True, "bot_token": "t0k", "chat_ids": ["1"]}])
    monkeypatch.setattr(server, "db", db)
    monkeypatch.setattr(server, "_aiohttp", SimpleNamespace(ClientSession=lambda: _Sesion(enviados),
                                                            ClientTimeout=server._aiohttp.ClientTimeout))
    clave = "user:prueba-telegram-sin-datos"
    server._login_fails.pop(clave, None)
    server._login_alerted.pop(clave, None)
    try:
        with caplog.at_level(logging.WARNING, logger=server.logger.name):
            for _ in range(server._LOGIN_MAX_FAILS):
                await server._rl_fail(clave, f"admin '{CORREO}' (IP {IP})", "una cuenta de administrador")
    finally:
        server._login_fails.pop(clave, None)
        server._login_alerted.pop(clave, None)
    assert len(enviados) == 1
    texto = enviados[0][1]["text"]
    assert "Acceso: una cuenta de administrador" in texto and "registro del servidor" in texto
    assert _sin_datos(texto, CORREO, "persona", IP)
    # El detalle, en el registro del servidor.
    assert any(CORREO in r.getMessage() and IP in r.getMessage() for r in caplog.records)


def test_cada_forma_de_entrar_dice_su_tipo_de_acceso():
    """Todas las llamadas a _rl_fail dicen qué acceso es (sin él, «una cuenta»), y ninguno de esos textos lleva datos."""
    src = Path(server.__file__).read_text(encoding="utf-8-sig")
    llamadas = re.findall(r"await _rl_fail\((.+)\)\s*$", src, re.M)
    assert len(llamadas) >= 8
    tipos = {"una cuenta de administrador", "un conductor", "la app", "la tienda", "el pase al móvil"}
    for ll in llamadas:
        m = re.search(r', "([^"]+)"$', ll)
        assert m and m.group(1) in tipos, ll


# ── La reserva fundador ───────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_la_reserva_fundador_avisa_sin_sus_datos_de_contacto(avisos):
    r = await server.founder_reserve(server.FounderReserve(name=NOMBRE, email=CORREO, phone=TELEFONO, fleet_size="12"),
                                     _peticion())
    assert r["success"] is True
    assert len(avisos) == 1 and "Negocio" in avisos[0] and "Plazas restantes" in avisos[0]
    assert _sin_datos(avisos[0], CORREO, "persona", "inventad", TELEFONO)
    d = server.global_db["founder_reservations"].docs[0]
    assert (d["name"], d["email"], d["phone"]) == (NOMBRE, CORREO, TELEFONO)


# ── Furgonetas facturadas: cuántas cuentas, no cuáles ─────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_furgonetas_facturadas_sin_el_nombre_de_las_cuentas(avisos, monkeypatch, caplog):
    server.global_db["organizations"] = Col([
        {"id": "o1", "name": "María Inventada López", "account_type": "dsp", "status": "active", "vehiculos_pagados": 1},
        {"id": "o2", "name": "Transportes Inventados SL", "account_type": "dsp", "status": "trial", "vehiculos_pagados": 9},
        {"id": "o3", "name": "Cuadra Exacta SL", "account_type": "dsp", "status": "active", "vehiculos_pagados": 4},
    ])

    async def en_flota(base):
        return {"dsp_o1": 2, "dsp_o2": 7, "dsp_o3": 4}[base]

    monkeypatch.setattr(server, "_vehiculos_facturables", en_flota)
    with caplog.at_level(logging.WARNING, logger=server.logger.name):
        desfases = await server.revisar_facturacion()
    assert {d["dsp"] for d in desfases} == {"María Inventada López", "Transportes Inventados SL"}
    assert len(avisos) == 1 and "2 cuenta(s) con desfase: 1 con más" in avisos[0] and "Negocio" in avisos[0]
    assert _sin_datos(avisos[0], "maría", "inventad", "transportes", "cuadra")
    assert any("María Inventada López" in r.getMessage() for r in caplog.records)


# ── Los avisos de error: el tipo y dónde ──────────────────────────────────────

def test_el_aviso_de_un_error_del_navegador_es_el_tipo_y_la_pantalla():
    a = server._aviso_error_navegador
    # Un JSON.parse de Chrome lleva el principio del texto; la URL, un token y un correo.
    assert a(f"Uncaught SyntaxError: Unexpected token 'M', \"{NOMBRE}\" is not valid JSON",
             f"https://flotadsp.com/portal/AbC123xyz?token=XYZ&email={CORREO}") == "SyntaxError en /portal"
    assert a("Cannot read properties of undefined (reading 'lat')", "/empleo/una-oferta/otra",
             "TypeError: Cannot read properties of undefined\n    at x (MiRuta-abc.js:1:2)") == "TypeError en /empleo"
    assert a("algo raro", "https://flotadsp.com/") == "Un error en /"
    assert a("Error: x", "https://flotadsp.com/AbC123xyz") == "Un error en /"          # un token no es una pantalla
    assert a("(in promise) ReferenceError: x is not defined", "https://flotadsp.com/panel/vehiculos#v1") == \
        "ReferenceError en /panel"


@pytest.mark.asyncio(loop_scope="session")
async def test_los_avisos_de_error_no_llevan_el_mensaje_ni_la_url(avisos, monkeypatch, caplog):
    msg = f"Uncaught SyntaxError: Unexpected token 'P', \"{NOMBRE}, {CORREO}\" is not valid JSON"
    url = f"https://flotadsp.com/registro?email={CORREO}"
    with caplog.at_level(logging.ERROR, logger=server.logger.name):
        await server._notify_error_once("frontend", msg, f"URL: {url}\nUA: Navegador de prueba",
                                        aviso=server._aviso_error_navegador(msg, url))
    assert len(avisos) == 1 and "SyntaxError en /registro" in avisos[0] and "Ref. " in avisos[0]
    assert _sin_datos(avisos[0], CORREO, "persona", "navegador de prueba", "email=")
    ref = re.search(r"Ref\. ([0-9a-f]{8})", avisos[0]).group(1)
    # El detalle, con la misma referencia, en el registro del servidor.
    assert any(ref in r.getMessage() and CORREO in r.getMessage() for r in caplog.records)
    # Un error del servidor (si se encienden sus avisos): un E11000 lleva el correo repetido.
    monkeypatch.setenv("BACKEND_ERROR_ALERTS", "1")
    await server._notify_error_once("backend", f"DuplicateKeyError: E11000 dup key: {{ email: \"{CORREO}\" }}",
                                    "POST /api/x", aviso="DuplicateKeyError en POST /api/x")
    assert len(avisos) == 2 and "DuplicateKeyError en POST /api/x" in avisos[1] and _sin_datos(avisos[1], CORREO)
    # Sin aviso, solo que hubo un error.
    await server._notify_error_once("backend", f"KeyError: '{CORREO}'", "")
    assert len(avisos) == 3 and "Un error sin controlar" in avisos[2] and _sin_datos(avisos[2], CORREO)


def test_un_500_avisa_con_la_ruta_declarada_y_sin_los_identificadores(avisos, monkeypatch):
    monkeypatch.setenv("BACKEND_ERROR_ALERTS", "1")
    app = FastAPI()
    r = APIRouter(prefix="/api")

    @r.post("/reparto/mis-pedidos/{pid}/editar")
    async def revienta(pid: str):
        raise KeyError(CORREO)

    app.include_router(r)
    app.add_exception_handler(Exception, server.unhandled_exception_handler)
    res = TestClient(app, raise_server_exceptions=False).post("/api/reparto/mis-pedidos/p-1234/editar")
    assert res.status_code == 500
    assert len(avisos) == 1 and "KeyError en POST /api/reparto/mis-pedidos/{pid}/editar" in avisos[0]
    assert _sin_datos(avisos[0], CORREO, "p-1234")


# ── La caché de Telegram del vigilante ────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_la_cache_del_vigilante_es_solo_la_de_la_base_por_defecto(monkeypatch):
    """El vigilante avisa de «la base no contesta» con la configuración cacheada: tiene que ser la nuestra (la base
    por defecto), nunca la del grupo de una empresa que acaba de mandar un aviso de su panel."""
    mandado = []

    async def tg(config, texto):
        mandado.append(config.get("bot_token"))
        return True

    db = Db()
    db["telegram_config"] = Col([{"enabled": True, "bot_token": "de-la-empresa", "chat_ids": ["9"]}])
    monkeypatch.setattr(server, "db", db)
    monkeypatch.setattr(server, "_telegram_enviar", tg)
    server._TG_CACHE.clear()
    marca = server._current_db_name.set("dsp_otra_empresa")
    try:
        assert await server._telegram_aviso("⛽ Depósito bajo") is True
    finally:
        server._current_db_name.reset(marca)
    assert mandado == ["de-la-empresa"] and server._TG_CACHE == {}
    # Con la base por defecto (puesta a mano: otra prueba de la sesión puede haber dejado fijada la de una empresa).
    db["telegram_config"] = Col([{"enabled": True, "bot_token": "nuestro", "chat_ids": ["1"]}])
    marca = server._current_db_name.set(server._DEFAULT_DB_NAME)
    try:
        await server._telegram_aviso("🗄️ La base de datos empieza a apretar")
    finally:
        server._current_db_name.reset(marca)
    assert server._TG_CACHE.get("bot_token") == "nuestro"
    server._TG_CACHE.clear()
