# -*- coding: utf-8 -*-
"""«Antes del perito» (14-11-2026): el repaso del día y el veredicto de cada lado.

A · GET /api/repaso/dia: las revisiones de ESE día, cada lado con la foto anterior del mismo lado, lo ya apuntado,
    las furgonetas sin revisión y las cuentas. Respeta el centro y los centros permitidos.
B · POST /api/inspections/{id}/repaso y su DELETE: «igual», «no_se_ve» o «golpe». El golpe queda en la revisión
    (`analysis.damages`, confirmado por una persona) y en el libro de la furgoneta; deshacer lo quita todo.

Con la base de mentira (base_de_mentira.py), sin MongoDB. Matrículas y nombres inventados.
"""
import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Db

HOY = "2026-11-14"
MARTA = {"sub": "u-marta", "role": "admin", "name": "Marta R."}
VISTAS = ["frontal", "trasera", "lateral_izq", "lateral_der", "odometro"]
ROLES = ["angle", "angle", "angle", "angle", "odometer"]
PUERTA = {"part": "Puerta lateral corredera izquierda", "severity": "moderado", "box_2d": [410, 220, 640, 470],
          "description": "Bollo con pintura saltada"}


def marca(dia, hora="07:00:00"):
    """Una marca «recibida en el servidor» en UTC, como las guarda la subida."""
    return f"2026-11-{dia:02d}T{hora}.000000+00:00"


def revision(rid, vid, did, creada, vistas=None, **extra):
    vistas = list(vistas or VISTAS)
    roles = ["odometer" if v == "odometro" else "angle" for v in vistas]
    return {"id": rid, "vehicle_id": vid, "driver_id": did, "created_at": creada,
            "photos": [f"/fotos/{rid}-{v}.jpg" for v in vistas], "photo_roles": roles, "photo_vistas": vistas,
            "analysis_status": "ok", "analysis": None, **extra}


def mundo_base():
    t = Db()
    t["vehicles"] = Col([
        {"id": "veh-5678", "license_plate": "5678 KLM", "brand": "Ford", "model": "Transit Custom",
         "center": "OGA5", "status": "active"},
        {"id": "veh-9012", "license_plate": "9012 JMN", "brand": "Renault", "model": "Master",
         "center": "OGA5", "status": "active"},
        {"id": "veh-1234", "license_plate": "1234 BCD", "brand": "", "model": "", "center": "DGA1",
         "status": "active"},
        {"id": "veh-baja", "license_plate": "0001 BBB", "center": "OGA5", "status": "baja"},
    ])
    t["drivers"] = Col([
        {"id": "drv-ana", "name": "Ana L.", "email": "ana@ejemplo.test", "center": "OGA5"},
        {"id": "drv-luis", "name": "Luis P.", "email": "luis@ejemplo.test", "center": "OGA5"},
        {"id": "drv-rosa", "name": "Rosa M.", "email": "rosa@ejemplo.test", "center": "DGA1"},
    ])
    t["inspections"] = Col([])
    t["vehicle_damage_ledger"] = Col([])
    t["daily_assignments"] = Col([])
    t["ai_feedback"] = Col([])
    return t


@pytest.fixture
def t(monkeypatch):
    base = mundo_base()
    monkeypatch.setattr(server, "db", base)
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)
    return base


def insp(t, rid):
    return next(d for d in t["inspections"].docs if d["id"] == rid)


async def marcar(rid, pi, veredicto, user=MARTA, **golpe):
    return await server.repaso_marcar_lado(rid, {"photo_index": pi, "veredicto": veredicto, **golpe}, user=user)


async def deshacer(rid, pi, user=MARTA):
    return await server.repaso_deshacer_lado(rid, str(pi), user=user)


async def todos_igual(rid, menos=()):
    for pi in (1, 2, 3, 4):
        if pi not in menos:
            await marcar(rid, pi, "igual")


def falla(codigo, texto=None):
    class _Falla:
        def __enter__(self):
            self.ctx = pytest.raises(HTTPException)
            self.e = self.ctx.__enter__()
            return self.e

        def __exit__(self, *exc):
            r = self.ctx.__exit__(*exc)
            assert self.e.value.status_code == codigo, self.e.value.detail
            if texto:
                assert texto in self.e.value.detail, self.e.value.detail
            return r
    return _Falla()


# ── A · el repaso del día ─────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_el_dia_trae_solo_las_revisiones_de_ese_dia_y_la_anterior_de_cada_lado(t):
    t["inspections"].docs += [
        revision("r10", "veh-5678", "drv-luis", marca(10)),
        revision("r11", "veh-5678", "drv-ana", marca(11)),
        revision("r12", "veh-5678", "drv-ana", marca(12, "06:58:31")),
        revision("r13", "veh-5678", "drv-ana", marca(13)),
        # A las 23:30 UTC del 11 ya es día 12 en Madrid: es del día 12, no del 11.
        revision("r12-noche", "veh-9012", "drv-luis", "2026-11-11T23:30:00.000000+00:00"),
        # Borrada: no cuenta en nada.
        revision("r12-borrada", "veh-9012", "drv-luis", marca(12), deleted=True),
    ]
    await todos_igual("r11", menos=(2,))
    r = await server.repaso_del_dia(fecha="2026-11-12", center=None, user=MARTA)
    assert r["fecha"] == "2026-11-12" and r["es_hoy"] is False and r["zona"] == "Europe/Madrid"
    assert [x["id"] for x in r["revisiones"]] == ["r12-noche", "r12"]
    r12 = r["revisiones"][1]
    assert r12["hora"] == "07:58" and r12["recibida_at"] == marca(12, "06:58:31")
    assert r12["vehiculo"] == {"id": "veh-5678", "matricula": "5678 KLM", "modelo": "Ford Transit Custom",
                               "centro": "OGA5"}
    assert r12["conductor"] == {"id": "drv-ana", "nombre": "Ana L."}
    assert [l["photo_index"] for l in r12["lados"]] == [1, 2, 3, 4]        # el cuentakilómetros no es un lado
    frontal = r12["lados"][0]
    assert frontal["foto_url"] == "/fotos/r12-frontal.jpg"
    assert frontal["anterior"] == {"inspection_id": "r11", "photo_index": 1, "foto_url": "/fotos/r11-frontal.jpg",
                                   "recibida_at": marca(11), "fecha": "2026-11-11", "hora": "08:00",
                                   "conductor": {"id": "drv-ana", "nombre": "Ana L."}, "veredicto": "igual"}
    assert r12["lados"][1]["anterior"]["veredicto"] is None                  # la trasera de ayer nadie la marcó
    assert r12["estado"] == "sin_repasar" and frontal["veredicto"] is None and frontal["golpe"] is None
    # La primera del 12 de la otra furgoneta no tiene anterior: es su primera foto de cada lado.
    assert all(l["anterior"] is None for l in r["revisiones"][0]["lados"])
    assert r["cuentas"]["revisiones"] == 2 and r["cuentas"]["sin_repasar"] == 2


@pytest.mark.asyncio(loop_scope="session")
async def test_la_foto_anterior_es_la_del_mismo_lado_aunque_sea_de_otra_revision(t):
    t["inspections"].docs += [
        revision("r09", "veh-5678", "drv-luis", marca(9)),
        revision("r10", "veh-5678", "drv-luis", marca(10), vistas=["frontal", "odometro"]),
        revision("r12", "veh-5678", "drv-ana", marca(12)),
    ]
    r = await server.repaso_del_dia(fecha="2026-11-12", center="", user=MARTA)
    ant = {l["vista"]: l["anterior"]["inspection_id"] for l in r["revisiones"][0]["lados"]}
    assert ant == {"frontal": "r10", "trasera": "r09", "lateral_izq": "r09", "lateral_der": "r09"}


@pytest.mark.asyncio(loop_scope="session")
async def test_las_viejas_sin_repasar_no_son_deuda_y_sin_revision_lista_las_activas(t):
    t["inspections"].docs += [revision(f"vieja{n}", "veh-9012", "drv-luis", marca(n)) for n in range(1, 11)]
    t["inspections"].docs.append(revision("r12", "veh-5678", "drv-ana", marca(12)))
    t["daily_assignments"].docs.append({"date": "2026-11-12", "center": "OGA5",
                                        "slots": [{"vehicle_id": "veh-9012", "driver_id": "drv-luis"},
                                                  {"vehicle_id": "veh-1234", "driver_id": "drv-borrado"}]})
    r = await server.repaso_del_dia(fecha="2026-11-12", center=None, user=MARTA)
    assert r["cuentas"] == {"revisiones": 1, "repasadas": 0, "a_medias": 0, "sin_repasar": 1, "sin_lados": 0,
                            "con_golpe": 0, "golpes": 0, "furgonetas_activas": 3, "sin_revision": 2}
    assert r["sin_revision"] == [
        {"id": "veh-1234", "matricula": "1234 BCD", "modelo": None, "centro": "DGA1",
         "asignada_a": {"id": "drv-borrado", "nombre": None}},
        {"id": "veh-9012", "matricula": "9012 JMN", "modelo": "Renault Master", "centro": "OGA5",
         "asignada_a": {"id": "drv-luis", "nombre": "Luis P."}},
    ]


@pytest.mark.asyncio(loop_scope="session")
async def test_el_dia_respeta_el_centro_y_los_centros_permitidos(t):
    t["inspections"].docs += [revision("oga", "veh-5678", "drv-ana", marca(12)),
                              revision("dga", "veh-1234", "drv-rosa", marca(12, "08:00:00")),
                              # Furgoneta de DGA1 que llevó alguien de OGA5: la ven los dos centros.
                              revision("cruzada", "veh-1234", "drv-ana", marca(12, "09:00:00"))]
    r = await server.repaso_del_dia(fecha="2026-11-12", center="OGA5", user=MARTA)
    assert [x["id"] for x in r["revisiones"]] == ["oga", "cruzada"] and r["center"] == "OGA5"
    assert {v["id"] for v in r["sin_revision"]} == {"veh-9012"}
    solo_dga = {**MARTA, "allowed_centers": ["DGA1"]}
    r = await server.repaso_del_dia(fecha="2026-11-12", center=None, user=solo_dga)
    assert [x["id"] for x in r["revisiones"]] == ["dga", "cruzada"] and r["center"] is None
    assert r["cuentas"]["furgonetas_activas"] == 1
    with falla(403, "No tienes acceso a ese centro"):
        await server.repaso_del_dia(fecha="2026-11-12", center="OGA5", user=solo_dga)
    with falla(400, "Código de centro inválido"):
        await server.repaso_del_dia(fecha="2026-11-12", center="OGA5;drop", user=MARTA)


@pytest.mark.asyncio(loop_scope="session")
async def test_la_fecha_mala_o_futura_da_400_y_sin_fecha_es_hoy(t):
    for mala in ("12-11-2026", "2026-13-01", "2026-11-12T00", "ayer"):
        with falla(400, "AAAA-MM-DD"):
            await server.repaso_del_dia(fecha=mala, center=None, user=MARTA)
    with falla(400, "todavía no ha llegado"):
        await server.repaso_del_dia(fecha="2026-11-15", center=None, user=MARTA)
    r = await server.repaso_del_dia(fecha=None, center=None, user=MARTA)
    assert r["fecha"] == HOY and r["es_hoy"] is True


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_roles_ni_vistas_la_revision_sale_sin_lados(t):
    t["inspections"].docs.append({"id": "rara", "vehicle_id": "veh-5678", "driver_id": None,
                                  "created_at": marca(12), "photos": ["/a.jpg", "/b.jpg"]})
    r = await server.repaso_del_dia(fecha="2026-11-12", center=None, user=MARTA)
    assert r["revisiones"][0]["estado"] == "sin_lados" and r["revisiones"][0]["lados"] == []
    assert r["revisiones"][0]["conductor"] is None and r["cuentas"]["sin_lados"] == 1


# ── B · el veredicto de un lado ───────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_todos_los_lados_igual_la_dejan_repasada_y_deshacer_devuelve_lo_de_la_ia(t):
    t["inspections"].docs += [revision("r11", "veh-5678", "drv-ana", marca(11)),
                              revision("r12", "veh-5678", "drv-ana", marca(12), reviewed=True, reviewed_by="ia",
                                       reviewed_at="2026-11-12T07:10:00+00:00",
                                       reviewed_motivo="sin daños nuevos que decidir")]
    for pi in (1, 2, 3):
        r = await marcar("r12", pi, "igual")
        assert r["estado"] == "a_medias" and r["libro"] is None
    assert insp(t, "r12")["reviewed_by"] == "ia"             # el repaso no se deduce de `reviewed`
    r = await marcar("r12", 4, "no_se_ve")
    assert r["estado"] == "repasada" and r["cuentas_revision"] == {"lados": 4, "con_veredicto": 4, "golpes": 0}
    assert r["lado"]["veredicto"] == "no_se_ve" and r["lado"]["veredicto_por"] == "Marta R."
    assert r["lado"]["anterior"]["inspection_id"] == "r11"
    d = insp(t, "r12")
    assert d["reviewed"] is True and d["reviewed_by"] == "Marta R." and d["reviewed_motivo"] == "repaso"
    assert d["repaso"]["completo"] is True
    assert d["repaso"]["reviewed_antes"]["reviewed_by"] == "ia"

    r = await deshacer("r12", 2)
    assert r == {"ok": True, "inspection_id": "r12", "photo_index": 2, "libro": None, "estado": "a_medias",
                 "cuentas_revision": {"lados": 4, "con_veredicto": 3, "golpes": 0}}
    d = insp(t, "r12")
    assert (d["reviewed"], d["reviewed_by"], d["reviewed_motivo"]) == (True, "ia", "sin daños nuevos que decidir")
    assert d["repaso"]["completo"] is False and "2" not in d["repaso"]["lados"]


@pytest.mark.asyncio(loop_scope="session")
async def test_deshacer_una_que_no_estaba_revisada_la_deja_sin_reviewed(t):
    t["inspections"].docs.append(revision("r12", "veh-5678", "drv-ana", marca(12)))
    await todos_igual("r12")
    assert insp(t, "r12")["reviewed"] is True
    await deshacer("r12", 1)
    assert "reviewed" not in insp(t, "r12") and "reviewed_by" not in insp(t, "r12")


@pytest.mark.asyncio(loop_scope="session")
async def test_el_golpe_queda_en_la_revision_y_en_el_libro_con_la_fecha_de_esa_revision(t):
    ia = {"severity": "leve", "total_damages_count": 1, "new_damages": [],
          "damages": [{"part": "Paragolpes delantero", "severity": "leve", "description": "Roce", "photo_index": 1}]}
    t["inspections"].docs += [revision("r11", "veh-5678", "drv-ana", marca(11)),
                              revision("r12", "veh-5678", "drv-ana", marca(12), analysis=ia)]
    await marcar("r11", 3, "igual")
    r = await marcar("r12", 3, "golpe", **PUERTA)
    gid = r["lado"]["golpe"]["golpe_id"]
    assert r["lado"]["golpe"] == {"golpe_id": gid, "pieza": PUERTA["part"], "panel": "puerta",
                                  "gravedad": "moderado", "descripcion": "Bollo con pintura saltada",
                                  "box_2d": [410, 220, 640, 470], "ya_estaba": False,
                                  "libro": {"accion": "nuevo", "ledger_id": None}}
    assert r["libro"] == {"accion": "nuevo", "ledger_id": None, "pieza": PUERTA["part"], "panel": "puerta",
                          "desde": "2026-11-12", "golpe_id": gid}
    # En la ficha de la inspección: al final de `damages`, confirmado por una persona; la IA no se mueve.
    an = insp(t, "r12")["analysis"]
    assert an["damages"][0]["part"] == "Paragolpes delantero"
    assert an["damages"][1] == {"part": PUERTA["part"], "severity": "moderado",
                                "description": "Bollo con pintura saltada", "photo_index": 3,
                                "box_2d": [410, 220, 640, 470], "is_new": True, "confirmed": True,
                                "origen": "repaso", "golpe_id": gid}
    assert an["severity"] == "moderado" and an["total_damages_count"] == 2
    assert an["new_damages"] == []                             # la cola de la IA no lo ve
    # El modelo de la respuesta de GET /inspections/{id} no se come los campos nuevos.
    visto = server.Inspection.model_validate(insp(t, "r12")).model_dump()
    assert visto["analysis"]["damages"][1]["origen"] == "repaso" and visto["analysis"]["damages"][1]["golpe_id"] == gid
    # En el libro, con la fecha de ESA revisión (no la de hoy) y de una persona.
    (e,) = t["vehicle_damage_ledger"].docs
    assert e["source"] == "human" and e["origen"] == "repaso" and e["golpe_id"] == gid and e["status"] == "open"
    assert (e["first_seen"], e["first_seen_inspection"], e["panel"], e["rank"]) == ("2026-11-12", "r12", "puerta", 2)
    assert e["confirmado_por"] == "Marta R." and e["ya_estaba"] is False and e["vista"] == "lateral_izq"
    # Y el repaso del día lo enseña como «ya apuntado» de esta revisión.
    dia = await server.repaso_del_dia(fecha="2026-11-12", center=None, user=MARTA)
    (ap,) = dia["revisiones"][0]["ya_apuntado"]
    assert ap["golpe_id"] == gid and ap["de_esta_revision"] is True and ap["origen"] == "repaso"
    assert ap["desde"] == "2026-11-12" and ap["en_taller"] is False
    assert dia["cuentas"]["con_golpe"] == 1 and dia["cuentas"]["golpes"] == 1

    # Deshacer lo quita todo y la ficha vuelve a ser la de la IA.
    r = await deshacer("r12", 3)
    assert r["libro"] == {"accion": "borrado"} and r["estado"] == "sin_repasar"
    assert t["vehicle_damage_ledger"].docs == []
    an = insp(t, "r12")["analysis"]
    assert [d["part"] for d in an["damages"]] == ["Paragolpes delantero"]
    assert an["severity"] == "leve" and an["total_damages_count"] == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_analisis_el_golpe_crea_uno_de_la_persona_y_deshacer_lo_vuelve_a_dejar_vacio(t):
    t["inspections"].docs += [revision("r11", "veh-5678", "drv-ana", marca(11)),
                              revision("r12", "veh-5678", "drv-ana", marca(12), analysis_status="sin_ia")]
    await marcar("r12", 3, "golpe", **{**PUERTA, "severity": "grave", "description": None})
    an = insp(t, "r12")["analysis"]
    assert an["origen"] == "repaso" and an["severity"] == "grave" and an["total_damages_count"] == 1
    assert an["damages"][0]["description"] == ""             # el modelo Damage pide texto
    assert insp(t, "r12")["analysis_status"] == "sin_ia"
    server.Inspection.model_validate(insp(t, "r12"))
    await deshacer("r12", 3)
    assert insp(t, "r12")["analysis"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_la_primera_foto_de_un_lado_es_ya_estaba_y_no_se_atribuye(t):
    # Hubo una revisión antes, pero sin lateral izquierdo: no existe ninguna foto anterior de ese lado.
    t["inspections"].docs += [revision("r10", "veh-5678", "drv-luis", marca(10), vistas=["frontal", "trasera"]),
                              revision("r12", "veh-5678", "drv-ana", marca(12))]
    r = await marcar("r12", 3, "golpe", **PUERTA)
    assert r["lado"]["anterior"] is None and r["lado"]["golpe"]["ya_estaba"] is True
    (e,) = t["vehicle_damage_ledger"].docs
    assert e["ya_estaba"] is True
    assert insp(t, "r12")["analysis"]["damages"][0]["is_new"] is False
    # La frontal sí tenía anterior: un golpe ahí no es «ya estaba».
    r = await marcar("r12", 1, "golpe", part="Paragolpes delantero", severity="leve", box_2d=[1, 1, 50, 50])
    assert r["lado"]["golpe"]["ya_estaba"] is False and r["lado"]["anterior"]["inspection_id"] == "r10"
    # «Origen de daños» no le cuelga el de la puerta a nadie, aunque haya revisiones antes.
    t["vehicles"].docs[0]["status"] = "active"
    od = await server.danos_atribucion(center="", dias=400, solo_alta=False, _=MARTA)
    puerta = next(x for x in od["danos"] if x["panel"] == "puerta")
    assert puerta["certeza"] == "baja" and "ya estaba" in puerta["motivo"] and puerta["confirmado"] is True


@pytest.mark.asyncio(loop_scope="session")
async def test_vista_desconocida_no_es_ya_estaba(t):
    # Cinco fotos de carrocería por roles y sin vistas: no se sabe qué lado es cada una.
    t["inspections"].docs.append({"id": "r12", "vehicle_id": "veh-5678", "driver_id": "drv-ana",
                                  "created_at": marca(12), "photos": [f"/f{k}.jpg" for k in range(5)],
                                  "photo_roles": ["angle"] * 5})
    r = await marcar("r12", 2, "golpe", **PUERTA)
    assert r["lado"]["vista"] is None and r["lado"]["anterior"] is None
    assert r["lado"]["golpe"]["ya_estaba"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_dos_golpes_en_el_mismo_panel_no_se_juntan_en_silencio(t):
    t["inspections"].docs += [revision("r11", "veh-5678", "drv-ana", marca(11)),
                              revision("r12", "veh-5678", "drv-ana", marca(12)),
                              revision("r13", "veh-5678", "drv-luis", marca(13))]
    primero = await marcar("r12", 3, "golpe", **PUERTA)
    # Al día siguiente, otro golpe en otra puerta (el libro dice «puerta» para las cuatro).
    r = await marcar("r13", 4, "golpe", part="Puerta delantera derecha", severity="leve", box_2d=[300, 600, 500, 800])
    assert r["libro"] == {"accion": "ya_apuntado", "ledger_id": None, "pieza": PUERTA["part"], "panel": "puerta",
                          "desde": "2026-11-12", "golpe_id": primero["lado"]["golpe"]["golpe_id"]}
    assert r["lado"]["golpe"]["libro"] == {"accion": "ya_apuntado", "ledger_id": None}
    # El libro no se toca (sigue el primero) y el segundo queda en su revisión, con su foto y su caja.
    (e,) = t["vehicle_damage_ledger"].docs
    assert e["golpe_id"] == primero["lado"]["golpe"]["golpe_id"] and e["severity"] == "moderado"
    assert insp(t, "r13")["analysis"]["damages"][0]["part"] == "Puerta delantera derecha"
    # Deshacer el segundo no toca el libro; deshacer el primero, sí.
    assert (await deshacer("r13", 4))["libro"] == {"accion": "sin_cambios"}
    assert len(t["vehicle_damage_ledger"].docs) == 1
    assert (await deshacer("r12", 3))["libro"] == {"accion": "borrado"}
    assert t["vehicle_damage_ledger"].docs == []


@pytest.mark.asyncio(loop_scope="session")
async def test_un_golpe_sobre_una_entrada_de_la_ia_la_sustituye_y_deshacer_la_devuelve_tal_cual(t):
    t["inspections"].docs += [revision("r11", "veh-5678", "drv-ana", marca(11)),
                              revision("r12", "veh-5678", "drv-ana", marca(12))]
    de_la_ia = {"vehicle_id": "veh-5678", "panel": "puerta", "status": "open", "source": "ai",
                "part": "puerta corredera", "severity": "leve", "rank": 1, "first_seen": "2026-10-02",
                "first_seen_inspection": "r-vieja", "updated_at": "2026-10-02T10:00:00+00:00"}
    t["vehicle_damage_ledger"].docs.append(dict(de_la_ia))
    r = await marcar("r12", 3, "golpe", **PUERTA)
    assert r["libro"]["accion"] == "sustituye_ia" and r["libro"]["desde"] == "2026-11-12"
    (e,) = t["vehicle_damage_ledger"].docs
    assert e["source"] == "human" and e["first_seen"] == "2026-11-12" and e["golpe_id"]
    assert e["ia_previa"]["source"] == "ai" and e["ia_previa"]["first_seen"] == "2026-10-02"
    assert (await deshacer("r12", 3))["libro"] == {"accion": "devuelto_a_ia"}
    assert t["vehicle_damage_ledger"].docs == [de_la_ia]


@pytest.mark.asyncio(loop_scope="session")
async def test_un_golpe_ya_confirmado_por_revision_rapida_es_ya_apuntado(t):
    t["inspections"].docs.append(revision("r12", "veh-5678", "drv-ana", marca(12)))
    humana = {"vehicle_id": "veh-5678", "panel": "puerta", "status": "open", "source": "human",
              "part": "Puerta trasera derecha", "severity": "grave", "rank": 3, "first_seen": "2026-11-03",
              "first_seen_inspection": "r-03", "orden_id": "ot-1"}
    t["vehicle_damage_ledger"].docs.append(dict(humana))
    r = await marcar("r12", 3, "golpe", **PUERTA)
    assert r["libro"] == {"accion": "ya_apuntado", "ledger_id": None, "pieza": "Puerta trasera derecha",
                          "panel": "puerta", "desde": "2026-11-03", "golpe_id": None}
    assert t["vehicle_damage_ledger"].docs == [humana]
    dia = await server.repaso_del_dia(fecha="2026-11-12", center=None, user=MARTA)
    (ap,) = dia["revisiones"][0]["ya_apuntado"]
    assert ap["origen"] == "revision_rapida" and ap["en_taller"] is True and ap["de_esta_revision"] is False
    assert ap["golpe_id"] is None and ap["vista"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_no_se_deshace_un_golpe_que_ya_esta_en_el_taller_o_reparado(t):
    t["inspections"].docs += [revision("r11", "veh-5678", "drv-ana", marca(11)),
                              revision("r12", "veh-5678", "drv-ana", marca(12))]
    await marcar("r12", 3, "golpe", **PUERTA)
    e = t["vehicle_damage_ledger"].docs[0]
    e["orden_id"] = "ot-7"
    with falla(409, "taller o reparado"):
        await deshacer("r12", 3)
    del e["orden_id"]
    # Reparado desde la ficha de la inspección: la ruta de siempre pasa el libro a «repaired».
    await server.update_damage("r12", 0, {"repair_status": "done"}, _=MARTA)
    assert e["status"] == "repaired"
    with falla(409, "taller o reparado"):
        await deshacer("r12", 3)
    assert insp(t, "r12")["repaso"]["lados"]["3"]["veredicto"] == "golpe"     # no se ha tocado nada


@pytest.mark.asyncio(loop_scope="session")
async def test_un_taller_asignado_en_la_ficha_tambien_para_el_deshacer(t):
    t["inspections"].docs.append(revision("r12", "veh-5678", "drv-ana", marca(12)))
    await marcar("r12", 3, "golpe", **PUERTA)
    await server.update_damage("r12", 0, {"workshop_id": "taller-1"}, _=MARTA)
    with falla(409):
        await deshacer("r12", 3)


@pytest.mark.asyncio(loop_scope="session")
async def test_un_lado_con_veredicto_no_se_cambia_encima(t):
    t["inspections"].docs.append(revision("r12", "veh-5678", "drv-ana", marca(12)))
    await marcar("r12", 1, "igual")
    with falla(409, "Deshazlo antes de cambiarlo"):
        await marcar("r12", 1, "golpe", **PUERTA)
    assert t["vehicle_damage_ledger"].docs == [] and insp(t, "r12")["analysis"] is None
    with falla(404, "Ese lado no tiene veredicto"):
        await deshacer("r12", 2)


@pytest.mark.asyncio(loop_scope="session")
async def test_los_errores_del_cuerpo(t):
    t["inspections"].docs.append(revision("r12", "veh-5678", "drv-ana", marca(12)))
    casos = [
        ({"veredicto": "igual"}, "Falta photo_index"),
        ({"photo_index": "tres", "veredicto": "igual"}, "photo_index debe ser un numero"),
        ({"photo_index": 5, "veredicto": "igual"}, "Esa foto no es de la carrocería"),      # el cuentakilómetros
        ({"photo_index": 9, "veredicto": "igual"}, "Esa foto no es de la carrocería"),
        ({"photo_index": 1, "veredicto": "roto"}, "igual, golpe o no_se_ve"),
        ({"photo_index": 1, "veredicto": ["igual"]}, "igual, golpe o no_se_ve"),
        ({"photo_index": 1, "veredicto": "golpe", **PUERTA, "part": ""}, "Indica la pieza"),
        ({"photo_index": 1, "veredicto": "golpe", **PUERTA, "part": "Salpicadero"}, "no es de la carrocería: elige otra"),
        ({"photo_index": 1, "veredicto": "golpe", **PUERTA, "severity": "medio"}, "leve, moderado, grave o critico"),
        ({"photo_index": 1, "veredicto": "golpe", **PUERTA, "box_2d": None}, "Dibuja la caja"),
        ({"photo_index": 1, "veredicto": "golpe", **PUERTA, "box_2d": [500, 1, 400, 9]}, "Dibuja la caja"),
        ({"photo_index": 1, "veredicto": "golpe", **PUERTA, "box_2d": [0, 0, 10, 1001]}, "Dibuja la caja"),
        ({"photo_index": 1, "veredicto": "golpe", **PUERTA, "box_2d": [0, True, 10, 10]}, "Dibuja la caja"),
    ]
    for cuerpo, texto in casos:
        with falla(400, texto):
            await server.repaso_marcar_lado("r12", cuerpo, user=MARTA)
    # Un cuerpo que no es un objeto tampoco revienta.
    with falla(400, "Falta photo_index"):
        await server.repaso_marcar_lado("r12", ["x"], user=MARTA)
    assert "repaso" not in insp(t, "r12")


@pytest.mark.asyncio(loop_scope="session")
async def test_permisos_no_admin_otra_empresa_y_otro_centro(t, monkeypatch):
    t["inspections"].docs.append(revision("r12", "veh-5678", "drv-ana", marca(12)))
    # Un no-admin no pasa de la puerta (la dependencia de las tres rutas).
    with falla(403, "Acceso restringido a administradores"):
        await server.require_admin({"sub": "drv-ana", "role": "driver"})
    with falla(403, "Acceso restringido a administradores"):
        await server.require_admin({"sub": "x", "role": "dispatcher"})
    # Otra empresa: su base es otra; la revisión de esta no existe allí.
    otra = mundo_base()
    monkeypatch.setattr(server, "db", otra)
    with falla(404, "Revisión no encontrada"):
        await marcar("r12", 1, "igual", user={**MARTA, "org_id": "otra"})
    with falla(404, "Revisión no encontrada"):
        await deshacer("r12", 1, user={**MARTA, "org_id": "otra"})
    monkeypatch.setattr(server, "db", t)
    # Otro centro: ni la furgoneta ni el conductor son suyos.
    solo_dga = {**MARTA, "allowed_centers": ["DGA1"]}
    with falla(403, "No tienes acceso a esa revisión"):
        await marcar("r12", 1, "igual", user=solo_dga)
    await marcar("r12", 1, "igual")
    with falla(403, "No tienes acceso a esa revisión"):
        await deshacer("r12", 1, user=solo_dga)
    # Si el conductor es de su centro, sí (como en «Revisión rápida»).
    t["drivers"].docs[0]["center"] = "DGA1"
    assert (await marcar("r12", 2, "igual", user=solo_dga))["ok"] is True
    # Borrada: no existe.
    insp(t, "r12")["deleted"] = True
    with falla(404, "Revisión no encontrada"):
        await marcar("r12", 3, "igual")


@pytest.mark.asyncio(loop_scope="session")
async def test_si_falla_el_libro_no_queda_nada_a_medias(t, monkeypatch):
    t["inspections"].docs.append(revision("r12", "veh-5678", "drv-ana", marca(12)))

    async def revienta(*a, **k):
        raise RuntimeError("Mongo se ha ido")
    monkeypatch.setattr(server, "_repaso_libro", revienta)
    with falla(500, "No ha quedado nada a medias"):
        await marcar("r12", 3, "golpe", **PUERTA)
    d = insp(t, "r12")
    assert d["repaso"]["lados"] == {} and d["analysis"] is None and t["vehicle_damage_ledger"].docs == []


@pytest.mark.asyncio(loop_scope="session")
async def test_un_analisis_que_llega_tarde_no_borra_el_golpe_de_la_persona():
    manual = {"part": "Puerta", "severity": "grave", "description": "", "photo_index": 3, "box_2d": [1, 1, 9, 9],
              "is_new": True, "confirmed": True, "origen": "repaso", "golpe_id": "g1"}
    actual = {"origen": "repaso", "damages": [manual], "new_damages": [], "severidad_ia": "sin_danos",
              "danos_ia": 0, "severity": "grave", "total_damages_count": 1}
    de_la_ia = {"severity": "leve", "total_damages_count": 2, "new_damages": [],
                "damages": [{"part": "Faro", "severity": "leve"}, {"part": "Capó", "severity": "leve"}]}
    junto = server._analisis_con_repaso(de_la_ia, actual)
    assert [d["part"] for d in junto["damages"]] == ["Faro", "Capó", "Puerta"]
    assert junto["severity"] == "grave" and junto["total_damages_count"] == 3
    assert junto["severidad_ia"] == "leve" and junto["danos_ia"] == 2
    # Si la IA falla (no devuelve análisis), queda el de la persona.
    assert server._analisis_con_repaso(None, actual)["damages"] == [manual]
    # Sin golpes a mano, lo de la IA tal cual (las empresas de siempre no notan nada).
    assert server._analisis_con_repaso(de_la_ia, None) is de_la_ia
    assert server._analisis_con_repaso(de_la_ia, {"damages": [{"part": "x"}]}) is de_la_ia
    # Los dos sitios que reescriben el análisis entero lo usan.
    import inspect
    for fn in (server.upload_inspection_photos, server.reanalyze_inspection):
        assert "_analisis_con_repaso(" in inspect.getsource(fn)


def test_el_modulo_repaso_esta_en_todos_los_planes_de_empresa():
    assert server.MODULOS_PANEL[[m["clave"] for m in server.MODULOS_PANEL].index("vehiculos") + 1]["clave"] == "repaso"
    for plan in ("operacion", "basico", "completo", "holding", "reparto", None):
        assert "repaso" in server.org_modulos({"account_type": "dsp", "plan": plan})
        for sector in ("dsp_amazon", "mensajeria", "supermercado", "distribucion"):
            modulos = list(server.SECTORES_REGISTRO[sector])
            assert "repaso" in server.org_modulos({"account_type": "dsp", "plan": plan, "modulos": modulos})
    assert "repaso" not in server._MODULOS_SOLO_PRO
    assert "repaso" not in server.SECTORES_REGISTRO["autonomo"]
    # Una lista propia guardada se respeta tal cual: el repaso lo activa el super-admin.
    assert "repaso" not in server.org_modulos({"account_type": "dsp", "plan": "completo",
                                               "modulos": ["vehiculos", "inspecciones"]})
