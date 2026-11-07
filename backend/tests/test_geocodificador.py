# -*- coding: utf-8 -*-
"""DÓNDE CAE UNA DIRECCIÓN (02-11-2026), sin salir a Internet: la red es de mentira y dice lo que diría cada servicio.

Dani, probando la app con una cuenta nueva: «el primer paquete que escaneo no encuentra la dirección y tiene que ir por
Maps». Lo que se prueba es lo que no se puede romper sin que nadie lo note:
  · la etiqueta se lee como sale (tipo abreviado, «Nº», piso, la «A» de A Coruña) y a CartoCiudad se le pregunta
    como lo entiende: nombre sin tipo ni artículo, número y pueblo; nunca el CP ni el piso dentro;
  · el orden de la cadena: el callejero oficial, Photon y, si no, Nominatim; con un portal seguro no se pregunta más;
  · una CALLE nunca sale como portal, y lo de otro CP, otro pueblo lejos u otro país no vale;
  · la ZONA (el centro del CP) va sin lat/lng: la app de antes guía a cualquier lat/lng como si fuera la puerta;
  · la caché, el semáforo y el corta-circuitos de la red de verdad;
  · POST /reparto/ubicar (no guarda nada) y situar una parada con lat/lng sin cambiar su dirección.
Y la revisión del 02-11-2026: lo del concello de al lado solo se sugiere (S1) y un portal de OpenStreetMap lejos del
tramo oficial no se cree; las empresas sin CartoCiudad hasta CARTOCIUDAD_EMPRESAS_DESDE (S3); una búsqueda cortada por
tiempo no se guarda y su zona se vuelve a buscar antes de ordenar (S4); navegar sin punto pide situarla (S6).
Y el 03-11-2026: la calle elegida a mano ("precision": "calle") queda «aprox» con su geo_origen y ninguna búsqueda
automática la pisa; y, sin poner nada, las empresas ya van a CartoCiudad (Dani: «Solo las mías»).
Las direcciones son calles y edificios públicos o inventados: ninguna de una persona.
"""
import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import geocodificador as G
import reparto as R
import server
from base_de_mentira import Col, Db

HOY = "2026-11-02"
ANA = {"sub": "d1", "role": "driver", "name": "ANA", "org_id": "o1"}
LUIS = {"sub": "d2", "role": "driver", "name": "LUIS", "org_id": "o1"}
OFICINA = {"sub": "a1", "role": "admin", "name": "Oficina", "db_name": "dsp_x", "org_id": "o1"}

CORUNA_15003 = (43.3700, -8.3990)        # el centro de un CP (inventado, en A Coruña)
MADRID_28013 = (40.4180, -3.7080)


# ── lo que contestaría cada servicio ──────────────────────────────────────────

def portal(via, num, cp, muni, lat, lng, tip="CALLE", pob=None, ext=None, ident=None):
    return {"id": ident or f"{via}-{num}-{muni}-{lat}", "type": "portal", "address": f"{tip} {via} {num}, {muni}",
            "postalCode": cp, "muni": muni, "poblacion": pob or muni, "tip_via": tip, "lat": lat, "lng": lng,
            "portalNumber": num, "extension": ext, "provinceCode": cp[:2], "state": 0}


def centro_cp(cp, punto):
    return {"id": cp, "type": "Codpost", "postalCode": cp, "lat": punto[0], "lng": punto[1]}


def ph_casa(calle, num, cp, ciudad, lat, lng, pais="ES"):
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [lng, lat]},
            "properties": {"type": "house", "street": calle, "housenumber": str(num), "postcode": cp, "city": ciudad,
                           "countrycode": pais}}


def ph_calle(nombre, cp, ciudad, lat, lng):
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [lng, lat]},
            "properties": {"type": "street", "name": nombre, "postcode": cp, "city": ciudad, "countrycode": "ES"}}


def nom(lat, lng, calle, num=None, cp="", ciudad="", clase="building", tipo="yes", pais="es"):
    a = {"road": calle, "postcode": cp, "city": ciudad, "country_code": pais}
    if num is not None:
        a["house_number"] = str(num)
    return {"lat": str(lat), "lon": str(lng), "class": clase, "type": tipo,
            "addresstype": "road" if clase == "highway" else clase, "address": a}


class Red:
    """La red de mentira de la cadena: por cada clase de petición (candidates, find, reverseGeocode, photon,
    nominatim), lo que diga la prueba (un valor o una función de los parámetros). Sin nada, lo que contestan cuando
    no encuentran: CartoCiudad 204, Photon sin features y Nominatim una lista vacía. Apunta todo lo pedido."""

    def __init__(self, fallan=(), **respuestas):
        self.r, self.fallan, self.pedidas = respuestas, set(fallan), []

    async def get(self, srv, url, params, tope, idioma=None):
        clase = url.rsplit("/", 1)[-1] if srv == "cartociudad" else srv
        self.pedidas.append((clase, dict(params)))
        if srv in self.fallan or clase in self.fallan:
            return {"status": "tope", "json": None}
        r = self.r.get(clase)
        js = r(params) if callable(r) else r
        if js is None:
            if srv == "cartociudad":
                return {"status": 204, "json": None}
            return {"status": 200, "json": {"features": []} if srv == "photon" else []}
        return {"status": 200, "json": js}

    def clases(self):
        return [c for c, _ in self.pedidas]


# ── leer la etiqueta y preguntar como entiende CartoCiudad ─────────────────────

def test_la_etiqueta_se_lee_como_sale():
    p = G.leer_etiqueta("RUA REAL Nº 1 3ºB, 15003, A CORUÑA")
    assert (p["familia"], p["nombre"], p["num"], p["letra"], p["cp"]) == ("calle", "REAL", "1", "", "15003")
    assert G.oficial(p["loc"]) == "A Coruña"                       # y no «A CORUÑA» ni «La Coruña»
    p = G.leer_etiqueta("Paseo Manuel Núñez Nº 37, 32616, Vilardevós")
    assert (p["familia"], p["nombre"], p["num"], p["cp"], p["loc"]) == ("paseo", "Manuel Núñez", "37", "32616", "Vilardevós")
    p = G.leer_etiqueta("Calle Fernando Macías N.º 4, 15004, CORUÑA (A)")
    assert p["num"] == "4" and G.oficial(p["loc"]) == "A Coruña"
    p = G.leer_etiqueta("LG. AS LARANXEIRAS 50, 36712, TUI")
    assert (p["familia"], p["nombre"], p["num"]) == ("lugar", "AS LARANXEIRAS", "50")
    # La «A» de «1 A Coruña» es del pueblo, no la puerta; «6A» pegado sí es la letra del portal.
    p = G.leer_etiqueta("Rúa Real 1 A Coruña")
    assert p["num"] == "1" and p["letra"] == "" and G.oficial(p["loc"]) == "A Coruña"
    assert G.leer_etiqueta("PAZO DE IRIXOA 6A, 15313, IRIXOA")["letra"] == "A"
    p = G.leer_etiqueta("Zabalbide kalea 61, 48007, Bilbao")
    assert (p["familia"], p["nombre"], p["num"]) == ("calle", "Zabalbide", "61")
    p = G.leer_etiqueta("Avenida da Pasaxe s/n, 15009, A Coruña")
    assert p["sn"] and p["num"] == ""
    # El nombre o la empresa delante no es la calle; sin nada que lo parezca, el primer trozo, como antes.
    p = G.leer_etiqueta("TALLERES INVENTADOS SL, Rúa Real 1, 15003 A Coruña")
    assert (p["nombre"], p["num"], G.oficial(p["loc"])) == ("Real", "1", "A Coruña")
    assert G.leer_etiqueta("Lugar O Barreiro, 36471 Salceda de Caselas")["nombre"] == "O Barreiro"
    # Donde el número va delante, y el CP de cada país.
    p = G.leer_etiqueta("10 Downing Street, London", pais="gb")
    assert (p["num"], p["nombre"], p["loc"]) == ("10", "Downing Street", "London")
    assert G.leer_etiqueta("Rua Augusta 100, 1100-053 Lisboa", pais="pt")["cp"] == "1100-053"


def test_el_piso_pegado_a_la_puerta_no_es_el_pueblo():
    """A5 (02-11-2026): «2ºIzq», «3ºDcha» o «1ºB» pegados son el piso. Antes «2ºIzq» se tomaba por el pueblo y Madrid
    (que también es provincia) se quitaba: a CartoCiudad se le preguntaba «Mayor 5, 2ºIzq»."""
    p = G.leer_etiqueta("Calle Mayor 5 2ºIzq, 28013 Madrid")
    assert (p["nombre"], p["num"], p["loc"], p["localidades"]) == ("Mayor", "5", "Madrid", ["Madrid"])
    assert G.consultas_cc(p, {})[0] == "Mayor 5, Madrid"
    p = G.leer_etiqueta("Rúa Real 2 3ºDcha, 15003 A Coruña")
    assert G.oficial(p["loc"]) == "A Coruña" and p["otros"] == []
    assert all(G.es_piso(t) for t in ("1ºB", "3ºA", "2ºIzq", "2ºIzda", "3ºDcha", "1ºCtro", "2ª", "2º Izq", "bajo B"))
    assert not any(G.es_piso(t) for t in ("12B", "Real", "Ames"))


def test_a_cartociudad_se_le_pregunta_como_lo_entiende():
    """Medido el 02-11-2026: con el tipo («rúa»), un artículo delante o el CP dentro no contesta o da basura; con
    «nombre número, pueblo» encuentra el 91 % de los portales. Sin comillas (dan un 500)."""
    qs = G.consultas_cc(G.leer_etiqueta("RUA REAL Nº 1 3ºB, 15003, A CORUÑA"), {})
    assert qs[0].lower() == "real 1, a coruña"
    assert all("15003" not in q and "3º" not in q and not q.lower().startswith("rua") for q in qs)
    qs = G.consultas_cc(G.leer_etiqueta("Avenida da Mariña 6, 15001 A Coruña"), {})
    assert qs[0] == "Mariña 6, A Coruña"
    qs = G.consultas_cc(G.leer_etiqueta("Pza. de Lug0 30, 15003, A Coruña"), {})
    assert "Lugo 30, A Coruña" in qs                               # el error del OCR, corregido como otra forma
    qs = G.consultas_cc(G.leer_etiqueta('Carrer d"Alfons 7, 08001 Barcelona'), {})
    assert all('"' not in q for q in qs) and len(qs) <= 4


def test_el_texto_que_se_ensena():
    c = portal("CASTELO, DO", 27, "27600", "Sarria", 42.77, -7.41, tip="RUA")
    assert G.texto_cc(c) == "Rúa do Castelo 27, 27600 Sarria"
    assert G.texto_cc(c, con_numero=False) == "Rúa do Castelo, 27600 Sarria"
    c = portal("ALFONSO XIII", 615, "08918", "Badalona", 41.44, 2.23, tip="AVINGUDA")
    assert G.texto_cc(c) == "Avinguda Alfonso XIII 615, 08918 Badalona"


# ── el orden de la cadena ─────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_con_el_portal_oficial_seguro_no_se_pregunta_a_nadie_mas():
    real_1 = portal("REAL", 1, "15003", "A Coruña", 43.3712, -8.3990)
    red = Red(find=centro_cp("15003", CORUNA_15003), candidates=lambda q: [real_1] if q["q"] == "REAL 1, A Coruña" else None)
    res, traza = await G.ubicar(red, "RUA REAL Nº 1 3ºB, 15003, A CORUÑA")
    assert res["precision"] == "portal" and res["fuente"] == "cartociudad"
    assert (res["lat"], res["lng"]) == (43.3712, -8.3990) and res["direccion"] == "Calle Real 1, 15003 A Coruña"
    # El centro del CP y la primera consulta, a la vez; y nada más: ni Photon ni Nominatim.
    assert red.clases() == ["find", "candidates"] and red.pedidas[0][1] == {"q": "15003"}
    assert traza["cc_estado"] == "seguro" and traza["candidatos"][0]["precision"] == "portal"


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_portal_oficial_primero_photon_y_luego_nominatim():
    casa = nom(40.4185, -3.7090, "Calle Inventada", 7, "28013", "Madrid")
    red = Red(find=centro_cp("28013", MADRID_28013), reverseGeocode={"muni": "Madrid"}, nominatim=[casa])
    res, _ = await G.ubicar(red, "C/ Inventada Nº 7 2º Izq, 28013 Madrid")
    assert res["precision"] == "portal" and res["fuente"] == "nominatim"
    clases = red.clases()
    assert clases[:2] == ["find", "candidates"] and "reverseGeocode" in clases
    assert clases.index("photon") < clases.index("nominatim")       # Photon antes: Nominatim va a 1 por segundo
    calle = [p for c, p in red.pedidas if c == "nominatim"][0]
    assert calle["street"] == "7 Calle Inventada" and calle["postalcode"] == "28013" and calle["city"] == "Madrid"
    # Con el portal en Photon, a Nominatim ni se le pregunta.
    red = Red(find=centro_cp("28013", MADRID_28013),
              photon={"features": [ph_casa("Calle Inventada", 7, "28013", "Madrid", 40.4185, -3.7090)]})
    res, _ = await G.ubicar(red, "C/ Inventada Nº 7 2º Izq, 28013 Madrid")
    assert res["precision"] == "portal" and res["fuente"] == "photon" and "nominatim" not in red.clases()


@pytest.mark.asyncio(loop_scope="session")
async def test_una_calle_nunca_sale_como_portal():
    # Nominatim da la calle (highway, sin número): es la calle, no la puerta (hoy se guardaba como portal).
    calle = nom(40.4182, -3.7085, "Calle Inventada", None, "28013", "Madrid", clase="highway", tipo="residential")
    res, _ = await G.ubicar(Red(find=centro_cp("28013", MADRID_28013), nominatim=[calle]), "Calle Inventada 7, 28013 Madrid")
    assert res["precision"] == "calle"
    # Una casa con OTRO número de esa calle, tampoco.
    otra = nom(40.4183, -3.7086, "Calle Inventada", 9, "28013", "Madrid")
    res, _ = await G.ubicar(Red(find=centro_cp("28013", MADRID_28013), nominatim=[otra]), "Calle Inventada 7, 28013 Madrid")
    assert res["precision"] == "calle"
    # Ni la calle de Photon.
    calle = ph_calle("Calle Inventada", "28013", "Madrid", 40.4181, -3.7084)
    red = Red(find=centro_cp("28013", MADRID_28013), photon={"features": [calle]})
    res, _ = await G.ubicar(red, "Calle Inventada 7, 28013 Madrid")
    assert res["precision"] == "calle" and res["fuente"] == "photon"
    # El callejero oficial tiene la calle pero no ese número: el portal de número más cercano, como calle.
    red = Red(find=centro_cp("15003", CORUNA_15003),
              candidates=[portal("REAL", 9, "15003", "A Coruña", 43.3715, -8.3995),
                          portal("REAL", 3, "15003", "A Coruña", 43.3713, -8.3991)])
    res, traza = await G.ubicar(red, "Rúa Real 1, 15003 A Coruña")
    assert res["precision"] == "calle" and res["fuente"] == "cartociudad-otro_numero" and res["lat"] == 43.3713
    assert res["direccion"] == "Calle Real, 15003 A Coruña"               # sin el número: no es esa puerta
    assert all(c["precision"] != "portal" for c in traza["candidatos"])


@pytest.mark.asyncio(loop_scope="session")
async def test_lo_de_otro_sitio_no_vale_y_queda_la_zona():
    """El mismo nombre y número en otro pueblo y otro CP a 60 km, una casa de Photon con otro CP lejos y una de
    Nominatim de Portugal: nada de eso es la parada. Queda la zona (el centro del CP), marcada como zona."""
    red = Red(find=lambda q: centro_cp("15003", CORUNA_15003) if q.get("q") == "15003" else None,
              reverseGeocode={"muni": "A Coruña"},
              candidates=[portal("REAL", 1, "27001", "Lugo", 43.0110, -7.5560)],
              photon={"features": [ph_casa("Rúa Real", 1, "15001", "Ferrol", 43.4840, -8.2330)]},
              nominatim=[nom(41.1500, -8.6100, "Rua Real", 1, "15003", "A Coruña", pais="pt")])
    res, traza = await G.ubicar(red, "Rúa Real 1, 15003 A Coruña")
    assert res["precision"] == "zona" and (res["lat"], res["lng"]) == CORUNA_15003 and res["fuente"] == "cartociudad-cp"
    assert res["direccion"] == "15003 A Coruña"
    assert [c["precision"] for c in traza["candidatos"]] == ["zona"]


@pytest.mark.asyncio(loop_scope="session")
async def test_dos_portales_iguales_en_dos_sitios_no_dan_portal_y_se_sugieren_los_dos():
    """«AVENIDA ANCARES 14» está dos veces en el callejero de Vega de Espinareda, a 753 m: no se sabe cuál."""
    a = portal("ANCARES", 14, "24430", "Vega de Espinareda", 42.7250, -6.6550, tip="AVENIDA", ident="a")
    b = portal("ANCARES", 14, "24430", "Vega de Espinareda", 42.7310, -6.6510, tip="AVENIDA", ident="b")
    muni = {"type": "Municipio", "muni": "Vega de Espinareda", "address": "Vega de Espinareda", "lat": 42.7270,
            "lng": -6.6530, "provinceCode": "24"}
    red = Red(candidates=[a, b], find=lambda q: muni if q.get("q") == "Vega de Espinareda" else None)
    res, traza = await G.ubicar(red, "Avenida Ancares 14, Vega de Espinareda")
    assert traza["cc_estado"] == "ambiguo"
    assert res["precision"] == "zona"                                     # el pueblo, no uno de los dos portales
    portales = [c for c in traza["candidatos"] if c["precision"] == "portal"]
    assert len(portales) == 2 and {(c["lat"], c["lng"]) for c in portales} == {(42.7250, -6.6550), (42.7310, -6.6510)}


@pytest.mark.asyncio(loop_scope="session")
async def test_fuera_de_espana_sin_callejero_oficial():
    red = Red(photon={"features": [ph_casa("Rua Augusta", 100, "1100-053", "Lisboa", 38.7100, -9.1370, pais="PT")]})
    res, _ = await G.ubicar(red, "Rua Augusta 100, 1100-053 Lisboa", pais="pt")
    assert res["precision"] == "portal" and res["fuente"] == "photon"
    assert "candidates" not in red.clases() and "find" not in red.clases()
    # Sin portal ni calle, la zona por Nominatim (el CP y la ciudad).
    zona = {"lat": "38.7110", "lon": "-9.1380", "class": "place", "type": "postcode",
            "address": {"postcode": "1100-053", "city": "Lisboa", "country_code": "pt"}}
    red = Red(nominatim=lambda q: [zona] if not q.get("street") else [])
    res, _ = await G.ubicar(red, "Rua Inventada 5, 1100-053 Lisboa", pais="pt")
    assert res["precision"] == "zona" and res["fuente"] == "nominatim-zona"


@pytest.mark.asyncio(loop_scope="session")
async def test_con_cartociudad_caido_la_zona_sale_de_nominatim():
    zona = {"lat": "40.4180", "lon": "-3.7080", "class": "place", "type": "postcode",
            "address": {"postcode": "28013", "city": "Madrid", "country_code": "es"}}
    red = Red(fallan=("cartociudad",), nominatim=lambda q: [zona] if not q.get("street") else [])
    res, traza = await G.ubicar(red, "Calle Inventada 7, 28013 Madrid")
    assert res["precision"] == "zona" and res["fuente"] == "nominatim-zona" and traza["fallos"] >= 1


@pytest.mark.asyncio(loop_scope="session")
async def test_la_posicion_del_movil_valida_pero_no_sale():
    """Sin CP ni pueblo en la etiqueta: lo que esté a 30 km o menos del móvil vale; la posición no se manda a nadie."""
    cerca = (43.3600, -8.4100)
    red = Red(photon={"features": [ph_casa("Calle Inventada", 7, "15004", "A Coruña", 43.3650, -8.4050)]})
    res, _ = await G.ubicar(red, "Calle Inventada 7", cerca=cerca)
    assert res and res["precision"] == "portal"
    assert all("lat" not in p and "viewbox" not in p for c, p in red.pedidas if c in ("photon", "nominatim"))
    # Sin el móvil, la misma casa no se puede dar por buena (podría ser de cualquier pueblo).
    res, _ = await G.ubicar(Red(photon={"features": [ph_casa("Calle Inventada", 7, "15004", "A Coruña", 43.3650, -8.4050)]}),
                            "Calle Inventada 7")
    assert res is None


@pytest.mark.asyncio(loop_scope="session")
async def test_el_punto_de_salida_sale_a_2_decimales():
    """03-11-2026: el punto con el que Photon ordena lo que da (el centro del CP o, sin él, la base) y el centro de la
    caja de Nominatim salen a 2 decimales (unos 1 km), como en las apps («43.37», «-8.40»): la base de quien reparte
    solo puede ser su casa, y para ordenar basta."""
    assert G.punto_de_salida((43.371234, -8.398765)) == ("43.37", "-8.40")
    assert G.punto_de_salida(("40.4180", "-3.7080")) == ("40.42", "-3.71")
    base = (43.371234, -8.398765)
    red = Red()                                     # nadie encuentra nada: pregunta a Photon y a Nominatim
    await G.ubicar(red, "Calle Inventada 7, 15004 A Coruña", base=base)
    photon = [p for c, p in red.pedidas if c == "photon"]
    assert photon and all((p["lat"], p["lon"]) == ("43.37", "-8.40") for p in photon)
    cajas = [p["viewbox"] for c, p in red.pedidas if c == "nominatim" and "viewbox" in p]
    assert cajas and all(v == "-9.00,43.97,-7.80,42.77" for v in cajas)
    # Con el centro del CP, ese, también a 2 decimales.
    red = Red(find=centro_cp("15004", (43.364321, -8.405678)))
    await G.ubicar(red, "Calle Inventada 7, 15004 A Coruña", base=base)
    assert {(p["lat"], p["lon"]) for c, p in red.pedidas if c == "photon"} == {("43.36", "-8.41")}
    # Ni la base ni el centro del CP salen con más decimales a Photon ni a Nominatim.
    for c, p in red.pedidas:
        if c in ("photon", "nominatim"):
            assert "371234" not in str(p) and "398765" not in str(p) and "364321" not in str(p)


# ── la red de verdad: caché, ritmo y corta-circuitos ──────────────────────────

class _Respuesta:
    def __init__(self, estado, js):
        self.status_code, self._js = estado, js

    def json(self):
        return self._js


class _Cliente:
    def __init__(self, responde):
        self.responde, self.llamadas = responde, []

    async def get(self, url, params=None, headers=None):
        self.llamadas.append((url, dict(params or {}), dict(headers or {})))
        r = self.responde(url, params)
        if isinstance(r, Exception):
            raise r
        if asyncio.iscoroutine(r):
            return await r
        return r


class _Reloj:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t

    async def dormir(self, s):
        self.t += s


@pytest.mark.asyncio(loop_scope="session")
async def test_la_red_guarda_lo_ya_pedido_una_hora_y_acotado():
    reloj = _Reloj()
    cli = _Cliente(lambda url, p: _Respuesta(200, [{"lat": 1}]))
    red = G.RedHttp("FDS/1.0 (pruebas)", cache_max=2, cliente=cli, ahora=reloj, dormir=reloj.dormir)
    a = await red.get("cartociudad", G.CC_CAND, {"q": "real 1, a coruña", "limit": 10}, 2.0)
    b = await red.get("cartociudad", G.CC_CAND, {"q": "real 1, a coruña", "limit": 10}, 2.0)
    assert a["status"] == b["status"] == 200 and b["cache"] and len(cli.llamadas) == 1
    reloj.t += 3601                                                   # pasada la hora, se vuelve a pedir
    await red.get("cartociudad", G.CC_CAND, {"q": "real 1, a coruña", "limit": 10}, 2.0)
    assert len(cli.llamadas) == 2
    for q in ("x 1, a", "y 2, b", "z 3, c"):                          # como mucho 2: lo más viejo sale
        await red.get("cartociudad", G.CC_CAND, {"q": q, "limit": 10}, 2.0)
    assert len(red._cache) == 2
    # Lo que falla no se guarda.
    cli2 = _Cliente(lambda url, p: _Respuesta(503, None))
    red2 = G.RedHttp("FDS/1.0 (pruebas)", cliente=cli2, ahora=reloj, dormir=reloj.dormir)
    await red2.get("cartociudad", G.CC_FIND, {"q": "15003"}, 2.0)
    assert not red2._cache


@pytest.mark.asyncio(loop_scope="session")
async def test_nominatim_va_a_uno_por_segundo_para_todos():
    reloj = _Reloj()
    cli = _Cliente(lambda url, p: _Respuesta(200, []))
    red = G.RedHttp("FDS/1.0 (pruebas)", cliente=cli, ahora=reloj, dormir=reloj.dormir)
    t0 = reloj.t
    await red.get("nominatim", G.NOMINATIM, {"q": "uno"}, 3.0, idioma="es")
    await red.get("nominatim", G.NOMINATIM, {"q": "dos"}, 3.0, idioma="es")
    assert reloj.t - t0 >= 1.1 and len(cli.llamadas) == 2
    assert cli.llamadas[0][2] == {"Accept-Language": "es"}
    # Si el turno no cabe en el tope del paso, no se pide (y no se espera).
    r = await red.get("nominatim", G.NOMINATIM, {"q": "tres"}, 0.5)
    assert r["status"] == "tope" and len(cli.llamadas) == 2


@pytest.mark.asyncio(loop_scope="session")
async def test_el_corta_circuitos_salta_el_servicio_que_no_contesta():
    reloj = _Reloj()

    async def colgado():
        await asyncio.sleep(1)
        return _Respuesta(200, {"features": []})
    cli = _Cliente(lambda url, p: colgado() if "photon" in url else _Respuesta(429, None))
    red = G.RedHttp("FDS/1.0 (pruebas)", cliente=cli, ahora=reloj, dormir=reloj.dormir)
    r = await red.get("photon", G.PHOTON, {"q": "a"}, 0.3)
    assert r["status"] == "tope" and len(cli.llamadas) == 1
    r = await red.get("photon", G.PHOTON, {"q": "b"}, 2.5)            # unos minutos sin preguntarle
    assert r["status"] == -2 and len(cli.llamadas) == 1
    reloj.t += 301
    cli.responde = lambda url, p: _Respuesta(200, {"features": []})
    assert (await red.get("photon", G.PHOTON, {"q": "c"}, 2.5))["status"] == 200
    # Nominatim con 429 (nos ha cortado): diez minutos fuera.
    cli.responde = lambda url, p: _Respuesta(429, None)
    await red.get("nominatim", G.NOMINATIM, {"q": "x"}, 3.0)
    assert (await red.get("nominatim", G.NOMINATIM, {"q": "y"}, 3.0))["status"] == -2
    reloj.t += 599
    assert (await red.get("nominatim", G.NOMINATIM, {"q": "y"}, 3.0))["status"] == -2
    # Una consulta mal hecha (400), o el 500 de CartoCiudad con una consulta rara, no es que el servicio esté caído.
    for codigo in (400, 500):
        cli.responde = lambda url, p, c=codigo: _Respuesta(c, None)
        await red.get("cartociudad", G.CC_CAND, {"q": f"a{codigo}"}, 2.0)
        await red.get("cartociudad", G.CC_CAND, {"q": f"b{codigo}"}, 2.0)
        assert red.saltado_hasta["cartociudad"] < reloj.t
    # Que no conteste dos veces seguidas, sí: un minuto sin preguntarle.
    cli.responde = lambda url, p: ConnectionError("sin red")
    await red.get("cartociudad", G.CC_CAND, {"q": "c"}, 2.0)
    await red.get("cartociudad", G.CC_CAND, {"q": "d"}, 2.0)
    assert (await red.get("cartociudad", G.CC_CAND, {"q": "e"}, 2.0))["status"] == -2


# ── el servidor ───────────────────────────────────────────────────────────────

@pytest.fixture
def base(monkeypatch):
    db = Db()
    db["drivers"] = Col([{"id": "d1", "name": "ANA PÉREZ"}, {"id": "d2", "name": "LUIS GÓMEZ"}])

    async def org(_id):
        return {"id": "o1", "account_type": "dsp", "modulos": ["dashboard", "reparto", "configuracion"]}

    async def matriz(puntos):
        seg, met = server.reparto.matriz_en_linea_recta(puntos)
        return seg, met, "linea_recta"
    monkeypatch.setattr(server, "db", db)
    monkeypatch.setattr(server, "global_db", Db())
    monkeypatch.setattr(server, "get_org", org)
    monkeypatch.setattr(server, "_rep_matriz", matriz)
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)
    # La cadena entera, con CartoCiudad también para la empresa de las pruebas: lo que puede cada cuenta y desde cuándo
    # (CARTOCIUDAD_EMPRESAS_DESDE) se prueba aparte, más abajo.
    monkeypatch.setenv("CARTOCIUDAD_EMPRESAS_DESDE", "2000-01-01")
    server._REP_GEO_HECHOS.clear()
    server._REP_CC_CACHE.clear()
    server._public_actions.clear()

    def con_red(red):
        monkeypatch.setattr(server, "_REP_GEO_RED", red)
        return red
    return SimpleNamespace(db=db, con_red=con_red)


def _red_coruna(**extra):
    """El callejero oficial con «Real 1» en 15003 y nada más."""
    return Red(find=lambda q: centro_cp("15003", CORUNA_15003) if q.get("q") == "15003" else None,
               candidates=lambda q: [portal("REAL", 1, "15003", "A Coruña", 43.3712, -8.3990)]
               if q["q"].lower().startswith("real 1") else None,
               reverseGeocode={"muni": "A Coruña"}, **extra)


@pytest.mark.asyncio(loop_scope="session")
async def test_la_zona_se_guarda_aparte_y_sin_lat_lng(base):
    """La app de antes (2.4.4) guía a cualquier lat/lng como si fuera la puerta: con solo la zona, nada en lat/lng."""
    base.con_red(_red_coruna())
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Inventada 5, 15003 A Coruña"}, ANA)
    assert p["geo"] == "zona" and p["lat"] is None and p["lng"] is None
    assert (p["zona_lat"], p["zona_lng"]) == CORUNA_15003
    guardada = base.db["reparto_pedidos"].docs[0]
    assert guardada["lat"] is None and guardada["geo"] == "zona" and guardada["zona_lat"] == CORUNA_15003[0]
    # El portal, en lat/lng como siempre (y sin campos de zona en la parada nueva).
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 1, 15003 A Coruña"}, ANA)
    assert (p["lat"], p["lng"], p["geo"]) == (43.3712, -8.3990, "ok") and "zona_lat" not in p
    assert server._rep_geo_campos((1.0, 2.0, "aprox")) == {"lat": 1.0, "lng": 2.0, "geo": "aprox",
                                                         "zona_lat": None, "zona_lng": None, "geo_incompleta": None}
    assert server._rep_geo_campos(None)["geo"] == "no"


@pytest.mark.asyncio(loop_scope="session")
async def test_lo_ya_buscado_no_se_vuelve_a_pedir(base):
    red = base.con_red(_red_coruna())
    a = await server._rep_ubicar_detalle("Rúa Real 1", "15003", "A Coruña")
    n = len(red.pedidas)
    b = await server._rep_ubicar_detalle("RÚA REAL 1", "15003", "a coruña")      # la misma, escrita de otra forma
    assert a == b and a["precision"] == "portal" and len(red.pedidas) == n
    b["candidatos"].clear()                                                       # lo que sale es una copia
    assert (await server._rep_ubicar_detalle("Rúa Real 1", "15003", "A Coruña"))["candidatos"]
    # Con un servicio caído no se guarda: la próxima vez puede salir mejor.
    red = base.con_red(Red(fallan=("photon",)))
    await server._rep_ubicar_detalle("Calle Inventada 7", "28013", "Madrid")
    n = len(red.pedidas)
    await server._rep_ubicar_detalle("Calle Inventada 7", "28013", "Madrid")
    assert len(red.pedidas) > n


@pytest.mark.asyncio(loop_scope="session")
async def test_ubicar_contesta_sin_guardar_nada(base):
    base.con_red(_red_coruna())
    r = await server.reparto_ubicar({"direccion": "RUA REAL Nº 1 3ºB", "cp": "15003", "localidad": "A CORUÑA"}, ANA)
    assert set(r) == {"encontrada", "lat", "lng", "precision", "direccion", "candidatos", "atribucion"}
    assert r["encontrada"] and r["precision"] == "portal" and (r["lat"], r["lng"]) == (43.3712, -8.3990)
    assert r["direccion"] == "Calle Real 1, 15003 A Coruña"
    assert 1 <= len(r["candidatos"]) <= 6 and set(r["candidatos"][0]) == {"lat", "lng", "precision", "direccion"}
    assert "CartoCiudad" in r["atribucion"] and "IGN" in r["atribucion"]
    assert not base.db["reparto_pedidos"].docs
    # Solo la zona: no se ha encontrado (no vale para ir), pero dice dónde centrar el mapa.
    r = await server.reparto_ubicar({"direccion": "Rúa Inventada 5, 15003 A Coruña"}, ANA)
    assert not r["encontrada"] and r["precision"] == "zona" and (r["lat"], r["lng"]) == CORUNA_15003
    # Nada de nada.
    base.con_red(Red())
    r = await server.reparto_ubicar({"direccion": "Calle Inventada 7"}, ANA)
    assert r == {"encontrada": False, "lat": None, "lng": None, "precision": None, "direccion": None, "candidatos": [],
                 "atribucion": r["atribucion"]} and "OpenStreetMap" in r["atribucion"]


@pytest.mark.asyncio(loop_scope="session")
async def test_ubicar_es_de_quien_reparte_y_con_limite(base):
    base.con_red(Red())
    with pytest.raises(HTTPException) as e:
        await server.reparto_ubicar({"direccion": "Rúa Real 1, A Coruña"}, OFICINA)       # una oficina, no
    assert e.value.status_code == 403
    with pytest.raises(HTTPException) as e:
        await server.reparto_ubicar({"direccion": "x"}, ANA)
    assert e.value.status_code == 400
    for _ in range(39):                                                   # 40 por minuto (con la de arriba)
        await server.reparto_ubicar({"direccion": "Calle Inventada 7"}, ANA)
    with pytest.raises(HTTPException) as e:
        await server.reparto_ubicar({"direccion": "Calle Inventada 7"}, ANA)
    assert e.value.status_code == 429
    await server.reparto_ubicar({"direccion": "Calle Inventada 7"}, LUIS)                 # el límite es de cada uno


async def _parada(db, **campos):
    p = {"id": campos.pop("id", "p1"), "fecha": HOY, "conductor_id": "d1", "estado": "pendiente",
         "direccion": "Rúa Inventada 5, 15003 A Coruña", "cp": "15003", "lat": None, "lng": None, "geo": "zona",
         "zona_lat": CORUNA_15003[0], "zona_lng": CORUNA_15003[1], **campos}
    db["reparto_pedidos"].docs.append(p)
    return p


@pytest.mark.asyncio(loop_scope="session")
async def test_situar_la_parada_con_lat_lng_sin_cambiar_la_direccion(base):
    await _parada(base.db)
    r = await server.reparto_mi_editar("p1", {"lat": 43.3721, "lng": -8.3985, "geo_origen": "mapa"}, ANA)
    assert (r["lat"], r["lng"], r["geo"], r["geo_origen"]) == (43.3721, -8.3985, "manual", "mapa")
    assert r["zona_lat"] is None and r["zona_lng"] is None and r["direccion"] == "Rúa Inventada 5, 15003 A Coruña"
    d = base.db["reparto_pedidos"].docs[0]
    assert d["geo"] == "manual" and d["lat"] == 43.3721 and d["zona_lat"] is None
    # Un origen que no es de los tres no se guarda.
    r = await server.reparto_mi_editar("p1", {"lat": 43.3722, "lng": -8.3986, "geo_origen": "otro"}, ANA)
    assert r["geo_origen"] is None
    for malo, texto in (({"lat": 0, "lng": 0}, "no es válido"), ({"lat": "x", "lng": 1}, "no es válido"),
                        ({"lat": 43.37}, "no es válido"), ({"lat": 19.43, "lng": -99.13}, "fuera de España")):
        with pytest.raises(HTTPException) as e:
            await server.reparto_mi_editar("p1", malo, ANA)
        assert e.value.status_code == 400 and texto in e.value.detail
    assert base.db["reparto_pedidos"].docs[0]["lat"] == 43.3722
    # Una ajena, 403; una cerrada, 409.
    await _parada(base.db, id="p2", conductor_id="d2")
    with pytest.raises(HTTPException) as e:
        await server.reparto_mi_editar("p2", {"lat": 43.37, "lng": -8.40}, ANA)
    assert e.value.status_code == 403
    await _parada(base.db, id="p3", estado="entregado")
    with pytest.raises(HTTPException) as e:
        await server.reparto_mi_editar("p3", {"lat": 43.37, "lng": -8.40}, ANA)
    assert e.value.status_code == 409
    # Un punto a null es que no se manda: la nota de una cerrada se sigue pudiendo cambiar, como siempre.
    r = await server.reparto_mi_editar("p3", {"notas": "portal verde", "lat": None, "lng": None}, ANA)
    assert r["notas"] == "portal verde" and r["lat"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_cambiar_la_direccion_vuelve_a_buscar_y_guarda_la_zona_aparte(base):
    base.con_red(_red_coruna())
    await _parada(base.db, geo="manual", lat=43.30, lng=-8.30, zona_lat=None, zona_lng=None, geo_origen="mapa")
    r = await server.reparto_mi_editar("p1", {"direccion": "Rúa Real 1, 15003 A Coruña"}, ANA)
    assert (r["lat"], r["lng"], r["geo"], r["geo_origen"]) == (43.3712, -8.3990, "ok", None)
    r = await server.reparto_mi_editar("p1", {"direccion": "Rúa Inventada 9, 15003 A Coruña"}, ANA)
    assert r["geo"] == "zona" and r["lat"] is None and r["zona_lat"] == CORUNA_15003[0]


@pytest.mark.asyncio(loop_scope="session")
async def test_el_alta_con_el_punto_elegido(base):
    base.con_red(_red_coruna())
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 1, 15003 A Coruña", "lat": 43.3712, "lng": -8.3990,
                                          "geo_origen": "sugerencia"}, ANA)
    assert (p["geo"], p["geo_origen"]) == ("manual", "sugerencia")
    # El 0,0 o un punto de otro país no se guardan: se busca la dirección como siempre.
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 1, 15003 A Coruña", "lat": 0, "lng": 0}, ANA)
    assert (p["lat"], p["geo"]) == (43.3712, "ok") and "geo_origen" not in p
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 1, 15003 A Coruña", "lat": 19.43, "lng": -99.13,
                                          "geo_origen": "mapa"}, ANA)
    assert (p["lat"], p["geo"]) == (43.3712, "ok") and "geo_origen" not in p


CALLE_ELEGIDA = {"direccion": "Rúa Inventada, 15179 Oleiros", "lat": 43.3500, "lng": -8.3300, "geo_origen": "sugerencia"}


@pytest.mark.asyncio(loop_scope="session")
async def test_la_calle_elegida_en_el_alta_queda_aprox(base):
    """03-11-2026: la sugerencia elegida que es la calle sin el portal (o «Es aquí» en el mapa sin mover la chincheta de
    ella) llega con "precision": "calle" y la parada queda «aprox», con su geo_origen: no es la puerta. Con otra
    precisión o sin ella (la chincheta movida, un portal, la app 2.4.4, que no la manda), «manual» como hasta ahora."""
    red = base.con_red(_red_coruna())
    p = await server.reparto_mis_pedidos({**CALLE_ELEGIDA, "precision": "calle"}, ANA)
    assert (p["lat"], p["lng"], p["geo"], p["geo_origen"]) == (43.35, -8.33, "aprox", "sugerencia")
    assert base.db["reparto_pedidos"].docs[-1]["geo"] == "aprox" and not red.pedidas          # sin buscar nada
    assert (await server.reparto_mis_pedidos({**CALLE_ELEGIDA, "precision": " Calle "}, ANA))["geo"] == "aprox"
    for otra in ("portal", "zona", "", None, 7, True, ["calle"], {"calle": 1}):
        p = await server.reparto_mis_pedidos({**CALLE_ELEGIDA, "precision": otra}, ANA)
        assert (p["geo"], p["geo_origen"]) == ("manual", "sugerencia"), otra
    assert (await server.reparto_mis_pedidos(CALLE_ELEGIDA, ANA))["geo"] == "manual"
    # Sin punto, o con uno que no vale, la precisión no dice nada: se busca la dirección como siempre.
    for sin_punto in ({}, {"lat": 0, "lng": 0, "geo_origen": "sugerencia"}):
        p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 1, 15003 A Coruña", "precision": "calle",
                                              **sin_punto}, ANA)
        assert (p["lat"], p["geo"]) == (43.3712, "ok") and "geo_origen" not in p


@pytest.mark.asyncio(loop_scope="session")
async def test_la_calle_elegida_al_situar_la_parada_queda_aprox(base):
    await _parada(base.db, geo_incompleta=True)
    r = await server.reparto_mi_editar("p1", {"lat": 43.3721, "lng": -8.3985, "geo_origen": "sugerencia",
                                              "precision": "calle"}, ANA)
    assert (r["lat"], r["lng"], r["geo"], r["geo_origen"]) == (43.3721, -8.3985, "aprox", "sugerencia")
    assert r["zona_lat"] is None and r["geo_incompleta"] is None and r["direccion"] == "Rúa Inventada 5, 15003 A Coruña"
    assert base.db["reparto_pedidos"].docs[0]["geo"] == "aprox"
    # La chincheta movida desde ella (sin precisión) o un portal: «manual».
    r = await server.reparto_mi_editar("p1", {"lat": 43.3722, "lng": -8.3986, "geo_origen": "mapa"}, ANA)
    assert (r["geo"], r["geo_origen"]) == ("manual", "mapa")
    r = await server.reparto_mi_editar("p1", {"lat": 43.3723, "lng": -8.3987, "geo_origen": "sugerencia",
                                              "precision": "portal"}, ANA)
    assert (r["geo"], r["lat"]) == ("manual", 43.3723)
    # La precisión sola, sin punto, no cambia nada.
    r = await server.reparto_mi_editar("p1", {"precision": "calle"}, ANA)
    assert (r["geo"], r["lat"]) == ("manual", 43.3723)
    # «Otra calle» elegida: la dirección pasa a ser la de la sugerencia, con su punto y su precisión, sin buscar nada.
    red = base.con_red(_red_coruna())
    r = await server.reparto_mi_editar("p1", {**CALLE_ELEGIDA, "precision": "calle"}, ANA)
    assert (r["direccion"], r["cp"], r["lat"], r["lng"], r["geo"], r["geo_origen"]) == (
        "Rúa Inventada, 15179 Oleiros", "15179", 43.35, -8.33, "aprox", "sugerencia") and not red.pedidas


@pytest.mark.asyncio(loop_scope="session")
async def test_la_oficina_cambia_la_direccion_y_el_punto_ya_no_es_de_la_persona(base):
    """Si la oficina cambia la dirección, se vuelve a buscar (como en reparto_mi_editar) y el geo_origen de la de antes
    no se queda colgado en el punto del buscador. Sin cambiar la dirección, lo que situó la persona se queda."""
    base.con_red(_red_coruna())
    await _parada(base.db, geo="aprox", lat=43.35, lng=-8.33, zona_lat=None, zona_lng=None, geo_origen="sugerencia")
    await _parada(base.db, id="p2", geo="aprox", lat=43.35, lng=-8.33, zona_lat=None, zona_lng=None, geo_origen="mapa")
    r = await server.reparto_editar("p1", {"direccion": "Rúa Real 1, 15003 A Coruña"}, OFICINA)
    assert (r["lat"], r["lng"], r["geo"], r["geo_origen"]) == (43.3712, -8.3990, "ok", None)
    r = await server.reparto_editar("p2", {"direccion": "Rúa Inventada 5, 15003 A Coruña", "notas": "timbre roto",
                                           "conductor_id": "d1"}, OFICINA)
    assert (r["lat"], r["lng"], r["geo"], r["geo_origen"], r["notas"]) == (43.35, -8.33, "aprox", "mapa", "timbre roto")


@pytest.mark.asyncio(loop_scope="session")
async def test_la_ruta_ordena_la_zona_por_su_zona(base):
    """Antes iba al final con las que no tienen sitio; ahora va por donde cae su CP, y sigue sin punto para ir."""
    for pid, lat, lng in (("a", 43.3700, -8.4000), ("c", 43.3900, -8.4000)):
        await _parada(base.db, id=pid, geo="ok", lat=lat, lng=lng, zona_lat=None, zona_lng=None)
    await _parada(base.db, id="z", zona_lat=43.3800, zona_lng=-8.4000)
    await _parada(base.db, id="n", geo="no", zona_lat=None, zona_lng=None)
    ruta = await server._rep_ordenar(HOY, "d1", (43.3600, -8.4000), salida_min=9 * 60)
    orden = {p["id"]: p["orden"] for p in base.db["reparto_pedidos"].docs}
    assert orden == {"a": 1, "z": 2, "c": 3, "n": 4}
    assert ruta["sin_ubicar"] == 2 and ruta["en_zona"] == 1 and ruta["paradas"] == 4
    z = next(p for p in base.db["reparto_pedidos"].docs if p["id"] == "z")
    assert z["eta"] and z["lat"] is None                                  # su hora, pero sin punto para navegar


@pytest.mark.asyncio(loop_scope="session")
async def test_la_cola_de_lo_pegado_no_pisa_lo_situado_a_mano(base, monkeypatch):
    await _parada(base.db, geo="pendiente", zona_lat=None, zona_lng=None)

    async def ubicar(direccion, cp="", localidad="", almacen=None):
        # Mientras se busca, la persona la sitúa en el mapa.
        server.db["reparto_pedidos"].docs[0].update({"geo": "manual", "lat": 43.3712, "lng": -8.3990})
        return (43.0, -8.0, "zona")
    monkeypatch.setattr(server, "_rep_ubicar", ubicar)
    await server._rep_ubicar_pendientes(HOY)
    d = base.db["reparto_pedidos"].docs[0]
    assert (d["geo"], d["lat"]) == ("manual", 43.3712) and d.get("zona_lat") is None


@pytest.mark.asyncio(loop_scope="session")
async def test_el_almacen_no_puede_ser_el_centro_del_cp(base, monkeypatch):
    async def ubicar(direccion, cp="", localidad="", base=None):
        return (43.0, -8.0, "zona")
    monkeypatch.setattr(server, "_rep_ubicar", ubicar)
    with pytest.raises(HTTPException) as e:
        await server.reparto_ajustes_put({"base_direccion": "Polígono Inventado, 15003 A Coruña"}, OFICINA)
    assert e.value.status_code == 400


def test_la_zona_tambien_se_tapa():
    p = R.tapar({"id": "x", "direccion": "Rúa Real 5", "zona_lat": 43.37, "zona_lng": -8.40, "geo": "zona"})
    assert p["zona_lat"] is None and p["zona_lng"] is None and p["geo"] == "zona"


def test_atribucion_de_las_fuentes():
    assert "CartoCiudad" in G.atribucion(["cartociudad-cp"], "es") and "OpenStreetMap" not in G.atribucion(["cartociudad"], "es")
    assert G.atribucion(["photon"], "es") == G.ATRIBUCION_OSM
    assert "CartoCiudad" in G.atribucion([], "es") and "CartoCiudad" not in G.atribucion([], "pt")


def test_punto_valido():
    assert G.punto_valido(43.37, -8.40, "es") == (43.37, -8.40)
    assert G.punto_valido("43.37", "-8.40") == (43.37, -8.40)
    for la, lo in ((0, 0), (None, 1), ("x", 2), (91, 0), (float("nan"), 1), (19.43, -99.13)):
        assert G.punto_valido(la, lo, "es") is None
    assert G.punto_valido(19.43, -99.13, "mx") == (19.43, -99.13)          # sin caja para México: no se mira


# ── la revisión del 02-11-2026 ────────────────────────────────────────────────

NARON_15570 = (43.5050, -8.1900)          # el centro de un CP (inventado)
FERROL_CASA = (43.4840, -8.2330)          # una casa del concello de al lado, a 4 km de ese centro


def _red_naron(**extra):
    return Red(find=lambda q: centro_cp("15570", NARON_15570) if q.get("q") == "15570" else None,
               reverseGeocode={"muni": "Narón"}, **extra)


@pytest.mark.asyncio(loop_scope="session")
async def test_el_mismo_portal_en_el_concello_de_al_lado_no_es_la_parada():
    """S1: «Rúa Nova 5, 15570 Narón» y la «Rúa Nova 5, 15403 Ferrol» de Photon, a 4 km del centro del CP. Antes salía
    como el portal (el atajo de los 6 km) y la app guiaba allí sin avisar; ahora queda la zona, con Ferrol sugerido."""
    red = _red_naron(photon={"features": [ph_casa("Rúa Nova", 5, "15403", "Ferrol", *FERROL_CASA)]})
    res, traza = await G.ubicar(red, "Rúa Nova 5, 15570 Narón")
    assert res["precision"] == "zona" and res["direccion"] == "15570 Narón"
    assert traza["candidatos"][-1] == {"lat": FERROL_CASA[0], "lng": FERROL_CASA[1], "precision": "portal",
                                       "direccion": "Rúa Nova 5, 15403 Ferrol", "fuente": "photon"}
    # Lo mismo si ese portal de Ferrol lo da el callejero oficial (antes «dudoso», y también salía como el portal).
    red = _red_naron(candidates=[portal("NOVA", 5, "15403", "Ferrol", *FERROL_CASA, tip="RUA")])
    res, traza = await G.ubicar(red, "Rúa Nova 5, 15570 Narón")
    assert res["precision"] == "zona" and traza["cc_estado"] is None
    assert [c["direccion"] for c in traza["candidatos"] if c["precision"] == "portal"] == ["Rúa Nova 5, 15403 Ferrol"]
    # Sin pueblo en la etiqueta el atajo sigue: un CP mal escrito suele ser el de al lado.
    red = _red_naron(photon={"features": [ph_casa("Rúa Nova", 5, "15403", "Ferrol", *FERROL_CASA)]})
    res, _ = await G.ubicar(red, "Rúa Nova 5, 15570")
    assert res["precision"] == "portal" and res["fuente"] == "photon"


@pytest.mark.asyncio(loop_scope="session")
async def test_el_pueblo_que_es_la_propia_calle_no_cuenta_y_la_parroquia_con_su_concello_si():
    """«O Toural nº 34, 36141, O Toural»: el pueblo es el lugar mismo y no dice de qué concello es (como si no lo
    trajera); la casa de Photon en Vilaboa, con el CP de al lado y a 500 m del centro del suyo, vale como antes. Y el
    «Biduído - Ames» de Photon (la parroquia y el concello) es Ames, aunque caiga lejos del centro del CP."""
    red = Red(find=lambda q: centro_cp("36141", (42.3600, -8.6400)) if q.get("q") == "36141" else None,
              photon={"features": [ph_casa("O Toural", 34, "36140", "Vilaboa", 42.3620, -8.6450)]})
    res, _ = await G.ubicar(red, "O Toural nº 34, 36141, O Toural")
    assert res["precision"] == "portal" and res["fuente"] == "photon"
    red = Red(find=lambda q: centro_cp("15896", (42.9500, -8.6500)) if q.get("q") == "15896" else None,
              photon={"features": [ph_casa("A Igrexa", 2, "15895", "Biduído - Ames", 42.8500, -8.6500)]})
    res, _ = await G.ubicar(red, "A Igrexa 2, 15896, Ames")
    assert res["precision"] == "portal" and (res["lat"], res["lng"]) == (42.8500, -8.6500)


@pytest.mark.asyncio(loop_scope="session")
async def test_travesa_es_un_tipo_de_via_tambien_al_comparar():
    """«Travesa» (travesía, en gallego) no se quitaba al comparar nombres: sin CartoCiudad, la casa de «Travesa de Vista
    Alegre 46» perdía frente a la de «Rúa de Vista Alegre 46», a 550 m (el laboratorio, 02-11-2026)."""
    assert G.nucleo("Travesa de Vista Alegre") == G.nucleo("Rúa de Vista Alegre") == "vista alegre"
    buena = ph_casa("Travesa de Vista Alegre", 46, "15705", "Santiago de Compostela", 42.894958, -8.547894)
    otra = ph_casa("Rúa de Vista Alegre", 46, "15705", "Santiago de Compostela", 42.889067, -8.546783)
    red = Red(photon={"features": [buena, otra]})
    res, _ = await G.ubicar(red, "Travesa de Vista A1egre 46 1º, 15705, Santiago de Compostela", opciones={"cc": False})
    assert res["precision"] == "portal" and (res["lat"], res["lng"]) == (42.894958, -8.547894)


@pytest.mark.asyncio(loop_scope="session")
async def test_un_portal_de_osm_lejos_del_tramo_oficial_no_se_cree():
    """S1: CartoCiudad da la calle como tramo (sin portales: lat/lng 0,0) y Photon un portal de ese pueblo a 3 km de
    ella: no es ese portal, se queda la calle oficial. Cuenta la distancia a su TRAZADO, no a su punto: en una calle
    larga, el portal de una punta queda lejos del punto y cerca de la calle, y vale."""
    tramo = {"id": "cj-nova", "type": "callejero", "address": "RUA NOVA, Narón", "postalCode": "15570", "muni": "Narón",
             "poblacion": "Narón", "tip_via": "RUA", "lat": 0, "lng": 0, "provinceCode": "15", "state": 0}
    linea = "MULTILINESTRING((-8.2200 43.5000,-8.1950 43.5000),(-8.1950 43.5000,-8.1710 43.5000))"   # 4 km

    def find(q):
        if q.get("q") == "15570":
            return centro_cp("15570", NARON_15570)
        if q.get("id") == "cj-nova":
            return {**tramo, "lat": 43.5000, "lng": -8.1955, "geom": linea}
        return None

    def red(casa):
        return Red(find=find, reverseGeocode={"muni": "Narón"}, candidates=[tramo], photon={"features": [casa]})
    r = red(ph_casa("Rúa Nova", 5, "15570", "Narón", 43.5270, -8.1955))           # a 3 km de la calle
    res, traza = await G.ubicar(r, "Rúa Nova 5, 15570 Narón")
    assert traza.get("portal_osm_descartado") and res["precision"] == "calle"
    assert res["fuente"] == "cartociudad-callejero" and (res["lat"], res["lng"]) == (43.5000, -8.1955)
    assert len([p for c, p in r.pedidas if c == "find" and p.get("id")]) == 1        # el tramo, pedido una vez
    r = red(ph_casa("Rúa Nova", 5, "15570", "Narón", 43.5002, -8.2180))           # a 1,8 km del punto, 20 m de la calle
    res, traza = await G.ubicar(r, "Rúa Nova 5, 15570 Narón")
    assert res["precision"] == "portal" and res["fuente"] == "photon" and not traza.get("portal_osm_descartado")


def test_la_red_guarda_el_trazado_de_las_calles_y_no_el_de_los_pueblos():
    calle = G._recorta({"id": "c", "lat": 43.5, "lng": -8.19, "geom": "LINESTRING(-8.20 43.50,-8.19 43.50,-8.18 43.51)"})
    assert "geom" not in calle and calle["linea"] == [[[43.5, -8.2], [43.5, -8.19], [43.51, -8.18]]]
    assert G.a_la_calle((43.5009, -8.195), calle) < 120             # a 100 m del tramo y a 400 m de cada vértice
    pueblo = G._recorta({"id": "p", "lat": 43.5, "lng": -8.19,
                         "geom": "MULTIPOLYGON(((-8.2 43.5,-8.1 43.5,-8.1 43.6,-8.2 43.5)))"})
    assert pueblo == {"id": "p", "lat": 43.5, "lng": -8.19}
    largo = "LINESTRING(" + ",".join(f"{-8.3 + i * 0.0001:.4f} 43.5" for i in range(2000)) + ")"
    partes = G._partes_wkt(largo)                                   # aligerado, sin perder las puntas
    assert sum(len(x) for x in partes) <= 401 and partes[0][0] == (43.5, -8.3) and partes[0][-1] == (43.5, -8.1001)


def test_cartociudad_ya_para_quien_reparte_solo_y_para_las_empresas_desde_la_fecha(monkeypatch):
    """S3: el Encargo con las empresas pide avisarles 15 días antes de recurrir a un subencargado nuevo. La fecha, puesta
    a mano (la que haría falta con una empresa de fuera): sin ponerla ya vale para todas (la prueba de más abajo)."""
    autonomo = {"id": "a", "plan": "autonomo", "sector": "autonomo"}
    empresa = {"id": "e", "plan": "completo", "sector": "paqueteria"}
    monkeypatch.setenv("CARTOCIUDAD_EMPRESAS_DESDE", "2026-11-17")
    assert server._cc_empresas_desde() == "2026-11-17"
    assert server._cc_permitido(autonomo, hoy="2026-11-02")
    assert not server._cc_permitido(empresa, hoy="2026-11-16") and server._cc_permitido(empresa, hoy="2026-11-17")
    assert not server._cc_permitido(None, hoy="2026-11-16")             # sin saber la cuenta, como una empresa
    monkeypatch.setenv("CARTOCIUDAD_EMPRESAS_DESDE", "2026-12-01")       # el aviso salió más tarde
    assert not server._cc_permitido(empresa, hoy="2026-11-20") and server._cc_permitido(empresa, hoy="2026-12-01")
    monkeypatch.setenv("CARTOCIUDAD_EMPRESAS_DESDE", "1-12-2026")        # mal escrita: no adelanta nada
    assert not server._cc_permitido(empresa, hoy="2099-01-01") and server._cc_permitido(autonomo, hoy="2026-11-02")


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_cartociudad_no_se_le_pregunta_nada():
    """S3: con {"cc": False} ni la calle, ni el centro del CP y su municipio, ni el pueblo de la zona; la zona sale de
    Nominatim y la atribución no cita a CartoCiudad."""
    zona = {"lat": "40.4180", "lon": "-3.7080", "class": "place", "type": "postcode",
            "address": {"postcode": "28013", "city": "Madrid", "country_code": "es"}}
    red = Red(find=centro_cp("28013", MADRID_28013), reverseGeocode={"muni": "Madrid"},
              candidates=[portal("INVENTADA", 7, "28013", "Madrid", 40.4185, -3.7090)],
              nominatim=lambda q: [zona] if not q.get("street") else [])
    res, traza = await G.ubicar(red, "Calle Inventada 7, 28013 Madrid", opciones={"cc": False})
    assert set(red.clases()) <= {"photon", "nominatim"}
    assert res["precision"] == "zona" and res["fuente"] == "nominatim-zona" and not traza["incompleta"]
    assert "CartoCiudad" not in G.atribucion([], "es", cc=False) and "CartoCiudad" in G.atribucion([], "es")


@pytest.mark.asyncio(loop_scope="session")
async def test_la_empresa_no_va_a_cartociudad_hasta_la_fecha_y_quien_reparte_solo_ya(base, monkeypatch):
    cuentas = {"o1": {"id": "o1", "account_type": "dsp", "plan": "completo", "sector": "paqueteria"},
               "o2": {"id": "o2", "account_type": "dsp", "plan": "autonomo", "sector": "autonomo"}}

    async def org(_id):
        return cuentas.get(_id)
    monkeypatch.setattr(server, "get_org", org)
    monkeypatch.setenv("CARTOCIUDAD_EMPRESAS_DESDE", "2099-01-01")
    red = base.con_red(_red_coruna())
    t = server._rep_org_actual.set("o1")
    try:
        r = await server._rep_ubicar_detalle("Rúa Real 1", "15003", "A Coruña")
        assert not r["cc"] and not set(red.clases()) & {"candidates", "find", "reverseGeocode"}
        assert "CartoCiudad" not in (await server.reparto_ubicar({"direccion": "Calle Inventada 7"}, ANA))["atribucion"]
    finally:
        server._rep_org_actual.reset(t)
    # Quien reparte solo, ya; y lo que se buscó sin CartoCiudad no le sale de la caché.
    t = server._rep_org_actual.set("o2")
    try:
        n = len(red.pedidas)
        r = await server._rep_ubicar_detalle("Rúa Real 1", "15003", "A Coruña")
        assert r["cc"] and (r["precision"], r["fuente"]) == ("portal", "cartociudad") and "candidates" in red.clases()[n:]
    finally:
        server._rep_org_actual.reset(t)


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_poner_la_fecha_la_empresa_ya_va_a_cartociudad(base, monkeypatch):
    """03-11-2026, Dani, sobre si había empresas de fuera: «Solo las mías». Todas las cuentas de empresa son suyas y no
    hay a quién avisar: sin CARTOCIUDAD_EMPRESAS_DESDE, una empresa ya usa CartoCiudad (desde el 02-11-2026)."""
    monkeypatch.delenv("CARTOCIUDAD_EMPRESAS_DESDE", raising=False)
    empresa = {"id": "o1", "account_type": "dsp", "plan": "completo", "sector": "paqueteria"}
    assert server._cc_empresas_desde() == "2026-11-02"
    assert server._cc_permitido(empresa, hoy="2026-11-03") and server._cc_permitido(None, hoy="2026-11-03")
    assert server._cc_permitido(empresa)                                  # hoy, en la hora de Madrid

    async def org(_id):
        return empresa
    monkeypatch.setattr(server, "get_org", org)
    red = base.con_red(_red_coruna())
    t = server._rep_org_actual.set("o1")
    try:
        r = await server._rep_ubicar_detalle("Rúa Real 1", "15003", "A Coruña")
        assert r["cc"] and (r["precision"], r["fuente"]) == ("portal", "cartociudad") and "candidates" in red.clases()
        assert "CartoCiudad" in (await server.reparto_ubicar({"direccion": "Calle Inventada 7"}, ANA))["atribucion"]
    finally:
        server._rep_org_actual.reset(t)


@pytest.mark.asyncio(loop_scope="session")
async def test_cada_peticion_del_reparto_lleva_su_cuenta(base, monkeypatch):
    from fastapi.security import HTTPAuthorizationCredentials

    async def ficha(sub):
        return sub
    monkeypatch.setattr(server, "_ficha_activa_de", ficha)
    server._REGION_CACHE.clear()
    cred = HTTPAuthorizationCredentials(scheme="Bearer", credentials=server.create_token(
        "d1", "driver", "ANA", org_id="o1", db_name="dsp_x", account_type="dsp"))

    async def cuenta_de(ruta):
        async def dentro():
            await server.get_current_user(SimpleNamespace(method="POST", url=SimpleNamespace(path=ruta), headers={},
                                                          client=None), cred)
            return server._rep_org_actual.get()
        return await asyncio.get_running_loop().create_task(dentro(), context=server.contextvars.copy_context())
    assert await cuenta_de("/api/reparto/ubicar") == "o1"
    assert await cuenta_de("/api/vehicles") == ""


class _RedLenta(Red):
    """La red de mentira con el reloj de mentira: cada clase de petición tarda lo que diga `lat` (S4)."""

    def __init__(self, reloj, lat, **respuestas):
        super().__init__(**respuestas)
        self.reloj, self.lat = reloj, lat

    async def get(self, srv, url, params, tope, idioma=None):
        clase = url.rsplit("/", 1)[-1] if srv == "cartociudad" else srv
        tarda = self.lat.get(clase, 0.0)
        self.reloj.t += min(float(tope), tarda)
        if tarda > float(tope):
            self.pedidas.append((clase, dict(params)))
            return {"status": "tope", "json": None}
        return await super().get(srv, url, params, tope, idioma)


CASA_MADRID = nom(40.4185, -3.7090, "Calle Inventada", 7, "28013", "Madrid")


def _red_madrid(reloj=None, lento=0.0):
    respuestas = dict(find=lambda q: centro_cp("28013", MADRID_28013) if q.get("q") == "28013" else None,
                      reverseGeocode={"muni": "Madrid"}, nominatim=[CASA_MADRID])
    if reloj is None:
        return Red(**respuestas)
    return _RedLenta(reloj, {"find": lento / 2, "candidates": lento, "reverseGeocode": lento, "photon": 0.4,
                             "nominatim": 0.4}, **respuestas)


@pytest.mark.asyncio(loop_scope="session")
async def test_una_busqueda_cortada_por_tiempo_es_incompleta_no_se_guarda_y_se_repite_al_ordenar(base, monkeypatch):
    """S4: con CartoCiudad lento (1,7 s cada vez, dentro de su tope de 2 s) Nominatim no cabe en los 8 s. Antes se
    saltaba sin contarlo: «zona» con 0 fallos, guardada una hora y sin volver a buscarla, aunque Nominatim tuviera el
    portal."""
    reloj = _Reloj()
    res, traza = await G.ubicar(_red_madrid(reloj, 1.7), "C/ Inventada Nº 7 2º Izq, 28013 Madrid",
                                reloj=G.Reloj(ahora=reloj))
    assert res["precision"] == "zona" and traza["fallos"] == 0
    assert traza["incompleta"] and "nominatim" in traza["saltados"]
    # En el servidor no se guarda como lo definitivo, y la parada lleva la marca.
    real = G.ubicar

    async def lenta(_red, *a, **k):
        r = _Reloj()
        return await real(_red_madrid(r, 1.7), *a, **{**k, "reloj": G.Reloj(ahora=r)})
    monkeypatch.setattr(server.geocodificador, "ubicar", lenta)
    base.con_red(Red())
    p = await server.reparto_mis_pedidos({"direccion": "C/ Inventada Nº 7 2º Izq, 28013 Madrid"}, ANA)
    assert (p["geo"], p["geo_incompleta"]) == ("zona", True) and not server._REP_GEO_HECHOS
    # Antes de ordenar se vuelve a buscar (ya con la red bien) y sale el portal.
    monkeypatch.setattr(server.geocodificador, "ubicar", real)
    base.con_red(_red_madrid())
    await server.reparto_mi_ordenar({"lat": 40.41, "lng": -3.70}, ANA)
    d = base.db["reparto_pedidos"].docs[0]
    assert (d["geo"], d["lat"], d["lng"], d["geo_incompleta"]) == ("ok", 40.4185, -3.7090, None)


@pytest.mark.asyncio(loop_scope="session")
async def test_antes_de_ordenar_solo_se_repite_la_zona_de_una_busqueda_incompleta(base, monkeypatch):
    await _parada(base.db, id="z1")                                   # la zona de una búsqueda completa: no
    await _parada(base.db, id="z2", geo_incompleta=True)
    buscadas = []

    async def ubicar(direccion, cp="", localidad="", almacen=None, cerca=None):
        buscadas.append(direccion)
        return (43.3712, -8.3990)
    monkeypatch.setattr(server, "_rep_ubicar", ubicar)
    await server.reparto_mi_ordenar({"lat": 43.36, "lng": -8.40}, ANA)
    z = {p["id"]: p for p in base.db["reparto_pedidos"].docs}
    assert len(buscadas) == 1 and (z["z2"]["geo"], z["z2"]["geo_incompleta"]) == ("ok", None) and z["z1"]["geo"] == "zona"
    # Situarla a mano también quita la marca.
    await _parada(base.db, id="z3", geo_incompleta=True)
    r = await server.reparto_mi_editar("z3", {"lat": 43.3721, "lng": -8.3985, "geo_origen": "mapa"}, ANA)
    assert r["geo"] == "manual" and r["geo_incompleta"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_ninguna_busqueda_automatica_pisa_la_calle_que_eligio_la_persona(base, monkeypatch):
    """03-11-2026: la calle elegida a mano («aprox» con geo_origen) lleva lat/lng: ni el último intento antes de ordenar
    ni la cola de lo pegado la vuelven a buscar; solo la zona de una búsqueda incompleta, como siempre."""
    await _parada(base.db, id="a1", direccion="Rúa Inventada Longa 23, 15011 A Coruña", geo="aprox", lat=43.35,
                  lng=-8.33, zona_lat=None, zona_lng=None, geo_origen="sugerencia")
    await _parada(base.db, id="z2", geo_incompleta=True)
    buscadas = []

    async def ubicar(direccion, cp="", localidad="", almacen=None, cerca=None):
        buscadas.append(direccion)
        return (43.3712, -8.3990)
    monkeypatch.setattr(server, "_rep_ubicar", ubicar)
    await server.reparto_mi_ordenar({"lat": 43.36, "lng": -8.40}, ANA)
    await server._rep_ubicar_pendientes(HOY)
    z = {p["id"]: p for p in base.db["reparto_pedidos"].docs}
    assert buscadas == ["Rúa Inventada 5, 15003 A Coruña"] and z["z2"]["geo"] == "ok"
    assert (z["a1"]["geo"], z["a1"]["lat"], z["a1"]["lng"], z["a1"]["geo_origen"]) == ("aprox", 43.35, -8.33, "sugerencia")


@pytest.mark.asyncio(loop_scope="session")
async def test_la_calle_elegida_mientras_se_busca_no_se_pisa(base, monkeypatch):
    """Y si la persona elige la calle mientras el último intento antes de ordenar aún la está buscando, se queda la suya."""
    await _parada(base.db, id="z1", geo_incompleta=True)

    async def ubicar(direccion, cp="", localidad="", almacen=None, cerca=None):
        await server.reparto_mi_editar("z1", {"lat": 43.35, "lng": -8.33, "geo_origen": "sugerencia",
                                              "precision": "calle"}, ANA)
        return (43.3712, -8.3990)
    monkeypatch.setattr(server, "_rep_ubicar", ubicar)
    await server.reparto_mi_ordenar({"lat": 43.36, "lng": -8.40}, ANA)
    d = base.db["reparto_pedidos"].docs[0]
    assert (d["geo"], d["lat"], d["lng"], d["geo_origen"], d["zona_lat"]) == ("aprox", 43.35, -8.33, "sugerencia", None)


@pytest.mark.asyncio(loop_scope="session")
async def test_navegar_a_una_parada_sin_punto_pide_situarla(base):
    """S6: ya no manda a Google Maps; las apps abren «Situar la parada» (el texto, traducido en textosRutaC.js)."""
    await _parada(base.db)
    with pytest.raises(HTTPException) as e:
        await server.reparto_mi_navegar({"id": "p1", "desde": {"lat": 43.36, "lng": -8.40}}, ANA)
    assert e.value.status_code == 400 and e.value.detail == "Esta parada no está situada en el mapa: sitúala antes de ir."


@pytest.mark.asyncio(loop_scope="session")
async def test_la_direccion_se_lee_como_la_cadena_antes_de_buscar(base):
    """«An der Alster 12» sola: reparto.direccion_para_buscar la dejaba en «An» (2 letras) y volvía sin buscar."""
    red = base.con_red(Red())
    t = server._region_actual.set(("de", "Europe/Berlin"))
    try:
        await server._rep_ubicar_detalle("An der Alster 12")
    finally:
        server._region_actual.reset(t)
    assert "photon" in red.clases()
    assert G.consulta_texto(G.leer_etiqueta("RUA REAL Nº 1 3ºB, 15003, A CORUÑA")) == "RUA REAL 1, 15003 A CORUÑA"
    assert G.consulta_texto(G.leer_etiqueta("10 Downing Street, London", pais="gb"), "gb") == "10 Downing Street, London"


# ── la provincia con el CP de otro municipio (03-11-2026, la quinta tanda) ──────────────────────────────────────────
# Como las apps (lib/situar.js y ui/hoy/Situar.kt): en España, el nombre de una provincia que se llama como su capital
# cuenta como el pueblo (la capital) solo con un CP de la capital (su tercera cifra es 0) o sin CP; con el de otro
# municipio es la provincia. «Rúa Rosalía de Castro 5, 15179 A Coruña» es de Oleiros, y CartoCiudad daba como su portal
# el de la ciudad (15004), a 8 km, por ser «el mismo pueblo» («dudoso»): el punto de otro sitio sin que nadie eligiera.

OLEIROS_15179 = (43.3412, -8.3150)          # el centro de un CP (inventado, en Oleiros)
ROSALIA_CIUDAD = (43.3655, -8.4045)         # «Rúa Rosalía de Castro 5, 15004 A Coruña», a unos 8 km
MAJADAHONDA_28220 = (40.4730, -3.8720)      # el centro de un CP (inventado, en Majadahonda), a 15 km de Madrid


def test_la_provincia_con_el_cp_de_otro_municipio_no_es_el_pueblo():
    def lee(direccion, cp="", loc=""):
        p = G.leer_etiqueta(direccion, cp, loc)
        return p["loc"], p["localidades"]
    # Con el CP de otro municipio, la provincia: ningún pueblo, o el escrito si lo hay.
    assert lee("Rúa Rosalía de Castro 5, 15179 A Coruña") == ("", [])
    assert lee("Rúa Rosalía de Castro 5", "15179", "A Coruña") == ("", [])         # la población guardada
    assert lee("Rúa Rosalía de Castro 5, 15179 Oleiros", "", "A Coruña") == ("Oleiros", ["Oleiros"])
    assert lee("Rúa Brétema 23, 15179, A Coruña") == ("", [])
    assert lee("Calle Mayor 5, 28220 Madrid") == ("", [])                           # Majadahonda
    assert lee("Calle Real 1 A Coruña", "15179") == ("", [])
    assert G.leer_etiqueta("Rúa Rosalía de Castro 5, 15179 A Coruña")["provincia"] == "A Coruña"   # aparte
    # Con un CP de la capital, o sin CP, la capital, como antes.
    assert lee("Rúa Rosalía de Castro, 15004 A Coruña") == ("A Coruña", ["A Coruña"])
    assert lee("Avenida de Finisterre 120, 15004 A Coruña") == ("A Coruña", ["A Coruña"])
    assert lee("Rúa Real 5, A Coruña") == ("A Coruña", ["A Coruña"])
    assert lee("Calle Mayor 5, 28013 Madrid") == ("Madrid", ["Madrid"])
    assert lee("Calle Fernando Macías N.º 4, 15004, CORUÑA (A)")[0] == "CORUÑA"
    # El país y las que no se llaman como ningún pueblo, nunca; la provincia detrás del pueblo sigue sobrando.
    p = G.leer_etiqueta("Calle Real 5, 27002 Lugo, España")
    assert (p["loc"], p["localidades"], p["otros"]) == ("Lugo", ["Lugo"], [])
    assert all("España" not in q for q in G.consultas_cc(G.leer_etiqueta("Rúa Real 5, 15003 A Coruña, España"), {}))
    assert lee("Calle Mayor 5, España") == ("", []) and lee("Calle Real 5", "", "Galicia") == ("", [])
    assert lee("Avenida de Galicia s/n, 15620, Mugardos (A Coruña)") == ("Mugardos", ["Mugardos"])
    assert lee("Rúa do Río, 19, Baixo, 15160, Sada Coruña") == ("Sada", ["Sada"])
    assert all(G.es_pueblo(x, cp) for x, cp in (("Oleiros", "15179"), ("A Coruña", "15004"), ("La Coruña", ""),
                                                ("Madrid", "28080"), ("Lugo", "27004"), ("Castelló", "12005")))
    assert not any(G.es_pueblo(x, cp) for x, cp in (("A Coruña", "15179"), ("Coruña", "15179"), ("Lugo", "27191"),
                                                    ("Madrid", "28220"), ("España", ""), ("Spain", "28013"),
                                                    ("Asturias", ""), ("Bizkaia", "48001")))
    # Fuera de España, como siempre.
    assert G.es_pueblo("Madrid", "28220", pais="pt")
    assert G.leer_etiqueta("Rua Augusta 100, 1100-053 Lisboa", pais="pt")["loc"] == "Lisboa"


def _red_oleiros(**extra):
    return Red(find=lambda q: centro_cp("15179", OLEIROS_15179) if q.get("q") == "15179" else None,
               reverseGeocode={"muni": "Oleiros"}, **extra)


@pytest.mark.asyncio(loop_scope="session")
async def test_el_portal_de_la_ciudad_no_es_el_de_otro_municipio_con_el_nombre_de_la_provincia():
    """Lo escrito «…, 15179 A Coruña», con la población guardada «A Coruña» o con «España» detrás: se le pregunta al
    callejero en Oleiros (el municipio del CP) y el portal de la ciudad no es el de la parada, ni el de CartoCiudad ni la
    casa de Photon. Con el de Oleiros, ese; con el CP de la ciudad, el de la ciudad, como siempre."""
    ciudad = portal("ROSALIA DE CASTRO", 5, "15004", "A Coruña", *ROSALIA_CIUDAD, tip="RUA")
    casa = ph_casa("Rúa Rosalía de Castro", 5, "15004", "A Coruña", *ROSALIA_CIUDAD)
    for direccion, cp, loc in (("Rúa Rosalía de Castro 5, 15179 A Coruña", "", ""),
                               ("Rúa Rosalía de Castro 5", "15179", "A Coruña"),
                               ("Rúa Rosalía de Castro 5, 15179, A Coruña, España", "", "")):
        red = _red_oleiros(candidates=lambda q: [ciudad] if "coru" in q["q"].lower() else None,
                           photon={"features": [casa]})
        res, traza = await G.ubicar(red, direccion, cp, loc)
        assert res["precision"] == "zona" and (res["lat"], res["lng"]) == OLEIROS_15179, direccion
        assert res["direccion"] == "15179 A Coruña"                                  # el texto, como antes
        assert traza["cc_consultas"] and all("Oleiros" in q for q in traza["cc_consultas"]), traza["cc_consultas"]
        assert all(c["precision"] != "portal" for c in traza["candidatos"])
    # A 6 km o menos del centro del CP, la de la ciudad tampoco es la parada (antes, «el mismo pueblo»): como con
    # pueblo, el concello de al lado solo se sugiere.
    cerca = portal("INVENTADA", 9, "15003", "A Coruña", 43.3550, -8.3600)          # a unos 4 km del centro del 15179
    red = _red_oleiros(candidates=[cerca])
    res, traza = await G.ubicar(red, "Rúa Inventada 9, 15179 A Coruña")
    assert res["precision"] == "zona" and (res["lat"], res["lng"]) == OLEIROS_15179
    assert traza["candidatos"][-1]["direccion"] == "Calle Inventada 9, 15003 A Coruña"   # sugerida, al final
    suyo = portal("ROSALIA DE CASTRO", 5, "15179", "Oleiros", 43.3420, -8.3160, tip="RUA")
    red = _red_oleiros(candidates=lambda q: [suyo] if "oleiros" in q["q"].lower() else [ciudad])
    res, traza = await G.ubicar(red, "Rúa Rosalía de Castro 5, 15179 A Coruña")
    assert res["precision"] == "portal" and (res["lat"], res["lng"]) == (43.3420, -8.3160)
    assert traza["cc_estado"] == "seguro"
    red = Red(find=lambda q: centro_cp("15004", (43.3660, -8.4050)) if q.get("q") == "15004" else None,
              candidates=[ciudad])
    res, traza = await G.ubicar(red, "Rúa Rosalía de Castro 5, 15004 A Coruña")
    assert res["precision"] == "portal" and (res["lat"], res["lng"]) == ROSALIA_CIUDAD and traza["cc_estado"] == "seguro"


@pytest.mark.asyncio(loop_scope="session")
async def test_con_un_pueblo_escrito_la_provincia_sobra_como_antes():
    """Con un pueblo (aunque sea el que se llama como la propia vía), la provincia sigue sobrando y no cambia nada: la
    casa de Photon en Vilaboa, con el CP de al lado y a 500 m del centro del suyo, vale como sin la provincia."""
    p = G.leer_etiqueta("O Toural nº 34, 36141, O Toural, Pontevedra")
    assert (p["localidades"], p["provincia"]) == (["O Toural"], "")
    red = Red(find=lambda q: centro_cp("36141", (42.3600, -8.6400)) if q.get("q") == "36141" else None,
              photon={"features": [ph_casa("O Toural", 34, "36140", "Vilaboa", 42.3620, -8.6450)]})
    res, _ = await G.ubicar(red, "O Toural nº 34, 36141, O Toural, Pontevedra")
    assert res["precision"] == "portal" and res["fuente"] == "photon"


@pytest.mark.asyncio(loop_scope="session")
async def test_madrid_con_el_cp_de_majadahonda_no_es_madrid():
    """«Calle Mayor 5, 28220 Madrid» (el 28220 es de Majadahonda): salía el portal de Madrid (28013), a 15 km, y sin él
    la zona era el centro de Madrid («el CP está mal» si el pueblo cae lejos de su centro). Ahora se pregunta en
    Majadahonda y la zona es la del CP. Con el CP de Madrid, Madrid, como siempre."""
    mayor_5 = portal("MAYOR", 5, "28013", "Madrid", 40.4155, -3.7074)
    madrid = {"type": "Municipio", "muni": "Madrid", "address": "Madrid", "lat": 40.4168, "lng": -3.7038,
              "provinceCode": "28"}
    red = Red(find=lambda q: {"28220": centro_cp("28220", MAJADAHONDA_28220), "Madrid": madrid}.get(q.get("q")),
              reverseGeocode={"muni": "Majadahonda"},
              candidates=lambda q: [mayor_5] if "madrid" in q["q"].lower() else None)
    res, traza = await G.ubicar(red, "Calle Mayor 5, 28220 Madrid")
    assert res["precision"] == "zona" and (res["lat"], res["lng"]) == MAJADAHONDA_28220
    assert traza["cc_consultas"] and all("Majadahonda" in q for q in traza["cc_consultas"])
    red = Red(find=lambda q: centro_cp("28013", MADRID_28013) if q.get("q") == "28013" else None, candidates=[mayor_5])
    res, _ = await G.ubicar(red, "Calle Mayor 5, 28013 Madrid")
    assert res["precision"] == "portal" and (res["lat"], res["lng"]) == (40.4155, -3.7074)


# ── todas las provincias (03-11-2026, la sexta tanda) ───────────────────────────────────────────────────────────────
# PROVINCIAS solo traía unas 20 (como las apps): con las demás, la provincia escrita detrás del pueblo contaba como otro
# pueblo, y «Calle Mayor 5, 30800 Lorca, Murcia» se daba por el mismo sitio que el portal de la ciudad de Murcia, a 60
# km (lugar_nivel 2): salía como su portal. Ahora están todas las que se llaman como su capital, también en las otras
# lenguas (la capital solo con su CP o sin CP), y en NO_PUEBLO las que no son ningún pueblo, las comunidades y el país.

LORCA_30800 = (37.6710, -1.7017)            # el centro de un CP (inventado, en Lorca), a unos 60 km de Murcia
MURCIA_MAYOR_5 = (37.9840, -1.1280)


def test_todas_las_provincias_cuentan_como_provincia():
    def lee(direccion, cp="", loc="", pais="es"):
        p = G.leer_etiqueta(direccion, cp, loc, pais)
        return p["loc"], p["localidades"], p["provincia"]
    # Detrás del pueblo, sobra; también las de dos palabras o más, y escritas junto al pueblo.
    assert lee("Calle Mayor 5, 30800 Lorca, Murcia") == ("Lorca", ["Lorca"], "")
    assert lee("Calle Reina Victoria 5, 03201 Elche, Alicante") == ("Elche", ["Elche"], "")
    jerez = "Jerez de la Frontera"
    assert lee("Calle Larga 5, 11403 Jerez de la Frontera, Cádiz") == (jerez, [jerez], "")
    for d, pueblo in (("Calle Mayor 5, Lorca, Murcia", "Lorca"), ("Calle Mayor 5, Lorca Murcia", "Lorca"),
                      ("Calle Real 5, 13300 Valdepeñas, Ciudad Real", "Valdepeñas"),
                      ("Calle Real 5, Valdepeñas Ciudad Real", "Valdepeñas"),
                      ("Calle Real 5, 35200 Telde, Las Palmas", "Telde"),
                      ("Calle Real 5, 38300 La Orotava, Santa Cruz de Tenerife", "La Orotava"),
                      ("Calle Mayor 5, Logroño La Rioja", "Logroño"),
                      ("Calle Mayor 5, 41001 Sevilla, Andalucía", "Sevilla"),         # antes, «Andalucía»
                      ("Calle Mayor 5, Toledo, Castilla-La Mancha", "Toledo"),
                      ("Calle Mayor 5, 47001 Valladolid, Castilla y León", "Valladolid"),
                      ("Calle Mayor 5, Alcobendas, Comunidad de Madrid", "Alcobendas"),
                      ("Calle Uría 5, Oviedo, Principado de Asturias", "Oviedo"),
                      ("Calle Mayor 5, 07001 Palma, Illes Balears", "Palma")):
        assert lee(d) == (pueblo, [pueblo], ""), d
    # La capital, con su CP o sin CP; con el de otro municipio, la provincia (no es su pueblo).
    assert lee("Calle Mayor 5, 30001 Murcia") == ("Murcia", ["Murcia"], "")
    assert lee("Calle Mayor 5, Murcia") == ("Murcia", ["Murcia"], "")
    assert lee("Calle Mayor 5, 30800 Murcia") == ("", [], "Murcia")
    assert lee("Calle Mayor 5", "30800", "Murcia") == ("", [], "Murcia")
    assert lee("Calle Real 5, 35001 Las Palmas") == ("Las Palmas", ["Las Palmas"], "")
    assert lee("Calle Real 5, 35200 Las Palmas") == ("", [], "Las Palmas")
    assert lee("Calle Real 5, 13001 Ciudad Real") == ("Ciudad Real", ["Ciudad Real"], "")
    # Las que no son ningún pueblo, nunca.
    assert lee("Calle Mayor 5, La Rioja") == lee("Calle Mayor 5", "", "La Rioja") == ("", [], "La Rioja")
    assert lee("Calle Mayor 5, Andalucía") == ("", [], "Andalucía")
    # Detrás de «de», es del nombre del pueblo («La Guardia de Jaén» se leía «La Guardia de»).
    for pueblo in ("Alhama de Murcia", "Villanueva de Córdoba", "La Guardia de Jaén", "Fuentes de León",
                   "Sant Joan d'Alacant", "Molina de Aragón"):
        assert lee(f"Calle Real 5, {pueblo}") == (pueblo, [pueblo], ""), pueblo
    villanueva = "Villanueva de Córdoba"
    assert lee("Calle Real 5, Villanueva de Córdoba, Córdoba")[:2] == (villanueva, [villanueva])
    assert all(G.es_pueblo(x, cp) for x, cp in (("Murcia", "30001"), ("Murcia", ""), ("Alicante", "03001"),
                                                ("Las Palmas", "35001"), ("Santa Cruz de Tenerife", "38001"),
                                                ("Ceuta", "51001"), ("Melilla", ""), ("Lorca", "30800")))
    assert not any(G.es_pueblo(x, cp) for x, cp in (("Murcia", "30800"), ("Alicante", "03201"), ("Cádiz", "11403"),
                                                    ("Ciudad Real", "13300"), ("Santa Cruz de Tenerife", "38300"),
                                                    ("La Rioja", ""), ("Castilla-La Mancha", ""), ("Euskadi", ""),
                                                    ("Illes Balears", ""), ("Comunidad de Madrid", "28001")))
    # Fuera de España, como siempre: «Guadalajara», «Toledo» o «Córdoba» son de allí.
    assert lee("Av. Vallarta 100, 44100 Guadalajara, Jal.", pais="mx")[0] == "Guadalajara"
    assert "Toledo" in lee("123 Main St, Toledo, OH 43604", pais="us")[1]
    assert lee("Av. Colón 100, X5000 Córdoba, Córdoba", pais="ar")[0] == "Córdoba"


def _red_lorca(candidatos):
    return Red(find=lambda q: centro_cp("30800", LORCA_30800) if q.get("q") == "30800" else None,
               reverseGeocode={"muni": "Lorca"}, candidates=candidatos)


@pytest.mark.asyncio(loop_scope="session")
async def test_la_provincia_detras_del_pueblo_no_trae_el_portal_de_la_capital():
    """El caso del revisor: el portal de la ciudad de Murcia no es el de «Calle Mayor 5, 30800 Lorca, Murcia» (se le
    preguntaba también en Murcia y salía como su portal, a 60 km); se queda la zona del CP. El de Lorca, si lo hay, y
    con la capital escrita sola, el de la capital, como siempre."""
    murcia = portal("MAYOR", 5, "30001", "Murcia", *MURCIA_MAYOR_5)
    p = G.leer_etiqueta("Calle Mayor 5, 30800 Lorca, Murcia")
    assert G.lugar_nivel(p, {"cp_punto": LORCA_30800}, "30001", "Murcia", [], MURCIA_MAYOR_5) == 0
    red = _red_lorca(lambda q: [murcia] if "murcia" in q["q"].lower() else None)
    res, traza = await G.ubicar(red, "Calle Mayor 5, 30800 Lorca, Murcia")
    assert res["precision"] == "zona" and (res["lat"], res["lng"]) == LORCA_30800
    assert traza["cc_consultas"] and all("Murcia" not in q for q in traza["cc_consultas"])
    lorca = portal("MAYOR", 5, "30800", "Lorca", 37.6770, -1.6990)
    res, traza = await G.ubicar(_red_lorca(lambda q: [lorca] if "lorca" in q["q"].lower() else [murcia]),
                                "Calle Mayor 5, 30800 Lorca, Murcia")
    assert res["precision"] == "portal" and (res["lat"], res["lng"]) == (37.6770, -1.6990)
    for d in ("Calle Mayor 5, Murcia", "Calle Mayor 5, 30001 Murcia"):
        p = G.leer_etiqueta(d)
        assert G.lugar_nivel(p, {}, "30002", "Murcia", [], MURCIA_MAYOR_5) == 2, d
        res, _ = await G.ubicar(Red(candidates=[murcia]), d)
        assert res["precision"] == "portal" and (res["lat"], res["lng"]) == MURCIA_MAYOR_5, d
