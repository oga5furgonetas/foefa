# -*- coding: utf-8 -*-
"""La API de conversiones de Meta (02-11-2026): sin META_PIXEL_ID y META_CAPI_TOKEN no llama a nadie; con ellas,
la URL, el correo y el teléfono en SHA-256, el event_id (el mismo que el píxel) y el valor van como exige Meta; y
nunca lanza, porque medir no puede romper un alta ni un login. Sin red: el cliente HTTP es de mentira."""
import hashlib
import logging
import time
from types import SimpleNamespace

import pytest

import meta_capi


def _sha(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


class _Cliente:
    """httpx.AsyncClient de mentira: apunta lo que se manda y contesta lo que se le diga."""
    llamadas = []
    respuesta = SimpleNamespace(status_code=200, text='{"events_received":1}')
    fallo = None

    def __init__(self, *a, **k):
        _Cliente.kw = k

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, url, json=None, **k):
        if _Cliente.fallo:
            raise _Cliente.fallo
        _Cliente.llamadas.append((url, json))
        return _Cliente.respuesta


@pytest.fixture
def red(monkeypatch):
    _Cliente.llamadas = []
    _Cliente.fallo = None
    _Cliente.respuesta = SimpleNamespace(status_code=200, text='{"events_received":1}')
    monkeypatch.setattr(meta_capi.httpx, "AsyncClient", _Cliente)
    monkeypatch.delenv("META_TEST_EVENT_CODE", raising=False)
    return _Cliente


@pytest.mark.asyncio
async def test_sin_entorno_no_llama_a_nadie(red, monkeypatch):
    monkeypatch.delenv("META_PIXEL_ID", raising=False)
    monkeypatch.delenv("META_CAPI_TOKEN", raising=False)
    assert not meta_capi.configurado()
    assert await meta_capi.enviar_evento("CompleteRegistration", "reg-1", correo="a@b.es") is False
    # Con solo una de las dos, tampoco.
    monkeypatch.setenv("META_PIXEL_ID", "123456789012345")
    assert not meta_capi.configurado()
    assert await meta_capi.enviar_evento("app_login", "login-1") is False
    assert red.llamadas == []


@pytest.mark.asyncio
async def test_con_entorno_manda_url_hash_event_id_y_valor(red, monkeypatch):
    monkeypatch.setenv("META_PIXEL_ID", "123456789012345")
    monkeypatch.setenv("META_CAPI_TOKEN", "EAAtoken")
    monkeypatch.setenv("META_TEST_EVENT_CODE", "TEST123")
    antes = int(time.time())
    ok = await meta_capi.enviar_evento(
        "primera_ruta", "ruta-o1", correo="  Pepe.Lopez@X.es ", telefono="+34 600 11 22 33", valor=25, moneda="eur",
        action_source="website", url="https://flotadsp.com/ruta", ip="198.51.100.7", agente="Mozilla/5.0",
        id_externo="o1", fbp="fb.1.1.2", fbc="fb.1.1.abc")
    assert ok is True
    assert len(red.llamadas) == 1
    url, cuerpo = red.llamadas[0]
    assert url == "https://graph.facebook.com/v21.0/123456789012345/events"
    assert cuerpo["access_token"] == "EAAtoken" and cuerpo["test_event_code"] == "TEST123"
    assert red.kw == {"timeout": 8.0}
    e = cuerpo["data"][0]
    assert e["event_name"] == "primera_ruta" and e["event_id"] == "ruta-o1" and e["action_source"] == "website"
    assert antes <= e["event_time"] <= int(time.time())
    assert e["event_source_url"] == "https://flotadsp.com/ruta"
    assert e["custom_data"] == {"value": 25.0, "currency": "EUR"}
    u = e["user_data"]
    assert u["em"] == [_sha("pepe.lopez@x.es")]             # minúsculas y sin espacios
    assert u["ph"] == [_sha("34600112233")]                 # E.164, solo dígitos
    assert u["external_id"] == [_sha("o1")]
    assert u["client_ip_address"] == "198.51.100.7" and u["client_user_agent"] == "Mozilla/5.0"
    assert u["fbp"] == "fb.1.1.2" and u["fbc"] == "fb.1.1.abc"
    assert "app_data" not in e


@pytest.mark.asyncio
async def test_sin_valor_ni_datos_personales_va_lo_minimo_y_sin_codigo_de_prueba(red, monkeypatch):
    monkeypatch.setenv("META_PIXEL_ID", "123456789012345")
    monkeypatch.setenv("META_CAPI_TOKEN", "EAAtoken")
    assert await meta_capi.enviar_evento("CompleteRegistration", "reg-u1", correo="", url="https://flotadsp.com/registro")
    _url, cuerpo = red.llamadas[0]
    assert "test_event_code" not in cuerpo
    e = cuerpo["data"][0]
    assert e["user_data"] == {} and "custom_data" not in e and e["event_id"] == "reg-u1"


def test_el_evento_de_app_lleva_app_data_y_no_url():
    e = meta_capi.evento("app_login", "login-o1", correo="a@b.es", action_source="app", url="https://flotadsp.com/ruta",
                         version_app="2.4.3", ahora=1700000000)
    assert e["action_source"] == "app" and e["event_time"] == 1700000000 and "event_source_url" not in e
    a = e["app_data"]
    assert a["advertiser_tracking_enabled"] is False and a["application_tracking_enabled"] is True
    # Los 16 huecos de extinfo, todos cadenas ("" lo que no se sabe), como pide Meta (02-11-2026: iban enteros).
    assert a["extinfo"] == ["a2", "com.flotadsp.flota", "2.4.3", "2.4.3"] + [""] * 12
    assert meta_capi.evento("x", "1", action_source="app")["app_data"]["extinfo"] == ["a2", "com.flotadsp.flota"] + [""] * 14
    # Un action_source que Meta no conoce se queda en «website».
    assert meta_capi.evento("x", "1", action_source="raro")["action_source"] == "website"


def test_normalizar_correo_y_telefono():
    assert meta_capi.normalizar_correo(" Ana López@Ejemplo.ES\n") == "analópez@ejemplo.es"
    assert meta_capi.normalizar_telefono("+34 600-11-22-33") == "34600112233"
    assert meta_capi.normalizar_telefono("0034600112233") == "34600112233"
    assert meta_capi.normalizar_telefono("(55) 99876-5432") == "55998765432"
    assert meta_capi.normalizar_telefono("1234") == ""                  # eso no es un teléfono
    assert meta_capi.normalizar_telefono(None) == ""
    # Lo personal nunca viaja en claro; un correo sin «@» no se manda.
    u = meta_capi.datos_usuario(correo="nada", telefono="12", ip="?", agente="")
    assert u == {}


@pytest.mark.asyncio
async def test_nunca_lanza(red, monkeypatch):
    monkeypatch.setenv("META_PIXEL_ID", "123456789012345")
    monkeypatch.setenv("META_CAPI_TOKEN", "EAAtoken")
    # Meta dice que no: False, sin excepción.
    red.respuesta = SimpleNamespace(status_code=400, text='{"error":{"message":"Invalid parameter"}}')
    assert await meta_capi.enviar_evento("app_login", "login-1", correo="a@b.es") is False
    # La red se cae: False, sin excepción.
    red.fallo = ConnectionError("sin red")
    assert await meta_capi.enviar_evento("app_login", "login-1", correo="a@b.es") is False
    # Un argumento que no existe: tampoco rompe.
    red.fallo = None
    assert await meta_capi.enviar_evento("app_login", "login-1", inventado=1) is False


@pytest.mark.asyncio
async def test_si_meta_rechaza_un_evento_de_la_app_es_un_error_y_no_un_aviso(red, monkeypatch, caplog):
    """Meta rechaza los eventos «app» si el dataset no está enlazado a la app (02-11-2026): que se vea en los logs
    como error, no como un aviso más. Y lo que se escribe nunca lleva el token."""
    monkeypatch.setenv("META_PIXEL_ID", "123456789012345")
    monkeypatch.setenv("META_CAPI_TOKEN", "EAAtoken")
    red.respuesta = SimpleNamespace(status_code=400, text='{"error":{"message":"No app linked to this dataset"}}')
    with caplog.at_level(logging.WARNING, logger="meta_capi"):
        assert await meta_capi.enviar_evento("app_login", "login-app", action_source="app", version_app="2.4.4") is False
        assert await meta_capi.enviar_evento("app_login", "login-web", action_source="website") is False
    app, web = [r for r in caplog.records if r.name == "meta_capi"]
    assert app.levelno == logging.ERROR and "login-app" in app.getMessage()
    assert web.levelno == logging.WARNING and "login-web" in web.getMessage()
    assert all("EAAtoken" not in r.getMessage() for r in caplog.records)
