# -*- coding: utf-8 -*-
"""EL CP ESCRITO, CON LA REGLA DEL PAÍS DE LA CUENTA (03-11-2026). Sin CP aparte, la parada se guardaba con el que sacaba
reparto.extrae_cp, que solo sabe el de España: en EE. UU. «12345 Lake City Way NE, Seattle, WA 98125» quedaba con el
12345 (el número de la casa; ese CP es de Schenectady, Nueva York) y se buscaba con él; en Brasil, «01310-100» con
«01310», y en Portugal, Francia o Reino Unido, sin CP. Ahora, con la regla del país (geocodificador.cps_escritos y
cp_escrito): donde el número va delante, el de la casa no es el CP, y el CP es el último que encaja. En España, como
antes. En el alta, al editar (el repartidor y la oficina), al pegar una lista, en el ticket, en la zona, en «¿Dónde cae
esta dirección?», en la sugerencia abandonada y en la puerta aprendida."""
import contextlib
import re
from types import SimpleNamespace

import pytest

import geocodificador as G
import reparto
import server
from base_de_mentira import Col, Db

HOY = "2026-11-03"
ANA = {"sub": "d1", "role": "driver", "name": "ANA", "org_id": "o1"}
OFICINA = {"sub": "a1", "role": "admin", "name": "Oficina", "db_name": "dsp_x", "org_id": "o1"}
ZONA = {"us": "America/Los_Angeles", "br": "America/Sao_Paulo", "pt": "Europe/Lisbon", "fr": "Europe/Paris",
        "gb": "Europe/London", "es": "Europe/Madrid"}
SEATTLE = "12345 Lake City Way NE, Seattle, WA 98125"
# El país, una dirección y su CP, y otra del mismo país y el suyo (para cambiarla).
CASOS = [
    ("us", SEATTLE, "98125", "1200 5th Ave, Seattle, WA 98101", "98101"),
    ("br", "Avenida Paulista 1000, 01310-100 São Paulo", "01310-100", "Rua da Assembleia 10, 20040-020 Rio de Janeiro",
     "20040-020"),
    ("pt", "Rua Augusta 100, 1100-053 Lisboa", "1100-053", "Rua de Santa Catarina 5, 4000-447 Porto", "4000-447"),
    ("fr", "12 rue de la Paix, 75002 Paris", "75002", "1 place de la Concorde, 75008 Paris", "75008"),
    ("gb", "10 Downing Street, London SW1A 2AA", "SW1A 2AA", "221B Baker Street, London NW1 6XE", "NW1 6XE"),
    ("es", "Rúa Real 5, 15003 A Coruña", "15003", "Rúa Brétema Mariñeira 23, 15011 A Coruña", "15011"),
]


@contextlib.contextmanager
def en(pais):
    """La cuenta, de ese país (lo que pone get_current_user en cada petición del reparto)."""
    t = server._region_actual.set((pais, ZONA[pais]))
    try:
        yield
    finally:
        server._region_actual.reset(t)


def test_el_cp_escrito_con_la_regla_del_pais():
    for pais, d, cp, otra, cp_otra in CASOS:
        assert (reparto.extrae_cp(d, pais), reparto.extrae_cp(otra, pais)) == (cp, cp_otra), pais
    # Donde el número va delante, el de la casa no es el CP (sin ZIP, ninguno) y el CP es el último que encaja.
    assert reparto.extrae_cp("12345 Lake City Way NE, Seattle", "us") == ""
    assert reparto.extrae_cp("12500 15th Ave NE, Seattle, WA 98125", "us") == "98125"
    assert reparto.extrae_cp("12345 1/2 Main St, Springfield", "us") == ""
    assert reparto.extrae_cp("Seattle, WA 98125-1234", "us") == "98125"           # el ZIP, sin los cuatro de detrás
    assert reparto.extrae_cp("10 downing street, london sw1a 2aa", "gb") == "SW1A 2AA"
    # Donde va detrás, un número de casa largo tampoco gana: el CP va después.
    assert reparto.extrae_cp("Blvd. Agua Caliente 10440, Col. Aviación, 22420 Tijuana", "mx") == "22420"
    assert reparto.extrae_cp("Invalidenstraße 1, 10115 Berlin", "de") == "10115"
    # En España (y sin decir el país), el primero con la regla de siempre.
    de_siempre = re.compile(r"\b(0[1-9]|[1-4]\d|5[0-2])\d{3}\b")
    for d in (SEATTLE, "Avenida Paulista 1000, 01310-100 São Paulo", "Rúa Real 5, 15003 A Coruña", "Calle Mayor 12345",
              "C/ Real 1, 28013 Madrid (antes 15003)", "Rúa Real 5, 15003A Coruña",
              "Polígono de Sabón parcela 7, 15142 Arteixo", "", None):
        m = de_siempre.search(str(d or ""))
        assert reparto.extrae_cp(d) == reparto.extrae_cp(d, "es") == reparto.extrae_cp(d, "") == (m.group(0) if m else ""), d


def test_los_cp_escritos_sin_el_numero_de_la_casa():
    assert G.cps_escritos(SEATTLE, "us") == ["98125"]
    assert G.cps_escritos("12345 Lake City Way NE, Seattle", "us") == []
    assert G.cps_escritos("Blvd. Agua Caliente 10440, Col. Aviación, 22420 Tijuana", "mx") == ["10440", "22420"]
    # En España, los de su regla y en su orden, como antes.
    d = "Rúa Real 5, 15003 A Coruña (antes 15004)"
    assert G.cps_escritos(d, "es") == [m.group(1) for m in G.CP_ES.finditer(d)] == ["15003", "15004"]


@pytest.fixture
def base(monkeypatch):
    db = Db()
    db["drivers"] = Col([{"id": "d1", "name": "ANA PÉREZ"}, {"id": "d2", "name": "LUIS GÓMEZ"}])
    buscadas = []

    async def ubicar(direccion, cp="", localidad="", base=None, cerca=None):
        buscadas.append((direccion, cp, localidad))
        return None

    async def org(_id):
        return {"id": "o1", "account_type": "dsp", "modulos": ["dashboard", "reparto", "configuracion"]}

    class _Cliente(dict):
        def __missing__(self, _nombre):
            return db
    monkeypatch.setattr(server, "db", db)
    monkeypatch.setattr(server, "global_db", Db())
    monkeypatch.setattr(server, "client", _Cliente())
    monkeypatch.setattr(server, "_rep_ubicar", ubicar)
    monkeypatch.setattr(server, "get_org", org)
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)
    monkeypatch.setattr(server, "_rep_programar_ubicacion", lambda fecha: None)    # lo pegado se busca aquí, a mano
    server._REP_LIMPIEZA.clear()
    return SimpleNamespace(db=db, buscadas=buscadas)


@pytest.mark.asyncio(loop_scope="session")
async def test_el_repartidor_guarda_y_busca_con_el_cp_de_su_pais(base):
    """El alta y el cambio de dirección del repartidor sin CP aparte: se guarda y se busca con el de la regla del país."""
    for pais, d, cp, otra, cp_otra in CASOS:
        with en(pais):
            base.buscadas.clear()
            p = await server.reparto_mis_pedidos({"direccion": d}, ANA)
            assert (p["cp"], base.buscadas) == (cp, [(d, cp, "")]), pais
            base.buscadas.clear()
            r = await server.reparto_mi_editar(p["id"], {"direccion": otra}, ANA)
            assert (r["cp"], base.buscadas) == (cp_otra, [(otra, cp_otra, "")]), pais
            # Con su CP aparte, el suyo, como siempre.
            assert (await server.reparto_mi_editar(p["id"], {"direccion": d, "cp": cp}, ANA))["cp"] == cp


@pytest.mark.asyncio(loop_scope="session")
async def test_la_oficina_guarda_y_busca_con_el_cp_de_su_pais(base):
    """El alta de la oficina, pegar una lista (y la hoja compartida) y el PATCH sin CP aparte: el de la regla del país.
    En el PATCH, el CP y la población de la dirección de antes ya no se quedan para buscar una nueva que trae otro CP."""
    for pais, d, cp, otra, cp_otra in CASOS:
        with en(pais):
            base.buscadas.clear()
            p = await server.reparto_crear({"direccion": d}, OFICINA)
            assert (p["cp"], base.buscadas) == (cp, [(d, cp, "")]), pais
            await base.db.reparto_pedidos.update_one({"id": p["id"]}, {"$set": {"localidad": "La de antes"}})
            base.buscadas.clear()
            r = await server.reparto_editar(p["id"], {"direccion": otra}, OFICINA)
            assert (r["cp"], r["localidad"], base.buscadas) == (cp_otra, "", [(otra, cp_otra, "")]), pais
            # Pegada en una lista sin columna de CP: lo que se enseña, lo que se guarda y con lo que se busca después.
            texto = f"Cliente;Dirección\nAna;{d}\n"
            assert (await server.reparto_pegar({"texto": texto}, OFICINA))["filas"][0]["cp"] == cp, pais
            n = len(base.db["reparto_pedidos"].docs)
            await server.reparto_pegar({"texto": texto, "confirmar": True}, OFICINA)
            assert base.db["reparto_pedidos"].docs[n]["cp"] == cp, pais
            base.buscadas.clear()
            await server._rep_ubicar_pendientes(HOY)
            assert base.buscadas == [(d, cp, "")], pais
    # La hoja compartida (la línea, sin el CP: lo pone el alta).
    with en("us"):
        n = len(base.db["reparto_pedidos"].docs)
        await server.reparto_pegar({"texto": f"Maria L.\n{SEATTLE}\n", "hoja": True, "confirmar": True}, OFICINA)
        assert (base.db["reparto_pedidos"].docs[n]["direccion"], base.db["reparto_pedidos"].docs[n]["cp"]) == (SEATTLE, "98125")
    # El PATCH en España: sin CP escrito en la nueva ni mandado, el de antes y su población, como antes; con el mismo,
    # también; con otro mandado aparte, la población de antes ya no; vacíos, se buscan vacíos (antes se guardaban
    # vacíos y se buscaba con los de antes).
    with en("es"):
        p = await server.reparto_crear({"direccion": "Rúa Real 5, 15003 A Coruña", "localidad": "A Coruña"}, OFICINA)
        for cambio, buscada in (
                ({"direccion": "Rúa Real 7"}, ("Rúa Real 7", "15003", "A Coruña")),
                ({"direccion": "Rúa Real 9, 15003 A Coruña"}, ("Rúa Real 9, 15003 A Coruña", "15003", "A Coruña")),
                ({"direccion": "Rúa Real 5, Oleiros", "cp": "15179"}, ("Rúa Real 5, Oleiros", "15179", "")),
                ({"direccion": "Rúa Nova 3", "cp": "", "localidad": ""}, ("Rúa Nova 3", "", ""))):
            base.buscadas.clear()
            r = await server.reparto_editar(p["id"], cambio, OFICINA)
            assert ((r["direccion"], r["cp"], r["localidad"]), base.buscadas) == (buscada, [buscada]), cambio


def test_el_ticket_y_la_zona_con_el_cp_del_pais():
    assert reparto.limpia_ticket({"direccion": SEATTLE}, "us")["cp"] == "98125"
    assert reparto.limpia_ticket({"direccion": SEATTLE, "cp": "98125"}, "us")["cp"] == "98125"
    assert reparto.limpia_ticket({"direccion": "Rúa Real 5, 15003 A Coruña"})["cp"] == "15003"     # España, como antes
    zonas = [{"nombre": "Schenectady", "cps": ["12345"]}, {"nombre": "Lake City", "cps": ["98125"]}]
    assert reparto.zona_de(SEATTLE, "", zonas, "us")["nombre"] == "Lake City"
    assert reparto.zona_de("12345 Lake City Way NE, Seattle", "", zonas, "us") == {}
    assert reparto.zona_de("Rúa Mallos 4, 15003 A Coruña", "", [{"nombre": "Centro", "cps": ["15003"]}])["nombre"] == "Centro"


@pytest.mark.asyncio(loop_scope="session")
async def test_repartir_por_zonas_con_el_cp_del_pais(base):
    base.db["reparto_ajustes"] = Col([{"id": "ajustes", "zonas": [
        {"nombre": "Schenectady", "cps": ["12345"], "conductor_id": "d2", "conductor_nombre": "LUIS GÓMEZ"},
        {"nombre": "Lake City", "cps": ["98125"], "conductor_id": "d1", "conductor_nombre": "ANA PÉREZ"}]}])
    base.db["reparto_pedidos"].docs.append({"id": "s1", "fecha": HOY, "conductor_id": "", "estado": "pendiente",
                                            "direccion": SEATTLE, "cp": "", "zona": ""})
    with en("us"):
        assert (await server.reparto_repartir({"fecha": HOY}, OFICINA))["asignados"] == 1
    s = base.db["reparto_pedidos"].docs[-1]
    assert (s["zona"], s["conductor_id"]) == ("Lake City", "d1")


def test_la_sugerencia_no_se_da_por_abandonada_por_el_numero_de_la_casa():
    with en("us"):
        assert not server._rep_sugerencia_ajena({"cp": "98125"}, "12345 Lake City Way NE, Seattle")       # antes, sí
        assert not server._rep_sugerencia_ajena({"cp": "98125"}, SEATTLE)
        assert not server._rep_sugerencia_ajena({"cp": "98125"}, "12345 Lake City Way NE, Seattle, WA 98125-1234")
        assert server._rep_sugerencia_ajena({"cp": "98101"}, SEATTLE)
    # En España, como antes.
    assert server._rep_sugerencia_ajena({"cp": "15179"}, "Rúa Brétema Mariñeira 23, 15011 A Coruña")
    assert not server._rep_sugerencia_ajena({"cp": "15179"}, "Rúa Brétema, 15179 Oleiros")


@pytest.mark.asyncio(loop_scope="session")
async def test_donde_cae_busca_con_el_cp_con_el_que_se_guardaria(base, monkeypatch):
    pedidas = []

    async def detalle(direccion, cp="", localidad="", base=None, cerca=None):
        pedidas.append((direccion, cp))
        return {"lat": None, "lng": None, "precision": None, "fuente": "", "direccion": "", "candidatos": [],
                "fuentes": [], "incompleta": False, "cc": False}
    monkeypatch.setattr(server, "_rep_ubicar_detalle", detalle)
    monkeypatch.setattr(server, "_rl_public_action", lambda *a, **k: None)
    with en("us"):
        await server.reparto_ubicar({"direccion": SEATTLE}, ANA)
        await server.reparto_ubicar({"direccion": SEATTLE, "cp": "98125"}, ANA)
    with en("es"):
        await server.reparto_ubicar({"direccion": "Rúa Real 5, 15003 A Coruña"}, ANA)
    assert pedidas == [(SEATTLE, "98125"), (SEATTLE, "98125"), ("Rúa Real 5, 15003 A Coruña", "15003")]


@pytest.mark.asyncio(loop_scope="session")
async def test_la_puerta_aprendida_se_compara_con_el_cp_que_se_guarda(base):
    """Con el CP que se guarda (el de la regla del país), no con el que leía la etiqueta, que en EE. UU. era el número de
    la casa: la puerta de «12345 Lake City Way NE, Seattle, WA 98125» vale para la misma con «, USA» detrás."""
    base.db["reparto_pedidos"].docs.append({
        "id": "v1", "fecha": "2026-11-01", "conductor_id": "d1", "estado": "entregado", "direccion": SEATTLE,
        "cp": "98125", "localidad": "", "puerta_lat": 47.7180, "puerta_lng": -122.2930})
    with en("us"):
        p = await server.reparto_mis_pedidos({"direccion": SEATTLE + ", USA"}, ANA)
    assert (p["cp"], p["lat"], p["lng"], p["geo"], base.buscadas) == ("98125", 47.7180, -122.2930, "puerta", [])
