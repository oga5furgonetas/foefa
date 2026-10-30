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
server._ensure_driver_recovery_indexes = _nada     # la base de mentira no tiene índices (vínculo del correo personal)
async def _enviado(*a, **k):
    return True

server._enviar_email = lambda *a, **k: _enviado()      # «enviado» sin mandar nada: el vínculo del correo personal lo exige

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

# LO QUE DICE LA DGT (30-10-2026), sin salir a internet: dos incidencias cerca de la ruta de prueba y la ZBE de A
# Coruña (el fichero real de nap.dgt.es si está descargado en el PC, %LOCALAPPDATA%\Temp\fds-emu\zbe_coruna.xml;
# si no, un polígono de prueba junto a la Marina).
INCIDENCIAS = [
    {"id": "p1", "clase": "obras", "que": "carril cortado (obras)", "gravedad": "baja", "carretera": "AC-12", "pk": "2.1",
     "municipio": "A Coruña", "provincia": "A Coruña", "lat": 43.3585, "lng": -8.4045, "lat2": 43.3570, "lng2": -8.4020,
     "desde": "2026-10-28T08:00:00+01:00"},
    {"id": "p2", "clase": "corte", "que": "calzada cortada (obras)", "gravedad": "alta", "carretera": "N-550", "pk": "12.1",
     "municipio": "Culleredo", "provincia": "A Coruña", "lat": 43.3520, "lng": -8.4080, "lat2": 43.3500, "lng2": -8.4100,
     "desde": "2026-10-29T07:00:00+01:00"},
]
ZBE_PRUEBA = """<?xml version="1.0" encoding="UTF-8"?>
<payload xmlns:com="http://levelC/schema/3/common" xmlns:loc="http://levelC/schema/3/locationReferencing"
 xmlns:conz="http://levelC/schema/3/controlledZone" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
 <conz:controlledZoneTable><conz:controlledZone id="15001_A Coruña - Marina (prueba)">
  <conz:name><com:values><com:value lang="ES">A Coruña - Marina</com:value></com:values></conz:name>
  <conz:controlledZoneDescription><com:values><com:value lang="ES">Carga y descarga de 6h a 11h.</com:value></com:values></conz:controlledZoneDescription>
  <conz:controlledZoneRecordVersionTime>2023-10-25T08:12:19.611Z</conz:controlledZoneRecordVersionTime><conz:status>active</conz:status>
  <loc:openlrPolygonCorners>
   <loc:openlrCoordinates><loc:latitude>43.3680</loc:latitude><loc:longitude>-8.3960</loc:longitude></loc:openlrCoordinates>
   <loc:openlrCoordinates><loc:latitude>43.3705</loc:latitude><loc:longitude>-8.3960</loc:longitude></loc:openlrCoordinates>
   <loc:openlrCoordinates><loc:latitude>43.3705</loc:latitude><loc:longitude>-8.3920</loc:longitude></loc:openlrCoordinates>
   <loc:openlrCoordinates><loc:latitude>43.3680</loc:latitude><loc:longitude>-8.3920</loc:longitude></loc:openlrCoordinates>
  </loc:openlrPolygonCorners>
 </conz:controlledZone></conz:controlledZoneTable></payload>"""


def _zbe_prueba() -> list:
    fichero = Path(os.environ.get("LOCALAPPDATA", "")) / "Temp" / "fds-emu" / "zbe_coruna.xml"
    if fichero.exists():
        try:
            zonas = server.reparto.zbe_datex(fichero.read_text(encoding="utf-8"), ciudad="ACoruña")
            if zonas:
                return zonas
        except Exception:                                    # noqa: BLE001
            pass
    return server.reparto.zbe_datex(ZBE_PRUEBA, ciudad="ACoruña")


def _dentro_de_la_zbe() -> tuple:
    """Un punto dentro de la primera ZBE (para una parada de prueba que caiga dentro): el centro del polígono si
    cae dentro; si no, cerca de una esquina."""
    z = _zbe_prueba()[0]
    pol = z["poligonos"][0]
    centro = (sum(p[0] for p in pol) / len(pol), sum(p[1] for p in pol) / len(pol))
    if server.reparto.punto_en_poligono(centro[0], centro[1], pol):
        return centro
    a, b, c = pol[0], pol[1], pol[2]
    return ((a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3)


async def dgt_incidencias():
    return INCIDENCIAS, "2026-10-30T08:00:00+01:00", True


async def dgt_zbe():
    return _zbe_prueba(), True

server._dgt_incidencias = dgt_incidencias
server._dgt_zbe = dgt_zbe


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
    # La quinta parada cae dentro de la ZBE (30-10-2026): se ve el chip «ZBE» y el polígono en el mapa.
    marina = _dentro_de_la_zbe()
    PUNTOS["avenida da mariña 8"] = marina
    paradas = [
        ("Farmacia Sol", "Rúa Sinfónica de Galicia 8, 15004 A Coruña", "", 0, 1),
        ("Lucía M.", "Rúa Emilia Pardo Bazán 14, 15005 A Coruña", "600000002", 24.5, 1),
        ("Bar Pepe", "Rúa Marcial del Adalid 5, 15005 A Coruña", "600000001", 0, 2),
        ("Kiosko Luz", "Rúa San Andrés 30, 15003 A Coruña", "", 0, 1),
        ("Café Marina", "Avenida da Mariña 8, 15001 A Coruña", "600000005", 0, 1),
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
    # Lo que pide la calle (30-10-2026), para verlo en la app: Lucía contestó en su enlace; en Kiosko Luz ya se entregó
    # otra vez y el pin es la puerta aprendida; y la tarifa puesta, para «Hoy llevas» y las fallidas sin cobrar.
    docs[1]["cliente_dice"] = {"estare": "no", "dejar": "porteria", "franja": None, "portal": "1234", "nota": "2º izq, el timbre no va",
                               "cuando": datetime.now(timezone.utc).isoformat()}
    docs[3]["geo"] = "puerta"
    t["reparto_pedidos"] = Col(docs)
    t["reparto_ajustes"] = Col([{"id": "ajustes", "min_parada": 4, "min_bulto": 1, "hora_salida": "09:00", "volver": False, "trafico": True,
                                 "pago_parada": 110, "pago_dia": 0, "coste_km": 12}])
    print(f"Cuenta de prueba: {PRUEBA_CORREO} / {PRUEBA_CLAVE} · {len(docs)} paradas para {hoy}")
    await sembrar_empresa(hoy)


# ── UNA EMPRESA CON UN CONDUCTOR (29-10-2026): para probar el portal NATIVO del conductor de empresa ────────────
# La misma app, entrando con el correo y la contraseña de un conductor de empresa (`/auth/app-login` → destino
# «conductor»): ruta del día, auditoría de la furgoneta (le toca hoy según el cuadrante), turnos del mes (trabaja
# entre semana, libra el finde y mañana), una vacante para mañana (hay máxima y falta gente) y un refuerzo abierto
# por la oficina dentro de tres días, «Invita y gana», contraseña, correo personal y teléfono.
CONDUCTOR_CORREO = "conductor@fds.test"
CONDUCTOR_CLAVE = "turno-de-prueba-1"
OFICINA_CORREO = "oficina@fds.test"
OFICINA_CLAVE = "oficina-de-prueba-1"


async def sembrar_empresa(hoy):
    from datetime import date as date_cls
    g = bases["flota_global"]
    org_id, driver_id, veh_id = "o-empresa", "d-conductor", "v-furgo-1"
    ahora = datetime.now(timezone.utc).isoformat()
    g["organizations"].docs.append({
        "id": org_id, "name": "Empresa de prueba", "slug": "empresa", "plan": "flota", "sector": "reparto",
        "db_name": "dsp_empresa", "account_type": "dsp", "status": "active", "pais": "es", "zona_horaria": "Europe/Madrid",
        "centers": ["OGA5"], "modulos": [], "created_at": ahora,
    })
    # La oficina de esa empresa (29-10-2026): para aprobar peticiones y abrir refuerzos y ver el aviso llegar a la app.
    g["admin_users"].docs.append({
        "id": "u-oficina", "username": OFICINA_CORREO, "email": OFICINA_CORREO, "name": "Oficina de prueba", "role": "admin",
        "org_id": org_id, "hashed_password": server.hash_password(OFICINA_CLAVE), "created_at": ahora,
    })
    t = bases["dsp_empresa"]
    t["drivers"] = Col([{"id": driver_id, "name": "Conductora de Prueba", "center": "OGA5", "email": CONDUCTOR_CORREO,
                         "phone": "600000099", "active": True, "status": "active", "created_at": ahora}])
    t["driver_accounts"] = Col([{"id": "da-1", "driver_id": driver_id, "email": CONDUCTOR_CORREO,
                                 "hashed_password": server.hash_password(CONDUCTOR_CLAVE), "active": True, "created_at": ahora}])
    t["vehicles"] = Col([{"id": veh_id, "license_plate": "1234 KLM", "brand": "Mercedes", "model": "Vito", "status": "active",
                          "center": "OGA5", "mileage": 48210, "mileage_history": [], "created_at": ahora, "updated_at": ahora}])
    t["daily_assignments"] = Col([{"id": "da-hoy", "date": hoy, "center": "OGA5",
                                   "slots": [{"driver_id": driver_id, "driver_name": "Conductora de Prueba", "vehicle_id": veh_id, "route": "CA_A1"}]}])
    d0 = date_cls.fromisoformat(hoy)
    manana = (d0 + timedelta(days=1)).isoformat()
    turnos = []
    for i in range(-10, 35):
        d = d0 + timedelta(days=i)
        f = d.isoformat()
        libre = d.weekday() >= 5 or f == manana
        turnos.append({"id": f"s-{f}", "driver_id": driver_id, "driver_name": "Conductora de Prueba", "center": "OGA5", "date": f,
                       "type": "libre" if libre else "trabaja", "cod": "L" if libre else "1"})
    t["shifts"] = Col(turnos)
    t["shift_requests"] = Col([])
    # Mañana hay máxima de 5 y nadie más en ruta: falta gente → vacante que puede solicitar (libra ese día).
    t["route_demand"] = Col([{"center": "OGA5", "date": manana, "maximo": 5}])
    t["refuerzos"] = Col([{"id": "r-oficina", "center": "OGA5", "date": (d0 + timedelta(days=3)).isoformat(), "plazas": 2,
                           "nota": "Pico de volumen: hacen falta dos más", "estado": "abierto", "avisados": 0, "auto": False,
                           "creado_por": "Oficina", "creado_en": ahora}])
    print(f"Conductor de empresa: {CONDUCTOR_CORREO} / {CONDUCTOR_CLAVE} · furgoneta 1234 KLM asignada hoy, libra {manana}")
    print(f"Oficina de esa empresa: {OFICINA_CORREO} / {OFICINA_CLAVE}")


if __name__ == "__main__":
    import uvicorn
    asyncio.run(sembrar())
    uvicorn.run(server.app, host="0.0.0.0", port=8787, lifespan="off", log_level="warning")
