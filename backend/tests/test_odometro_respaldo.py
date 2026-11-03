# -*- coding: utf-8 -*-
"""El lector de km con los modelos de respaldo (03-11-2026): con el nivel gratuito de Gemini (20 fotos al día por modelo),
el principal se agotaba a media tarde y el lector decía «no está disponible» a todos los conductores."""
import json

import pytest

import server


def _cliente_falso(llamadas, agotados):
    class _Respuesta:
        text = json.dumps({"km": 123456, "confianza": 0.95, "legible": True, "cuadro_encendido": True,
                           "es_parcial": False, "digitos": 6})

    class _Modelos:
        def generate_content(self, model, contents, config):
            llamadas.append(model)
            if model in agotados:
                raise Exception("429 RESOURCE_EXHAUSTED. Quota exceeded: GenerateRequestsPerDayPerProjectPerModel-FreeTier")
            return _Respuesta()

    class _Cliente:
        def __init__(self, *a, **k):
            self.models = _Modelos()
    return _Cliente


@pytest.fixture
def sin_vetos(monkeypatch):
    vetos = {}
    monkeypatch.setattr(server, "_gemini_daily_exhausted", vetos)
    monkeypatch.setattr(server, "_mark_daily_exhausted", lambda m: vetos.__setitem__(m, server.time.time()))
    monkeypatch.delenv("USE_VERTEX_AI", raising=False)
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    return vetos


@pytest.mark.asyncio(loop_scope="session")
async def test_con_el_principal_agotado_lee_con_el_de_respaldo(sin_vetos, monkeypatch):
    from google import genai
    llamadas = []
    monkeypatch.setattr(genai, "Client", _cliente_falso(llamadas, {server._MODELO_IA_DEFECTO}))
    r = await server._odo_leer_foto(b"foto", intentos=2)
    assert r["servicio_caido"] is False and [x["km"] for x in r["lecturas"]] == [123456, 123456]
    # El principal se prueba una vez y queda vetado: la segunda lectura va directa al de respaldo.
    assert llamadas == [server._MODELO_IA_DEFECTO, server._MODELOS_RESPALDO[0], server._MODELOS_RESPALDO[0]]
    assert server._MODELO_IA_DEFECTO in sin_vetos


@pytest.mark.asyncio(loop_scope="session")
async def test_con_todos_agotados_dice_que_el_lector_no_esta_disponible(sin_vetos, monkeypatch):
    from google import genai
    llamadas = []
    monkeypatch.setattr(genai, "Client", _cliente_falso(llamadas, {server._MODELO_IA_DEFECTO, *server._MODELOS_RESPALDO}))
    r = await server._odo_leer_foto(b"foto", intentos=2)
    assert r == {"lecturas": [], "servicio_caido": True}
    assert len(llamadas) == 1 + len(server._MODELOS_RESPALDO)          # la segunda lectura ya no gasta ninguna
    assert "no esta disponible" in server._odo_consenso(r)["motivo"]
