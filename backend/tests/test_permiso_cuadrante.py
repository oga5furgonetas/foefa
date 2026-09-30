# -*- coding: utf-8 -*-
"""El Cuadrante con casilla propia (30-09-2026, Dani en Usuarios: «¿no puedo
marcarle cuadrante?»). Hasta entonces iba con Días libres: la migración se lo
marca UNA vez a quien lo veía por eso, y nunca más (si luego se le quita a
alguien, no vuelve solo). Sin base de datos."""
from types import SimpleNamespace

import pytest

import server


class _Usuarios:
    def __init__(self, docs):
        self.docs = docs

    async def update_many(self, filtro, cambio):
        con, sin = filtro["$and"][0]["permissions"], filtro["$and"][1]["permissions"]["$ne"]
        n = 0
        for d in self.docs:
            p = d.get("permissions")
            if isinstance(p, list) and con in p and sin not in p:
                p.append(cambio["$addToSet"]["permissions"])
                n += 1
        return SimpleNamespace(modified_count=n)


class _Meta:
    def __init__(self):
        self.docs = {}

    async def find_one(self, q):
        return self.docs.get(q["_id"])

    async def update_one(self, q, cambio, upsert=False):
        self.docs[q["_id"]] = {"_id": q["_id"], **cambio.get("$set", {})}


@pytest.fixture
def base(monkeypatch):
    usuarios = [
        {"id": "mery", "permissions": ["turnos", "conductores"]},
        {"id": "ana", "permissions": ["vehiculos"]},
        {"id": "luis", "permissions": None},
        {"id": "pepe", "permissions": ["turnos", "cuadrante"]},
    ]
    g = SimpleNamespace(admin_users=_Usuarios(usuarios), app_meta=_Meta())
    monkeypatch.setattr(server, "global_db", g)
    return usuarios, g


@pytest.mark.asyncio(loop_scope="session")
async def test_quien_tenia_dias_libres_sigue_viendo_el_cuadrante(base):
    usuarios, g = base
    await server.migrar_permiso_cuadrante()
    por = {u["id"]: u["permissions"] for u in usuarios}
    assert por["mery"] == ["turnos", "conductores", "cuadrante"]
    assert por["ana"] == ["vehiculos"]            # no lo veía: tampoco ahora
    assert por["luis"] is None                    # sin lista ya lo ve todo
    assert por["pepe"] == ["turnos", "cuadrante"]
    assert g.app_meta.docs["migracion_permiso_cuadrante"]["usuarios"] == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_solo_una_vez_lo_que_se_quite_despues_no_vuelve(base):
    usuarios, _ = base
    await server.migrar_permiso_cuadrante()
    usuarios[0]["permissions"].remove("cuadrante")   # Dani se lo quita a Mery
    await server.migrar_permiso_cuadrante()          # siguiente despliegue
    assert "cuadrante" not in usuarios[0]["permissions"]
