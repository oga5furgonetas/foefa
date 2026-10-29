# -*- coding: utf-8 -*-
"""La versión de la app que se descarga de la web (GET /app/version), para que la instalada fuera de Play avise."""
import pytest

import server


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_variable_no_se_anuncia_nada(monkeypatch):
    monkeypatch.delenv("APP_ANDROID_WEB", raising=False)
    assert await server.app_version() == {"web": None}


@pytest.mark.asyncio(loop_scope="session")
async def test_con_variable_se_anuncia_code_y_nombre(monkeypatch):
    monkeypatch.setenv("APP_ANDROID_WEB", "17 2.2.5")
    assert await server.app_version() == {"web": {"code": 17, "nombre": "2.2.5"}}
    # Mal escrita (sin code, o con texto): como si no estuviera, nunca un 500 en algo que abre cada móvil.
    for mala in ("2.2.5", "diecisiete 2.2.5", "17 dos", "17 2.2.5 extra"):
        monkeypatch.setenv("APP_ANDROID_WEB", mala)
        assert await server.app_version() == {"web": None}, mala
