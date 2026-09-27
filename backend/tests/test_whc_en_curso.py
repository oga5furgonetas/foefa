# -*- coding: utf-8 -*-
"""Horas (WHC) en Flota: el plan se PEGA, y «ya pasado» es solo lo cerrado.

El total que da el portal cuenta también el bloque EN CURSO (por eso no
cuadraba con la suma de bloques cerrados: faltaba una ruta entera). Con 50 h
cerradas y una ruta empezada, el portal dice 59 h y la pantalla decía «pasado»
de alguien que todavía no ha llegado a las 54 h 30. Lo que depende del bloque de
hoy va aparte (`pasara_hoy`): a ese todavía se le puede cortar el día.

Se prueba el endpoint de verdad (server.app) con una base falsa en memoria.
"""
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

import server

pytestmark = pytest.mark.asyncio(loop_scope="session")

LIMITE = int(54.5 * 60)


def _bloque(ini, fin, minutos, en_curso=False):
    return {"inicio": ini, "fin": fin, "minutos": minutos, "tipo": "Standard Parcel",
            "estimado": en_curso, **({"en_curso": True} if en_curso else {})}


def _conductor(nombre, trabajado, bloques):
    return {"nombre": nombre, "trabajado": trabajado, "planificado": 0,
            "trabajado_origen": "portal", "bloques": bloques}


def test_con_el_bloque_de_hoy_en_curso_no_es_ya_pasado():
    cerrados = [_bloque("8:00am", "6:00pm", 600) for _ in range(5)]            # 50 h
    c = _conductor("EN RUTA", 59 * 60, cerrados + [_bloque("10:45am", None, None, True)])
    [r] = server._whc_evaluar([c], LIMITE, None, 6)
    assert r["supera_semanal"] is False
    assert r["pasara_hoy"] is True and r["cerrado"] == 50 * 60
    assert r["incumple_propio"] is False
    assert r["estado_ritmo"] != "pasado"


def test_lo_cerrado_que_ya_pasa_si_es_ya_pasado():
    cerrados = [_bloque("8:00am", "5:30pm", 570) for _ in range(6)]            # 57 h
    c = _conductor("PASADO", 57 * 60, cerrados)
    [r] = server._whc_evaluar([c], LIMITE, None, 7)
    assert r["supera_semanal"] is True and r["pasara_hoy"] is False
    assert r["incumple_propio"] is True


def test_pasado_aunque_este_en_ruta_si_lo_cerrado_ya_pasa():
    cerrados = [_bloque("8:00am", "5:30pm", 570) for _ in range(6)]            # 57 h
    c = _conductor("PASADO Y EN RUTA", 66 * 60, cerrados + [_bloque("9:00am", None, None, True)])
    [r] = server._whc_evaluar([c], LIMITE, None, 7)
    assert r["supera_semanal"] is True and r["trabajando_ahora"] is True


def test_domingo_de_la_semana():
    assert server._whc_domingo("2026-09-27") == "2026-09-27"      # domingo
    assert server._whc_domingo("2026-10-03") == "2026-09-27"      # sábado
    assert server._whc_domingo("2026-09-28") == "2026-09-27"      # lunes


# ── El endpoint: pegar, guardar por (centro, semana) y leerlo después ───────

PLAN = """Editar asignación de ruta
OGA5
dom., sep. 27
lun., sep. 28
ANA PEREZ GARCIA
Estándar
59h 00m / 60h 00m
8:00am - 6:00pm
Standard Parcel
8:00am - 6:00pm
Standard Parcel
8:00am - 6:00pm
Standard Parcel
8:00am - 6:00pm
Standard Parcel
8:00am - 6:00pm
Standard Parcel
10:45am - en curso
Standard Parcel
LUIS GOMEZ VIDAL
Estándar
27h 00m / 45h 00m
8:00am - 5:00pm
Standard Parcel
8:00am - 5:00pm
Standard Parcel
8:00am - 5:00pm
Standard Parcel
"""


class _Planes:
    def __init__(self):
        self.docs = {}

    async def find_one(self, filtro, proy=None, sort=None):
        if "week" in filtro:
            return self.docs.get((filtro["center"], filtro["week"]))
        cand = [d for (c, _), d in self.docs.items() if c == filtro["center"]]
        return max(cand, key=lambda d: d["week"]) if cand else None

    async def update_one(self, filtro, cambio, upsert=False):
        self.docs[(filtro["center"], filtro["week"])] = dict(cambio["$set"])


class _Col:
    async def find_one(self, *a, **k):
        return None

    async def insert_one(self, *a, **k):
        return None


class _Base:
    def __init__(self):
        self.whc_planes = _Planes()

    def __getattr__(self, n):
        return _Col()

    def __getitem__(self, n):
        return _Col()


class _Orgs:
    async def find_one(self, *a, **k):
        return {"centers": ["OGA5", "DGA1"]}


class _Global:
    organizations = _Orgs()

    def __getattr__(self, n):
        return _Col()


@pytest_asyncio.fixture(loop_scope="session")
async def cliente():
    async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://testserver") as c:
        yield c


@pytest.fixture
def base(monkeypatch):
    b = _Base()
    monkeypatch.setattr(server, "db", b)
    monkeypatch.setattr(server, "global_db", _Global())
    monkeypatch.setattr(server, "_dia_negocio", lambda: "2026-09-28")
    server._ADMIN_EXISTS_CACHE.clear()
    return b


def _cab():
    tok = server.create_token("maintenance-claude", "admin", "Jefe", org_id="owner", account_type="owner",
                              super_admin=True)
    return {"Authorization": f"Bearer {tok}"}


async def test_pegar_el_plan_lo_analiza_y_lo_guarda(cliente, base):
    r = await cliente.post("/api/whc/analizar", headers=_cab(),
                           json={"texto": PLAN, "limite_horas": 54.5, "center": "Todos"})
    assert r.status_code == 200, r.text
    j = r.json()
    # «Todos» no es un centro: se saca de la cabecera del plan.
    assert j["centro"] == "OGA5" and j["guardado"] is True
    por = {c["nombre"]: c for c in j["conductores"]}
    assert set(por) == {"ANA PEREZ GARCIA", "LUIS GOMEZ VIDAL"}
    assert por["ANA PEREZ GARCIA"]["supera_semanal"] is False
    assert por["ANA PEREZ GARCIA"]["pasara_hoy"] is True
    assert j["resumen"]["superan"] == 0 and j["resumen"]["pasaran_hoy"] == 1
    # Sin la hoja de excepciones, el % de Amazon no se inventa.
    assert j["whc"]["porcentaje"] is None
    assert ("OGA5", "2026-09-27") in base.whc_planes.docs

    # Y al volver a la pantalla, el plan está.
    p = (await cliente.get("/api/whc/plan", headers=_cab(), params={"center": "OGA5"})).json()
    assert p["hay"] is True and p["semana"] == "2026-09-27" and p["n_conductores"] == 2
    e = (await cliente.get("/api/whc/estado", headers=_cab())).json()
    estado = {n["centro"]: n for n in e["naves"]}
    assert estado["OGA5"]["al_dia"] is True and estado["DGA1"]["al_dia"] is False
    assert e["faltan"] == ["DGA1"] and "DGA1" in e["como_se_arregla"]


async def test_un_texto_sin_conductores_400(cliente, base):
    r = await cliente.post("/api/whc/analizar", headers=_cab(),
                           json={"texto": "esto no es un plan de la semana, solo texto suelto " * 2})
    assert r.status_code == 400
