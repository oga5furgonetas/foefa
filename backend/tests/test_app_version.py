# -*- coding: utf-8 -*-
"""La versión de la app que se descarga de la web (GET /app/version), para que la instalada fuera de Play avise."""
import pytest

import server


NADA = {"web": None, "play": None, "min": None}


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_variable_no_se_anuncia_nada(monkeypatch):
    for v in ("APP_ANDROID_WEB", "APP_ANDROID_PLAY", "APP_ANDROID_MIN"):
        monkeypatch.delenv(v, raising=False)
    assert await server.app_version() == NADA


@pytest.mark.asyncio(loop_scope="session")
async def test_con_variable_se_anuncia_code_y_nombre(monkeypatch):
    for v in ("APP_ANDROID_PLAY", "APP_ANDROID_MIN"):
        monkeypatch.delenv(v, raising=False)
    monkeypatch.setenv("APP_ANDROID_WEB", "17 2.2.5")
    assert await server.app_version() == {**NADA, "web": {"code": 17, "nombre": "2.2.5"}}
    # Mal escrita (sin code, o con texto): como si no estuviera, nunca un 500 en algo que abre cada móvil.
    for mala in ("2.2.5", "diecisiete 2.2.5", "17 dos", "17 2.2.5 extra"):
        monkeypatch.setenv("APP_ANDROID_WEB", mala)
        assert await server.app_version() == NADA, mala


@pytest.mark.asyncio(loop_scope="session")
async def test_la_de_play_y_la_minima_van_aparte(monkeypatch):
    """El aviso de actualizar de la app (30-10-2026): la de Play se anuncia cuando Dani la pone (ya publicada) y la mínima
    hace que el aviso no se pueda cerrar; cada una mal escrita cae a null sin tocar a las otras."""
    monkeypatch.delenv("APP_ANDROID_WEB", raising=False)
    monkeypatch.setenv("APP_ANDROID_PLAY", "20 2.4.1")
    monkeypatch.setenv("APP_ANDROID_MIN", "2.4.0")
    assert await server.app_version() == {"web": None, "play": {"code": 20, "nombre": "2.4.1"}, "min": "2.4.0"}
    monkeypatch.setenv("APP_ANDROID_MIN", "dos punto cuatro")
    monkeypatch.setenv("APP_ANDROID_PLAY", "2.4.1")
    assert await server.app_version() == NADA


def test_app_vieja_solo_con_minimo_y_cabecera_android(monkeypatch):
    monkeypatch.delenv("APP_ANDROID_MIN", raising=False)
    assert server._app_android_vieja({"x-fds-app": "android-2.2.3"}) is False
    monkeypatch.setenv("APP_ANDROID_MIN", "2.2.5")
    assert server._app_android_vieja({"x-fds-app": "android-2.2.3"}) is True
    assert server._app_android_vieja({"x-fds-app": "android-2.2.4"}) is True
    assert server._app_android_vieja({"x-fds-app": "android-2.2.5"}) is False
    assert server._app_android_vieja({"x-fds-app": "android-2.10.0"}) is False   # 2.10 > 2.2: números, no texto
    assert server._app_android_vieja({}) is False                                  # la web y los tests no llevan cabecera
    assert server._app_android_vieja({"x-fds-app": "ios-1.0"}) is False
    monkeypatch.setenv("APP_ANDROID_MIN", "dos punto dos")
    assert server._app_android_vieja({"x-fds-app": "android-1.0"}) is False       # variable mal escrita: nunca bloquea


def test_app_vieja_recibe_426_con_el_aviso(monkeypatch):
    from types import SimpleNamespace
    from fastapi import HTTPException
    monkeypatch.setenv("APP_ANDROID_MIN", "2.2.5")
    with pytest.raises(HTTPException) as e:
        server._exigir_app_al_dia(SimpleNamespace(headers={"x-fds-app": "android-2.2.4"}))
    assert e.value.status_code == 426 and "Actualízala" in e.value.detail and "Google Play" in e.value.detail
    server._exigir_app_al_dia(SimpleNamespace(headers={"x-fds-app": "android-2.2.5"}))   # al día: no pasa nada
    server._exigir_app_al_dia(None)
