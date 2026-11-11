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


async def _celdas(t, cambios):
    """Celdas tocadas a mano en la rejilla, con el flujo de verdad."""
    return await server.cuadrante_celdas({"center": "OGA5", "cambios": [
        {"driver_id": d, "fecha": f, "cod": c} for d, f, c in cambios]}, OFI)


async def _previa():
    r = await server.cuadrante_avisos_previa({"center": "OGA5"}, OFI)
    return [(p["driver_id"], [(d["fecha"], d["antes"], d["ahora"]) for d in p["dias"]]) for p in r["personas"]]


def _bandeja(t):
    return sorted(a["user_id"] for a in t["avisos_movil"].docs)


PEND = "cuadrante_avisos_pendientes"


@pytest.mark.asyncio(loop_scope="session")
async def test_la_previa_lista_lo_que_cambia_en_los_proximos_14_dias(base):
    assert (await _aceptar(base.t, CAMBIOS))["aplicadas"] == 4
    r = await server.cuadrante_avisos_previa({"center": "OGA5"}, OFI)
    assert set(r) == {"personas", "hasta"} and r["hasta"] == "2026-11-01"
    assert [(p["driver_id"], p["nombre"], [(d["fecha"], d["antes"], d["ahora"], d["texto"]) for d in p["dias"]])
            for p in r["personas"]] == [
        ("d1", "Ana", [(MAN, "trabajas", "libras", "lunes 19/10: libras")]),
        ("d4", "Sara", [(PAS, "sin turno", "trabajas", "martes 20/10: trabajas")])]
    # Cada celda que cambia de hoy en adelante queda apuntada con lo que el conductor sabía (también la de dentro de 20
    # días, que no se enseña); la de 1 → T no, porque para él no cambia nada (tercera ronda, V8). La previa no manda
    # nada ni marca nada.
    assert sorted((d["driver_id"], d["fecha"], d["dicho"]) for d in base.t[PEND].docs) == [
        ("d1", MAN, "trabajas"), ("d3", LEJOS, "sin turno"), ("d4", PAS, "sin turno")]
    assert base.avisos == [] and base.t["avisos_movil"].docs == []
    assert not any(d.get("avisado_en") or d.get("visto") for d in base.t[PEND].docs)


@pytest.mark.asyncio(loop_scope="session")
async def test_un_cambio_deshecho_o_devuelto_a_como_estaba_no_avisa(base):
    await _aceptar(base.t, CAMBIOS)
    await server.cuadrante_deshacer({"center": "OGA5"}, OFI)
    assert await _previa() == []
    # Cambiado a mano y vuelto a dejar como estaba: tampoco.
    await _celdas(base.t, [("d1", MAN, "N/T")])
    await _celdas(base.t, [("d1", MAN, "1")])
    assert await _previa() == []


@pytest.mark.asyncio(loop_scope="session")
async def test_enviar_manda_un_aviso_por_persona_y_no_lo_repite(base):
    await _aceptar(base.t, CAMBIOS)
    await _celdas(base.t, [("d1", PAS, "V")])
    r = await server.cuadrante_avisos_enviar({"center": "OGA5"}, OFI)
    assert (r["avisados"], r["descartados"]) == (2, 0) and [p["driver_id"] for p in r["personas"]] == ["d1", "d4"]
    bandeja = sorted((a["user_id"], a["titulo"], a["cuerpo"], a["url"]) for a in base.t["avisos_movil"].docs)
    assert bandeja == [
        ("d1", "Cambios en tu cuadrante", "lunes 19/10: libras · martes 20/10: vacaciones", "/conductor"),
        ("d4", "Cambios en tu cuadrante", "martes 20/10: trabajas", "/conductor")]
    assert sorted(a.ids[0] for a in base.avisos) == ["d1", "d4"]          # y el push, uno por persona
    # Lo que se le dijo a cada uno queda como lo que sabe, con quién y cuándo.
    dichos = {(d["driver_id"], d["fecha"]): d for d in base.t[PEND].docs}
    assert dichos[("d1", MAN)]["dicho"] == "libras" and dichos[("d1", PAS)]["dicho"] == "vacaciones"
    assert dichos[("d1", MAN)]["avisado_por"] == "Oficina" and dichos[("d1", MAN)]["avisado_en"]
    # Ya avisado: la previa sale vacía y volver a pulsar no manda nada.
    assert await _previa() == []
    assert (await server.cuadrante_avisos_enviar({"center": "OGA5"}, OFI))["avisados"] == 0
    assert len(base.t["avisos_movil"].docs) == 2


@pytest.mark.asyncio(loop_scope="session")
async def test_garantia_a_35_cambios_seguidos_no_pierden_ningun_aviso(base):
    """(a) «Deshacer» guarda los 30 últimos registros por nave; el aviso ya no sale de ahí y no pierde nada."""
    await _celdas(base.t, [("d1", MAN, "N/T")])                              # el primero de todos
    for i in range(34):
        await _celdas(base.t, [("d2", PAS, "V" if i % 2 == 0 else "L")])
    # «Deshacer» sigue exactamente igual: sus 30 últimos registros.
    assert len(base.t["cuadrante_cambios"].docs) == 30
    assert await _previa() == [("d1", [(MAN, "trabajas", "libras")]), ("d2", [(PAS, "sin turno", "libras")])]


@pytest.mark.asyncio(loop_scope="session")
async def test_garantia_b_un_dia_lejano_sale_cuando_entra_aunque_el_cambio_tenga_un_mes(base, monkeypatch):
    lejisimo = "2026-11-27"                                                   # hoy + 40
    await _celdas(base.t, [("d3", lejisimo, "N/T")])
    assert await _previa() == []                                              # todavía fuera de los 14 días
    for col in ("cuadrante_cambios", PEND):                                   # el cambio se hizo hace un mes
        for d in base.t[col].docs:
            d["en"] = "2026-09-01T10:00:00+00:00"
    monkeypatch.setattr(server, "_dia_negocio", lambda: "2026-11-17")       # ya está dentro
    assert await _previa() == [("d3", [(lejisimo, "sin turno", "libras")])]


@pytest.mark.asyncio(loop_scope="session")
async def test_garantia_c_un_cambio_entre_la_previa_y_el_envio_no_queda_como_avisado(base):
    await _aceptar(base.t, CAMBIOS)
    assert [p for p, _d in await _previa()] == ["d1", "d4"]
    await _celdas(base.t, [("d2", MAN, "V")])                                # Luis, con la ventana abierta
    r = await server.cuadrante_avisos_enviar({"center": "OGA5", "driver_ids": ["d1", "d4"], "descartar_ids": []}, OFI)
    assert [p["driver_id"] for p in r["personas"]] == ["d1", "d4"] and _bandeja(base.t) == ["d1", "d4"]
    # A Luis nadie lo ha visto en la lista: no se le avisa ni queda como avisado; sale la próxima vez.
    assert await _previa() == [("d2", [(MAN, "trabajas", "vacaciones")])]


@pytest.mark.asyncio(loop_scope="session")
async def test_garantia_d_el_desmarcado_no_se_avisa_ni_vuelve_y_si_se_deshace_no_recibe_nada(base):
    await _aceptar(base.t, CAMBIOS)
    r = await server.cuadrante_avisos_enviar({"center": "OGA5", "driver_ids": ["d4"], "descartar_ids": ["d1"]}, OFI)
    assert (r["avisados"], r["descartados"]) == (1, 1) and _bandeja(base.t) == ["d4"]
    assert await _previa() == []                                              # mientras su día siga igual, no sale
    # Se deshace la propuesta: Ana vuelve a trabajar, que es lo que ella sabía, y no recibe nada. A Sara sí se le
    # avisó de su turno, y ahora ya no lo tiene.
    await server.cuadrante_deshacer({"center": "OGA5"}, OFI)
    assert await _previa() == [("d4", [(PAS, "trabajas", "sin turno")])]
    # Si su día cambia a otra cosa, vuelve a salir con el «antes» de verdad (lo que ella sabe), no con lo desmarcado.
    await _celdas(base.t, [("d1", MAN, "V")])
    assert ("d1", [(MAN, "trabajas", "vacaciones")]) in await _previa()


@pytest.mark.asyncio(loop_scope="session")
async def test_garantia_d_desmarcado_y_cambiado_a_otra_cosa_dice_lo_que_sabia(base):
    await _aceptar(base.t, CAMBIOS)
    await server.cuadrante_avisos_enviar({"center": "OGA5", "driver_ids": [], "descartar_ids": ["d1", "d4"]}, OFI)
    assert base.t["avisos_movil"].docs == [] and await _previa() == []
    await _celdas(base.t, [("d1", MAN, "V")])
    assert await _previa() == [("d1", [(MAN, "trabajas", "vacaciones")])]


# Fleco 1 (11-11-2026, segunda ronda): la oficina solo descarta lo que VIO. La previa da una `marca` por día y el
# panel la devuelve en `vistas`; lo que cambió después de la previa no se descarta y vuelve a salir.

async def _marcas():
    r = await server.cuadrante_avisos_previa({"center": "OGA5"}, OFI)
    return {p["driver_id"]: [d["marca"] for d in p["dias"]] for p in r["personas"]}


def _pend(t, did, fecha):
    return next(d for d in t[PEND].docs if (d["driver_id"], d["fecha"]) == (did, fecha))


@pytest.mark.asyncio(loop_scope="session")
async def test_fleco1_la_previa_da_una_marca_por_dia(base):
    await _aceptar(base.t, CAMBIOS)
    marcas = await _marcas()
    assert set(marcas) == {"d1", "d4"} and all(isinstance(m, str) and m for ms in marcas.values() for m in ms)
    # Cambia con cada cambio de la celda.
    await _celdas(base.t, [("d1", MAN, "V")])
    assert (await _marcas())["d1"] != marcas["d1"]


@pytest.mark.asyncio(loop_scope="session")
async def test_fleco1_un_desmarcado_que_cambia_entre_la_previa_y_el_envio_vuelve_a_salir(base):
    await _aceptar(base.t, CAMBIOS)
    marcas = await _marcas()
    # Con la ventana abierta, el día de Ana cambia otra vez: la oficina vio «libras» y ahora es «vacaciones».
    await _celdas(base.t, [("d1", MAN, "V")])
    r = await server.cuadrante_avisos_enviar({"center": "OGA5", "driver_ids": ["d4"], "descartar_ids": ["d1"],
                                              "vistas": marcas["d1"]}, OFI)
    assert (r["avisados"], r["descartados"]) == (1, 0) and _bandeja(base.t) == ["d4"]
    assert "visto" not in _pend(base.t, "d1", MAN)
    assert await _previa() == [("d1", [(MAN, "trabajas", "vacaciones")])]


@pytest.mark.asyncio(loop_scope="session")
async def test_fleco1_lo_que_vio_se_descarta_y_un_dia_nuevo_del_mismo_conductor_no(base):
    await _aceptar(base.t, CAMBIOS)
    marcas = await _marcas()
    await _celdas(base.t, [("d1", PAS, "V")])                                # un día más de Ana, después de la previa
    r = await server.cuadrante_avisos_enviar({"center": "OGA5", "driver_ids": [], "descartar_ids": ["d1", "d4"],
                                              "vistas": marcas["d1"] + marcas["d4"]}, OFI)
    assert (r["avisados"], r["descartados"]) == (0, 2) and base.t["avisos_movil"].docs == []
    assert _pend(base.t, "d1", MAN)["visto"] == "libras" and "visto" not in _pend(base.t, "d1", PAS)
    assert await _previa() == [("d1", [(PAS, "sin turno", "vacaciones")])]


@pytest.mark.asyncio(loop_scope="session")
async def test_fleco1_un_cambio_por_fuera_del_cuadrante_entre_la_previa_y_el_envio_tampoco_se_descarta(base):
    """Lo que no pasa por el cuadrante (la rejilla escondida de Turnos) cambia el turno sin cambiar `tocado`: la marca
    lleva también lo que se enseñó, así que tampoco se descarta lo que nadie vio."""
    await _aceptar(base.t, CAMBIOS)
    marcas = await _marcas()
    _celda(base.t, "d1", MAN).update({"cod": "V", "type": "vacaciones"})
    r = await server.cuadrante_avisos_enviar({"center": "OGA5", "driver_ids": ["d4"], "descartar_ids": ["d1"],
                                              "vistas": marcas["d1"]}, OFI)
    assert r["descartados"] == 0 and "visto" not in _pend(base.t, "d1", MAN)
    assert await _previa() == [("d1", [(MAN, "trabajas", "vacaciones")])]


@pytest.mark.asyncio(loop_scope="session")
async def test_fleco1_sin_vistas_como_antes(base):
    """Sin `vistas` en el cuerpo se descarta lo que hay al enviar (lo de la primera ronda)."""
    await _aceptar(base.t, CAMBIOS)
    await _marcas()
    await _celdas(base.t, [("d1", MAN, "V")])
    r = await server.cuadrante_avisos_enviar({"center": "OGA5", "driver_ids": ["d4"], "descartar_ids": ["d1"]}, OFI)
    assert r["descartados"] == 1 and _pend(base.t, "d1", MAN)["visto"] == "vacaciones"
    assert await _previa() == []


@pytest.mark.asyncio(loop_scope="session")
async def test_garantia_e_dos_envios_a_la_vez_no_avisan_dos_veces(base, monkeypatch):
    await _aceptar(base.t, CAMBIOS)
    original = server._cua_avisos_calcular
    dentro = []

    async def otro_pulsa_a_la_vez(center):
        leido = await original(center)
        # La primera vez, justo después de leer lo pendiente, otra persona manda el suyo entero.
        if not dentro:
            dentro.append(1)
            await server.cuadrante_avisos_enviar({"center": "OGA5"}, OFI)
        return leido

    monkeypatch.setattr(server, "_cua_avisos_calcular", otro_pulsa_a_la_vez)
    r = await server.cuadrante_avisos_enviar({"center": "OGA5"}, OFI)
    assert r["avisados"] == 0 and r["personas"] == []
    assert _bandeja(base.t) == ["d1", "d4"]


@pytest.mark.asyncio(loop_scope="session")
async def test_garantia_e_avisado_y_deshecho_despues_se_avisa_otra_vez(base):
    await _aceptar(base.t, CAMBIOS)
    await server.cuadrante_avisos_enviar({"center": "OGA5"}, OFI)
    await server.cuadrante_deshacer({"center": "OGA5"}, OFI)
    assert _celda(base.t, "d1", MAN)["cod"] == "1"
    # Se le dijo «libras» y ya no es verdad: vuelve a trabajar. A Sara se le quita el turno que se le dijo.
    assert await _previa() == [("d1", [(MAN, "libras", "trabajas")]), ("d4", [(PAS, "trabajas", "sin turno")])]
    assert (await server.cuadrante_avisos_enviar({"center": "OGA5"}, OFI))["avisados"] == 2
    assert await _previa() == []


@pytest.mark.asyncio(loop_scope="session")
async def test_driver_ids_limita_y_quien_no_esta_en_ninguna_lista_sigue_pendiente(base):
    await _aceptar(base.t, CAMBIOS)
    r = await server.cuadrante_avisos_enviar({"center": "OGA5", "driver_ids": ["d4"]}, OFI)
    assert r["avisados"] == 1 and [p["driver_id"] for p in r["personas"]] == ["d4"] and _bandeja(base.t) == ["d4"]
    # Ana no estaba ni en una lista ni en la otra: no se le ha tocado nada y sale la próxima vez.
    assert await _previa() == [("d1", [(MAN, "trabajas", "libras")])]
    # Una lista vacía es «a nadie», no «a todos».
    assert (await server.cuadrante_avisos_enviar({"center": "OGA5", "driver_ids": []}, OFI))["avisados"] == 0
    assert await _previa() == [("d1", [(MAN, "trabajas", "libras")])]


@pytest.mark.asyncio(loop_scope="session")
async def test_si_el_envio_a_uno_falla_sus_dias_siguen_pendientes(base, monkeypatch):
    await _aceptar(base.t, CAMBIOS)
    original = server._avisar_usuarios

    async def falla_con_ana(ids, *a, **k):
        if ids == ["d1"]:
            raise RuntimeError("sin red")
        return await original(ids, *a, **k)

    monkeypatch.setattr(server, "_avisar_usuarios", falla_con_ana)
    r = await server.cuadrante_avisos_enviar({"center": "OGA5"}, OFI)
    assert r["avisados"] == 1 and [p["driver_id"] for p in r["personas"]] == ["d4"]
    assert await _previa() == [("d1", [(MAN, "trabajas", "libras")])]
    ana = next(d for d in base.t[PEND].docs if (d["driver_id"], d["fecha"]) == ("d1", MAN))
    assert ana["dicho"] == "trabajas" and not ana.get("avisado_en")


@pytest.mark.asyncio(loop_scope="session")
async def test_si_apuntar_falla_el_cuadrante_se_guarda_y_se_deshace_igual(base):
    class Rota(Col):
        def find(self, *a, **k):
            raise RuntimeError("base caída")

        async def bulk_write(self, *a, **k):
            raise RuntimeError("base caída")

        async def update_one(self, *a, **k):
            raise RuntimeError("base caída")

        async def delete_many(self, *a, **k):                              # el borrado de días pasados (V8)
            raise RuntimeError("base caída")

    base.t[PEND] = Rota()
    await _celdas(base.t, [("d1", MAN, "N/T")])
    assert _celda(base.t, "d1", MAN)["cod"] == "N/T"
    assert len(base.t["cuadrante_cambios"].docs) == 1
    await server.cuadrante_deshacer({"center": "OGA5"}, OFI)
    assert _celda(base.t, "d1", MAN)["cod"] == "1"
    assert base.t["cuadrante_cambios"].docs[0]["deshecho"] is True


@pytest.mark.asyncio(loop_scope="session")
async def test_la_previa_borra_lo_pendiente_de_dias_ya_pasados(base, monkeypatch):
    await _aceptar(base.t, CAMBIOS)
    monkeypatch.setattr(server, "_dia_negocio", lambda: PAS)                  # el lunes ya pasó
    assert await _previa() == [("d4", [(PAS, "sin turno", "trabajas")])]
    assert sorted({d["fecha"] for d in base.t[PEND].docs}) == [PAS, LEJOS]


@pytest.mark.asyncio(loop_scope="session")
async def test_una_ficha_de_baja_o_fusionada_no_se_avisa(base):
    base.t["drivers"].docs[0]["active"] = False                           # Ana, de baja
    base.t["drivers"].docs[3]["merged_into"] = "d2"                       # Sara, fusionada
    await _aceptar(base.t, CAMBIOS)
    assert await _previa() == []


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
async def test_un_cambio_lejano_sale_cuando_entra_en_los_14_dias(base, monkeypatch):
    await _aceptar(base.t, CAMBIOS)
    await server.cuadrante_avisos_enviar({"center": "OGA5"}, OFI)
    # Una semana después, el día 7 de noviembre ya está dentro: se avisa a Pepe (y solo eso).
    monkeypatch.setattr(server, "_dia_negocio", lambda: "2026-10-25")
    assert await _previa() == [("d3", [(LEJOS, "sin turno", "libras")])]


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


# ── Tercera ronda (11-11-2026): lo que sacó la comprobación de «Avisar a los conductores» ─────────────────────────────

AYER = "2026-10-17"


class _Contada(Col):
    """Una colección que cuenta lo que se le pide: lecturas, lotes y escrituras sueltas."""

    def __init__(self, docs=None):
        super().__init__(docs)
        self.n = {"find": 0, "bulk_write": 0, "ops": 0, "update_one": 0, "delete_many": 0}
        self._en_lote = False

    def find(self, *a, **k):
        self.n["find"] += 1
        return super().find(*a, **k)

    async def bulk_write(self, ops, ordered=True):
        self.n["bulk_write"] += 1
        self.n["ops"] += len(ops)
        self._en_lote = True
        try:
            return await super().bulk_write(ops, ordered)
        finally:
            self._en_lote = False

    async def update_one(self, *a, **k):
        if not self._en_lote:
            self.n["update_one"] += 1
        return await super().update_one(*a, **k)

    async def delete_many(self, *a, **k):
        self.n["delete_many"] += 1
        return await super().delete_many(*a, **k)


def _dias(n, desde=HOY):
    from datetime import date, timedelta
    d0 = date.fromisoformat(desde)
    return [(d0 + timedelta(days=i)).isoformat() for i in range(n)]


def _rejilla(t, ids, fechas, cod="1"):
    """Una nave con todos sus días puestos (lo que hay antes de sincronizar la hoja)."""
    t["shifts"] = _Contada([{"driver_id": d, "date": f, "type": "trabaja" if cod in ("1", "T") else "libre",
                             "cod": cod, "center": "OGA5"} for d in ids for f in fechas])


async def _como_la_hoja(t, celdas, center="OGA5"):
    """Un cambio como la sincronización con la hoja de Google: TODAS las celdas de la hoja pasan por _CuaCambio,
    cambien o no (server.py, la sincronización: anota cada celda y la escribe por lotes)."""
    from pymongo import UpdateOne
    cambio = server._CuaCambio(center, {"name": "Google Sheets"}, "Sincronizar con Google Sheets")
    ops = []
    for did, f, cod in celdas:
        filtro = {"driver_id": did, "date": f}
        cambio.anota("shifts", filtro, _celda(t, did, f))
        ops.append(UpdateOne(filtro, {"$set": {"driver_id": did, "date": f, "center": center, "cod": cod,
                                               "type": "trabaja" if cod in ("1", "T") else "libre"}}, upsert=True))
    await t["shifts"].bulk_write(ops)
    return await cambio.guardar()


@pytest.mark.asyncio(loop_scope="session")
async def test_v8_una_sincronizacion_que_no_cambia_nada_no_apunta_ni_toca_nada(base):
    ids, fechas = ["d1", "d2", "d3", "d4"], _dias(50)
    _rejilla(base.t, ids, fechas)
    await _celdas(base.t, [("d1", MAN, "N/T")])                           # un cambio de verdad, de antes
    antes = [dict(d) for d in base.t[PEND].docs]
    assert len(antes) == 1
    base.t[PEND] = _Contada(antes)
    # La hoja vuelve a escribir las 200 celdas tal como están (la de Ana, ya con su libre).
    await _como_la_hoja(base.t, [(d, f, "N/T" if (d, f) == ("d1", MAN) else "1") for d in ids for f in fechas])
    assert base.t[PEND].docs == antes                                         # ni uno nuevo, ni un `tocado` movido
    assert base.t[PEND].n["ops"] == 0 and base.t[PEND].n["update_one"] == 0


@pytest.mark.asyncio(loop_scope="session")
async def test_v8_una_sincronizacion_que_cambia_3_de_200_apunta_3(base):
    ids, fechas = ["d1", "d2", "d3", "d4"], _dias(50)
    _rejilla(base.t, ids, fechas)
    cambian = {("d1", fechas[1]): "N/T", ("d2", fechas[3]): "V", ("d4", fechas[40]): "L"}
    # «T» en vez de «1» se escribe distinto pero para el conductor es lo mismo («trabajas»): tampoco se apunta.
    await _como_la_hoja(base.t, [(d, f, cambian.get((d, f), "T" if f == fechas[2] else "1"))
                                 for d in ids for f in fechas])
    assert sorted((p["driver_id"], p["fecha"], p["dicho"]) for p in base.t[PEND].docs) == [
        ("d1", fechas[1], "trabajas"), ("d2", fechas[3], "trabajas"), ("d4", fechas[40], "trabajas")]


@pytest.mark.asyncio(loop_scope="session")
async def test_v8_300_celdas_cambiadas_son_una_lectura_y_escrituras_por_lotes(base):
    ids, fechas = ["d1", "d2", "d3", "d4"], _dias(75)
    _rejilla(base.t, ids, fechas)
    base.t[PEND] = _Contada()
    lecturas = base.t["shifts"].n["find"]
    await _como_la_hoja(base.t, [(d, f, "N/T") for d in ids for f in fechas])
    assert len(base.t[PEND].docs) == 300
    assert base.t["shifts"].n["find"] - lecturas == 1                       # lo de ahora, en UNA consulta
    assert base.t[PEND].n["find"] == 0 and base.t[PEND].n["update_one"] == 0
    assert 1 <= base.t[PEND].n["bulk_write"] <= 2                            # por lotes de 500


@pytest.mark.asyncio(loop_scope="session")
async def test_v8_los_dias_pasados_se_van_al_apuntar(base):
    base.t[PEND].docs += [
        {"_id": f"OGA5|d2|{AYER}", "center": "OGA5", "driver_id": "d2", "fecha": AYER, "dicho": "trabajas",
         "tocado": "t0"},
        {"_id": f"DGA1|d9|{AYER}", "center": "DGA1", "driver_id": "d9", "fecha": AYER, "dicho": "trabajas",
         "tocado": "t0"}]
    await _celdas(base.t, [("d1", MAN, "N/T")])                              # sin abrir la previa
    assert sorted((p["center"], p["fecha"]) for p in base.t[PEND].docs) == [("DGA1", AYER), ("OGA5", MAN)]


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("antes", ["avisado", "descartado"])
async def test_v1_un_extra_concedido_y_anulado_en_el_cuadrante_sale_con_lo_que_le_dijo_la_aprobacion(base, antes):
    await _celdas(base.t, [("d1", MAN, "N/T")])                              # la oficina le quita el lunes…
    if antes == "avisado":                                                    # …y se lo avisa: sabe «libras»
        await server.cuadrante_avisos_enviar({"center": "OGA5"}, OFI)
        assert _pend(base.t, "d1", MAN)["dicho"] == "libras"
    else:                                                                     # …o decide no avisarle
        await server.cuadrante_avisos_enviar({"center": "OGA5", "driver_ids": [], "descartar_ids": ["d1"]}, OFI)
        assert _pend(base.t, "d1", MAN)["visto"] == "libras"
    # Pide trabajar ese lunes y se lo conceden: se entera por el aviso de la aprobación, no por aquí.
    _peticion(base.t, "r1", MAN, did="d1", tipo="extra", estado="aprobado")
    await server._turno_aprobado({"id": "r1", "driver_id": "d1", "driver_name": "Ana", "date": MAN, "type": "extra",
                                  "center": "OGA5"})
    assert server._cua_aviso_etiqueta(_celda(base.t, "d1", MAN)) == "trabajas (extra)"
    assert await _previa() == []
    # La oficina se lo anula desde el cuadrante (le quita el candado y lo vuelve a poner libre): eso sí hay que avisarlo.
    await server.cuadrante_celdas({"center": "OGA5", "cambios": [
        {"driver_id": "d1", "fecha": MAN, "desbloquear": True}]}, OFI)
    await _celdas(base.t, [("d1", MAN, "N/T")])
    assert await _previa() == [("d1", [(MAN, "trabajas (extra)", "libras")])]
    assert "visto" not in _pend(base.t, "d1", MAN)


@pytest.mark.asyncio(loop_scope="session")
async def test_v6_descartado_deshecho_y_vuelto_a_poner_lo_mismo_vuelve_a_salir(base):
    await _celdas(base.t, [("d1", MAN, "N/T")])
    await server.cuadrante_avisos_enviar({"center": "OGA5", "driver_ids": [], "descartar_ids": ["d1"]}, OFI)
    assert await _previa() == []
    await server.cuadrante_deshacer({"center": "OGA5"}, OFI)                 # vuelve a trabajar: lo que ella sabe
    assert "visto" not in _pend(base.t, "d1", MAN)
    # Más tarde, por otro motivo y sin abrir la previa entre medias, se le vuelve a dar libre: la oficina no ha visto
    # este cambio, así que sale.
    await _celdas(base.t, [("d1", MAN, "N/T")])
    assert await _previa() == [("d1", [(MAN, "trabajas", "libras")])]


@pytest.mark.asyncio(loop_scope="session")
async def test_v6_tambien_si_vuelve_por_fuera_del_cuadrante(base):
    """La rejilla escondida de Turnos no pasa por el cuadrante: lo olvida la previa al ver que el día volvió a lo que
    el conductor sabe."""
    await _celdas(base.t, [("d1", MAN, "N/T")])
    await server.cuadrante_avisos_enviar({"center": "OGA5", "driver_ids": [], "descartar_ids": ["d1"]}, OFI)
    _celda(base.t, "d1", MAN).update({"cod": "1", "type": "trabaja"})
    assert await _previa() == []
    assert "visto" not in _pend(base.t, "d1", MAN)
    _celda(base.t, "d1", MAN).update({"cod": "N/T", "type": "libre"})
    assert await _previa() == [("d1", [(MAN, "trabajas", "libras")])]


@pytest.mark.asyncio(loop_scope="session")
async def test_v9_un_dia_que_ya_es_de_otra_nave_lo_avisa_la_suya_y_no_esta(base):
    await _celdas(base.t, [("d1", MAN, "N/T")])                              # OGA5 le da libre el lunes
    # La hoja de DGA1 se lo lleva ese lunes (la sincronización escribe la celda con su nave).
    await _como_la_hoja(base.t, [("d1", MAN, "V")], center="DGA1")
    assert _celda(base.t, "d1", MAN)["center"] == "DGA1"
    assert await _previa() == []                                              # OGA5 ya no lo enseña ni lo avisa
    r = await server.cuadrante_avisos_enviar({"center": "OGA5"}, OFI)
    assert r["avisados"] == 0 and base.t["avisos_movil"].docs == []
    dga1 = await server.cuadrante_avisos_previa({"center": "DGA1"}, OFI)
    assert [(p["driver_id"], [d["ahora"] for d in p["dias"]]) for p in dga1["personas"]] == [("d1", ["vacaciones"])]
    # Un turno sin nave apuntada (datos viejos) sigue saliendo donde se apuntó.
    _celda(base.t, "d1", MAN).pop("center")
    assert await _previa() == [("d1", [(MAN, "trabajas", "vacaciones")])]


@pytest.mark.asyncio(loop_scope="session")
async def test_v7_si_la_bandeja_no_guarda_el_aviso_sus_dias_siguen_pendientes(base):
    """_avisar_usuarios nunca lanza (se traga sus errores): se comprueba que el aviso está de verdad en la bandeja."""
    class BandejaQueFallaConAna(Col):
        async def insert_many(self, docs, **k):
            if any(d["user_id"] == "d1" for d in docs):
                raise RuntimeError("la base no responde")
            return await super().insert_many(docs, **k)

    base.t["avisos_movil"] = BandejaQueFallaConAna()
    await _aceptar(base.t, CAMBIOS)
    r = await server.cuadrante_avisos_enviar({"center": "OGA5"}, OFI)
    assert r["avisados"] == 1 and [p["driver_id"] for p in r["personas"]] == ["d4"] and _bandeja(base.t) == ["d4"]
    ana = _pend(base.t, "d1", MAN)
    assert ana["dicho"] == "trabajas" and not ana.get("avisado_en") and not ana.get("avisado_lote")
    assert await _previa() == [("d1", [(MAN, "trabajas", "libras")])]
    # Cuando la bandeja vuelve, se le avisa con normalidad.
    base.t["avisos_movil"] = Col()
    assert (await server.cuadrante_avisos_enviar({"center": "OGA5"}, OFI))["avisados"] == 1
    assert _bandeja(base.t) == ["d1"] and await _previa() == []


@pytest.mark.asyncio(loop_scope="session")
async def test_v10a_una_celda_sin_apuntar_que_se_deshace_sale_en_la_previa(base):
    """Lo sujeta el apunte de `cuadrante_deshacer`: el cambio original no quedó apuntado (anterior a publicar esto, o
    un apunte que falló), y deshacerlo también cambia lo que el conductor tiene ese día."""
    await _celdas(base.t, [("d1", MAN, "N/T")])
    base.t[PEND].docs.clear()                                                 # como un cambio de antes de publicar
    await server.cuadrante_deshacer({"center": "OGA5"}, OFI)
    assert _celda(base.t, "d1", MAN)["cod"] == "1"
    assert await _previa() == [("d1", [(MAN, "libras", "trabajas")])]


@pytest.mark.asyncio(loop_scope="session")
async def test_v10b_previa_deshacer_y_envio_con_el_descartado_no_guarda_lo_que_no_vio(base):
    await _celdas(base.t, [("d1", MAN, "N/T")])
    base.t["cuadrante_cambios"].docs[0]["en"] = "2026-10-18T08:00:00+00:00"  # el reloj de Windows puede repetir la hora
    await _celdas(base.t, [("d1", MAN, "V")])
    marcas = await _marcas()                                                  # la oficina ve «vacaciones»
    assert await _previa() == [("d1", [(MAN, "trabajas", "vacaciones")])]
    await server.cuadrante_deshacer({"center": "OGA5"}, OFI)                 # con la ventana abierta: vuelve a libre
    r = await server.cuadrante_avisos_enviar({"center": "OGA5", "driver_ids": [], "descartar_ids": ["d1"],
                                              "vistas": marcas["d1"]}, OFI)
    assert (r["avisados"], r["descartados"]) == (0, 0) and base.t["avisos_movil"].docs == []
    assert "visto" not in _pend(base.t, "d1", MAN)
    assert await _previa() == [("d1", [(MAN, "trabajas", "libras")])]


@pytest.mark.asyncio(loop_scope="session")
async def test_v10c_un_cambio_de_un_dia_de_ayer_no_se_apunta(base):
    base.t["shifts"].docs.append({"driver_id": "d1", "date": AYER, "type": "trabaja", "cod": "1", "center": "OGA5"})
    await _celdas(base.t, [("d1", AYER, "N/T"), ("d2", AYER, "V")])
    assert _celda(base.t, "d1", AYER)["cod"] == "N/T"                        # el cambio se guarda…
    assert base.t[PEND].docs == []                                            # …pero no se apunta para avisar
    await server.cuadrante_deshacer({"center": "OGA5"}, OFI)
    assert base.t[PEND].docs == []                                            # ni al deshacerlo
