# -*- coding: utf-8 -*-
"""Las DNR del propio conductor (11-11-2026, tanda 2, zona «dnr»): GET /diarios/mias.

Dani: «que cuando yo suba los daily report y aparezcan las DNRs ellos puedan ver la DNR que le cae a ellos», y después:
«entrega de paquete tipo "marcaste puerta y no llamaste ni sacaste bien la foto"».
Son informes de Amazon sobre cada persona: lo que vigilan estas pruebas es que NADIE vea lo de otro (ni cambiando
parámetros, ni con el mismo correo, ni desde otra empresa, ni de baja), que se casen igual que en la pantalla de la
oficina (nunca por nombre), que salga lo mínimo (sin euros ni el ID), que sin el módulo «diarios» la ruta no exista, que el
estado salga bien en los tres casos y que «cómo fue la entrega» solo diga lo que se entiende con seguridad.

Con la base de mentira (base_de_mentira.py), sin MongoDB, y con el día fijo (miércoles 11-11-2026). Las pruebas de la
sesión pasan por el token de verdad (create_token + get_current_user) y con una base por empresa.
Los nombres, correos y códigos son inventados.
"""
import inspect
import json

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

import server
from base_de_mentira import Col, Cursor, Db

HOY = "2026-11-11"          # miércoles: su semana de Amazon empieza el domingo 08-11
DANI = {"sub": "u1", "name": "Dani", "role": "admin", "account_type": "owner"}


def _conductor(sub, org="o1"):
    return {"sub": sub, "name": sub, "role": "driver", "org_id": org}


class _CursorMongo(Cursor):
    """Ordena como MongoDB también con booleanos y campos que faltan (null < false < true). El de la base de mentira
    compara True con "" y revienta; aquí hace falta porque la oficina ordena las fichas por `active`. Y apunta si la
    consulta llevaba tope (`limit` o `to_list(n)`), para la prueba de los topes."""

    def __init__(self, docs, col=None):
        super().__init__(docs)
        self.col = col
        self.con_tope = False
        if col is not None:
            col.cursores.append(self)

    def sort(self, *a, **k):
        claves = a[0] if a and isinstance(a[0], list) else ([(a[0], a[1] if len(a) > 1 else 1)] if a else [])
        for campo, sentido in reversed(claves):
            def clave(d, campo=campo):
                v = d.get(campo)
                if v is None:
                    return (0, "")
                if isinstance(v, bool):
                    return (1, str(int(v)))
                return (2, str(v))
            self.docs.sort(key=clave, reverse=sentido < 0)
        return self

    def limit(self, n):
        self.con_tope = self.con_tope or bool(n)
        return super().limit(n)

    async def to_list(self, n=None):
        self.con_tope = self.con_tope or n is not None
        return await super().to_list(n)


class _Col(Col):
    def __init__(self, docs=None):
        super().__init__(docs)
        self.cursores = []

        # Lo que no es un cursor (find_one, distinct, aggregate), apuntado con su colección para la prueba de los topes
        # (R7, 11-11-2026: «mirando TODAS las colecciones que toque la ruta»).
        self.otras = []

    def find(self, q=None, proyeccion=None, **_):
        return _CursorMongo(super().find(q, proyeccion).docs, self)

    async def find_one(self, *a, **k):
        self.otras.append("find_one")
        return await super().find_one(*a, **k)

    async def distinct(self, campo, *a, **k):
        self.otras.append(f"distinct:{campo}")
        return await super().distinct(campo, *a, **k)

    def aggregate(self, pipeline, **_):
        # Lo único que agrega este camino son los votos de Amazon (route_history) y los extremos y recuentos de la
        # oficina: con la colección vacía de esos datos, nada.
        self.otras.append("aggregate")
        return _CursorMongo([])


class _Db(Db):
    def __missing__(self, nombre):
        self[nombre] = _Col()
        return self[nombre]


FICHAS = [
    # Ana: su ID en `transporter_id`, el centro escrito «sucio» como en la base de verdad.
    {"id": "d-ana", "name": "ANA PEREZ GOMEZ", "email": "ana@ejemplo.test", "center": "AMZL OGA5 SANTIAGO XPT",
     "active": True, "transporter_id": "AANA000001"},
    # La misma Ana, dada de alta dos veces y FUSIONADA por la oficina en su ficha buena, con otro ID: es ella.
    {"id": "d-ana-vieja", "name": "ANA PEREZ GOMEZ ", "email": "ANA@ejemplo.test", "center": "OGA5",
     "active": False, "status": "fusionada", "merged_into": "d-ana", "transporter_id": "AANAVIEJA1"},
    {"id": "d-luis", "name": "LUIS MARTIN RIOS", "email": "luis@ejemplo.test", "center": "OGA5", "active": True,
     "transporter_id": "ALUIS00001"},
    # Eva tiene el ID SOLO en `driver_id` («ID Amazon»): la oficina también lo casa.
    {"id": "d-eva", "name": "EVA SANZ LOPEZ", "email": "eva@ejemplo.test", "center": "DGA1", "active": True,
     "driver_id": " aeva000001 "},
    # Mar tiene en `driver_id` el ID que ya reclama Luis en `transporter_id`: para la oficina es de Luis.
    {"id": "d-mar", "name": "MAR GIL PONS", "email": "mar@ejemplo.test", "center": "OGA5", "active": True,
     "driver_id": "ALUIS00001"},
    # Paco: dos fichas con el mismo ID y distinto correo; manda la activa.
    {"id": "d-paco-baja", "name": "PACO ROS VILA", "email": "paco.viejo@ejemplo.test", "center": "DGA1",
     "active": False, "transporter_id": "APACO00001"},
    {"id": "d-paco", "name": "PACO ROS VILA", "email": "paco@ejemplo.test", "center": "DGA1", "active": True,
     "transporter_id": "APACO00001"},
    # Sin ID de reparto, y con el MISMO nombre que el que sale en el historial para un ID sin ficha.
    {"id": "d-sin", "name": "ANA PEREZ GOMEZ", "email": "otra.ana@ejemplo.test", "center": "OGA5", "active": True},
    # EL CASO DEL REVISOR (D1): Juan se fue (de baja) y la oficina dio de alta a Pedro con el MISMO buzón, eligiendo
    # «es otra persona, crear una ficha nueva». Son dos personas: ninguna ve lo de la otra.
    {"id": "d-juan", "name": "JUAN REY SOTO", "email": "repartos3@empresa.test", "center": "OGA5", "active": False,
     "transporter_id": "AJUAN00001"},
    {"id": "d-pedro", "name": "PEDRO VAL MIR", "email": "Repartos3@empresa.test", "center": "OGA5", "active": True,
     "transporter_id": "APEDRO0001"},
    # De DGA10 (D6): el centro se casa por el código entero, «DGA1» no entra en «DGA10».
    {"id": "d-diez", "name": "RITA NOVO PAZ", "email": "rita@ejemplo.test", "center": "DGA10", "active": True,
     "transporter_id": "ARITA00001"},
]


def _fila(tracking, tid, dia, dsc, center="OGA5", **mas):
    return {"tracking_id": tracking, "transporter_id": tid, "fecha_concesion": dia, "dsc": dsc, "center": center,
            "semana": server._dia_semana(dia), "fecha_entrega": dia, "scan": "", "valor": "€25.40",
            "valor_eur": 25.4, "cp": "15701", "phr": "PHRSECRETO", "excepcion": "EXCSECRETA",
            "simultaneas": "7", **mas}


FILAS = [
    # cuenta; marcado en la puerta, a más de 25 m; foto borrosa y llamada de 12 s (ver FOTO y CONTACTO)
    _fila("TBAANA1", "AANA000001", "2026-11-09", "Y", scan="DELIVERED_TO_DOORSTEP", mas_25m="Y", cp="15704"),
    _fila("TBAANA2", "AANA000001", "2026-11-03", "N"),                   # no cuenta: ese día OGA5 tiene una Y (Luis)
    _fila("TBAANA3", "AANA000001", "2026-11-10", "N"),                   # sin clasificar: ninguna Y en OGA5 ese día
    _fila("TBAANA4", "AANA000001", "2026-10-20", ""),                    # sin clasificar: sin DSC
    _fila("TBAANA5", "AANA000001", "2026-10-18", "Y"),                   # el primer día de la 4.ª semana: entra
    _fila("TBAANA6", "AANA000001", "2026-10-17", "Y"),                   # el sábado anterior: fuera
    _fila("TBAANAV", "AANAVIEJA1", "2026-11-02", "Y"),                   # de su ficha fusionada: suya
    _fila("TBLUIS1", "ALUIS00001", "2026-11-03", "Y"),
    _fila("TBEVA01", "AEVA000001", "2026-11-10", "Y", center="DGA1"),   # una Y en DGA1 el 10: no clasifica OGA5
    _fila("TBPACO1", "APACO00001", "2026-11-04", "N", center="DGA1"),
    _fila("TBFANT1", "AFANTASMA1", "2026-11-05", "Y"),                   # un ID sin ficha: de nadie
    _fila("TBJUAN1", "AJUAN00001", "2026-11-09", "Y"),                   # de Juan (de baja)
    _fila("TBPEDR1", "APEDRO0001", "2026-11-05", "Y"),                   # de Pedro
    _fila("TBRITA1", "ARITA00001", "2026-11-04", "Y", center="DGA10"),
]

# La tabla de los fallos de foto y la de los de contacto (las guarda la subida del .html por paquete y fecha del
# reporte). La de Luis lleva el MISMO paquete que una de Ana: no es de Ana y no puede cambiar lo que ve ella.
FOTO = [
    {"tracking_id": "TBAANA1", "transporter_id": "AANA000001", "fecha_reporte": "2026-11-11",
     "motivo": "DELIVERED_TO_DOORSTEP", "fallo": "Blurry photo"},
    {"tracking_id": "TBAANA2", "transporter_id": "ALUIS00001", "fecha_reporte": "2026-11-05",
     "motivo": "DELIVERED_TO_GARDEN", "fallo": "PACKAGE_NOT_VISIBLE"},
]
CONTACTO = [
    {"tracking_id": "TBAANA1", "transporter_id": "AANA000001", "fecha_reporte": "2026-11-11",
     "motivo": "DELIVERED_TO_DOORSTEP", "tipo": "CALL", "segundos": 12},
    {"tracking_id": "TBAANA2", "transporter_id": "ALUIS00001", "fecha_reporte": "2026-11-05",
     "motivo": "DELIVERED_TO_GARDEN", "tipo": "NO_CALL", "segundos": 0},
]


def _organizaciones():
    return _Col([
        {"id": "o1", "account_type": "owner", "db_name": server._DEFAULT_DB_NAME, "centers": ["OGA5", "DGA1"]},
        {"id": "o2", "account_type": "dsp", "modulos": ["dashboard", "conductores", "asignacion"]},
        {"id": "o3", "account_type": "dsp", "modulos": ["dashboard", "conductores", "diarios"], "db_name": "dsp_o3"},
        {"id": server._DEMO_REP_ORG_ID, "account_type": "dsp", "modulos": list(server._MODULOS_REPARTO),
         "db_name": server._DEMO_REP_DB, "demo": True},
    ])


def _base_de_ana():
    tenant = _Db()
    tenant["drivers"] = _Col([dict(f) for f in FICHAS])
    tenant["dnr_rows"] = _Col([dict(f) for f in FILAS])
    tenant["pod_rows"] = _Col([dict(f) for f in FOTO])
    tenant["cc_rows"] = _Col([dict(f) for f in CONTACTO])
    tenant["daily_reports"] = _Col([
        {"center": "OGA5", "fecha": "2026-11-11", "fecha_dnr": "2026-11-09", "transporter_id": "AANA000001", "dnr": 1},
        {"center": "OGA5", "fecha": "2026-11-12", "fecha_dnr": "2026-11-10", "transporter_id": "AANA000001", "dnr": 1},
        {"center": "DGA1", "fecha": "2026-11-13", "fecha_dnr": "2026-11-11", "transporter_id": "AEVA000001", "dnr": 1},
        {"center": "DGA10", "fecha": "2026-11-06", "fecha_dnr": "2026-11-04", "transporter_id": "ARITA00001", "dnr": 1},
    ])
    # El historial de rutas pone el nombre de Ana a un ID que ninguna ficha tiene: la oficina lo enseña con ese nombre,
    # pero eso no hace que sea de ninguna de las dos Anas.
    tenant["route_history"] = _Col([{"transporter_id": "AFANTASMA1", "driver_name": "ANA PEREZ GOMEZ"}])
    return tenant


@pytest.fixture
def base(monkeypatch):
    tenant = _base_de_ana()
    globales = _Db()
    globales["organizations"] = _organizaciones()
    monkeypatch.setattr(server, "db", tenant)
    monkeypatch.setattr(server, "global_db", globales)
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)
    return tenant


def _paquetes(r):
    return {x["paquete"] for s in r["semanas"] for x in s["dnr"]}


def _dnr(r, paquete):
    return next(x for s in r["semanas"] for x in s["dnr"] if x["paquete"] == paquete)


# R7 (11-11-2026): `entrega` es nueva y `sin_interpretar` ya no sale (F22/F25).
CLAVES_DNR = {"dia", "entrega", "paquete", "estado", "cp", "como", "lejos", "llamada", "segundos", "fallo_contacto",
              "foto", "foto_motivo"}


# ── Lo suyo, por semana y con su estado ────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_ana_ve_sus_cuatro_semanas_con_el_estado_de_cada_una(base):
    r = await server.mis_dnr(_conductor("d-ana"))
    assert r["tiene_id"] is True and r["en_revision"] is False
    # Las 4 últimas semanas de Amazon (domingo a sábado), de la más nueva a la más vieja, también las vacías.
    assert [(s["semana"], s["hasta"]) for s in r["semanas"]] == [
        ("2026-11-08", "2026-11-14"), ("2026-11-01", "2026-11-07"),
        ("2026-10-25", "2026-10-31"), ("2026-10-18", "2026-10-24")]
    estado = {x["paquete"]: x["estado"] for s in r["semanas"] for x in s["dnr"]}
    assert estado == {"TBAANA1": "cuenta", "TBAANA2": "no_cuenta", "TBAANA3": "sin_clasificar",
                      "TBAANA4": "sin_clasificar", "TBAANA5": "cuenta", "TBAANAV": "cuenta"}
    s0, s1, s2, s3 = r["semanas"]
    assert [x["paquete"] for x in s0["dnr"]] == ["TBAANA3", "TBAANA1"]          # la más nueva primero
    assert (s0["cuentan"], s0["no_cuentan"], s0["sin_clasificar"]) == (1, 0, 1)
    assert (s1["cuentan"], s1["no_cuentan"], s1["sin_clasificar"]) == (1, 1, 0)
    assert s2["dnr"] == [] and (s2["cuentan"], s2["no_cuentan"], s2["sin_clasificar"]) == (0, 0, 0)
    assert (s3["cuentan"], s3["sin_clasificar"]) == (1, 1)


@pytest.mark.asyncio(loop_scope="session")
async def test_el_estado_sale_bien_en_los_tres_casos(base):
    """Cuenta = DSC Y. No cuenta = N en un día que Amazon ya clasificó en ese centro (hay alguna Y). Sin clasificar = sin
    DSC, o N en un día de ese centro sin una sola Y (la regla del aviso al subir): una Y de OTRO centro no lo clasifica."""
    r = await server.mis_dnr(_conductor("d-ana"))
    estado = {x["paquete"]: x["estado"] for s in r["semanas"] for x in s["dnr"]}
    assert estado["TBAANA1"] == "cuenta"
    assert estado["TBAANA2"] == "no_cuenta"
    assert estado["TBAANA3"] == "sin_clasificar"
    assert estado["TBAANA4"] == "sin_clasificar"
    # Cuando Amazon clasifica el día 10 de OGA5 (llega una Y de otro), la N de Ana pasa a «no cuenta».
    base["dnr_rows"].docs.append(_fila("TBLUIS2", "ALUIS00001", "2026-11-10", "Y"))
    r = await server.mis_dnr(_conductor("d-ana"))
    assert {x["paquete"]: x["estado"] for s in r["semanas"] for x in s["dnr"]}["TBAANA3"] == "no_cuenta"


@pytest.mark.asyncio(loop_scope="session")
async def test_solo_lo_minimo_ni_euros_ni_el_id_ni_otros(base):
    r = await server.mis_dnr(_conductor("d-ana"))
    assert set(r) == {"tiene_id", "en_revision", "datos_hasta", "semanas"}
    for s in r["semanas"]:
        assert set(s) == {"semana", "hasta", "cuentan", "no_cuentan", "sin_clasificar", "dnr"}
        for x in s["dnr"]:
            assert set(x) == CLAVES_DNR, set(x) ^ CLAVES_DNR
    texto = json.dumps(r, ensure_ascii=False)
    # Ni euros, ni su ID, ni nada de otros conductores (ni sus filas de foto o contacto), ni las columnas que no se
    # entienden (PHR, la excepción, las simultáneas).
    for prohibido in ("25.4", "25.40", "€", "valor", "AANA000001", "AANAVIEJA1", "ALUIS", "TBLUIS", "TBEVA", "TBPACO",
                      "TBFANT", "TBJUAN", "TBPEDR", "LUIS", "PACKAGE_NOT_VISIBLE", "GARDEN", "jardin", "NO_CALL",
                      "PHRSECRETO", "EXCSECRETA", "phr", "excepcion", "simultaneas"):
        assert prohibido not in texto, prohibido


# ── Nadie ve lo de otro ────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_cada_uno_ve_solo_lo_suyo(base):
    vistos = {sub: _paquetes(await server.mis_dnr(_conductor(sub))) for sub in
              ("d-ana", "d-luis", "d-eva", "d-mar", "d-paco", "d-sin", "d-pedro", "d-diez")}
    assert vistos["d-ana"] == {"TBAANA1", "TBAANA2", "TBAANA3", "TBAANA4", "TBAANA5", "TBAANAV"}  # con la fusionada
    # R7/F11: Mar (viva) tiene en `driver_id` el ID de Luis (vivo): dos personas lo reclaman y no gana ninguna.
    assert vistos["d-luis"] == set()
    assert vistos["d-eva"] == {"TBEVA01"}                    # por su `driver_id`, con espacios y en minúsculas
    assert vistos["d-mar"] == set()                          # su `driver_id` lo tiene Luis en `transporter_id`
    assert vistos["d-paco"] == {"TBPACO1"}                   # dos fichas con el mismo ID: manda la activa
    assert vistos["d-sin"] == set()                          # mismo nombre que el del historial: nunca por nombre
    assert vistos["d-pedro"] == {"TBPEDR1"}                  # el mismo correo que Juan no le da lo de Juan
    assert vistos["d-diez"] == {"TBRITA1"}
    # Y el ID sin ficha no lo ve nadie.
    assert not any("TBFANT1" in v for v in vistos.values())


@pytest.mark.asyncio(loop_scope="session")
async def test_el_mismo_correo_no_junta_a_dos_personas(base):
    """D1: la oficina dio de alta a Pedro con el buzón de Juan (de baja) eligiendo «es otra persona». Ninguno ve lo del
    otro, en los dos sentidos: Pedro solo lo suyo; con la ficha de Juan, 403 (está de baja) y nunca lo de Pedro. Lo que
    SÍ se suma es lo que la oficina fusionó en la ficha (Ana y su ficha vieja)."""
    assert _paquetes(await server.mis_dnr(_conductor("d-pedro"))) == {"TBPEDR1"}
    with pytest.raises(HTTPException) as e:
        await server.mis_dnr(_conductor("d-juan"))
    assert e.value.status_code == 403
    # Aunque Juan siguiera activo, el correo compartido no le daría lo de Pedro (ni a Pedro lo de Juan).
    base["drivers"].docs[[f["id"] for f in base["drivers"].docs].index("d-juan")]["active"] = True
    assert _paquetes(await server.mis_dnr(_conductor("d-juan"))) == {"TBJUAN1"}
    assert _paquetes(await server.mis_dnr(_conductor("d-pedro"))) == {"TBPEDR1"}
    assert "TBAANAV" in _paquetes(await server.mis_dnr(_conductor("d-ana")))


@pytest.mark.asyncio(loop_scope="session")
async def test_de_baja_o_fusionada_no_puede_usar_la_ruta(base):
    """D4: el token de un conductor vale 30 días y la baja no lo revoca. Con la ficha de baja, o fusionada en otra,
    403, aunque tenga IDs con DNR (las de Paco son de la ficha activa)."""
    for sub in ("d-paco-baja", "d-ana-vieja", "d-juan"):
        with pytest.raises(HTTPException) as e:
            await server.mis_dnr(_conductor(sub))
        assert e.value.status_code == 403, sub


@pytest.mark.asyncio(loop_scope="session")
async def test_se_casan_igual_que_en_la_pantalla_de_la_oficina(base):
    """La oficina (diarios_por_conductor) pone a cada ID el `driver_id` de su ficha. Lo que ve cada persona tiene que ser
    exactamente lo que la oficina le pone a su ficha y a las fusionadas en ella, en las 4 semanas. (Además de esta
    comparación, test_cada_uno_ve_solo_lo_suyo dice a mano qué tiene que ver cada uno.) La única excepción es la de R7/F11:
    un ID que reclaman dos fichas vivas no se enseña a ninguna (Luis y Mar; la oficina se lo pone a Luis)."""
    de_la_oficina: dict = {}
    for centro in ("OGA5", "DGA1", "DGA10"):
        r = await server.diarios_por_conductor(centro, "2026-10-18", "2026-11-14", DANI)
        for c in r["conductores"]:
            for d in c["detalle"]:
                de_la_oficina.setdefault(c.get("driver_id"), set()).add(d["tracking_id"])
    personas = {"d-ana": {"d-ana", "d-ana-vieja"}, "d-luis": {"d-luis"}, "d-eva": {"d-eva"}, "d-mar": {"d-mar"},
                "d-paco": {"d-paco"}, "d-sin": {"d-sin"}, "d-pedro": {"d-pedro"}, "d-diez": {"d-diez"}}
    en_disputa = {"TBLUIS1"}
    for sub, fichas in personas.items():
        esperado = set().union(*(de_la_oficina.get(f, set()) for f in fichas)) - en_disputa
        assert _paquetes(await server.mis_dnr(_conductor(sub))) == esperado, sub
    assert "TBLUIS1" in de_la_oficina.get("d-luis", set())
    # El ID sin ficha, la oficina lo enseña con el nombre del historial pero sin ficha (driver_id None).
    assert "TBFANT1" in de_la_oficina.get(None, set())


def test_no_hay_parametro_que_cambiar_para_ver_lo_de_otro(base, monkeypatch):
    """La ruta solo tiene la sesión: ni `driver_id`, ni `transporter_id`, ni `center`, ni `desde`. Lo que se mande de
    más en la dirección se ignora y sale lo mismo. (`credentials` es el mismo token de la sesión, de la cabecera, para
    saber su `sub` original: R7/F1.)"""
    assert list(inspect.signature(server.mis_dnr).parameters) == ["user", "credentials"]
    ruta = next(r for r in server.api_router.routes if getattr(r, "path", "").endswith("/diarios/mias"))
    assert ruta.dependant.query_params == [] and ruta.dependant.body_params == []
    app = FastAPI()
    app.add_api_route("/diarios/mias", server.mis_dnr, methods=["GET"])
    app.dependency_overrides[server.get_current_user] = lambda: _conductor("d-ana")
    with TestClient(app) as c:
        normal = c.get("/diarios/mias").json()
        trampa = c.get("/diarios/mias", params={"driver_id": "d-luis", "transporter_id": "ALUIS00001",
                                                "sub": "d-luis", "center": "DGA1", "desde": "2026-01-01",
                                                "hasta": "2026-12-31", "id": "d-luis"}).json()
    assert trampa == normal
    assert _paquetes(normal) == {"TBAANA1", "TBAANA2", "TBAANA3", "TBAANA4", "TBAANA5", "TBAANAV"}


@pytest.mark.asyncio(loop_scope="session")
async def test_solo_para_conductores(base):
    with pytest.raises(HTTPException) as e:
        await server.mis_dnr(DANI)
    assert e.value.status_code == 403


@pytest.mark.asyncio(loop_scope="session")
async def test_un_id_en_dos_fichas_vivas_no_se_ensena_a_ninguna(base, monkeypatch):
    """R7/F11. Si dos fichas VIVAS (activas y sin fusionar), que no son la misma persona, tienen el mismo ID (en
    `transporter_id` o en `driver_id`), sus DNR no se enseñan a ninguna: `en_revision`. Antes ganaba la que Mongo
    devolviera primero. Las de su otro ID (la ficha fusionada de Ana) sí se ven. Y ya no se mira el «no coincide» de
    _amazon_nombres (F14/F15): aunque dijera algo, no se le llama."""
    async def no_se_llama(*a, **k):
        raise AssertionError("mis_dnr ya no usa _amazon_nombres")
    monkeypatch.setattr(server, "_amazon_nombres", no_se_llama)
    # Otra persona, viva, con el ID de Ana en `driver_id`.
    base["drivers"].docs.append({"id": "d-copia", "name": "OTRA PERSONA", "email": "otra@ejemplo.test",
                                 "center": "OGA5", "active": True, "driver_id": "aana000001"})
    r = await server.mis_dnr(_conductor("d-ana"))
    assert r["tiene_id"] is True and r["en_revision"] is True
    assert _paquetes(r) == {"TBAANAV"}
    r = await server.mis_dnr(_conductor("d-copia"))
    assert r["en_revision"] is True and _paquetes(r) == set()
    # Si esa otra ficha está de baja, ya no es viva: manda la de Ana, como en la oficina.
    base["drivers"].docs[-1]["active"] = False
    r = await server.mis_dnr(_conductor("d-ana"))
    assert r["en_revision"] is False and "TBAANA1" in _paquetes(r)
    # Y si estuviera fusionada (en Ana o en quien sea), tampoco.
    base["drivers"].docs[-1].update(active=True, merged_into="d-ana")
    assert (await server.mis_dnr(_conductor("d-ana")))["en_revision"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_dos_fichas_vivas_con_el_mismo_transporter_id_tampoco(base):
    """El empate que más se ve: el mismo `transporter_id` en dos fichas activas. Antes lo decidía el orden."""
    base["drivers"].docs.append({"id": "d-gemela", "name": "OTRA ANA", "email": "gemela@ejemplo.test",
                                 "center": "OGA5", "active": True, "transporter_id": "AANA000001"})
    for sub in ("d-ana", "d-gemela"):
        r = await server.mis_dnr(_conductor(sub))
        assert r["en_revision"] is True, sub
        assert not ({"TBAANA1", "TBAANA2", "TBAANA3"} & _paquetes(r)), sub


@pytest.mark.asyncio(loop_scope="session")
async def test_si_todos_sus_ids_estan_en_duda_no_ve_nada(base):
    """Luis (vivo, `transporter_id`) y Mar (viva, el mismo en `driver_id`): los dos en revisión y sin ninguna DNR."""
    for sub in ("d-luis", "d-mar"):
        r = await server.mis_dnr(_conductor(sub))
        assert r["tiene_id"] is True and r["en_revision"] is True and r["semanas"] == [], sub
        assert "TBLUIS1" not in json.dumps(r)
    # datos_hasta, el de su centro (OGA5), como a cualquiera.
    assert (await server.mis_dnr(_conductor("d-luis")))["datos_hasta"] == "2026-11-10"


# ── Sin ID, sin módulo ─────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_sin_id_de_reparto_lista_vacia(base):
    r = await server.mis_dnr(_conductor("d-sin"))
    assert r == {"tiene_id": False, "en_revision": False, "datos_hasta": None, "semanas": []}
    # Una ficha que ya no existe, igual.
    assert (await server.mis_dnr(_conductor("d-no-existe")))["semanas"] == []


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_el_modulo_de_la_dnr_la_ruta_no_existe(base):
    with pytest.raises(HTTPException) as e:
        await server.mis_dnr(_conductor("d-ana", org="o2"))
    assert e.value.status_code == 404 and e.value.detail == "Not Found"
    # Ni siquiera a quien no es conductor se le dice otra cosa.
    with pytest.raises(HTTPException) as e:
        await server.mis_dnr({**DANI, "org_id": "o2"})
    assert e.value.status_code == 404
    # Con el módulo puesto, sí; la cuenta del dueño lo ve todo.
    assert _paquetes(await server.mis_dnr(_conductor("d-ana", org="o3")))
    assert _paquetes(await server.mis_dnr(_conductor("d-ana", org="o1")))


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_ningun_reporte_subido_la_ruta_no_existe(base):
    """R7/F5: con el módulo puesto pero sin ningún reporte subido (la empresa no usa la DNR diaria), 404 como si la
    ruta no existiera: así la casilla no le sale a nadie. Va DESPUÉS de las comprobaciones de módulo y de rol."""
    base["daily_reports"].docs = []
    base["dnr_rows"].docs = []
    with pytest.raises(HTTPException) as e:
        await server.mis_dnr(_conductor("d-ana"))
    assert e.value.status_code == 404 and e.value.detail == "Not Found"
    # A quien no es conductor se le sigue diciendo lo de siempre (el rol va antes).
    with pytest.raises(HTTPException) as e:
        await server.mis_dnr(DANI)
    assert e.value.status_code == 403
    # Un pegado de solo el bloque DNR (sin el resumen) guarda filas pero ningún documento en daily_reports: eso
    # también es un reporte subido, y sus DNR se ven.
    base["dnr_rows"].docs = [_fila("TBAANA1", "AANA000001", "2026-11-09", "Y")]
    assert _paquetes(await server.mis_dnr(_conductor("d-ana"))) == {"TBAANA1"}
    # Y con un reporte, aunque no tenga filas DNR, la ruta existe (otro conductor, sin ninguna: 200 y vacía).
    base["dnr_rows"].docs = []
    base["daily_reports"].docs = [{"center": "OGA5", "fecha": "2026-11-11", "fecha_dnr": "2026-11-09"}]
    r = await server.mis_dnr(_conductor("d-ana"))
    assert r["tiene_id"] is True and _paquetes(r) == set()


# ── Hasta qué día hay reportes ─────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_dice_hasta_que_dia_hay_reportes_de_su_centro(base):
    """Sin esto, «esta semana no tienes ninguna» no se distingue de «aún no se ha subido». Es el de SU centro (la ficha
    dice «AMZL OGA5 SANTIAGO XPT»): DGA1 va un día por delante y no cuenta para Ana."""
    assert (await server.mis_dnr(_conductor("d-ana")))["datos_hasta"] == "2026-11-10"
    assert (await server.mis_dnr(_conductor("d-eva")))["datos_hasta"] == "2026-11-11"


@pytest.mark.asyncio(loop_scope="session")
async def test_el_centro_se_casa_por_el_codigo_entero(base):
    """D6: «DGA1» está dentro de «DGA10», pero no es su centro: a Rita (DGA10) no se le cuela la fecha de DGA1."""
    assert (await server.mis_dnr(_conductor("d-diez")))["datos_hasta"] == "2026-11-04"
    # Y si su centro no ha subido nada, nada (no la de DGA1).
    base["daily_reports"].docs = [d for d in base["daily_reports"].docs if d["center"] != "DGA10"]
    base["dnr_rows"].docs = [d for d in base["dnr_rows"].docs if d["center"] != "DGA10"]
    assert (await server.mis_dnr(_conductor("d-diez")))["datos_hasta"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_centro_reconocible_el_ultimo_de_la_empresa(base):
    """R7/F18: si la ficha no tiene un centro reconocible (vacío, o «Santiago» sin código) y no hay filas suyas que lo
    digan, no se puede afirmar que «no hay reportes de su centro»: va el último día con datos de toda la empresa."""
    base["drivers"].docs += [
        {"id": "d-santi", "name": "SANTI SIN CODIGO", "email": "santi@ejemplo.test", "center": "Santiago",
         "active": True, "transporter_id": "ASANTI0001"},
        {"id": "d-nada", "name": "NADA DE CENTRO", "email": "nada@ejemplo.test", "active": True,
         "transporter_id": "ANADA00001"},
    ]
    for sub in ("d-santi", "d-nada"):
        r = await server.mis_dnr(_conductor(sub))
        assert r["tiene_id"] is True and _paquetes(r) == set(), sub
        assert r["datos_hasta"] == "2026-11-11", sub          # el último de la empresa (DGA1)
    # Con un centro reconocible SIN reportes, null (no el de la empresa): ver test_el_centro_se_casa_por_el_codigo_entero.


@pytest.mark.asyncio(loop_scope="session")
async def test_ninguna_consulta_lee_sin_tope(base):
    """D7 y R7/F14: cada consulta de la ruta lleva su tope (limit o to_list(n)), mirando TODAS las colecciones que toca:
    las de las fichas, las filas, la foto, el contacto, los reportes y la empresa. Lo que no es un cursor: find_one (uno),
    y un único distinct, el de los centros de daily_reports (tantos como centros, con su índice). Y ya no toca las
    colecciones heredadas del «no coincide» (cortex_resumen, route_history, whc_api, app_meta), que leía sin tope."""
    tocadas: dict = {}
    await server.mis_dnr(_conductor("d-ana"))
    for nombre, col in list(base.items()):
        if col.cursores or col.otras:
            tocadas[nombre] = col
    assert set(tocadas) == {"drivers", "dnr_rows", "pod_rows", "cc_rows", "daily_reports"}, set(tocadas)
    for nombre, col in tocadas.items():
        assert all(c.con_tope for c in col.cursores), nombre
        assert not [o for o in col.otras if o not in ("find_one", "distinct:center")], (nombre, col.otras)
    assert base["daily_reports"].otras.count("distinct:center") <= 1
    for heredada in ("cortex_resumen", "route_history", "whc_api", "app_meta"):
        assert not base[heredada].cursores and not base[heredada].otras, heredada
    # La empresa (la base global): solo find_one.
    org = server.global_db["organizations"]
    assert not org.cursores and set(org.otras) <= {"find_one"}


# ── Cómo fue la entrega (R4) ───────────────────────────────────────────────────

def test_el_escaneo_se_entiende_solo_si_es_uno_conocido():
    como = server._dnr_como
    assert como("DELIVERED_TO_DOORSTEP") == "puerta"
    assert como("Delivered to mail slot") == "buzon"            # cualquier forma de escribirlo
    assert como("doorstep") == "puerta"                           # sin el prefijo, como lo pinta la oficina
    assert como("DELIVERED_TO_HOUSEHOLD_MEMBER") == "familiar"
    assert como("DELIVERED_TO_CUSTOMER") == "en_mano"
    assert como("DELIVERED_TO_NEIGHBOR") == "vecino"
    assert como("DELIVERED_TO_RECEPTIONIST") == "recepcion"
    assert como("DELIVERED_TO_LOCKER") == como("DELIVERED_TO_EVERYWHERE_LOCKER") == "locker"
    for raro in ("", None, "Delivered", "FRONT_DOOR", "DELIVERED_TO_MOON", "1"):
        assert como(raro) is None, raro


def test_cada_dato_interpretado_y_lo_que_no_se_entiende_a_null():
    e = server._dnr_entrega
    base = {"cp": "15704", "scan": "DELIVERED_TO_DOORSTEP", "mas_25m": "Y", "contacto": "Y",
            "phr": "Y", "excepcion": "X", "simultaneas": "3"}
    r = e(base, [{"fallo": "Blurry photo", "motivo": "DELIVERED_TO_DOORSTEP"}], [{"tipo": "CALL", "segundos": 12}])
    assert set(r) == CLAVES_DNR - {"dia", "entrega", "paquete", "estado"}
    assert (r["cp"], r["como"], r["lejos"]) == ("15704", "puerta", True)
    # Llamó 12 s: eso se dice. Un tipo «CALL» no dice ningún fallo: fallo_contacto null (R7/F7).
    assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == ("si", 12, None)
    assert (r["foto"], r["foto_motivo"]) == ("mal", "borrosa")

    # A menos de 25 m; sin filas de foto ni de contacto: de eso no se sabe nada (null, no «bien»).
    r = e({"mas_25m": "No", "scan": "DELIVERED_TO_MAIL_SLOT"}, [], [])
    assert (r["como"], r["lejos"], r["llamada"], r["segundos"], r["fallo_contacto"], r["foto"]) == (
        "buzon", False, None, None, None, None)

    # Un «1» en «≥ 25 m» no se traduce (como con la DSC), un escaneo raro tampoco: null.
    r = e({"mas_25m": "1", "scan": "DELIVERED_TO_MOON"}, [], [])
    assert (r["como"], r["lejos"]) == (None, None)

    # «No llamaste» solo si el tipo lo dice con todas las letras y sin segundos; con 0 s y un tipo desconocido, no se sabe.
    assert e({}, [], [{"tipo": "NO_CALL", "segundos": 0}])["llamada"] == "no"
    assert e({}, [], [{"tipo": "NO_CALL", "segundos": 9}])["llamada"] == "si"
    sin_saber = e({}, [], [{"tipo": "SMS", "segundos": 0}])
    assert (sin_saber["llamada"], sin_saber["segundos"], sin_saber["fallo_contacto"]) == (None, None, None)

    assert e({}, [{"fallo": "PASS"}], [])["foto"] == "bien"
    assert e({}, [{"fallo": ""}, {"fallo": "-"}], [])["foto"] is None
    assert e({}, [{"fallo": "PACKAGE_NOT_CLEARLY_VISIBLE"}], [])["foto_motivo"] == "sin_paquete"

    # Sin escaneo en la fila, vale el de su fila de foto o de contacto si es uno conocido.
    assert e({"scan": ""}, [], [{"motivo": "DELIVERED_TO_NEIGHBOR", "segundos": 0}])["como"] == "vecino"


def test_la_foto_mal_solo_con_un_motivo_conocido():
    """R7/F7: «La foto no pasó la revisión» es decir algo malo de una persona; solo con un motivo que se reconoce. Un
    valor que no se entiende («N», «Y», «PENDING», un código raro) no dice nada: null, nunca «mal» ni «bien»."""
    e = server._dnr_entrega
    for raro in ("N", "Y", "PENDING", "WEIRD_AUDIT", "OK", "Accepted"):
        r = e({}, [{"fallo": raro}], [])
        assert (r["foto"], r["foto_motivo"]) == (None, None), raro
    assert (e({}, [{"fallo": "BLURRY"}], [])["foto"], e({}, [{"fallo": "TOO_DARK"}], [])["foto_motivo"]) == (
        "mal", "oscura")
    # «bien» solo si TODO lo que dice es PASS/PASSED; con uno que no se entiende al lado, no se sabe.
    assert e({}, [{"fallo": "PASSED"}, {"fallo": "PASS"}], [])["foto"] == "bien"
    assert e({}, [{"fallo": "PASS"}, {"fallo": "PENDING"}], [])["foto"] is None
    # Un motivo conocido manda aunque haya otras filas.
    r = e({}, [{"fallo": "PASS"}, {"fallo": "NO_PHOTO"}], [])
    assert (r["foto"], r["foto_motivo"]) == ("mal", "sin_foto")


def test_el_fallo_de_contacto_solo_si_el_tipo_lo_dice():
    """R7/F7: estar en la tabla de contacto ya NO basta para «Te apuntaron un fallo de contacto». Solo un tipo que lo
    dice con todas las letras (los NO_CALL… que dan «No llamaste»), y nunca si a la vez consta una llamada."""
    e = server._dnr_entrega
    for tipo, segundos in (("CALL", 12), ("SMS", 0), ("Y", 0), ("", 0), ("CONTACTED", 30)):
        assert e({}, [], [{"tipo": tipo, "segundos": segundos}])["fallo_contacto"] is None, tipo
    for tipo in ("NO_CALL", "no call made", "CALL_NOT_MADE", "NOT_CALLED"):
        r = e({}, [], [{"tipo": tipo, "segundos": 0}])
        assert (r["llamada"], r["fallo_contacto"]) == ("no", True), tipo
    # Contradictorio (dice NO_CALL pero hay segundos de llamada): no se afirma el fallo.
    assert e({}, [], [{"tipo": "NO_CALL", "segundos": 9}])["fallo_contacto"] is None
    # Sin fila de contacto, no se sabe (nunca false).
    assert e({}, [], [])["fallo_contacto"] is None


def test_el_cp_solo_si_parece_un_codigo_postal():
    """R7/F23/F24: al menos una cifra, de 3 a 10 caracteres y como mucho un espacio o un guion."""
    e = server._dnr_entrega
    for bueno in ("15704", "1000-001", "SW1A 1AA", "sw1a 1aa", " 28001 "):
        assert e({"cp": bueno}, [], [])["cp"] == bueno.strip().upper(), bueno
    for malo in ("SANTIAGO", "Calle Mayor 5", "C/ Mayor 5", "12", "12345678901", "1 2 3", "15-70-4", "AB-CD",
                 "15704.0", "Rúa 5", ""):
        assert e({"cp": malo}, [], [])["cp"] is None, malo


def test_nada_que_parezca_texto_libre_sale_tal_cual():
    """R7/F22/F25: `sin_interpretar` ya no se manda: lo que no se entiende no sale de ninguna forma, ni un texto libre
    en ASCII (un nombre, una calle, un teléfono). Y un CP que no parece un CP, tampoco."""
    r = server._dnr_entrega({"cp": "Rúa Real 50, 3ºB", "scan": "Lo dejé con la Sra. María, 3ºB",
                             "contacto": "llamar al 600 000 000 (María)"}, [], [])
    assert r["cp"] is None and r["como"] is None
    r = server._dnr_entrega({"cp": "Calle Mayor 5", "scan": "Maria Lopez", "mas_25m": "600123456",
                             "contacto": "JUAN PEREZ"},
                            [{"fallo": "Calle Mayor 5", "motivo": "Maria Lopez"}],
                            [{"tipo": "600 123 456", "motivo": "JUAN PEREZ", "segundos": 0}])
    assert "sin_interpretar" not in r
    texto = json.dumps(r, ensure_ascii=False)
    for libre in ("Calle", "Mayor", "Maria", "Lopez", "600", "JUAN", "PEREZ"):
        assert libre not in texto, libre
    assert set(r.values()) == {None}


@pytest.mark.asyncio(loop_scope="session")
async def test_lo_que_no_se_entiende_no_sale_ni_en_la_respuesta_ni_en_el_log(base, caplog):
    base["dnr_rows"].docs.append(_fila("TBAANA9", "AANA000001", "2026-11-09", "Y", scan="Maria Lopez",
                                       mas_25m="600123456", contacto="JUAN PEREZ", cp="Calle Mayor 5"))
    with caplog.at_level("DEBUG"):
        r = await server.mis_dnr(_conductor("d-ana"))
    texto = json.dumps(r, ensure_ascii=False)
    assert "sin_interpretar" not in texto
    for libre in ("Maria", "600123456", "JUAN", "Calle Mayor"):
        assert libre not in texto and libre not in caplog.text, libre


def test_el_dia_de_la_entrega_solo_si_es_una_fecha_iso_clara():
    """R7/F8/F9: `entrega` solo si `fecha_entrega` empieza por una fecha ISO que existe, no es posterior a la DNR y no
    es más de 60 días anterior. Nunca se adivina el día y el mes de un formato dudoso."""
    f = server._dnr_dia_entrega
    dia = "2026-11-09"
    assert f("2026-11-07", dia) == "2026-11-07"
    assert f("2026-11-09", dia) == "2026-11-09"
    assert f("2026-11-07T10:30:00Z", dia) == "2026-11-07"
    assert f("2026-11-07 10:30", dia) == "2026-11-07"
    assert f(" 2026-11-07 ", dia) == "2026-11-07"
    assert f("2026-09-10", dia) == "2026-09-10"          # 60 días antes: aún vale
    for malo in ("2026-09-09",                            # 61 días antes
                 "2026-11-10",                            # después de la DNR
                 "07/11/2026", "11/07/2026", "7/11/26", "2026/11/07", "20261107", "2026-11-071",
                 "2026-02-30", "2026-13-01", "Nov 7, 2026", "", None, "-"):
        assert f(malo, dia) is None, malo
    assert f("2026-11-07", "") is None and f("2026-11-07", None) is None


@pytest.mark.asyncio(loop_scope="session")
async def test_cada_dnr_lleva_su_dia_de_entrega_si_se_sabe(base):
    base["dnr_rows"].docs = [d for d in base["dnr_rows"].docs if d["tracking_id"] not in ("TBAANA1", "TBAANA3")]
    base["dnr_rows"].docs += [_fila("TBAANA1", "AANA000001", "2026-11-09", "Y", fecha_entrega="2026-11-07"),
                              _fila("TBAANA3", "AANA000001", "2026-11-10", "N", fecha_entrega="07/11/2026")]
    r = await server.mis_dnr(_conductor("d-ana"))
    assert (_dnr(r, "TBAANA1")["dia"], _dnr(r, "TBAANA1")["entrega"]) == ("2026-11-09", "2026-11-07")
    assert _dnr(r, "TBAANA3")["entrega"] is None
    assert _dnr(r, "TBAANA2")["entrega"] == "2026-11-03"        # el mismo día que la DNR
    # La semana y el orden siguen yendo por el día de la DNR.
    assert [x["paquete"] for x in r["semanas"][0]["dnr"]] == ["TBAANA3", "TBAANA1"]


@pytest.mark.asyncio(loop_scope="session")
async def test_una_n_de_mas_de_7_dias_ya_no_cuenta_aunque_su_centro_no_tenga_ninguna_y(base):
    """R7/F12: Amazon rellena la DSC con 2 a 4 días de retraso; una N de hace más de 7 días ya está decidida, aunque
    ese día nadie de su centro tuviera una Y. A los 7 justos, todavía «sin clasificar». Sin DSC, sigue sin clasificar."""
    base["dnr_rows"].docs.append(_fila("TBPACO2", "APACO00001", "2026-11-03", "N", center="DGA1"))   # 8 días
    r = await server.mis_dnr(_conductor("d-paco"))
    estado = {x["paquete"]: x["estado"] for s in r["semanas"] for x in s["dnr"]}
    assert estado == {"TBPACO1": "sin_clasificar", "TBPACO2": "no_cuenta"}   # TBPACO1: el 04-11, 7 días
    assert r["semanas"][1]["no_cuentan"] == 1 and r["semanas"][1]["sin_clasificar"] == 1
    # Ana: la de hace 22 días sin DSC sigue «sin clasificar».
    assert _dnr(await server.mis_dnr(_conductor("d-ana")), "TBAANA4")["estado"] == "sin_clasificar"
    assert server._DNR_DIAS_PARA_DAR_POR_CLASIFICADA == 7


@pytest.mark.asyncio(loop_scope="session")
async def test_ana_ve_como_fue_cada_entrega_y_nada_de_las_filas_de_otro(base):
    r = await server.mis_dnr(_conductor("d-ana"))
    a1 = _dnr(r, "TBAANA1")
    assert (a1["cp"], a1["como"], a1["lejos"]) == ("15704", "puerta", True)
    assert (a1["llamada"], a1["segundos"], a1["fallo_contacto"]) == ("si", 12, None)
    assert (a1["foto"], a1["foto_motivo"]) == ("mal", "borrosa")
    # TBAANA2 comparte paquete con una fila de foto y otra de contacto de LUIS (con NO_CALL y un motivo de foto
    # conocido): no son de Ana y no cuentan.
    a2 = _dnr(r, "TBAANA2")
    assert (a2["cp"], a2["como"], a2["lejos"], a2["llamada"], a2["segundos"], a2["fallo_contacto"], a2["foto"],
            a2["foto_motivo"]) == ("15701", None, None, None, None, None, None, None)


# ── Por la sesión de verdad: el token, get_current_user y una base por empresa (D3) ────────────────────────────

class _PorEmpresa:
    """Como el `db` de server.py: cada petición lee la base de SU empresa (la que fija get_current_user con el
    `db_name` del token)."""

    def __init__(self, bases):
        self.bases = bases

    def _b(self):
        return self.bases[server._current_db_name.get()]

    def __getattr__(self, nombre):
        return getattr(self._b(), nombre)

    def __getitem__(self, nombre):
        return self._b()[nombre]


@pytest.fixture
def dos_empresas(monkeypatch):
    """La empresa del dueño (base por defecto) y otra empresa con el módulo (dsp_o3). En LAS DOS hay una ficha «d-ana»
    con el mismo ID de reparto: con el token de una solo salen las filas de esa. Y la demo de reparto, vacía."""
    de_ana = _base_de_ana()
    otra = _Db()
    otra["drivers"] = _Col([{"id": "d-ana", "name": "ANA OTRA EMPRESA", "email": "ana@otra.test", "center": "MAD1",
                             "active": True, "transporter_id": "AANA000001"}])
    otra["dnr_rows"] = _Col([_fila("TBOTRA1", "AANA000001", "2026-11-09", "Y", center="MAD1")])
    otra["daily_reports"] = _Col([{"center": "MAD1", "fecha": "2026-11-11", "fecha_dnr": "2026-11-09"}])
    globales = _Db()
    globales["organizations"] = _organizaciones()
    monkeypatch.setattr(server, "db", _PorEmpresa({server._DEFAULT_DB_NAME: de_ana, "dsp_o3": otra,
                                                  server._DEMO_REP_DB: _Db()}))
    monkeypatch.setattr(server, "global_db", globales)
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)
    monkeypatch.setattr(server, "_FICHA_ACTIVA_CACHE", {})
    app = FastAPI()
    app.add_api_route("/api/diarios/mias", server.mis_dnr, methods=["GET"])   # con su get_current_user de verdad
    with TestClient(app) as c:
        yield c


def _pedir(c, token):
    return c.get("/api/diarios/mias", headers={"Authorization": f"Bearer {token}"})


def _token(sub, org="o1", db_name=None, **mas):
    return server.create_token(sub, "driver", sub, org_id=org,
                               db_name=db_name if db_name is not None else server._DEFAULT_DB_NAME, **mas)


def test_por_la_sesion_cada_empresa_lee_solo_su_base(dos_empresas):
    c = dos_empresas
    r = _pedir(c, _token("d-ana"))
    assert r.status_code == 200
    assert _paquetes(r.json()) == {"TBAANA1", "TBAANA2", "TBAANA3", "TBAANA4", "TBAANA5", "TBAANAV"}
    r = _pedir(c, _token("d-ana", org="o3", db_name="dsp_o3"))
    assert r.status_code == 200 and _paquetes(r.json()) == {"TBOTRA1"}
    assert r.json()["datos_hasta"] == "2026-11-09"
    # Pedro, por su token, solo lo suyo (el mismo correo que Juan no le da lo de Juan).
    assert _paquetes(_pedir(c, _token("d-pedro")).json()) == {"TBPEDR1"}


def test_por_la_sesion_de_baja_sin_otra_ficha_activa_403(dos_empresas):
    """La ficha de baja de Paco no tiene otra activa con su correo (la activa tiene otro): get_current_user no la
    lleva a ninguna y la ruta contesta 403, aunque el token siga vivo."""
    assert _pedir(dos_empresas, _token("d-paco-baja")).status_code == 403


def test_por_la_sesion_la_ficha_fusionada_lleva_a_la_buena(dos_empresas):
    """El token de la ficha vieja de Ana (fusionada en la buena, mismo correo) lo lleva get_current_user a la ficha
    buena: ve lo de Ana, que es suyo."""
    r = _pedir(dos_empresas, _token("d-ana-vieja"))
    assert r.status_code == 200 and "TBAANA1" in _paquetes(r.json())


def test_por_la_sesion_el_token_de_juan_no_ve_lo_de_pedro(dos_empresas):
    """R7/F1. get_current_user lleva el token de Juan (ficha de baja) a la ficha ACTIVA del mismo correo, la de Pedro,
    aunque la oficina diera de alta a Pedro como «otra persona». ESTA ruta vuelve a leer el `sub` original del token:
    no es la ficha de la sesión ni una fusionada en ella, así que 403 «Tu ficha está de baja».
    OJO: el RESTO DEL PORTAL sigue con ese agujero (Juan ve los turnos, la furgoneta… de Pedro): viene de antes, es de
    get_current_user/_ficha_activa_de y se arregla aparte. Aquí solo se cierra para las DNR."""
    c = dos_empresas
    r = _pedir(c, _token("d-juan"))
    assert r.status_code == 403 and r.json()["detail"] == "Tu ficha está de baja"
    assert "TBPEDR1" not in r.text
    # El de Pedro, el suyo, sigue funcionando.
    r = _pedir(c, _token("d-pedro"))
    assert r.status_code == 200 and _paquetes(r.json()) == {"TBPEDR1"}


def test_por_la_sesion_dos_fichas_suyas_sin_fusionar_403_hasta_que_vuelva_a_entrar(dos_empresas):
    """El coste aceptado de F1: el token viejo de una ficha de baja que solo comparte correo con la activa (no está
    FUSIONADA en ella) recibe 403 en esta ruta, aunque fuera la misma persona; al volver a entrar, el token ya es el de
    la activa. Fusionarlas lo decide la oficina (test_por_la_sesion_la_ficha_fusionada_lleva_a_la_buena)."""
    c = dos_empresas
    server.db.bases[server._DEFAULT_DB_NAME]["drivers"].docs.append(
        {"id": "d-eva-vieja", "name": "EVA SANZ LOPEZ", "email": "EVA@ejemplo.test", "center": "DGA1",
         "active": False})
    assert _pedir(c, _token("d-eva-vieja")).status_code == 403
    r = _pedir(c, _token("d-eva"))
    assert r.status_code == 200 and _paquetes(r.json()) == {"TBEVA01"}


def test_por_la_sesion_caducado_401_y_sin_token_401(dos_empresas):
    assert _pedir(dos_empresas, _token("d-ana", horas=-1)).status_code == 401
    assert dos_empresas.get("/api/diarios/mias").status_code == 401


def test_por_la_sesion_la_demo_de_reparto_no_la_tiene(dos_empresas):
    """La demo de reparto no tiene la DNR diaria: como si la ruta no existiera."""
    t = server.create_token("demo-r1", "driver", "Repartidor 1", org_id=server._DEMO_REP_ORG_ID,
                            db_name=server._DEMO_REP_DB, account_type="dsp", demo=True)
    r = _pedir(dos_empresas, t)
    assert r.status_code == 404
