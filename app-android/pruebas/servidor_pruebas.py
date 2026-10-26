"""EL SERVIDOR DE VERDAD PARA PROBAR LA APP DE ANDROID, EN EL PC Y SIN TOCAR PRODUCCIÓN (25-10-2026).

Arranca el backend real (backend/server.py: los mismos endpoints que usa la app en producción) con la base de
datos de mentira de las pruebas (backend/tests/base_de_mentira.py), en memoria. Crea una cuenta de repartidor
autónomo y una ruta de hoy en A Coruña. El emulador de Android llega al PC por 10.0.2.2:

    py -3 app-android/pruebas/servidor_pruebas.py
    cd app-android && ./gradlew installDebug -PapiUrl=http://10.0.2.2:8787/api/

Cuenta de prueba: la de PRUEBA_CORREO / PRUEBA_CLAVE de abajo (solo existe en este servidor, en memoria).
No manda correos ni avisos (sin claves de correo) y no arranca las tareas de fondo (lifespan="off")."""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
os.environ.update({
    "SECRET_KEY": "solo-para-probar-la-app-en-el-pc", "MONGO_URL": "mongodb://127.0.0.1:1", "DB_NAME": "flota",
    "GLOBAL_DB_NAME": "flota_global", "ADMIN_USERNAME": "", "ADMIN_PASSWORD": "", "VIGILANTE_BD": "0",
    "CORREO_CONTACTO": "", "RESEND_API_KEY": "", "BREVO_API_KEY": "",
})
sys.path[:0] = [str(RAIZ / "backend"), str(RAIZ / "backend" / "tests")]

import server  # noqa: E402
from base_de_mentira import Col, Db  # noqa: E402

PRUEBA_CORREO = "prueba@fds.test"
PRUEBA_CLAVE = "ruta-de-prueba-1"


class Bases(dict):
    def __missing__(self, nombre):
        self[nombre] = Db()
        return self[nombre]


bases = Bases()
server.client = bases
server.global_db = bases["flota_global"]


async def _nada(*a, **k):
    return None

server._ensure_tenant_indexes = _nada
server._enviar_email = lambda *a, **k: _nada()

# Las direcciones de la ruta de prueba, con su punto (el buscador de verdad no hace falta para probar la app).
PUNTOS = {
    "sinfónica de galicia 8": (43.363889, -8.409899), "emilia pardo bazán 14": (43.363999, -8.407109),
    "marcial del adalid 5": (43.36219, -8.407002), "san andrés 30": (43.3713, -8.4007), "real 5": (43.3712, -8.3990),
    "montero ríos 12": (43.3690, -8.4050), "mayor 12": (43.3700, -8.3980), "del villar 12": (42.8805, -8.5450),
}


async def ubicar(direccion, cp="", localidad="", base=None):
    d = (direccion or "").lower()
    for k, v in PUNTOS.items():
        if k in d:
            return v
    return None

server._rep_ubicar = ubicar


async def matriz(puntos):
    seg, met = server.reparto.matriz_en_linea_recta(puntos)
    return seg, met, "linea_recta"

server._rep_matriz = matriz


async def sembrar():
    g = bases["flota_global"]
    org_id, user_id = "o-prueba", "u-prueba"
    g["organizations"] = Col([{
        "id": org_id, "name": "Repartidor de prueba", "slug": "prueba", "plan": "autonomo", "sector": "autonomo",
        "db_name": "dsp_prueba", "account_type": "dsp", "status": "trial", "pais": "es", "zona_horaria": "Europe/Madrid",
        "trial_ends": (datetime.now(timezone.utc) + timedelta(days=20)).isoformat(), "modulos": ["reparto", "configuracion"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }])
    g["admin_users"] = Col([{
        "id": user_id, "username": PRUEBA_CORREO, "email": PRUEBA_CORREO, "name": "Repartidor de prueba", "role": "admin",
        "org_id": org_id, "hashed_password": server.hash_password(PRUEBA_CLAVE), "created_at": datetime.now(timezone.utc).isoformat(),
    }])
    t = bases["dsp_prueba"]
    t["drivers"] = Col([{"id": user_id, "name": "Repartidor de prueba", "active": True, "autonomo": True}])
    hoy = server._dia_negocio()
    paradas = [
        ("Farmacia Sol", "Rúa Sinfónica de Galicia 8, 15004 A Coruña", "", 0, 1),
        ("Lucía M.", "Rúa Emilia Pardo Bazán 14, 15005 A Coruña", "600000002", 24.5, 1),
        ("Bar Pepe", "Rúa Marcial del Adalid 5, 15005 A Coruña", "600000001", 0, 2),
        ("Kiosko Luz", "Rúa San Andrés 30, 15003 A Coruña", "", 0, 1),
    ]
    docs = []
    for i, (cli, dirc, tel, cobrar, bultos) in enumerate(paradas):
        lat, lng = await ubicar(dirc)
        docs.append({
            "id": str(uuid.uuid4()), "fecha": hoy, "codigo": f"ZX8{1000 + i}", "codigos": [], "cliente": cli, "telefono": tel,
            "direccion": dirc, "cp": "", "localidad": "A Coruña", "contenido": "", "notas": "", "bultos": bultos, "escaneos": 1,
            "ventana_desde": None, "ventana_hasta": None, "tipo": "entrega", "cobrar": cobrar, "hueco": "", "prioridad": False,
            "zona": "", "conductor_id": user_id, "conductor_nombre": "Repartidor de prueba", "estado": "pendiente", "orden": None,
            "origen": "escaneo", "lat": lat, "lng": lng, "geo": "ok", "creado_por": "prueba",
            "creado_en": datetime.now(timezone.utc).isoformat(),
        })
    t["reparto_pedidos"] = Col(docs)
    print(f"Cuenta de prueba: {PRUEBA_CORREO} / {PRUEBA_CLAVE} · {len(docs)} paradas para {hoy}")


if __name__ == "__main__":
    import uvicorn
    asyncio.run(sembrar())
    uvicorn.run(server.app, host="0.0.0.0", port=8787, lifespan="off", log_level="warning")
