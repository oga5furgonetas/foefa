# -*- coding: utf-8 -*-
"""El enlace personal del conductor (14-11-2026, «una flota empieza sola en diez minutos»).

El dueño le manda a cada conductor, desde su WhatsApp, un enlace (`/c#<token>`) que le deja dentro de su portal con un
toque. Aquí hay una prueba por cada regla de seguridad del contrato (CONTRATO-ALTA.md §1), pensadas como un atacante:
el token en la base, atarlo al primer teléfono, el reenviado a otra persona, dos teléfonos a la vez, la fuerza bruta,
el 401 que no dice nada, renovar / quitar / dar de baja que cortan la sesión, una empresa contra otra, que no abre el
panel y que el token no aparece en ningún registro. Sin Mongo: base de mentira, y las rutas de verdad (`server.app`).
"""
import asyncio
import hashlib
import json
import logging
import re
import time
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

import server
from base_de_mentira import Col, Db

TEL_ANA = "a" * 43                      # el secreto del teléfono de Ana (lo crea su navegador: 32 bytes en base64url)
TEL_OTRO = "B-" + "b" * 41              # el de otra persona a la que le han reenviado el enlace
TEL_TERCERO = "c_" * 30


def _sha(x):
    return hashlib.sha256(x.encode()).hexdigest()


def _empresas():
    return [
        {"id": "orga", "name": "Transportes Pérez", "slug": "transportes-perez", "account_type": "dsp",
         "db_name": "dsp_orga", "status": "trial", "centers": ["PRINCIPAL"]},
        {"id": "orgb", "name": "Reparto Norte", "slug": "reparto-norte", "account_type": "dsp",
         "db_name": "dsp_orgb", "status": "active", "centers": ["NORTE", "SUR"]},
    ]


def montar_mundo(monkeypatch):
    """Dos empresas con sus bases. En las DOS hay una ficha con el id «d-ana» (los ids no se eligen, pero que no
    choquen no es lo que separa a una empresa de otra: es la base)."""
    bases = {}

    class Cliente(dict):
        def __getitem__(self, nombre):
            return bases.setdefault(nombre, Db())

    g = Db()
    g["organizations"] = Col(_empresas())
    g["admin_users"] = Col([
        {"id": "adm-a", "username": "perez", "name": "Transportes Pérez", "role": "admin", "org_id": "orga"},
        {"id": "adm-b", "username": "norte", "name": "Reparto Norte", "role": "admin", "org_id": "orgb"},
        {"id": "adm-b-norte", "username": "jefe-norte", "name": "Jefe Norte", "role": "admin", "org_id": "orgb",
         "allowed_centers": ["NORTE"]},
    ])
    a = bases.setdefault("dsp_orga", Db())
    a["drivers"] = Col([
        {"id": "d-ana", "name": "Ana López", "center": "PRINCIPAL", "active": True, "movil_personal": "+34612345678"},
        {"id": "d-luis", "name": "Luis Pérez", "center": "PRINCIPAL", "active": True, "email": "luis@ejemplo.es"},
        {"id": "d-rosa", "name": "Rosa M.", "center": "PRINCIPAL", "active": True},
        {"id": "d-pepe", "name": "Pepe de baja", "center": "PRINCIPAL", "active": False},
    ])
    b = bases.setdefault("dsp_orgb", Db())
    b["drivers"] = Col([
        {"id": "d-ana", "name": "ANA DE LA OTRA EMPRESA", "center": "NORTE", "active": True},
        {"id": "d-sur", "name": "Sergio Sur", "center": "SUR", "active": True},
        {"id": "d-sin", "name": "Sin Nave", "active": True},
    ])
    monkeypatch.setattr(server, "client", Cliente())
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "_ACCESO_ESPERA_FALLO", 0)
    # Dar de baja limpia también el correo personal del conductor (`_limpiar_correo_personal_conductor`, con
    # `find_one_and_delete`): la base de mentira ya lo tiene, así que se prueba de verdad, sin rodeos.
    for cache in (server._ACCESO_CACHE, server._ADMIN_EXISTS_CACHE, server._FICHA_ACTIVA_CACHE,
                  server._login_fails, server._public_actions, server._login_alerted):
        cache.clear()
    server.set_current_org_db(None)
    return SimpleNamespace(g=g, bases=bases, a=a, b=b)


@pytest.fixture
def mundo(monkeypatch):
    m = montar_mundo(monkeypatch)
    m.http = TestClient(server.app)
    yield m
    for cache in (server._ACCESO_CACHE, server._login_fails, server._public_actions):
        cache.clear()


def _sesion_admin(sub="adm-a", org="orga", **mas):
    return server.create_token(sub, "admin", "Transportes Pérez" if org == "orga" else "Reparto Norte",
                               org_id=org, db_name="dsp_" + org, account_type="dsp", **mas)


def _h(token):
    return {"Authorization": "Bearer " + token}


def _crear(m, driver_id="d-ana", admin=None, **cuerpo):
    return m.http.post(f"/api/conductores/{driver_id}/acceso", json=cuerpo, headers=_h(admin or _sesion_admin()))


def _canjear(m, token, dispositivo=TEL_ANA, ip="203.0.113.10"):
    return m.http.post("/api/auth/enlace", json={"token": token, "dispositivo": dispositivo},
                       headers={"X-Forwarded-For": ip})


def _mi_ficha(m, sesion):
    return m.http.get("/api/portal/mi-ficha", headers=_h(sesion))


def _enlace_abierto(m, driver_id="d-ana"):
    r = _crear(m, driver_id)
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    e = _canjear(m, token)
    assert e.status_code == 200, e.text
    return token, e.json()["access_token"]


# ── EL TOKEN Y LO QUE SE GUARDA ───────────────────────────────────────────────

def test_el_token_son_256_bits_en_hex_y_en_la_base_solo_estan_sus_hashes(mundo):
    r = _crear(mundo)
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store"
    cuerpo = r.json()
    token = cuerpo["token"]
    assert re.fullmatch(r"[0-9a-f]{64}", token)
    assert cuerpo["ruta"] == "/c#" + token
    assert cuerpo["driver_id"] == "d-ana" and cuerpo["nombre"] == "Ana López" and cuerpo["empresa"] == "Transportes Pérez"
    assert cuerpo["whatsapp"] == "34612345678" and cuerpo["renovado"] is False
    assert cuerpo["acceso"]["estado"] == "sin_abrir" and cuerpo["acceso"]["abierto_dia"] is None
    [doc] = mundo.g["accesos_conductor"].docs
    assert doc["token_hash"] == _sha(token) and doc["org_id"] == "orga" and doc["driver_id"] == "d-ana"
    assert doc["abierto_at"] is None and doc["dispositivo_hash"] is None and doc["ultimo_uso_at"] is None
    assert re.fullmatch(r"[0-9a-f]{32}", doc["id"])
    creado = datetime.fromisoformat(doc["creado_at"])
    assert datetime.fromisoformat(doc["caduca_at"]) - creado == timedelta(days=30)
    assert token not in json.dumps(doc)
    assert _canjear(mundo, token).status_code == 200
    guardado = json.dumps(mundo.g["accesos_conductor"].docs)
    assert token not in guardado and TEL_ANA not in guardado
    assert mundo.g["accesos_conductor"].docs[0]["dispositivo_hash"] == _sha(TEL_ANA)


def test_dos_enlaces_seguidos_no_se_parecen(mundo):
    uno = _crear(mundo, "d-ana").json()["token"]
    otro = _crear(mundo, "d-luis").json()["token"]
    assert uno != otro and len({uno, otro}) == 2


# ── ENTRAR ────────────────────────────────────────────────────────────────────

def test_entra_con_la_misma_sesion_que_el_codigo_por_correo_y_sin_elegir_contrasena(mundo):
    token = _crear(mundo).json()["token"]
    e = _canjear(mundo, token)
    assert e.status_code == 200 and e.headers["cache-control"] == "no-store"
    cuerpo = e.json()
    assert cuerpo == {"access_token": cuerpo["access_token"], "token_type": "bearer", "role": "driver",
                      "name": "Ana López", "id": "d-ana", "center": "PRINCIPAL", "configurar_cuenta": False,
                      "slug": "transportes-perez", "empresa": "Transportes Pérez", "email": None}
    enlace = server.decode_token(cuerpo["access_token"])
    # La del código por correo, de verdad (driver_code_verify), para la misma ficha con su correo.
    mundo.a["drivers"].docs[0]["email"] = "ana@ejemplo.es"
    codigo = "123456"
    ahora = datetime.now(timezone.utc)
    mundo.a["driver_login_codes"] = Col([{"_id": "c1", "driver_id": "d-ana", "email": "ana@ejemplo.es",
                                          "destination_email": "ana@ejemplo.es",
                                          "code_hash": _sha(f"{server.SECRET_KEY}:{codigo}"),
                                          "created_at": ahora, "expires_at": ahora + timedelta(minutes=10),
                                          "attempts": 0}])
    c = mundo.http.post("/api/auth/driver-code/verify",
                        json={"email": "ana@ejemplo.es", "code": codigo, "slug": "transportes-perez"})
    assert c.status_code == 200, c.text
    del mundo.a["drivers"].docs[0]["email"]
    por_codigo = server.decode_token(c.json()["access_token"])
    for k in ("sub", "role", "name", "org_id", "db_name", "account_type"):
        assert enlace[k] == por_codigo[k], k
    # Ni un permiso, ni un centro, ni nada más. Y SIN `at` (R12, 14-11-2026): la del enlace no cuenta como «recién
    # entrado» (la del código sí: con ella se puede elegir contraseña sin la actual nada más entrar).
    assert set(enlace) - {"lk"} == set(por_codigo) - {"at"} and "at" in por_codigo
    assert enlace["role"] == "driver" and "permissions" not in enlace and "allowed_centers" not in enlace
    assert enlace["lk"] == mundo.g["accesos_conductor"].docs[0]["id"] and enlace["via"] == "enlace"
    assert abs(enlace["exp"] - (time.time() + 30 * 86400)) < 120 and abs(enlace["exp"] - por_codigo["exp"]) < 120
    # Y el portal no le manda a «Elige tu contraseña».
    f = _mi_ficha(mundo, cuerpo["access_token"])
    assert f.status_code == 200 and f.json()["configurar_cuenta"] is False and f.json()["nombre"] == "Ana López"


def test_vuelve_a_entrar_con_el_mismo_telefono_las_veces_que_haga_falta(mundo):
    token, _ = _enlace_abierto(mundo)
    for _ in range(3):
        assert _canjear(mundo, token).status_code == 200
    doc = mundo.g["accesos_conductor"].docs[0]
    assert doc["ultimo_uso_at"] >= doc["abierto_at"]


def test_abierto_en_otro_telefono_409_sin_decir_de_quien_es(mundo):
    token, _ = _enlace_abierto(mundo)
    r = _canjear(mundo, token, dispositivo=TEL_OTRO, ip="198.51.100.20")
    assert r.status_code == 409 and r.headers["cache-control"] == "no-store"
    assert r.json() == {"detail": "Este enlace ya se abrió en otro teléfono o en otro navegador de este. Ábrelo donde "
                                  "lo abriste la primera vez o pide uno nuevo a tu empresa.",
                        "codigo": "enlace_usado_en_otro"}
    assert "Ana" not in r.text and "access_token" not in r.text
    # Y a la dueña de verdad le sigue valiendo.
    assert _canjear(mundo, token).status_code == 200


def test_sin_identificador_de_telefono_400_antes_de_mirar_nada(mundo):
    token = _crear(mundo).json()["token"]
    for malo in ("", "corto", "a" * 42, "a" * 129, "a" * 42 + "=", "ñ" * 50, 12345, None, ["a" * 43]):
        r = mundo.http.post("/api/auth/enlace", json={"token": token, "dispositivo": malo})
        assert r.status_code == 400 and r.json() == {"detail": "Falta el identificador de este teléfono. Vuelve a abrir el enlace.",
                                                     "codigo": "enlace_sin_telefono"}
    # Un cuerpo que no es JSON, o que no es un objeto, tampoco: 400, nunca un 422 que devuelva lo recibido ni un 500.
    for crudo in (b"token=" + token.encode() + b"&dispositivo=" + TEL_ANA.encode(), b"[1,2]", b"\"" + token.encode() + b"\""):
        r = mundo.http.post("/api/auth/enlace", content=crudo, headers={"Content-Type": "application/json"})
        assert r.status_code == 400 and token not in r.text
    assert mundo.g["accesos_conductor"].docs[0]["dispositivo_hash"] is None      # no se ha atado a nada


@pytest.mark.asyncio(loop_scope="session")
async def test_dos_telefonos_que_lo_abren_a_la_vez_solo_gana_uno(monkeypatch):
    mundo = montar_mundo(monkeypatch)
    server.set_current_org_db("dsp_orga")
    admin = {"sub": "adm-a", "name": "Transportes Pérez", "role": "admin", "org_id": "orga", "db_name": "dsp_orga",
             "account_type": "dsp"}
    creado = json.loads((await server.crear_acceso_conductor("d-ana", {}, admin)).body)
    token = creado["token"]

    class Peticion:
        def __init__(self, dispositivo, ip):
            self.cuerpo = {"token": token, "dispositivo": dispositivo}
            self.headers = {"x-forwarded-for": ip}
            self.client = SimpleNamespace(host=ip)

        async def json(self):
            await asyncio.sleep(0)
            return self.cuerpo

    async def toque(dispositivo, ip):
        try:
            r = await server.entrar_con_enlace(Peticion(dispositivo, ip))
            return 200, json.loads(r.body)
        except HTTPException as e:
            return e.status_code, e.detail

    for _ in range(5):                                  # cinco carreras, cada una con un enlace nuevo
        resultados = await asyncio.gather(toque(TEL_ANA, "203.0.113.1"), toque(TEL_OTRO, "203.0.113.2"))
        codigos = sorted(r[0] for r in resultados)
        assert codigos == [200, 409], resultados
        ganador = next(r for r in resultados if r[0] == 200)
        doc = mundo.g["accesos_conductor"].docs[0]
        tel = TEL_ANA if resultados[0][0] == 200 else TEL_OTRO
        assert doc["dispositivo_hash"] == _sha(tel) and ganador[1]["id"] == "d-ana"
        creado = json.loads((await server.crear_acceso_conductor("d-ana", {"renovar": True}, admin)).body)
        token = creado["token"]
        server._login_fails.clear()


# ── EL 401 QUE NO DICE NADA ───────────────────────────────────────────────────

def test_el_401_es_identico_para_todo_lo_que_no_vale(mundo):
    respuestas = {}

    def guarda(nombre, r):
        respuestas[nombre] = (r.status_code, r.content, r.headers.get("cache-control"), r.headers.get("content-type"))

    guarda("no existe", _canjear(mundo, "0" * 64, ip="192.0.2.1"))
    guarda("forma mala", _canjear(mundo, "XYZ" + "0" * 61, ip="192.0.2.2"))
    guarda("vacío", mundo.http.post("/api/auth/enlace", json={"dispositivo": TEL_ANA}))
    guarda("no es texto", mundo.http.post("/api/auth/enlace", json={"token": ["a" * 64], "dispositivo": TEL_ANA}))
    # Caducado: nunca abierto y pasados sus 30 días.
    caducado = _crear(mundo, "d-rosa").json()["token"]
    mundo.g["accesos_conductor"].docs[-1]["caduca_at"] = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
    guarda("caducado", _canjear(mundo, caducado, ip="192.0.2.3"))
    # Renovado: el viejo deja de existir.
    viejo = _crear(mundo, "d-ana").json()["token"]
    assert _crear(mundo, "d-ana").status_code == 200
    guarda("renovado", _canjear(mundo, viejo, ip="192.0.2.4"))
    # Quitado desde el panel.
    quitado = _crear(mundo, "d-luis").json()["token"]
    assert mundo.http.delete("/api/conductores/d-luis/acceso", headers=_h(_sesion_admin())).status_code == 200
    guarda("quitado", _canjear(mundo, quitado, ip="192.0.2.5"))
    # Ficha de baja sin que nadie borrase el enlace (la hoja de Google, una fusión).
    mundo.a["drivers"].docs.append({"id": "d-hoja", "name": "Hoja", "center": "PRINCIPAL", "active": True})
    de_baja = _crear(mundo, "d-hoja").json()["token"]
    mundo.a["drivers"].docs[-1]["active"] = False
    guarda("de baja", _canjear(mundo, de_baja, ip="192.0.2.6"))
    # Fusionada en otra.
    mundo.a["drivers"].docs.append({"id": "d-fus", "name": "Fusionada", "center": "PRINCIPAL", "active": True})
    fusionada = _crear(mundo, "d-fus").json()["token"]
    mundo.a["drivers"].docs[-1]["merged_into"] = "d-ana"
    guarda("fusionada", _canjear(mundo, fusionada, ip="192.0.2.7"))
    # La ficha ya no existe.
    mundo.a["drivers"].docs.append({"id": "d-borrada", "name": "Borrada", "center": "PRINCIPAL", "active": True})
    borrada = _crear(mundo, "d-borrada").json()["token"]
    mundo.a["drivers"].docs.pop()
    guarda("ficha inexistente", _canjear(mundo, borrada, ip="192.0.2.8"))
    # La oficina le quitó el acceso al portal.
    mundo.a["drivers"].docs.append({"id": "d-cuenta", "name": "Cuenta", "center": "PRINCIPAL", "active": True})
    cuenta = _crear(mundo, "d-cuenta").json()["token"]
    mundo.a["driver_accounts"] = Col([{"driver_id": "d-cuenta", "email": "c@x.es", "active": False}])
    guarda("cuenta quitada", _canjear(mundo, cuenta, ip="192.0.2.9"))
    # La empresa ya no está activa.
    de_ana = _crear(mundo, "d-ana").json()["token"]
    mundo.g["organizations"].docs[0]["status"] = "canceled"
    guarda("empresa no activa", _canjear(mundo, de_ana, ip="192.0.2.10"))
    assert len(respuestas) == 12
    unica = set(respuestas.values())
    assert len(unica) == 1, respuestas
    status, cuerpo, cache, tipo = unica.pop()
    assert status == 401 and json.loads(cuerpo) == {"detail": "Este enlace ya no vale. Pide uno nuevo a tu empresa.",
                                                    "codigo": "enlace_no_vale"}
    assert cache == "no-store"


def test_un_enlace_sin_abrir_caduca_a_los_30_dias_y_uno_abierto_ya_no(mundo):
    nunca = _crear(mundo, "d-rosa").json()["token"]
    abierto, _ = _enlace_abierto(mundo, "d-ana")
    pasado = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    for d in mundo.g["accesos_conductor"].docs:
        d["caduca_at"] = pasado
    assert _canjear(mundo, nunca, ip="192.0.2.30").status_code == 401
    assert _canjear(mundo, abierto).status_code == 200
    estados = {c["driver_id"]: c["acceso"] for c in
               mundo.http.get("/api/conductores/accesos", headers=_h(_sesion_admin())).json()["conductores"]}
    assert estados["d-rosa"]["estado"] == "caducado" and estados["d-ana"]["estado"] == "abierto"
    assert estados["d-ana"]["caduca_dia"] is None


# ── LÍMITE DE INTENTOS ────────────────────────────────────────────────────────

def test_cinco_fallos_con_otro_telefono_cierran_ese_enlace_cinco_minutos(mundo):
    token, _ = _enlace_abierto(mundo)
    for i in range(5):
        assert _canjear(mundo, token, dispositivo=TEL_OTRO, ip=f"198.51.100.{i + 1}").status_code == 409
    # Desde otra IP, otro teléfono más: ese enlace está cerrado un rato para los que no son el suyo (y lo dice como las
    # demás entradas). El teléfono bueno sigue entrando (14-11-2026, A4: los toques de otro no le dejan fuera).
    r = _canjear(mundo, token, dispositivo=TEL_TERCERO, ip="198.51.100.99")
    assert r.status_code == 429 and r.json() == {"detail": "Demasiados intentos fallidos. Espera 5 minutos.",
                                                 "codigo": "demasiados_intentos"}
    assert r.headers["cache-control"] == "no-store"
    assert _canjear(mundo, token, ip="198.51.100.99").status_code == 200
    # Los demás enlaces siguen abriendo.
    otro = _crear(mundo, "d-luis").json()["token"]
    assert _canjear(mundo, otro, dispositivo=TEL_TERCERO, ip="198.51.100.99").status_code == 200


def test_cincuenta_fallos_desde_una_ip_la_cierran_y_las_demas_siguen(mundo):
    bueno = _crear(mundo).json()["token"]
    for i in range(50):
        assert _canjear(mundo, "%064x" % i, ip="192.0.2.200").status_code == 401
    assert _canjear(mundo, "%064x" % 999, ip="192.0.2.200").status_code == 429
    assert _canjear(mundo, bueno, ip="192.0.2.200").status_code == 429         # ni con uno bueno
    assert _canjear(mundo, bueno, ip="192.0.2.201").status_code == 200


# ── RENOVAR, QUITAR Y DAR DE BAJA CORTAN LA SESIÓN ────────────────────────────

def test_renovar_pide_permiso_si_ya_se_abrio_y_corta_la_sesion_del_viejo(mundo):
    viejo, sesion = _enlace_abierto(mundo)
    assert _mi_ficha(mundo, sesion).status_code == 200
    r = _crear(mundo)
    assert r.status_code == 409 and r.json()["detail"] == {
        "codigo": "ya_abierto",
        "mensaje": "Ana López ya entra con su enlace desde su teléfono. Si lo renuevas, el anterior deja de valer y "
                   "tendrá que abrir el nuevo."}
    assert _mi_ficha(mundo, sesion).status_code == 200             # sin renovar, nada ha cambiado
    r = _crear(mundo, renovar=True)
    assert r.status_code == 200 and r.json()["renovado"] is True and r.json()["acceso"]["estado"] == "sin_abrir"
    nuevo = r.json()["token"]
    corta = _mi_ficha(mundo, sesion)
    assert corta.status_code == 401 and corta.json() == {
        "detail": "Este acceso ya no vale. Pide a tu empresa que te mande el enlace otra vez.", "codigo": "acceso_cambiado"}
    assert _canjear(mundo, viejo, ip="192.0.2.40").status_code == 401
    # El nuevo vale, en el mismo teléfono o en otro (renovar suelta el teléfono de antes).
    assert _canjear(mundo, nuevo, dispositivo=TEL_TERCERO).status_code == 200
    assert len(mundo.g["accesos_conductor"].docs) == 1


def test_sin_abrir_se_crea_otro_sin_preguntar_y_el_anterior_deja_de_valer(mundo):
    primero = _crear(mundo).json()["token"]
    r = _crear(mundo)
    assert r.status_code == 200 and r.json()["renovado"] is True
    assert _canjear(mundo, primero, ip="192.0.2.41").status_code == 401
    assert _canjear(mundo, r.json()["token"]).status_code == 200


def test_quitar_el_enlace_corta_la_sesion_y_se_puede_repetir(mundo):
    token, sesion = _enlace_abierto(mundo)
    for _ in range(2):
        r = mundo.http.delete("/api/conductores/d-ana/acceso", headers=_h(_sesion_admin()))
        assert r.status_code == 200 and r.json() == {"ok": True, "acceso": {"estado": "sin_enlace", "creado_dia": None,
                                                                           "abierto_dia": None, "abierto_hora": None, "caduca_dia": None}}
    assert _mi_ficha(mundo, sesion).status_code == 401
    assert _canjear(mundo, token, ip="192.0.2.42").status_code == 401
    assert mundo.g["accesos_conductor"].docs == []


def test_dar_de_baja_corta_la_sesion_y_reactivar_no_la_revive(mundo):
    token, sesion = _enlace_abierto(mundo)
    # Su correo personal de recuperación se va con la baja (find_one_and_delete); el de otro conductor se queda.
    mundo.a["driver_recovery_emails"] = Col([{"driver_id": "d-ana", "email_norm": "ana@personal.es"},
                                             {"driver_id": "d-rosa", "email_norm": "rosa@personal.es"}])
    assert mundo.http.delete("/api/drivers/d-ana", headers=_h(_sesion_admin())).status_code == 200
    assert [d["driver_id"] for d in mundo.a["driver_recovery_emails"].docs] == ["d-rosa"]
    assert mundo.g["accesos_conductor"].docs == []
    assert _mi_ficha(mundo, sesion).status_code == 401
    assert mundo.http.patch("/api/drivers/d-ana", json={"active": True}, headers=_h(_sesion_admin())).status_code == 200
    assert mundo.a["drivers"].docs[0]["active"] is True
    assert _mi_ficha(mundo, sesion).status_code == 401
    assert _canjear(mundo, token, ip="192.0.2.43").status_code == 401
    # Con el PATCH que da de baja, lo mismo.
    token2, sesion2 = _enlace_abierto(mundo, "d-luis")
    assert mundo.http.patch("/api/drivers/d-luis", json={"active": False}, headers=_h(_sesion_admin())).status_code == 200
    assert mundo.g["accesos_conductor"].docs == []
    assert _mi_ficha(mundo, sesion2).status_code == 401
    assert _canjear(mundo, token2, ip="192.0.2.44").status_code == 401


def test_la_baja_que_no_borra_el_enlace_corta_la_sesion_en_cuanto_caduca_la_cache(mundo):
    """La hoja de Google o una fusión ponen la ficha de baja sin pasar por el panel: el enlace sigue en la base, pero su
    sesión deja de valer en 60 s como mucho (la caché de cada proceso)."""
    _, sesion = _enlace_abierto(mundo)
    assert _mi_ficha(mundo, sesion).status_code == 200
    mundo.a["drivers"].docs[0]["active"] = False
    lk = server.decode_token(sesion)["lk"]
    assert server._ACCESO_CACHE[lk][0] - time.time() <= server._ACCESO_TTL
    server._ACCESO_CACHE[lk] = (time.time() - 1,) + server._ACCESO_CACHE[lk][1:]        # pasan los 60 s
    assert _mi_ficha(mundo, sesion).status_code == 401


def test_una_sesion_sin_enlace_no_mira_la_base_de_enlaces(mundo, monkeypatch):
    async def no_tocar(*a, **k):
        raise AssertionError("una sesión sin `lk` ha mirado los enlaces")
    monkeypatch.setattr(mundo.g["accesos_conductor"], "find_one", no_tocar)
    sesion = server.create_token("d-ana", "driver", "Ana López", org_id="orga", db_name="dsp_orga",
                                 account_type="dsp", entrada=time.time())
    assert _mi_ficha(mundo, sesion).status_code == 200


def test_renovar_la_sesion_del_enlace_vale_sin_cuenta_y_se_niega_con_el_enlace_muerto(mundo):
    _, sesion = _enlace_abierto(mundo)
    antes = server.decode_token(sesion)
    assert not mundo.a["driver_accounts"].docs                     # ni correo ni cuenta: solo su enlace
    r = mundo.http.post("/api/auth/renovar", headers=_h(sesion))
    assert r.status_code == 200 and r.json()["configurar_cuenta"] is False and r.json()["id"] == "d-ana"
    nueva = server.decode_token(r.json()["access_token"])
    assert (nueva["lk"], nueva["via"], nueva["org_id"], nueva["db_name"]) == (antes["lk"], "enlace", "orga", "dsp_orga")
    assert "at" not in antes and "at" not in nueva              # nunca «recién entrado» (R12)
    assert mundo.http.delete("/api/conductores/d-ana/acceso", headers=_h(_sesion_admin())).status_code == 200
    assert mundo.http.post("/api/auth/renovar", headers=_h(r.json()["access_token"])).status_code == 401
    # Y sin pasar por la caché: la ruta vuelve a mirar el enlace.
    server._ACCESO_CACHE.clear()
    sesion_muerta = server.create_token("d-ana", "driver", "Ana López", org_id="orga", db_name="dsp_orga",
                                        account_type="dsp", entrada=time.time(), enlace="0" * 32, via="enlace")
    assert mundo.http.post("/api/auth/renovar", headers=_h(sesion_muerta)).status_code == 401


# ── NO ES MÁS QUE EL CONDUCTOR DE HOY ─────────────────────────────────────────

def test_la_sesion_del_enlace_no_abre_el_panel(mundo):
    _, sesion = _enlace_abierto(mundo)
    for metodo, ruta in (("get", "/api/conductores/accesos"), ("post", "/api/conductores/d-luis/acceso"),
                         ("get", "/api/alta/estado"), ("delete", "/api/drivers/d-luis")):
        r = getattr(mundo.http, metodo)(ruta, headers=_h(sesion))
        assert r.status_code == 403 and r.json() == {"detail": "Acceso restringido a administradores"}, ruta


def test_el_enlace_de_una_empresa_no_entra_en_otra(mundo):
    adm_b = _sesion_admin("adm-b", "orgb")
    # La ficha de A no existe para el admin de B (su «d-ana» es otra persona, de su base).
    creado_b = _crear(mundo, "d-ana", admin=adm_b)
    assert creado_b.status_code == 200 and creado_b.json()["nombre"] == "ANA DE LA OTRA EMPRESA"
    assert _crear(mundo, "d-luis", admin=adm_b).status_code == 404
    assert _crear(mundo, "d-luis", admin=adm_b).json() == {"detail": "Conductor no encontrado",
                                                           "codigo": "conductor_no_encontrado"}
    assert mundo.http.delete("/api/conductores/d-luis/acceso", headers=_h(adm_b)).status_code == 404
    # El de A lleva a la base de A, aunque en B haya una ficha con el mismo id.
    token_a, sesion_a = _enlace_abierto(mundo, "d-ana")
    p = server.decode_token(sesion_a)
    assert (p["org_id"], p["db_name"]) == ("orga", "dsp_orga")
    assert _mi_ficha(mundo, sesion_a).json()["nombre"] == "Ana López"
    # Quitar el de B no toca el de A, y al revés.
    assert mundo.http.delete("/api/conductores/d-ana/acceso", headers=_h(adm_b)).status_code == 200
    assert _mi_ficha(mundo, sesion_a).status_code == 200
    assert {(d["org_id"], d["driver_id"]) for d in mundo.g["accesos_conductor"].docs} == {("orga", "d-ana")}
    # B no ve los de A en su lista.
    lista_b = mundo.http.get("/api/conductores/accesos", headers=_h(adm_b)).json()
    assert lista_b["empresa"] == "Reparto Norte" and "Ana López" not in json.dumps(lista_b)


def test_la_plataforma_mirando_la_cuenta_no_crea_enlaces(mundo):
    r = _crear(mundo, admin=_sesion_admin(suplantado=True))
    assert r.status_code == 403 and r.json() == {"detail": server._SOLO_EL_CLIENTE, "codigo": "solo_el_cliente"}
    assert mundo.g["accesos_conductor"].docs == []


def test_con_centros_asignados_solo_los_suyos_y_los_sin_centro_no_cuentan(mundo):
    jefe = _sesion_admin("adm-b-norte", "orgb")
    assert _crear(mundo, "d-ana", admin=jefe).status_code == 200                       # NORTE
    for ajeno in ("d-sur", "d-sin"):                                                  # SUR y sin centro
        r = _crear(mundo, ajeno, admin=jefe)
        assert r.status_code == 403 and r.json() == {"detail": "No tienes acceso a ese centro",
                                                     "codigo": "centro_no_visible"}, ajeno
        assert mundo.http.delete(f"/api/conductores/{ajeno}/acceso", headers=_h(jefe)).status_code == 403
    lista = mundo.http.get("/api/conductores/accesos", headers=_h(jefe)).json()
    assert [c["driver_id"] for c in lista["conductores"]] == ["d-ana"]
    assert mundo.http.get("/api/conductores/accesos?center=SUR", headers=_h(jefe)).status_code == 403
    # Quien no tiene centros asignados los ve todos.
    todos = mundo.http.get("/api/conductores/accesos", headers=_h(_sesion_admin("adm-b", "orgb"))).json()
    assert sorted(c["driver_id"] for c in todos["conductores"]) == ["d-ana", "d-sin", "d-sur"]


def test_de_baja_o_sin_acceso_al_portal_no_se_le_crea_enlace(mundo):
    r = _crear(mundo, "d-pepe")
    assert r.status_code == 409 and r.json()["detail"] == {
        "codigo": "de_baja", "mensaje": "Pepe de baja está de baja. Reactívala antes de mandarle su acceso."}
    mundo.a["driver_accounts"] = Col([{"driver_id": "d-luis", "email": "luis@ejemplo.es", "active": False}])
    r = _crear(mundo, "d-luis")
    assert r.status_code == 409 and r.json()["detail"] == {
        "codigo": "acceso_quitado",
        "mensaje": "A Luis Pérez le quitaron el acceso al portal. Vuelve a dárselo en su ficha y después mándale el enlace."}
    assert _crear(mundo, "no-existe").status_code == 404
    assert mundo.g["accesos_conductor"].docs == []


def test_la_lista_de_accesos_dice_el_estado_de_cada_uno_y_ningun_secreto(mundo):
    sin_abrir = _crear(mundo, "d-luis").json()["token"]
    abierto, _ = _enlace_abierto(mundo, "d-ana")
    r = mundo.http.get("/api/conductores/accesos", headers=_h(_sesion_admin()))
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["empresa"] == "Transportes Pérez"
    assert [c["nombre"] for c in cuerpo["conductores"]] == ["Ana López", "Luis Pérez", "Rosa M."]   # sin el de baja
    hoy = datetime.now(ZoneInfo("Europe/Madrid")).strftime("%Y-%m-%d")       # el día de la empresa, no el de UTC
    ana, luis, rosa = cuerpo["conductores"]
    assert ana == {"driver_id": "d-ana", "nombre": "Ana López", "center": "PRINCIPAL", "movil": "+34612345678",
                   "whatsapp": "34612345678", "email": None, "acceso": ana["acceso"]}
    assert ana["acceso"]["estado"] == "abierto" and ana["acceso"]["abierto_dia"] and ana["acceso"]["caduca_dia"] is None
    assert ana["acceso"]["abierto_dia"] == ana["acceso"]["creado_dia"] == hoy
    assert luis["acceso"]["estado"] == "sin_abrir" and luis["email"] == "luis@ejemplo.es" and luis["whatsapp"] is None
    assert luis["acceso"]["caduca_dia"] > luis["acceso"]["creado_dia"]
    assert rosa["acceso"] == {"estado": "sin_enlace", "creado_dia": None, "abierto_dia": None, "abierto_hora": None, "caduca_dia": None}
    assert cuerpo["cuentas"] == {"sin_enlace": 1, "sin_abrir": 1, "abierto": 1, "caducado": 0}
    for secreto in (sin_abrir, abierto, _sha(sin_abrir), _sha(abierto), _sha(TEL_ANA), "token_hash", "dispositivo"):
        assert secreto not in r.text


# ── EL TOKEN NO SALE EN NINGÚN REGISTRO ───────────────────────────────────────

def test_el_token_no_aparece_en_registros_ni_en_respuestas_de_error(mundo, caplog):
    caplog.set_level(logging.DEBUG)
    token, sesion = _enlace_abierto(mundo)
    respuestas = [_canjear(mundo, token, dispositivo=TEL_OTRO, ip="198.51.100.50") for _ in range(6)]   # 409 y 429
    respuestas.append(_canjear(mundo, token[:-1] + ("0" if token[-1] != "0" else "1"), ip="198.51.100.51"))
    respuestas.append(mundo.http.post("/api/auth/enlace", json={"token": token + "x", "dispositivo": TEL_ANA}))
    respuestas.append(mundo.http.post("/api/auth/enlace", json=[token, TEL_ANA]))
    respuestas.append(mundo.http.post("/api/auth/enlace", content=("{\"token\": \"%s\"" % token).encode()))
    respuestas.append(mundo.http.post("/api/auth/renovar", headers=_h(sesion)))
    nuevo = _crear(mundo, renovar=True).json()["token"]
    assert {r.status_code for r in respuestas} >= {409, 429, 401, 400}
    for r in respuestas:
        assert token not in r.text and TEL_OTRO not in r.text
    texto_registro = caplog.text
    for secreto in (token, nuevo, TEL_ANA, TEL_OTRO):
        assert secreto not in texto_registro
    # Ni en el registro de auditoría ni en el de escrituras (lo que se apunta de cada petición).
    for col in ("audit_log", "audit_requests"):
        volcado = json.dumps(mundo.g[col].docs, default=str)
        assert token not in volcado and nuevo not in volcado
    assert any(d.get("action") == "acceso_conductor" for d in mundo.g["audit_log"].docs)


# ── LA ENTRADA DE SIEMPRE ─────────────────────────────────────────────────────

def test_el_codigo_por_correo_no_obliga_a_elegir_contrasena_y_la_inicial_si(mundo):
    ahora = datetime.now(timezone.utc)
    mundo.a["driver_login_codes"] = Col([{"_id": "c1", "driver_id": "d-luis", "email": "luis@ejemplo.es",
                                          "destination_email": "luis@ejemplo.es",
                                          "code_hash": _sha(f"{server.SECRET_KEY}:654321"),
                                          "created_at": ahora, "expires_at": ahora + timedelta(minutes=10),
                                          "attempts": 0}])
    # Con una temporal vigente puesta por la oficina: antes, el código le mandaba a «Elige tu contraseña».
    inicial = server.hash_password("inicial-de-la-empresa")
    mundo.a["driver_accounts"] = Col([{"id": "acc", "driver_id": "d-luis", "email": "luis@ejemplo.es",
                                       "hashed_password": inicial, "active": True, "must_change_password": True,
                                       "password_temp_created_at": ahora.isoformat(), "contrasena_inicial": True}])
    assert server._temporal_vigente_de(mundo.a["driver_accounts"].docs)
    # Con la contraseña inicial compartida de la empresa sigue obligado a elegir la suya, como hoy.
    c = mundo.http.post("/api/auth/driver-login", json={"email": "luis@ejemplo.es", "password": "inicial-de-la-empresa"})
    assert c.status_code == 200 and c.json()["configurar_cuenta"] is True
    clave = c.json()["access_token"]
    assert "via" not in server.decode_token(clave)
    assert _mi_ficha(mundo, clave).json()["configurar_cuenta"] is True
    r = mundo.http.post("/api/auth/driver-code/verify",
                        json={"email": "luis@ejemplo.es", "code": "654321", "slug": "transportes-perez"})
    assert r.status_code == 200 and r.json()["configurar_cuenta"] is False
    sesion = r.json()["access_token"]
    assert server.decode_token(sesion)["via"] == "codigo" and "lk" not in server.decode_token(sesion)
    assert _mi_ficha(mundo, sesion).json()["configurar_cuenta"] is False
    # Y desde que entró con el código, la inicial (la de todos) ya no le abre la cuenta (A2, 14-11-2026; el detalle, en
    # test_acceso_arreglos_enlace.py).
    c = mundo.http.post("/api/auth/driver-login", json={"email": "luis@ejemplo.es", "password": "inicial-de-la-empresa"},
                        headers={"X-Forwarded-For": "203.0.113.90"})
    assert c.status_code == 401 and c.json()["detail"] == "Email o contraseña incorrectos"
