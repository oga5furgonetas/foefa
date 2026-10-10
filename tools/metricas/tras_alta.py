"""Qué hace cada alta reciente DESPUÉS de registrarse: todas sus sesiones (por org) y la de alta, paso a paso."""
import os
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient

cli = MongoClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=20000)
g = cli["flota_global"]
ev = g.analitica_eventos
desde = (datetime.now(timezone.utc) - timedelta(hours=30)).isoformat()
for o in g.organizations.find({"created_at": {"$gte": desde}, "sector": "autonomo"},
                              {"_id": 0, "id": 1, "name": 1, "db_name": 1, "created_at": 1}):
    c = datetime.fromisoformat(o["created_at"])
    d = cli[o["db_name"]]
    print(f"\n=== {o['name'][:20]} alta {c + timedelta(hours=2):%d-%m %H:%M} · paradas {d.reparto_pedidos.count_documents({})}"
          f" · usuarios {d.users.count_documents({}) if 'users' in d.list_collection_names() else '-'}")
    # sesión de alta: registro_ok ±3 min
    e = ev.find_one({"nombre": "registro_ok", "ts": {"$gte": (c - timedelta(minutes=3)).replace(tzinfo=None),
                                                       "$lte": (c + timedelta(minutes=3)).replace(tzinfo=None)}})
    sids = set()
    if e:
        sids.add(e["sid"])
    for x in ev.find({"org": o["id"]}, {"sid": 1}):
        sids.add(x["sid"])
    pasos = sorted(ev.find({"sid": {"$in": list(sids)}}, {"_id": 0}), key=lambda p: p["ts"])
    for p in pasos:
        print(f"  {p['ts'] + timedelta(hours=2):%H:%M:%S} {p['sid'][:5]} {p['tipo']:6} {p.get('nombre') or '':24} {p.get('ruta')} {p.get('disp') or ''} {p.get('seg')}")
