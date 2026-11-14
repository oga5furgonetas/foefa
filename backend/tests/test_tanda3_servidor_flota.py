# -*- coding: utf-8 -*-
"""«Antes del perito», tercera tanda (14-11-2026): lo que ve la flota que YA usa el producto (S6-S11).

Las pruebas del revisor «flota» (segunda revisión), dadas la vuelta y con el resultado del servidor de antes de la
tanda (ec5da88) como medida donde no se ha decidido otra cosa:

· S6  La IA no repite cada día la misma escalada sobre una pieza que confirmó una persona: [1, 0, 0], como antes,
      sin pisar la gravedad que puso la persona.
· S7  «Origen de daños»: lo que solo marcó la IA, como mucho «media»; lo de «Revisión rápida», la regla de siempre
      con los motivos de hecho; lo del repaso, la regla del expediente. 10 furgonetas: 6 confirmadas «alta», 4 de la
      IA «media». Cada fila lleva `confirmado`.
· S8  /repaso/pendientes lleva `avisar` (R7).
· S9  El expediente lleva `posibles_ia` (R8): lo que marcó la IA y nadie ha decidido, aparte.
· S10 Los planes no nombran la IA.
· S11 La migración de permisos da «repaso» también a quien solo tenía «revision».

Con la base de mentira (base_de_mentira.py), sin MongoDB. Matrículas y nombres inventados.
"""
from datetime import datetime, timedelta, timezone

import pytest

import server
from base_de_mentira import Col, Db
from test_perito_repaso import MARTA, insp, marca, marcar, revision, t  # noqa: F401

V = "veh-5678"
ADMIN = {"sub": "u-marta", "role": "admin", "name": "Marta R."}
VISTAS = ["frontal", "trasera", "lateral_izq", "lateral_der", "odometro"]


# ── S6: la misma escalada, una vez ────────────────────────────────────────────

@pytest.fixture
def escalada(monkeypatch):
    base = Db()
    base["vehicles"] = Col([{"id": V, "license_plate": "5678 KLM", "center": "OGA5", "status": "active"}])
    base["inspections"] = Col([
        {"id": r, "vehicle_id": V, "driver_id": "drv-ana", "created_at": f"2026-11-{d}T07:00:00+00:00"}
        for r, d in (("r11", 11), ("r12", 12), ("r13", 13))])
    base["vehicle_damage_ledger"] = Col([{
        "vehicle_id": V, "panel": server._canon_panel("Puerta lateral"), "status": "open", "part": "Puerta lateral",
        "source": "human", "severity": "leve", "rank": 1, "first_seen": "2026-10-01",
        "first_seen_inspection": "r-vieja"}])
    base["ai_feedback"] = Col([])
    monkeypatch.setattr(server, "db", base)

    async def vacio(*a, **k):
        return {}
    monkeypatch.setattr(server, "_ia_fiabilidad_piezas", vacio)
    return base


async def _tres_revisiones(gravedad):
    nuevos, marcados = [], []
    for rid in ("r11", "r12", "r13"):
        dano = dict(part="Puerta lateral", severity=gravedad, description="abolladura", confidence=0.97)
        an = server.InspectionAnalysis(new_damages=[server.Damage(**dano)], damages=[server.Damage(**dano)])
        await server._apply_vehicle_memory(V, an, inspection_id=rid)
        nuevos.append(len(an.new_damages))
        marcados.append([d.is_new for d in an.damages])
    return nuevos, marcados


@pytest.mark.asyncio(loop_scope="session")
async def test_la_escalada_sobre_lo_de_una_persona_sale_una_vez(escalada):
    nuevos, marcados = await _tres_revisiones("grave")
    assert nuevos == [1, 0, 0], nuevos                       # el servidor viejo: [1, 0, 0]; la segunda tanda: [1, 1, 1]
    assert marcados == [[True], [False], [False]]
    (e,) = escalada["vehicle_damage_ledger"].docs
    # La persona manda: su pieza, su gravedad y su rango no se tocan. Lo que vio la IA, aparte.
    assert (e["source"], e["severity"], e["rank"], e["part"]) == ("human", "leve", 1, "Puerta lateral")
    assert e["rank_ia"] == 3


@pytest.mark.asyncio(loop_scope="session")
async def test_un_grado_mas_sobre_lo_de_una_persona_es_el_mismo_golpe(escalada):
    """Tolerancia de ±1 grado (otra foto, otro ángulo): conocido desde el primer día, como siempre."""
    nuevos, _ = await _tres_revisiones("moderado")
    assert nuevos == [0, 0, 0]
    (e,) = escalada["vehicle_damage_ledger"].docs
    assert (e["severity"], e["rank"], e["rank_ia"]) == ("leve", 1, 2)


@pytest.mark.asyncio(loop_scope="session")
async def test_si_la_ia_lo_ve_aun_peor_vuelve_a_avisar_una_vez(escalada):
    await _tres_revisiones("grave")
    dano = dict(part="Puerta lateral", severity="critico", description="hundida", confidence=0.97)
    nuevos = []
    for rid in ("r14", "r15"):
        an = server.InspectionAnalysis(new_damages=[server.Damage(**dano)])
        await server._apply_vehicle_memory(V, an, inspection_id=rid)
        nuevos.append(len(an.new_damages))
    assert nuevos == [0, 0]                                  # crítico es +1 sobre grave: el mismo golpe


@pytest.mark.asyncio(loop_scope="session")
async def test_la_escalada_sobre_lo_de_la_ia_sigue_como_siempre(escalada):
    """Control: una entrada de la IA se consolida con la gravedad mayor, como antes de la tanda."""
    escalada["vehicle_damage_ledger"].docs[0]["source"] = "ai"
    nuevos, _ = await _tres_revisiones("grave")
    assert nuevos == [1, 0, 0]
    (e,) = escalada["vehicle_damage_ledger"].docs
    assert (e["source"], e["severity"], e["rank"]) == ("ai", "grave", 3) and "rank_ia" not in e


# ── S7: «Origen de daños» ─────────────────────────────────────────────────────

def _rev(rid, vid, dia, danos=None, did="drv-ana"):
    roles = ["odometer" if v == "odometro" else "angle" for v in VISTAS]
    an = {"severity": "moderado", "damages": danos, "new_damages": danos} if danos else None
    return {"id": rid, "vehicle_id": vid, "driver_id": did, "created_at": dia + "T07:00:00.000000+00:00",
            "photos": [f"/f/{rid}-{v}.jpg" for v in VISTAS], "photo_roles": roles, "photo_vistas": VISTAS,
            "analysis_status": "ok", "analysis": an}


@pytest.fixture
def flota(monkeypatch):
    """La prueba del revisor: 10 furgonetas; en cada una, Ana hizo la revisión del día anterior y la del golpe
    (moderado). En 6 lo confirmó una persona en «Revisión rápida»; en 4 solo lo marcó la IA."""
    hoy = datetime.now(timezone.utc).date()
    d11, d12 = (hoy - timedelta(days=3)).isoformat(), (hoy - timedelta(days=2)).isoformat()
    base = Db()
    veh, ins, libro = [], [], []
    for n in range(10):
        vid = f"veh-{n}"
        veh.append({"id": vid, "license_plate": f"{1000 + n} KLM", "center": "OGA5", "status": "active"})
        dano = {"part": "Puerta lateral corredera izquierda", "severity": "moderado", "photo_index": 3,
                "box_2d": [400, 200, 600, 450], "confidence": 0.9}
        ins += [_rev(f"a{n}", vid, d11), _rev(f"b{n}", vid, d12, [dano])]
        libro.append({"vehicle_id": vid, "panel": server._canon_panel(dano["part"]), "status": "open",
                      "part": dano["part"], "severity": "moderado", "rank": 2,
                      "source": "human" if n < 6 else "ai", "first_seen": d12, "first_seen_inspection": f"b{n}",
                      "_id": f"l{n}"})
    base["vehicles"] = Col(veh)
    base["inspections"] = Col(ins)
    base["vehicle_damage_ledger"] = Col(libro)
    base["drivers"] = Col([{"id": "drv-ana", "name": "Ana L.", "email": "ana@ejemplo.test", "center": "OGA5"},
                           {"id": "drv-luis", "name": "Luis P.", "email": "luis@ejemplo.test", "center": "OGA5"}])
    base["ai_feedback"] = Col([])
    base["daily_assignments"] = Col([])
    monkeypatch.setattr(server, "db", base)
    return base


def _cuenta(filas):
    c = {}
    for f in filas:
        c[(f["confirmado"], f["certeza"])] = c.get((f["confirmado"], f["certeza"]), 0) + 1
    return c


@pytest.mark.asyncio(loop_scope="session")
async def test_origen_nunca_da_mas_certeza_a_la_ia_sola_que_a_una_persona(flota):
    o = await server.danos_atribucion(center="", dias=120, solo_alta=False, _=ADMIN)
    assert o["resumen"] == {"alta": 6, "media": 4, "baja": 0}
    assert _cuenta(o["danos"]) == {(True, "alta"): 6, (False, "media"): 4}
    for f in o["danos"]:
        if not f["confirmado"]:
            assert f["motivo"] == "solo lo marcó la IA: nadie lo ha confirmado"
        else:
            assert f["conductores"] == [{"id": "drv-ana", "nombre": "Ana L."}] and not f["motivo"]


@pytest.mark.asyncio(loop_scope="session")
async def test_lo_de_revision_rapida_baja_por_los_motivos_de_hecho(flota):
    """Con otra persona entre las dos fotos de ese lado («varios_conductores»), lo confirmado deja de ser «alta»."""
    b0 = insp(flota, "b0")
    flota["inspections"].docs.append(_rev("x0", "veh-0", b0["created_at"][:10], did="drv-luis"))
    flota["inspections"].docs[-1]["created_at"] = b0["created_at"].replace("T07:", "T06:")
    o = await server.danos_atribucion(center="", dias=120, solo_alta=False, _=ADMIN)
    f0 = next(f for f in o["danos"] if f["vehicle_id"] == "veh-0")
    assert f0["confirmado"] is True and f0["certeza"] == "media"


@pytest.mark.asyncio(loop_scope="session")
async def test_lo_de_la_ia_sola_que_ya_era_media_o_baja_no_cambia(flota):
    for n in (6, 7):
        flota["inspections"].docs = [i for i in flota["inspections"].docs if i["id"] != f"a{n}"]
    o = await server.danos_atribucion(center="", dias=120, solo_alta=False, _=ADMIN)
    for n in (6, 7):
        f = next(x for x in o["danos"] if x["vehicle_id"] == f"veh-{n}")
        assert f["certeza"] == "baja" and f["motivo"] == "no hay ninguna foto anterior sin ese golpe"


@pytest.mark.asyncio(loop_scope="session")
async def test_un_golpe_del_repaso_sigue_la_regla_entera_del_expediente(t):
    """Golpe del repaso con la foto anterior de ese lado sin repasar: «media», como dice el expediente."""
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    await marcar("r12", 3, "golpe", pieza_clave="corredera_izq", severity="moderado", box_2d=[410, 220, 640, 470])
    o = await server.danos_atribucion(center="", dias=400, solo_alta=False, _=ADMIN)
    (f,) = o["danos"]
    assert f["confirmado"] is True and f["certeza"] == "media" and "nadie marcó como igual" in f["motivo"]


# ── S8 / R7: el número del menú ───────────────────────────────────────────────

@pytest.fixture
def menu(t, monkeypatch):
    monkeypatch.setattr(server, "_REPASO_USADO", set())
    monkeypatch.setattr(server, "_REPASO_MIRADO", set())
    return t


@pytest.mark.asyncio(loop_scope="session")
async def test_avisar_no_persigue_a_quien_usa_revision_rapida(menu):
    menu["inspections"].docs.append(revision("r14", V, "drv-ana", marca(14)))
    r = await server.repaso_pendientes(center=None, user=MARTA)
    assert r == {"fecha": "2026-11-14", "pendientes": 1, "avisar": False, "revisiones": 1, "repasadas": 0, "golpes": 0}
    # En cuanto alguien da un veredicto, sí, y para siempre (aunque se deshaga).
    await marcar("r14", 1, "igual")
    assert (await server.repaso_pendientes(center=None, user=MARTA))["avisar"] is True
    await server.repaso_deshacer_lado("r14", "1", user=MARTA)
    assert (await server.repaso_pendientes(center=None, user=MARTA))["avisar"] is True
    assert menu["app_meta"].docs == [{"_id": "repaso_usado", "en": menu["app_meta"].docs[0]["en"]}]


@pytest.mark.asyncio(loop_scope="session")
async def test_avisar_se_entera_por_la_marca_que_deja_otro_proceso(menu):
    menu["app_meta"].docs.append({"_id": "repaso_usado", "en": "2026-11-14T08:00:00+00:00"})
    assert (await server.repaso_pendientes(center=None, user=MARTA))["avisar"] is True


@pytest.mark.asyncio(loop_scope="session")
async def test_avisar_con_veredictos_de_antes_de_la_marca(menu):
    menu["inspections"].docs.append(revision("r13", V, "drv-ana", marca(13),
                                             repaso={"lados": {"1": {"veredicto": "igual"}}}))
    assert (await server.repaso_pendientes(center=None, user=MARTA))["avisar"] is True


@pytest.mark.asyncio(loop_scope="session")
async def test_avisar_es_barato_las_revisiones_se_miran_una_vez(menu):
    vistas = []
    original = menu["inspections"].find_one

    async def contar(q=None, *a, **k):
        if q == {"repaso.lados": {"$exists": True}}:
            vistas.append(1)
        return await original(q, *a, **k)
    menu["inspections"].find_one = contar
    for _ in range(5):
        assert (await server.repaso_pendientes(center=None, user=MARTA))["avisar"] is False
    assert len(vistas) == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_ia_avisar_siempre(menu, monkeypatch):
    async def nueva(_o):
        return {"id": "org-nueva", "ia_danos": False}
    monkeypatch.setattr(server, "get_org", nueva)
    monkeypatch.delenv("IA_DANOS_DE_PAGO", raising=False)
    r = await server.repaso_pendientes(center=None, user={**MARTA, "org_id": "org-nueva"})
    assert r["avisar"] is True


# ── S9 / R8: `posibles_ia` en el expediente ───────────────────────────────────

IA_PUERTA = {"part": "Puerta lateral corredera izquierda", "severity": "moderado", "photo_index": 3,
             "box_2d": [400, 200, 600, 450], "confidence": 0.8, "is_new": True}
IA_CAPO = {"part": "Capó", "severity": "leve", "photo_index": 1, "box_2d": [100, 100, 300, 300], "confidence": 0.6,
           "is_new": True}


def _an(*danos):
    return {"severity": "moderado", "total_damages_count": len(danos), "damages": [dict(d) for d in danos],
            "new_damages": [dict(d) for d in danos]}


@pytest.mark.asyncio(loop_scope="session")
async def test_posibles_ia_lo_que_nadie_ha_decidido_aparte(t, monkeypatch):
    async def nada(*a, **k):
        return None
    monkeypatch.setattr(server, "_ia_reentrenar_si_toca", nada)
    t["inspections"].docs += [
        revision("r10", V, "drv-ana", marca(10), analysis=_an(IA_CAPO)),          # la primera: sin anterior
        revision("r11", V, "drv-ana", marca(11), analysis=_an(IA_PUERTA)),         # con anterior (la del 10)
        revision("r12", V, "drv-luis", marca(12), analysis=_an(IA_PUERTA, IA_CAPO)),
        revision("r13", V, "drv-luis", marca(13), analysis=_an(IA_CAPO), deleted=True),
    ]
    # El 12: alguien confirma el capó en «Revisión rápida» y descarta... nada; en el repaso marca la puerta.
    await server.damage_feedback("r12", {"verdict": "correct", "damage_index": 1, "scope": "new"}, user=MARTA)
    await marcar("r12", 3, "golpe", pieza_clave="corredera_izq", severity="moderado", box_2d=[410, 220, 640, 470])
    exp = await server.expediente_antes_del_perito(V, user=MARTA)
    p = exp["posibles_ia"]
    assert [(x["inspeccion_id"], x["pieza"]) for x in p] == [("r11", "Puerta lateral corredera izquierda"),
                                                          ("r10", "Capó")]
    assert exp["posibles_ia_mas"] == 0
    r11, r10 = p
    assert set(r11) == {"inspeccion_id", "fecha", "pieza", "vista", "foto_url", "box_2d", "anterior"}
    assert r11["vista"] == "lateral_izq" and r11["foto_url"] == "/fotos/r11-lateral_izq.jpg"
    assert r11["box_2d"] == [400, 200, 600, 450] and r11["fecha"].startswith("2026-11-11T07:00:00")
    assert r11["anterior"] == {"foto_url": "/fotos/r10-lateral_izq.jpg", "fecha": r10["fecha"]}
    assert r10["anterior"] is None
    # No cuentan en nada: ni en las cuentas, ni en el calendario, ni como golpe.
    assert exp["cuentas"]["golpes"] == len(exp["golpes"]) == 2
    assert {g["origen"] for g in exp["golpes"]} == {"repaso", "revision_rapida"}
    assert "conductor" not in str(p) and "gravedad" not in str(p)


@pytest.mark.asyncio(loop_scope="session")
async def test_posibles_ia_sin_lo_descartado_ni_lo_ya_registrado(t):
    descartado = {**IA_CAPO, "veredicto_ia": "descartado"}
    conocido = {**IA_PUERTA, "is_new": False}
    t["inspections"].docs += [revision("r10", V, "drv-ana", marca(10), analysis=_an(descartado, conocido)),
                              revision("r11", V, "drv-ana", marca(11), analysis=_an(IA_PUERTA))]
    t["ai_feedback"].docs.append({"inspection_id": "r11", "vehicle_id": V, "scope": "new", "damage_index": 0,
                                  "verdict": "wrong"})
    assert (await server.expediente_antes_del_perito(V, user=MARTA))["posibles_ia"] == []


@pytest.mark.asyncio(loop_scope="session")
async def test_posibles_ia_como_mucho_60(t):
    t["inspections"].docs += [revision(f"r{k:03d}", V, "drv-ana", f"2026-10-01T07:{k // 60:02d}:{k % 60:02d}.000000+00:00",
                                       analysis=_an(IA_CAPO)) for k in range(65)]
    exp = await server.expediente_antes_del_perito(V, user=MARTA)
    assert len(exp["posibles_ia"]) == 60 and exp["posibles_ia_mas"] == 5
    assert exp["posibles_ia"][0]["inspeccion_id"] == "r064"                  # del más reciente al más antiguo


@pytest.mark.asyncio(loop_scope="session")
async def test_posibles_ia_vacia_sin_la_ia(t, monkeypatch):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11), analysis=_an(IA_PUERTA))]

    async def nueva(_o):
        return {"id": "org-nueva", "ia_danos": False}
    monkeypatch.setattr(server, "get_org", nueva)
    monkeypatch.delenv("IA_DANOS_DE_PAGO", raising=False)
    exp = await server.expediente_antes_del_perito(V, user={**MARTA, "org_id": "org-nueva"})
    assert exp["posibles_ia"] == [] and exp["posibles_ia_mas"] == 0


# ── S10: los planes no nombran la IA ──────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_ningun_plan_nombra_la_ia(monkeypatch):
    async def cat(forzar=False):
        return server._catalogo_por_defecto()
    monkeypatch.setattr(server, "_catalogo_planes", cat)
    r = await server.billing_planes()
    for p in r["planes"]:
        for x in p["incluye"] + p["no_incluye"]:
            assert "IA" not in x.replace(",", " ").replace(".", " ").split(), (p["clave"], x)
            assert "Revisión rápida" not in x, (p["clave"], x)


# ── S11: «repaso» también a quien solo tenía «revision» ───────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_la_migracion_da_repaso_a_quien_solo_hace_revision_rapida(monkeypatch):
    g = Db()
    g["app_meta"] = Col([])
    g["admin_users"] = Col([
        {"id": "u1", "permissions": ["inspecciones"]},
        {"id": "u2", "permissions": ["revision"]},
        {"id": "u3", "permissions": ["revision", "repaso"]},
        {"id": "u4", "permissions": ["vehiculos"]},
        {"id": "u5", "permissions": None},
    ])
    monkeypatch.setattr(server, "global_db", g)
    r = await server._migrar_repaso_a_permisos()
    assert r == {"hecha_antes": False, "usuarios": 2}
    por = {u["id"]: u["permissions"] for u in g["admin_users"].docs}
    assert por == {"u1": ["inspecciones", "repaso"], "u2": ["revision", "repaso"], "u3": ["revision", "repaso"],
                   "u4": ["vehiculos"], "u5": None}
    assert (await server._migrar_repaso_a_permisos())["hecha_antes"] is True
