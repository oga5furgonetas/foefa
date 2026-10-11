"""Corrige el país de las cuentas que quedaron como España teniendo la hora de otro país de la tabla
(11-10-2026: hasta hoy Portugal, Europa y EE. UU. no estaban en PAISES_REPARTO y caían en «es"; el
buscador de direcciones buscaba entonces en España). Por defecto solo enseña; con --aplicar, cambia.
   MONGO_URL=... py -3 tools/metricas/corregir_pais_por_zona.py [--aplicar]"""
import os
import sys

from pymongo import MongoClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
ZONAS = {
    "pt": ["Europe/Lisbon", "Atlantic/Madeira", "Atlantic/Azores"], "fr": ["Europe/Paris"], "it": ["Europe/Rome"],
    "de": ["Europe/Berlin", "Europe/Busingen"], "gb": ["Europe/London"], "ie": ["Europe/Dublin"],
    "be": ["Europe/Brussels"], "nl": ["Europe/Amsterdam"], "ch": ["Europe/Zurich"], "at": ["Europe/Vienna"],
    "ad": ["Europe/Andorra"],
}
aplicar = "--aplicar" in sys.argv
g = MongoClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=20000)["flota_global"]
for pais, zonas in ZONAS.items():
    for o in g.organizations.find({"pais": "es", "zona_horaria": {"$in": zonas}}, {"_id": 0, "id": 1, "name": 1, "zona_horaria": 1}):
        print(f"{(o.get('name') or '')[:30]:30} {o['zona_horaria']:20} es -> {pais}")
        if aplicar:
            g.organizations.update_one({"id": o["id"], "pais": "es"}, {"$set": {"pais": pais}})
print("aplicado" if aplicar else "(solo enseña; --aplicar para cambiar)")
