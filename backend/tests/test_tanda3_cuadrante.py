# -*- coding: utf-8 -*-
"""Tanda 3 (11-11-2026), zona del cuadrante:
  · cuadrante-2: GET /shift-requests/cobertura, cómo queda la nave cada día si se concede lo pendiente (solo lectura);
  · cuadrante-1 (parte A): GET /cuadrante devuelve también las peticiones sin contestar (`pendientes`);
  · cuadrante-8: el botón «Avisar a los conductores» (previa y envío, nunca solo).
Contra la base de mentira, con los flujos del servidor enteros. La fecha de hoy va fija (_dia_negocio), así que
ninguna prueba depende del reloj."""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Db

HOY = "2026-10-18"          # domingo
MAN = "2026-10-19"          # lunes
PAS = "2026-10-20"          # martes
OFI = {"sub": "a1", "role": "admin", "name": "Oficina", "org_id": "owner"}
SOLO_DGA1 = {"sub": "a4", "role": "admin", "name": "Jefe DGA1", "org_id": "owner", "allowed_centers": ["DGA1"]}


@pytest.fixture
def base(monkeypatch):
    t = Db()
    t["drivers"] = Col([
        {"id": "d1", "name": "Ana", "center": "OGA5", "active": True},
        {"id": "d2", "name": "Luis", "center": "OGA5", "active": True},
        {"id": "d3", "name": "Pepe", "center": "OGA5", "active": True},
        {"id": "d4", "name": "Sara", "center": "OGA5", "active": True},
        {"id": "d9", "name": "Diego", "center": "DGA1", "active": True},
    ])
    turno = lambda did, tipo, cod, centro="OGA5", fecha=MAN: {  # noqa: E731
        "driver_id": did, "date": fecha, "type": tipo, "cod": cod, "center": centro}
    t["shifts"] = Col([turno("d1", "trabaja", "1"), turno("d2", "trabaja", "1"), turno("d3", "trabaja", "T"),
                       turno("d4", "libre", "N/T"), turno("d9", "trabaja", "1", centro="DGA1")])
    t["shift_requests"] = Col([])
    t["route_demand"] = Col([])
    t["cuadrante_ajustes"] = Col([])
    t["cuadrante_config"] = Col([])
    t["cuadrante_personas"] = Col([])
    avisos = []

    async def push(ids, titulo, cuerpo, url="/panel"):
        avisos.append(SimpleNamespace(ids=sorted(ids), titulo=titulo, cuerpo=cuerpo, url=url))

    async def sin_fcm(docs):
        return 0

    monkeypatch.setattr(server, "db", t)
    monkeypatch.setattr(server, "global_db", Db())
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)
    monkeypatch.setattr(server, "send_web_push_to_users", push)
    monkeypatch.setattr(server, "_fcm_enviar", sin_fcm)
    return SimpleNamespace(t=t, avisos=avisos)


def _peticion(t, rid, fecha, did="d1", tipo="libre", estado="pendiente", centro="OGA5", grupo=None):
    t["shift_requests"].docs.append({
        "id": rid, "grupo": grupo or rid, "center": centro, "driver_id": did, "driver_name": did,
        "date": fecha, "type": tipo, "status": estado, "motivo": "asuntos"})


def _maxima(t, fecha, m, centro="OGA5"):
    t["route_demand"].docs.append({"center": centro, "date": fecha, "maximo": m})


# ── cuadrante-2: la cobertura de cada día pedido ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_cobertura_cuenta_en_ruta_y_dice_quien_trabaja(base):
    _maxima(base.t, MAN, 3)
    _peticion(base.t, "r1", MAN, did="d1")                       # trabaja ese día: darle el libre resta uno
    _peticion(base.t, "r2", MAN, did="d4")                       # ya libra: no cambia nada
    r = await server.cobertura_peticiones("OGA5", None, None, OFI)
    assert (r["desde"], r["hasta"]) == (HOY, "2026-11-17")     # por defecto, de hoy a hoy+30
    d = r["dias"][MAN]
    assert (d["maximo"], d["en_ruta"], d["bajan"], d["colchon"]) == (3, 3, 0, 2)
    assert (d["pendientes_libre"], d["pendientes_extra"], d["concedidos"]) == (2, 0, 0)
    assert "d1|" + MAN in r["trabaja"]
    assert "d4|" + MAN not in r["trabaja"]
    # Solo las celdas de quien tiene algo pendiente: Luis y Pepe trabajan pero no han pedido nada.
    assert r["trabaja"] == ["d1|" + MAN]


@pytest.mark.asyncio(loop_scope="session")
async def test_cobertura_sin_maxima_no_inventa_nada(base):
    _peticion(base.t, "r1", PAS, did="d1", tipo="extra")
    r = await server.cobertura_peticiones("OGA5", HOY, PAS, OFI)
    assert r["dias"] == {PAS: {"maximo": None, "en_ruta": None, "bajan": 0, "colchon": 2, "concedidos": 0,
                               "pendientes_libre": 0, "pendientes_extra": 1}}
    # Ana trabaja el lunes, pero solo ha pedido el martes: en `trabaja` van solo las celdas pedidas.
    assert r["trabaja"] == []


@pytest.mark.asyncio(loop_scope="session")
async def test_cobertura_pide_un_centro_y_que_sea_tuyo(base):
    for centro in ("", "Todos", "todos", "all"):
        with pytest.raises(HTTPException) as e:
            await server.cobertura_peticiones(centro, None, None, OFI)
        assert e.value.status_code == 400
    with pytest.raises(HTTPException) as e:
        await server.cobertura_peticiones("OGA5", None, None, SOLO_DGA1)
    assert e.value.status_code == 403
    assert (await server.cobertura_peticiones("DGA1", None, None, SOLO_DGA1))["center"] == "DGA1"


@pytest.mark.asyncio(loop_scope="session")
async def test_cobertura_con_fechas_malas_o_un_rango_enorme_dice_que_no(base):
    for desde, hasta in (("ayer", None), (HOY, "2026-13-01"), (PAS, MAN), (HOY, "2026-12-19")):
        with pytest.raises(HTTPException) as e:
            await server.cobertura_peticiones("OGA5", desde, hasta, OFI)
        assert e.value.status_code == 400
    # 62 días justos sí.
    r = await server.cobertura_peticiones("OGA5", HOY, "2026-12-18", OFI)
    assert r["hasta"] == "2026-12-18"


@pytest.mark.asyncio(loop_scope="session")
async def test_cobertura_suma_los_que_bajan_igual_que_refuerzos(base):
    _maxima(base.t, MAN, 6)
    base.t["cuadrante_ajustes"].docs.append({"center": "OGA5", "tipo": "refuerzo_dia", "fecha": MAN, "refuerzo": 2})
    _peticion(base.t, "r1", MAN)
    d = (await server.cobertura_peticiones("OGA5", HOY, PAS, OFI))["dias"][MAN]
    falta = (await server.refuerzos_faltas("OGA5", 14, OFI))["faltas"]
    assert (d["maximo"], d["en_ruta"], d["bajan"]) == (6, 3, 2)
    assert [(x["date"], x["en_ruta"], x["bajan"], x["falta"]) for x in falta] == [(MAN, 3, 2, 1)]
    # La diferencia del chip (en ruta + bajan − máxima) es la misma que lo que falta en Refuerzos, con el signo al revés.
    assert d["en_ruta"] + d["bajan"] - d["maximo"] == -falta[0]["falta"]


@pytest.mark.asyncio(loop_scope="session")
async def test_cobertura_cuenta_concedidos_y_pendientes_por_nave_y_fecha(base):
    _maxima(base.t, MAN, 3)
    _peticion(base.t, "a1", MAN, did="d2", estado="aprobado")
    _peticion(base.t, "a2", MAN, did="d3", estado="aprobado", tipo="extra")      # un extra concedido no es un libre
    _peticion(base.t, "x1", MAN, did="d3", estado="rechazado")
    _peticion(base.t, "x2", MAN, did="d4", estado="cancelado")
    _peticion(base.t, "p1", MAN, did="d1")
    _peticion(base.t, "p2", PAS, did="d1")
    _peticion(base.t, "p3", MAN, did="d4", tipo="extra")
    _peticion(base.t, "o1", MAN, did="d9", centro="DGA1")                         # otra nave: no cuenta aquí
    _peticion(base.t, "o2", MAN, did="d9", centro="DGA1", estado="aprobado")
    dias = (await server.cobertura_peticiones("OGA5", HOY, PAS, OFI))["dias"]
    assert (dias[MAN]["concedidos"], dias[MAN]["pendientes_libre"], dias[MAN]["pendientes_extra"]) == (1, 1, 1)
    assert (dias[PAS]["concedidos"], dias[PAS]["pendientes_libre"], dias[PAS]["maximo"]) == (0, 1, None)


@pytest.mark.asyncio(loop_scope="session")
async def test_cobertura_usa_el_colchon_del_cuadrante(base):
    _maxima(base.t, MAN, 3)
    _maxima(base.t, PAS, 3)
    base.t["cuadrante_config"].docs.append({"center": "OGA5", "colchon": 4})
    base.t["cuadrante_ajustes"].docs.append({"center": "OGA5", "tipo": "colchon_dia", "fecha": PAS, "colchon": 1})
    dias = (await server.cobertura_peticiones("OGA5", HOY, PAS, OFI))["dias"]
    assert (dias[MAN]["colchon"], dias[PAS]["colchon"]) == (4, 1)


@pytest.mark.asyncio(loop_scope="session")
async def test_la_bandeja_de_siempre_no_cambia(base):
    """La lista de peticiones que lee la web vieja (y el resto del panel) es la misma de antes."""
    _peticion(base.t, "p1", MAN)
    r = await server.list_shift_requests(center="OGA5", status="pendiente", user=OFI)
    assert list(r) == ["requests"] and [x["id"] for x in r["requests"]] == ["p1"]


# ── cuadrante-1 (parte A): las peticiones sin contestar, en el Cuadrante ──────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_el_cuadrante_trae_las_pendientes_del_rango_y_de_su_gente(base):
    _peticion(base.t, "p1", MAN, did="d1", grupo="g1")
    _peticion(base.t, "p2", PAS, did="d2", tipo="extra")
    _peticion(base.t, "a1", MAN, did="d3", estado="aprobado")
    _peticion(base.t, "x1", MAN, did="d4", estado="rechazado")
    _peticion(base.t, "x2", PAS, did="d4", estado="cancelado")
    _peticion(base.t, "o1", MAN, did="d9", centro="DGA1")              # no está en el cuadrante de OGA5
    _peticion(base.t, "f1", "2026-10-25", did="d1")                    # fuera de las fechas pedidas
    r = await server.cuadrante_ver("OGA5", MAN, PAS, OFI)
    assert r["pendientes"] == {f"d1|{MAN}": {"id": "p1", "tipo": "libre", "grupo": "g1"},
                               f"d2|{PAS}": {"id": "p2", "tipo": "extra", "grupo": "p2"}}
    # Lo de siempre sigue igual: los concedidos van en `aprobados`, con su forma de antes.
    assert r["aprobados"] == [f"d3|{MAN}"]


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_peticiones_pendientes_la_clave_va_vacia_y_lo_demas_no_cambia(base):
    r = await server.cuadrante_ver("OGA5", MAN, PAS, OFI)
    assert r["pendientes"] == {}
    assert set(r) == {"center", "desde", "hasta", "hoy", "personas", "celdas", "maximas", "objetivos", "config",
                      "ajustes", "aprobados", "propuesta", "ultimo_cambio", "tipos", "pendientes"}
    assert sorted(p["id"] for p in r["personas"]) == ["d1", "d2", "d3", "d4"]


# ── cuadrante-8: «Avisar a los conductores» (previa y envío, nunca solo) ───────────────────────────────────────────

LEJOS = "2026-11-07"        # hoy + 20: fuera de los 14 días


async def _aceptar(t, cambios, pid="pr1"):
    """Una propuesta del motor aceptada por la oficina, con el flujo de verdad (deja su registro de «Deshacer»)."""
    t["cuadrante_propuestas"].docs.append({
        "id": pid, "center": "OGA5", "estado": "pendiente", "desde": MAN, "hasta": LEJOS,
        "cambios": [{"driver_id": d, "nombre": d, "fecha": f, "antes": a, "valor": v, "extra": False}
                    for d, f, a, v in cambios]})
    return await server.cuadrante_aceptar(pid, OFI)


def _celda(t, did, fecha):
    return next((d for d in t["shifts"].docs if d["driver_id"] == did and d["date"] == fecha), None)


CAMBIOS = [("d1", MAN, "1", "N/T"),          # trabajaba y ahora libra: se avisa
           ("d2", MAN, "1", "T"),            # 1 → T: para él sigue siendo «trabajas», no se avisa
           ("d3", LEJOS, "", "N/T"),         # dentro de 20 días: todavía no
           ("d4", PAS, "", "1")]             # no tenía nada y ahora trabaja: se avisa


@pytest.mark.asyncio(loop_scope="session")
async def test_la_previa_lista_lo_que_cambia_en_los_proximos_14_dias(base):
    assert (await _aceptar(base.t, CAMBIOS))["aplicadas"] == 4
    r = await server.cuadrante_avisos_previa({"center": "OGA5"}, OFI)
    assert r["hasta"] == "2026-11-01"
    assert [(p["driver_id"], p["nombre"], [(d["fecha"], d["antes"], d["ahora"], d["texto"]) for d in p["dias"]])
            for p in r["personas"]] == [
        ("d1", "Ana", [(MAN, "trabajas", "libras", "lunes 19/10: libras")]),
        ("d4", "Sara", [(PAS, "sin turno", "trabajas", "martes 20/10: trabajas")])]
    assert len(r["cambios"]) == 1
    # La previa no manda nada ni marca nada.
    assert base.avisos == [] and base.t["avisos_movil"].docs == []
    assert "avisado_en" not in base.t["cuadrante_cambios"].docs[0]


@pytest.mark.asyncio(loop_scope="session")
async def test_un_cambio_deshecho_o_devuelto_a_como_estaba_no_avisa(base):
    await _aceptar(base.t, CAMBIOS)
    await server.cuadrante_deshacer({"center": "OGA5"}, OFI)
    assert (await server.cuadrante_avisos_previa({"center": "OGA5"}, OFI))["personas"] == []
    # Cambiado a mano y vuelto a dejar como estaba: tampoco.
    await server.cuadrante_celdas({"center": "OGA5", "cambios": [{"driver_id": "d1", "fecha": MAN, "cod": "N/T"}]}, OFI)
    await server.cuadrante_celdas({"center": "OGA5", "cambios": [{"driver_id": "d1", "fecha": MAN, "cod": "1"}]}, OFI)
    assert (await server.cuadrante_avisos_previa({"center": "OGA5"}, OFI))["personas"] == []


@pytest.mark.asyncio(loop_scope="session")
async def test_enviar_manda_un_aviso_por_persona_y_no_lo_repite(base):
    await _aceptar(base.t, CAMBIOS)
    await server.cuadrante_celdas({"center": "OGA5", "cambios": [{"driver_id": "d1", "fecha": PAS, "cod": "V"}]}, OFI)
    r = await server.cuadrante_avisos_enviar({"center": "OGA5"}, OFI)
    assert r["avisados"] == 2 and [p["driver_id"] for p in r["personas"]] == ["d1", "d4"]
    bandeja = sorted((a["user_id"], a["titulo"], a["cuerpo"], a["url"]) for a in base.t["avisos_movil"].docs)
    assert bandeja == [
        ("d1", "Cambios en tu cuadrante", "lunes 19/10: libras · martes 20/10: vacaciones", "/conductor"),
        ("d4", "Cambios en tu cuadrante", "martes 20/10: trabajas", "/conductor")]
    assert sorted(a.ids[0] for a in base.avisos) == ["d1", "d4"]          # y el push, uno por persona
    assert all(c.get("avisado_en") and c.get("avisado_hasta") == "2026-11-01"
               for c in base.t["cuadrante_cambios"].docs)
    # Ya avisado: la previa sale vacía y volver a pulsar no manda nada.
    assert (await server.cuadrante_avisos_previa({"center": "OGA5"}, OFI))["personas"] == []
    assert (await server.cuadrante_avisos_enviar({"center": "OGA5"}, OFI))["avisados"] == 0
    assert len(base.t["avisos_movil"].docs) == 2


@pytest.mark.asyncio(loop_scope="session")
async def test_dos_envios_a_la_vez_no_avisan_dos_veces(base, monkeypatch):
    await _aceptar(base.t, CAMBIOS)
    original = server._cua_avisos_registros
    dentro = []

    async def otro_pulsa_a_la_vez(center, hasta):
        regs = await original(center, hasta)
        # La primera vez, justo después de leer los registros, otra persona manda el suyo entero.
        if not dentro:
            dentro.append(1)
            await server.cuadrante_avisos_enviar({"center": "OGA5"}, OFI)
        return regs

    monkeypatch.setattr(server, "_cua_avisos_registros", otro_pulsa_a_la_vez)
    r = await server.cuadrante_avisos_enviar({"center": "OGA5"}, OFI)
    assert r["avisados"] == 0
    assert sorted(a["user_id"] for a in base.t["avisos_movil"].docs) == ["d1", "d4"]


@pytest.mark.asyncio(loop_scope="session")
async def test_driver_ids_limita_a_quien_se_avisa_y_los_desmarcados_no_vuelven(base):
    await _aceptar(base.t, CAMBIOS)
    r = await server.cuadrante_avisos_enviar({"center": "OGA5", "driver_ids": ["d4"]}, OFI)
    assert r["avisados"] == 1 and [p["driver_id"] for p in r["personas"]] == ["d4"]
    assert [a["user_id"] for a in base.t["avisos_movil"].docs] == ["d4"]
    assert (await server.cuadrante_avisos_previa({"center": "OGA5"}, OFI))["personas"] == []
    # Una lista vacía es «a nadie», no «a todos».
    await server.cuadrante_celdas({"center": "OGA5", "cambios": [{"driver_id": "d2", "fecha": MAN, "cod": "V"}]}, OFI)
    assert (await server.cuadrante_avisos_enviar({"center": "OGA5", "driver_ids": []}, OFI))["avisados"] == 0


@pytest.mark.asyncio(loop_scope="session")
async def test_una_ficha_de_baja_o_fusionada_no_se_avisa(base):
    base.t["drivers"].docs[0]["active"] = False                           # Ana, de baja
    base.t["drivers"].docs[3]["merged_into"] = "d2"                       # Sara, fusionada
    await _aceptar(base.t, CAMBIOS)
    assert (await server.cuadrante_avisos_previa({"center": "OGA5"}, OFI))["personas"] == []


@pytest.mark.asyncio(loop_scope="session")
async def test_avisar_pide_un_centro_y_que_sea_tuyo(base):
    for centro in ("", "Todos"):
        for ruta in (server.cuadrante_avisos_previa, server.cuadrante_avisos_enviar):
            with pytest.raises(HTTPException) as e:
                await ruta({"center": centro}, OFI)
            assert e.value.status_code == 400
    for ruta in (server.cuadrante_avisos_previa, server.cuadrante_avisos_enviar):
        with pytest.raises(HTTPException) as e:
            await ruta({"center": "OGA5"}, SOLO_DGA1)
        assert e.value.status_code == 403


@pytest.mark.asyncio(loop_scope="session")
async def test_avisado_y_deshecho_despues_se_avisa_otra_vez(base):
    await _aceptar(base.t, CAMBIOS)
    await server.cuadrante_avisos_enviar({"center": "OGA5"}, OFI)
    await server.cuadrante_deshacer({"center": "OGA5"}, OFI)
    assert _celda(base.t, "d1", MAN)["cod"] == "1"
    r = await server.cuadrante_avisos_previa({"center": "OGA5"}, OFI)
    # Se le dijo «libras» y ya no es verdad: vuelve a trabajar. A Sara se le quita el turno que se le dijo.
    assert [(p["driver_id"], [(d["antes"], d["ahora"]) for d in p["dias"]]) for p in r["personas"]] == [
        ("d1", [("libras", "trabajas")]), ("d4", [("trabajas", "sin turno")])]
    assert (await server.cuadrante_avisos_enviar({"center": "OGA5"}, OFI))["avisados"] == 2
    assert (await server.cuadrante_avisos_previa({"center": "OGA5"}, OFI))["personas"] == []


@pytest.mark.asyncio(loop_scope="session")
async def test_un_cambio_lejano_sale_cuando_entra_en_los_14_dias(base, monkeypatch):
    await _aceptar(base.t, CAMBIOS)
    await server.cuadrante_avisos_enviar({"center": "OGA5"}, OFI)
    # Una semana después, el día 7 de noviembre ya está dentro: se avisa a Pepe (y solo eso).
    monkeypatch.setattr(server, "_dia_negocio", lambda: "2026-10-25")
    r = await server.cuadrante_avisos_previa({"center": "OGA5"}, OFI)
    assert [(p["driver_id"], [(d["fecha"], d["antes"], d["ahora"]) for d in p["dias"]]) for p in r["personas"]] == [
        ("d3", [(LEJOS, "sin turno", "libras")])]


@pytest.mark.asyncio(loop_scope="session")
async def test_un_dia_concedido_no_se_avisa_por_aqui(base):
    await _aceptar(base.t, CAMBIOS)
    _celda(base.t, "d1", MAN)["aprobado_req"] = "r1"                      # ya tiene su aviso de «aprobada»
    r = await server.cuadrante_avisos_previa({"center": "OGA5"}, OFI)
    assert [p["driver_id"] for p in r["personas"]] == ["d4"]


def test_el_texto_del_aviso_lleva_como_mucho_seis_dias():
    dias = [{"texto": f"día {i}: libras"} for i in range(8)]
    assert server._cua_aviso_texto(dias) == " · ".join(f"día {i}: libras" for i in range(6)) + " · y 2 más"
    assert server._cua_aviso_etiqueta(None) == "sin turno"
    assert server._cua_aviso_etiqueta({"cod": "1", "extra": True}) == "trabajas (extra)"
    assert {server._cua_aviso_etiqueta({"cod": c}) for c in ("1", "T", "X")} == {"trabajas"}
    assert server._cua_aviso_etiqueta({"type": "libre"}) == "libras"
