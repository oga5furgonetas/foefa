"""Cuántos usuarios hay de verdad: cuentas por sector, sin demos ni pruebas, y conductores dentro de empresas."""
import os, collections, re
from pymongo import MongoClient

cli = MongoClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=20000)
g = cli["flota_global"]
PRUEBA = re.compile(r"prueba|test|demo|revisor|pepito|claude", re.I)
por = collections.Counter()
conductores = 0
reales_aut = []
for o in g.organizations.find({}, {"_id": 0, "id": 1, "name": 1, "sector": 1, "demo": 1, "db_name": 1, "account_type": 1, "created_at": 1}):
    if o.get("demo") or o.get("account_type") == "owner":
        por["demo/propia"] += 1
        continue
    if PRUEBA.search(o.get("name") or ""):
        por["prueba (nombre)"] += 1
        continue
    s = o.get("sector") or "sin sector"
    por[s] += 1
    if s == "autonomo":
        reales_aut.append(o)
    elif o.get("db_name"):
        try:
            conductores += cli[o["db_name"]].drivers.count_documents({"active": {"$ne": False}})
        except Exception:
            pass
print("cuentas por sector:", dict(por))
print("autónomos reales:", len(reales_aut))
print("conductores activos dentro de empresas:", conductores)
print("usuarios con acceso (admin_users):", g.admin_users.count_documents({}))
