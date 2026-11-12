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
    # Se le ha puesto su secundaria PORQUE la principal tiene la ITV caducada: se nombra la principal, que iba por
    # delante de la que se puso (11-11-2026, segunda ronda; la primera corrección de P26 no la nombraba).
    assert j["itv_caducada"] == [
        {"furgo": "1234 ABC", "itv_date": _iso(_hoy() - timedelta(days=2)), "conductor": "ANA PÉREZ"}]
    assert "1234 ABC" not in [o["furgo"] for o in j["opciones"]["0"]]
    # Con las dos caducadas se queda sin ninguna, y entonces sí se nombran las dos.
    base.vehicles.docs[1]["itv_date"] = _iso(_hoy() - timedelta(days=5))
    r = await cliente.post("/api/tools/plantilla-furgos", headers=_cab(),
                           json={"center": "OGA5", "date": _hoja(_hoy()), "rows": [{"conductor": "ANA PÉREZ"}]})
    j = r.json()
    assert [p["furgo"] for p in j["propuestas"] if p["aplicar"]] == []
    assert j["itv_caducada"] == [
        {"furgo": "1234 ABC", "itv_date": _iso(_hoy() - timedelta(days=2)), "conductor": "ANA PÉREZ"},
        {"furgo": "5678 DEF", "itv_date": _iso(_hoy() - timedelta(days=5)), "conductor": "ANA PÉREZ"}]


async def test_la_nota_de_la_itv_no_nombra_la_secundaria_si_la_principal_se_puso(cliente, base):
    """P26 (11-11-2026): la principal está bien y se pone; que la secundaria tenga la ITV caducada no es noticia."""
    base.drivers.docs.append({"id": "d1", "name": "ANA PÉREZ", "center": "OGA5"})
    _flota_itv(base, _iso(_hoy() + timedelta(days=400)), _iso(_hoy() - timedelta(days=2)))
    base[server._AFIN_COL].docs.append({"driver_id": "d1", "principal": "v1", "secundaria": "v2"})
    r = await cliente.post("/api/tools/plantilla-furgos", headers=_cab(),
                           json={"center": "OGA5", "date": _hoja(_hoy()), "rows": [{"conductor": "ANA PÉREZ"}]})
    assert r.status_code == 200, r.text
    assert [p["furgo"] for p in r.json()["propuestas"] if p["aplicar"]] == ["1234 ABC"]
    assert r.json()["itv_caducada"] == []


async def test_la_nota_de_la_itv_nombra_la_principal_si_por_ella_se_puso_la_secundaria(cliente, base):
    """Segunda ronda (11-11-2026): se nombra la saltada por la ITV que iba POR DELANTE de la que se puso. Principal
    caducada y secundaria puesta: sale la nota de la principal, y solo de ella."""
    base.drivers.docs.append({"id": "d1", "name": "ANA PÉREZ", "center": "OGA5"})
    _flota_itv(base, _iso(_hoy() - timedelta(days=3)), _iso(_hoy() + timedelta(days=400)))
    base[server._AFIN_COL].docs.append({"driver_id": "d1", "principal": "v1", "secundaria": "v2"})
    r = await cliente.post("/api/tools/plantilla-furgos", headers=_cab(),
                           json={"center": "OGA5", "date": _hoja(_hoy()), "rows": [{"conductor": "ANA PÉREZ"}]})
    assert r.status_code == 200, r.text
    j = r.json()
    assert [p["furgo"] for p in j["propuestas"] if p["aplicar"]] == ["5678 DEF"]
    assert j["itv_caducada"] == [
        {"furgo": "1234 ABC", "itv_date": _iso(_hoy() - timedelta(days=3)), "conductor": "ANA PÉREZ"}]


async def test_la_nota_de_la_itv_con_completar_nombra_las_dos_si_se_puso_otra(cliente, base):
    """Segunda ronda (11-11-2026): con «completar» y las dos fijas caducadas se le pone una tercera; las dos iban por
    delante de ella, así que se nombran las dos (con la primera corrección de P26 no salía ninguna)."""
    base.drivers.docs.append({"id": "d1", "name": "ANA PÉREZ", "center": "OGA5"})
    _flota_itv(base, _iso(_hoy() - timedelta(days=3)), _iso(_hoy() - timedelta(days=6)))
    base.vehicles.docs.append({"id": "v3", "license_plate": "9012 GHI", "status": "active", "center": "OGA5",
                               "itv_date": _iso(_hoy() + timedelta(days=400))})
    base[server._AFIN_COL].docs.append({"driver_id": "d1", "principal": "v1", "secundaria": "v2"})
    r = await cliente.post("/api/tools/plantilla-furgos", headers=_cab(),
                           json={"center": "OGA5", "date": _hoja(_hoy()), "completar": True,
                                 "rows": [{"conductor": "ANA PÉREZ"}]})
    assert r.status_code == 200, r.text
    j = r.json()
    assert [p["furgo"] for p in j["propuestas"] if p["aplicar"]] == ["9012 GHI"], j["propuestas"]
    assert j["itv_caducada"] == [
        {"furgo": "1234 ABC", "itv_date": _iso(_hoy() - timedelta(days=3)), "conductor": "ANA PÉREZ"},
        {"furgo": "5678 DEF", "itv_date": _iso(_hoy() - timedelta(days=6)), "conductor": "ANA PÉREZ"}]


async def test_poner_furgonetas_con_fecha_vacia_mide_contra_hoy(cliente, base):
    # Caduca dentro de 3 días: hoy (el panel nuevo con la fecha de la hoja vacía) se pone su principal.
    _flota_fijas(base, _iso(_hoy() + timedelta(days=3)))
    r = await cliente.post("/api/tools/plantilla-furgos", headers=_cab(),
                           json={"center": "OGA5", "date": "", "rows": [{"conductor": "ANA PÉREZ"}]})
    assert r.status_code == 200, r.text
    assert [p["furgo"] for p in r.json()["propuestas"] if p["aplicar"]] == ["1234 ABC"]
    assert r.json()["itv_caducada"] == []
    # Para una hoja de dentro de 5 días, ya no.
    r = await cliente.post("/api/tools/plantilla-furgos", headers=_cab(),
                           json={"center": "OGA5", "date": _hoja(_hoy() + timedelta(days=5)),
                                 "rows": [{"conductor": "ANA PÉREZ"}]})
    assert [p["furgo"] for p in r.json()["propuestas"] if p["aplicar"]] == ["5678 DEF"]
    # Con la fecha vacía y la ITV ya caducada hoy: tampoco.
    base.vehicles.docs[0]["itv_date"] = _iso(_hoy() - timedelta(days=1))
    r = await cliente.post("/api/tools/plantilla-furgos", headers=_cab(),
                           json={"center": "OGA5", "date": "", "rows": [{"conductor": "ANA PÉREZ"}]})
    assert [p["furgo"] for p in r.json()["propuestas"] if p["aplicar"]] == ["5678 DEF"]


async def test_poner_furgonetas_web_vieja_sin_date_como_main(cliente, base):
    """P25 (11-11-2026): la web vieja en caché no manda `date`. Para ella, como en main: la de la ITV caducada se
    propone como cualquier otra y la respuesta no trae `itv_caducada`."""
    _flota_fijas(base, _iso(_hoy() - timedelta(days=2)))
    cuerpo = {"center": "OGA5", "rows": [{"conductor": "ANA PÉREZ"}]}
    r = await cliente.post("/api/tools/plantilla-furgos", headers=_cab(), json=cuerpo)
    assert r.status_code == 200, r.text
    j = r.json()
    assert [p["furgo"] for p in j["propuestas"] if p["aplicar"]] == ["1234 ABC"]
    assert "itv_caducada" not in j
    assert "1234 ABC" in [o["furgo"] for o in j["opciones"]["0"]]


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


async def test_el_casador_de_la_plantilla_casa_igual_que_afin_casar():
    """P24 (11-11-2026): el casado con los nombres normalizados una sola vez da lo mismo que `_afin_casar`."""
    pares = [("d1", "ANA PÉREZ GIL"), ("d2", "LUIS GÓMEZ RUIZ"), ("d3", "ANA PÉREZ GIL"), ("d4", "Sara Vidal-Rey"),
             ("d5", "PABLO SOUTO"), ("d6", "PABLO SOUTO DÍAZ"), ("d7", ""), ("d8", "MARÍA JOSÉ LAGO PAZ"),
             ("d9", "MARIA JOSE LAGO")]
    casar = server._plantilla_casador(pares)
    for nombre in ("ANA PÉREZ GIL", "ana perez gil", "LUIS GOMEZ", "luis gómez ruiz", "SARA VIDAL REY", "SARA",
                   "PABLO SOUTO", "PABLO SOUTO DIAZ", "SOUTO DIAZ", "MARIA JOSE LAGO PAZ", "MARIA JOSE LAGO",
                   "JOSE LAGO", "LAGO", "", "   ", "NADIE CONOCIDO", "LUIS GOM...", "PÉREZ GIL ANA"):
        assert casar(nombre) == server._afin_casar(nombre, pares), nombre
        for _, otro in pares:
            assert server._plantilla_puntos(server._name_tokens(nombre), server._name_tokens(otro)) == \
                server._match_score(nombre, otro), (nombre, otro)


async def test_validar_no_normaliza_la_plantilla_entera_en_cada_fila(base, monkeypatch):
    """P24: con 200 fichas y 50 filas, los nombres se normalizan una vez por llamada, no una por fila (antes, más
    de 10.000 veces)."""
    nombres = ["CONDUCTOR%03d APELLIDO%03d SEGUNDO%03d" % (i, i, i) for i in range(200)]
    conductores = [{"id": f"c{i}", "name": n, "center": "OGA5"} for i, n in enumerate(nombres)]
    base.drivers.docs += [dict(c) for c in conductores]
    dia = _iso(_hoy() + timedelta(days=1))
    for i in range(150, 180):                                     # 30 de turno de ruta que no están en la hoja
        _turno(base, f"c{i}", dia, "1", nombre=nombres[i])
    filas = [_fila(conductor=n) for n in nombres[:45]] + \
        [_fila(conductor="CONDUCTOR%03d APELLIDO%03d" % (i, i)) for i in range(45, 50)]   # 5 que casan por parecido
    llamadas = [0]
    original = server._normalize_name

    def _contando(nombre):
        llamadas[0] += 1
        return original(nombre)
    monkeypatch.setattr(server, "_normalize_name", _contando)
    avisos, faltan, con = await server._plantilla_cuadrante(filas, conductores, "OGA5", dia, {"account_type": "owner"})
    assert con is True and len(faltan) == 30
    assert llamadas[0] < 1500, llamadas[0]


async def test_limitado_a_una_nave_no_ve_ausencias_ni_suspensiones_de_otra(cliente, base):
    """P1 (11-11-2026): quien solo ve OGA5 no se entera de que alguien de DGA1 está de vacaciones o suspendido.
    El prestado de DGA1 con su turno en OGA5 sí avisa (ese turno lo ve en su cuadrante); para el dueño, todo igual."""
    _equipo(base)
    base.drivers.docs += [{"id": "e1", "name": "TOMÁS RIVAS PENA", "center": "DGA1"},
                          {"id": "e2", "name": "ELENA CASAL MOURE", "center": "DGA1"},
                          {"id": "e3", "name": "IVÁN LOSADA FREIRE", "center": "DGA1"}]
    dia = _hoy() + timedelta(days=1)
    _turno(base, "d1", _iso(dia), "V")                             # de OGA5: se ve
    _turno(base, "e1", _iso(dia), "V", center="DGA1")              # de DGA1, de vacaciones en DGA1: no se ve
    base.suspensiones.docs.append({"driver_id": "e2", "center": "DGA1", "estado": "activa", "desde": _iso(dia),
                                   "hasta": _iso(dia), "motivo": "X"})
    _turno(base, "e3", _iso(dia), "L", center="OGA5")              # de DGA1, con su día en OGA5: se ve
    filas = [_fila(conductor=n) for n in ("ANA PÉREZ GIL", "TOMÁS RIVAS PENA", "ELENA CASAL MOURE",
                                          "IVÁN LOSADA FREIRE")]
    cuerpo = {"rows": filas, "center": "OGA5", "date": dia.strftime("%d/%m/%Y")}
    nuevos = ("no_tiene_turno", "suspendido")
    r = await cliente.post("/api/tools/plantilla-validar", json=cuerpo,
                           headers=_cab("u-oga5", "Jefe OGA5", centros=["OGA5"], cuenta="dsp"))
    assert r.status_code == 200, r.text
    assert [(a["fila"], a["tipo"]) for a in r.json()["avisos"] if a["tipo"] in nuevos] == [
        (0, "no_tiene_turno"), (3, "no_tiene_turno")]
    assert "Suspendido" not in str(r.json()) and "Vacaciones" not in str([a for a in r.json()["avisos"]
                                                                          if a["fila"] == 1])
    # El dueño (y quien no tiene naves asignadas) lo ve todo, como hasta ahora.
    for cab in (_cab(), _cab("u-todas", "Oficina", centros=None, cuenta="dsp")):
        r = await cliente.post("/api/tools/plantilla-validar", json=cuerpo, headers=cab)
        assert [(a["fila"], a["tipo"]) for a in r.json()["avisos"] if a["tipo"] in nuevos] == [
            (0, "no_tiene_turno"), (1, "no_tiene_turno"), (2, "suspendido"), (3, "no_tiene_turno")]


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


def _asignaciones_de_dos_naves(base):
    base["daily_assignments"] = Col([
        {"id": "a1", "date": "2026-11-11", "center": "OGA5", "slots": [{"driver_id": "dO"}],
         "updated_at": "2026-11-11T06:00:00+00:00", "updated_by": "María"},
        {"id": "a2", "date": "2026-11-11", "center": "DGA1", "slots": [{"driver_id": "dD"}],
         "updated_at": "2026-11-11T06:30:00+00:00", "updated_by": "Pedro"}])


async def test_limitado_no_lee_ni_pisa_la_asignacion_de_otra_nave(cliente, base):
    """P2 (11-11-2026, ya pasaba en main): quien solo ve OGA5 no lee ni pisa la Asignación de DGA1."""
    _asignaciones_de_dos_naves(base)
    cab = _cab("u-oga5", "Jefe OGA5", centros=["OGA5"], cuenta="dsp")
    r = await cliente.get("/api/assignments/daily?center=DGA1&date=2026-11-11", headers=cab)
    assert r.status_code == 403, r.text
    assert r.json()["detail"] == "No tienes acceso a ese centro"
    r = await cliente.put("/api/assignments/daily", headers=cab,
                          json={"center": "DGA1", "date": "2026-11-11", "slots": [SLOT]})
    assert r.status_code == 403, r.text
    dga1 = next(d for d in base.daily_assignments.docs if d["center"] == "DGA1")
    assert dga1["slots"] == [{"driver_id": "dD"}] and dga1["updated_by"] == "Pedro"
    # Su nave, como siempre (también con «oga5» en minúsculas en el permiso).
    r = await cliente.get("/api/assignments/daily?center=OGA5&date=2026-11-11", headers=cab)
    assert r.status_code == 200 and [d["id"] for d in r.json()] == ["a1"]
    r = await cliente.put("/api/assignments/daily", headers=_cab("u-oga5b", "Jefe", centros=["oga5"], cuenta="dsp"),
                          json={"center": "OGA5", "date": "2026-11-11", "slots": [SLOT]})
    assert r.status_code == 200, r.text
    # Con «Todos» o sin centro, solo las suyas.
    for q in ("center=Todos&", ""):
        r = await cliente.get(f"/api/assignments/daily?{q}date=2026-11-11", headers=cab)
        assert r.status_code == 200, r.text
        assert [d["id"] for d in r.json()] == ["a1"], q


async def test_asignacion_sin_naves_asignadas_o_dueno_igual_que_siempre(cliente, base):
    _asignaciones_de_dos_naves(base)
    for cab in (_cab(), _cab("u-todas", "Oficina", centros=None, cuenta="dsp"),
                _cab("u-vacio", "Oficina", centros=[], cuenta="dsp")):
        r = await cliente.get("/api/assignments/daily?center=Todos&date=2026-11-11", headers=cab)
        assert r.status_code == 200 and sorted(d["id"] for d in r.json()) == ["a1", "a2"]
        r = await cliente.get("/api/assignments/daily?center=DGA1&date=2026-11-11", headers=cab)
        assert r.status_code == 200 and [d["id"] for d in r.json()] == ["a2"]
        r = await cliente.put("/api/assignments/daily", headers=cab,
                              json={"center": "DGA1", "date": "2026-11-11", "slots": [SLOT]})
        assert r.status_code == 200, r.text


def _naves_de_la_empresa(monkeypatch, naves):
    """La ficha de la organización con su lista de naves (la principal se resuelve por `account_type`)."""
    g = Db()
    g.organizations.docs.append({"id": "o1", "account_type": "owner", "centers": list(naves)})
    monkeypatch.setattr(server, "global_db", g)


async def _guardar_en(cliente, cab, centro):
    return await cliente.put("/api/assignments/daily", headers=cab,
                             json={"center": centro, "date": "2026-11-11", "slots": [SLOT]})


async def test_limitado_no_guarda_una_asignacion_con_un_nombre_de_nave_inventado(cliente, base, monkeypatch):
    """V2 (11-11-2026): quien solo ve OGA5 guardaba la Asignación de «OGA5 DGA1» (lleva OGA5 dentro y pasaba el
    permiso), y el portal y el resumen de DGA1 la leían como suya. Ahora, para un usuario limitado, el centro tiene que
    ser una nave de la empresa (o una de las suyas) y que él la vea; su nave, en mayúsculas o en minúsculas, como
    siempre."""
    _naves_de_la_empresa(monkeypatch, ["OGA5", "DGA1", "DGA2"])
    cab = _cab("u-oga5", "Jefe OGA5", centros=["OGA5"], cuenta="dsp")
    for inventado in ("OGA5 DGA1", "OGA5/DGA1", "DGA1 OGA5", "OGA5-DGA1", "AMZL OGA5 SANTIAGO XPT"):
        r = await _guardar_en(cliente, cab, inventado)
        assert r.status_code == 403, (inventado, r.text)
        assert r.json()["detail"] == "No tienes acceso a ese centro"
    assert base.daily_assignments.docs == []           # no se ha escrito nada
    for suya in ("OGA5", "oga5", " Oga5 "):
        r = await _guardar_en(cliente, cab, suya)
        assert r.status_code == 200, (suya, r.text)
    # Con el permiso en minúsculas, igual.
    r = await _guardar_en(cliente, _cab("u-oga5b", "Jefe", centros=["oga5"], cuenta="dsp"), "OGA5")
    assert r.status_code == 200, r.text
    # Una nave suya que la ficha de la empresa no lista (datos viejos: el selector le ofrece las suyas): sigue
    # guardando. Y lo que lleve otra nave dentro, no.
    cab9 = _cab("u-dga9", "Jefe DGA9", centros=["DGA9"], cuenta="dsp")
    r = await _guardar_en(cliente, cab9, "DGA9")
    assert r.status_code == 200, r.text
    r = await _guardar_en(cliente, cab9, "DGA9 DGA1")
    assert r.status_code == 403, r.text


async def test_limitado_y_empresa_sin_lista_de_naves_salen_de_las_fichas(cliente, base, monkeypatch):
    """Sin naves en la ficha de la organización, las naves conocidas son los códigos limpios de las fichas (los de
    `_centros_conocidos`)."""
    base.drivers.docs += [{"id": "d1", "name": "ANA", "center": "OGA5"},
                          {"id": "d2", "name": "PEDRO", "center": "DGA1"}]
    cab = _cab("u-oga5", "Jefe OGA5", centros=["OGA5"], cuenta="dsp")
    r = await _guardar_en(cliente, cab, "OGA5/DGA1")
    assert r.status_code == 403, r.text
    r = await _guardar_en(cliente, cab, "OGA5")
    assert r.status_code == 200, r.text


async def test_nombre_de_nave_inventado_igual_que_siempre_para_los_demas(cliente, base, monkeypatch):
    """V2: el dueño y el super-admin (aunque tengan naves apuntadas) y quien no tiene naves asignadas guardan como
    antes, con el nombre que manden. Y si la empresa no tiene ninguna lista de naves (ni en su ficha ni en las fichas
    de los conductores), el limitado también, como antes."""
    sa = server.create_token("u-sa", "admin", "Super", org_id="o1", account_type="dsp", super_admin=True)
    server._ADMIN_EXISTS_CACHE["u-sa"] = (time.time() + 600, True, ["OGA5"], None, None)
    todos = (_cab(), _cab("u-duena", "Dueña", centros=["OGA5"]), {"Authorization": f"Bearer {sa}"},
             _cab("u-todas", "Oficina", centros=None, cuenta="dsp"),
             _cab("u-vacio", "Oficina", centros=[], cuenta="dsp"))
    # Sin lista de naves en ningún sitio: nadie nota nada.
    for cab in todos + (_cab("u-oga5", "Jefe OGA5", centros=["OGA5"], cuenta="dsp"),):
        r = await _guardar_en(cliente, cab, "OGA5 DGA1")
        assert r.status_code == 200, r.text
    # Con lista: los que no están limitados, igual que siempre.
    _naves_de_la_empresa(monkeypatch, ["OGA5", "DGA1", "DGA2"])
    base["daily_assignments"] = Col()
    for cab in todos:
        for centro in ("OGA5 DGA1", "NAVE NUEVA", "DGA1"):
            r = await _guardar_en(cliente, cab, centro)
            assert r.status_code == 200, (centro, r.text)
    assert sorted({d["center"] for d in base.daily_assignments.docs}) == ["DGA1", "NAVE NUEVA", "OGA5 DGA1"]


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
    """P12 (11-11-2026): su nave no tiene Asignación. Ve lo de siempre (la lista de su nave, «sin_cuadrante») y
    además la furgoneta de la otra nave; nunca en lugar de lo suyo."""
    _asig(portal, "OGA5", ("juan", "vO"))
    ids, puede, motivo = await _ver("juan")
    assert ids[0] == "vO" and sorted(ids) == ["vD", "vD2", "vO"] and puede is True and motivo == "sin_cuadrante"


async def test_prestado_su_nave_sin_asignacion_y_con_furgoneta_fija(portal):
    """P12: con su furgoneta fija (la de siempre) la sigue viendo, y además la del préstamo."""
    next(v for v in portal.vehicles.docs if v["id"] == "vD")["current_driver_id"] = "juan"
    _asig(portal, "OGA5", ("juan", "vO"))
    assert await _ver("juan") == (["vO", "vD"], True, None)


async def test_prestado_con_la_furgoneta_del_hueco_de_baja_ve_lo_de_antes(portal):
    """P12: la furgoneta del hueco de la otra nave no está (de baja o borrada): lo de antes, en los dos casos."""
    next(v for v in portal.vehicles.docs if v["id"] == "vO")["status"] = "baja"
    _asig(portal, "OGA5", ("juan", "vO"))
    ids, puede, motivo = await _ver("juan")                          # su nave sin Asignación: la lista de su nave
    assert sorted(ids) == ["vD", "vD2"] and puede is True and motivo == "sin_cuadrante"
    _asig(portal, "DGA2", ("otro", "vD"))                            # su nave con Asignación y él no está
    assert await _ver("juan") == ([], False, "no_en_ruta")
    portal.vehicles.docs[:] = [v for v in portal.vehicles.docs if v["id"] != "vO"]   # borrada del todo: igual
    assert await _ver("juan") == ([], False, "no_en_ruta")


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
