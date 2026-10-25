"""Resultado de la prueba A/B de /repartidores (06-10-2026).

La versión de cada visita sale de su clave de sesión, igual que en
frontend/src/lib/analitica.js (varianteAB): código del último carácter de
`sid`, par -> «a», impar -> «b». Por eso no hace falta guardar nada más.

    MONGO_URL=... python scripts/ab_repartidores.py [desde AAAA-MM-DD] [utm]

Sin `utm` cuenta todas las visitas a /repartidores; con `tiktok` solo las de TikTok.
Las visitas forzadas con ?v= (revisiones a mano) caen en el grupo de su sesión:
son pocas y se ven como ruido, no como resultado.
"""
import os
import sys
from collections import defaultdict
from datetime import datetime

from pymongo import MongoClient

PASOS = ("rep_10s", "rep_mitad", "rep_abrir_alta", "rep_form_inicio", "rep_probar", "registro_ok")


def version(sid: str) -> str:
    return "b" if ord(sid[-1]) % 2 else "a"


def main():
    desde = datetime.strptime(sys.argv[1] if len(sys.argv) > 1 else "2026-10-06", "%Y-%m-%d")
    utm = sys.argv[2] if len(sys.argv) > 2 else None
    url = os.environ.get("MONGO_URL")
    if not url:
        sys.exit("Falta MONGO_URL")
    col = MongoClient(url, serverSelectionTimeoutMS=20000)[os.environ.get("GLOBAL_DB_NAME", "flota_global")].analitica_eventos

    q = {"ts": {"$gte": desde}, "ruta": "/repartidores", "seg": "visitante"}
    if utm:
        q["utm"] = utm
    sesiones = {e["sid"] for e in col.find(q, {"_id": 0, "sid": 1})}
    hechos = defaultdict(set)
    for e in col.find({"ts": {"$gte": desde}, "sid": {"$in": list(sesiones)}, "tipo": "accion"},
                      {"_id": 0, "sid": 1, "nombre": 1}):
        hechos[e["sid"]].add(e.get("nombre"))

    grupos = defaultdict(list)
    for s in sesiones:
        grupos[version(s)].append(s)
    print(f"Desde {desde:%d-%m-%Y}{' · solo ' + utm if utm else ''}")
    print(f"{'':<17}" + "".join(f"{v:>14}" for v in ("a (alta arriba)", "b (vídeo)")))
    print(f"{'visitas':<17}" + "".join(f"{len(grupos[v]):>14}" for v in "ab"))
    for paso in PASOS:
        fila = ""
        for v in "ab":
            n = sum(1 for s in grupos[v] if paso in hechos[s])
            pct = 100 * n / max(len(grupos[v]), 1)   # sin visitas, n es 0: 0 %
            fila += f"{n:>7} ({pct:4.1f}%)"
        print(f"{paso:<17}{fila}")


if __name__ == "__main__":
    main()
