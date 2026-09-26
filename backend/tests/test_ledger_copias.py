# -*- coding: utf-8 -*-
"""El historial de daños (gemelo 3D) de una furgoneta sin registro se construye
desde sus inspecciones y se devuelve a la pantalla SIN el `_id` de Mongo.

Visto con los datos reales traspasados de FlotaDSP (26-09-2026): `insert_many`
les mete el `_id` (ObjectId) a los mismos dicts que luego se devolvían, y la
primera vez que se abría el historial de una furgoneta salía «Error interno».
Se ejecuta la función REAL de server.py con una base falsa que hace lo mismo
que Mongo al insertar.
"""
import ast
import asyncio
import io
import logging
import os
from datetime import datetime, timedelta, timezone

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUENTE = io.open(os.path.join(RAIZ, "server.py"), encoding="utf-8-sig").read()


class _Cursor:
    def __init__(self, docs):
        self.docs = docs

    def sort(self, *a, **k):
        return self

    async def to_list(self, n):
        return [dict(d) for d in self.docs][:n]


class _Col:
    def __init__(self, docs=None):
        self.docs = list(docs or [])

    def find(self, filtro=None, proy=None):
        return _Cursor([d for d in self.docs if all(d.get(k) == v for k, v in (filtro or {}).items()
                                                    if not isinstance(v, dict))])

    async def find_one(self, filtro=None, proy=None):
        return None

    async def count_documents(self, filtro):
        return 0

    async def insert_many(self, docs):
        for d in docs:              # lo que hace pymongo: muta el dict que recibe
            d["_id"] = object()
        self.docs.extend(docs)


class _DB:
    def __init__(self):
        hace = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
        self.vehicle_damage_ledger = _Col()
        self.vehicles = _Col()
        self.inspections = _Col([{"id": "i1", "vehicle_id": "v1", "created_at": hace,
                                  "analysis_status": "ok",
                                  "analysis": {"damages": [{"part": "paragolpes trasero", "severity": "moderado"}]}}])


def _cargar(db):
    arbol = ast.parse(FUENTE)
    quiero = {"_get_vehicle_ledger", "_canon_panel", "_norm_sev"}
    cuerpo = [n for n in arbol.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name in quiero]
    cuerpo += [n for n in arbol.body if isinstance(n, ast.Assign)
               and any(getattr(t, "id", "") in ("_SEV_RANK", "_PANEL_ALIASES", "_PANELES_CANON", "_SEV_ALIAS")
                       for t in n.targets)]
    ns = {"db": db, "datetime": datetime, "timedelta": timedelta, "timezone": timezone,
          "logger": logging.getLogger("t"), "re": __import__("re"), "unicodedata": __import__("unicodedata")}
    exec(compile(ast.fix_missing_locations(ast.Module(body=cuerpo, type_ignores=[])), "<server>", "exec"), ns)
    return ns["_get_vehicle_ledger"]


def test_lo_devuelto_no_lleva_el_id_de_mongo():
    db = _DB()
    try:
        ledger = _cargar(db)
    except Exception as e:                                        # noqa: BLE001
        # Si las auxiliares cambian de nombre, al menos se comprueba el código.
        src = ast.get_source_segment(FUENTE, next(
            n for n in ast.walk(ast.parse(FUENTE))
            if isinstance(n, ast.AsyncFunctionDef) and n.name == "_get_vehicle_ledger"))
        assert "insert_many([dict(" in src, "vuelve a insertar los mismos dicts que devuelve (%s)" % e
        return
    try:
        filas = asyncio.run(ledger("v1"))
    except NameError:
        src = ast.get_source_segment(FUENTE, next(
            n for n in ast.walk(ast.parse(FUENTE))
            if isinstance(n, ast.AsyncFunctionDef) and n.name == "_get_vehicle_ledger"))
        assert "insert_many([dict(" in src
        return
    assert filas, "tendría que salir el daño de la inspección"
    assert all("_id" not in f for f in filas), "lo devuelto lleva el _id de Mongo: la pantalla da error"
    assert db.vehicle_damage_ledger.docs and all("_id" in d for d in db.vehicle_damage_ledger.docs)
