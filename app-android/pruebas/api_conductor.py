"""LO QUE LA APP NATIVA LE PIDE AL SERVIDOR, PEDIDO DESDE EL PC (29-10-2026).

Las mismas llamadas, con los mismos cuerpos y los mismos campos que lee `app-android` (data/Repositorio.kt y las
pantallas de ui/acceso/*), contra el servidor de pruebas (`servidor_pruebas.py`, el server.py real con una base en
memoria). Sirve para comprobar el contrato app <-> API sin emulador: si un campo cambia de nombre en el servidor,
aquí se ve antes que en el móvil.

    py -3 app-android/pruebas/servidor_pruebas.py          # en otra ventana
    py -3 app-android/pruebas/api_conductor.py [http://127.0.0.1:8787/api]
"""
import json
import sys
from datetime import date, timedelta

import httpx

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8787/api").rstrip("/")
CONDUCTOR = ("conductor@fds.test", "turno-de-prueba-1")
AUTONOMO = ("prueba@fds.test", "ruta-de-prueba-1")
CLAVE_NUEVA = "nueva-clave-1"
fallos = []


def ok(cond, que):
    print(("  OK  " if cond else "  MAL ") + que)
    if not cond:
        fallos.append(que)


def jpeg():
    import cv2
    import numpy as np
    # Del tamaño que manda la app (reduce a 1280 px de lado): el servidor rechaza fotos de menos de 200x200.
    img = np.full((480, 640, 3), 120, np.uint8)
    cv2.putText(img, "FDS", (60, 280), cv2.FONT_HERSHEY_SIMPLEX, 5, (255, 255, 255), 8)
    return cv2.imencode(".jpg", img)[1].tobytes()


def main():
    # Sin conexiones reutilizadas: si el servidor cierra una tras un error, la siguiente llamada no hereda el corte.
    c = httpx.Client(base_url=BASE, timeout=30, headers={"X-FDS-App": "android-prueba-pc", "Accept": "application/json"},
                     limits=httpx.Limits(max_keepalive_connections=0))
    hoy = date.today()
    manana = (hoy + timedelta(days=1)).isoformat()

    print("Acceso unificado (auth/app-login) con un conductor de empresa")
    # La batería cambia la contraseña por el camino y la deja como estaba al final; si una pasada anterior se quedó a
    # medias (el servidor sigue en marcha), se entra con la nueva y se restaura igual.
    clave = CONDUCTOR[1]
    r = c.post("/auth/app-login", json={"identifier": CONDUCTOR[0], "password": clave})
    if r.status_code == 401:
        clave = CLAVE_NUEVA
        r = c.post("/auth/app-login", json={"identifier": CONDUCTOR[0], "password": clave})
    ok(r.status_code == 200, f"200 al entrar ({r.status_code})")
    s = r.json()
    ok(s.get("app_destino") == "conductor", "app_destino = conductor")
    ok(s.get("role") == "driver" and s.get("access_token"), "role driver y access_token")
    ok(s.get("center") == "OGA5", f"center = {s.get('center')}")
    ok(s.get("configurar_cuenta") is False, "configurar_cuenta = false (ya tiene contraseña)")
    c.headers["Authorization"] = f"Bearer {s['access_token']}"
    driver_id = s["id"]

    print("Contraseña mal: 401 con detail (la app lo enseña como error)")
    r = c.post("/auth/app-login", json={"identifier": CONDUCTOR[0], "password": "mal"})
    ok(r.status_code == 401 and "detail" in r.json(), f"401 con detail ({r.status_code})")

    print("Mis turnos (shifts/mine + shift-blocks/mios), como TurnosConductorNativo")
    # Como la pantalla: un mes. Aquí, de 10 días atrás a 35 adelante, para tener días que pedir aunque sea fin de mes.
    desde = (hoy - timedelta(days=10)).isoformat()
    hasta = (hoy + timedelta(days=35)).isoformat()
    r = c.get("/shifts/mine", params={"desde": desde, "hasta": hasta})
    ok(r.status_code == 200, "200")
    d = r.json()
    ok(isinstance(d.get("shifts"), list) and d["shifts"], f"shifts: {len(d.get('shifts', []))}")
    t = {x["date"]: x for x in d["shifts"]}
    ok(all(k in t[hoy.isoformat()] for k in ("date", "type", "cod")), "cada turno trae date, type y cod")
    ok(t[manana]["type"] == "libre" and t[manana]["cod"] == "L", "mañana libra (type libre, cod L)")
    ok(isinstance(d.get("requests"), list), "requests es una lista")
    ok(d.get("suspension") is None, "suspension null")
    r = c.get("/shift-blocks/mios")
    ok(r.status_code == 200 and isinstance(r.json().get("bloqueos"), list), "shift-blocks/mios -> bloqueos[]")

    print("Pedir un día libre (shift-requests con date/type/motivo/note) y marcar la respuesta como vista")
    # Un día de trabajo que no esté ya pedido (si el servidor viene de una pasada anterior, lo está).
    pedidos_ya = {q.get("date") for q in d["requests"] if q.get("status") in ("pendiente", "aprobado")}
    pedido = next(f for f in (hoy + timedelta(days=i) for i in range(2, 40))
                  if t.get(f.isoformat(), {}).get("type") == "trabaja" and f.isoformat() not in pedidos_ya).isoformat()
    r = c.post("/shift-requests", json={"date": pedido, "type": "libre", "motivo": "medico", "note": "Cita médica a las 10"})
    ok(r.status_code == 200, f"200 al pedir el {pedido} ({r.status_code}: {r.text[:120]})")
    d = c.get("/shifts/mine", params={"desde": desde, "hasta": hasta}).json()
    pet = next((q for q in d["requests"] if q.get("date") == pedido), None)
    ok(pet is not None and pet.get("status") == "pendiente" and pet.get("id"), "la petición sale con status pendiente e id")
    r = c.post("/shift-requests", json={"date": pedido, "type": "libre", "motivo": "medico", "note": "otra vez"})
    ok(r.status_code in (400, 409), f"repetir el mismo día no cuela ({r.status_code})")
    r = c.post("/shift-requests/vistas", json={"ids": [pet["id"] if pet else "x"]})
    ok(r.status_code == 200, "shift-requests/vistas 200")
    otro = next(f for f in (hoy + timedelta(days=i) for i in range(2, 40))
                if t.get(f.isoformat(), {}).get("type") == "trabaja" and f.isoformat() not in pedidos_ya | {pedido}).isoformat()
    r = c.post("/shift-requests", json={"date": otro, "type": "libre", "motivo": "medico", "note": ""})
    ok(r.status_code == 400, f"sin explicación -> 400 ({r.status_code})")

    print("Trabajar más (trabajar-mas, solicitar, desapuntarme, mias/cancelar), como ExtrasConductorNativos")
    r = c.get("/trabajar-mas")
    ok(r.status_code == 200, "200")
    d = r.json()
    ok(all(k in d for k in ("vacantes", "extras", "plazas", "dias")), "trae vacantes, extras, plazas, dias")
    v = next((x for x in d["vacantes"] if x.get("date") == manana), None)
    ok(v is not None, f"mañana ({manana}) sale como vacante: {d.get('vacantes')}")
    if v:
        ok(all(k in v for k in ("date", "dia", "quedan", "nota", "refuerzo_id", "mi_estado")),
           "la vacante trae date, dia, quedan, nota, refuerzo_id, mi_estado")
        ok(v["mi_estado"] is None, "mi_estado null antes de pedir")
    r = c.post(f"/trabajar-mas/{manana}/solicitar", json={"nota": "Puedo mañana"})
    ok(r.status_code == 200, f"solicitar 200 ({r.status_code}: {r.text[:120]})")
    d = c.get("/trabajar-mas").json()
    v = next((x for x in d["vacantes"] if x.get("date") == manana), None)
    ok(v is not None and v.get("mi_estado") == "pendiente" and v.get("refuerzo_id"), "tras pedir: mi_estado pendiente y refuerzo_id")
    if v and v.get("refuerzo_id"):
        r = c.post(f"/refuerzos/{v['refuerzo_id']}/desapuntarme")
        ok(r.status_code == 200, f"desapuntarme 200 ({r.status_code})")
        d = c.get("/trabajar-mas").json()
        v = next((x for x in d["vacantes"] if x.get("date") == manana), None)
        ok(v is not None and not v.get("mi_estado"), "tras retirar: vuelve a estar libre")
    r = c.post("/shift-requests/mias/cancelar", json={"ids": ["no-existe"]})
    ok(r.status_code == 200 and "no" in r.json(), "mias/cancelar devuelve la lista no[] con lo que no se pudo")

    print("Auditoría (vehicles/portal, me/assigned-vehicle, validate-photo, odometer-photo, upload), como AuditoriaConductorNativa")
    r = c.get("/vehicles/portal")
    d = r.json()
    ok(r.status_code == 200 and d.get("puede_auditar") is True, "puede_auditar true (le toca hoy)")
    ok(bool(d.get("vehicles")) and d["vehicles"][0].get("license_plate") == "1234 KLM", "su furgoneta: 1234 KLM")
    veh = d["vehicles"][0]["id"]
    r = c.get("/auth/me/assigned-vehicle")
    a = r.json()
    ok(a.get("assigned") is True and (a.get("vehicle") or {}).get("id") == veh, "assigned-vehicle: la misma")
    ya_hecha = a.get("already_inspected") is True       # de una pasada anterior contra el mismo servidor
    ok(a.get("already_inspected") in (True, False), f"already_inspected: {a.get('already_inspected')}")
    foto = jpeg()
    r = c.post("/inspections/validate-photo", data={"vehicle_id": veh, "expected_zone": "frontal"},
               files={"file": ("check.jpg", foto, "image/jpeg")})
    ok(r.status_code == 200 and "valid" in r.json(), f"validate-photo contesta valid ({r.json()})")
    r = c.post(f"/vehicles/{veh}/odometer-photo", files={"file": ("odometro.jpg", foto, "image/jpeg")})
    d = r.json()
    ok(r.status_code == 200 and "aceptada" in d, "odometer-photo contesta aceptada")
    ok(all(k in d for k in ("manual_min", "manual_max", "current_mileage", "dias")),
       f"y el rango a mano: {d.get('manual_min')}-{d.get('manual_max')}")
    km = int(d.get("manual_min") or 48210) + 10
    notas = json.dumps({"checklist": {"neumaticos": "ok", "luces": "malo"}, "notes": "prueba desde el PC",
                        "driver_name": s["name"], "center": s["center"], "odometer_km": km, "odometer_manual": True,
                        "combustible_pct": 50, "checklist_photo_items": ["Luces"], "rueda_repuesto": "si",
                        "rueda_repuesto_foto": False})
    nombres = ("angle_0_frontal.jpg", "angle_1_trasera.jpg", "angle_2_lateral_izq.jpg", "angle_3_lateral_der.jpg",
               "odometro.jpg", "combustible.jpg", "checklist_luces.jpg")
    files = [("files", (n, foto, "image/jpeg")) for n in nombres]
    r = c.post("/inspections/upload", data={"vehicle_id": veh, "driver_id": driver_id, "notes": notas}, files=files)
    if ya_hecha:
        ok(r.status_code == 409, f"ya enviada hoy en una pasada anterior: upload -> 409 ({r.status_code})")
    else:
        ok(r.status_code == 200, f"upload 200 ({r.status_code}: {r.text[:160]})")
    a = c.get("/auth/me/assigned-vehicle").json()
    ok(a.get("already_inspected") is True, "después: already_inspected true")
    r = c.post("/inspections/upload", data={"vehicle_id": veh, "driver_id": driver_id, "notes": notas}, files=files)
    ok(r.status_code == 409, f"repetirla hoy -> 409 ({r.status_code})")

    print("Invita y gana (conductor/referidos), como ReferidosConductorNativo")
    r = c.get("/conductor/referidos")
    d = r.json()
    ok(r.status_code == 200, "200")
    claves = ("enlace", "saldo", "metodos", "retirada_min", "pendiente", "retiradas", "invitados", "premiados", "por_invitado")
    ok(all(k in d for k in claves), f"trae enlace, saldo, metodos ({d.get('metodos')}), retirada_min, pendiente, retiradas...")
    r = c.post("/conductor/referidos/retirar", json={"titular": "Conductora de Prueba", "metodo": "bizum", "destino": "600000099"})
    ok(r.status_code in (400, 409), f"retirar sin saldo no cuela ({r.status_code}: {str(r.json().get('detail', ''))[:80]})")

    print("Mi cuenta (portal/mi-ficha, mi-telefono, mi-correo-personal, change-my-password)")
    r = c.get("/portal/mi-ficha")
    ok(r.status_code == 200, f"mi-ficha 200 ({r.status_code})")
    r = c.post("/portal/mi-telefono", json={"telefono": "+34 600 11 22 33"})
    ok(r.status_code == 200, f"mi-telefono 200 ({r.status_code}: {r.text[:100]})")
    r = c.get("/portal/mi-correo-personal")
    d = r.json()
    ok(r.status_code == 200 and "vinculado" in d, f"mi-correo-personal GET: {d}")
    r = c.post("/portal/mi-correo-personal", json={"email": "personal@ejemplo.test"})
    d = r.json()
    # El POST contesta {ok, pendiente, email enmascarado} (sin `vinculado`): la app lo lee como «pendiente de confirmar».
    # Tiene tope de 3 por hora (lo mismo que verá la app: un 429 con su detail): varias pasadas seguidas lo gastan.
    if r.status_code == 429:
        ok(bool(d.get("detail")), f"POST con tope de peticiones (429, de pasadas anteriores): {d.get('detail')}")
    else:
        ok(r.status_code == 200 and d.get("ok") is True and d.get("pendiente") is True and d.get("email") and d.get("vinculado") is not True,
           f"POST deja la verificación pendiente: {d}")
    otra = CLAVE_NUEVA if clave == CONDUCTOR[1] else CONDUCTOR[1]
    r = c.post("/auth/change-my-password", json={"current_password": "mal", "new_password": otra})
    # 400 y no 401 (29-10-2026): la app cierra la sesión ante cualquier 401 con token, y teclear mal la
    # contraseña actual echaba al conductor de la app.
    ok(r.status_code == 400, f"cambiar con la actual mal -> 400, no 401 ({r.status_code})")
    r = c.post("/auth/change-my-password", json={"current_password": clave, "new_password": otra})
    ok(r.status_code == 200, f"cambiar contraseña 200 ({r.status_code})")
    r = c.post("/auth/app-login", json={"identifier": CONDUCTOR[0], "password": otra})
    ok(r.status_code == 200 and r.json().get("app_destino") == "conductor", "entra con la nueva")
    # Y se deja como estaba, para la siguiente pasada.
    c.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    r = c.post("/auth/change-my-password", json={"current_password": otra, "new_password": CONDUCTOR[1]})
    ok(r.status_code == 200, "contraseña restaurada")
    r = c.post("/auth/driver-lookup", json={"email": CONDUCTOR[0]})
    ok(r.status_code in (200, 429), f"driver-lookup (código por correo) 200, o 429 por el tope de 3 cada 15 min ({r.status_code})")
    r = c.post("/auth/driver-code/verify", json={"email": CONDUCTOR[0], "code": "000000"})
    ok(r.status_code == 401, f"código malo -> 401 ({r.status_code})")

    print("La ruta del conductor de empresa (reparto/mi-ruta), como RutaConductorNativa")
    r = c.get("/reparto/mi-ruta")
    ok(r.status_code == 200 and "activo" in r.json(), f"mi-ruta contesta ({r.status_code}): activo={r.json().get('activo')}")

    print("El autónomo (lo de siempre): app-login -> reparto, mi-ruta con sus paradas, renovar")
    c.headers.pop("Authorization", None)
    r = c.post("/auth/app-login", json={"identifier": AUTONOMO[0], "password": AUTONOMO[1]})
    s2 = r.json()
    ok(r.status_code == 200 and s2.get("app_destino") == "reparto" and s2.get("role") == "admin", "app_destino reparto, role admin")
    c.headers["Authorization"] = f"Bearer {s2['access_token']}"
    d = c.get("/reparto/mi-ruta").json()
    ok(bool(d.get("activo")) and len(d.get("pedidos", [])) == 4, f"mi-ruta: {len(d.get('pedidos', []))} paradas")
    ok(all(k in d["pedidos"][0] for k in ("id", "direccion", "estado", "lat", "lng")), "cada parada trae id, direccion, estado, lat, lng")
    r = c.post("/auth/renovar")
    ok(r.status_code == 200 and r.json().get("access_token"), "auth/renovar devuelve token")
    r = c.get("/billing/planes")
    ok(r.status_code == 200 and any(p.get("clave") == "autonomo" for p in r.json().get("planes", [])), "billing/planes trae el plan autonomo")
    r = c.get("/org/billing")
    ok(r.status_code == 200, f"org/billing 200 ({r.status_code})")
    r = c.get("/reparto/ajustes")
    ok(r.status_code == 200 and "paises" in r.json(), "reparto/ajustes trae paises")
    r = c.get("/reparto/estadisticas", params={"dias": "30"})
    ok(r.status_code == 200 and "por_dia" in r.json(), "reparto/estadisticas trae por_dia")
    r = c.get("/referidos")
    ok(r.status_code == 200 and "codigo" in r.json(), "referidos trae codigo")

    print()
    if fallos:
        print(f"{len(fallos)} FALLOS:")
        for f in fallos:
            print("  -", f)
        sys.exit(1)
    print("Todo en verde.")


if __name__ == "__main__":
    main()
