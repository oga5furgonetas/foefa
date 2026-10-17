# -*- coding: utf-8 -*-
"""El estado de la flota: qué furgoneta está peor, por qué y en qué zona (17-10-2026).

Dani: «una sección de estado de tu flota: cuál es la que peor está (con la última foto de las inspecciones),
siempre que no esté ya en el taller; que se pueda ordenar, ver las fotos y mandarla al taller; con un buen
baremo, que añada cosas que las fotos no ven, sin falsos positivos».

DE DÓNDE SALE CADA DAÑO. De la ÚLTIMA inspección analizada, contrastada con el libro de daños:
  · Un daño de la última foto cuenta si su pieza tiene un apunte ABIERTO en el libro sin orden de taller.
    El libro es la memoria depurada: lo que una persona descartó en Revisión rápida ya no está, lo reparado
    tampoco, y la IA solo apunta lo que da por seguro. Así la foto de hoy da el detalle («puerta delantera
    izquierda» y «puerta delantera derecha» por separado: el libro guarda UN apunte por tipo de pieza y no
    distingue los lados) y el libro quita los fantasmas.
  · Lo que está en el libro y no sale en la última foto también cuenta, con su fecha: que la IA no lo
    vuelva a nombrar un día no quiere decir que se haya arreglado (medido el 17-10: 146 de 240 apuntes
    abiertos no salían en la última inspección de su furgoneta).

EL BAREMO. Se suman PUNTOS DE DETERIORO y la salud es 100 menos esos puntos (nunca menos de 0):
  · Daño de chapa: crítico 35, grave 18, moderado 7, leve 2. Lo que solo ha visto la IA cuenta un 70 %;
    lo que confirmó una persona cuenta entero.
  · Lo que las fotos NO ven, dicho por el conductor en esa misma inspección:
      - el checklist (luces, neumáticos, puertas, espejos) marcado «dañado» o «malo»: 10 cada uno;
      - lo que escribe en la nota: frenos y dirección 30 (y es urgente), motor 18, neumáticos y puertas
        12, luces, visibilidad y batería 7. Cada cosa cuenta una vez aunque salga en el checklist y en
        la nota. «Peligro» o «urgente» escritos por él la hacen urgente.
  · Averías abiertas de los últimos 30 días: crítica 30 (urgente), grave 15, moderada 6, leve 2.
    Las de antes NO cuentan: el 17-10 había 28 abiertas, la más nueva del 23-09 y casi todas «Vehículo en
    taller —» de furgonetas que ya volvieron. Nadie las cerró; contarlas sería un falso positivo.
  · La IA dice en la última inspección que no es seguro circular: 14 y urgente (se dice que es la IA).
  · Lo del conductor y lo de la IA sobre circular solo vale si esa inspección es de los últimos 14 días:
    el 17-10 una furgoneta salía «urgente» por un «no es seguro circular» del 31-07.
  · La ITV NO suma: se enseña aparte. El 17-10 había 14 «caducadas» hace hasta 441 días que salían a
    repartir a diario — es la fecha de la ficha sin actualizar, y eso es de Vencimientos, no del taller.
  · Nada por «falta de mantenimiento»: con 18 apuntes en toda la flota señalaría a todas por no tener datos.

LOS NIVELES (calibrados con los datos reales del 17-10-2026):
  · Taller urgente — algo de lo de arriba marcado como urgente, o 45 puntos o más.
  · Necesita taller — 22 puntos o más, o un daño grave confirmado por una persona.
  · Vigilar — 7 puntos o más.
  · Bien — menos de 7. Si no hay ninguna inspección en 30 días no se dice «Bien»: es «Sin datos».

El módulo no toca la base: recibe los datos y devuelve la ficha. Se prueba entero sin red (test_salud_flota).
"""
import re
import unicodedata
from datetime import date

DANO_PUNTOS = {"critico": 35, "grave": 18, "moderado": 7, "leve": 2}
INCIDENCIA_PUNTOS = {"critico": 30, "grave": 15, "moderado": 6, "media": 6, "leve": 2}
FACTOR_IA = 0.7
IA_NO_CIRCULA_PUNTOS = 14
CHECKLIST_PUNTOS = 10
INCIDENCIA_DIAS = 30
RECIENTE_DIAS = 14
SIN_DATOS_DIAS = 30
UMBRAL_URGENTE, UMBRAL_TALLER, UMBRAL_VIGILAR = 45, 22, 7
GRAVEDAD_ORDEN = {"critico": 0, "grave": 1, "moderado": 2, "media": 2, "leve": 3}
NIVELES = {
    "urgente": "Taller urgente",
    "taller": "Necesita taller",
    "vigilar": "Vigilar",
    "bien": "Bien",
    "sin_datos": "Sin datos recientes",
}
NIVEL_ORDEN = {"urgente": 0, "taller": 1, "vigilar": 2, "sin_datos": 3, "bien": 4}
ZONAS = {
    "frontal": "Frontal",
    "lat_izq": "Lateral izquierdo",
    "lat_der": "Lateral derecho",
    "trasera": "Trasera",
    "ruedas": "Ruedas",
    "otros": "Otros",
}
HINT_ZONA = {"frontal": "frontal", "trasera": "trasera", "lateral_izquierdo": "lat_izq", "lateral_derecho": "lat_der"}
SEVERIDAD_TXT = {"critico": "crítico", "grave": "grave", "moderado": "moderado", "media": "moderado", "leve": "leve"}

# Lo que el conductor cuenta y la foto no ve. (categoría, puntos, urgente, nombre, patrón sobre el texto plano)
MECANICA = [
    ("frenos", 30, True, "Frenos", r"\bfren|pastilla|\bdisco|travao|travoes"),
    ("direccion", 30, True, "Dirección", r"direccion|volante"),
    ("motor", 18, False, "Motor", r"motor|testigo|chivato|turbo|embrague|caja de cambio|marcha|\bcarter|aceite|humo"),
    ("neumaticos", 12, False, "Neumáticos", r"neumatic|rueda|pinchaz|\bpneu|cubierta"),
    ("puertas", 12, False, "Puertas", r"puerta|cerradura|porton"),
    ("luces", 7, False, "Luces", r"\bluz\b|\bluces|bombilla|intermitente|\bfaro|piloto|\bfoco"),
    ("visibilidad", 7, False, "Visibilidad", r"limpiaparabrisas|escobilla|espejo|retrovisor|\bluna\b|parabrisas"),
    ("bateria", 7, False, "Batería", r"bateri|no arranca|arranque"),
]
MECANICA_NOMBRE = {c[0]: c[3] for c in MECANICA}
CHECKLIST_CATEGORIA = {"luces": "luces", "neumaticos": "neumaticos", "puertas": "puertas", "espejos": "visibilidad"}
CHECKLIST_MAL = ("danado", "malo")
CHECKLIST_NOMBRE = {"chapa": "Chapa", "neumaticos": "Neumáticos", "luces": "Luces", "puertas": "Puertas",
                    "espejos": "Espejos", "interior": "Interior", "combustible": "Combustible", "limpieza": "Limpieza"}
CHECKLIST_VALOR = {"regular": "regular", "danado": "dañado", "malo": "malo"}
_URGENTE_TXT = r"peligr|urgente|no frena|se abre sola"
_TODO_BIEN = r"^(todo )?(bien|ok|correcto|perfecto|nada|sin (novedad|problemas?|incidencias?))\.?$"


def _plano(s) -> str:
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", s.replace("_", " ")).strip()


def zona(pieza: str, panel: str = "", hint: str = "") -> str:
    """La zona del daño: la que dice la IA (`location_hint`) y, si no la dice, el texto de la pieza.

    Se lee el nombre de la PIEZA y el tipo (`panel`) solo si no hay nombre: el tipo es una simplificación del
    nombre y pierde cosas. «Paso de rueda derecho» es chapa del lateral (el arco), pero su tipo es «rueda», y
    leyendo los dos pintaba las cuatro ruedas del dibujo como si fuera un neumático (9886 NFX, 17-10).
    """
    t = f" {_plano(pieza) or _plano(panel)} "
    t = re.sub(r"\bpaso (de )?rueda", " paso ", t)
    if re.search(r"\b(rueda|neumatico|llanta|tapacubos)", t):
        return "ruedas"
    if hint in HINT_ZONA:
        return HINT_ZONA[hint]
    izq = re.search(r"\b(izq|izda|izquierd)", t)
    der = re.search(r"\b(der|dcha|derech)", t)
    if izq and not der:
        return "lat_izq"
    if der and not izq:
        return "lat_der"
    if re.search(r"\b(traser|porton|pilot|maletero)", t):
        return "trasera"
    if re.search(r"\b(delanter|frontal|capo|parabrisas|rejilla|calandra|faro|optica)", t):
        return "frontal"
    return "otros"


def mecanica_de_la_nota(nota: str) -> list:
    """Las categorías de avería que nombra la nota del conductor. [] si no nombra ninguna o dice que todo bien."""
    t = _plano(nota)
    if not t or re.match(_TODO_BIEN, t):
        return []
    # «Luz de freno» es una bombilla, no los frenos; «luz de motor» es un testigo, no una bombilla.
    t = re.sub(r"\bluz(es)? (de |del )?frenos?\b", " bombilla ", t)
    t = re.sub(r"\bluz(es)? (de |del )?(motor|aceite|averia|check)\b", " testigo ", t)
    return [c[0] for c in MECANICA if re.search(c[4], t)]


def lo_que_no_se_ve(checklist: dict, nota: str) -> list:
    """Lo que el conductor marca o escribe en la inspección y la foto no puede ver.

    [{categoria, nombre, puntos, urgente, origen: checklist|nota}], una vez por categoría (gana la nota, que
    dice más). La chapa, la limpieza, el interior y el combustible del checklist no entran: la chapa ya la
    ven las fotos y lo demás no es estado del vehículo.
    """
    tabla = {c[0]: c for c in MECANICA}
    out = {}
    for item, valor in (checklist or {}).items():
        cat = CHECKLIST_CATEGORIA.get(str(item))
        if cat and _plano(valor) in CHECKLIST_MAL:
            out[cat] = {"categoria": cat, "nombre": tabla[cat][3], "puntos": CHECKLIST_PUNTOS,
                        "urgente": False, "origen": "checklist"}
    urgente_txt = bool(re.search(_URGENTE_TXT, _plano(nota)))
    for cat in mecanica_de_la_nota(nota):
        c = tabla[cat]
        previo = out.get(cat)
        out[cat] = {"categoria": cat, "nombre": c[3], "puntos": max(c[1], (previo or {}).get("puntos", 0)),
                    "urgente": c[2] or urgente_txt, "origen": "nota"}
    return sorted(out.values(), key=lambda x: -x["puntos"])


def _pieza(*textos) -> str:
    """El nombre de la pieza con mayúscula inicial: la IA escribe a veces «puerta delantera derecha»."""
    t = next((str(x).strip() for x in textos if x and str(x).strip()), "")
    return t[:1].upper() + t[1:]


def danos_a_contar(libro: list, ultima_danos: list) -> list:
    """Cruza la última foto con el libro (ver arriba). Cada daño: {zona, pieza, severity, humano, foto, visto}.

    `libro`: apuntes abiertos SIN orden ({panel, part, severity, source, first_seen, first_seen_inspection}).
    `ultima_danos`: daños de la última inspección ya filtrados (ni `confirmed: False` ni descartados por una
    persona), con su `panel` canónico, `location_hint`, `photo_index` y `humano` (lo validó alguien).
    """
    abiertos = {e.get("panel"): e for e in libro if e.get("panel")}
    vistos = set()
    out = []
    for dm in ultima_danos:
        e = abiertos.get(dm.get("panel"))
        if not e:
            continue                                   # descartado, reparado o nunca seguro: no cuenta
        vistos.add(dm.get("panel"))
        out.append({
            "zona": zona(dm.get("part"), dm.get("panel"), dm.get("location_hint")),
            "pieza": _pieza(dm.get("part"), e.get("part"), dm.get("panel")),
            "panel": dm.get("panel"),
            "severity": str(dm.get("severity") or e.get("severity") or "").lower(),
            "humano": bool(dm.get("humano")) or e.get("source") == "human",
            "en_ultima": True, "photo_index": dm.get("photo_index"),
            "desde": str(e.get("first_seen") or "")[:10],
        })
    for e in libro:
        if e.get("panel") in vistos:
            continue
        out.append({
            "zona": zona(e.get("part"), e.get("panel")),
            "pieza": _pieza(e.get("part"), e.get("panel")),
            "panel": e.get("panel"),
            "severity": str(e.get("severity") or "").lower(),
            "humano": e.get("source") == "human",
            "en_ultima": False, "photo_index": None,
            "desde": str(e.get("first_seen") or "")[:10],
            "ledger_id": e.get("ledger_id"),
        })
    out.sort(key=lambda d: (GRAVEDAD_ORDEN.get(d["severity"], 9), not d["humano"], d["pieza"]))
    return out


def averias_vigentes(incidencias: list, hoy: date) -> list:
    """Averías abiertas que cuentan: las de los últimos 30 días que no son el aviso automático de «en taller»
    (aquí solo llegan furgonetas que NO están en el taller, así que ese aviso es de una visita que ya acabó)."""
    out = []
    for i in incidencias:
        titulo = (i.get("titulo") or "").strip()
        if _plano(titulo).startswith("vehiculo en taller"):
            continue
        try:
            dias = (hoy - date.fromisoformat(str(i.get("fecha") or "")[:10])).days
        except ValueError:
            continue
        if 0 <= dias <= INCIDENCIA_DIAS:
            out.append({**i, "dias": dias})
    return out


def ficha(vehiculo: dict, danos: list, mecanica: list, averias: list, ultima: dict, itv_dias=None) -> dict:
    """La ficha de salud de UNA furgoneta a partir de lo ya cruzado (`danos_a_contar`, `lo_que_no_se_ve`,
    `averias_vigentes`). `ultima`: {fecha, dias, circulation_safe, …} de la última inspección, o {}."""
    ultima = ultima or {}
    reciente = ultima.get("dias") is not None and ultima["dias"] <= RECIENTE_DIAS
    if not reciente:
        mecanica = []
    puntos = 0.0
    motivos = []
    urgencias = []
    zonas = {}
    confirmados = sin_confirmar = 0
    grave_confirmado = False
    for d in danos:
        sev = d["severity"]
        p = DANO_PUNTOS.get(sev, 0) * (1 if d["humano"] else FACTOR_IA)
        puntos += p
        confirmados += 1 if d["humano"] else 0
        sin_confirmar += 0 if d["humano"] else 1
        grave_confirmado |= d["humano"] and sev in ("grave", "critico")
        if d["humano"] and sev == "critico":
            urgencias.append(f"Daño crítico confirmado: {d['pieza'] or 'chapa'}")
        z = zonas.setdefault(d["zona"], {"zona": d["zona"], "nombre": ZONAS[d["zona"]], "peor": sev, "n": 0})
        z["n"] += 1
        if GRAVEDAD_ORDEN.get(sev, 9) < GRAVEDAD_ORDEN.get(z["peor"], 9):
            z["peor"] = sev
        motivos.append((p, f"{d['pieza'] or 'Chapa'}: {SEVERIDAD_TXT.get(sev, sev or '?')}"
                           f"{'' if d['humano'] else ' (lo vio la IA)'}"))
    for m in mecanica:
        puntos += m["puntos"]
        quien = "el conductor lo marca" if m["origen"] == "checklist" else "lo escribe el conductor"
        motivos.append((m["puntos"], f"{m['nombre']}: {quien}"))
        if m["urgente"]:
            urgencias.append(f"{m['nombre']}: el conductor avisa")
    for a in averias:
        sev = str(a.get("severity") or "").lower()
        p = INCIDENCIA_PUNTOS.get(sev, 2)
        puntos += p
        motivos.append((p, f"Avería: {(a.get('titulo') or 'sin describir').strip()[:60]} "
                           f"({SEVERIDAD_TXT.get(sev, sev or '?')})"))
        if sev == "critico":
            urgencias.append("Avería crítica abierta")
    if reciente and ultima.get("circulation_safe") is False:
        puntos += IA_NO_CIRCULA_PUNTOS
        motivos.append((IA_NO_CIRCULA_PUNTOS, "La IA marcó en la última inspección que no es seguro circular"))
        urgencias.append("La IA dice que no es seguro circular")
    puntos = round(puntos, 1)
    if urgencias or puntos >= UMBRAL_URGENTE:
        nivel = "urgente"
    elif puntos >= UMBRAL_TALLER or grave_confirmado:
        nivel = "taller"
    elif puntos >= UMBRAL_VIGILAR:
        nivel = "vigilar"
    elif ultima.get("dias") is None or ultima["dias"] > SIN_DATOS_DIAS:
        nivel = "sin_datos"
    else:
        nivel = "bien"
    lista_zonas = sorted(zonas.values(), key=lambda z: (GRAVEDAD_ORDEN.get(z["peor"], 9), z["nombre"]))
    motivos.sort(key=lambda m: -m[0])
    return {
        "vehicle_id": vehiculo.get("id"), "matricula": vehiculo.get("license_plate") or "?",
        "modelo": " ".join(x for x in (vehiculo.get("brand"), vehiculo.get("model")) if x).strip(),
        "center": (vehiculo.get("center") or "").strip(),
        "salud": max(0, round(100 - puntos)), "puntos": puntos, "nivel": nivel, "nivel_txt": NIVELES[nivel],
        "urgencias": urgencias, "zonas": lista_zonas,
        "resumen": resumen(lista_zonas, mecanica, averias),
        "danos": len(danos), "confirmados": confirmados, "sin_confirmar": sin_confirmar,
        "mecanica": mecanica, "averias": len(averias),
        "itv_vencida": itv_dias is not None and itv_dias < 0, "itv_dias": itv_dias,
        "motivos": [{"puntos": round(p, 1), "texto": t} for p, t in motivos],
        "ultima": ultima,
    }


def resumen(zonas: list, mecanica: list, averias: list) -> str:
    """Una línea para la lista: «Lateral izquierdo grave · Lateral derecho grave · Frenos · 1 avería»."""
    trozos = [f"{z['nombre']} {SEVERIDAD_TXT.get(z['peor'], z['peor'])}" for z in zonas[:4]]
    if len(zonas) > 4:
        trozos.append(f"y {len(zonas) - 4} zona{'s' if len(zonas) - 4 > 1 else ''} más")
    trozos += [m["nombre"] for m in mecanica[:3]]
    if averias:
        trozos.append(f"{len(averias)} avería{'s' if len(averias) > 1 else ''}")
    return " · ".join(trozos) or "Sin daños pendientes"


def ordenar(fichas: list, por: str = "peor") -> list:
    """peor (primero el nivel y dentro la menor salud) · mejor · matricula · antigua (última foto más vieja)."""
    if por == "matricula":
        return sorted(fichas, key=lambda f: f["matricula"])
    if por == "mejor":
        return sorted(fichas, key=lambda f: (-f["salud"], f["matricula"]))
    if por == "antigua":
        return sorted(fichas, key=lambda f: (-(f["ultima"].get("dias") if f["ultima"].get("dias") is not None else 10 ** 6), f["matricula"]))
    return sorted(fichas, key=lambda f: (NIVEL_ORDEN[f["nivel"]], f["salud"], f["matricula"]))
