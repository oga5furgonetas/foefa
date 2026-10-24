"""¿Usan la app las altas nuevas? Cuenta por cuenta, las de los últimos N días (por defecto 10), sin demos, pruebas
ni testers de Play (misma regla que usuarios_total.py). Solo lectura.

Para cada alta: días desde el alta, días distintos con actividad (analítica de su cuenta), paradas suyas (no de
ejemplo), entregadas, el día con más entregas, si entra por la app instalada o la web, y su última acción.
La fase sale de lo que hizo, no de lo que dice: «día real» = un día con 15 entregas o más."""
import collections
import os
import re
import sys
from datetime import datetime, timedelta, timezone

from pymongo import MongoClient

DIAS = int(sys.argv[1]) if len(sys.argv) > 1 else 10
cli = MongoClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=20000)
g = cli["flota_global"]
ev = g.analitica_eventos
PRUEBA = re.compile(r"prueba|test|demo|revisor|pepito|claude", re.I)
ahora = datetime.now(timezone.utc)


def fecha(o):
    try:
        f = datetime.fromisoformat(str(o.get("created_at") or "").replace("Z", "+00:00"))
        return f if f.tzinfo else f.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


desde = ahora - timedelta(days=DIAS)
todas = [o for o in g.organizations.find({}, {"_id": 0}) if not o.get("demo") and o.get("account_type") != "owner"
         and not PRUEBA.search(o.get("name") or "")]
aut = [o for o in todas if o.get("sector") == "autonomo"]
recientes = [o for o in todas if fecha(o) and fecha(o) >= desde]
fases = collections.Counter()
for o in sorted(recientes, key=lambda x: fecha(x)):
    f = fecha(o)
    if o.get("sector") == "autonomo":
        lote = sum(1 for x in aut if fecha(x) and abs((fecha(x) - f).total_seconds()) <= 60)
        if lote >= 3 or "@" in (o.get("name") or ""):
            fases["tester de Play"] += 1
            continue
    d = cli[o["db_name"]] if o.get("db_name") else None
    ps = list(d.reparto_pedidos.find({"ejemplo": {"$ne": True}}, {"_id": 0, "estado": 1, "fecha": 1})) if d is not None else []
    ent = [p for p in ps if p.get("estado") == "entregado"]
    por_dia = collections.Counter(p.get("fecha") for p in ent)
    evs = list(ev.find({"org": o["id"]}, {"_id": 0, "ts": 1, "tipo": 1, "nombre": 1, "ruta": 1, "ref": 1}))
    dias_act = sorted({str(e["ts"])[:10] for e in evs})
    app = any((e.get("ref") or "").startswith("com.flotadsp") for e in evs)
    ultima = max((e["ts"] for e in evs), default=None)
    conductores = d.drivers.count_documents({}) if d is not None and o.get("sector") != "autonomo" else None
    if o.get("sector") != "autonomo":
        paso = "empresa"
    elif por_dia and max(por_dia.values()) >= 15:
        paso = "6 día real"
    elif ent:
        paso = "5 entregó algo"
    elif ps:
        paso = "4 metió paradas"
    elif len(dias_act) >= 2:
        paso = "3 volvió otro día"
    elif evs:
        paso = "2 solo el día del alta"
    else:
        paso = "1 sin rastro"
    fases[paso] += 1
    print(f"{f + timedelta(hours=2):%d-%m %H:%M} | {(o.get('name') or '')[:22]:22} | {o.get('sector') or '-':9} | "
          f"{(ahora - f).days:2} d | activo {len(dias_act)} d | paradas {len(ps):3} | entregadas {len(ent):3} | "
          f"mejor día {max(por_dia.values()) if por_dia else 0:3} | {'app' if app else 'web'} | "
          f"última {(ultima + timedelta(hours=2)).strftime('%d-%m %H:%M') if ultima else '-':11} | "
          f"{'conductores ' + str(conductores) + ' | ' if conductores is not None else ''}{paso}")
print("\nFASES:", sorted(fases.items()))
