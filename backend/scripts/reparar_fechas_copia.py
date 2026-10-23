# -*- coding: utf-8 -*-
"""Devuelve a fecha de verdad lo que la restauración de una copia dejó como texto.

La copia nocturna (`/api/admin/backup-now` y la de las 04:00) serializa cada documento con
`json.dumps(..., default=str)`: un `datetime` de Mongo se escribe como «2026-09-18 22:12:38.411000»
(con ESPACIO entre fecha y hora, que es como lo imprime Python). `restaurar_copia.py` insertaba
eso tal cual, así que tras la restauración del 23-10-2026 la analítica tenía 26.197 eventos con
`ts` en texto: invisibles para los informes (`ts >= datetime`) y para el índice TTL.

Las fechas que la app escribe ella misma van en ISO con «T» (`created_at: 2026-10-20T23:23:11`),
así que el patrón con espacio identifica exactamente lo que ERA una fecha de Mongo. Se convierte
a UTC sin zona, que es como Motor las guardaba.

Uso (con MONGO_URL en el entorno, nunca en la línea de comandos):
    py -3 reparar_fechas_copia.py            # en seco: cuenta por base, colección y campo
    py -3 reparar_fechas_copia.py --aplicar  # convierte
"""
import os
import re
import sys
from collections import Counter
from datetime import datetime

from pymongo import MongoClient, UpdateOne

PATRON = re.compile(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?$")
SISTEMA = {"admin", "local", "config"}


def a_fecha(v):
    """La fecha, o None si el texto no es una fecha de Python."""
    if not isinstance(v, str) or not PATRON.match(v):
        return None
    try:
        return datetime.fromisoformat(v)
    except ValueError:
        return None


def campos_a_convertir(doc, prefijo=""):
    """Pares (ruta.con.puntos, fecha) de todo lo que hay que convertir, hasta dos niveles.

    Dentro de listas no se entra: una lista de fechas en texto no existe en este esquema y
    `$set` con índices de lista es frágil."""
    out = []
    for k, v in doc.items():
        if k == "_id":
            continue
        ruta = f"{prefijo}{k}"
        f = a_fecha(v)
        if f is not None:
            out.append((ruta, f))
        elif isinstance(v, dict) and not prefijo:
            out.extend(campos_a_convertir(v, ruta + "."))
    return out


def reparar(cli, aplicar=False, salida=print):
    """Recorre todas las bases y devuelve Counter((base, colección, campo) -> documentos)."""
    cuenta = Counter()
    for base in sorted(cli.list_database_names()):
        if base in SISTEMA:
            continue
        db = cli[base]
        for col in sorted(db.list_collection_names()):
            if col.startswith("system."):
                continue
            ops = []
            for doc in db[col].find({}):
                pares = campos_a_convertir(doc)
                if not pares:
                    continue
                for ruta, _ in pares:
                    cuenta[(base, col, ruta)] += 1
                if aplicar:
                    ops.append(UpdateOne({"_id": doc["_id"]}, {"$set": dict(pares)}))
                    if len(ops) >= 500:
                        db[col].bulk_write(ops, ordered=False)
                        ops = []
            if ops:
                db[col].bulk_write(ops, ordered=False)
    return cuenta


def main():
    aplicar = "--aplicar" in sys.argv[1:]
    url = os.environ.get("MONGO_URL")
    if not url:
        print("Falta MONGO_URL en el entorno", file=sys.stderr)
        sys.exit(2)
    cli = MongoClient(url, serverSelectionTimeoutMS=20000)
    cuenta = reparar(cli, aplicar=aplicar)
    if not cuenta:
        print("Nada que convertir: ninguna fecha en texto con el formato de la copia.")
        return
    por_col = Counter()
    for (base, col, campo), n in sorted(cuenta.items()):
        print(f"  {n:7}  {base}.{col}.{campo}")
        por_col[(base, col)] = max(por_col[(base, col)], n)
    print(f"{'CONVERTIDOS' if aplicar else 'EN SECO (nada tocado)'}: {sum(por_col.values())} documentos en {len(por_col)} colecciones")


if __name__ == "__main__":
    main()
