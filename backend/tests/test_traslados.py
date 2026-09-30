# -*- coding: utf-8 -*-
"""Cambio de centro programado (30-09-2026, Dani: «pásalo a OGA5 el día 5»):
la ficha de Fran Gil pasa de DGA1 a OGA5 el 05-10 sola, apuntando de dónde
venía. Sin base de datos: una colección de mentira con lo que usa
`aplicar_traslados`."""
from types import SimpleNamespace

import pytest

import server


class _Cursor:
    def __init__(self, docs):
        self._it = iter(docs)

    def __aiter__(self):
        return self

    async def __anext__(self):
        try:
            return next(self._it)
        except StopIteration:
            raise StopAsyncIteration


class _Fichas:
    def __init__(self, docs):
        self.docs = docs

    def find(self, q, proyeccion=None):
        return _Cursor([dict(d) for d in self.docs if "traslado" in d])

    async def update_one(self, filtro, cambio):
        for d in self.docs:
            t = d.get("traslado") or {}
            if (d["id"] == filtro["id"] and t.get("centro") == filtro.get("traslado.centro")
                    and t.get("desde") == filtro.get("traslado.desde")):
                d.update(cambio.get("$set", {}))
                for k in cambio.get("$unset", {}):
                    d.pop(k, None)
                for k, v in cambio.get("$push", {}).items():
                    d.setdefault(k, []).append(v)
                return SimpleNamespace(modified_count=1)
        return SimpleNamespace(modified_count=0)


def _empresa():
    return [
        {"id": "fran", "name": "FRANCISCO JAVIER GIL ADAMUZ", "center": "DGA1",
         "traslado": {"centro": "OGA5", "desde": "2026-10-05", "por": "Dani"}},
        {"id": "otra", "name": "OTRA PERSONA", "center": "OGA5",
         "traslado": {"centro": "DGA1", "desde": "2026-10-06", "por": "Dani"}},
        {"id": "quieta", "name": "SIN CAMBIOS", "center": "OGA5"},
    ]


@pytest.fixture
def fichas(monkeypatch):
    docs = _empresa()
    monkeypatch.setattr(server, "db", SimpleNamespace(drivers=_Fichas(docs)))
    return docs


def test_cuando_toca():
    t = {"centro": "OGA5", "desde": "2026-10-05"}
    assert not server._traslado_toca(t, "2026-10-04")
    assert server._traslado_toca(t, "2026-10-05")
    assert server._traslado_toca(t, "2026-10-09")
    assert not server._traslado_toca({"centro": "", "desde": "2026-10-05"}, "2026-10-09")
    assert not server._traslado_toca({"centro": "OGA5", "desde": "5-10"}, "2026-10-09")
    assert not server._traslado_toca(None, "2026-10-09")


@pytest.mark.asyncio(loop_scope="session")
async def test_el_dia_antes_no_se_mueve_nadie(fichas):
    assert await server.aplicar_traslados("2026-10-04") == []
    assert fichas[0]["center"] == "DGA1" and "traslado" in fichas[0]


@pytest.mark.asyncio(loop_scope="session")
async def test_el_dia_5_fran_pasa_a_oga5_y_queda_apuntado(fichas):
    hechos = await server.aplicar_traslados("2026-10-05")
    assert [h["id"] for h in hechos] == ["fran"]
    fran = fichas[0]
    assert fran["center"] == "OGA5" and "traslado" not in fran
    assert fran["historial_centros"][0]["de"] == "DGA1" and fran["historial_centros"][0]["a"] == "OGA5"
    # La otra es del 6: sigue esperando. Y quien no tiene nada, igual.
    assert fichas[1]["center"] == "OGA5" and "traslado" in fichas[1]
    assert fichas[2] == {"id": "quieta", "name": "SIN CAMBIOS", "center": "OGA5"}


@pytest.mark.asyncio(loop_scope="session")
async def test_dos_pasadas_no_lo_aplican_dos_veces(fichas):
    await server.aplicar_traslados("2026-10-05")
    assert await server.aplicar_traslados("2026-10-05") == []
    assert len(fichas[0]["historial_centros"]) == 1
