# -*- coding: utf-8 -*-
"""Reparto a domicilio y a negocios: pedidos, zonas y orden de la ruta.

Para empresas que NO son de paquetería: un supermercado que lleva la compra a
casa (los tickets de caja pegados a las cajas, apuntados a boli), o un
distribuidor que reparte a talleres y astilleros escaneando cada bulto por la
mañana. Lo que hace falta es lo mismo en los dos: saber qué lleva cada pedido,
a dónde va, quién lo lleva y en qué orden.

Como `seguimiento.py`, sin base de datos delante: así se prueba entero.

── LO LEGAL, QUE MANDA SOBRE TODO LO DEMÁS ─────────────────────────────────
  · La empresa cliente es la RESPONSABLE de los datos de sus clientes
    (nombre, teléfono, dirección); Flota es su ENCARGADA (art. 28 RGPD). Así
    que nosotros no los vemos: cuando el dueño del producto entra «como» una
    empresa, los datos personales del reparto salen tapados (`tapar`).
  · Minimización: el conductor ve SOLO sus pedidos, y los datos personales
    se borran solos a los `DIAS_CONSERVAR` días de la entrega (`caducado`).
    Quedan los números (cuántos, estado, zona) para las estadísticas.
  · Ubicación del conductor (art. 90 LOPDGDD): solo dentro de la jornada que
    él mismo empieza y termina, después de haberle informado. Fuera de eso no
    se guarda ni un punto.
"""
import math
import re
import unicodedata

ESTADOS = ("pendiente", "en_ruta", "entregado", "fallido")
DIAS_CONSERVAR = 30          # datos de clientes tras la fecha del pedido
DIAS_RASTRO = 30             # puntos de ubicación de la jornada
MAX_PEGADO = 500             # líneas por pegada

# Lo que se tapa a quien no es la empresa (el dueño del producto entrando
# como ella). La zona, el estado y los bultos no son datos de nadie.
CAMPOS_PERSONALES = ("cliente", "telefono", "direccion", "lat", "lng", "notas")


def sin_acentos(s) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", str(s or ""))
                   if not unicodedata.combining(c))


def norm(s) -> str:
    return re.sub(r"\s+", " ", sin_acentos(s).lower()).strip()


def normaliza_codigo(c) -> str:
    """El código de barras o QR tal como se compara: sin espacios y en
    mayúsculas. Un lector mete a veces un salto de línea o un espacio final, y
    con eso el mismo bulto parecía otro pedido."""
    return re.sub(r"\s+", "", str(c or "")).upper()[:120]


_CP_RE = re.compile(r"\b(0[1-9]|[1-4]\d|5[0-2])\d{3}\b")
_TEL_RE = re.compile(r"(?:\+?34[\s.-]?)?[6789](?:[\s.-]?\d){8}\b")


def extrae_cp(texto) -> str:
    m = _CP_RE.search(str(texto or ""))
    return m.group(0) if m else ""


def extrae_telefono(texto) -> str:
    m = _TEL_RE.search(str(texto or ""))
    if not m:
        return ""
    d = re.sub(r"\D", "", m.group(0))
    return d[-9:]


# ── ZONAS ─────────────────────────────────────────────────────────────────────
# Cada repartidor tiene su zona («los repartidores tienen sus zonas»). Una zona
# se reconoce por código postal o por una palabra de la dirección (la calle,
# el barrio, el pueblo). El código postal manda: es exacto, y una palabra
# como «Real» está en media ciudad.

def zona_de(direccion, cp, zonas) -> dict:
    """La zona que le toca a una dirección, o {} si ninguna."""
    cp = (cp or extrae_cp(direccion) or "").strip()
    if cp:
        for z in zonas or []:
            if cp in [str(x).strip() for x in (z.get("cps") or [])]:
                return z
    texto = " " + norm(direccion) + " "
    mejor, largo = {}, 0
    for z in zonas or []:
        for p in z.get("palabras") or []:
            p = norm(p)
            # Palabra entera: «ria» no puede casar con «Maria».
            if len(p) >= 3 and re.search(r"(?<![a-z0-9])" + re.escape(p) + r"(?![a-z0-9])", texto):
                if len(p) > largo:          # la más concreta gana
                    mejor, largo = z, len(p)
    return mejor


# ── ORDEN DE LA RUTA ──────────────────────────────────────────────────────────
# Sin servicios de pago: vecino más cercano y luego 2-opt, que deshace los
# cruces. Con las 20-60 paradas de un repartidor da rutas a pocos puntos de la
# óptima en milisegundos. Distancia en línea recta: no es el kilometraje real,
# pero el ORDEN que sale es el que importa, y la calle la pone el navegador.

def distancia_km(a, b) -> float:
    (la1, lo1), (la2, lo2) = a, b
    r = 6371.0
    p1, p2 = math.radians(la1), math.radians(la2)
    dp, dl = p2 - p1, math.radians(lo2 - lo1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


def _punto(p):
    try:
        la, lo = float(p.get("lat")), float(p.get("lng"))
    except (TypeError, ValueError, AttributeError):
        return None
    if la != la or lo != lo or not (-90 <= la <= 90 and -180 <= lo <= 180):
        return None
    return (la, lo)


def _largo(origen, puntos, orden) -> float:
    total, prev = 0.0, origen
    for i in orden:
        if prev is not None:
            total += distancia_km(prev, puntos[i])
        prev = puntos[i]
    return total


def ordena_ruta(origen, paradas) -> list:
    """Las paradas en el orden de reparto. `origen` es (lat, lng) o None.

    Las que no tienen coordenadas van al final, en el orden en que llegaron:
    no se pueden colocar, pero tampoco se pueden perder.
    """
    con = [(i, _punto(p)) for i, p in enumerate(paradas)]
    ubicadas = [(i, pt) for i, pt in con if pt]
    sin = [paradas[i] for i, pt in con if not pt]
    if not ubicadas:
        return list(paradas)
    puntos = {i: pt for i, pt in ubicadas}
    quedan = set(puntos)
    orden = []
    actual = origen if origen else puntos[ubicadas[0][0]]
    while quedan:
        sig = min(quedan, key=lambda i: (distancia_km(actual, puntos[i]), i))
        orden.append(sig)
        quedan.discard(sig)
        actual = puntos[sig]
    # 2-opt sobre un camino ABIERTO (no se vuelve al almacén).
    mejora = True
    vueltas = 0
    while mejora and vueltas < 50:
        mejora, vueltas = False, vueltas + 1
        for a in range(len(orden) - 1):
            for b in range(a + 1, len(orden)):
                nuevo = orden[:a] + orden[a:b + 1][::-1] + orden[b + 1:]
                if _largo(origen, puntos, nuevo) + 1e-9 < _largo(origen, puntos, orden):
                    orden, mejora = nuevo, True
    return [paradas[i] for i in orden] + sin


def largo_ruta_km(origen, paradas) -> float:
    pts = [p for p in (_punto(x) for x in paradas) if p]
    if not pts:
        return 0.0
    total, prev = 0.0, origen
    for p in pts:
        if prev:
            total += distancia_km(prev, p)
        prev = p
    return round(total, 1)


# ── PEGAR LA LISTA DEL DÍA ────────────────────────────────────────────────────
# La oficina pega lo que tenga: una exportación de su programa, una hoja de
# Excel copiada (tabuladores) o una lista escrita a mano con «;». Si la
# primera fila trae cabeceras se leen por nombre; si no, se supone el orden
# código · cliente · dirección · teléfono · contenido.

_CABECERAS = {
    "codigo": ("codigo", "cod", "ticket", "pedido", "n pedido", "num", "numero", "referencia", "ref", "albaran"),
    "cliente": ("cliente", "nombre", "destinatario", "empresa", "negocio"),
    "direccion": ("direccion", "domicilio", "calle", "dir", "destino"),
    "telefono": ("telefono", "tel", "movil", "tlf", "telf"),
    "contenido": ("contenido", "lleva", "productos", "articulos", "descripcion", "mercancia"),
    "bultos": ("bultos", "cajas", "n bultos", "paquetes"),
    "cp": ("cp", "codigo postal", "c p", "postal"),
    "localidad": ("localidad", "poblacion", "ciudad", "municipio"),
    "notas": ("notas", "observaciones", "obs", "comentarios"),
}
_ORDEN_SIN_CABECERA = ("codigo", "cliente", "direccion", "telefono", "contenido")


def _separa(linea: str) -> list:
    for sep in ("\t", ";", "|"):
        if sep in linea:
            return [c.strip() for c in linea.split(sep)]
    return [linea.strip()]


def _campo_de_cabecera(c: str) -> str:
    c = re.sub(r"[^a-z ]", " ", norm(c)).strip()
    c = re.sub(r"\s+", " ", c)
    for campo, nombres in _CABECERAS.items():
        if c in nombres:
            return campo
    return ""


def lee_pegado(texto) -> list:
    """Lista de pedidos a partir del texto pegado. Nunca lanza."""
    lineas = [l for l in str(texto or "").replace("\r", "").split("\n") if l.strip()][:MAX_PEGADO + 1]
    if not lineas:
        return []
    primera = _separa(lineas[0])
    campos = [_campo_de_cabecera(c) for c in primera]
    if sum(1 for c in campos if c) >= 2:
        lineas = lineas[1:]
    else:
        campos = list(_ORDEN_SIN_CABECERA)
    salida = []
    for l in lineas[:MAX_PEGADO]:
        celdas = _separa(l)
        p = {}
        if len(celdas) == 1:
            # Una sola columna: es una dirección (con su teléfono si lo trae).
            p["direccion"] = celdas[0]
        else:
            for campo, valor in zip(campos, celdas):
                if campo and valor:
                    p[campo] = valor
        if not p.get("direccion"):
            continue
        if p.get("telefono"):
            p["telefono"] = extrae_telefono(p["telefono"]) or p["telefono"]
        else:
            t = extrae_telefono(l)
            if t:
                p["telefono"] = t
        if not p.get("cp"):
            p["cp"] = extrae_cp(p["direccion"])
        try:
            p["bultos"] = max(1, min(99, int(float(str(p.get("bultos") or 1).replace(",", ".")))))
        except ValueError:
            p["bultos"] = 1
        if p.get("codigo"):
            p["codigo"] = normaliza_codigo(p["codigo"])
        salida.append(p)
    return salida


# ── PRIVACIDAD ────────────────────────────────────────────────────────────────

def tapar(pedido: dict) -> dict:
    """El pedido sin datos personales, para quien no es la empresa."""
    p = dict(pedido)
    for c in CAMPOS_PERSONALES:
        if p.get(c) not in (None, ""):
            p[c] = None if c in ("lat", "lng") else "•••"
    p["tapado"] = True
    return p


def caducado(pedido: dict, hoy_iso: str, dias: int = DIAS_CONSERVAR) -> bool:
    """¿Ya toca borrar los datos personales de este pedido?

    Cuenta desde la FECHA del reparto, entregado o no: un pedido que se quedó
    sin entregar no justifica guardar la dirección de nadie para siempre.
    """
    f = str(pedido.get("fecha") or "")[:10]
    if len(f) != 10 or pedido.get("anonimizado"):
        return False
    from datetime import date
    try:
        d = date.fromisoformat(f)
        h = date.fromisoformat(hoy_iso[:10])
    except ValueError:
        return False
    return (h - d).days > dias


# ── LEER EL TICKET CON IA ─────────────────────────────────────────────────────
PROMPT_TICKET = """Eres un lector de tickets y etiquetas de reparto en España.
En la imagen hay un ticket de caja, un albarán o una etiqueta pegada a una caja.
Saca SOLO lo que se lee; si algo no está, déjalo vacío. No inventes nada.
Devuelve exactamente este JSON:
{"codigo": "número del código de barras o del pedido/ticket, solo dígitos y letras",
 "cliente": "nombre del cliente o negocio de destino",
 "telefono": "teléfono de contacto",
 "direccion": "calle, número, piso y puerta",
 "cp": "código postal",
 "localidad": "población",
 "contenido": "qué lleva, resumido (p. ej. '3 cajas, 2 packs de agua, leche')",
 "bultos": número de bultos si se indica o 1,
 "notas": "horario o indicaciones de entrega si las hay"}"""


def limpia_ticket(d) -> dict:
    """Lo que devuelve la IA, recortado y con los tipos bien."""
    d = d if isinstance(d, dict) else {}

    def t(k, n):
        v = d.get(k)
        return str(v).strip()[:n] if isinstance(v, (str, int, float)) and not isinstance(v, bool) else ""
    out = {k: t(k, n) for k, n in (("cliente", 120), ("telefono", 30), ("direccion", 200),
                                    ("cp", 10), ("localidad", 80), ("contenido", 300), ("notas", 200))}
    out["codigo"] = normaliza_codigo(t("codigo", 120))
    if out["telefono"]:
        out["telefono"] = extrae_telefono(out["telefono"]) or out["telefono"]
    if not out["cp"]:
        out["cp"] = extrae_cp(out["direccion"])
    try:
        out["bultos"] = max(1, min(99, int(float(str(d.get("bultos") or 1)))))
    except (TypeError, ValueError):
        out["bultos"] = 1
    return out
