# -*- coding: utf-8 -*-
"""Valor (apuestas) es SOLO de Dani: nadie más la ve, la encuentra ni la usa.

Se prueba la puerta de verdad —la app de server.py con sus dependencias—, no
una copia. La base de usuarios se sustituye por una falsa en memoria (estas
pruebas no necesitan Mongo) y la de Valor es un SQLite temporal.

Lo que tiene que dar 403 aunque el token diga «super-admin»: la demo, el token
de mantenimiento, la cuenta de una empresa vista por el super-admin, otra
cuenta que acabara marcada como super-admin y un servidor sin
SUPERADMIN_USERNAME. Y la base no puede bajarse por /uploads.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

import server
from valor.escaner import Escaner, Presupuesto
from valor.fuentes.base import Fuente, Lectura
from valor.fuentes.nombres import id_evento
from valor.nucleo.modelo import Cuota, Evento
from valor.registro import Registro

pytestmark = pytest.mark.asyncio(loop_scope="session")

DANI = "dani-el-dueno"
LEER = ["/api/valor/estado", "/api/valor/oportunidades", "/api/valor/oportunidades?vivo=true",
        "/api/valor/seguras", "/api/valor/apuestas",
        "/api/valor/aprendizaje"]
ESCRIBIR = [("/api/valor/apuestas", {"oportunidad_id": 1}),
            ("/api/valor/apuestas/manual", {"descripcion": "x", "casa": "y", "cuota": 2, "importe": 5}),
            ("/api/valor/apuestas/1/resultado", {"resultado": "ganada"})]


class _Coleccion:
    def __init__(self, docs=None):
        self.docs = docs if docs is not None else []

    async def find_one(self, filtro, proyeccion=None):
        for d in self.docs:
            if all(d.get(k) == v for k, v in filtro.items()):
                return dict(d)
        return None

    async def insert_one(self, doc):          # el registro de escrituras del middleware
        return None


class _BaseFalsa:
    def __init__(self, usuarios):
        self.admin_users = _Coleccion(usuarios)

    def __getattr__(self, nombre):
        return _Coleccion()


USUARIOS = {
    "dani": {"id": "u-dani", "username": DANI, "super_admin": True},
    "encargado": {"id": "u-encargado", "username": "encargado", "admin_role": "center_manager"},
    "admin": {"id": "u-admin", "username": "otro-admin"},
    "otro_sa": {"id": "u-otro-sa", "username": "otro-super", "super_admin": True},
    "retirado": {"id": "u-retirado", "username": DANI + "-viejo", "super_admin": False},
}


class Falsa(Fuente):
    """La misma lectura que usaban las pruebas de la web original de Valor."""
    nombre = "falsa"

    def __init__(self, cruce):
        self.cruce = cruce

    def leer(self, deportes):
        ahora = datetime.now(timezone.utc)
        inicio = ahora + timedelta(hours=3)
        e = self.cruce.registra(Evento(id_evento("futbol", "Betis", "Sevilla", inicio), "futbol",
                                       "LaLiga", "Betis", "Sevilla", inicio))
        t = ahora - timedelta(seconds=5)
        c = [Cuota(e.id, "pinnacle", "1x2", None, s, v, t) for s, v in
             (("local", 2.10), ("empate", 3.45), ("visitante", 3.70))]
        c += [Cuota(e.id, "bet365", "1x2", None, "local", 2.30, t),
              Cuota(e.id, "codere", "1x2", None, "empate", 3.70, t),
              Cuota(e.id, "bwin", "1x2", None, "visitante", 4.10, t)]
        return Lectura([e], c)


@pytest.fixture
def entorno(tmp_path, monkeypatch):
    # Filtros abiertos como en las pruebas originales: la apuesta de ejemplo sale el 46 %.
    monkeypatch.setenv("VALOR_PROB_MINIMA", "0")
    monkeypatch.setenv("VALOR_SEGURAS", "1")
    monkeypatch.setenv("SUPERADMIN_USERNAME", DANI)
    monkeypatch.setattr(server, "global_db", _BaseFalsa(list(USUARIOS.values())))
    monkeypatch.setattr(server, "VALOR_DB", str(tmp_path / "privado" / "valor.db"))
    monkeypatch.setattr(server, "_VALOR_REG", None)
    server._ADMIN_EXISTS_CACHE.clear()
    server._VALOR_DUENO_CACHE.clear()
    (tmp_path / "privado").mkdir()
    reg = Registro(server.VALOR_DB)
    esc = Escaner(reg, 1000, fuentes={})
    esc.fuentes = {Falsa(esc.cruce): Presupuesto("falsa", 100, timedelta(days=1), 1)}
    esc.vuelta()
    reg.db.close()
    yield
    if server._VALOR_REG is not None:
        server._VALOR_REG.db.close()
    server._ADMIN_EXISTS_CACHE.clear()
    server._VALOR_DUENO_CACHE.clear()


@pytest_asyncio.fixture(loop_scope="session")
async def cliente():
    async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://testserver") as c:
        yield c


def _cab(quien, **extra):
    u = USUARIOS[quien]
    tok = server.create_token(u["id"], "admin", quien, org_id="owner", db_name="test_flota",
                              account_type="owner", super_admin=bool(u.get("super_admin")), **extra)
    return {"Authorization": f"Bearer {tok}"}


async def _todas(cliente, cabeceras):
    codigos = [(await cliente.get(r, headers=cabeceras)).status_code for r in LEER]
    codigos += [(await cliente.post(r, json=b, headers=cabeceras)).status_code for r, b in ESCRIBIR]
    return codigos


async def test_sin_sesion_401(cliente, entorno):
    assert set(await _todas(cliente, {})) == {401}


@pytest.mark.parametrize("quien", ["encargado", "admin"])
async def test_admin_que_no_es_super_admin_403(cliente, entorno, quien):
    assert set(await _todas(cliente, _cab(quien))) == {403}


async def test_otra_cuenta_marcada_como_super_admin_403(cliente, entorno):
    """Si otra cuenta acabara con la marca, ve Gastos, pero Valor no."""
    assert set(await _todas(cliente, _cab("otro_sa"))) == {403}


async def test_token_viejo_de_super_admin_ya_retirado_403(cliente, entorno):
    tok = server.create_token("u-retirado", "admin", "x", org_id="owner", account_type="owner",
                              super_admin=True)
    assert set(await _todas(cliente, {"Authorization": f"Bearer {tok}"})) == {403}


async def test_demo_mantenimiento_y_empresa_suplantada_403(cliente, entorno):
    demo = server.create_token("u-dani", "admin", "demo", super_admin=True, demo=True)
    mant = server.create_token("maintenance-claude", "admin", "m", org_id="owner",
                               account_type="owner", super_admin=True)
    # Mirando la cuenta de una empresa: el token lleva el id de Dani, sin la marca.
    supl = server.create_token("u-dani", "admin", "Empresa", org_id="org1", db_name="test_x",
                               account_type="dsp", suplantado=True)
    for tok in (demo, mant, supl):
        codigos = [(await cliente.get(r, headers={"Authorization": f"Bearer {tok}"})).status_code
                   for r in LEER]
        assert set(codigos) == {403}, codigos


async def test_sin_superadmin_username_no_entra_ni_dani(cliente, entorno, monkeypatch):
    monkeypatch.delenv("SUPERADMIN_USERNAME", raising=False)
    r = await cliente.get("/api/valor/estado", headers=_cab("dani"))
    assert r.status_code == 403


async def test_dani_entra_y_funciona(cliente, entorno):
    h = _cab("dani")
    for ruta in LEER:
        assert (await cliente.get(ruta, headers=h)).status_code == 200, ruta

    items = (await cliente.get("/api/valor/oportunidades", headers=h)).json()["items"]
    op = next(o for o in items if o["casa"] == "bet365")
    r = await cliente.post("/api/valor/apuestas", headers=h,
                           json={"oportunidad_id": op["id"], "cuota": "2,28", "importe": "10"})
    assert r.status_code == 200
    apuesta = r.json()["id"]
    assert (await cliente.post("/api/valor/apuestas", headers=h,
                               json={"oportunidad_id": op["id"], "cuota": "0.5"})).status_code == 400
    assert (await cliente.post("/api/valor/apuestas", headers=h,
                               json={"oportunidad_id": 99999})).status_code == 404
    assert (await cliente.post(f"/api/valor/apuestas/{apuesta}/resultado", headers=h,
                               json={"resultado": "ganada"})).status_code == 200
    assert (await cliente.post(f"/api/valor/apuestas/{apuesta}/resultado", headers=h,
                               json={"resultado": "quizas"})).status_code == 400
    assert (await cliente.post("/api/valor/apuestas/99999/resultado", headers=h,
                               json={"resultado": "ganada"})).status_code == 404
    b = (await cliente.get("/api/valor/apuestas", headers=h)).json()["balance"]
    assert b["beneficio"] == pytest.approx(12.8)

    r = await cliente.post("/api/valor/apuestas/manual", headers=h, json={
        "descripcion": "Sevilla gana", "casa": "Bet365", "cuota": "1,85", "importe": "100"})
    assert r.status_code == 200
    for malo in ({"casa": "x"}, {"descripcion": "x", "casa": "y", "cuota": "1", "importe": "5"},
                 {"descripcion": ["x"], "casa": {"a": 1}, "cuota": True, "importe": None}):
        assert (await cliente.post("/api/valor/apuestas/manual", headers=h, json=malo)).status_code == 400
    assert (await cliente.get("/api/valor/aprendizaje", headers=h)).json()["minimo"] == 30


async def test_aprendizaje_con_un_solo_aviso_no_da_500(cliente, entorno):
    """Un segmento con UN aviso tiene margen infinito, y JSON no lo admite."""
    reg = Registro(server.VALOR_DB)
    reg.db.execute("UPDATE oportunidades SET clv=0.03 WHERE id=(SELECT MIN(id) FROM oportunidades)")
    reg.db.commit()
    reg.db.close()
    r = await cliente.get("/api/valor/aprendizaje", headers=_cab("dani"))
    assert r.status_code == 200
    seg = r.json()["segmentos"]
    assert seg and seg[0]["n"] == 1 and seg[0]["margen"] is None


async def test_la_base_no_se_baja_por_uploads(cliente, tmp_path):
    """/uploads es público; lo que va en PRIVADO_DIR no sale por ahí de ninguna forma."""
    nombre = "prueba-%s.db" % uuid.uuid4().hex[:8]
    secreto = server.PRIVADO_DIR / nombre
    publico = server.UPLOAD_DIR / ("prueba-%s.txt" % uuid.uuid4().hex[:8])
    secreto.write_bytes(b"SQLite format 3\x00")
    publico.write_text("hola")
    try:
        assert (await cliente.get("/uploads/" + publico.name)).status_code == 200
        for ruta in ("/uploads/privado/" + nombre, "/uploads/./privado/" + nombre,
                     "/uploads/x/../privado/" + nombre, "/uploads//privado/" + nombre,
                     "/uploads/privado/", "/uploads/privado"):
            assert (await cliente.get(ruta)).status_code == 404, ruta
    finally:
        secreto.unlink()
        publico.unlink()


async def test_la_lista_de_rutas_no_es_publica(cliente):
    for ruta in ("/openapi.json", "/docs", "/redoc"):
        assert (await cliente.get(ruta)).status_code == 404, ruta
