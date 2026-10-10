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
    # La base GLOBAL también de mentira: el índice de enlaces de seguimiento
    # vive ahí, y una prueba no puede tocar la de verdad.
    globales = Db()
    monkeypatch.setattr(server, "global_db", globales)
    class _Cliente(dict):
        def __missing__(self, _nombre):
            return db
    monkeypatch.setattr(server, "client", _Cliente())
    monkeypatch.setattr(server, "_rep_ubicar", ubicar)

    async def matriz(puntos):
        seg, met = server.reparto.matriz_en_linea_recta(puntos)
        return seg, met, "linea_recta"
    monkeypatch.setattr(server, "_rep_matriz", matriz)
    monkeypatch.setattr(server, "get_org", org)
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)
    server._REP_LIMPIEZA.clear()
    return SimpleNamespace(db=db, globales=globales)


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
    assert r == {"creados": 0, "repetidos": 1, "fecha": HOY, "sin_hueco": 0}


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


@pytest.mark.asyncio(loop_scope="session")
async def test_ruta_por_tiempo_con_franja_y_hora_estimada(base):
    await server.reparto_ajustes_put({"base_direccion": "Almacén", "hora_salida": "10:00",
                                      "min_parada": 5}, OFICINA)
    a = await server._rep_nuevo({"codigo": "B1", "direccion": "Rúa Real 5", "conductor_id": "d1",
                                 "notas": "Entregar de 12 a 13"}, OFICINA, "oficina", "2026-10-10")
    b = await server._rep_nuevo({"codigo": "B2", "direccion": "Avda Montero Ríos 12", "conductor_id": "d1"},
                                OFICINA, "oficina", "2026-10-10")
    assert a["ventana_desde"] == "12:00" and a["ventana_hasta"] == "13:00"
    r = await server.reparto_ordenar({"fecha": "2026-10-10"}, OFICINA)
    ruta = r["rutas"][0]
    assert ruta["salida"] == "10:00" and ruta["fuente"] == "linea_recta" and ruta["tarde"] == 0
    docs = {p["codigo"]: p for p in base.db["reparto_pedidos"].docs}
    # Sin franja va primero; el de la franja de 12 a 13 se espera y llega dentro.
    assert docs["B2"]["orden"] == 1 and docs["B1"]["orden"] == 2
    assert "12:00" <= docs["B1"]["eta"] <= "13:00" and docs["B1"]["espera_min"] > 0
    vista = await server.reparto_pedidos("2026-10-10", OFICINA)
    assert vista["conductores"][0]["ruta"]["paradas"] == 2


@pytest.mark.asyncio(loop_scope="session")
async def test_el_autonomo_es_su_propio_repartidor(base, monkeypatch):
    async def org_autonomo(_id):
        return {"id": "o1", "account_type": "dsp", "sector": "autonomo",
                "modulos": ["dashboard", "reparto", "configuracion"]}
    monkeypatch.setattr(server, "get_org", org_autonomo)
    yo = {"sub": "a9", "role": "admin", "name": "Pepe", "org_id": "o1", "db_name": "dsp_x"}
    r = await server.reparto_mi_ruta(yo)
    assert r["activo"] and r["autonomo"] and r["pedidos"] == []
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5", "telefono": "600111222"}, yo)
    assert p["conductor_id"] == "a9"
    assert any(d["id"] == "a9" for d in base.db["drivers"].docs)
    assert (await server.reparto_estado(p["id"], {"estado": "entregado"}, yo))["estado"] == "entregado"


@pytest.mark.asyncio(loop_scope="session")
async def test_un_admin_que_no_es_autonomo_no_tiene_mi_ruta(base):
    assert (await server.reparto_mi_ruta(OFICINA)) == {"activo": False}


@pytest.mark.asyncio(loop_scope="session")
async def test_estadisticas_sobreviven_al_borrado_de_datos(base):
    base.db["reparto_pedidos"].docs += [
        {"id": "1", "fecha": "2026-10-02", "estado": "entregado", "zona": "Centro", "conductor_id": "d1",
         "conductor_nombre": "ANA", "anonimizado": True, "cliente": None},
        {"id": "2", "fecha": "2026-10-02", "estado": "fallido", "motivo": "No había nadie", "zona": "Centro",
         "conductor_id": "d1", "conductor_nombre": "ANA"},
        {"id": "3", "fecha": "2026-10-03", "estado": "pendiente", "zona": "Os Mallos", "conductor_id": "d2",
         "conductor_nombre": "LUIS", "ventana_desde": "10:00", "tarde_min": 5},
        {"id": "4", "fecha": "2026-08-01", "estado": "entregado"},
    ]
    r = await server.reparto_estadisticas(14, OFICINA)
    assert r["total"] == 3 and r["entregados"] == 1 and r["tasa_entrega"] == 50
    assert r["motivos"] == [{"motivo": "No había nadie", "n": 1}]
    assert r["franjas"] == {"con_franja": 1, "previstas_tarde": 1}
    assert len(r["por_dia"]) == 14 and r["por_dia"][-1]["fecha"] == "2026-10-03"
    assert r["por_repartidor"][0]["nombre"] == "ANA" and r["por_repartidor"][0]["total"] == 2



@pytest.mark.asyncio(loop_scope="session")
async def test_cobro_recogida_y_reintento(base):
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5", "cobrar": "23,50 €"}, ANA)
    assert p["cobrar"] == 23.5 and p["tipo"] == "entrega"
    with pytest.raises(HTTPException) as e:
        await server.reparto_estado(p["id"], {"estado": "entregado"}, ANA)
    assert e.value.status_code == 400                 # sin decir cómo pagó, no
    r = await server.reparto_estado(p["id"], {"estado": "entregado", "metodo": "bizum"}, ANA)
    assert r["cobrado_metodo"] == "bizum" and r["cobrado_importe"] == 23.5
    vista = await server.reparto_pedidos("", OFICINA)
    ana = next(c for c in vista["conductores"] if c["conductor_id"] == "d1")
    assert ana["a_cobrar"] == 23.5 and ana["cobrado"] == {"bizum": 23.5}
    # Fuera de España no hay Bizum: se acepta la transferencia.
    t = await server.reparto_mis_pedidos({"direccion": "Rúa Real 7", "cobrar": "10"}, ANA)
    r = await server.reparto_estado(t["id"], {"estado": "entregado", "metodo": "transferencia"}, ANA)
    assert r["cobrado_metodo"] == "transferencia"
    rec = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5", "tipo": "Recogida de envases"}, ANA)
    assert rec["tipo"] == "recogida"
    f = await server.reparto_estado(rec["id"], {"estado": "fallido", "motivo": "No había nadie"}, ANA)
    m = await server.reparto_editar(f["id"], {"fecha": "2026-10-04"}, OFICINA)
    assert m["fecha"] == "2026-10-04" and m["estado"] == "pendiente" and m["reintento"] == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_seguimiento_del_cliente_sin_datos_personales(base, monkeypatch):
    # Las 10:00 de un viernes: la franja de 12 a 13 todavía no ha pasado.
    monkeypatch.setattr(server, "_rep_ahora_local", lambda: (600, 4))
    await server.reparto_ajustes_put({"base_direccion": "Almacén"}, OFICINA)
    a = await server.reparto_mis_pedidos({"direccion": "Avda Montero Ríos 12", "telefono": "600111222",
                                          "cliente": "Marta"}, ANA)
    b = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5", "telefono": "600333444",
                                          "cliente": "Bea", "notas": "Entregar de 12 a 13"}, ANA)
    await server.reparto_mi_ordenar({}, ANA)
    ruta = await server.reparto_mi_ruta(ANA)
    tok = {p["cliente"]: p["seguimiento"] for p in ruta["pedidos"]}
    assert all(tok.values()) and len(tok["Bea"]) >= 16
    pub = await server.seguimiento_publico(tok["Bea"], SimpleNamespace(headers={}, client=SimpleNamespace(host="1.1.1.1")))
    assert pub["estado"] == "pendiente" and pub["paradas_antes"] == 1 and pub["franja"] == ["12:00", "13:00"]
    texto = str(pub)
    for prohibido in ("Bea", "Real", "600333444", "lat", "direccion", "cliente", "telefono"):
        assert prohibido not in texto, prohibido
    with pytest.raises(HTTPException):
        await server.seguimiento_publico("no-existe-este-token-xx", SimpleNamespace(headers={}, client=SimpleNamespace(host="1.1.1.1")))
    # Caducado: ya no se ve.
    base.globales["reparto_enlaces"].docs[0]["caduca"] = "2026-10-01"
    with pytest.raises(HTTPException):
        await server.seguimiento_publico(base.globales["reparto_enlaces"].docs[0]["token"],
                                         SimpleNamespace(headers={}, client=SimpleNamespace(host="1.1.1.1")))


@pytest.mark.asyncio(loop_scope="session")
async def test_prueba_de_entrega_con_foto(base):
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5"}, ANA)
    foto = "data:image/jpeg;base64," + "A" * 2000
    with pytest.raises(HTTPException):
        await server.reparto_estado(p["id"], {"estado": "entregado", "foto": "data:image/png;base64,xx"}, ANA)
    r = await server.reparto_estado(p["id"], {"estado": "entregado", "foto": foto, "nota": "Al vecino del 2º"}, ANA)
    assert r["entrega_foto"] == foto and r["entrega_nota"] == "Al vecino del 2º"
    # La lista de la oficina no carga con la foto, pero dice que la hay.
    vista = await server.reparto_pedidos("", OFICINA)
    assert "entrega_foto" not in vista["pedidos"][0] and vista["pedidos"][0]["tiene_foto"] is True
    assert (await server.reparto_foto(p["id"], OFICINA))["foto"] == foto
    with pytest.raises(HTTPException) as e:
        await server.reparto_foto(p["id"], DUENO_COMO_EMPRESA)
    assert e.value.status_code == 403
    # Y se borra con el resto de datos personales.
    base.db["reparto_pedidos"].docs[0]["fecha"] = "2026-08-01"
    server._REP_LIMPIEZA.clear()
    await server.reparto_pedidos("2026-08-01", OFICINA)
    assert base.db["reparto_pedidos"].docs[0]["entrega_foto"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_orden_a_mano_recalcula_horas_y_no_reordena(base, monkeypatch):
    monkeypatch.setattr(server, "_rep_ahora_local", lambda: (600, 4))
    await server.reparto_ajustes_put({"base_direccion": "Almacén"}, OFICINA)
    a = await server.reparto_mis_pedidos({"direccion": "Avda Montero Ríos 12"}, ANA)
    b = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5"}, ANA)
    await server.reparto_mi_ordenar({}, ANA)
    optimo = {p["id"]: p["orden"] for p in base.db["reparto_pedidos"].docs}
    # Al revés de lo que dio el optimizador:
    al_reves = sorted(optimo, key=lambda k: -optimo[k])
    r = await server.reparto_mi_orden({"ids": al_reves}, ANA)
    assert r["ruta"]["manual"] is True and r["ordenados"] == 2
    nuevo = {p["id"]: p["orden"] for p in base.db["reparto_pedidos"].docs}
    assert [k for k in sorted(nuevo, key=nuevo.get)] == al_reves
    assert all(p["eta"] for p in base.db["reparto_pedidos"].docs)
    # No se pueden ordenar paradas de otro.
    otro = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5"}, LUIS)
    with pytest.raises(HTTPException) as e:
        await server.reparto_mi_orden({"ids": [a["id"], otro["id"]]}, ANA)
    assert e.value.status_code == 403


@pytest.mark.asyncio(loop_scope="session")
async def test_hueco_en_la_furgoneta_solo_en_lo_mio(base):
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5", "hueco": "Detrás · izq"}, ANA)
    assert p["hueco"] == "Detrás · izq"
    r = await server.reparto_mi_editar(p["id"], {"hueco": "Delante · der", "notas": "timbre 2B"}, ANA)
    assert r["hueco"] == "Delante · der"
    with pytest.raises(HTTPException) as e:
        await server.reparto_mi_editar(p["id"], {"hueco": "x"}, LUIS)
    assert e.value.status_code == 403


@pytest.mark.asyncio(loop_scope="session")
async def test_quien_reparte_solo_pega_su_lista_y_es_suya(base, monkeypatch):
    async def org_autonomo(_id):
        return {"id": "o1", "account_type": "dsp", "sector": "autonomo",
                "modulos": ["dashboard", "reparto", "configuracion"]}
    monkeypatch.setattr(server, "get_org", org_autonomo)
    yo = {"sub": "a9", "role": "admin", "name": "Pepe", "org_id": "o1", "db_name": "dsp_x"}
    r = await server.reparto_pegar({"texto": "Rúa Real 5, A Coruña\nAvda Montero Ríos 12, 15003", "confirmar": True}, yo)
    assert r["creados"] == 2
    assert {p["conductor_id"] for p in base.db["reparto_pedidos"].docs} == {"a9"}
    assert (await server.reparto_mi_ruta(yo))["puede_pegar"] is True


@pytest.mark.asyncio(loop_scope="session")
async def test_trazado_va_por_lo_pendiente_en_orden_desde_donde_estoy(base, monkeypatch):
    vistos = []

    async def trazado(puntos):
        vistos.append(puntos)
        return {"linea": [list(p) for p in puntos], "fuente": "carreteras", "km": 3.2, "minutos": 9}
    monkeypatch.setattr(server, "_rep_trazado", trazado)
    a = await server.reparto_mis_pedidos({"direccion": "Avda Montero Ríos 12"}, ANA)
    b = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5"}, ANA)
    c = await server.reparto_mis_pedidos({"direccion": "Calle San Andrés 30"}, ANA)
    for p, n, la in ((a, 2, 43.1), (b, 1, 43.2), (c, 3, 43.3)):
        await base.db.reparto_pedidos.update_one({"id": p["id"]}, {"$set": {"orden": n, "lat": la, "lng": -8.4}})
    await server.reparto_estado(c["id"], {"estado": "entregado"}, ANA)
    r = await server.reparto_mi_trazado({"desde": {"lat": 43.0, "lng": -8.4}}, ANA)
    assert r["fuente"] == "carreteras"
    assert vistos[-1] == [(43.0, -8.4), (43.2, -8.4), (43.1, -8.4)]   # yo, orden 1, orden 2; lo entregado no


@pytest.mark.asyncio(loop_scope="session")
async def test_trazado_sin_servidor_de_rutas_va_en_linea_recta(monkeypatch):
    import httpx

    class Roto:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            raise httpx.ConnectError("sin red")

        async def __aexit__(self, *a):
            return False
    monkeypatch.setattr(httpx, "AsyncClient", Roto)
    server._REP_TRAZADOS.clear()
    r = await server._rep_trazado([(43.0, -8.4), (43.01, -8.41)])
    assert r["fuente"] == "linea_recta" and r["linea"] == [[43.0, -8.4], [43.01, -8.41]]


@pytest.mark.asyncio(loop_scope="session")
async def test_navegar_solo_a_lo_mio_pendiente_y_con_ubicacion(base, monkeypatch):
    vistos = []

    async def nav(desde, hasta):
        vistos.append((desde, hasta))
        return {"fuente": "carreteras", "linea": [list(desde), list(hasta)], "metros": 900, "minutos": 3,
                "pasos": [{"texto": "Gira a la derecha por Rúa Real", "icono": "derecha", "punto": list(hasta), "calle": "Rúa Real", "metros": 0}]}
    monkeypatch.setattr(server, "_rep_navegacion", nav)
    a = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5"}, ANA)
    await base.db.reparto_pedidos.update_one({"id": a["id"]}, {"$set": {"lat": 43.37, "lng": -8.40}})
    r = await server.reparto_mi_navegar({"id": a["id"], "desde": {"lat": 43.36, "lng": -8.41}}, ANA)
    assert r["pasos"][0]["texto"].startswith("Gira") and vistos == [((43.36, -8.41), (43.37, -8.40))]
    for datos, quien, codigo in (({"id": a["id"]}, ANA, 400),                                   # sin ubicación
                                 ({"id": a["id"], "desde": {"lat": 43.3, "lng": -8.4}}, LUIS, 403),   # de otro
                                 ({"id": "nada", "desde": {"lat": 43.3, "lng": -8.4}}, ANA, 404)):
        with pytest.raises(HTTPException) as e:
            await server.reparto_mi_navegar(datos, quien)
        assert e.value.status_code == codigo
    await server.reparto_estado(a["id"], {"estado": "fallido", "motivo": "No había nadie"}, ANA)
    with pytest.raises(HTTPException) as e:
        await server.reparto_mi_navegar({"id": a["id"], "desde": {"lat": 43.3, "lng": -8.4}}, ANA)
    assert e.value.status_code == 409


@pytest.mark.asyncio(loop_scope="session")
async def test_navegacion_sin_servidor_de_rutas_da_la_direccion_en_recto(monkeypatch):
    import httpx

    class Roto:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            raise httpx.ConnectError("sin red")

        async def __aexit__(self, *a):
            return False
    monkeypatch.setattr(httpx, "AsyncClient", Roto)
    server._REP_NAVEGACION.clear()
    r = await server._rep_navegacion((43.0, -8.4), (43.001, -8.4))
    assert r["fuente"] == "linea_recta" and r["pasos"][0]["texto"] == "Ve hacia la parada"
    assert 100 <= r["metros"] <= 120
    assert server._REP_NAVEGACION == {}   # lo fallido no se guarda: el siguiente intento vuelve a preguntar


@pytest.mark.asyncio(loop_scope="session")
async def test_trazado_usa_el_respaldo_y_no_guarda_el_fallo(monkeypatch):
    """Si el servidor principal de rutas no contesta se pregunta al de respaldo;
    y un fallo total NO se queda guardado (antes dejaba rayas rectas hasta reiniciar)."""
    import httpx
    llamadas = []

    class Resp:
        def __init__(self, ok):
            self.status_code = 200 if ok else 503
            self._ok = ok

        def json(self):
            return {"code": "Ok", "routes": [{"distance": 1500, "duration": 180,
                    "geometry": {"coordinates": [[-8.4, 43.0], [-8.405, 43.005], [-8.41, 43.01]]}}]} if self._ok else {}

    def cliente(principal_ok, respaldo_ok):
        class C:
            def __init__(self, *a, **k):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            async def get(self, url, params=None):
                llamadas.append(url)
                return Resp(respaldo_ok if "router.project-osrm.org" in url else principal_ok)
        return C
    pts = [(43.0, -8.4), (43.01, -8.41)]
    monkeypatch.setattr(server, "_REP_RUTAS_ULTIMA", [0.0])
    monkeypatch.setattr(httpx, "AsyncClient", cliente(False, True))
    server._REP_TRAZADOS.clear()
    r = await server._rep_trazado(pts)
    assert r["fuente"] == "carreteras" and len(r["linea"]) == 3 and len(llamadas) == 2
    # Todo caído: rayas rectas, y NO se guarda.
    server._REP_TRAZADOS.clear()
    monkeypatch.setattr(httpx, "AsyncClient", cliente(False, False))
    r = await server._rep_trazado(pts)
    assert r["fuente"] == "linea_recta" and server._REP_TRAZADOS == {}
    # Y al volver el servidor, el siguiente intento ya da calles.
    monkeypatch.setattr(httpx, "AsyncClient", cliente(True, True))
    r = await server._rep_trazado(pts)
    assert r["fuente"] == "carreteras"


@pytest.mark.asyncio(loop_scope="session")
async def test_editar_una_parada_cambia_la_direccion_y_la_vuelve_a_situar(base):
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5", "cliente": "Bar Pepe", "telefono": "600000001"}, ANA)
    assert (p["lat"], p["lng"]) == (43.3712, -8.3990)
    r = await server.reparto_mi_editar(p["id"], {"direccion": "Avda. Montero Ríos 12", "cliente": "Farmacia Sol",
                                                 "bultos": "3", "cobrar": "12,50", "prioridad": True}, ANA)
    assert (r["lat"], r["lng"]) == (43.3690, -8.4050) and r["cliente"] == "Farmacia Sol"
    assert r["bultos"] == 3 and r["cobrar"] == 12.5 and r["prioridad"] is True
    # Una dirección que no se encuentra no se inventa: queda sin punto.
    r = await server.reparto_mi_editar(p["id"], {"direccion": "Calle que no existe 99"}, ANA)
    assert r["lat"] is None and r["geo"] == "no"
    # Dirección demasiado corta: se rechaza y no cambia nada.
    with pytest.raises(HTTPException) as e:
        await server.reparto_mi_editar(p["id"], {"direccion": "ab"}, ANA)
    assert e.value.status_code == 400
    # Con el sitio ya elegido en el buscador (coordenadas), se respeta.
    r = await server.reparto_mi_editar(p["id"], {"direccion": "Rúa Nueva 1", "lat": 43.3, "lng": -8.4}, ANA)
    assert (r["lat"], r["lng"], r["geo"]) == (43.3, -8.4, "manual")


@pytest.mark.asyncio(loop_scope="session")
async def test_editar_no_toca_lo_cerrado_ni_lo_de_otro(base):
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5"}, ANA)
    with pytest.raises(HTTPException) as e:
        await server.reparto_mi_editar(p["id"], {"cliente": "X"}, LUIS)
    assert e.value.status_code == 403
    await server.reparto_estado(p["id"], {"estado": "entregado"}, ANA)
    with pytest.raises(HTTPException) as e:
        await server.reparto_mi_editar(p["id"], {"direccion": "Rúa Real 7"}, ANA)
    assert e.value.status_code == 409
    # La nota y el hueco sí se pueden poner siempre.
    r = await server.reparto_mi_editar(p["id"], {"notas": "lo dejé en portería"}, ANA)
    assert r["notas"] == "lo dejé en portería"


@pytest.mark.asyncio(loop_scope="session")
async def test_quitar_una_parada(base, monkeypatch):
    mia = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5"}, ANA)          # la metió ella
    de_oficina = await server._rep_nuevo({"direccion": "Avda. Montero Ríos 12", "conductor_id": "d1"}, OFICINA, "oficina", HOY)
    # Lo que mandó la oficina, no lo quita la repartidora de empresa.
    with pytest.raises(HTTPException) as e:
        await server.reparto_mi_quitar(de_oficina["id"], ANA)
    assert e.value.status_code == 403
    # Lo suyo sí; de otro, no.
    with pytest.raises(HTTPException) as e:
        await server.reparto_mi_quitar(mia["id"], LUIS)
    assert e.value.status_code == 403
    assert (await server.reparto_mi_quitar(mia["id"], ANA))["ok"]
    assert await server.db.reparto_pedidos.find_one({"id": mia["id"]}) is None
    with pytest.raises(HTTPException) as e:
        await server.reparto_mi_quitar(mia["id"], ANA)
    assert e.value.status_code == 404
    # Quien reparte solo puede quitar cualquiera de las suyas.
    async def autonomo(_u):
        return True
    monkeypatch.setattr(server, "_rep_es_autonomo", autonomo)
    assert (await server.reparto_mi_quitar(de_oficina["id"], ANA))["ok"]
    # Y una ya entregada no se quita.
    otra = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5"}, ANA)
    await server.reparto_estado(otra["id"], {"estado": "entregado"}, ANA)
    with pytest.raises(HTTPException) as e:
        await server.reparto_mi_quitar(otra["id"], ANA)
    assert e.value.status_code == 409


@pytest.mark.asyncio(loop_scope="session")
async def test_paradas_de_ejemplo_se_ponen_alrededor_y_se_quitan(base):
    r = await server.reparto_mis_ejemplo({"lat": 43.36, "lng": -8.41}, ANA)
    assert r["n"] == 3
    ps = [p async for p in server.db.reparto_pedidos.find({"conductor_id": "d1", "ejemplo": True}, {"_id": 0})]
    assert len(ps) == 3 and all(p["lat"] is not None and abs(p["lat"] - 43.36) < 0.02 for p in ps)
    assert all(p["geo"] == "manual" and p["estado"] == "pendiente" for p in ps)
    assert sorted(p["cobrar"] for p in ps) == [0, 0, 12.5]
    # Salen en su ruta y con orden.
    mi = await server.reparto_mi_ruta(ANA)
    assert len([p for p in mi["pedidos"] if p.get("ejemplo")]) == 3
    # No se duplican.
    with pytest.raises(HTTPException) as e:
        await server.reparto_mis_ejemplo({"lat": 43.36, "lng": -8.41}, ANA)
    assert e.value.status_code == 409
    # Otro conductor no los ve ni los quita.
    assert (await server.reparto_mis_quitar_ejemplos(LUIS))["quitadas"] == 0
    # Una real mezclada con los ejemplos NO se toca.
    real = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5"}, ANA)
    assert (await server.reparto_mis_quitar_ejemplos(ANA))["quitadas"] == 3
    assert await server.db.reparto_pedidos.find_one({"id": real["id"]}) is not None
