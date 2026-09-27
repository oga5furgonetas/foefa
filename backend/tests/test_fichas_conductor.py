# -*- coding: utf-8 -*-
"""Fichas de conductor que «no se guardaban» (27-09-2026).

Lo que pasaba: una ficha dada de alta con «Todos» elegido se quedaba SIN
centro y no salía en la lista de ningún centro. La oficina la volvía a crear y
el servidor contestaba «ya hay un conductor activo con ese correo»: desde
fuera, que no se podía guardar. Y el ID de reparto (`transporter_id`) no salía
en la ficha porque el modelo de respuesta lo quitaba.

Se prueba el endpoint de verdad (server.app) con una base falsa en memoria.
"""
import re

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

import server

pytestmark = pytest.mark.asyncio(loop_scope="session")


def _casa(doc, filtro):
    """Lo justo del lenguaje de consultas de Mongo para estas rutas."""
    for k, cond in filtro.items():
        if k == "$or":
            if not any(_casa(doc, f) for f in cond):
                return False
            continue
        v = doc.get(k)
        if isinstance(cond, dict) and any(c.startswith("$") for c in cond):
            for op, arg in cond.items():
                if op == "$ne" and v == arg:
                    return False
                if op == "$in" and v not in arg:
                    return False
                if op == "$nin" and v in arg:
                    return False
                if op == "$exists" and (k in doc) != arg:
                    return False
                if op == "$regex":
                    flags = re.I if "i" in cond.get("$options", "") else 0
                    if not isinstance(v, str) or not re.search(arg, v, flags):
                        return False
        elif v != cond:
            return False
    return True


class _Cursor:
    def __init__(self, docs):
        self.docs = docs

    async def to_list(self, n=None):
        return self.docs

    def sort(self, *a, **k):
        return self


class _Res:
    def __init__(self, n):
        self.matched_count = n


class _Drivers:
    def __init__(self, docs):
        self.docs = docs

    def find(self, filtro=None, proy=None):
        return _Cursor([{k: v for k, v in d.items() if k != "_id"} for d in self.docs if _casa(d, filtro or {})])

    async def find_one(self, filtro=None, proy=None):
        for d in self.docs:
            if _casa(d, filtro or {}):
                return dict(d)
        return None

    async def insert_one(self, doc):
        self.docs.append(dict(doc))

    async def update_one(self, filtro, cambio):
        for d in self.docs:
            if _casa(d, filtro):
                d.update(cambio.get("$set") or {})
                for k in cambio.get("$unset") or {}:
                    d.pop(k, None)
                return _Res(1)
        return _Res(0)


class _Col:
    async def find_one(self, *a, **k):
        return None

    async def insert_one(self, *a, **k):
        return None


class _Base:
    def __init__(self, drivers):
        self.drivers = _Drivers(drivers)

    def __getattr__(self, n):
        return _Col()

    def __getitem__(self, n):
        return _Col()


class _Orgs:
    def __init__(self, centros):
        self.centros = centros

    async def find_one(self, *a, **k):
        return {"centers": self.centros}


class _Global:
    def __init__(self, centros):
        self.organizations = _Orgs(centros)

    def __getattr__(self, n):
        return _Col()


def _fichas():
    return [
        {"id": "estela", "name": "Estela Alen Lage", "email": "estela@ejemplo.es", "center": "", "active": True},
        {"id": "ana", "name": "Ana Pérez", "email": "ana@ejemplo.es", "center": "OGA5", "active": True,
         "transporter_id": "A2S2HK9FC8JOUX"},
        {"id": "luis", "name": "Luis Gómez", "center": "DGA1", "active": True, "driver_id": "A1B9QW7ER5TY3U"},
        {"id": "vieja", "name": "Ficha Vieja", "center": "OGA5", "active": True, "transporter_id": "raro-123"},
        {"id": "sincampo", "name": "Sin Campo Centro", "active": True},
    ]


@pytest_asyncio.fixture(loop_scope="session")
async def cliente():
    async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://testserver") as c:
        yield c


@pytest.fixture
def base(monkeypatch):
    b = _Base(_fichas())
    monkeypatch.setattr(server, "db", b)
    monkeypatch.setattr(server, "global_db", _Global(["OGA5", "DGA1"]))
    server._ADMIN_EXISTS_CACHE.clear()
    return b


def _cab():
    tok = server.create_token("maintenance-claude", "admin", "Jefe", org_id="owner", account_type="owner",
                              super_admin=True)
    return {"Authorization": f"Bearer {tok}"}


async def test_las_fichas_sin_centro_salen_al_filtrar_por_centro(cliente, base):
    r = await cliente.get("/api/drivers", params={"center": "OGA5"}, headers=_cab())
    assert r.status_code == 200, r.text
    ids = {d["id"] for d in r.json()}
    assert ids == {"estela", "ana", "vieja", "sincampo"}      # Luis es de DGA1: fuera


async def test_la_ficha_trae_su_id_de_reparto(cliente, base):
    r = await cliente.get("/api/drivers", headers=_cab())
    ana = next(d for d in r.json() if d["id"] == "ana")
    assert ana["transporter_id"] == "A2S2HK9FC8JOUX"


async def test_correo_repetido_dice_a_que_ficha_ir(cliente, base):
    r = await cliente.post("/api/drivers", headers=_cab(),
                           json={"name": "Estela Alen", "email": "ESTELA@ejemplo.es", "center": "OGA5"})
    assert r.status_code == 409
    d = r.json()["detail"]
    assert d["abrir_id"] == "estela" and d["centro"] == ""
    assert "sin centro asignado" in d["mensaje"]


async def test_id_de_reparto_repetido_tambien_en_el_otro_campo(cliente, base):
    r = await cliente.post("/api/drivers", headers=_cab(),
                           json={"name": "Otro Luis", "transporter_id": "a1b9 qw7er5ty3u", "center": "DGA1"})
    assert r.status_code == 409
    assert r.json()["detail"]["abrir_id"] == "luis"


async def test_id_de_reparto_mal_escrito_400(cliente, base):
    r = await cliente.post("/api/drivers", headers=_cab(), json={"name": "Nueva", "transporter_id": "12345"})
    assert r.status_code == 400


async def test_alta_con_id_se_guarda_normalizado(cliente, base):
    r = await cliente.post("/api/drivers", headers=_cab(),
                           json={"name": "Nueva Persona", "transporter_id": " a7k2lm4nb8vc1x ", "center": "OGA5"})
    assert r.status_code == 200, r.text
    assert r.json()["transporter_id"] == "A7K2LM4NB8VC1X"


async def test_sin_centro_y_una_sola_sede_se_pone_la_sede(cliente, base, monkeypatch):
    monkeypatch.setattr(server, "global_db", _Global(["OGA5"]))
    r = await cliente.post("/api/drivers", headers=_cab(), json={"name": "Una Sede", "center": ""})
    assert r.status_code == 200, r.text
    assert r.json()["center"] == "OGA5"


async def test_sin_centro_y_varias_sedes_no_se_adivina(cliente, base):
    r = await cliente.post("/api/drivers", headers=_cab(), json={"name": "Varias Sedes"})
    assert r.status_code == 200, r.text
    assert not r.json()["center"]


async def test_editar_con_id_viejo_sin_tocarlo_no_falla(cliente, base):
    """El formulario manda la ficha entera: un ID viejo con forma rara no
    puede impedir guardar un cambio de teléfono."""
    r = await cliente.patch("/api/drivers/vieja", headers=_cab(),
                            json={"phone": "600111222", "transporter_id": "raro-123"})
    assert r.status_code == 200, r.text
    vieja = next(d for d in base.drivers.docs if d["id"] == "vieja")
    assert vieja["transporter_id"] == "raro-123" and vieja["phone"] == "600111222"


async def test_editar_id_de_reparto_poner_y_quitar(cliente, base):
    r = await cliente.patch("/api/drivers/estela", headers=_cab(), json={"transporter_id": "a7k2lm4nb8vc1x"})
    assert r.status_code == 200, r.text
    estela = next(d for d in base.drivers.docs if d["id"] == "estela")
    assert estela["transporter_id"] == "A7K2LM4NB8VC1X"
    # El de otra ficha no.
    r = await cliente.patch("/api/drivers/estela", headers=_cab(), json={"transporter_id": "A2S2HK9FC8JOUX"})
    assert r.status_code == 409 and r.json()["detail"]["abrir_id"] == "ana"
    # Vacío lo quita.
    r = await cliente.patch("/api/drivers/estela", headers=_cab(), json={"transporter_id": ""})
    assert r.status_code == 200
    assert "transporter_id" not in next(d for d in base.drivers.docs if d["id"] == "estela")
