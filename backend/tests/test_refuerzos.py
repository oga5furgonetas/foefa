# -*- coding: utf-8 -*-
"""Refuerzos (18-10-2026): la oficina pide gente para un día y se apunta quien quiera. Lo que se vigila, por orden
de lo que más daño haría: que solo se avise a quien ese día LIBRA según el cuadrante (nunca a quien trabaja, está de
vacaciones, de baja, tiene un día concedido o no sale en el cuadrante); que nada se apruebe solo; que al aprobar
entre en el cuadrante como EXTRA y al borrarse vuelva a como estaba; y que al cubrirse se cierre y se avise."""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Db

HOY = "2026-10-18"          # domingo
MAN = "2026-10-19"          # lunes
OFI = {"sub": "a1", "role": "admin", "name": "Oficina", "org_id": "owner"}
OFI_DGA1 = {"sub": "a2", "role": "admin", "name": "Jefe DGA1", "org_id": "owner", "allowed_centers": ["DGA1"]}
SOLO_VER = {"sub": "a3", "role": "admin", "name": "Mira", "org_id": "owner", "permissions": ["turnos"]}


def conductor(did):
    return {"sub": did, "role": "driver"}


@pytest.fixture
def nave(monkeypatch):
    t = Db()
    t["drivers"] = Col([
        {"id": "d1", "name": "Ana", "center": "OGA5", "active": True},
        {"id": "d2", "name": "Luis", "center": "OGA5", "active": True},
        {"id": "d3", "name": "Pepe", "center": "OGA5", "active": True},
        {"id": "d4", "name": "Eva", "center": "OGA5", "active": True},
        {"id": "d5", "name": "Rosa", "center": "OGA5", "active": True},
        {"id": "d6", "name": "Toni", "center": "OGA5", "active": True},
        {"id": "d7", "name": "Juan", "center": "OGA5", "active": True},
        {"id": "d8", "name": "María", "center": "OGA5", "active": False},
        {"id": "d9", "name": "Diego", "center": "DGA1", "active": True},
    ])
    turno = lambda did, tipo, cod, centro="OGA5", fecha=MAN: {  # noqa: E731
        "driver_id": did, "date": fecha, "type": tipo, "cod": cod, "center": centro}
    t["shifts"] = Col([
        turno("d1", "libre", "N/T"), turno("d2", "libre", "L"), turno("d3", "trabaja", "1"),
        turno("d4", "libre", "V"), turno("d5", "libre", "BAJA"), turno("d6", "libre", "N/T APROB"),
        turno("d8", "libre", "N/T"), turno("d9", "libre", "N/T", "DGA1"),
        # La semana de Ana: trabaja martes y miércoles.
        turno("d1", "trabaja", "1", fecha="2026-10-20"), turno("d1", "trabaja", "1", fecha="2026-10-21"),
    ])
    t["shift_requests"] = Col([])
    t["refuerzos"] = Col([])
    a_conductores, a_oficina = [], []

    async def push(ids, titulo, cuerpo, url="/panel"):
        a_conductores.append(SimpleNamespace(ids=sorted(ids), titulo=titulo, cuerpo=cuerpo, url=url))

    async def push_oficina(center, titulo, cuerpo, url, exclude_id=None):
        a_oficina.append(SimpleNamespace(center=center, titulo=titulo, cuerpo=cuerpo, url=url))
    monkeypatch.setattr(server, "db", t)
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)
    monkeypatch.setattr(server, "send_web_push_to_users", push)
    monkeypatch.setattr(server, "push_center_event", push_oficina)
    return SimpleNamespace(t=t, conductores=a_conductores, oficina=a_oficina)


async def _crear(plazas=2, nota="Salida 9:00", fecha=MAN, quien=OFI):
    return await server.crear_refuerzo({"center": "OGA5", "date": fecha, "plazas": plazas, "nota": nota}, quien)


@pytest.mark.asyncio(loop_scope="session")
async def test_solo_avisa_a_quien_libra(nave):
    r = await _crear()
    assert r["avisados"] == 2
    aviso = nave.conductores[-1]
    # Ana (N/T) y Luis (L). Ni Pepe (trabaja), ni Eva (vacaciones), ni Rosa (baja), ni Toni (día concedido),
    # ni Juan (no sale en el cuadrante), ni María (de baja en la empresa), ni Diego (otra nave).
    assert aviso.ids == ["d1", "d2"]
    assert aviso.titulo == "📣 lunes 19/10: hacen falta 2 en OGA5" and "voluntario" in aviso.cuerpo
    assert aviso.url == "/conductor?vista=extra"


@pytest.mark.asyncio(loop_scope="session")
async def test_lo_que_no_se_puede_pedir(nave):
    for quien, cuerpo, codigo in (
        (SOLO_VER, {}, 403),                                        # ver turnos no es decidir
        (OFI_DGA1, {}, 403),                                        # otra nave
        (OFI, {"center": "Todos"}, 400),
        (OFI, {"date": "2026-10-17"}, 400),                        # ya pasó
        (OFI, {"date": "2026-12-01"}, 400),                        # más de 30 días
        (OFI, {"plazas": 0}, 400), (OFI, {"plazas": 21}, 400), (OFI, {"plazas": "x"}, 400),
        (OFI, {"date": "2026-10-25"}, 409),                        # ese día nadie sale en el cuadrante
    ):
        with pytest.raises(HTTPException) as e:
            await server.crear_refuerzo({"center": "OGA5", "date": MAN, "plazas": 2, **cuerpo}, quien)
        assert e.value.status_code == codigo, cuerpo
    await _crear()
    with pytest.raises(HTTPException) as e:                         # uno por nave y día
        await _crear()
    assert e.value.status_code == 409
    assert nave.conductores and len(nave.conductores) == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_el_portal_y_apuntarse(nave):
    rid = (await _crear())["refuerzo"]["id"]
    ana = await server.refuerzos_del_conductor(conductor("d1"))
    assert ana["nuevos"] == 1 and ana["refuerzos"][0]["quedan"] == 2 and ana["refuerzos"][0]["nota"] == "Salida 9:00"
    for did in ("d3", "d4", "d7", "d9"):                            # a quien no libra no le sale
        assert (await server.refuerzos_del_conductor(conductor(did)))["refuerzos"] == []
    with pytest.raises(HTTPException) as e:
        await server.apuntarme_refuerzo(rid, {}, conductor("d3"))
    assert e.value.status_code == 409
    with pytest.raises(HTTPException) as e:
        await server.apuntarme_refuerzo(rid, {}, conductor("d9"))
    assert e.value.status_code == 403                               # otra nave
    await server.apuntarme_refuerzo(rid, {"nota": "Puedo desde las 8"}, conductor("d1"))
    with pytest.raises(HTTPException) as e:
        await server.apuntarme_refuerzo(rid, {}, conductor("d1"))
    assert e.value.status_code == 409                               # ya apuntada
    q = nave.t.shift_requests.docs[0]
    assert (q["type"], q["status"], q["refuerzo_id"], q["note"]) == ("extra", "pendiente", rid, "Puedo desde las 8")
    assert nave.oficina[-1].titulo == "🙋 Ana se apunta al refuerzo del lunes 19/10"
    assert (await server.refuerzos_del_conductor(conductor("d1")))["refuerzos"][0]["mi_estado"] == "pendiente"
    # Nada se aprueba solo: el cuadrante sigue igual.
    assert next(s for s in nave.t.shifts.docs if s["driver_id"] == "d1" and s["date"] == MAN)["cod"] == "N/T"


@pytest.mark.asyncio(loop_scope="session")
async def test_aprobar_cubre_cierra_y_da_las_gracias(nave):
    rid = (await _crear(plazas=1))["refuerzo"]["id"]
    await server.apuntarme_refuerzo(rid, {}, conductor("d1"))
    await server.apuntarme_refuerzo(rid, {}, conductor("d2"))
    ana, luis = nave.t.shift_requests.docs
    await server.resolve_shift_request(ana["id"], {"action": "aprobar"}, OFI)
    turno = next(s for s in nave.t.shifts.docs if s["driver_id"] == "d1" and s["date"] == MAN)
    assert turno["cod"] == "EXTRA" and turno["fijada"] is True    # al cuadrante, con candado
    assert nave.t.refuerzos.docs[0]["estado"] == "cubierto"
    assert luis["status"] == "rechazado" and luis["motivo_respuesta"] == server._REFUERZO_GRACIAS
    assert nave.conductores[-1].ids == ["d2"] and "cubierto" in nave.conductores[-1].titulo
    assert (await server.refuerzos_del_conductor(conductor("d2")))["refuerzos"] == []
    assert (await server.refuerzos_del_conductor(conductor("d1")))["refuerzos"][0]["mi_estado"] == "aprobado"
    # Ana se borra: el cuadrante vuelve a como estaba y el refuerzo se reabre.
    await server.desapuntarme_refuerzo(rid, conductor("d1"))
    turno = next(s for s in nave.t.shifts.docs if s["driver_id"] == "d1" and s["date"] == MAN)
    assert turno["cod"] == "N/T" and "aprobado_req" not in turno
    assert nave.t.refuerzos.docs[0]["estado"] == "abierto"
    assert nave.oficina[-1].titulo == "↩️ Ana se borra del refuerzo del lunes 19/10"


@pytest.mark.asyncio(loop_scope="session")
async def test_la_lista_de_la_oficina(nave):
    rid = (await _crear())["refuerzo"]["id"]
    await server.apuntarme_refuerzo(rid, {}, conductor("d1"))
    await server.apuntarme_refuerzo(rid, {}, conductor("d2"))
    # Después de apuntarse, a Luis le cambian el cuadrante: ese día trabaja. Que se vea antes de aprobar.
    next(s for s in nave.t.shifts.docs if s["driver_id"] == "d2" and s["date"] == MAN).update(type="trabaja", cod="1")
    r = (await server.listar_refuerzos("", OFI))["refuerzos"][0]
    por = {a["driver_name"]: a for a in r["apuntados"]}
    assert por["Ana"]["dias_semana"] == 2 and not por["Ana"]["ya_no_libra"]
    assert por["Luis"]["ya_no_libra"] is True
    assert (r["pendientes"], r["aprobados"], r["libran_ahora"]) == (2, 0, 1)
    assert (await server.listar_refuerzos("", OFI_DGA1))["refuerzos"] == []       # no es de su nave


@pytest.mark.asyncio(loop_scope="session")
async def test_anular_y_cambiar_plazas(nave):
    rid = (await _crear(plazas=2))["refuerzo"]["id"]
    await server.apuntarme_refuerzo(rid, {}, conductor("d1"))
    await server.apuntarme_refuerzo(rid, {}, conductor("d2"))
    ana, luis = nave.t.shift_requests.docs
    await server.resolve_shift_request(ana["id"], {"action": "aprobar"}, OFI)
    with pytest.raises(HTTPException) as e:                         # por debajo de los aprobados, no
        await server.cambiar_refuerzo(rid, {"plazas": 0}, OFI)
    assert e.value.status_code == 400
    await server.cambiar_refuerzo(rid, {"plazas": 1}, OFI)          # baja a 1: cubierto, y a Luis las gracias
    assert nave.t.refuerzos.docs[0]["estado"] == "cubierto" and luis["status"] == "rechazado"
    with pytest.raises(HTTPException) as e:                         # con gente aprobada no se anula de golpe
        await server.anular_refuerzo(rid, OFI)
    assert e.value.status_code == 409
    await server.resolve_shift_request(ana["id"], {"action": "rechazar", "motivo": "Al final no hace falta"}, OFI)
    assert nave.t.refuerzos.docs[0]["estado"] == "abierto"          # desaprobada: se reabre
    await server.apuntarme_refuerzo(rid, {}, conductor("d2"))       # Luis vuelve a apuntarse
    await server.anular_refuerzo(rid, OFI)
    assert nave.t.refuerzos.docs[0]["estado"] == "anulado"
    assert nave.t.shift_requests.docs[-1]["motivo_respuesta"] == server._REFUERZO_ANULADO
    assert (await server.refuerzos_del_conductor(conductor("d2")))["refuerzos"] == []


@pytest.mark.asyncio(loop_scope="session")
async def test_la_peticion_de_un_refuerzo_no_se_cambia_de_dias(nave):
    rid = (await _crear())["refuerzo"]["id"]
    await server.apuntarme_refuerzo(rid, {}, conductor("d1"))
    q = nave.t.shift_requests.docs[0]
    with pytest.raises(HTTPException) as e:
        await server.cambiar_mi_peticion({"grupo": q["grupo"], "dates": ["2026-10-22"], "nota": "otro día"}, conductor("d1"))
    assert e.value.status_code == 409
    # Cancelarla desde «mis peticiones» también deja la plaza libre.
    await server.cancelar_mis_peticiones({"ids": [q["id"]]}, conductor("d1"))
    assert q["status"] == "cancelado"


def _trabaja(nave, did, fechas):
    for f in fechas:
        celda = next((s for s in nave.t.shifts.docs if s["driver_id"] == did and s["date"] == f), None)
        if celda:
            celda.update(type="trabaja", cod="1")
        else:
            nave.t.shifts.docs.append({"driver_id": did, "date": f, "type": "trabaja", "cod": "1", "center": "OGA5"})


@pytest.mark.asyncio(loop_scope="session")
async def test_la_ley_7_dias_seguidos_no(nave):
    """Luis libra el lunes 19 pero viene de trabajar del martes 13 al domingo 18: el lunes sería el 7.º seguido."""
    _trabaja(nave, "d2", ["2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"])
    r = await _crear()
    assert r["avisados"] == 1 and nave.conductores[-1].ids == ["d1"]       # a Luis ni se le avisa
    rid = r["refuerzo"]["id"]
    assert (await server.refuerzos_del_conductor(conductor("d2")))["refuerzos"] == []
    with pytest.raises(HTTPException) as e:
        await server.apuntarme_refuerzo(rid, {}, conductor("d2"))
    assert e.value.status_code == 409 and "7 días seguidos" in e.value.detail
    # Y si ya estaba apuntado de antes (el cuadrante cambió después), no se le puede aprobar.
    nave.t.shift_requests.docs.append({"id": "q7", "driver_id": "d2", "driver_name": "Luis", "date": MAN, "type": "extra",
                                       "status": "pendiente", "refuerzo_id": rid, "center": "OGA5", "created_at": "x"})
    lista = (await server.listar_refuerzos("", OFI))["refuerzos"][0]
    assert lista["apuntados"][0]["no_puede"] == "Serían 7 días seguidos trabajando (máximo 6)"
    with pytest.raises(HTTPException) as e:
        await server.resolve_shift_request("q7", {"action": "aprobar"}, OFI)
    assert e.value.status_code == 409
    assert next(s for s in nave.t.shifts.docs if s["driver_id"] == "d2" and s["date"] == MAN)["cod"] == "L"


@pytest.mark.asyncio(loop_scope="session")
async def test_la_nota_del_cuadrante_manda(nave):
    """«Sin extra»: Ana ya trabaja 5 días esa semana, el 6.º no. «No trabaja los lunes»: Luis, nunca un lunes."""
    _trabaja(nave, "d1", ["2026-10-22", "2026-10-23", "2026-10-25"])     # con el 20 y 21: 5 días esa semana
    nave.t["cuadrante_personas"] = Col([
        {"center": "OGA5", "driver_id": "d1", "en_cuadrante": True, "nota": "sin extra"},
        {"center": "OGA5", "driver_id": "d2", "en_cuadrante": True, "nota": "no trabaja los lunes"}])
    no = await server._extra_impedimentos("OGA5", MAN, ["d1", "d2"])
    assert no == {"d1": "Serían 6 días esa semana (máximo 5)",
                  "d2": "Su nota del cuadrante dice que ese día de la semana no trabaja"}
    with pytest.raises(HTTPException) as e:                                 # nadie puede: no se publica
        await _crear()
    assert e.value.status_code == 409


@pytest.mark.asyncio(loop_scope="session")
async def test_pedir_un_dia_extra_tambien_mira_la_ley(nave):
    _trabaja(nave, "d2", ["2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"])
    with pytest.raises(HTTPException) as e:
        await server.create_shift_request({"dates": [MAN], "type": "extra", "motivo": "otro", "note": "quiero ir"}, conductor("d2"))
    assert e.value.status_code == 409 and "7 días seguidos" in e.value.detail


@pytest.mark.asyncio(loop_scope="session")
async def test_los_dias_que_no_llegan_a_la_maxima(nave):
    nave.t["route_demand"] = Col([{"center": "OGA5", "date": MAN, "maximo": 3}, {"center": "OGA5", "date": "2026-10-20", "maximo": 1}])
    f = await server.refuerzos_faltas("OGA5", 14, OFI)
    # El lunes: máxima 3 y en ruta solo Pepe → faltan 2; pueden Ana y Luis. El martes llega (Ana trabaja).
    assert [(x["date"], x["maximo"], x["en_ruta"], x["falta"], x["pueden"], x["refuerzo"]) for x in f["faltas"]] == [
        (MAN, 3, 1, 2, 2, None)]
    rid = (await _crear(plazas=2))["refuerzo"]["id"]
    f = await server.refuerzos_faltas("OGA5", 14, OFI)
    assert f["faltas"][0]["refuerzo"] == {"id": rid, "plazas": 2, "estado": "abierto", "auto": False, "aprobados": 0}
    with pytest.raises(HTTPException) as e:
        await server.refuerzos_faltas("Todos", 14, OFI)
    assert e.value.status_code == 400


# ─── Trabajar más (24-10-2026): las vacantes de los días bajo la máxima, a la vista de quien libra ───────────────

def _maximas(nave, **por_dia):
    nave.t["route_demand"] = Col([{"center": "OGA5", "date": f, "maximo": m} for f, m in por_dia.items()])


@pytest.mark.asyncio(loop_scope="session")
async def test_trabajar_mas_solo_a_quien_libra_y_puede(nave):
    _maximas(nave, **{MAN: 3, "2026-10-20": 1})
    ana = await server.trabajar_mas(conductor("d1"))
    # El lunes faltan 2 (máxima 3, en ruta Pepe); el martes llega. A Ana, que libra el lunes, le salen las 2.
    assert [(v["date"], v["quedan"], v["mi_estado"], v["refuerzo_id"]) for v in ana["vacantes"]] == [(MAN, 2, None, None)]
    assert (ana["plazas"], ana["dias"], ana["extras"]) == (2, 1, [])
    # Ni a quien trabaja, está de vacaciones, de baja, con un día concedido, fuera del cuadrante, de baja en la
    # empresa o en otra nave.
    for did in ("d3", "d4", "d5", "d6", "d7", "d8", "d9"):
        assert (await server.trabajar_mas(conductor(did)))["vacantes"] == [], did
    # Luis libra, pero viene de 6 días seguidos: el lunes sería el 7.º. No se le enseña algo que no se le podría aprobar.
    _trabaja(nave, "d2", ["2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"])
    assert (await server.trabajar_mas(conductor("d2")))["vacantes"] == []
    # Sin máximas puestas no hay vacantes que enseñar.
    nave.t["route_demand"] = Col([])
    assert (await server.trabajar_mas(conductor("d1")))["vacantes"] == []


@pytest.mark.asyncio(loop_scope="session")
async def test_solicitar_abre_un_refuerzo_sin_avisar_a_nadie(nave):
    _maximas(nave, **{MAN: 3})
    r = await server.solicitar_trabajar_mas(MAN, {"nota": "Puedo de mañana"}, conductor("d1"))
    ref = nave.t.refuerzos.docs[0]
    assert (ref["auto"], ref["plazas"], ref["avisados"], ref["estado"]) == (True, 2, 0, "abierto")
    assert nave.conductores == []                                  # a nadie más le llega nada
    q = r["peticion"]
    assert (q["type"], q["status"], q["refuerzo_id"], q["note"]) == ("extra", "pendiente", ref["id"], "Puedo de mañana")
    assert nave.oficina[-1].titulo == "🙋 Ana quiere trabajar el lunes 19/10"
    # Luis solicita el mismo día: va al MISMO refuerzo, no abre otro.
    await server.solicitar_trabajar_mas(MAN, {}, conductor("d2"))
    assert len(nave.t.refuerzos.docs) == 1 and len(nave.t.shift_requests.docs) == 2
    ana = await server.trabajar_mas(conductor("d1"))
    assert [(v["mi_estado"], v["refuerzo_id"]) for v in ana["vacantes"]] == [("pendiente", ref["id"])]
    assert (ana["plazas"], ana["dias"]) == (0, 0)                  # lo ya solicitado no cuenta como vacante nueva
    # Nada se aprueba solo: el cuadrante sigue igual.
    assert next(s for s in nave.t.shifts.docs if s["driver_id"] == "d1" and s["date"] == MAN)["cod"] == "N/T"


@pytest.mark.asyncio(loop_scope="session")
async def test_lo_que_no_se_puede_solicitar(nave):
    _maximas(nave, **{MAN: 3, "2026-10-20": 1})
    for did, fecha, codigo in (
        ("d3", MAN, 409),                 # ese día trabaja
        ("d4", MAN, 409),                 # de vacaciones
        ("d1", "2026-10-20", 409),        # el martes está completo
        ("d1", HOY, 409),                 # hoy ya está en marcha
        ("d1", "2026-11-30", 409),        # demasiado lejos
        ("d1", "19-10-2026", 400),
    ):
        with pytest.raises(HTTPException) as e:
            await server.solicitar_trabajar_mas(fecha, {}, conductor(did))
        assert e.value.status_code == codigo, (did, fecha)
    _trabaja(nave, "d2", ["2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"])
    with pytest.raises(HTTPException) as e:
        await server.solicitar_trabajar_mas(MAN, {}, conductor("d2"))
    assert e.value.status_code == 409 and "7 días seguidos" in e.value.detail
    assert nave.t.refuerzos.docs == []                             # ninguno de esos ha abierto nada
    with pytest.raises(HTTPException) as e:
        await server.trabajar_mas({"sub": "a1", "role": "admin"})
    assert e.value.status_code == 403                              # es del portal del conductor


@pytest.mark.asyncio(loop_scope="session")
async def test_aprobada_queda_como_extra_y_con_constancia(nave):
    _maximas(nave, **{MAN: 2})                                     # falta 1
    await server.solicitar_trabajar_mas(MAN, {}, conductor("d1"))
    await server.solicitar_trabajar_mas(MAN, {}, conductor("d2"))
    ana, luis = nave.t.shift_requests.docs
    await server.resolve_shift_request(ana["id"], {"action": "aprobar"}, OFI)
    turno = next(s for s in nave.t.shifts.docs if s["driver_id"] == "d1" and s["date"] == MAN)
    assert (turno["cod"], turno["type"], turno["fijada"]) == ("EXTRA", "extra", True)
    aviso = next(a for a in nave.conductores if a.ids == ["d1"])
    assert aviso.titulo == "✅ Día extra confirmado: lunes 19/10" and "EXTRA" in aviso.cuerpo
    assert nave.t.refuerzos.docs[0]["estado"] == "cubierto" and luis["status"] == "rechazado"
    r = await server.trabajar_mas(conductor("d1"))
    assert r["vacantes"] == []                                     # ya no es una vacante: es su día extra
    [x] = r["extras"]
    assert (x["date"], x["confirmado_por"], x["en_cuadrante"], x["puede_soltar"]) == (MAN, "Oficina", True, True)
    assert (await server.trabajar_mas(conductor("d2")))["vacantes"] == []   # cubierto: a Luis ya no le sale
    # Si la oficina cambia después la celda a mano, la constancia no miente.
    turno.update(cod="1", type="trabaja")
    assert (await server.trabajar_mas(conductor("d1")))["extras"][0]["en_cuadrante"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_la_oficina_hace_suyo_el_automatico_y_avisa(nave):
    _maximas(nave, **{MAN: 3})
    await server.solicitar_trabajar_mas(MAN, {}, conductor("d1"))
    r = await _crear(plazas=2, nota="Ruta de tarde")
    ref = nave.t.refuerzos.docs[0]
    assert len(nave.t.refuerzos.docs) == 1 and (ref["auto"], ref["nota"], ref["creado_por"]) == (False, "Ruta de tarde", "Oficina")
    # Se avisa a Luis, que libra; a Ana no, que ya lo había solicitado.
    assert r["avisados"] == 1 and nave.conductores[-1].ids == ["d2"]
    with pytest.raises(HTTPException) as e:                        # y ahora sí es de la oficina: uno por día
        await _crear()
    assert e.value.status_code == 409
