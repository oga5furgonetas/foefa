# -*- coding: utf-8 -*-
"""El arranque del dueño y el enlace del conductor (14-11-2026): las respuestas de ejemplo que usan las pruebas de
pantalla, sacadas de las rutas DE VERDAD con una empresa inventada en la base de mentira:

  frontend/e2e/fixtures/alta-furgonetas.json     <- POST /api/alta/furgonetas (vista previa)
  frontend/e2e/fixtures/alta-conductores.json    <- POST /api/alta/conductores (vista previa)
  frontend/e2e/fixtures/alta-acceso-creado.json  <- POST /api/conductores/{id}/acceso
  frontend/e2e/fixtures/alta-enlace.json         <- POST /api/auth/enlace
  frontend/e2e/fixtures/alta-accesos.json        <- GET  /api/conductores/accesos
  frontend/e2e/fixtures/alta-estado.json         <- GET  /api/alta/estado (con la primera revisión ya llegada)

Si el servidor cambia la forma de una respuesta, esta prueba falla hasta que se regeneran, y entonces fallan las de
pantalla que no la sigan: la pantalla y el servidor no pueden separarse en silencio. El token del enlace y la sesión
van sustituidos por valores fijos de ejemplo (no son de nadie); el reloj y los ids, fijos: el fichero sale igual en
cada vuelta. Datos inventados (matrículas tipo 5678 KLM, nombres con inicial); las fotos, las de la demo pública.

Regenerar:  ACTUALIZAR_FIXTURES=1 python -m pytest backend/tests/test_alta_fixtures.py -q
"""
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi.testclient import TestClient

import server
from base_de_mentira import Col
from test_alta_enlace import TEL_ANA, _h, _sesion_admin, montar_mundo

RAIZ = Path(__file__).resolve().parents[2]
FIXTURES = RAIZ / "frontend" / "e2e" / "fixtures"
TOKEN_EJEMPLO = "9f2c4e6a8b0d1f3e5a7c9e1b3d5f7a9c2e4b6d8f0a1c3e5b7d9f1a3c5e7b9d0f"
SESION_EJEMPLO = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ejemplo-de-sesion-de-conductor.firma"
LATERAL, FRONTAL = "/demo/van-lateral.jpg", "/demo/van-frontal.jpg"


class Reloj(datetime):
    """El reloj del servidor, parado el 14-11-2026 a las 09:00 UTC (10:00 en Madrid)."""
    ahora = datetime(2026, 11, 14, 9, 0, tzinfo=timezone.utc)

    @classmethod
    def now(cls, tz=None):
        return Reloj.ahora.astimezone(tz) if tz else Reloj.ahora.replace(tzinfo=None)


class Ids:
    """`uuid.uuid4()` con ids fijos (con cara de uuid de verdad)."""
    def __init__(self):
        self.n = 0

    def uuid4(self):
        self.n += 1
        return uuid.uuid5(uuid.NAMESPACE_URL, f"fds-alta-{self.n}")

    def __getattr__(self, nombre):
        return getattr(uuid, nombre)


def test_las_respuestas_de_ejemplo_salen_de_las_rutas_de_verdad(monkeypatch):
    m = montar_mundo(monkeypatch)
    monkeypatch.setattr(server, "datetime", Reloj)
    monkeypatch.setattr(server, "uuid", Ids())
    m.a["drivers"] = Col([
        {"id": "0f8e2c1a-6b7d-4c3e-9a1f-2d4b6c8e0a12", "name": "Ana L.", "center": "PRINCIPAL", "active": True,
         "movil_personal": "+34612345678"},
        {"id": "7c1d5e9b-3a2f-4d6c-8b1e-5f0a9c2d4e61", "name": "Luis P.", "center": "PRINCIPAL", "active": True,
         "email": "luis@ejemplo.es"},
        {"id": "2a9b4c6d-8e1f-4a3b-9c5d-7e0f1a2b3c4d", "name": "Rosa M.", "center": "PRINCIPAL", "active": True,
         "phone": "+34655443322"},
    ])
    ana, luis = m.a["drivers"].docs[0]["id"], m.a["drivers"].docs[1]["id"]
    m.a["vehicles"] = Col([{"id": "6d1f0b7e-2c4a-4e8b-9f3d-1a5c7e9b0d2f", "license_plate": "5678 KLM",
                            "model": "Proace", "status": "active", "center": "PRINCIPAL"}])
    http = TestClient(server.app)
    admin = _h(_sesion_admin())

    furgonetas = http.post("/api/alta/furgonetas", headers=admin,
                           json={"texto": "1234 ABC\n5678-klm\n1234abc\nfurgo de Juan", "center": None,
                                 "guardar": False}).json()
    conductores = http.post("/api/alta/conductores", headers=admin,
                            json={"texto": "Marta S., 677 123 456\nLuis P.\t698765432\tluis@ejemplo.es\nPablo R.",
                                  "center": None, "guardar": False}).json()
    creado = http.post(f"/api/conductores/{ana}/acceso", headers=admin, json={})
    assert creado.status_code == 200, creado.text
    creado = creado.json()
    assert http.post(f"/api/conductores/{luis}/acceso", headers=admin, json={}).status_code == 200
    Reloj.ahora = datetime(2026, 11, 14, 9, 20, tzinfo=timezone.utc)
    enlace = http.post("/api/auth/enlace", json={"token": creado["token"], "dispositivo": TEL_ANA})
    assert enlace.status_code == 200, enlace.text
    enlace = enlace.json()
    accesos = http.get("/api/conductores/accesos", headers=admin).json()
    # Ana abre el enlace y hace su revisión: llega a las 09:31 de Madrid.
    m.a["inspections"] = Col([{
        "id": "c3d4e5f6-0a1b-4c2d-8e3f-4a5b6c7d8e9f", "vehicle_id": "6d1f0b7e-2c4a-4e8b-9f3d-1a5c7e9b0d2f",
        "driver_id": ana, "created_at": "2026-11-14T08:31:07.512000+00:00",
        "photos": [FRONTAL, LATERAL, LATERAL, LATERAL, LATERAL, LATERAL, LATERAL],
        "photo_roles": ["angle", "angle", "angle", "angle", "odometer", "checklist", "checklist"],
        "photo_vistas": ["frontal", "trasera", "lateral_izq", "lateral_der", "cuentakilometros", "combustible",
                         "rueda_repuesto"],
        "analysis_status": "sin_ia", "notes": json.dumps({"odometer_km": 48210}),
        "combustible": {"pct": 75}}])
    estado = http.get("/api/alta/estado", headers=admin).json()

    # Lo que tiene que decir cada una (las demás pruebas lo miran con más detalle).
    assert [f["estado"] for f in furgonetas["lineas"]] == ["nueva", "ya_estaba", "error", "error"]
    assert [f["estado"] for f in conductores["lineas"]] == ["nuevo", "ya_estaba", "nuevo"]
    assert creado["acceso"]["estado"] == "sin_abrir" and creado["whatsapp"] == "34612345678"
    assert enlace["configurar_cuenta"] is False and enlace["slug"] == "transportes-perez"
    assert [c["acceso"]["estado"] for c in accesos["conductores"]] == ["abierto", "sin_abrir", "sin_enlace"]
    assert estado["paso_actual"] is None and estado["revision"]["hora"] == "09:31"
    assert len(estado["revision"]["fotos"]) == 4

    # Los secretos, por valores de ejemplo fijos.
    assert creado["ruta"] == "/c#" + creado["token"]
    creado.update(token=TOKEN_EJEMPLO, ruta="/c#" + TOKEN_EJEMPLO)
    enlace["access_token"] = SESION_EJEMPLO

    actualizar = os.environ.get("ACTUALIZAR_FIXTURES") == "1"
    distintos = []
    for nombre, datos in (("alta-furgonetas.json", furgonetas), ("alta-conductores.json", conductores),
                          ("alta-acceso-creado.json", creado), ("alta-enlace.json", enlace),
                          ("alta-accesos.json", accesos), ("alta-estado.json", estado)):
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
