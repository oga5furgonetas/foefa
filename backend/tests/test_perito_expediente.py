# -*- coding: utf-8 -*-
"""«Antes del perito» (14-11-2026): el expediente de la furgoneta, GET /api/vehicles/{id}/antes-del-perito.

Solo golpes confirmados por una persona (repaso, o «Revisión rápida» con correct/corrected). Lo que la IA marcó y
nadie confirmó no sale. «Quién la llevaba» solo cuando es seguro: un único conductor entre la foto anterior de ese
lado y la del golpe, un día o menos, y la anterior marcada «igual» por una persona. Si no, el motivo.

Con la base de mentira (base_de_mentira.py), sin MongoDB. Matrículas y nombres inventados.
"""
import pytest

import server
from test_perito_repaso import MARTA, PUERTA, deshacer, falla, insp, marca, marcar, revision, t  # noqa: F401

V = "veh-5678"


async def expediente(user=MARTA, vid=V):
    return await server.expediente_antes_del_perito(vid, user=user)


def golpe_ia(part="Puerta lateral corredera izquierda", pi=3, sev="moderado", caja=(400, 200, 600, 450)):
    return {"part": part, "severity": sev, "description": "Golpe que ve la IA", "photo_index": pi,
            "box_2d": list(caja)}


def con_ia(*danos):
    return {"severity": "moderado", "total_damages_count": len(danos), "damages": list(danos),
            "new_damages": [dict(d) for d in danos]}


def feedback(fid, rid, dano, verdict="correct", **extra):
    return {"id": fid, "inspection_id": rid, "vehicle_id": V, "scope": "new", "damage_index": 0, "damage": dano,
            "verdict": verdict, "reviewed_by": "Marta R.", "created_at": "2026-11-12T09:00:00+00:00", **extra}


@pytest.mark.asyncio(loop_scope="session")
async def test_lo_que_la_ia_marco_y_nadie_confirmo_no_sale(t):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)),
                              revision("r12", V, "drv-ana", marca(12), analysis=con_ia(golpe_ia()))]
    t["vehicle_damage_ledger"].docs.append({"vehicle_id": V, "panel": "puerta", "status": "open", "source": "ai",
                                            "part": "Puerta", "severity": "moderado", "first_seen": "2026-11-12",
                                            "first_seen_inspection": "r12"})
    # Una persona dijo que se equivocaba: tampoco sale.
    t["ai_feedback"].docs.append(feedback("fb-mal", "r12", golpe_ia(), verdict="wrong"))
    r = await expediente()
    assert r["golpes"] == [] and r["cuentas"]["golpes"] == 0
    assert [c["estado"] for c in r["calendario"]] == ["revisada", "revisada"]
    # Nada de la IA en ninguna parte del documento.
    texto = repr(r)
    assert "Golpe que ve la IA" not in texto and "annotated" not in texto and "severity" not in texto


@pytest.mark.asyncio(loop_scope="session")
async def test_un_golpe_confirmado_en_revision_rapida_si_sale_con_su_caja_corregida(t):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)),
                              revision("r12", V, "drv-ana", marca(12), analysis=con_ia(golpe_ia()))]
    await marcar("r11", 3, "igual")
    t["ai_feedback"].docs.append(feedback("fb1", "r12", golpe_ia(), verdict="corrected",
                                          corrected_box=[420, 230, 610, 460]))
    # De la IA, en otro sitio y sin confirmar: no sale.
    t["ai_feedback"].docs.append(feedback("fb-otra", "r12", golpe_ia("Faro delantero", 1), verdict="missed"))
    r = await expediente()
    (g,) = r["golpes"]
    assert g["id"] == "rr-fb1" and g["origen"] == "revision_rapida" and g["box_2d"] == [420, 230, 610, 460]
    assert g["vista"] == "lateral_izq" and g["foto_url"] == "/fotos/r12-lateral_izq.jpg"
    assert g["confirmado_por"] == "Marta R." and g["gravedad"] == "moderado"
    assert g["atribucion"] == {"atribuible": True, "motivo": None, "dias": 1,
                               "conductor": {"id": "drv-ana", "nombre": "Ana L."},
                               "conductores": [{"id": "drv-ana", "nombre": "Ana L."}]}


@pytest.mark.asyncio(loop_scope="session")
async def test_el_mismo_golpe_en_el_repaso_y_en_revision_rapida_sale_una_vez(t):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)),
                              revision("r12", V, "drv-ana", marca(12), analysis=con_ia(golpe_ia()))]
    hecho = await marcar("r12", 3, "golpe", **PUERTA)
    t["ai_feedback"].docs.append(feedback("fb1", "r12", golpe_ia()))
    r = await expediente()
    assert [g["id"] for g in r["golpes"]] == [hecho["lado"]["golpe"]["golpe_id"]]
    assert r["golpes"][0]["origen"] == "repaso"


@pytest.mark.asyncio(loop_scope="session")
async def test_atribuible_solo_con_un_conductor_un_dia_y_la_anterior_igual(t):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)),
                              revision("r12", V, "drv-ana", marca(12))]
    await marcar("r11", 3, "igual")
    await marcar("r12", 3, "golpe", **PUERTA)
    (g,) = (await expediente())["golpes"]
    assert g["atribucion"]["atribuible"] is True and g["atribucion"]["conductor"]["nombre"] == "Ana L."
    assert g["anterior"]["inspection_id"] == "r11" and g["anterior"]["veredicto"] == "igual"
    assert g["anterior"]["conductor"] == {"id": "drv-ana", "nombre": "Ana L."}
    assert g["fecha"] == "2026-11-12" and g["hora"] == "08:00" and g["recibida_at"] == marca(12)


@pytest.mark.asyncio(loop_scope="session")
async def test_con_tres_dias_de_ventana_sale_sin_conductor(t):
    t["inspections"].docs += [revision("r09", V, "drv-ana", marca(9)),
                              revision("r12", V, "drv-ana", marca(12))]
    await marcar("r09", 3, "igual")
    await marcar("r12", 3, "golpe", **PUERTA)
    (g,) = (await expediente())["golpes"]
    assert g["atribucion"] == {"atribuible": False, "motivo": "varios_dias", "dias": 3, "conductor": None,
                               "conductores": [{"id": "drv-ana", "nombre": "Ana L."}]}


@pytest.mark.asyncio(loop_scope="session")
async def test_con_la_foto_anterior_sin_repasar_sale_sin_conductor(t):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)),
                              revision("r12", V, "drv-ana", marca(12))]
    await marcar("r12", 3, "golpe", **PUERTA)
    (g,) = (await expediente())["golpes"]
    assert g["atribucion"]["atribuible"] is False and g["atribucion"]["motivo"] == "anterior_sin_repasar"
    assert g["atribucion"]["conductor"] is None and g["anterior"]["veredicto"] is None
    # «No se ve» tampoco es «igual».
    await deshacer("r12", 3)
    await marcar("r11", 3, "no_se_ve")
    await marcar("r12", 3, "golpe", **PUERTA)
    (g,) = (await expediente())["golpes"]
    assert g["atribucion"]["motivo"] == "anterior_sin_repasar"


@pytest.mark.asyncio(loop_scope="session")
async def test_dos_personas_en_la_ventana_no_se_nombra_a_ninguna(t):
    t["inspections"].docs += [revision("r11", V, "drv-luis", marca(11)),
                              revision("r12", V, "drv-ana", marca(12))]
    await marcar("r11", 3, "igual")
    await marcar("r12", 3, "golpe", **PUERTA)
    (g,) = (await expediente())["golpes"]
    assert g["atribucion"]["motivo"] == "varios_conductores" and g["atribucion"]["conductor"] is None
    assert {c["id"] for c in g["atribucion"]["conductores"]} == {"drv-ana", "drv-luis"}


@pytest.mark.asyncio(loop_scope="session")
async def test_dos_fichas_con_el_mismo_correo_son_una_persona(t):
    t["drivers"].docs.append({"id": "drv-ana-2", "name": "Ana L.", "email": "ANA@ejemplo.test "})
    t["inspections"].docs += [revision("r11", V, "drv-ana-2", marca(11)),
                              revision("r12", V, "drv-ana", marca(12))]
    await marcar("r11", 3, "igual")
    await marcar("r12", 3, "golpe", **PUERTA)
    (g,) = (await expediente())["golpes"]
    assert g["atribucion"]["atribuible"] is True and len(g["atribucion"]["conductores"]) == 1
    assert (await expediente())["cuentas"]["conductores"] == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_conductor_en_la_ventana(t):
    t["inspections"].docs += [revision("r11", V, None, marca(11)), revision("r12", V, None, marca(12))]
    await marcar("r11", 3, "igual")
    await marcar("r12", 3, "golpe", **PUERTA)
    (g,) = (await expediente())["golpes"]
    assert g["atribucion"] == {"atribuible": False, "motivo": "sin_conductor", "dias": 1, "conductor": None,
                               "conductores": []}


@pytest.mark.asyncio(loop_scope="session")
async def test_ya_estaba_y_sin_foto_anterior(t):
    t["inspections"].docs.append(revision("r10", V, "drv-ana", marca(10)))
    hecho = await marcar("r10", 4, "golpe", part="Aleta trasera derecha", severity="leve", box_2d=[500, 700, 650, 900])
    r = await expediente()
    (g,) = r["golpes"]
    assert g["ya_estaba"] is True and g["anterior"] is None
    assert g["atribucion"] == {"atribuible": False, "motivo": "ya_estaba", "dias": None, "conductor": None,
                               "conductores": []}
    assert r["como_entro"]["golpes_ya_estaban"] == [hecho["lado"]["golpe"]["golpe_id"]]
    assert r["cuentas"]["ya_estaban"] == 1 and r["calendario"] == [
        {"fecha": "2026-11-10", "estado": "revisada", "revisiones": 1}]        # «ya estaba» no aparece ese día
    # Vista desconocida: sin foto anterior que mirar.
    t["inspections"].docs.append({"id": "r11", "vehicle_id": V, "driver_id": "drv-ana", "created_at": marca(11),
                                  "photos": [f"/f{k}.jpg" for k in range(5)], "photo_roles": ["angle"] * 5})
    await marcar("r11", 2, "golpe", **PUERTA)
    g = (await expediente())["golpes"][1]
    assert g["vista"] is None and g["ya_estaba"] is False
    assert g["atribucion"]["motivo"] == "sin_foto_anterior" and g["atribucion"]["dias"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_reparado_en_taller_y_coste(t):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)),
                              revision("r12", V, "drv-ana", marca(12))]
    await marcar("r12", 3, "golpe", **PUERTA)
    e = t["vehicle_damage_ledger"].docs[0]
    e.update(orden_id="ot-1", orden_numero="OT-0042")
    (g,) = (await expediente())["golpes"]
    assert g["reparacion"] == {"estado": "en_taller", "orden_numero": "OT-0042", "reparado_at": None, "coste": None}
    e.pop("orden_id")
    await server.update_damage("r12", 0, {"repair_status": "done", "actual_cost": 340}, _=MARTA)
    r = await expediente()
    (g,) = r["golpes"]
    assert g["reparacion"]["estado"] == "reparado" and g["reparacion"]["coste"] == 340.0
    assert g["reparacion"]["reparado_at"] == e["repaired_at"]
    assert r["cuentas"]["reparados"] == 1 and r["cuentas"]["abiertos"] == 0


@pytest.mark.asyncio(loop_scope="session")
async def test_como_entro_como_esta_calendario_y_cuentas(t):
    t["vehicles"].docs[0].update(renting_end_date="2027-03-31T00:00:00", mileage=48210,
                                 mileage_history=[{"date": "2026-11-11", "km": 48000},
                                                  {"date": "2026-11-12T22:30:00+00:00", "km": 48210}])
    t["inspections"].docs += [
        revision("r09", V, "drv-luis", marca(9), vistas=["frontal", "trasera"]),
        revision("r12", V, "drv-ana", marca(12)),
        revision("r12b", V, "drv-ana", marca(12, "15:00:00"), vistas=["lateral_der"]),
        revision("borrada", V, "drv-ana", marca(13), deleted=True),
        revision("otra", "veh-9012", "drv-luis", marca(10)),
    ]
    await marcar("otra", 1, "golpe", **{**PUERTA, "part": "Paragolpes delantero"})
    r = await expediente()
    assert r["vehiculo"] == {"id": V, "matricula": "5678 KLM", "modelo": "Ford Transit Custom", "centro": "OGA5",
                             "fin_renting": "2027-03-31", "km": 48210, "km_fecha": "2026-11-12"}
    assert r["periodo"] == {"desde": "2026-11-09", "hasta": "2026-11-12", "dias": 4}
    assert [(c["fecha"], c["estado"], c["revisiones"]) for c in r["calendario"]] == [
        ("2026-11-09", "revisada", 1), ("2026-11-10", "sin_revisar", 0), ("2026-11-11", "sin_revisar", 0),
        ("2026-11-12", "revisada", 2)]
    entro = {f["vista"]: f["inspection_id"] for f in r["como_entro"]["fotos"]}
    esta = {f["vista"]: f["inspection_id"] for f in r["como_esta"]["fotos"]}
    assert entro == {"frontal": "r09", "trasera": "r09", "lateral_izq": "r12", "lateral_der": "r12"}
    assert esta == {"frontal": "r12", "trasera": "r12", "lateral_izq": "r12", "lateral_der": "r12b"}
    assert [f["vista"] for f in r["como_esta"]["fotos"]] == ["frontal", "trasera", "lateral_izq", "lateral_der"]
    # Nada de la otra furgoneta.
    assert r["golpes"] == [] and "veh-9012" not in repr(r) and "otra" not in {f["inspection_id"]
                                                                              for f in r["como_esta"]["fotos"]}
    assert r["cuentas"] == {"revisiones": 3, "conductores": 2, "golpes": 0, "reparados": 0, "abiertos": 0,
                            "en_taller": 0, "atribuibles": 0, "ya_estaban": 0, "dias_con_revision": 2,
                            "dias_sin_revision": 2}


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_revisiones_y_errores(t):
    t["vehicles"].docs[0]["status"] = "baja"              # una de baja es justo la que se devuelve
    r = await expediente()
    assert r["periodo"] == {"desde": None, "hasta": None, "dias": 0}
    assert r["como_entro"] is None and r["como_esta"] is None and r["golpes"] == [] and r["calendario"] == []
    assert set(r["cuentas"].values()) == {0}
    with falla(404, "Esa furgoneta no existe"):
        await expediente(vid="no-existe")
    with falla(403, "No tienes acceso a esa furgoneta"):
        await expediente(user={**MARTA, "allowed_centers": ["DGA1"]})
    assert (await expediente(user={**MARTA, "allowed_centers": ["OGA5"]}))["vehiculo"]["id"] == V
