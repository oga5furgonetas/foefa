# -*- coding: utf-8 -*-
"""El login del panel no distingue mayúsculas (Mery, 28-09-2026: su usuario es
«Mery» y escribía «mery»; al 5º intento se bloqueaba). Sin base de datos: una
colección de mentira con las dos consultas que hace `_admin_por_usuario`."""
import re

import pytest

import server


class _Cursor:
    def __init__(self, docs):
        self.docs = docs

    async def to_list(self, n):
        return self.docs[:n]


def _casa(doc, q):
    v = q["username"]
    if isinstance(v, dict):
        return re.match(v["$regex"], doc["username"], re.I if "i" in v.get("$options", "") else 0) is not None
    return doc["username"] == v


class _Usuarios:
    def __init__(self, nombres):
        self.docs = [{"id": n.lower() + str(i), "username": n} for i, n in enumerate(nombres)]

    async def find_one(self, q, proyeccion=None):
        return next((dict(d) for d in self.docs if _casa(d, q)), None)

    def find(self, q, proyeccion=None):
        return _Cursor([dict(d) for d in self.docs if _casa(d, q)])


class _Global:
    def __init__(self, nombres):
        self.admin_users = _Usuarios(nombres)


@pytest.fixture
def con_usuarios(monkeypatch):
    def poner(*nombres):
        monkeypatch.setattr(server, "global_db", _Global(nombres))
    return poner


@pytest.mark.asyncio(loop_scope="session")
async def test_mery_entra_escribiendo_en_minusculas(con_usuarios):
    con_usuarios("Mery", "dani")
    u = await server._admin_por_usuario("mery")
    assert u and u["username"] == "Mery"
    assert (await server._admin_por_usuario("  MERY ")).get("username") == "Mery"


@pytest.mark.asyncio(loop_scope="session")
async def test_el_exacto_manda(con_usuarios):
    con_usuarios("Pepe", "pepe")
    assert (await server._admin_por_usuario("pepe"))["username"] == "pepe"
    assert (await server._admin_por_usuario("Pepe"))["username"] == "Pepe"


@pytest.mark.asyncio(loop_scope="session")
async def test_dos_que_solo_cambian_en_mayusculas_no_se_adivinan(con_usuarios):
    con_usuarios("Pepe", "pepe")
    assert await server._admin_por_usuario("PEPE") is None


@pytest.mark.asyncio(loop_scope="session")
async def test_un_nombre_con_simbolos_no_rompe_la_busqueda(con_usuarios):
    con_usuarios("ana.m", "anaxm")
    assert (await server._admin_por_usuario("ANA.M"))["username"] == "ana.m"
    assert await server._admin_por_usuario("") is None
