# -*- coding: utf-8 -*-
"""LO QUE DICE LA CALLE EN CADA PAÍS (30-10-2026): cortes y obras, zonas de bajas emisiones y restricciones por placa.

Hasta hoy el mapa del repartidor solo sabía lo que publica la DGT (España). Dani: «si no hay DGT en los otros
países, debería haber algo que se adecue a esos países». Aquí está, con la MISMA forma de salida que lo de la DGT
(reparto.incidencias_datex / zbe_datex), fuente por fuente y país por país, y sin inventar nada: lo que no se lee de
una fuente abierta, no se pinta (docs/EXPANSION-INTERNACIONAL-30-10.md §11 y ESTADO.md).

Fuentes (todas abiertas y sin clave; bajadas y leídas el 30-10-2026, muestras reales en tests/muestras/):
  · Francia: Bison Futé, «Événements routiers sur le RRN» (DATEX II v2, tipi.bison-fute.gouv.fr, licencia LOV2) y la
    Base nationale consolidée des ZFE (data.gouv.fr, aires.geojson, ODbL): Crit'Air prohibido por tipo de vehículo.
  · Países Bajos: NDW «actueel beeld» (DATEX II v3) y «emissiezones» (zonas de cero y bajas emisiones oficiales).
  · Reino Unido: ULEZ y LEZ de Londres (GLA / TfL, ArcGIS abierto). Los cortes de National Highways piden clave:
    no se leen (se dice en la respuesta: `fuente` vacía).
  · EE. UU.: Work Zone Data Exchange (WZDx), los feeds estatales que contestan sin clave (18 el 30-10-2026; el
    registro oficial trae 43). Sin feed para la zona de la ruta, no se dice nada (`aplica: false`).
  · Alemania, Italia, Bélgica, Austria, Portugal, Suiza, Irlanda, Andorra: zonas de bajas emisiones de OpenStreetMap
    (`boundary=low_emission_zone`, Overpass), con su fuente a la vista. Cortes: sin fuente abierta sin registro.
  · Latinoamérica: las restricciones por placa que son estables y públicas (rodízio de São Paulo, Hoy No Circula de
    CDMX, pico y placa de Quito, restricción de San José) calculadas para hoy y, si se sabe la placa, para esa placa;
    Bogotá, Medellín y Santiago cambian cada temporada: solo el aviso con el enlace oficial.
"""
import json
import math
import re
from datetime import date, datetime, timedelta, timezone
import xml.etree.ElementTree as _ET

import reparto as R

# ── Qué fuente vale en cada país ──────────────────────────────────────────────────────────────────────────────
FUENTES = {
    "es": {"incidencias": "dgt", "zonas": ("dgt",), "tipo_zona": "ZBE"},
    "fr": {"incidencias": "bison", "zonas": ("bnzfe",), "tipo_zona": "ZFE"},
    "nl": {"incidencias": "ndw", "zonas": ("ndw",), "tipo_zona": "Milieuzone"},
    "us": {"incidencias": "wzdx", "zonas": (), "tipo_zona": ""},
    "gb": {"incidencias": None, "zonas": ("gla", "osm"), "tipo_zona": "LEZ"},
    "de": {"incidencias": None, "zonas": ("osm",), "tipo_zona": "Umweltzone"},
    "it": {"incidencias": None, "zonas": ("osm",), "tipo_zona": "ZTL"},
    "be": {"incidencias": None, "zonas": ("osm",), "tipo_zona": "LEZ"},
    "at": {"incidencias": None, "zonas": ("osm",), "tipo_zona": "LEZ"},
    "pt": {"incidencias": None, "zonas": ("osm",), "tipo_zona": "ZER"},
    "ch": {"incidencias": None, "zonas": ("osm",), "tipo_zona": "LEZ"},
    "ie": {"incidencias": None, "zonas": ("osm",), "tipo_zona": "LEZ"},
    "ad": {"incidencias": None, "zonas": ("osm",), "tipo_zona": "LEZ"},
}
NOMBRES_FUENTE = {"dgt": "DGT", "bison": "Bison Futé", "ndw": "NDW", "wzdx": "WZDx", "bnzfe": "BNZFE (data.gouv.fr)",
                  "gla": "TfL / GLA", "osm": "OpenStreetMap"}

URL_BISON = "http://tipi.bison-fute.gouv.fr/bison-fute-ouvert/publicationsDIR/Evenementiel-DIR/grt/RRN/content.xml"
URL_NDW_ACTUAL = "https://opendata.ndw.nu/actueel_beeld.xml.gz"
URL_NDW_ZONAS = "https://opendata.ndw.nu/emissiezones.xml.gz"
URL_BNZFE_DATASET = "https://www.data.gouv.fr/api/1/datasets/base-nationale-consolidee-des-zones-a-faibles-emissions/"
URL_GLA = "https://gis.london.gov.uk/arcgis/rest/services/apps/Air_Quality_map_service_01/MapServer/{capa}/query?where=1%3D1&outFields=*&f=geojson"
CAPAS_GLA = ((4, "ULEZ"), (6, "LEZ"))
URLS_OVERPASS = ("https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter")

# Los feeds WZDx que contestaron sin clave el 30-10-2026 (de los 43 del registro oficial, data.transportation.gov),
# con la caja aproximada del estado: solo se baja el feed de la zona donde está la ruta.
WZDX_FEEDS = (
    ("mn", "Minnesota DOT", "https://mn.carsprogram.org/carsapi_v1/api/wzdx", (43.4, -97.4, 49.5, -89.4)),
    ("md", "Maryland DOT", "https://filter.ritis.org/wzdx_v4.1/mdot.geojson", (37.8, -79.6, 39.8, -74.9)),
    ("mo", "Missouri DOT", "https://traveler.modot.org/timconfig/feed/desktop/mo_wzdx.json", (35.9, -95.9, 40.7, -89.0)),
    ("az", "Arizona DOT", "https://wzdxapi.aztech.org/construction", (31.2, -115.0, 37.1, -108.9)),
    ("hi", "Hawaii DOT", "https://ai.blyncsy.io/wzdx/hidot/feed", (18.8, -160.4, 22.4, -154.7)),
    ("wa", "Washington State DOT", "https://wzdx.wsdot.wa.gov/api/v4/WorkZoneFeed", (45.4, -124.9, 49.1, -116.8)),
    ("ky", "Kentucky Transportation Cabinet", "https://storage.googleapis.com/kytc-its-2020-openrecords/public/feeds/wzdx.geojson", (36.4, -89.7, 39.2, -81.8)),
    ("ks", "Kansas DOT", "https://ks.carsprogram.org/carsapi_v1/api/wzdx", (36.9, -102.1, 40.1, -94.5)),
    ("de", "Delaware DOT", "https://wzdx.e-dot.com/del_dot_feed_wzdx_v4.1.geojson", (38.4, -75.9, 39.9, -74.9)),
    ("la", "Louisiana DOTD", "https://wzdx.e-dot.com/la_dot_d_feed_wzdx_v4.1.geojson", (28.8, -94.1, 33.1, -88.7)),
    ("id", "Idaho Transportation Department", "https://511.idaho.gov/api/wzdx", (41.9, -117.3, 49.1, -110.9)),
    ("in", "Indiana DOT", "https://in.carsprogram.org/carsapi_v1/api/wzdx", (37.7, -88.2, 41.8, -84.7)),
    ("ne", "New England 511 (NH, VT, ME)", "https://api.dx.ne-compass.com/wzdx-latest/", (42.6, -73.5, 47.6, -66.8)),
    ("ms", "Mississippi DOT", "https://api.mdottraffic.com/prod/v3/data/wzdx", (30.0, -91.8, 35.1, -88.0)),
    ("nd", "North Dakota DOT", "https://travelfiles.dot.nd.gov/geojson_nc/wzdx_geojson.json", (45.8, -104.1, 49.1, -96.5)),
)

# Las ciudades francesas de la base de ZFE, por el SIREN que llevan sus ids (etalab/transport-site, zfe_ids.csv).
ZFE_NOMBRES = {
    "248000531": "Amiens", "244900015": "Angers", "200066793": "Annecy", "200011773": "Annemasse", "248400251": "Avignon",
    "200067106": "Bayonne", "200072460": "Béthune", "243300316": "Bordeaux", "242900314": "Brest", "200051183": "Caen",
    "200069110": "Chambéry", "246300701": "Clermont-Ferrand", "242100410": "Dijon", "246200364": "Douai-Lens",
    "245900428": "Dunkerque", "253800825": "Grenoble", "200084952": "Le Havre", "247200132": "Le Mans", "200093201": "Lille",
    "248719312": "Limoges", "200046977": "Lyon", "200054807": "Marseille-Aix", "200039865": "Metz", "243400017": "Montpellier",
    "200066009": "Mulhouse", "245400676": "Nancy", "244400404": "Nantes", "200030195": "Nice", "243000643": "Nîmes",
    "244500468": "Orléans", "217500016": "Paris", "200067254": "Pau", "200027183": "Perpignan", "200067213": "Reims",
    "243500139": "Rennes", "200023414": "Rouen", "214401846": "Saint-Nazaire", "244200770": "Saint-Étienne",
    "246700488": "Strasbourg", "248300543": "Toulon", "243100518": "Toulouse", "243700754": "Tours", "245901160": "Valenciennes",
}


def tipo_zona(pais: str) -> str:
    return (FUENTES.get((pais or "").lower()) or {}).get("tipo_zona") or "LEZ"


def fuente_incidencias(pais: str):
    return (FUENTES.get((pais or "").lower()) or {}).get("incidencias")


def fuentes_zonas(pais: str) -> tuple:
    return tuple((FUENTES.get((pais or "").lower()) or {}).get("zonas") or ())


def hay_normas(pais: str) -> bool:
    return any(c["pais"] == (pais or "").lower() for c in CIUDADES_NORMAS)


# ── Fechas y vigencia ────────────────────────────────────────────────────────────────────────────────────────
def _instante(s):
    """Un instante ISO de DATEX o GeoJSON («2026-10-30T09:57:43.642+01:00», «…Z», con nanosegundos) → datetime UTC."""
    t = str(s or "").strip()
    if not t:
        return None
    t = re.sub(r"(\.\d{6})\d+", r"\1", t).replace("Z", "+00:00")
    try:
        d = datetime.fromisoformat(t)
    except ValueError:
        return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc)


def vigente(desde, hasta, ahora=None, margen_h: float = 1.0) -> bool:
    """Lo que está en marcha ahora (o empieza en menos de una hora) y no ha acabado. Sin fechas, se da por vigente."""
    ahora = ahora or datetime.now(timezone.utc)
    a, b = _instante(desde), _instante(hasta)
    if a and a > ahora + timedelta(hours=margen_h):
        return False
    if b and b < ahora:
        return False
    return True


# ── DATEX II (Bison Futé v2, NDW v3; la DGT sigue en reparto.incidencias_datex) ─────────────────────────────
_CLASE_TIPO = {
    **R._INC_TIPO,
    "MaintenanceWorks": ("obras", "obras"), "ConstructionWorks": ("obras", "obras"), "Accident": ("accidente", "accidente"),
    "EnvironmentalObstruction": ("obstaculo", "obstáculo (desprendimiento, inundación…)"),
    "InfrastructureDamageObstruction": ("obstaculo", "daños en la vía"), "AnimalPresenceObstruction": ("obstaculo", "animales en la vía"),
    "WeatherRelatedRoadConditions": ("meteo", "meteorología"), "ReroutingManagement": ("aviso", "desvío"),
    "GeneralNetworkManagement": ("aviso", "aviso"), "RoadsideServiceDisruption": ("aviso", "aviso"),
}


def _comentario(rec, tipo="description") -> str:
    """El texto para el público de un registro DATEX («Travaux de maintenance…»), del tipo pedido o el primero."""
    primero = ""
    for gp in rec.iter():
        if R._local(gp.tag) != "generalPublicComment":
            continue
        v = R._hijo_texto(gp, "value")
        if not v:
            continue
        if tipo is None or R._hijo_texto(gp, "commentType") == tipo:
            return v
        primero = primero or v
    return primero


def _descriptor(el, tipo: str) -> str:
    """En Bison Futé (v2) la carretera y el municipio van como «descriptores» de cada punto: linkName, townName."""
    for n in el.iter():
        if R._local(n.tag) == "name" and R._hijo_texto(n, "tpegOtherPointDescriptorType") == tipo:
            return R._hijo_texto(n, "value")
    return ""


def _puntos_de(el) -> list:
    """Todos los puntos (lat, lng) de un elemento: `pointCoordinates` (v2 y v3) y `posList` de GML (NDW)."""
    pts = []
    for x in el.iter():
        n = R._local(x.tag)
        if n == "pointCoordinates":
            q = R._punto_de(x)
            if q:
                pts.append(q)
        elif n == "posList" and x.text:
            nums = x.text.split()
            try:
                pts.extend((float(nums[i]), float(nums[i + 1])) for i in range(0, len(nums) - 1, 2))
            except ValueError:
                pass
    return pts


def _primero(el, nombre):
    return next((x for x in el.iter() if R._local(x.tag) == nombre), None)


def incidencias_datex(xml, fuente: str, ahora=None) -> tuple:
    """Las incidencias vigentes de un DATEX II (v2 o v3) → ([{…}], publicado). La misma forma que la DGT, más
    `texto` (lo que escribe el gestor, en su idioma) y `fuente`."""
    raiz = _ET.fromstring(xml if isinstance(xml, (bytes, bytearray)) else str(xml).encode("utf-8"))
    publicado = R._hijo_texto(raiz, "publicationTime")[:32]
    ahora = ahora or datetime.now(timezone.utc)
    out = []
    for sit in raiz.iter():
        if R._local(sit.tag) != "situation":
            continue
        grav_sit = R._hijo_texto(sit, "overallSeverity")
        for rec in sit:
            if R._local(rec.tag) != "situationRecord":
                continue
            desde = R._hijo_texto(rec, "overallStartTime")
            hasta = R._hijo_texto(rec, "overallEndTime")
            if not vigente(desde, hasta, ahora):
                continue
            tipo = (rec.get(R._XSI_TYPE) or "").split(":")[-1]
            gestion = [x.text.strip() for x in rec.iter() if R._local(x.tag) == "roadOrCarriagewayOrLaneManagementType" and x.text]
            causa = R._hijo_texto(rec, "causeType")
            clase, que = "otro", "incidencia"
            if gestion and gestion[0] in R._INC_GESTION:
                clase, que = R._INC_GESTION[gestion[0]]
                if clase == "corte" and causa in R._INC_CAUSA:
                    que = f"{que} ({R._INC_CAUSA[causa][1]})"
            elif causa in R._INC_CAUSA:
                clase, que = R._INC_CAUSA[causa]
            elif tipo in _CLASE_TIPO:
                clase, que = _CLASE_TIPO[tipo]
            desde_el, hasta_el = _primero(rec, "from"), _primero(rec, "to")
            puntos = _puntos_de(rec)
            if not puntos:
                continue
            a = (R._punto_de(desde_el) if desde_el is not None else None) or puntos[0]
            b = (R._punto_de(hasta_el) if hasta_el is not None else None) or (puntos[-1] if len(puntos) > 1 else None)
            if b and abs(b[0] - a[0]) < 1e-6 and abs(b[1] - a[1]) < 1e-6:
                b = None
            grav = R._hijo_texto(rec, "severity") or grav_sit
            donde = desde_el if desde_el is not None else rec
            carretera = R._hijo_texto(donde, "roadName") or _descriptor(donde, "linkName") or R._hijo_texto(rec, "roadNumber")
            municipio = R._hijo_texto(donde, "municipality") or _descriptor(donde, "townName")
            out.append({
                "id": (rec.get("id") or sit.get("id") or "")[:40], "clase": clase, "que": que,
                "gravedad": R._GRAVEDAD.get(grav, ""), "carretera": carretera[:40], "pk": R._hijo_texto(donde, "kilometerPoint")[:12],
                "municipio": municipio[:60], "provincia": R._hijo_texto(donde, "province")[:40],
                "lat": round(a[0], 6), "lng": round(a[1], 6),
                "lat2": round(b[0], 6) if b else None, "lng2": round(b[1], 6) if b else None,
                "desde": desde[:32], "texto": _comentario(rec)[:200], "fuente": fuente,
            })
    return out, publicado


# ── Polígonos: simplificar y encajar ─────────────────────────────────────────────────────────────────────────
def _dist_segmento(p, a, b) -> float:
    """Distancia (en grados, con la longitud corregida por la latitud) de p al segmento a-b."""
    k = math.cos(math.radians(p[0]))
    px, py = p[1] * k, p[0]
    ax, ay = a[1] * k, a[0]
    bx, by = b[1] * k, b[0]
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def simplifica(puntos: list, tolerancia: float = 0.0003) -> list:
    """Douglas-Peucker: los mismos contornos con muchos menos puntos (la LEZ de Londres trae 43.000; con 30 m de
    tolerancia se queda en unos cientos). `tolerancia` en grados (0,0003 ≈ 30 m)."""
    if len(puntos) <= 3:
        return list(puntos)
    pila, quedan = [(0, len(puntos) - 1)], {0, len(puntos) - 1}
    while pila:
        i, j = pila.pop()
        lejos, k_max = 0.0, -1
        for k in range(i + 1, j):
            d = _dist_segmento(puntos[k], puntos[i], puntos[j])
            if d > lejos:
                lejos, k_max = d, k
        if k_max >= 0 and lejos > tolerancia:
            quedan.add(k_max)
            pila.append((i, k_max))
            pila.append((k_max, j))
    return [puntos[k] for k in sorted(quedan)]


def _poligonos_geojson(geometria: dict, tolerancia: float = 0.0003, tope: int = 1500) -> list:
    """Los anillos exteriores de un Polygon o MultiPolygon GeoJSON ([lng, lat]) → [[[lat, lng]…]…], simplificados."""
    g = geometria or {}
    cs = g.get("coordinates") or []
    anillos = []
    if g.get("type") == "Polygon" and cs:
        anillos = [cs[0]]
    elif g.get("type") == "MultiPolygon":
        anillos = [p[0] for p in cs if p]
    out = []
    for anillo in anillos:
        pts = [[round(float(c[1]), 6), round(float(c[0]), 6)] for c in anillo if isinstance(c, (list, tuple)) and len(c) >= 2]
        tol = tolerancia
        while len(pts) > tope:
            pts = simplifica(pts, tol)
            tol *= 2
        if len(pts) >= 3:
            out.append(simplifica(pts, tolerancia) if len(pts) > 50 else pts)
    return out


def _zona(id_, nombre, descripcion, url, tipo, fuente, poligonos, ciudad="", estado="active", version="", etiquetas=None) -> dict:
    todos = [pt for pol in poligonos for pt in pol]
    return {
        "id": str(id_)[:80], "ciudad": ciudad[:40], "nombre": nombre[:80], "descripcion": descripcion[:300], "estado": estado[:20],
        "url": url[:200], "version": version[:10], "etiquetas": etiquetas or [], "negado": False, "poligonos": poligonos,
        "caja": (min(p[0] for p in todos), min(p[1] for p in todos), max(p[0] for p in todos), max(p[1] for p in todos)),
        "tipo": tipo, "fuente": fuente,
    }


# ── Países Bajos: las zonas oficiales (NDW emissiezones, DATEX II v3 ControlledZoneTable) ───────────────────
def zonas_ndw(xml, ahora=None) -> list:
    raiz = _ET.fromstring(xml if isinstance(xml, (bytes, bytearray)) else str(xml).encode("utf-8"))
    ahora = ahora or datetime.now(timezone.utc)
    out = []
    for z in raiz.iter():
        if R._local(z.tag) != "urbanVehicleAccessRegulation":
            continue
        desde = R._hijo_texto(z, "overallStartTime")
        hasta = R._hijo_texto(z, "overallEndTime")
        if not vigente(desde, hasta, ahora):
            continue
        poligonos = []
        for ext in z.iter():
            if R._local(ext.tag) != "exterior":
                continue
            pts = _puntos_de(ext)
            if len(pts) >= 3:
                poligonos.append(simplifica([[round(p[0], 6), round(p[1], 6)] for p in pts]))
        if not poligonos:
            continue
        clase = R._hijo_texto(z, "controlledZoneType")
        nombre = R._valor_de(z, "name")
        # NDW declara las ZES (cero emisiones para furgonetas y camiones) como lowEmissionZone: el nombre lo dice.
        cero = "zero" in clase.lower() or nombre.upper().startswith(("ZES", "ZE ")) or "nul-emissie" in nombre.lower() or "zero-emissie" in nombre.lower()
        autoridad = R._valor_de(z, "issuingAuthority")
        out.append(_zona(
            z.get("id") or "", nombre or ("ZES " + autoridad if cero else "Milieuzone " + autoridad),
            ("Zero-emission zone for delivery vans and lorries" if cero else "Low-emission zone") + (f" · {autoridad}" if autoridad else ""),
            R._hijo_texto(z, "urlForFurtherInformation"), "ZES" if cero else "Milieuzone", "ndw", poligonos,
            ciudad=autoridad, estado=R._hijo_texto(z, "status") or "active",
            version=R._hijo_texto(z, "controlledZoneRecordVersionTime")[:10]))
    return out


# ── Francia: la base nacional de ZFE (aires.geojson) ────────────────────────────────────────────────────────
_CRITAIR = {"EL": "tous sauf électriques interdits", "V1": "Crit'Air 1 et au-delà interdits", "V2": "Crit'Air 2 et au-delà interdits",
            "V3": "Crit'Air 3 et au-delà interdits", "V4": "Crit'Air 4 et au-delà interdits", "V5": "Crit'Air 5 et non classés interdits"}


def zonas_bnzfe(geojson, hoy=None) -> list:
    """Las ZFE vigentes hoy, con lo que prohíben a los utilitarios ligeros (VUL: lo que lleva un repartidor) y a
    los turismos. `vul_critair: V4` quiere decir que Crit'Air 4, 5 y sin viñeta no pueden circular (esquema oficial)."""
    d = json.loads(geojson) if isinstance(geojson, (str, bytes, bytearray)) else (geojson or {})
    hoy = hoy or date.today()
    out = []
    for f in d.get("features") or []:
        p = f.get("properties") or {}
        ini, fin = str(p.get("date_debut") or ""), str(p.get("date_fin") or "")
        try:
            if ini and date.fromisoformat(ini[:10]) > hoy:
                continue
            if fin and date.fromisoformat(fin[:10]) < hoy:
                continue
        except ValueError:
            continue
        poligonos = _poligonos_geojson(f.get("geometry"))
        if not poligonos:
            continue
        id_ = str(p.get("id") or p.get("gid") or "")
        ciudad = ZFE_NOMBRES.get(id_.split("-")[0], "")
        nombre = p.get("nom") if p.get("nom") and p.get("nom") != "ZFEM" else ""
        nombre = nombre or (f"ZFE {ciudad}" if ciudad else "ZFE")
        partes = []
        vul, vp = str(p.get("vul_critair") or ""), str(p.get("vp_critair") or "")
        if vul in _CRITAIR:
            partes.append(f"Utilitaires : {_CRITAIR[vul]}" + (f" ({p['vul_horaires']})" if p.get("vul_horaires") else ""))
        if vp in _CRITAIR and vp != vul:
            partes.append(f"Voitures : {_CRITAIR[vp]}")
        if not partes:
            partes.append("Règles Crit'Air : voir l'arrêté")
        out.append(_zona(id_, nombre, " · ".join(partes), str(p.get("url_site") or p.get("url_arrete") or ""), "ZFE", "bnzfe",
                         poligonos, ciudad=ciudad, version=str(p.get("date_maj") or ini)[:10]))
    return out


# ── Londres: ULEZ y LEZ (GLA / TfL) ─────────────────────────────────────────────────────────────────────────
_TEXTO_GLA = {
    "ULEZ": "Cars and vans: Euro 6 (diesel) or Euro 4 (petrol), or £12.50 a day. Source: TfL",
    "LEZ": "Heavier vehicles (over 3.5 t): Euro VI or a daily charge; vans are covered by the ULEZ. Source: TfL",
}


def zonas_gla(geojson, tipo: str) -> list:
    d = json.loads(geojson) if isinstance(geojson, (str, bytes, bytearray)) else (geojson or {})
    out = []
    for f in d.get("features") or []:
        p = f.get("properties") or {}
        poligonos = _poligonos_geojson(f.get("geometry"), tolerancia=0.0005, tope=1200)
        if not poligonos:
            continue
        out.append(_zona(f"gla-{tipo}-{p.get('objectid') or len(out) + 1}", p.get("boundary") or tipo, _TEXTO_GLA.get(tipo, ""),
                         str(p.get("url") or ""), tipo, "gla", poligonos, ciudad="London"))
    return out


# ── OpenStreetMap: boundary=low_emission_zone (Overpass) ─────────────────────────────────────────────────────
CONSULTA_OSM = '[out:json][timeout:25];relation["boundary"="low_emission_zone"]({s},{w},{n},{e});out geom;'


def _anillos(vias: list) -> list:
    """Une los tramos (listas de [lat, lng]) por sus extremos hasta cerrar anillos."""
    pendientes = [list(v) for v in vias if len(v) >= 2]
    anillos = []
    while pendientes:
        actual = pendientes.pop(0)
        cambio = True
        while cambio and (actual[0] != actual[-1]):
            cambio = False
            for i, v in enumerate(pendientes):
                if v[0] == actual[-1]:
                    actual += v[1:]
                elif v[-1] == actual[-1]:
                    actual += list(reversed(v))[1:]
                elif v[-1] == actual[0]:
                    actual = v[:-1] + actual
                elif v[0] == actual[0]:
                    actual = list(reversed(v))[:-1] + actual
                else:
                    continue
                pendientes.pop(i)
                cambio = True
                break
        if len(actual) >= 4 and actual[0] == actual[-1]:
            anillos.append(actual)
    return anillos


def zonas_osm(j, tipo_defecto: str = "LEZ") -> list:
    d = json.loads(j) if isinstance(j, (str, bytes, bytearray)) else (j or {})
    out = []
    for e in d.get("elements") or []:
        if e.get("type") != "relation":
            continue
        t = e.get("tags") or {}
        vias = []
        for m in e.get("members") or []:
            if m.get("type") == "way" and m.get("role") in ("outer", "") and m.get("geometry"):
                vias.append([[round(float(p["lat"]), 6), round(float(p["lon"]), 6)] for p in m["geometry"]])
        poligonos = [simplifica(a) if len(a) > 50 else a for a in _anillos(vias)]
        if not poligonos:
            continue
        detalle = [x for x in (t.get("description"), t.get("emission_standard") and f"{t['emission_standard']}", t.get("charge") and f"charge: {t['charge']}",
                               t.get("opening_hours")) if x]
        out.append(_zona(f"osm-{e.get('id')}", t.get("name") or t.get("official_name") or tipo_defecto,
                         " · ".join(detalle)[:300] or "Low-emission zone according to OpenStreetMap",
                         t.get("website") or t.get("url") or "", tipo_defecto, "osm", poligonos, ciudad=t.get("addr:city") or ""))
    return out


# ── EE. UU.: Work Zone Data Exchange (GeoJSON, v4) ──────────────────────────────────────────────────────────
def feeds_wzdx_para(caja) -> list:
    """Los feeds cuyo estado toca la caja (s, w, n, e) de la ruta."""
    if not caja:
        return []
    return [f for f in WZDX_FEEDS if not (f[3][2] < caja[0] or f[3][0] > caja[2] or f[3][3] < caja[1] or f[3][1] > caja[3])]


def incidencias_wzdx(geojson, fuente: str, ahora=None) -> list:
    d = json.loads(geojson) if isinstance(geojson, (str, bytes, bytearray)) else (geojson or {})
    ahora = ahora or datetime.now(timezone.utc)
    out = []
    for f in d.get("features") or []:
        p = f.get("properties") or {}
        cd = p.get("core_details") or {}
        if (p.get("event_status") or "") in ("completed", "cancelled"):
            continue
        if not vigente(p.get("start_date"), p.get("end_date"), ahora):
            continue
        g = f.get("geometry") or {}
        cs = g.get("coordinates") or []
        if g.get("type") == "Point":
            pts = [cs]
        elif g.get("type") in ("LineString", "MultiPoint"):
            pts = cs
        else:
            pts = []
        pts = [(float(c[1]), float(c[0])) for c in pts if isinstance(c, (list, tuple)) and len(c) >= 2]
        if not pts:
            continue
        impacto = str(p.get("vehicle_impact") or "")
        tipo = str(cd.get("event_type") or "")
        if impacto == "all-lanes-closed":
            clase, que = "corte", "carretera cortada (obras)"
        elif tipo == "detour":
            clase, que = "aviso", "desvío"
        elif impacto == "some-lanes-closed":
            clase, que = "obras", "carril cortado"
        else:
            clase, que = "obras", "obras"
        a, b = pts[0], (pts[-1] if len(pts) > 1 else None)
        out.append({
            "id": str(f.get("id") or cd.get("data_source_id") or "")[:40], "clase": clase, "que": que, "gravedad": "",
            "carretera": ", ".join(str(x) for x in (cd.get("road_names") or []))[:40], "pk": "", "municipio": "", "provincia": "",
            "lat": round(a[0], 6), "lng": round(a[1], 6), "lat2": round(b[0], 6) if b else None, "lng2": round(b[1], 6) if b else None,
            "desde": str(p.get("start_date") or "")[:32], "texto": str(cd.get("description") or "")[:200], "fuente": fuente,
        })
    return out


# ── Latinoamérica: restricciones por placa ───────────────────────────────────────────────────────────────────
# Caja (s, w, n, e) de la zona donde rige. Las reglas por dígito solo donde son fijas y públicas desde hace años;
# donde cambian por temporada (Bogotá, Medellín, Santiago), el aviso con el enlace oficial y sin inventar dígitos.
_DIGITOS = {0: ("1", "2"), 1: ("3", "4"), 2: ("5", "6"), 3: ("7", "8"), 4: ("9", "0")}
_DIGITOS_HNC = {0: ("5", "6"), 1: ("7", "8"), 2: ("3", "4"), 3: ("1", "2"), 4: ("9", "0")}
_ENGOMADO = {0: "amarillo", 1: "rosa", 2: "rojo", 3: "verde", 4: "azul"}
CIUDADES_NORMAS = (
    {"id": "sp", "pais": "br", "ciudad": "São Paulo", "caja": (-23.80, -46.90, -23.35, -46.35), "regla": "rodizio",
     "url": "https://www.cetsp.com.br/consultas/rodizio-municipal.aspx"},
    {"id": "cdmx", "pais": "mx", "ciudad": "Ciudad de México", "caja": (19.10, -99.40, 19.65, -98.90), "regla": "hnc",
     "url": "https://www.sedema.cdmx.gob.mx/"},
    {"id": "quito", "pais": "ec", "ciudad": "Quito", "caja": (-0.45, -78.65, 0.05, -78.35), "regla": "quito",
     "url": "https://www.quito.gob.ec/"},
    {"id": "sanjose", "pais": "cr", "ciudad": "San José", "caja": (9.85, -84.20, 10.05, -84.00), "regla": "sanjose",
     "url": "https://www.mopt.go.cr/"},
    {"id": "bogota", "pais": "co", "ciudad": "Bogotá", "caja": (4.45, -74.25, 4.85, -73.95), "regla": "enlace",
     "url": "https://bogota.gov.co/mi-ciudad/movilidad",
     "texto": "Pico y placa de lunes a viernes (los dígitos cambian cada semestre) y pico y placa para vehículos de carga: consulta la restricción vigente antes de salir."},
    {"id": "medellin", "pais": "co", "ciudad": "Medellín", "caja": (6.10, -75.75, 6.40, -75.45), "regla": "enlace",
     "url": "https://www.medellin.gov.co/es/secretaria-de-movilidad/pico-y-placa/",
     "texto": "Pico y placa de lunes a viernes (los dígitos rotan cada semestre): consulta la restricción vigente antes de salir."},
    {"id": "santiago", "pais": "cl", "ciudad": "Santiago", "caja": (-33.65, -70.85, -33.30, -70.45), "regla": "santiago",
     "url": "https://www.uoct.cl/restriccion-vehicular/",
     "texto": "Restricción vehicular de mayo a agosto, de lunes a viernes de 7:30 a 21:00, para vehículos sin sello verde (los dígitos los publica cada año la UOCT): consúltalos antes de salir."},
)


def _toca(caja_ruta, caja) -> bool:
    return bool(caja_ruta) and not (caja[2] < caja_ruta[0] or caja[0] > caja_ruta[2] or caja[3] < caja_ruta[1] or caja[1] > caja_ruta[3])


def _ultimo_digito(placa: str) -> str:
    d = re.findall(r"\d", str(placa or ""))
    return d[-1] if d else ""


def normas_hoy(pais: str, paradas: list, ahora_local: datetime, placa: str = "") -> list:
    """Los avisos de restricción por placa que tocan la ruta de hoy: [{ciudad, titulo, texto, url, hoy, digitos}].
    `hoy`: True si la placa dada no puede circular hoy, False si puede, None si no se sabe la placa (o la regla no se
    calcula). Nunca se dice «hoy te toca» sin saber la placa."""
    caja = R.caja_de(paradas, 0.0)
    if not caja:
        return []
    dia = ahora_local.weekday()
    ultimo = _ultimo_digito(placa)
    out = []
    for c in CIUDADES_NORMAS:
        if c["pais"] != (pais or "").lower() or not _toca(caja, c["caja"]):
            continue
        regla = c["regla"]
        aviso = {"ciudad": c["ciudad"], "url": c["url"], "hoy": None, "digitos": [], "titulo": "", "texto": ""}
        if regla == "rodizio":
            aviso["titulo"] = "Rodízio municipal"
            if dia <= 4:
                dig = _DIGITOS[dia]
                aviso["digitos"] = list(dig)
                aviso["texto"] = (f"Hoje não circulam placas com final {dig[0]} e {dig[1]} das 7h às 10h e das 17h às 20h no centro expandido "
                                  "(caminhões: regras próprias da ZMRC).")
                aviso["hoy"] = (ultimo in dig) if ultimo else None
            else:
                aviso["texto"] = "Sem rodízio aos sábados e domingos."
                aviso["hoy"] = False
        elif regla == "hnc":
            aviso["titulo"] = "Hoy No Circula"
            if dia <= 4:
                dig = _DIGITOS_HNC[dia]
                aviso["digitos"] = list(dig)
                aviso["texto"] = (f"Hoy no circulan las placas terminadas en {dig[0]} y {dig[1]} (engomado {_ENGOMADO[dia]}) de 5:00 a 22:00, "
                                  "salvo holograma 00 y 0; en contingencia ambiental aplica el doble Hoy No Circula.")
                aviso["hoy"] = (ultimo in dig) if ultimo else None
            elif dia == 5:
                aviso["texto"] = "Sábado: depende del holograma y de la terminación de la placa; consulta el calendario del programa."
            else:
                aviso["texto"] = "Los domingos no aplica."
                aviso["hoy"] = False
        elif regla == "quito":
            aviso["titulo"] = "Pico y placa"
            if dia <= 4:
                dig = _DIGITOS[dia]
                aviso["digitos"] = list(dig)
                aviso["texto"] = f"Hoy no circulan las placas terminadas en {dig[0]} y {dig[1]} de 6:00 a 9:30 y de 16:00 a 20:00."
                aviso["hoy"] = (ultimo in dig) if ultimo else None
            else:
                aviso["texto"] = "Sin pico y placa los fines de semana."
                aviso["hoy"] = False
        elif regla == "sanjose":
            aviso["titulo"] = "Restricción vehicular"
            if dia <= 4:
                dig = _DIGITOS[dia]
                aviso["digitos"] = list(dig)
                aviso["texto"] = f"Hoy no circulan las placas terminadas en {dig[0]} y {dig[1]} de 6:00 a 19:00 dentro del anillo de circunvalación."
                aviso["hoy"] = (ultimo in dig) if ultimo else None
            else:
                aviso["texto"] = "Sin restricción los fines de semana."
                aviso["hoy"] = False
        elif regla == "santiago":
            if not (5 <= ahora_local.month <= 8):
                continue
            aviso["titulo"] = "Restricción vehicular"
            aviso["texto"] = c["texto"]
        else:
            aviso["titulo"] = "Pico y placa"
            aviso["texto"] = c["texto"]
            if dia > 4:
                continue
        out.append(aviso)
    return out
