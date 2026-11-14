# -*- coding: utf-8 -*-
"""«Antes del perito» (14-11-2026): las respuestas de ejemplo que usan las pruebas de pantalla.

Siembra una flota inventada en la base de mentira, la recorre con las rutas DE VERDAD (marcar lados, deshacer nada,
reparar desde la ficha, confirmar en «Revisión rápida") y guarda lo que devuelven:

  frontend/e2e/fixtures/repaso-dia.json  <- GET /api/repaso/dia?fecha=2026-11-12
  frontend/e2e/fixtures/expediente.json  <- GET /api/vehicles/veh-5678/antes-del-perito

Las pantallas de repaso y de expediente usan ESOS ficheros como respuesta simulada: si el servidor cambia la forma
de la respuesta, esta prueba falla hasta que se regeneran, y entonces fallan las de pantalla que no la sigan. Así la
pantalla y el servidor no pueden separarse en silencio.

Regenerar:  ACTUALIZAR_FIXTURES=1 python -m pytest backend/tests/test_perito_fixtures.py -q

La hora va fija (el reloj del servidor se sustituye) y los ids también: el fichero sale igual en cada vuelta.
Matrículas y nombres inventados; las fotos son las de la demo pública (frontend/public/demo).
"""
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest

import server
from base_de_mentira import Col, Db

RAIZ = Path(__file__).resolve().parents[2]
FIXTURES = RAIZ / "frontend" / "e2e" / "fixtures"
LIMPIA = "/demo/van-lateral.jpg"
GOLPE = "/demo/van-lateral-golpe-puerta.jpg"
MARTA = {"sub": "u-marta", "role": "admin", "name": "Marta R."}
GENERADO = "2026-11-14T09:00:00+00:00"


class Reloj(datetime):
    """El reloj del servidor, parado donde diga la prueba."""
    ahora = datetime(2026, 11, 14, 9, 0, tzinfo=timezone.utc)

    @classmethod
    def now(cls, tz=None):
        return Reloj.ahora.astimezone(tz) if tz else Reloj.ahora.replace(tzinfo=None)


class Ids:
    """`uuid.uuid4()` con ids fijos (con cara de uuid de verdad) para que el fichero no cambie en cada vuelta."""
    def __init__(self):
        self.n = 0

    def uuid4(self):
        self.n += 1
        return uuid.uuid5(uuid.NAMESPACE_URL, f"fds-antes-del-perito-{self.n}")

    def __getattr__(self, nombre):
        return getattr(uuid, nombre)


def a_las(iso):
    Reloj.ahora = datetime.fromisoformat(iso)


def revision(rid, vid, did, creada, fotos, analisis=None):
    """`fotos`: [(vista, url)]. Las de carrocería con rol «angle», el cuentakilómetros aparte."""
    return {"id": rid, "vehicle_id": vid, "driver_id": did, "created_at": creada,
            "photos": [u for _v, u in fotos], "photo_vistas": [v for v, _u in fotos],
            "photo_roles": ["odometer" if v == "odometro" else "angle" for v, _u in fotos],
            "analysis_status": "ok", "analysis_error": None,
            "analysis": analisis or {"severity": "sin_danos", "total_damages_count": 0, "damages": [],
                                     "new_damages": []},
            "notes": ""}


def cuatro(lateral_izq=LIMPIA, lateral_der=LIMPIA, sin=()):
    lados = [("frontal", LIMPIA), ("trasera", LIMPIA), ("lateral_izq", lateral_izq), ("lateral_der", lateral_der)]
    return [x for x in lados if x[0] not in sin] + [("odometro", LIMPIA)]


RETROVISOR = {"part": "Retrovisor derecho", "severity": "leve", "description": "Carcasa rayada",
              "photo_index": 4, "box_2d": [300, 640, 420, 780], "confidence": 0.71, "is_new": True,
              "confirmed": True}


def sembrar():
    t = Db()
    t["vehicles"] = Col([
        {"id": "veh-5678", "license_plate": "5678 KLM", "brand": "Ford", "model": "Transit Custom",
         "center": "OGA5", "status": "active", "renting_end_date": "2027-03-31", "mileage": 48210,
         "mileage_history": [{"date": "2026-11-10", "km": 47950}, {"date": "2026-11-11", "km": 48090},
                             {"date": "2026-11-12", "km": 48210}]},
        {"id": "veh-3456", "license_plate": "3456 HJK", "brand": "Citroën", "model": "Jumpy",
         "center": "OGA5", "status": "active", "mileage": 61200},
        {"id": "veh-9012", "license_plate": "9012 JMN", "brand": "Renault", "model": "Master",
         "center": "OGA5", "status": "active"},
    ])
    t["drivers"] = Col([
        {"id": "drv-ana", "name": "Ana L.", "email": "ana@ejemplo.test", "center": "OGA5"},
        {"id": "drv-luis", "name": "Luis P.", "email": "luis@ejemplo.test", "center": "OGA5"},
        {"id": "drv-rosa", "name": "Rosa M.", "email": "rosa@ejemplo.test", "center": "OGA5"},
    ])
    t["inspections"] = Col([
        revision("rev-5678-1110", "veh-5678", "drv-luis", "2026-11-10T07:01:00.000000+00:00",
                 cuatro(lateral_der=GOLPE)),
        revision("rev-5678-1111", "veh-5678", "drv-ana", "2026-11-11T07:03:12.000000+00:00", cuatro(),
                 {"severity": "leve", "total_damages_count": 1, "damages": [dict(RETROVISOR)],
                  "new_damages": [dict(RETROVISOR)]}),
        revision("rev-3456-1111", "veh-3456", "drv-luis", "2026-11-11T07:20:00.000000+00:00",
                 cuatro(sin=("lateral_der",))),
        revision("rev-5678-1112", "veh-5678", "drv-ana", "2026-11-12T06:58:31.402000+00:00", cuatro(GOLPE)),
        revision("rev-3456-1112", "veh-3456", "drv-luis", "2026-11-12T07:20:05.000000+00:00", cuatro()),
    ])
    t["daily_assignments"] = Col([{"date": "2026-11-12", "center": "OGA5", "slots": [
        {"vehicle_id": "veh-5678", "driver_id": "drv-ana"}, {"vehicle_id": "veh-3456", "driver_id": "drv-luis"},
        {"vehicle_id": "veh-9012", "driver_id": "drv-rosa"}]}])
    t["vehicle_damage_ledger"] = Col([])
    t["ai_feedback"] = Col([])
    return t


async def marcar(rid, pi, veredicto, cuando, **golpe):
    a_las(cuando)
    return await server.repaso_marcar_lado(rid, {"photo_index": pi, "veredicto": veredicto, **golpe}, user=MARTA)


async def recorrer(monkeypatch):
    """La semana de la 5678 y de la 3456 tal como la viviría la oficina, con las rutas de verdad."""
    t = sembrar()
    monkeypatch.setattr(server, "db", t)
    monkeypatch.setattr(server, "datetime", Reloj)
    monkeypatch.setattr(server, "uuid", Ids())

    async def nada(*a, **k):
        return None
    monkeypatch.setattr(server, "_ia_reentrenar_si_toca", nada)

    # 10-11: la primera revisión de la 5678. La puerta derecha ya venía con un bollo: primera foto de ese lado,
    # así que «ya estaba» y no se le atribuye a nadie.
    for pi, cuando in ((1, "2026-11-10T09:15:00+00:00"), (2, "2026-11-10T09:15:20+00:00"),
                       (3, "2026-11-10T09:15:41+00:00")):
        await marcar("rev-5678-1110", pi, "igual", cuando)
    await marcar("rev-5678-1110", 4, "golpe", "2026-11-10T09:16:30+00:00", part="Puerta lateral derecha",
                 severity="leve", box_2d=[410, 220, 640, 470], description="Bollo pequeño, sin pintura saltada")
    # 11-11: la arreglan en el taller propio (desde la ficha de la inspección, la ruta de siempre). Por eso el golpe
    # del 12 en la otra puerta entra en el libro como nuevo (el libro es uno por pieza abierta).
    a_las("2026-11-11T16:30:00+00:00")
    await server.update_damage("rev-5678-1110", 0, {"repair_status": "done", "actual_cost": 180}, _=MARTA)
    # 11-11: el repaso del día, y en «Revisión rápida» alguien confirma el retrovisor que marcó la IA.
    for pi, cuando in ((1, "2026-11-11T09:40:00+00:00"), (2, "2026-11-11T09:40:15+00:00"),
                       (3, "2026-11-11T09:40:31+00:00")):
        await marcar("rev-5678-1111", pi, "igual", cuando)
    a_las("2026-11-11T10:05:00+00:00")
    await server.damage_feedback("rev-5678-1111", {"verdict": "correct", "damage_index": 0, "scope": "new"},
                                 user=MARTA)
    # 12-11: golpe nuevo en la puerta corredera; la trasera no se ve; el lateral derecho, sin repasar todavía.
    await marcar("rev-5678-1112", 1, "igual", "2026-11-12T08:40:02+00:00")
    await marcar("rev-5678-1112", 3, "golpe", "2026-11-12T08:41:10+00:00", part="Puerta lateral corredera izquierda",
                 severity="moderado", box_2d=[410, 220, 640, 470], description="Bollo con pintura saltada")
    await marcar("rev-5678-1112", 2, "no_se_ve", "2026-11-12T08:41:40+00:00")

    a_las(GENERADO)
    dia = await server.repaso_del_dia(fecha="2026-11-12", center=None, user=MARTA)
    exp = await server.expediente_antes_del_perito("veh-5678", user=MARTA)
    exp["generado_at"] = GENERADO
    return dia, exp


def _claves(obj, esperadas, donde):
    assert set(obj) == set(esperadas), f"{donde}: sobran {set(obj) - set(esperadas)}, faltan {set(esperadas) - set(obj)}"


def _forma_del_contrato(dia, exp):
    """La forma exacta del contrato (CONTRATO.md §A y §C): si cambia, cambia el contrato con ella."""
    _claves(dia, ["fecha", "es_hoy", "zona", "center", "cuentas", "revisiones", "sin_revision"], "dia")
    _claves(dia["cuentas"], ["revisiones", "repasadas", "a_medias", "sin_repasar", "sin_lados", "con_golpe", "golpes",
                             "furgonetas_activas", "sin_revision"], "dia.cuentas")
    for r in dia["revisiones"]:
        _claves(r, ["id", "recibida_at", "hora", "vehiculo", "conductor", "estado", "lados", "ya_apuntado"], "revision")
        _claves(r["vehiculo"], ["id", "matricula", "modelo", "centro"], "vehiculo")
        for lado in r["lados"]:
            _claves(lado, ["photo_index", "vista", "foto_url", "anterior", "veredicto", "veredicto_por",
                           "veredicto_at", "golpe"], "lado")
            if lado["anterior"]:
                _claves(lado["anterior"], ["inspection_id", "photo_index", "foto_url", "recibida_at", "fecha",
                                           "hora", "conductor", "veredicto"], "anterior")
            if lado["golpe"]:
                _claves(lado["golpe"], ["golpe_id", "pieza", "panel", "gravedad", "descripcion", "box_2d",
                                        "ya_estaba", "libro"], "golpe")
        for a in r["ya_apuntado"]:
            _claves(a, ["ledger_id", "golpe_id", "pieza", "panel", "gravedad", "desde", "inspection_id", "vista",
                        "origen", "en_taller", "de_esta_revision"], "ya_apuntado")
    for s in dia["sin_revision"]:
        _claves(s, ["id", "matricula", "modelo", "centro", "asignada_a"], "sin_revision")

    _claves(exp, ["generado_at", "vehiculo", "periodo", "cuentas", "como_entro", "como_esta", "golpes",
                  "calendario"], "expediente")
    _claves(exp["vehiculo"], ["id", "matricula", "modelo", "centro", "fin_renting", "km", "km_fecha"], "vehiculo")
    _claves(exp["cuentas"], ["revisiones", "conductores", "golpes", "reparados", "abiertos", "en_taller",
                             "atribuibles", "ya_estaban", "dias_con_revision", "dias_sin_revision"], "cuentas")
    for f in exp["como_entro"]["fotos"] + exp["como_esta"]["fotos"]:
        _claves(f, ["vista", "photo_index", "foto_url", "inspection_id", "fecha", "recibida_at", "hora"], "foto")
    for g in exp["golpes"]:
        _claves(g, ["id", "origen", "pieza", "panel", "gravedad", "descripcion", "fecha", "recibida_at", "hora",
                    "inspection_id", "vista", "photo_index", "foto_url", "box_2d", "confirmado_por",
                    "confirmado_at", "ya_estaba", "anterior", "reparacion", "atribucion"], "golpe")
        _claves(g["reparacion"], ["estado", "orden_numero", "reparado_at", "coste"], "reparacion")
        _claves(g["atribucion"], ["atribuible", "motivo", "dias", "conductor", "conductores"], "atribucion")
    for c in exp["calendario"]:
        _claves(c, ["fecha", "estado", "revisiones"], "calendario")


@pytest.mark.asyncio(loop_scope="session")
async def test_los_ejemplos_de_las_pantallas_salen_de_las_rutas_de_verdad(monkeypatch):
    dia, exp = await recorrer(monkeypatch)
    _forma_del_contrato(dia, exp)

    # Lo que tiene que haber en los ejemplos (si no, no sirven para probar las pantallas).
    assert dia["fecha"] == "2026-11-12" and dia["es_hoy"] is False
    assert dia["cuentas"] == {"revisiones": 2, "repasadas": 0, "a_medias": 1, "sin_repasar": 1, "sin_lados": 0,
                              "con_golpe": 1, "golpes": 1, "furgonetas_activas": 3, "sin_revision": 1}
    r5678, r3456 = dia["revisiones"]
    assert [l["veredicto"] for l in r5678["lados"]] == ["igual", "no_se_ve", "golpe", None]
    assert r3456["lados"][3]["anterior"] is None                     # un lado sin foto anterior
    assert {a["origen"] for a in r5678["ya_apuntado"]} == {"repaso", "revision_rapida"}
    assert dia["sin_revision"][0]["asignada_a"] == {"id": "drv-rosa", "nombre": "Rosa M."}
    golpes = {g["pieza"]: g for g in exp["golpes"]}
    assert golpes["Puerta lateral derecha"]["ya_estaba"] is True
    assert golpes["Puerta lateral derecha"]["reparacion"]["estado"] == "reparado"
    assert golpes["Retrovisor derecho"]["atribucion"]["motivo"] == "anterior_sin_repasar"
    assert golpes["Puerta lateral corredera izquierda"]["atribucion"]["conductor"] == {"id": "drv-ana",
                                                                                      "nombre": "Ana L."}
    assert [c["estado"] for c in exp["calendario"]] == ["revisada", "golpe", "golpe"]
    todas = [l["foto_url"] for r in dia["revisiones"] for l in r["lados"]] + [g["foto_url"] for g in exp["golpes"]]
    assert set(todas) <= {LIMPIA, GOLPE}
    for foto in (LIMPIA, GOLPE):
        assert (RAIZ / "frontend" / "public" / foto.lstrip("/")).is_file(), foto

    actualizar = os.environ.get("ACTUALIZAR_FIXTURES") == "1"
    distintos = []
    for nombre, datos in (("repaso-dia.json", dia), ("expediente.json", exp)):
        texto = json.dumps(datos, ensure_ascii=False, indent=2) + "\n"
        ruta = FIXTURES / nombre
        guardado = ruta.read_text(encoding="utf-8") if ruta.is_file() else None
        if guardado == texto:
            continue
        if actualizar:
            FIXTURES.mkdir(parents=True, exist_ok=True)
            ruta.write_text(texto, encoding="utf-8", newline="\n")
        else:
            distintos.append(nombre)
    assert not distintos, (f"{', '.join(distintos)} no coincide con lo que devuelven las rutas. Si el cambio es "
                           "bueno, regenéralos con ACTUALIZAR_FIXTURES=1 y revisa las pruebas de pantalla.")
