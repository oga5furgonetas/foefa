# -*- coding: utf-8 -*-
"""«COMPARTIR CON FDS» (01-11-2026): el texto leído de una foto, captura o PDF de la hoja de la agencia se convierte en
paradas con la misma regla que la web (hojaReparto.js, cuyos casos están en scripts/check-leer-etiqueta.mjs), y
/reparto/pegar con `hoja: true` lo enseña y lo añade."""
import pytest
from fastapi import HTTPException

import reparto
import server
from test_reparto_api import OFICINA, base  # noqa: F401  (la base de mentira y los usuarios de siempre)

HOJA_ES = """HOJA DE REPARTO  13/10/2026   Ruta 4
N° Código Destinatario Dirección CP Población Teléfono
1 ZX812345 María López C/ Mayor 12 3ºB 15001 A Coruña 612 345 678
2 ZX812346 Bar Pepe Rúa Real 5 15003 A Coruña 981 22 33 44
3 ZX812347 Ana Ruiz Avda. de Finisterre 100 15004 A Coruña
Total bultos: 3
Firma del conductor:"""


def test_la_hoja_de_reparto_leida_da_sus_paradas_como_en_la_web():
    assert reparto.paradas_de_hoja(HOJA_ES, "es") == [
        {"codigo": "ZX812345", "cliente": "María López", "direccion": "C/ Mayor 12 3ºB 15001 A Coruña", "telefono": "612345678"},
        {"codigo": "ZX812346", "cliente": "Bar Pepe", "direccion": "Rúa Real 5 15003 A Coruña", "telefono": "981223344"},
        {"codigo": "ZX812347", "cliente": "Ana Ruiz", "direccion": "Avda. de Finisterre 100 15004 A Coruña", "telefono": ""},
    ]
    # El nombre en la línea de arriba y el CP con la población en la de abajo (México).
    mx = reparto.paradas_de_hoja("Juan Pérez\nCalle Hidalgo 245 Int. 3\n64000 Monterrey\n81 1234 5678\nJosefina Ruiz\n"
                                 "Av. Insurgentes Sur 1602\n03940 Ciudad de Mexico", "mx")
    assert mx == [
        {"codigo": "", "cliente": "Juan Pérez", "direccion": "Calle Hidalgo 245 Int. 3, 64000 Monterrey", "telefono": "8112345678"},
        {"codigo": "", "cliente": "Josefina Ruiz", "direccion": "Av. Insurgentes Sur 1602, 03940 Ciudad de Mexico", "telefono": ""},
    ]
    # Sin palabra de calle pero con CP y portal; y el teléfono solo, debajo.
    assert reparto.paradas_de_hoja("Mayor 12 28013 Madrid\n+34 981 55 44 33", "es") == [
        {"codigo": "", "cliente": "", "direccion": "Mayor 12 28013 Madrid", "telefono": "981554433"}]
    # Lo que no es una parada no entra; la basura no revienta.
    assert reparto.paradas_de_hoja("Total bultos: 3\nFirma del conductor:\n\n   ", "es") == []
    assert reparto.paradas_de_hoja(None) == [] and reparto.paradas_de_hoja(12345) == []
    # Francia (el número delante de la calle) y Alemania (la calle pegada al nombre), con el teléfono rotulado debajo.
    assert reparto.paradas_de_hoja("Marie Dupont\n12 rue de la Paix\n75002 Paris\nTél : 06 12 34 56 78", "fr") == [
        {"codigo": "", "cliente": "Marie Dupont", "direccion": "12 rue de la Paix, 75002 Paris", "telefono": "0612345678"}]
    assert reparto.paradas_de_hoja("Hans Müller\nHauptstraße 12\n10115 Berlin\nTel. 030 1234567", "de") == [
        {"codigo": "", "cliente": "Hans Müller", "direccion": "Hauptstraße 12, 10115 Berlin", "telefono": "0301234567"}]


def test_el_telefono_de_una_linea_segun_el_pais():
    assert reparto.telefono_de("Bar Pepe Rúa Real 5, 981 22 33 44", "es") == "981223344"
    assert reparto.telefono_de("Rúa Real 5 15003 A Coruña 981 22 33 44", "es") == "981223344"
    assert reparto.telefono_de("+34 612 345 678", "es") == "612345678"
    assert reparto.telefono_de("81 1234 5678", "mx") == "8112345678"
    assert reparto.telefono_de("+52 1 81 1234 5678", "mx") == "8112345678"
    assert reparto.telefono_de("Tél : 06 12 34 56 78", "fr") == "0612345678"
    assert reparto.telefono_de("ZX812345678901", "es") == ""        # un código de envío no es un teléfono
    assert reparto.telefono_de("", "es") == "" and reparto.telefono_de(None, "xx") == ""


@pytest.mark.asyncio(loop_scope="session")
async def test_lo_compartido_se_ensena_y_se_anade_con_pegar(base, monkeypatch):
    async def org_autonomo(_id):
        return {"id": "o1", "account_type": "dsp", "sector": "autonomo", "modulos": ["dashboard", "reparto", "configuracion"]}
    monkeypatch.setattr(server, "get_org", org_autonomo)
    monkeypatch.setattr(server, "_rep_programar_ubicacion", lambda _fecha: None)
    yo = {"sub": "a9", "role": "admin", "name": "Pepe", "org_id": "o1", "db_name": "dsp_x"}
    # Primero se enseña (sin confirmar): las tres paradas, nada creado.
    r = await server.reparto_pegar({"texto": HOJA_ES, "hoja": True, "pais": "es"}, yo)
    assert r["n"] == 3 and [f["cliente"] for f in r["filas"]] == ["María López", "Bar Pepe", "Ana Ruiz"]
    assert base.db["reparto_pedidos"].docs == []
    # Con confirmar, entran como suyas, con su código, su cliente, su teléfono y su CP sacado de la dirección.
    r = await server.reparto_pegar({"texto": HOJA_ES, "hoja": True, "pais": "es", "confirmar": True}, yo)
    assert r["creados"] == 3 and r["repetidos"] == 0
    docs = base.db["reparto_pedidos"].docs
    assert {p["conductor_id"] for p in docs} == {"a9"}
    bar = next(p for p in docs if p["cliente"] == "Bar Pepe")
    assert bar["codigo"] == "ZX812346" and bar["telefono"] == "981223344" and bar["cp"] == "15003"
    # Otra vez lo mismo: ya estaban (por el código).
    r = await server.reparto_pegar({"texto": HOJA_ES, "hoja": True, "pais": "es", "confirmar": True}, yo)
    assert r["creados"] == 0 and r["repetidos"] == 3
    # Una captura sin ninguna parada: se dice.
    with pytest.raises(HTTPException) as e:
        await server.reparto_pegar({"texto": "Total bultos: 3\nFirma:", "hoja": True}, yo)
    assert e.value.status_code == 400 and "compartido" in e.value.detail
    # Sin `hoja`, la lista pegada va como siempre (cada línea con dirección es una parada).
    r = await server.reparto_pegar({"texto": "Rúa Nova 3, 2º\nPraza de Lugo 1"}, yo)
    assert r["n"] == 2
