# -*- coding: utf-8 -*-
"""Tanda 3, zona «día» (11-11-2026), contra el servidor de verdad (server.app) con una base de mentira en memoria:
no hace falta Mongo.

- dia-5: la Plantilla avisa de la furgoneta con la ITV caducada (medida contra el día DE LA HOJA) y «Poner
  furgonetas» ya no la pone sola. Sin fecha de ITV, sin aviso. Furgonetas fijas no cambia.

Las fechas salen de hoy (Madrid), nunca escritas: así las pruebas no caducan.
"""
import time
from datetime import date, timedelta

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

import server
from base_de_mentira import Col, Db

pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest_asyncio.fixture(loop_scope="session")
async def cliente():
    async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://testserver") as c:
        yield c


class _ColConAgregado(Col):
    """Los daños abiertos por furgoneta (`_afin_datos`): ninguno."""

    def aggregate(self, _pipeline):
        return _Vacio()


class _Vacio:
    def __aiter__(self):
        return self

    async def __anext__(self):
        raise StopAsyncIteration


@pytest.fixture
def base(monkeypatch):
    b = Db()
    b["vehicle_damage_ledger"] = _ColConAgregado()
    monkeypatch.setattr(server, "db", b)
    monkeypatch.setattr(server, "global_db", Db())

    async def _sin_cuidado(*_a, **_k):
        return {}, False, ""
    monkeypatch.setattr(server, "_afin_cuidado", _sin_cuidado)
    server._ADMIN_EXISTS_CACHE.clear()
    yield b
    server._ADMIN_EXISTS_CACHE.clear()


def _cab(uid="u-ofi", nombre="Oficina", centros=None, cuenta="owner"):
    """Un usuario de oficina que existe (la caché de _admin_cacheado hace de base)."""
    server._ADMIN_EXISTS_CACHE[uid] = (time.time() + 600, True, centros, None, None)
    tok = server.create_token(uid, "admin", nombre, org_id="o1", account_type=cuenta)
    return {"Authorization": f"Bearer {tok}"}


def _hoy() -> date:
    return date.fromisoformat(server._hoy_madrid())


def _iso(d: date) -> str:
    return d.isoformat()


def _hoja(d: date) -> str:
    return d.strftime("%d/%m/%Y")


FILA = {"ruta": "", "conductor": "", "movil": "", "furgo": "", "h_salida": "", "h_bajada": "", "h_llegada": "",
        "observaciones": ""}


def _fila(**k):
    return {**FILA, **k}


# ── dia-5 · la función pura ──────────────────────────────────────────────────

MATS = {"1234ABC": "1234 ABC", "5678DEF": "5678 DEF"}


def _itv(avisos):
    return [a for a in avisos if a["tipo"] == "itv_caducada"]


async def test_itv_caducada_antes_del_dia_de_la_hoja_avisa():
    av = server._plantilla_validar_filas([_fila(furgo="1234 ABC")], [], MATS, {},
                                         itv={"1234ABC": "2026-03-01"}, dia="2026-03-02")
    assert _itv(av) == [{"fila": 0, "campo": "furgo", "tipo": "itv_caducada",
                         "texto": "ITV caducada desde el 01/03/2026", "sugerencia": None}]


async def test_itv_que_caduca_ese_dia_o_despues_no_avisa():
    for f in ("2026-03-02", "2026-03-03"):
        av = server._plantilla_validar_filas([_fila(furgo="1234ABC")], [], MATS, {},
                                             itv={"1234ABC": f}, dia="2026-03-02")
        assert _itv(av) == [], f


async def test_itv_sin_fecha_o_mal_escrita_no_avisa():
    for itv in ({}, {"1234ABC": ""}, {"1234ABC": "01/03/2026"}, {"1234ABC": "pronto"}, {"1234ABC": None}):
        av = server._plantilla_validar_filas([_fila(furgo="1234ABC")], [], MATS, {}, itv=itv, dia="2026-03-02")
        assert _itv(av) == [], itv


async def test_sin_los_parametros_nuevos_los_avisos_de_siempre():
    filas = [_fila(furgo="1234ABC", ruta="CX1"), _fila(furgo="9999ZZZ")]
    antes = server._plantilla_validar_filas(filas, [], MATS, {})
    con = server._plantilla_validar_filas(filas, [], MATS, {}, itv={"1234ABC": "2000-01-01"}, dia="")
    assert antes == con
    assert sorted(a["tipo"] for a in antes) == ["hora_falta", "matricula_desconocida"]


# ── dia-5 · plantilla-validar ─────────────────────────────────────────────────

def _flota_itv(base, itv_v1, itv_v2="", center="OGA5"):
    base.vehicles.docs += [
        {"id": "v1", "license_plate": "1234 ABC", "status": "active", "center": center, "itv_date": itv_v1},
        {"id": "v2", "license_plate": "5678 DEF", "status": "active", "center": center, "itv_date": itv_v2},
    ]


async def test_validar_avisa_de_la_itv_contra_el_dia_de_la_hoja(cliente, base):
    # Caduca dentro de 3 días: hoy está en regla, el día de la hoja (dentro de 5) ya no.
    _flota_itv(base, _iso(_hoy() + timedelta(days=3)))
    cuerpo = {"rows": [_fila(furgo="1234ABC"), _fila(furgo="5678DEF")], "center": "OGA5",
              "date": _hoja(_hoy() + timedelta(days=5))}
    r = await cliente.post("/api/tools/plantilla-validar", headers=_cab(), json=cuerpo)
    assert r.status_code == 200, r.text
    itv = _itv(r.json()["avisos"])
    caduca = _hoy() + timedelta(days=3)
    assert itv == [{"fila": 0, "campo": "furgo", "tipo": "itv_caducada",
                    "texto": "ITV caducada desde el %s" % caduca.strftime("%d/%m/%Y"), "sugerencia": None}]
    assert r.json()["resumen"]["con_aviso"] == 1

    # La misma hoja con la fecha de hoy (o sin fecha): en regla, sin aviso.
    for fecha in (_hoja(_hoy()), ""):
        r = await cliente.post("/api/tools/plantilla-validar", headers=_cab(), json={**cuerpo, "date": fecha})
        assert _itv(r.json()["avisos"]) == [], fecha


async def test_validar_sin_fecha_de_itv_no_avisa_y_lo_demas_igual(cliente, base):
    _flota_itv(base, "", "")
    r = await cliente.post("/api/tools/plantilla-validar", headers=_cab(),
                           json={"rows": [_fila(furgo="1234ABC")], "center": "OGA5", "date": _hoja(_hoy())})
    assert r.status_code == 200, r.text
    assert r.json()["avisos"] == []
    assert set(r.json()) >= {"avisos", "con_asignacion", "dia", "resumen"}


# ── dia-5 · Poner furgonetas ─────────────────────────────────────────────────

def _flota_fijas(base, itv_v1):
    base.drivers.docs.append({"id": "d1", "name": "ANA PÉREZ", "center": "OGA5"})
    _flota_itv(base, itv_v1, _iso(_hoy() + timedelta(days=400)))
    base[server._AFIN_COL].docs.append({"driver_id": "d1", "principal": "v1", "secundaria": "v2"})


async def test_poner_furgonetas_no_pone_la_de_itv_caducada_y_lo_dice(cliente, base):
    _flota_fijas(base, _iso(_hoy() - timedelta(days=2)))
    r = await cliente.post("/api/tools/plantilla-furgos", headers=_cab(),
                           json={"center": "OGA5", "date": _hoja(_hoy()), "rows": [{"conductor": "ANA PÉREZ"}]})
    assert r.status_code == 200, r.text
    j = r.json()
    puestas = [p["furgo"] for p in j["propuestas"] if p["aplicar"]]
    assert puestas == ["5678 DEF"], j["propuestas"]
    assert j["itv_caducada"] == [{"furgo": "1234 ABC", "itv_date": _iso(_hoy() - timedelta(days=2)),
                                  "conductor": "ANA PÉREZ"}]
    assert "1234 ABC" not in [o["furgo"] for o in j["opciones"]["0"]]


async def test_poner_furgonetas_sin_fecha_mide_contra_hoy(cliente, base):
    # Caduca dentro de 3 días: hoy (sin `date`, como la web de antes) se pone su principal, como siempre.
    _flota_fijas(base, _iso(_hoy() + timedelta(days=3)))
    r = await cliente.post("/api/tools/plantilla-furgos", headers=_cab(),
                           json={"center": "OGA5", "rows": [{"conductor": "ANA PÉREZ"}]})
    assert r.status_code == 200, r.text
    assert [p["furgo"] for p in r.json()["propuestas"] if p["aplicar"]] == ["1234 ABC"]
    assert r.json()["itv_caducada"] == []
    # Para una hoja de dentro de 5 días, ya no.
    r = await cliente.post("/api/tools/plantilla-furgos", headers=_cab(),
                           json={"center": "OGA5", "date": _hoja(_hoy() + timedelta(days=5)),
                                 "rows": [{"conductor": "ANA PÉREZ"}]})
    assert [p["furgo"] for p in r.json()["propuestas"] if p["aplicar"]] == ["5678 DEF"]


async def test_furgonetas_fijas_sigue_viendola_operativa(cliente, base):
    _flota_fijas(base, _iso(_hoy() - timedelta(days=2)))
    r = await cliente.get("/api/afinidad?center=OGA5", headers=_cab())
    assert r.status_code == 200, r.text
    v1 = next(f for f in r.json()["furgos"] if f["id"] == "v1")
    assert v1["operativa"] is True
    assert "itv_date" not in v1


# ── dia-4 · el cuadrante y las suspensiones en la Plantilla ──────────────────

def _equipo(base):
    for did, nom, c in (("d1", "ANA PÉREZ GIL", "OGA5"), ("d2", "LUIS GÓMEZ RUIZ", "OGA5"),
                        ("d3", "SARA VIDAL REY", "OGA5"), ("d4", "PABLO SOUTO DÍAZ", "OGA5"),
                        ("d5", "NURIA VARELA LAGO", "OGA5"), ("d9", "MARTA BAJA LÓPEZ", "OGA5")):
        base.drivers.docs.append({"id": did, "name": nom, "center": c})
    base.drivers.docs[-1]["active"] = False                       # d9: ficha de baja


def _turno(base, did, dia, cod=None, center="OGA5", tipo=None, nombre=""):
    t = {"driver_id": did, "date": dia, "center": center, "driver_name": nombre}
    if cod is not None:
        t["cod"] = cod
        t["type"] = server.CODIGOS_CUADRANTE_DEF.get(cod, "trabaja")
    if tipo:
        t["type"] = tipo
    base.shifts.docs.append(t)


async def _validar(cliente, filas, dia, center="OGA5"):
    r = await cliente.post("/api/tools/plantilla-validar", headers=_cab(),
                           json={"rows": filas, "center": center, "date": dia.strftime("%d/%m/%Y")})
    assert r.status_code == 200, r.text
    return r.json()


def _de(avisos, tipo):
    return [(a["fila"], a["texto"]) for a in avisos if a["tipo"] == tipo]


async def test_quien_libra_ese_dia_avisa_con_la_etiqueta_del_cuadrante(cliente, base):
    _equipo(base)
    dia = _hoy() + timedelta(days=1)
    _turno(base, "d1", _iso(dia), "V")
    _turno(base, "d2", _iso(dia), "BKP")                          # un backup en la hoja: lo han llamado
    _turno(base, "d3", _iso(dia), "1")
    _turno(base, "d4", _iso(dia), tipo="libre")                   # turno viejo, sin código
    j = await _validar(cliente, [_fila(conductor=n) for n in ("ANA PÉREZ GIL", "LUIS GÓMEZ RUIZ", "SARA VIDAL REY",
                                                               "PABLO SOUTO DÍAZ", "NURIA VARELA LAGO")], dia)
    assert _de(j["avisos"], "no_tiene_turno") == [(0, "En el cuadrante ese día: Vacaciones"),
                                                  (3, "En el cuadrante ese día: Libre")]
    assert all(a["sugerencia"] is None and a["campo"] == "conductor"
               for a in j["avisos"] if a["tipo"] == "no_tiene_turno")
    # Nuria no tiene turno ese día: sin aviso (el cuadrante puede no estar cargado).
    assert j["con_cuadrante"] is True and j["faltan"] == []


async def test_suspendido_avisa_sin_el_motivo_y_no_sale_en_faltan(cliente, base):
    _equipo(base)
    dia = _hoy() + timedelta(days=2)
    desde, hasta = dia - timedelta(days=1), dia + timedelta(days=3)
    base.suspensiones.docs += [
        {"driver_id": "d1", "estado": "activa", "desde": _iso(desde), "hasta": _iso(hasta), "motivo": "SECRETO"},
        {"driver_id": "d2", "estado": "activa", "desde": _iso(desde), "hasta": _iso(hasta), "motivo": "X"},
        {"driver_id": "d3", "estado": "levantada", "desde": _iso(desde), "hasta": _iso(hasta), "motivo": "X"},
    ]
    _turno(base, "d1", _iso(dia), "1")
    _turno(base, "d2", _iso(dia), "1")                             # suspendido y sin fila: no «falta»
    _turno(base, "d3", _iso(dia), "1")                             # suspensión levantada: sí falta
    j = await _validar(cliente, [_fila(conductor="ANA PÉREZ GIL")], dia)
    sus = [a for a in j["avisos"] if a["tipo"] == "suspendido"]
    assert [(a["fila"], a["texto"]) for a in sus] == [
        (0, "Suspendido del %s al %s" % (desde.strftime("%d/%m"), hasta.strftime("%d/%m")))]
    assert "SECRETO" not in str(j)
    assert [f["driver_id"] for f in j["faltan"]] == ["d3"]


async def test_faltan_los_de_turno_de_ruta_en_la_nave_sin_fila(cliente, base):
    _equipo(base)
    dia = _hoy() + timedelta(days=1)
    _turno(base, "d1", _iso(dia), "1")                             # en la hoja
    _turno(base, "d2", _iso(dia), "X")                             # falta
    _turno(base, "d3", _iso(dia), tipo="trabaja")                  # turno viejo sin código: cuenta como ruta
    _turno(base, "d4", _iso(dia), "BKP")                           # backup: no saca ruta, no falta
    _turno(base, "d5", _iso(dia), "1", center="DGA1")              # de otra nave
    _turno(base, "d9", _iso(dia), "1")                             # ficha de baja
    j = await _validar(cliente, [_fila(conductor="ANA PÉREZ GIL")], dia)
    assert j["con_cuadrante"] is True
    assert j["faltan"] == [{"driver_id": "d2", "nombre": "LUIS GÓMEZ RUIZ"},
                           {"driver_id": "d3", "nombre": "SARA VIDAL REY"}]
    # Con un nombre parecido en la hoja (ficha duplicada, nombre mal leído) no se le acusa.
    j = await _validar(cliente, [_fila(conductor="ANA PÉREZ GIL"), _fila(conductor="LUIS GOMEZ")], dia)
    assert [f["driver_id"] for f in j["faltan"]] == ["d3"]


async def test_sin_cuadrante_en_la_nave_ni_faltan_ni_avisos(cliente, base):
    _equipo(base)
    dia = _hoy() + timedelta(days=1)
    _turno(base, "d1", _iso(dia), "V", center="DGA1")              # su turno es de otra nave
    _turno(base, "d2", _iso(dia - timedelta(days=1)), "1")         # el cuadrante de OGA5 es de otro día
    j = await _validar(cliente, [_fila(conductor="ANA PÉREZ GIL")], dia)
    assert j["con_cuadrante"] is False and j["faltan"] == []
    # El aviso por fila mira su turno en CUALQUIER nave: libra ese día.
    assert _de(j["avisos"], "no_tiene_turno") == [(0, "En el cuadrante ese día: Vacaciones")]


async def test_con_todos_o_sin_fecha_nada_nuevo(cliente, base):
    _equipo(base)
    dia = _hoy() + timedelta(days=1)
    _turno(base, "d1", _iso(dia), "V")
    _turno(base, "d2", _iso(dia), "1")
    for center, fecha in (("Todos", dia.strftime("%d/%m/%Y")), ("", dia.strftime("%d/%m/%Y")), ("OGA5", ""),
                          ("OGA5", "mañana")):
        r = await cliente.post("/api/tools/plantilla-validar", headers=_cab(),
                               json={"rows": [_fila(conductor="ANA PÉREZ GIL")], "center": center, "date": fecha})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["avisos"] == [] and j["faltan"] == [] and j["con_cuadrante"] is False, (center, fecha)


async def test_tocayos_sin_aviso(cliente, base):
    _equipo(base)
    base.drivers.docs.append({"id": "d1b", "name": "ANA PÉREZ GIL", "center": "DGA1"})
    dia = _hoy() + timedelta(days=1)
    _turno(base, "d1", _iso(dia), "V")
    j = await _validar(cliente, [_fila(conductor="ANA PÉREZ GIL")], dia)
    assert _de(j["avisos"], "no_tiene_turno") == []


async def test_los_avisos_nuevos_van_junto_a_los_de_su_fila(cliente, base):
    _equipo(base)
    dia = _hoy() + timedelta(days=1)
    _turno(base, "d2", _iso(dia), "L")
    filas = [_fila(conductor="ANA PÉREZ GIL", ruta="CX1"), _fila(conductor="LUIS GÓMEZ RUIZ", ruta="CX2")]
    j = await _validar(cliente, filas, dia)
    assert [(a["fila"], a["tipo"]) for a in j["avisos"]] == [(0, "hora_falta"), (1, "hora_falta"), (1, "no_tiene_turno")]
    assert j["resumen"]["con_aviso"] == 2


# ── dia-6 · «otro guardó mientras editabas» en la Asignación ─────────────────

SLOT = {"vehicle_id": "v1", "vehicle_plate": "1234 ABC", "driver_id": "d1", "driver_name": "ANA", "route": ""}


async def _poner(cliente, cab, **extra):
    return await cliente.put("/api/assignments/daily", headers=cab,
                             json={"center": "OGA5", "date": "2026-11-11", "slots": [SLOT], **extra})


def _doc(base):
    return next(d for d in base.daily_assignments.docs if d["center"] == "OGA5")


async def test_sin_version_gana_el_ultimo_como_siempre(cliente, base):
    base["daily_assignments"] = Col([{"id": "a1", "date": "2026-11-11", "center": "OGA5", "slots": [],
                                      "updated_at": "2026-11-11T06:00:00+00:00", "updated_by": "María"}])
    r = await _poner(cliente, _cab("u-jefe", "Jefe OGA5"))
    assert r.status_code == 200, r.text
    assert r.json()["action"] == "updated" and r.json()["id"] == "a1"
    assert _doc(base)["slots"] == [SLOT]
    # Y se apunta quién y cuándo.
    assert _doc(base)["updated_by"] == "Jefe OGA5" and _doc(base)["updated_at"] == r.json()["updated_at"]


async def test_con_la_version_buena_guarda_y_devuelve_la_nueva(cliente, base):
    base["daily_assignments"] = Col([{"id": "a1", "date": "2026-11-11", "center": "OGA5", "slots": [],
                                      "updated_at": "2026-11-11T06:00:00+00:00"}])
    r = await _poner(cliente, _cab("u-jefe", "Jefe OGA5"), version="2026-11-11T06:00:00+00:00")
    assert r.status_code == 200, r.text
    nueva = r.json()["updated_at"]
    assert nueva and nueva != "2026-11-11T06:00:00+00:00"
    assert _doc(base)["updated_at"] == nueva and _doc(base)["slots"] == [SLOT]
    # La siguiente, con la nueva: también.
    r = await _poner(cliente, _cab("u-jefe", "Jefe OGA5"), version=nueva)
    assert r.status_code == 200, r.text


async def test_con_una_version_vieja_409_y_no_se_toca_nada(cliente, base):
    base["daily_assignments"] = Col([{"id": "a1", "date": "2026-11-11", "center": "OGA5", "slots": [{"driver_id": "dX"}],
                                      "updated_at": "2026-11-11T07:30:00+00:00", "updated_by": "María"}])
    r = await _poner(cliente, _cab("u-jefe", "Jefe OGA5"), version="2026-11-11T06:00:00+00:00")
    assert r.status_code == 409, r.text
    assert r.json()["detail"] == {"codigo": "otro_guardo", "por": "María", "updated_at": "2026-11-11T07:30:00+00:00"}
    assert _doc(base)["slots"] == [{"driver_id": "dX"}] and _doc(base)["updated_by"] == "María"
    # Con `forzar`, encima.
    r = await _poner(cliente, _cab("u-jefe", "Jefe OGA5"), version="2026-11-11T06:00:00+00:00", forzar=True)
    assert r.status_code == 200, r.text
    assert _doc(base)["slots"] == [SLOT] and _doc(base)["updated_by"] == "Jefe OGA5"


async def test_el_dia_estaba_vacio_al_cargar_y_otra_lo_creo(cliente, base):
    # Vacío al cargar (version '') y ya no lo está: 409.
    base["daily_assignments"] = Col([{"id": "a1", "date": "2026-11-11", "center": "OGA5", "slots": [{"driver_id": "dX"}],
                                      "updated_at": "2026-11-11T07:30:00+00:00", "updated_by": "María"}])
    r = await _poner(cliente, _cab("u-jefe", "Jefe OGA5"), version="")
    assert r.status_code == 409, r.text
    assert r.json()["detail"]["por"] == "María"


async def test_vacio_al_cargar_y_sigue_vacio_o_documento_antiguo_sin_fecha(cliente, base):
    r = await _poner(cliente, _cab("u-jefe", "Jefe OGA5"), version="")
    assert r.status_code == 200, r.text
    assert r.json()["action"] == "created" and _doc(base)["updated_by"] == "Jefe OGA5"
    # Un documento de antes, sin updated_at: la pantalla cargó '' y guarda bien.
    base["daily_assignments"] = Col([{"id": "a1", "date": "2026-11-11", "center": "OGA5", "slots": []}])
    r = await _poner(cliente, _cab("u-jefe", "Jefe OGA5"), version="")
    assert r.status_code == 200, r.text


async def test_otra_nave_u_otro_dia_no_cuentan(cliente, base):
    base["daily_assignments"] = Col([
        {"id": "a2", "date": "2026-11-11", "center": "DGA1", "slots": [], "updated_at": "2026-11-11T07:30:00+00:00"},
        {"id": "a3", "date": "2026-11-10", "center": "OGA5", "slots": [], "updated_at": "2026-11-10T07:30:00+00:00"}])
    r = await _poner(cliente, _cab("u-jefe", "Jefe OGA5"), version="")
    assert r.status_code == 200, r.text
    assert r.json()["action"] == "created"


async def test_el_asistente_apunta_quien_y_cambia_la_version(cliente, base):
    base["daily_assignments"] = Col([{"id": "a1", "date": "2026-11-11", "center": "OGA5", "slots": [],
                                      "updated_at": "2026-11-11T06:00:00+00:00"}])
    base.vehicles.docs.append({"id": "v1", "license_plate": "1234 ABC"})
    base.drivers.docs.append({"id": "d1", "name": "ANA"})
    r = await server._cia_asignar({"center": "OGA5", "fecha": "2026-11-11",
                                   "cambios": [{"vehicle_id": "v1", "driver_id": "d1"}]},
                                  {"account_type": "owner", "name": "Jefe OGA5"})
    assert r["ok"] is True
    assert _doc(base)["updated_by"] == "Asistente" and _doc(base)["updated_at"] != "2026-11-11T06:00:00+00:00"
    # Quien tenía la hoja abierta desde antes ya no la pisa sin enterarse.
    r = await _poner(cliente, _cab("u-jefe", "Jefe OGA5"), version="2026-11-11T06:00:00+00:00")
    assert r.status_code == 409 and r.json()["detail"]["por"] == "Asistente"


async def test_el_get_de_la_asignacion_trae_quien_guardo(cliente, base):
    r = await _poner(cliente, _cab("u-jefe", "Jefe OGA5"))
    assert r.status_code == 200, r.text
    r = await cliente.get("/api/assignments/daily?center=OGA5&date=2026-11-11", headers=_cab("u-jefe", "Jefe OGA5"))
    assert r.status_code == 200, r.text
    (doc,) = r.json()
    assert doc["updated_by"] == "Jefe OGA5" and doc["updated_at"]


# ── dia-1-prestados · el portal ve la furgoneta de la Asignación de otra nave ─

HOY_PORTAL = "2026-11-11"


@pytest.fixture
def portal(base, monkeypatch):
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY_PORTAL)
    base.drivers.docs += [{"id": "juan", "name": "JUAN", "center": "DGA2", "email": "juan@x.es"},
                          {"id": "otro", "name": "OTRO", "center": "DGA2"},
                          {"id": "ana", "name": "ANA", "center": "OGA5"}]
    base.vehicles.docs += [{"id": "vO", "license_plate": "1111 OGA", "status": "active", "center": "OGA5"},
                           {"id": "vD", "license_plate": "2222 DGA", "status": "active", "center": "DGA2"},
                           {"id": "vD2", "license_plate": "3333 DGA", "status": "active", "center": "DGA2"}]
    return base


def _asig(base, center, *pares):
    base.daily_assignments.docs.append({"id": "a-" + center, "date": HOY_PORTAL, "center": center,
                                        "slots": [{"vehicle_id": v, "driver_id": d} for d, v in pares]})


async def _ver(did):
    r = await server.get_vehicles_portal({"sub": did, "role": "driver"})
    return [v["id"] for v in r["vehicles"]], r["puede_auditar"], r["motivo"]


async def test_prestado_en_la_asignacion_de_otra_nave_y_la_suya_sin_el(portal):
    _asig(portal, "OGA5", ("juan", "vO"))
    _asig(portal, "DGA2", ("otro", "vD"))
    assert await _ver("juan") == (["vO"], True, None)
    # A quien está en la de su nave no le cambia nada.
    assert await _ver("otro") == (["vD"], True, None)


async def test_prestado_y_su_nave_sin_asignacion(portal):
    _asig(portal, "OGA5", ("juan", "vO"))
    assert await _ver("juan") == (["vO"], True, None)


async def test_sin_estar_en_ninguna_igual_que_hoy(portal):
    _asig(portal, "OGA5", ("ana", "vO"))
    _asig(portal, "DGA2", ("otro", "vD"))
    # Juan no está en ninguna y su nave tiene Asignación: «no_en_ruta», como siempre.
    assert await _ver("juan") == ([], False, "no_en_ruta")


async def test_de_oga5_fuera_de_la_suya_sigue_bloqueado(portal):
    _asig(portal, "OGA5", ("otro", "vO"))
    assert await _ver("ana") == ([], False, "no_en_ruta")


async def test_sin_asignacion_en_ninguna_la_lista_de_su_nave(portal):
    ids, puede, motivo = await _ver("juan")
    assert sorted(ids) == ["vD", "vD2"] and puede is True and motivo == "sin_cuadrante"


async def test_suspendido_aunque_este_asignado_en_otra_nave(portal):
    _asig(portal, "OGA5", ("juan", "vO"))
    portal.suspensiones.docs.append({"driver_id": "juan", "estado": "activa", "desde": HOY_PORTAL,
                                     "hasta": HOY_PORTAL, "motivo": "x"})
    assert await _ver("juan") == ([], False, "suspendido")


async def test_otra_asignacion_de_otro_dia_no_cuenta(portal):
    portal.daily_assignments.docs.append({"id": "ayer", "date": "2026-11-10", "center": "OGA5",
                                          "slots": [{"vehicle_id": "vO", "driver_id": "juan"}]})
    _asig(portal, "DGA2", ("otro", "vD"))
    assert await _ver("juan") == ([], False, "no_en_ruta")
