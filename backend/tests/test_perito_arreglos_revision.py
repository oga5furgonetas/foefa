# -*- coding: utf-8 -*-
"""«Antes del perito», arreglos tras la revisión (14-11-2026): el repaso y «Revisión rápida» no se pisan (R5).

· Completar el repaso no saca de «Revisión rápida» una revisión con daños nuevos de la IA sin decidir (ni una con el
  análisis sin terminar): el repaso lleva su propio `repaso.completo`. Sin IA, sí la da por revisada.
· Un golpe del repaso no se valida en «Revisión rápida» como si fuera de la IA: la pantalla lo filtra y
  `damage-feedback` contesta 400.
· El golpe a mano no infla las cuentas de la IA (`total_damages_count`, `severity`) que usa la autorrevisión.
· Deshacer un lado no le quita a la revisión el «revisada» que le puso después una persona en «Revisión rápida».
"""
from pathlib import Path

import pytest

import server
from test_perito_repaso import MARTA, deshacer, falla, insp, marca, marcar, revision, t  # noqa: F401

RAIZ = Path(__file__).resolve().parents[2]
V = "veh-5678"
IA = {"part": "Puerta lateral corredera izquierda", "severity": "leve", "description": "lo ve la IA",
      "photo_index": 3, "box_2d": [400, 200, 600, 450], "is_new": True, "confirmed": True}


def con_ia(rid, dia, **extra):
    return revision(rid, V, "drv-ana", marca(dia), analysis={
        "severity": "leve", "total_damages_count": 1, "damages": [dict(IA)], "new_damages": [dict(IA)]}, **extra)


async def cola():
    return [x["id"] for x in (await server.get_review_queue(center=None, user=MARTA))["queue"]]


@pytest.fixture
def sin_reentrenar(monkeypatch):
    async def nada(*a, **k):
        return None
    monkeypatch.setattr(server, "_ia_reentrenar_si_toca", nada)


@pytest.mark.asyncio(loop_scope="session")
async def test_completar_el_repaso_no_saca_de_revision_rapida_lo_que_la_ia_no_ha_decidido(t, sin_reentrenar):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11), reviewed=True), con_ia("r12", 12)]
    t["vehicle_damage_ledger"].docs.append({"vehicle_id": V, "panel": "puerta", "status": "open", "source": "ai",
                                            "part": IA["part"], "severity": "leve", "rank": 1,
                                            "first_seen": "2026-11-12", "first_seen_inspection": "r12"})
    assert "r12" in await cola()
    for pi in (1, 2, 3, 4):
        r = await marcar("r12", pi, "igual")
    assert r["estado"] == "repasada"
    d = insp(t, "r12")
    assert d["repaso"]["completo"] is True and d["repaso"]["marco_revisada"] is False
    assert d.get("reviewed") is not True and "r12" in await cola()      # sigue allí para que alguien decida
    # El repaso del día la cuenta como repasada (cuenta con sus lados, no con `reviewed`).
    dia = await server.repaso_del_dia(fecha="2026-11-12", center=None, user=MARTA)
    assert dia["cuentas"]["repasadas"] == 1
    # Cuando alguien decide el daño de la IA en «Revisión rápida», ya no queda nada: un lado más deshecho y vuelto
    # a marcar la cierra del todo.
    await server.damage_feedback("r12", {"verdict": "wrong", "damage_index": 0, "scope": "new"}, user=MARTA)
    await deshacer("r12", 4)
    await marcar("r12", 4, "igual")
    d = insp(t, "r12")
    assert d["reviewed"] is True and d["reviewed_motivo"] == "repaso" and "r12" not in await cola()


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("estado", ["pending", "error", "gemini_failed"])
async def test_con_el_analisis_sin_terminar_tampoco(t, estado):
    t["inspections"].docs.append(revision("r12", V, "drv-ana", marca(12), analysis_status=estado))
    for pi in (1, 2, 3, 4):
        await marcar("r12", pi, "igual")
    d = insp(t, "r12")
    assert d["repaso"]["completo"] is True and d.get("reviewed") is not True


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("estado", ["sin_ia", "plan_disabled", "ok"])
async def test_sin_nada_que_decidir_de_la_ia_si_la_da_por_revisada(t, estado):
    t["inspections"].docs.append(revision("r12", V, "drv-ana", marca(12), analysis_status=estado))
    for pi in (1, 2, 3, 4):
        await marcar("r12", pi, "igual")
    d = insp(t, "r12")
    assert d["reviewed"] is True and d["repaso"]["marco_revisada"] is True


@pytest.mark.asyncio(loop_scope="session")
async def test_deshacer_no_quita_lo_que_marco_despues_revision_rapida(t, monkeypatch):
    monkeypatch.setattr(server, "_repaso_ahora", lambda: "2026-11-12T09:00:00+00:00")
    t["inspections"].docs.append(revision("r12", V, "drv-ana", marca(12)))
    for pi in (1, 2, 3, 4):
        await marcar("r12", pi, "igual")
    # Después, alguien la marca revisada en «Revisión rápida» (la ruta de siempre: cambia `reviewed_at`).
    await server.mark_inspection_reviewed("r12", _=MARTA)
    marcada_at = insp(t, "r12")["reviewed_at"]
    await deshacer("r12", 2)
    d = insp(t, "r12")
    assert d["repaso"]["completo"] is False
    assert (d["reviewed"], d["reviewed_at"]) == (True, marcada_at)
    # (Sin nadie en medio, deshacer la devuelve a como estaba: test_perito_repaso.py, «deshacer una que no estaba
    # revisada la deja sin reviewed».)


@pytest.mark.asyncio(loop_scope="session")
async def test_un_golpe_del_repaso_no_se_valida_como_de_la_ia(t, sin_reentrenar):
    # Revisión sin análisis de la IA: el golpe de la persona es el único daño (y `new_damages` va vacío, así que
    # «Revisión rápida» miraría `damages`).
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)),
                              revision("r12", V, "drv-ana", marca(12), analysis_status="error")]
    await marcar("r12", 3, "golpe", pieza_clave="corredera_izq", severity="moderado", box_2d=[410, 220, 640, 470])
    for verdict in ("wrong", "correct"):
        with falla(400, "lo marcó una persona en el repaso"):
            await server.damage_feedback("r12", {"verdict": verdict, "damage_index": 0, "scope": "all"}, user=MARTA)
    assert t["ai_feedback"].docs == []
    # Y la pantalla no lo ofrece (la única línea de RevisionRapida.jsx que toca esta tanda).
    fuente = (RAIZ / "frontend" / "src" / "panel" / "pages" / "RevisionRapida.jsx").read_text("utf-8")
    assert "d?.origen === 'repaso'" in fuente.split("const isKnownDamage")[1].split("\n")[0]


@pytest.mark.asyncio(loop_scope="session")
async def test_el_golpe_a_mano_no_cuenta_dos_veces_lo_que_la_ia_ya_traia(t):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), con_ia("r12", 12)]
    await marcar("r12", 3, "golpe", pieza_clave="corredera_izq", severity="grave", box_2d=[410, 220, 640, 470])
    an = insp(t, "r12")["analysis"]
    # Las cuentas de la IA (las que lee la autorrevisión) siguen siendo las suyas.
    assert (an["severity"], an["total_damages_count"]) == ("leve", 1)
    # Con lo de la persona, aparte: el golpe que la IA ya traía (misma pieza, misma foto) no cuenta dos veces.
    assert (an["severidad_con_repaso"], an["total_con_repaso"]) == ("grave", 1)
    await marcar("r12", 1, "golpe", pieza_clave="paragolpes_del", severity="leve", box_2d=[10, 10, 90, 90])
    assert insp(t, "r12")["analysis"]["total_con_repaso"] == 2
