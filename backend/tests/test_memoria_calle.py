# -*- coding: utf-8 -*-
"""LA MEMORIA DE LA CALLE (01-11-2026): lo que se aprende de cada portal (el código, dónde dejar, cómo se entra) es de
la EMPRESA y vale para la próxima vez, lo haya apuntado quien lo haya apuntado; el portal que da el cliente en su
enlace se queda si no había; y caduca al año."""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import reparto
import server
from test_reparto_api import ANA, LUIS, OFICINA, base  # noqa: F401  (la base de mentira y los usuarios de siempre)

PETICION = SimpleNamespace(headers={}, client=SimpleNamespace(host="1.1.1.1"))


def test_lo_que_se_guarda_de_un_portal():
    assert reparto.memoria_sanea({"portal": " 1234B ", "dejar": "porteria", "acceso": "Entrada por\nel garaje"}) == \
        {"portal": "1234B", "dejar": "porteria", "acceso": "Entrada por el garaje"}
    assert reparto.memoria_sanea({"portal": "x" * 50, "dejar": "tejado"})["portal"] == "x" * 40
    assert reparto.memoria_sanea({"portal": "x" * 50, "dejar": "tejado"})["dejar"] == ""
    assert reparto.memoria_sanea({"portal": "", "dejar": "", "acceso": "  "}) == {}
    assert reparto.memoria_sanea("nada") == {} and reparto.memoria_sanea(None) == {}


@pytest.mark.asyncio(loop_scope="session")
async def test_la_memoria_del_portal_es_de_la_empresa_y_la_trae_la_ruta(base):
    a = await server.reparto_mis_pedidos({"direccion": "Rúa Real 22, A Coruña", "cliente": "Bea"}, ANA)
    assert "memoria" not in (await server.reparto_mi_ruta(ANA))["pedidos"][0]
    r = await server.reparto_mi_memoria(a["id"], {"portal": " 1234B ", "dejar": "porteria", "acceso": "Entrada por el garaje"}, ANA)
    assert r["ok"] and r["memoria"]["portal"] == "1234B" and r["memoria"]["por"] == "ANA" and r["memoria"]["actualizado"]
    assert (await server.reparto_mi_ruta(ANA))["pedidos"][0]["memoria"]["dejar"] == "porteria"
    # Luis, de la misma empresa, con la misma puerta escrita de otra manera, lo hereda.
    b = await server.reparto_mis_pedidos({"direccion": "rua real 22 a coruña"}, LUIS)
    m = (await server.reparto_mi_ruta(LUIS))["pedidos"][0]["memoria"]
    assert m == {"portal": "1234B", "dejar": "porteria", "acceso": "Entrada por el garaje", "por": "ANA", "actualizado": m["actualizado"]}
    # Una puerta, un apunte: Luis lo corrige y es el mismo documento.
    await server.reparto_mi_memoria(b["id"], {"portal": "1234B", "dejar": "buzon", "acceso": ""}, LUIS)
    assert len(base.db["calle_memoria"].docs) == 1 and base.db["calle_memoria"].docs[0]["por"] == "LUIS"
    assert (await server.reparto_mi_ruta(ANA))["pedidos"][0]["memoria"]["dejar"] == "buzon"
    # Lo que no vale, fuera; y todo vacío borra.
    r = await server.reparto_mi_memoria(a["id"], {"portal": "", "dejar": "tejado", "acceso": ""}, ANA)
    assert r["memoria"] is None and base.db["calle_memoria"].docs == []
    assert "memoria" not in (await server.reparto_mi_ruta(LUIS))["pedidos"][0]
    # Nadie toca la parada de otro; la oficina sí puede.
    with pytest.raises(HTTPException) as e:
        await server.reparto_mi_memoria(b["id"], {"portal": "1"}, ANA)
    assert e.value.status_code == 403
    assert (await server.reparto_mi_memoria(b["id"], {"portal": "77"}, OFICINA))["memoria"]["por"] == "Oficina"
    with pytest.raises(HTTPException):
        await server.reparto_mi_memoria("no-existe", {"portal": "1"}, ANA)


@pytest.mark.asyncio(loop_scope="session")
async def test_el_portal_que_da_el_cliente_se_queda_si_no_habia(base):
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5", "telefono": "612345678"}, ANA)
    token = (await server.reparto_enlace(p["id"], ANA))["token"]
    await server.seguimiento_respuesta(token, PETICION, {"estare": "no", "dejar": "vecino", "portal": "4321"})
    doc = base.db["calle_memoria"].docs[0]
    assert doc["portal"] == "4321" and doc["por"] == "cliente" and doc["dejar"] == "" and doc["clave"] == "rua real 5"
    assert (await server.reparto_mi_ruta(ANA))["pedidos"][0]["memoria"]["portal"] == "4321"
    # El repartidor escribe otro: el que dé el cliente después no lo pisa.
    await server.reparto_mi_memoria(p["id"], {"portal": "9999", "acceso": "Timbre 2"}, ANA)
    await server.seguimiento_respuesta(token, PETICION, {"estare": "no", "dejar": "vecino", "portal": "0000"})
    doc = base.db["calle_memoria"].docs[0]
    assert doc["portal"] == "9999" and doc["acceso"] == "Timbre 2" and doc["por"] == "ANA"
    # Sin portal en la respuesta no se toca nada.
    await server.seguimiento_respuesta(token, PETICION, {"estare": "si"})
    assert base.db["calle_memoria"].docs[0]["portal"] == "9999" and len(base.db["calle_memoria"].docs) == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_la_memoria_caduca_al_ano(base):
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Nova 3"}, ANA)
    await server.reparto_mi_memoria(p["id"], {"portal": "1"}, ANA)
    base.db["calle_memoria"].docs[0]["actualizado"] = "2025-01-01T00:00:00+00:00"
    server._REP_LIMPIEZA.clear()
    await server.reparto_pedidos("", OFICINA)
    assert base.db["calle_memoria"].docs == []
