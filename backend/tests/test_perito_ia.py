# -*- coding: utf-8 -*-
"""«Antes del perito» (14-11-2026): la IA de daños, apagada para las empresas NUEVAS.

· El alta escribe `ia_danos: False`; las empresas que ya existen no llevan el campo y siguen EXACTAMENTE igual.
· Sin IA: la subida no llama a Gemini ni al detector propio y guarda «sin_ia» (ni error ni pendiente: nadie la
  reintenta ni la cuenta como fallo); validar la foto y leer el cuentakilómetros no preguntan a nadie; reanalizar y
  la subida masiva dan 403; «Revisión rápida» e «IA Peritaje» salen del menú. `IA_DANOS_DE_PAGO=1` la devuelve.
· Los textos de los planes no prometen la IA.

Cada «no se llama» se prueba con un doble que revienta si se llama, y con su control: la empresa de siempre sí llama.
Con la base de mentira (base_de_mentira.py), sin MongoDB.
"""
import asyncio
import inspect
import io

import pytest
from fastapi import HTTPException
from PIL import Image

import server
from base_de_mentira import Col, Db
from test_alta_ios import _dar_de_alta, mundo  # noqa: F401  (la fixture del alta, con su base de mentira)

NUEVA = {"id": "org-nueva", "account_type": "dsp", "plan": "completo", "status": "trial", "ia_danos": False}
DE_SIEMPRE = {"id": "org-vieja", "account_type": "dsp", "plan": "completo", "status": "active"}
ADMIN_NUEVA = {"sub": "a1", "role": "admin", "name": "Oficina", "org_id": "org-nueva"}
ADMIN_VIEJA = {"sub": "a2", "role": "admin", "name": "Oficina", "org_id": "org-vieja"}


def revienta(nombre):
    async def _no(*a, **k):
        raise AssertionError(f"sin la IA de daños se ha llamado a {nombre}")
    return _no


def _jpeg() -> bytes:
    b = io.BytesIO()
    Image.new("RGB", (64, 48), (200, 200, 200)).save(b, format="JPEG")
    return b.getvalue()


class Fichero:
    def __init__(self, nombre, contenido=b"foto"):
        self.filename, self._c = nombre, contenido

    async def read(self):
        return self._c


class NoLeer(Fichero):
    async def read(self):
        raise AssertionError("sin la IA no hace falta ni leer la foto")


@pytest.fixture
def base(monkeypatch):
    t = Db()
    t["vehicles"] = Col([{"id": "v1", "license_plate": "5678 KLM", "center": "OGA5", "status": "active",
                          "mileage": 48210}])
    t["drivers"] = Col([])
    t["inspections"] = Col([])
    t["daily_assignments"] = Col([])
    t["incidents"] = Col([])
    monkeypatch.setattr(server, "db", t)
    orgs = {"org-nueva": NUEVA, "org-vieja": DE_SIEMPRE}

    async def get_org(org_id):
        return dict(orgs[org_id]) if org_id in orgs else None
    monkeypatch.setattr(server, "get_org", get_org)
    monkeypatch.delenv("IA_DANOS_DE_PAGO", raising=False)
    return t


def test_quien_tiene_la_ia():
    assert server._ia_danos_activa(None) is True                      # sin empresa (pruebas, base por defecto)
    assert server._ia_danos_activa(DE_SIEMPRE) is True                # las de siempre no llevan el campo
    assert server._ia_danos_activa({**DE_SIEMPRE, "ia_danos": True}) is True
    assert server._ia_danos_activa(NUEVA) is False


@pytest.mark.parametrize("valor, activa", [("1", True), (" 1 ", True), ("true", False), ("0", False), ("", False)])
def test_la_clave_de_pago_se_la_devuelve(monkeypatch, valor, activa):
    monkeypatch.setenv("IA_DANOS_DE_PAGO", valor)
    assert server._ia_danos_activa(NUEVA) is activa


def test_sin_ia_fuera_revision_rapida_e_ia_peritaje(monkeypatch):
    monkeypatch.delenv("IA_DANOS_DE_PAGO", raising=False)
    todos = list(server._MODULOS_CLAVES)
    nueva = server.org_modulos({**NUEVA, "modulos": todos})
    assert "revision" not in nueva and "ia-peritaje" not in nueva and "repaso" in nueva
    vieja = server.org_modulos({**DE_SIEMPRE, "modulos": todos})
    assert "revision" in vieja and "ia-peritaje" in vieja
    # Una empresa de siempre ve exactamente lo de antes con el estándar.
    assert server.org_modulos(DE_SIEMPRE) == [k for k in server._MODULOS_CLAVES
                                              if k in set(server.MODULOS_ESTANDAR) | set(server._MODULOS_FIJOS)]
    monkeypatch.setenv("IA_DANOS_DE_PAGO", "1")
    assert "revision" in server.org_modulos({**NUEVA, "modulos": todos})


@pytest.mark.asyncio(loop_scope="session")
async def test_el_alta_nueva_nace_sin_la_ia(mundo):  # noqa: F811
    _, ana = await _dar_de_alta(mundo, "ana@x.es")
    assert ana["ia_danos"] is False
    _, pepe = await _dar_de_alta(mundo, "pepe@x.es", sector="mensajeria", plan="completo")
    assert pepe["ia_danos"] is False and server._ia_danos_activa(pepe) is False
    assert "revision" not in server.org_modulos(pepe) and "repaso" in server.org_modulos(pepe)


# ── La subida ─────────────────────────────────────────────────────────────────

async def _subir(monkeypatch, user):
    """Sube cuatro fotos de carrocería y el cuentakilómetros; devuelve (respuesta, tareas lanzadas)."""
    monkeypatch.setattr(server, "validate_image_content", lambda c: None)

    async def guardar(contenido, vid):
        return f"https://fotos.test/{vid}-{len(guardadas)}.jpg", contenido
    guardadas = []
    monkeypatch.setattr(server, "process_and_save_image", guardar)
    tareas = []

    def tarea(coro, *a, **k):
        tareas.append(coro)
        return None
    # Las tareas en segundo plano se apuntan en vez de lanzarse: así se sabe cuáles hay y se corren a mano.
    original = asyncio.create_task
    monkeypatch.setattr(server.asyncio, "create_task", tarea)
    nombres = ["angle_0_frontal.jpg", "angle_1_trasera.jpg", "angle_2_lateral_izq.jpg", "angle_3_lateral_der.jpg",
               "odometro.jpg"]
    try:
        r = await server.upload_inspection_photos(vehicle_id="v1", driver_id=None, notes="",
                                                  files=[Fichero(n) for n in nombres], user=user)
    finally:
        monkeypatch.setattr(server.asyncio, "create_task", original)
    return r, tareas


@pytest.mark.asyncio(loop_scope="session")
async def test_la_subida_de_una_empresa_nueva_no_llama_a_gemini(base, monkeypatch):
    monkeypatch.setattr(server, "analyze_images_with_gemini", revienta("Gemini"))
    monkeypatch.setattr(server, "_referencias_para_ia", revienta("las referencias para la IA"))
    monkeypatch.setattr(server, "_run_yolo_for_inspection", revienta("el detector propio"))
    r, tareas = await _subir(monkeypatch, ADMIN_NUEVA)
    assert r["analysis_status"] == "sin_ia" and r["success"] is True
    (doc,) = base["inspections"].docs
    assert doc["analysis_status"] == "sin_ia" and doc["analysis"] is None and doc["analysis_error"] is None
    # Solo el control de fraude (EXIF y hash, sin Gemini): ni análisis ni detector.
    assert [c.__name__ for c in tareas] == ["_delayed_fraud"]
    for c in tareas:
        c.close()


@pytest.mark.asyncio(loop_scope="session")
async def test_la_subida_de_una_empresa_de_siempre_sigue_llamando_a_gemini(base, monkeypatch):
    llamadas = []

    async def gemini(fotos, *a, **k):
        llamadas.append(len(fotos))
        return None, "gemini_failed", "doble de prueba"
    monkeypatch.setattr(server, "analyze_images_with_gemini", gemini)
    monkeypatch.setattr(server, "AI_SERVICE_URL", "")
    r, tareas = await _subir(monkeypatch, ADMIN_VIEJA)
    assert r["analysis_status"] == "pending"
    assert [c.__name__ for c in tareas] == ["_analyze_and_update", "_run_yolo_for_inspection", "_delayed_fraud"]
    await tareas[0]
    for c in tareas[1:]:
        c.close()
    assert llamadas == [4]                         # las cuatro de carrocería, no el cuentakilómetros
    assert base["inspections"].docs[0]["analysis_status"] == "gemini_failed"


def test_sin_ia_no_es_error_ni_pendiente_para_nadie():
    """Los que reintentan o cuentan fallos miran estados concretos: «sin_ia» no está en ninguno."""
    recuperacion = inspect.getsource(server.start_analysis_recovery)
    assert '"error", "gemini_failed", "gemini_timeout"' in recuperacion and "sin_ia" not in recuperacion
    assert '"analysis_status": "ok"' in inspect.getsource(server.autorrevisar_inspecciones)


@pytest.mark.asyncio(loop_scope="session")
async def test_reencolar_fallidas_y_la_atencion_no_cuentan_sin_ia(base):
    ahora = server.datetime.now(server.timezone.utc).isoformat()
    base["inspections"].docs += [
        {"id": f"i-{s}", "vehicle_id": "v1", "photos": ["x"], "analysis_status": s, "created_at": ahora,
         "reviewed": True}
        for s in ("ok", "sin_ia", "plan_disabled", "gemini_failed", "error")]
    r = await server.reanalyze_all_failed(_=ADMIN_VIEJA)
    assert sorted(r["inspection_ids"]) == ["i-error", "i-gemini_failed", "i-plan_disabled"]
    a = await server.stats_attention(_=ADMIN_VIEJA)
    assert a["failed_analyses"] == 2


# ── Validar la foto, el cuentakilómetros, reanalizar, la subida masiva ────────

@pytest.mark.asyncio(loop_scope="session")
async def test_validar_la_foto_sin_ia_la_acepta_sin_preguntar(base):
    r = await server.validate_inspection_photo(vehicle_id="v1", expected_zone="frontal",
                                               file=NoLeer("frontal.jpg"), user=ADMIN_NUEVA)
    assert r == {"valid": True, "checked": False}


@pytest.mark.asyncio(loop_scope="session")
async def test_el_cuentakilometros_sin_ia_lo_teclea_el_conductor(base, monkeypatch):
    monkeypatch.setattr(server, "_odo_leer_foto", revienta("el lector del cuentakilómetros"))
    r = await server.read_odometer_photo("v1", file=Fichero("odometro.jpg", _jpeg()), user=ADMIN_NUEVA)
    assert r["aceptada"] is False and r["km"] is None and r["manual_permitido"] is True
    assert r["servicio_caido"] is True and r["sin_lector"] is True
    assert r["motivo"] == "Escribe los kilómetros que marca el cuadro."
    assert r["current_mileage"] == 48210 and r["manual_min"] == 48210 and r["manual_max"] >= 48210
    # Los errores de antes siguen antes.
    with pytest.raises(HTTPException) as e:
        await server.read_odometer_photo("no-existe", file=Fichero("o.jpg", _jpeg()), user=ADMIN_NUEVA)
    assert e.value.status_code == 404
    with pytest.raises(HTTPException) as e:
        await server.read_odometer_photo("v1", file=Fichero("o.jpg", b""), user=ADMIN_NUEVA)
    assert e.value.status_code == 400


@pytest.mark.asyncio(loop_scope="session")
async def test_el_cuentakilometros_de_siempre_sigue_usando_el_lector(base, monkeypatch):
    llamadas = []

    async def lector(img, *a, **k):
        llamadas.append(len(img))
        return {"lecturas": [], "servicio_caido": False}
    monkeypatch.setattr(server, "_odo_leer_foto", lector)
    r = await server.read_odometer_photo("v1", file=Fichero("odometro.jpg", _jpeg()), user=ADMIN_VIEJA)
    assert len(llamadas) == 1 and "sin_lector" not in r


@pytest.mark.asyncio(loop_scope="session")
async def test_reanalizar_y_subida_masiva_sin_ia_dan_403(base, monkeypatch):
    monkeypatch.setattr(server, "load_reference_images", revienta("la descarga de fotos"))
    for llamada in (lambda u: server.reanalyze_inspection("i-1", False, _=u),
                    lambda u: server.batch_upload_inspections(plates=["x"], files=[], file_plates=[], _=u)):
        with pytest.raises(HTTPException) as e:
            await llamada(ADMIN_NUEVA)
        assert e.value.status_code == 403 and "análisis automático" in e.value.detail
    # La de siempre pasa de largo (y llega al 404 de una inspección que no existe).
    with pytest.raises(HTTPException) as e:
        await server.reanalyze_inspection("i-1", False, _=ADMIN_VIEJA)
    assert e.value.status_code == 404
    # El bucle de recuperación llama sin usuario: como siempre.
    assert await server._ia_danos_de(None) is True


@pytest.mark.asyncio(loop_scope="session")
async def test_la_foto_con_cajas_sin_ia_no_pregunta_a_gemini(base, monkeypatch):
    monkeypatch.setattr(server, "_detectar_cajas_danos", revienta("Gemini (cajas en directo)"))
    import base64
    foto = "data:image/jpeg;base64," + base64.b64encode(_jpeg()).decode()
    base["inspections"].docs.append({"id": "i-1", "vehicle_id": "v1", "photos": [foto], "created_at": "2026-11-12",
                                     "analysis": {"damages": [], "new_damages": []}})
    r = await server.inspection_annotated("i-1", 0, _=ADMIN_NUEVA)
    assert r.status_code == 200


# ── Lo que dicen los planes ───────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_los_planes_no_prometen_la_ia(monkeypatch):
    async def cat(forzar=False):
        return server._catalogo_por_defecto()
    monkeypatch.setattr(server, "_catalogo_planes", cat)
    r = await server.billing_planes()
    textos = [x for p in r["planes"] for x in (p["incluye"] + p["no_incluye"])]
    junto = " · ".join(textos).lower()
    for prohibido in ("detectad", "detecta ", "causa los golpes", "fotos e ia", "por ia", "con ia"):
        assert prohibido not in junto, prohibido
    # La IA solo se nombra diciendo lo que hace, dónde está y que se equivoca.
    con_ia = [x for x in textos if "IA" in x.split()]
    assert con_ia and all("solo en las cuentas con la IA activa" in x and "se equivoca a menudo" in x.lower()
                          for x in con_ia)
    por = {p["clave"]: p for p in r["planes"]}
    assert any("Repaso del día" in x for x in por["operacion"]["incluye"])
    assert any("pericial" in x for x in por["completo"]["incluye"])          # lo que ya comprobaba test_precios
