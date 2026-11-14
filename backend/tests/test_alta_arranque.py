# -*- coding: utf-8 -*-
"""El arranque del dueño (14-11-2026): `/alta/estado` (en qué paso va, sacado de los datos, y la revisión que acaba de
llegar) y las listas pegadas de furgonetas y conductores, que dicen línea a línea qué pasa ANTES de guardar y, al
guardar, dan de alta solo lo nuevo con las mismas reglas que el alta a mano. Sin Mongo: base de mentira y las rutas
de verdad (`server.app`)."""
import json
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

import server
from base_de_mentira import Col
from test_alta_enlace import TEL_ANA, _canjear, _crear, _h, _sesion_admin, montar_mundo


@pytest.fixture
def mundo(monkeypatch):
    m = montar_mundo(monkeypatch)
    m.http = TestClient(server.app)
    m.a["vehicles"] = Col([])
    m.b["vehicles"] = Col([])
    yield m
    for cache in (server._ACCESO_CACHE, server._login_fails, server._public_actions):
        cache.clear()


def _estado(m, admin=None):
    r = m.http.get("/api/alta/estado", headers=_h(admin or _sesion_admin()))
    assert r.status_code == 200, r.text
    return r.json()


def _furgonetas(m, texto, admin=None, **mas):
    return m.http.post("/api/alta/furgonetas", json={"texto": texto, **mas}, headers=_h(admin or _sesion_admin()))


def _conductores(m, texto, admin=None, **mas):
    return m.http.post("/api/alta/conductores", json={"texto": texto, **mas}, headers=_h(admin or _sesion_admin()))


def _revision(id_, vehicle_id, driver_id, cuando, **mas):
    doc = {"id": id_, "vehicle_id": vehicle_id, "driver_id": driver_id, "created_at": cuando,
           "photos": [f"https://fotos.ejemplo/{id_}/{n}.jpg" for n in
                      ("frontal", "trasera", "izq", "der", "km", "deposito", "rueda")],
           "photo_roles": ["angle", "angle", "angle", "angle", "odometer", "checklist", "checklist"],
           "photo_vistas": ["frontal", "trasera", "lateral_izq", "lateral_der", "cuentakilometros", "combustible",
                            "rueda_repuesto"],
           "annotated_photos": [f"https://fotos.ejemplo/{id_}/ia-{n}.jpg" for n in range(4)],
           "analysis": {"damages": [{"part": "puerta", "severity": "leve"}]}, "analysis_status": "done",
           "notes": json.dumps({"odometer_km": 48210}), "combustible": {"pct": 75}}
    doc.update(mas)
    return doc


# ── /alta/estado ──────────────────────────────────────────────────────────────

def test_una_empresa_recien_creada_va_por_el_paso_uno(mundo):
    for d in mundo.a["drivers"].docs:
        d["active"] = False
    e = _estado(mundo)
    assert e == {"empresa": "Transportes Pérez", "centros": ["PRINCIPAL"], "furgonetas": 0, "conductores": 0,
                 "accesos": {"sin_enlace": 0, "sin_abrir": 0, "abierto": 0, "caducado": 0}, "revisiones": 0,
                 "pasos": [{"id": "furgonetas", "hecho": False}, {"id": "conductores", "hecho": False},
                           {"id": "acceso", "hecho": False}, {"id": "revision", "hecho": False}],
                 "paso_actual": 1, "revision": None}


def test_cada_paso_sale_de_los_datos(mundo):
    mundo.a["vehicles"].docs += [{"id": "v1", "license_plate": "5678 KLM", "model": "Proace", "status": "active",
                                  "center": "PRINCIPAL"},
                                 {"id": "v-baja", "license_plate": "1111 BBB", "status": "baja", "center": "PRINCIPAL"},
                                 {"id": "v-borrada", "license_plate": "2222 CCC", "status": "deleted"}]
    e = _estado(mundo)
    assert e["furgonetas"] == 1 and e["conductores"] == 3 and e["paso_actual"] == 3
    assert e["accesos"] == {"sin_enlace": 3, "sin_abrir": 0, "abierto": 0, "caducado": 0}
    token = _crear(mundo).json()["token"]
    assert _estado(mundo)["paso_actual"] == 3                     # creado no es abierto
    assert _canjear(mundo, token).status_code == 200
    e = _estado(mundo)
    assert e["paso_actual"] == 4 and e["accesos"]["abierto"] == 1 and e["pasos"][2] == {"id": "acceso", "hecho": True}
    mundo.a["inspections"] = Col([_revision("r1", "v1", "d-ana", "2026-11-14T08:31:07.512000+00:00")])
    e = _estado(mundo)
    assert e["paso_actual"] is None and all(p["hecho"] for p in e["pasos"]) and e["revisiones"] == 1


def test_quien_ya_entra_por_correo_no_necesita_enlace(mundo):
    mundo.a["vehicles"].docs.append({"id": "v1", "license_plate": "5678 KLM", "status": "active", "center": "PRINCIPAL"})
    mundo.a["inspections"] = Col([_revision("r1", "v1", "d-luis", "2026-11-14T08:31:07+00:00")])
    e = _estado(mundo)
    assert e["accesos"]["abierto"] == 0 and e["pasos"][2]["hecho"] is True and e["paso_actual"] is None


def test_la_revision_es_la_mas_reciente_con_sus_fotos_de_carroceria_y_nada_de_la_ia(mundo):
    mundo.a["vehicles"].docs += [{"id": "v1", "license_plate": "5678 KLM", "model": "Proace", "status": "active",
                                  "center": "PRINCIPAL"},
                                 {"id": "v2", "license_plate": "1234 ABC", "status": "active", "center": "PRINCIPAL"}]
    mundo.a["inspections"] = Col([
        _revision("vieja", "v2", "d-luis", "2026-11-13T07:00:00+00:00"),
        _revision("nueva", "v1", "d-ana", "2026-11-14T08:31:07.512000+00:00"),
        _revision("borrada", "v2", "d-luis", "2026-11-14T09:00:00+00:00", deleted=True),
    ])
    r = _estado(mundo)["revision"]
    assert r == {
        "id": "nueva", "dia": "2026-11-14", "hora": "09:31", "recibida_at": "2026-11-14T08:31:07.512000+00:00",
        "furgoneta": {"id": "v1", "matricula": "5678 KLM", "modelo": "Proace"},
        "conductor": {"id": "d-ana", "nombre": "Ana López"},
        "fotos": [{"photo_index": 1, "vista": "frontal", "url": "https://fotos.ejemplo/nueva/frontal.jpg"},
                  {"photo_index": 2, "vista": "trasera", "url": "https://fotos.ejemplo/nueva/trasera.jpg"},
                  {"photo_index": 3, "vista": "lateral_izq", "url": "https://fotos.ejemplo/nueva/izq.jpg"},
                  {"photo_index": 4, "vista": "lateral_der", "url": "https://fotos.ejemplo/nueva/der.jpg"}],
        "km": 48210, "combustible_pct": 75}
    texto = json.dumps(_estado(mundo))
    assert "ia-" not in texto and "analysis" not in texto and "damages" not in texto
    assert _estado(mundo)["revisiones"] == 2


def test_una_revision_sin_conductor_sin_km_y_sin_fotos_de_carroceria(mundo):
    mundo.a["vehicles"].docs.append({"id": "v1", "license_plate": "5678 KLM", "status": "active"})
    mundo.a["inspections"] = Col([{"id": "r", "vehicle_id": "v1", "created_at": "2026-11-14T22:30:00+00:00",
                                   "photos": ["https://fotos.ejemplo/x.jpg"], "notes": "texto libre"}])
    r = _estado(mundo)["revision"]
    assert r["conductor"] is None and r["fotos"] == [] and r["km"] is None and r["combustible_pct"] is None
    assert (r["dia"], r["hora"]) == ("2026-11-14", "23:30")                       # hora de la empresa, no la de UTC
    assert r["furgoneta"] == {"id": "v1", "matricula": "5678 KLM", "modelo": None}


def test_con_centros_asignados_solo_cuenta_lo_de_sus_centros(mundo):
    jefe = _sesion_admin("adm-b-norte", "orgb")
    mundo.b["vehicles"].docs += [{"id": "vn", "license_plate": "1111 NNN", "status": "active", "center": "NORTE"},
                                 {"id": "vs", "license_plate": "2222 SSS", "status": "active", "center": "SUR"}]
    mundo.b["inspections"] = Col([_revision("rn", "vn", "d-ana", "2026-11-14T07:00:00+00:00"),
                                  _revision("rs", "vs", "d-sur", "2026-11-14T08:00:00+00:00")])
    e = _estado(mundo, jefe)
    assert e["centros"] == ["NORTE"] and e["furgonetas"] == 1 and e["conductores"] == 1 and e["revisiones"] == 1
    assert e["revision"]["id"] == "rn"                    # la de SUR es más reciente, pero no es suya
    todo = _estado(mundo, _sesion_admin("adm-b", "orgb"))
    assert todo["centros"] == ["NORTE", "SUR"] and todo["furgonetas"] == 2 and todo["revision"]["id"] == "rs"


# ── /alta/furgonetas ──────────────────────────────────────────────────────────

def test_las_matriculas_se_revisan_linea_a_linea_antes_de_guardar(mundo):
    mundo.a["vehicles"].docs.append({"id": "v1", "license_plate": "5678KLM", "status": "active", "center": "PRINCIPAL"})
    r = _furgonetas(mundo, "1234 ABC\n5678-klm\n\n  1234abc  \nfurgo de Juan\nABCD\n12345")
    assert r.status_code == 200, r.text
    # Cada línea con su `codigo` (R12) y `confirmada` (A11), y la cuenta de dudosas (14-11-2026).
    assert r.json() == {"lineas": [
        {"n": 1, "texto": "1234 ABC", "matricula": "1234 ABC", "estado": "nueva", "motivo": None, "codigo": None,
         "confirmada": False},
        {"n": 2, "texto": "5678-klm", "matricula": "5678 KLM", "estado": "ya_estaba", "motivo": "Ya la tienes dada de alta.",
         "codigo": "matricula_ya_estaba", "confirmada": False},
        {"n": 3, "texto": "1234abc", "matricula": "1234 ABC", "estado": "error", "motivo": "Repetida en la lista.",
         "codigo": "matricula_repetida", "confirmada": False},
        {"n": 4, "texto": "furgo de Juan", "matricula": None, "estado": "error", "motivo": "No parece una matrícula.",
         "codigo": "matricula_rara", "confirmada": False},
        {"n": 5, "texto": "ABCD", "matricula": None, "estado": "error", "motivo": "No parece una matrícula.",
         "codigo": "matricula_rara", "confirmada": False},
        {"n": 6, "texto": "12345", "matricula": None, "estado": "error", "motivo": "No parece una matrícula.",
         "codigo": "matricula_rara", "confirmada": False}],
        "nuevas": 1, "ya_estaban": 1, "errores": 4, "dudosas": 0, "center": "PRINCIPAL", "guardado": False,
        "creadas": []}
    assert len(mundo.a["vehicles"].docs) == 1                       # sin guardar, nada


def test_guardar_da_de_alta_solo_las_nuevas_en_su_sede(mundo):
    mundo.a["vehicles"].docs.append({"id": "v1", "license_plate": "5678 KLM", "status": "active", "center": "PRINCIPAL"})
    r = _furgonetas(mundo, "1234 abc\n5678 KLM\nB-1234-XY\nno vale", guardar=True)
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["guardado"] is True and [c["matricula"] for c in cuerpo["creadas"]] == ["1234 ABC", "B 1234 XY"]
    nuevas = [v for v in mundo.a["vehicles"].docs if v["id"] != "v1"]
    assert [(v["license_plate"], v["status"], v["center"], v["origen"]) for v in nuevas] == [
        ("1234 ABC", "active", "PRINCIPAL", "alta"), ("B 1234 XY", "active", "PRINCIPAL", "alta")]
    assert {c["id"] for c in cuerpo["creadas"]} == {v["id"] for v in nuevas}
    # Repetirlo no duplica nada.
    otra = _furgonetas(mundo, "1234 abc\nB-1234-XY", guardar=True).json()
    assert otra["nuevas"] == 0 and otra["ya_estaban"] == 2 and otra["creadas"] == []
    assert len(mundo.a["vehicles"].docs) == 3


def test_la_sede_de_las_furgonetas(mundo):
    adm_b = _sesion_admin("adm-b", "orgb")
    r = _furgonetas(mundo, "1234 ABC", admin=adm_b)
    assert r.status_code == 400 and r.json() == {"detail": "Elige la sede de estas furgonetas: tienes varias.",
                                                 "codigo": "elige_sede"}
    assert _furgonetas(mundo, "1234 ABC", admin=adm_b, center="sur").json()["center"] == "SUR"
    r = _furgonetas(mundo, "1234 ABC", admin=adm_b, center="MADRID")
    assert r.status_code == 400 and r.json() == {"detail": "Ese centro no es de tu empresa.", "codigo": "centro_ajeno"}
    jefe = _sesion_admin("adm-b-norte", "orgb")
    assert _furgonetas(mundo, "1234 ABC", admin=jefe).json()["center"] == "NORTE"          # la única que ve
    r = _furgonetas(mundo, "1234 ABC", admin=jefe, center="SUR")
    assert r.status_code == 403 and r.json() == {"detail": "No tienes acceso a ese centro", "codigo": "centro_no_visible"}
    # La que ya está en un centro que no ve: ni «ya la tienes» ni se toca.
    mundo.b["vehicles"].docs.append({"id": "vs", "license_plate": "2222 SSS", "status": "active", "center": "SUR"})
    fila = _furgonetas(mundo, "2222SSS", admin=jefe, guardar=True).json()["lineas"][0]
    assert fila["estado"] == "error" and fila["motivo"] == "Es de un centro que no tienes asignado."
    assert len(mundo.b["vehicles"].docs) == 1


def test_sin_centros_en_la_empresa_las_furgonetas_van_sin_centro(mundo, monkeypatch):
    async def sin_naves():
        return []
    monkeypatch.setattr(server, "_centros_de_la_empresa", sin_naves)
    r = _furgonetas(mundo, "1234 ABC", guardar=True).json()
    assert r["center"] is None and "center" not in mundo.a["vehicles"].docs[0]


def test_lo_que_no_se_puede_revisar_se_dice(mundo):
    for texto, msg in (("", "Pega o escribe al menos una matrícula."), ("\n  \n", "Pega o escribe al menos una matrícula."),
                       (None, "Pega o escribe al menos una matrícula."), (["1234 ABC"], "Pega o escribe al menos una matrícula."),
                       ("1234 ABC\n" * 301, "Son demasiadas líneas: pega como mucho 300 de una vez."),
                       ("x" * 20001, "Son demasiadas líneas: pega como mucho 300 de una vez.")):
        r = _furgonetas(mundo, texto)
        codigo = "sin_matriculas" if msg.startswith("Pega") else "demasiadas_lineas"
        assert r.status_code == 400 and r.json() == {"detail": msg, "codigo": codigo}, texto
    assert _furgonetas(mundo, "1234 ABC\n" * 300).status_code == 200
    r = mundo.http.post("/api/alta/furgonetas", json=[1, 2], headers=_h(_sesion_admin()))
    assert r.status_code in (400, 422) and r.status_code != 500


# ── /alta/conductores ─────────────────────────────────────────────────────────

def test_los_conductores_se_revisan_linea_a_linea(mundo):
    texto = "\n".join([
        "Ana Gómez, 612 345 678",
        "Luis Pérez\t698765432\tluis@ejemplo.es",
        "Rosa Martín",
        "Pedro Ruiz 611 22 33 44",
        "Juan; +34 600 111 222; JUAN@Ejemplo.es",
        "Jo, 600123123",
        "Marta Sanz, 612 34",
        "Ana Duplicada, 612345678",
        "rosa martin",
        "Rosa M.",
        "Pepe de baja, 699000111",
    ])
    r = _conductores(mundo, texto)
    assert r.status_code == 200, r.text
    c = r.json()
    lineas = {f["n"]: f for f in c["lineas"]}
    # Con su `codigo`, `aviso_codigo` y `dato` (R12, 14-11-2026).
    assert lineas[1] == {"n": 1, "texto": "Ana Gómez, 612 345 678", "nombre": "Ana Gómez", "movil": "+34612345678",
                         "email": None, "estado": "ya_estaba", "motivo": "Ya está dado de alta como «Ana López».",
                         "aviso": None, "codigo": "conductor_ya_estaba", "aviso_codigo": None, "dato": "Ana López"}
    assert lineas[2] == {"n": 2, "texto": "Luis Pérez\t698765432\tluis@ejemplo.es", "nombre": "Luis Pérez",
                         "movil": "+34698765432", "email": "luis@ejemplo.es", "estado": "ya_estaba",
                         "motivo": "Ya está dado de alta como «Luis Pérez».", "aviso": None,
                         "codigo": "conductor_ya_estaba", "aviso_codigo": None, "dato": "Luis Pérez"}
    assert lineas[3] == {"n": 3, "texto": "Rosa Martín", "nombre": "Rosa Martín", "movil": None, "email": None,
                         "estado": "nuevo", "motivo": None, "aviso": "Sin móvil: tendrás que copiarle el enlace.",
                         "codigo": None, "aviso_codigo": "sin_movil", "dato": None}
    assert (lineas[4]["nombre"], lineas[4]["movil"], lineas[4]["estado"]) == ("Pedro Ruiz", "+34611223344", "nuevo")
    assert (lineas[5]["nombre"], lineas[5]["movil"], lineas[5]["email"], lineas[5]["estado"]) == \
        ("Juan", "+34600111222", "juan@ejemplo.es", "nuevo")
    assert (lineas[6]["estado"], lineas[6]["motivo"]) == ("error", "Falta el nombre.")
    assert (lineas[7]["estado"], lineas[7]["motivo"]) == ("error", "El móvil «612 34» no parece un número.")
    assert (lineas[8]["estado"], lineas[8]["motivo"]) == ("error", "Repetida en la lista.")       # el móvil de la 1
    assert (lineas[9]["estado"], lineas[9]["motivo"]) == ("error", "Repetida en la lista.")       # el nombre de la 3
    # Sin «.».» al final cuando el nombre ya acaba en punto (panel2, 13).
    assert (lineas[10]["estado"], lineas[10]["motivo"]) == ("ya_estaba", "Ya está dado de alta como «Rosa M.»")
    assert lineas[11]["estado"] == "nuevo"                     # la ficha de baja no cuenta como «ya está»
    assert (c["nuevos"], c["ya_estaban"], c["errores"]) == (4, 3, 4)
    assert c["center"] == "PRINCIPAL" and c["guardado"] is False and c["creados"] == []
    assert len(mundo.a["drivers"].docs) == 4                   # sin guardar, nada


def test_guardar_da_de_alta_a_los_nuevos_como_el_alta_a_mano(mundo):
    r = _conductores(mundo, "Rosa Martín\nPedro Ruiz 611 22 33 44\nAna López, 612345678", guardar=True)
    assert r.status_code == 200, r.text
    c = r.json()
    nuevos = {d["name"]: d for d in mundo.a["drivers"].docs if d["id"] not in ("d-ana", "d-luis", "d-rosa", "d-pepe")}
    assert sorted(nuevos) == ["Pedro Ruiz", "Rosa Martín"]
    assert nuevos["Pedro Ruiz"]["movil_personal"] == "+34611223344" and nuevos["Pedro Ruiz"]["center"] == "PRINCIPAL"
    assert nuevos["Rosa Martín"]["movil_personal"] is None
    assert sorted(x["nombre"] for x in c["creados"]) == ["Pedro Ruiz", "Rosa Martín"]
    assert {x["id"] for x in c["creados"]} == {d["id"] for d in nuevos.values()}
    # Con el correo de una ficha de baja, create_driver pide reactivarla: esa línea pasa a error con su mensaje.
    mundo.a["drivers"].docs[3]["email"] = "pepe@x.es"
    r2 = _conductores(mundo, "Pepe Vuelve, pepe@x.es", guardar=True).json()
    assert r2["lineas"][0]["estado"] == "error" and "Reactivala" in r2["lineas"][0]["motivo"]
    assert r2["creados"] == []


def test_la_sede_de_los_conductores(mundo):
    adm_b = _sesion_admin("adm-b", "orgb")
    r = _conductores(mundo, "Nuevo Uno, 600000001", admin=adm_b)
    assert r.status_code == 400 and r.json() == {"detail": "Elige la sede de estos conductores: tienes varias.",
                                                 "codigo": "elige_sede"}
    r = _conductores(mundo, "Nuevo Uno, 600000001", admin=adm_b, center="SUR", guardar=True)
    assert r.status_code == 200 and r.json()["center"] == "SUR"
    assert [d["center"] for d in mundo.b["drivers"].docs if d["name"] == "Nuevo Uno"] == ["SUR"]
    jefe = _sesion_admin("adm-b-norte", "orgb")
    assert _conductores(mundo, "Otro Más", admin=jefe).json()["center"] == "NORTE"
    assert _conductores(mundo, "Otro Más", admin=jefe, center="SUR").status_code == 403
    assert _conductores(mundo, "Otro Más", admin=jefe, center="LEJOS").json() == {
        "detail": "Ese centro no es de tu empresa.", "codigo": "centro_ajeno"}
    # Uno de un centro que no ve: no se dice cómo se llama ni se duplica.
    fila = _conductores(mundo, "Sergio Sur", admin=jefe).json()["lineas"][0]
    assert fila["estado"] == "error" and fila["motivo"] == "Es de un centro que no tienes asignado."
    vacio = _conductores(mundo, "  \n ")
    assert vacio.status_code == 400 and vacio.json() == {"detail": "Pega o escribe al menos un conductor.",
                                                         "codigo": "sin_conductores"}


def test_la_lista_pegada_y_el_enlace_casan_de_principio_a_fin(mundo):
    """El camino entero del dueño: pega un conductor, le crea su enlace y el conductor entra con un toque."""
    c = _conductores(mundo, "Marta Nueva, 677 888 999", guardar=True).json()
    nuevo = c["creados"][0]["id"]
    acceso = _crear(mundo, nuevo).json()
    assert acceso["whatsapp"] == "34677888999" and acceso["nombre"] == "Marta Nueva"
    entra = _canjear(mundo, acceso["token"], dispositivo=TEL_ANA)
    assert entra.status_code == 200 and entra.json()["id"] == nuevo and entra.json()["center"] == "PRINCIPAL"
