# -*- coding: utf-8 -*-
"""Lo que pide la calle (30-10-2026, docs/NECESIDADES-REPARTIDOR-30-10.md), contra una base de mentira:

  · el cliente contesta en su enlace (si estará, dónde dejarlo, el portal, una franja) y eso entra en la
    parada, mueve la ventana y le salta un aviso al repartidor; un enlace caducado o un pedido cerrado, no;
  · el registro del intento (llegada, llamada, espera) se guarda con el estado y el enlace lo enseña;
  · la app aprende la puerta: la posición al entregar, si es precisa y cercana, es el punto de la próxima
    parada en esa dirección y de las direcciones conocidas;
  · lo que publica la DGT se lee (incidencias y zonas de bajas emisiones) y se filtra a la ruta.
"""
import os
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import reparto as R
import server
from base_de_mentira import Col, Db

HOY = "2026-10-30"
ANA = {"sub": "d1", "role": "driver", "name": "ANA", "org_id": "o1"}
LUIS = {"sub": "d2", "role": "driver", "name": "LUIS", "org_id": "o1"}
PETICION = SimpleNamespace(headers={}, client=SimpleNamespace(host="203.0.113.7"))


@pytest.fixture
def base(monkeypatch):
    db = Db()
    db["drivers"] = Col([{"id": "d1", "name": "ANA PÉREZ"}, {"id": "d2", "name": "LUIS GÓMEZ"}])
    puntos = {"Montero R": (43.3690, -8.4050), "Real 5": (43.3712, -8.3990)}

    async def ubicar(direccion, cp="", localidad="", base=None):
        for k, v in puntos.items():
            if k in (direccion or ""):
                return v
        return None

    async def org(_id):
        return {"id": "o1", "account_type": "dsp", "modulos": ["dashboard", "reparto", "configuracion"]}

    monkeypatch.setattr(server, "db", db)
    globales = Db()
    globales["organizations"] = Col([{"id": "o1", "db_name": "dsp_x", "sector": "autonomo", "name": "Ana"}])
    monkeypatch.setattr(server, "global_db", globales)

    class _Cliente(dict):
        def __missing__(self, _nombre):
            return db
    monkeypatch.setattr(server, "client", _Cliente())
    monkeypatch.setattr(server, "_rep_ubicar", ubicar)
    monkeypatch.setattr(server, "get_org", org)
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)
    server._current_db_name.set("dsp_x")
    server._public_actions.clear()
    server._REP_LIMPIEZA.clear()
    return SimpleNamespace(db=db, globales=globales)


async def _parada(user, direccion="Avda Montero Ríos 12, 15003", **extra):
    return await server.reparto_mis_pedidos({"cliente": "Lucía M.", "telefono": "600000002", "direccion": direccion, **extra}, user)


# ── El cliente te ayuda antes de llegar ──────────────────────────────────────

def test_respuesta_del_cliente_solo_lo_que_dice():
    r, e = R.respuesta_cliente({"estare": "no", "dejar": "porteria", "portal": " 1234\n", "nota": "timbre roto"})
    assert e == "" and r == {"estare": "no", "dejar": "porteria", "franja": None, "portal": "1234", "nota": "timbre roto"}
    r, e = R.respuesta_cliente({"estare": "franja", "franja_desde": "16", "franja_hasta": "18:30"})
    assert e == "" and r["franja"] == ["16:00", "18:30"] and r["dejar"] == ""
    assert R.respuesta_cliente({"estare": "si"})[0]["estare"] == "si"
    # Sin decir dónde, con la franja al revés, o con cualquier cosa: no.
    assert R.respuesta_cliente({"estare": "no"})[0] is None
    assert R.respuesta_cliente({"estare": "no", "dejar": "en casa del perro"})[0] is None
    assert R.respuesta_cliente({"estare": "franja", "franja_desde": "18", "franja_hasta": "16"})[0] is None
    assert R.respuesta_cliente({"estare": "quizás"})[0] is None
    assert R.respuesta_cliente("no")[0] is None
    # Lo que le llega al repartidor, en una línea.
    assert R.texto_respuesta({"estare": "no", "dejar": "porteria", "portal": "1234"}, "Lucía M.") == "Lucía M.: no estará: déjalo en portería · portal: 1234"
    assert R.texto_respuesta({"estare": "franja", "franja": ["16:00", "18:30"], "nota": "2º izq"}) == "mejor de 16:00 a 18:30 · «2º izq»"


@pytest.mark.asyncio(loop_scope="session")
async def test_el_cliente_contesta_en_su_enlace_y_el_repartidor_lo_ve(base):
    p = await _parada(ANA)
    token = await server._rep_enlace(p)
    antes = await server.seguimiento_publico(token, PETICION)
    assert antes["puede_contestar"] is True and antes["respuesta"] is None
    r = await server.seguimiento_respuesta(token, PETICION, {"estare": "franja", "franja_desde": "16:00", "franja_hasta": "18:00",
                                                             "portal": "1234", "nota": "2º izq"})
    assert r["ok"] and r["cliente_dice"]["franja"] == ["16:00", "18:00"] and r["cliente_dice"]["cuando"]
    guardado = base.db["reparto_pedidos"].docs[0]
    # Entra en la parada y mueve la ventana que la ruta respeta.
    assert guardado["cliente_dice"]["portal"] == "1234" and guardado["ventana_desde"] == "16:00" and guardado["ventana_hasta"] == "18:00"
    # Y le salta un aviso al repartidor, en su bandeja.
    avisos = base.db["avisos_movil"].docs
    assert len(avisos) == 1 and avisos[0]["user_id"] == "d1" and avisos[0]["url"] == "/ruta"
    assert avisos[0]["cuerpo"] == "Lucía M.: mejor de 16:00 a 18:00 · portal: 1234 · «2º izq»"
    # El enlace lo enseña, y la ruta del repartidor también.
    despues = await server.seguimiento_publico(token, PETICION)
    assert despues["respuesta"]["portal"] == "1234" and despues["franja"] == ["16:00", "18:00"]
    ruta = await server.reparto_mi_ruta(ANA)
    assert ruta["pedidos"][0]["cliente_dice"]["estare"] == "franja"
    # «No estaré»: dónde dejarlo, sin franja.
    r = await server.seguimiento_respuesta(token, PETICION, {"estare": "no", "dejar": "vecino"})
    assert r["cliente_dice"]["dejar"] == "vecino" and r["cliente_dice"]["franja"] is None
    # Lo que no vale, con su motivo.
    with pytest.raises(HTTPException) as e:
        await server.seguimiento_respuesta(token, PETICION, {"estare": "no"})
    assert e.value.status_code == 400 and "dónde" in e.value.detail


@pytest.mark.asyncio(loop_scope="session")
async def test_no_se_contesta_a_un_enlace_caducado_ni_a_un_pedido_cerrado(base):
    p = await _parada(ANA)
    token = await server._rep_enlace(p)
    with pytest.raises(HTTPException) as e:
        await server.seguimiento_respuesta("x" * 20, PETICION, {"estare": "si"})
    assert e.value.status_code == 404
    await server.reparto_estado(p["id"], {"estado": "entregado"}, ANA)
    with pytest.raises(HTTPException) as e:
        await server.seguimiento_respuesta(token, PETICION, {"estare": "si"})
    assert e.value.status_code == 409
    # Caducado: el día después del segundo día.
    base.globales["reparto_enlaces"].docs[0]["caduca"] = "2026-10-29"
    with pytest.raises(HTTPException) as e:
        await server.seguimiento_publico(token, PETICION)
    assert e.value.status_code == 404


# ── El registro del intento ──────────────────────────────────────────────────

def test_el_intento_se_sanea():
    assert R.sanea_intento({"llegada": "2026-10-30T11:00:00Z", "llamada": "2026-10-30T11:02:10Z", "espera_s": "185", "llamadas": 2}) == {
        "llegada": "2026-10-30T11:00:00Z", "llamada": "2026-10-30T11:02:10Z", "whatsapp": None, "espera_s": 185, "llamadas": 2}
    assert R.sanea_intento({"llamada": "ayer", "espera_s": 99999}) == {"llegada": None, "llamada": None, "whatsapp": None, "espera_s": 3600, "llamadas": 0}
    assert R.sanea_intento({}) is None and R.sanea_intento("hola") is None and R.sanea_intento({"espera_s": "x"}) is None


@pytest.mark.asyncio(loop_scope="session")
async def test_el_intento_se_guarda_con_el_fallo_y_el_cliente_lo_ve(base):
    p = await _parada(ANA)
    token = await server._rep_enlace(p)
    r = await server.reparto_estado(p["id"], {"estado": "fallido", "motivo": "No había nadie", "intento": {
        "llegada": "2026-10-30T11:00:00Z", "llamada": "2026-10-30T11:02:10Z", "espera_s": 180, "llamadas": 1}}, ANA)
    assert r["intento"]["llamada"] == "2026-10-30T11:02:10Z" and r["intento"]["espera_s"] == 180
    s = await server.seguimiento_publico(token, PETICION)
    assert s["estado"] == "fallido" and s["intento"]["llamada"] == "2026-10-30T11:02:10Z" and s["puede_contestar"] is False
    # Entregado: el intento se guarda, pero el enlace no lo enseña (no hace falta).
    await server.reparto_estado(p["id"], {"estado": "entregado", "intento": {"llegada": "2026-10-30T11:10:00Z"}}, ANA)
    s = await server.seguimiento_publico(token, PETICION)
    assert s["estado"] == "entregado" and s["intento"] is None
    assert base.db["reparto_pedidos"].docs[0]["intento"]["llegada"] == "2026-10-30T11:10:00Z"


# ── La app aprende la puerta ─────────────────────────────────────────────────

def test_la_puerta_vale_si_es_precisa_y_cercana():
    assert R.puerta_valida({"lat": 43.36905, "lng": -8.40495, "precision": 12}, 43.3690, -8.4050) == (43.36905, -8.40495, 12.0)
    assert R.puerta_valida({"lat": 43.36905, "lng": -8.40495, "precision": 12}, None, None) == (43.36905, -8.40495, 12.0)
    assert R.puerta_valida({"lat": 43.36905, "lng": -8.40495, "precision": 120}, 43.3690, -8.4050) is None     # imprecisa
    assert R.puerta_valida({"lat": 43.40, "lng": -8.40, "precision": 5}, 43.3690, -8.4050) is None             # a 3 km
    assert R.puerta_valida({"lat": 43.36905, "lng": -8.40495}, 43.3690, -8.4050) is None                       # sin precisión
    assert R.puerta_valida("43.3,-8.4", 43.3690, -8.4050) is None


@pytest.mark.asyncio(loop_scope="session")
async def test_la_proxima_parada_en_esa_direccion_nace_en_la_puerta(base):
    p = await _parada(ANA)
    assert (p["lat"], p["geo"]) == (43.3690, "ok")
    await server.reparto_estado(p["id"], {"estado": "entregado", "posicion": {"lat": 43.36905, "lng": -8.40495, "precision": 12}}, ANA)
    g = base.db["reparto_pedidos"].docs[0]
    assert (g["puerta_lat"], g["puerta_lng"], g["puerta_precision"]) == (43.36905, -8.40495, 12.0)
    # La misma dirección escrita distinto, mañana: el pin es la puerta, no lo que adivina el buscador.
    q = await _parada(ANA, direccion="AVDA. MONTERO RÍOS, 12 · 15003")
    assert (q["lat"], q["lng"], q["geo"]) == (43.36905, -8.40495, "puerta")
    # Con la población detrás también es la misma puerta.
    q2 = await _parada(ANA, direccion="Avda Montero Ríos 12, 15003 A Coruña")
    assert (q2["lat"], q2["geo"]) == (43.36905, "puerta")
    # Otra dirección, como siempre; y lo aprendido es de cada repartidor.
    otra = await _parada(ANA, direccion="Rúa Real 5, 15003")
    assert (otra["lat"], otra["geo"]) == (43.3712, "ok")
    de_luis = await _parada(LUIS, direccion="Avda Montero Ríos 12, 15003")
    assert (de_luis["lat"], de_luis["geo"]) == (43.3690, "ok")
    # Las direcciones conocidas salen con la puerta.
    d = await server.reparto_mis_direcciones("montero", ANA)
    assert d["direcciones"][0]["lat"] == 43.36905 and d["direcciones"][0]["puerta"] is True and d["direcciones"][0]["veces"] == 2
    # Una posición imprecisa no se aprende.
    await server.reparto_estado(otra["id"], {"estado": "entregado", "posicion": {"lat": 43.3712, "lng": -8.3990, "precision": 90}}, ANA)
    assert "puerta_lat" not in base.db["reparto_pedidos"].docs[3]


# ── Lo que publica la DGT ────────────────────────────────────────────────────

DATEX = """<?xml version="1.0" encoding="UTF-8"?>
<d2:payload xsi:type="sit:SituationPublication" lang="es" xmlns:com="http://levelC/schema/3/common"
 xmlns:loc="http://levelC/schema/3/locationReferencing" xmlns:lse="http://levelC/schema/3/locationReferencingSpanishExtension"
 xmlns:d2="http://levelC/schema/3/d2Payload" xmlns:sit="http://levelC/schema/3/situation" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
 <com:publicationTime>2026-10-30T01:11:52.783+01:00</com:publicationTime>
 <sit:situation id="2816645">
  <sit:overallSeverity>low</sit:overallSeverity>
  <sit:situationRecord xsi:type="sit:RoadOrCarriagewayOrLaneManagement" id="18811074" version="2">
   <sit:severity>highest</sit:severity>
   <sit:validity><com:validityStatus>active</com:validityStatus><com:validityTimeSpecification>
    <com:overallStartTime>2025-12-12T08:05:19.000+01:00</com:overallStartTime></com:validityTimeSpecification></sit:validity>
   <sit:cause><sit:causeType>roadMaintenance</sit:causeType><sit:detailedCauseType><sit:roadMaintenanceType>roadworks</sit:roadMaintenanceType></sit:detailedCauseType></sit:cause>
   <sit:locationReference xsi:type="loc:SingleRoadLinearLocation">
    <loc:supplementaryPositionalDescription><loc:roadInformation><loc:roadName>N-550</loc:roadName></loc:roadInformation></loc:supplementaryPositionalDescription>
    <loc:tpegLinearLocation>
     <loc:to xsi:type="loc:TpegNonJunctionPoint"><loc:pointCoordinates><loc:latitude>43.3500</loc:latitude><loc:longitude>-8.4100</loc:longitude></loc:pointCoordinates>
      <loc:_tpegNonJunctionPointExtension><loc:extendedTpegNonJunctionPoint><lse:kilometerPoint>12.3</lse:kilometerPoint><lse:municipality>Culleredo</lse:municipality><lse:province>A Coruña</lse:province></loc:extendedTpegNonJunctionPoint></loc:_tpegNonJunctionPointExtension></loc:to>
     <loc:from xsi:type="loc:TpegNonJunctionPoint"><loc:pointCoordinates><loc:latitude>43.3520</loc:latitude><loc:longitude>-8.4080</loc:longitude></loc:pointCoordinates>
      <loc:_tpegNonJunctionPointExtension><loc:extendedTpegNonJunctionPoint><lse:kilometerPoint>12.1</lse:kilometerPoint><lse:municipality>Culleredo</lse:municipality><lse:province>A Coruña</lse:province></loc:extendedTpegNonJunctionPoint></loc:_tpegNonJunctionPointExtension></loc:from>
    </loc:tpegLinearLocation>
   </sit:locationReference>
   <sit:roadOrCarriagewayOrLaneManagementType>carriagewayClosures</sit:roadOrCarriagewayOrLaneManagementType>
  </sit:situationRecord>
 </sit:situation>
 <sit:situation id="99">
  <sit:situationRecord xsi:type="sit:AbnormalTraffic" id="100" version="1">
   <sit:locationReference xsi:type="loc:PointLocation">
    <loc:supplementaryPositionalDescription><loc:roadInformation><loc:roadName>A-6</loc:roadName></loc:roadInformation></loc:supplementaryPositionalDescription>
    <loc:pointByCoordinates><loc:pointCoordinates><loc:latitude>40.4000</loc:latitude><loc:longitude>-3.7000</loc:longitude></loc:pointCoordinates></loc:pointByCoordinates>
   </sit:locationReference>
  </sit:situationRecord>
 </sit:situation>
 <sit:situation id="7"><sit:situationRecord xsi:type="sit:GenericSituationRecord" id="8" version="1"></sit:situationRecord></sit:situation>
</d2:payload>"""

ZBE = """<?xml version="1.0" encoding="UTF-8"?>
<payload xsi:type="conz:ControlledZoneTablePublication" xmlns:com="http://levelC/schema/3/common" xmlns:loc="http://levelC/schema/3/locationReferencing"
 xmlns:tra="http://levelC/schema/3/trafficRegulation" xmlns:conz="http://levelC/schema/3/controlledZone" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
 <com:publicationTime>2024-09-12T14:47:06.468Z</com:publicationTime>
 <conz:controlledZoneTable>
  <conz:controlledZone id="15001_A Coruña - Marina">
   <conz:name><com:values><com:value lang="ES">A Coruña - Marina</com:value></com:values></conz:name>
   <conz:controlledZoneDescription><com:values><com:value lang="ES">Carga y descarga de 6h a 11h.</com:value></com:values></conz:controlledZoneDescription>
   <conz:controlledZoneRecordVersionTime>2023-10-25T08:12:19.611Z</conz:controlledZoneRecordVersionTime>
   <conz:urlForFurtherInformation>https://www.coruna.gal/zbe</conz:urlForFurtherInformation>
   <conz:status>active</conz:status>
   <conz:trafficRegulationOrder><tra:trafficRegulation>
    <tra:condition xsi:type="tra:ConditionSet"><tra:operator>and</tra:operator>
     <tra:conditions xsi:type="tra:LocationCondition"><tra:implementedLocation xsi:type="loc:LocationGroupByList">
      <loc:locationContainedInGroup xsi:type="loc:AreaLocation"><loc:openlrAreaLocationReference xsi:type="loc:OpenlrPolygonLocationReference">
       <loc:openlrPolygonCorners>
        <loc:openlrCoordinates><loc:latitude>43.3680</loc:latitude><loc:longitude>-8.4060</loc:longitude></loc:openlrCoordinates>
        <loc:openlrCoordinates><loc:latitude>43.3700</loc:latitude><loc:longitude>-8.4060</loc:longitude></loc:openlrCoordinates>
        <loc:openlrCoordinates><loc:latitude>43.3700</loc:latitude><loc:longitude>-8.4040</loc:longitude></loc:openlrCoordinates>
        <loc:openlrCoordinates><loc:latitude>43.3680</loc:latitude><loc:longitude>-8.4040</loc:longitude></loc:openlrCoordinates>
       </loc:openlrPolygonCorners></loc:openlrAreaLocationReference></loc:locationContainedInGroup></tra:implementedLocation></tra:conditions>
     <tra:conditions xsi:type="tra:ConditionSet"><tra:negate>true</tra:negate>
      <tra:conditions xsi:type="conz:NonCodableCondition"><tra:active>true</tra:active><conz:condition><com:values><com:value lang="ES">ECO</com:value></com:values></conz:condition><conz:type>stickerCondition</conz:type></tra:conditions>
      <tra:conditions xsi:type="conz:NonCodableCondition"><tra:active>true</tra:active><conz:condition><com:values><com:value lang="ES">C</com:value></com:values></conz:condition><conz:type>stickerCondition</conz:type></tra:conditions>
     </tra:conditions>
    </tra:condition>
   </tra:trafficRegulation></conz:trafficRegulationOrder>
  </conz:controlledZone>
 </conz:controlledZoneTable>
</payload>"""


def test_las_incidencias_de_la_dgt_se_leen_y_se_filtran_a_la_ruta():
    items, publicado = R.incidencias_datex(DATEX)
    assert publicado == "2026-10-30T01:11:52.783+01:00"
    assert [i["id"] for i in items] == ["18811074", "100"]          # la genérica sin punto no sale
    corte = items[0]
    assert corte["clase"] == "corte" and corte["que"] == "calzada cortada (obras)" and corte["gravedad"] == "alta"
    assert corte["carretera"] == "N-550" and corte["pk"] == "12.1" and corte["municipio"] == "Culleredo" and corte["provincia"] == "A Coruña"
    assert (corte["lat"], corte["lng"], corte["lat2"], corte["lng2"]) == (43.352, -8.408, 43.35, -8.41)   # el marcador en «from»
    assert corte["desde"] == "2025-12-12T08:05:19.000+01:00"
    assert items[1]["clase"] == "retencion" and items[1]["que"] == "retención" and items[1]["lat2"] is None
    # Cerca de una ruta en A Coruña: solo la N-550, con su distancia y su parada.
    paradas = [{"id": "a", "lat": 43.3690, "lng": -8.4050, "orden": 3}, {"id": "b", "lat": 43.3600, "lng": -8.4100, "orden": 7}]
    cerca = R.incidencias_cerca(items, paradas)
    assert len(cerca) == 1 and cerca[0]["id"] == "18811074" and cerca[0]["parada"] == 7 and 0.8 <= cerca[0]["distancia_km"] <= 1.0
    assert R.incidencias_cerca(items, []) == []
    # El fichero de verdad de la DGT: 3,6 MB con cientos de situaciones; si está en el PC, que se lea entero.
    real = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Temp", "fds-emu", "datex37.xml")
    if os.path.exists(real):
        reales, pub = R.incidencias_datex(open(real, "rb").read())
        assert len(reales) > 300 and pub.startswith("2026") and all(i["lat"] and i["clase"] for i in reales)


def test_las_zbe_de_la_dgt_se_leen_y_dicen_que_paradas_caen_dentro():
    zonas = R.zbe_datex(ZBE, ciudad="ACoruña")
    assert len(zonas) == 1
    z = zonas[0]
    assert z["nombre"] == "A Coruña - Marina" and z["descripcion"] == "Carga y descarga de 6h a 11h." and z["estado"] == "active"
    assert z["etiquetas"] == ["ECO", "C"] and z["negado"] is True and z["version"] == "2023-10-25" and z["ciudad"] == "ACoruña"
    assert len(z["poligonos"]) == 1 and len(z["poligonos"][0]) == 4 and z["caja"] == (43.368, -8.406, 43.37, -8.404)
    dentro = {"id": "a", "lat": 43.3690, "lng": -8.4050}
    fuera = {"id": "b", "lat": 43.3750, "lng": -8.4050}
    assert R.zbe_de_paradas(zonas, [dentro, fuera]) == {"a": {"id": "15001_A Coruña - Marina", "nombre": "A Coruña - Marina", "tipo": "ZBE"}}
    assert R.zbe_cerca(zonas, [fuera]) == zonas and R.zbe_cerca(zonas, [{"id": "c", "lat": 42.0, "lng": -8.0}]) == []
    assert R.punto_en_poligono(43.369, -8.405, z["poligonos"][0]) and not R.punto_en_poligono(43.371, -8.405, z["poligonos"][0])


@pytest.mark.asyncio(loop_scope="session")
async def test_los_endpoints_de_la_dgt_filtran_a_las_paradas_de_hoy(base, monkeypatch):
    items, _ = R.incidencias_datex(DATEX)

    async def incidencias():
        return items, "2026-10-30T01:11:52.783+01:00", True

    async def zbe():
        return R.zbe_datex(ZBE, ciudad="ACoruña"), False
    monkeypatch.setattr(server, "_dgt_incidencias", incidencias)
    monkeypatch.setattr(server, "_dgt_zbe", zbe)
    # Sin paradas, nada que pedir a la DGT.
    assert (await server.reparto_mi_incidencias(ANA))["incidencias"] == []
    assert (await server.reparto_mi_zbe(ANA))["zonas"] == []
    p = await _parada(ANA)
    r = await server.reparto_mi_incidencias(ANA)
    assert r["fuente"] == "DGT" and r["incompleto"] is False and [i["carretera"] for i in r["incidencias"]] == ["N-550"]
    z = await server.reparto_mi_zbe(ANA)
    assert z["incompleto"] is True and z["zonas"][0]["nombre"] == "A Coruña - Marina" and "caja" not in z["zonas"][0]
    assert z["paradas"] == {p["id"]: {"id": "15001_A Coruña - Marina", "nombre": "A Coruña - Marina", "tipo": "ZBE"}}
    # Lo de otro repartidor no cuenta.
    assert (await server.reparto_mi_incidencias(LUIS))["incidencias"] == []
    assert r["aplica"] is True and z["aplica"] is True and r["avisos"] == [] and z["tipo"] == "ZBE"
    assert z["zonas"][0]["tipo"] == "ZBE" and z["zonas"][0]["fuente"] == "dgt"
    # FUERA DE ESPAÑA (30-10-2026): lo de la DGT no vale. Donde no hay fuente abierta (cortes en Alemania, zonas en
    # EE. UU.) se dice (`aplica: False`), sin «ninguna cerca» que engañe; en EE. UU. una ruta en Nueva York, sin feed
    # WZDx abierto, tampoco.
    server._region_actual.set(("de", "Europe/Berlin"))
    try:
        de = await server.reparto_mi_incidencias(ANA)
        assert de == {"incidencias": [], "fuente": None, "publicado": "", "incompleto": False, "aplica": False, "avisos": []}
    finally:
        server._region_actual.set(("es", "Europe/Madrid"))
    server._region_actual.set(("us", "America/New_York"))
    try:
        us = await server.reparto_mi_incidencias(ANA)        # las paradas están en A Coruña: ningún feed las toca
        assert us["aplica"] is False and us["fuente"] is None and us["incidencias"] == []
        assert (await server.reparto_mi_zbe(ANA)) == {"zonas": [], "paradas": {}, "fuente": None, "incompleto": False, "aplica": False, "tipo": "LEZ"}
    finally:
        server._region_actual.set(("es", "Europe/Madrid"))
