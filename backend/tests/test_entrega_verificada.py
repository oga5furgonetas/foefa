# -*- coding: utf-8 -*-
"""LA ENTREGA VERIFICADA (01-11-2026): al dar por entregado con foto, la IA la mira y la app avisa si no cuadra (nunca
bloquea); el cliente ve «entrega verificada» en su enlace solo con el veredicto bueno; sin IA no pasa nada; si la IA
tarda, el veredicto llega en segundo plano; y se borra con los datos personales."""
import asyncio
from types import SimpleNamespace

import pytest

import reparto
import server
from test_reparto_api import ANA, OFICINA, base  # noqa: F401  (la base de mentira y los usuarios de siempre)

FOTO = "data:image/jpeg;base64," + "A" * 2000
PETICION = SimpleNamespace(headers={}, client=SimpleNamespace(host="1.1.1.1"))


def test_el_numero_de_portal_de_una_direccion():
    assert reparto.numero_portal("Rúa Nova 3, 2º") == "3"
    assert reparto.numero_portal("Calle Real, 5, 2º B") == "5"
    assert reparto.numero_portal("Avda. Montero Ríos 12 3ºB") == "12"
    assert reparto.numero_portal("Calle 8 de Marzo 12") == "12"
    assert reparto.numero_portal("Rúa Real 5 15003 A Coruña") == "5"
    assert reparto.numero_portal("Praza de Lugo s/n, 15004") == "" and reparto.numero_portal("Praza de Lugo s/n") == ""
    assert reparto.numero_portal("Polígono A Grela, nave 7") == "7"
    assert reparto.numero_portal("") == "" and reparto.numero_portal(None) == ""


def test_el_veredicto_de_lo_que_dijo_la_ia():
    v = reparto.veredicto_entrega({"paquete_visible": True, "numero_visible": "5", "personas": False}, "Rúa Real 5", "Bea")
    assert v["nivel"] == "verificada" and v["aviso"] is None and v["numero"] == "5" and v["portal"] == "5"
    # Otro número: a revisar, y la app enseña los dos.
    v = reparto.veredicto_entrega({"paquete_visible": True, "numero_visible": "7"}, "Rúa Real 5", "Bea")
    assert v["nivel"] == "revisar" and v["aviso"] == "otro_numero" and (v["numero"], v["portal"]) == ("7", "5")
    # «5-7» o «5 B» contienen el 5: vale.
    assert reparto.veredicto_entrega({"paquete_visible": True, "numero_visible": "5-7"}, "Rúa Real 5")["nivel"] == "verificada"
    # Personas o sin paquete mandan sobre todo lo demás.
    assert reparto.veredicto_entrega({"paquete_visible": True, "numero_visible": "5", "personas": True}, "Rúa Real 5")["aviso"] == "personas"
    assert reparto.veredicto_entrega({"paquete_visible": False, "numero_visible": "5"}, "Rúa Real 5")["aviso"] == "sin_paquete"
    # El rótulo del negocio también verifica.
    v = reparto.veredicto_entrega({"paquete_visible": True, "numero_visible": None, "rotulo": "FARMACIA SOL"}, "Rúa Nova 3", "Farmacia Sol, S.L.")
    assert v["nivel"] == "verificada" and v["rotulo"] == "FARMACIA SOL"
    assert reparto.veredicto_entrega({"paquete_visible": True, "rotulo": "Bar Pepe"}, "Rúa Nova 3", "Farmacia Sol")["nivel"] == "parcial"
    # Sin número en la dirección, lo que diga la IA.
    assert reparto.veredicto_entrega({"paquete_visible": True, "coincide": True}, "Praza de Lugo s/n", "Lola")["nivel"] == "verificada"
    assert reparto.veredicto_entrega({"paquete_visible": True, "coincide": None}, "Praza de Lugo s/n", "Lola")["aviso"] == "sin_numero"
    # Paquete sin número: parcial, con el aviso suave; y la basura no revienta.
    assert reparto.veredicto_entrega({"paquete_visible": True}, "Rúa Real 5")["aviso"] == "sin_numero"
    assert reparto.veredicto_entrega("nada", "Rúa Real 5") == {"paquete": None, "personas": None, "numero": None, "portal": "5",
                                                              "rotulo": None, "lugar": None, "nivel": "parcial", "aviso": None}
    assert reparto.veredicto_entrega({"numero_visible": 12, "lugar": "x" * 50}, "Rúa Real 12")["lugar"] == "x" * 20


@pytest.mark.asyncio(loop_scope="session")
async def test_la_ia_mira_la_foto_y_la_app_avisa_antes_de_irse(base, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "de-mentira")
    vistas = []
    respuestas = [{"paquete_visible": True, "numero_visible": "7", "personas": False, "lugar": "puerta"},
                  {"paquete_visible": True, "numero_visible": "5", "personas": False, "lugar": "buzon"}]

    async def ia(foto, direccion, cliente):
        vistas.append((foto[:30], direccion, cliente))
        return respuestas.pop(0)
    monkeypatch.setattr(server, "_rep_ia_entrega_llamada", ia)
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5", "cliente": "Bea", "telefono": "612345678"}, ANA)
    token = (await server.reparto_enlace(p["id"], ANA))["token"]
    # Sin foto, la IA no mira nada.
    r = await server.reparto_estado(p["id"], {"estado": "entregado"}, ANA)
    assert "entrega_ia" not in r and not vistas
    # Con foto: la IA lee el 7 y la parada es el 5 → a revisar, en la propia respuesta.
    r = await server.reparto_estado(p["id"], {"estado": "entregado", "foto": FOTO}, ANA)
    assert r["entrega_ia"]["nivel"] == "revisar" and r["entrega_ia"]["aviso"] == "otro_numero"
    assert r["entrega_ia"]["numero"] == "7" and r["entrega_ia"]["portal"] == "5" and r["entrega_ia"]["cuando"]
    assert vistas == [(FOTO[:30], "Rúa Real 5", "Bea")]
    doc = base.db["reparto_pedidos"].docs[0]
    assert doc["entrega_ia"]["nivel"] == "revisar" and doc["entrega_foto"] == FOTO
    # El cliente no ve «verificada» (ni el aviso).
    pub = await server.seguimiento_publico(token, PETICION)
    assert pub["estado"] == "entregado" and pub["verificada"] is False and "7" not in str(pub)
    # Repite la foto: ahora se lee el 5 → verificada; el cliente lo ve y la oficina también.
    r = await server.reparto_estado(p["id"], {"estado": "entregado", "foto": FOTO.replace("AAAA", "BBBB", 1)}, ANA)
    assert r["entrega_ia"]["nivel"] == "verificada" and r["entrega_ia"]["aviso"] is None
    assert (await server.seguimiento_publico(token, PETICION))["verificada"] is True
    vista = await server.reparto_pedidos("", OFICINA)
    assert vista["pedidos"][0]["entrega_ia"]["nivel"] == "verificada" and vista["pedidos"][0]["entrega_ia"]["lugar"] == "buzon"
    # Volver a «por entregar» borra el veredicto con la foto.
    await server.reparto_estado(p["id"], {"estado": "pendiente"}, ANA)
    assert base.db["reparto_pedidos"].docs[0]["entrega_ia"] is None
    # Y se borra con el resto de datos personales.
    base.db["reparto_pedidos"].docs[0]["entrega_ia"] = {"nivel": "verificada", "numero": "5"}
    base.db["reparto_pedidos"].docs[0]["fecha"] = "2026-08-01"
    server._REP_LIMPIEZA.clear()
    await server.reparto_pedidos("2026-08-01", OFICINA)
    assert base.db["reparto_pedidos"].docs[0]["entrega_ia"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_ia_o_con_la_ia_caida_la_entrega_se_guarda_igual(base, monkeypatch):
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5"}, ANA)
    # Sin GEMINI_API_KEY: ni se intenta.
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("USE_VERTEX_AI", raising=False)
    r = await server.reparto_estado(p["id"], {"estado": "entregado", "foto": FOTO}, ANA)
    assert "entrega_ia" not in r and "entrega_ia" not in base.db["reparto_pedidos"].docs[0]
    # Con la IA caída: la entrega queda guardada con su foto y sin veredicto (nada «pendiente» que la app espere).
    monkeypatch.setenv("GEMINI_API_KEY", "de-mentira")

    async def rota(foto, direccion, cliente):
        raise RuntimeError("503 saturado")
    monkeypatch.setattr(server, "_rep_ia_entrega_llamada", rota)
    r = await server.reparto_estado(p["id"], {"estado": "entregado", "foto": FOTO}, ANA)
    assert r["estado"] == "entregado" and r["entrega_ia"] is None
    assert base.db["reparto_pedidos"].docs[0]["entrega_foto"] == FOTO and base.db["reparto_pedidos"].docs[0]["entrega_ia"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_si_la_ia_tarda_el_veredicto_llega_en_segundo_plano(base, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "de-mentira")
    monkeypatch.setattr(server, "_REP_IA_ESPERA", 0.05)

    async def lenta(foto, direccion, cliente):
        await asyncio.sleep(0.25)
        return {"paquete_visible": True, "numero_visible": "5", "personas": False}
    monkeypatch.setattr(server, "_rep_ia_entrega_llamada", lenta)
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5"}, ANA)
    r = await server.reparto_estado(p["id"], {"estado": "entregado", "foto": FOTO}, ANA)
    assert r["entrega_ia"] == {"nivel": "pendiente", "aviso": None}
    assert base.db["reparto_pedidos"].docs[0]["entrega_ia"]["nivel"] == "pendiente"
    await asyncio.sleep(0.5)
    assert base.db["reparto_pedidos"].docs[0]["entrega_ia"]["nivel"] == "verificada"
    # Lo que ve el repartidor al refrescar su ruta lo trae.
    mia = await server.reparto_mi_ruta(ANA)
    assert mia["pedidos"][0]["entrega_ia"]["nivel"] == "verificada"
