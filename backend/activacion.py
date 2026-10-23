# -*- coding: utf-8 -*-
"""Activación de los repartidores autónomos: del alta al primer día de reparto de verdad.

Dani (18-10-2026): «mil repartidores son 10.000 € al mes». La métrica que manda no es
cuántos se dan de alta, sino cuántos llegan a USAR la app para trabajar, porque solo esos
pagan cuando acabe la promoción. Medido aquel día a mano: de 31 cuentas, 18 no volvieron
tras el día del alta, 9 metieron paradas y 0 hicieron un día real. Este módulo deja ese
embudo en el panel (Negocio → «Cómo va el negocio») para no tener que calcularlo a mano.

Se cuenta por CUENTA, no por visita: la analítica anónima (analitica.py) olvida a la gente
al cerrar la pestaña, así que aquí se cruza lo que hay en la base (altas, paradas, entregas)
con los eventos de la app que SÍ llevan la empresa (`org`, los de quien ha entrado).

Las cuentas que no cuentan son las mismas que en tools/metricas/usuarios_total.py: demos, la
propia, las de prueba por el nombre y los testers de Google Play (tres o más altas en el
mismo minuto, o el correo puesto como nombre).

Lo que sale de la analítica anónima (abrir otro día, ordenar, navegar) puede ir por debajo
de la realidad: quien bloquea la medición no aparece en esos pasos. Se dice en la pantalla.
"""
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

MADRID = ZoneInfo("Europe/Madrid")
PRUEBA = re.compile(r"prueba|test|demo|revisor|pepito|claude", re.I)
CORREO = re.compile(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", re.I)
TESTERS_MISMO_MINUTO = 3

# Cada paso: (clave, etiqueta, de dónde sale). «eventos» = analítica anónima con `org`.
PASOS = [
    ("alta", "Se dan de alta", "base"),
    ("vuelve", "Abren la app otro día", "eventos"),
    ("parada", "Meten una parada suya", "base"),
    # «Ordenan la ruta» no es un paso: la app ordena sola al pegar la lista o al «Montar ruta», y el
    # evento `ruta_ordenar` solo salta con el botón a mano (en producción, 1 de 9 que navegan).
    ("navega", "Empiezan a navegar", "eventos"),
    ("entrega", "Entregan algo de verdad", "base"),
    ("dia_real", "Hacen un día de reparto real", "base"),
]
# Las acciones de la app que marcan cada paso de «eventos» (nombres de medirAccion).
ACCIONES = {"navega": {"ruta_navegar"}}


def _utc(v):
    """Fechas de Mongo (sin zona) y cadenas ISO (con o sin `Z`) a UTC; lo demás, None."""
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    if isinstance(v, str) and v:
        try:
            d = datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError:
            return None
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    return None


def _dia(dt):
    return dt.astimezone(MADRID).date()


def filtrar_reales(orgs):
    """Las cuentas de autónomo que son personas de verdad, en orden de alta.

    Fuera: demos, la cuenta propia, nombres de prueba, y los testers de Play (lote de
    TESTERS_MISMO_MINUTO o más en el mismo minuto, o el correo como nombre).
    """
    candidatas = []
    for o in orgs:
        if o.get("demo") or o.get("account_type") == "owner" or o.get("sector") != "autonomo":
            continue
        if PRUEBA.search(o.get("name") or ""):
            continue
        creada = _utc(o.get("created_at"))
        if not creada:
            continue
        candidatas.append((creada, o))
    por_minuto = Counter(c.strftime("%Y-%m-%d %H:%M") for c, _ in candidatas)
    reales = []
    for creada, o in sorted(candidatas, key=lambda x: x[0]):
        if por_minuto[creada.strftime("%Y-%m-%d %H:%M")] >= TESTERS_MISMO_MINUTO:
            continue
        if CORREO.match((o.get("name") or "").strip()):
            continue
        reales.append(o)
    return reales


def pasos_de(cuenta, uso_real):
    """Qué pasos ha tocado una cuenta. `cuenta`: creada (datetime), eventos (lista de
    {nombre, ts}), paradas (nº de paradas suyas, sin ejemplos), entregadas (pedidos
    entregados no de ejemplo, con fecha/direccion/cerrado_en). `uso_real(entregadas)`
    devuelve (entregas que cuentan, días que cuentan): la misma vara que el bono."""
    creada = _utc(cuenta.get("creada"))
    eventos = cuenta.get("eventos") or []
    nombres = {e.get("nombre") for e in eventos if e.get("nombre")}
    dia_alta = _dia(creada) if creada else None
    otro_dia = any(
        (t := _utc(e.get("ts"))) and dia_alta and _dia(t) != dia_alta for e in eventos
    )
    entregadas = cuenta.get("entregadas") or []
    _, dias = uso_real(entregadas) if entregadas else (0, 0)
    return {
        "alta": True,
        "vuelve": otro_dia,
        "parada": (cuenta.get("paradas") or 0) > 0,
        "navega": bool(nombres & ACCIONES["navega"]),
        "entrega": len(entregadas) > 0,
        "dia_real": dias >= 1,
    }


def _pct(a, b):
    return round(100 * a / b, 1) if b else None


def embudo(cuentas, ahora, dias, uso_real):
    """El informe: el embudo entero, dónde se cae más gente y la serie por semana."""
    ahora = _utc(ahora)
    desde = ahora - timedelta(days=dias)
    tocados = Counter()
    semanas = defaultdict(lambda: Counter())
    n = 0
    for c in cuentas:
        creada = _utc(c.get("creada"))
        if not creada or creada < desde or creada > ahora:
            continue
        n += 1
        p = pasos_de(c, uso_real)
        lunes = _dia(creada) - timedelta(days=_dia(creada).weekday())
        for clave, ok in p.items():
            if ok:
                tocados[clave] += 1
                semanas[lunes.isoformat()][clave] += 1

    pasos = []
    for clave, etiqueta, fuente in PASOS:
        pasos.append({"clave": clave, "etiqueta": etiqueta, "fuente": fuente,
                      "n": tocados[clave], "pct": _pct(tocados[clave], n)})

    # Dónde se pierde más gente: la mayor caída entre un paso y el siguiente (en cuentas).
    peor = None
    for a, b in zip(pasos, pasos[1:]):
        caida = a["n"] - b["n"]
        if caida > 0 and (peor is None or caida > peor["cuentas"]):
            peor = {"de": a["etiqueta"], "a": b["etiqueta"], "cuentas": caida}

    serie = []
    lunes = _dia(desde) - timedelta(days=_dia(desde).weekday())
    fin = _dia(ahora)
    while lunes <= fin:
        s = semanas.get(lunes.isoformat(), Counter())
        serie.append({"semana": lunes.isoformat(), "altas": s["alta"], "parada": s["parada"],
                      "entrega": s["entrega"], "dia_real": s["dia_real"]})
        lunes += timedelta(days=7)

    return {"dias": dias, "cuentas": n, "pasos": pasos, "peor_caida": peor, "semanas": serie}


async def recoger(global_db, base_de, ahora, dias):
    """Lee de la base lo que necesita `embudo`: las cuentas reales del periodo con sus
    eventos, paradas y entregas. `base_de(nombre)` da la base de cada empresa."""
    ahora = _utc(ahora)
    desde = ahora - timedelta(days=dias)
    # `created_at` se guarda como texto ISO en UTC sin zona: se compara con el mismo formato.
    orgs = await global_db.organizations.find(
        {"sector": "autonomo", "created_at": {"$gte": desde.replace(tzinfo=None).isoformat()}},
        {"_id": 0, "id": 1, "name": 1, "sector": 1, "demo": 1, "account_type": 1,
         "created_at": 1, "db_name": 1}).to_list(5000)
    reales = filtrar_reales(orgs)
    if not reales:
        return []
    ids = [o["id"] for o in reales]
    eventos = defaultdict(list)
    cursor = global_db.analitica_eventos.find(
        {"org": {"$in": ids}, "ts": {"$gte": desde - timedelta(days=1)}},
        {"_id": 0, "org": 1, "nombre": 1, "ts": 1})
    async for e in cursor:
        eventos[e["org"]].append({"nombre": e.get("nombre"), "ts": e.get("ts")})
    cuentas = []
    for o in reales:
        paradas, entregadas = 0, []
        if o.get("db_name"):
            db = base_de(o["db_name"])
            paradas = await db.reparto_pedidos.count_documents({"ejemplo": {"$ne": True}})
            if paradas:
                entregadas = await db.reparto_pedidos.find(
                    {"estado": "entregado", "ejemplo": {"$ne": True}},
                    {"_id": 0, "fecha": 1, "direccion": 1, "cerrado_en": 1}).to_list(5000)
        cuentas.append({"id": o["id"], "creada": o.get("created_at"), "eventos": eventos.get(o["id"], []),
                        "paradas": paradas, "entregadas": entregadas})
    return cuentas
