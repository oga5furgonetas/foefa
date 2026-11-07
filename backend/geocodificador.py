# -*- coding: utf-8 -*-
"""DÓNDE CAE UNA DIRECCIÓN DE REPARTO (02-11-2026).

Dani, probando la app con una cuenta nueva de repartidor: «el primer paquete que escaneo no encuentra la dirección y
tiene que ir por Maps; eso es un pedazo de mierda, hazlo bien». La cadena de antes (Nominatim con el texto tal cual y,
si no, Photon exigiendo TODAS las palabras) dejó sin punto 52 de 182 etiquetas de direcciones públicas como salen de
las etiquetas (laboratorio del 02-11-2026) y dio por portal 10 que estaban de 197 m a 37 km: guardaba como «la puerta»
lo que Nominatim devolvía a nivel de calle o de barrio. Esta es la cadena que midió el laboratorio con esas mismas
etiquetas (y dos juegos más para validar): 164 portales y 18 calles bien, ninguna sin punto ni mal situada, 0,7 s de
media (p95 1,7 s).

    0. Leer la etiqueta (leer_etiqueta): tipo de vía (gallego, castellano, catalán, euskera y abreviado), nombre,
       número y letra, «s/n», CP y poblaciones. Fuera el piso, «Nº», la provincia repetida y los paréntesis; el pueblo,
       por su nombre oficial («La Coruña» -> «A Coruña»).
    1. España: CartoCiudad (el callejero oficial del IGN) con «nombre sin tipo ni artículo + número, pueblo» (con el
       tipo o el CP dentro no contesta), a la vez que el centro del CP. Un portal solo si cuadran nombre, número y
       sitio y ningún otro cuadra igual en otro sitio (elegir_cc). Hasta 4 formas de preguntar.
    2. Photon (OpenStreetMap, tolerante a faltas) y 3. Nominatim (estructurado), si no hubo portal oficial, con la
       precisión que de verdad tiene lo que devuelven: una calle NUNCA sale como portal.
    4. La calle (geo «aprox») y 5. la zona (el centro del CP o del pueblo, geo «zona»), nunca como portal.

Revisión del 02-11-2026: lo de un concello VECINO (otro pueblo y otro CP, cerca del centro del CP de una etiqueta que
trae su pueblo: la calle que se llama igual en el de al lado) ya no sale nunca, solo se sugiere (lugar_nivel); sin
CartoCiudad (opciones {"cc": False}) no se le pregunta nada, ni el centro del CP; y una búsqueda con un servicio caído o
un paso que no cupo en el tope sale marcada como incompleta (traza["incompleta"]): no es lo definitivo.

Sin base de datos ni red delante (como reparto.py): la red se le pasa (`red.get`), así que se prueba entera sin
Internet (tests/test_geocodificador.py) y scripts/probar_geocodificador.py la usa con la de verdad o con las
respuestas guardadas del laboratorio. `RedHttp` es la de verdad: caché, semáforo por servicio, el ritmo de Nominatim
(1 petición por segundo para todo el servidor, su norma de uso) y un corta-circuitos por servicio.

A los servicios solo les llega la dirección (calle, número, CP y pueblo): nunca el nombre ni el teléfono del cliente,
ni el piso. Datos: CartoCiudad © IGN/CNIG con licencia CC BY 4.0 (hay que citarlo: ATRIBUCION_CC) y OpenStreetMap
con licencia ODbL (ATRIBUCION_OSM).
"""
import asyncio
import difflib
import hashlib
import json
import math
import re
import time
import unicodedata

NOMINATIM = "https://nominatim.openstreetmap.org/search"
PHOTON = "https://photon.komoot.io/api/"
CC_CAND = "https://www.cartociudad.es/geocoder/api/geocoder/candidates"
CC_FIND = "https://www.cartociudad.es/geocoder/api/geocoder/find"
CC_REV = "https://www.cartociudad.es/geocoder/api/geocoder/reverseGeocode"

ATRIBUCION_CC = "CartoCiudad © IGN/CNIG (CC BY 4.0)"
ATRIBUCION_OSM = "© OpenStreetMap (ODbL)"

# Topes en segundos (medidos el 02-11-2026: CartoCiudad contesta en 0,30 s de mediana y 0,6 s el p95). Un paso que no
# cabe en lo que queda no se hace; la cadena entera, como mucho TOPE_TOTAL.
TOPE_TOTAL, TOPE_CC, TOPE_NOM, TOPE_PHO = 8.0, 2.0, 3.0, 2.5
M_PORTAL = 150          # dos portales a más de esto son dos sitios distintos
M_MISMO = 25            # dos candidatos a menos de esto, con la misma precisión, son el mismo

# La caja de cada país para dar un punto por bueno (sur, oeste, norte, este). Solo la de España, la de siempre del
# código (con Canarias, Ceuta y Melilla); de los demás no hay y no se mira.
CAJA_PAIS = {"es": (27.0, -19.0, 44.5, 5.0)}
# Donde el número va delante de la calle («10 Downing Street», «12 rue de la Paix»), como reparto._NUMERO_DELANTE.
NUMERO_DELANTE = {"fr", "gb", "ie", "us", "ca", "au", "nz"}


# ── texto y distancias ────────────────────────────────────────────────────────

def metros(a, b) -> float:
    (la1, lo1), (la2, lo2) = a, b
    r = 6371000.0
    p1, p2 = math.radians(la1), math.radians(la2)
    dp, dl = p2 - p1, math.radians(lo2 - lo1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


def sin_acentos(s) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", str(s or "")) if not unicodedata.combining(c))


def norm(s) -> str:
    return re.sub(r"\s+", " ", sin_acentos(s).lower()).strip()


def solo(s) -> str:
    return re.sub(r"[^a-z0-9]+", " ", norm(s)).strip()


def en_pais(lat, lng, pais) -> bool:
    caja = CAJA_PAIS.get(pais)
    return not caja or (caja[0] <= lat <= caja[2] and caja[1] <= lng <= caja[3])


def punto_valido(lat, lng, pais=""):
    """(lat, lng) si son dos números de verdad, no el 0,0 de «sin punto» y, si hay caja para ese país, dentro de ella.
    Si no, None. Es lo que se le pide a un punto que pone la persona en el mapa o que llega de la app."""
    try:
        la, lo = float(lat), float(lng)
    except (TypeError, ValueError):
        return None
    if la != la or lo != lo or math.isinf(la) or math.isinf(lo):
        return None
    if not (-90 <= la <= 90 and -180 <= lo <= 180) or (abs(la) < 1e-6 and abs(lo) < 1e-6):
        return None
    if pais and not en_pais(la, lo, pais):
        return None
    return la, lo


# ── nombres de vía: tipo, artículos y comparación ────────────────────────────

TIPO_FAMILIA = {
    "calle": "calle", "c": "calle", "cl": "calle", "cll": "calle", "rua": "calle", "r": "calle", "carrer": "calle",
    "cr": "calle", "kalea": "calle", "k": "calle", "rueiro": "calle", "ruela": "calle", "carrero": "callejon",
    "callejon": "callejon", "calexa": "callejon", "calleja": "callejon",
    "avenida": "avenida", "avda": "avenida", "av": "avenida", "avd": "avenida", "avinguda": "avenida",
    "etorbidea": "avenida", "hiribidea": "avenida",
    "plaza": "plaza", "praza": "plaza", "pza": "plaza", "pz": "plaza", "pl": "plaza", "placa": "plaza",
    "pca": "plaza", "pr": "plaza", "enparantza": "plaza", "pracina": "plaza", "plazuela": "plaza",
    "plazoleta": "plaza", "placeta": "plaza",
    "paseo": "paseo", "po": "paseo", "passeig": "paseo", "pg": "paseo", "pasealekua": "paseo",
    "ronda": "ronda", "rda": "ronda", "rolda": "ronda",
    "travesia": "travesia", "trav": "travesia", "trv": "travesia", "travessera": "travesia", "tv": "travesia",
    # «Travesa» (gallego) solo se reconocía al leer la etiqueta; al comparar (nucleo) no se quitaba, y sin CartoCiudad
    # «Travesa de Vista Alegre 46» perdía frente a «Rúa de Vista Alegre 46», a 550 m (laboratorio, 02-11-2026).
    "travesa": "travesia",
    "camino": "camino", "cmno": "camino", "cno": "camino", "cami": "camino", "bidea": "camino",
    "carretera": "carretera", "ctra": "carretera", "estrada": "carretera", "errepidea": "carretera",
    "lugar": "lugar", "lg": "lugar", "lug": "lugar", "aldea": "lugar",
    "glorieta": "glorieta", "gta": "glorieta", "urbanizacion": "urbanizacion", "urb": "urbanizacion",
    "barrio": "barrio", "bo": "barrio", "bairro": "barrio", "auzoa": "barrio", "poligono": "poligono",
    "pol": "poligono", "costa": "cuesta", "cuesta": "cuesta", "costanilla": "cuesta", "alameda": "alameda",
    "parque": "parque", "bulevar": "bulevar", "boulevard": "bulevar", "pasaje": "pasaje", "pasaxe": "pasaje",
    "passatge": "pasaje", "muelle": "muelle", "peirao": "muelle", "rambla": "rambla", "explanada": "explanada",
    "via": "via", "sector": "sector", "senda": "senda", "vereda": "senda", "subida": "subida", "baixada": "bajada",
    "bajada": "bajada", "calzada": "calzada", "cc": "calzada", "pasadizo": "pasaje",
}
SUFIJO_EU = {"kalea": "calle", "k": "calle", "etorbidea": "avenida", "hiribidea": "avenida", "plaza": "plaza",
             "enparantza": "plaza", "pasealekua": "paseo", "bidea": "camino", "errepidea": "carretera",
             "zumarkalea": "calle", "auzoa": "barrio"}
PREPS = {"de", "del", "la", "el", "los", "las", "da", "do", "das", "dos", "a", "o", "os", "as", "d", "l", "dels",
         "les", "en", "na", "y", "e", "i"}


def nucleo(nombre) -> str:
    """El nombre de la vía sin tipo, artículos, tildes ni signos: «Avenida da Mariña» -> «marina»;
    «RUA TRAS DO PILAR (DE)» -> «tras pilar»; «SALANOVA, RAMON» -> «salanova ramon»."""
    s = norm(nombre)
    s = re.sub(r"\([^)]*\)", " ", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    toks = s.split()
    while len(toks) > 1 and toks[0] in TIPO_FAMILIA:
        toks.pop(0)
    while len(toks) > 1 and toks[-1] in SUFIJO_EU:
        toks.pop()
    return " ".join(t for t in toks if t not in PREPS)


_OCR = str.maketrans({"0": "o", "1": "l", "5": "s", "8": "b", "6": "g", "4": "a", "3": "e"})


def des_ocr(s) -> str:
    """«Lug0» -> «Lugo», «A1calá» -> «Alcalá», «Rarnbla» -> «Rambla»: las confusiones del OCR dentro de una palabra
    (una cifra entre letras; «rn» por «m»). Las cifras sueltas («XIII», «2 de Maio») no se tocan. Es una forma más de
    comparar y de preguntar, nunca en lugar de lo leído («Carnoedo» lleva «rn» de verdad)."""
    def palabra(m):
        w = m.group(0)
        return w.translate(_OCR) if re.search(r"[^\W\d_]", w) and re.search(r"\d", w) else w
    return re.sub(r"rn", "m", re.sub(r"RN", "M", re.sub(r"\w+", palabra, str(s or ""))))


def parecido(a, b) -> float:
    """0-1: cuánto se parecen dos nombres de vía. Tolera el nombre en dos idiomas del callejero («POETA MAS I ROS /
    POETA MAS Y ROS»), el apellido delante («SALANOVA, RAMON»), uno más corto («Pardo Bazán» y «Emilia Pardo Bazán»)
    y una letra mal leída. «Rúa do Vilar» y «TRAS DO PILAR» no pasan."""
    mejor = 0.0
    formas_a = [str(a or "")]
    if des_ocr(a) != str(a or ""):
        formas_a.append(des_ocr(a))
    for aa in [x for fa in formas_a for x in re.split(r"\s+/\s+", fa)]:
        for bb in re.split(r"\s+/\s+", str(b or "")):
            x, y = nucleo(aa), nucleo(bb)
            if not x or not y:
                continue
            r = difflib.SequenceMatcher(None, x, y).ratio()
            tx, ty = set(x.split()), set(y.split())
            if tx == ty:
                r = max(r, 0.95)
            elif len(x) >= 5 and len(y) >= 5 and (tx <= ty or ty <= tx):
                r = max(r, 0.86)
            mejor = max(mejor, r)
    return mejor


def parecido_osm(etiqueta, via) -> float:
    """Como parecido(), pero si el nombre de la etiqueta es solo un trozo de uno MÁS LARGO de OpenStreetMap («La
    Rambla» y «Rambla de Catalunya»), se queda en 0,80: puede ser otra calle (y en OSM no hay rivales que mirar). Al
    revés sí vale («Arzobispo Lago González» y «Arzobispo Lago»)."""
    sim = parecido(etiqueta, via)
    x, y = set(nucleo(des_ocr(etiqueta)).split()), set(nucleo(via).split())
    if x and y and x < y and sim < 0.95:
        return min(sim, 0.80)
    return sim


def nombre_via_cc(c) -> str:
    """La vía de un resultado de CartoCiudad sin tipo, número ni pueblo: «CALLE REAL 1 A, A Coruña» -> «REAL»;
    «LUGAR XOBRE, A Ponte (A Pobra do Caramiñal)» -> «XOBRE»; «CALLE SALANOVA, RAMON 2, Zaragoza» -> «SALANOVA,
    RAMON»."""
    a = str(c.get("address") or "").strip()
    muni, pob = str(c.get("muni") or ""), str(c.get("poblacion") or "")
    for suf in (f", {pob} ({muni})", f" ({muni})", f", {muni}", f", {pob}"):
        if suf.strip(", ()") and a.endswith(suf):
            a = a[:-len(suf)].strip()
    if str(c.get("type") or "").lower() == "portal" and c.get("portalNumber") is not None:
        m = re.search(r"\s+" + re.escape(str(c["portalNumber"])) + r"(\s+[A-Za-z0-9]{1,5}){0,2}\s*$", a)
        if m:
            a = a[:m.start()]
    tv = str(c.get("tip_via") or "").strip()
    if tv and a.upper().startswith(tv.upper() + " "):
        a = a[len(tv):].strip()
    return a.strip(" ,")


# ── leer la etiqueta ──────────────────────────────────────────────────────────

CP_ES = re.compile(r"(?<!\d)((?:0[1-9]|[1-4]\d|5[0-2])\d{3})(?!\d)")
# El código postal de cada país (como reparto._CP_PAIS); España, el de arriba.
CP_PAIS = {
    "pt": r"\d{4}-\d{3}", "br": r"\d{5}-\d{3}|\d{8}", "mx": r"\d{5}", "us": r"\d{5}(?:-\d{4})?", "pe": r"\d{5}",
    "fr": r"\d{5}", "it": r"\d{5}", "de": r"\d{5}", "ar": r"[A-Z]\d{4}[A-Z]{3}", "gb": r"[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}",
    "nl": r"\d{4}\s?[A-Z]{2}", "ie": r"[A-Z]\d{2}\s?[A-Z0-9]{4}", "be": r"\d{4}", "ch": r"\d{4}", "at": r"\d{4}",
    "ad": r"AD\d{3}", "cl": r"\d{7}", "co": r"\d{6}", "uy": r"\d{5}", "py": r"\d{4}", "cr": r"\d{5}", "pa": r"\d{4}",
    "gt": r"\d{5}", "do": r"\d{5}", "ve": r"\d{4}", "ec": r"\d{6}", "hn": r"\d{5}", "ni": r"\d{5}", "sv": r"\d{4}",
    "cu": r"\d{5}", "cn": r"\d{6}",
}


def _cp_re(pais):
    if pais in ("es", "", None) or pais not in CP_PAIS:
        return CP_ES
    return re.compile(r"(?<![\w-])(" + CP_PAIS[pais] + r")(?![\w-])", re.I)


# Lo que va detrás del número de la casa cuando va delante de la calle: la calle («12345 Lake City Way NE», «12500 15th
# Ave NE», «123 1/2 Main St»).
_TRAS_LA_CASA = re.compile(r"\s+(?:\d+/\d+\s+)?\d*[^\W\d_]")


def cps_escritos(texto, pais="es") -> list:
    """Los CP escritos en una dirección con la regla del país, en su orden (03-11-2026). Donde el número va delante
    (NUMERO_DELANTE), el del principio seguido de la calle es el de la casa, no un CP: de «12345 Lake City Way NE,
    Seattle, WA 98125», solo «98125». En mayúsculas, con un espacio entre sus trozos («SW1A 2AA») y, en EE. UU., el ZIP
    sin los cuatro de detrás («98125-1234» -> «98125», como lo dan los buscadores)."""
    s = str(texto or "")
    salida = []
    for m in _cp_re(pais).finditer(s):
        if pais in NUMERO_DELANTE and not s[:m.start()].strip() and _TRAS_LA_CASA.match(s, m.end()):
            continue
        cp = " ".join(m.group(1).upper().split())
        salida.append(cp[:5] if pais == "us" else cp)
    return salida


def cp_escrito(texto, pais="es") -> str:
    """EL CP ESCRITO EN UNA DIRECCIÓN FUERA DE ESPAÑA, con la regla del país (03-11-2026; en España, reparto.extrae_cp):
    el que se guarda en la parada si no llega aparte. El último de cps_escritos, que va detrás de la calle y del número:
    así no gana un número de casa largo («Blvd. Agua Caliente 10440, Col. Aviación, 22420 Tijuana» -> «22420»)."""
    cps = cps_escritos(texto, pais)
    return cps[-1] if cps else ""


# Los que no son el nombre de ningún pueblo (03-11-2026): el país, la comunidad o una provincia que no se llama como su
# capital. Nunca son el pueblo de la etiqueta (es_pueblo). Todos desde la sexta tanda (03-11-2026), como las apps.
NO_PUEBLO = {"alava", "araba", "asturias", "bizkaia", "vizcaya", "cantabria", "gipuzkoa", "guipuzcoa", "navarra",
             "nafarroa", "la rioja", "rioja", "illes balears", "islas baleares", "baleares", "galicia", "euskadi",
             "pais vasco", "catalunya", "cataluna", "andalucia", "aragon", "castilla y leon", "castilla la mancha",
             "extremadura", "comunidad valenciana", "comunitat valenciana", "region de murcia", "comunidad de madrid",
             "canarias", "principado de asturias", "espana", "spain"}
# Las provincias que se llaman como su capital, también en las otras lenguas (cuentan como la capital solo con un CP de
# ella o sin CP: es_pueblo), y las de NO_PUEBLO. Todas desde la sexta tanda (03-11-2026), como las apps: eran unas 20, y
# «Calle Mayor 5, 30800 Lorca, Murcia» daba por el mismo pueblo el portal de la ciudad de Murcia, a 60 km.
PROVINCIAS = {"a coruna", "la coruna", "coruna", "coruna a", "albacete", "alicante", "alacant", "almeria", "avila",
              "badajoz", "barcelona", "burgos", "caceres", "cadiz", "castellon", "castello", "castellon de la plana",
              "ciudad real", "cordoba", "cuenca", "girona", "gerona", "granada", "guadalajara", "huelva", "huesca",
              "jaen", "las palmas", "leon", "lleida", "lerida", "lugo", "madrid", "malaga", "murcia", "ourense",
              "orense", "palencia", "pontevedra", "salamanca", "santa cruz de tenerife", "segovia", "sevilla", "soria",
              "tarragona", "teruel", "toledo", "valencia", "valladolid", "zamora", "zaragoza", "ceuta",
              "melilla"} | NO_PUEBLO
# Fuera de España, solo las de antes de la sexta tanda, como siempre: muchas de las nuevas son también ciudades de allí
# («Av. Vallarta 100, 44100 Guadalajara, Jal.», «123 Main St, Toledo, OH 43604») y se quitarían como provincia.
PROVINCIAS_FUERA = {"a coruna", "la coruna", "coruna", "coruna a", "lugo", "ourense", "orense", "pontevedra",
                    "madrid", "barcelona", "sevilla", "valencia", "bizkaia", "vizcaya", "zaragoza", "malaga", "girona",
                    "gerona", "leon", "caceres", "teruel", "jaen", "burgos", "albacete", "huesca", "salamanca",
                    "castellon", "castello", "asturias", "cantabria", "navarra", "alava", "araba", "gipuzkoa",
                    "guipuzcoa", "espana", "galicia", "spain"}
# Nombre de siempre -> el oficial, como lo escribe CartoCiudad (con sus tildes).
ALIAS = {"la coruna": "A Coruña", "coruna": "A Coruña", "coruna a": "A Coruña", "a coruna": "A Coruña",
         "orense": "Ourense", "el ferrol": "Ferrol", "sangenjo": "Sanxenxo", "villagarcia de arosa": "Vilagarcía de Arousa",
         "villagarcia": "Vilagarcía de Arousa", "vilagarcia": "Vilagarcía de Arousa", "la estrada": "A Estrada",
         "puentedeume": "Pontedeume", "puenteareas": "Ponteareas", "arteijo": "Arteixo", "el porrino": "O Porriño",
         "porrino": "O Porriño", "bayona": "Baiona", "el barco de valdeorras": "O Barco de Valdeorras",
         "o barco": "O Barco de Valdeorras", "puebla del caraminal": "A Pobra do Caramiñal",
         "pobra do caraminal": "A Pobra do Caramiñal", "santa uxia de ribeira": "Ribeira",
         "santa eugenia de riveira": "Ribeira", "riveira": "Ribeira", "santiago": "Santiago de Compostela",
         "santiago compostela": "Santiago de Compostela", "bilbo": "Bilbao", "donostia": "Donostia/San Sebastián",
         "san sebastian": "Donostia/San Sebastián", "gasteiz": "Vitoria-Gasteiz", "vitoria": "Vitoria-Gasteiz",
         "irunea": "Pamplona/Iruña", "iruna": "Pamplona/Iruña", "pamplona": "Pamplona/Iruña", "lerida": "Lleida",
         "gerona": "Girona", "alicante": "Alacant/Alicante", "alacant": "Alacant/Alicante", "elche": "Elx/Elche",
         "elx": "Elx/Elche", "castello": "Castelló de la Plana",
         "castellon de la plana": "Castelló de la Plana", "castellon": "Castelló de la Plana",
         "valencia": "València", "malaga": "Málaga", "carballino": "O Carballino", "el carballino": "O Carballino"}
# El piso pegado a la puerta (02-11-2026, revisión A5): «1ºB», «2ºIzq» o «3ºDcha» son una sola palabra (norm() pasa
# «º» a «o»). «2ºIzq» no se reconocía y, como lleva letras, se tomaba por el pueblo: «Calle Mayor 5 2ºIzq, 28013
# Madrid» se buscaba en «2ºIzq» (y Madrid, que también es provincia, se quitaba).
PISO_TOK = re.compile(
    r"^(?:\d{1,2}(?:[ºª°]|o|a)(?:[a-z]|izq|izqda|izda|izquierda|dcha|dcho|dch|der|derecha|dta|dereita|esq|esquerda|"
    r"ctro|centro|int|ext)?|\d{1,2}(?:o|a|n|r|t|er|na|ra|ta|do|ro|to)|\d{1,2}|bajo|bajos|bj|baixo|baixos|"
    r"entlo|entresuelo|entreplanta|entl|pral|principal|atico|atic|sotano|semisotano|local|izq|izda|izquierda|"
    r"dcha|dcho|derecha|dta|dereita|esq|esquerda|centro|ctro|esc|escalera|escaleira|portal|pta|puerta|porta|"
    r"piso|planta|bloque|blq|bl|edificio|edif|behea|ezk|esk|eskuma|ezkerra|eskuina|bis|dup|duplicado|"
    r"[a-h]|[ºª°])$")
SN_RE = re.compile(r"(?<![^\W\d_])(?:s\s*/\s*n|s\.\s*n\.?|sin\s+n[uú]mero)(?![^\W\d_])", re.I)
N_RE = re.compile(r"(?<![^\W\d_])(?:n\s*[º°o]\s*\.?|n\.\s*[º°o]\.?|n[uú]m\.?|n[uú]mero)\s*(?=\d)", re.I)
TIPO_RE = re.compile(r"^(c\s*/\s*\.?|r\s*/|[^\W\d_][^\W\d_ºª.]*\.?|p\.?\s*º\.?|bº\.?)\s+(.+)$", re.I)
NUM_RE = re.compile(r"(?<![\w/])(\d{1,4})(?:([A-Za-z])(?![^\W\d_])|\s+([A-Ha-h])(?=\s*$))?(?![\d/ºª°])")
TIPO_LARGO = {"calle": "Calle", "avenida": "Avenida", "plaza": "Plaza", "paseo": "Paseo", "ronda": "Ronda",
              "travesia": "Travesía", "camino": "Camino", "carretera": "Carretera", "glorieta": "Glorieta",
              "urbanizacion": "Urbanización", "barrio": "Barrio", "callejon": "Callejón", "cuesta": "Cuesta",
              "alameda": "Alameda", "pasaje": "Pasaje", "subida": "Subida", "calzada": "Calzada", "via": "Vía"}


def oficial(loc) -> str:
    """«La Coruña» -> «A Coruña»; lo demás tal cual."""
    return ALIAS.get(solo(loc), loc)


def muni_clave(s) -> str:
    return solo(oficial(s))


def es_pueblo(nombre, cp="", pais="es") -> bool:
    """¿Cuenta este nombre de la etiqueta como su pueblo? (03-11-2026, como las apps) En España, el de una provincia
    que se llama como su capital (A Coruña, Lugo, Madrid…: PROVINCIAS) es la capital solo con un CP de ella (su
    tercera cifra es 0: 15001-15011, 27001-27004, 28001-28080…) o sin CP; con el de otro municipio es la provincia:
    «Rúa Rosalía de Castro 5, 15179 A Coruña» es de Oleiros, y CartoCiudad daba como su portal el de la ciudad, a 8 km.
    Los que no son el nombre de ningún pueblo (NO_PUEBLO), nunca. Fuera de España, todos."""
    if pais not in ("es", "", None):
        return True
    k = solo(nombre)
    if k in NO_PUEBLO:
        return False
    c = str(cp or "").strip()
    return k not in PROVINCIAS or not CP_ES.fullmatch(c) or c[2] == "0"


def _provincias(pais) -> set:
    return PROVINCIAS if pais in ("es", "", None) else PROVINCIAS_FUERA


def es_piso(texto) -> bool:
    toks = [t for t in re.split(r"[\s.,/-]+", norm(texto)) if t]
    return bool(toks) and all(PISO_TOK.match(t) for t in toks)


def loc_limpia(loc, pais="es") -> str:
    """«Sada Coruña» -> «Sada»; «Lugo Lugo» -> «Lugo»; «A Coruña» se queda (es la ciudad). En España, detrás de «de» la
    provincia es del nombre (03-11-2026, con todas): «Alhama de Murcia» y «La Guardia de Jaén» se quedan (esta se
    quedaba en «La Guardia de»). Fuera de España, como siempre."""
    espana = pais in ("es", "", None)
    k = solo(loc)
    if k in _provincias(pais):
        return loc
    for pv in sorted(_provincias(pais), key=len, reverse=True):
        if k.endswith(" " + pv) and len(k) > len(pv) + 2:
            if espana and k[:-len(pv) - 1].split()[-1] in ("de", "del", "d"):
                return loc
            palabras = loc.split()
            queda = " ".join(palabras[:-len(pv.split())]).strip(" ,.-")
            if solo(queda) not in ("a", "o", "la", "el", "as", "os", "las", "los", ""):
                return queda
    return loc


def _parece_calle(trozo) -> bool:
    """¿Este trozo de la etiqueta es la calle? Lleva un número de portal o empieza (o acaba, en euskera) por un tipo
    de vía («R/», «Avda.», «Lugar», «Praza»…)."""
    if re.search(r"(?<![\w/])\d{1,4}(?![\d/ºª°])", trozo):
        return True
    mm = TIPO_RE.match(trozo.strip())
    if mm:
        t0 = norm(mm.group(1)).replace(" ", "").rstrip(".").replace("º", "o")
        if {"c/": "c", "c/.": "c", "r/": "r"}.get(t0, t0) in TIPO_FAMILIA or t0 == "travesa":
            return True
    ultima = norm(trozo).split()[-1:] or [""]
    return ultima[0].rstrip(".") in SUFIJO_EU


def leer_etiqueta(direccion, cp_campo="", loc_campo="", pais="es") -> dict:
    """«RUA REAL Nº 1 3ºB, 15003, A CORUÑA» -> tipo «RUA» (familia calle), nombre «REAL», número «1», CP «15003»,
    población «A CORUÑA». Lo que no se sabe se queda vacío. El piso y la puerta no se usan para buscar."""
    cp_re = _cp_re(pais)
    s = " ".join(str(direccion or "").replace("\n", ", ").split())
    s = re.sub(r"\s*\(([^)]*)\)\s*", r", \1, ", s)
    cp_campo = str(cp_campo or "").strip()
    cp = cp_campo if cp_re.fullmatch(cp_campo or "x") else ""
    m = cp_re.search(s)
    if not cp and m:
        cp = m.group(1)
    # La población de la parada, si es un pueblo con ese CP (es_pueblo, 03-11-2026): «A Coruña» con el 15179 es la
    # provincia, y la que manda es la escrita. Lo que no es un pueblo queda aparte («provincia»).
    campo = loc_limpia(str(loc_campo or "").strip(), pais)
    no_pueblos = [campo] if campo and not es_pueblo(campo, cp, pais) else []
    campo = "" if no_pueblos else campo
    sn = bool(SN_RE.search(s))
    s = SN_RE.sub(" ", s)
    s = N_RE.sub(" ", s)
    trozos = []
    for t in re.split(r"\s*[,;]\s*|\s+-\s+|\s+–\s+", s):
        t = t.strip(" .")
        if not t:
            continue
        mm = cp_re.search(t)
        if mm:
            antes, despues = t[:mm.start()].strip(" ,.-"), t[mm.end():].strip(" ,.-")
            if antes:
                trozos.append(antes)
            trozos.append("#CP")
            if despues:
                trozos.append(despues)
        else:
            trozos.append(t)
    posibles = [i for i, t in enumerate(trozos) if t != "#CP" and re.search(r"[^\W\d_]{2,}", t) and not es_piso(t)]
    # La calle es el primer trozo que lo parece (un tipo de vía o un número): con el nombre o la empresa delante
    # («TALLERES PEPE SL, Rúa Real 1, 15003 A Coruña», 02-11-2026) se tomaba el nombre por la calle. Si ninguno lo
    # parece («O Barreiro, 36471 Salceda»), el primero, como antes.
    calle_i = next((i for i in posibles if _parece_calle(trozos[i])), posibles[0] if posibles else None)
    vacio = {"tipo": "", "familia": "", "nombre": "", "num": "", "letra": "", "sn": sn, "cp": cp,
             "localidades": [], "loc": campo, "otros": [], "provincia": no_pueblos[0] if no_pueblos else ""}
    if calle_i is None:
        return vacio
    calle = trozos[calle_i]
    num, letra, resto = "", "", ""
    # El número: el primero que va detrás del nombre («Rúa 25 de Xullo 3» -> 3; «12 de Octubre» es nombre).
    for mm in NUM_RE.finditer(calle):
        antes = calle[:mm.start()].strip()
        if not antes or norm(antes).rstrip(".").replace(" ", "") in TIPO_FAMILIA or \
                re.fullmatch(r"[cr]\s*/\s*\.?", antes, re.I):
            continue
        if re.match(r"^(de|da|do|del)\b", norm(calle[mm.end():].lstrip())):
            continue
        num, letra = mm.group(1), (mm.group(2) or mm.group(3) or "").upper()
        resto = calle[mm.end():]
        calle = antes
        break
    # Donde el número va delante («10 Downing Street», «12 rue de la Paix»).
    if not num and pais in NUMERO_DELANTE:
        mm = re.match(r"^\s*(\d{1,5})([A-Za-z])?\s+(?=[^\W\d_])", calle)
        if mm:
            num, letra, calle = mm.group(1), (mm.group(2) or "").upper(), calle[mm.end():]
    usados = {calle_i}
    if not num and not sn:
        for j in range(calle_i + 1, min(len(trozos), calle_i + 3)):
            mm = re.match(r"^(\d{1,4})(?:([A-Za-z])(?![^\W\d_])|\s+([A-Ha-h])(?=\s*$))?(?![\d/ºª°])(.*)$", trozos[j])
            if mm and trozos[j] != "#CP":
                num, letra, resto = mm.group(1), (mm.group(2) or mm.group(3) or "").upper(), mm.group(4)
                usados.add(j)
                break
    extra_loc = []
    if resto.strip():
        toks = resto.split()
        k = 0
        # Una letra suelta es la puerta solo si detrás no viene más nombre: en «1 A Coruña» la «A» es del pueblo.
        while k < len(toks) and es_piso(toks[k]) and not (
                len(toks[k]) == 1 and k + 1 < len(toks) and not es_piso(" ".join(toks[k + 1:]))):
            k += 1
        quedan = " ".join(toks[k:]).strip(" ,.-")
        if quedan and re.search(r"[^\W\d_]{3,}", quedan) and not es_piso(quedan):
            if es_pueblo(loc_limpia(quedan, pais), cp, pais):
                extra_loc.append(quedan)
            else:
                no_pueblos.append(loc_limpia(quedan, pais))
    cn, tipo, familia = calle.strip(), "", ""
    mm = TIPO_RE.match(cn)
    if mm:
        t0 = norm(mm.group(1)).replace(" ", "").rstrip(".")
        t0 = {"c/": "c", "c/.": "c", "r/": "r", "p.o": "po", "pº": "po", "p.º": "po", "bº": "bo"}.get(t0, t0)
        t0 = t0.replace("º", "o")
        if t0 in TIPO_FAMILIA or t0 == "travesa":
            tipo, familia, cn = mm.group(1), TIPO_FAMILIA.get(t0, "travesia"), mm.group(2).strip()
            m2 = re.match(r"^de\s+(.*)$", cn, re.I)          # «Lugar de Xobre» -> «Xobre»
            if familia == "lugar" and m2:
                cn = m2.group(1)
    if not familia:
        # El tipo con un carácter mal leído por el OCR («Colzada», «Avcnida», «Trauesía»): si se parece mucho a un
        # tipo largo, lo es.
        mm = TIPO_RE.match(cn)
        if mm:
            t0 = norm(des_ocr(mm.group(1))).rstrip(".")
            largos = [t for t in TIPO_FAMILIA if len(t) >= 5]
            casi = difflib.get_close_matches(t0, largos, n=1, cutoff=0.84) if len(t0) >= 5 else []
            if casi:
                tipo, familia, cn = mm.group(1), TIPO_FAMILIA[casi[0]], mm.group(2).strip()
    if not familia:
        mm = re.match(r"^(.*\S)\s+([^\W\d_]+)\.?$", cn)
        if mm and norm(mm.group(2)) in ("kalea", "k", "etorbidea", "hiribidea", "plaza", "enparantza",
                                        "pasealekua", "bidea", "errepidea", "zumarkalea"):
            tipo, cn = mm.group(2), mm.group(1)
            familia = {"kalea": "calle", "k": "calle", "etorbidea": "avenida", "hiribidea": "avenida",
                       "pasealekua": "paseo", "bidea": "camino", "errepidea": "carretera",
                       "zumarkalea": "calle"}.get(norm(tipo), "plaza")
    locs, tras_cp = [], None
    for i, t in enumerate(trozos):
        if i in usados or i < calle_i:
            continue
        if t == "#CP":
            tras_cp = len(locs)
            continue
        if re.search(r"\d", t) or es_piso(t) or not re.search(r"[^\W\d_]{2,}", t):
            continue
        if not es_pueblo(loc_limpia(t.strip(), pais), cp, pais):
            # La provincia con el CP de otro municipio, o el país (03-11-2026).
            no_pueblos.append(loc_limpia(t.strip(), pais))
            continue
        locs.append(t.strip())
    locs = [loc_limpia(x, pais) for x in extra_loc + locs]
    if campo and solo(campo) not in [solo(x) for x in locs]:
        locs.append(campo)
    sin_prov = [x for x in locs if solo(x) not in _provincias(pais)]
    if sin_prov and len(sin_prov) < len(locs):
        locs = sin_prov                     # «Ordes, A Coruña»: la provincia sobra si hay pueblo
    vistos, unicos = set(), []
    for x in locs:
        if muni_clave(x) not in vistos:
            vistos.add(muni_clave(x))
            unicos.append(x)
    locs = unicos
    if campo:
        principal = campo
    elif tras_cp is not None and locs:
        k = min(len(locs) - 1, tras_cp + len(extra_loc))
        principal = locs[k]
    else:
        principal = locs[-1] if locs else ""
    otros = [x for x in locs if muni_clave(x) != muni_clave(principal)]
    # «provincia» (03-11-2026): sin ningún pueblo, lo escrito que dice el sitio sin serlo (la provincia con el CP de
    # otro municipio, el país…). No es un pueblo para comparar, pero la etiqueta no va sin sitio (lugar_nivel).
    return {"tipo": tipo, "familia": familia, "nombre": cn.strip(" ,.-"), "num": num, "letra": letra, "sn": sn,
            "cp": cp, "localidades": locs, "loc": principal, "otros": otros,
            "provincia": no_pueblos[0] if no_pueblos and not locs else ""}


def sin_articulo(nombre) -> str:
    return re.sub(r"^(?:(?:de las|de los|de la|del|de|da|do|das|dos|la|el|los|las|a|o|os|as)\s+|d'|l')+", "",
                  nombre.strip(), flags=re.I).strip() or nombre.strip()


def tipo_completo(p) -> str:
    """El tipo de vía escrito entero para Nominatim y Photon («Avda.» -> «Avenida»; «R/» -> «Rúa»). En los lugares
    no se pone: OpenStreetMap los guarda sin «Lugar»."""
    if not p["familia"] or p["familia"] == "lugar":
        return ""
    t = p["tipo"]
    if len(t) >= 4 and not t.endswith((".", "/")):
        return t
    if norm(t).startswith("r"):
        return "Rúa"
    return TIPO_LARGO.get(p["familia"], "")


# ── ¿está donde dice la etiqueta? ────────────────────────────────────────────

def _loc_coincide(texto, *nombres) -> bool:
    """¿Es el mismo pueblo? Igual (con los alias), o igual a una parte de un nombre doble del callejero
    («Pamplona/Iruña») o de Photon («Biduído - Ames»: la parroquia y el concello), o, si el más corto tiene varias
    palabras («As Pontes»), dentro del otro. Uno de una palabra no vale dentro de otro: «Burgos» no es «San Mamés de
    Burgos»."""
    a = muni_clave(texto)
    if len(a) < 3:
        return False
    for n in nombres:
        # « - » con espacios (02-11-2026): «A Igrexa 2, 15896, Ames» con el «Biduído - Ames» de Photon no se daba por
        # el mismo pueblo y solo pasaba por caer cerca del centro del CP, que con pueblo ya no basta (lugar_nivel).
        for parte in [n or ""] + re.split(r"/|\s+-\s+", str(n or "")):
            b = muni_clave(parte)
            if not b:
                continue
            if a == b:
                return True
            corto, largo = (a, b) if len(a) <= len(b) else (b, a)
            if len(corto.split()) >= 2 and re.search(r"(^| )" + re.escape(corto) + r"( |$)", largo):
                return True
    return False


def pueblos_reales(p) -> list:
    """Los pueblos de la etiqueta que dicen de verdad dónde cae (02-11-2026): sin el que se llama como la propia vía. En
    «O Toural nº 34, 36141, O Toural» el pueblo es el lugar mismo y no dice de qué concello es: como si no lo trajera."""
    locs = p["localidades"] or ([p["loc"]] if p["loc"] else [])
    via = nucleo(p["nombre"]) if p["nombre"] else ""
    return [x for x in locs if not via or nucleo(x) != via]


def lugar_nivel(p, ctx, cp_c, muni_c, otros_c, punto_c) -> int:
    """¿Está donde dice la etiqueta?
      2: sí. El pueblo coincide, o el CP es el mismo, o, si la etiqueta no trae pueblo, está a 6 km o menos del centro
         de su CP (un CP mal escrito suele ser el de al lado). Sin pueblo ni CP, a 30 km o menos de la base (o del móvil).
      1: un sitio VECINO (02-11-2026, revisión S1): la etiqueta trae su pueblo, ni el pueblo ni el CP coinciden y está a
         6 km o menos del centro del CP. Es la calle que se llama igual en el concello de al lado («Rúa Nova 5, 15570
         Narón» y la «Rúa Nova 5, 15403 Ferrol» a 4 km): antes se daba por el portal y la app guiaba allí sin avisar.
         Ahora nunca es la parada; como mucho, una sugerencia.
      0: otro sitio."""
    locs = p["localidades"] or ([p["loc"]] if p["loc"] else [])
    if any(_loc_coincide(x, muni_c, *otros_c) for x in locs):
        return 2
    if p["cp"]:
        if cp_c and str(cp_c) == p["cp"]:
            return 2
        if ctx.get("cp_punto") and punto_c and metros(punto_c, ctx["cp_punto"]) <= 6000:
            # Con la provincia (o el país) escrita y sin pueblo (03-11-2026), como con pueblo: «…, 15179 A Coruña»
            # contaba la ciudad como su pueblo; ahora no lo es, y lo de al lado tampoco pasa a ser la parada.
            return 1 if pueblos_reales(p) or p.get("provincia") else 2
        return 0
    if ctx.get("base") and punto_c and not locs and not p.get("provincia"):
        return 2 if metros(punto_c, ctx["base"]) <= 30000 else 0
    return 0


def lugar_ok(p, ctx, cp_c, muni_c, otros_c, punto_c) -> bool:
    """Es el sitio de la etiqueta (lugar_nivel 2). Un sitio vecino no vale."""
    return lugar_nivel(p, ctx, cp_c, muni_c, otros_c, punto_c) == 2


# ── CartoCiudad ───────────────────────────────────────────────────────────────

TIPO_CC = {"calle": "calle", "avenida": "avenida", "plaza": "plaza", "paseo": "paseo", "ronda": "ronda",
           "travesia": "travesia", "camino": "camino", "carretera": "carretera", "lugar": "lugar",
           "glorieta": "glorieta", "urbanizacion": "urbanizacion", "barrio": "barrio"}
# Palabras gallegas que el callejero oficial escribe a veces en castellano (A Coruña: «AVENIDA MARINA»). Solo
# nombres comunes; los apellidos y nombres propios no se tocan.
GL_ES = {"rua": "calle", "praza": "plaza", "estrada": "carretera", "camino": "camino", "igrexa": "iglesia",
         "ponte": "puente", "fonte": "fuente", "nova": "nueva", "vella": "vieja", "porto": "puerto",
         "xeneral": "general", "doutor": "doctor", "marina": "marina", "raina": "reina", "castelo": "castillo",
         "mosteiro": "monasterio", "cruceiro": "crucero", "areal": "arenal", "pasaxe": "pasaje",
         "xardin": "jardin", "xunqueira": "junquera", "san xoan": "san juan", "xose": "jose", "afonso": "alfonso"}


def castellaniza(nombre) -> str:
    s = " " + solo(nombre) + " "
    for a, b in GL_ES.items():
        s = s.replace(" " + a + " ", " " + b + " ")
    return s.strip()


def familia_cc(tip_via) -> str:
    t = solo(str(tip_via or "").split(",")[0])
    t = {"rua": "calle", "carrer": "calle", "kalea": "calle", "praza": "plaza", "placa": "plaza",
         "avinguda": "avenida", "passeig": "paseo", "cami": "camino", "calleja": "callejon",
         "travessera": "travesia"}.get(t, t)
    return TIPO_FAMILIA.get(t, t)


def consultas_cc(p, ctx) -> list:
    """Las formas que entiende CartoCiudad (medido el 02-11-2026): con el CP dentro no contesta; con «rúa» o «avenida
    da» delante tampoco (o da basura); sí con el nombre a secas y el pueblo («real 1, a coruña»). Sin pueblo, el
    municipio del CP (CartoCiudad lo da en la inversa del centro del CP). Como mucho cuatro."""
    if not p["nombre"]:
        return []
    sa = sin_articulo(p["nombre"])
    num = (p["num"] + (" " + p["letra"] if p["letra"] else "")) if p["num"] else ""
    base = f"{sa} {num}".strip()
    locs = []
    if p["loc"]:
        locs.append(oficial(p["loc"]))
    if ctx.get("cp_muni") and muni_clave(ctx["cp_muni"]) not in [muni_clave(x) for x in locs]:
        locs.append(ctx["cp_muni"])
    for x in p["otros"]:
        if muni_clave(x) not in [muni_clave(y) for y in locs]:
            locs.append(x)
    qs = [f"{base}, {lc}" for lc in locs[:2]]
    if p["letra"] and locs:
        # «6A» que en el callejero es «6»: el número sin la letra (se acepta con la letra distinta).
        qs.insert(1, f"{sa} {p['num']}, {locs[0]}")
    if p["familia"] in TIPO_CC and locs:
        qs.append(f"{TIPO_CC[p['familia']]} {base}, {locs[0]}")
    cast = castellaniza(sa)
    if cast != solo(sa) and locs:
        qs.append(f"{cast} {num}, {locs[0]}".replace("  ", " "))
    if des_ocr(sa) != sa and locs:
        # Un carácter mal leído («Lug0», «Rarnbla»): CartoCiudad no lo tolera siempre.
        qs.insert(1, f"{des_ocr(sa)} {num}, {locs[0]}")
    if not locs:
        qs.append(base)
    vistos, out = set(), []
    for q in qs:
        q = q.replace('"', " ").replace("  ", " ")      # CartoCiudad contesta 500 con unas comillas dentro
        if q.lower() not in vistos:
            vistos.add(q.lower())
            out.append(q)
    return out[:4]


def confianza(c, p, sim) -> tuple:
    """Cuánto cuadra un portal oficial con la etiqueta: nombre (2 si es el mismo, 1 si casi), tipo de vía (+1 el mismo,
    -1 otro), CP (+1 el mismo, -1 otro) y población (+1; +0,5 más si la entidad se llama como el pueblo de la etiqueta,
    que desempata entre dos portales iguales del mismo concello)."""
    nombre = 2 if sim >= 0.95 else (1 if sim >= 0.86 else 0)
    fam = 0
    if p["familia"]:
        fam_c = familia_cc(c.get("tip_via"))
        fam = 1 if (fam_c == p["familia"] or {fam_c, p["familia"]} <= {"calle", "lugar", "barrio", "callejon"}) else -1
    cp_c = str(c.get("postalCode") or "")
    cp = 0 if not (p["cp"] and cp_c) else (1 if cp_c == p["cp"] else -1)
    pueblo = 1 if any(_loc_coincide(x, c.get("muni") or "", c.get("poblacion") or "") for x in p["localidades"]) else 0
    if pueblo and c.get("poblacion") and any(_loc_coincide(x, c["poblacion"]) for x in p["localidades"]):
        pueblo += 0.5
    return nombre + fam + cp + pueblo, {"nombre": nombre, "tipo": fam, "cp": cp, "pueblo": pueblo}


def nivel_portal(x, p, ctx) -> str:
    """seguro / dudoso / flojo: lo que hace falta para dar un portal. SEGURO: el nombre cuadra, el tipo de vía no
    contradice y el CP es el mismo (o no hay CP y el pueblo es el mismo). DUDOSO: el pueblo es el mismo o el CP es
    vecino. FLOJO: se queda en calle."""
    sim, pt = x["sim"], x["partes"]
    cp_igual = pt["cp"] == 1
    cp_vecino = False
    # El CP vecino solo cuenta si la etiqueta no trae pueblo (02-11-2026, revisión S1: con pueblo es lugar_nivel 1).
    if p["cp"] and not cp_igual and ctx.get("cp_punto") and not pueblos_reales(p) and not p.get("provincia"):
        cp_vecino = metros((x["c"]["lat"], x["c"]["lng"]), ctx["cp_punto"]) <= 6000
    if sim >= 0.86 and pt["tipo"] >= 0 and (cp_igual or (not p["cp"] and pt["pueblo"] >= 1)):
        return "seguro"
    if sim >= 0.86 and (pt["pueblo"] >= 1 or cp_igual or cp_vecino) and not (pt["tipo"] < 0 and sim < 0.95):
        return "dudoso"
    return "flojo"


def _distintas(a, b) -> bool:
    """Dos resultados que son sitios distintos: a más de 150 m (otra calle, otro municipio o el mismo portal dos veces
    en el callejero, que pasa: «AVENIDA ANCARES 14» en Vega de Espinareda, a 753 m uno de otro)."""
    return metros((a["c"]["lat"], a["c"]["lng"]), (b["c"]["lat"], b["c"]["lng"])) > M_PORTAL


def elegir_cc(cands, p, ctx) -> dict:
    """De lo que devuelve CartoCiudad: el portal de ESE número en ESA calle y ESE sitio, con su estado («seguro»,
    «dudoso», «ambiguo», «flojo»); si no, la calle (el portal de número más cercano o el tramo); si no, la entidad de
    población con ese nombre (rural). Devuelve también los portales y calles que cuadran (las sugerencias)."""
    portales, calles, lugares, vecinos = [], [], [], []
    for c in cands:
        t = str(c.get("type") or "").lower()
        punto_c = (c["lat"], c["lng"]) if c.get("lat") and c.get("lng") else None
        if t in ("portal", "callejero"):
            nombre_c = nombre_via_cc(c)
            sim = max(parecido(p["nombre"], nombre_c), parecido(castellaniza(p["nombre"]), nombre_c))
            if sim < 0.80:
                continue
            nivel_l = lugar_nivel(p, ctx, c.get("postalCode") or "", c.get("muni") or "", [c.get("poblacion") or ""],
                                  punto_c)
            if nivel_l == 1 and t == "portal" and sim >= 0.86 and p["num"] and str(c.get("portalNumber")) == p["num"]:
                vecinos.append(c)            # ese portal en el concello de al lado: solo se sugiere (revisión S1)
            if nivel_l != 2:
                continue
            conf, partes = confianza(c, p, sim)
            if t == "portal" and p["num"] and str(c.get("portalNumber")) == p["num"]:
                ext = (c.get("extension") or "").strip().upper()
                portales.append({"conf": conf - (0 if ext == p["letra"] else 0.5), "sim": sim, "c": c,
                                 "nombre": nombre_c, "partes": partes})
            elif t == "portal":
                calles.append({"conf": conf, "sim": sim, "c": c, "nombre": nombre_c, "tipo": "otro_numero"})
            else:
                calles.append({"conf": conf, "sim": sim, "c": c, "nombre": nombre_c, "tipo": "callejero"})
        elif t in ("poblacion", "toponimo", "ngbe") and p["familia"] in ("lugar", "", "barrio"):
            nom = str(c.get("poblacion") or c.get("address") or "").split(",")[0]
            if parecido(p["nombre"], nom) >= 0.85 and solo(nom) != solo(c.get("muni") or "") and \
                    lugar_ok(p, ctx, c.get("postalCode") or "", c.get("muni") or "", [], punto_c):
                lugares.append((parecido(p["nombre"], nom), c))
    portal, estado = None, None
    if portales:
        orden_nivel = {"seguro": 0, "dudoso": 1, "flojo": 2}
        for x in portales:
            x["nivel"] = nivel_portal(x, p, ctx)
        portales.sort(key=lambda x: (orden_nivel[x["nivel"]], -x["conf"], -x["sim"]))
        mejor = portales[0]
        # Dos sitios distintos con ese número que cuadran casi igual (o el nombre de la etiqueta se queda corto para
        # los dos, como «A Igrexa» en un concello con una Igrexa por parroquia): no se sabe cuál.
        rivales = [x for x in portales[1:] if _distintas(x, mejor) and x["nivel"] != "flojo" and
                   ((x["nivel"] == mejor["nivel"] and x["conf"] > mejor["conf"] - 0.5) or
                    (mejor["sim"] < 0.95 and x["sim"] >= 0.80 and nucleo(x["nombre"]) != nucleo(mejor["nombre"])))]
        if rivales:
            estado = "ambiguo"
        else:
            estado = mejor["nivel"]
            c = mejor["c"]
            if estado == "flojo":            # se queda en calle
                calles.append({"conf": mejor["conf"], "sim": mejor["sim"], "c": c, "nombre": mejor["nombre"],
                               "tipo": "portal_flojo"})
            else:
                portal = {"lat": c["lat"], "lng": c["lng"], "precision": "portal", "fuente": "cartociudad",
                          "direccion": texto_cc(c, cp=p["cp"])}
    calle = None
    if calles and estado != "ambiguo":
        def orden(x):
            dif = 9999.0
            if x["tipo"] in ("otro_numero",) and p["num"]:
                try:
                    n = int(x["c"].get("portalNumber"))
                    dif = abs(n - int(p["num"])) + (0.0 if (n - int(p["num"])) % 2 == 0 else 0.5)
                except (TypeError, ValueError):
                    pass
            return (-x["conf"], 0 if (p["sn"] and x["tipo"] == "callejero") else 1, dif)
        calles.sort(key=orden)
        mejor_c = calles[0]
        otras = [x for x in calles[1:] if x["conf"] > mejor_c["conf"] - 0.5 and _distintas(x, mejor_c)
                 and nucleo(x["nombre"]) != nucleo(mejor_c["nombre"])]
        if not otras:
            calle = {"cand": mejor_c["c"], "tipo": mejor_c["tipo"]}
    lugar = max(lugares, key=lambda x: x[0])[1] if lugares and estado != "ambiguo" else None
    return {"portal": portal, "estado": estado, "calle": calle, "lugar": lugar,
            "portales": [x for x in portales if x.get("nivel") != "flojo"], "calles": calles, "vecinos": vecinos}


# ── OpenStreetMap (Nominatim y Photon), con la precisión que de verdad tienen ─

def _num_ok(hn, p) -> bool:
    hn = str(hn or "").upper().replace(" ", "")
    return bool(p["num"] and hn and re.match(r"^" + re.escape(p["num"]) + r"(?![0-9])", hn))


def nominatim_clasifica(x, p) -> tuple:
    """(precisión, parecido) de un resultado de Nominatim: «portal» solo si es ESE número en ESA calle; «calle» si es
    la calle; «lugar» si es la aldea o el barrio con ese nombre; si no, «zona» (que aquí no vale)."""
    a = x.get("address") or {}
    via = a.get("road") or a.get("pedestrian") or a.get("footway") or a.get("square") or a.get("place") or \
        a.get("hamlet") or a.get("isolated_dwelling") or ""
    sim = parecido_osm(p["nombre"], via) if via else 0.0
    if _num_ok(a.get("house_number"), p) and sim >= 0.86:
        return "portal", sim
    # La calle en el otro idioma (Bilbao: la etiqueta dice «Errosario Santua kalea» y Nominatim contesta en castellano
    # «Calle del Santo Rosario»): vale la casa con ESE número, en ESE CP y en ESE pueblo, si el nombre se parece algo.
    sitio = a.get("city") or a.get("town") or a.get("village") or a.get("municipality") or ""
    if _num_ok(a.get("house_number"), p) and sim >= 0.45 and p["cp"] and str(a.get("postcode") or "") == p["cp"] \
            and x.get("class") in ("place", "building", "amenity", "shop", "office", "healthcare", "craft") \
            and any(_loc_coincide(lc, sitio) for lc in p["localidades"]):
        return "portal", sim
    if sim >= 0.80 and (x.get("class") == "highway" or x.get("addresstype") in ("road", "street", "place") or
                        a.get("house_number")):
        return "calle", sim
    if x.get("class") == "place" and x.get("type") in ("hamlet", "isolated_dwelling", "farm", "neighbourhood",
                                                       "locality", "village", "quarter") and \
            parecido(p["nombre"], x.get("name") or "") >= 0.85:
        return "lugar", sim
    return "zona", sim


def nominatim_lugar_nivel(x, p, ctx) -> int:
    """lugar_nivel de un resultado de Nominatim: 2 el sitio de la etiqueta, 1 un concello vecino, 0 otro."""
    a = x.get("address") or {}
    pt = (float(x["lat"]), float(x["lon"]))
    sitios = [a.get(k) or "" for k in ("city", "town", "village", "municipality", "hamlet", "suburb", "city_district",
                                       "county", "quarter", "neighbourhood")]
    return lugar_nivel(p, ctx, str(a.get("postcode") or ""), next((s for s in sitios if s), ""), sitios, pt)


def photon_clasifica(f, p, ctx, pais="es") -> tuple:
    """(precisión, punto, nivel) de un resultado de Photon, o (None, None, 0) si no vale: del país de la cuenta, en el
    sitio de la etiqueta (nivel 2; 1 si es un concello vecino, que solo se sugiere: lugar_nivel) y, para ser portal,
    una casa con ESE número en ESA calle."""
    pr = f.get("properties") or {}
    if (pr.get("countrycode") or "").lower() != pais:
        return None, None, 0
    try:
        lng, lat = (float(v) for v in f["geometry"]["coordinates"][:2])
    except (KeyError, TypeError, ValueError):
        return None, None, 0
    via = pr.get("street") or (pr.get("name") if pr.get("type") == "street" else "") or ""
    sim = parecido_osm(p["nombre"], via) if via else 0.0
    sitio = [pr.get(k) or "" for k in ("city", "district", "locality", "county")]
    nivel = lugar_nivel(p, ctx, str(pr.get("postcode") or ""), sitio[0], sitio[1:], (lat, lng))
    if not nivel:
        return None, None, 0
    if pr.get("type") == "house" and _num_ok(pr.get("housenumber"), p) and sim >= 0.86:
        return "portal", (lat, lng), nivel
    if sim >= 0.80 and pr.get("type") in ("street", "house"):
        return "calle", (lat, lng), nivel
    if pr.get("type") in ("locality", "district") and parecido(p["nombre"], pr.get("name") or "") >= 0.85:
        return "lugar", (lat, lng), nivel
    return None, None, 0


# ── lo que se enseña: el texto de cada sitio encontrado ─────────────────────────

_MINUSCULAS = {"de", "del", "la", "las", "el", "los", "da", "do", "das", "dos", "y", "e", "i", "en", "na", "o", "a",
               "os", "as", "al", "dels", "les", "por", "sobre"}
_ROMANO = re.compile(r"^(?=[MDCLXVI])M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$")
_TIPO_BONITO = {"RUA": "Rúa", "TRAVESIA": "Travesía", "CALLEJON": "Callejón", "URBANIZACION": "Urbanización",
                "POLIGONO": "Polígono", "PLACA": "Plaça", "CAMI": "Camí"}


def _titulo(texto, detras=False) -> str:
    """«CALLE DE LA PAZ» -> «Calle de la Paz»; «ALFONSO XIII» -> «Alfonso XIII»; «PUXEIROS-MOS» -> «Puxeiros-Mos».
    Con `detras`, va detrás de otra palabra (el nombre tras el tipo de vía): su artículo inicial, en minúscula."""
    out = []
    for i, w in enumerate(str(texto or "").replace('"', "'").split(), 1 if detras else 0):
        limpio = w.strip(",.")
        if len(limpio) >= 2 and limpio.isupper() and _ROMANO.match(limpio):
            out.append(w)
            continue
        lw = w.lower()
        if i > 0 and lw.strip(",") in _MINUSCULAS:
            out.append(lw)
            continue
        m = re.match(r"^([dl])'(.+)$", lw)
        if m:
            out.append(f"{m.group(1)}'{m.group(2)[:1].upper()}{m.group(2)[1:]}")
            continue
        out.append("-".join(x[:1].upper() + x[1:] for x in lw.split("-")))
    return " ".join(out)


def _sin_coma(nombre) -> str:
    """«CASTELO, DO» -> «DO CASTELO»; «SALANOVA, RAMON» -> «RAMON SALANOVA»: el callejero pone delante lo que ordena."""
    if str(nombre).count(",") == 1:
        a, b = (x.strip() for x in str(nombre).split(","))
        if a and b and len(b.split()) <= 3:
            return f"{b} {a}"
    return str(nombre)


def texto_cc(c, con_numero=True, cp="") -> str:
    """Un resultado de CartoCiudad como se le enseña a quien reparte: «Rúa do Castelo 27, 27600 Sarria»; una entidad
    de población, «A Pasaxe-O Burgo, A Coruña»."""
    t = str(c.get("type") or "").lower()
    tv = str(c.get("tip_via") or "").strip()
    pob, muni = str(c.get("poblacion") or ""), str(c.get("muni") or "")
    num = ""
    if t in ("portal", "callejero"):
        tipo = _TIPO_BONITO.get(tv.upper(), _titulo(tv)) if tv else ""
        via = " ".join(x for x in (tipo, _titulo(_sin_coma(nombre_via_cc(c)), detras=bool(tipo))) if x)
        if con_numero and t == "portal" and c.get("portalNumber") not in (None, ""):
            ext = str(c.get("extension") or "").strip()
            num = f"{c['portalNumber']}{ext if len(ext) == 1 else (' ' + ext if ext else '')}"
    else:
        via = re.split(r"\s*[(\[,]", str(c.get("address") or pob))[0].strip()
        via = _titulo(via) if via.isupper() else via
        if solo(via) == solo(pob):
            pob = ""
    via = " ".join(x for x in (via, num) if x)
    cps = str(c.get("postalCode") or "").split()
    cp_txt = cp if cp and cp in cps else (cps[0] if cps else "")
    sitio = muni if (not pob or solo(pob) == solo(muni)) else (f"{pob} ({muni})" if muni else pob)
    return ", ".join(x for x in (via, " ".join(y for y in (cp_txt, sitio) if y)) if x)


def texto_photon(f, con_numero=True) -> str:
    pr = f.get("properties") or {}
    via = pr.get("street") or pr.get("name") or ""
    num = str(pr.get("housenumber") or "") if con_numero and pr.get("street") else ""
    sitio = pr.get("city") or pr.get("district") or pr.get("locality") or pr.get("county") or ""
    return ", ".join(x for x in (" ".join(y for y in (via, num) if y),
                                 " ".join(y for y in (str(pr.get("postcode") or ""), sitio) if y)) if x)


def texto_nominatim(x, con_numero=True) -> str:
    a = x.get("address") or {}
    via = a.get("road") or a.get("pedestrian") or a.get("footway") or a.get("square") or a.get("place") or \
        a.get("hamlet") or a.get("isolated_dwelling") or x.get("name") or ""
    num = str(a.get("house_number") or "") if con_numero else ""
    sitio = a.get("city") or a.get("town") or a.get("village") or a.get("municipality") or ""
    return ", ".join(y for y in (" ".join(z for z in (via, num) if z),
                                 " ".join(z for z in (str(a.get("postcode") or ""), sitio) if z)) if y)


def consulta_texto(p, pais="es") -> str:
    """Lo leído de la etiqueta como UNA consulta de texto (02-11-2026): «Rúa Real 1, 15003 A Coruña», «10 Downing
    Street, London». Sin el piso, «Nº» ni la provincia repetida. Es lo que el servidor le da a un buscador de texto libre
    (Amap, en China) y con lo que ve si hay algo que buscar; antes salía de reparto.direccion_para_buscar, que se comía
    «An der Alster 12» hasta «An»."""
    num = (p["num"] + p["letra"]) if p["num"] else ""
    via = " ".join(x for x in (p["tipo"], p["nombre"]) if x)
    calle = " ".join(x for x in ((num, via) if pais in NUMERO_DELANTE else (via, num)) if x)
    if p["sn"] and not num and via:
        calle += " s/n"
    return ", ".join(x for x in (calle, " ".join(y for y in (p["cp"], p["loc"]) if y)) if x)


# ── el trazado de una calle oficial ───────────────────────────────────────────

def _partes_wkt(g, maximo=400) -> list:
    """Los tramos [[(lat, lng), …], …] de la geometría de una calle de CartoCiudad («LINESTRING(…)» o
    «MULTILINESTRING((…),(…))», lng delante); de otra (un pueblo entero, un punto), ninguno. Como mucho `maximo`
    vértices entre todos, repartidos a lo largo y sin perder el primero ni el último de cada tramo (para la caché)."""
    g = str(g or "").strip()
    if not re.match(r"^(MULTI)?LINESTRING\b", g, re.I):
        return []
    partes = []
    for trozo in re.findall(r"\(([^()]+)\)", g):
        pts = []
        for par in trozo.split(","):
            xy = par.split()
            if len(xy) >= 2:
                try:
                    pts.append((float(xy[1]), float(xy[0])))
                except ValueError:
                    continue
        if pts:
            partes.append(pts)
    total = sum(len(x) for x in partes)
    if total > maximo:
        paso = math.ceil(total / maximo)
        partes = [x[::paso] + ([x[-1]] if (len(x) - 1) % paso else []) for x in partes]
    return partes


def trazado(j) -> list:
    """Los tramos de una calle de CartoCiudad (lo que devuelve find?id=): los que guardó la red («linea»), los de su
    geometría si viene entera o, si no hay, su punto como un tramo de un vértice."""
    if isinstance(j.get("linea"), list) and j["linea"]:
        return [[tuple(q) for q in parte] for parte in j["linea"] if parte]
    partes = _partes_wkt(j.get("geom"))
    if partes:
        return partes
    pt = punto_valido(j.get("lat"), j.get("lng"))
    return [[pt]] if pt else []


def a_la_calle(pt, j) -> float:
    """Metros de `pt` a la calle `j`, tramo a tramo (en plano local: sobra para unos km); sin trazado, infinito."""
    kx, ky = 111320.0 * math.cos(math.radians(pt[0])), 110574.0
    mejor = math.inf
    for parte in trazado(j):
        xy = [((q[1] - pt[1]) * kx, (q[0] - pt[0]) * ky) for q in parte]
        if len(xy) == 1:
            mejor = min(mejor, math.hypot(*xy[0]))
        for (ax, ay), (bx, by) in zip(xy, xy[1:]):
            dx, dy = bx - ax, by - ay
            l2 = dx * dx + dy * dy
            k = 0.0 if l2 <= 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / l2))
            mejor = min(mejor, math.hypot(ax + k * dx, ay + k * dy))
    return mejor


# ── el reloj de la cadena ─────────────────────────────────────────────────────

class Reloj:
    """El tiempo de verdad de una búsqueda: cada paso tiene su tope y la cadena el suyo (TOPE_TOTAL). Apunta cada
    petición (servicio, segundos, estado) para la traza y cuenta los fallos y los pasos que no cupieron (`saltados`):
    lo que se encontró con un servicio caído o sin tiempo para preguntar a todos no se guarda en la caché de
    resultados."""

    def __init__(self, tope=TOPE_TOTAL, ahora=time.monotonic):
        self._ahora = ahora
        self.inicio = ahora()
        self.tope = tope
        self.pasos = []
        self.fallos = 0
        self.saltados = []

    def t(self) -> float:
        return self._ahora() - self.inicio

    def queda(self) -> float:
        return self.tope - self.t()

    def cabe(self, segundos, paso) -> bool:
        """¿Quedan más de `segundos`? Si no, el paso se salta y se apunta (02-11-2026, revisión S4): antes se saltaba
        Photon o Nominatim sin contarlo, la búsqueda salía «zona» con 0 fallos y el servidor la guardaba una hora como
        si fuera definitiva aunque Nominatim tuviera el portal."""
        if self.queda() > segundos:
            return True
        self.saltados.append(paso)
        return False

    def corte(self, tope) -> float:
        return max(0.0, min(tope, self.queda()))


async def _pide(red, reloj, srv, url, params, tope, idioma=None) -> tuple:
    """(ok, json) de una petición, con su tope recortado a lo que le queda a la cadena. 204 (CartoCiudad sin nada) es
    ok y vacío; lo demás que no sea 200 cuenta como fallo del servicio."""
    corte = reloj.corte(tope)
    if corte < 0.2:
        reloj.pasos.append({"srv": srv, "params": params, "seg": 0.0, "estado": "sin tiempo"})
        reloj.fallos += 1
        return False, None
    t0 = reloj.t()
    try:
        r = await red.get(srv, url, params, corte, idioma=idioma)
    except Exception as e:                                   # noqa: BLE001
        r = {"status": -1, "json": None, "error": type(e).__name__}
    estado = r.get("status")
    reloj.pasos.append({"srv": srv, "params": params, "seg": round(reloj.t() - t0, 3), "estado": estado,
                        "cache": bool(r.get("cache"))})
    if estado == 200:
        return True, r.get("json")
    if estado == 204:
        return True, None
    reloj.fallos += 1
    return False, None


def _lista(js) -> list:
    return js if isinstance(js, list) else []


# ── la cadena ─────────────────────────────────────────────────────────────────

def punto_de_salida(pt) -> tuple:
    """El punto con el que Photon ordena lo que da y alrededor del que Nominatim prefiere (el centro del CP o la base),
    a 2 decimales y como texto («43.37», «-8.40»), igual que las apps (03-11-2026: lib/direcciones.js aKm y la app
    nativa, «%.2f»). Unos 1 km basta para ordenar, y la base (en quien reparte solo, puede ser su casa) no sale
    exacta del servidor."""
    return (f"{float(pt[0]):.2f}", f"{float(pt[1]):.2f}")


async def ubicar(red, direccion, cp="", localidad="", base=None, pais="es", cerca=None, opciones=None, reloj=None):
    """La cadena entera. Devuelve (resultado, traza): resultado = {lat, lng, precision («portal», «calle» o «zona»),
    fuente, direccion (el texto de lo encontrado)} o None; traza = lo leído, cada petición, las decisiones y los
    candidatos (como mucho 6, el mejor primero: lo que la app enseña al situar la parada).

    `base` es el almacén: se usa para preferir lo cercano (se manda a Photon y a Nominatim, como siempre; desde el
    03-11-2026 a 2 decimales, unos 1 km: punto_de_salida) y para validar. `cerca` (la posición del móvil, redondeada)
    solo para validar: no sale del servidor.

    España: CartoCiudad, Photon, Nominatim, la calle y la zona. Fuera de España, o con opciones {"cc": False}, lo mismo
    sin CartoCiudad (sin preguntarle nada). La traza dice también si la búsqueda quedó incompleta (`incompleta`: algún
    servicio no contestó o algún paso no cupo en el tope; `saltados`, cuáles): lo que salga no es lo definitivo."""
    o = {"cc": pais == "es", "nominatim": True, "photon": True, "zona": True, "tope": TOPE_TOTAL,
         "orden": ("photon", "nominatim")}
    o.update(opciones or {})
    reloj = reloj or Reloj(o["tope"])
    idioma = "es" if pais == "es" else None
    traza = {"pasos": reloj.pasos, "candidatos": []}
    p = leer_etiqueta(direccion, cp, localidad, pais)
    traza["lectura"] = {k: p[k] for k in ("tipo", "familia", "nombre", "num", "letra", "sn", "cp", "loc", "otros")}
    ctx = {"base": base or cerca, "cp_punto": None, "cp_muni": "", "cp_fallo": False}
    junto = {"cc": {"portales": [], "calles": []}, "osm": [], "vecinos": []}
    # Sin CartoCiudad («cc»: False; 02-11-2026, revisión S3: las cuentas de empresa, hasta que se les avise del
    # subencargado nuevo con los 15 días del Encargo) no se le pregunta NADA: ni la calle, ni el centro del CP y su
    # municipio, ni el pueblo de la zona.
    cc = bool(o["cc"]) and pais == "es"

    def fin(res):
        if res and not punto_valido(res["lat"], res["lng"], pais):
            traza["fuera_del_pais"] = True
            res = None
        traza["segundos"] = round(reloj.t(), 3)
        traza["fallos"] = reloj.fallos
        # INCOMPLETA (02-11-2026, revisión S4): un servicio no contestó o un paso no cupo en el tope. Lo que salga
        # puede no ser lo mejor que hay: el servidor no lo guarda como lo definitivo y vuelve a buscar esa zona.
        traza["saltados"] = list(reloj.saltados)
        traza["incompleta"] = bool(reloj.fallos or reloj.saltados)
        traza["candidatos"] = _candidatos(res, junto, p, pais)
        return res, traza

    if not p["nombre"] and not p["cp"] and not p["loc"]:
        return fin(None)
    usa_cc = cc and bool(p["nombre"])
    cands, ids = [], set()

    def junta(lista):
        for c in lista:
            if not isinstance(c, dict):
                continue
            k = c.get("id") or (c.get("address"), c.get("lat"))
            if k not in ids:
                ids.add(k)
                cands.append(c)

    # 1) El centro del CP (para validar y como zona) a la vez que la primera consulta a CartoCiudad.
    tareas, que = [], []
    if cc and p["cp"]:
        tareas.append(_pide(red, reloj, "cartociudad", CC_FIND, {"q": p["cp"]}, TOPE_CC, idioma))
        que.append("cp")
    qs = consultas_cc(p, ctx) if usa_cc and p["loc"] else []
    if qs:
        tareas.append(_pide(red, reloj, "cartociudad", CC_CAND, {"q": qs[0], "limit": 10}, TOPE_CC, idioma))
        que.append("cc")
    resp = dict(zip(que, await asyncio.gather(*tareas))) if tareas else {}
    if "cp" in resp:
        ok, j = resp["cp"]
        if ok and isinstance(j, dict) and j.get("lat") and str(j.get("type") or "").lower() == "codpost":
            ctx["cp_punto"] = punto_valido(j.get("lat"), j.get("lng"), pais)
        elif not ok:
            ctx["cp_fallo"] = True
    if "cc" in resp and resp["cc"][0]:
        junta(_lista(resp["cc"][1]))
    hechas = 1 if qs else 0
    el = {"portal": None, "estado": None, "calle": None, "lugar": None, "portales": [], "calles": [], "vecinos": []}
    if usa_cc:
        el = elegir_cc(cands, p, ctx)
    # Sin pueblo en la etiqueta, o sin un portal seguro a la primera: el municipio del CP (inversa del centro del CP),
    # que es otra forma de preguntar y además dice si el CP y el pueblo de la etiqueta cuadran.
    if usa_cc and el["estado"] != "seguro" and ctx["cp_punto"] and reloj.cabe(2.0, "cartociudad-cp"):
        la, lo = ctx["cp_punto"]
        ok, j = await _pide(red, reloj, "cartociudad", CC_REV, {"lon": f"{lo:.6f}", "lat": f"{la:.6f}"}, TOPE_CC, idioma)
        if ok and isinstance(j, dict):
            ctx["cp_muni"] = j.get("muni") or ""
        qs = qs[:hechas] + [q for q in consultas_cc(p, ctx) if q not in qs[:hechas]]
    elif usa_cc and not qs:
        qs = consultas_cc(p, ctx)
    while usa_cc and el["estado"] != "seguro" and hechas < len(qs) and hechas < 4 and reloj.cabe(2.5, "cartociudad"):
        ok, j = await _pide(red, reloj, "cartociudad", CC_CAND, {"q": qs[hechas], "limit": 10}, TOPE_CC, idioma)
        hechas += 1
        if ok:
            junta(_lista(j))
            el = elegir_cc(cands, p, ctx)
    traza["cc_consultas"] = qs[:hechas]
    traza["cc_estado"] = el["estado"]
    junto["cc"] = el
    if el["portal"]:
        return fin(el["portal"])
    calle_cc, lugar_cc = el["calle"], el["lugar"]
    # 2) y 3) OpenStreetMap: Photon (tolerante, con el centro del CP como preferencia) y, si no dio portal, Nominatim
    # (estructurado; si no da nada, texto libre). Con Photon primero, Nominatim (1 por segundo para todo el servidor)
    # trabaja muy poco.
    osm = {"portal": None, "calle": None, "lugar": None}
    tc = tipo_completo(p)
    loc_osm = oficial(p["loc"]) if p["loc"] else ctx.get("cp_muni", "")

    def apunta(prec, pt, fuente, texto, cp_res=""):
        r = {"lat": pt[0], "lng": pt[1], "precision": "calle" if prec == "lugar" else prec, "fuente": fuente,
             "direccion": texto}
        if cp_res:
            r["cp"] = cp_res
        junto["osm"].append(r)
        return r

    async def paso_nominatim():
        if not (o["nominatim"] and p["nombre"]) or not reloj.cabe(2.0, "nominatim"):
            return
        via = " ".join(x for x in (p["num"] + p["letra"].lower() if p["num"] else "", tc, p["nombre"]) if x)
        params = {"street": via, "format": "json", "limit": 3, "countrycodes": pais, "addressdetails": 1}
        if loc_osm:
            params["city"] = loc_osm
        if p["cp"]:
            params["postalcode"] = p["cp"]
        ok, j = await _pide(red, reloj, "nominatim", NOMINATIM, params, TOPE_NOM, idioma)
        res = _lista(j) if ok else []
        if not res and (p["cp"] or loc_osm) and reloj.cabe(3.0, "nominatim-texto"):
            q = ", ".join(x for x in (" ".join(y for y in (tc, p["nombre"], p["num"]) if y), p["cp"], loc_osm) if x)
            params = {"q": q, "format": "json", "limit": 3, "countrycodes": pais, "addressdetails": 1}
            if base:
                la, lo = (float(x) for x in punto_de_salida(base))
                params["viewbox"] = f"{lo - 0.6:.2f},{la + 0.6:.2f},{lo + 0.6:.2f},{la - 0.6:.2f}"
            ok, j = await _pide(red, reloj, "nominatim", NOMINATIM, params, TOPE_NOM, idioma)
            res = _lista(j) if ok else []
        traza["nominatim"] = []
        for x in res:
            try:
                prec, _sim = nominatim_clasifica(x, p)
                nivel = nominatim_lugar_nivel(x, p, ctx)
                pt = (float(x["lat"]), float(x["lon"]))
            except (KeyError, TypeError, ValueError, AttributeError):
                continue
            # Del país de la cuenta (Nominatim ya filtra con countrycodes: esto es la red por si un día no lo hace).
            if not _del_pais(x, pt, pais):
                continue
            vale = nivel == 2
            traza["nominatim"].append({"prec": prec, "ok": vale, "class": x.get("class"), "type": x.get("type")})
            if nivel == 1 and prec == "portal":
                # Ese portal en el concello de al lado (02-11-2026, revisión S1): nunca la parada, solo una sugerencia.
                junto["vecinos"].append({"lat": pt[0], "lng": pt[1], "precision": "portal", "fuente": "nominatim",
                                         "direccion": texto_nominatim(x)})
            if not vale or prec == "zona":
                continue
            r = apunta(prec, pt, "nominatim" if prec != "lugar" else "nominatim-lugar",
                       texto_nominatim(x, prec == "portal"), str((x.get("address") or {}).get("postcode") or ""))
            if prec == "portal" and not osm["portal"]:
                osm["portal"] = r
            elif prec == "calle" and not osm["calle"]:
                osm["calle"] = r
            elif prec == "lugar" and not osm["lugar"]:
                osm["lugar"] = r

    async def paso_photon():
        if not (o["photon"] and p["nombre"]) or not reloj.cabe(1.5, "photon"):
            return
        q = ", ".join(x for x in (" ".join(y for y in (tc, p["nombre"], p["num"]) if y),
                                  " ".join(y for y in (p["cp"], loc_osm) if y)) if x)
        params = {"q": q, "limit": 8}
        sesgo = ctx.get("cp_punto") or base
        if sesgo:
            la, lo = punto_de_salida(sesgo)
            params.update({"lat": la, "lon": lo})
        ok, j = await _pide(red, reloj, "photon", PHOTON, params, TOPE_PHO, idioma)
        feats = ((j or {}).get("features") or []) if ok and isinstance(j, dict) else []
        for f in feats:
            if not isinstance(f, dict):
                continue
            prec, pt, nivel = photon_clasifica(f, p, ctx, pais)
            if not prec or not punto_valido(pt[0], pt[1], pais):
                continue
            if nivel < 2:
                # Un concello vecino (02-11-2026, revisión S1): la casa con ese número en la calle que se llama igual
                # en el de al lado. Nunca es la parada sola; como mucho, una sugerencia.
                if prec == "portal":
                    junto["vecinos"].append({"lat": pt[0], "lng": pt[1], "precision": "portal", "fuente": "photon",
                                             "direccion": texto_photon(f)})
                continue
            r = apunta(prec, pt, "photon" if prec != "lugar" else "photon-lugar", texto_photon(f, prec == "portal"),
                       str((f.get("properties") or {}).get("postcode") or ""))
            if prec == "portal":
                osm["portal"] = r
                break
            if prec == "calle" and not osm["calle"]:
                osm["calle"] = r
            if prec == "lugar" and not osm["lugar"]:
                osm["lugar"] = r

    for nombre_paso in o.get("orden", ("photon", "nominatim")):
        if osm["portal"]:
            break
        await (paso_nominatim if nombre_paso == "nominatim" else paso_photon)()
    portal, calle_osm, lugar_osm = osm["portal"], osm["calle"], osm["lugar"]
    tramo = {}

    async def del_tramo(c):
        """El tramo oficial con su punto y su trazado (find?id=), pedido una sola vez: para el contraste y la calle."""
        if "j" not in tramo:
            tramo["j"] = None
            if reloj.cabe(0.6, "cartociudad-tramo"):
                ok, j = await _pide(red, reloj, "cartociudad", CC_FIND, {"id": c["id"], "type": c.get("type")},
                                    TOPE_CC, idioma)
                if ok and isinstance(j, dict) and j.get("lat") and j.get("lng"):
                    tramo["j"] = j
        return tramo["j"]

    # Un portal de OpenStreetMap lejos de la calle oficial no se cree: se queda en calle. También contra el TRAMO
    # (02-11-2026, revisión S1): CartoCiudad da la calle sin portales con lat/lng 0,0 y antes no se contrastaba
    # (un portal del concello de al lado pasaba). Se pide su trazado y cuenta lo que queda del portal a la calle, no a su
    # punto: en una calle larga el punto puede estar a más de 1,5 km del portal bueno.
    if portal and calle_cc:
        c = calle_cc["cand"]
        lejos = False
        if c.get("lat") and c.get("lng"):
            lejos = metros((portal["lat"], portal["lng"]), (c["lat"], c["lng"])) > 1500
        elif c.get("id"):
            j = await del_tramo(c)
            d = a_la_calle((portal["lat"], portal["lng"]), j) if j else math.inf
            lejos = d != math.inf and d > 1500
        if lejos:
            traza["portal_osm_descartado"] = True
            junto["osm"] = [r for r in junto["osm"] if r is not portal]      # tampoco se sugiere
            portal = None
    if portal:
        return fin(_limpio(portal))

    # 4) La calle: solo si cae en el CP de la etiqueta (su CP, o a 5 km o menos de su centro). El tramo oficial
    # («callejero») de una calle larga cae en cualquier punto: solo si el CP de la etiqueta es uno de los suyos.
    def calle_creible(pt, cp_c=""):
        if not p["cp"]:
            return True
        if cp_c and p["cp"] in str(cp_c).split():
            return True
        return bool(ctx.get("cp_punto")) and metros(pt, ctx["cp_punto"]) <= 5000
    if calle_cc:
        c = calle_cc["cand"]
        if c.get("lat") and c.get("lng"):
            if calle_creible((c["lat"], c["lng"]), c.get("postalCode")):
                return fin({"lat": c["lat"], "lng": c["lng"], "precision": "calle",
                            "fuente": "cartociudad-" + calle_cc["tipo"], "direccion": texto_cc(c, False, p["cp"])})
        elif c.get("id") and (not p["cp"] or p["cp"] in str(c.get("postalCode") or "").split()):
            j = await del_tramo(c)
            if j and calle_creible((j["lat"], j["lng"]), c.get("postalCode")):
                return fin({"lat": j["lat"], "lng": j["lng"], "precision": "calle", "fuente": "cartociudad-callejero",
                            "direccion": texto_cc({**c, **{k: v for k, v in j.items() if v}}, False, p["cp"])})
    if calle_osm and calle_creible((calle_osm["lat"], calle_osm["lng"]), calle_osm.get("cp", "")):
        return fin(_limpio(calle_osm))
    if lugar_cc and lugar_cc.get("id") and reloj.cabe(0.6, "cartociudad-lugar"):
        ok, j = await _pide(red, reloj, "cartociudad", CC_FIND, {"id": lugar_cc["id"], "type": lugar_cc.get("type")},
                            TOPE_CC, idioma)
        if ok and isinstance(j, dict) and j.get("lat") and j.get("lng"):
            return fin({"lat": j["lat"], "lng": j["lng"], "precision": "calle", "fuente": "cartociudad-lugar",
                        "direccion": texto_cc({**lugar_cc, **{k: v for k, v in j.items() if v}}, False, p["cp"])})
    if lugar_osm:
        return fin(_limpio(lugar_osm))
    # 5) La zona, marcada como zona.
    if o["zona"]:
        z = await zona(red, p, ctx, reloj, pais, idioma, cc)
        if z:
            return fin(z)
    return fin(None)


def _limpio(r) -> dict:
    return {k: v for k, v in r.items() if k != "cp"}


def _del_pais(x, pt, pais) -> bool:
    """Un resultado de Nominatim del país de la cuenta (su country_code, si lo trae) y dentro de su caja, si la hay."""
    cc = str((x.get("address") or {}).get("country_code") or "").lower()
    return (not cc or cc == pais) and bool(punto_valido(pt[0], pt[1], pais))


async def _pueblo_exacto(red, loc, reloj, idioma="es") -> tuple:
    """(punto, «clase:provincia», ¿CartoCiudad falló?) del pueblo o la entidad que se llama EXACTAMENTE así. Si no es
    exactamente ese nombre, ninguno: «Miño» es el de A Coruña, no Miño de Medinaceli."""
    k = muni_clave(loc)
    ok, j = await _pide(red, reloj, "cartociudad", CC_FIND, {"q": oficial(loc)}, TOPE_CC, idioma)
    if ok and isinstance(j, dict):
        t = str(j.get("type") or "").lower()
        if j.get("lat") and t in ("municipio", "poblacion"):
            prov = str(j.get("provinceCode") or "")
            if k == muni_clave(j.get("muni") or "") or t == "municipio" and k == muni_clave(j.get("address") or ""):
                return (j["lat"], j["lng"]), "municipio:" + prov, False
            if k in (muni_clave(j.get("poblacion") or ""), muni_clave(j.get("address") or "")):
                return (j["lat"], j["lng"]), "entidad:" + prov, False
    return None, "", not ok


async def zona(red, p, ctx, reloj, pais="es", idioma="es", cc=True):
    """La zona, marcada como zona. Con CP: el centro del CP (CartoCiudad lo da con «find?q=15003»), o la entidad de
    población con el nombre exacto de la etiqueta si está a 15 km o menos de ese centro (una parroquia es más concreta
    que el CP), o el municipio de la etiqueta si el CP está lejos de él (el CP está mal). Sin CP: el pueblo con ese
    nombre exacto; una entidad suelta («O Toural»: hay decenas), solo cerca de la base. Fuera de España, con
    CartoCiudad sin contestar o sin poder preguntarle (`cc`), Nominatim con el CP y el pueblo."""
    # El texto, sin pueblo, con la provincia escrita (03-11-2026: «15179 A Coruña», como antes; no es su pueblo).
    sitio = p["loc"] or p.get("provincia") or ""
    texto_cp = " ".join(x for x in (p["cp"], oficial(sitio) if sitio else "") if x)
    # Sin permiso para CartoCiudad (02-11-2026, revisión S3), como si no contestara: la zona sale de Nominatim.
    cc_caido = bool(ctx.get("cp_fallo")) or not cc
    if pais == "es" and not cc_caido:
        pueblo, tipo = (None, "")
        if p["loc"] and reloj.cabe(0.6, "cartociudad-pueblo"):
            pueblo, tipo, cc_caido = await _pueblo_exacto(red, p["loc"], reloj, idioma)
    if pais == "es" and not cc_caido:
        clase, _, prov = tipo.partition(":")
        nombre = oficial(p["loc"]) if p["loc"] else ""
        if ctx.get("cp_punto"):
            if pueblo and clase == "entidad" and metros(pueblo, ctx["cp_punto"]) <= 15000:
                return {"lat": pueblo[0], "lng": pueblo[1], "precision": "zona", "fuente": "cartociudad-pueblo",
                        "direccion": texto_cp or nombre}
            if pueblo and clase == "municipio" and prov == p["cp"][:2] and metros(pueblo, ctx["cp_punto"]) > 10000:
                return {"lat": pueblo[0], "lng": pueblo[1], "precision": "zona", "fuente": "cartociudad-pueblo",
                        "direccion": nombre}
            return {"lat": ctx["cp_punto"][0], "lng": ctx["cp_punto"][1], "precision": "zona", "fuente": "cartociudad-cp",
                    "direccion": texto_cp}
        if pueblo and clase == "municipio" and (not p["cp"] or prov == p["cp"][:2]):
            return {"lat": pueblo[0], "lng": pueblo[1], "precision": "zona", "fuente": "cartociudad-pueblo",
                    "direccion": nombre}
        if pueblo and clase == "entidad" and ctx.get("base") and metros(pueblo, ctx["base"]) <= 30000:
            return {"lat": pueblo[0], "lng": pueblo[1], "precision": "zona", "fuente": "cartociudad-pueblo",
                    "direccion": nombre}
        return None
    if (p["cp"] or p["loc"]) and reloj.cabe(1.2, "nominatim-zona"):
        params = {"street": "", "format": "json", "limit": 3, "countrycodes": pais, "addressdetails": 1}
        if p["loc"]:
            params["city"] = oficial(p["loc"])
        if p["cp"]:
            params["postalcode"] = p["cp"]
        ok, j = await _pide(red, reloj, "nominatim", NOMINATIM, params, TOPE_NOM, idioma)
        for x in _lista(j) if ok else []:
            try:
                pt = (float(x["lat"]), float(x["lon"]))
            except (KeyError, TypeError, ValueError, AttributeError):
                continue
            if not _del_pais(x, pt, pais):
                continue
            a = x.get("address") or {}
            if p["cp"] and a.get("postcode") and str(a["postcode"]).replace(" ", "") != p["cp"].replace(" ", "") \
                    and not any(_loc_coincide(lc, a.get("city") or a.get("town") or a.get("village") or "")
                                for lc in p["localidades"]):
                continue
            return {"lat": pt[0], "lng": pt[1], "precision": "zona", "fuente": "nominatim-zona",
                    "direccion": texto_cp or texto_nominatim(x, False)}
    return None


# ── los candidatos que se enseñan al situar la parada ─────────────────────────

def _candidatos(res, junto, p, pais, n=6) -> list:
    """Lo encontrado primero; luego los portales oficiales que cuadran (también los dos de una etiqueta ambigua, que
    es justo cuando la persona tiene que elegir), el de OpenStreetMap, la calle oficial más cercana y la de OSM. Sin
    repetir un sitio (a menos de 25 m con la misma precisión, o la misma calle) y solo con punto de verdad. Como
    mucho 6."""
    lista = []
    if res:
        lista.append({k: res.get(k) for k in ("lat", "lng", "precision", "direccion", "fuente")})
    el = junto.get("cc") or {}
    for x in el.get("portales") or []:
        c = x["c"]
        lista.append({"lat": c.get("lat"), "lng": c.get("lng"), "precision": "portal",
                      "direccion": texto_cc(c, cp=p["cp"]), "fuente": "cartociudad"})
    osm = junto.get("osm") or []
    lista += [_limpio(r) for r in osm if r["precision"] == "portal"]
    for x in el.get("calles") or []:
        c = x["c"]
        if x["tipo"] in ("otro_numero", "portal_flojo") and c.get("lat") and c.get("lng"):
            lista.append({"lat": c["lat"], "lng": c["lng"], "precision": "calle",
                          "direccion": texto_cc(c, False, p["cp"]), "fuente": "cartociudad"})
            break
    lista += [_limpio(r) for r in osm if r["precision"] == "calle"]
    # Al final, ese portal en un concello vecino (02-11-2026, revisión S1): por si el pueblo de la etiqueta está mal.
    # La persona ve en el texto que es otro pueblo; nunca se elige solo.
    for c in el.get("vecinos") or []:
        lista.append({"lat": c.get("lat"), "lng": c.get("lng"), "precision": "portal", "direccion": texto_cc(c),
                      "fuente": "cartociudad"})
    lista += [_limpio(r) for r in junto.get("vecinos") or []]
    salida = []
    for c in lista:
        pt = punto_valido(c.get("lat"), c.get("lng"), pais)
        if not pt or not str(c.get("direccion") or "").strip():
            continue
        if any(s["precision"] == c["precision"] and metros(pt, (s["lat"], s["lng"])) < M_MISMO for s in salida):
            continue
        # Una calle basta una vez (una plaza grande sale en seis trozos); dos portales con el mismo texto en dos
        # sitios, no: son los de una etiqueta ambigua, y la persona tiene que ver los dos.
        if c["precision"] != "portal" and any(s["precision"] == c["precision"] and solo(s["direccion"]) == solo(c["direccion"])
                                              for s in salida):
            continue
        salida.append({"lat": pt[0], "lng": pt[1], "precision": c["precision"], "direccion": c["direccion"],
                       "fuente": c.get("fuente") or ""})
        if len(salida) >= n:
            break
    return salida


def atribucion(fuentes, pais="es", cc=True) -> str:
    """El texto de las fuentes de lo que se enseña. CartoCiudad (CC BY 4.0) y OpenStreetMap (ODbL) piden que se
    citen. Sin nada encontrado, las que se consultan en ese país (CartoCiudad, solo si se le pregunta: `cc`)."""
    fs = {str(f or "").split("-")[0] for f in fuentes or []}
    if not fs - {""}:
        fs = {"cartociudad", "photon"} if pais == "es" and cc else {"photon"}
    partes = []
    if "cartociudad" in fs:
        partes.append(ATRIBUCION_CC)
    if fs & {"photon", "nominatim"}:
        partes.append(ATRIBUCION_OSM)
    if "amap" in fs:
        partes.append("© Amap")
    return " · ".join(partes)


# ── la red de verdad ──────────────────────────────────────────────────────────

def _recorta(js):
    """La geometría de CartoCiudad (calles y pueblos enteros) no se guarda: el punto ya viene en lat/lng. De una calle
    se queda su trazado aligerado («linea», 02-11-2026), con el que ubicar mira si un portal de OpenStreetMap cae lejos
    de la calle oficial; un pueblo entero ocuparía la caché para nada."""
    if isinstance(js, dict) and "geom" in js:
        linea = _partes_wkt(js.get("geom"))
        sin = {k: v for k, v in js.items() if k != "geom"}
        if linea:
            sin["linea"] = [[list(q) for q in parte] for parte in linea]
        return sin
    if isinstance(js, list):
        return [({k: v for k, v in x.items() if k != "geom"} if isinstance(x, dict) else x) for x in js]
    return js


class RedHttp:
    """Las peticiones de la cadena a los servicios de verdad.

      · Caché en memoria de las respuestas buenas (1 h, acotada): el centro de un CP o su municipio se piden una vez
        para todas las paradas de ese CP, y la misma dirección no se vuelve a pedir.
      · Un semáforo por servicio (CartoCiudad 4 a la vez, Photon 2) y, para Nominatim, uno solo y 1,1 s entre
        petición y petición para todo el servidor: es su norma de uso. La espera cuenta dentro del tope del paso.
      · Corta-circuitos: Photon dejó de contestar al PC del laboratorio una hora (02-11-2026, 18:20-19:15); si un
        servicio no contesta en su tope (o da 5xx), se salta unos minutos en vez de esperar su tope en cada parada.
        Nominatim con 403 o 429 (nos ha cortado) se salta diez minutos. A CartoCiudad solo le cuenta no contestar: su
        500 suele ser de una consulta rara (unas comillas), contesta al momento y no debe dejar a todos sin callejero.
    """

    SERVICIOS = {
        "cartociudad": {"a_la_vez": 4, "intervalo": 0.0, "fallos": 2, "salta": 60.0, "solo_sin_respuesta": True},
        # Photon, como mucho 2 por segundo: el laboratorio vio que corta a quien le pide mucho seguido.
        "photon": {"a_la_vez": 2, "intervalo": 0.5, "fallos": 1, "salta": 300.0},
        "nominatim": {"a_la_vez": 1, "intervalo": 1.1, "fallos": 1, "salta": 120.0, "cortado": 600.0},
    }

    def __init__(self, user_agent, cache_max=1500, cache_ttl=3600.0, cliente=None, ahora=time.monotonic,
                 registro=None, dormir=None):
        self.user_agent = user_agent
        self._dormir = dormir or asyncio.sleep
        self.cache_max, self.cache_ttl = cache_max, cache_ttl
        self._cache = {}
        self._cliente_fijo = cliente
        self._cli, self._cli_loop = None, None
        self._prim, self._prim_loop = None, None
        self._ahora = ahora
        self._registro = registro
        self._ultima = {s: 0.0 for s in self.SERVICIOS}
        self._fallos = {s: 0 for s in self.SERVICIOS}
        self.saltado_hasta = {s: 0.0 for s in self.SERVICIOS}
        self.cuenta = {"peticiones": 0, "cache": 0, "saltadas": 0}

    @staticmethod
    def clave(url, params, idioma=None) -> str:
        txt = url + "?" + json.dumps(sorted((str(k), str(v)) for k, v in (params or {}).items()), ensure_ascii=False)
        return hashlib.sha1(f"{txt}|{idioma or ''}".encode("utf-8")).hexdigest()

    def _de_cache(self, k):
        x = self._cache.pop(k, None)
        if x is None or x[0] < self._ahora():
            return None
        self._cache[k] = x                       # el último usado, al final: lo viejo sale primero
        return x

    def _a_cache(self, k, estado, js):
        self._cache.pop(k, None)
        self._cache[k] = (self._ahora() + self.cache_ttl, estado, js)
        while len(self._cache) > self.cache_max:
            self._cache.pop(next(iter(self._cache)))

    def _primitivas(self):
        """Los semáforos, del bucle en el que se usan (uno solo en el servidor; varios en las pruebas)."""
        bucle = asyncio.get_running_loop()
        if self._prim is None or self._prim_loop is not bucle:
            self._prim = {s: asyncio.Semaphore(c["a_la_vez"]) for s, c in self.SERVICIOS.items()}
            self._prim_loop = bucle
        return self._prim

    def _cliente(self):
        if self._cliente_fijo is not None:
            return self._cliente_fijo
        bucle = asyncio.get_running_loop()
        if self._cli is None or self._cli_loop is not bucle:
            import httpx
            self._cli = httpx.AsyncClient(timeout=10, follow_redirects=True, headers={"User-Agent": self.user_agent})
            self._cli_loop = bucle
        return self._cli

    def _avisa(self, srv, segundos, por):
        if self._registro is not None:
            try:
                self._registro.warning(f"geocodificador: {srv} no contesta ({por}): se salta {int(segundos)} s")
            except Exception:                                # noqa: BLE001
                pass

    def _anota(self, srv, estado):
        conf = self.SERVICIOS[srv]
        if estado in (200, 204):
            self._fallos[srv] = 0
            return
        if isinstance(estado, int) and 400 <= estado < 500 and estado not in (403, 429):
            return                               # una consulta mal hecha no es que el servicio esté caído
        if estado in (403, 429) and conf.get("cortado"):
            self.saltado_hasta[srv] = self._ahora() + conf["cortado"]
            self._fallos[srv] = 0
            self._avisa(srv, conf["cortado"], estado)
            return
        if conf.get("solo_sin_respuesta") and estado not in ("tope", -1):
            return
        self._fallos[srv] += 1
        if self._fallos[srv] >= conf["fallos"]:
            self.saltado_hasta[srv] = self._ahora() + conf["salta"]
            self._fallos[srv] = 0
            self._avisa(srv, conf["salta"], estado)

    async def get(self, srv, url, params, tope, idioma=None) -> dict:
        """{status, json} de una petición: 200/204 bien; otro código HTTP; -1 sin conexión; «tope» si no contesta a
        tiempo; -2 si el servicio está saltado por el corta-circuitos. Nunca lanza."""
        k = self.clave(url, params, idioma)
        x = self._de_cache(k)
        if x is not None:
            self.cuenta["cache"] += 1
            return {"status": x[1], "json": x[2], "cache": True}
        if self.saltado_hasta.get(srv, 0.0) > self._ahora():
            self.cuenta["saltadas"] += 1
            return {"status": -2, "json": None}
        conf = self.SERVICIOS[srv]
        fin = self._ahora() + max(0.0, float(tope))
        sem = self._primitivas()[srv]
        try:
            await asyncio.wait_for(sem.acquire(), timeout=max(0.01, fin - self._ahora()))
        except asyncio.TimeoutError:
            return {"status": "tope", "json": None, "en_cola": True}
        estado, js = -1, None
        try:
            if conf["intervalo"]:
                # Su turno: el intervalo se cuenta entre el principio de una petición y el de la siguiente, y se
                # reserva antes de esperar (así vale también con dos a la vez).
                turno = max(self._ahora(), self._ultima[srv] + conf["intervalo"])
                if turno > fin - 0.3:
                    return {"status": "tope", "json": None, "en_cola": True}
                self._ultima[srv] = turno
                if turno > self._ahora():
                    await self._dormir(turno - self._ahora())
            quedan = fin - self._ahora()
            if quedan < 0.1:
                return {"status": "tope", "json": None, "en_cola": True}
            cabeceras = {"Accept-Language": idioma} if idioma else {}
            self.cuenta["peticiones"] += 1
            try:
                r = await asyncio.wait_for(self._cliente().get(url, params=params, headers=cabeceras), timeout=quedan)
                estado = r.status_code
                if estado == 200:
                    try:
                        js = _recorta(r.json())
                    except ValueError:
                        estado = -3              # 200 sin JSON: como un fallo del servicio
            except asyncio.TimeoutError:
                estado = "tope"
            except Exception:                                # noqa: BLE001
                estado = -1
        finally:
            sem.release()
        self._anota(srv, estado)
        if estado in (200, 204):
            self._a_cache(k, estado, js)
        return {"status": estado, "json": js}
