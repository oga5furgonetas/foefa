# -*- coding: utf-8 -*-
"""«Antes del perito», arreglos tras la revisión (14-11-2026): el libro de daños con varios golpes de personas.

El libro es UNO por pieza gruesa abierta («puerta» vale para las seis puertas). Un golpe marcado por una persona
nunca depende de la entrada de otro golpe: la entrada lleva todos los golpes enlazados (`golpe_ids`), deshacer o
reparar uno no se lleva a los demás, lo que confirmó otra persona en «Revisión rápida» no se pierde, la IA no pisa
lo de una persona y el estado de reparación de cada golpe es el SUYO.

Cada prueba falla con el código de antes (las de los revisores, en
scratchpad/crecer/perito/revision/{permisos,contrato,servidor-regresiones}).
"""
import pytest

import server
from test_perito_repaso import MARTA, deshacer, falla, insp, marca, marcar, revision, t  # noqa: F401

V = "veh-5678"
IZQ = {"pieza_clave": "corredera_izq", "severity": "moderado", "box_2d": [410, 220, 640, 470]}
DER = {"pieza_clave": "puerta_del_der", "severity": "leve", "box_2d": [300, 100, 500, 300]}
LUIS = {"sub": "u-luis", "role": "admin", "name": "Luis P."}


def abiertas(t, panel="puerta"):
    return [e for e in t["vehicle_damage_ledger"].docs if e.get("panel") == panel and e.get("status") == "open"]


def idx_golpe(t, rid, gid):
    return next(i for i, d in enumerate(insp(t, rid)["analysis"]["damages"]) if d.get("golpe_id") == gid)


@pytest.fixture
def sin_reentrenar(monkeypatch):
    async def nada(*a, **k):
        return None
    monkeypatch.setattr(server, "_ia_reentrenar_si_toca", nada)


async def dos_puertas(t):
    """La 5678 el 12-11: dos golpes en dos puertas distintas de la misma revisión (la de ayer, marcada igual)."""
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12)),
                              revision("r13", V, "drv-luis", marca(13))]
    for pi in (1, 2, 3, 4):
        await marcar("r11", pi, "igual")
    a = await marcar("r12", 3, "golpe", **IZQ)
    b = await marcar("r12", 4, "golpe", **DER)
    return a["lado"]["golpe"]["golpe_id"], b["lado"]["golpe"]["golpe_id"]


@pytest.mark.asyncio(loop_scope="session")
async def test_marcar_dice_que_pieza_estaba_ya_apuntada(t):
    ga, gb = await dos_puertas(t)
    (e,) = abiertas(t)
    assert e["golpe_id"] == ga and e["golpe_ids"] == [ga, gb]
    # R3: la respuesta al segundo nombra la pieza que YA estaba, con su clave.
    dia = await server.repaso_del_dia(fecha="2026-11-12", center=None, user=MARTA)
    filas = {a["golpe_id"]: a for a in dia["revisiones"][0]["ya_apuntado"]}
    assert set(filas) == {ga, gb}                          # los dos golpes salen, cada uno con su pieza
    assert filas[gb]["pieza"] == "Puerta delantera derecha" and filas[gb]["pieza_clave"] == "puerta_del_der"
    assert filas[gb]["vista"] == "lateral_der" and filas[gb]["foto_url"] == "/fotos/r12-lateral_der.jpg"


@pytest.mark.asyncio(loop_scope="session")
async def test_deshacer_el_primero_no_deja_fuera_del_libro_al_segundo(t):
    ga, gb = await dos_puertas(t)
    r = await deshacer("r12", 3)
    assert r["libro"] == {"accion": "pasa_a_otro"}
    (e,) = abiertas(t)
    # La entrada pasa al otro golpe, con SUS datos: sigue en el taller y en «Ya apuntado».
    assert e["golpe_id"] == gb and e["golpe_ids"] == [gb] and e["part"] == "Puerta delantera derecha"
    assert (e["photo_index"], e["vista"], e["severity"], e["source"]) == (4, "lateral_der", "leve", "human")
    dia = await server.repaso_del_dia(fecha="2026-11-12", center=None, user=MARTA)
    assert [a["golpe_id"] for a in dia["revisiones"][0]["ya_apuntado"]] == [gb]
    exp = await server.expediente_antes_del_perito(V, user=MARTA)
    (g,) = exp["golpes"]
    assert g["id"] == gb and g["reparacion"]["estado"] == "abierto"
    # Y deshacer el que queda deja el libro limpio.
    assert (await deshacer("r12", 4))["libro"] == {"accion": "borrado"}
    assert t["vehicle_damage_ledger"].docs == []


@pytest.mark.asyncio(loop_scope="session")
async def test_deshacer_el_segundo_solo_lo_desenlaza(t):
    ga, gb = await dos_puertas(t)
    assert (await deshacer("r12", 4))["libro"] == {"accion": "sin_cambios"}
    (e,) = abiertas(t)
    assert e["golpe_id"] == ga and e["golpe_ids"] == [ga]


@pytest.mark.asyncio(loop_scope="session")
async def test_reparar_una_puerta_no_da_por_reparada_la_otra(t):
    ga, gb = await dos_puertas(t)
    # Se repara SOLO la corredera (el dueño de la entrada) desde la ficha, con su coste.
    await server.update_damage("r12", idx_golpe(t, "r12", ga), {"repair_status": "done", "actual_cost": 200}, _=MARTA)
    exp = await server.expediente_antes_del_perito(V, user=MARTA)
    est = {g["id"]: g["reparacion"] for g in exp["golpes"]}
    assert est[ga]["estado"] == "reparado" and est[ga]["coste"] == 200.0
    assert est[gb]["estado"] == "abierto"
    assert exp["cuentas"]["reparados"] == 1 and exp["cuentas"]["abiertos"] == 1
    # La entrada sigue abierta para la otra puerta (el taller la sigue viendo), ya con sus datos.
    (e,) = abiertas(t)
    assert e["golpe_id"] == gb and e["golpe_ids"] == [gb]
    # La corredera reparada ya no se deshace; la otra puerta, sí.
    with falla(409, "taller o reparado"):
        await deshacer("r12", 3)
    assert (await deshacer("r12", 4))["libro"] == {"accion": "borrado"}


@pytest.mark.asyncio(loop_scope="session")
async def test_reparar_la_otra_puerta_no_toca_la_primera(t):
    ga, gb = await dos_puertas(t)
    await server.update_damage("r12", idx_golpe(t, "r12", gb), {"repair_status": "done"}, _=MARTA)
    exp = await server.expediente_antes_del_perito(V, user=MARTA)
    est = {g["id"]: g["reparacion"]["estado"] for g in exp["golpes"]}
    assert est == {ga: "abierto", gb: "reparado"}
    (e,) = abiertas(t)
    assert e["golpe_id"] == ga and e["golpe_ids"] == [ga]
    # Y la corredera se puede deshacer: nadie la ha reparado.
    assert (await deshacer("r12", 3))["libro"] == {"accion": "borrado"}


@pytest.mark.asyncio(loop_scope="session")
async def test_la_orden_de_taller_de_una_puerta_no_mete_en_el_taller_a_la_otra(t):
    ga, gb = await dos_puertas(t)
    (e,) = abiertas(t)
    e["orden_id"], e["orden_numero"] = "ot-1", 371                  # la corredera (la dueña) va al taller
    exp = await server.expediente_antes_del_perito(V, user=MARTA)
    est = {g["id"]: (g["reparacion"]["estado"], g["reparacion"]["orden_numero"]) for g in exp["golpes"]}
    assert est == {ga: ("en_taller", 371), gb: ("abierto", None)}


@pytest.mark.asyncio(loop_scope="session")
async def test_reparar_otro_dano_de_esa_pieza_no_cierra_la_entrada_de_una_persona(t):
    """Un daño de la IA en una puerta reparado desde la ficha cerraba TODAS las entradas abiertas de «puerta»."""
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)),
                              revision("r12", V, "drv-ana", marca(12), analysis={
                                  "severity": "leve", "total_damages_count": 1, "new_damages": [],
                                  "damages": [{"part": "Puerta trasera izquierda", "severity": "leve",
                                               "photo_index": 2}]})]
    await marcar("r12", 3, "golpe", **IZQ)
    await server.update_damage("r12", 0, {"repair_status": "done"}, _=MARTA)     # el de la IA
    (e,) = abiertas(t)
    assert e["origen"] == "repaso"


@pytest.mark.asyncio(loop_scope="session")
async def test_deshacer_no_se_lleva_lo_confirmado_despues_en_revision_rapida_de_otra_revision(t, sin_reentrenar):
    t["inspections"].docs += [revision("r12", V, "drv-ana", marca(12)), revision("r13", V, "drv-luis", marca(13))]
    await marcar("r12", 3, "golpe", **IZQ)
    # Al día siguiente la IA ve la puerta trasera derecha y Luis lo confirma en «Revisión rápida».
    insp(t, "r13")["analysis"] = {"damages": [], "new_damages": [
        {"part": "Puerta trasera derecha", "severity": "grave", "description": "x", "photo_index": 2,
         "box_2d": [1, 1, 500, 500]}]}
    await server.damage_feedback("r13", {"verdict": "correct", "damage_index": 0, "scope": "new"}, user=LUIS)
    (e,) = abiertas(t)
    # Lo del repaso no cambia: lo de Luis queda anotado aparte.
    assert e["part"] == "Puerta lateral corredera izquierda" and e["revision_rapida"]["por"] == "Luis P."
    r = await deshacer("r12", 3)
    assert r["libro"] == {"accion": "queda_revision_rapida"}
    (e,) = abiertas(t)
    assert (e["source"], e["part"], e["severity"], e["first_seen_inspection"]) == (
        "human", "Puerta trasera derecha", "grave", "r13")
    assert "golpe_id" not in e and "origen" not in e and "revision_rapida" not in e


@pytest.mark.asyncio(loop_scope="session")
async def test_deshacer_no_se_lleva_lo_confirmado_en_revision_rapida_en_la_misma_revision(t, sin_reentrenar):
    """La prueba de servidor-regresiones: la IA ve la misma puerta en la misma revisión y Luis la confirma."""
    ia = {"part": "Puerta lateral corredera izquierda", "severity": "leve", "description": "lo ve la IA",
          "photo_index": 3, "box_2d": [400, 200, 600, 450]}
    t["inspections"].docs.append(revision("r12", V, "drv-ana", marca(12), analysis={
        "severity": "leve", "total_damages_count": 1, "damages": [dict(ia)], "new_damages": [dict(ia)]}))
    r = await marcar("r12", 3, "golpe", **IZQ)
    assert r["libro"]["accion"] == "nuevo"
    await server.damage_feedback("r12", {"verdict": "correct", "damage_index": 0, "scope": "new"}, user=LUIS)
    assert (await deshacer("r12", 3))["libro"] == {"accion": "queda_revision_rapida"}
    (e,) = abiertas(t)
    assert e["source"] == "human" and e["severity"] == "leve"


@pytest.mark.asyncio(loop_scope="session")
async def test_con_una_entrada_de_la_ia_y_revision_rapida_deshacer_no_la_devuelve_a_la_ia(t, sin_reentrenar):
    t["inspections"].docs += [revision("r12", V, "drv-ana", marca(12)), revision("r13", V, "drv-luis", marca(13))]
    t["vehicle_damage_ledger"].docs.append({"vehicle_id": V, "panel": "puerta", "status": "open", "source": "ai",
                                            "part": "puerta", "severity": "leve", "rank": 1,
                                            "first_seen": "2026-10-02", "first_seen_inspection": "r-vieja"})
    assert (await marcar("r12", 3, "golpe", **IZQ))["libro"]["accion"] == "sustituye_ia"
    insp(t, "r13")["analysis"] = {"damages": [], "new_damages": [
        {"part": "Puerta trasera derecha", "severity": "moderado", "photo_index": 2}]}
    await server.damage_feedback("r13", {"verdict": "correct", "damage_index": 0, "scope": "new"}, user=LUIS)
    assert (await deshacer("r12", 3))["libro"] == {"accion": "queda_revision_rapida"}
    (e,) = abiertas(t)
    assert e["source"] == "human" and "ia_previa" not in e


@pytest.mark.asyncio(loop_scope="session")
async def test_la_ia_no_pisa_la_pieza_ni_la_gravedad_de_un_golpe_confirmado(t, monkeypatch):
    async def vacio(*a, **k):
        return {}
    monkeypatch.setattr(server, "_ia_fiabilidad_piezas", vacio)
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    await marcar("r12", 3, "golpe", **{**IZQ, "severity": "grave"})
    # Llega tarde el análisis de ESA revisión (o se reanaliza): la IA ve la puerta como leve, con otro nombre.
    an = server.InspectionAnalysis(new_damages=[server.Damage(
        part="puerta corredera", severity="leve", description="roce", confidence=0.97)])
    await server._apply_vehicle_memory(V, an, inspection_id="r12")
    # Y otro análisis, de otra revisión, que la ve un grado más grave (antes «consolidaba» la gravedad).
    an2 = server.InspectionAnalysis(new_damages=[server.Damage(
        part="Puerta lateral", severity="critico", description="x", confidence=0.97)])
    await server._apply_vehicle_memory(V, an2, inspection_id="r11")
    (e,) = abiertas(t)
    assert (e["source"], e["part"], e["severity"], e["rank"]) == (
        "human", "Puerta lateral corredera izquierda", "grave", 3)
