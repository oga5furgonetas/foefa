# -*- coding: utf-8 -*-
"""«Montar la hoja» pegando solo la lista de rutas: salen los conductores de la
empresa con su nombre de ficha, su ruta y su hora, sin llamar a la IA.

Se prueba el endpoint de verdad (server.app); la base se sustituye por una
falsa en memoria, así que no hace falta Mongo.
"""
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

import server

pytestmark = pytest.mark.asyncio(loop_scope="session")

CONDUCTORES = [
    {"id": "a", "name": "Andrea Rodríguez Arias", "center": "OGA5"},
    {"id": "l", "name": "Luis Gómez Vidal", "center": "OGA5"},
    {"id": "s", "name": "Sara Martínez Peña", "center": "DGA1"},      # viene de otro centro
    {"id": "v", "name": "Vieja Ficha Borrada", "center": "OGA5", "status": "fusionada", "merged_into": "a"},
]
CORTEX = "\n".join([
    "CA_A44", "Rodriguez Arias, Andrea", "A2S2HK9FC8JOUX", "Standard Parcel - Large Van", "10:25",
    "CA_A45", "Gomez Vidal, Luis", "A1B9QW7ER5TY3U", "Standard Parcel - Large Van", "10:45",
    "CA_A46", "Martinez Pena, Sara", "A7K2LM4NB8VC1X", "Standard Parcel - Large Van", "11:05",
])


class _Cursor:
    def __init__(self, docs):
        self.docs = docs

    def __aiter__(self):
        self._it = iter(self.docs)
        return self

    async def __anext__(self):
        try:
            return next(self._it)
        except StopIteration:
            raise StopAsyncIteration


class _Drivers:
    def find(self, filtro, proyeccion=None):
        vivos = [d for d in CONDUCTORES if d.get("status") != "fusionada" and not d.get("merged_into")]
        return _Cursor([dict(d) for d in vivos])


class _Col:
    async def find_one(self, *a, **k):
        return None

    async def insert_one(self, *a, **k):
        return None


class _Base:
    drivers = _Drivers()

    def __getattr__(self, n):
        return _Col()

    def __getitem__(self, n):
        return _Col()


@pytest_asyncio.fixture(loop_scope="session")
async def cliente():
    async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://testserver") as c:
        yield c


@pytest.fixture
def entorno(monkeypatch):
    monkeypatch.setattr(server, "db", _Base())
    monkeypatch.setattr(server, "global_db", _Base())

    def sin_ia():
        raise AssertionError("no debía llamar a la IA: el texto se lee con el plantel")
    monkeypatch.setattr(server, "_gemini_client_plantilla", sin_ia)
    server._ADMIN_EXISTS_CACHE.clear()


def _cab():
    tok = server.create_token("maintenance-claude", "admin", "Jefe", org_id="owner", account_type="owner",
                              super_admin=True)
    return {"Authorization": f"Bearer {tok}"}


async def test_solo_rutas_pegadas_una_celda_por_linea(cliente, entorno):
    r = await cliente.post("/api/tools/plantilla-extraer", headers=_cab(),
                           data={"rutas_texto": CORTEX, "center": "OGA5"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["por_plantel"] is True and j["sin_ia"] is False
    filas = [(f["ruta"], f["conductor"], f["h_salida"], f["furgo"]) for f in j["rows"]]
    assert filas == [("CA_A44", "ANDREA RODRÍGUEZ ARIAS", "10:25", ""),
                     ("CA_A45", "LUIS GÓMEZ VIDAL", "10:45", ""),
                     ("CA_A46", "SARA MARTÍNEZ PEÑA", "11:05", "")]


async def test_solo_nombres_sin_ruta_tambien_salen(cliente, entorno):
    r = await cliente.post("/api/tools/plantilla-extraer", headers=_cab(),
                           data={"rutas_texto": "Andrea Rodriguez\nLuis Gomez\n", "center": "OGA5"})
    assert r.status_code == 200, r.text
    assert [f["conductor"] for f in r.json()["rows"]] == ["ANDREA RODRÍGUEZ ARIAS", "LUIS GÓMEZ VIDAL"]


async def test_sin_ninguna_lista_400(cliente, entorno):
    r = await cliente.post("/api/tools/plantilla-extraer", headers=_cab(), data={"center": "OGA5"})
    assert r.status_code == 400
