# -*- coding: utf-8 -*-
"""Arreglos de la zona «día» (10-11-2026), contra el servidor de verdad (server.app) con
una base de mentira en memoria: no hace falta Mongo.

- dia-3: «Nueva plantilla» ya no borra sin avisar la hoja que otra persona está editando.
  Con `preguntar=1`, si OTRA persona la tocó en los últimos 10 minutos, no se borra y se
  contesta quién y hace cuánto; sin el parámetro (la web de antes, en caché), como siempre.
- dia-11: el botón «Resumen» del checklist de una nave avisaba a TODAS. Con `center` solo
  se manda el de esa nave, y solo si quien lo pide puede verla; sin él, como siempre.
"""
import time
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

import server
from base_de_mentira import Col, Db

pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest_asyncio.fixture(loop_scope="session")
async def cliente():
    async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://testserver") as c:
        yield c


@pytest.fixture
def base(monkeypatch):
    b = Db()
    monkeypatch.setattr(server, "db", b)
    monkeypatch.setattr(server, "global_db", Db())
    server._ADMIN_EXISTS_CACHE.clear()
    yield b
    server._ADMIN_EXISTS_CACHE.clear()


def _cab(uid, nombre, centros=None, cuenta="owner"):
    """Un usuario de oficina que existe (la caché de _admin_cacheado hace de base)."""
    server._ADMIN_EXISTS_CACHE[uid] = (time.time() + 600, True, centros, None, None)
    tok = server.create_token(uid, "admin", nombre, org_id="o1", account_type=cuenta)
    return {"Authorization": f"Bearer {tok}"}


FILA = {"ruta": "CA_A1", "conductor": "ANA", "movil": "", "furgo": "", "h_salida": "",
        "h_bajada": "", "h_llegada": "", "observaciones": ""}


async def _borrador(cliente, cab):
    r = await cliente.post("/api/tools/plantilla-compartida", headers=cab,
                           json={"center": "OGA5", "state": {"week": "46", "date": "10/11/2026", "rows": [FILA]}})
    assert r.status_code == 200, r.text
    return r.json()["id"]


# ── dia-3 ─────────────────────────────────────────────────────────────────────

async def test_si_otra_persona_la_esta_editando_no_se_borra_y_dice_quien(cliente, base):
    maria, jefe = _cab("u-maria", "María"), _cab("u-jefe", "Jefe OGA5")
    bid = await _borrador(cliente, maria)
    r = await cliente.patch(f"/api/tools/plantilla-compartida/{bid}/meta", headers=maria, json={"week": "47"})
    assert r.status_code == 200, r.text

    r = await cliente.delete(f"/api/tools/plantilla-compartida/{bid}?preguntar=1", headers=jefe)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["ok"] is False and j["editando"]["nombre"] == "María" and j["editando"]["minutos"] >= 1
    assert len(base.plantillas_compartidas.docs) == 1, "con otra persona dentro no se borra sin preguntar"

    # El jefe confirma: el borrado de siempre, para todos.
    r = await cliente.delete(f"/api/tools/plantilla-compartida/{bid}", headers=jefe)
    assert r.json() == {"ok": True}
    assert base.plantillas_compartidas.docs == []


async def test_aunque_el_ultimo_cambio_sea_mio_cuenta_que_otra_la_toco(cliente, base):
    maria, jefe = _cab("u-maria", "María"), _cab("u-jefe", "Jefe OGA5")
    bid = await _borrador(cliente, maria)
    r = await cliente.patch(f"/api/tools/plantilla-compartida/{bid}/marca", headers=jefe,
                            json={"tipo": "red_routes", "valor": "CA_A1", "activo": True})
    assert r.status_code == 200, r.text
    # El último cambio es de verdad del jefe: si /marca fallara, la prueba no demostraría nada.
    assert base.plantillas_compartidas.docs[0]["updated_by"] == "Jefe OGA5"
    r = await cliente.delete(f"/api/tools/plantilla-compartida/{bid}?preguntar=1", headers=jefe)
    assert r.json()["ok"] is False and r.json()["editando"]["nombre"] == "María"


# Lo que más se usa para editar: celda a celda (/celda) y pegar las horas (/horas). La hoja
# la crea el jefe, así que el único toque de María es el de ESA operación (10-11-2026).

async def test_maria_escribiendo_celdas_cuenta_como_que_la_esta_editando(cliente, base):
    maria, jefe = _cab("u-maria", "María"), _cab("u-jefe", "Jefe OGA5")
    bid = await _borrador(cliente, jefe)
    r = await cliente.patch(f"/api/tools/plantilla-compartida/{bid}/celda", headers=maria,
                            json={"fila": 0, "campo": "furgo", "valor": "1234 ABC", "ruta_ref": "CA_A1"})
    assert r.status_code == 200, r.text
    doc = base.plantillas_compartidas.docs[0]
    assert doc["state"]["rows"][0]["furgo"] == "1234 ABC"
    assert doc["toques"]["u-maria"]["nombre"] == "María"

    r = await cliente.delete(f"/api/tools/plantilla-compartida/{bid}?preguntar=1", headers=jefe)
    assert r.json()["ok"] is False and r.json()["editando"]["nombre"] == "María"
    assert len(base.plantillas_compartidas.docs) == 1


async def test_maria_pegando_las_horas_cuenta_como_que_la_esta_editando(cliente, base):
    maria, jefe = _cab("u-maria", "María"), _cab("u-jefe", "Jefe OGA5")
    bid = await _borrador(cliente, jefe)
    r = await cliente.patch(f"/api/tools/plantilla-compartida/{bid}/horas", headers=maria,
                            json={"h_salida": "09:40"})
    assert r.status_code == 200, r.text
    doc = base.plantillas_compartidas.docs[0]
    assert doc["state"]["rows"][0]["h_salida"] == "09:40"
    assert doc["toques"]["u-maria"]["nombre"] == "María"

    r = await cliente.delete(f"/api/tools/plantilla-compartida/{bid}?preguntar=1", headers=jefe)
    assert r.json()["ok"] is False and r.json()["editando"]["nombre"] == "María"
    assert len(base.plantillas_compartidas.docs) == 1


async def test_si_solo_la_he_tocado_yo_se_borra_sin_preguntar(cliente, base):
    maria = _cab("u-maria", "María")
    bid = await _borrador(cliente, maria)
    await cliente.post(f"/api/tools/plantilla-compartida/{bid}/fila", headers=maria)
    r = await cliente.delete(f"/api/tools/plantilla-compartida/{bid}?preguntar=1", headers=maria)
    assert r.json() == {"ok": True}
    assert base.plantillas_compartidas.docs == []


async def test_si_la_otra_persona_lleva_mas_de_10_minutos_sin_tocarla_se_borra(cliente, base):
    maria, jefe = _cab("u-maria", "María"), _cab("u-jefe", "Jefe OGA5")
    bid = await _borrador(cliente, maria)
    hace_un_rato = (datetime.now(timezone.utc) - timedelta(minutes=25)).isoformat()
    base.plantillas_compartidas.docs[0]["toques"]["u-maria"]["at"] = hace_un_rato
    r = await cliente.delete(f"/api/tools/plantilla-compartida/{bid}?preguntar=1", headers=jefe)
    assert r.json() == {"ok": True}
    assert base.plantillas_compartidas.docs == []


async def test_un_borrador_de_antes_sin_toques_usa_el_ultimo_que_lo_cambio(cliente, base):
    jefe = _cab("u-jefe", "Jefe OGA5")
    base.plantillas_compartidas.docs.append({
        "id": "viejo", "center": "OGA5", "state": {"rows": [FILA]}, "revision": 3,
        "updated_at": (datetime.now(timezone.utc) - timedelta(minutes=3)).isoformat(), "updated_by": "María"})
    r = await cliente.delete("/api/tools/plantilla-compartida/viejo?preguntar=1", headers=jefe)
    assert r.json()["ok"] is False and r.json()["editando"] == {"nombre": "María", "minutos": 3}


async def test_la_web_de_antes_sin_preguntar_borra_como_siempre(cliente, base):
    maria, jefe = _cab("u-maria", "María"), _cab("u-jefe", "Jefe OGA5")
    bid = await _borrador(cliente, maria)
    r = await cliente.delete(f"/api/tools/plantilla-compartida/{bid}", headers=jefe)
    assert r.json() == {"ok": True}
    assert base.plantillas_compartidas.docs == []


# ── dia-11 ────────────────────────────────────────────────────────────────────

@pytest.fixture
def envios(monkeypatch, base):
    hechos = {"push": [], "telegram": []}

    async def push(center, titulo, cuerpo, url, **_):
        hechos["push"].append(center)

    async def telegram(texto):
        hechos["telegram"].append(texto)
        return True
    monkeypatch.setattr(server, "push_center_event", push)
    monkeypatch.setattr(server, "_telegram_aviso", telegram)
    base["daily_checklists"] = Col([
        {"id": f"c{i}", "center": c, "date": "2026-11-10", "shift": "manana",
         "items": [{"id": "t1", "text": "Abrir nave", "done": True}, {"id": "t2", "text": "Llaves", "done": False}]}
        for i, c in enumerate(("OGA5", "DGA1", "DGA2"))])
    return hechos


async def test_el_resumen_de_una_nave_solo_avisa_a_esa_nave(cliente, envios):
    cab = _cab("u-jefe", "Jefe DGA1")
    r = await cliente.post("/api/checklist/enviar-resumen", headers=cab,
                           json={"shift": "manana", "date": "2026-11-10", "center": "DGA1"})
    assert r.status_code == 200, r.text
    assert [e["center"] for e in r.json()["enviados"]] == ["DGA1"]
    assert envios["push"] == ["DGA1"]
    assert len(envios["telegram"]) == 1 and "DGA1" in envios["telegram"][0]


async def test_sin_nave_en_la_peticion_se_mandan_todas_como_antes(cliente, envios):
    cab = _cab("u-jefe", "Jefe")
    r = await cliente.post("/api/checklist/enviar-resumen", headers=cab,
                           json={"shift": "manana", "date": "2026-11-10"})
    assert r.status_code == 200, r.text
    assert sorted(envios["push"]) == ["DGA1", "DGA2", "OGA5"]


async def test_no_se_puede_pedir_el_resumen_de_una_nave_que_no_ve(cliente, envios):
    # Empresa cliente con un jefe limitado a DGA1 (en la cuenta dueña se ven todas).
    cab = _cab("u-dga1", "Jefe DGA1", centros=["DGA1"], cuenta="dsp")
    r = await cliente.post("/api/checklist/enviar-resumen", headers=cab,
                           json={"shift": "manana", "date": "2026-11-10", "center": "OGA5"})
    assert r.status_code == 403, r.text
    assert envios["push"] == [] and envios["telegram"] == []
