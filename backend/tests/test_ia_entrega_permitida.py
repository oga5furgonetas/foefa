# -*- coding: utf-8 -*-
"""LA FOTO DE ENTREGA SOLO VA A LA IA DE PAGO (14-11-2026). La verificación de la entrega manda a la IA la foto, la
dirección y el nombre del cliente. Antes iba con la clave general (GEMINI_API_KEY, que puede ser del nivel gratuito,
donde Google usa lo que se le manda) sin mirar nada. Ahora sigue la misma regla que la lectura de tickets
(_rep_ia_activa): la IA con datos de clientes permitida (REPARTO_IA_PERMITIDA o REPARTO_IA_CLAVE) y encendida en la
empresa, y la llamada va con el cliente de pago (_rep_cliente_ia). Sin eso, la entrega se guarda como cuando la IA no
contesta: con su foto y sin veredicto, sin errores ni esperas."""
import pytest

import server
from test_reparto_api import ANA, OFICINA, base  # noqa: F401  (la base de mentira y los usuarios de siempre)

FOTO = "data:image/jpeg;base64," + "A" * 2000
PAGO = object()


def _sin_claves(monkeypatch):
    for v in ("REPARTO_IA_PERMITIDA", "REPARTO_IA_CLAVE", "USE_VERTEX_AI"):
        monkeypatch.delenv(v, raising=False)


def _ia_prohibida(monkeypatch) -> list:
    """Apunta cualquier llamada a la IA (y revienta). Se mira la lista al final: el servidor se traga los errores de la
    IA (la entrega se guarda igual), así que el error solo no basta para que la prueba falle."""
    llamadas = []

    async def no_se_llama(*a, **_k):
        llamadas.append(("ia",) + tuple(str(x)[:30] for x in a))
        raise AssertionError("se ha llamado a la IA sin estar permitida")

    def sin_cliente(*_a, **_k):
        llamadas.append(("cliente",))
        raise AssertionError("se ha pedido un cliente de IA sin estar permitida")
    monkeypatch.setattr(server, "_rep_ia_entrega_llamada", no_se_llama)
    monkeypatch.setattr(server, "_gemini_json_call", no_se_llama)
    monkeypatch.setattr(server, "_gemini_client_plantilla", sin_cliente)
    monkeypatch.setattr(server, "_rep_cliente_ia", sin_cliente)
    return llamadas


@pytest.mark.asyncio(loop_scope="session")
async def test_con_solo_la_clave_general_la_foto_no_va_a_la_ia(base, monkeypatch):
    _sin_claves(monkeypatch)
    # La empresa la tuvo encendida cuando había clave de pago; luego se quitó (como en test_ia_de_tickets_solo_con_clave_de_pago).
    monkeypatch.setenv("REPARTO_IA_PERMITIDA", "1")
    assert (await server.reparto_ajustes_put({"ia_tickets": True}, OFICINA))["ia_tickets"] is True
    monkeypatch.delenv("REPARTO_IA_PERMITIDA")
    monkeypatch.setenv("GEMINI_API_KEY", "clave-general-de-mentira")
    llamadas = _ia_prohibida(monkeypatch)
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5", "cliente": "Bea", "telefono": "612345678"}, ANA)
    r = await server.reparto_estado(p["id"], {"estado": "entregado", "foto": FOTO, "nota": "En el buzón"}, ANA)
    # La respuesta, como cuando la IA no contesta: entregado, sin veredicto y sin la foto de vuelta.
    assert r["estado"] == "entregado" and r["entrega_ia"] is None and "entrega_foto" not in r
    doc = base.db["reparto_pedidos"].docs[0]
    assert doc["estado"] == "entregado" and doc["entrega_foto"] == FOTO and doc["entrega_nota"] == "En el buzón"
    assert doc["entrega_ia"] is None and llamadas == []


@pytest.mark.asyncio(loop_scope="session")
async def test_permitida_pero_apagada_en_la_empresa_tampoco(base, monkeypatch):
    """La misma condición que «Leer el ticket con IA»: con la clave de pago puesta, una empresa que no lo ha
    encendido (sin elegir = apagado para las empresas) no manda la foto."""
    _sin_claves(monkeypatch)
    monkeypatch.setenv("REPARTO_IA_CLAVE", "clave-de-pago")
    monkeypatch.setenv("GEMINI_API_KEY", "clave-general-de-mentira")
    llamadas = _ia_prohibida(monkeypatch)
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5", "cliente": "Bea"}, ANA)
    r = await server.reparto_estado(p["id"], {"estado": "entregado", "foto": FOTO}, ANA)
    assert r["estado"] == "entregado" and r["entrega_ia"] is None
    assert base.db["reparto_pedidos"].docs[0]["entrega_foto"] == FOTO and llamadas == []


@pytest.mark.asyncio(loop_scope="session")
async def test_permitida_y_encendida_va_con_el_cliente_de_pago(base, monkeypatch):
    _sin_claves(monkeypatch)
    monkeypatch.setenv("REPARTO_IA_CLAVE", "clave-de-pago")
    monkeypatch.setenv("GEMINI_API_KEY", "clave-general-de-mentira")
    assert (await server.reparto_ajustes_put({"ia_tickets": True}, OFICINA))["ia_tickets"] is True
    clientes = []

    def general(*_a, **_k):
        raise AssertionError("la foto de entrega no puede ir con el cliente general")

    async def llamada(cliente, _modelo, contents):
        clientes.append(cliente)
        assert "Rúa Real 5" in contents[0] and "Bea" in contents[0]
        return {"paquete_visible": True, "numero_visible": "5", "personas": False, "lugar": "puerta"}
    monkeypatch.setattr(server, "_gemini_client_plantilla", general)
    monkeypatch.setattr(server, "_rep_cliente_ia", lambda: PAGO)
    monkeypatch.setattr(server, "_gemini_json_call", llamada)
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5", "cliente": "Bea"}, ANA)
    r = await server.reparto_estado(p["id"], {"estado": "entregado", "foto": FOTO}, ANA)
    assert clientes == [PAGO]
    assert r["entrega_ia"]["nivel"] == "verificada"
    assert base.db["reparto_pedidos"].docs[0]["entrega_ia"]["nivel"] == "verificada"


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_foto_como_siempre(base, monkeypatch):
    _sin_claves(monkeypatch)
    monkeypatch.setenv("REPARTO_IA_CLAVE", "clave-de-pago")
    assert (await server.reparto_ajustes_put({"ia_tickets": True}, OFICINA))["ia_tickets"] is True
    llamadas = _ia_prohibida(monkeypatch)
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5", "cliente": "Bea"}, ANA)
    r = await server.reparto_estado(p["id"], {"estado": "entregado"}, ANA)
    assert r["estado"] == "entregado" and "entrega_ia" not in r
    assert "entrega_ia" not in base.db["reparto_pedidos"].docs[0] and llamadas == []
