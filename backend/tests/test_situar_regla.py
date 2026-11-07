# -*- coding: utf-8 -*-
"""SITUAR LA PARADA SIN EL PUNTO DE OTRA CALLE (03-11-2026): la parte del servidor, contra una base de mentira y sin
salir a Internet.

El emulador y el revisor encontraron caminos que guardaban la dirección escrita con el punto de OTRA calle (el grave:
«Rúa Brétema Mariñeira 23, 15011 A Coruña» guardada con el punto de «Rúa Brétema, 15179 Oleiros», a 8 km, y la guía
llevando a Oleiros). Qué dirección y qué precisión se guardan lo decide la app con la regla de «Situar la parada» (la
misma en ui/hoy/Situar.kt y en lib/situar.js); lo que se prueba aquí es lo que hace el servidor con lo que le llega:
  · GET /reparto/mis-direcciones («Ya estuviste aquí»), desde el 03-11-2026: solo cuentan las paradas ENTREGADAS
    (las fallidas nunca, tampoco por «Dirección incorrecta») y una dirección solo sale si alguna de ellas aprendió la
    puerta (la posición del móvil al entregar, precisa y a 300 m o menos del punto); el punto es esa puerta, con
    precisión "portal". Una entregada lejos del punto guardado (sin puerta) no sale. Y sin entrega no queda puerta:
    ni al reabrirla ni al darla por fallida;
  · «Es aquí» con una sugerencia (POST /reparto/mis-pedidos/{pid}/editar con direccion, cp, localidad, lat, lng y
    precision) y el alta con la sugerencia elegida (POST /reparto/mis-pedidos): se guardan la dirección, el CP, la
    población y el punto que manda la app, «aprox» o «manual» según la precisión, SIN volver a buscar nada;
  · los casos de la regla tal como los manda la app (desde la ficha, desde «Situar» y desde Hoy o la ruta);
  · la sugerencia abandonada (03-11-2026): si la dirección que queda trae escrito otro CP que el de la sugerencia, el
    CP, la población y el punto de la sugerencia no se guardan con ella (se busca lo escrito). Los CP escritos, con la
    regla del país de la cuenta (fuera de España, la de España daba por abandonada una sugerencia recién elegida);
  · la puerta aprendida (03-11-2026): la de una dirección que empieza por la otra vale solo si lo que sobra es el piso
    o si las dos son del mismo sitio (el mismo CP o, si no, el mismo municipio); con el piso, si las dos dicen dónde,
    también el mismo sitio (la séptima tanda); la de la misma dirección escrita, si alguna no dice dónde o si las dos
    son del mismo sitio (la que no lo dice, solo si ninguna con esa dirección, con el piso o con el sitio detrás dice
    otro sitio: la sexta y la séptima tanda); y el nombre de la provincia con el CP de otro municipio no es un pueblo
    («A Coruña» con el 15179 no es la ciudad).
Las direcciones son calles y edificios públicos o inventados, y los puntos, inventados: nada de una persona.
"""
import random
from types import SimpleNamespace

import pytest

import reparto as R
import server
from base_de_mentira import Col, Db

HOY = "2026-11-03"
ANA = {"sub": "d1", "role": "driver", "name": "ANA", "org_id": "o1"}

BRETEMA_D = "Rúa Brétema Mariñeira 23, 15011 A Coruña"     # la parada (D)
BRETEMA_S = "Rúa Brétema, 15179 Oleiros"                    # la sugerencia de otra calle (S), a unos 8 km
OLEIROS = (43.3412, -8.3150)
CORUNA_15011 = (43.3570, -8.4110)
REAL_CALLE = (43.3705, -8.3995)                             # «Calle Real, 15003 A Coruña»: la calle, sin el portal
REAL_85 = (43.3716, -8.3981)                                # «Calle Real 85»: un portal, pero no el de la parada
REAL_5 = (43.3712, -8.3990)


class SinRed:
    """La red del geocodificador: en estas pruebas no se le pregunta a nadie. Si alguien pregunta, queda apuntado y no
    se le contesta."""

    def __init__(self):
        self.pedidas = []

    async def get(self, srv, url, params, tope, idioma=None):
        self.pedidas.append((srv, dict(params)))
        return {"status": "tope", "json": None}


@pytest.fixture
def base(monkeypatch):
    db = Db()
    db["drivers"] = Col([{"id": "d1", "name": "ANA PÉREZ"}, {"id": "d2", "name": "LUIS GÓMEZ"}])
    busquedas = []

    async def org(_id):
        return {"id": "o1", "account_type": "dsp", "modulos": ["dashboard", "reparto", "configuracion"]}

    async def ubicar(*a, **k):                      # volver a buscar la dirección: aquí no tiene que pasar
        busquedas.append((a, k))
        return None

    red = SinRed()
    monkeypatch.setattr(server, "db", db)
    monkeypatch.setattr(server, "global_db", Db())
    monkeypatch.setattr(server, "get_org", org)
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)
    monkeypatch.setattr(server, "_rep_ubicar", ubicar)
    monkeypatch.setattr(server, "_REP_GEO_RED", red)
    server._REP_GEO_HECHOS.clear()
    server._REP_CC_CACHE.clear()
    server._public_actions.clear()
    return SimpleNamespace(db=db, busquedas=busquedas, red=red, sin_buscar=lambda: not busquedas and not red.pedidas)


def _de_antes(db, pid, direccion, fecha, estado="entregado", punto=REAL_5, geo="ok", conductor="d1", **extra):
    """Una parada del historial, con su punto."""
    p = {"id": pid, "conductor_id": conductor, "fecha": fecha, "estado": estado, "direccion": direccion,
         "cp": R.extrae_cp(direccion), "localidad": "", "lat": punto[0], "lng": punto[1], "geo": geo, **extra}
    if geo is None:
        del p["geo"]                                # una parada de antes de que existiera el campo
    db["reparto_pedidos"].docs.append(p)
    return p


async def _suya(q, direccion=None):
    r = (await server.reparto_mis_direcciones(q, ANA))["direcciones"]
    return r if direccion is None else next(x for x in r if x["direccion"] == direccion)


# ── «Ya estuviste aquí»: solo donde ya se entregó, y con la puerta (03-11-2026) ─────────────────────────────────
# Antes contaban las cerradas (también las fallidas) y las entregadas sin puerta, con el punto guardado: el revisor
# vio que la de Brétema guardada con el punto de Oleiros saldría al día siguiente como «Ya estuviste aquí · 1 vez»
# con el punto de Oleiros, y las dos apps la toman tal cual.

PUERTA_REAL_5 = (43.37123, -8.39897)                         # la puerta aprendida en «Rúa Real 5», a unos pasos


def _puerta(punto, precision=8.0):
    return {"puerta_lat": punto[0], "puerta_lng": punto[1], "puerta_precision": precision}


@pytest.mark.asyncio(loop_scope="session")
async def test_ya_estuviste_aqui_solo_cuenta_las_entregadas(base):
    """Las fallidas y las que siguen sin cerrar no cuentan ni ponen su cliente ni su punto; las veces, la última vez,
    el cliente y el teléfono salen de las entregadas, y el punto, de la puerta aprendida."""
    real = "Rúa Real 5, 15003 A Coruña"
    _de_antes(base.db, "a1", real, "2026-10-20", cliente="Bar Inventado", telefono="600000001", **_puerta(PUERTA_REAL_5))
    _de_antes(base.db, "a2", real, "2026-10-27", estado="fallido", motivo="No había nadie", cliente="Otro cliente",
              telefono="600000008")
    # Hoy otra vez en la ruta, y una de ayer sin cerrar.
    _de_antes(base.db, "a3", real, HOY, estado="pendiente", punto=(43.3800, -8.4100), cliente="Otro cliente",
              telefono="600000009")
    _de_antes(base.db, "a4", real, "2026-11-02", estado="en_ruta", punto=(43.3800, -8.4100), cliente="Otro cliente")
    r = await _suya("real 5")
    assert len(r) == 1
    assert (r[0]["veces"], r[0]["ultima"], r[0]["cliente"], r[0]["telefono"]) == (1, "2026-10-20", "Bar Inventado", "600000001")
    assert (r[0]["lat"], r[0]["lng"], r[0]["puerta"], r[0]["precision"]) == (*PUERTA_REAL_5, True, "portal")


@pytest.mark.asyncio(loop_scope="session")
async def test_una_fallida_por_direccion_incorrecta_no_sale(base):
    """El caso grave: la parada de Brétema guardada con el punto de Oleiros y cerrada como fallida por «Dirección
    incorrecta» (justo la señal de que allí no se encontró). No sale, ni aunque guarde una puerta de cuando se dio por
    entregada antes de cambiarla (los datos de antes del 03-11-2026)."""
    _de_antes(base.db, "b1", BRETEMA_D, "2026-11-02", estado="fallido", motivo="Dirección incorrecta", punto=OLEIROS,
              geo="manual", geo_origen="sugerencia")
    _de_antes(base.db, "b2", BRETEMA_D, "2026-11-01", estado="fallido", motivo="Dirección incorrecta", punto=OLEIROS,
              geo="manual", **_puerta((OLEIROS[0] + 0.0001, OLEIROS[1])))
    _de_antes(base.db, "b3", BRETEMA_D, HOY, estado="pendiente", punto=OLEIROS, geo="manual")
    assert await _suya("Bretema") == []
    assert await _suya(BRETEMA_D) == []
    # Y la parada nueva en esa dirección no nace en esa «puerta».
    assert await server._rep_puerta_aprendida("d1", BRETEMA_D) is None


@pytest.mark.asyncio(loop_scope="session")
async def test_una_entregada_lejos_del_punto_no_sale(base):
    """La de Brétema con el punto de Oleiros, entregada en A Coruña: la posición del móvil queda a 8 km del punto
    guardado, no se aprende la puerta y la dirección no sale (su punto no lo comprobó nadie)."""
    _de_antes(base.db, "e1", BRETEMA_D, "2026-11-02", estado="pendiente", punto=OLEIROS, geo="manual",
              geo_origen="sugerencia", cliente="Tienda Inventada")
    await server.reparto_estado("e1", {"estado": "entregado", "posicion": {"lat": CORUNA_15011[0],
                                                                            "lng": CORUNA_15011[1], "precision": 8}}, ANA)
    g = _guardada(base.db, "e1")
    assert g["estado"] == "entregado" and g.get("puerta_lat") is None
    assert await _suya("bretema") == []
    assert await _suya("bretema marineira") == []


@pytest.mark.asyncio(loop_scope="session")
async def test_una_entregada_con_puerta_sale_con_la_puerta(base):
    """Entregada con el móvil preciso y cerca del punto: sale una vez, con la puerta como punto y precisión "portal"
    (aunque el punto guardado fuera solo la calle)."""
    _de_antes(base.db, "e2", BRETEMA_D, "2026-11-02", estado="pendiente", punto=CORUNA_15011, geo="aprox",
              cliente="Tienda Inventada", telefono="600000003")
    puerta = (43.3574, -8.4107)                                           # a unos 50 m del punto guardado
    await server.reparto_estado("e2", {"estado": "entregado", "posicion": {"lat": puerta[0], "lng": puerta[1],
                                                                            "precision": 8}}, ANA)
    r = await _suya("bretema marineira")
    assert len(r) == 1
    assert (r[0]["lat"], r[0]["lng"], r[0]["puerta"], r[0]["precision"], r[0]["veces"]) == (*puerta, True, "portal", 1)
    assert (r[0]["direccion"], r[0]["cliente"], r[0]["telefono"], r[0]["ultima"]) == (
        BRETEMA_D, "Tienda Inventada", "600000003", "2026-11-02")


@pytest.mark.asyncio(loop_scope="session")
async def test_dos_entregadas_y_una_con_puerta(base):
    """Dos entregadas en la misma dirección y solo una aprendió la puerta: sale con las dos veces, el punto de la
    puerta y el cliente y el teléfono de la más reciente. Con dos puertas, la más reciente."""
    gamma = "Rúa Inventada Gamma 9, 15003 A Coruña"
    _de_antes(base.db, "c1", gamma, "2026-10-30", punto=REAL_CALLE, geo="aprox", cliente="Cliente Nuevo",
              telefono="600000002")
    _de_antes(base.db, "c2", gamma, "2026-10-10", punto=REAL_CALLE, geo="aprox", cliente="Cliente Viejo",
              telefono="600000001", **_puerta((43.37101, -8.39902)))
    g = (await _suya("gamma"))[0]
    assert (g["veces"], g["lat"], g["lng"], g["puerta"], g["precision"]) == (2, 43.37101, -8.39902, True, "portal")
    assert (g["cliente"], g["telefono"], g["ultima"]) == ("Cliente Nuevo", "600000002", "2026-10-30")
    delta = "Rúa Inventada Delta 11, 15003 A Coruña"
    _de_antes(base.db, "h1", delta, "2026-10-31", punto=REAL_CALLE, **_puerta((43.37103, -8.39904), 6.0))
    _de_antes(base.db, "h2", delta, "2026-10-01", punto=REAL_CALLE, **_puerta((43.37150, -8.39950)))
    _de_antes(base.db, "h3", delta, "2026-10-20", estado="fallido", punto=REAL_CALLE, **_puerta((43.38, -8.40)))
    d = (await _suya("delta"))[0]
    assert (d["veces"], d["lat"], d["lng"]) == (2, 43.37103, -8.39904)
    # Las entregadas sin puerta (también las de antes, sin el campo «geo») no salen, y todas las que salen son portal.
    _de_antes(base.db, "c5", "Rúa Inventada Épsilon 13, 15003 A Coruña", "2026-09-30", geo=None)
    _de_antes(base.db, "c6", "Rúa Inventada Beta 7, 15003 A Coruña", "2026-10-30", geo="manual")
    assert await _suya("epsilon") == [] and await _suya("beta") == []
    assert {x["precision"] for x in await _suya("15003 coruna")} == {"portal"}


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_entrega_no_queda_puerta(base):
    """Reabierta (o dada por fallida) después de entregarla, la parada pierde la puerta: si después se le cambia la
    dirección o el punto y se vuelve a entregar sin una posición precisa, la puerta de antes no se queda con la
    dirección nueva (ni sale como suya, ni la parada nueva nace en ella)."""
    real = "Rúa Real 5, 15003 A Coruña"
    _de_antes(base.db, "f1", real, "2026-11-02", estado="pendiente", punto=REAL_5)
    await server.reparto_estado("f1", {"estado": "entregado", "posicion": {"lat": PUERTA_REAL_5[0],
                                                                            "lng": PUERTA_REAL_5[1], "precision": 8}}, ANA)
    assert (_guardada(base.db, "f1")["puerta_lat"], _guardada(base.db, "f1")["puerta_lng"]) == PUERTA_REAL_5
    await server.reparto_estado("f1", {"estado": "pendiente"}, ANA)
    assert (_guardada(base.db, "f1")["puerta_lat"], _guardada(base.db, "f1")["puerta_precision"]) == (None, None)
    await server.reparto_mi_editar("f1", {"direccion": BRETEMA_S, "cp": "15179", "localidad": "Oleiros",
                                          "lat": OLEIROS[0], "lng": OLEIROS[1], "geo_origen": "sugerencia"}, ANA)
    await server.reparto_estado("f1", {"estado": "entregado"}, ANA)
    assert _guardada(base.db, "f1")["puerta_lat"] is None
    assert await _suya("bretema") == [] and await _suya("real 5") == []
    assert await server._rep_puerta_aprendida("d1", BRETEMA_S) is None
    # Entregada y después fallida: tampoco.
    _de_antes(base.db, "f2", real, "2026-11-02", estado="pendiente", punto=REAL_5)
    await server.reparto_estado("f2", {"estado": "entregado", "posicion": {"lat": PUERTA_REAL_5[0],
                                                                            "lng": PUERTA_REAL_5[1], "precision": 8}}, ANA)
    assert await server._rep_puerta_aprendida("d1", real) == PUERTA_REAL_5
    await server.reparto_estado("f2", {"estado": "fallido", "motivo": "Dirección incorrecta"}, ANA)
    assert _guardada(base.db, "f2")["puerta_lat"] is None
    assert await server._rep_puerta_aprendida("d1", real) is None and await _suya("real 5") == []


@pytest.mark.asyncio(loop_scope="session")
async def test_una_suya_se_guarda_con_su_punto_y_su_precision(base):
    """La regla, punto 1: una «suya» se toma tal cual (dirección, cliente, teléfono y la puerta como punto) con la
    precisión que dice el servidor ("portal"): la parada nueva queda «manual» y sin buscar nada."""
    _de_antes(base.db, "s1", "Rúa Real 999, 15003 A Coruña", "2026-10-30", punto=REAL_CALLE, geo="aprox",
              cliente="Bar Inventado", telefono="600000001", **_puerta((43.37052, -8.39948)))
    s = (await _suya("real 999"))[0]
    assert (s["precision"], s["lat"], s["lng"]) == ("portal", 43.37052, -8.39948)
    p = await server.reparto_mis_pedidos({"direccion": s["direccion"], "cp": s["cp"], "localidad": s["localidad"],
                                          "cliente": s["cliente"], "telefono": s["telefono"], "lat": s["lat"],
                                          "lng": s["lng"], "geo_origen": "sugerencia", "precision": s["precision"]}, ANA)
    assert (p["direccion"], p["lat"], p["lng"], p["geo"], p["geo_origen"], p["cliente"]) == (
        "Rúa Real 999, 15003 A Coruña", 43.37052, -8.39948, "manual", "sugerencia", "Bar Inventado")
    assert base.sin_buscar()
    # La nueva está pendiente: no suma una vez más hasta que se entregue.
    assert (await _suya("real 999"))[0]["veces"] == 1


# ── «Es aquí» y el alta con la sugerencia elegida: se guarda lo que manda la app, sin volver a buscar ─────────────

async def _abierta(db, **campos):
    p = {"id": campos.pop("id", "p1"), "fecha": HOY, "conductor_id": "d1", "estado": "pendiente",
         "direccion": BRETEMA_D, "cp": "15011", "localidad": "A Coruña", "lat": None, "lng": None, "geo": "zona",
         "zona_lat": CORUNA_15011[0], "zona_lng": CORUNA_15011[1], "geo_incompleta": True, **campos}
    db["reparto_pedidos"].docs.append(p)
    return p


def _guardada(db, pid):
    return next(x for x in db["reparto_pedidos"].docs if x["id"] == pid)


@pytest.mark.asyncio(loop_scope="session")
async def test_es_aqui_con_otra_calle_guarda_su_direccion_y_su_punto_sin_buscar(base):
    """La regla, punto 4, desde Hoy o la ruta: con número en D y S de otra calle, la dirección pasa a ser la de S (con
    el piso de D), con su CP, su población y su punto, y la precisión de S. El servidor la guarda tal cual: nunca D con
    el punto de otra calle, y sin volver a buscar."""
    await _abierta(base.db)
    r = await server.reparto_mi_editar("p1", {"direccion": BRETEMA_S, "cp": "15179", "localidad": "Oleiros",
                                              "lat": OLEIROS[0], "lng": OLEIROS[1], "geo_origen": "sugerencia",
                                              "precision": "calle"}, ANA)
    esperado = (BRETEMA_S, "15179", "Oleiros", OLEIROS[0], OLEIROS[1], "aprox", "sugerencia")
    campos = ("direccion", "cp", "localidad", "lat", "lng", "geo", "geo_origen")
    assert tuple(r[k] for k in campos) == esperado
    g = _guardada(base.db, "p1")
    assert tuple(g[k] for k in campos) == esperado
    assert (g["zona_lat"], g["zona_lng"], g["geo_incompleta"]) == (None, None, None)
    assert base.sin_buscar()
    # Después, la chincheta movida a mano (o «Mi ubicación»): «manual», y la dirección ya no cambia.
    r = await server.reparto_mi_editar("p1", {"lat": OLEIROS[0] + 0.0002, "lng": OLEIROS[1], "geo_origen": "mapa"}, ANA)
    assert (r["direccion"], r["cp"], r["localidad"], r["geo"], r["geo_origen"]) == (BRETEMA_S, "15179", "Oleiros", "manual", "mapa")
    assert base.sin_buscar()


@pytest.mark.asyncio(loop_scope="session")
async def test_es_aqui_la_precision_decide_aprox_o_manual(base):
    """La misma petición con un portal ("precision": "portal") o sin precisión (la app 2.4.4, o la chincheta movida):
    «manual». Sin el CP en el cuerpo, el de la dirección nueva; sin la población, ninguna (la de antes era de D)."""
    await _abierta(base.db, id="p2")
    r = await server.reparto_mi_editar("p2", {"direccion": f"{BRETEMA_S}, 3º A", "lat": OLEIROS[0], "lng": OLEIROS[1],
                                              "geo_origen": "sugerencia"}, ANA)
    assert (r["direccion"], r["cp"], r["localidad"], r["geo"]) == (f"{BRETEMA_S}, 3º A", "15179", "", "manual")
    await _abierta(base.db, id="p3")
    r = await server.reparto_mi_editar("p3", {"direccion": BRETEMA_S, "cp": "15179", "localidad": "Oleiros",
                                              "lat": OLEIROS[0], "lng": OLEIROS[1], "geo_origen": "sugerencia",
                                              "precision": "portal"}, ANA)
    assert (r["direccion"], r["localidad"], r["geo"]) == (BRETEMA_S, "Oleiros", "manual")
    assert base.sin_buscar()


@pytest.mark.asyncio(loop_scope="session")
async def test_los_casos_de_la_regla_como_los_manda_la_app(base):
    """Los casos que tienen que salir así en la web y en la app, con lo que cada una manda al servidor."""
    # D «Rúa Real 999, 15003 A Coruña» + S «Calle Real 85» (otro portal de la misma calle) o «Calle Real» (la calle):
    # se queda D, precisión calle. La app manda solo el punto (lo de la cola sin conexión de antes, igual).
    for pid, s in (("r1", REAL_85), ("r2", REAL_CALLE)):
        await _abierta(base.db, id=pid, direccion="Rúa Real 999, 15003 A Coruña", cp="15003")
        r = await server.reparto_mi_editar(pid, {"lat": s[0], "lng": s[1], "geo_origen": "sugerencia",
                                                 "precision": "calle"}, ANA)
        assert (r["direccion"], r["cp"], r["localidad"], r["lat"], r["geo"]) == (
            "Rúa Real 999, 15003 A Coruña", "15003", "A Coruña", s[0], "aprox")
    # D sin el CP ni el pueblo: D con los de S detrás.
    await _abierta(base.db, id="r3", direccion="Rúa Real 999", cp="", localidad="")
    r = await server.reparto_mi_editar("r3", {"direccion": "Rúa Real 999, 15003 A Coruña", "cp": "15003",
                                              "localidad": "A Coruña", "lat": REAL_CALLE[0], "lng": REAL_CALLE[1],
                                              "geo_origen": "sugerencia", "precision": "calle"}, ANA)
    assert (r["direccion"], r["cp"], r["localidad"], r["geo"]) == ("Rúa Real 999, 15003 A Coruña", "15003", "A Coruña", "aprox")
    # D «Rúa Real 5, 2º B, 15003 A Coruña» + S «Calle Real, 5, 15003 A Coruña» (el mismo portal): la de S con el
    # piso de D, precisión portal.
    await _abierta(base.db, id="r4", direccion="Rúa Real 5, 2º B, 15003 A Coruña", cp="15003")
    r = await server.reparto_mi_editar("r4", {"direccion": "Calle Real, 5, 15003 A Coruña, 2º B", "cp": "15003",
                                              "localidad": "A Coruña", "lat": REAL_5[0], "lng": REAL_5[1],
                                              "geo_origen": "sugerencia"}, ANA)
    assert (r["direccion"], r["cp"], r["localidad"], r["lat"], r["geo"]) == (
        "Calle Real, 5, 15003 A Coruña, 2º B", "15003", "A Coruña", REAL_5[0], "manual")
    # D sin número («Hospital Abente y Lago») + cualquier S: la de S.
    await _abierta(base.db, id="r5", direccion="Hospital Abente y Lago", cp="", localidad="")
    r = await server.reparto_mi_editar("r5", {"direccion": "Paseo Inventado, 15002 A Coruña", "cp": "15002",
                                              "localidad": "A Coruña", "lat": 43.3690, "lng": -8.3890,
                                              "geo_origen": "sugerencia", "precision": "calle"}, ANA)
    assert (r["direccion"], r["cp"], r["geo"]) == ("Paseo Inventado, 15002 A Coruña", "15002", "aprox")
    assert base.sin_buscar()


@pytest.mark.asyncio(loop_scope="session")
async def test_el_alta_desde_la_ficha_con_otra_calle(base):
    """Desde la ficha de una parada nueva, lo mismo: la dirección, el CP, la población y el punto de S, sin buscar."""
    p = await server.reparto_mis_pedidos({"direccion": BRETEMA_S, "cp": "15179", "localidad": "Oleiros",
                                          "cliente": "Tienda Inventada", "lat": OLEIROS[0], "lng": OLEIROS[1],
                                          "geo_origen": "sugerencia", "precision": "calle"}, ANA)
    assert (p["direccion"], p["cp"], p["localidad"], p["lat"], p["lng"], p["geo"], p["geo_origen"]) == (
        BRETEMA_S, "15179", "Oleiros", OLEIROS[0], OLEIROS[1], "aprox", "sugerencia")
    p = await server.reparto_mis_pedidos({"direccion": "Calle Real, 5, 15003 A Coruña, 2º B", "localidad": "A Coruña",
                                          "lat": REAL_5[0], "lng": REAL_5[1], "geo_origen": "sugerencia"}, ANA)
    assert (p["cp"], p["localidad"], p["geo"]) == ("15003", "A Coruña", "manual")
    assert base.sin_buscar()


# ── La sugerencia abandonada (03-11-2026): su CP, su población y su punto no van con lo escrito ───────────────────
# El revisor: en la ficha nativa, volver a escribir la dirección tras elegir «Rúa Brétema, 15179 Oleiros» mandaba D con
# el punto, el CP y la población de Oleiros; en la web, D con el CP y el pueblo de la sugerencia. La regla solo manda el
# CP de la sugerencia con la dirección que sale de ella (que lleva ese CP o ninguno): si D trae escrito otro, lo de la
# sugerencia es de otra dirección.

def test_la_sugerencia_es_ajena_solo_con_otro_cp_escrito():
    ajena = server._rep_sugerencia_ajena
    assert ajena({"cp": "15179"}, BRETEMA_D) is True
    assert ajena({"cp": "15011"}, BRETEMA_D) is False and ajena({"cp": " 15011 "}, BRETEMA_D) is False
    assert ajena({"cp": "15179"}, BRETEMA_S) is False                       # la de la sugerencia, con su CP
    assert ajena({"cp": "15179"}, "Rúa Brétema Mariñeira 23, A Coruña") is False   # sin CP escrito no se sabe
    assert ajena({}, BRETEMA_D) is False and ajena({"cp": ""}, BRETEMA_D) is False


@pytest.mark.asyncio(loop_scope="session")
async def test_el_alta_con_la_sugerencia_abandonada_busca_lo_escrito(base):
    p = await server.reparto_mis_pedidos({"direccion": BRETEMA_D, "cliente": "Tienda Inventada", "lat": OLEIROS[0],
                                          "lng": OLEIROS[1], "geo_origen": "sugerencia", "precision": "calle",
                                          "cp": "15179", "localidad": "Oleiros"}, ANA)
    assert (p["direccion"], p["cp"], p["localidad"], p["lat"], p["lng"]) == (BRETEMA_D, "15011", "", None, None)
    assert "geo_origen" not in p and p["cliente"] == "Tienda Inventada"
    assert base.busquedas and base.busquedas[-1][0][:3] == (BRETEMA_D, "15011", "")
    # La web: sin punto, con el CP y el pueblo de la sugerencia abandonada.
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5, 15003 A Coruña", "cp": "15179",
                                          "localidad": "Oleiros"}, ANA)
    assert (p["cp"], p["localidad"]) == ("15003", "")
    assert base.busquedas[-1][0][:3] == ("Rúa Real 5, 15003 A Coruña", "15003", "")


@pytest.mark.asyncio(loop_scope="session")
async def test_al_editar_la_sugerencia_abandonada_no_deja_su_punto(base):
    """Editando: D (la de siempre) con el punto, el CP y la población de Oleiros. La parada se queda como estaba, sin
    punto y sin buscar; con una dirección nueva que trae su CP, se busca esa con el suyo y sin el pueblo de la otra."""
    await _abierta(base.db, id="q1")
    r = await server.reparto_mi_editar("q1", {"direccion": BRETEMA_D, "cliente": "A2", "lat": OLEIROS[0],
                                              "lng": OLEIROS[1], "geo_origen": "sugerencia", "precision": "calle",
                                              "cp": "15179", "localidad": "Oleiros"}, ANA)
    assert (r["direccion"], r["cp"], r["localidad"], r["lat"], r["geo"], r["cliente"]) == (
        BRETEMA_D, "15011", "A Coruña", None, "zona", "A2")
    g = _guardada(base.db, "q1")
    assert (g["lat"], g["lng"], g["geo"], g.get("geo_origen")) == (None, None, "zona", None)
    assert base.sin_buscar()
    r = await server.reparto_mi_editar("q1", {"direccion": "Rúa Real 5, 15003 A Coruña", "cp": "15179",
                                              "localidad": "Oleiros"}, ANA)
    assert (r["direccion"], r["cp"], r["localidad"]) == ("Rúa Real 5, 15003 A Coruña", "15003", "")
    assert base.busquedas[-1][0][:3] == ("Rúa Real 5, 15003 A Coruña", "15003", "")


# ── Fuera de España (03-11-2026, el verificador): los CP escritos con la regla del país de la cuenta ────────────────
# Con la de España, en Brasil «01310-100» se leía «01310» y en EE. UU. el número de la casa («12345»): la sugerencia recién
# elegida se daba por abandonada y se tiraban su punto, su CP y su pueblo.

ZONA = {"es": "Europe/Madrid", "br": "America/Sao_Paulo", "us": "America/Los_Angeles", "pt": "Europe/Lisbon",
        "gb": "Europe/London"}


@pytest.mark.parametrize("pais, cp, direccion, ajena", [
    ("br", "01310-100", "Avenida Paulista 1000, 01310-100 São Paulo", False),
    ("br", "01310100", "Avenida Paulista 1000, 01310-100 São Paulo", False),         # el mismo, sin guion
    ("br", "20040-020", "Avenida Paulista 1000, 01310-100 São Paulo", True),         # otro CEP escrito
    ("us", "98125", "12345 Lake City Way NE, Seattle, WA 98125", False),             # el 12345 es la casa
    ("us", "98125", "12345 Lake City Way NE, Seattle, WA 98125-1234", False),
    ("us", "98101", "12345 Lake City Way NE, Seattle, WA 98125", True),
    ("pt", "1100-053", "Rua Augusta 100, 1100-053 Lisboa", False),
    ("pt", "4000-123", "Rua Augusta 100, 1100-053 Lisboa", True),
    ("gb", "SW1A 2AA", "10 Downing Street, London SW1A2AA", False),
    ("es", "15179", BRETEMA_D, True),
    ("es", "15179", "Rúa Brétema Mariñeira 23, A Coruña", False),                    # sin CP escrito, se usa
    ("es", "15179", BRETEMA_S, False),
])
def test_la_sugerencia_ajena_con_la_regla_del_pais(pais, cp, direccion, ajena):
    t = server._region_actual.set((pais, ZONA[pais]))
    try:
        assert server._rep_sugerencia_ajena({"cp": cp}, direccion) is ajena
    finally:
        server._region_actual.reset(t)


@pytest.mark.asyncio(loop_scope="session")
async def test_el_alta_con_la_sugerencia_elegida_fuera_de_espana(base):
    """En Seattle y en São Paulo, la sugerencia elegida se guarda con su dirección, su CP, su pueblo y su punto, sin
    buscar nada (antes: el CP «12345» de la casa o «01310», sin punto y buscando)."""
    for pais, d, cp, loc, pt in (("us", "12345 Lake City Way NE, Seattle, WA 98125", "98125", "Seattle", (47.7180, -122.2930)),
                                 ("br", "Avenida Paulista 1000, 01310-100 São Paulo", "01310-100", "São Paulo",
                                  (-23.5650, -46.6520))):
        t = server._region_actual.set((pais, ZONA[pais]))
        try:
            p = await server.reparto_mis_pedidos({"direccion": d, "cliente": "Cliente", "lat": pt[0], "lng": pt[1],
                                                  "geo_origen": "sugerencia", "cp": cp, "localidad": loc}, ANA)
        finally:
            server._region_actual.reset(t)
        assert (p["direccion"], p["cp"], p["localidad"], p["lat"], p["lng"], p["geo"], p["geo_origen"]) == (
            d, cp, loc, pt[0], pt[1], "manual", "sugerencia")
    assert base.sin_buscar()


# ── La puerta aprendida de una dirección que empieza por la otra (03-11-2026, el revisor) ─────────────────────────────
# «Calle Real 5», sin pueblo y entregada en Oleiros, le ponía su puerta a una parada nueva «Calle Real 5, 15003 A
# Coruña» (geo «puerta», el punto de Oleiros, sin buscar nada): el caso grave sin que nadie elija nada. Con la misma
# clave, como siempre; si una empieza por la otra, solo si lo que sobra es el piso, o si las dos tienen CP o pueblo y es
# el mismo sitio (el mismo CP o, si no, el mismo municipio).

PUERTA_OLEIROS = (OLEIROS[0] + 0.0002, OLEIROS[1])
PUERTA_MONTERO = (43.36905, -8.40495)


@pytest.mark.parametrize("vieja, campos, nueva, sale", [
    ("Calle Real 5", {}, "Calle Real 5, 15003 A Coruña", False),                    # el P1 del revisor
    ("Calle Real 5", {}, "calle real, 5", True),                                   # la misma clave
    ("Montero Ríos 12", {}, "Montero Ríos 12, 2º B", True),                        # sobra el piso
    ("Montero Ríos 12, 2º B", {}, "Montero Ríos 12", True),
    ("Montero Ríos 12", {"cp": "15003"}, "Montero Ríos 12, 15003 A Coruña", True),  # el mismo CP
    ("Calle Real 5", {"cp": "15179"}, "Calle Real 5, 15003 A Coruña", False),       # otro CP
    ("Montero Ríos 12", {"localidad": "La Coruña"}, "Montero Ríos 12, A Coruña", True),   # el mismo municipio
    ("Montero Ríos 12", {"localidad": "Oleiros"}, "Montero Ríos 12, A Coruña", False),
    ("Montero Ríos 12, 15003 A Coruña", {}, "Montero Ríos 12", False),             # la nueva, sin CP ni pueblo
    ("Calle Real", {"cp": "15003"}, "Calle Real 12, 15003 A Coruña", False),        # el 12 es el portal, no el piso
])
@pytest.mark.asyncio(loop_scope="session")
async def test_la_puerta_de_una_que_empieza_por_la_otra(base, vieja, campos, nueva, sale):
    _de_antes(base.db, "v1", vieja, "2026-11-02", punto=OLEIROS, geo="manual", **campos, **_puerta(PUERTA_OLEIROS))
    assert await server._rep_puerta_aprendida("d1", nueva) == (PUERTA_OLEIROS if sale else None)


@pytest.mark.asyncio(loop_scope="session")
async def test_el_alta_sin_elegir_nada_no_nace_en_la_puerta_de_otro_pueblo(base):
    """El P1 del revisor por el alta: se busca lo escrito. Con el CP guardado y el mismo escrito, la puerta, sin buscar;
    con el CP en el cuerpo, ese manda."""
    _de_antes(base.db, "k1", "Calle Real 5", "2026-11-02", punto=OLEIROS, geo="manual", geo_origen="sugerencia",
              **_puerta(PUERTA_OLEIROS))
    p = await server.reparto_mis_pedidos({"direccion": "Calle Real 5, 15003 A Coruña", "cliente": "P1b"}, ANA)
    assert (p["lat"], p["lng"], p["geo"]) == (None, None, "no")
    assert base.busquedas and base.busquedas[-1][0][:3] == ("Calle Real 5, 15003 A Coruña", "15003", "")
    _de_antes(base.db, "k2", "Montero Ríos 12", "2026-11-01", punto=PUERTA_MONTERO, cp="15003", **_puerta(PUERTA_MONTERO))
    antes = len(base.busquedas)
    p = await server.reparto_mis_pedidos({"direccion": "Montero Ríos 12, 15003 A Coruña", "cliente": "Q"}, ANA)
    assert (p["lat"], p["lng"], p["geo"]) == (*PUERTA_MONTERO, "puerta") and len(base.busquedas) == antes
    p = await server.reparto_mis_pedidos({"direccion": "Montero Ríos 12, A Coruña", "cp": "15011", "cliente": "R"}, ANA)
    assert p["geo"] != "puerta" and len(base.busquedas) == antes + 1


# ── La puerta aprendida con la MISMA dirección escrita y otro sitio (03-11-2026, el revisor de la cuarta tanda) ───────
# «Calle Real 5» de 15179 Oleiros (el CP y el pueblo, aparte en el cuerpo), entregada y con la puerta aprendida, le ponía
# su puerta (geo «puerta», sin buscar nada) a una «Calle Real 5» nueva de 15003 A Coruña; y de Madrid a Barcelona. Con
# la misma clave, si las dos dicen dónde (un CP o un pueblo, en sus campos o escrito), tiene que ser el mismo sitio: el
# mismo CP o, si no, el mismo municipio. Si alguna no lo dice, como siempre. Y en España el nombre de la provincia con
# el CP de otro municipio no es un pueblo (geocodificador.es_pueblo): «A Coruña» con el 15179 no es la ciudad.

@pytest.mark.parametrize("vieja, cpv, locv, nueva, cpn, locn", [
    ("Calle Real 5", "15179", "Oleiros", "Calle Real 5", "15003", "A Coruña"),       # otro CP y otro pueblo
    ("Calle Real 5", "15179", "Oleiros", "calle real, 5", "15003", "A Coruña"),      # escrita de otra manera
    ("Calle Mayor 3", "28013", "Madrid", "Calle Mayor 3", "08014", "Barcelona"),     # de Madrid a Barcelona
])
@pytest.mark.asyncio(loop_scope="session")
async def test_la_misma_direccion_escrita_de_otro_sitio_no_nace_en_su_puerta(base, vieja, cpv, locv, nueva, cpn, locn):
    """Los tres casos del revisor: la puerta de antes no es la de esta parada, y el alta busca lo escrito con el CP y el
    pueblo que llegan."""
    _de_antes(base.db, "v1", vieja, "2026-11-02", punto=OLEIROS, geo="manual", cp=cpv, localidad=locv,
              **_puerta(PUERTA_OLEIROS))
    assert await server._rep_puerta_aprendida("d1", nueva, cpn, locn) is None
    p = await server.reparto_mis_pedidos({"direccion": nueva, "cliente": "Sonda", "cp": cpn, "localidad": locn}, ANA)
    assert (p["lat"], p["lng"], p["geo"], p["cp"], p["localidad"]) == (None, None, "no", cpn, locn)
    assert base.busquedas and base.busquedas[-1][0][:3] == (nueva, cpn, locn)


@pytest.mark.parametrize("cpv, locv, cpn, locn, sale", [
    ("15179", "Oleiros", "15179", "Oleiros", True),          # el mismo CP y el mismo pueblo
    ("15179", "Oleiros", "15179", "", True),                 # el mismo CP
    ("15179", "Oleiros", "", "Oleiros", True),               # sin CP en una, el mismo municipio
    ("", "La Coruña", "", "A Coruña", True),                 # el mismo municipio, escrito de otra manera
    ("15179", "Oleiros", "", "", True),                      # la nueva sin campos: como siempre
    ("", "", "15003", "A Coruña", True),                     # la vieja sin campos: como siempre
    ("", "España", "15003", "A Coruña", True),               # «España» no dice dónde: como sin campos
    ("", "Oleiros", "", "A Coruña", False),                  # otro municipio
    ("15179", "", "", "Oleiros", False),                     # un CP y un pueblo: no se sabe si es el mismo sitio
    ("15179", "A Coruña", "", "A Coruña", False),            # con el 15179, «A Coruña» es la provincia; sin CP, la ciudad
    ("15004", "A Coruña", "", "A Coruña", True),             # con un CP de la ciudad, la ciudad
])
@pytest.mark.asyncio(loop_scope="session")
async def test_la_misma_direccion_escrita_vale_si_es_del_mismo_sitio(base, cpv, locv, cpn, locn, sale):
    _de_antes(base.db, "v1", "Calle Real 5", "2026-11-02", punto=OLEIROS, geo="manual", cp=cpv, localidad=locv,
              **_puerta(PUERTA_OLEIROS))
    assert await server._rep_puerta_aprendida("d1", "calle real, 5", cpn, locn) == (PUERTA_OLEIROS if sale else None)


@pytest.mark.asyncio(loop_scope="session")
async def test_el_alta_con_la_misma_direccion_y_el_mismo_cp_nace_en_la_puerta(base):
    """Con el mismo CP en el cuerpo, o sin campos, la puerta y sin buscar nada, como siempre. Con otra de otro sitio más
    reciente delante, la que es del mismo sitio."""
    _de_antes(base.db, "v1", "Calle Real 5", "2026-11-01", punto=OLEIROS, geo="manual", cp="15179", localidad="Oleiros",
              **_puerta(PUERTA_OLEIROS))
    _de_antes(base.db, "v2", "Calle Real 5", "2026-11-02", punto=REAL_5, cp="15003", localidad="A Coruña",
              **_puerta(PUERTA_REAL_5))
    p = await server.reparto_mis_pedidos({"direccion": "Calle Real 5", "cliente": "S", "cp": "15179",
                                          "localidad": "Oleiros"}, ANA)
    assert (p["lat"], p["lng"], p["geo"]) == (*PUERTA_OLEIROS, "puerta")
    p = await server.reparto_mis_pedidos({"direccion": "calle real, 5", "cliente": "T", "cp": "15003"}, ANA)
    assert (p["lat"], p["lng"], p["geo"]) == (*PUERTA_REAL_5, "puerta")
    p = await server.reparto_mis_pedidos({"direccion": "Calle Real 5", "cliente": "U"}, ANA)
    assert (p["lat"], p["lng"], p["geo"]) == (*PUERTA_REAL_5, "puerta")      # sin campos, la más reciente
    assert base.sin_buscar()


@pytest.mark.parametrize("vieja, campos, nueva, cp, loc, sale", [
    # Entregada en Oleiros con «A Coruña» como población (la provincia, con el 15179) y la nueva de la ciudad.
    ("Calle Real 5", {"cp": "15179", "localidad": "A Coruña"}, "Calle Real 5, A Coruña", "", "", False),
    # Entregada en la ciudad y la nueva de Oleiros con la provincia como población.
    ("Calle Real 5, A Coruña", {}, "Calle Real 5", "15179", "A Coruña", False),
    # Con un CP de la ciudad o sin CP, «A Coruña» es la ciudad: el mismo sitio, como antes.
    ("Calle Real 5", {"cp": "15004", "localidad": "A Coruña"}, "Calle Real 5, A Coruña", "", "", True),
    ("Calle Real 5", {"localidad": "A Coruña"}, "Calle Real 5, A Coruña", "", "", True),
])
@pytest.mark.asyncio(loop_scope="session")
async def test_la_provincia_con_el_cp_de_otro_municipio_no_es_el_mismo_pueblo(base, vieja, campos, nueva, cp, loc, sale):
    """La de una que empieza por la otra (_rep_misma_puerta) daba por el mismo pueblo «A Coruña» con el 15179 (Oleiros)
    y «A Coruña» sin CP (la ciudad), a 8 km."""
    _de_antes(base.db, "v1", vieja, "2026-11-02", punto=OLEIROS, geo="manual", **campos, **_puerta(PUERTA_OLEIROS))
    assert await server._rep_puerta_aprendida("d1", nueva, cp, loc) == (PUERTA_OLEIROS if sale else None)


# ── La vieja sin sitio (03-11-2026, la sexta tanda, el revisor) ───────────────────────────────────────────────────────
# Con la misma clave, la de otro sitio se saltaba y la primera que no dice dónde daba su puerta, aunque el historial
# ya dijera que ese repartidor reparte esa dirección en otro pueblo: «Calle Real 5» de 15179 Oleiros (01-11) y «Calle
# Real 5» sin sitio (20-10) le ponían a la nueva «Calle Real 5» de 15003 A Coruña la puerta de la del 20-10. Si alguna
# con la misma clave dice OTRO sitio, las que no dicen dónde no valen: la del mismo sitio si la hay o, si no, None y se
# busca lo escrito. Y un sitio escrito que no es un pueblo («La Rioja», «Galicia») dice dónde y se compara por su
# nombre; el país, solo en la nueva (B2).

PUERTA_SIN_SITIO = (43.3600, -8.3500)
OLEIROS_01 = ("2026-11-01", "15179", "Oleiros", PUERTA_OLEIROS)
SIN_SITIO_20 = ("2026-10-20", "", "", PUERTA_SIN_SITIO)


@pytest.mark.parametrize("historial, cpn, locn, sale", [
    ([OLEIROS_01, SIN_SITIO_20], "15003", "A Coruña", None),                        # el ejemplo del revisor
    ([SIN_SITIO_20], "15003", "A Coruña", PUERTA_SIN_SITIO),                         # sin la de otro sitio, como ahora
    ([("2026-11-01", "", "", PUERTA_SIN_SITIO), ("2026-10-20", "15179", "Oleiros", PUERTA_OLEIROS)],
     "15003", "A Coruña", None),                                                     # la sin sitio, la más reciente
    ([OLEIROS_01, ("2026-10-25", "", "", PUERTA_SIN_SITIO), ("2026-10-20", "15003", "A Coruña", PUERTA_REAL_5)],
     "15003", "A Coruña", PUERTA_REAL_5),                                            # la del mismo sitio, más vieja
    ([("2026-11-01", "", "", PUERTA_SIN_SITIO), ("2026-10-20", "15003", "A Coruña", PUERTA_REAL_5)],
     "15003", "A Coruña", PUERTA_SIN_SITIO),                                         # sin otro sitio, como ahora
    ([OLEIROS_01, SIN_SITIO_20], "", "", PUERTA_OLEIROS),                            # la nueva sin sitio: como siempre
    ([OLEIROS_01, SIN_SITIO_20], "", "La Rioja", None),                              # un sitio que no es un pueblo
    ([OLEIROS_01], "", "Galicia", None),
    ([SIN_SITIO_20], "", "Galicia", PUERTA_SIN_SITIO),
    # Una vieja con un sitio así, por su nombre (como cuando «La Rioja» era un pueblo); «España», como sin sitio.
    ([("2026-10-20", "", "La Rioja", PUERTA_SIN_SITIO)], "15003", "A Coruña", None),
    ([("2026-10-20", "", "La Rioja", PUERTA_SIN_SITIO)], "", "La Rioja", PUERTA_SIN_SITIO),
    ([OLEIROS_01, ("2026-10-20", "", "España", PUERTA_SIN_SITIO)], "15003", "A Coruña", None),
])
@pytest.mark.asyncio(loop_scope="session")
async def test_la_vieja_sin_sitio_no_vale_si_otra_dice_otro_sitio(base, historial, cpn, locn, sale):
    for i, (fecha, cpv, locv, puerta) in enumerate(historial):
        _de_antes(base.db, f"h{i}", "Calle Real 5", fecha, punto=puerta, geo="manual", cp=cpv, localidad=locv,
                  **_puerta(puerta))
    assert await server._rep_puerta_aprendida("d1", "Calle Real 5", cpn, locn) == sale


@pytest.mark.asyncio(loop_scope="session")
async def test_el_alta_con_la_vieja_sin_sitio_y_otra_de_otro_sitio_busca_lo_escrito(base):
    """El ejemplo del revisor por el alta, sin que nadie elija nada: no nace en ninguna de las dos puertas y se busca
    lo escrito con el CP y el pueblo que llegan."""
    for i, (fecha, cpv, locv, puerta) in enumerate((OLEIROS_01, SIN_SITIO_20)):
        _de_antes(base.db, f"h{i}", "Calle Real 5", fecha, punto=puerta, geo="manual", cp=cpv, localidad=locv,
                  **_puerta(puerta))
    p = await server.reparto_mis_pedidos({"direccion": "Calle Real 5", "cliente": "E2", "cp": "15003",
                                          "localidad": "A Coruña"}, ANA)
    assert (p["lat"], p["lng"], p["geo"]) == (None, None, "no")
    assert base.busquedas and base.busquedas[-1][0][:3] == ("Calle Real 5", "15003", "A Coruña")


# ── La de otro sitio con el piso o con otra clave (03-11-2026, la séptima tanda, el revisor) ─────────────────────────
# Con el piso detrás, la puerta valía sin mirar el sitio: «Calle Real 5 2º B» de 15179 Oleiros le ponía su puerta a la
# nueva «Calle Real 5» de 15003 A Coruña. Y la vieja sin sitio solo se apartaba si la de otro sitio tenía la misma clave:
# con «Calle Real 5, 15179 Oleiros» (el CP y el pueblo escritos) la nueva de A Coruña nacía en la puerta de la «Calle
# Real 5» sin sitio. Ahora, con el piso, si las dos dicen dónde, tiene que ser el mismo sitio; y la que empieza por la
# otra y dice otro sitio cuenta como en la sexta tanda. Sin ninguna de otro sitio, la puerta como hasta ahora.

PUERTA_OLEIROS_PISO = (43.3420, -8.3160)
SIN_SITIO_E3 = ("2026-10-20", "Calle Real 5", "", "", PUERTA_SIN_SITIO)
REVISOR_E3B = [("2026-11-02", "Calle Real 5", "", "", PUERTA_SIN_SITIO),
               ("2026-11-01", "Calle Real 5 2º B", "15179", "Oleiros", PUERTA_OLEIROS_PISO),
               ("2026-10-20", "Calle Real 5", "15179", "Oleiros", PUERTA_OLEIROS)]


def _historial(db, historial):
    """Las paradas entregadas, con su puerta; el CP, el de sus campos o el escrito (como lo guarda el alta)."""
    for i, (fecha, dv, cpv, locv, puerta) in enumerate(historial):
        _de_antes(db, f"h{i}", dv, fecha, punto=puerta, geo="manual", cp=cpv or R.extrae_cp(dv), localidad=locv,
                  **_puerta(puerta))


@pytest.mark.parametrize("historial, nueva, cpn, locn, sale", [
    # Los del revisor: la de Oleiros con el CP y el pueblo escritos, solo con el pueblo, con el piso detrás y con la
    # misma clave (la sexta), y una «Calle Real 5» sin sitio más vieja.
    ([("2026-11-01", "Calle Real 5, 15179 Oleiros", "", "", PUERTA_OLEIROS), SIN_SITIO_E3],
     "Calle Real 5", "15003", "A Coruña", None),
    ([("2026-11-01", "Calle Real 5, Oleiros", "", "", PUERTA_OLEIROS), SIN_SITIO_E3],
     "Calle Real 5", "15003", "A Coruña", None),
    ([("2026-11-01", "Calle Real 5 2º B", "15179", "Oleiros", PUERTA_OLEIROS), SIN_SITIO_E3],
     "Calle Real 5", "15003", "A Coruña", None),
    ([("2026-11-01", "Calle Real 5", "15179", "Oleiros", PUERTA_OLEIROS), SIN_SITIO_E3],
     "Calle Real 5", "15003", "A Coruña", None),
    (REVISOR_E3B, "Calle Real 5", "15003", "A Coruña", None),                   # salía la del piso de Oleiros
    # El piso con otro sitio, sola y al revés (el piso en la nueva).
    ([("2026-11-01", "Calle Real 5 2º B", "15179", "Oleiros", PUERTA_OLEIROS)],
     "Calle Real 5", "15003", "A Coruña", None),
    ([("2026-11-01", "Calle Real 5", "15179", "Oleiros", PUERTA_OLEIROS)],
     "Calle Real 5 2º B", "15003", "A Coruña", None),
    # Con la del mismo sitio ya vista, la de otro sitio con otra clave la da (como en la sexta).
    ([("2026-11-02", "Calle Real 5", "", "", PUERTA_SIN_SITIO), ("2026-11-01", "Calle Real 5", "15003", "A Coruña",
      PUERTA_REAL_5), ("2026-10-20", "Calle Real 5, 15179 Oleiros", "", "", PUERTA_OLEIROS)],
     "Calle Real 5", "15003", "A Coruña", PUERTA_REAL_5),
    # Sin ninguna de otro sitio, como hasta ahora.
    ([("2026-11-01", "Calle Real 5 2º B", "15003", "A Coruña", PUERTA_REAL_5)],
     "Calle Real 5", "15003", "A Coruña", PUERTA_REAL_5),
    ([("2026-11-01", "Calle Real 5 2º B", "", "", PUERTA_SIN_SITIO)],
     "Calle Real 5", "15003", "A Coruña", PUERTA_SIN_SITIO),
    ([("2026-11-01", "Calle Real 5 2º B", "15179", "Oleiros", PUERTA_OLEIROS)],
     "Calle Real 5", "", "", PUERTA_OLEIROS),                                    # la nueva sin sitio
    ([("2026-11-01", "Calle Real 5, Bajo", "15179", "Oleiros", PUERTA_OLEIROS)],
     "Calle Real 5", "15179", "", PUERTA_OLEIROS),
    ([("2026-11-02", "Calle Real 5", "", "", PUERTA_SIN_SITIO), ("2026-11-01", "Calle Real 5, 15003 A Coruña", "", "",
      PUERTA_REAL_5)], "Calle Real 5", "15003", "A Coruña", PUERTA_SIN_SITIO),
    ([("2026-11-01", "Calle Real 5, 15003 A Coruña", "", "", PUERTA_REAL_5), SIN_SITIO_E3],
     "Calle Real 5", "15003", "A Coruña", PUERTA_REAL_5),
    # La vieja sin sitio con el piso o el sitio detrás, apartada como la de la misma clave (el verificador de la
    # séptima): antes salía su puerta aunque otra fuera de Oleiros.
    ([("2026-11-02", "Calle Real 5 2º B", "", "", PUERTA_SIN_SITIO),
      ("2026-11-01", "Calle Real 5", "15179", "Oleiros", PUERTA_OLEIROS)], "Calle Real 5", "15003", "A Coruña", None),
    ([("2026-11-02", "Calle Real 5, Bajo", "", "", PUERTA_SIN_SITIO),
      ("2026-11-01", "Calle Real 5", "15179", "Oleiros", PUERTA_OLEIROS)], "Calle Real 5", "15003", "A Coruña", None),
    ([("2026-11-02", "Calle Real 5 2º B", "", "", PUERTA_SIN_SITIO),
      ("2026-11-01", "Calle Real 5, 15179 Oleiros", "", "", PUERTA_OLEIROS)], "Calle Real 5", "15003", "A Coruña", None),
    ([("2026-11-02", "Calle Real 5", "15179", "Oleiros", PUERTA_OLEIROS),
      ("2026-11-01", "Calle Real 5 2º B", "", "", PUERTA_SIN_SITIO)], "Calle Real 5", "15003", "A Coruña", None),
    ([("2026-11-02", "Calle Real 5", "", "", PUERTA_SIN_SITIO),
      ("2026-11-01", "Calle Real 5", "15179", "Oleiros", PUERTA_OLEIROS)], "Calle Real 5 2º B", "15003", "A Coruña", None),
])
@pytest.mark.asyncio(loop_scope="session")
async def test_la_de_otro_sitio_con_el_piso_o_con_otra_clave(base, historial, nueva, cpn, locn, sale):
    _historial(base.db, historial)
    assert await server._rep_puerta_aprendida("d1", nueva, cpn, locn) == sale


@pytest.mark.asyncio(loop_scope="session")
async def test_el_alta_con_la_de_otro_sitio_con_el_piso_busca_lo_escrito(base):
    """El caso del revisor por el alta, sin que nadie elija nada: no nace en la puerta del piso de Oleiros ni en la de
    sin sitio, y se busca lo escrito con el CP y el pueblo que llegan."""
    _historial(base.db, REVISOR_E3B)
    p = await server.reparto_mis_pedidos({"direccion": "Calle Real 5", "cliente": "E3", "cp": "15003",
                                          "localidad": "A Coruña"}, ANA)
    assert (p["lat"], p["lng"], p["geo"]) == (None, None, "no")
    assert base.busquedas and base.busquedas[-1][0][:3] == ("Calle Real 5", "15003", "A Coruña")


@pytest.mark.asyncio(loop_scope="session")
async def test_el_alta_con_la_vieja_sin_sitio_con_el_piso_busca_lo_escrito(base):
    """El hueco del verificador de la séptima, por el alta y sin que nadie elija nada: «Calle Real 5 2º B» sin sitio y
    «Calle Real 5» de 15179 Oleiros; la nueva «Calle Real 5» de 15003 A Coruña no nace en ninguna de las dos puertas."""
    _historial(base.db, [("2026-11-02", "Calle Real 5 2º B", "", "", PUERTA_SIN_SITIO),
                         ("2026-11-01", "Calle Real 5", "15179", "Oleiros", PUERTA_OLEIROS)])
    p = await server.reparto_mis_pedidos({"direccion": "Calle Real 5", "cliente": "E4", "cp": "15003",
                                          "localidad": "A Coruña"}, ANA)
    assert (p["lat"], p["lng"], p["geo"]) == (None, None, "no")
    assert base.busquedas and base.busquedas[-1][0][:3] == ("Calle Real 5", "15003", "A Coruña")


@pytest.mark.asyncio(loop_scope="session")
async def test_la_puerta_al_azar_nunca_es_de_otro_sitio(base):
    """La prueba al azar del revisor (4000 historiales que mezclan la misma clave, el piso detrás y el CP o el pueblo
    escritos): si sale una puerta y la nueva dice dónde, la parada de esa puerta no dice OTRO sitio. Antes de la
    séptima tanda, 682 de 2636."""
    rnd = random.Random(7)
    sitios = [("15179", "Oleiros"), ("15003", "A Coruña"), ("", ""), ("", "Oleiros"), ("15008", "")]
    escritas = ["Calle Real 5", "Calle Real 5, 15179 Oleiros", "Calle Real 5, 15003 A Coruña", "Calle Real 5 2º B",
                "Calle Real 5, Bajo", "calle real, 5", "Calle Real 5, Oleiros"]
    total, malas = 0, []
    for n in range(4000):
        base.db["reparto_pedidos"] = Col([])
        hist = []
        for i in range(rnd.randint(1, 4)):
            cp, loc = rnd.choice(sitios)
            puerta = (43.0 + n * 1e-4, -8.0 - i * 1e-3)
            hist.append({"id": f"h{n}_{i}", "conductor_id": "d1", "fecha": f"2026-10-{10 + i:02d}",
                         "estado": "entregado", "direccion": rnd.choice(escritas), "cp": cp, "localidad": loc,
                         "lat": puerta[0], "lng": puerta[1], "geo": "manual", **_puerta(puerta)})
        base.db["reparto_pedidos"].docs.extend(hist)
        cpn, locn = rnd.choice(sitios)
        nueva = rnd.choice(["Calle Real 5", "calle real, 5"])
        r = await server._rep_puerta_aprendida("d1", nueva, cpn, locn)
        nl = server._rep_leida(nueva, cpn, locn)
        if r is None or not server._rep_nueva_dice_donde(nl):
            continue
        total += 1
        h = next(x for x in hist if (x["puerta_lat"], x["puerta_lng"]) == r)
        v = server._rep_leida(h["direccion"], h["cp"], h["localidad"])
        if server._rep_dice_donde(v) and not server._rep_mismo_sitio(v, nl):
            malas.append((nueva, cpn, locn, h["direccion"], h["cp"], h["localidad"]))
    assert total > 1500 and not malas, (total, len(malas), malas[:3])
