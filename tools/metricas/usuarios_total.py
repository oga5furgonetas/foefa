"""Cuántos usuarios hay de verdad: cuentas por sector, sin demos ni pruebas, y conductores dentro de empresas.

11-10-2026: los testers de Google Play (Dani los consigue en otro grupo) se dan de alta en lote desde la
app, a veces con el correo como nombre. No son repartidores: se cuentan aparte para no inflar la cifra
del objetivo (1000 usuarios reales). Regla: 3 o más altas de autónomo en el mismo minuto, o el correo de nombre (las 4 de Meta de
la noche del 10-10 llegaron en 4 minutos y son reales)."""
import os, collections, re
from datetime import datetime
from pymongo import MongoClient

cli = MongoClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=20000)
g = cli["flota_global"]
PRUEBA = re.compile(r"prueba|test|demo|revisor|pepito|claude", re.I)
por = collections.Counter()
conductores = 0
autonomos = []


def fecha(o):
    try:
        return datetime.fromisoformat(str(o.get("created_at") or "").replace("Z", "+00:00"))
    except ValueError:
        return None


for o in g.organizations.find({}, {"_id": 0, "id": 1, "name": 1, "sector": 1, "demo": 1, "db_name": 1, "account_type": 1, "created_at": 1}):
    if o.get("demo") or o.get("account_type") == "owner":
        por["demo/propia"] += 1
        continue
    if PRUEBA.search(o.get("name") or ""):
        por["prueba (nombre)"] += 1
        continue
    s = o.get("sector") or "sin sector"
    if s == "autonomo":
        autonomos.append(o)
        continue
    por[s] += 1
    if o.get("db_name"):
        try:
            conductores += cli[o["db_name"]].drivers.count_documents({"active": {"$ne": False}})
        except Exception:
            pass

reales_aut, testers = [], []
for o in autonomos:
    f = fecha(o)
    lote = sum(1 for x in autonomos if f and fecha(x) and abs((fecha(x) - f).total_seconds()) <= 60)
    (testers if lote >= 3 or "@" in (o.get("name") or "") else reales_aut).append(o)
por["autonomo"] = len(reales_aut)
por["tester de Play (lote o correo de nombre)"] = len(testers)
print("cuentas por sector:", dict(por))
print("autónomos reales:", len(reales_aut))
print("testers de Play aparte:", len(testers))
# Cuántos la usan de verdad: con paradas suyas (no de ejemplo) y con algún día de reparto real
# (direcciones distintas y entregas repartidas al menos 45 min, la vara de «Invita y gana»).
con_paradas = con_reparto = 0
for o in reales_aut:
    if not o.get("db_name"):
        continue
    col = cli[o["db_name"]].reparto_pedidos
    if col.count_documents({"ejemplo": {"$ne": True}}, limit=1):
        con_paradas += 1
    por_dia = collections.defaultdict(list)
    for p in col.find({"ejemplo": {"$ne": True}, "estado": "entregado"}, {"_id": 0, "fecha": 1, "direccion": 1, "cerrado_en": 1}):
        por_dia[p.get("fecha")].append(p)
    for ps in por_dia.values():
        horas = sorted(datetime.fromisoformat(str(p["cerrado_en"]).replace("Z", "+00:00")) for p in ps if p.get("cerrado_en"))
        if len(horas) >= 2 and (horas[-1] - horas[0]).total_seconds() >= 45 * 60 and len({str(p.get("direccion")).lower() for p in ps}) >= 2:
            con_reparto += 1
            break
print("de ellos, con paradas suyas:", con_paradas, "· con algún día de reparto de verdad:", con_reparto)
print("conductores activos dentro de empresas:", conductores)
print("usuarios con acceso (admin_users):", g.admin_users.count_documents({}))
