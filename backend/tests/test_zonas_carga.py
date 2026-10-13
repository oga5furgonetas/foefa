# -*- coding: utf-8 -*-
"""Zonas de carga y descarga en el mapa del repartidor (13-10-2026).

Lo que no se puede romper sin que nadie lo note:
  · de la respuesta de Overpass salen el punto, el horario y el tiempo máximo;
  · a Overpass se le pregunta por un cuadrado de ~5 km, nunca por las paradas;
  · solo vuelven las zonas cerca de SUS paradas pendientes;
  · la segunda vez sale de la caché, y si Overpass no contesta no se rompe nada.

La respuesta de Overpass es de mentira, con su formato (elements, center, tags)
y las etiquetas del wiki de OSM: desde aquí no se llega a Overpass.
"""
import httpx
import pytest

import server
from test_reparto_api import ANA, base  # noqa: F401  (la base de mentira del reparto)

OVERPASS = {"version": 0.6, "elements": [
    {"type": "way", "id": 101, "center": {"lat": 43.3692, "lon": -8.4049},
     "tags": {"highway": "residential", "name": "Rúa Montero Ríos", "parking:right": "lane",
              "parking:right:restriction:conditional": "loading_only @ (Mo-Fr 08:00-14:00)",
              "parking:right:maxstay": "30 min"}},
    {"type": "node", "id": 5, "lat": 43.3713, "lon": -8.3992, "tags": {"amenity": "parking", "restriction": "loading_only"}},
    {"type": "node", "id": 5, "lat": 43.3713, "lon": -8.3992, "tags": {}},                  # repetido
    {"type": "node", "id": 9, "lat": 43.3990, "lon": -8.3000, "tags": {"amenity": "parking", "access": "delivery"}},  # lejos
    {"type": "way", "id": 7, "tags": {"name": "sin punto"}},
]}


def test_de_la_respuesta_salen_punto_horario_y_maximo():
    zonas = server.reparto.zonas_de_overpass(OVERPASS)
    assert [z["id"] for z in zonas] == ["way101", "node5", "node9"]
    assert zonas[0] == {"id": "way101", "lat": 43.3692, "lng": -8.4049, "horario": "Mo-Fr 08:00-14:00",
                        "maximo": "30 min", "calle": "Rúa Montero Ríos"}
    assert zonas[1]["horario"] == "" and server.reparto.zonas_de_overpass({"elements": "basura"}) == []


def test_la_consulta_es_de_un_cuadrado_con_las_etiquetas_de_osm():
    caja = server.reparto.caja_de_tesela(server.reparto.teselas(43.369, -8.405, 43.369, -8.405)[0])
    assert caja == (43.35, -8.45, 43.4, -8.4)
    q = server.reparto.consulta_zonas_carga(*caja)
    assert "(43.35,-8.45,43.4,-8.4)" in q and "loading_only" in q and 'parking:condition' in q and '"access"="delivery"' in q


class _Overpass:
    def __init__(self, estado=200):
        self.peticiones = []
        self.estado = estado

    def cliente(self, *_a, **_k):
        ov = self

        class _C:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *_):
                return False

            async def post(self, url, data=None):
                ov.peticiones.append(data["data"])
                return httpx.Response(ov.estado, json=OVERPASS if ov.estado == 200 else {})
        return _C()


@pytest.fixture
def overpass(monkeypatch):
    ov = _Overpass()
    monkeypatch.setattr(httpx, "AsyncClient", ov.cliente)
    server._ZONAS_CACHE.clear()
    server._ZONAS_ULTIMA[0] = 0.0
    return ov


@pytest.mark.asyncio(loop_scope="session")
async def test_solo_las_zonas_cerca_de_sus_paradas_y_por_cuadrados(base, overpass):  # noqa: F811
    assert (await server.reparto_mi_zonas_carga(ANA))["zonas"] == []        # sin paradas, ni se pregunta
    assert overpass.peticiones == []
    await server.reparto_mis_pedidos({"direccion": "Avda Montero Ríos 12"}, ANA)
    await server.reparto_mis_pedidos({"direccion": "Rúa Real 5"}, ANA)
    r = await server.reparto_mi_zonas_carga(ANA)
    assert [z["id"] for z in r["zonas"]] == ["way101", "node5"] and r["incompleto"] is False
    # Las dos paradas caen en dos cuadrados (-8.405 y -8.399): una pregunta por cuadrado, sin
    # repetir la zona que viene en los dos, y nunca con las coordenadas de las paradas.
    assert len(overpass.peticiones) == 2
    assert "(43.35,-8.45,43.4,-8.4)" in overpass.peticiones[0] and "(43.35,-8.4,43.4,-8.35)" in overpass.peticiones[1]
    assert not any("43.369" in q or "-8.405" in q for q in overpass.peticiones)
    # La segunda vez, de la caché.
    await server.reparto_mi_zonas_carga(ANA)
    assert len(overpass.peticiones) == 2


@pytest.mark.asyncio(loop_scope="session")
async def test_si_overpass_no_contesta_no_se_rompe(base, overpass):  # noqa: F811
    overpass.estado = 504
    await server.reparto_mis_pedidos({"direccion": "Rúa Real 5"}, ANA)
    r = await server.reparto_mi_zonas_carga(ANA)
    assert r == {"zonas": [], "incompleto": True, "fuente": "OpenStreetMap"}
    assert server._ZONAS_CACHE == {}                                        # el fallo no se guarda
