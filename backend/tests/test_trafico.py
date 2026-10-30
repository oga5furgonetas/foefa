# -*- coding: utf-8 -*-
"""Lo que dice la calle en cada país (30-10-2026): los lectores de Bison Futé, NDW, WZDx, BNZFE, GLA y OpenStreetMap,
con muestras REALES (tests/muestras, bajadas el 30-10-2026), y las restricciones por placa."""
import json
import os
from datetime import date, datetime, timezone

import trafico as T

AQUI = os.path.dirname(__file__)


def muestra(nombre):
    with open(os.path.join(AQUI, "muestras", nombre), "rb") as f:
        return f.read()


AHORA = datetime(2026, 10, 30, 10, 0, tzinfo=timezone.utc)


def test_bison_fute_lee_cortes_obras_y_accidentes_vigentes():
    items, publicado = T.incidencias_datex(muestra("bison_fute.xml"), "bison", ahora=AHORA)
    assert publicado.startswith("2026-10-30")
    clases = {i["clase"] for i in items}
    # Las obras de mantenimiento programadas para diciembre NO salen (no están vigentes); el accidente, la retención y la
    # restricción permanente de la N20 (desde 2023, sin fin) sí.
    assert "accidente" in clases and "retencion" in clases
    assert "260122-001707-1" not in {i["id"] for i in items} and "230814-001797-1" in {i["id"] for i in items}
    acc = next(i for i in items if i["clase"] == "accidente")
    assert acc["fuente"] == "bison" and acc["carretera"] == "N569" and acc["municipio"] == "Istres"
    assert abs(acc["lat"] - 43.504517) < 1e-5 and abs(acc["lng"] - 4.9656405) < 1e-5
    # Un tramo (Linear) lleva principio y final distintos.
    ret = next(i for i in items if i["clase"] == "retencion")
    assert ret["lat2"] is not None and (ret["lat"], ret["lng"]) != (ret["lat2"], ret["lng2"])
    assert ret["texto"]


def test_bison_fute_obras_futuras_salen_cuando_toca():
    items, _ = T.incidencias_datex(muestra("bison_fute.xml"), "bison", ahora=datetime(2026, 12, 3, 9, 0, tzinfo=timezone.utc))
    obras = next(i for i in items if i["id"] == "260122-001707-1")
    assert obras["clase"] == "obras" and obras["carretera"] == "N125" and obras["municipio"] == "Eup" and "Travaux" in obras["texto"]


def test_ndw_lee_datex_v3_con_lineas_gml():
    items, publicado = T.incidencias_datex(muestra("ndw_actueel.xml"), "ndw", ahora=AHORA)
    assert publicado.startswith("2026-10-30")
    corte = next(i for i in items if i["clase"] == "corte")
    # calzada cortada por obras, con el principio y el final del posList
    assert corte["que"].startswith("calzada cortada") and corte["lat2"] is not None
    assert abs(corte["lat"] - 52.58548) < 1e-5 and abs(corte["lng"] - 6.128689) < 1e-5
    assert any(i["clase"] == "obstaculo" for i in items)


def test_ndw_zonas_de_emisiones():
    zonas = T.zonas_ndw(muestra("ndw_emissiezones.xml"), ahora=AHORA)
    assert len(zonas) == 1
    z = zonas[0]
    assert z["nombre"] == "ZES Maastricht" and z["tipo"] == "ZES" and z["fuente"] == "ndw"
    assert z["url"].startswith("https://www.gemeentemaastricht.nl") and z["poligonos"] and len(z["poligonos"][0]) >= 4
    assert z["caja"][0] < 50.85 < z["caja"][2] and z["caja"][1] < 5.705 < z["caja"][3]


def test_bnzfe_solo_las_vigentes_y_con_lo_que_prohiben_a_las_furgonetas():
    zonas = T.zonas_bnzfe(muestra("bnzfe_aires.geojson"), hoy=date(2026, 10, 30))
    ids = {z["id"] for z in zonas}
    # Reims 2022 caducó; Reims 2023-2028 y Burdeos siguen.
    assert "200067213-ZFE-001" not in ids and {"200067213-ZFE-002", "243300316-ZFE-001"} <= ids
    reims = next(z for z in zonas if z["id"] == "200067213-ZFE-002")
    assert reims["ciudad"] == "Reims" and reims["tipo"] == "ZFE" and "Crit'Air 4 et au-delà interdits" in reims["descripcion"]
    burdeos = next(z for z in zonas if z["id"] == "243300316-ZFE-001")
    assert burdeos["nombre"] == "ZFE Bordeaux" and burdeos["poligonos"]


def test_gla_ulez():
    zonas = T.zonas_gla(muestra("gla_ulez.geojson"), "ULEZ")
    assert len(zonas) == 1 and zonas[0]["tipo"] == "ULEZ" and zonas[0]["url"].startswith("https://tfl.gov.uk")
    assert "£12.50" in zonas[0]["descripcion"]
    # Londres cae dentro.
    assert T.zonas_osm("{}") == [] and zonas[0]["caja"][0] < 51.5 < zonas[0]["caja"][2]


def test_wzdx_obras_vigentes_en_delaware():
    items = T.incidencias_wzdx(muestra("wzdx_delaware.geojson"), "WZDx · Delaware DOT", ahora=datetime(2026, 10, 30, 9, 30, tzinfo=timezone.utc))
    assert items and all(i["clase"] in ("obras", "corte", "aviso") for i in items)
    assert items[0]["carretera"].startswith("SR 896") and items[0]["lat2"] is not None and items[0]["fuente"].startswith("WZDx")
    # Dos horas después ya acabaron: no se enseñan.
    assert T.incidencias_wzdx(muestra("wzdx_delaware.geojson"), "x", ahora=datetime(2026, 10, 30, 13, 0, tzinfo=timezone.utc)) == []


def test_feeds_wzdx_por_zona():
    seattle = (47.5, -122.5, 47.8, -122.1)
    assert [f[0] for f in T.feeds_wzdx_para(seattle)] == ["wa"]
    assert T.feeds_wzdx_para((40.6, -74.1, 40.9, -73.7)) == []          # Nueva York: sin feed abierto sin clave
    assert T.feeds_wzdx_para(None) == []


def test_osm_une_los_tramos_en_anillos():
    j = {"elements": [{"type": "relation", "id": 7, "tags": {"name": "Umweltzone Prueba", "website": "https://x.de", "emission_standard": "Euro 4"},
                       "members": [
                           {"type": "way", "role": "outer", "geometry": [{"lat": 52.0, "lon": 13.0}, {"lat": 52.0, "lon": 13.1}]},
                           {"type": "way", "role": "outer", "geometry": [{"lat": 52.1, "lon": 13.1}, {"lat": 52.0, "lon": 13.1}]},
                           {"type": "way", "role": "outer", "geometry": [{"lat": 52.1, "lon": 13.1}, {"lat": 52.1, "lon": 13.0}, {"lat": 52.0, "lon": 13.0}]},
                       ]}]}
    zonas = T.zonas_osm(j, "Umweltzone")
    assert len(zonas) == 1 and zonas[0]["nombre"] == "Umweltzone Prueba" and zonas[0]["tipo"] == "Umweltzone"
    assert len(zonas[0]["poligonos"]) == 1 and zonas[0]["poligonos"][0][0] == zonas[0]["poligonos"][0][-1]
    assert "Euro 4" in zonas[0]["descripcion"] and zonas[0]["url"] == "https://x.de"


def test_simplificar_quita_puntos_pero_no_la_forma():
    pts = [[0.0, i * 0.0001] for i in range(200)] + [[0.01, 0.02], [0.0, 0.0]]
    s = T.simplifica(pts, 0.0003)
    assert len(s) < 10 and s[0] == pts[0] and s[-1] == pts[-1]


def test_restricciones_por_placa():
    sp = [{"id": "a", "lat": -23.55, "lng": -46.63}]
    # Lunes 2-11-2026 en São Paulo: finales 1 y 2.
    lunes = datetime(2026, 11, 2, 8, 0)
    a = T.normas_hoy("br", sp, lunes)
    assert len(a) == 1 and a[0]["digitos"] == ["1", "2"] and a[0]["hoy"] is None and "7h às 10h" in a[0]["texto"]
    assert T.normas_hoy("br", sp, lunes, placa="ABC1D21")[0]["hoy"] is True
    assert T.normas_hoy("br", sp, lunes, placa="ABC1234")[0]["hoy"] is False
    # Domingo: sin rodízio.
    assert T.normas_hoy("br", sp, datetime(2026, 11, 1, 8, 0))[0]["hoy"] is False
    # CDMX, miércoles: 3 y 4 (engomado rojo).
    cdmx = [{"id": "b", "lat": 19.43, "lng": -99.13}]
    mie = T.normas_hoy("mx", cdmx, datetime(2026, 11, 4, 8, 0), placa="XYZ-123")
    assert mie[0]["titulo"] == "Hoy No Circula" and mie[0]["digitos"] == ["3", "4"] and mie[0]["hoy"] is True and "rojo" in mie[0]["texto"]
    # Bogotá: solo el aviso con enlace, sin dígitos inventados; Santiago fuera de temporada, nada.
    bog = T.normas_hoy("co", [{"id": "c", "lat": 4.65, "lng": -74.08}], lunes)
    assert bog and bog[0]["digitos"] == [] and bog[0]["hoy"] is None and bog[0]["url"].startswith("https://bogota.gov.co")
    assert T.normas_hoy("cl", [{"id": "d", "lat": -33.45, "lng": -70.65}], lunes) == []
    assert T.normas_hoy("cl", [{"id": "d", "lat": -33.45, "lng": -70.65}], datetime(2026, 6, 1, 8, 0))[0]["titulo"] == "Restricción vehicular"
    # Un país sin reglas, o una ruta fuera de la ciudad: nada.
    assert T.normas_hoy("es", sp, lunes) == [] and T.normas_hoy("br", [{"id": "e", "lat": -22.9, "lng": -43.2}], lunes) == []


def test_fuentes_por_pais():
    assert T.fuente_incidencias("es") == "dgt" and T.fuente_incidencias("fr") == "bison" and T.fuente_incidencias("de") == "autobahn"
    assert T.fuentes_zonas("gb") == ("gla", "osm") and T.fuentes_zonas("us") == () and T.tipo_zona("de") == "Umweltzone"
    assert T.hay_normas("mx") and not T.hay_normas("fr")


# ── Reino Unido (TfL) y Alemania (Autobahn), 30-10-2026 ────────────────────────────────────────────────────────────────

def test_tfl_londres_solo_lo_vigente_y_con_impacto():
    """Muestra real del 30-10-2026 (4 avisos de TfL): se quedan las obras y el aviso meteorológico vigentes; fuera el
    «No impact» y el accidente que acabó la víspera. Calle con su número de carretera y el distrito."""
    j = muestra("tfl_disruptions.json")
    inc = T.incidencias_tfl(j, "TfL", AHORA)
    ids = {i["id"]: i for i in inc}
    assert set(ids) == {"TIMS-237029", "TIMS-237277"}
    obras = ids["TIMS-237029"]
    assert (obras["clase"], obras["que"], obras["carretera"], obras["municipio"]) == ("obras", "obras", "A1010 High Road", "Haringey")
    assert ids["TIMS-237277"]["que"] == "meteorología" and ids["TIMS-237277"]["clase"] == "meteo"
    for i in inc:
        assert i["fuente"] == "TfL" and 51.2 < i["lat"] < 51.8 and -0.6 < i["lng"] < 0.4 and i["texto"] and i["desde"]
    # Con un corte declarado, es un corte; grave, con su gravedad.
    d = json.loads(j)
    d[0]["hasClosures"] = True
    d[0]["severity"] = "Serious"
    corte = T.incidencias_tfl(d, "TfL", AHORA)[0]
    assert (corte["clase"], corte["que"], corte["gravedad"]) == ("corte", "carretera cortada (obras)", "alta")
    # Pasada su fecha, desaparece.
    assert T.incidencias_tfl(j, "TfL", datetime(2026, 12, 1, tzinfo=timezone.utc)) == []


def test_autobahn_obras_y_cortes_sin_las_futuras():
    """Muestra real (A1 y A7): dos obras en marcha, un acceso cerrado y dos avisos futuros que no se enseñan."""
    inc = T.incidencias_autobahn(muestra("autobahn_a1.json"), "Autobahn", AHORA)
    assert len(inc) == 3 and len({i["id"] for i in inc}) == 3
    obras = [i for i in inc if i["clase"] == "obras"]
    assert len(obras) == 2 and all(i["carretera"] == "A1" and i["que"] == "obras" and i["lat2"] is not None for i in obras)
    assert "Saarbrücken - Eppelborn" in obras[0]["texto"] and "Saarbrücken -> Trier" in obras[0]["texto"]
    corte = [i for i in inc if i["clase"] == "corte"][0]
    assert (corte["que"], corte["carretera"], corte["gravedad"]) == ("acceso cerrado", "A7", "alta")
    assert "Horster Dreieck" in corte["texto"] and corte["desde"].startswith("2026-03-08")
    # Una obra que corta del todo la autopista es un corte.
    d = json.loads(muestra("autobahn_a1.json"))
    d["roadworks"][0]["isBlocked"] = "true"
    assert T.incidencias_autobahn(d, "Autobahn", AHORA)[0]["que"] == "carretera cortada (obras)"


def test_tfl_solo_vale_en_el_gran_londres():
    assert T.toca_caja((51.50, -0.15, 51.55, -0.05), T.CAJA_LONDRES)         # Westminster
    assert not T.toca_caja((53.45, -2.30, 53.50, -2.20), T.CAJA_LONDRES)     # Mánchester
    assert not T.toca_caja(None, T.CAJA_LONDRES)
    assert T.fuente_incidencias("gb") == "tfl" and T.fuente_incidencias("de") == "autobahn"
    assert T.fuente_incidencias("it") is None and T.fuente_incidencias("pt") is None

