"""Embudo de /repartidores por canal (últimos 7 días): sesiones, % que pasa 10 s, mitad, abre formulario, alta.
Más dispositivo y si el navegador cargó (cualquier evento = el JS corrió)."""
import os, collections
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient

g = MongoClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=20000)["flota_global"]
ev = g.analitica_eventos
desde = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=7)
ses = collections.defaultdict(lambda: {"canal": None, "acc": set(), "disp": None, "vistas": 0, "rutas": []})
for e in ev.find({"ts": {"$gte": desde}}, {"_id": 0, "sid": 1, "utm": 1, "anuncio": 1, "ref": 1, "nombre": 1, "tipo": 1, "disp": 1, "ruta": 1}):
    s = ses[e["sid"]]
    if not s["canal"]:
        if e.get("utm"):
            s["canal"] = f"{e['utm']}:{e.get('anuncio') or '-'}"
        elif e.get("ref"):
            s["canal"] = "ref:" + e["ref"]
    if e.get("nombre"):
        s["acc"].add(e["nombre"])
    if e.get("tipo") == "vista":
        s["vistas"] += 1
        if len(s["rutas"]) < 4:
            s["rutas"].append(e.get("ruta"))
    s["disp"] = s["disp"] or e.get("disp")

por = collections.defaultdict(collections.Counter)
for s in ses.values():
    c = s["canal"] or "directo"
    if c.startswith("ref:") and "tiktok" in c:
        c = "ref:tiktok"
    k = por[c]
    k["sesiones"] += 1
    for a in ("rep_10s", "rep_mitad", "rep_form_inicio", "rep_abrir_alta", "rep_alta", "registro_ok", "cookies_si", "cookies_no"):
        if a in s["acc"]:
            k[a] += 1
    if s["vistas"] == 1 and not s["acc"]:
        k["solo_1_vista_sin_nada"] += 1
print(f"{'canal':34} {'ses':>5} {'10s':>5} {'mitad':>5} {'form':>5} {'alta':>5} {'ok':>4} {'ck_si':>5} {'ck_no':>5} {'nada':>5}")
for c, k in sorted(por.items(), key=lambda x: -x[1]["sesiones"])[:18]:
    print(f"{c[:34]:34} {k['sesiones']:5} {k['rep_10s']:5} {k['rep_mitad']:5} {k['rep_form_inicio']:5} {k['rep_alta']:5} {k['registro_ok']:4} {k['cookies_si']:5} {k['cookies_no']:5} {k['solo_1_vista_sin_nada']:5}")
