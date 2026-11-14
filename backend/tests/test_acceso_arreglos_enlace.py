# -*- coding: utf-8 -*-
"""El acceso del conductor tras la segunda revisión (14-11-2026, ARREGLOS-3, zona acceso; R12 de CONTRATO.md).

Cada prueba fallaba con el código de 403cc89/901524a (las del revisor, `revision2/enlace/test_enlace_revision.py`,
pasaban porque el fallo existía) y pasa con el arreglo:
  A1  la sesión del enlace no crea ni cambia contraseñas ni correos de acceso; renovar o anular el enlace echa a quien
      lo abrió del todo (nada de lo que hizo sigue abriendo la cuenta);
  A2  la contraseña COMPARTIDA (la inicial de la empresa, la temporal común) deja de abrir la cuenta de quien entra con
      el código o con su enlace, sin obligarle a elegir una; `/auth/renovar` conserva cómo se entró;
  A4  los fallos de OTRO teléfono no dejan fuera al teléfono atado; el 409 dice la verdad y lleva su código;
  A5  la IP de los límites es la de Fly (o la última de X-Forwarded-For), no la que escribe quien llama;
  A6  crear, ver y anular enlaces exige poder ver Conductores;
  A7  el número de WhatsApp no se inventa: con el país de la empresa o sin destinatario;
  A14 los días del enlace, en la zona de la empresa;
  R12 los errores llevan su `codigo`.
Sin Mongo: base de mentira y las rutas de verdad (`server.app`)."""
import asyncio
import time
from datetime import datetime, timedelta, timezone

import pytest

import server
from base_de_mentira import Col
from test_alta_enlace import (  # noqa: F401  (mundo es la fixture)
    TEL_ANA, TEL_OTRO, TEL_TERCERO, _canjear, _crear, _h, _mi_ficha, _sesion_admin, _sha, mundo)

CON_ENLACE = "Con el enlace no se puede cambiar la contraseña. Pide a tu empresa que te la cambie."
INICIAL = "inicial-de-la-empresa"


def _login(m, correo, clave, ip="203.0.113.77"):
    return m.http.post("/api/auth/driver-login", json={"email": correo, "password": clave},
                       headers={"X-Forwarded-For": ip})


def _cuenta_propia(m, clave="la-de-luis-123"):
    m.a["driver_accounts"] = Col([{"id": "acc-luis", "driver_id": "d-luis", "email": "luis@ejemplo.es",
                                   "hashed_password": server.hash_password(clave), "active": True,
                                   "password_changed_at": "2026-10-01T10:00:00+00:00"}])


def _con_inicial(m, cuenta=True):
    """La empresa tiene contraseña inicial y Luis (con correo en su ficha) solo tiene la cuenta con ella (o ninguna)."""
    h = server.hash_password(INICIAL)
    next(o for o in m.g["organizations"].docs if o["id"] == "orga")["contrasena_inicial_hash"] = h
    ahora = datetime.now(timezone.utc).isoformat()
    m.a["driver_accounts"] = Col([server._cuenta_inicial("d-luis", "luis@ejemplo.es", h, ahora)] if cuenta else [])
    return h


def _codigo_por_correo(m, codigo="654321"):
    ahora = datetime.now(timezone.utc)
    m.a["driver_login_codes"] = Col([{"_id": "c1", "driver_id": "d-luis", "email": "luis@ejemplo.es",
                                      "destination_email": "luis@ejemplo.es",
                                      "code_hash": _sha(f"{server.SECRET_KEY}:{codigo}"),
                                      "created_at": ahora, "expires_at": ahora + timedelta(minutes=10),
                                      "attempts": 0}])
    return m.http.post("/api/auth/driver-code/verify",
                       json={"email": "luis@ejemplo.es", "code": codigo, "slug": "transportes-perez"})


def _sesion_enlace(m, driver_id="d-luis", dispositivo=TEL_OTRO):
    token = _crear(m, driver_id).json()["token"]
    e = _canjear(m, token, dispositivo=dispositivo)
    assert e.status_code == 200, e.text
    return e.json()["access_token"]


# Toda ruta que crea o cambia una contraseña, o vincula o cambia un correo de acceso, que puede llamar una sesión de
# conductor (recorridas en server.py: change-my-password —cambiar y crear—, codigo-clave y mi-correo-personal; además,
# mi-telefono cuando cambia el que ya hay, que es adonde la empresa manda el enlace nuevo).
RUTAS_PROHIBIDAS = [
    ("/api/auth/change-my-password", {"new_password": "me-la-quedo-1"}, "enlace_sin_contrasena"),
    ("/api/auth/change-my-password", {"new_password": "me-la-quedo-1", "current_password": "la-de-luis-123"},
     "enlace_sin_contrasena"),
    ("/api/auth/change-my-password", {"new_password": "me-la-quedo-1", "codigo": "123456"}, "enlace_sin_contrasena"),
    ("/api/auth/codigo-clave", {}, "enlace_sin_contrasena"),
    ("/api/portal/mi-correo-personal", {"email": "intruso@ejemplo.es"}, "enlace_sin_contrasena"),
    # La cuenta de la tienda (14-11-2026, enlace3 hallazgo 2): correo y contraseña atados al conductor que seguían
    # abriendo la tienda después de anular el enlace.
    ("/api/tienda/cuenta/vincular", {"email": "intruso@ejemplo.es", "password": "intruso-1234"},
     "enlace_sin_contrasena"),
    ("/api/portal/mi-telefono", {"telefono": "699 111 222"}, "enlace_sin_cambiar_telefono"),
]


# ── A1 · la sesión del enlace no fabrica contraseñas ──────────────────────────────────────────────────────────────

def test_la_sesion_del_enlace_no_cuenta_como_recien_entrado(mundo):
    sesion = _sesion_enlace(mundo)
    p = server.decode_token(sesion)
    assert "at" not in p and p["via"] == "enlace" and p["lk"]
    ficha = _mi_ficha(mundo, sesion).json()
    assert ficha["clave_sin_actual"] is False and ficha["configurar_cuenta"] is False
    # Renovarla tampoco le da `at`.
    r = mundo.http.post("/api/auth/renovar", headers=_h(sesion))
    assert r.status_code == 200 and "at" not in server.decode_token(r.json()["access_token"])


@pytest.mark.parametrize("con_cuenta", [True, False])
def test_con_la_sesion_del_enlace_toda_ruta_de_contrasena_o_correo_de_acceso_da_403(mundo, con_cuenta):
    if con_cuenta:
        _cuenta_propia(mundo)
    else:
        mundo.a["driver_accounts"] = Col([])            # sin cuenta: antes, el camino «no tiene ninguna» la creaba
    next(d for d in mundo.a["drivers"].docs if d["id"] == "d-luis")["phone"] = "+34600000001"
    cuentas_antes = [dict(c) for c in mundo.a["driver_accounts"].docs]
    sesion = _sesion_enlace(mundo)
    for ruta, cuerpo, codigo in RUTAS_PROHIBIDAS:
        r = mundo.http.post(ruta, json=cuerpo, headers=_h(sesion))
        assert r.status_code == 403, (ruta, r.status_code, r.text)
        assert r.json()["codigo"] == codigo, (ruta, r.text)
        if codigo == "enlace_sin_contrasena":
            assert r.json()["detail"] == CON_ENLACE
    # Nada ha cambiado: ni cuentas, ni códigos para cambiarla, ni correos personales pendientes, ni el teléfono.
    assert [dict(c) for c in mundo.a["driver_accounts"].docs] == cuentas_antes
    assert mundo.a["driver_clave_codes"].docs == []
    assert mundo.g["driver_recovery_pending"].docs == []
    assert mundo.a["tienda_clientes"].docs == []
    assert next(d for d in mundo.a["drivers"].docs if d["id"] == "d-luis")["phone"] == "+34600000001"


def test_con_la_sesion_del_enlace_si_se_pone_el_telefono_que_falta(mundo):
    sesion = _sesion_enlace(mundo)
    r = mundo.http.post("/api/portal/mi-telefono", json={"telefono": "699 111 222"}, headers=_h(sesion))
    assert r.status_code == 200, r.text
    assert next(d for d in mundo.a["drivers"].docs if d["id"] == "d-luis")["phone"] == "699111222"


def test_las_sesiones_de_codigo_y_de_contrasena_siguen_pudiendo_lo_de_siempre(mundo):
    _cuenta_propia(mundo)
    codigo = server.create_token("d-luis", "driver", "Luis Pérez", org_id="orga", db_name="dsp_orga",
                                 account_type="dsp", entrada=time.time(), via="codigo")
    r = mundo.http.post("/api/auth/change-my-password", json={"new_password": "nueva-de-luis-1"}, headers=_h(codigo))
    assert r.status_code == 200, r.text
    clave = server.create_token("d-luis", "driver", "Luis Pérez", org_id="orga", db_name="dsp_orga",
                                account_type="dsp", entrada=time.time() - 3600)
    r = mundo.http.post("/api/auth/change-my-password",
                        json={"new_password": "otra-de-luis-2", "current_password": "nueva-de-luis-1"},
                        headers=_h(clave))
    assert r.status_code == 200, r.text
    assert _login(mundo, "luis@ejemplo.es", "otra-de-luis-2").status_code == 200


@pytest.mark.parametrize("como", ["renovar", "anular"])
def test_renovar_o_anular_el_enlace_deja_fuera_a_quien_lo_abrio_del_todo(mundo, como):
    """Luis entra cada día con SU contraseña; su enlace lo abre primero otra persona (mensaje reenviado). Esa persona
    no puede quedarse nada: el dueño renueva o anula y ya no entra por ningún lado; Luis sigue con la suya."""
    _cuenta_propia(mundo)
    intrusa = _sesion_enlace(mundo, dispositivo=TEL_OTRO)
    for ruta, cuerpo, _codigo in RUTAS_PROHIBIDAS:
        mundo.http.post(ruta, json=cuerpo, headers=_h(intrusa))
    if como == "renovar":
        assert _crear(mundo, "d-luis", renovar=True).status_code == 200
    else:
        assert mundo.http.delete("/api/conductores/d-luis/acceso", headers=_h(_sesion_admin())).status_code == 200
    r = _mi_ficha(mundo, intrusa)
    assert r.status_code == 401 and r.json()["codigo"] == "acceso_cambiado"
    r = mundo.http.post("/api/auth/renovar", headers=_h(intrusa))
    assert r.status_code == 401 and r.json()["codigo"] == "acceso_cambiado"
    assert _login(mundo, "luis@ejemplo.es", "me-la-quedo-1").status_code == 401
    assert _login(mundo, "luis@ejemplo.es", "la-de-luis-123", ip="203.0.113.78").status_code == 200


# ── A2 · la contraseña compartida se retira para quien entra con código o enlace ──────────────────────────────────

def test_al_entrar_con_el_codigo_la_inicial_compartida_deja_de_abrir_su_cuenta(mundo):
    _con_inicial(mundo)
    r = _codigo_por_correo(mundo)
    assert r.status_code == 200 and r.json()["configurar_cuenta"] is False
    sesion = r.json()["access_token"]
    assert _mi_ficha(mundo, sesion).json()["configurar_cuenta"] is False
    # Un compañero que sabe la inicial y el correo de Luis: el fallo de siempre, sin pistas.
    c = _login(mundo, "luis@ejemplo.es", INICIAL)
    assert c.status_code == 401 and c.json()["detail"] == "Email o contraseña incorrectos"
    # La cuenta sigue (su ficha, su acceso), sin ninguna contraseña que alguien sepa y sin obligarle a nada.
    [cuenta] = mundo.a["driver_accounts"].docs
    assert cuenta["active"] is True and not cuenta.get("must_change_password") and not cuenta.get("contrasena_inicial")
    # Si quiere una, la elige desde su sesión de código (nada más entrar, sin la actual) y entra con ella.
    assert mundo.http.post("/api/auth/change-my-password", json={"new_password": "la-mia-de-luis"},
                           headers=_h(sesion)).status_code == 200
    assert _login(mundo, "luis@ejemplo.es", "la-mia-de-luis").status_code == 200


@pytest.mark.parametrize("con_cuenta", [True, False])
def test_al_entrar_con_el_enlace_la_inicial_compartida_deja_de_abrir_su_cuenta(mundo, con_cuenta):
    _con_inicial(mundo, cuenta=con_cuenta)
    sesion = _sesion_enlace(mundo, dispositivo=TEL_ANA)
    assert _mi_ficha(mundo, sesion).json()["configurar_cuenta"] is False
    renovada = mundo.http.post("/api/auth/renovar", headers=_h(sesion))
    assert renovada.status_code == 200 and renovada.json()["configurar_cuenta"] is False
    c = _login(mundo, "luis@ejemplo.es", INICIAL)
    assert c.status_code == 401 and c.json()["detail"] == "Email o contraseña incorrectos"
    # Sin cuenta, la inicial ya no se la crea.
    assert all(not server.verify_password(INICIAL, x["hashed_password"]) for x in mundo.a["driver_accounts"].docs)


def test_entrar_con_la_inicial_sigue_obligando_a_elegir_la_suya(mundo):
    _con_inicial(mundo, cuenta=False)
    r = _login(mundo, "luis@ejemplo.es", INICIAL)
    assert r.status_code == 200 and r.json()["configurar_cuenta"] is True


def test_quien_ya_tiene_la_suya_o_una_temporal_de_la_oficina_no_nota_nada(mundo):
    _cuenta_propia(mundo)
    next(o for o in mundo.g["organizations"].docs if o["id"] == "orga")["contrasena_inicial_hash"] = \
        server.hash_password(INICIAL)
    assert _codigo_por_correo(mundo).status_code == 200
    assert _login(mundo, "luis@ejemplo.es", "la-de-luis-123").status_code == 200
    # La inicial le sigue diciendo lo de siempre (ya eligió la suya).
    assert _login(mundo, "luis@ejemplo.es", INICIAL, ip="203.0.113.79").json()["detail"] == \
        server._MSG_INICIAL_YA_CAMBIADA
    # Una temporal que le pone la oficina (suya, aunque su cuenta viniera de la inicial) tampoco se toca.
    _con_inicial(mundo)
    adm = _sesion_admin()
    assert mundo.http.post("/api/auth/set-driver-password", json={"driver_id": "d-luis", "password": "temporal-77"},
                           headers=_h(adm)).status_code == 200
    assert _codigo_por_correo(mundo, "111222").status_code == 200
    assert _login(mundo, "luis@ejemplo.es", "temporal-77", ip="203.0.113.80").status_code == 200


def test_la_temporal_comun_en_bloque_tambien_es_compartida(mundo):
    h = server.hash_password("comun-de-todos-1")
    mundo.a["driver_accounts"] = Col([{"id": "acc", "driver_id": "d-luis", "email": "luis@ejemplo.es",
                                       "hashed_password": h, "active": True, "creada_en_bloque": True,
                                       "must_change_password": True,
                                       "password_temp_created_at": datetime.now(timezone.utc).isoformat()}])
    assert _codigo_por_correo(mundo).status_code == 200
    assert _login(mundo, "luis@ejemplo.es", "comun-de-todos-1").status_code == 401


@pytest.mark.asyncio
async def test_la_inicial_y_la_retirada_a_la_vez_acaban_sin_abrir(mundo, monkeypatch):
    """Dos entradas a la vez: un compañero entra con la inicial (sin cuenta: se la crearía) mientras Luis entra con su
    código. Se fuerza el peor orden: la retirada pasa entera entre que el login lee la ficha y escribe la cuenta."""
    _con_inicial(mundo, cuenta=False)
    original = server._hash_inicial_de
    hecho = {"n": 0}

    async def en_medio(org):
        if hecho["n"] == 0:
            hecho["n"] = 1
            await server._retirar_la_compartida(mundo.a, org, "d-luis")
        return await original(org)

    monkeypatch.setattr(server, "_hash_inicial_de", en_medio)
    hallados, _ya = await server._entrar_con_la_inicial("luis@ejemplo.es", INICIAL, [(
        next(o for o in mundo.g["organizations"].docs if o["id"] == "orga"), mundo.a)])
    monkeypatch.setattr(server, "_hash_inicial_de", original)
    assert hecho["n"] == 1 and hallados == []
    assert all(not server.verify_password(INICIAL, c["hashed_password"]) for c in mundo.a["driver_accounts"].docs)
    assert _login(mundo, "luis@ejemplo.es", INICIAL).status_code == 401


@pytest.mark.asyncio
async def test_dos_retiradas_a_la_vez_y_la_que_elige_la_suya_entre_medias(mundo):
    _con_inicial(mundo)
    org = next(o for o in mundo.g["organizations"].docs if o["id"] == "orga")
    await asyncio.gather(server._retirar_la_compartida(mundo.a, org, "d-luis"),
                         server._retirar_la_compartida(mundo.a, org, "d-luis"))
    assert _login(mundo, "luis@ejemplo.es", INICIAL).status_code == 401
    # Si elige la suya (cambia el hash) justo antes de que la retirada escriba, la retirada no se la pisa.
    _con_inicial(mundo)
    for d in mundo.a["drivers"].docs:
        d.pop("inicial_retirada_at", None)
    original = server._cuentas_de

    async def y_elige_la_suya(tdb, driver_id, correo=""):
        cuentas = await original(tdb, driver_id, correo)
        for c in mundo.a["driver_accounts"].docs:
            c.update(hashed_password=server.hash_password("la-suya-123"),
                     password_changed_at=datetime.now(timezone.utc).isoformat())
            c.pop("must_change_password", None)
        return cuentas

    server._cuentas_de, guardada = y_elige_la_suya, server._cuentas_de
    try:
        await server._retirar_la_compartida(mundo.a, org, "d-luis")
    finally:
        server._cuentas_de = guardada
    assert _login(mundo, "luis@ejemplo.es", "la-suya-123").status_code == 200


def test_renovar_la_sesion_del_codigo_conserva_via_y_no_obliga(mundo):
    """La app de Android renueva a partir del quinto día y guarda `configurar_cuenta`: no puede recibir un valor
    distinto del que recibió al entrar."""
    _con_inicial(mundo)
    r = _codigo_por_correo(mundo)
    sesion = r.json()["access_token"]
    n = mundo.http.post("/api/auth/renovar", headers=_h(sesion))
    assert n.status_code == 200, n.text
    assert n.json()["configurar_cuenta"] is False
    p = server.decode_token(n.json()["access_token"])
    assert p["via"] == "codigo" and p["at"] == server.decode_token(sesion)["at"] and "lk" not in p
    assert _mi_ficha(mundo, n.json()["access_token"]).json()["configurar_cuenta"] is False


def test_renovar_la_sesion_del_codigo_sin_cuenta_vale_y_con_el_acceso_quitado_no(mundo):
    mundo.a["driver_accounts"] = Col([])
    sesion = server.create_token("d-luis", "driver", "Luis Pérez", org_id="orga", db_name="dsp_orga",
                                 account_type="dsp", entrada=time.time(), via="codigo")
    assert mundo.http.post("/api/auth/renovar", headers=_h(sesion)).status_code == 200
    mundo.a["driver_accounts"] = Col([{"id": "x", "driver_id": "d-luis", "email": "luis@ejemplo.es",
                                       "hashed_password": server.hash_password("z" * 10), "active": False}])
    assert mundo.http.post("/api/auth/renovar", headers=_h(sesion)).status_code == 401


def test_renovar_la_sesion_de_contrasena_sigue_como_siempre(mundo):
    _con_inicial(mundo)
    r = _login(mundo, "luis@ejemplo.es", INICIAL)
    assert r.json()["configurar_cuenta"] is True
    n = mundo.http.post("/api/auth/renovar", headers=_h(r.json()["access_token"]))
    assert n.status_code == 200 and n.json()["configurar_cuenta"] is True
    assert "via" not in server.decode_token(n.json()["access_token"])


# ── A4 · el teléfono bueno no queda fuera por los toques de otro ──────────────────────────────────────────────────

def test_los_toques_de_otro_telefono_no_dejan_fuera_al_telefono_atado(mundo):
    token = _crear(mundo, "d-ana").json()["token"]
    assert _canjear(mundo, token, dispositivo=TEL_ANA).status_code == 200
    for i in range(5):
        r = _canjear(mundo, token, dispositivo=TEL_OTRO, ip="198.51.100.%d" % (i + 1))
        assert r.status_code == 409
        assert r.json() == {"detail": server._ACCESO_OTRO_TELEFONO, "codigo": "enlace_usado_en_otro"}
    # El sexto de otro teléfono, cerrado cinco minutos...
    r = _canjear(mundo, token, dispositivo=TEL_TERCERO, ip="198.51.100.99")
    assert r.status_code == 429 and r.json()["codigo"] == "demasiados_intentos"
    # ...pero el teléfono bueno entra.
    assert _canjear(mundo, token, dispositivo=TEL_ANA, ip="203.0.113.10").status_code == 200
    # Y entrar el bueno no le borra la cuenta al otro.
    assert _canjear(mundo, token, dispositivo=TEL_OTRO, ip="198.51.100.98").status_code == 429


def test_el_409_dice_la_verdad_a_quien_perdio_el_secreto_de_su_navegador():
    assert "otro navegador" in server._ACCESO_OTRO_TELEFONO and "pide uno nuevo" in server._ACCESO_OTRO_TELEFONO


# ── A5 · la IP de los límites ─────────────────────────────────────────────────────────────────────────────────────

def test_el_limite_por_ip_no_se_salta_inventando_x_forwarded_for(mundo):
    vistos = []
    for i in range(80):
        r = mundo.http.post("/api/auth/enlace", json={"token": "%064x" % i, "dispositivo": TEL_OTRO},
                            headers={"X-Forwarded-For": "10.9.%d.%d, 66.66.66.66" % (i // 200, i % 200)})
        vistos.append(r.status_code)
    assert vistos[:50] == [401] * 50 and set(vistos[50:]) == {429}


def test_fly_client_ip_manda_sobre_x_forwarded_for(mundo):
    for i in range(55):
        r = mundo.http.post("/api/auth/enlace", json={"token": "%064x" % i, "dispositivo": TEL_OTRO},
                            headers={"Fly-Client-IP": "66.66.66.67", "X-Forwarded-For": "10.0.0.%d" % i})
    assert r.status_code == 429


def test_la_ip_que_se_apunta_es_la_de_fly():
    class Pet:
        def __init__(self, cab):
            self.headers, self.client = cab, None
    assert server._rl_key_ip(Pet({"fly-client-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9, 5.6.7.8"})) == "1.2.3.4"
    assert server._rl_key_ip(Pet({"x-forwarded-for": "9.9.9.9, 5.6.7.8"})) == "5.6.7.8"
    assert server._rl_key_ip(Pet({"x-forwarded-for": "5.6.7.8"})) == "5.6.7.8"
    assert server._rl_key_ip(Pet({})) == "?"


# ── A6 · el enlace es cosa de quien ve Conductores ────────────────────────────────────────────────────────────────

def test_sin_la_pantalla_de_conductores_no_se_crea_ni_se_ve_ni_se_anula_un_enlace(mundo):
    mundo.g["admin_users"].docs.append({"id": "adm-taller", "username": "taller", "name": "Mecánico", "role": "admin",
                                        "org_id": "orga", "permissions": ["vehiculos"]})
    taller = _sesion_admin("adm-taller", "orga", permissions=["vehiculos"])
    for r in (_crear(mundo, "d-luis", admin=taller),
              mundo.http.get("/api/conductores/accesos", headers=_h(taller)),
              mundo.http.delete("/api/conductores/d-luis/acceso", headers=_h(taller))):
        assert r.status_code == 403 and r.json()["codigo"] == "sin_permiso", r.text
    assert mundo.g["accesos_conductor"].docs == []
    mundo.g["admin_users"].docs.append({"id": "adm-of", "username": "oficina", "name": "Oficina", "role": "admin",
                                        "org_id": "orga", "permissions": ["conductores"]})
    assert _crear(mundo, "d-luis", admin=_sesion_admin("adm-of", "orga", permissions=["conductores"])).status_code == 200


# ── A7 · el número de WhatsApp, sin inventar ──────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("pais,movil,esperado", [
    ("es", "612 345 678", "34612345678"), ("es", "+34 612 345 678", "34612345678"),
    ("es", "0034612345678", "34612345678"), ("es", "34612345678", "34612345678"),
    ("es", "912 345 678", ""), ("es", "61234", ""),
    ("pt", "912 345 678", "351912345678"), ("pt", "612 345 678", ""), ("pt", "+351 912 345 678", "351912345678"),
    ("fr", "06 12 34 56 78", "33612345678"), ("fr", "01 23 45 67 89", ""),
    ("it", "312 345 6789", "393123456789"), ("de", "0151 23456789", "4915123456789"),
    ("gb", "07123 456789", "447123456789"), ("ie", "085 123 4567", "353851234567"),
    ("mx", "55 1234 5678", ""), ("mx", "+52 55 1234 5678", "525512345678"),
])
def test_el_movil_para_whatsapp_con_el_pais_de_la_empresa(pais, movil, esperado):
    assert server._movil_wa(movil, pais) == esperado


def test_fuera_de_espana_el_enlace_va_al_numero_bueno_o_sin_destinatario(mundo):
    next(o for o in mundo.g["organizations"].docs if o["id"] == "orga")["pais"] = "pt"
    mundo.a["drivers"].docs[0]["movil_personal"] = "912 345 678"              # Ana, móvil portugués
    next(d for d in mundo.a["drivers"].docs if d["id"] == "d-rosa")["phone"] = "06 12 34 56 78"   # no se monta
    creado = _crear(mundo, "d-ana").json()
    assert creado["whatsapp"] == "351912345678"
    filas = {c["driver_id"]: c for c in mundo.http.get("/api/conductores/accesos",
                                                       headers=_h(_sesion_admin())).json()["conductores"]}
    assert filas["d-ana"]["whatsapp"] == "351912345678"
    assert filas["d-rosa"]["whatsapp"] is None and filas["d-rosa"]["movil"] == "06 12 34 56 78"


# ── A14 · los días, en la zona de la empresa ──────────────────────────────────────────────────────────────────────

def test_los_dias_del_enlace_salen_en_la_zona_de_la_empresa(mundo):
    next(o for o in mundo.g["organizations"].docs if o["id"] == "orga").update(pais="mx", zona_horaria="America/Mexico_City")
    server._REGION_CACHE.clear()
    try:
        token = _crear(mundo, "d-ana").json()["token"]
        assert _canjear(mundo, token).status_code == 200
        # Abierto a las 03:30 UTC del 15: en Ciudad de México aún es el 14 (en Madrid sería el 15).
        mundo.g["accesos_conductor"].docs[0]["abierto_at"] = "2026-11-15T03:30:00+00:00"
        filas = mundo.http.get("/api/conductores/accesos", headers=_h(_sesion_admin())).json()["conductores"]
        assert next(c for c in filas if c["driver_id"] == "d-ana")["acceso"]["abierto_dia"] == "2026-11-14"
    finally:
        server._REGION_CACHE.clear()


# ── R12 · los errores llevan su código ────────────────────────────────────────────────────────────────────────────

def test_los_errores_del_enlace_llevan_su_codigo(mundo):
    r = mundo.http.post("/api/auth/enlace", json={"token": "f" * 64})
    assert r.status_code == 400 and r.json()["codigo"] == "enlace_sin_telefono"
    r = _canjear(mundo, "f" * 64)
    assert r.status_code == 401 and r.json() == {"detail": server._ACCESO_NO_VALE, "codigo": "enlace_no_vale"}
    r = _crear(mundo, "no-existe")
    assert r.status_code == 404 and r.json()["codigo"] == "conductor_no_encontrado"
    r = _crear(mundo, "d-pepe")
    assert r.status_code == 409 and r.json()["codigo"] == "de_baja" and r.json()["detail"]["codigo"] == "de_baja"
    assert r.json()["dato"] == "Pepe de baja"
    token = _crear(mundo, "d-ana").json()["token"]
    assert _canjear(mundo, token).status_code == 200
    r = _crear(mundo, "d-ana")
    assert r.status_code == 409 and r.json()["codigo"] == "ya_abierto" and r.json()["dato"] == "Ana López"
    assert r.json()["detail"]["mensaje"].startswith("Ana López ya entra")
    norte = _sesion_admin("adm-b-norte", "orgb", allowed_centers=["NORTE"])
    r = mundo.http.post("/api/conductores/d-sur/acceso", json={}, headers=_h(norte))
    assert r.status_code == 403 and r.json()["codigo"] == "centro_no_visible"
    r = mundo.http.post("/api/conductores/d-ana/acceso", json={}, headers=_h(_sesion_admin(suplantado=True)))
    assert r.status_code == 403 and r.json()["codigo"] == "solo_el_cliente"
