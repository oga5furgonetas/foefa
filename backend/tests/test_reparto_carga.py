# -*- coding: utf-8 -*-
"""La carga guiada (01-11-2026): al ordenar la ruta, cada parada recibe el hueco de la furgoneta que le toca por su
posición (lo primero que se entrega, junto a la puerta por la que se carga); el escaneo en modo carga marca la parada
como metida sin contar bultos; se puede marcar y desmarcar a mano; el hueco puesto a mano manda; y el ajuste «por
dónde cargo» da la vuelta a las filas."""
import pytest
from fastapi import HTTPException

import reparto
import server
from test_reparto_api import ANA, LUIS, OFICINA, base  # noqa: F401  (la base de mentira y los usuarios de siempre)


def test_hueco_por_posicion_reparte_tercios_y_mitades():
    # Seis paradas: una por hueco, de la puerta trasera hacia dentro.
    assert [reparto.hueco_sugerido(i, 6) for i in range(6)] == list(reparto.HUECOS)
    # Una sola parada: junto a la puerta.
    assert reparto.hueco_sugerido(0, 1) == "Detrás · izq"
    # 112 paradas: seis huecos con 18 o 19 cada uno, en orden.
    huecos = [reparto.hueco_sugerido(i, 112) for i in range(112)]
    cuenta = {h: huecos.count(h) for h in reparto.HUECOS}
    assert all(18 <= n <= 19 for n in cuenta.values()) and sum(cuenta.values()) == 112
    assert huecos == sorted(huecos, key=reparto.HUECOS.index)      # nunca se desordena
    # Por la puerta lateral, la primera fila es la de delante.
    assert reparto.hueco_sugerido(0, 6, "lateral") == "Delante · izq"
    assert reparto.hueco_sugerido(5, 6, "lateral") == "Detrás · der"
    assert reparto.hueco_sugerido(2, 6, "lateral") == "Medio · izq"
    # Lo que no tiene sentido no revienta.
    assert reparto.hueco_sugerido(0, 0) == "" and reparto.hueco_sugerido(-1, 5) == ""
    assert reparto.hueco_sugerido(99, 5) == "Delante · der"


@pytest.mark.asyncio(loop_scope="session")
async def test_al_ordenar_cada_parada_recibe_su_hueco_y_el_manual_manda(base, monkeypatch):
    monkeypatch.setattr(server, "_rep_ahora_local", lambda: (600, 4))
    await server.reparto_ajustes_put({"base_direccion": "Almacén"}, OFICINA)
    ids = []
    for i in range(6):
        p = await server.reparto_mis_pedidos({"direccion": "Avda Montero Ríos 12" if i % 2 else "Rúa Real 5",
                                              "cliente": f"C{i}", "codigo": f"COD{i}"}, ANA)
        ids.append(p["id"])
    # Una la pone el repartidor a mano antes de ordenar.
    await server.reparto_mi_editar(ids[0], {"hueco": "Delante · der"}, ANA)

    r = await server.reparto_mi_ordenar({}, ANA)
    assert r["ruta"]["carga_por"] == "traseras"
    docs = {d["id"]: d for d in base.db["reparto_pedidos"].docs}
    assert docs[ids[0]]["hueco"] == "Delante · der" and docs[ids[0]]["hueco_manual"] is True
    assert "hueco_auto" not in docs[ids[0]] or docs[ids[0]]["hueco_auto"] is False
    for i in ids[1:]:
        d = docs[i]
        assert d["hueco_auto"] is True and d["hueco"] == reparto.hueco_sugerido(d["orden"] - 1, 6), d

    # Escanear en modo carga: marca cargado, no suma bultos, y dice cuántas van.
    antes = docs[ids[1]].get("escaneos")
    r = await server.reparto_escanear({"codigo": "COD1", "carga": True}, ANA)
    assert r["encontrado"] and r["pedido"]["cargado_en"] and r["cargados"] == 1 and r["total"] == 6
    docs = {d["id"]: d for d in base.db["reparto_pedidos"].docs}
    assert docs[ids[1]].get("escaneos") == antes and docs[ids[1]]["cargado_en"]
    # El escaneo normal sigue contando bultos y no marca cargado (los docs de la base de mentira se mutan en
    # sitio: el valor de antes se copia, no se mira después).
    antes2 = int(docs[ids[2]].get("escaneos") or 0)
    r = await server.reparto_escanear({"codigo": "COD2"}, ANA)
    assert r["pedido"]["escaneos"] == antes2 + 1 and "cargados" not in r
    assert not {d["id"]: d for d in base.db["reparto_pedidos"].docs}[ids[2]].get("cargado_en")

    # A mano desde la lista: marcar y quitar; nunca la parada de otro.
    r = await server.reparto_mi_cargado({"id": ids[2], "cargado": True}, ANA)
    assert r == {"ok": True, "cargados": 2, "total": 6}
    r = await server.reparto_mi_cargado({"id": ids[2], "cargado": False}, ANA)
    assert r["cargados"] == 1
    with pytest.raises(HTTPException) as e:
        await server.reparto_mi_cargado({"id": ids[2], "cargado": True}, LUIS)
    assert e.value.status_code == 404

    # Vaciar el hueco a mano lo devuelve a automático en la siguiente ordenación.
    await server.reparto_mi_editar(ids[0], {"hueco": ""}, ANA)
    # Y con la puerta lateral, las filas se dan la vuelta (el ajuste se conserva si el formulario no lo manda).
    await server.reparto_ajustes_put({"base_direccion": "Almacén", "carga_por": "lateral"}, OFICINA)
    await server.reparto_ajustes_put({"base_direccion": "Almacén"}, OFICINA)
    r = await server.reparto_mi_ordenar({}, ANA)
    assert r["ruta"]["carga_por"] == "lateral"
    docs = {d["id"]: d for d in base.db["reparto_pedidos"].docs}
    for i in ids:
        d = docs[i]
        assert d["hueco_auto"] is True and d["hueco"] == reparto.hueco_sugerido(d["orden"] - 1, 6, "lateral"), d
    # La ruta que ve la app lleva el ajuste (para dibujar la furgoneta con la puerta donde toca).
    ruta = await server.reparto_mi_ruta(ANA)
    assert ruta["ruta"]["carga_por"] == "lateral"
    assert all(p.get("hueco") for p in ruta["pedidos"])
