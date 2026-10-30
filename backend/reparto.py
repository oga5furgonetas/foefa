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
DIAS_RASTRO = 30             # jornadas (empezada, terminada y última posición)
MAX_PEGADO = 500             # líneas por pegada

# Lo que se tapa a quien no es la empresa (el dueño del producto entrando
# como ella). La zona, el estado y los bultos no son datos de nadie.
CAMPOS_PERSONALES = ("cliente", "telefono", "direccion", "lat", "lng", "notas", "entrega_recibe")

# DÓNDE SE DEJA (10-10-2026, como Circuit/Spoke): un toque en vez de escribir la
# nota. Lo ve el cliente en su enlace de seguimiento («Entregado: en el buzón»).
DONDE_ENTREGA = {"mano": "En mano", "vecino": "Al vecino", "buzon": "En el buzón",
                 "porteria": "En portería o recepción", "seguro": "En un lugar seguro"}


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


def clave_direccion(texto) -> str:
    """La misma puerta escrita de dos maneras («Rúa Real 22, A Coruña» y «rua real 22 a coruña») da la misma
    clave: sin acentos, en minúscula y solo letras y cifras."""
    return re.sub(r"[^a-z0-9]+", " ", norm(texto)).strip()


def ultima_vez(pendientes: list, previas: list, metros: float = 20.0) -> dict:
    """LA ÚLTIMA VEZ EN ESA PUERTA (17-10-2026): {id de parada de hoy: lo que pasó la última vez que se repartió
    allí} (dónde se dejó, la nota, o que no se pudo y por qué). Primero por la dirección escrita; si no, por
    estar a menos de `metros` (la misma puerta escrita distinto). De las previas manda la más reciente."""
    previas = sorted(previas, key=lambda v: str(v.get("cerrado_en") or v.get("fecha") or ""), reverse=True)
    por_clave = {}
    for v in previas:
        k = clave_direccion(v.get("direccion"))
        if k and k not in por_clave:
            por_clave[k] = v
    salida = {}
    for p in pendientes:
        v = por_clave.get(clave_direccion(p.get("direccion")))
        a = _punto(p)
        if v is None and a:
            v = next((x for x in previas if _punto(x) and distancia_km(a, _punto(x)) * 1000 <= metros), None)
        if v is None:
            continue
        fallo = v.get("estado") == "fallido"
        dato = {"fecha": v.get("fecha") or "", "estado": v.get("estado") or "", "nota": v.get("entrega_nota") or "",
                "donde": v.get("entrega_donde") or "", "motivo": (v.get("motivo") or "") if fallo else ""}
        if fallo or dato["nota"] or dato["donde"]:
            salida[p["id"]] = dato
    return salida


def rumbo(a, b) -> float:
    """Hacia dónde hay que mirar desde a para ver b, en grados (0 = norte, 90 = este)."""
    (la1, lo1), (la2, lo2) = a, b
    p1, p2 = math.radians(la1), math.radians(la2)
    dl = math.radians(lo2 - lo1)
    x = math.sin(dl) * math.cos(p2)
    y = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


_TIPOS_VIA = re.compile(r"^(calle|c|cl|rua|r|avenida|avda|av|plaza|praza|pza|paseo|po|travesia|trav|camino|carretera|ctra|"
                        r"ronda|glorieta|lugar|lg|urbanizacion|urb|estrada|rueiro|calzada|via|bulevar)(?![a-z])\.?\s*"
                        r"(de\s+(la\s+|los\s+|las\s+)?|del\s+|da\s+|do\s+|das\s+|dos\s+)?")


def calle_de_la_direccion(waypoints, direccion: str = ""):
    """De los puntos de calle cercanos que da OSRM (el más cercano primero), el
    de la calle de la dirección si está entre ellos; si no, el más cercano."""
    validos = [w for w in (waypoints or []) if isinstance(w, dict) and isinstance(w.get("location"), list)
               and len(w["location"]) == 2]
    if not validos:
        return None
    via = _TIPOS_VIA.sub("", norm(str(direccion or "").split(",")[0].replace("/", " ")))
    via = re.sub(r"\s*\d.*$", "", via).strip()
    elegido = validos[0]
    if len(via) >= 4:
        for w in validos:
            nombre = _TIPOS_VIA.sub("", norm(w.get("name") or "")).strip()
            if nombre and (via in nombre or nombre in via):
                elegido = w
                break
    lo, la = elegido["location"]
    return (float(la), float(lo))


def vista_fachada(casa, calle) -> dict:
    """VER LA PUERTA (10-10-2026): desde el punto de la calle más cercano a la
    casa (donde pasa el coche de Street View), mirando hacia la casa. Si la calle
    no se sabe o la casa está encima de ella (dirección situada solo por la
    calle), se mira desde la casa sin rumbo: mejor eso que apuntar a la acera
    de enfrente."""
    if not calle or distancia_km(casa, calle) * 1000 < 4:
        return {"lat": round(casa[0], 6), "lng": round(casa[1], 6), "rumbo": None}
    return {"lat": round(calle[0], 6), "lng": round(calle[1], 6), "rumbo": round(rumbo(calle, casa))}


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


def presupuesto_evaluaciones(n: int) -> int:
    """Cuántas vueltas se le dan a la búsqueda local según las paradas (29-10-2026).

    60.000 hasta 50 paradas (milisegundos con 20, 2,5 s con 40) y la mitad a partir
    de ahí: medido, con 60 paradas da el mismo orden y con 80 uno un 2 % más largo,
    en una cuarta parte del tiempo. El servidor lo corre en un hilo, pero una
    oficina que «ordena todos» con 20 repartidores lo nota igual.
    """
    return 60000 if n <= 50 else 30000


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
                          "metros": round(s.get("distance") or 0),
                          # En bruto, para que la app lo escriba en el idioma de cada uno.
                          "maniobra": {"tipo": m.get("type") or "", "mod": m.get("modifier") or "",
                                       "salida": m.get("exit") if isinstance(m.get("exit"), int) else None}})
    return fuera


# ── China: coordenadas GCJ-02 ↔ WGS-84 (04-10-2026) ──────────────────────────
# Los mapas chinos (Amap, Baidu sobre GCJ) dan las coordenadas con el
# desplazamiento oficial (cientos de metros). El GPS del móvil, OpenStreetMap
# y OSRM van en WGS-84: lo que llega de Amap se convierte antes de guardarlo.
_GCJ_A = 6378245.0
_GCJ_EE = 0.00669342162296594323


def _gcj_tlat(x: float, y: float) -> float:
    r = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * math.sqrt(abs(x))
    r += (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
    r += (20.0 * math.sin(y * math.pi) + 40.0 * math.sin(y / 3.0 * math.pi)) * 2.0 / 3.0
    r += (160.0 * math.sin(y / 12.0 * math.pi) + 320.0 * math.sin(y * math.pi / 30.0)) * 2.0 / 3.0
    return r


def _gcj_tlng(x: float, y: float) -> float:
    r = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * math.sqrt(abs(x))
    r += (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
    r += (20.0 * math.sin(x * math.pi) + 40.0 * math.sin(x / 3.0 * math.pi)) * 2.0 / 3.0
    r += (150.0 * math.sin(x / 12.0 * math.pi) + 300.0 * math.sin(x / 30.0 * math.pi)) * 2.0 / 3.0
    return r


def wgs84_a_gcj02(lat: float, lng: float) -> tuple:
    dlat = _gcj_tlat(lng - 105.0, lat - 35.0)
    dlng = _gcj_tlng(lng - 105.0, lat - 35.0)
    rad = lat / 180.0 * math.pi
    magia = 1 - _GCJ_EE * math.sin(rad) ** 2
    raiz = math.sqrt(magia)
    dlat = (dlat * 180.0) / ((_GCJ_A * (1 - _GCJ_EE)) / (magia * raiz) * math.pi)
    dlng = (dlng * 180.0) / (_GCJ_A / raiz * math.cos(rad) * math.pi)
    return lat + dlat, lng + dlng


def gcj02_a_wgs84(lat: float, lng: float) -> tuple:
    """Inversa por aproximaciones sucesivas: error por debajo del centímetro."""
    wlat, wlng = lat, lng
    for _ in range(6):
        glat, glng = wgs84_a_gcj02(wlat, wlng)
        wlat, wlng = wlat - (glat - lat), wlng - (glng - lng)
    return wlat, wlng


# ── ZONAS DE CARGA Y DESCARGA (13-10-2026) ────────────────────────────────────
# Dónde puede parar la furgoneta a descargar, pintado en el mapa del repartidor.
# Sale de OpenStreetMap (Overpass): sirve en cualquier país y es gratis, pero
# solo están las zonas que alguien ha apuntado (en España, pocas fuera de las
# grandes ciudades). NO dice si están libres: eso no lo publica nadie.
# Etiquetas (wiki de OSM, «Street parking» y «Key:restriction»):
#   parking:<lado>:restriction=loading_only (y :conditional con su horario),
#   el esquema antiguo parking:condition:<lado>=loading, y un aparcamiento
#   dibujado aparte con restriction=loading_only o access=delivery.
# Al servidor de Overpass se le pregunta por cuadrados de ~5 km (TESELA), nunca
# por los puntos de la ruta: así no sabe qué calles reparte nadie.

TESELA = 0.05


def teselas(s: float, w: float, n: float, e: float, lado: float = TESELA) -> list:
    """Los cuadrados (claves enteras) que tapan la caja."""
    fs, fn = math.floor(s / lado), math.floor(n / lado)
    fw, fe = math.floor(w / lado), math.floor(e / lado)
    return [(i, j) for i in range(fs, fn + 1) for j in range(fw, fe + 1)]


def caja_de_tesela(t: tuple, lado: float = TESELA) -> tuple:
    i, j = t
    return (round(i * lado, 6), round(j * lado, 6), round((i + 1) * lado, 6), round((j + 1) * lado, 6))


def consulta_zonas_carga(s: float, w: float, n: float, e: float) -> str:
    caja = f"{s},{w},{n},{e}"
    return (
        "[out:json][timeout:25];("
        f'way[~"^parking:(both|left|right)(:restriction|:restriction:conditional)$"~"loading_only"]({caja});'
        f'way[~"^parking:condition:(both|left|right)(:conditional)?$"~"loading"]({caja});'
        f'nwr["amenity"="parking"]["restriction"~"loading_only"]({caja});'
        f'nwr["amenity"="parking"]["access"="delivery"]({caja});'
        ");out center tags qt;"
    )


def _horario_zona(tags: dict) -> str:
    """«loading_only @ (Mo-Fr 08:00-14:00)» → «Mo-Fr 08:00-14:00». Vacío si es a cualquier hora."""
    for k, v in tags.items():
        if k.endswith(":conditional") and ("loading" in str(v)):
            m = re.search(r"@\s*\(?([^);]+)\)?", str(v))
            if m:
                return m.group(1).strip()[:60]
    return ""


def _maximo_zona(tags: dict) -> str:
    for k in ("parking:both:maxstay", "parking:right:maxstay", "parking:left:maxstay", "maxstay"):
        if tags.get(k):
            return str(tags[k])[:20]
    return ""


def zonas_de_overpass(j: dict, limite: int = 400) -> list:
    """La respuesta de Overpass → [{id, lat, lng, horario, maximo, calle}]. Nunca lanza."""
    out, vistos = [], set()
    for el in (j or {}).get("elements") or []:
        if not isinstance(el, dict):
            continue
        c = el.get("center") or el
        lat, lng = c.get("lat"), c.get("lon")
        if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
            continue
        clave = f"{el.get('type', '')}{el.get('id', '')}"
        if clave in vistos:
            continue
        vistos.add(clave)
        tags = el.get("tags") or {}
        out.append({"id": clave, "lat": round(float(lat), 6), "lng": round(float(lng), 6),
                    "horario": _horario_zona(tags), "maximo": _maximo_zona(tags),
                    "calle": str(tags.get("name") or "")[:80]})
        if len(out) >= limite:
            break
    return out


# ══ LO QUE PIDE LA CALLE (30-10-2026) ════════════════════════════════════════
# De docs/NECESIDADES-REPARTIDOR-30-10.md: al repartidor le pagan por paquete entregado y una de cada cinco
# entregas falla a la primera. Lo de aquí es lo que se puede probar sin base de datos: lo que contesta el
# cliente en su enlace, el registro del intento, la puerta aprendida y lo que publica la DGT (cortes, obras y
# zonas de bajas emisiones, en DATEX II).
import xml.etree.ElementTree as _ET  # noqa: E402

DEJAR_CLIENTE = {"buzon": "en el buzón", "porteria": "en portería", "vecino": "a un vecino",
                 "seguro": "en un lugar seguro", "punto_recogida": "en un punto de recogida"}
ESTARE = ("si", "no", "franja")
_ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}")


def _corto(v, n: int) -> str:
    """Texto del cliente: sin saltos ni caracteres de control, en una línea y corto."""
    t = "".join(ch for ch in str(v or "") if ch == " " or (ch.isprintable() and ch not in "\r\n\t"))
    return re.sub(r"\s+", " ", t).strip()[:n]


def respuesta_cliente(data) -> tuple:
    """Lo que contesta el cliente en su enlace → (lo que se guarda, error). Nada que él no diga: si no
    estará, dónde dejarlo; si da una franja, de qué hora a qué hora; el código del portal y una nota."""
    d = data if isinstance(data, dict) else {}
    estare = _corto(d.get("estare"), 10).lower()
    if estare not in ESTARE:
        return None, "Di si estarás, si no estarás, o a qué hora"
    r = {"estare": estare, "dejar": "", "franja": None,
         "portal": _corto(d.get("portal"), 120), "nota": _corto(d.get("nota"), 200)}
    if estare == "no":
        dejar = _corto(d.get("dejar"), 20).lower()
        if dejar not in DEJAR_CLIENTE:
            return None, "Di dónde dejarlo: buzón, portería, vecino, lugar seguro o punto de recogida"
        r["dejar"] = dejar
    if estare == "franja":
        a, b = a_minutos(d.get("franja_desde")), a_minutos(d.get("franja_hasta"))
        if a is None or b is None or b <= a:
            return None, "La franja va de una hora a otra posterior"
        r["franja"] = [hm(a), hm(b)]
    return r, ""


def texto_respuesta(r: dict, quien: str = "") -> str:
    """Lo que se le dice al repartidor: «Lucía M.: no estará, déjalo en portería · portal 1234»."""
    partes = []
    if r.get("estare") == "si":
        partes.append("estará en casa")
    elif r.get("estare") == "no":
        partes.append("no estará: déjalo " + DEJAR_CLIENTE.get(r.get("dejar") or "", "donde diga"))
    elif r.get("franja"):
        partes.append(f"mejor de {r['franja'][0]} a {r['franja'][1]}")
    if r.get("portal"):
        partes.append(f"portal: {r['portal']}")
    if r.get("nota"):
        partes.append(f"«{r['nota']}»")
    texto = " · ".join(partes)
    return f"{quien}: {texto}" if quien else texto


def sanea_intento(d) -> "dict | None":
    """El registro del intento que manda la app: cuándo llegó, si llamó y escribió, cuánto esperó. Solo
    fechas con forma de fecha y números con tope; sin nada de eso, nada."""
    if not isinstance(d, dict):
        return None
    out = {}
    for k in ("llegada", "llamada", "whatsapp"):
        v = str(d.get(k) or "").strip()[:40]
        out[k] = v if _ISO_RE.match(v) else None
    try:
        out["espera_s"] = max(0, min(3600, int(float(d.get("espera_s") or 0))))
    except (TypeError, ValueError):
        out["espera_s"] = 0
    try:
        out["llamadas"] = max(0, min(20, int(float(d.get("llamadas") or 0))))
    except (TypeError, ValueError):
        out["llamadas"] = 0
    if not any(out[k] for k in ("llegada", "llamada", "whatsapp")) and not out["espera_s"]:
        return None
    return out


def puerta_valida(pos, lat, lng, precision_max: float = 50.0, metros_max: float = 300.0):
    """La posición del móvil al pulsar «Entregado», si vale como puerta: precisa (hasta 50 m) y cerca de lo
    que se buscó (hasta 300 m; sin punto buscado, vale). (lat, lng, precisión) o None."""
    if not isinstance(pos, dict):
        return None
    p = _punto(pos)
    if not p:
        return None
    try:
        prec = float(pos.get("precision")) if pos.get("precision") is not None else 9999.0
    except (TypeError, ValueError):
        prec = 9999.0
    if prec != prec or prec > precision_max:
        return None
    if lat is not None and lng is not None and distancia_km((lat, lng), p) * 1000 > metros_max:
        return None
    return (round(p[0], 6), round(p[1], 6), round(prec, 1))


def caja_de(puntos, margen: float = 0.0):
    """La caja (s, w, n, e) que envuelve unos puntos {lat, lng}, con un margen en grados. None sin puntos."""
    ps = [q for q in (_punto(p) for p in puntos) if q]
    if not ps:
        return None
    return (min(p[0] for p in ps) - margen, min(p[1] for p in ps) - margen,
            max(p[0] for p in ps) + margen, max(p[1] for p in ps) + margen)


def en_caja(lat, lng, caja) -> bool:
    return bool(caja) and caja[0] <= lat <= caja[2] and caja[1] <= lng <= caja[3]


def punto_en_poligono(lat, lng, poligono) -> bool:
    """Trazado de rayo: dentro si el rayo hacia el este corta un número impar de lados. `poligono`: [[lat, lng]…]."""
    n = len(poligono)
    if n < 3:
        return False
    dentro = False
    j = n - 1
    for i in range(n):
        yi, xi = poligono[i][0], poligono[i][1]
        yj, xj = poligono[j][0], poligono[j][1]
        if (yi > lat) != (yj > lat):
            x = (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi
            if lng < x:
                dentro = not dentro
        j = i
    return dentro


# ── DATEX II de la DGT: incidencias (cortes y obras) y zonas de bajas emisiones ──
def _local(tag) -> str:
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def _hijo_texto(el, nombre: str) -> str:
    """El texto del primer descendiente con ese nombre (sin espacio de nombres)."""
    for x in el.iter():
        if _local(x.tag) == nombre and x.text and x.text.strip():
            return x.text.strip()
    return ""


def _valor_de(el, nombre: str) -> str:
    """El `com:value` de dentro del primer descendiente con ese nombre (los textos van en listas de valores)."""
    for x in el.iter():
        if _local(x.tag) == nombre:
            return _hijo_texto(x, "value")
    return ""


def _punto_de(el):
    try:
        return (float(_hijo_texto(el, "latitude")), float(_hijo_texto(el, "longitude")))
    except ValueError:
        return None


_INC_GESTION = {
    "roadClosed": ("corte", "carretera cortada"), "carriagewayClosures": ("corte", "calzada cortada"),
    "intermittentShortTermClosures": ("corte", "cortes intermitentes"), "laneClosures": ("obras", "carril cortado"),
    "singleAlternateLineTraffic": ("obras", "paso alternativo"), "narrowLanes": ("obras", "carriles estrechos"),
    "lanesDeviated": ("obras", "desvío de carriles"), "newRoadworksLayout": ("obras", "obras: nuevo trazado"),
    "doNotUseSpecifiedLanesOrCarriageways": ("obras", "carriles cerrados"), "contraflow": ("obras", "contraflujo"),
    "useOfSpecifiedLanesOrCarriagewaysAllowed": ("aviso", "carriles habilitados"),
}
_INC_CAUSA = {
    "roadMaintenance": ("obras", "obras"), "accident": ("accidente", "accidente"),
    "vehicleObstruction": ("obstaculo", "vehículo parado"), "obstruction": ("obstaculo", "obstáculo en la vía"),
    "environmentalObstruction": ("obstaculo", "obstáculo (desprendimiento, inundación…)"),
    "infrastructureDamageObstruction": ("obstaculo", "daños en la vía"), "poorEnvironment": ("meteo", "meteorología"),
    "abnormalTraffic": ("retencion", "retención"),
}
_INC_TIPO = {
    "AbnormalTraffic": ("retencion", "retención"), "SpeedManagement": ("aviso", "límite de velocidad"),
    "GeneralObstruction": ("obstaculo", "obstáculo"), "VehicleObstruction": ("obstaculo", "vehículo parado"),
    "PoorEnvironmentConditions": ("meteo", "meteorología"),
    "NonWeatherRelatedRoadConditions": ("obstaculo", "estado de la vía"),
    "GeneralInstructionOrMessageToRoadUsers": ("aviso", "aviso"),
    "RoadOrCarriagewayOrLaneManagement": ("obras", "restricción"),
}
_GRAVEDAD = {"highest": "alta", "high": "alta", "medium": "media", "low": "baja", "lowest": "baja"}
_XSI_TYPE = "{http://www.w3.org/2001/XMLSchema-instance}type"


def incidencias_datex(xml) -> tuple:
    """Las incidencias activas de la DGT (DATEX II v3, perfil RTTI de nap.dgt.es) → ([{…}], publicado). Cada
    registro con su clase (corte, obras, accidente, obstáculo, retención, meteo, aviso), qué pasa en español,
    la carretera, el punto kilométrico, el municipio, su punto (y el final si es un tramo) y desde cuándo."""
    raiz = _ET.fromstring(xml if isinstance(xml, (bytes, bytearray)) else str(xml).encode("utf-8"))
    publicado = _hijo_texto(raiz, "publicationTime")[:32]
    out = []
    for sit in raiz.iter():
        if _local(sit.tag) != "situation":
            continue
        grav_sit = _hijo_texto(sit, "overallSeverity")
        for rec in sit:
            if _local(rec.tag) != "situationRecord":
                continue
            tipo = (rec.get(_XSI_TYPE) or "").split(":")[-1]
            gestion = [x.text.strip() for x in rec.iter()
                       if _local(x.tag) == "roadOrCarriagewayOrLaneManagementType" and x.text]
            causa = _hijo_texto(rec, "causeType")
            clase, que = "otro", "incidencia"
            if gestion and gestion[0] in _INC_GESTION:
                clase, que = _INC_GESTION[gestion[0]]
                # Un corte manda sobre la causa, pero la causa se dice: «carretera cortada (obras)».
                if clase == "corte" and causa in _INC_CAUSA:
                    que = f"{que} ({_INC_CAUSA[causa][1]})"
            elif causa in _INC_CAUSA:
                clase, que = _INC_CAUSA[causa]
            elif tipo in _INC_TIPO:
                clase, que = _INC_TIPO[tipo]
            desde_el = next((x for x in rec.iter() if _local(x.tag) == "from"), None)
            hasta_el = next((x for x in rec.iter() if _local(x.tag) == "to"), None)
            puntos = [q for q in (_punto_de(pc) for pc in rec.iter() if _local(pc.tag) == "pointCoordinates") if q]
            if not puntos:
                continue
            # En un tramo, el marcador va al principio («from»; la DGT escribe antes el «to»).
            a = (_punto_de(desde_el) if desde_el is not None else None) or puntos[0]
            b = (_punto_de(hasta_el) if hasta_el is not None else None) or (puntos[1] if len(puntos) > 1 else None)
            if b and abs(b[0] - a[0]) < 1e-6 and abs(b[1] - a[1]) < 1e-6:
                b = None
            grav = _hijo_texto(rec, "severity") or grav_sit
            donde = desde_el if desde_el is not None else rec       # el pk y el municipio, del punto del marcador
            out.append({
                "id": (rec.get("id") or sit.get("id") or "")[:20], "clase": clase, "que": que,
                "gravedad": _GRAVEDAD.get(grav, ""),
                "carretera": _hijo_texto(rec, "roadName")[:40], "pk": _hijo_texto(donde, "kilometerPoint")[:12],
                "municipio": _hijo_texto(donde, "municipality")[:60], "provincia": _hijo_texto(donde, "province")[:40],
                "lat": round(a[0], 6), "lng": round(a[1], 6),
                "lat2": round(b[0], 6) if b else None, "lng2": round(b[1], 6) if b else None,
                "desde": _hijo_texto(rec, "overallStartTime")[:32],
            })
    return out, publicado


def incidencias_cerca(items, paradas, margen: float = 0.06, limite: int = 60) -> list:
    """Las incidencias dentro de la caja de las paradas (± margen en grados, unos 6 km), con la distancia a la
    parada más cercana y el número de esa parada. Las más cercanas primero."""
    caja = caja_de(paradas, margen)
    if not caja:
        return []
    ps = [(p, q) for p, q in ((p, _punto(p)) for p in paradas) if q]
    out = []
    for it in items:
        if not en_caja(it["lat"], it["lng"], caja):
            continue
        cerca = min(ps, key=lambda x: distancia_km(x[1], (it["lat"], it["lng"])))
        out.append({**it, "distancia_km": round(distancia_km(cerca[1], (it["lat"], it["lng"])), 1),
                    "parada": cerca[0].get("orden")})
    out.sort(key=lambda x: x["distancia_km"])
    return out[:limite]


def zbe_datex(xml, ciudad: str = "") -> list:
    """Las zonas de bajas emisiones de una ciudad (DATEX II ControlledZoneTablePublication de la DGT) →
    [{id, ciudad, nombre, descripcion, estado, url, version, etiquetas, negado, poligonos, caja}]. La
    descripción es la que escribe el ayuntamiento («Carga y descarga de 6h a 11h»): se enseña tal cual."""
    raiz = _ET.fromstring(xml if isinstance(xml, (bytes, bytearray)) else str(xml).encode("utf-8"))
    out = []
    for z in raiz.iter():
        if _local(z.tag) != "controlledZone":
            continue
        poligonos = []
        for esquinas in z.iter():
            if _local(esquinas.tag) != "openlrPolygonCorners":
                continue
            pol = []
            for c in esquinas:
                if _local(c.tag) == "openlrCoordinates":
                    q = _punto_de(c)
                    if q:
                        pol.append([round(q[0], 6), round(q[1], 6)])
            if len(pol) >= 3:
                poligonos.append(pol)
        if not poligonos:
            continue
        etiquetas = []
        for cond in z.iter():
            if _local(cond.tag) == "conditions" and _hijo_texto(cond, "type") == "stickerCondition":
                v = _hijo_texto(cond, "value")[:8]
                if v and v not in etiquetas:
                    etiquetas.append(v)
        todos = [pt for pol in poligonos for pt in pol]
        out.append({
            "id": (z.get("id") or "")[:80], "ciudad": ciudad[:40], "nombre": _valor_de(z, "name")[:80],
            "descripcion": _valor_de(z, "controlledZoneDescription")[:300],
            "estado": _hijo_texto(z, "status")[:20], "url": _hijo_texto(z, "urlForFurtherInformation")[:200],
            "version": _hijo_texto(z, "controlledZoneRecordVersionTime")[:10], "etiquetas": etiquetas,
            "negado": any(_local(x.tag) == "negate" and (x.text or "").strip() == "true" for x in z.iter()),
            "poligonos": poligonos,
            "caja": (min(p[0] for p in todos), min(p[1] for p in todos), max(p[0] for p in todos), max(p[1] for p in todos)),
        })
    return out


def zbe_cerca(zonas, paradas, margen: float = 0.02) -> list:
    """Las zonas cuya caja toca la caja de las paradas (± margen en grados, unos 2 km)."""
    caja = caja_de(paradas, margen)
    if not caja:
        return []
    return [z for z in zonas if not (z["caja"][2] < caja[0] or z["caja"][0] > caja[2]
                                     or z["caja"][3] < caja[1] or z["caja"][1] > caja[3])]


def zbe_de_paradas(zonas, paradas) -> dict:
    """{id de parada: {id, nombre}} de la primera zona en la que cae cada parada."""
    out = {}
    for p in paradas:
        q = _punto(p)
        if not q:
            continue
        for z in zonas:
            if not en_caja(q[0], q[1], z["caja"]):
                continue
            if any(punto_en_poligono(q[0], q[1], pol) for pol in z["poligonos"]):
                out[p["id"]] = {"id": z["id"], "nombre": z["nombre"]}
                break
    return out
