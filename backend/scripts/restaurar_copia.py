# -*- coding: utf-8 -*-
"""Restaura una copia de seguridad de Flota (el JSONL.gz ya descifrado) en un MongoDB.

    python backend/scripts/restaurar_copia.py <copia.jsonl.gz> <fichero_con_mongo_url> [--solo base1,base2] [--forzar]

POR QUÉ EXISTE (23-10-2026). Atlas suspendió la organización donde vivía la base
de Flota por dos recibos devueltos, y Dani no quiso pagar: la única salida era
levantar la última copia diaria de R2 (descifrada con descifrar_copia.py) en un
Mongo nuevo. Esto hace justo eso, y nada más.

CÓMO. La copia trae una línea por documento: {"_db", "_col", "d"} sin `_id`
(la copia se hace con {"_id": 0}); el servidor nunca usa ObjectId, todo va por
campos `id`, así que los `_id` nuevos no rompen nada. Se inserta por lotes de
500 y al final se cuentan los documentos de cada colección contra los de la
copia: si no cuadran, lo dice y sale con error.

SEGURO POR DEFECTO. Se niega a escribir en una base que ya tenga datos: una
restauración encima de datos vivos duplicaría todo. `--forzar` lo salta (solo
para rehacer una prueba). Los índices NO se crean aquí: los crea el servidor al
arrancar (los `_idx(...)` de server.py), como con una base nueva.

La cadena de conexión se lee de un FICHERO, nunca de la línea de órdenes: así
no queda en el historial de la consola.
"""
import gzip
import io
import json
import sys
import time
from collections import defaultdict

from pymongo import MongoClient
from pymongo.errors import BulkWriteError

LOTE = 500
AJENAS = ("admin", "local", "config")


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) < 2:
        print(__doc__)
        return 2
    copia, fichero_url = args[0], args[1]
    forzar = "--forzar" in sys.argv
    solo = None
    if "--solo" in sys.argv:
        solo = set(sys.argv[sys.argv.index("--solo") + 1].split(","))
    url = io.open(fichero_url, encoding="utf-8-sig").read().strip()
    cliente = MongoClient(url, serverSelectionTimeoutMS=15000)
    cliente.admin.command("ping")

    # 1) Qué trae la copia (recuento por base y colección, sin cargarla en memoria).
    esperado = defaultdict(lambda: defaultdict(int))
    with gzip.open(copia, "rt", encoding="utf-8") as f:
        for linea in f:
            o = json.loads(linea)
            if o["_db"] in AJENAS or (solo and o["_db"] not in solo):
                continue
            esperado[o["_db"]][o["_col"]] += 1
    bases = sorted(esperado)
    print(f"copia: {len(bases)} bases, {sum(len(c) for c in esperado.values())} colecciones, "
          f"{sum(sum(c.values()) for c in esperado.values()):,} documentos")

    # 2) El destino tiene que estar vacío (salvo --forzar).
    existentes = set(cliente.list_database_names())
    con_datos = [b for b in bases if b in existentes and any(
        cliente[b][c].estimated_document_count() for c in cliente[b].list_collection_names())]
    if con_datos and not forzar:
        print("ME NIEGO: estas bases ya tienen datos en el destino: " + ", ".join(con_datos[:10])
              + (" …" if len(con_datos) > 10 else "") + "\nSi es una prueba que se rehace, --forzar la vacía antes.")
        return 1
    if con_datos:
        for b in con_datos:
            cliente.drop_database(b)
        print(f"--forzar: vaciadas {len(con_datos)} bases")

    # 3) Insertar por lotes, en el orden de la copia.
    t0 = time.time()
    lote, lote_clave, hechos = [], None, 0

    def volcar():
        nonlocal lote, hechos
        if not lote:
            return
        b, c = lote_clave
        try:
            cliente[b][c].insert_many(lote, ordered=False)
        except BulkWriteError as e:
            print(f"ERROR insertando en {b}.{c}: {e.details.get('writeErrors', [])[:2]}")
            raise
        hechos += len(lote)
        lote = []

    with gzip.open(copia, "rt", encoding="utf-8") as f:
        for linea in f:
            o = json.loads(linea)
            clave = (o["_db"], o["_col"])
            if o["_db"] in AJENAS or (solo and o["_db"] not in solo):
                continue
            if clave != lote_clave:
                volcar()
                lote_clave = clave
            lote.append(o["d"])
            if len(lote) >= LOTE:
                volcar()
                if hechos % 20000 < LOTE:
                    print(f"  {hechos:,} documentos… ({time.time() - t0:.0f} s)")
        volcar()
    print(f"insertados {hechos:,} documentos en {time.time() - t0:.0f} s")

    # 4) Cuadrar: cada colección con los mismos documentos que la copia.
    fallos = []
    for b in bases:
        for c, n in esperado[b].items():
            real = cliente[b][c].count_documents({})
            if real != n:
                fallos.append(f"{b}.{c}: copia {n}, destino {real}")
    if fallos:
        print("NO CUADRA:\n  " + "\n  ".join(fallos[:30]))
        return 1
    print("OK: todas las colecciones cuadran con la copia.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
