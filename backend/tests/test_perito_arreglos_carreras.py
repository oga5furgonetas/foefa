# -*- coding: utf-8 -*-
"""«Antes del perito», arreglos tras la revisión (14-11-2026): carreras y entradas hostiles.

· Dos personas marcando a la vez dos lados de la misma revisión, o la IA escribiendo su análisis mientras alguien
  marca: ningún golpe se pierde de la ficha (escrituras sobre `analysis.damages` condicionadas a lo leído).
· Marcar y deshacer a la vez: o queda todo o no queda nada (nunca un golpe fantasma en el libro).
· Deshacer un lado mientras otro completa la revisión: no queda «completa» con un lado sin decidir.
· `photo_index` con «inf», «1e999», decimales y `box_2d` con infinitos o NaN: 400, sin escribir nada.
· Deshacer deja el análisis de la IA EXACTAMENTE como estaba.

La base de mentira devuelve el objeto guardado y contesta sin esperar, lo que esconde las carreras: `ColLenta`
devuelve copias y cede el turno en cada lectura, como Mongo de verdad.
"""
import asyncio
import copy

import pytest

import server
from base_de_mentira import Col
from test_perito_repaso import MARTA, deshacer, falla, insp, marca, marcar, mundo_base, revision, t  # noqa: F401

V = "veh-5678"
FRENTE = {"pieza_clave": "paragolpes_del", "severity": "leve", "box_2d": [100, 100, 300, 300]}
IZQ = {"pieza_clave": "corredera_izq", "severity": "moderado", "box_2d": [410, 220, 640, 470]}


class ColLenta(Col):
    """Como Mongo: cada lectura devuelve una copia y tarda en volver (entre leer y escribir pasa tiempo)."""
    async def find_one(self, *a, **k):
        r = copy.deepcopy(await super().find_one(*a, **k))
        await asyncio.sleep(0)
        return r


@pytest.fixture
def lenta(monkeypatch, t):
    t["inspections"] = ColLenta([])
    return t


def golpes_en_ficha(t, rid):
    return [d for d in (insp(t, rid).get("analysis") or {}).get("damages") or [] if d.get("origen") == "repaso"]


@pytest.mark.asyncio(loop_scope="session")
async def test_dos_golpes_a_la_vez_en_la_misma_revision_quedan_los_dos_en_la_ficha(lenta):
    t = lenta
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)),
                              revision("r12", V, "drv-ana", marca(12), analysis={
                                  "severity": "sin_danos", "total_damages_count": 0, "damages": [],
                                  "new_damages": []})]
    await asyncio.gather(marcar("r12", 1, "golpe", **FRENTE), marcar("r12", 3, "golpe", **IZQ))
    assert len(golpes_en_ficha(t, "r12")) == 2
    assert insp(t, "r12")["analysis"]["total_con_repaso"] == 2


@pytest.mark.asyncio(loop_scope="session")
async def test_dos_golpes_a_la_vez_sin_analisis_quedan_los_dos(lenta):
    t = lenta
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    await asyncio.gather(marcar("r12", 1, "golpe", **FRENTE), marcar("r12", 3, "golpe", **IZQ),
                         marcar("r12", 4, "golpe", pieza_clave="retrovisor_der", severity="grave",
                                box_2d=[10, 10, 90, 90]))
    an = insp(t, "r12")["analysis"]
    assert len(golpes_en_ficha(t, "r12")) == 3 and an["total_damages_count"] == 3 and an["severity"] == "grave"


@pytest.mark.asyncio(loop_scope="session")
async def test_la_ia_escribiendo_su_analisis_no_se_lleva_un_golpe_marcado_a_la_vez(lenta):
    t = lenta
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)),
                              revision("r12", V, "drv-ana", marca(12), analysis_status="pending")]
    de_la_ia = {"severity": "leve", "total_damages_count": 1, "new_damages": [],
                "damages": [{"part": "Faro delantero izquierdo", "severity": "leve", "photo_index": 1}]}
    await asyncio.gather(
        server._escribir_analisis_ia("r12", de_la_ia, {"analysis_status": "ok"}),
        marcar("r12", 3, "golpe", **IZQ))
    an = insp(t, "r12")["analysis"]
    assert [d["part"] for d in an["damages"]] == ["Faro delantero izquierdo", "Puerta lateral corredera izquierda"]
    assert an["severity"] == "leve" and an["total_damages_count"] == 1 and an["total_con_repaso"] == 2
    assert insp(t, "r12")["analysis_status"] == "ok"


@pytest.mark.asyncio(loop_scope="session")
async def test_marcar_y_deshacer_a_la_vez_no_deja_golpe_fantasma(t, monkeypatch):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    original = server._repaso_libro

    async def con_deshacer_en_medio(*a, **k):
        # Otra persona pulsa «deshacer» en ese lado justo mientras el primero apunta el golpe en el libro.
        await deshacer("r12", 3)
        return await original(*a, **k)
    monkeypatch.setattr(server, "_repaso_libro", con_deshacer_en_medio)
    with falla(409, "se ha deshecho mientras se guardaba"):
        await marcar("r12", 3, "golpe", **IZQ)
    assert "3" not in (insp(t, "r12").get("repaso") or {}).get("lados", {})
    assert golpes_en_ficha(t, "r12") == [] and t["vehicle_damage_ledger"].docs == []


@pytest.mark.asyncio(loop_scope="session")
async def test_deshacer_un_lado_mientras_otro_completa_no_la_deja_completa(t, monkeypatch):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    for pi in (1, 2, 3):
        await marcar("r12", pi, "igual")
    original = server._repaso_puede_dar_por_revisada

    async def con_deshacer_en_medio(insp_doc):
        # Mientras se cierra la revisión (ya leída con los cuatro lados), otra persona deshace el lado 1.
        await t["inspections"].update_one({"id": "r12"}, {"$unset": {"repaso.lados.1": ""}})
        return await original(insp_doc)
    monkeypatch.setattr(server, "_repaso_puede_dar_por_revisada", con_deshacer_en_medio)
    r = await marcar("r12", 4, "igual")
    d = insp(t, "r12")
    assert d["repaso"].get("completo") is not True and d.get("reviewed") is not True
    assert r["estado"] == "a_medias" and r["cuentas_revision"]["con_veredicto"] == 3


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("valor", ["inf", "1e999", "-Infinity", "NaN", "2.9", "2.5", "tres"])
async def test_deshacer_con_un_numero_raro_da_400(t, valor):
    t["inspections"].docs.append(revision("r12", V, "drv-ana", marca(12)))
    await marcar("r12", 2, "igual")
    with falla(400, "photo_index debe ser un numero"):
        await deshacer("r12", valor)
    assert insp(t, "r12")["repaso"]["lados"]["2"]["veredicto"] == "igual"


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("valor", [float("inf"), float("-inf"), float("nan"), 2.9, "2.9", "1e999", 10 ** 400, True])
async def test_marcar_con_un_numero_raro_da_400_y_no_marca_otro_lado(t, valor):
    t["inspections"].docs.append(revision("r12", V, "drv-ana", marca(12)))
    with falla(400, "photo_index debe ser un numero"):
        await marcar("r12", valor, "igual")
    assert "repaso" not in insp(t, "r12")


@pytest.mark.asyncio(loop_scope="session")
async def test_un_entero_escrito_como_decimal_si_vale(t):
    t["inspections"].docs.append(revision("r12", V, "drv-ana", marca(12)))
    assert (await marcar("r12", 2.0, "igual"))["lado"]["photo_index"] == 2
    assert (await deshacer("r12", "2"))["photo_index"] == 2


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("caja", [[0, 0, float("inf"), 10], [0, float("nan"), 10, 10], [0, 0, 10, 1e999],
                                  [0, 0, 10, 10 ** 400], [0, 0, float("-inf"), 10]])
async def test_una_caja_con_infinitos_da_400(t, caja):
    t["inspections"].docs.append(revision("r12", V, "drv-ana", marca(12)))
    with falla(400, "Dibuja la caja"):
        await marcar("r12", 3, "golpe", **{**IZQ, "box_2d": caja})
    assert "repaso" not in insp(t, "r12") and t["vehicle_damage_ledger"].docs == []


def test_entero_general_no_revienta_con_infinitos():
    from fastapi import HTTPException
    for valor in ("inf", "1e999", float("inf")):
        with pytest.raises(HTTPException) as e:
            server._entero(valor, "n")
        assert e.value.status_code == 400


@pytest.mark.asyncio(loop_scope="session")
async def test_deshacer_deja_el_analisis_de_la_ia_exactamente_igual(t):
    ia = {"severity": "moderado", "total_damages_count": 1, "new_damages": [],
          "damages": [{"part": "Paragolpes trasero", "severity": "moderado", "description": "", "photo_index": 2}]}
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)),
                              revision("r12", V, "drv-ana", marca(12), analysis=copy.deepcopy(ia))]
    await marcar("r12", 3, "golpe", **IZQ)
    await marcar("r12", 1, "golpe", **FRENTE)
    await deshacer("r12", 3)
    await deshacer("r12", 1)
    assert insp(t, "r12")["analysis"] == ia
    # Sin severidad de la IA (análisis antiguo), tampoco se inventa un «sin_danos».
    ia2 = {"total_damages_count": 0, "damages": [], "new_damages": []}
    insp(t, "r12")["analysis"] = copy.deepcopy(ia2)
    await marcar("r12", 3, "golpe", **IZQ)
    await deshacer("r12", 3)
    assert insp(t, "r12")["analysis"] == ia2
