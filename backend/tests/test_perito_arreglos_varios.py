# -*- coding: utf-8 -*-
"""«Antes del perito», arreglos tras la revisión (14-11-2026): lo que queda.

· «Origen de daños» usa la regla del expediente con lo confirmado por personas: nunca certeza «alta» con nombre
  cuando el expediente diría «sin conductor atribuible».
· Los planes dicen lo que hace la app: el expediente con «quién la llevaba» va en todos; lo de Pro es la pantalla
  «Origen de daños» de toda la flota. Y precios.js dice lo mismo (test_verdad2_textos.py lo compara letra a letra).
· «Reconstruir flota» no archiva lo que confirmó una persona.
· El PDF firmado mete SIEMPRE el golpe que confirmó una persona (antes: «confianza 0%<50%»).
· El expediente: con la revisión anterior borrada, la anterior viva (no «no hay foto anterior»); un golpe de
  «Revisión rápida» sin foto y el mismo marcado en el repaso salen una vez.
· Rendimiento sin cambiar las respuestas: índices, una consulta por furgoneta, lotes pequeños.
"""
import inspect
import re
from pathlib import Path

import pytest

import server
from base_de_mentira import Cursor
from test_perito_repaso import MARTA, insp, marca, marcar, revision, t  # noqa: F401

RAIZ = Path(__file__).resolve().parents[2]
V = "veh-5678"
G = {"pieza_clave": "corredera_izq", "severity": "moderado", "box_2d": [410, 220, 640, 470]}


@pytest.fixture
def sin_reentrenar(monkeypatch):
    async def nada(*a, **k):
        return None
    monkeypatch.setattr(server, "_ia_reentrenar_si_toca", nada)


# ── «Origen de daños» y el expediente dicen lo mismo ─────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_origen_de_danos_no_nombra_a_quien_el_expediente_no(t):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    # Nadie repasó la del 11. El 12 una persona marca un golpe moderado en la corredera.
    await marcar("r12", 3, "golpe", **G)
    e = await server.expediente_antes_del_perito(V, user=MARTA)
    assert e["golpes"][0]["atribucion"]["motivo"] == "anterior_sin_repasar"
    o = await server.danos_atribucion(center="", dias=120, solo_alta=False, _=MARTA)
    (fila,) = o["danos"]
    assert fila["certeza"] != "alta" and "nadie marcó como igual" in fila["motivo"]
    assert o["resumen"]["alta"] == 0


@pytest.mark.asyncio(loop_scope="session")
async def test_origen_de_danos_si_nombra_cuando_el_expediente_tambien(t):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    for pi in (1, 2, 3, 4):
        await marcar("r11", pi, "igual")
    await marcar("r12", 3, "golpe", **G)
    e = await server.expediente_antes_del_perito(V, user=MARTA)
    assert e["golpes"][0]["atribucion"]["atribuible"] is True
    o = await server.danos_atribucion(center="", dias=120, solo_alta=False, _=MARTA)
    (fila,) = o["danos"]
    assert fila["certeza"] == "alta" and [c["id"] for c in fila["conductores"]] == ["drv-ana"]


@pytest.mark.asyncio(loop_scope="session")
async def test_origen_de_danos_con_lo_confirmado_en_revision_rapida_tambien(t, sin_reentrenar):
    dano = {"part": "Puerta lateral corredera izquierda", "severity": "grave", "photo_index": 3,
            "box_2d": [400, 200, 600, 450]}
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)),
                              revision("r12", V, "drv-ana", marca(12), analysis={
                                  "severity": "grave", "total_damages_count": 1, "damages": [dict(dano)],
                                  "new_damages": [dict(dano)]})]
    await server.damage_feedback("r12", {"verdict": "correct", "damage_index": 0, "scope": "new"}, user=MARTA)
    (fila,) = (await server.danos_atribucion(center="", dias=120, solo_alta=False, _=MARTA))["danos"]
    assert fila["confirmado"] is True and fila["certeza"] != "alta"        # la foto de ayer, sin marcar igual
    for pi in (1, 2, 3, 4):
        await marcar("r11", pi, "igual")
    (fila,) = (await server.danos_atribucion(center="", dias=120, solo_alta=False, _=MARTA))["danos"]
    assert fila["certeza"] == "alta"


# ── Los planes ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_los_planes_no_dicen_que_esencial_no_sabe_quien_la_llevaba(monkeypatch):
    async def cat(forzar=False):
        return server._catalogo_por_defecto()
    monkeypatch.setattr(server, "_catalogo_planes", cat)
    planes = {p["clave"]: p for p in (await server.billing_planes())["planes"]}
    for clave in ("operacion", "reparto"):
        assert not any("quién llevaba" in x.lower() for x in planes[clave]["no_incluye"]), clave
        assert any("Origen de daños" in x for x in planes[clave]["no_incluye"]), clave
    assert any("cuando es seguro, quién la llevaba" in x for x in planes["operacion"]["incluye"])
    assert any(x.startswith("Origen de daños") for x in planes["completo"]["incluye"])
    # Lo que es de Pro en la app es la pantalla, no el expediente.
    assert "origen-danos" in server._MODULOS_SOLO_PRO and "vehiculos" not in server._MODULOS_SOLO_PRO
    js = (RAIZ / "frontend" / "src" / "lib" / "precios.js").read_text("utf-8")
    assert "Quién llevaba la furgoneta" not in js


# ── «Reconstruir flota» ──────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_reconstruir_flota_no_archiva_lo_que_confirmo_una_persona(t, monkeypatch):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    for pi in (1, 2, 4):
        await marcar("r12", pi, "igual")
    await marcar("r12", 3, "golpe", **G)
    assert insp(t, "r12")["reviewed"] is True
    t["vehicle_damage_ledger"].docs.append({"vehicle_id": V, "panel": "capo", "status": "open", "source": "ai",
                                            "part": "Capó", "severity": "leve", "rank": 1})
    t["inspections"].aggregate = lambda pipeline: Cursor([{"_id": V, "insp_id": "r12"}])
    r = await server.rebuild_fleet_damages(_=MARTA)
    assert r["archived_ledger_entries"] == 1
    por_panel = {e["panel"]: e["status"] for e in t["vehicle_damage_ledger"].docs}
    assert por_panel == {"puerta": "open", "capo": "archived"}
    # Vuelve a «Revisión rápida» para que alguien valide el análisis nuevo; deshacer un lado después no le pone
    # el `reviewed` de antes de la reconstrucción.
    d = insp(t, "r12")
    assert d["reviewed"] is False and d["repaso"]["completo"] is True and d["repaso"]["marco_revisada"] is False
    await server.repaso_deshacer_lado("r12", "1", user=MARTA)
    assert insp(t, "r12")["reviewed"] is False
    exp = await server.expediente_antes_del_perito(V, user=MARTA)
    assert exp["golpes"][0]["reparacion"]["estado"] == "abierto"


# ── El PDF firmado ────────────────────────────────────────────────────────────

def test_el_filtro_del_pdf_mete_siempre_lo_que_confirmo_una_persona():
    del_repaso = {"part": "Puerta lateral corredera izquierda", "severity": "moderado", "box_2d": [410, 220, 640, 470],
                  "origen": "repaso", "golpe_id": "g1"}
    confirmado = {"part": "Retrovisor derecho", "severity": "leve", "confidence": 0.2, "box_2d": [0, 0, 1, 1],
                  "_confirmado_por": "Luis P."}
    floja = {"part": "Paragolpes trasero", "severity": "leve", "confidence": 0.3, "box_2d": [100, 100, 300, 300]}
    incluidos, sugeridos = server._filter_damages_for_peritaje([del_repaso, confirmado, floja])
    assert incluidos == [del_repaso, confirmado] and sugeridos == [floja]


@pytest.mark.asyncio(loop_scope="session")
async def test_el_pdf_firmado_lleva_el_golpe_del_repaso_y_el_confirmado_en_revision_rapida(t, monkeypatch,
                                                                                          sin_reentrenar):
    ia = {"part": "Retrovisor derecho", "severity": "leve", "confidence": 0.31, "photo_index": 4,
          "box_2d": [300, 640, 420, 780]}
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)),
                              revision("r12", V, "drv-ana", marca(12), forensic_signed=True, analysis={
                                  "severity": "leve", "total_damages_count": 1, "damages": [dict(ia)],
                                  "new_damages": [dict(ia)]})]
    t["forensic_signatures"].docs.append({"inspection_id": "r12", "content_hash": "ab" * 32,
                                          "signed_at": "2026-11-12T10:00:00+00:00"})
    await marcar("r12", 3, "golpe", **G)
    await server.damage_feedback("r12", {"verdict": "correct", "damage_index": 0, "scope": "new"}, user=MARTA)
    visto = {}

    async def sin_foto(*a, **k):
        return None

    async def nada_de_yolo(_iid, _i, dets):
        return []                                    # la IA de cajas no confirma nada: lo de personas va igual

    def pdf(*args):
        visto["incluidos"], visto["sugeridos"] = args[-2], args[-1]
        return b"%PDF-1.4"
    monkeypatch.setattr(server, "_fetch_photo_bytes", sin_foto)
    monkeypatch.setattr(server, "_refine_damage_boxes_with_yolo_sam", nada_de_yolo)
    monkeypatch.setattr(server, "_build_forensic_pdf", pdf)
    await server.forensic_pdf("r12", _=MARTA)
    assert sorted(d["part"] for d in visto["incluidos"]) == ["Puerta lateral corredera izquierda",
                                                           "Retrovisor derecho"]
    assert visto["sugeridos"] == []


def test_el_pdf_dice_que_lo_confirmo_una_persona():
    from test_demo_fotos import _bytes_jpeg, _frases_del_pdf
    sig = {"signed_by_name": "Ana", "signed_at": "2026-11-14T11:00:00", "content_hash": "ab" * 32,
           "prev_hash": "0" * 64, "revision": 1, "signature_text": "Firmado."}
    golpe = {"part": "Puerta lateral corredera izquierda", "severity": "moderado", "photo_index": 1,
             "box_2d": [100, 100, 300, 300], "origen": "repaso", "golpe_id": "g1"}
    cuerpo = server._build_forensic_pdf(
        {"id": "r12", "vehicle_id": V, "created_at": "2026-11-12T07:00:00", "photos": ["https://x/a.jpg"],
         "analysis": {"severity": "sin_danos"}}, sig, {"license_plate": "5678 KLM"}, "Ana L.", [_bytes_jpeg()],
        "https://ejemplo.test/verify/x", [golpe], [])
    frases = _frases_del_pdf(cuerpo)
    assert "Una persona" in frases and "los confirmó una persona" in frases
    assert "confianza 0%" not in frases


# ── El expediente ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_con_la_anterior_borrada_el_expediente_usa_la_anterior_viva(t):
    t["inspections"].docs += [revision("r10", V, "drv-ana", marca(10)), revision("r11", V, "drv-ana", marca(11)),
                              revision("r12", V, "drv-ana", marca(12))]
    for pi in (1, 2, 3, 4):
        await marcar("r10", pi, "igual")
        await marcar("r11", pi, "igual")
    await marcar("r12", 3, "golpe", **G)
    insp(t, "r11")["deleted"] = True
    (g,) = (await server.expediente_antes_del_perito(V, user=MARTA))["golpes"]
    # La misma que enseña el repaso del día: la del 10 (no «no hay foto anterior», que era falso).
    assert g["anterior"]["inspection_id"] == "r10" and g["atribucion"]["motivo"] == "varios_dias"
    dia = await server.repaso_del_dia(fecha="2026-11-12", center=None, user=MARTA)
    assert dia["revisiones"][0]["lados"][2]["anterior"]["inspection_id"] == "r10"


@pytest.mark.asyncio(loop_scope="session")
async def test_un_golpe_de_revision_rapida_sin_foto_no_sale_dos_veces(t):
    sin_foto = {"part": "Puerta corredera", "severity": "moderado", "photo_index": None}
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)),
                              revision("r12", V, "drv-ana", marca(12), analysis={
                                  "severity": "moderado", "total_damages_count": 1, "damages": [dict(sin_foto)],
                                  "new_damages": [dict(sin_foto)]})]
    await marcar("r12", 3, "golpe", **G)
    t["ai_feedback"].docs.append({"id": "fb1", "inspection_id": "r12", "vehicle_id": V, "scope": "new",
                                  "damage_index": 0, "damage": dict(sin_foto), "verdict": "correct",
                                  "reviewed_by": "Luis P.", "created_at": "2026-11-12T09:00:00+00:00"})
    exp = await server.expediente_antes_del_perito(V, user=MARTA)
    assert [g["origen"] for g in exp["golpes"]] == ["repaso"] and exp["cuentas"]["golpes"] == 1


# ── Rendimiento (sin cambiar las respuestas) ─────────────────────────────────

def test_los_indices_de_la_foto_anterior_y_de_revision_rapida():
    fuente = inspect.getsource(server._ensure_tenant_indexes)
    assert 'await _idx(tdb.inspections, [("vehicle_id", 1), ("created_at", -1)])' in fuente
    assert 'await _idx(tdb.ai_feedback, [("vehicle_id", 1), ("verdict", 1)])' in fuente
    assert ".batch_size(" in inspect.getsource(server._repaso_anteriores_de)


@pytest.mark.asyncio(loop_scope="session")
async def test_el_dia_busca_las_anteriores_con_una_consulta_por_furgoneta(t, monkeypatch):
    for k in range(1, 12):
        t["inspections"].docs.append(revision(f"v5678-{k}", V, "drv-ana", marca(k)))
    # Tres revisiones el mismo día de la misma furgoneta (mañana, mediodía y tarde) y una de otra.
    t["inspections"].docs += [revision("hoy-a", V, "drv-ana", marca(12, "06:00:00")),
                              revision("hoy-b", V, "drv-luis", marca(12, "11:00:00")),
                              revision("hoy-c", V, "drv-ana", marca(12, "17:00:00")),
                              revision("otra-1", "veh-9012", "drv-luis", marca(11)),
                              revision("otra-hoy", "veh-9012", "drv-luis", marca(12))]
    consultas = []
    original = t["inspections"].find

    def find(q=None, proyeccion=None, **k):
        consultas.append(q)
        return original(q, proyeccion, **k)
    monkeypatch.setattr(t["inspections"], "find", find)
    dia = await server.repaso_del_dia(fecha="2026-11-12", center=None, user=MARTA)
    anteriores = [q for q in consultas if "vehicle_id" in q and "$lt" in (q.get("created_at") or {})]
    assert len(anteriores) == 2                           # una por furgoneta, no una por revisión
    ant = {r["id"]: r["lados"][0]["anterior"]["inspection_id"] for r in dia["revisiones"]}
    # Cada una con SU anterior: la del mismo día cuenta como anterior de la siguiente.
    assert ant == {"hoy-a": "v5678-11", "hoy-b": "hoy-a", "hoy-c": "hoy-b", "otra-hoy": "otra-1"}


def test_el_expediente_no_trae_los_analisis_enteros():
    fuente = inspect.getsource(server.expediente_antes_del_perito)
    assert '"analysis.damages": 1' not in fuente and '"analysis.damages.golpe_id": 1' in fuente
    assert re.search(r"vehicle_damage_ledger\.find\(\s*\{\"vehicle_id\": vehicle_id\},\s*\{\"_id\": 0", fuente)
