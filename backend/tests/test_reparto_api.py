# -*- coding: utf-8 -*-
"""Reparto a domicilio, flujos enteros contra una base de mentira.

Lo que se prueba es lo que no se puede romper sin que nadie lo note:
  · el conductor escanea un bulto que no está → foto/a mano → entra en SU ruta;
    el segundo bulto del mismo pedido lo encuentra y no crea otro;
  · nadie ve pedidos de otro conductor, ni los cambia;
  · el dueño del producto entrando como la empresa NO ve datos de clientes
    ni dónde están los conductores (somos encargados, art. 28 RGPD);
  · sin jornada empezada y sin aviso aceptado no se guarda ni un punto;
  · los datos personales se borran solos a los días configurados.
"""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Db

HOY = "2026-10-03"
OFICINA = {"sub": "a1", "role": "admin", "name": "Oficina", "db_name": "dsp_x", "org_id": "o1"}
DUENO_COMO_EMPRESA = {**OFICINA, "imp": True}
ANA = {"sub": "d1", "role": "driver", "name": "ANA", "org_id": "o1"}
LUIS = {"sub": "d2", "role": "driver", "name": "LUIS", "org_id": "o1"}


@pytest.fixture
def base(monkeypatch):
    db = Db()
    db["drivers"] = Col([{"id": "d1", "name": "ANA PÉREZ"}, {"id": "d2", "name": "LUIS GÓMEZ"}])
    puntos = {"Montero Ríos 12": (43.3690, -8.4050), "Real 5": (43.3712, -8.3990),
              "Almacén": (43.3600, -8.4100)}

    async def ubicar(direccion, cp="", localidad="", base=None):
        for k, v in puntos.items():
            if k in (direccion or ""):
                return v
        return None

    async def org(_id):
        return {"id": "o1", "account_type": "dsp", "modulos": ["dashboard", "reparto", "configuracion"]}

    monkeypatch.setattr(server, "db", db)
    monkeypatch.setattr(server, "_rep_ubicar", ubicar)
    monkeypatch.setattr(server, "get_org", org)
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)
    server._REP_LIMPIEZA.clear()
    return SimpleNamespace(db=db)


@pytest.mark.asyncio(loop_scope="session")
async def test_escanear_lo_que_no_esta_y_el_segundo_bulto(base):
    r = await server.reparto_escanear({"codigo": " 8412 345 "}, ANA)
    assert r == {"encontrado": False, "codigo": "8412345"}
    p = await server.reparto_mis_pedidos({"codigo": "8412345", "cliente": "Marta",
                                          "direccion": "Avda Montero Ríos 12, 15003", "de_ticket": True}, ANA)
    assert p["conductor_id"] == "d1" and p["lat"] == 43.3690 and p["origen"] == "ticket"
    r = await server.reparto_escanear({"codigo": "8412345"}, ANA)
    assert r["encontrado"] and r["pedido"]["id"] == p["id"] and r["pedido"]["escaneos"] == 2
    assert len(base.db["reparto_pedidos"].docs) == 1
    # Otro conductor no se lo puede quedar.
    with pytest.raises(HTTPException) as e:
        await server.reparto_escanear({"codigo": "8412345"}, LUIS)
    assert e.value.status_code == 409


@pytest.mark.asyncio(loop_scope="session")
async def test_cada_conductor_ve_y_cierra_solo_lo_suyo(base):
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5"}, ANA)
    ruta_luis = await server.reparto_mi_ruta(LUIS)
    assert ruta_luis["activo"] and ruta_luis["pedidos"] == []
    with pytest.raises(HTTPException) as e:
        await server.reparto_estado(p["id"], {"estado": "entregado"}, LUIS)
    assert e.value.status_code == 403
    r = await server.reparto_estado(p["id"], {"estado": "entregado"}, ANA)
    assert r["estado"] == "entregado" and r["cerrado_en"]


@pytest.mark.asyncio(loop_scope="session")
async def test_el_dueno_entrando_como_la_empresa_no_ve_datos_de_clientes(base):
    await server.reparto_crear({"cliente": "Marta", "telefono": "600111222",
                                "direccion": "Rúa Real 5"}, OFICINA)
    vista = await server.reparto_pedidos("", DUENO_COMO_EMPRESA)
    p = vista["pedidos"][0]
    assert p["cliente"] == "•••" and p["telefono"] == "•••" and p["lat"] is None
    assert vista["ve_datos"] is False and vista["base"] is None
    with pytest.raises(HTTPException):
        await server.reparto_crear({"direccion": "Rúa Real 5"}, DUENO_COMO_EMPRESA)
    # La oficina de la empresa sí lo ve.
    assert (await server.reparto_pedidos("", OFICINA))["pedidos"][0]["cliente"] == "Marta"


@pytest.mark.asyncio(loop_scope="session")
async def test_ubicacion_solo_en_jornada_y_con_aviso(base):
    with pytest.raises(HTTPException) as e:
        await server.reparto_posicion({"lat": 43.37, "lng": -8.40}, ANA)
    assert e.value.status_code == 409
    assert base.db["reparto_jornadas"].docs == []
    with pytest.raises(HTTPException) as e:
        await server.reparto_jornada({"accion": "empezar"}, ANA)
    assert e.value.status_code == 428
    await server.reparto_jornada({"accion": "empezar", "acepto_aviso": True}, ANA)
    await server.reparto_posicion({"lat": 43.37, "lng": -8.40}, ANA)
    vivo = await server.reparto_vivo(OFICINA)
    assert vivo["conductores"][0]["conductor_id"] == "d1"
    assert (await server.reparto_vivo(DUENO_COMO_EMPRESA))["conductores"] == []
    await server.reparto_jornada({"accion": "terminar"}, ANA)
    assert (await server.reparto_vivo(OFICINA))["conductores"] == []
    with pytest.raises(HTTPException):
        await server.reparto_posicion({"lat": 43.37, "lng": -8.40}, ANA)
    # La segunda vez ya no pide el aviso.
    await server.reparto_jornada({"accion": "empezar"}, ANA)


@pytest.mark.asyncio(loop_scope="session")
async def test_zonas_reparten_y_la_ruta_se_ordena_desde_el_almacen(base):
    await server.reparto_ajustes_put({"base_direccion": "Almacén", "zonas": [
        {"nombre": "Centro", "cps": "15003", "palabras": "Real", "conductor_id": "d2"}]}, OFICINA)
    await server.reparto_pegar({"texto": "Código;Cliente;Dirección\nA1;Ana;Rúa Real 5\n"
                                         "A2;Bea;Avda Montero Ríos 12, 15003\n", "confirmar": True}, OFICINA)
    await server._rep_ubicar_pendientes(HOY)
    ps = base.db["reparto_pedidos"].docs
    assert {p["conductor_id"] for p in ps} == {"d2"} and all(p["geo"] == "ok" for p in ps)
    await server.reparto_ordenar({}, OFICINA)
    orden = sorted(ps, key=lambda p: p["orden"])
    assert [p["codigo"] for p in orden] == ["A2", "A1"]      # Montero Ríos queda más cerca del almacén
    # Repetir la pegada no duplica.
    r = await server.reparto_pegar({"texto": "Código;Cliente;Dirección\nA1;Ana;Rúa Real 5\n",
                                    "confirmar": True}, OFICINA)
    assert r == {"creados": 0, "repetidos": 1, "fecha": HOY}


@pytest.mark.asyncio(loop_scope="session")
async def test_los_datos_personales_se_borran_solos(base):
    base.db["reparto_pedidos"].docs.append({"id": "viejo", "fecha": "2026-08-01", "cliente": "Marta",
                                            "telefono": "600", "direccion": "Real 5", "lat": 1, "lng": 1,
                                            "zona": "Centro", "estado": "entregado"})
    base.db["reparto_jornadas"].docs.append({"id": "j", "fecha": "2026-08-01", "rastro": [[1, 1, "x"]]})
    await server.reparto_pedidos("2026-08-01", OFICINA)
    p = base.db["reparto_pedidos"].docs[0]
    assert p["cliente"] is None and p["direccion"] is None and p["anonimizado"]
    assert p["zona"] == "Centro" and p["estado"] == "entregado"
    assert base.db["reparto_jornadas"].docs == []


@pytest.mark.asyncio(loop_scope="session")
async def test_ticket_con_ia_apagada_no_sale_de_la_empresa(base):
    class Foto:
        async def read(self, n=-1):
            return b"x" * 1000
    with pytest.raises(HTTPException) as e:
        await server.reparto_ticket(Foto(), ANA)
    assert e.value.status_code == 403


@pytest.mark.asyncio(loop_scope="session")
async def test_ia_de_tickets_solo_con_clave_de_pago(base, monkeypatch):
    monkeypatch.delenv("REPARTO_IA_PERMITIDA", raising=False)
    a = await server.reparto_ajustes_put({"ia_tickets": True}, OFICINA)
    assert a["ia_tickets"] is False and a["ia_disponible"] is False
    monkeypatch.setenv("REPARTO_IA_PERMITIDA", "1")
    a = await server.reparto_ajustes_put({"ia_tickets": True}, OFICINA)
    assert a["ia_tickets"] is True
    # Si luego se quita la clave de pago, deja de leer aunque estuviera encendida.
    monkeypatch.delenv("REPARTO_IA_PERMITIDA")
    assert (await server.reparto_mi_ruta(ANA))["ia_tickets"] is False
