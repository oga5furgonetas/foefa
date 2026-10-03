# -*- coding: utf-8 -*-
"""Una base de datos de mentira, lo justo para probar flujos enteros del
servidor sin MongoDB: find/find_one/update (con upsert)/insert/delete/distinct
y los operadores que usan (=, $in, $nin, $ne, $exists, rangos, $and, $or,
$regex; $set, $unset, $setOnInsert, $addToSet, $push (con $each/$slice), $pull, $inc;
replace_one). No es mongomock: si
una prueba necesita más, se añade aquí y se dice."""
import re
from types import SimpleNamespace

_FALTA = object()


def _leer(d, ruta):
    """Un campo con puntos («filas.d1.nota»), como lo lee MongoDB."""
    for trozo in ruta.split("."):
        if not isinstance(d, dict) or trozo not in d:
            return _FALTA
        d = d[trozo]
    return d


def _poner(d, ruta, valor):
    *camino, ultimo = ruta.split(".")
    for trozo in camino:
        d = d.setdefault(trozo, {})
    d[ultimo] = valor


def _quitar(d, ruta):
    *camino, ultimo = ruta.split(".")
    for trozo in camino:
        if not isinstance(d, dict) or trozo not in d:
            return
        d = d[trozo]
    if isinstance(d, dict):
        d.pop(ultimo, None)



class Cursor:
    def __init__(self, docs):
        self.docs = docs

    def sort(self, *a, **k):
        return self

    def skip(self, n):
        self.docs = self.docs[n:]
        return self

    def limit(self, n):
        self.docs = self.docs[:n] if n else self.docs
        return self

    async def to_list(self, n=None):
        return list(self.docs if n is None else self.docs[:n])

    def __aiter__(self):
        self._it = iter(self.docs)
        return self

    async def __anext__(self):
        try:
            return next(self._it)
        except StopIteration:
            raise StopAsyncIteration


def _casa(d, q):
    for k, v in (q or {}).items():
        if k == "$and":
            if not all(_casa(d, x) for x in v):
                return False
            continue
        if k == "$or":
            if not any(_casa(d, x) for x in v):
                return False
            continue
        val = _leer(d, k)
        if isinstance(v, dict) and v and all(str(x).startswith("$") for x in v):
            for op, arg in v.items():
                lista_val = val if isinstance(val, list) else [val]
                if op == "$in" and not any(x in arg for x in lista_val):
                    return False
                if op == "$nin" and any(x in arg for x in lista_val):
                    return False
                if op == "$ne" and (val == arg or (isinstance(val, list) and arg in val)):
                    return False
                if op == "$exists" and (val is not _FALTA) != bool(arg):
                    return False
                if op in ("$gte", "$lte", "$gt", "$lt"):
                    if val is _FALTA or val is None:
                        return False
                    if op == "$gte" and not val >= arg or op == "$lte" and not val <= arg \
                            or op == "$gt" and not val > arg or op == "$lt" and not val < arg:
                        return False
                if op == "$regex" and not re.search(arg, str(val if val is not _FALTA else ""),
                                                    re.I if "i" in v.get("$options", "") else 0):
                    return False
        elif isinstance(val, list) and not isinstance(v, list):
            if v not in val:
                return False
        elif (None if val is _FALTA else val) != v:
            return False
    return True


class Col:
    def __init__(self, docs=None):
        self.docs = [dict(d) for d in (docs or [])]

    def _aplica(self, d, u, nuevo=False):
        for k, v in u.get("$set", {}).items():
            _poner(d, k, v)
        if nuevo:
            for k, v in u.get("$setOnInsert", {}).items():
                _poner(d, k, v)
        for k in u.get("$unset", {}):
            _quitar(d, k)
        for k, v in u.get("$addToSet", {}).items():
            d.setdefault(k, [])
            if v not in d[k]:
                d[k].append(v)
        for k, v in u.get("$push", {}).items():
            # {"$each": [...], "$slice": -n} lo usa la jornada de reparto.
            if isinstance(v, dict) and "$each" in v:
                d.setdefault(k, []).extend(v["$each"])
                if v.get("$slice"):
                    d[k] = d[k][v["$slice"]:] if v["$slice"] < 0 else d[k][:v["$slice"]]
            else:
                d.setdefault(k, []).append(v)
        for k, v in u.get("$inc", {}).items():
            _poner(d, k, (_leer(d, k) if _leer(d, k) is not _FALTA else 0) + v)
        for k, v in u.get("$pull", {}).items():
            if isinstance(d.get(k), list):
                d[k] = [x for x in d[k] if x != v]

    async def find_one(self, q=None, proyeccion=None, sort=None, **_):
        docs = [d for d in self.docs if _casa(d, q)]
        for campo, sentido in reversed(sort or []):
            docs.sort(key=lambda d: (d.get(campo) is None, d.get(campo) or ""), reverse=sentido < 0)
        return dict(docs[0]) if docs else None

    async def bulk_write(self, ops, ordered=True):
        """ReplaceOne y DeleteOne de pymongo, que es lo que usa deshacer."""
        for op in ops:
            if type(op).__name__ == "DeleteOne":
                await self.delete_one(op._filter)
            elif type(op).__name__ == "ReplaceOne":
                nuevo = dict(op._doc)
                for i, d in enumerate(self.docs):
                    if _casa(d, op._filter):
                        self.docs[i] = nuevo
                        break
                else:
                    if op._upsert:
                        self.docs.append(nuevo)
            else:
                raise NotImplementedError(type(op).__name__)

    def find(self, q=None, proyeccion=None, **_):
        return Cursor([dict(d) for d in self.docs if _casa(d, q)])

    async def update_one(self, q, u, upsert=False, **_):
        for d in self.docs:
            if _casa(d, q):
                self._aplica(d, u)
                return SimpleNamespace(modified_count=1, matched_count=1, upserted_id=None)
        if upsert:
            d = {k: v for k, v in q.items() if not k.startswith("$") and not isinstance(v, dict)}
            self._aplica(d, u, nuevo=True)
            self.docs.append(d)
            return SimpleNamespace(modified_count=0, matched_count=0, upserted_id="x")
        return SimpleNamespace(modified_count=0, matched_count=0, upserted_id=None)

    async def update_many(self, q, u, **_):
        n = 0
        for d in self.docs:
            if _casa(d, q):
                self._aplica(d, u)
                n += 1
        return SimpleNamespace(modified_count=n, matched_count=n)

    async def insert_one(self, doc):
        self.docs.append(dict(doc))
        return SimpleNamespace(inserted_id="x")

    async def insert_many(self, docs, **_):
        self.docs += [dict(d) for d in docs]

    async def delete_one(self, q):
        for i, d in enumerate(self.docs):
            if _casa(d, q):
                del self.docs[i]
                return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)

    async def delete_many(self, q):
        antes = len(self.docs)
        self.docs = [d for d in self.docs if not _casa(d, q)]
        return SimpleNamespace(deleted_count=antes - len(self.docs))

    async def distinct(self, campo, q=None):
        return sorted({d.get(campo) for d in self.docs if _casa(d, q) and d.get(campo) is not None})

    async def replace_one(self, q, doc, upsert=False, **_):
        for i, d in enumerate(self.docs):
            if _casa(d, q):
                self.docs[i] = dict(doc)
                return SimpleNamespace(matched_count=1, modified_count=1)
        if upsert:
            self.docs.append(dict(doc))
        return SimpleNamespace(matched_count=0, modified_count=0)

    async def count_documents(self, q=None, **_):
        return sum(1 for d in self.docs if _casa(d, q))


class Db(dict):
    def __getattr__(self, nombre):
        return self[nombre]

    def __missing__(self, nombre):
        self[nombre] = Col()
        return self[nombre]
