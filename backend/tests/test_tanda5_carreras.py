# -*- coding: utf-8 -*-
"""Las carreras del libro que quedaban (14-11-2026, tercera revisión, servidor3 MENOR 1).

Dos personas, en la misma furgoneta, con acciones contradictorias en el mismo instante. Cada prueba cruza las dos con
0..15 cesiones de turno antes de la segunda (`ColLenta` cede el turno en cada lectura y escritura), para pasar por
todas las llegadas:

  1. deshacer un golpe  ||  repararlo desde la ficha con coste: antes, las dos decían que sí y el coste se perdía.
  2. deshacer un golpe  ||  «reparar pieza»: antes quedaba una entrada reparada de un golpe que ya no existía.
  3. marcar un golpe que se enlaza  ||  «reparar pieza»: antes el golpe nuevo quedaba huérfano (enlazado a una entrada
     cerrada y sin reparar en su ficha).
  4. «Reconstruir flota»  ||  deshacer: antes la entrada vieja de la IA volvía ABIERTA.

Los arreglos: `repaso_deshacer_lado` solo quita el lado si el daño de la ficha sigue sin taller ni reparación, y no
deja nada a medias si el taller o «reparar pieza» se cuelan; `vehicle_ledger_repair` cierra entrada a entrada con una
escritura que devuelve lo que ha cerrado; `rebuild_fleet_damages` y `_repaso_libro_soltar` no dejan abierta lo viejo
de la IA. Base de mentira, sin MongoDB; matrículas y nombres inventados."""
import asyncio
import copy

import pytest

import server
from base_de_mentira import Col, Cursor
from test_perito_repaso import MARTA, HOY, insp, marca, marcar, deshacer, revision, mundo_base

V = "veh-5678"
G1 = {"pieza_clave": "corredera_izq", "severity": "moderado", "box_2d": [410, 220, 640, 470]}   # lado 3
G2 = {"pieza_clave": "puerta_del_der", "severity": "leve", "box_2d": [300, 100, 500, 300]}      # lado 4
ESPERAS = list(range(0, 16))


class ColLenta(Col):
    """Cede el turno en cada lectura y escritura, y devuelve copias (como Mongo): así dos peticiones se cruzan."""
    async def find_one(self, *a, **k):
        r = copy.deepcopy(await super().find_one(*a, **k))
        await asyncio.sleep(0)
        return r

    async def update_one(self, *a, **k):
        await asyncio.sleep(0)
        return await super().update_one(*a, **k)

    async def update_many(self, *a, **k):
        await asyncio.sleep(0)
        return await super().update_many(*a, **k)

    async def find_one_and_update(self, *a, **k):
        await asyncio.sleep(0)
        return await super().find_one_and_update(*a, **k)

    def find(self, *a, **k):
        cur = super().find(*a, **k)
        orig = cur.to_list

        async def to_list(n=None):
            r = copy.deepcopy(await orig(n))
            await asyncio.sleep(0)
            return r
        cur.to_list = to_list
        return cur


@pytest.fixture
def base(monkeypatch):
    b = mundo_base()
    for k in ("inspections", "vehicle_damage_ledger"):
        b[k] = ColLenta([])
    monkeypatch.setattr(server, "db", b)
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)

    async def _sin_empresa(_o):
        return None
    monkeypatch.setattr(server, "get_org", _sin_empresa)

    async def nada(*a, **k):
        return None
    monkeypatch.setattr(server, "_ia_reentrenar_si_toca", nada)
    return b


async def tras(n, coro):
    for _ in range(n):
        await asyncio.sleep(0)
    return await coro


def golpes_ficha(b, rid):
    return [d for d in (insp(b, rid).get("analysis") or {}).get("damages") or [] if d.get("origen") == "repaso"]


def lado_de(b, rid, pi):
    return ((insp(b, rid).get("repaso") or {}).get("lados") or {}).get(str(pi))


async def _r11_igual_y_golpe_en_r12(b):
    b["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    for pi in (1, 2, 3, 4):
        await marcar("r11", pi, "igual")
    return await marcar("r12", 3, "golpe", **G1)


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("espera", ESPERAS)
async def test_deshacer_y_reparar_con_coste_a_la_vez_no_pierde_el_coste(base, espera):
    a = await _r11_igual_y_golpe_en_r12(base)
    gid = a["lado"]["golpe"]["golpe_id"]
    k = next(i for i, d in enumerate(insp(base, "r12")["analysis"]["damages"]) if d.get("golpe_id") == gid)
    res = await asyncio.gather(
        deshacer("r12", 3),
        tras(espera, server.update_damage("r12", k, {"repair_status": "done", "actual_cost": 90}, _=MARTA)),
        return_exceptions=True)
    d_ok, r_ok = not isinstance(res[0], Exception), not isinstance(res[1], Exception)
    g, lado = golpes_ficha(base, "r12"), lado_de(base, "r12", 3)
    assert not (d_ok and r_ok), "las dos dicen que sí: el coste del taller se guarda y el deshacer lo borra"
    assert d_ok or r_ok, res
    assert bool(g) == bool(lado), (g, lado)
    if r_ok:
        # Ganó el taller: el golpe sigue, reparado y con su coste, y el deshacer contestó 409.
        assert [(x.get("repair_status"), x.get("actual_cost")) for x in g] == [("done", 90)]
        assert res[0].status_code == 409
    else:
        # Ganó el deshacer: el taller contesta 409 (cambió mientras guardaba) o 404 (ya no está).
        assert g == [] and res[1].status_code in (404, 409)
        assert base["vehicle_damage_ledger"].docs == []


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("espera", ESPERAS)
async def test_deshacer_y_reparar_pieza_a_la_vez_no_deja_una_entrada_de_un_golpe_deshecho(base, espera):
    await _r11_igual_y_golpe_en_r12(base)
    res = await asyncio.gather(deshacer("r12", 3),
                               tras(espera, server.vehicle_ledger_repair(V, {"panel": "puerta"}, user=MARTA)),
                               return_exceptions=True)
    assert not isinstance(res[1], Exception), res[1]
    d_ok = not isinstance(res[0], Exception)
    g, lado = golpes_ficha(base, "r12"), lado_de(base, "r12", 3)
    libro = base["vehicle_damage_ledger"].docs
    assert bool(g) == bool(lado), (g, lado)
    if d_ok:
        # Deshecho de verdad: ni en la ficha ni en el libro.
        assert g == [] and libro == [] and res[1]["repaired"] == 0, (g, libro, res[1])
    else:
        # Ganó «reparar pieza»: el golpe sigue, reparado en su ficha, y su entrada cerrada.
        assert res[0].status_code == 409
        assert [x.get("repair_status") for x in g] == ["done"]
        assert [e.get("status") for e in libro] == ["repaired"] and res[1]["repaired"] == 1


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("espera", ESPERAS)
async def test_marcar_un_golpe_que_se_enlaza_y_reparar_pieza_a_la_vez_no_lo_deja_huerfano(base, espera):
    base["inspections"].docs.append(revision("r13", V, "drv-luis", marca(13)))
    await _r11_igual_y_golpe_en_r12(base)
    res = await asyncio.gather(marcar("r13", 4, "golpe", **G2),
                               tras(espera, server.vehicle_ledger_repair(V, {"panel": "puerta"}, user=MARTA)),
                               return_exceptions=True)
    assert not [r for r in res if isinstance(r, Exception)], res
    g13 = golpes_ficha(base, "r13")
    gid13 = g13[0]["golpe_id"]
    abiertas = [e for e in base["vehicle_damage_ledger"].docs if e.get("status") == "open"
                and (e.get("golpe_id") == gid13 or gid13 in (e.get("golpe_ids") or []))]
    # Sigue en «Ya apuntado» (una entrada abierta) o quedó reparado en su ficha con la entrada que lo llevaba.
    assert abiertas or g13[0].get("repair_status") == "done", base["vehicle_damage_ledger"].docs


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("espera", ESPERAS)
async def test_reconstruir_y_deshacer_a_la_vez_no_resucita_lo_viejo_de_la_ia(base, espera):
    base["vehicle_damage_ledger"].docs.append({"vehicle_id": V, "panel": "puerta", "status": "open", "source": "ai",
                                               "part": "Puerta lateral corredera izquierda", "severity": "leve",
                                               "rank": 1, "first_seen": "2026-10-01", "first_seen_inspection": "r00"})
    await _r11_igual_y_golpe_en_r12(base)
    base["inspections"].aggregate = lambda pipeline: Cursor([{"_id": V, "insp_id": "r12"}])
    res = await asyncio.gather(tras(espera, server.rebuild_fleet_damages(_=MARTA)), deshacer("r12", 3),
                               return_exceptions=True)
    assert not [r for r in res if isinstance(r, Exception)], res
    assert not [e for e in base["vehicle_damage_ledger"].docs if e.get("status") == "open"
                and e.get("source") == "ai" and e.get("first_seen_inspection") == "r00"], \
        base["vehicle_damage_ledger"].docs


@pytest.mark.asyncio(loop_scope="session")
async def test_reparar_pieza_cierra_cada_entrada_y_cuenta_las_que_cierra(base):
    """Sin carrera: «reparar pieza» y «todo el vehículo» siguen haciendo lo de siempre."""
    await _r11_igual_y_golpe_en_r12(base)
    base["vehicle_damage_ledger"].docs.append({"vehicle_id": V, "panel": "capo", "status": "open", "source": "ai",
                                               "part": "Capó", "severity": "leve"})
    r = await server.vehicle_ledger_repair(V, {"panel": "puerta", "note": "chapa"}, user=MARTA)
    assert r == {"ok": True, "repaired": 1}
    assert [x.get("repair_status") for x in golpes_ficha(base, "r12")] == ["done"]
    r = await server.vehicle_ledger_repair(V, {"all": True}, user=MARTA)
    assert r == {"ok": True, "repaired": 1}
    assert {e["panel"]: e["status"] for e in base["vehicle_damage_ledger"].docs} == {"puerta": "repaired",
                                                                                      "capo": "repaired"}
