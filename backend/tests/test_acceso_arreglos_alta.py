# -*- coding: utf-8 -*-
"""El arranque tras la segunda revisión (14-11-2026, ARREGLOS-3 A11 y A12; panel2 6 y 13; servidor2 IMPORTANTE 6).

Las listas pegadas como las pega un dueño de verdad (con su cabecera, con dos columnas de Excel, con «Furgo 1» en vez de
una matrícula, con «Apellidos, Nombre») y `/alta/estado`, que el Inicio pregunta a menudo y tiene que ser barata.
Cada prueba fallaba con el código de 901524a. Sin Mongo: base de mentira y las rutas de verdad."""
import pytest
from fastapi.testclient import TestClient

import server
from base_de_mentira import Col
from test_alta_arranque import _conductores, _estado, _furgonetas, _revision
from test_alta_enlace import _h, _sesion_admin, montar_mundo


@pytest.fixture
def mundo(monkeypatch):
    m = montar_mundo(monkeypatch)
    m.http = TestClient(server.app)
    m.a["vehicles"] = Col([])
    m.b["vehicles"] = Col([])
    yield m
    for cache in (server._ACCESO_CACHE, server._login_fails, server._public_actions):
        cache.clear()


def _por_texto(cuerpo):
    return {f["texto"]: f for f in cuerpo["lineas"]}


# ── Las furgonetas ────────────────────────────────────────────────────────────────────────────────────────────────

def test_lo_que_no_parece_una_matricula_sale_aparte_y_solo_entra_si_se_confirma(mundo):
    texto = "\n".join(["Matrícula", "1234 abc", "M-1234-AB", "GC 1234 B", "AB-12-CD", "AB-123-CD", "B-AB 1234",
                       "Furgo 1", "Calle 5", "VAN 12", "Furgoneta 2", "Total: 3", "Nº 12", "Ford Transit"])
    r = _furgonetas(mundo, texto, guardar=True)
    assert r.status_code == 200, r.text
    f = _por_texto(r.json())
    assert (f["Matrícula"]["estado"], f["Matrícula"]["codigo"]) == ("error", "cabecera")
    for buena in ("1234 abc", "M-1234-AB", "GC 1234 B", "AB-12-CD", "AB-123-CD", "B-AB 1234"):
        assert f[buena]["estado"] == "nueva", buena
    for dudosa in ("Furgo 1", "Calle 5", "VAN 12", "Furgoneta 2", "Total: 3"):
        assert (f[dudosa]["estado"], f[dudosa]["codigo"], f[dudosa]["motivo"]) == \
            ("dudosa", "matricula_dudosa", "¿Seguro que es una matrícula?"), dudosa
    for rara in ("Nº 12", "Ford Transit"):
        assert (f[rara]["estado"], f[rara]["codigo"]) == ("error", "matricula_rara"), rara
    assert r.json()["dudosas"] == 5 and r.json()["nuevas"] == 6
    # Se guardaron las seis buenas y ninguna dudosa.
    guardadas = sorted(v["license_plate"] for v in mundo.a["vehicles"].docs)
    assert len(guardadas) == 6 and not any(p.startswith(("FURGO", "CALLE", "VAN", "TOTAL")) for p in guardadas)
    # El dueño confirma «VAN 12»: entra ella y solo ella.
    r = _furgonetas(mundo, "VAN 12\nCalle 5", guardar=True, confirmadas=["van-12"])
    f = _por_texto(r.json())
    assert (f["VAN 12"]["estado"], f["VAN 12"]["confirmada"], f["VAN 12"]["codigo"]) == ("nueva", True, None)
    assert f["Calle 5"]["estado"] == "dudosa"
    assert [c["matricula"] for c in r.json()["creadas"]] == ["VAN 12"]
    # Y una vez dada de alta, ya es suya: la próxima vez sale «ya la tienes», sin preguntar.
    assert _furgonetas(mundo, "VAN 12").json()["lineas"][0]["codigo"] == "matricula_ya_estaba"


def test_dos_columnas_de_excel_cuenta_la_primera(mundo):
    r = _furgonetas(mundo, "Matrícula\tKilómetros\n1234 ABC\t48000 km\n5678 KLM;Ford Transit", guardar=True)
    f = _por_texto(r.json())
    assert f["Matrícula\tKilómetros"]["codigo"] == "cabecera"
    assert (f["1234 ABC\t48000 km"]["estado"], f["1234 ABC\t48000 km"]["matricula"]) == ("nueva", "1234 ABC")
    assert (f["5678 KLM;Ford Transit"]["estado"], f["5678 KLM;Ford Transit"]["matricula"]) == ("nueva", "5678 KLM")
    assert sorted(v["license_plate"] for v in mundo.a["vehicles"].docs) == ["1234 ABC", "5678 KLM"]


def test_una_dudosa_repetida_es_repetida(mundo):
    f = _furgonetas(mundo, "Furgo 1\nFURGO-1").json()["lineas"]
    assert [(x["estado"], x["codigo"]) for x in f] == [("dudosa", "matricula_dudosa"), ("error", "matricula_repetida")]


# ── Los conductores ───────────────────────────────────────────────────────────────────────────────────────────────

def test_la_cabecera_pegada_no_da_de_alta_a_nadie(mundo):
    texto = "Nombre, Teléfono\nNombre\tMóvil\tCorreo\nNombre y apellidos;Teléfono\nMarta Sanz, 677 123 456"
    r = _conductores(mundo, texto, guardar=True)
    f = r.json()["lineas"]
    assert [(x["estado"], x["codigo"]) for x in f[:3]] == [("error", "cabecera")] * 3
    assert f[0]["motivo"] == "Es la cabecera de la lista: no se da de alta." and f[0]["nombre"] is None
    assert [c["nombre"] for c in r.json()["creados"]] == ["Marta Sanz"]
    assert not any("Nombre" in (d.get("name") or "") for d in mundo.a["drivers"].docs)


def test_un_nombre_con_coma_no_se_parte(mundo):
    r = _conductores(mundo, "López García, Ana, 612 999 888\nRuiz, Pedro\nAna\tLópez\t611 222 333").json()
    f = _por_texto(r)
    assert (f["López García, Ana, 612 999 888"]["nombre"], f["López García, Ana, 612 999 888"]["movil"]) == \
        ("López García, Ana", "+34612999888")
    assert f["Ruiz, Pedro"]["nombre"] == "Ruiz, Pedro"
    assert f["Ana\tLópez\t611 222 333"]["nombre"] == "Ana López"


def test_cada_motivo_lleva_su_codigo_y_su_dato(mundo):
    texto = "\n".join(["Jo, 600123123", "Marta Sanz, 612 34", "Ana Duplicada, 612345678", "Rosa Martín",
                       "rosa martin", "Luis P.\t698765432\tluis@ejemplo.es"])
    f = _conductores(mundo, texto).json()["lineas"]
    assert [(x["codigo"], x["dato"]) for x in f] == [
        ("falta_nombre", None), ("telefono_raro", "612 34"), ("conductor_ya_estaba", "Ana López"), (None, None),
        ("conductor_repetido", None), ("conductor_ya_estaba", "Luis Pérez")]
    assert f[3]["aviso_codigo"] == "sin_movil"


def test_el_movil_pegado_se_monta_con_el_pais_de_la_empresa(mundo):
    next(o for o in mundo.g["organizations"].docs if o["id"] == "orga")["pais"] = "pt"
    f = _por_texto(_conductores(mundo, "Rui Costa, 912 345 678\nJoão Silva, 612 345 678\n"
                                       "Ana Sousa, +34 612 777 888").json())
    assert f["Rui Costa, 912 345 678"]["movil"] == "+351912345678"
    assert (f["João Silva, 612 345 678"]["estado"], f["João Silva, 612 345 678"]["codigo"]) == ("error", "telefono_raro")
    assert f["Ana Sousa, +34 612 777 888"]["movil"] == "+34612777888"


def test_en_espana_un_fijo_no_es_un_movil_para_whatsapp(mundo):
    f = _conductores(mundo, "Pepe Fijo, 912 345 678").json()["lineas"][0]
    assert (f["estado"], f["codigo"], f["dato"]) == ("error", "telefono_raro", "912 345 678")


# ── /alta/estado, barata ──────────────────────────────────────────────────────────────────────────────────────────

def test_alta_estado_no_cuenta_todas_las_revisiones_ni_lee_las_fichas_enteras(mundo, monkeypatch):
    mundo.a["vehicles"].docs.append({"id": "v1", "license_plate": "5678 KLM", "status": "active", "center": "PRINCIPAL"})
    mundo.a["inspections"] = Col([_revision("r%d" % i, "v1", "d-ana", "2026-11-%02dT08:00:00+00:00" % (i + 1))
                                  for i in range(5)])
    llamadas = {"count_insp": 0, "proy_drivers": []}
    insp, drivers = mundo.a["inspections"], mundo.a["drivers"]
    original_count, original_find = insp.count_documents, drivers.find

    async def cuenta(*a, **k):
        llamadas["count_insp"] += 1
        return await original_count(*a, **k)

    def busca(q=None, proy=None, *a, **k):
        llamadas["proy_drivers"].append(dict(proy or {}))
        return original_find(q, proy, *a, **k)

    monkeypatch.setattr(insp, "count_documents", cuenta)
    monkeypatch.setattr(drivers, "find", busca)
    e = _estado(mundo)
    assert llamadas["count_insp"] == 0
    assert e["revisiones"] == 2 and e["revision"]["id"] == "r4" and e["paso_actual"] is None
    assert e["conductores"] == 3 and e["accesos"]["sin_enlace"] == 3
    for proy in llamadas["proy_drivers"]:
        assert not {"name", "email", "movil_personal", "phone"} & {k for k, v in proy.items() if v}, proy


def test_alta_estado_dice_una_sola_revision_cuando_hay_una(mundo):
    mundo.a["vehicles"].docs.append({"id": "v1", "license_plate": "5678 KLM", "status": "active", "center": "PRINCIPAL"})
    mundo.a["inspections"] = Col([_revision("r1", "v1", "d-ana", "2026-11-14T08:00:00+00:00")])
    assert _estado(mundo)["revisiones"] == 1


def test_alta_estado_cuenta_los_enlaces_igual_que_la_lista(mundo):
    from test_alta_enlace import _canjear, _crear
    token = _crear(mundo, "d-ana").json()["token"]
    assert _canjear(mundo, token).status_code == 200
    assert _crear(mundo, "d-luis").status_code == 200
    lista = mundo.http.get("/api/conductores/accesos", headers=_h(_sesion_admin())).json()
    e = _estado(mundo)
    assert e["accesos"] == lista["cuentas"] == {"sin_enlace": 1, "sin_abrir": 1, "abierto": 1, "caducado": 0}
    assert e["conductores"] == len(lista["conductores"])
