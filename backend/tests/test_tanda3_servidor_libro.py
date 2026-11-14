# -*- coding: utf-8 -*-
"""«Antes del perito», tercera tanda (14-11-2026): el libro de daños, el taller y lo firmado (S2-S5, S12-S14).

Las pruebas de la segunda revisión (servidor2, `test_s2_libro.py`), dadas la vuelta: antes demostraban el fallo,
ahora fijan el arreglo.

· S2  El taller (`update_damage`) escribe con condición: no borra un golpe que se marca a la vez.
· S3  Una entrada de «Revisión rápida» con golpes enlazados se cierra cuando todo lo suyo está reparado, en los dos
      órdenes; cerrar por «reparar pieza» o por la entrega de una orden de taller deja reparados los golpes
      enlazados; dos «deshacer» a la vez no dejan ids muertos; un deshacer que no puede escribir no deja un golpe sin
      lado (409 y todo como estaba).
· S4  «Reconstruir flota» no resucita lo archivado al deshacer después un golpe, y no se puede en una cuenta sin IA.
· S5  El PDF de una revisión firmada lleva lo que había al firmar; lo confirmado después va aparte.
· S12 El índice único del libro se pide antes de la primera escritura de cada base.
· S13 La escritura del análisis que agota sus intentos no pierde el golpe que se cuela.
· S14 La gravedad y el número de daños «con el repaso» llegan a las respuestas y a las cuentas del servidor.

Con la base de mentira (base_de_mentira.py), sin MongoDB. Matrículas y nombres inventados.
"""
import asyncio
import copy

import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Cursor
from test_perito_repaso import MARTA, HOY, insp, marca, marcar, deshacer, revision, t, mundo_base  # noqa: F401

V = "veh-5678"
LUIS = {"sub": "u-luis", "role": "admin", "name": "Luis P."}
PEPA = {"sub": "u-pepa", "role": "admin", "name": "Pepa G."}
G1 = {"pieza_clave": "corredera_izq", "severity": "moderado", "box_2d": [410, 220, 640, 470]}   # lado 3
G2 = {"pieza_clave": "puerta_del_der", "severity": "leve", "box_2d": [300, 100, 500, 300]}      # lado 4
G3 = {"pieza_clave": "puerta_tras_der", "severity": "grave", "box_2d": [100, 100, 300, 300]}    # lado 2
RR_PUERTA = {"part": "Puerta trasera derecha", "severity": "leve", "description": "x", "photo_index": 2,
             "box_2d": [1, 1, 500, 500]}


@pytest.fixture
def quieto(monkeypatch):
    async def nada(*a, **k):
        return None
    monkeypatch.setattr(server, "_ia_reentrenar_si_toca", nada)


def abiertas(base, panel="puerta"):
    return [e for e in base["vehicle_damage_ledger"].docs if e.get("panel") == panel and e.get("status") == "open"]


async def tres_golpes(base):
    base["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12)),
                                 revision("r13", V, "drv-luis", marca(13)), revision("r14", V, "drv-rosa", marca(14))]
    for pi in (1, 2, 3, 4):
        await marcar("r11", pi, "igual")
    a = await marcar("r12", 3, "golpe", user=MARTA, **G1)
    b = await marcar("r13", 4, "golpe", user=LUIS, **G2)
    c = await marcar("r14", 2, "golpe", user=PEPA, **G3)
    return {"r12": (3, a["lado"]["golpe"]["golpe_id"]), "r13": (4, b["lado"]["golpe"]["golpe_id"]),
            "r14": (2, c["lado"]["golpe"]["golpe_id"])}


def _indice_golpe(base, rid, gid):
    return next(k for k, d in enumerate(insp(base, rid)["analysis"]["damages"]) if d.get("golpe_id") == gid)


async def _rr_confirma_la_puerta_y_el_repaso_enlaza_otra(base):
    """«Revisión rápida» confirma ANTES la puerta trasera derecha (r12: entrada humana sin dueño del repaso) y el
    repaso marca otra puerta en r13, que se enlaza a esa entrada."""
    base["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12)),
                                 revision("r13", V, "drv-luis", marca(13))]
    insp(base, "r12")["analysis"] = {"severity": "leve", "total_damages_count": 1, "damages": [dict(RR_PUERTA)],
                                     "new_damages": [dict(RR_PUERTA)]}
    await server.damage_feedback("r12", {"verdict": "correct", "damage_index": 0, "scope": "new"}, user=MARTA)
    (e,) = abiertas(base)
    assert e["source"] == "human" and not e.get("golpe_id")
    for pi in (1, 2, 3, 4):
        await marcar("r11", pi, "igual")
    b = await marcar("r13", 3, "golpe", **G1)
    assert b["libro"]["accion"] == "ya_apuntado"
    return b["lado"]["golpe"]["golpe_id"]


# ── S3: la entrada de «Revisión rápida» con golpes enlazados se cierra ────────

@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("primero", ["revision_rapida", "golpe"])
async def test_reparados_los_dos_la_entrada_se_cierra_en_cualquier_orden(t, quieto, primero):
    gid = await _rr_confirma_la_puerta_y_el_repaso_enlaza_otra(t)
    reparar = {"revision_rapida": lambda: server.update_damage("r12", 0, {"repair_status": "done"}, _=MARTA),
               "golpe": lambda: server.update_damage("r13", _indice_golpe(t, "r13", gid), {"repair_status": "done"},
                                                     _=MARTA)}
    otro = "golpe" if primero == "revision_rapida" else "revision_rapida"
    await reparar[primero]()
    assert len(abiertas(t)) == 1, "con uno de los dos sin reparar, la entrada sigue abierta"
    await reparar[otro]()
    assert abiertas(t) == [], "las dos puertas reparadas y la entrada del libro seguía abierta"
    (e,) = [x for x in t["vehicle_damage_ledger"].docs if x.get("panel") == "puerta"]
    assert e["status"] == "repaired" and e.get("repaired_at")


@pytest.mark.asyncio(loop_scope="session")
async def test_reparada_la_de_revision_rapida_y_deshecho_el_enlazado_tambien_se_cierra(t, quieto):
    gid = await _rr_confirma_la_puerta_y_el_repaso_enlaza_otra(t)
    await server.update_damage("r12", 0, {"repair_status": "done"}, _=MARTA)
    assert len(abiertas(t)) == 1
    r = await deshacer("r13", 3)
    assert r["libro"]["accion"] == "sin_cambios"
    assert abiertas(t) == [], "lo suyo reparado y el enlazado deshecho: no queda nada abierto en esa pieza"


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_reparar_lo_suyo_deshacer_el_enlazado_no_cierra_nada(t, quieto):
    await _rr_confirma_la_puerta_y_el_repaso_enlaza_otra(t)
    await deshacer("r13", 3)
    (e,) = abiertas(t)
    assert e.get("golpe_ids") == [] and not e.get("dano_propio_reparado_at")


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("como", ["reparar_pieza", "orden_entregada"])
async def test_cerrar_la_entrada_desde_fuera_deja_reparados_sus_golpes(t, como):
    g = await tres_golpes(t)
    (e,) = abiertas(t)
    assert set(e["golpe_ids"]) == {gid for _pi, gid in g.values()}
    if como == "reparar_pieza":
        await server.vehicle_ledger_repair(V, {"panel": "puerta"}, user=MARTA)
    else:
        e["_id"] = "ent-1"
        assert await server._ot_cerrar_danos(["ent-1"], "entregado", numero=7) == 1
    assert abiertas(t) == []
    for rid, (pi, gid) in g.items():
        dano = insp(t, rid)["analysis"]["damages"][_indice_golpe(t, rid, gid)]
        assert dano["repair_status"] == "done" and dano.get("completed_at"), (rid, dano)
    exp = await server.expediente_antes_del_perito(V, user=MARTA)
    assert {x["reparacion"]["estado"] for x in exp["golpes"]} == {"reparado"}
    # Y ya no se pueden deshacer desde el repaso (están reparados): nada se queda a medias.
    with pytest.raises(HTTPException) as err:
        await deshacer("r13", 4)
    assert err.value.status_code == 409


@pytest.mark.asyncio(loop_scope="session")
async def test_anular_una_orden_no_toca_los_golpes(t):
    g = await tres_golpes(t)
    (e,) = abiertas(t)
    e["_id"] = "ent-1"
    await server._ot_cerrar_danos(["ent-1"], "anulado")
    for rid, (pi, gid) in g.items():
        assert insp(t, rid)["analysis"]["damages"][_indice_golpe(t, rid, gid)].get("repair_status") in (None, "pending")


# ── S3: dos «deshacer» a la vez ───────────────────────────────────────────────

class ColLenta(Col):
    """Cede el turno en cada lectura y escritura, como Mongo: así se cruzan dos peticiones."""
    async def find_one(self, *a, **k):
        r = copy.deepcopy(await super().find_one(*a, **k))
        await asyncio.sleep(0)
        return r

    async def update_one(self, *a, **k):
        await asyncio.sleep(0)
        return await super().update_one(*a, **k)


def _mundo_lento(monkeypatch, colecciones):
    base = mundo_base()
    for k in colecciones:
        base[k] = ColLenta([])
    monkeypatch.setattr(server, "db", base)
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)

    async def _sin_empresa(_o):
        return None
    monkeypatch.setattr(server, "get_org", _sin_empresa)
    return base


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("pareja", [("r12", "r13"), ("r13", "r12"), ("r12", "r14"), ("r13", "r14")])
async def test_deshacer_dos_a_la_vez_no_deja_fantasma(monkeypatch, pareja):
    base = _mundo_lento(monkeypatch, ("inspections", "vehicle_damage_ledger"))
    g = await tres_golpes(base)
    x, y = pareja
    res = await asyncio.gather(deshacer(x, g[x][0]), deshacer(y, g[y][0]), return_exceptions=True)
    assert not [r for r in res if isinstance(r, Exception)], res
    vivos = {g[r][1] for r in ("r12", "r13", "r14") if r not in pareja}
    (e,) = abiertas(base)
    assert e["golpe_id"] in vivos, "la entrada se ha quedado con un golpe ya deshecho como dueño"
    assert set(e["golpe_ids"]) == vivos, "la entrada se ha quedado con un golpe ya deshecho dentro"


# ── S3: un deshacer que no puede escribir no deja un golpe sin lado ──────────

@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("donde", ["ficha", "libro"])
async def test_deshacer_que_no_puede_escribir_lo_deja_todo_como_estaba(t, monkeypatch, donde):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    for pi in (1, 2, 3, 4):
        await marcar("r11", pi, "igual")
    a = await marcar("r12", 3, "golpe", **G1)
    gid = a["lado"]["golpe"]["golpe_id"]
    libro_antes = copy.deepcopy(t["vehicle_damage_ledger"].docs)

    async def no_para(*a, **k):
        raise RuntimeError("cambia sin parar")
    if donde == "ficha":
        monkeypatch.setattr(server, "_repaso_cambiar_danos", no_para)
    else:
        monkeypatch.setattr(server, "_repaso_libro_deshacer", no_para)
    with pytest.raises(HTTPException) as e:
        await deshacer("r12", 3)
    assert e.value.status_code == 409 and "Vuelve a intentarlo" in e.value.detail
    r12 = insp(t, "r12")
    assert r12["repaso"]["lados"]["3"]["golpe"]["golpe_id"] == gid, "el lado tiene que volver"
    assert [d for d in r12["analysis"]["damages"] if d.get("golpe_id") == gid], "el golpe tiene que seguir en la ficha"
    assert t["vehicle_damage_ledger"].docs == libro_antes
    monkeypatch.undo()


# ── S2: el taller y el repaso a la vez ────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("espera", list(range(0, 14)))
async def test_taller_y_repaso_a_la_vez_no_pierden_el_golpe(monkeypatch, espera):
    base = _mundo_lento(monkeypatch, ("inspections",))
    ia = {"part": "Paragolpes delantero", "severity": "leve", "description": "roce", "photo_index": 1,
          "box_2d": [1, 1, 100, 100]}
    base["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)),
                                 revision("r12", V, "drv-ana", marca(12), analysis={
                                     "severity": "leve", "total_damages_count": 1, "damages": [dict(ia)],
                                     "new_damages": []})]
    for pi in (1, 2, 3, 4):
        await marcar("r11", pi, "igual")

    async def taller():
        for _ in range(espera):
            await asyncio.sleep(0)
        await server.update_damage("r12", 0, {"workshop_id": "w1"}, _=MARTA)
    await asyncio.gather(marcar("r12", 3, "golpe", **G1), taller())
    r12 = insp(base, "r12")
    ficha = [d for d in r12["analysis"]["damages"] if d.get("origen") == "repaso"]
    assert len(ficha) == 1, "el taller ha pisado la lista de daños y el golpe del repaso ha desaparecido de la ficha"
    assert r12["analysis"]["damages"][0]["workshop_id"] == "w1", "y lo del taller tampoco se pierde"


@pytest.mark.asyncio(loop_scope="session")
async def test_el_taller_sobre_un_golpe_lo_busca_por_su_id(t):
    """Los golpes van al final de la lista: si se deshace uno anterior, el índice de otro cambia. El taller lo
    encuentra por su `golpe_id`, no por la posición que tenía."""
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    for pi in (1, 2, 3, 4):
        await marcar("r11", pi, "igual")
    await marcar("r12", 3, "golpe", **G1)
    b = await marcar("r12", 4, "golpe", **G2)
    gid = b["lado"]["golpe"]["golpe_id"]
    leido = _indice_golpe(t, "r12", gid)

    # El taller abre la ficha (lee el índice) y mientras tanto alguien deshace el otro golpe.
    original = server._repaso_cambiar_danos
    deshecho = {}

    async def entre_medias(iid, cambio):
        if not deshecho:
            deshecho["si"] = True
            await deshacer("r12", 3)
        return await original(iid, cambio)
    server._repaso_cambiar_danos = entre_medias
    try:
        r = await server.update_damage("r12", leido, {"actual_cost": 120}, _=MARTA)
    finally:
        server._repaso_cambiar_danos = original
    assert r["damage"]["golpe_id"] == gid
    (dano,) = [d for d in insp(t, "r12")["analysis"]["damages"] if d.get("golpe_id") == gid]
    assert dano["actual_cost"] == 120


@pytest.mark.asyncio(loop_scope="session")
async def test_el_taller_sobre_un_dano_de_la_ia_que_ya_no_esta_da_409(t, monkeypatch):
    ia = {"part": "Capó", "severity": "leve", "photo_index": 1, "box_2d": [1, 1, 100, 100]}
    t["inspections"].docs.append(revision("r12", V, "drv-ana", marca(12), analysis={
        "severity": "leve", "total_damages_count": 1, "damages": [dict(ia)], "new_damages": []}))
    original = server._repaso_cambiar_danos

    async def reanalisis_entre_medias(iid, cambio):
        insp(t, "r12")["analysis"]["damages"] = [{"part": "Faro izquierdo", "severity": "leve", "photo_index": 1}]
        return await original(iid, cambio)
    monkeypatch.setattr(server, "_repaso_cambiar_danos", reanalisis_entre_medias)
    with pytest.raises(HTTPException) as e:
        await server.update_damage("r12", 0, {"workshop_id": "w1"}, _=MARTA)
    assert e.value.status_code == 409
    assert "workshop_id" not in insp(t, "r12")["analysis"]["damages"][0]


@pytest.mark.asyncio(loop_scope="session")
async def test_el_taller_de_siempre_sigue_igual(t):
    """Control: sin nadie a la vez, lo mismo que antes (coste, total, marcas de tiempo, el libro limpio)."""
    ia = [{"part": "Capó", "severity": "leve", "photo_index": 1}, {"part": "Faro izquierdo", "severity": "leve",
                                                                    "photo_index": 1, "actual_cost": 30}]
    t["inspections"].docs.append(revision("r12", V, "drv-ana", marca(12), analysis={
        "severity": "leve", "total_damages_count": 2, "damages": copy.deepcopy(ia), "new_damages": []}))
    t["vehicle_damage_ledger"].docs.append({"vehicle_id": V, "panel": "capo", "status": "open", "source": "ai"})
    r = await server.update_damage("r12", 0, {"workshop_id": "w1", "actual_cost": "150", "nada": 1}, _=MARTA)
    assert r["total_actual_cost"] == 180.0 and r["damage"]["repair_status"] == "assigned"
    assert r["damage"]["actual_cost"] == 150.0 and "nada" not in r["damage"] and r["damage"]["assigned_at"]
    r = await server.update_damage("r12", 0, {"repair_status": "done"}, _=MARTA)
    assert r["damage"]["completed_at"]
    an = insp(t, "r12")["analysis"]
    assert an["total_actual_cost"] == 180.0 and an["damages"][1] == ia[1]
    assert t["vehicle_damage_ledger"].docs[0]["status"] == "repaired"
    with pytest.raises(HTTPException) as e:
        await server.update_damage("r12", 5, {"workshop_id": "w1"}, _=MARTA)
    assert e.value.status_code == 404


# ── S4: «Reconstruir flota» ───────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_reconstruir_flota_y_deshacer_no_resucita_la_entrada_vieja_de_la_ia(t):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    t["vehicle_damage_ledger"].docs.append({"vehicle_id": V, "panel": "puerta", "status": "open", "source": "ai",
                                            "part": "Puerta lateral corredera izquierda", "severity": "leve",
                                            "rank": 1, "first_seen": "2026-10-01", "first_seen_inspection": "r00"})
    for pi in (1, 2, 3, 4):
        await marcar("r11", pi, "igual")
    a = await marcar("r12", 3, "golpe", **G1)
    assert a["libro"]["accion"] == "sustituye_ia"
    t["inspections"].aggregate = lambda pipeline: Cursor([{"_id": V, "insp_id": "r12"}])
    await server.rebuild_fleet_damages(_=MARTA)
    r = await deshacer("r12", 3)
    assert r["libro"]["accion"] == "devuelto_a_ia"
    assert abiertas(t) == [], "deshacer tras reconstruir resucitaba abierta la entrada de la IA archivada"
    (e,) = t["vehicle_damage_ledger"].docs
    assert e["status"] == "archived" and e["archived_reason"] == "rebuild_fleet" and e["first_seen"] == "2026-10-01"
    assert "ia_previa" not in e and "golpe_id" not in e


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_reconstruir_deshacer_la_devuelve_abierta_como_siempre(t):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    vieja = {"vehicle_id": V, "panel": "puerta", "status": "open", "source": "ai", "part": "Puerta",
             "severity": "leve", "rank": 1, "first_seen": "2026-10-01", "first_seen_inspection": "r00"}
    t["vehicle_damage_ledger"].docs.append(dict(vieja))
    for pi in (1, 2, 3, 4):
        await marcar("r11", pi, "igual")
    await marcar("r12", 3, "golpe", **G1)
    await deshacer("r12", 3)
    assert t["vehicle_damage_ledger"].docs == [vieja]


@pytest.mark.asyncio(loop_scope="session")
async def test_reconstruir_flota_en_una_cuenta_sin_ia_da_403(t, monkeypatch):
    t["inspections"].docs.append(revision("r12", V, "drv-ana", marca(12), analysis_status="sin_ia"))
    t["inspections"].aggregate = lambda pipeline: Cursor([{"_id": V, "insp_id": "r12"}])

    async def nueva(_o):
        return {"id": "org-nueva", "ia_danos": False}
    monkeypatch.setattr(server, "get_org", nueva)
    monkeypatch.delenv("IA_DANOS_DE_PAGO", raising=False)
    with pytest.raises(HTTPException) as e:
        await server.rebuild_fleet_damages(_={**MARTA, "org_id": "org-nueva"})
    assert e.value.status_code == 403
    assert insp(t, "r12")["analysis_status"] == "sin_ia"


# ── S5: el PDF de una revisión firmada ────────────────────────────────────────

def _sin_fotos_ni_yolo(monkeypatch, visto):
    async def sin_foto(*a, **k):
        return None

    async def nada_de_yolo(_iid, _i, dets):
        return []

    def pdf(insp_, sig, veh, cond, fotos, url, incluidos, sugeridos, anadidos=None):
        visto.update(insp=insp_, incluidos=incluidos, sugeridos=sugeridos, anadidos=anadidos)
        return b"%PDF-1.4"
    monkeypatch.setattr(server, "_fetch_photo_bytes", sin_foto)
    monkeypatch.setattr(server, "_refine_damage_boxes_with_yolo_sam", nada_de_yolo)
    monkeypatch.setattr(server, "_build_forensic_pdf", pdf)


@pytest.mark.asyncio(loop_scope="session")
async def test_lo_confirmado_despues_de_firmar_va_aparte(t, monkeypatch, quieto):
    ia = {"part": "Retrovisor derecho", "severity": "leve", "confidence": 0.71, "photo_index": 4,
          "box_2d": [300, 640, 420, 780]}
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)),
                              revision("r12", V, "drv-ana", marca(12), forensic_signed=True, analysis={
                                  "severity": "leve", "total_damages_count": 1, "damages": [dict(ia)],
                                  "new_damages": [dict(ia)]})]
    # Firmada ANTES de que nadie confirmara nada (la marca y el veredicto llevan la hora de ahora, posterior).
    t["forensic_signatures"].docs.append({"inspection_id": "r12", "content_hash": "ab" * 32,
                                          "signed_at": "2026-11-12T10:00:00+00:00"})
    await marcar("r12", 3, "golpe", **{**G1, "severity": "grave"})
    await server.damage_feedback("r12", {"verdict": "correct", "damage_index": 0, "scope": "new"}, user=MARTA)
    visto = {}
    _sin_fotos_ni_yolo(monkeypatch, visto)
    await server.forensic_pdf("r12", _=MARTA)
    # Lo firmado: el retrovisor TAL COMO ESTABA (de la IA, con su confianza), sin el golpe ni la confirmación.
    assert [d["part"] for d in visto["incluidos"] + visto["sugeridos"]] == ["Retrovisor derecho"]
    assert not any(d.get("_confirmado_por") or d.get("origen") == "repaso"
                   for d in visto["incluidos"] + visto["sugeridos"])
    # Aparte, con su fecha y quién.
    assert sorted((a["que"], a["part"], a["por"]) for a in visto["anadidos"]) == [
        ("Confirmado en Revisión rápida", "Retrovisor derecho", "Marta R."),
        ("Golpe marcado en el repaso", "Puerta lateral corredera izquierda", "Marta R.")]
    assert all(a["at"] > "2026-11-12T10:00:00+00:00" and a["cuando"] for a in visto["anadidos"])


@pytest.mark.asyncio(loop_scope="session")
async def test_lo_confirmado_antes_de_firmar_sigue_dentro(t, monkeypatch, quieto):
    ia = {"part": "Retrovisor derecho", "severity": "leve", "confidence": 0.31, "photo_index": 4,
          "box_2d": [300, 640, 420, 780]}
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)),
                              revision("r12", V, "drv-ana", marca(12), forensic_signed=True, analysis={
                                  "severity": "leve", "total_damages_count": 1, "damages": [dict(ia)],
                                  "new_damages": [dict(ia)]})]
    await marcar("r12", 3, "golpe", **G)
    await server.damage_feedback("r12", {"verdict": "correct", "damage_index": 0, "scope": "new"}, user=MARTA)
    t["forensic_signatures"].docs.append({"inspection_id": "r12", "content_hash": "ab" * 32,
                                          "signed_at": "2999-01-01T00:00:00+00:00"})       # firmada después de todo
    visto = {}
    _sin_fotos_ni_yolo(monkeypatch, visto)
    await server.forensic_pdf("r12", _=MARTA)
    assert sorted(d["part"] for d in visto["incluidos"]) == ["Puerta lateral corredera izquierda",
                                                           "Retrovisor derecho"]
    assert visto["sugeridos"] == [] and visto["anadidos"] == []


G = {"pieza_clave": "corredera_izq", "severity": "moderado", "box_2d": [410, 220, 640, 470]}


def test_el_pdf_pone_lo_de_despues_aparte_y_la_gravedad_con_lo_firmado():
    from test_demo_fotos import _bytes_jpeg, _frases_del_pdf
    sig = {"signed_by_name": "Ana", "signed_at": "2026-11-14T11:00:00", "content_hash": "ab" * 32,
           "prev_hash": "0" * 64, "revision": 1, "signature_text": "Firmado."}
    golpe = {"part": "Puerta lateral corredera izquierda", "severity": "grave", "photo_index": 1,
             "box_2d": [100, 100, 300, 300], "origen": "repaso", "golpe_id": "g1"}
    revision_ = {"id": "r12", "vehicle_id": V, "created_at": "2026-11-12T07:00:00", "photos": ["https://x/a.jpg"],
                 "analysis": {"severity": "sin_danos"}}
    # S14: «sin_danos» de la IA + un golpe grave de una persona dentro de lo firmado -> la cabecera dice «grave».
    frases = _frases_del_pdf(server._build_forensic_pdf(revision_, sig, {"license_plate": "5678 KLM"}, "Ana L.",
                                                        [_bytes_jpeg()], "https://ejemplo.test/verify/x", [golpe], []))
    assert "grave" in frases and "sin_danos" not in frases and "Añadido después de la firma" not in frases
    # S5: el mismo golpe confirmado DESPUÉS de firmar: fuera de lo firmado, en su bloque, y la cabecera con lo firmado.
    frases = _frases_del_pdf(server._build_forensic_pdf(
        revision_, sig, {"license_plate": "5678 KLM"}, "Ana L.", [_bytes_jpeg()], "https://ejemplo.test/verify/x",
        [], [], anadidos=[{"part": golpe["part"], "severity": "grave", "que": "Golpe marcado en el repaso",
                           "at": "2026-11-15T08:00:00+00:00", "cuando": "2026-11-15 09:00", "por": "Marta R."}]))
    assert "Añadido después de la firma" in frases and "no forma parte de lo firmado" in frases.lower()
    assert "Marta R." in frases and "2026-11-15 09:00" in frases and "sin_danos" in frases


# ── S12: el único del libro desde el primer golpe ────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_el_unico_del_libro_se_pide_antes_del_primer_golpe(t, monkeypatch):
    monkeypatch.setattr(server, "_LIBRO_CON_INDICE", set())
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    await marcar("r12", 3, "golpe", **G1)
    indices = t["vehicle_damage_ledger"].__dict__.get("indices") or []
    assert indices == [([("vehicle_id", 1), ("panel", 1)],
                        {"unique": True, "partialFilterExpression": {"status": "open"},
                         "name": "uniq_veh_panel_open"})]
    await marcar("r12", 4, "golpe", **G2)
    assert len(t["vehicle_damage_ledger"].indices) == 1, "una vez por base y proceso, no en cada golpe"


@pytest.mark.asyncio(loop_scope="session")
async def test_el_unico_del_libro_tambien_antes_de_lo_que_apunta_la_ia(t, monkeypatch):
    monkeypatch.setattr(server, "_LIBRO_CON_INDICE", set())
    await server._ledger_upsert({"vehicle_id": V, "panel": "capo", "status": "open"},
                                {"$set": {"part": "Capó"}, "$setOnInsert": {"source": "ai"}})
    assert t["vehicle_damage_ledger"].indices[0][1]["name"] == "uniq_veh_panel_open"


@pytest.mark.asyncio(loop_scope="session")
async def test_si_el_indice_no_se_puede_crear_el_golpe_se_guarda_igual(t, monkeypatch):
    monkeypatch.setattr(server, "_LIBRO_CON_INDICE", set())

    async def falla(*a, **k):
        raise RuntimeError("sin permiso")
    t["vehicle_damage_ledger"].create_index = falla
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    r = await marcar("r12", 3, "golpe", **G1)
    assert r["libro"]["accion"] == "nuevo" and len(abiertas(t)) == 1
    assert not server._LIBRO_CON_INDICE, "si no se pudo, se vuelve a intentar en el siguiente"


# ── S13: el análisis que agota sus intentos no pierde el golpe ───────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_el_analisis_que_no_para_de_chocar_no_pierde_el_golpe(t):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    a = await marcar("r12", 3, "golpe", **G1)
    gid = a["lado"]["golpe"]["golpe_id"]
    original = t["inspections"].update_one
    choques = {"n": 0}

    async def siempre_choca(q, u, **k):
        # Las escrituras condicionadas del análisis no casan nunca (otro escribe a la vez); y la de «como antes» llega
        # con una lista que ya no tiene el golpe (se coló entre la lectura y la escritura).
        if ("analysis.damages" in q or "analysis" in q) and choques["n"] < 8:
            choques["n"] += 1
            from types import SimpleNamespace
            return SimpleNamespace(matched_count=0, modified_count=0)
        if "$set" in u and "analysis" in u["$set"] and isinstance(u["$set"]["analysis"], dict) \
                and not choques.get("perdido"):
            choques["perdido"] = True
            u = {**u, "$set": {**u["$set"], "analysis": {**u["$set"]["analysis"], "damages": [
                d for d in u["$set"]["analysis"]["damages"] if d.get("golpe_id") != gid]}}}
        return await original(q, u, **k)
    t["inspections"].update_one = siempre_choca
    try:
        await server._escribir_analisis_ia("r12", {"severity": "sin_danos", "total_damages_count": 0, "damages": [],
                                                   "new_damages": []}, {"analysis_status": "ok"})
    finally:
        t["inspections"].update_one = original
    assert choques["n"] >= 8 and choques.get("perdido")
    danos = insp(t, "r12")["analysis"]["damages"]
    assert [d for d in danos if d.get("golpe_id") == gid], "el golpe se ha perdido de la ficha"
    assert insp(t, "r12")["analysis_status"] == "ok"


# ── S14: «con el repaso» en las respuestas y en las cuentas ──────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_un_golpe_grave_a_mano_no_se_lee_sin_danos(t, monkeypatch):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)),
                              revision("r12", V, "drv-ana", marca(12), analysis={
                                  "severity": "sin_danos", "total_damages_count": 0, "damages": [],
                                  "new_damages": []})]
    for pi in (1, 2, 3, 4):
        await marcar("r11", pi, "igual")
    await marcar("r12", 3, "golpe", **{**G1, "severity": "grave"})
    an = insp(t, "r12")["analysis"]
    # Lo de la IA no se toca (la cola de «Revisión rápida» y la autorrevisión lo leen); lo de la persona, aparte.
    assert an["severity"] == "sin_danos" and an["total_damages_count"] == 0
    assert an["severidad_con_repaso"] == "grave" and an["total_con_repaso"] == 1
    assert server._sev_con_repaso(an) == "grave" and server._total_con_repaso(an) == 1
    # La responsabilidad de un daño (lo que se enseña al pulsar una revisión).
    r = await server.damage_responsibility("r12", _=MARTA)
    assert r["severity"] == "grave" and r["damages_count"] == 1


def test_las_cuentas_por_gravedad_del_servidor_cuentan_con_el_repaso():
    """/stats/dashboard agrupa en Mongo: la gravedad de cada revisión es la de la persona si la hay."""
    assert server._AGG_SEV_CON_REPASO == {"$ifNull": ["$analysis.severidad_con_repaso",
                                                      {"$ifNull": ["$analysis.severity", "sin_danos"]}]}
    import inspect
    fuente = inspect.getsource(server.stats_dashboard)
    assert fuente.count("_AGG_SEV_CON_REPASO") == 2 and '"$analysis.severity"' not in fuente


@pytest.mark.asyncio(loop_scope="session")
async def test_el_dia_de_la_portada_y_la_asignacion_con_el_repaso(t, monkeypatch):
    monkeypatch.setattr(server, "_hoy_madrid", lambda: "2026-11-12")
    t["daily_assignments"].docs.append({"date": "2026-11-12", "center": "OGA5", "slots": [
        {"vehicle_id": V, "vehicle_plate": "5678 KLM", "driver_id": "drv-ana"}]})
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)),
                              revision("r12", V, "drv-ana", marca(12), analysis={
                                  "severity": "leve", "total_damages_count": 1, "damages": [
                                      {"part": "Capó", "severity": "leve", "photo_index": 1}], "new_damages": []})]
    await marcar("r12", 3, "golpe", **{**G1, "severity": "critico"})
    hoy = await server.stats_hoy(center=None, user=MARTA)
    (fila,) = [x for x in hoy["salidas"]["lista"] if x["vehicle_id"] == V]
    assert fila["revisada"] is True and fila["gravedad"] == "critico"
    docs = await server.get_daily_assignments(date="2026-11-12", center=None, user=MARTA)
    assert docs[0]["slots"][0]["inspection_severity"] == "critico"
