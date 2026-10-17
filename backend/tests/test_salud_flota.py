# -*- coding: utf-8 -*-
"""El estado de la flota (17-10-2026). Lo que se vigila: que la peor salga primero y por las razones
buenas; que nada sume por datos viejos o descartados (averías sin cerrar de hace meses, un «no es seguro
circular» de julio, un daño que una persona dijo que no existía); que lo que ya está en el taller no salga en
la lista; y que cada uno vea solo sus centros."""
from datetime import date, timedelta

import pytest
from fastapi import HTTPException

import salud_flota as sf
import server
from base_de_mentira import Col, Db

HOY = date.today()


def _dia(n: int) -> str:
    """La fecha de hace `n` días, como la guarda Mongo."""
    return (HOY - timedelta(days=n)).isoformat() + "T19:00:00+00:00"


# ── El baremo, sin base de datos ──────────────────────────────────────────────

def test_zona_del_dano():
    assert sf.zona("Puerta delantera izquierda") == "lat_izq"
    assert sf.zona("Panel lateral trasero derecho") == "lat_der"
    assert sf.zona("paragolpes_delantero", "paragolpes") == "frontal"       # con guion bajo también
    assert sf.zona("Portón trasero") == "trasera"
    assert sf.zona("Rueda delantera derecha") == "ruedas"
    assert sf.zona("Paso de rueda derecho", "rueda", "lateral_derecho") == "lat_der"   # el arco es chapa
    assert sf.zona("Paso de rueda trasero izquierdo", "rueda") == "lat_izq"
    assert sf.zona("", "paragolpes_delantero") == "frontal"                             # sin nombre, el tipo
    assert sf.zona("Puerta", "puerta", "lateral_derecho") == "lat_der"       # manda lo que dice la IA
    assert sf.zona("Tapa del depósito de combustible") == "otros"


def test_la_nota_del_conductor():
    assert sf.mecanica_de_la_nota("Luz motor encendida") == ["motor"]          # un testigo, no una bombilla
    assert sf.mecanica_de_la_nota("La luz de freno izquierda no va") == ["luces"]   # una bombilla, no los frenos
    assert sf.mecanica_de_la_nota("Los frenos hay que revisarlos, está rayando el disco") == ["frenos"]
    assert sf.mecanica_de_la_nota("Todo bien") == []
    assert sf.mecanica_de_la_nota("Quién conduce este vehículo lo dejó lleno de mierda") == []
    assert sf.mecanica_de_la_nota("") == []


def test_lo_que_no_se_ve_una_vez_por_cosa():
    m = sf.lo_que_no_se_ve({"espejos": "danado", "limpieza": "malo", "chapa": "danado", "luces": "regular"},
                           "El espejo derecho está tan roto que es un peligro")
    assert [x["categoria"] for x in m] == ["visibilidad"]          # la chapa la ven las fotos; la limpieza no es avería
    assert m[0]["urgente"] and m[0]["origen"] == "nota" and m[0]["puntos"] == sf.CHECKLIST_PUNTOS
    assert sf.lo_que_no_se_ve({"neumaticos": "malo"}, "")[0]["puntos"] == sf.CHECKLIST_PUNTOS


def test_cruce_de_la_ultima_foto_con_el_libro():
    libro = [{"panel": "puerta", "part": "Puerta corredera derecha", "severity": "grave", "source": "ai",
              "first_seen": "2026-07-01"},
             {"panel": "aleta", "part": "Aleta delantera izquierda", "severity": "moderado", "source": "human",
              "first_seen": "2026-08-01"}]
    ultima = [{"panel": "puerta", "part": "Puerta delantera izquierda", "severity": "grave",
               "location_hint": "lateral_izquierdo", "photo_index": 3},
              {"panel": "puerta", "part": "Puerta delantera derecha", "severity": "moderado",
               "location_hint": "lateral_derecho", "photo_index": 4},
              # Sin apunte abierto en el libro (descartado, reparado o nunca seguro): no cuenta.
              {"panel": "paragolpes", "part": "Paragolpes trasero", "severity": "grave",
               "location_hint": "trasera", "photo_index": 2}]
    d = sf.danos_a_contar(libro, ultima)
    assert [(x["pieza"], x["zona"], x["en_ultima"]) for x in d] == [
        ("Puerta delantera izquierda", "lat_izq", True),            # los dos lados, que el libro junta
        ("Aleta delantera izquierda", "lat_izq", False),             # del libro aunque hoy no salga
        ("Puerta delantera derecha", "lat_der", True),
    ]
    assert d[1]["humano"] and not d[0]["humano"]


def test_averias_viejas_o_de_taller_no_cuentan():
    a = sf.averias_vigentes([
        {"titulo": "Vehículo en taller — 1234 ABC", "severity": "grave", "fecha": _dia(3)[:10]},
        {"titulo": "Carter roto", "severity": "critico", "fecha": _dia(90)[:10]},
        {"titulo": "Ruido al frenar", "severity": "grave", "fecha": _dia(5)[:10]},
        {"titulo": "Sin fecha", "severity": "grave", "fecha": ""},
    ], HOY)
    assert [x["titulo"] for x in a] == ["Ruido al frenar"]


def _f(danos=(), mecanica=(), averias=(), dias=0, circula=True):
    return sf.ficha({"id": "v", "license_plate": "1111 AAA"}, list(danos), list(mecanica), list(averias),
                    {"fecha": "x", "dias": dias, "circulation_safe": circula} if dias is not None else {})


def _dano(sev, humano=False, zona="lat_izq"):
    return {"zona": zona, "pieza": "Puerta", "severity": sev, "humano": humano, "en_ultima": True}


def test_niveles():
    assert _f()["nivel"] == "bien" and _f()["salud"] == 100
    assert _f(dias=None)["nivel"] == "sin_datos"                    # sin inspección no se dice «Bien»
    assert _f(dias=45)["nivel"] == "sin_datos"
    assert _f([_dano("grave")])["nivel"] == "vigilar"                # una grave que solo vio la IA
    assert _f([_dano("grave", humano=True)])["nivel"] == "taller"    # la misma, confirmada por una persona
    assert _f([_dano("grave"), _dano("grave", zona="lat_der")])["nivel"] == "taller"
    assert _f([_dano("critico", humano=True)])["nivel"] == "urgente"
    f = _f([_dano("critico", humano=True)] * 4)
    assert f["salud"] == 0 and f["puntos"] == 140                   # la nota no baja de 0
    assert _f([_dano("leve")])["nivel"] == "bien"


def test_lo_de_la_ultima_inspeccion_caduca():
    frenos = sf.lo_que_no_se_ve({}, "Daño en frenos!!!")
    assert _f(mecanica=frenos)["nivel"] == "urgente"
    assert _f(mecanica=frenos, dias=20)["nivel"] == "bien"           # lo dijo hace 20 días: no vale para hoy
    assert _f(circula=False)["nivel"] == "urgente"
    assert _f(circula=False, dias=20)["nivel"] == "bien"            # el «no circula» del 31-07 no vale el 17-10


def test_orden_peor_primero():
    urgente = _f(mecanica=sf.lo_que_no_se_ve({}, "frenos"))           # salud 70, pero urgente
    taller = _f([_dano("grave", humano=True)] * 2)                    # salud 64: peor nota, pero no urgente
    bien = _f()
    sin = _f(dias=None)
    for f, m in ((urgente, "U"), (taller, "T"), (bien, "B"), (sin, "S")):
        f["matricula"] = m
    assert [f["matricula"] for f in sf.ordenar([bien, sin, taller, urgente])] == ["U", "T", "S", "B"]
    assert [f["matricula"] for f in sf.ordenar([bien, sin, taller, urgente], "mejor")][0] in ("B", "S")


# ── Los endpoints, con una base de mentira ────────────────────────────────────

DANI = {"sub": "dani", "role": "admin", "sa": True, "org_id": "owner", "name": "Dani"}
SOLO_DGA1 = {"sub": "j", "role": "admin", "org_id": "owner", "name": "Jefe DGA1", "allowed_centers": ["DGA1"]}


def _insp(id_, veh, dias, damages=(), nota="", checklist=None, circula=True):
    return {"id": id_, "vehicle_id": veh, "created_at": _dia(dias), "analysis_status": "ok",
            "photos": [f"https://r2/{id_}/{k}.jpg" for k in range(1, 7)],
            "annotated_photos": [None, None, f"https://r2/{id_}/a3.jpg", None, None, None],
            "photo_vistas": ["frontal", "trasera", "lateral_izq", "lateral_der", "odometro", "combustible"],
            "notes": __import__("json").dumps({"checklist": checklist or {}, "notes": nota, "driver_name": "Ana",
                                               "odometer_km": 52854}),
            "analysis": {"circulation_safe": circula, "damages": list(damages)}}


@pytest.fixture
def flota(monkeypatch):
    t = Db()
    t["vehicles"] = Col([
        {"id": "a", "license_plate": "1111 AAA", "center": "OGA5", "status": "active", "itv_date": "2025-01-01"},
        {"id": "b", "license_plate": "2222 BBB", "center": "OGA5", "status": "active"},
        {"id": "c", "license_plate": "3333 CCC", "center": "OGA5", "status": "taller"},
        {"id": "d", "license_plate": "4444 DDD", "center": "OGA5", "status": "active"},
        {"id": "e", "license_plate": "5555 EEE", "center": "OGA5", "status": "baja"},
        {"id": "f", "license_plate": "6666 FFF", "center": "DGA1", "status": "active"},
    ])
    t["ordenes_trabajo"] = Col([
        {"vehicle_id": "d", "numero": "OT-7", "estado": "reparando", "taller_nombre": "Talleres Pepe"},
        {"vehicle_id": "b", "numero": "OT-1", "estado": "entregado"},          # cerrada: no la saca de la lista
    ])
    t["vehicle_damage_ledger"] = Col([
        {"_id": "l1", "vehicle_id": "a", "panel": "puerta", "part": "Puerta corredera izquierda", "severity": "grave",
         "source": "ai", "status": "open", "orden_id": None, "first_seen": "2026-07-01", "first_seen_inspection": "i0"},
        {"_id": "l2", "vehicle_id": "a", "panel": "aleta", "part": "Aleta delantera derecha", "severity": "moderado",
         "source": "human", "status": "open", "orden_id": None, "first_seen": "2026-08-01", "first_seen_inspection": "i0"},
        {"_id": "l3", "vehicle_id": "d", "panel": "puerta", "part": "Puerta", "severity": "critico",
         "source": "human", "status": "open", "orden_id": None, "first_seen": "2026-09-01"},
    ])
    ultimas = {
        "a": _insp("ia", "a", 0, [
            {"part": "Puerta delantera izquierda", "severity": "grave", "location_hint": "lateral_izquierdo",
             "photo_index": 3, "confirmed": True},
            {"part": "Puerta delantera derecha", "severity": "grave", "location_hint": "lateral_derecho",
             "photo_index": 4, "confirmed": True},
            {"part": "Paragolpes trasero", "severity": "grave", "location_hint": "trasera",
             "photo_index": 2, "confirmed": False},                                 # la IA no lo da por seguro
        ], nota="Luz motor encendida", checklist={"espejos": "danado", "limpieza": "regular"}),
        "b": _insp("ib", "b", 1),
        "f": _insp("if", "f", 2),
    }
    t["inspections"] = Col(list(ultimas.values()) + [
        _insp("i0", "a", 60, [{"part": "Aleta delantera derecha", "severity": "moderado", "photo_index": 4,
                               "location_hint": "lateral_derecho"}]),
        _insp("ia2", "a", 3, nota="Neumático delantero con golpe"),
    ])
    t["ai_feedback"] = Col([{"inspection_id": "ia", "scope": "all", "damage_index": 0, "verdict": "correct"}])
    t["incidents"] = Col([
        {"vehicle_id": "a", "title": "Vehículo en taller — 1111 AAA", "severity": "grave", "status": "open",
         "created_at": _dia(2)},
        {"vehicle_id": "a", "title": "Carter roto", "severity": "critico", "status": "open", "created_at": _dia(80)},
    ])
    t["drivers"] = Col([])

    async def ultimas_de(ids):
        return {k: v for k, v in ultimas.items() if k in ids}
    monkeypatch.setattr(server, "db", t)
    monkeypatch.setattr(server, "_salud_ultimas", ultimas_de)
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY.isoformat())
    return t


@pytest.mark.asyncio(loop_scope="session")
async def test_lista_peor_primero_y_sin_las_del_taller(flota):
    r = await server.estado_flota("", "peor", DANI)
    mats = [f["matricula"] for f in r["furgonetas"]]
    assert mats[0] == "1111 AAA"
    assert set(mats) == {"1111 AAA", "2222 BBB", "6666 FFF"}           # ni la de baja ni las del taller
    assert {x["matricula"]: x["estado"] for x in r["en_taller"]} == {"3333 CCC": "En el taller", "4444 DDD": "En reparación"}
    a = r["furgonetas"][0]
    # Puerta izq grave confirmada (18) + puerta der grave IA (12,6) + aleta del libro moderado confirmada (7)
    # + motor (18) + espejos (10). El paragolpes no (sin confirmar), ni las averías (taller y de hace 80 días).
    assert a["puntos"] == 65.6 and a["nivel"] == "urgente" and a["salud"] == 34
    assert [z["nombre"] for z in a["zonas"]] == ["Lateral derecho", "Lateral izquierdo"]
    assert a["mecanica"] == ["Motor", "Visibilidad"] and a["averias"] == 0
    assert a["itv_vencida"] and a["portada"] == "https://r2/ia/a3.jpg"   # la foto marcada del peor daño
    assert a["ultima"] == {"fecha": _dia(0)[:10], "dias": 0, "conductor": "Ana", "km": 52854}
    assert "motivos" not in a
    assert r["niveles"]["urgente"] == 1 and r["niveles"]["bien"] == 2 and r["salud_media"] == round((34 + 100 + 100) / 3)


@pytest.mark.asyncio(loop_scope="session")
async def test_un_dano_descartado_por_una_persona_no_cuenta(flota):
    flota["ai_feedback"] = Col([{"inspection_id": "ia", "scope": "all", "damage_index": 1, "verdict": "wrong"}])
    a = (await server.estado_flota("", "peor", DANI))["furgonetas"][0]
    assert a["zonas"] == [{"zona": "lat_izq", "nombre": "Lateral izquierdo", "peor": "grave", "n": 1},
                          {"zona": "lat_der", "nombre": "Lateral derecho", "peor": "moderado", "n": 1}]


@pytest.mark.asyncio(loop_scope="session")
async def test_cada_uno_ve_sus_centros(flota):
    r = await server.estado_flota("", "peor", SOLO_DGA1)
    assert [f["matricula"] for f in r["furgonetas"]] == ["6666 FFF"] and r["en_taller"] == []
    with pytest.raises(HTTPException) as e:
        await server.estado_flota_ficha("a", SOLO_DGA1)
    assert e.value.status_code == 403
    with pytest.raises(HTTPException):
        await server.estado_flota("OGA5", "peor", SOLO_DGA1)


@pytest.mark.asyncio(loop_scope="session")
async def test_ficha_con_fotos_y_parte(flota):
    f = await server.estado_flota_ficha("a", DANI)
    assert [x["nombre"] for x in f["fotos"]][:4] == ["Frontal", "Trasera", "Lateral izquierdo", "Lateral derecho"]
    assert f["fotos"][2]["anotada"] == "https://r2/ia/a3.jpg" and f["fotos"][0]["anotada"] is None
    d = {x["pieza"]: x for x in f["danos_detalle"]}
    assert d["Puerta delantera izquierda"]["foto"] == "https://r2/ia/a3.jpg"       # la de hoy, con la marca
    assert d["Puerta delantera derecha"]["foto"] == "https://r2/ia/4.jpg"
    assert d["Aleta delantera derecha"]["foto"] == "https://r2/i0/4.jpg"          # la del día que se vio
    assert d["Aleta delantera derecha"]["foto_fecha"] == _dia(60)[:10] and not d["Aleta delantera derecha"]["en_ultima"]
    assert f["motivos"][0]["texto"] == "Puerta delantera izquierda: grave"
    assert f["checklist_mal"] == [{"item": "Espejos", "valor": "dañado"}, {"item": "Limpieza", "valor": "regular"}]
    assert f["notas_anteriores"] == [{"fecha": _dia(3)[:10], "conductor": "Ana", "texto": "Neumático delantero con golpe"}]
    assert f["parte"].splitlines() == [
        "Lateral izquierdo: Puerta delantera izquierda (grave)",
        "Lateral derecho: Puerta delantera derecha (grave), Aleta delantera derecha (moderado)",
        "Avisa el conductor: Motor, Visibilidad",
        f"Nota del conductor ({_dia(0)[:10]}): «Luz motor encendida»",
    ]
    assert f["en_taller"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_ficha_de_una_que_ya_esta_en_el_taller(flota):
    f = await server.estado_flota_ficha("d", DANI)
    assert f["en_taller"]["orden"] == "OT-7" and f["en_taller"]["taller"] == "Talleres Pepe"
    with pytest.raises(HTTPException) as e:
        await server.estado_flota_ficha("e", DANI)                        # de baja
    assert e.value.status_code == 404
