# -*- coding: utf-8 -*-
"""Tanda 3, zona «seguridad» (11-11-2026): S3, S2 y S1 (partes 1 y 2).

S3 · La inspección del portal web que entró con contraseña mandaba `driver_id` "undefined": el anti-duplicado del día
     no la encontraba y un reintento creaba una SEGUNDA inspección. Para un conductor se busca con la ficha del token.
S2 · Oficina («DNR por conductor») y «Mis DNR» reparten cada ID con el mismo ayudante (_reparto_ids): una ficha de baja
     nunca le quita el ID a una viva (ni en `driver_id`, ni a una ficha sin el campo `active` en `transporter_id`).
S1 · «Es otra persona con el mismo correo»: al dar de alta con `?nueva=true`, o con «No es la misma persona» en
     «Fichas duplicadas» (POST /drivers/separar), las fichas de baja con ese correo se quedan sin él (y sus cuentas,
     desactivadas): Juan, que se fue, deja de entrar como Pedro por su token, su contraseña o la renovación de la app.

Con la base de mentira (base_de_mentira.py), sin MongoDB. Nombres, correos y códigos inventados.
"""
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

import server
import test_tanda2_dnr as T
from base_de_mentira import Col, Cursor, Db


# ══════════════════════════════════════════════════════════════════════════ S3

class _Fichero:
    """Un UploadFile vacío: si se llega a leer las fotos, la ruta contesta 400 («No llegó ninguna foto entera»)."""
    filename = "frontal.jpg"

    async def read(self):
        return b""


@pytest.fixture
def insp(monkeypatch):
    tenant = Db()
    tenant["drivers"] = Col([{"id": "d1", "name": "ANA", "email": "ana@x.test", "center": "OGA5", "active": True}])
    tenant["vehicles"] = Col([{"id": "v1", "center": "OGA5", "status": "active"}])
    tenant["inspections"] = Col([])
    tenant["daily_assignments"] = Col([])
    monkeypatch.setattr(server, "db", tenant)
    return tenant


def _inspeccion_de_hoy(tenant, driver_id="d1", vehicle_id="v1"):
    tenant["inspections"].docs.append({"id": "i-1", "vehicle_id": vehicle_id, "driver_id": driver_id,
                                       "created_at": datetime.now(timezone.utc).isoformat()})


async def _subir(driver_id, user):
    return await server.upload_inspection_photos(vehicle_id="v1", driver_id=driver_id, notes="",
                                                 files=[_Fichero()], user=user)


CONDUCTORA = {"sub": "d1", "role": "driver", "name": "ANA"}


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("mandado", ["undefined", "d-otro", None, "d1"])
async def test_s3_el_reenvio_del_dia_da_409_mande_lo_que_mande_el_formulario(insp, mandado):
    """El portal que entró con contraseña mandaba "undefined" (y una web vieja en caché lo seguirá mandando): 409 igual,
    antes de tocar ninguna foto."""
    _inspeccion_de_hoy(insp)
    with pytest.raises(HTTPException) as e:
        await _subir(mandado, CONDUCTORA)
    assert e.value.status_code == 409 and "Ya enviaste" in e.value.detail


@pytest.mark.asyncio(loop_scope="session")
async def test_s3_sin_inspeccion_de_hoy_sigue_adelante(insp):
    """La de OTRO conductor en la misma furgoneta no cuenta, aunque el formulario mande su id: sigue y llega a las fotos."""
    _inspeccion_de_hoy(insp, driver_id="d-otro")
    with pytest.raises(HTTPException) as e:
        await _subir("d-otro", CONDUCTORA)
    assert e.value.status_code == 400 and "foto" in e.value.detail


@pytest.mark.asyncio(loop_scope="session")
async def test_s3_el_admin_puede_repetir_como_hoy(insp):
    _inspeccion_de_hoy(insp)
    with pytest.raises(HTTPException) as e:
        await _subir("d1", {"sub": "a1", "role": "admin", "name": "Dani"})
    assert e.value.status_code == 400                       # llega a las fotos: sin 409


# ══════════════════════════════════════════════════════════════════════════ S2

@pytest.fixture
def dnr(monkeypatch):
    tenant = T._base_de_ana()
    tenant["drivers"].docs += [
        # Dora: ficha vieja de baja y ficha activa, el MISMO ID solo en `driver_id` (la de baja sale antes).
        {"id": "d-dora-baja", "name": "DORA VIEJA", "email": "dora.vieja@x.test", "center": "OGA5",
         "active": False, "driver_id": "ADORA00001"},
        {"id": "d-dora", "name": "DORA BUENA", "email": "dora@x.test", "center": "OGA5",
         "active": True, "driver_id": "ADORA00001"},
        # Xan: ficha SIN el campo `active` (cuenta como activa) y otra de baja con su ID en `transporter_id`.
        {"id": "d-xan", "name": "XAN SIN ACTIVE", "email": "xan@x.test", "center": "OGA5",
         "transporter_id": "AXAN000001"},
        {"id": "d-xan-baja", "name": "XAN BAJA", "email": "xan.viejo@x.test", "center": "OGA5",
         "active": False, "transporter_id": "AXAN000001"},
    ]
    tenant["dnr_rows"].docs += [T._fila("TBDORA100", "ADORA00001", "2026-11-09", "Y"),
                                T._fila("TBXAN0100", "AXAN000001", "2026-11-09", "Y")]
    g = T._Db()
    g["organizations"] = T._organizaciones()
    monkeypatch.setattr(server, "db", tenant)
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "_dia_negocio", lambda: T.HOY)
    return tenant


async def _oficina_oga5():
    r = await server.diarios_por_conductor("OGA5", "2026-10-18", "2026-11-14", T.DANI)
    return {c["transporter_id"]: c for c in r["conductores"]}


@pytest.mark.asyncio(loop_scope="session")
async def test_s2_una_de_baja_no_le_quita_el_driver_id_a_la_activa(dnr):
    c = (await _oficina_oga5())["ADORA00001"]
    assert (c["driver_id"], c["driver_name"], c["de_baja"]) == ("d-dora", "DORA BUENA", False)
    r = await server.mis_dnr(T._conductor("d-dora"))
    assert r["en_revision"] is False and T._paquetes(r) == {"TBDORA100"}


@pytest.mark.asyncio(loop_scope="session")
async def test_s2_una_de_baja_no_pisa_a_una_ficha_sin_active_en_transporter_id(dnr):
    c = (await _oficina_oga5())["AXAN000001"]
    assert (c["driver_id"], c["de_baja"]) == ("d-xan", False)
    r = await server.mis_dnr(T._conductor("d-xan"))
    assert r["en_revision"] is False and T._paquetes(r) == {"TBXAN0100"}


@pytest.mark.asyncio(loop_scope="session")
async def test_s2_oficina_y_mis_dnr_siguen_diciendo_lo_mismo(dnr):
    """Lo que ve cada persona es exactamente lo que la oficina pone a su ficha (y a sus fusionadas), con los casos nuevos
    y los de siempre (Paco: el mismo ID en `transporter_id` en una de baja y una activa, manda la activa)."""
    oficina = await T._de_la_oficina()
    assert "TBPACO100" in oficina["d-paco"]
    await T._como_la_oficina(oficina, {"d-dora": {"d-dora"}, "d-xan": {"d-xan"}, "d-paco": {"d-paco"},
                                       "d-ana": {"d-ana", "d-ana-vieja"}, "d-luis": {"d-luis"}, "d-eva": {"d-eva"}})


def test_s2_el_reparto_en_los_casos_limite():
    viva = lambda fid, **m: {"id": fid, "active": True, **m}            # noqa: E731
    baja = lambda fid, **m: {"id": fid, "active": False, **m}           # noqa: E731
    # Dos vivas con el mismo ID solo en `driver_id`: la primera leída, como siempre.
    assert server._reparto_ids([], [viva("a", driver_id="X1"), viva("b", driver_id="x1 ")])["X1"]["id"] == "a"
    # Una de baja con el ID en `transporter_id` frente a una viva en `driver_id`: la de baja (R8, no cambia).
    r = server._reparto_ids([baja("b", transporter_id="X1")], [viva("a", driver_id="X1")])
    assert r["X1"]["id"] == "b"
    # Dos de baja en `transporter_id`: la última leída; dos vivas: la última leída (como siempre).
    assert server._reparto_ids([baja("a", transporter_id="X1"), baja("b", transporter_id="X1")], [])["X1"]["id"] == "b"
    assert server._reparto_ids([viva("a", transporter_id="X1"), viva("b", transporter_id="X1")], [])["X1"]["id"] == "b"
    # Una fusionada (de baja) no pisa a la viva; una viva sí pisa a la de baja.
    assert server._reparto_ids([viva("a", transporter_id="X1"), baja("f", transporter_id="X1", merged_into="a")],
                               [])["X1"]["id"] == "a"
    assert server._reparto_ids([baja("b", transporter_id="X1"), viva("a", transporter_id="X1")], [])["X1"]["id"] == "a"
    # En `driver_id`, una viva leída después le gana a la de baja leída antes; dos de baja, la primera.
    assert server._reparto_ids([], [baja("b", driver_id="X1"), viva("a", driver_id="X1")])["X1"]["id"] == "a"
    assert server._reparto_ids([], [baja("b", driver_id="X1"), baja("c", driver_id="X1")])["X1"]["id"] == "b"


# ══════════════════════════════════════════════════════════════════════════ S1

CORREO = "repartos3@empresa.test"
ADMIN = {"sub": "a1", "role": "admin", "name": "Dani", "org_id": "o1", "account_type": "dsp"}


class _ColAgregable(Col):
    """drivers_duplicados cuenta con `aggregate`; aquí no hay inspecciones ni turnos: nada."""

    def aggregate(self, pipeline, **_):
        return Cursor([])


@pytest.fixture
def s1(monkeypatch):
    tenant = Db()
    tenant["drivers"] = Col([
        {"id": "d-juan", "name": "JUAN", "email": CORREO, "center": "OGA5", "active": False,
         "created_at": "2026-05-01"},
        # Una ficha vieja del propio Juan, fusionada en la suya (misma persona que Juan).
        {"id": "d-juan-vieja", "name": "JUAN", "email": CORREO, "center": "OGA5", "active": False,
         "status": "fusionada", "merged_into": "d-juan", "created_at": "2026-01-01"},
        # Luis: activo, con OTRO correo en la ficha, pero su cuenta se quedó con el de Juan (el correo de la ficha se
        # cambió después). Es una persona viva: su cuenta no se toca nunca.
        {"id": "d-luis", "name": "LUIS", "email": "luis@empresa.test", "center": "OGA5", "active": True,
         "created_at": "2026-03-01"},
    ])
    tenant["driver_accounts"] = Col([
        {"id": "c-juan", "driver_id": "d-juan", "email": CORREO, "hashed_password": server.hash_password("clave-de-juan"),
         "active": True, "password_changed_at": "2026-06-01T00:00:00+00:00", "created_at": "2026-05-01"},
        {"id": "c-luis", "driver_id": "d-luis", "email": CORREO.upper(),
         "hashed_password": server.hash_password("clave-de-luis"), "active": True, "created_at": "2026-03-01"},
    ])
    tenant["driver_recovery_emails"] = Col([])
    for col in ("inspections", "shifts", "shift_requests", "daily_assignments"):
        tenant[col] = _ColAgregable([])
    g = Db()
    g["organizations"] = Col([{"id": "o1", "slug": "oga5", "name": "E", "account_type": "dsp",
                               "db_name": "dsp_o1", "status": "active", "centers": ["OGA5"]}])
    g["admin_users"] = Col([])
    g["audit_log"] = Col([])
    monkeypatch.setattr(server, "db", tenant)
    monkeypatch.setattr(server, "global_db", g)

    class _Cliente(dict):
        def __missing__(self, n):
            self[n] = Db()
            return self[n]
    monkeypatch.setattr(server, "client", _Cliente({"dsp_o1": tenant}))

    async def org(oid):
        return await g["organizations"].find_one({"id": oid}, {"_id": 0})
    monkeypatch.setattr(server, "get_org", org)
    server._login_fails.clear()
    server._FICHA_ACTIVA_CACHE.clear()
    yield tenant
    server._FICHA_ACTIVA_CACHE.clear()


def _req(path="/api/portal/mi-ficha", method="GET"):
    return SimpleNamespace(method=method, url=SimpleNamespace(path=path), headers={},
                           client=SimpleNamespace(host="10.0.0.9"))


def _ficha(tenant, fid):
    return next(f for f in tenant["drivers"].docs if f["id"] == fid)


def _cuenta(tenant, cid):
    return next(c for c in tenant["driver_accounts"].docs if c["id"] == cid)


async def _alta_pedro(nueva=True, otra_persona=True, admin=ADMIN):
    # Revisión P13 (11-11-2026): ceder el correo pide las DOS señales del panel nuevo (`nueva` y `otra_persona`).
    return await server.create_driver(
        server.DriverCreate(name="Pedro", email="Repartos3@Empresa.test", center="OGA5", password="clave-de-pedro"),
        nueva=nueva, admin=admin, otra_persona=otra_persona)


async def _login(clave, correo=CORREO):
    return await server.driver_login(server.DriverLoginRequest(email=correo, password=clave),
                                      _req("/api/auth/driver-login", "POST"))


async def _sub_del_token_de(fid):
    tok = server.create_token(fid, "driver", fid, org_id="o1", db_name="dsp_o1", account_type="dsp")
    return await server.get_current_user(_req(), HTTPAuthorizationCredentials(scheme="Bearer", credentials=tok))


@pytest.mark.asyncio(loop_scope="session")
async def test_s1_sin_nueva_sigue_el_409_de_reactivar_y_no_toca_nada(s1):
    antes = [dict(f) for f in s1["drivers"].docs], [dict(c) for c in s1["driver_accounts"].docs]
    with pytest.raises(HTTPException) as e:
        await _alta_pedro(nueva=False)
    assert e.value.status_code == 409 and e.value.detail["reactivar_id"] == "d-juan"
    assert ([dict(f) for f in s1["drivers"].docs], [dict(c) for c in s1["driver_accounts"].docs]) == antes


@pytest.mark.asyncio(loop_scope="session")
async def test_s1_alta_otra_persona_cierra_todos_los_caminos_de_juan(s1):
    pedro = await _alta_pedro()
    # Las fichas de Juan (y su fusionada) se quedan sin correo, con el correo guardado para la historia.
    for fid in ("d-juan", "d-juan-vieja"):
        f = _ficha(s1, fid)
        assert "email" not in f and f["correo_cedido"]["email"] == CORREO and f["correo_cedido"]["a"] == pedro.id
        assert f["active"] is False
    # Su cuenta, desactivada y sin correo; la de Luis (ficha activa) intacta, con el correo que tenía.
    cj = _cuenta(s1, "c-juan")
    assert cj["active"] is False and "email" not in cj and cj["correo_cedido"]
    cl = _cuenta(s1, "c-luis")
    assert cl["active"] is True and cl["email"] == CORREO.upper() and "correo_cedido" not in cl
    # Pedro: ficha con su correo y su cuenta nueva, que no se ha tocado.
    assert _ficha(s1, pedro.id)["email"] == "Repartos3@Empresa.test"
    cp = next(c for c in s1["driver_accounts"].docs if c["driver_id"] == pedro.id)
    assert cp["active"] is True and cp["email"] == "Repartos3@Empresa.test"
    # El token vivo de Juan se queda en SU ficha (antes saltaba a la de Pedro).
    assert await server._ficha_activa_de("d-juan") == "d-juan"
    assert (await _sub_del_token_de("d-juan"))["sub"] == "d-juan"
    # La renovación de la app de Android: 401 (su ficha está de baja), nunca un token de Pedro.
    with pytest.raises(HTTPException) as e:
        await server.renovar_sesion({"sub": "d-juan", "role": "driver", "org_id": "o1"}, _req("/api/auth/renovar", "POST"))
    assert e.value.status_code == 401
    # Con la contraseña de Juan no se entra (ni por el correo ni como Pedro).
    with pytest.raises(HTTPException) as e:
        await _login("clave-de-juan")
    assert e.value.status_code in (401, 403)
    # Pedro entra con la suya, como Pedro.
    s = await _login("clave-de-pedro")
    assert s.id == pedro.id and s.name == "Pedro"
    # Ya no son «la misma persona»: ni en la furgoneta ni en «Fichas duplicadas».
    ids, _ = await server._fichas_misma_persona(_ficha(s1, pedro.id))
    assert ids == {pedro.id}
    assert (await server.drivers_duplicados(ADMIN))["grupos"] == []
    # Y queda apuntado quién lo hizo.
    assert [a["action"] for a in server.global_db.audit_log.docs] == ["driver_correo_cedido"]


@pytest.mark.asyncio(loop_scope="session")
async def test_s1_alta_nueva_sin_fichas_de_baja_es_como_hoy(s1):
    """`?nueva=true` con un correo que ninguna ficha de baja tiene: el alta de siempre, sin ceder nada."""
    s1["drivers"].docs = [f for f in s1["drivers"].docs if f["id"] == "d-luis"]
    s1["driver_accounts"].docs = [c for c in s1["driver_accounts"].docs if c["id"] == "c-luis"]
    pedro = await _alta_pedro()
    assert _cuenta(s1, "c-luis")["active"] is True and _cuenta(s1, "c-luis")["email"] == CORREO.upper()
    assert all("correo_cedido" not in f for f in s1["drivers"].docs)
    assert server.global_db.audit_log.docs == []
    assert (await _login("clave-de-pedro")).id == pedro.id


# ── POST /drivers/separar: las parejas que ya existen ──────────────────────────

@pytest.fixture
def pareja(s1):
    """Pedro (activo) con el correo de Juan (de baja) y de Juana (de baja, otra ficha): como están hoy en producción."""
    s1["drivers"].docs += [
        {"id": "d-pedro", "name": "PEDRO", "email": CORREO.upper(), "center": "OGA5", "active": True,
         "created_at": "2026-11-01"},
        {"id": "d-juana", "name": "JUANA", "email": CORREO, "center": "OGA5", "active": False,
         "created_at": "2026-04-01"},
    ]
    s1["driver_accounts"].docs.append(
        {"id": "c-pedro", "driver_id": "d-pedro", "email": CORREO, "hashed_password": server.hash_password("clave-de-pedro"),
         "active": True, "password_changed_at": "2026-11-02T00:00:00+00:00", "created_at": "2026-11-01"})
    return s1


@pytest.mark.asyncio(loop_scope="session")
async def test_s1_hoy_juan_entra_como_pedro_hasta_que_se_separan(pareja):
    """Lo de hoy (sin tocar nada): el token de Juan lleva a Pedro y «Fichas duplicadas» los junta, con `activa`."""
    assert (await _sub_del_token_de("d-juan"))["sub"] == "d-pedro"
    grupo = (await server.drivers_duplicados(ADMIN))["grupos"][0]
    assert {f["id"]: f["activa"] for f in grupo["fichas"]} == {"d-juan": False, "d-pedro": True, "d-juana": False}
    r = await server.drivers_separar({"queda": "d-pedro", "ceden": ["d-juan"]}, ADMIN)
    assert r["ok"] is True and set(r["cedidas"]) == {"d-juan", "d-juan-vieja"}     # con su fusionada
    server._FICHA_ACTIVA_CACHE.clear()
    assert (await _sub_del_token_de("d-juan"))["sub"] == "d-juan"
    with pytest.raises(HTTPException):
        await _login("clave-de-juan")
    assert (await _login("clave-de-pedro")).id == "d-pedro"
    # Solo la indicada: Juana sigue con el correo (puede ser la misma persona que Pedro) y su token sigue llevando a él.
    assert _ficha(pareja, "d-juana")["email"] == CORREO
    assert (await _sub_del_token_de("d-juana"))["sub"] == "d-pedro"
    assert _ficha(pareja, "d-pedro")["email"] == CORREO.upper() and _cuenta(pareja, "c-pedro")["active"] is True
    grupo = (await server.drivers_duplicados(ADMIN))["grupos"][0]
    assert {f["id"] for f in grupo["fichas"]} == {"d-pedro", "d-juana"}


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("cuerpo", [
    {"queda": "d-juan", "ceden": ["d-juana"]},          # la que se queda el correo, de baja
    {"queda": "d-pedro", "ceden": ["d-luis"]},          # una activa no se separa nunca
    {"queda": "d-juana", "ceden": ["d-pedro"]},
    {"queda": "d-pedro", "ceden": ["d-juan-vieja"]},    # fusionada en otra: se separa la otra
    {"queda": "d-pedro", "ceden": ["d-no-existe"]},
    {"queda": "d-pedro", "ceden": ["d-pedro"]},
    {"queda": "d-pedro", "ceden": []},
    {"queda": "d-pedro"},
    {"ceden": ["d-juan"]},
])
async def test_s1_separar_rechaza_lo_que_no_es_una_de_baja_con_el_mismo_correo(pareja, cuerpo):
    antes = [dict(f) for f in pareja["drivers"].docs], [dict(c) for c in pareja["driver_accounts"].docs]
    with pytest.raises(HTTPException) as e:
        await server.drivers_separar(cuerpo, ADMIN)
    assert e.value.status_code == 400
    assert ([dict(f) for f in pareja["drivers"].docs], [dict(c) for c in pareja["driver_accounts"].docs]) == antes


@pytest.mark.asyncio(loop_scope="session")
async def test_s1_separar_con_otro_correo_da_400(pareja):
    pareja["drivers"].docs.append({"id": "d-otra", "name": "OTRA", "email": "otra@empresa.test", "active": False})
    with pytest.raises(HTTPException) as e:
        await server.drivers_separar({"queda": "d-pedro", "ceden": ["d-otra"]}, ADMIN)
    assert e.value.status_code == 400
    assert _ficha(pareja, "d-otra")["email"] == "otra@empresa.test"


def test_s1_separar_va_antes_que_las_rutas_con_id():
    rutas = [getattr(r, "path", "") for r in server.api_router.routes]
    sep = rutas.index("/api/drivers/separar") if "/api/drivers/separar" in rutas else rutas.index("/drivers/separar")
    assert all(not p.startswith(("/api/drivers/{", "/drivers/{")) for p in rutas[:sep])


# ══════════════════════════════════════════════════════════ Revisión 1 (11-11-2026, noche)
# P3 + P14 · _ceder_correo solo cierra las cuentas de las fichas que CEDEN y las huérfanas con ese correo: nunca la de
#             una ficha (activa o de baja) que se queda con él.

@pytest.fixture
def trio(s1):
    """El grupo de tres: Pedro, activo y SIN cuenta propia (entra con la de su ficha vieja); la ficha vieja de Pedro, de
    baja y con su cuenta («pedro-buena»); y la de Juan, de baja, con la suya. Más dos cuentas huérfanas con el correo."""
    s1["drivers"].docs += [
        {"id": "d-pedro", "name": "PEDRO", "email": CORREO.upper(), "center": "OGA5", "active": True,
         "created_at": "2026-11-01"},
        {"id": "d-pedro-vieja", "name": "PEDRO", "email": CORREO, "center": "OGA5", "active": False,
         "created_at": "2026-02-01"},
    ]
    s1["driver_accounts"].docs += [
        {"id": "c-pedro-vieja", "driver_id": "d-pedro-vieja", "email": CORREO,
         "hashed_password": server.hash_password("pedro-buena"), "active": True,
         "password_changed_at": "2026-06-01T00:00:00+00:00", "created_at": "2026-02-01"},
        {"id": "c-sin-ficha", "email": CORREO, "hashed_password": server.hash_password("x-1"), "active": True},
        {"id": "c-ficha-borrada", "driver_id": "d-no-existe", "email": " " + CORREO.upper() + " ",
         "hashed_password": server.hash_password("x-2"), "active": True},
    ]
    return s1


@pytest.mark.asyncio(loop_scope="session")
async def test_p3_p14_separar_a_juan_no_cierra_la_cuenta_de_la_ficha_vieja_de_pedro(trio):
    antes = dict(_cuenta(trio, "c-pedro-vieja"))
    assert (await _login("pedro-buena")).id == "d-pedro"            # hoy: entra con la de su ficha vieja
    server._login_fails.clear()
    r = await server.drivers_separar({"queda": "d-pedro", "ceden": ["d-juan"]}, ADMIN)
    assert set(r["cedidas"]) == {"d-juan", "d-juan-vieja"}
    # La cuenta de la ficha vieja de Pedro (de baja, NO separada) sigue exactamente igual…
    assert _cuenta(trio, "c-pedro-vieja") == antes
    # …y Pedro sigue entrando con su contraseña de siempre, como Pedro.
    assert (await _login("pedro-buena")).id == "d-pedro"
    # La de Juan, cerrada; las huérfanas con el correo (sin ficha, o con una que no existe), también.
    assert _cuenta(trio, "c-juan")["active"] is False and "email" not in _cuenta(trio, "c-juan")
    for cid in ("c-sin-ficha", "c-ficha-borrada"):
        assert _cuenta(trio, cid)["active"] is False and "email" not in _cuenta(trio, cid)
    # La de Luis (ficha activa con otro correo en la ficha) no se toca nunca.
    assert _cuenta(trio, "c-luis")["active"] is True and "correo_cedido" not in _cuenta(trio, "c-luis")


# P27 + P30 · El correo se casa recortado y sin mayúsculas, como «Fichas duplicadas»; y si no se cede nada, 409.

@pytest.mark.asyncio(loop_scope="session")
async def test_p27_separar_con_el_correo_guardado_con_espacios_y_mayusculas(pareja):
    _ficha(pareja, "d-juan")["email"] = "  " + CORREO.upper() + " "
    _cuenta(pareja, "c-juan")["email"] = " " + CORREO + "  "
    r = await server.drivers_separar({"queda": "d-pedro", "ceden": ["d-juan"]}, ADMIN)
    assert set(r["cedidas"]) == {"d-juan", "d-juan-vieja"}
    assert "email" not in _ficha(pareja, "d-juan") and _ficha(pareja, "d-juan")["correo_cedido"]["email"].strip()
    assert _cuenta(pareja, "c-juan")["active"] is False and "email" not in _cuenta(pareja, "c-juan")
    server._FICHA_ACTIVA_CACHE.clear()
    assert (await _sub_del_token_de("d-juan"))["sub"] == "d-juan"
    with pytest.raises(HTTPException):
        await _login("clave-de-juan")


@pytest.mark.asyncio(loop_scope="session")
async def test_p30_separar_sin_nada_cedido_da_409_y_no_ok(pareja, monkeypatch):
    async def _nada(*_a, **_k):
        return []
    monkeypatch.setattr(server, "_ceder_correo", _nada)
    with pytest.raises(HTTPException) as e:
        await server.drivers_separar({"queda": "d-pedro", "ceden": ["d-juan"]}, ADMIN)
    assert e.value.status_code == 409 and "ninguna" in e.value.detail


# P13 + P28 · Ceder el correo en el alta va SOLO con `?nueva=true&otra_persona=true` (el segundo paso del panel nuevo).
#             Con `nueva=true` a secas (el «Cancelar» del único aviso del panel viejo en caché), lo de main.

def _foto(tenant):
    return ([dict(f) for f in tenant["drivers"].docs], [dict(c) for c in tenant["driver_accounts"].docs])


@pytest.mark.asyncio(loop_scope="session")
async def test_p13_con_nueva_a_secas_la_ficha_de_baja_conserva_correo_y_cuenta(s1):
    juan, cuenta = dict(_ficha(s1, "d-juan")), dict(_cuenta(s1, "c-juan"))
    pedro = await _alta_pedro(nueva=True, otra_persona=False)
    assert _ficha(s1, pedro.id)["email"] == "Repartos3@Empresa.test"           # la ficha nueva se crea, como en main
    assert _ficha(s1, "d-juan") == juan and _ficha(s1, "d-juan-vieja")["email"] == CORREO
    assert _cuenta(s1, "c-juan") == cuenta
    assert server.global_db.audit_log.docs == []
    assert (await _login("clave-de-juan")).id                                   # Juan sigue entrando, como en main


@pytest.mark.asyncio(loop_scope="session")
async def test_p13_con_las_dos_senales_cede(s1):
    await _alta_pedro(nueva=True, otra_persona=True)
    assert "email" not in _ficha(s1, "d-juan") and _cuenta(s1, "c-juan")["active"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_p27_el_alta_cede_tambien_la_ficha_guardada_con_espacios(s1):
    _ficha(s1, "d-juan")["email"] = " " + CORREO.upper() + "  "
    await _alta_pedro()
    assert "email" not in _ficha(s1, "d-juan") and _cuenta(s1, "c-juan")["active"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_p13_ficha_conductor_desde_incorporaciones_con_nueva_cede(s1):
    """La ruta nueva de «fichas»: su `nueva: true` solo lo manda el panel nuevo tras el segundo paso."""
    s1["incorporaciones"] = Col([{"id": "p-pedro", "nombre": "PEDRO", "email": CORREO, "centro": "OGA5"}])
    r = await server.onb_ficha_conductor("p-pedro", {"usar_correo": True, "nueva": True}, ADMIN)
    assert r["ya_tenia"] is False
    assert "email" not in _ficha(s1, "d-juan") and _cuenta(s1, "c-juan")["active"] is False


# P29 + P31 · La nave de quien lo hace: separar, o ceder en el alta, solo fichas de naves que ve.

JEFE_DGA1 = {**ADMIN, "sub": "a2", "name": "Marta", "allowed_centers": ["DGA1"]}
JEFE_OGA5 = {**ADMIN, "sub": "a3", "name": "Rosa", "allowed_centers": ["OGA5"]}


@pytest.mark.asyncio(loop_scope="session")
async def test_p31_alta_otra_persona_con_una_baja_de_otra_nave_da_403_sin_escribir_nada(s1):
    antes = _foto(s1)
    with pytest.raises(HTTPException) as e:
        await _alta_pedro(admin=JEFE_DGA1)
    assert e.value.status_code == 403 and "OGA5" in e.value.detail
    assert _foto(s1) == antes and server.global_db.audit_log.docs == []
    # Quien sí ve esa nave, como siempre.
    await _alta_pedro(admin=JEFE_OGA5)
    assert "email" not in _ficha(s1, "d-juan")


@pytest.mark.asyncio(loop_scope="session")
async def test_p31_con_nueva_a_secas_no_se_mira_la_nave_como_en_main(s1):
    pedro = await _alta_pedro(nueva=True, otra_persona=False, admin={**JEFE_DGA1, "allowed_centers": ["OGA5"]})
    assert _ficha(s1, pedro.id)["email"] and _ficha(s1, "d-juan")["email"] == CORREO


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("centros", [{"d-pedro": "DGA1"}, {"d-juan": "DGA1"}])
async def test_p29_separar_fichas_de_una_nave_que_no_ve_da_403_sin_tocar_nada(pareja, centros):
    for fid, c in centros.items():
        _ficha(pareja, fid)["center"] = c
    antes = _foto(pareja)
    with pytest.raises(HTTPException) as e:
        await server.drivers_separar({"queda": "d-pedro", "ceden": ["d-juan"]}, JEFE_OGA5)
    assert e.value.status_code == 403
    assert _foto(pareja) == antes and server.global_db.audit_log.docs == []


@pytest.mark.asyncio(loop_scope="session")
async def test_p29_separar_en_su_nave_y_sin_naves_asignadas_como_hasta_ahora(pareja):
    r = await server.drivers_separar({"queda": "d-pedro", "ceden": ["d-juan"]}, JEFE_OGA5)
    assert "d-juan" in r["cedidas"]
    sin_naves = {**ADMIN, "allowed_centers": []}
    r = await server.drivers_separar({"queda": "d-pedro", "ceden": ["d-juana"]}, sin_naves)
    assert r["cedidas"] == ["d-juana"]


# P11 + P20 · _user_can_see_center: el centro pedido tiene que estar en el permitido como PALABRA ENTERA. Antes un trozo
#             («GA», «1», «M») pasaba por el `c in p.upper()` y la consulta casaba otras naves.

def _limitado(*centros):
    return {"sub": "a9", "role": "admin", "account_type": "dsp", "allowed_centers": list(centros)}


@pytest.mark.parametrize("permitidos,pedido,ve", [
    # Los trozos del código permitido: fuera.
    (["OGA5"], "GA", False), (["OGA5"], "5", False), (["OGA5"], "OGA", False), (["OGA5"], "O", False),
    (["DGA1"], "1", False), (["DGA1"], "GA", False), (["DGA1", "DGA2"], "DGA", False),
    (["AMZL OGA5 SANTIAGO XPT"], "M", False), (["AMZL OGA5 SANTIAGO XPT"], "GA5", False),
    (["AMZL OGA5 SANTIAGO XPT"], "SANT", False),
    # Otra nave: fuera, como siempre.
    (["OGA5"], "DGA1", False),
    # El código exacto, en mayúsculas o minúsculas.
    (["OGA5"], "OGA5", True), (["OGA5"], "oga5", True), (["oga5"], "OGA5", True), (["OGA5", "DGA1"], "dga1", True),
    # El permitido con el nombre largo y el pedido, el código.
    (["AMZL OGA5 SANTIAGO XPT"], "OGA5", True), (["AMZL OGA5 SANTIAGO XPT"], "oga5", True),
    (["AMZL OGA5 SANTIAGO XPT"], " OGA5 ", True), (["AMZL OGA5 SANTIAGO XPT"], " ", False),
    # La otra dirección, que se queda como estaba: el código permitido dentro de un nombre sucio de la base.
    (["OGA5"], "AMZL OGA5 SANTIAGO XPT", True), (["OGA5"], "amzl oga5 santiago xpt", True),
    (["DGA1"], "AMZL OGA5 SANTIAGO XPT", False),
])
def test_p11_solo_el_codigo_entero(permitidos, pedido, ve):
    assert server._user_can_see_center(_limitado(*permitidos), pedido) is ve


@pytest.mark.parametrize("user", [
    {"sa": True, "allowed_centers": ["OGA5"]},
    {"account_type": "owner", "allowed_centers": ["OGA5"]},
    {"account_type": "dsp", "allowed_centers": []},
    {"account_type": "dsp"},
])
@pytest.mark.parametrize("pedido", ["GA", "1", "DGA1", "OGA5", ""])
def test_p11_superadmin_dueno_y_sin_naves_ven_todo_como_antes(user, pedido):
    assert server._user_can_see_center(user, pedido) is True


def test_p11_centro_vacio_como_antes():
    assert server._user_can_see_center(_limitado("OGA5"), "") is True
    assert server._user_can_see_center(_limitado("OGA5"), None) is True


@pytest.fixture
def naves(monkeypatch):
    tenant = Db()
    tenant["drivers"] = Col([
        {"id": "d-o", "name": "ANA OGA", "center": "OGA5", "active": True},
        {"id": "d-g", "name": "BEA DGA", "center": "AMZL DGA1 CORUNA", "active": True},
    ])
    for col in ("vehicles", "shift_requests", "shifts", "daily_assignments", "suspensiones", "cuadrante_config",
                "dias_concedidos"):
        tenant[col] = Col([])
    monkeypatch.setattr(server, "db", tenant)
    return tenant


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("pedido", ["GA", "1", "A", "DGA"])
async def test_p11_drivers_con_un_trozo_da_403(naves, pedido):
    with pytest.raises(HTTPException) as e:
        await server.get_drivers(pedido, _limitado("OGA5"))
    assert e.value.status_code == 403


@pytest.mark.asyncio(loop_scope="session")
async def test_p11_drivers_de_su_nave_como_siempre(naves):
    assert [d["id"] for d in await server.get_drivers("OGA5", _limitado("OGA5"))] == ["d-o"]
    assert [d["id"] for d in await server.get_drivers("oga5", _limitado("AMZL OGA5 SANTIAGO XPT"))] == ["d-o"]


@pytest.mark.asyncio(loop_scope="session")
async def test_p11_cobertura_con_un_trozo_da_403(naves):
    with pytest.raises(HTTPException) as e:
        await server.cobertura_peticiones("GA", None, None, _limitado("OGA5"))
    assert e.value.status_code == 403


@pytest.mark.asyncio(loop_scope="session")
async def test_p11_plantilla_validar_con_un_trozo_da_403(naves):
    with pytest.raises(HTTPException) as e:
        await server.plantilla_validar({"rows": [], "center": "GA", "date": "2026-11-11"}, _limitado("OGA5"))
    assert e.value.status_code == 403


@pytest.mark.asyncio(loop_scope="session")
async def test_p31_ficha_conductor_desde_incorporaciones_con_una_baja_de_otra_nave_da_403(s1):
    s1["incorporaciones"] = Col([{"id": "p-pedro", "nombre": "PEDRO", "email": CORREO, "centro": ""}])
    antes = _foto(s1)
    with pytest.raises(HTTPException) as e:
        await server.onb_ficha_conductor("p-pedro", {"usar_correo": True, "nueva": True}, JEFE_DGA1)
    assert e.value.status_code == 403
    assert _foto(s1) == antes and "driver_id" not in s1["incorporaciones"].docs[0]
