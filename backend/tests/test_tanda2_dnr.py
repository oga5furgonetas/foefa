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
from base_de_mentira import _FALTA, Col, Cursor, Db, _casa, _leer, _poner, _proyecta

HOY = "2026-11-11"          # miércoles: su semana de Amazon empieza el domingo 08-11
DANI = {"sub": "u1", "name": "Dani", "role": "admin", "account_type": "owner"}


def _conductor(sub, org="o1"):
    return {"sub": sub, "name": sub, "role": "driver", "org_id": org}


def _proyecta_mongo(d, proyeccion):
    """Como MongoDB también con las proyecciones de INCLUSIÓN (R10/H3, 11-11-2026): `{campo: 1}` devuelve solo esos
    campos, más `_id` si no se excluye. La base de mentira las ignora (y devuelve el documento entero), así que quitar
    `merged_into` o `actualizado` de una proyección del servidor no lo notaba ninguna prueba. Las de exclusión, como
    siempre. Todo documento de MongoDB tiene `_id`: si el de mentira no lo trae, se le da uno fijo (el suyo en memoria),
    para que `find_one({}, {"_id": 1})` siga diciendo «hay algo»."""
    if not isinstance(proyeccion, dict) or not any(v not in (0, False) for v in proyeccion.values()):
        return _proyecta(d, proyeccion)
    fuera = {}
    for campo, v in proyeccion.items():
        if campo == "_id" or v in (0, False):
            continue
        valor = _leer(d, campo)
        if valor is not _FALTA:
            _poner(fuera, campo, valor)
    if proyeccion.get("_id", 1) not in (0, False):
        fuera["_id"] = d.get("_id", id(d))
    return fuera


class _CursorMongo(Cursor):
    """Ordena como MongoDB también con booleanos y campos que faltan (null < false < true). El de la base de mentira
    compara True con "" y revienta; aquí hace falta porque la oficina ordena las fichas por `active`. Y apunta si la
    consulta llevaba tope (`limit` o `to_list(n)`), para la prueba de los topes."""

    def __init__(self, docs, col=None, proyeccion=None):
        super().__init__(docs)
        self.col = col
        self.con_tope = False
        # Como MongoDB, la proyección se aplica DESPUÉS de ordenar y cortar (R10/H3): se puede ordenar por un campo que
        # no se pide.
        self.proyeccion = proyeccion
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
        return [_proyecta_mongo(d, self.proyeccion) for d in await super().to_list(n)]

    async def __anext__(self):
        return _proyecta_mongo(await super().__anext__(), self.proyeccion)


class _Col(Col):
    def __init__(self, docs=None):
        super().__init__(docs)
        self.cursores = []

        # Lo que no es un cursor (find_one, distinct, aggregate), apuntado con su colección para la prueba de los topes
        # (R7, 11-11-2026: «mirando TODAS las colecciones que toque la ruta»).
        self.otras = []

    def find(self, q=None, proyeccion=None, projection=None, **_):
        # Como MongoDB, `{campo: {"$nin": [None, …]}}` deja FUERA los documentos sin ese campo (null casa con «no
        # está»); la base de mentira los deja entrar. Con el tope bajado (R8/G1) eso cambia qué fichas caben.
        sin_campo = [k for k, v in (q or {}).items() if isinstance(v, dict) and None in (v.get("$nin") or ())]
        docs = [d for d in self.docs if all(_leer(d, k) is not _FALTA for k in sin_campo)]
        return _CursorMongo([d for d in docs if _casa(d, q)], self, proyeccion or projection)

    async def find_one(self, q=None, proyeccion=None, projection=None, sort=None, **k):
        self.otras.append("find_one")
        d = await super().find_one(q, None, sort=sort, **k)
        return None if d is None else _proyecta_mongo(d, proyeccion or projection)

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
    _fila("TBAANA100", "AANA000001", "2026-11-09", "Y", scan="DELIVERED_TO_DOORSTEP", mas_25m="Y", cp="15704"),
    _fila("TBAANA200", "AANA000001", "2026-11-03", "N"),                   # no cuenta: ese día OGA5 tiene una Y (Luis)
    _fila("TBAANA300", "AANA000001", "2026-11-10", "N"),                   # sin clasificar: ninguna Y en OGA5 ese día
    _fila("TBAANA400", "AANA000001", "2026-10-20", ""),                    # sin clasificar: sin DSC
    _fila("TBAANA500", "AANA000001", "2026-10-18", "Y"),                   # el primer día de la 4.ª semana: entra
    _fila("TBAANA600", "AANA000001", "2026-10-17", "Y"),                   # el sábado anterior: fuera
    _fila("TBAANAV00", "AANAVIEJA1", "2026-11-02", "Y"),                   # de su ficha fusionada: suya
    _fila("TBLUIS100", "ALUIS00001", "2026-11-03", "Y"),
    _fila("TBEVA0100", "AEVA000001", "2026-11-10", "Y", center="DGA1"),   # una Y en DGA1 el 10: no clasifica OGA5
    _fila("TBPACO100", "APACO00001", "2026-11-04", "N", center="DGA1"),
    _fila("TBFANT100", "AFANTASMA1", "2026-11-05", "Y"),                   # un ID sin ficha: de nadie
    _fila("TBJUAN100", "AJUAN00001", "2026-11-09", "Y"),                   # de Juan (de baja)
    _fila("TBPEDR100", "APEDRO0001", "2026-11-05", "Y"),                   # de Pedro
    _fila("TBRITA100", "ARITA00001", "2026-11-04", "Y", center="DGA10"),
]

# La tabla de los fallos de foto y la de los de contacto (las guarda la subida del .html por paquete y fecha del
# reporte). La de Luis lleva el MISMO paquete que una de Ana: no es de Ana y no puede cambiar lo que ve ella.
FOTO = [
    {"tracking_id": "TBAANA100", "transporter_id": "AANA000001", "fecha_reporte": "2026-11-11",
     "motivo": "DELIVERED_TO_DOORSTEP", "fallo": "Blurry photo"},
    {"tracking_id": "TBAANA200", "transporter_id": "ALUIS00001", "fecha_reporte": "2026-11-05",
     "motivo": "DELIVERED_TO_GARDEN", "fallo": "PACKAGE_NOT_VISIBLE"},
]
CONTACTO = [
    {"tracking_id": "TBAANA100", "transporter_id": "AANA000001", "fecha_reporte": "2026-11-11",
     "motivo": "DELIVERED_TO_DOORSTEP", "tipo": "CALL", "segundos": 12},
    {"tracking_id": "TBAANA200", "transporter_id": "ALUIS00001", "fecha_reporte": "2026-11-05",
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
# R14 (11-11-2026): las 7 nuevas, de las columnas de la tabla DNR que Dani decidió usar.
CLAVES_R14 = {"contacto_como", "preferencia", "buzon_otro", "varios_a_la_vez", "a_distancia", "cliente_no_confirma",
              "alto_valor"}
CLAVES_DNR = CLAVES_DNR | CLAVES_R14


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
    assert estado == {"TBAANA100": "cuenta", "TBAANA200": "no_cuenta", "TBAANA300": "sin_clasificar",
                      "TBAANA400": "sin_clasificar", "TBAANA500": "cuenta", "TBAANAV00": "cuenta"}
    s0, s1, s2, s3 = r["semanas"]
    assert [x["paquete"] for x in s0["dnr"]] == ["TBAANA300", "TBAANA100"]          # la más nueva primero
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
    assert estado["TBAANA100"] == "cuenta"
    assert estado["TBAANA200"] == "no_cuenta"
    assert estado["TBAANA300"] == "sin_clasificar"
    assert estado["TBAANA400"] == "sin_clasificar"
    # Cuando Amazon clasifica el día 10 de OGA5 (llega una Y de otro), la N de Ana pasa a «no cuenta».
    base["dnr_rows"].docs.append(_fila("TBLUIS200", "ALUIS00001", "2026-11-10", "Y"))
    r = await server.mis_dnr(_conductor("d-ana"))
    assert {x["paquete"]: x["estado"] for s in r["semanas"] for x in s["dnr"]}["TBAANA300"] == "no_cuenta"


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
    # entienden (PHR, la excepción, las simultáneas). Desde R14 hay una clave «alto_valor» (un sí, nunca el importe): lo
    # prohibido es la clave «valor» y «valor_eur», no la palabra.
    for prohibido in ("25.4", "25.40", "€", '"valor"', "valor_eur", "AANA000001", "AANAVIEJA1", "ALUIS", "TBLUIS", "TBEVA", "TBPACO",
                      "TBFANT", "TBJUAN", "TBPEDR", "LUIS", "PACKAGE_NOT_VISIBLE", "GARDEN", "jardin", "NO_CALL",
                      "PHRSECRETO", "EXCSECRETA", "phr", "excepcion", "simultaneas"):
        assert prohibido not in texto, prohibido


# ── Nadie ve lo de otro ────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_cada_uno_ve_solo_lo_suyo(base):
    vistos = {sub: _paquetes(await server.mis_dnr(_conductor(sub))) for sub in
              ("d-ana", "d-luis", "d-eva", "d-mar", "d-paco", "d-sin", "d-pedro", "d-diez")}
    assert vistos["d-ana"] == {"TBAANA100", "TBAANA200", "TBAANA300", "TBAANA400", "TBAANA500", "TBAANAV00"}  # con la fusionada
    # Mar (viva) tiene en `driver_id` el ID que Luis (vivo) tiene en `transporter_id`: la oficina se lo da a Luis
    # (manda el `transporter_id`), y aquí igual. No es una disputa (R7/F11 afinado, S1): ninguno queda «en revisión».
    assert vistos["d-luis"] == {"TBLUIS100"}
    assert vistos["d-eva"] == {"TBEVA0100"}                    # por su `driver_id`, con espacios y en minúsculas
    assert vistos["d-mar"] == set()                          # su `driver_id` lo tiene Luis en `transporter_id`
    for sub in ("d-luis", "d-mar"):
        assert (await server.mis_dnr(_conductor(sub)))["en_revision"] is False, sub
    assert vistos["d-paco"] == {"TBPACO100"}                   # dos fichas con el mismo ID: manda la activa
    assert vistos["d-sin"] == set()                          # mismo nombre que el del historial: nunca por nombre
    assert vistos["d-pedro"] == {"TBPEDR100"}                  # el mismo correo que Juan no le da lo de Juan
    assert vistos["d-diez"] == {"TBRITA100"}
    # Y el ID sin ficha no lo ve nadie.
    assert not any("TBFANT100" in v for v in vistos.values())


@pytest.mark.asyncio(loop_scope="session")
async def test_el_mismo_correo_no_junta_a_dos_personas(base):
    """D1: la oficina dio de alta a Pedro con el buzón de Juan (de baja) eligiendo «es otra persona». Ninguno ve lo del
    otro, en los dos sentidos: Pedro solo lo suyo; con la ficha de Juan, 403 (está de baja) y nunca lo de Pedro. Lo que
    SÍ se suma es lo que la oficina fusionó en la ficha (Ana y su ficha vieja)."""
    assert _paquetes(await server.mis_dnr(_conductor("d-pedro"))) == {"TBPEDR100"}
    with pytest.raises(HTTPException) as e:
        await server.mis_dnr(_conductor("d-juan"))
    assert e.value.status_code == 403
    # Aunque Juan siguiera activo, el correo compartido no le daría lo de Pedro (ni a Pedro lo de Juan).
    base["drivers"].docs[[f["id"] for f in base["drivers"].docs].index("d-juan")]["active"] = True
    assert _paquetes(await server.mis_dnr(_conductor("d-juan"))) == {"TBJUAN100"}
    assert _paquetes(await server.mis_dnr(_conductor("d-pedro"))) == {"TBPEDR100"}
    assert "TBAANAV00" in _paquetes(await server.mis_dnr(_conductor("d-ana")))


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
    comparación, test_cada_uno_ve_solo_lo_suyo dice a mano qué tiene que ver cada uno.) Aquí no hay ninguna disputa
    (R7/F11 afinado, S1): Luis tiene su ID en `transporter_id` y Mar el mismo SOLO en `driver_id`; la oficina se lo da a
    Luis y Luis lo ve."""
    de_la_oficina = await _de_la_oficina()
    personas = {"d-ana": {"d-ana", "d-ana-vieja"}, "d-luis": {"d-luis"}, "d-eva": {"d-eva"}, "d-mar": {"d-mar"},
                "d-paco": {"d-paco"}, "d-sin": {"d-sin"}, "d-pedro": {"d-pedro"}, "d-diez": {"d-diez"}}
    await _como_la_oficina(de_la_oficina, personas)
    assert "TBLUIS100" in de_la_oficina.get("d-luis", set())
    # El ID sin ficha, la oficina lo enseña con el nombre del historial pero sin ficha (driver_id None).
    assert "TBFANT100" in de_la_oficina.get(None, set())


async def _de_la_oficina(centros=("OGA5", "DGA1", "DGA10")) -> dict:
    """{id de ficha (o None): paquetes} según la pantalla de la oficina, en las 4 semanas."""
    de_la_oficina: dict = {}
    for centro in centros:
        r = await server.diarios_por_conductor(centro, "2026-10-18", "2026-11-14", DANI)
        for c in r["conductores"]:
            for d in c["detalle"]:
                de_la_oficina.setdefault(c.get("driver_id"), set()).add(d["tracking_id"])
    return de_la_oficina


async def _como_la_oficina(de_la_oficina: dict, personas: dict, en_disputa=frozenset()):
    """Lo que ve cada persona es EXACTAMENTE lo que la oficina pone a su ficha y a las fusionadas, menos lo disputado."""
    for sub, fichas in personas.items():
        esperado = set().union(*(de_la_oficina.get(f, set()) for f in fichas)) - set(en_disputa)
        assert _paquetes(await server.mis_dnr(_conductor(sub))) == esperado, sub


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
    assert _paquetes(normal) == {"TBAANA100", "TBAANA200", "TBAANA300", "TBAANA400", "TBAANA500", "TBAANAV00"}


@pytest.mark.asyncio(loop_scope="session")
async def test_solo_para_conductores(base):
    with pytest.raises(HTTPException) as e:
        await server.mis_dnr(DANI)
    assert e.value.status_code == 403


# ── Un ID en dos personas (R7/F11, afinado el 11-11-2026, S1) ─────────────────────────────────────────────────
# SOLO hay disputa cuando la regla de la oficina no decide. Para un ID X, contando solo fichas VIVAS y tomando como
# UNA persona la ficha de la sesión con las fusionadas en ella: T = las que lo tienen en `transporter_id`, D = las que
# lo tienen SOLO en `driver_id`. T >= 2: disputa (a ninguna; «en revisión» las de T). T = 1: es suyo, como en la
# oficina, y las de D ni lo ven ni quedan en revisión. T vacío y D >= 2: disputa («en revisión» las de D). T vacío y
# D = 1: es suyo. Fuera de la disputa, lo que ve cada uno es EXACTAMENTE lo que le da la oficina.

def _ficha(fid, **mas):
    return {"id": fid, "name": fid.upper(), "email": f"{fid}@ejemplo.test", "center": "OGA5", "active": True, **mas}


@pytest.mark.asyncio(loop_scope="session")
async def test_con_el_id_en_el_transporter_id_de_una_sola_persona_es_suyo(base, monkeypatch):
    """T = 1. Otra persona viva tiene el ID de Ana SOLO en `driver_id`: la oficina se lo da a Ana (manda el
    `transporter_id`), y aquí igual; ninguna de las dos queda «en revisión». Y ya no se mira el «no coincide» de
    _amazon_nombres (F14/F15): aunque dijera algo, no se le llama (la oficina sí, y se compara al final)."""
    original = server._amazon_nombres

    async def no_se_llama(*a, **k):
        raise AssertionError("mis_dnr ya no usa _amazon_nombres")
    monkeypatch.setattr(server, "_amazon_nombres", no_se_llama)
    base["drivers"].docs.append(_ficha("d-copia", driver_id="aana000001"))
    r = await server.mis_dnr(_conductor("d-ana"))
    assert r["tiene_id"] is True and r["en_revision"] is False
    assert _paquetes(r) == {"TBAANA100", "TBAANA200", "TBAANA300", "TBAANA400", "TBAANA500", "TBAANAV00"}
    r = await server.mis_dnr(_conductor("d-copia"))
    assert r["en_revision"] is False and _paquetes(r) == set()
    monkeypatch.setattr(server, "_amazon_nombres", original)
    await _como_la_oficina(await _de_la_oficina(), {"d-ana": {"d-ana", "d-ana-vieja"}, "d-copia": {"d-copia"}})


@pytest.mark.asyncio(loop_scope="session")
async def test_dos_personas_con_el_mismo_transporter_id_es_una_disputa(base):
    """T >= 2. El empate que más se ve: el mismo `transporter_id` en dos fichas activas (antes lo decidía el orden).
    Las dos «en revisión» y sin esas DNR (Ana sigue viendo la de su ficha fusionada). Una tercera que lo tiene SOLO en
    `driver_id` tampoco lo ve, pero NO queda en revisión: no es de las que lo reclaman donde manda la oficina."""
    base["drivers"].docs += [_ficha("d-gemela", transporter_id="AANA000001"),
                             _ficha("d-tercera", driver_id="AANA000001")]
    disputadas = {"TBAANA100", "TBAANA200", "TBAANA300", "TBAANA400", "TBAANA500"}
    for sub in ("d-ana", "d-gemela"):
        r = await server.mis_dnr(_conductor(sub))
        assert r["en_revision"] is True, sub
        assert not (disputadas & _paquetes(r)), sub
    assert _paquetes(await server.mis_dnr(_conductor("d-ana"))) == {"TBAANAV00"}
    r = await server.mis_dnr(_conductor("d-tercera"))
    assert r["en_revision"] is False and _paquetes(r) == set()
    await _como_la_oficina(await _de_la_oficina(), {"d-ana": {"d-ana", "d-ana-vieja"}, "d-gemela": {"d-gemela"},
                                                   "d-tercera": {"d-tercera"}}, disputadas)


@pytest.mark.asyncio(loop_scope="session")
async def test_si_todos_sus_ids_estan_en_duda_no_ve_nada(base):
    """T >= 2 con todos sus IDs: Luis y otra ficha viva con su mismo `transporter_id`, los dos en revisión y sin
    ninguna DNR (pero con datos_hasta). Mar, que lo tiene SOLO en `driver_id`, ni lo ve ni queda en revisión."""
    base["drivers"].docs.append(_ficha("d-luis-dos", transporter_id="ALUIS00001"))
    for sub in ("d-luis", "d-luis-dos"):
        r = await server.mis_dnr(_conductor(sub))
        assert r["tiene_id"] is True and r["en_revision"] is True and r["semanas"] == [], sub
        assert "TBLUIS100" not in json.dumps(r)
    # datos_hasta, el de su centro (OGA5), como a cualquiera.
    assert (await server.mis_dnr(_conductor("d-luis")))["datos_hasta"] == "2026-11-10"
    r = await server.mis_dnr(_conductor("d-mar"))
    assert r["en_revision"] is False and _paquetes(r) == set()


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_transporter_id_y_dos_con_el_mismo_driver_id_es_una_disputa(base):
    """T vacío y D >= 2: nadie lo tiene en `transporter_id` y dos personas vivas en `driver_id`. Era el caso del
    hallazgo (ganaba la que Mongo devolviera primero): las dos en revisión y ninguna lo ve."""
    base["drivers"].docs.append(_ficha("d-eva-dos", center="DGA1", driver_id="AEVA000001"))
    for sub in ("d-eva", "d-eva-dos"):
        r = await server.mis_dnr(_conductor(sub))
        assert r["tiene_id"] is True and r["en_revision"] is True and r["semanas"] == [], sub
        assert r["datos_hasta"] == "2026-11-11", sub
        assert "TBEVA0100" not in json.dumps(r)


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_transporter_id_y_uno_solo_con_el_driver_id_es_suyo(base):
    """T vacío y D = 1: Eva, la única viva con ese `driver_id`, lo ve y no está en revisión."""
    r = await server.mis_dnr(_conductor("d-eva"))
    assert r["en_revision"] is False and _paquetes(r) == {"TBEVA0100"}


@pytest.mark.asyncio(loop_scope="session")
async def test_las_fichas_de_baja_no_disputan_y_se_queda_lo_que_hace_la_oficina(base):
    """Las de baja no cuentan para la disputa, pero lo que ve cada uno sigue siendo lo que da la oficina:
    · Una ficha de BAJA con el ID en `transporter_id` y una viva que lo tiene en `driver_id`: la oficina se lo da a la
      de baja y la viva no lo ve (se queda igual), sin quedar en revisión.
    · Si la de baja lo tiene en `driver_id`, en cambio, ya no se lo quita a la viva (tanda 3, S2, 11-11-2026: antes la
      oficina se quedaba con la primera leída, que era la de baja, y Eva dejaba de verlo): la oficina se lo da a Eva y
      Eva lo ve, sin quedar en revisión."""
    base["drivers"].docs += [_ficha("d-xavi-baja", active=False, transporter_id="AXAVI00001"),
                             _ficha("d-xavi", driver_id="AXAVI00001"),
                             _ficha("d-eva-baja", center="DGA1", active=False, driver_id="AEVA000001")]
    base["dnr_rows"].docs.append(_fila("TBXAVI100", "AXAVI00001", "2026-11-05", "Y"))
    oficina = await _de_la_oficina()
    assert "TBXAVI100" in oficina["d-xavi-baja"] and "TBEVA0100" in oficina["d-eva"]
    assert "TBEVA0100" not in oficina.get("d-eva-baja", set())
    r = await server.mis_dnr(_conductor("d-xavi"))
    assert r["en_revision"] is False and _paquetes(r) == set()
    r = await server.mis_dnr(_conductor("d-eva"))
    assert r["en_revision"] is False and _paquetes(r) == {"TBEVA0100"}
    await _como_la_oficina(oficina, {"d-xavi": {"d-xavi"}, "d-eva": {"d-eva"}, "d-ana": {"d-ana", "d-ana-vieja"},
                                     "d-luis": {"d-luis"}})


@pytest.mark.asyncio(loop_scope="session")
async def test_la_sesion_y_sus_fusionadas_son_una_sola_persona(base):
    """La ficha de la sesión con las fusionadas en ella cuenta como UNA persona viva. Ana tiene en `driver_id` el ID de
    su ficha fusionada (que lo tiene en `transporter_id`) y otra persona viva lo tiene en `driver_id`: para Ana, T es
    ella sola, así que es suyo (como en la oficina, que se lo da a su ficha fusionada) y no está en revisión.
    Y si otra persona viva lo tiene en `transporter_id`, son dos en T: disputa, y Ana en revisión."""
    base["drivers"].docs[0]["driver_id"] = "AANAVIEJA1"
    base["drivers"].docs.append(_ficha("d-otra", driver_id="AANAVIEJA1"))
    r = await server.mis_dnr(_conductor("d-ana"))
    assert r["en_revision"] is False and "TBAANAV00" in _paquetes(r)
    assert _paquetes(await server.mis_dnr(_conductor("d-otra"))) == set()
    base["drivers"].docs[-1] = _ficha("d-otra", transporter_id="AANAVIEJA1")
    r = await server.mis_dnr(_conductor("d-ana"))
    assert r["en_revision"] is True and "TBAANAV00" not in _paquetes(r) and "TBAANA100" in _paquetes(r)
    # R8/G2: y desde el OTRO lado, lo mismo. La ficha vieja de Ana (fusionada, ya no viva) cuenta como Ana para todos,
    # no solo para la sesión de Ana: d-otra también está en revisión y tampoco ve la DNR de ese ID. Antes d-otra la
    # veía (la oficina se la da a ella: la activa pisa a la de baja) y el servidor se contradecía.
    r = await server.mis_dnr(_conductor("d-otra"))
    assert r["en_revision"] is True and "TBAANAV00" not in _paquetes(r)
    assert r == {"tiene_id": True, "en_revision": True, "datos_hasta": "2026-11-10", "semanas": []}


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
    # R8/G10: un 404 PROPIO («Sin DNR diaria»), no el genérico de una ruta que no existe («Not Found»): la web solo
    # recuerda 12 horas este, y no el de un servidor que aún no tiene la ruta.
    assert e.value.status_code == 404 and e.value.detail == "Sin DNR diaria"
    # Ni siquiera a quien no es conductor se le dice otra cosa.
    with pytest.raises(HTTPException) as e:
        await server.mis_dnr({**DANI, "org_id": "o2"})
    assert e.value.status_code == 404 and e.value.detail == "Sin DNR diaria"
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
    assert e.value.status_code == 404 and e.value.detail == "Sin DNR diaria"          # R8/G10
    # A quien no es conductor se le sigue diciendo lo de siempre (el rol va antes).
    with pytest.raises(HTTPException) as e:
        await server.mis_dnr(DANI)
    assert e.value.status_code == 403
    # Un pegado de solo el bloque DNR (sin el resumen) guarda filas pero ningún documento en daily_reports: eso
    # también es un reporte subido, y sus DNR se ven.
    base["dnr_rows"].docs = [_fila("TBAANA100", "AANA000001", "2026-11-09", "Y")]
    assert _paquetes(await server.mis_dnr(_conductor("d-ana"))) == {"TBAANA100"}
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
async def test_una_empresa_solo_con_filas_pegadas_tambien_dice_hasta_cuando(base):
    """S2 (11-11-2026): un pegado de solo el bloque DNR guarda filas en `dnr_rows` y NINGÚN documento en
    `daily_reports`. datos_hasta tiene que mirar también esas filas (su `fecha_concesion`), o el conductor leería «Aún
    no hay reportes de tu centro» habiéndolos. Los centros, casados por código exacto, como con los reportes."""
    base["daily_reports"].docs = []
    base["dnr_rows"].docs.append(_fila("TBOTRO100", "AFANTASMA1", "2026-11-11", "", center="DGA1"))
    base["drivers"].docs += [
        {"id": "d-nada", "name": "NADA DE CENTRO", "email": "nada@ejemplo.test", "active": True,
         "transporter_id": "ANADA00001"},
        {"id": "d-oga5", "name": "SIN FILAS EN OGA5", "email": "oga5@ejemplo.test", "center": "AMZL OGA5 XPT",
         "active": True, "transporter_id": "AOGA500001"},
    ]
    assert (await server.mis_dnr(_conductor("d-ana")))["datos_hasta"] == "2026-11-10"     # su centro, OGA5
    assert (await server.mis_dnr(_conductor("d-oga5")))["datos_hasta"] == "2026-11-10"    # sin filas suyas: su ficha
    assert (await server.mis_dnr(_conductor("d-diez")))["datos_hasta"] == "2026-11-04"    # DGA10, no DGA1
    assert (await server.mis_dnr(_conductor("d-nada")))["datos_hasta"] == "2026-11-11"    # toda la empresa
    # Con las dos cosas, el mayor de los dos: el reporte de OGA5 llega al 09 y las filas pegadas, al 10.
    base["daily_reports"].docs = [{"center": "OGA5", "fecha": "2026-11-11", "fecha_dnr": "2026-11-09"}]
    assert (await server.mis_dnr(_conductor("d-oga5")))["datos_hasta"] == "2026-11-10"
    # Y al revés: el reporte de DGA10 va por delante de sus filas.
    base["daily_reports"].docs.append({"center": "DGA10", "fecha": "2026-11-09", "fecha_dnr": "2026-11-07"})
    assert (await server.mis_dnr(_conductor("d-diez")))["datos_hasta"] == "2026-11-07"


@pytest.mark.asyncio(loop_scope="session")
async def test_ninguna_consulta_lee_sin_tope(base):
    """D7 y R7/F14: cada consulta de la ruta lleva su tope (limit o to_list(n)), mirando TODAS las colecciones que toca:
    las de las fichas, las filas, la foto, el contacto, los reportes y la empresa. Lo que no es un cursor: find_one (uno),
    y un único distinct por colección, el de los centros de daily_reports y el de dnr_rows (tantos como centros, con su
    índice (center, fecha): S2). Y ya no toca las colecciones heredadas del «no coincide» (cortex_resumen, route_history,
    whc_api, app_meta), que leía sin tope. Por cada camino: lo normal, una ficha sin centro (el último de la empresa) y
    todos sus IDs en disputa."""
    base["drivers"].docs += [
        {"id": "d-nada", "name": "NADA DE CENTRO", "email": "nada@ejemplo.test", "active": True,
         "transporter_id": "ANADA00001"},
        {"id": "d-luis-dos", "name": "OTRO LUIS", "email": "luis2@ejemplo.test", "center": "OGA5", "active": True,
         "transporter_id": "ALUIS00001"},
    ]
    for sub in ("d-ana", "d-nada", "d-luis"):
        for col in list(base.values()) + [server.global_db["organizations"]]:
            col.cursores.clear()
            col.otras.clear()
        await server.mis_dnr(_conductor(sub))
        tocadas = {nombre: col for nombre, col in list(base.items()) if col.cursores or col.otras}
        assert set(tocadas) <= {"drivers", "dnr_rows", "pod_rows", "cc_rows", "daily_reports"}, (sub, set(tocadas))
        for nombre, col in tocadas.items():
            assert all(c.con_tope for c in col.cursores), (sub, nombre)
            assert not [o for o in col.otras if o not in ("find_one", "distinct:center")], (sub, nombre, col.otras)
        for nombre in ("daily_reports", "dnr_rows"):
            assert base[nombre].otras.count("distinct:center") <= 1, (sub, nombre)
        for heredada in ("cortex_resumen", "route_history", "whc_api", "app_meta"):
            assert not base[heredada].cursores and not base[heredada].otras, (sub, heredada)
        # La empresa (la base global): solo find_one.
        org = server.global_db["organizations"]
        assert not org.cursores and set(org.otras) <= {"find_one"}, sub


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
    # Llamó 12 s: eso se dice, y es menos de los 30 que pide Dani: «corta» y fallo de contacto (R9, 11-11-2026).
    assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == ("corta", 12, True)
    assert (r["foto"], r["foto_motivo"]) == ("mal", "borrosa")

    # A menos de 25 m; sin filas de foto ni de contacto: de eso no se sabe nada (null, no «bien»).
    r = e({"mas_25m": "No", "scan": "DELIVERED_TO_MAIL_SLOT"}, [], [])
    assert (r["como"], r["lejos"], r["llamada"], r["segundos"], r["fallo_contacto"], r["foto"]) == (
        "buzon", False, None, None, None, None)

    # Un «1» en «≥ 25 m» no se traduce (como con la DSC), un escaneo raro tampoco: null.
    r = e({"mas_25m": "1", "scan": "DELIVERED_TO_MOON"}, [], [])
    assert (r["como"], r["lejos"]) == (None, None)

    # «No llamaste» por el tipo solo si lo dice con todas las letras y la fila no trae ningún segundo.
    assert e({}, [], [{"tipo": "NO_CALL", "segundos": ""}])["llamada"] == "no"
    # Con segundos manda lo medido: 9 s es una llamada, corta (R9). El 0 no es una medida (retoque de R12, 11-11-2026):
    # con NO_CALL y 0 s, «no», como sin segundos.
    assert e({}, [], [{"tipo": "NO_CALL", "segundos": 9}])["llamada"] == "corta"
    assert e({}, [], [{"tipo": "NO_CALL", "segundos": 0}])["llamada"] == "no"
    # Una fila de la tabla de fallos de contacto es fallo diga lo que diga el tipo; con un mensaje y 0 s, de la llamada
    # no se afirma nada (ni «0 s»).
    con_cero = e({}, [], [{"tipo": "SMS", "segundos": 0}])
    assert (con_cero["llamada"], con_cero["segundos"], con_cero["fallo_contacto"]) == (None, None, True)

    assert e({}, [{"fallo": "PASS"}], [])["foto"] == "bien"
    assert e({}, [{"fallo": ""}, {"fallo": "-"}], [])["foto"] is None
    assert e({}, [{"fallo": "PACKAGE_NOT_CLEARLY_VISIBLE"}], [])["foto_motivo"] == "sin_paquete"

    # Sin escaneo en la fila, vale el de su fila de foto o de contacto si es uno conocido.
    assert e({"scan": ""}, [], [{"motivo": "DELIVERED_TO_NEIGHBOR", "segundos": 0}])["como"] == "vecino"


def test_la_foto_mal_con_cualquier_fallo_y_el_motivo_solo_si_se_conoce():
    """R7/F7 decía: «mal» solo con un motivo que se reconoce, y lo demás null. R12 (11-11-2026, con un reporte real): la
    tabla de «POD Audit» es la de los FALLOS de foto, así que cualquier valor que no sea PASS/PASSED es «mal»; el motivo,
    solo si se reconoce (si no, «mal» SIN motivo)."""
    e = server._dnr_entrega
    for raro in ("N", "Y", "PENDING", "WEIRD_AUDIT", "OK", "Accepted"):
        r = e({}, [{"fallo": raro}], [])
        assert (r["foto"], r["foto_motivo"]) == ("mal", None), raro
    assert (e({}, [{"fallo": "BLURRY"}], [])["foto"], e({}, [{"fallo": "TOO_DARK"}], [])["foto_motivo"]) == (
        "mal", "oscura")
    # «bien» solo si TODO lo que dice es PASS/PASSED; con un fallo al lado, «mal».
    assert e({}, [{"fallo": "PASSED"}, {"fallo": "PASS"}], [])["foto"] == "bien"
    assert (e({}, [{"fallo": "PASS"}, {"fallo": "PENDING"}], [])["foto"],
            e({}, [{"fallo": "PASS"}, {"fallo": "PENDING"}], [])["foto_motivo"]) == ("mal", None)
    # Un motivo conocido manda aunque haya otras filas.
    r = e({}, [{"fallo": "PASS"}, {"fallo": "NO_PHOTO"}], [])
    assert (r["foto"], r["foto_motivo"]) == ("mal", "sin_foto")


def test_el_fallo_de_contacto_si_esta_en_la_tabla_o_contact_compliance_es_n():
    """R7/F7 decía que estar en la tabla de contacto no bastaba (no se había visto nunca un reporte real). R12
    (11-11-2026): en el reporte real esa tabla es la de los FALLOS de contacto (sus filas suman «CC Fails»), así que
    estar en ella ES el fallo, diga lo que diga el tipo y aunque la llamada llegue a 30 s."""
    e = server._dnr_entrega
    for tipo, segundos in (("CALL", 30), ("SMS", 0), ("Y", 0), ("", 0), ("CONTACTED", 30), ("CALL", 1800),
                           ("Calls to Customer", 0)):
        assert e({}, [], [{"tipo": tipo, "segundos": segundos}])["fallo_contacto"] is True, (tipo, segundos)
    # Los NO_CALL… puestos a ojo siguen diciendo «no» cuando la fila no trae ningún segundo.
    for tipo in ("NO_CALL", "no call made", "CALL_NOT_MADE", "NOT_CALLED"):
        r = e({}, [], [{"tipo": tipo, "segundos": ""}])
        assert (r["llamada"], r["fallo_contacto"]) == ("no", True), tipo
    # Sin fila, «Contact Compliance» N también es fallo; Y no.
    assert (e({"contacto": "N"}, [], [])["fallo_contacto"], e({"contacto": "Y"}, [], [])["fallo_contacto"]) == (
        True, None)
    # Dice NO_CALL pero hay 9 s medidos: manda lo medido, y es corta (R9).
    assert e({}, [], [{"tipo": "NO_CALL", "segundos": 9}])["fallo_contacto"] is True
    # Sin fila de contacto, no se sabe (nunca false).
    assert e({}, [], [])["fallo_contacto"] is None


def test_la_llamada_minimo_30_segundos():
    """R9 (Dani, 11-11-2026): «dando tono no podemos colgar nosotros la llamada y mínimo deben ser 30 segundos».
    Menos de 30 s medidos es «corta»; 30 o más, «si». Desde R12 (11-11-2026) cualquier fila de la tabla de contacto es
    fallo de contacto (es la tabla de los fallos), también con 30 s o más. El 0 no es una medida (retoque de R12): una
    fila de tipo llamada con 0 s es «corta» SIN cifra."""
    e = server._dnr_entrega
    assert server._DNR_SEGUNDOS_MIN_LLAMADA == 30
    for segundos, llamada in ((1, "corta"), (29, "corta"), ("29.9", "corta"),
                              (30, "si"), (31, "si"), (1800, "si")):
        r = e({}, [], [{"tipo": "CALL", "segundos": segundos}])
        assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == (llamada, int(float(segundos)), True), segundos
    r = e({}, [], [{"tipo": "CALL", "segundos": 0}])
    assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == ("corta", None, True)
    # NO_CALL con 0 s o sin ningún segundo: «no», sin cifra.
    for vacio in (0, "0", "", None, "-"):
        r = e({}, [], [{"tipo": "NO_CALL", "segundos": vacio}])
        assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == ("no", None, True), vacio
    # NO_CALL con 12 s: los datos se contradicen y manda lo medido.
    r = e({}, [], [{"tipo": "NO_CALL", "segundos": 12}])
    assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == ("corta", 12, True)
    # Dos filas: vale la llamada más larga (si una llega a 30, no es corta; el fallo sigue: está en la tabla).
    r = e({}, [], [{"tipo": "CALL", "segundos": 12}, {"tipo": "CALL", "segundos": 45}])
    assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == ("si", 45, True)
    # Sin fila de contacto (ni «Contact Compliance»): todo null.
    r = e({}, [], [])
    assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == (None, None, None)
    # Segundos raros (retoque de R12): no son una medida y manda el tipo; con NO_CALL, «no» sin cifra. El fallo, sí.
    r = e({}, [], [{"tipo": "NO_CALL", "segundos": 600123456}])
    assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == ("no", None, True)


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
    # Desde R12 (11-11-2026) estar en la tabla de fallos de foto y en la de contacto ya dice algo (fallo de foto sin
    # motivo y fallo de contacto), pero nada del texto libre; lo demás, null (un tipo que no se reconoce con 0 s no dice
    # nada de la llamada).
    assert {k: v for k, v in r.items() if v is not None} == {"fallo_contacto": True, "foto": "mal"}


@pytest.mark.asyncio(loop_scope="session")
async def test_lo_que_no_se_entiende_no_sale_ni_en_la_respuesta_ni_en_el_log(base, caplog):
    base["dnr_rows"].docs.append(_fila("TBAANA900", "AANA000001", "2026-11-09", "Y", scan="Maria Lopez",
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
    base["dnr_rows"].docs = [d for d in base["dnr_rows"].docs if d["tracking_id"] not in ("TBAANA100", "TBAANA300")]
    base["dnr_rows"].docs += [_fila("TBAANA100", "AANA000001", "2026-11-09", "Y", fecha_entrega="2026-11-07"),
                              _fila("TBAANA300", "AANA000001", "2026-11-10", "N", fecha_entrega="07/11/2026")]
    r = await server.mis_dnr(_conductor("d-ana"))
    assert (_dnr(r, "TBAANA100")["dia"], _dnr(r, "TBAANA100")["entrega"]) == ("2026-11-09", "2026-11-07")
    assert _dnr(r, "TBAANA300")["entrega"] is None
    assert _dnr(r, "TBAANA200")["entrega"] == "2026-11-03"        # el mismo día que la DNR
    # La semana y el orden siguen yendo por el día de la DNR.
    assert [x["paquete"] for x in r["semanas"][0]["dnr"]] == ["TBAANA300", "TBAANA100"]


@pytest.mark.asyncio(loop_scope="session")
async def test_una_n_de_mas_de_7_dias_ya_no_cuenta_aunque_su_centro_no_tenga_ninguna_y(base):
    """R7/F12: Amazon rellena la DSC con 2 a 4 días de retraso; una N de hace más de 7 días ya está decidida, aunque
    ese día nadie de su centro tuviera una Y. A los 7 justos, todavía «sin clasificar». Sin DSC, sigue sin clasificar.
    (R8/G4: las dos filas se volvieron a pegar 6 días después de su día, cuando Amazon ya debía haberlas clasificado;
    si no, se quedan sin clasificar: test_la_n_que_nunca_se_volvio_a_pegar_sigue_sin_clasificar.)"""
    base["dnr_rows"].docs.append(_fila("TBPACO200", "APACO00001", "2026-11-03", "N", center="DGA1",   # 8 días
                                       actualizado="2026-11-09T10:00:00+00:00"))
    base["dnr_rows"].docs[[f["tracking_id"] for f in base["dnr_rows"].docs].index("TBPACO100")]["actualizado"] = (
        "2026-11-10T10:00:00+00:00")
    r = await server.mis_dnr(_conductor("d-paco"))
    estado = {x["paquete"]: x["estado"] for s in r["semanas"] for x in s["dnr"]}
    assert estado == {"TBPACO100": "sin_clasificar", "TBPACO200": "no_cuenta"}   # TBPACO100: el 04-11, 7 días
    assert r["semanas"][1]["no_cuentan"] == 1 and r["semanas"][1]["sin_clasificar"] == 1
    # Ana: la de hace 22 días sin DSC sigue «sin clasificar».
    assert _dnr(await server.mis_dnr(_conductor("d-ana")), "TBAANA400")["estado"] == "sin_clasificar"
    assert server._DNR_DIAS_PARA_DAR_POR_CLASIFICADA == 7


@pytest.mark.asyncio(loop_scope="session")
async def test_ana_ve_como_fue_cada_entrega_y_nada_de_las_filas_de_otro(base):
    r = await server.mis_dnr(_conductor("d-ana"))
    a1 = _dnr(r, "TBAANA100")
    assert (a1["cp"], a1["como"], a1["lejos"]) == ("15704", "puerta", True)
    # 12 s es menos de los 30 de Dani: llamada corta y fallo de contacto (R9).
    assert (a1["llamada"], a1["segundos"], a1["fallo_contacto"]) == ("corta", 12, True)
    assert (a1["foto"], a1["foto_motivo"]) == ("mal", "borrosa")
    # TBAANA200 comparte paquete con una fila de foto y otra de contacto de LUIS (con NO_CALL y un motivo de foto
    # conocido): no son de Ana y no cuentan.
    a2 = _dnr(r, "TBAANA200")
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
    otra["dnr_rows"] = _Col([_fila("TBOTRA100", "AANA000001", "2026-11-09", "Y", center="MAD1")])
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
    assert _paquetes(r.json()) == {"TBAANA100", "TBAANA200", "TBAANA300", "TBAANA400", "TBAANA500", "TBAANAV00"}
    r = _pedir(c, _token("d-ana", org="o3", db_name="dsp_o3"))
    assert r.status_code == 200 and _paquetes(r.json()) == {"TBOTRA100"}
    assert r.json()["datos_hasta"] == "2026-11-09"
    # Pedro, por su token, solo lo suyo (el mismo correo que Juan no le da lo de Juan).
    assert _paquetes(_pedir(c, _token("d-pedro")).json()) == {"TBPEDR100"}


def test_por_la_sesion_de_baja_sin_otra_ficha_activa_403(dos_empresas):
    """La ficha de baja de Paco no tiene otra activa con su correo (la activa tiene otro): get_current_user no la
    lleva a ninguna y la ruta contesta 403, aunque el token siga vivo."""
    assert _pedir(dos_empresas, _token("d-paco-baja")).status_code == 403


def test_por_la_sesion_la_ficha_fusionada_lleva_a_la_buena(dos_empresas):
    """El token de la ficha vieja de Ana (fusionada en la buena, mismo correo) lo lleva get_current_user a la ficha
    buena: ve lo de Ana, que es suyo."""
    r = _pedir(dos_empresas, _token("d-ana-vieja"))
    assert r.status_code == 200 and "TBAANA100" in _paquetes(r.json())


def test_por_la_sesion_el_token_de_juan_no_ve_lo_de_pedro(dos_empresas):
    """R7/F1. get_current_user lleva el token de Juan (ficha de baja) a la ficha ACTIVA del mismo correo, la de Pedro,
    aunque la oficina diera de alta a Pedro como «otra persona». ESTA ruta vuelve a leer el `sub` original del token:
    no es la ficha de la sesión ni una fusionada en ella, así que 403 «Tu ficha está de baja».
    OJO: el RESTO DEL PORTAL sigue con ese agujero (Juan ve los turnos, la furgoneta… de Pedro): viene de antes, es de
    get_current_user/_ficha_activa_de y se arregla aparte. Aquí solo se cierra para las DNR."""
    c = dos_empresas
    r = _pedir(c, _token("d-juan"))
    assert r.status_code == 403 and r.json()["detail"] == "Tu ficha está de baja"
    assert "TBPEDR100" not in r.text
    # El de Pedro, el suyo, sigue funcionando.
    r = _pedir(c, _token("d-pedro"))
    assert r.status_code == 200 and _paquetes(r.json()) == {"TBPEDR100"}


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
    assert r.status_code == 200 and _paquetes(r.json()) == {"TBEVA0100"}


def test_por_la_sesion_caducado_401_y_sin_token_401(dos_empresas):
    assert _pedir(dos_empresas, _token("d-ana", horas=-1)).status_code == 401
    assert dos_empresas.get("/api/diarios/mias").status_code == 401


def test_por_la_sesion_la_demo_de_reparto_no_la_tiene(dos_empresas):
    """La demo de reparto no tiene la DNR diaria: como si la ruta no existiera."""
    t = server.create_token("demo-r1", "driver", "Repartidor 1", org_id=server._DEMO_REP_ORG_ID,
                            db_name=server._DEMO_REP_DB, account_type="dsp", demo=True)
    r = _pedir(dos_empresas, t)
    # R8/G10: por HTTP llega tal cual, con su `detail` propio (la web lo distingue del «Not Found» de una ruta que no
    # existe todavía en el servidor).
    assert r.status_code == 404 and r.json() == {"detail": "Sin DNR diaria"}


# ── R8 (11-11-2026): lo de la comprobación de las correcciones (G1, G2, G4, G11) ─────────────────────────────────

EN_REVISION_SIN_NADA = {"tiene_id": True, "en_revision": True, "datos_hasta": "2026-11-10", "semanas": []}


@pytest.mark.asyncio(loop_scope="session")
async def test_si_las_fichas_llegan_al_tope_no_se_casa_nada(base, monkeypatch, caplog):
    """G1: las fichas se leen con tope y ordenadas por `active` ascendente (como la oficina, para que la activa pise),
    así que lo primero que corta el tope son las ACTIVAS. Pedro (activo) tiene APEDRO0001 en `transporter_id`; Dora
    (viva) lo tiene en `driver_id`. Con el tope en 3, la lectura se queda con las 3 de baja y Pedro no entra: sin el
    arreglo, Dora veía la DNR de Pedro. Ahora, si cualquiera de las dos lecturas llega al tope, no se casa nada: en
    revisión y sin semanas, para todos los que tienen un ID. Quien no tiene ningún ID sigue como siempre (vacío: decirle
    que su ID está en revisión sería falso). Y una línea en el log sin datos de nadie."""
    base["drivers"].docs.append(_ficha("d-dora", driver_id="APEDRO0001"))
    monkeypatch.setattr(server, "_DNR_TOPE_FICHAS", 3)
    with caplog.at_level("INFO"):
        for sub in ("d-dora", "d-pedro", "d-ana"):
            r = await server.mis_dnr(_conductor(sub))
            assert r == EN_REVISION_SIN_NADA, sub
            assert "TBPEDR100" not in json.dumps(r), sub
        assert await server.mis_dnr(_conductor("d-sin")) == {
            "tiene_id": False, "en_revision": False, "datos_hasta": None, "semanas": []}
    avisos = [x.getMessage() for x in caplog.records if "tope" in x.getMessage()]
    assert avisos, caplog.text
    for dato in ("d-dora", "d-pedro", "d-ana", "DORA", "PEDRO", "ANA", "APEDRO", "AANA", "ejemplo.test", "OGA5"):
        assert dato not in caplog.text, dato
    # Con el tope por encima de las que hay, todo como siempre.
    monkeypatch.setattr(server, "_DNR_TOPE_FICHAS", 50)
    assert _paquetes(await server.mis_dnr(_conductor("d-pedro"))) == {"TBPEDR100"}
    assert _paquetes(await server.mis_dnr(_conductor("d-dora"))) == set()


@pytest.mark.asyncio(loop_scope="session")
async def test_tambien_si_el_tope_lo_alcanza_la_lectura_de_driver_id(base, monkeypatch):
    """G1, la otra lectura: las de `transporter_id` (8) caben, pero las de `driver_id` no. Tampoco se casa nada."""
    base["drivers"].docs += [_ficha(f"d-relleno{i}", driver_id=f"ARELLENO{i:02d}") for i in range(9)]
    monkeypatch.setattr(server, "_DNR_TOPE_FICHAS", 9)
    assert await server.mis_dnr(_conductor("d-ana")) == EN_REVISION_SIN_NADA
    assert (await server.mis_dnr(_conductor("d-eva")))["semanas"] == []


@pytest.mark.asyncio(loop_scope="session")
async def test_la_disputa_con_una_ficha_fusionada_sale_igual_desde_los_dos_lados(base):
    """G2: una ficha no viva con `merged_into` cuenta como la persona en la que acaba su cadena de fusiones, para TODOS.
    · Cadena de dos: la ficha «muy vieja» de Ana se fusionó en la vieja, y la vieja en la buena. Otra persona viva tiene
      su ID en `transporter_id`: las dos en revisión y ninguna lo ve (sin el arreglo, la otra lo veía).
    · Cadena que sale de lo leído: la ficha buena de Fede no tiene ningún ID (no entra en la lectura); la vieja,
      fusionada en ella, sí. La persona es la última ficha a la que se llega (Fede): disputa para los dos."""
    base["drivers"].docs += [
        _ficha("d-ana-muy-vieja", active=False, status="fusionada", merged_into="d-ana-vieja",
               transporter_id="AANAMUY001"),
        _ficha("d-otra2", transporter_id="AANAMUY001"),
        _ficha("d-fede"),
        _ficha("d-fede-viejo", active=False, merged_into="d-fede", transporter_id="AFEDE00001"),
        _ficha("d-x", transporter_id="AFEDE00001"),
    ]
    base["dnr_rows"].docs += [_fila("TBAMUY001", "AANAMUY001", "2026-11-05", "Y"),
                              _fila("TBFEDE001", "AFEDE00001", "2026-11-05", "Y")]
    for sub, suya in (("d-ana", "TBAMUY001"), ("d-otra2", "TBAMUY001"), ("d-fede", "TBFEDE001"), ("d-x", "TBFEDE001")):
        r = await server.mis_dnr(_conductor(sub))
        assert r["en_revision"] is True and suya not in _paquetes(r), sub
    # Ana sigue viendo lo suyo que no está en disputa (la de su ficha vieja, con otro ID).
    assert {"TBAANA100", "TBAANAV00"} <= _paquetes(await server.mis_dnr(_conductor("d-ana")))


@pytest.mark.asyncio(loop_scope="session")
async def test_la_disputa_con_una_fusionada_por_driver_id_sale_desde_los_dos_lados(base):
    """G2 por la OTRA lectura de fichas, la de `driver_id` (R10/H3, 11-11-2026): la ficha vieja de Gil, fusionada en la
    buena (que no tiene ningún ID), tiene el ID solo en `driver_id`, y otra persona viva también. Nadie lo tiene en
    `transporter_id`: son dos personas en D, disputa, y las dos en revisión. Con el doble que respeta las proyecciones,
    quitar `merged_into` de esa lectura hace fallar esta prueba (d-z dejaría de estar en revisión)."""
    base["drivers"].docs += [
        _ficha("d-gil"),
        _ficha("d-gil-vieja", active=False, status="fusionada", merged_into="d-gil", driver_id="AGIL000001"),
        _ficha("d-z", driver_id="AGIL000001"),
    ]
    base["dnr_rows"].docs.append(_fila("TBGIL0001", "AGIL000001", "2026-11-05", "Y"))
    for sub in ("d-gil", "d-z"):
        r = await server.mis_dnr(_conductor(sub))
        assert r["en_revision"] is True and "TBGIL0001" not in _paquetes(r), sub


@pytest.mark.asyncio(loop_scope="session")
async def test_una_fusionada_en_una_ficha_de_baja_no_disputa(base):
    """G2, el otro extremo: si la cadena acaba en una ficha de BAJA (no fusionada), esa persona ya no está, y como
    cualquier ficha de baja no disputa. Lo ve la viva, como en la oficina (la activa pisa a las de baja)."""
    base["drivers"].docs += [
        _ficha("d-bea", active=False, transporter_id="ABEA000001"),
        _ficha("d-bea-vieja", active=False, merged_into="d-bea", transporter_id="ABEA000002"),
        _ficha("d-y", transporter_id="ABEA000002"),
    ]
    base["dnr_rows"].docs.append(_fila("TBBEA0002", "ABEA000002", "2026-11-05", "Y"))
    r = await server.mis_dnr(_conductor("d-y"))
    assert r["en_revision"] is False and _paquetes(r) == {"TBBEA0002"}
    await _como_la_oficina(await _de_la_oficina(), {"d-y": {"d-y"}})


@pytest.mark.asyncio(loop_scope="session")
async def test_una_ficha_de_baja_con_el_id_en_transporter_id_no_deja_a_nadie_en_revision(base):
    """R8: si una ficha de BAJA (no fusionada) tiene el ID en `transporter_id`, la oficina se lo da a ella y ninguna viva
    lo ve. Aunque dos vivas lo tengan en `driver_id`, eso NO es una disputa: ninguna queda «en revisión» (antes, las
    dos). Y ninguna lo ve, como en la oficina."""
    base["drivers"].docs += [_ficha("d-xavi-baja", active=False, transporter_id="AXAVI00001"),
                             _ficha("d-xavi", driver_id="AXAVI00001"),
                             _ficha("d-xavi-dos", driver_id="axavi00001 ")]
    base["dnr_rows"].docs.append(_fila("TBXAVI100", "AXAVI00001", "2026-11-05", "Y"))
    oficina = await _de_la_oficina()
    assert "TBXAVI100" in oficina["d-xavi-baja"]
    for sub in ("d-xavi", "d-xavi-dos"):
        r = await server.mis_dnr(_conductor(sub))
        assert r["en_revision"] is False and _paquetes(r) == set(), sub
    await _como_la_oficina(oficina, {"d-xavi": {"d-xavi"}, "d-xavi-dos": {"d-xavi-dos"}})


@pytest.mark.asyncio(loop_scope="session")
async def test_la_n_que_nunca_se_volvio_a_pegar_sigue_sin_clasificar(base):
    """G4: la regla de los 7 días solo vale si la fila se guardó cuando Amazon ya debía haberla clasificado (su
    `actualizado` es de al menos 5 días después de su día). Un bloque pegado al día siguiente llega todo a N: si la
    oficina no lo vuelve a pegar, esa N no dice nada, y decirle «no te cuenta» sería afirmar lo contrario de lo que
    puede ser verdad. (DGA1 no tiene ninguna Y esos días: solo cuenta la regla de los 7 días.)"""
    base["dnr_rows"].docs += [
        _fila("TBPACO300", "APACO00001", "2026-10-19", "N", center="DGA1", actualizado="2026-10-20T07:00:00+00:00"),
        _fila("TBPACO400", "APACO00001", "2026-10-20", "N", center="DGA1", actualizado="2026-10-26T07:00:00+00:00"),
        _fila("TBPACO500", "APACO00001", "2026-10-21", "N", center="DGA1", actualizado="2026-10-26T23:59:00+00:00"),
        _fila("TBPACO600", "APACO00001", "2026-10-22", "N", center="DGA1", actualizado="2026-10-26T07:00:00+00:00"),
        _fila("TBPACO700", "APACO00001", "2026-10-23", "N", center="DGA1"),                 # sin `actualizado`
    ]
    r = await server.mis_dnr(_conductor("d-paco"))
    estado = {x["paquete"]: x["estado"] for s in r["semanas"] for x in s["dnr"]}
    assert estado["TBPACO300"] == "sin_clasificar"      # pegada al día siguiente y nunca más: a los 23 días, igual
    assert estado["TBPACO400"] == "no_cuenta"           # vuelta a pegar a los 6 días
    assert estado["TBPACO500"] == "no_cuenta"           # a los 5 justos
    assert estado["TBPACO600"] == "sin_clasificar"      # a los 4: aún podía no estar
    assert estado["TBPACO700"] == "sin_clasificar"      # sin saber cuándo se guardó
    assert server._DNR_DIAS_PARA_DAR_POR_REPEGADA == 5


def test_los_segundos_de_llamada_solo_entre_1_y_1800():
    """G11: un teléfono en la celda de los segundos («600123456») salía como «Llamaste al cliente (600123456 s)».
    Ahora, entero entre 1 y 1800 (el 0 no se manda: retoque de R12, 11-11-2026); fuera de eso, null, y entonces
    `llamada` no es «si» por los segundos: manda el tipo (con CALL, «corta» sin cifra)."""
    e = server._dnr_entrega
    for raro in (600123456, "600123456", 1801, -5, "600 123456x", 0, "0"):
        r = e({}, [], [{"tipo": "CALL", "segundos": raro}])
        assert (r["llamada"], r["segundos"]) == ("corta", None), raro
        assert server._dnr_segundos(raro)[0] is None, raro
    # Por debajo de 30 s la llamada es «corta» (R9); los segundos salen igual.
    for bueno, s, llamada in ((1, 1, "corta"), (1800, 1800, "si"), ("12", 12, "corta"), ("12.7", 12, "corta"),
                              ("30", 30, "si")):
        r = e({}, [], [{"tipo": "CALL", "segundos": bueno}])
        assert (r["llamada"], r["segundos"]) == (llamada, s), bueno
    r = e({}, [], [{"tipo": "NO_CALL", "segundos": 600123456}])
    assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == ("no", None, True)     # R12: la fila es el fallo
    # Una fila con segundos buenos y otra con un teléfono: los buenos.
    r = e({}, [], [{"tipo": "CALL", "segundos": 12}, {"tipo": "CALL", "segundos": 600123456}])
    assert (r["llamada"], r["segundos"]) == ("corta", 12)
    # Con NO_CALL, ni el 0 ni la celda vacía son una medida: «no», sin cifra.
    for vacio in (0, ""):
        r = e({}, [], [{"tipo": "NO_CALL", "segundos": vacio}])
        assert (r["llamada"], r["segundos"]) == ("no", None), vacio


def test_un_movil_no_es_un_codigo_postal():
    """G11: además de lo de R7, como mucho 8 caracteres sin contar el espacio o el guion y nunca más de 6 cifras
    seguidas (un móvil de 9 cifras no es un código postal)."""
    e = server._dnr_entrega
    for malo in ("600123456", "600 123456", "600-123456", "1234567", "AB12345678", "ABCDE 12345"):
        assert e({"cp": malo}, [], [])["cp"] is None, malo
    for bueno in ("15704", "123456", "1000-001", "SW1A 1AA", "EC1A 1BB", "28001"):
        assert e({"cp": bueno}, [], [])["cp"] == bueno, bueno


@pytest.mark.asyncio(loop_scope="session")
async def test_el_paquete_solo_si_tiene_forma_de_codigo(base):
    """G11: `paquete` era el tracking_id en crudo (al guardar solo se pide que no esté vacío): con una tabla pegada
    descuadrada, cualquier texto de esa columna llegaba al conductor. Ahora solo letras y cifras (con alguna cifra y, desde
    R10/H2, alguna letra), sin espacios, de 8 a 30 caracteres; si no, esa fila NO sale (ni cuenta en los totales)."""
    raros = ("TBA 1234 5678", "MARIA LOPEZ", "MARIALOPEZ", "TBA-12345678", "TB12345", "T" * 20 + "1" * 11,
             "600 123 456", "600123456")         # R10/H2: un móvil de 9 cifras sin espacios tampoco es un paquete
    base["dnr_rows"].docs += [_fila(p, "AANA000001", "2026-11-09", "Y") for p in raros]
    base["dnr_rows"].docs += [_fila("TBA123456789012", "AANA000001", "2026-11-09", "Y"),
                              _fila("T" * 20 + "1" * 10, "AANA000001", "2026-11-09", "Y")]
    r = await server.mis_dnr(_conductor("d-ana"))
    paquetes = _paquetes(r)
    assert {"TBA123456789012", "T" * 20 + "1" * 10} <= paquetes
    texto = json.dumps(r, ensure_ascii=False)
    for p in raros:
        assert p not in paquetes and p not in texto, p
    assert r["semanas"][0]["cuentan"] == 3                # TBAANA100 y las dos con forma de código


# ── R12 (11-11-2026): ajustado con un Daily Report real (OGA5, 09-11-2026) y su leyenda ─────────────────────────────
# Dani mandó un informe de verdad: de él se ha tomado SOLO el vocabulario de sus columnas y lo que dice su leyenda
# (ningún paquete, ID ni dato de nadie). Los paquetes y los IDs de aquí son inventados, con la misma forma que los reales
# («ES» + 10 cifras). La tabla de foto y la de contacto son tablas de FALLOS: estar en ellas ya es un fallo.

# Las ocho frases de la leyenda de «POD Audit» (unas veces dice «Package» y otras «Parcel»), con su motivo.
LEYENDA_FOTO = (
    ("Blurred photo", "borrosa"), ("Person apparent in photo", "persona"), ("No {p} detected in photo", "sin_paquete"),
    ("{P} in car", "en_furgoneta"), ("{P} in hand", "en_mano"), ("{P} in letterbox", "en_buzon"),
    ("{P} too close", "muy_cerca"), ("Photo too dark", "oscura"))


def test_r12_cada_frase_de_la_leyenda_de_la_foto_con_package_y_con_parcel():
    e = server._dnr_entrega
    for frase, motivo in LEYENDA_FOTO:
        for palabra in ("Package", "Parcel"):
            texto = frase.format(p=palabra.lower(), P=palabra)
            variantes = {texto, texto.upper(), texto.lower(), texto.replace(" ", "_").upper()}
            # «in photo» o sin él (la leyenda lo pone en unas y en otras no).
            if texto.endswith(" in photo"):
                variantes.add(texto[:-len(" in photo")])
            elif "photo" not in texto.lower():
                variantes.add(texto + " in photo")
            for v in variantes:
                r = e({}, [{"fallo": v}], [])
                assert (r["foto"], r["foto_motivo"]) == ("mal", motivo), v
    # Lo que se vio escrito en las filas del informe real, y las otras formas de la leyenda.
    for v, motivo in (("Package in car", "en_furgoneta"), ("No package detected", "sin_paquete"),
                      ("No parcel detected", "sin_paquete"), ("Person in photo", "persona"),
                      ("Parcel in mailbox", "en_buzon"), ("Package in mailbox", "en_buzon")):
        r = e({}, [{"fallo": v}], [])
        assert (r["foto"], r["foto_motivo"]) == ("mal", motivo), v


def test_r12_la_tabla_de_foto_es_de_fallos_un_motivo_que_no_se_reconoce_es_mal_sin_motivo():
    """Es la tabla de FALLOS de foto (sus filas suman la columna «POD Fails» del resumen): una fila con «POD Audit»
    relleno es un fallo aunque no se reconozca el motivo. «bien» solo con PASS/PASSED; sin fila, no se sabe."""
    e = server._dnr_entrega
    for raro in ("Some new reason", "WEIRD_AUDIT", "N", "PENDING"):
        r = e({}, [{"fallo": raro}], [])
        assert (r["foto"], r["foto_motivo"]) == ("mal", None), raro
    assert (e({}, [{"fallo": "PASS"}], [])["foto"], e({}, [{"fallo": "PASSED"}], [])["foto"]) == ("bien", "bien")
    assert (e({}, [], [])["foto"], e({}, [{"fallo": ""}], [])["foto"]) == (None, None)
    # Un motivo reconocido manda sobre uno que no, en cualquier orden.
    r = e({}, [{"fallo": "Some new reason"}, {"fallo": "Parcel in hand"}], [])
    assert (r["foto"], r["foto_motivo"]) == ("mal", "en_mano")


def test_r12_la_tabla_de_contacto_es_de_fallos_y_el_0_no_es_una_medida():
    """En el informe real, «CC Type» es «Calls to Customer» o vacío y «Call Duration (Seconds)» es 0 en TODAS las
    filas, también en las que apuntan una llamada. Estar en esa tabla ya es un fallo de contacto. Retoque de R12
    (11-11-2026): el 0 no se manda (sería afirmar «0 s», una medida que el informe no da; y la subida guarda como 0 una
    celda vacía). Sin segundos válidos manda el tipo: una llamada → «corta» sin cifra; vacío → «no»; un mensaje u otro
    tipo → no se sabe."""
    e = server._dnr_entrega
    for cero in (0, "0", 0.0, "", None, "-"):
        r = e({}, [], [{"tipo": "Calls to Customer", "segundos": cero}])
        assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == ("corta", None, True), cero
        r = e({}, [], [{"tipo": "", "segundos": cero}])
        assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == ("no", None, True), cero
        for mensaje in ("SMS", "Texts to Customer", "Message"):
            r = e({}, [], [{"tipo": mensaje, "segundos": cero}])
            assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == (None, None, True), (mensaje, cero)
    r = e({}, [], [{"tipo": "Calls to Customer", "segundos": 45}])
    assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == ("si", 45, True)
    for corta in (12, 29):
        r = e({}, [], [{"tipo": "Calls to Customer", "segundos": corta}])
        assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == ("corta", corta, True), corta
    # Con segundos válidos mandan ellos, aunque el tipo venga vacío.
    r = e({}, [], [{"tipo": "", "segundos": 12}])
    assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == ("corta", 12, True)
    # La fila manda sobre «Contact Compliance» de la propia DNR.
    r = e({"contacto": "Y"}, [], [{"tipo": "Calls to Customer", "segundos": 0}])
    assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == ("corta", None, True)
    r = e({"contacto": "Y"}, [], [{"tipo": "", "segundos": 0}])
    assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == ("no", None, True)
    # Con algo raro en la celda tampoco hay cifra: manda el tipo.
    for raro in (600123456, 1801, -5, "600 123456x"):
        r = e({"contacto": "Y"}, [], [{"tipo": "Calls to Customer", "segundos": raro}])
        assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == ("corta", None, True), raro
    # Varias filas: si alguna apunta una llamada, «corta»; un tipo que no se reconoce junto a uno vacío, no se sabe.
    r = e({}, [], [{"tipo": "", "segundos": 0}, {"tipo": "Calls to Customer", "segundos": 0}])
    assert (r["llamada"], r["segundos"]) == ("corta", None)
    r = e({}, [], [{"tipo": "", "segundos": 0}, {"tipo": "SMS", "segundos": 0}])
    assert (r["llamada"], r["segundos"]) == (None, None)
    # Los NO_CALL… llevan CALL en su código pero no son una llamada.
    for tipo in ("NO_CALL", "no call made", "CALL_NOT_MADE", "NOT_CALLED"):
        r = e({}, [], [{"tipo": tipo, "segundos": 0}])
        assert (r["llamada"], r["segundos"]) == ("no", None), tipo


def test_r12_por_la_subida_una_celda_de_segundos_vacia_no_es_0_s():
    """M1 de la revisión de R12: la subida del .html guarda «Call Duration (Seconds)» con _dia_num, que deja en 0 una
    celda vacía, «-», «N/A» o «12s». Eso no puede salir como «Llamada corta · 0 s»: sin cifra. (Cómo se guarda no se
    cambia.)"""
    html = _HTML_R12.replace(
        "<td>Calls to Customer</td><td>0</td>", "<td>Calls to Customer</td><td></td>").replace(
        "<td>DELIVERED_TO_MAIL_SLOT</td><td></td><td>0</td>", "<td>DELIVERED_TO_MAIL_SLOT</td><td></td><td>-</td>")
    assert html.count("<td>0</td>") == 0
    p = server._parsea_diario_html(html)
    assert len(p["cc"]) == 2
    for fila in p["dnr"]:
        ccs = [x for x in p["cc"] if (x["tracking_id"], x["transporter_id"]) == (fila["tracking_id"], "AINVENTA0001")]
        if not ccs:
            continue
        r = server._dnr_entrega(fila, [], ccs)
        assert r["segundos"] is None and r["fallo_contacto"] is True, fila["tracking_id"]
        assert r["llamada"] == {"ES2600000001": "corta", "ES2600000004": "no"}[fila["tracking_id"]]


def test_r12_sin_fila_de_contacto_manda_contact_compliance():
    """La leyenda: «Contact Compliance» Y = se intentó una llamada o un mensaje; N = no. Solo cuando el paquete no
    tiene fila en la tabla de fallos de contacto. Lo que no sea Y/N, no se sabe."""
    e = server._dnr_entrega
    r = e({"contacto": "Y"}, [], [])
    assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == ("si", None, None)
    r = e({"contacto": "N"}, [], [])
    assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == ("no", None, True)
    for raro in ("", "-", "1", "0", "PENDING", None):
        r = e({"contacto": raro}, [], [])
        assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == (None, None, None), raro


_HTML_R12 = """<html><body>
<h1>ES TDSL OGA5 Daily Report 2026-11-09</h1>
<h2>DNR (2026-11-07)</h2>
<table>
<tr><th>Tracking ID</th><th>Transporter ID</th><th>Delivery Date</th><th>Delivery Scan</th><th>DSC</th>
<th>Delivered &ge; 25m</th><th>Contact Compliance</th><th>PHR</th><th>Postal Code</th></tr>
<tr><td>ES2600000001</td><td>AINVENTA0001</td><td>2026-11-02</td><td>DELIVERED_TO_HOUSEHOLD_MEMBER</td><td>Y</td>
<td>N</td><td>Y</td><td>N</td><td>15701</td></tr>
<tr><td>ES2600000002</td><td>AINVENTA0001</td><td>2026-11-03</td><td>DELIVERED_TO_DOORSTEP</td><td>N</td>
<td>Y</td><td>N</td><td>N</td><td>15702</td></tr>
<tr><td>ES2600000003</td><td>AINVENTA0001</td><td>2026-10-30</td><td>DELIVERED_TO_SAFE_LOCATION</td><td>Y</td>
<td>N</td><td>Y</td><td>Y</td><td>15703</td></tr>
<tr><td>ES2600000004</td><td>AINVENTA0001</td><td>2026-11-04</td><td>DELIVERED_TO_MAIL_SLOT</td><td>Y</td>
<td>N</td><td>Y</td><td>Y</td><td>15704</td></tr>
</table>
<table>
<tr><th>Tracking ID</th><th>Transporter ID</th><th>Delivery/Attempt Reason</th><th>POD Audit</th></tr>
<tr><td>ES2600000001</td><td>AINVENTA0001</td><td>DELIVERED_TO_HOUSEHOLD_MEMBER</td><td>Package in car</td></tr>
<tr><td>ES2600000002</td><td>AINVENTA0001</td><td>DELIVERED_TO_DOORSTEP</td><td>No package detected</td></tr>
</table>
<table>
<tr><th>Tracking ID</th><th>Transporter ID</th><th>Delivery/Attempt Reason</th><th>CC Type</th>
<th>Call Duration (Seconds)</th></tr>
<tr><td>ES2600000001</td><td>AINVENTA0001</td><td>DELIVERED_TO_HOUSEHOLD_MEMBER</td><td>Calls to Customer</td><td>0</td></tr>
<tr><td>ES2600000004</td><td>AINVENTA0001</td><td>DELIVERED_TO_MAIL_SLOT</td><td></td><td>0</td></tr>
</table>
</body></html>"""


def test_r12_de_un_informe_con_la_forma_real_a_lo_que_ve_el_conductor():
    """Lo mismo, pasando por la lectura del .html tal como se guarda (sin cambiarla): «0» en la celda llega como 0, y
    ese 0 no sale como «0 s» (retoque de R12): «Calls to Customer» es «corta» sin cifra y el tipo vacío, «no»."""
    p = server._parsea_diario_html(_HTML_R12)
    assert p["fecha_dnr"] == "2026-11-07" and len(p["dnr"]) == 4 and len(p["pod"]) == 2 and len(p["cc"]) == 2

    def suyas(tabla, paquete):
        return [x for x in p[tabla] if (x["tracking_id"], x["transporter_id"]) == (paquete, "AINVENTA0001")]

    vista = {f["tracking_id"]: server._dnr_entrega(f, suyas("pod", f["tracking_id"]), suyas("cc", f["tracking_id"]))
             for f in p["dnr"]}
    campos = ("como", "lejos", "llamada", "segundos", "fallo_contacto", "foto", "foto_motivo")
    assert {k: tuple(v[c] for c in campos) for k, v in vista.items()} == {
        "ES2600000001": ("familiar", False, "corta", None, True, "mal", "en_furgoneta"),
        "ES2600000002": ("puerta", True, "no", None, True, "mal", "sin_paquete"),
        "ES2600000003": ("lugar_seguro", False, "si", None, None, None, None),
        "ES2600000004": ("buzon", False, "no", None, True, None, None),
    }
    assert [x["segundos"] for x in p["cc"]] == [0, 0]       # se guarda como siempre; lo que cambia es lo que se manda
    assert all(server._DNR_PAQUETE.match(k) for k in vista)


@pytest.mark.asyncio(loop_scope="session")
async def test_r12_un_paquete_es_sale_y_contact_compliance_llega_de_lo_guardado(base):
    """Por la ruta: un paquete «ES» + 10 cifras sale, y «Contact Compliance» se lee de la fila guardada (la proyección
    de dnr_rows vuelve a pedir `contacto`). Sin euros, sin el ID y sin el PHR, como siempre."""
    base["dnr_rows"].docs += [
        _fila("ES2600000001", "AANA000001", "2026-11-09", "Y", scan="DELIVERED_TO_HOUSEHOLD_MEMBER", contacto="Y"),
        _fila("ES2600000002", "AANA000001", "2026-11-09", "Y", scan="DELIVERED_TO_DOORSTEP", contacto="N"),
        _fila("ES2600000003", "AANA000001", "2026-11-09", "Y", contacto="Y")]
    base["cc_rows"].docs.append({"tracking_id": "ES2600000003", "transporter_id": "AANA000001",
                                 "fecha_reporte": "2026-11-09", "motivo": "DELIVERED_TO_DOORSTEP",
                                 "tipo": "Calls to Customer", "segundos": 0})
    base["pod_rows"].docs.append({"tracking_id": "ES2600000002", "transporter_id": "AANA000001",
                                  "fecha_reporte": "2026-11-09", "motivo": "DELIVERED_TO_DOORSTEP",
                                  "fallo": "Parcel in letterbox"})
    r = await server.mis_dnr(_conductor("d-ana"))
    assert {"ES2600000001", "ES2600000002", "ES2600000003"} <= _paquetes(r)
    campos = ("llamada", "segundos", "fallo_contacto", "foto", "foto_motivo")
    assert tuple(_dnr(r, "ES2600000001")[c] for c in campos) == ("si", None, None, None, None)
    assert tuple(_dnr(r, "ES2600000002")[c] for c in campos) == ("no", None, True, "mal", "en_buzon")
    assert tuple(_dnr(r, "ES2600000003")[c] for c in campos) == ("corta", None, True, None, None)
    assert set(_dnr(r, "ES2600000001")) == CLAVES_DNR
    texto = json.dumps(r, ensure_ascii=False)
    for secreto in ("AANA000001", "PHRSECRETO", "EXCSECRETA", "25.4", "€"):
        assert secreto not in texto, secreto


# ── R14 (11-11-2026): más información útil de la tabla DNR ─────────────────────
# Dani: «monta lo que consideres necesario, que dé buena información y sea útil; si consideras lo de preferencia
# respetada, mételo, y lo de la columna esa de Mailbox Eligible, delivered elsewhere, también». Cada marca solo se dice
# con Y (con N, vacío o algo raro, null: la pantalla no dice nada); nunca euros ni la nota del cliente.

# (columna guardada en la fila, clave que sale)
MARCAS_R14 = (("phr", "preferencia"), ("buzon_otro", "buzon_otro"), ("simultaneas", "varios_a_la_vez"),
              ("excepcion", "a_distancia"), ("escaneo_falso", "cliente_no_confirma"), ("alto_valor", "alto_valor"))


def test_r14_cada_marca_solo_con_y_y_nunca_false():
    e = server._dnr_entrega
    base_r12 = e({}, [], [])
    for columna, clave in MARCAS_R14:
        for si in ("Y", "y", "Yes", "TRUE", " Y "):
            r = e({columna: si}, [], [])
            assert r[clave] is True, (columna, si)
            # Las demás claves no cambian por esta columna.
            assert {k: v for k, v in r.items() if k != clave} == {k: v for k, v in base_r12.items() if k != clave}
        for nada in ("N", "No", "false", "", "-", "N/A", None, "1", "0", "PENDING", "PHRSECRETO", "€33.05"):
            assert e({columna: nada}, [], [])[clave] is None, (columna, nada)
    # Una fila de antes de R14 (sin las columnas nuevas): las 7 claves nuevas a null.
    assert {k: base_r12[k] for k in CLAVES_R14} == dict.fromkeys(CLAVES_R14)


def test_r14_contacto_como_de_contact_details():
    e = server._dnr_entrega
    for valor, como in (("Calls to Customer", "llamada"), ("CALL", "llamada"), ("Call", "llamada"),
                        ("Text", "mensaje"), ("SMS", "mensaje"), ("Texts to Customer", "mensaje"),
                        ("", None), (None, None), ("-", None), ("Email", None), ("1", None), ("Y", None),
                        # Las dos cosas, o que no lo hubo: no se adivina.
                        ("Text or call", None), ("No call attempted", None), ("Call not made", None),
                        ("Not called", None), ("No text sent", None),
                        # Las formas que trae el informe real además de «Calls to Customer» y vacío (revisión de R14,
                        # 11-11-2026): con el prefijo entre corchetes; NOTIFY no es una negación.
                        ("[NOTIFY_OF_ARRIVAL] Text to Customer", "mensaje"),
                        ("[NOTIFY_OF_ARRIVAL] Calls to Customer / Text to Customer", None),
                        ("[OTHER] Calls to Customer / Text to Customer", None)):
        assert e({"contacto_detalle": valor}, [], [])["contacto_como"] == como, valor
    # Sale de la fila de la DNR, no de la tabla de fallos de contacto.
    assert e({}, [], [{"tipo": "Calls to Customer", "segundos": 0}])["contacto_como"] is None


def test_r14_un_tipo_con_call_que_dice_que_no_la_hubo_es_no_y_no_corta():
    """Retoque de R12: «habla de una llamada» era «el código contiene CALL», y «No call attempted» salía «corta». Un
    tipo cuya negación va pegada a CALL (NO_CALL…, CALL_NOT…, NOT_CALLED, NEVER_CALLED, WITHOUT_CALL) es «no»."""
    e = server._dnr_entrega
    for tipo in ("No call attempted", "Call not made", "Not called", "Never called", "Delivered without call",
                 "Customer not called", "NO_CALL_ATTEMPTED", "no-call", "CALL NEVER MADE"):
        for cero in (0, "", None):
            r = e({"contacto": "Y"}, [], [{"tipo": tipo, "segundos": cero}])
            assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == ("no", None, True), (tipo, cero)
    # Con segundos válidos siguen mandando ellos.
    r = e({}, [], [{"tipo": "No call attempted", "segundos": 45}])
    assert (r["llamada"], r["segundos"]) == ("si", 45)
    # Si otra fila apunta una llamada de verdad, «corta» (como con NO_CALL).
    r = e({}, [], [{"tipo": "No call attempted", "segundos": 0}, {"tipo": "Calls to Customer", "segundos": 0}])
    assert (r["llamada"], r["segundos"]) == ("corta", None)
    # «Calls to Customer» sigue siendo una llamada: CALLS no es una negación, ni CUSTOMER, ni NOTES.
    for tipo in ("Calls to Customer", "CALL", "Call notes"):
        assert e({}, [], [{"tipo": tipo, "segundos": 0}])["llamada"] == "corta", tipo
    # Revisión de R14 (11-11-2026): la negación solo hace «no» cuando niega la LLAMADA. «Calls to Customer - No
    # answer» apunta una llamada que sí se hizo y nadie cogió: «corta» sin segundos, como «Calls to Customer».
    for cero in (0, "", None):
        r = e({}, [], [{"tipo": "Calls to Customer - No answer", "segundos": cero}])
        assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == ("corta", None, True), cero
    # Un tipo SIN CALL con una negación no afirma «Sin llamada»: no se sabe qué fue (null), como cualquier otro tipo
    # que no habla de una llamada. Sigue siendo un fallo de contacto (estar en la tabla lo es).
    for tipo in ("Customer not available", "No answer", "Text not delivered", "NOT_AVAILABLE", "Never home",
                 "Left without signature"):
        for cero in (0, "", None):
            r = e({}, [], [{"tipo": tipo, "segundos": cero}])
            assert (r["llamada"], r["segundos"], r["fallo_contacto"]) == (None, None, True), (tipo, cero)
        # Junto a una fila que sí niega la llamada, tampoco: no TODAS dicen que no la hubo.
        r = e({}, [], [{"tipo": tipo, "segundos": 0}, {"tipo": "No call attempted", "segundos": 0}])
        assert r["llamada"] is None, tipo


# Las claves que la subida del .html ya guardaba en cada fila DNR antes de R14 (no cambian).
CLAVES_FILA_ANTES = {"tracking_id", "transporter_id", "fecha_entrega", "dsc", "scan", "phr", "mas_25m", "simultaneas",
                     "contacto", "excepcion", "valor", "valor_eur", "cp"}
CLAVES_FILA_R14 = {"contacto_detalle", "escaneo_falso", "buzon_otro", "alto_valor"}

# La tabla DNR con las cabeceras del informe real y valores INVENTADOS con su forma. Trae también lo que no se usa nunca
# (el importe, la nota del cliente, el Place ID, OTP/SIG, Next / Same Day), para ver que no sale.
_HTML_R14 = """<html><body>
<h1>ES TDSL OGA5 Daily Report 2026-11-09</h1>
<h2>DNR (2026-11-07)</h2>
<table>
<tr><th>Tracking ID</th><th>Transporter ID</th><th>Delivery Date</th><th>Delivery Scan</th><th>DSC</th>
<th>Delivered &ge; 25m</th><th>Simultaneous Deliveries</th><th>Contact Compliance</th><th>Contact Details</th>
<th>PHR</th><th>Feedback False Scan Indicator</th><th>Delivery Exception</th>
<th>Mailbox Eligible, Delivered Elsewhere</th><th>High Value</th><th>Value</th><th>Delivery Hint / Customer Note</th>
<th>Place ID</th><th>OTP/SIG</th><th>Next / Same Day</th><th>Postal Code</th></tr>
<tr><td>ES2600000011</td><td>AANA000001</td><td>2026-11-02</td><td>DELIVERED_TO_MAIL_SLOT</td><td>Y</td>
<td>Y</td><td>Y</td><td>Y</td><td>Calls to Customer</td>
<td>Y</td><td>Y</td><td>Y</td>
<td>Y</td><td>Y</td><td>&euro;33.05</td><td>Dejar en el portal 3B, preguntar por Marta</td>
<td>PLACEINVENT01</td><td>N</td><td>Next Day</td><td>15701</td></tr>
<tr><td>ES2600000012</td><td>AANA000001</td><td>2026-11-03</td><td>DELIVERED_TO_DOORSTEP</td><td>Y</td>
<td>N</td><td>N</td><td>N</td><td></td>
<td>N</td><td>N</td><td>N</td>
<td>N</td><td>N</td><td>&euro;33.05</td><td>Dejar en el portal 3B, preguntar por Marta</td>
<td>PLACEINVENT02</td><td>N</td><td>Same Day</td><td>15702</td></tr>
</table>
</body></html>"""


def test_r14_la_subida_guarda_las_cuatro_columnas_nuevas_sin_cambiar_las_de_antes():
    p = server._parsea_diario_html(_HTML_R14)
    assert p["fecha_dnr"] == "2026-11-07" and len(p["dnr"]) == 2
    uno, dos = p["dnr"]
    assert set(uno) == CLAVES_FILA_ANTES | CLAVES_FILA_R14, set(uno) ^ (CLAVES_FILA_ANTES | CLAVES_FILA_R14)
    assert {k: uno[k] for k in CLAVES_FILA_R14} == {"contacto_detalle": "Calls to Customer", "escaneo_falso": "Y",
                                                    "buzon_otro": "Y", "alto_valor": "Y"}
    assert {k: dos[k] for k in CLAVES_FILA_R14} == {"contacto_detalle": "", "escaneo_falso": "N", "buzon_otro": "N",
                                                    "alto_valor": "N"}
    # Las de antes, igual que siempre.
    assert {k: uno[k] for k in CLAVES_FILA_ANTES} == {
        "tracking_id": "ES2600000011", "transporter_id": "AANA000001", "fecha_entrega": "2026-11-02", "dsc": "Y",
        "scan": "DELIVERED_TO_MAIL_SLOT", "phr": "Y", "mas_25m": "Y", "simultaneas": "Y", "contacto": "Y",
        "excepcion": "Y", "valor": "€33.05", "valor_eur": 33.05, "cp": "15701"}
    # Un informe sin esas columnas (el de R12) guarda las de antes y las nuevas vacías.
    viejo = server._parsea_diario_html(_HTML_R12)["dnr"][0]
    assert set(viejo) == CLAVES_FILA_ANTES | CLAVES_FILA_R14
    assert {k: viejo[k] for k in CLAVES_FILA_R14} == dict.fromkeys(CLAVES_FILA_R14, "")
    # El pegado de texto no cambia: sigue sin estas columnas.
    pegado = server._parsea_diario("DNR (2026-11-07)\nTracking ID\tTransporter ID\tDSC\tHigh Value\n"
                                   "ES2600000013\tAANA000001\tY\tY\n")
    assert set(pegado["dnr"][0]) == CLAVES_FILA_ANTES


@pytest.mark.asyncio(loop_scope="session")
async def test_r14_de_la_subida_a_lo_que_ve_el_conductor_con_las_19_claves(base):
    """Por la ruta de la oficina (pegar_diario con el .html) y después la del conductor: cada DNR lleva exactamente 19
    claves, las marcas nuevas llegan de lo guardado (la proyección de dnr_rows las pide: el doble de Mongo respeta las
    proyecciones de inclusión) y siguen sin salir ni un euro ni la nota del cliente."""
    r = await server.pegar_diario({"texto": _HTML_R14, "confirmar": True}, DANI)
    assert r["guardado"] is True and r["dnr_guardados"] == 2
    vista = await server.mis_dnr(_conductor("d-ana"))
    for s in vista["semanas"]:
        for x in s["dnr"]:
            assert set(x) == CLAVES_DNR and len(x) == 19, set(x) ^ CLAVES_DNR
    uno, dos = _dnr(vista, "ES2600000011"), _dnr(vista, "ES2600000012")
    assert {k: uno[k] for k in CLAVES_R14} == {
        "contacto_como": "llamada", "preferencia": True, "buzon_otro": True, "varios_a_la_vez": True,
        "a_distancia": True, "cliente_no_confirma": True, "alto_valor": True}
    assert {k: dos[k] for k in CLAVES_R14} == dict.fromkeys(CLAVES_R14)
    # Las de antes, como en R12: «Contact Compliance» Y sin fila de contacto → «si» sin segundos.
    assert (uno["como"], uno["lejos"], uno["llamada"], uno["segundos"], uno["fallo_contacto"]) == (
        "buzon", True, "si", None, None)
    assert (dos["como"], dos["lejos"], dos["llamada"], dos["fallo_contacto"]) == ("puerta", False, "no", True)
    # Una DNR guardada antes de R14 (sin las columnas nuevas) sale con las 7 a null.
    assert {k: _dnr(vista, "TBAANA100")[k] for k in CLAVES_R14} == dict.fromkeys(CLAVES_R14)
    texto = json.dumps(vista, ensure_ascii=False)
    for prohibido in ("33.05", "€", '"valor"', "valor_eur", "Marta", "portal 3B", "PLACEINVENT", "Next Day",
                      "Same Day", "AANA000001", "Calls to Customer"):
        assert prohibido not in texto, prohibido


@pytest.mark.asyncio(loop_scope="session")
async def test_r14_la_proyeccion_de_dnr_rows_pide_las_columnas_nuevas_y_ningun_euro(base):
    await server.mis_dnr(_conductor("d-ana"))
    proyecciones = [c.proyeccion for c in base["dnr_rows"].cursores
                    if isinstance(c.proyeccion, dict) and "tracking_id" in c.proyeccion]
    assert proyecciones
    p = proyecciones[0]
    for campo in ("phr", "simultaneas", "excepcion", "contacto_detalle", "escaneo_falso", "buzon_otro", "alto_valor"):
        assert p.get(campo) == 1, campo
    assert "valor" not in p and "valor_eur" not in p


@pytest.mark.asyncio(loop_scope="session")
async def test_r14_lo_que_ve_la_oficina_no_cambia(base):
    """Las rutas de la oficina que devuelven algo de las filas DNR (la subida, en su previa y al guardar, y la tabla por
    conductor) contestan lo mismo con las columnas nuevas que sin ellas: el detalle de la oficina va escrito campo a
    campo y las columnas nuevas no salen ahí."""
    sin_r14 = _HTML_R14
    for cabecera in ("Contact Details", "Feedback False Scan Indicator", "Mailbox Eligible, Delivered Elsewhere",
                     "High Value"):
        sin_r14 = sin_r14.replace("<th>%s</th>" % cabecera, "<th>Otra columna %d</th>" % len(cabecera))
    assert server._parsea_diario_html(sin_r14)["dnr"][0]["alto_valor"] == ""

    async def oficina():
        return await server.diarios_por_conductor("OGA5", "2026-10-18", "2026-11-14", DANI)

    previa_sin = await server.pegar_diario({"texto": sin_r14}, DANI)
    previa_con = await server.pegar_diario({"texto": _HTML_R14}, DANI)
    assert previa_sin == previa_con
    guardado_sin = await server.pegar_diario({"texto": sin_r14, "confirmar": True}, DANI)
    tabla_sin = await oficina()
    guardado_con = await server.pegar_diario({"texto": _HTML_R14, "confirmar": True}, DANI)
    tabla_con = await oficina()
    assert {k: v for k, v in guardado_sin.items() if k != "clasificados_ahora"} == {
        k: v for k, v in guardado_con.items() if k != "clasificados_ahora"}
    assert tabla_sin == tabla_con
    # Y se guardó de verdad con las columnas nuevas (no es que no llegaran).
    fila = next(d for d in base["dnr_rows"].docs if d["tracking_id"] == "ES2600000011")
    assert (fila["contacto_detalle"], fila["alto_valor"]) == ("Calls to Customer", "Y")
    detalle = [d for c in tabla_con["conductores"] for d in c["detalle"] if d["tracking_id"].startswith("ES26")]
    assert len(detalle) == 2
    for d in detalle:
        assert set(d) == {"tracking_id", "fecha_concesion", "fecha_entrega", "dsc", "scan", "valor", "cp", "valor_eur"}
