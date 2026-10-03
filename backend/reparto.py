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


# ── LA RUTA POR TIEMPO (03-10-2026) ───────────────────────────────────────────
# Lo de arriba ordena por línea recta. Esto ordena por lo que de verdad cuesta:
# MINUTOS por carretera (una matriz de tiempos que da el servidor de rutas),
# con el tráfico típico de cada hora, el rato que se pasa en cada portal y las
# franjas horarias de los clientes. Lo que se minimiza es la hora a la que
# acabas, con un castigo fuerte por llegar tarde a una franja.
#
# TRÁFICO: «típico», no en vivo. El tráfico en tiempo real solo lo dan
# servicios de pago; aquí cada tramo se alarga según la hora del día a la que
# se va a hacer (salir a las 8:15 no es salir a las 11). Los factores son una
# estimación de ciudad española, no una medida: por eso se llaman así en
# pantalla y nunca «en vivo».

# (desde, hasta, factor) en minutos del día, de lunes a viernes.
TRAFICO_LABORABLE = [
    (7 * 60 + 30, 9 * 60 + 30, 1.35),     # entrada a trabajar y colegios
    (9 * 60 + 30, 13 * 60 + 30, 1.12),
    (13 * 60 + 30, 15 * 60 + 30, 1.25),   # salida de mediodía
    (15 * 60 + 30, 17 * 60 + 30, 1.12),
    (17 * 60 + 30, 20 * 60 + 30, 1.35),   # vuelta a casa
]
TRAFICO_SABADO = [(10 * 60, 14 * 60, 1.15), (17 * 60, 20 * 60 + 30, 1.12)]

CASTIGO_TARDE = 20      # cada minuto tarde en una franja cuenta como 20
PESO_PRIORIDAD = 0.5    # los urgentes tiran hacia el principio, sin romper la ruta


def factor_trafico(minuto_del_dia: float, dia_semana: int, con_trafico: bool = True) -> float:
    """dia_semana: 0 = lunes … 6 = domingo."""
    if not con_trafico or dia_semana == 6:
        return 1.0
    franjas = TRAFICO_SABADO if dia_semana == 5 else TRAFICO_LABORABLE
    m = minuto_del_dia % (24 * 60)
    for a, b, f in franjas:
        if a <= m < b:
            return f
    return 1.0


def hm(minutos) -> str:
    m = int(round(minutos)) % (24 * 60)
    return f"{m // 60:02d}:{m % 60:02d}"


def a_minutos(texto) -> "int | None":
    """«9», «9:30», «09.30», «9h» -> minutos del día."""
    m = re.fullmatch(r"\s*([01]?\d|2[0-3])(?:\s*[:.h]\s*([0-5]\d))?\s*h?\s*", str(texto or ""))
    if not m:
        return None
    return int(m.group(1)) * 60 + int(m.group(2) or 0)


_VENT_RE = re.compile(r"(?:de\s+|entre\s+)?([01]?\d|2[0-3])(?:[:.h]([0-5]\d))?\s*h?\s*(?:-|a|y|hasta)\s*([01]?\d|2[0-3])(?:[:.h]([0-5]\d))?\s*h?", re.I)


def lee_ventana(texto) -> tuple:
    """Franja horaria de un texto libre -> (desde, hasta) en minutos, o (None, None).

    «de 10 a 12», «10:30-13», «entre 17 y 19 h», «por la mañana», «tarde».
    No inventa: si no hay nada reconocible, no hay franja.
    """
    t = norm(texto)
    if not t:
        return (None, None)
    m = _VENT_RE.search(t)
    if m:
        a = int(m.group(1)) * 60 + int(m.group(2) or 0)
        b = int(m.group(3)) * 60 + int(m.group(4) or 0)
        # Solo horas de reparto: «portal 5-7» no es una franja de 5 a 7.
        if b > a and a >= 6 * 60 and b <= 23 * 60 + 59:
            return (a, b)
    if re.search(r"\b(por la )?manana\b", t):
        return (9 * 60, 14 * 60)
    if re.search(r"\b(por la )?tarde\b", t):
        return (16 * 60, 21 * 60)
    return (None, None)


_HABLA_DE_HORAS = re.compile(r"\b(hora|horario|franja|entre|entregar|manana|tarde|desde|hasta)\b|\d\s*h\b|\d[:.]\d\d")


def ventana_de_nota(texto) -> tuple:
    """Como `lee_ventana`, pero para notas libres: solo si la nota habla de
    horas. «Portal 2-4, 3º» no es una franja; «entregar de 10 a 12» sí."""
    if not _HABLA_DE_HORAS.search(norm(texto)):
        return (None, None)
    return lee_ventana(texto)



def _evalua(orden, matriz, salida, paradas, dia_semana, con_trafico, volver):
    """Recorre la ruta en el tiempo. Devuelve (coste, llegadas, fin, tarde_total)."""
    t = salida
    prev = 0
    llegadas = []
    tarde_total = 0.0
    prioridad = 0.0
    for i in orden:
        p = paradas[i - 1]
        t += matriz[prev][i] / 60.0 * factor_trafico(t, dia_semana, con_trafico)
        desde, hasta = p.get("desde"), p.get("hasta")
        espera = 0.0
        if desde is not None and t < desde:
            espera = desde - t
            t = desde
        tarde = max(0.0, t - hasta) if hasta is not None else 0.0
        tarde_total += tarde
        if p.get("prioridad"):
            prioridad += t - salida
        llegadas.append((i, t, tarde, espera))
        t += p.get("servicio", 0)
        prev = i
    if volver and orden:
        t += matriz[prev][0] / 60.0 * factor_trafico(t, dia_semana, con_trafico)
    coste = (t - salida) + CASTIGO_TARDE * tarde_total + PESO_PRIORIDAD * prioridad
    return coste, llegadas, t, tarde_total


def optimiza_por_tiempo(matriz, paradas, salida, dia_semana=0, con_trafico=True, volver=False,
                        presupuesto_evaluaciones=60000):
    """Orden de las paradas que acaba antes respetando franjas.

    `matriz`: segundos de i a j, con el nodo 0 = punto de salida y 1..n las
    paradas en el orden de `paradas`. Cada parada: {servicio (min), desde,
    hasta (min del día o None), prioridad}. Devuelve
    {"orden": [índices de `paradas`], "llegadas": [{eta, tarde, espera}],
     "fin": min, "minutos": total, "tarde": total de minutos tarde}.

    Búsqueda local (mover una parada, invertir un tramo) desde tres arranques
    —el más cercano en tiempo, el que cierra antes su franja y el orden en que
    llegaron— y se queda con el mejor. Para las 10-60 paradas de un repartidor
    da en milisegundos lo que una persona tardaría un rato en cuadrar a mano.
    """
    n = len(paradas)
    if n == 0:
        return {"orden": [], "llegadas": [], "fin": salida, "minutos": 0, "tarde": 0}
    ev = lambda o: _evalua(o, matriz, salida, paradas, dia_semana, con_trafico, volver)  # noqa: E731

    def vecino():
        quedan, o, prev = set(range(1, n + 1)), [], 0
        while quedan:
            sig = min(quedan, key=lambda j: (matriz[prev][j], j))
            o.append(sig)
            quedan.discard(sig)
            prev = sig
        return o

    arranques = [vecino(),
                 sorted(range(1, n + 1), key=lambda j: (paradas[j - 1].get("hasta") or 10 ** 6, matriz[0][j])),
                 list(range(1, n + 1))]
    gastado = 0
    mejor, mejor_c = None, float("inf")
    for o in arranques:
        c = ev(o)[0]
        mejora = True
        while mejora and gastado < presupuesto_evaluaciones:
            mejora = False
            # Mover una parada a otro sitio.
            for a in range(n):
                for b in range(n):
                    if a == b:
                        continue
                    nuevo = o[:a] + o[a + 1:]
                    nuevo.insert(b, o[a])
                    gastado += 1
                    cn = ev(nuevo)[0]
                    if cn + 1e-9 < c:
                        o, c, mejora = nuevo, cn, True
                        break
                if mejora or gastado >= presupuesto_evaluaciones:
                    break
            if mejora:
                continue
            # Invertir un tramo (deshace cruces).
            for a in range(n - 1):
                for b in range(a + 1, n):
                    nuevo = o[:a] + o[a:b + 1][::-1] + o[b + 1:]
                    gastado += 1
                    cn = ev(nuevo)[0]
                    if cn + 1e-9 < c:
                        o, c, mejora = nuevo, cn, True
                        break
                if mejora or gastado >= presupuesto_evaluaciones:
                    break
        if c < mejor_c:
            mejor, mejor_c = o, c
    _, llegadas, fin, tarde = ev(mejor)
    return {"orden": [i - 1 for i in mejor],
            "llegadas": [{"eta": t, "tarde": round(td), "espera": round(es)} for _, t, td, es in llegadas],
            "fin": fin, "minutos": round(fin - salida), "tarde": round(tarde)}


def matriz_en_linea_recta(puntos) -> tuple:
    """Plan B sin servidor de rutas: km en línea recta × 1,35 (las calles no
    van rectas) a 22 km/h de media urbana con paradas. Devuelve (segundos, metros)."""
    n = len(puntos)
    seg = [[0.0] * n for _ in range(n)]
    met = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                km = distancia_km(puntos[i], puntos[j]) * 1.35
                met[i][j] = km * 1000
                seg[i][j] = km / 22.0 * 3600
    return seg, met

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
    "horario": ("horario", "franja", "hora", "ventana", "hora entrega", "entrega"),
    "prioridad": ("prioridad", "urgente"),
    "cobrar": ("cobrar", "a cobrar", "importe", "total", "reembolso", "contra reembolso"),
    "tipo": ("tipo", "entrega o recogida"),
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


def importe(v) -> float:
    """«23,50 €», «23.5», «1.234,50» -> 23.5 / 1234.5. Lo raro, 0."""
    t = re.sub(r"[^\d,.-]", "", str(v or ""))
    if not t:
        return 0.0
    if "," in t and "." in t:
        t = t.replace(".", "").replace(",", ".") if t.rfind(",") > t.rfind(".") else t.replace(",", "")
    else:
        t = t.replace(",", ".")
    try:
        n = round(float(t), 2)
    except ValueError:
        return 0.0
    return n if 0 <= n <= 100000 else 0.0


def tipo_parada(v) -> str:
    """Entrega o recogida (envases, devoluciones, cambios)."""
    return "recogida" if re.search(r"recog|devol|envase|retir", norm(v)) else "entrega"


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


def aligera_linea(linea: list, metros: float = 12.0, tope: int = 4000) -> list:
    """Quita puntos casi pegados de un trazado (el servidor da uno cada pocos
    metros): mismo dibujo, mucho menos peso para el móvil. Primero y último
    se quedan siempre."""
    if len(linea) <= 2:
        return linea
    fuera = [linea[0]]
    for p in linea[1:-1]:
        if distancia_km(fuera[-1], p) * 1000 >= metros:
            fuera.append(p)
    fuera.append(linea[-1])
    if len(fuera) > tope:
        paso = len(fuera) / tope
        fuera = [fuera[int(i * paso)] for i in range(tope - 1)] + [fuera[-1]]
    return fuera


# ── NAVEGACIÓN DENTRO DE LA APP ──────────────────────────────────────────────
# El servidor de rutas (OSRM) da cada maniobra como tipo + modificador + calle
# + número de salida en las rotondas. Aquí se pasa a una frase en español
# («Gira a la derecha por Rúa Real») y a un icono. La voz la pone el móvil.

_GIROS = {
    "uturn": ("Da la vuelta", "vuelta"),
    "sharp right": ("Gira cerrado a la derecha", "derecha"),
    "right": ("Gira a la derecha", "derecha"),
    "slight right": ("Ligeramente a la derecha", "ligera-derecha"),
    "straight": ("Sigue recto", "recto"),
    "slight left": ("Ligeramente a la izquierda", "ligera-izquierda"),
    "left": ("Gira a la izquierda", "izquierda"),
    "sharp left": ("Gira cerrado a la izquierda", "izquierda"),
}
_ORDINALES = ["primera", "segunda", "tercera", "cuarta", "quinta", "sexta", "séptima", "octava", "novena", "décima"]


def _minuscula(t: str) -> str:
    return t[:1].lower() + t[1:]


def instruccion(tipo: str, modificador: str = "", calle: str = "", salida=None) -> tuple:
    """(texto, icono) de una maniobra. Sin calle, la frase sin «por …»."""
    tipo = (tipo or "").strip()
    mod = (modificador or "").strip()
    calle = (calle or "").strip()
    por = f" por {calle}" if calle else ""
    giro, icono = _GIROS.get(mod, ("Sigue", "recto"))
    if tipo == "depart":
        return (f"Sal por {calle}" if calle else "Empieza la ruta"), "recto"
    if tipo == "arrive":
        return "Has llegado", "llegada"
    if tipo in ("roundabout", "rotary"):
        if isinstance(salida, int) and 1 <= salida <= len(_ORDINALES):
            return f"En la rotonda, toma la {_ORDINALES[salida - 1]} salida{por}", "rotonda"
        return f"Entra en la rotonda{por}", "rotonda"
    if tipo in ("exit roundabout", "exit rotary"):
        return f"Sal de la rotonda{por}", "rotonda"
    if tipo == "roundabout turn":
        return f"En la rotonda, {_minuscula(giro)}{por}", "rotonda"
    if tipo in ("new name", "continue") and mod in ("straight", ""):
        return f"Sigue recto{por}", "recto"
    if tipo == "fork":
        lado = "a la derecha" if "right" in mod else "a la izquierda" if "left" in mod else "recto"
        return f"En la bifurcación, mantente {lado}{por}", icono
    if tipo == "merge":
        return f"Incorpórate{por}", icono
    if tipo == "on ramp":
        return f"Toma la entrada{por}", icono
    if tipo == "off ramp":
        return f"Toma la salida{por}", icono
    if tipo == "end of road":
        return f"Al final de la calle, {_minuscula(giro)}{por}", icono
    return f"{giro}{por}", icono


def pasos_osrm(ruta: dict) -> list:
    """Las maniobras de una ruta de OSRM (con steps=true), en orden:
    [{texto, icono, punto:[lat,lng], calle, metros}]. `metros` es lo que se
    recorre DESPUÉS de la maniobra hasta la siguiente."""
    fuera = []
    for tramo in (ruta or {}).get("legs") or []:
        for s in tramo.get("steps") or []:
            m = s.get("maneuver") or {}
            loc = m.get("location")
            if not (isinstance(loc, list) and len(loc) == 2):
                continue
            calle = (s.get("name") or s.get("ref") or "").strip()
            texto, icono = instruccion(m.get("type"), m.get("modifier"), calle, m.get("exit"))
            fuera.append({"texto": texto, "icono": icono, "punto": [loc[1], loc[0]], "calle": calle,
                          "metros": round(s.get("distance") or 0)})
    return fuera
