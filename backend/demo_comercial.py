# -*- coding: utf-8 -*-
"""Demo comercial «Paquetería del Noroeste» (06-10-2026), para enseñar Flota a una
paquetería de verdad: 5 delegaciones gallegas, 150 furgonetas, ~170 conductores y un
mes de operación (inspecciones diarias, golpes con su coste, quién los causa, taller,
vencimientos, cuadrante y turnos).

Para qué: la demo pública (dsp_demo) tiene 1 centro, 10 furgonetas y es de solo
lectura. A una empresa de 150 vehículos eso no le dice nada, y en una reunión lo que
convence es hacer una inspección en directo con el móvil. Esta empresa es NORMAL
(se puede escribir), marcada `interna` para que no se facture, y se entra con
«entrar como» desde el panel del super-admin.

Reglas: todo inventado (nombres combinados, matrículas al azar con el formato
español, talleres sin marca), SIN teléfonos ni correos (podrían ser de alguien), y
determinista (misma semilla → mismos datos) con las fechas relativas a hoy.

El módulo no toca la base: `generar(ahora)` devuelve {colección: [documentos]}.
"""
import random
from datetime import datetime, timedelta, timezone

try:
    from zoneinfo import ZoneInfo
    _MADRID = ZoneInfo("Europe/Madrid")
except Exception:                                                # noqa: BLE001
    _MADRID = timezone.utc

ORG_ID = "demo-noroeste"
NOMBRE = "Paquetería del Noroeste (demo)"
CENTROS = {"CORUÑA": 45, "SANTIAGO": 30, "LUGO": 20, "OURENSE": 20, "VIGO": 35}   # 150 furgonetas
MODULOS = ["dashboard", "mi-dia", "actividad", "asignacion", "cuadrante", "turnos", "checklist-operativo",
           "plantilla", "vehiculos", "revision", "inspecciones", "incidencias", "talleres", "ordenes",
           "aparcamiento", "vencimientos", "importaciones", "chat", "conductores", "incorporaciones",
           "empleo", "contactos", "origen-danos", "ia-peritaje", "configuracion"]

_MODELOS = [("Citroën", "Berlingo", 3), ("Peugeot", "Partner", 3), ("Renault", "Kangoo", 2),
            ("Ford", "Transit Custom", 3), ("Renault", "Trafic", 2), ("Mercedes-Benz", "Vito", 2),
            ("Renault", "Master", 2), ("Mercedes-Benz", "Sprinter", 2), ("Iveco", "Daily", 1)]
_RENTING = ["Renting Atlántico", "Norte Fleet", "Flota propia"]
_NOMBRES = ["Brais", "Uxía", "Antón", "Iria", "Xoán", "Noa", "Martín", "Lucía", "Iago", "Sabela", "Hugo",
            "Carmen", "Pablo", "Antía", "Manuel", "Laura", "Diego", "Alba", "Roi", "Paula", "Javier",
            "Andrea", "Óscar", "Marta", "Rubén", "Sara", "Adrián", "Eva", "Iván", "Nerea", "Alberto",
            "Cristina", "Daniel", "Rocío", "Sergio", "Beatriz", "Raúl", "Silvia", "Marcos", "Lorena"]
_APELLIDOS = ["Castro", "Pereira", "Rodríguez", "Fernández", "López", "Vázquez", "Rey", "Otero",
              "Lorenzo", "Varela", "Pazos", "Seoane", "Barreiro", "Couto", "Iglesias", "Souto",
              "Méndez", "Gómez", "Dopazo", "Rial", "Lema", "Mosquera", "Carballo", "Teijeiro",
              "Bouzas", "Ferreiro", "Abalo", "Prieto", "Vilar", "Domínguez"]
_PIEZAS = [("Paragolpes trasero", "paragolpes", "trasera"), ("Paragolpes delantero", "paragolpes", "frontal"),
           ("Puerta lateral derecha", "puerta", "lateral_derecho"), ("Puerta corredera izquierda", "puerta", "lateral_izquierdo"),
           ("Aleta delantera izquierda", "aleta", "lateral_izquierdo"), ("Portón trasero", "porton", "trasera"),
           ("Retrovisor derecho", "menor", "lateral_derecho"), ("Faldón lateral derecho", "faldon", "lateral_derecho"),
           ("Óptica trasera izquierda", "optica", "trasera")]
_GOLPES = {"leve": (90, 220, "Rozadura con pérdida de pintura en la superficie."),
           "moderado": (240, 520, "Abolladura con la pintura cuarteada; hay que enderezar y pintar."),
           "grave": (600, 1400, "Impacto con deformación de la chapa y la pieza desalineada.")}
_TALLERES = [("Chapa y Pintura {c}", ["chapa", "pintura"]), ("Mecánica Rápida {c}", ["mecanica", "neumaticos"])]
_LETRAS = "BCDFGHJKLMNPRSTVWXYZ"


def _dia(d):
    return d.strftime("%Y-%m-%d")


def generar(ahora=None, semilla=2026):
    ahora = ahora or datetime.now(timezone.utc)
    r = random.Random(semilla)
    # «Hoy» es el de Madrid: a las 0:30 de aquí todavía es ayer en UTC, y la pantalla
    # «Hoy» salía vacía. Las horas se guardan en UTC, como en el resto de la app.
    hoy = ahora.astimezone(_MADRID).replace(hour=0, minute=0, second=0, microsecond=0)
    iso = ahora.isoformat()
    vehiculos, conductores, por_centro_v, por_centro_c = [], [], {}, {}
    usados = set()

    # ── Furgonetas ───────────────────────────────────────────────────────────
    modelos = [m for m in _MODELOS for _ in range(m[2])]
    n = 0
    for centro, cuantas in CENTROS.items():
        por_centro_v[centro] = []
        for _ in range(cuantas):
            marca, modelo, _p = r.choice(modelos)
            year = r.randint(2019, 2025)
            while True:
                mat = f"{r.randint(1000, 9999)} {'KLMN'[min(3, (year - 2019) // 2)]}{r.choice(_LETRAS)}{r.choice(_LETRAS)}"
                if mat not in usados:
                    usados.add(mat)
                    break
            prov = r.choice(_RENTING)
            km = r.randint(18000, 210000)
            itv = hoy + timedelta(days=r.randint(-3, 330))
            v = {"id": f"dn-v{n}", "license_plate": mat, "brand": marca, "model": modelo, "year": year,
                 "color": "Blanco", "status": "active", "center": centro, "mileage": km,
                 "provider": prov, "vehicle_type": "Furgoneta", "fuel_type": "Diésel",
                 "itv_date": _dia(itv),
                 "renting_end_date": _dia(hoy + timedelta(days=r.randint(40, 900))) if prov != "Flota propia" else None,
                 "oil_interval_km": 30000, "oil_last_change_km": km - r.randint(2000, 29000),
                 "documents": [], "bloqueada": False, "current_driver_id": None,
                 "mileage_history": [{"date": _dia(hoy - timedelta(days=d)), "km": km - d * 140, "source": "inspeccion"}
                                     for d in (28, 21, 14, 7, 0)],
                 "created_at": iso, "updated_at": iso, "demo_comercial": True}
            vehiculos.append(v)
            por_centro_v[centro].append(v)
            n += 1
    # Unas cuantas en el taller (con su orden) y alguna ITV a punto de caducar: lo que
    # un jefe de tráfico mira cada mañana.
    en_taller = r.sample(vehiculos, 5)
    for v in en_taller:
        v["status"] = "taller"
    for v in r.sample([x for x in vehiculos if x["status"] == "active"], 6):
        v["itv_date"] = _dia(hoy + timedelta(days=r.randint(2, 14)))

    # ── Conductores ──────────────────────────────────────────────────────────
    nombres = [f"{a} {b} {c}" for a in _NOMBRES for b in _APELLIDOS for c in _APELLIDOS if b != c]
    r.shuffle(nombres)
    k = 0
    for centro, lista in por_centro_v.items():
        por_centro_c[centro] = []
        for _ in range(int(len(lista) * 1.13) + 1):
            c = {"id": f"dn-d{k}", "name": nombres[k], "center": centro, "active": True,
                 "contrato": "empresa" if r.random() < 0.8 else "ett", "nivel": r.choice(["pleno", "L1", "L2"]),
                 "dni": None, "phone": None, "email": None, "created_at": iso, "demo_comercial": True}
            conductores.append(c)
            por_centro_c[centro].append(c)
            k += 1
    # ── Un mes de inspecciones (de lunes a sábado), con sus golpes ──────────
    inspecciones, ledger, incidencias = [], [], []
    fijo = {}
    for centro, lista in por_centro_v.items():
        gente = por_centro_c[centro]
        for i, v in enumerate(lista):
            fijo[v["id"]] = gente[i % len(gente)]
    # Tres con muchos más golpes que el resto: es lo que enseña «quién causa los golpes».
    # Entre los que llevan furgoneta fija: si no conducen, no hay golpes que atribuirles.
    torpes = set(r.sample(sorted({c["id"] for c in fijo.values()}), 3))
    hoy_local = hoy
    for atras in range(30, -1, -1):
        dia = hoy_local - timedelta(days=atras)
        if dia.weekday() == 6:
            continue
        for centro, lista in por_centro_v.items():
            gente = por_centro_c[centro]
            for v in lista:
                if v["status"] == "taller" and atras < 4:
                    continue
                if r.random() > 0.93:
                    continue
                cond = fijo[v["id"]] if r.random() < 0.8 else r.choice(gente)
                cuando = (dia.replace(hour=17, minute=0) + timedelta(minutes=r.randint(0, 200))).astimezone(timezone.utc)
                if atras == 0 and cuando > ahora:
                    continue
                pid = f"dn-i{len(inspecciones)}"
                prob = 0.18 if cond["id"] in torpes else 0.005
                nuevos = []
                if r.random() < prob:
                    pieza, panel, hint = r.choice(_PIEZAS)
                    sev = r.choices(["leve", "moderado", "grave"], [5, 3, 1])[0]
                    lo, hi, desc = _GOLPES[sev]
                    coste = float(r.randrange(lo, hi, 10))
                    nuevos.append({"part": pieza, "severity": sev, "description": desc, "repair_suggestion": "",
                                   "estimated_cost": coste, "confidence": round(r.uniform(0.82, 0.97), 2),
                                   "location_hint": hint, "is_new": True, "repair_status": "pending",
                                   "actual_cost": None, "workshop_id": None})
                    ledger.append({"vehicle_id": v["id"], "panel": panel, "part": pieza, "severity": sev,
                                   "status": "open", "source": "ai", "rank": 1, "first_seen": cuando.isoformat(),
                                   "first_seen_inspection": pid, "updated_at": cuando.isoformat()})
                    if sev != "leve":
                        incidencias.append({
                            "id": f"dn-inc{len(incidencias)}", "vehicle_id": v["id"], "driver_id": cond["id"],
                            "created_by_name": "IA de inspección", "title": f"{pieza}: golpe nuevo",
                            "description": desc, "severity": sev,
                            "status": "open" if atras < 10 else "resolved", "photos": [], "notes": "",
                            "created_at": cuando.isoformat(), "updated_at": cuando.isoformat(),
                            "resolved_at": None if atras < 10 else (cuando + timedelta(days=3)).isoformat(),
                            "auto_created": True, "history": [], "center": centro})
                sev_g = nuevos[0]["severity"] if nuevos else "sin_danos"
                inspecciones.append({
                    "id": pid, "vehicle_id": v["id"], "driver_id": cond["id"], "center": centro,
                    "photos": [], "annotated_photos": [], "notes": "", "analysis_status": "ok",
                    "created_at": cuando.isoformat(), "reviewed": atras > 0,
                    "analysis": {
                        "severity": sev_g, "urgency": "esta_semana" if nuevos else "puede_esperar",
                        "risk": {"grave": "alto", "moderado": "medio"}.get(sev_g, "bajo"),
                        "circulation_safe": True, "critical_damages_count": 0,
                        "total_damages_count": len(nuevos), "new_damages_count": len(nuevos),
                        "total_estimated_cost": sum(d["estimated_cost"] for d in nuevos),
                        "confidence": 92, "dirt_level": round(r.uniform(0.1, 0.6), 2),
                        "executive_summary": ("Golpe nuevo respecto a la inspección anterior: " + nuevos[0]["part"].lower() + ".")
                        if nuevos else "Sin daños nuevos respecto a la inspección anterior.",
                        "damages": nuevos, "new_damages": nuevos, "affected_parts": [d["part"] for d in nuevos],
                        "image_quality_warnings": [], "critical_damages": [], "fraud_warnings": [],
                        "zonas_no_evaluables": []},
                    "demo_comercial": True})
    # Hoy: qué furgoneta lleva cada uno
    asignaciones = []
    for centro, lista in por_centro_v.items():
        slots = []
        for v in lista:
            if v["status"] != "active":
                continue
            c = fijo[v["id"]]
            v["current_driver_id"] = c["id"]
            slots.append({"vehicle_id": v["id"], "vehicle_plate": v["license_plate"],
                          "driver_id": c["id"], "driver_name": c["name"]})
        asignaciones.append({"id": f"dn-a-{centro}", "date": _dia(hoy), "center": centro, "slots": slots,
                             "created_at": iso, "updated_at": iso})

    # ── Talleres y órdenes ───────────────────────────────────────────────────
    talleres, ordenes = [], []
    for centro in CENTROS:
        for j, (nombre, cats) in enumerate(_TALLERES):
            talleres.append({"id": f"dn-t-{centro}-{j}", "name": nombre.format(c=centro.title()), "address": "",
                             "city": centro.title(), "center": centro, "phone": "", "email": "", "notes": "",
                             "categories": cats, "convenios": [], "active": True, "is_official": False,
                             "hours": "L-V 8:00-19:00", "maps_url": "", "created_at": iso, "updated_at": iso})
    estados = ["recibido", "esperando_piezas", "abierta", "abierta", "recibido"]
    for i, v in enumerate(en_taller):
        t = next(x for x in talleres if x["center"] == v["center"])
        entrada = hoy - timedelta(days=r.randint(1, 6))
        imp = float(r.randrange(320, 1800, 10))
        ordenes.append({
            "id": f"dn-ot{i}", "numero": f"OT-{entrada.strftime('%y%m')}-{100 + i}", "vehicle_id": v["id"],
            "matricula": v["license_plate"], "modelo": f"{v['brand']} {v['model']}", "center": v["center"],
            "workshop_id": t["id"], "taller_nombre": t["name"], "taller_telefono": "", "incident_id": None,
            "estado": estados[i % len(estados)], "problema": r.choice(["Golpe en el portón trasero", "Embrague",
                                                                       "Puerta corredera que no cierra", "Frenos", "Paragolpes delantero"]),
            "descripcion_trabajo": "", "fecha_entrada": _dia(entrada),
            "fecha_entrega_estimada": _dia(hoy + timedelta(days=r.randint(1, 5))), "fecha_entrega_real": None,
            "importe_estimado": imp, "importe_final": None, "presupuesto": "", "fotos": [], "partes": [],
            "historial": [{"en": entrada.isoformat(), "estado": "abierta", "por": "Jefe de tráfico"}],
            "creada_por": "Jefe de tráfico", "creada_en": entrada.isoformat(), "actualizada_en": iso,
            "vehiculo_estado_previo": "active", "ledger_ids": [], "abierto_en": entrada.isoformat()})

    # ── Cuadrante: dos semanas atrás y dos adelante, 5 días y 2 libres ──────
    turnos, personas = [], []
    for centro, gente in por_centro_c.items():
        for orden, c in enumerate(gente):
            personas.append({"driver_id": c["id"], "center": centro, "en_cuadrante": True, "orden": orden,
                             "tipo": "normal", "patron": None, "alta_desde": _dia(hoy - timedelta(days=90)),
                             "inactivo_desde": None, "actualizado_en": iso, "actualizado_por": "demo"})
            de_vacaciones = r.random() < 0.04
            for d in range(-14, 15):
                fecha = hoy + timedelta(days=d)
                libre = (fecha.toordinal() + orden) % 7 in (0, 1)
                cod = "V" if de_vacaciones and 3 <= d <= 9 else ("L" if libre else "1")
                turnos.append({"driver_id": c["id"], "driver_name": c["name"], "date": _dia(fecha), "center": centro,
                               "cod": cod, "type": "libre" if cod in ("L", "V") else "trabaja", "extra": False})
    config = [{"center": c, "seguimiento_desde": _dia(hoy - timedelta(days=14))} for c in CENTROS]

    return {"vehicles": vehiculos, "drivers": conductores, "inspections": inspecciones,
            "vehicle_damage_ledger": ledger, "incidents": incidencias, "daily_assignments": asignaciones,
            "workshops": talleres, "ordenes_trabajo": ordenes, "shifts": turnos,
            "cuadrante_personas": personas, "cuadrante_config": config}
