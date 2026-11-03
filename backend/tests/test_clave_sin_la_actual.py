# -*- coding: utf-8 -*-
"""Cambiar la contraseña sin saber la actual (02-11-2026).

María (oficina de OGA5): «No les deja cambiar la contraseña en la app… creo que inician desde Google». Quien entra con la
contraseña que le rellena Google, o con el código del correo, no sabe su contraseña actual, y «Cambiar contraseña» se la
pedía sin otra salida. Muchos, además, creen que «la actual» es la inicial de la empresa, que dejó de valer cuando
eligieron la suya. Ahora:
  · nada más entrar (15 min desde que se ENTRÓ, no desde que se renovó la sesión) se cambia sin la actual;
  · con la sesión abierta se pide un código al correo (POST /auth/codigo-clave) que vale por la actual, una vez;
  · si escribe la inicial de la empresa ya cambiada, se le dice qué pasa en vez de «no es correcta» a secas.
"""
import re
import time
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Db

CORREO = "conductora@empresa.es"
PERSONAL = "ella.personal@gmail.com"
PROPIA = "la-que-no-recuerda-1"
INICIAL = "inicial-de-la-empresa-1"


@pytest.fixture
def base(monkeypatch):
    tenant = Db()
    tenant["drivers"] = Col([
        {"id": "f1", "name": "LUCÍA", "email": CORREO, "active": True, "created_at": "2026-09-01"},
        {"id": "f2", "name": "OTRO", "email": "otro@empresa.es", "active": True, "created_at": "2026-09-01"},
        {"id": "f3", "name": "SIN CORREO", "email": "", "active": True, "created_at": "2026-09-01"},
    ])
    # Una contraseña PROPIA (no temporal): la de quien entra con Google o con el código y ya no se acuerda.
    tenant["driver_accounts"] = Col([
        {"id": "c1", "driver_id": "f1", "email": CORREO, "hashed_password": server.hash_password(PROPIA),
         "active": True, "password_changed_at": "2026-10-20T10:00:00+00:00", "created_at": "2026-09-01"},
        {"id": "c2", "driver_id": "f2", "email": "otro@empresa.es", "hashed_password": server.hash_password("la-del-otro-1"),
         "active": True, "password_changed_at": "2026-10-20T10:00:00+00:00", "created_at": "2026-09-01"},
    ])
    tenant["driver_recovery_emails"] = Col([])
    tenant["driver_clave_codes"] = Col([])
    globales = Db()
    globales["organizations"] = Col([{"id": "o1", "slug": "oga5", "name": "OGA5", "account_type": "dsp",
                                      "db_name": "dsp_o1", "status": "active",
                                      "contrasena_inicial_hash": server.hash_password(INICIAL)}])
    globales["admin_users"] = Col([])
    monkeypatch.setattr(server, "db", tenant)
    monkeypatch.setattr(server, "global_db", globales)

    class _Cliente(dict):
        def __missing__(self, nombre):
            self[nombre] = Db()
            return self[nombre]
    monkeypatch.setattr(server, "client", _Cliente({"dsp_o1": tenant}))

    async def org(oid):
        return await globales["organizations"].find_one({"id": oid}, {"_id": 0})
    monkeypatch.setattr(server, "get_org", org)

    enviados = []

    async def enviar(to, subject, html, **kw):
        enviados.append({"to": to, "subject": subject, "texto": kw.get("texto", "")})
        return True
    monkeypatch.setattr(server, "_enviar_email", enviar)

    async def sin_espera(_s):
        return None
    monkeypatch.setattr(server.asyncio, "sleep", sin_espera)
    server._public_actions.clear()
    server._login_fails.clear()
    server._FICHA_ACTIVA_CACHE.clear()
    tenant.enviados = enviados
    return tenant


def _yo(driver_id="f1", **extra):
    """La sesión de una conductora que entró hace días (sin hora de entrada reciente)."""
    return {"sub": driver_id, "role": "driver", "org_id": "o1", "db_name": "dsp_o1", **extra}


def _codigo(base):
    return re.search(r"\b(\d{6})\b", base.enviados[-1]["texto"]).group(1)


def _peticion():
    return SimpleNamespace(headers={}, client=SimpleNamespace(host="10.0.0.1"),
                           url=SimpleNamespace(path="/api/auth/driver-login"), method="POST")


# ── Nada más entrar ──────────────────────────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_al_entrar_con_contrasena_el_token_lleva_la_hora_de_entrada(base):
    s = await server.driver_login(server.DriverLoginRequest(email=CORREO, password=PROPIA), _peticion())
    at = server.decode_token(s.access_token).get("at")
    assert at and abs(time.time() - at) < 30


@pytest.mark.asyncio(loop_scope="session")
async def test_nada_mas_entrar_se_cambia_sin_la_actual(base):
    r = await server.change_my_password({"current_password": "", "new_password": "la-nueva-1"}, _yo(at=int(time.time())))
    assert r == {"success": True}
    assert server.verify_password("la-nueva-1", base["driver_accounts"].docs[0]["hashed_password"])


@pytest.mark.asyncio(loop_scope="session")
async def test_pasados_15_minutos_vuelve_a_pedir_la_actual(base):
    with pytest.raises(HTTPException) as e:
        await server.change_my_password({"current_password": "", "new_password": "la-nueva-1"},
                                        _yo(at=int(time.time()) - 16 * 60))
    assert e.value.status_code == 400 and "escribe la actual" in e.value.detail and "código a tu correo" in e.value.detail
    with pytest.raises(HTTPException):
        await server.change_my_password({"current_password": "", "new_password": "la-nueva-1"}, _yo())
    assert server.verify_password(PROPIA, base["driver_accounts"].docs[0]["hashed_password"])


@pytest.mark.asyncio(loop_scope="session")
async def test_nada_mas_entrar_una_actual_mal_escrita_se_rechaza_como_siempre(base):
    # Recién entrado no hace falta escribirla; si se escribe y está mal, 400 (el contrato de la app: api_conductor.py).
    with pytest.raises(HTTPException) as e:
        await server.change_my_password({"current_password": "mal", "new_password": "la-nueva-1"}, _yo(at=int(time.time())))
    assert e.value.status_code == 400 and "actual no es correcta" in e.value.detail
    assert server.verify_password(PROPIA, base["driver_accounts"].docs[0]["hashed_password"])


@pytest.mark.asyncio(loop_scope="session")
async def test_renovar_la_sesion_copia_la_hora_de_entrada_no_la_rejuvenece(base, monkeypatch):
    monkeypatch.setattr(server, "_exigir_app_al_dia", lambda _r: None)
    hace_un_dia = int(time.time()) - 86400
    s = await server.renovar_sesion(_yo(at=hace_un_dia), _peticion())
    assert server.decode_token(s.access_token).get("at") == hace_un_dia
    s2 = await server.renovar_sesion(_yo(), _peticion())               # un token viejo sin hora: sigue sin hora
    assert "at" not in server.decode_token(s2.access_token)


@pytest.mark.asyncio(loop_scope="session")
async def test_la_ficha_dice_si_puede_cambiarla_sin_la_actual_y_adonde_iria_el_codigo(base):
    r = await server.portal_mi_ficha(_yo(at=int(time.time())))
    assert r["clave_sin_actual"] is True and r["codigo_a"].endswith("@empresa.es") and CORREO not in r["codigo_a"]
    r = await server.portal_mi_ficha(_yo())
    assert r["clave_sin_actual"] is False
    assert (await server.portal_mi_ficha(_yo("f3")))["codigo_a"] is None


# ── Una sola regla para pedirla y para aceptarla (03-11-2026) ────────────────────────────────────────────────────────
# José Arturo (OGA5): «no pueden pedir para trabajar mañana… les da problemas con la contraseña». Tres conductores se
# quedaron en «Elige tu contraseña personal» (sin la actual) y el servidor se la rechazaba una y otra vez: el login, la
# renovación y la ficha decían «configurar la cuenta» con solo mirar la marca, y el cambio miraba además las fechas.

@pytest.mark.asyncio(loop_scope="session")
async def test_con_una_temporal_vieja_ni_la_ficha_ni_la_renovacion_piden_elegirla(base, monkeypatch):
    monkeypatch.setattr(server, "_exigir_app_al_dia", lambda _r: None)
    c1 = base["driver_accounts"].docs[0]
    c1.update({"must_change_password": True, "password_temp_created_at": "2026-10-01T10:00:00+00:00"})
    assert (await server.portal_mi_ficha(_yo()))["configurar_cuenta"] is False
    s = await server.renovar_sesion(_yo(), _peticion())
    assert s.configurar_cuenta is False
    with pytest.raises(HTTPException) as e:                       # y el cambio sin la actual dice qué hacer
        await server.change_my_password({"current_password": "", "new_password": "la-nueva-1"}, _yo())
    assert "escribe la actual" in e.value.detail


@pytest.mark.asyncio(loop_scope="session")
async def test_con_una_temporal_nueva_la_piden_y_se_crea_sin_la_actual(base, monkeypatch):
    monkeypatch.setattr(server, "_exigir_app_al_dia", lambda _r: None)
    c1 = base["driver_accounts"].docs[0]
    c1.update({"must_change_password": True, "password_temp_created_at": "2026-11-03T08:00:00+00:00"})
    assert (await server.portal_mi_ficha(_yo()))["configurar_cuenta"] is True
    assert (await server.renovar_sesion(_yo(), _peticion())).configurar_cuenta is True
    assert await server.change_my_password({"current_password": "", "new_password": "la-mia-nueva-1"}, _yo()) == {"success": True}
    assert (await server.portal_mi_ficha(_yo()))["configurar_cuenta"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_la_temporal_de_otra_cuenta_suya_vieja_no_pide_elegirla(base):
    # Dos cuentas de la misma persona (fichas fusionadas): la temporal vieja de una no vale frente a la propia de la otra.
    base["driver_accounts"].docs.append({"id": "c9", "driver_id": "f1", "email": CORREO, "active": True,
                                         "hashed_password": server.hash_password("vieja-1"), "creada_en_bloque": True,
                                         "password_temp_created_at": "2026-10-01T10:00:00+00:00", "created_at": "2026-10-01"})
    assert (await server.portal_mi_ficha(_yo()))["configurar_cuenta"] is False
    assert await server._configurar_cuenta_de(base, "f1", CORREO) is False


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_ninguna_cuenta_el_login_por_codigo_pide_crearla_si_puede(base):
    base["drivers"].docs.append({"id": "f4", "name": "NUEVA", "email": "nueva@empresa.es", "active": True})
    assert await server._configurar_cuenta_de(base, "f4") is True
    # Sin correo en la ficha no se puede crear («Tu ficha no tiene correo»): no se la deja en esa pantalla.
    assert await server._configurar_cuenta_de(base, "f3") is False
    assert await server._configurar_cuenta_de(base, "") is False
    # Y la ficha no opina (null): ni obliga a quien ya estaba dentro sin cuenta, ni le quita la pantalla al que entra.
    f = await server.portal_mi_ficha(_yo("f4"))
    assert f["configurar_cuenta"] is None and f["tiene_clave"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_con_dos_fichas_la_ficha_mira_tambien_las_cuentas_de_su_correo(base):
    # La revisión del 03-11-2026 (Karim, Junior): la temporal en bloque vieja en la cuenta de la ficha activa y la
    # propia, más nueva, en la de la otra ficha. La ficha decía «elígela» y el cambio no la dejaba sin la actual.
    base["drivers"].docs.append({"id": "f1b", "name": "LUCÍA", "email": CORREO, "active": True, "created_at": "2026-10-25"})
    base["driver_accounts"].docs.append({"id": "c1b", "driver_id": "f1b", "email": CORREO, "active": True,
                                         "hashed_password": server.hash_password("de-bloque-1"), "creada_en_bloque": True,
                                         "password_temp_created_at": "2026-10-01T10:00:00+00:00", "created_at": "2026-10-01"})
    f = await server.portal_mi_ficha(_yo("f1b"))
    assert f["configurar_cuenta"] is False and f["tiene_clave"] is True
    # Solo por el correo y con una temporal vigente: la ficha la pide, y el cambio la acepta sin la actual.
    base["driver_accounts"].docs[:] = [c for c in base["driver_accounts"].docs if c["id"] != "c1b"]
    base["driver_accounts"].docs[0].update({"must_change_password": True, "password_temp_created_at": "2026-11-03T08:00:00+00:00"})
    assert await server._configurar_cuenta_de(base, "f1b", CORREO) is True
    assert (await server.portal_mi_ficha(_yo("f1b")))["configurar_cuenta"] is True
    assert await server.change_my_password({"current_password": "", "new_password": "la-mia-nueva-1"}, _yo("f1b")) == {"success": True}
    assert (await server.portal_mi_ficha(_yo("f1b")))["configurar_cuenta"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_con_la_suya_en_la_cuenta_de_la_ficha_de_baja_entra_con_la_activa(base):
    # Dos fichas suyas (mismo correo): la suya, solo en la cuenta de la de baja (de antes del 29-10), y una temporal vieja
    # en la de la activa. Se le decía «Ficha de conductor desactivada» estando de alta.
    base["drivers"].docs.append({"id": "f1-vieja", "name": "LUCÍA", "email": CORREO, "active": False, "created_at": "2026-08-01"})
    base["driver_accounts"].docs[0]["driver_id"] = "f1-vieja"
    base["driver_accounts"].docs.append({"id": "c1-act", "driver_id": "f1", "email": CORREO, "active": True,
                                         "hashed_password": server.hash_password("de-bloque-1"), "creada_en_bloque": True,
                                         "password_temp_created_at": "2026-10-01T10:00:00+00:00", "created_at": "2026-10-01"})
    s = await server.driver_login(server.DriverLoginRequest(email=CORREO, password=PROPIA), _peticion())
    assert s.id == "f1" and server.decode_token(s.access_token)["sub"] == "f1" and s.configurar_cuenta is False
    # Sin otra ficha activa, la de baja sigue sin entrar.
    base["drivers"].docs[0]["active"] = False
    with pytest.raises(HTTPException) as e:
        await server.driver_login(server.DriverLoginRequest(email=CORREO, password=PROPIA), _peticion())
    assert e.value.status_code == 403


@pytest.mark.asyncio(loop_scope="session")
async def test_la_oficina_que_entra_como_el_no_queda_atrapada_en_elegirla(base):
    base["driver_accounts"].docs[0].update({"must_change_password": True, "password_temp_created_at": "2026-11-03T08:00:00+00:00"})
    assert (await server.portal_mi_ficha(_yo(imp=True)))["configurar_cuenta"] is False
    assert (await server.portal_mi_ficha(_yo()))["configurar_cuenta"] is True


@pytest.mark.asyncio(loop_scope="session")
async def test_la_app_de_android_vieja_sin_la_actual_cierra_la_sesion_para_volver_a_entrar(base):
    # La 2.4.4 no tiene ni la actual ni «Cerrar sesión» en «Elige tu contraseña»: el 401 la lleva a la de entrar.
    def con(cabeceras):
        return SimpleNamespace(headers=cabeceras)
    vacia = {"current_password": "", "new_password": "la-nueva-1"}
    with pytest.raises(HTTPException) as e:
        await server.change_my_password(vacia, _yo(), con({"x-fds-app": "android-2.4.4"}))
    assert e.value.status_code == 401
    for cabeceras in ({"x-fds-app": "android-2.4.5"}, {"x-fds-app": "android-2.5.0"}, {}):   # la 2.4.5 y la web salen solas
        with pytest.raises(HTTPException) as e:
            await server.change_my_password(vacia, _yo(), con(cabeceras))
        assert e.value.status_code == 400 and "escribe la actual" in e.value.detail
    with pytest.raises(HTTPException) as e:                      # teclear mal la actual no echa a nadie de la app
        await server.change_my_password({"current_password": "no-es-1", "new_password": "la-nueva-1"}, _yo(),
                                        con({"x-fds-app": "android-2.4.4"}))
    assert e.value.status_code == 400
    # Con una temporal de verdad, la vieja la crea sin la actual, como siempre.
    base["driver_accounts"].docs[0].update({"must_change_password": True, "password_temp_created_at": "2026-11-03T08:00:00+00:00"})
    assert await server.change_my_password(vacia, _yo(), con({"x-fds-app": "android-2.4.4"})) == {"success": True}


# ── La inicial de la empresa, ya cambiada ────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_si_escribe_la_inicial_de_la_empresa_ya_cambiada_se_le_explica(base):
    with pytest.raises(HTTPException) as e:
        await server.change_my_password({"current_password": INICIAL, "new_password": "la-nueva-1"}, _yo())
    assert e.value.status_code == 400 and "contraseña inicial de la empresa" in e.value.detail
    with pytest.raises(HTTPException) as e:
        await server.change_my_password({"current_password": "otra-cualquiera", "new_password": "la-nueva-1"}, _yo())
    assert e.value.detail == "La contraseña actual no es correcta"


# ── Con un código en el correo ───────────────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_con_el_codigo_del_correo_cambia_y_entra_con_la_nueva(base):
    r = await server.codigo_para_clave(_yo())
    assert r["ok"] and r["minutos"] == 10 and r["enviado_a"].endswith("@empresa.es") and CORREO not in r["enviado_a"]
    assert base.enviados[-1]["to"] == CORREO
    hecho = await server.change_my_password({"current_password": "", "new_password": "la-nueva-de-lucia-1",
                                             "codigo": _codigo(base)}, _yo())
    assert hecho == {"success": True}
    assert base["driver_clave_codes"].docs == []                 # el código se gasta al usarlo
    s = await server.driver_login(server.DriverLoginRequest(email=CORREO, password="la-nueva-de-lucia-1"), _peticion())
    assert s.role == "driver"


@pytest.mark.asyncio(loop_scope="session")
async def test_el_codigo_va_al_correo_personal_verificado_si_lo_vinculo(base):
    base["driver_recovery_emails"].docs.append({"driver_id": "f1", "email": PERSONAL, "email_norm": PERSONAL,
                                                "verified_at": "2026-10-01T10:00:00+00:00"})
    r = await server.codigo_para_clave(_yo())
    assert base.enviados[-1]["to"] == PERSONAL and r["enviado_a"].endswith("@gmail.com")


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_codigo_ni_actual_rechaza_y_la_actual_buena_sigue_valiendo(base):
    with pytest.raises(HTTPException) as e:
        await server.change_my_password({"current_password": "", "new_password": "otra-nueva-1"}, _yo())
    assert e.value.status_code == 400 and "escribe la actual" in e.value.detail
    assert await server.change_my_password({"current_password": PROPIA, "new_password": "otra-nueva-1"}, _yo()) == {"success": True}


@pytest.mark.asyncio(loop_scope="session")
async def test_un_codigo_malo_no_cambia_nada_y_el_bueno_sigue_valiendo(base):
    await server.codigo_para_clave(_yo())
    bueno = _codigo(base)
    malo = "000000" if bueno != "000000" else "111111"
    with pytest.raises(HTTPException) as e:
        await server.change_my_password({"new_password": "no-deberia-1", "codigo": malo}, _yo())
    assert e.value.status_code == 400 and "código no es correcto" in e.value.detail
    assert base["driver_clave_codes"].docs[0]["attempts"] == 1
    assert server.verify_password(PROPIA, base["driver_accounts"].docs[0]["hashed_password"])
    assert await server.change_my_password({"new_password": "ahora-si-1", "codigo": bueno}, _yo()) == {"success": True}


@pytest.mark.asyncio(loop_scope="session")
async def test_cinco_fallos_anulan_el_codigo(base):
    await server.codigo_para_clave(_yo())
    bueno = _codigo(base)
    malo = "000000" if bueno != "000000" else "111111"
    for _ in range(5):
        with pytest.raises(HTTPException):
            await server.change_my_password({"new_password": "no-deberia-1", "codigo": malo}, _yo())
    with pytest.raises(HTTPException) as e:
        await server.change_my_password({"new_password": "tampoco-1", "codigo": bueno}, _yo())
    assert e.value.status_code == 400
    assert server.verify_password(PROPIA, base["driver_accounts"].docs[0]["hashed_password"])


@pytest.mark.asyncio(loop_scope="session")
async def test_un_codigo_caducado_no_vale(base):
    await server.codigo_para_clave(_yo())
    base["driver_clave_codes"].docs[0]["expires_at"] = datetime.now(timezone.utc) - timedelta(minutes=1)
    with pytest.raises(HTTPException) as e:
        await server.change_my_password({"new_password": "tarde-1", "codigo": _codigo(base)}, _yo())
    assert e.value.status_code == 400


@pytest.mark.asyncio(loop_scope="session")
async def test_el_codigo_de_una_persona_no_cambia_la_de_otra(base):
    await server.codigo_para_clave(_yo("f1"))
    with pytest.raises(HTTPException):
        await server.change_my_password({"new_password": "la-del-otro-nueva-1", "codigo": _codigo(base)}, _yo("f2"))
    assert server.verify_password("la-del-otro-1", base["driver_accounts"].docs[1]["hashed_password"])


@pytest.mark.asyncio(loop_scope="session")
async def test_el_mismo_codigo_no_sirve_dos_veces_y_pedir_otro_anula_el_anterior(base):
    await server.codigo_para_clave(_yo())
    primero = _codigo(base)
    await server.codigo_para_clave(_yo())
    segundo = _codigo(base)
    assert len(base["driver_clave_codes"].docs) == 1
    if primero != segundo:
        with pytest.raises(HTTPException):
            await server.change_my_password({"new_password": "con-el-viejo-1", "codigo": primero}, _yo())
    assert await server.change_my_password({"new_password": "con-el-nuevo-1", "codigo": segundo}, _yo()) == {"success": True}
    with pytest.raises(HTTPException):
        await server.change_my_password({"new_password": "otra-vez-1", "codigo": segundo}, _yo())


@pytest.mark.asyncio(loop_scope="session")
async def test_limite_de_peticiones_sin_correo_y_correo_que_no_sale(base, monkeypatch):
    for _ in range(3):
        await server.codigo_para_clave(_yo())
    with pytest.raises(HTTPException) as e:
        await server.codigo_para_clave(_yo())
    assert e.value.status_code == 429
    with pytest.raises(HTTPException) as e:
        await server.codigo_para_clave(_yo("f3"))
    assert e.value.status_code == 400 and "oficina" in e.value.detail

    async def falla(*a, **k):
        return False
    monkeypatch.setattr(server, "_enviar_email", falla)
    with pytest.raises(HTTPException) as e:
        await server.codigo_para_clave(_yo("f2"))
    # El de la otra persona (f2) no se queda guardado si el correo no sale; el de f1 sigue vivo.
    assert e.value.status_code == 503 and all(c["driver_id"] != "f2" for c in base["driver_clave_codes"].docs)


@pytest.mark.asyncio(loop_scope="session")
async def test_el_codigo_solo_para_conductores_y_no_en_la_demo(base):
    with pytest.raises(HTTPException) as e:
        await server.codigo_para_clave({"sub": "a1", "role": "admin", "org_id": "o1"})
    assert e.value.status_code == 403
    with pytest.raises(HTTPException) as e:
        await server.codigo_para_clave({**_yo(), "demo": True})
    assert e.value.status_code == 403
