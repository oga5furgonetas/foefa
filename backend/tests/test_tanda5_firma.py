# -*- coding: utf-8 -*-
"""Lo firmado no cambia NUNCA (14-11-2026, tercera revisión, servidor3 IMPORTANTE 1).

Al firmar se guarda con la firma la lista exacta de lo que se firma (`contenido`: cada daño con pieza, gravedad,
descripción, foto, caja, origen y quién lo confirmó, y la gravedad de la cabecera), entra en el código de la firma, y
el PDF construye «lo firmado» desde ESA lista. Lo que se quita o se cambia después va en «Quitado o cambiado después
de la firma» (qué, cuándo y quién); lo añadido, en «Añadido después de la firma». Deshacer un golpe o cambiar un
veredicto de una revisión firmada sigue permitido. Las firmas de antes (sin lista) se siguen construyendo de la ficha
y el PDF lo dice. /verify comprueba la lista de las firmas nuevas; las de antes, igual que siempre.

Antes de este cambio, las dos primeras fallaban: el golpe deshecho y el retrovisor con «no es un daño» salían de lo
firmado con la misma firma y el mismo código."""
import hashlib
import json

import pytest
from starlette.requests import Request

import server
from base_de_mentira import Db
from test_perito_repaso import MARTA, insp, marca, marcar, deshacer, revision, t  # noqa: F401

V = "veh-5678"
G1 = {"pieza_clave": "corredera_izq", "severity": "grave", "box_2d": [410, 220, 640, 470]}
FIRMANTE = {**MARTA, "account_type": "owner"}         # el plan no lleva la firma en la base de mentira: dueño


class _Cliente(dict):
    """`client[db_name]` de Motor: cualquier base es la de la prueba."""
    def __init__(self, base):
        super().__init__()
        self.base = base

    def __getitem__(self, _nombre):
        return self.base


@pytest.fixture
def pdf(monkeypatch, t):
    visto = {}

    async def sin_foto(*a, **k):
        return None

    async def nada_de_yolo(_iid, _i, dets):
        return []

    async def nada(*a, **k):
        return None

    def construir(insp_, sig, veh, cond, fotos, url, incluidos, sugeridos, anadidos=None):
        visto.clear()
        visto.update(incluidos=[d.get("part") for d in incluidos], sugeridos=[d.get("part") for d in sugeridos],
                     anadidos=[(a.get("que"), a.get("part"), a.get("por")) for a in (anadidos or [])],
                     quitados=[(a.get("que"), a.get("part"), a.get("por"), bool(a.get("at")))
                               for a in (sig.get("_quitados") or [])],
                     reconstruida=sig.get("_reconstruida"),
                     cabecera=(insp_.get("analysis") or {}).get("severity"))
        return b"%PDF-1.4"
    monkeypatch.setattr(server, "_fetch_photo_bytes", sin_foto)
    monkeypatch.setattr(server, "_refine_damage_boxes_with_yolo_sam", nada_de_yolo)
    monkeypatch.setattr(server, "_build_forensic_pdf", construir)
    monkeypatch.setattr(server, "_ia_reentrenar_si_toca", nada)
    monkeypatch.setattr(server, "_rl_public_action", lambda *a, **k: None)
    g = Db()
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "client", _Cliente(t))
    return visto


def _peticion():
    return Request({"type": "http", "method": "POST", "path": "/", "headers": [(b"user-agent", b"pruebas")],
                    "client": ("203.0.113.9", 1234), "query_string": b""})


async def firmar(rid):
    return await server.sign_inspection(rid, server.SignInspectionRequest(signature_text="Conforme"), _peticion(),
                                        user=FIRMANTE)


def _sig(t, rid):
    return next(s for s in t["forensic_signatures"].docs if s["inspection_id"] == rid)


@pytest.mark.asyncio(loop_scope="session")
async def test_deshacer_un_golpe_despues_de_firmar_no_lo_quita_de_lo_firmado(t, pdf):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    for pi in (1, 2, 3, 4):
        await marcar("r11", pi, "igual")
    await marcar("r12", 3, "golpe", **G1)
    await firmar("r12")
    await server.forensic_pdf("r12", _=MARTA)
    antes = dict(pdf)
    assert antes["incluidos"] == ["Puerta lateral corredera izquierda"] and antes["cabecera"] == "grave"
    assert antes["quitados"] == [] and antes["reconstruida"] is False
    # Deshacer sigue permitido (no es un 409): lo firmado ya no depende de la ficha.
    r = await deshacer("r12", 3)
    assert r["ok"] is True
    await server.forensic_pdf("r12", _=MARTA)
    assert pdf["incluidos"] == antes["incluidos"] and pdf["cabecera"] == "grave", pdf
    assert pdf["quitados"] == [("Golpe deshecho en el repaso", "Puerta lateral corredera izquierda", "Marta R.", True)]
    assert pdf["anadidos"] == []


@pytest.mark.asyncio(loop_scope="session")
async def test_revision_rapida_cambia_de_opinion_despues_de_firmar_y_lo_firmado_no_cambia(t, pdf):
    ia = {"part": "Retrovisor derecho", "severity": "leve", "confidence": 0.31, "photo_index": 4,
          "box_2d": [300, 640, 420, 780]}
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)),
                              revision("r12", V, "drv-ana", marca(12), analysis={
                                  "severity": "leve", "total_damages_count": 1, "damages": [dict(ia)],
                                  "new_damages": [dict(ia)]})]
    await server.damage_feedback("r12", {"verdict": "correct", "damage_index": 0, "scope": "new"}, user=MARTA)
    await firmar("r12")
    await server.forensic_pdf("r12", _=MARTA)
    antes = dict(pdf)
    assert antes["incluidos"] == ["Retrovisor derecho"]
    await server.damage_feedback("r12", {"verdict": "wrong", "damage_index": 0, "scope": "new"}, user=MARTA)
    await server.forensic_pdf("r12", _=MARTA)
    assert pdf["incluidos"] == antes["incluidos"], pdf
    assert pdf["quitados"] == [("Confirmación retirada en Revisión rápida («no es un daño»)", "Retrovisor derecho",
                                "Marta R.", True)]


@pytest.mark.asyncio(loop_scope="session")
async def test_lo_marcado_despues_de_firmar_va_aparte_y_no_entra_en_lo_firmado(t, pdf):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    for pi in (1, 2, 3, 4):
        await marcar("r11", pi, "igual")
    await firmar("r12")
    await marcar("r12", 3, "golpe", **G1)
    await server.forensic_pdf("r12", _=MARTA)
    assert pdf["incluidos"] == [] and pdf["cabecera"] is None
    assert pdf["anadidos"] == [("Golpe marcado en el repaso", "Puerta lateral corredera izquierda", "Marta R.")]


@pytest.mark.asyncio(loop_scope="session")
async def test_la_lista_entra_en_el_codigo_y_verify_la_comprueba(t, pdf):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    for pi in (1, 2, 3, 4):
        await marcar("r11", pi, "igual")
    await marcar("r12", 3, "golpe", **G1, description="Bollo con pintura saltada")
    r = await firmar("r12")
    s = _sig(t, "r12")
    c = s["contenido"]
    assert c["gravedad"] == "grave" and len(c["danos"]) == 1
    d = c["danos"][0]
    assert {k: d[k] for k in ("part", "severity", "description", "photo_index", "box_2d", "origen",
                              "confirmado_por")} == {
        "part": "Puerta lateral corredera izquierda", "severity": "grave", "description": "Bollo con pintura saltada",
        "photo_index": 3, "box_2d": [410, 220, 640, 470], "origen": "repaso", "confirmado_por": "Marta R."}
    # El código es el SHA-256 de lo guardado, y la lista va DENTRO.
    assert hashlib.sha256(s["payload_canonical"].encode("utf-8")).hexdigest() == s["content_hash"] == r["hash"]
    assert json.loads(s["payload_canonical"])["contenido_firmado"] == c
    v = await server.verify_hash_public(r["hash"], _peticion())
    assert v["valid"] is True and v["contenido_comprobado"] is True
    # Si alguien toca la lista guardada, /verify y el PDF lo dicen.
    s["contenido"]["danos"][0]["severity"] = "leve"
    v = await server.verify_hash_public(r["hash"], _peticion())
    assert v["valid"] is False and "no cuadra" in v["error"]
    with pytest.raises(server.HTTPException) as e:
        await server.forensic_pdf("r12", _=MARTA)
    assert e.value.status_code == 500


@pytest.mark.asyncio(loop_scope="session")
async def test_en_una_firma_de_antes_lo_marcado_y_deshecho_despues_no_sale_como_quitado(t, pdf):
    """Firma de antes (sin lista). Un golpe marcado DESPUÉS de firmar y luego deshecho nunca estuvo en lo firmado: no
    sale en «Quitado o cambiado después de la firma» (lo encontró quien verificó la tanda)."""
    from datetime import datetime, timedelta, timezone
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    for pi in (1, 2, 3, 4):
        await marcar("r11", pi, "igual")
    cuando = (datetime.now(timezone.utc) - timedelta(seconds=2)).isoformat()   # la firma, dos segundos antes
    insp(t, "r12").update(forensic_signed=True, forensic_signed_at=cuando)
    t["forensic_signatures"].docs.append({"inspection_id": "r12", "content_hash": "cd" * 32, "signed_at": cuando,
                                          "prev_hash": "0" * 64, "signed_by_name": "Marta R."})
    await marcar("r12", 3, "golpe", **G1)
    await deshacer("r12", 3)
    await server.forensic_pdf("r12", _=MARTA)
    assert pdf["quitados"] == []


@pytest.mark.asyncio(loop_scope="session")
async def test_una_firma_de_antes_se_sigue_construyendo_de_la_ficha_y_lo_dice(t, pdf):
    """Firma anterior a este cambio: sin `contenido`. Lo firmado sale de la ficha como hasta ahora (deshacer lo
    quita), con la línea «Firma anterior al 14-11-2026…», y el golpe deshecho sale en «Quitado…»."""
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    for pi in (1, 2, 3, 4):
        await marcar("r11", pi, "igual")
    await marcar("r12", 3, "golpe", **G1)
    from datetime import datetime, timezone
    cuando = datetime.now(timezone.utc).isoformat()
    insp(t, "r12").update(forensic_signed=True, forensic_signed_at=cuando)
    t["forensic_signatures"].docs.append({"inspection_id": "r12", "content_hash": "ab" * 32, "signed_at": cuando,
                                          "prev_hash": "0" * 64, "signed_by_name": "Marta R."})
    await server.global_db.forensic_index.insert_one({"content_hash": "ab" * 32, "db_name": "x", "inspection_id": "r12"})
    await server.forensic_pdf("r12", _=MARTA)
    assert pdf["reconstruida"] is True and pdf["incluidos"] == ["Puerta lateral corredera izquierda"]
    await deshacer("r12", 3)
    await server.forensic_pdf("r12", _=MARTA)
    assert pdf["incluidos"] == [] and pdf["reconstruida"] is True
    assert pdf["quitados"] == [("Golpe deshecho en el repaso", "Puerta lateral corredera izquierda", "Marta R.", True)]
    # /verify de una firma de antes: la respuesta de siempre (sin `contenido_comprobado`).
    v = await server.verify_hash_public("ab" * 32, _peticion())
    assert v["valid"] is True and "contenido_comprobado" not in v
    assert v["disclaimer"].startswith("Esto solo dice que el código está en el registro")


def test_sin_lista_el_codigo_de_la_firma_es_el_de_siempre():
    """Las firmas de antes: el payload sin `contenido` es EXACTAMENTE el de antes (mismas claves, mismo orden)."""
    i = {"id": "r1", "vehicle_id": "v1", "driver_id": "d1", "created_at": "2026-11-10T07:00:00+00:00",
         "photos": ["/a.jpg"], "plate_text": "5678KLM",
         "analysis": {"severity": "leve", "total_damages_count": 1, "executive_summary": "x"}}
    viejo = json.dumps({"prev_hash": "0" * 64, "inspection_id": "r1", "vehicle_id": "v1", "driver_id": "d1",
                        "created_at": "2026-11-10T07:00:00+00:00", "photos": ["/a.jpg"], "plate_text": "5678KLM",
                        "analysis_summary": {"severity": "leve", "total_damages_count": 1, "executive_summary": "x"}},
                       sort_keys=True, ensure_ascii=False, default=str)
    assert server._canonical_inspection_payload(i, "0" * 64) == viejo
    assert "contenido_firmado" in server._canonical_inspection_payload(i, "0" * 64, {"version": 1, "danos": []})


def test_el_pdf_de_verdad_se_construye_con_lo_quitado_y_la_nota():
    """El PDF de verdad (reportlab) con el bloque nuevo y la línea de las firmas de antes."""
    pytest.importorskip("reportlab")
    pytest.importorskip("qrcode")
    sig = {"signed_by_name": "Marta R.", "signed_at": "2026-11-14T08:00:00+00:00", "content_hash": "ab" * 32,
           "prev_hash": "0" * 64, "_reconstruida": True,
           "_quitados": [{"part": "Puerta lateral corredera izquierda", "severity": "grave",
                          "que": "Golpe deshecho en el repaso", "at": "2026-11-14T09:00:00+00:00", "por": "Marta R.",
                          "cuando": "2026-11-14 10:00"}]}
    b = server._build_forensic_pdf({"id": "r12", "analysis": {"severity": "grave"}}, sig, {"license_plate": "5678 KLM"},
                                   "Ana L.", [], "https://ejemplo.test/verify/x",
                                   [{"part": "Puerta lateral corredera izquierda", "severity": "grave",
                                     "origen": "repaso", "photo_index": 3}], [], anadidos=[])
    assert b.startswith(b"%PDF")
