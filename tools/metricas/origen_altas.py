"""De dónde sale cada alta: cruza organizations (created_at) con la sesión de analitica_eventos
que hizo registro_ok / rep_alta justo antes, y con su primera visita (utm, anuncio, referrer)."""
import os, sys, collections
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient

dias = int(sys.argv[1]) if len(sys.argv) > 1 else 10
g = MongoClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=20000)["flota_global"]
ev = g.analitica_eventos
ahora = datetime.now(timezone.utc)
desde = ahora - timedelta(days=dias)


def ts(v):
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    try:
        d = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except Exception:
        return None


CAMPANAS = {
    ("facebook", "video"): "Meta · «Gratis sin límite» (10-10)",
    ("tiktok", "es_interes"): "TikTok · interés reparto (10-10)",
}


def nombre_origen(utm, anuncio, ref, disp_ua):
    if utm == "facebook":
        if anuncio in ("gratis_es", "gratis_latam"):
            return f"Meta · lanzamiento repartidor ({anuncio})"
        return CAMPANAS.get((utm, anuncio), f"Meta · campaña multiidioma 04-10 ({anuncio or '?'})")
    if utm == "tiktok":
        return CAMPANAS.get((utm, anuncio), f"TikTok · campaña anterior ({anuncio or '?'})")
    if utm == "grupo":
        return f"Grupo de Facebook ({anuncio or '?'})"
    if utm == "referido":
        return "Enlace de invitación de otro repartidor"
    if utm:
        return f"utm={utm} ({anuncio or '-'})"
    if ref:
        if ref.startswith("com.flotadsp"):
            return f"App Android de Play ({ref}) = testers"
        if "facebook" in ref or ref in ("l.facebook.com", "lm.facebook.com", "m.facebook.com"):
            return f"Facebook sin utm ({ref})"
        if "instagram" in ref:
            return f"Instagram sin utm ({ref})"
        if "tiktok" in ref:
            return f"TikTok sin utm ({ref})"
        if "google" in ref:
            return f"Google ({ref})"
        if "t.me" in ref or "telegram" in ref:
            return f"Telegram ({ref})"
        return f"web externa ({ref})"
    return "directo (escribió la web / app sin referencia)"


orgs = []
for o in g.organizations.find({}, {"_id": 0, "id": 1, "name": 1, "email": 1, "sector": 1, "plan": 1,
                                   "created_at": 1, "referido_por": 1, "pais": 1, "idioma": 1, "status": 1,
                                   "demo": 1, "account_type": 1}):
    c = ts(o.get("created_at"))
    if c and c >= desde:
        o["_c"] = c
        orgs.append(o)
orgs.sort(key=lambda o: o["_c"])

# Todas las acciones de alta del periodo
altas_ev = list(ev.find({"ts": {"$gte": desde.replace(tzinfo=None)}, "tipo": "accion",
                         "nombre": {"$in": ["registro_ok", "rep_alta", "alta_ok", "alta_rapida_ok"]}},
                        {"_id": 0}))
if not altas_ev:
    altas_ev = list(ev.find({"ts": {"$gte": desde}, "tipo": "accion",
                             "nombre": {"$in": ["registro_ok", "rep_alta", "alta_ok", "alta_rapida_ok"]}}, {"_id": 0}))
print(f"altas (organizations) últimos {dias} días: {len(orgs)} · eventos de alta: {len(altas_ev)}")
print("nombres de eventos de alta:", collections.Counter(e["nombre"] for e in altas_ev))

cache = {}


def origen_sesion(sid):
    if sid in cache:
        return cache[sid]
    pasos = list(ev.find({"sid": sid}, {"_id": 0, "ts": 1, "ruta": 1, "utm": 1, "ref": 1, "anuncio": 1,
                                        "disp": 1, "nombre": 1, "seg": 1}))
    pasos.sort(key=lambda p: ts(p["ts"]))
    utm = next((p["utm"] for p in pasos if p.get("utm")), None)
    anuncio = next((p["anuncio"] for p in pasos if p.get("anuncio")), None)
    ref = next((p["ref"] for p in pasos if p.get("ref")), None)
    r = {"utm": utm, "anuncio": anuncio, "ref": ref, "disp": pasos[0].get("disp") if pasos else None,
         "primera": pasos[0].get("ruta") if pasos else None, "inicio": ts(pasos[0]["ts"]) if pasos else None,
         "n": len(pasos), "acciones": [p.get("nombre") for p in pasos if p.get("nombre")][:12]}
    cache[sid] = r
    return r


resumen = collections.Counter()
usados = set()
for o in orgs:
    # el evento de alta más cercano (±3 min) a la creación de la empresa
    cand = []
    for i, e in enumerate(altas_ev):
        d = abs((ts(e["ts"]) - o["_c"]).total_seconds())
        if d <= 180 and e["nombre"] in ("registro_ok", "alta_ok", "alta_rapida_ok") or (d <= 180 and e["nombre"] == "rep_alta"):
            cand.append((d, e["nombre"] != "registro_ok", i, e))
    cand.sort(key=lambda x: (x[0] > 60, x[1], x[0]))
    ref_inv = "sí" if o.get("referido_por") else "no"
    nombre = (o.get("name") or "")[:22]
    correo = (o.get("email") or "")
    dom = correo.split("@")[-1] if "@" in correo else "-"
    cab = (f"{o['_c'] + timedelta(hours=2):%d-%m %H:%M} · {nombre!r:26} · {dom:14} · sector={o.get('sector') or '-'} "
           f"plan={o.get('plan') or '-'} pais={o.get('pais') or '-'} · invitado={ref_inv}")
    if not cand:
        print(cab + "\n      origen: SIN evento de analítica (¿cookies/bloqueador, app china o alta por API?)")
        resumen["sin rastro en analítica"] += 1
        continue
    e = cand[0][3]
    usados.add(cand[0][2])
    s = origen_sesion(e["sid"])
    nom = nombre_origen(s["utm"], s["anuncio"], s["ref"], None)
    if o.get("referido_por") and "invitación" not in nom:
        nom += " + código de invitación"
    resumen[nom.split(" (")[0] if not nom.startswith("Grupo") else "Grupo de Facebook"] += 1
    print(cab + f"\n      origen: {nom} · {s['disp']} · entró por {s['primera']} "
          f"{(s['inicio'] + timedelta(hours=2)):%d-%m %H:%M} · seg={e.get('seg')} · {s['n']} eventos")

print("\nRESUMEN:")
for k, v in resumen.most_common():
    print(f"  {v:3}  {k}")

# Visitas por origen en el periodo (para ver qué canal trae gente aunque no se registre)
print(f"\nSesiones de visitantes por origen, últimos {dias} días:")
por = collections.Counter()
vistos = set()
for p in ev.find({"ts": {"$gte": desde.replace(tzinfo=None)}, "seg": "visitante"},
                 {"_id": 0, "sid": 1, "utm": 1, "anuncio": 1, "ref": 1}):
    if p["sid"] in vistos or not (p.get("utm") or p.get("ref")):
        continue
    vistos.add(p["sid"])
    por[nombre_origen(p.get("utm"), p.get("anuncio"), p.get("ref"), None)] += 1
for k, v in por.most_common(20):
    print(f"  {v:4}  {k}")
