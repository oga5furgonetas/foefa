# -*- coding: utf-8 -*-
"""Tanda 3, zona «fichas» (11-11-2026): lo que cambia en la ficha del conductor.

horas_dnr-10 · Cada cambio del ID de reparto hecho DESDE LA FICHA (alta o edición) queda apuntado en
               `transporter_id_cambios`, con la misma forma que los de la DNR diaria más `origen`.
equipo-8     · Cambiar la nave desde «Editar» apunta `historial_centros` (como="ficha") y `_audit`; misma nave, nada.
equipo-6     · «Dar de baja» apunta cuándo y quién; GET /drivers/bajas; POST /drivers/{id}/reactivar (409 por correo o ID
               de reparto); el PATCH que reactiva comprueba el ID; la importación separa «estaban de baja».
historia-10  · `license_expiry` en el modelo (tolerante: nunca tumba GET /drivers), en el alta y en el PATCH.
equipo-5     · GET /drivers/app: versión de la app de Android y cuándo se abrió, solo de las fichas de esta base.
equipo-11    · Incorporaciones dice quién tiene ya ficha y POST …/ficha-conductor la enlaza o la crea con create_driver.

Con la base de mentira (base_de_mentira.py), sin MongoDB. Nombres, correos e IDs inventados.
"""
import contextvars
from datetime import date, datetime
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pymongo.errors import WriteError

import server
from base_de_mentira import Col, Db

DANI = {"sub": "a1", "role": "admin", "name": "Dani", "org_id": "o1", "account_type": "owner"}
TID_A = "AAAAA11111BB"
TID_B = "ABBBB22222CC"


class ColMongo(Col):
    """Las fichas, como en MongoDB de verdad en lo que importa aquí (11-11-2026, segunda revisión, F1): `$push` o
    `$addToSet` sobre un campo que EXISTE y no es una lista LANZA («must be an array but is of type null»). La base de
    mentira lo creaba como lista y por eso no se vio que el alta guardaba `historial_centros: null`."""

    def _aplica(self, d, u, nuevo=False):
        for op in ("$push", "$addToSet"):
            for k in u.get(op, {}):
                if k in d and not isinstance(d[k], list):
                    tipo = "null" if d[k] is None else type(d[k]).__name__
                    raise WriteError("The field '%s' must be an array but is of type %s in document" % (k, tipo),
                                     code=2)
        super()._aplica(d, u, nuevo)


@pytest.fixture
def base(monkeypatch):
    # La base de la petición, propia de cada prueba: otra prueba que la deja puesta en otra (test_necesidades_repartidor
    # pone «dsp_x» y pytest-asyncio comparte el contexto entre pruebas) hacía que GET /drivers/app no viera los
    # registros de esta base (segunda revisión, punto 9).
    monkeypatch.setattr(server, "_current_db_name",
                        contextvars.ContextVar("db_de_la_prueba", default=server._DEFAULT_DB_NAME))
    tenant = Db()
    tenant["drivers"] = ColMongo([
        {"id": "d-ana", "name": "ANA RÍOS", "email": "ana@x.test", "center": "OGA5", "active": True,
         "transporter_id": TID_A},
        {"id": "d-luis", "name": "LUIS PAZ", "email": "luis@x.test", "center": "DGA1", "active": True},
    ])
    tenant["driver_accounts"] = Col([])
    tenant["transporter_id_cambios"] = Col([])
    globales = Db()
    globales["organizations"] = Col([{"id": "o1", "account_type": "owner", "status": "active",
                                      "centers": ["OGA5", "DGA1", "DGA2"]}])
    monkeypatch.setattr(server, "db", tenant)
    monkeypatch.setattr(server, "global_db", globales)

    async def _sin_inicial(_user):
        return None
    monkeypatch.setattr(server, "_contrasena_inicial", _sin_inicial)

    async def _audit(user, accion, detalle=None):
        tenant["audit_log"].docs.append({"action": accion, "detail": detalle, "por": (user or {}).get("name")})
    monkeypatch.setattr(server, "_audit", _audit)

    async def _limpiar(_did, _org):
        tenant["correo_personal_limpiado"].docs.append({"driver_id": _did})
    monkeypatch.setattr(server, "_limpiar_correo_personal_conductor", _limpiar)
    return tenant


def _apuntes(tenant):
    return tenant["transporter_id_cambios"].docs


# ══════════════════════════════════════════════════════════════════════ horas_dnr-10

@pytest.mark.asyncio(loop_scope="session")
async def test_hdnr10_alta_con_id_deja_un_apunte_ficha_alta(base):
    d = await server.create_driver(server.DriverCreate(name="Eva Sol", transporter_id=" ab cde12345 "), admin=DANI)
    [a] = _apuntes(base)
    assert a["origen"] == "ficha_alta" and a["transporter_id"] == "ABCDE12345"
    assert a["antes"] == [] and a["despues"] == {"ficha_id": d.id, "ficha": "Eva Sol"}
    assert a["por"] == "Dani" and a["en"]


@pytest.mark.asyncio(loop_scope="session")
async def test_hdnr10_alta_sin_id_no_apunta(base):
    await server.create_driver(server.DriverCreate(name="Eva Sol"), admin=DANI)
    assert _apuntes(base) == []


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("mismo", [TID_A, TID_A.lower(), " aaaaa 11111bb "])
async def test_hdnr10_guardar_la_ficha_con_el_mismo_id_no_apunta(base, mismo):
    """El formulario manda la ficha entera: con el mismo ID (en minúsculas o con espacios) no se apunta nada."""
    r = await server.update_driver("d-ana", {"name": "ANA RÍOS", "transporter_id": mismo, "phone": "600"}, DANI)
    assert r["success"] is True
    assert _apuntes(base) == []


@pytest.mark.asyncio(loop_scope="session")
async def test_hdnr10_cambiar_el_id_deja_dos_apuntes(base):
    await server.update_driver("d-ana", {"transporter_id": TID_B}, DANI)
    viejo, nuevo = _apuntes(base)
    assert viejo["transporter_id"] == TID_A and viejo["despues"] is None and viejo["origen"] == "ficha"
    assert viejo["antes"] == [{"ficha_id": "d-ana", "ficha": "ANA RÍOS", "campos": ["transporter_id"]}]
    assert nuevo["transporter_id"] == TID_B and nuevo["antes"] == [] and nuevo["origen"] == "ficha"
    assert nuevo["despues"] == {"ficha_id": "d-ana", "ficha": "ANA RÍOS"}


@pytest.mark.asyncio(loop_scope="session")
async def test_hdnr10_quitar_el_id_deja_un_apunte_con_despues_none(base):
    await server.update_driver("d-ana", {"transporter_id": ""}, DANI)
    [a] = _apuntes(base)
    assert a["transporter_id"] == TID_A and a["despues"] is None
    assert "transporter_id" not in await base["drivers"].find_one({"id": "d-ana"})


@pytest.mark.asyncio(loop_scope="session")
async def test_hdnr10_poner_id_a_quien_no_tenia_deja_solo_el_nuevo(base):
    await server.update_driver("d-luis", {"transporter_id": TID_B}, DANI)
    [a] = _apuntes(base)
    assert a["transporter_id"] == TID_B and a["despues"]["ficha_id"] == "d-luis"


@pytest.mark.asyncio(loop_scope="session")
async def test_hdnr10_un_id_de_otra_ficha_sigue_dando_409_sin_apunte(base):
    with pytest.raises(HTTPException) as e:
        await server.update_driver("d-luis", {"transporter_id": TID_A}, DANI)
    assert e.value.status_code == 409
    assert _apuntes(base) == []


@pytest.mark.asyncio(loop_scope="session")
async def test_hdnr10_si_el_apunte_falla_la_ficha_se_guarda_igual(base):
    class _Rota(Col):
        async def insert_one(self, doc):
            raise RuntimeError("sin base")
    base["transporter_id_cambios"] = _Rota([])
    r = await server.update_driver("d-ana", {"transporter_id": TID_B}, DANI)
    assert r == {"success": True}
    assert (await base["drivers"].find_one({"id": "d-ana"}))["transporter_id"] == TID_B


# ══════════════════════════════════════════════════════════════════════ equipo-8

def _ficha(tenant, did):
    return next(d for d in tenant["drivers"].docs if d["id"] == did)


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("misma", ["OGA5", "oga5", " OGA5 "])
async def test_e8_guardar_con_la_misma_nave_no_apunta_nada(base, misma):
    r = await server.update_driver("d-ana", {"name": "ANA RÍOS", "center": misma, "phone": "600"}, DANI)
    assert r == {"success": True}
    f = _ficha(base, "d-ana")
    assert f["center"] == "OGA5" and "historial_centros" not in f
    assert not [a for a in base["audit_log"].docs if a["action"] == "driver_centro"]


@pytest.mark.asyncio(loop_scope="session")
async def test_e8_cambiar_de_nave_apunta_historial_y_auditoria(base, monkeypatch):
    monkeypatch.setattr(server, "_dia_negocio", lambda: "2026-11-11")
    r = await server.update_driver("d-luis", {"center": "OGA5"}, DANI)
    assert r["centro_cambiado"] == {"de": "DGA1", "a": "OGA5"} and r["traslado_pendiente"] is None
    f = _ficha(base, "d-luis")
    assert f["center"] == "OGA5"
    [h] = f["historial_centros"]
    assert h["de"] == "DGA1" and h["a"] == "OGA5" and h["desde"] == "2026-11-11"
    assert h["como"] == "ficha" and h["programado_por"] == "Dani" and h["aplicado_en"]
    [a] = [a for a in base["audit_log"].docs if a["action"] == "driver_centro"]
    assert a["detail"] == {"driver_id": "d-luis", "de": "DGA1", "a": "OGA5"}


@pytest.mark.asyncio(loop_scope="session")
async def test_e8_traslado_a_esa_nave_se_quita_y_a_otra_se_conserva(base):
    _ficha(base, "d-luis")["traslado"] = {"centro": "OGA5", "desde": "2026-12-01", "por": "Fran"}
    _ficha(base, "d-ana")["traslado"] = {"centro": "DGA2", "desde": "2026-12-01", "por": "Fran"}
    r1 = await server.update_driver("d-luis", {"center": "OGA5"}, DANI)
    r2 = await server.update_driver("d-ana", {"center": "DGA1"}, DANI)
    assert "traslado" not in _ficha(base, "d-luis") and r1["traslado_pendiente"] is None
    assert _ficha(base, "d-ana")["traslado"]["centro"] == "DGA2"
    assert r2["traslado_pendiente"] == {"centro": "DGA2", "desde": "2026-12-01"}
    # Y el bucle de traslados no apunta nada de Luis otra vez (el de Ana, que sigue en pie, sí lo aplica ese día).
    hechos = await server.aplicar_traslados("2026-12-02")
    assert [h["id"] for h in hechos] == ["d-ana"]
    assert len(_ficha(base, "d-luis")["historial_centros"]) == 1
    assert [h.get("como") for h in _ficha(base, "d-ana")["historial_centros"]] == ["ficha", None]


@pytest.mark.asyncio(loop_scope="session")
async def test_e8_un_usuario_limitado_no_pasa_a_nadie_a_una_nave_que_no_ve(base):
    jefe = {"sub": "a2", "role": "admin", "name": "Marta", "account_type": "dsp", "allowed_centers": ["DGA1"]}
    with pytest.raises(HTTPException) as e:
        await server.update_driver("d-luis", {"center": "OGA5"}, jefe)
    assert e.value.status_code == 403
    assert _ficha(base, "d-luis")["center"] == "DGA1" and "historial_centros" not in _ficha(base, "d-luis")
    # Guardar SU ficha sin tocar la nave sigue funcionando, y la misma nave en minúsculas también.
    assert (await server.update_driver("d-luis", {"center": "dga1", "phone": "611"}, jefe)) == {"success": True}
    # Y con la cuenta dueña, como hoy, a cualquiera.
    assert (await server.update_driver("d-luis", {"center": "OGA5"}, {**jefe, "account_type": "owner"}))["centro_cambiado"]


@pytest.mark.asyncio(loop_scope="session")
async def test_e8_poner_nave_a_una_ficha_sin_centro_tambien_se_apunta(base):
    _ficha(base, "d-luis")["center"] = None
    r = await server.update_driver("d-luis", {"center": "DGA2"}, DANI)
    assert r["centro_cambiado"] == {"de": "", "a": "DGA2"}
    assert _ficha(base, "d-luis")["historial_centros"][0]["de"] == ""


@pytest.mark.asyncio(loop_scope="session")
async def test_e8_get_drivers_devuelve_el_historial_y_tolera_uno_raro(base):
    _ficha(base, "d-ana")["historial_centros"] = [{"de": "DGA1", "a": "OGA5", "desde": "2026-10-05"}]
    _ficha(base, "d-luis")["historial_centros"] = "roto"
    filas = [server.Driver(**d).model_dump() for d in await server.get_drivers(None, DANI)]
    por_id = {f["id"]: f for f in filas}
    assert por_id["d-ana"]["historial_centros"][0]["a"] == "OGA5"
    assert por_id["d-luis"]["historial_centros"] is None


# ══════════════════════════════════════════════════════════════════════ F1 (segunda revisión)
# Las fichas nuevas nacían con `historial_centros: null` y el `$push` de después falla en Mongo de verdad: se rompían
# el cambio de nave desde «Editar» y el traslado programado de cada noche (que además paraba a las demás empresas).

HOY = "2026-11-11"


def _bucle_una_vuelta(monkeypatch):
    """`_bucle_traslados` es un bucle sin fin: con este `asyncio` de mentira da UNA vuelta y para."""
    class _Fin(Exception):
        pass

    async def _dormir(segundos):
        if segundos >= server.TRASLADOS_CADA_MIN * 60:
            raise _Fin()
    monkeypatch.setattr(server, "asyncio", SimpleNamespace(sleep=_dormir))

    async def una_vuelta():
        with pytest.raises(_Fin):
            await server._bucle_traslados()
    return una_vuelta


@pytest.mark.asyncio(loop_scope="session")
async def test_f1_el_alta_no_guarda_nulls_y_luego_se_cambia_de_nave(base, monkeypatch):
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)
    d = await server.create_driver(server.DriverCreate(name="Eva Sol", center="OGA5"), admin=DANI)
    f = _ficha(base, d.id)
    assert "historial_centros" not in f and "license_expiry" not in f          # como en main: el alta no los escribía
    assert d.historial_centros is None and d.license_expiry is None              # la respuesta, igual que antes
    r = await server.update_driver(d.id, {"center": "DGA1"}, DANI)
    assert r["centro_cambiado"] == {"de": "OGA5", "a": "DGA1"}
    assert [h["a"] for h in _ficha(base, d.id)["historial_centros"]] == ["DGA1"]


@pytest.mark.asyncio(loop_scope="session")
async def test_f1_alta_y_traslado_programado_que_aplica_el_bucle(base, monkeypatch):
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)

    async def _centros():
        return ["OGA5", "DGA1", "DGA2"]
    monkeypatch.setattr(server, "_centros_de_la_empresa", _centros)
    d = await server.create_driver(server.DriverCreate(name="Eva Sol", center="OGA5"), admin=DANI)
    # Con fecha de hoy se aplica en el acto (antes: guardaba el traslado y daba 500).
    hoy = await server.programar_traslado(d.id, {"centro": "DGA1", "desde": HOY}, DANI)
    assert hoy["aplicado"] is True and _ficha(base, d.id)["center"] == "DGA1"
    # Con fecha de mañana lo aplica el bucle de cada cuarto de hora cuando llega el día.
    d2 = await server.create_driver(server.DriverCreate(name="Eva Dos", center="OGA5"), admin=DANI)
    await server.programar_traslado(d2.id, {"centro": "DGA2", "desde": "2026-11-12"}, DANI)
    monkeypatch.setattr(server, "_dia_negocio", lambda: "2026-11-12")
    await _bucle_una_vuelta(monkeypatch)()
    f2 = _ficha(base, d2.id)
    assert f2["center"] == "DGA2" and "traslado" not in f2
    assert [(h["de"], h["a"]) for h in f2["historial_centros"]] == [("OGA5", "DGA2")]


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("guardado", [None, "roto", {"de": "X"}])
async def test_f1_una_ficha_que_ya_tiene_el_null_guardado_tambien_funciona(base, guardado):
    """Las que se dieran de alta con el null antes del arreglo: se convierte en lista antes del `$push`."""
    _ficha(base, "d-luis")["historial_centros"] = guardado
    _ficha(base, "d-ana")["historial_centros"] = guardado
    _ficha(base, "d-ana")["traslado"] = {"centro": "DGA2", "desde": "2026-11-01", "por": "Fran"}
    r = await server.update_driver("d-luis", {"center": "OGA5"}, DANI)
    assert r["centro_cambiado"]["a"] == "OGA5"
    assert [h["a"] for h in _ficha(base, "d-luis")["historial_centros"]] == ["OGA5"]
    hechos = await server.aplicar_traslados(HOY)
    assert [h["id"] for h in hechos] == ["d-ana"]
    assert [h["a"] for h in _ficha(base, "d-ana")["historial_centros"]] == ["DGA2"]


@pytest.mark.asyncio(loop_scope="session")
async def test_f1_una_ficha_que_falla_no_para_a_las_demas_ni_a_otras_empresas(base, monkeypatch):
    class _UnaRota(ColMongo):
        async def update_one(self, q, u, upsert=False, **k):
            if q.get("id") == "d-rota":
                raise RuntimeError("ficha rota")
            return await super().update_one(q, u, upsert=upsert, **k)
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)
    traslado = {"centro": "DGA2", "desde": HOY, "por": "Fran"}
    base["drivers"] = _UnaRota([
        {"id": "d-rota", "name": "ROTA", "center": "OGA5", "active": True, "traslado": dict(traslado)},
        {"id": "d-sigue", "name": "SIGUE", "center": "OGA5", "active": True, "traslado": dict(traslado)}])
    otra = Db()
    otra["drivers"] = ColMongo([
        {"id": "d-otra", "name": "DE OTRA EMPRESA", "center": "MAD1", "active": True,
         "traslado": {"centro": "MAD2", "desde": HOY, "por": "Luz"}}])
    server.global_db["organizations"].docs.append({"id": "o2", "status": "active", "db_name": "dsp_o2"})
    bases = {server._DEFAULT_DB_NAME: base, "dsp_o2": otra}

    class _PorBase:
        def __getattr__(self, nombre):
            return getattr(bases[server._current_db_name.get()], nombre)

        def __getitem__(self, nombre):
            return bases[server._current_db_name.get()][nombre]
    monkeypatch.setattr(server, "db", _PorBase())
    await _bucle_una_vuelta(monkeypatch)()
    assert _ficha(base, "d-sigue")["center"] == "DGA2"                  # la de detrás, en la misma empresa
    assert _ficha(otra, "d-otra")["center"] == "MAD2"                   # y la de la empresa siguiente
    assert _ficha(base, "d-rota")["center"] == "OGA5"                   # la rota se queda para la próxima vuelta
    latido = server.global_db["app_meta"].docs[-1]
    assert latido["aplicados"] == 2


@pytest.mark.asyncio(loop_scope="session")
async def test_f1_las_otras_altas_tampoco_guardan_el_null(base):
    """Las demás altas que salen del modelo Driver: «Contratar» desde Empleo y el cuadrante (también la hoja de
    Google, que pasa por _cua_crear_conductor). La importación ya quitaba los vacíos."""
    base["candidatos"] = Col([{"id": "c1", "nombre": "Rosa Mar", "telefono": "600111222", "centro": "OGA5"}])
    r = await server.empleo_contratar("c1", DANI)
    nueva = await server._cua_crear_conductor("DGA1", "Pepe Nuevo")
    for did in (r["driver_id"], nueva["id"]):
        f = _ficha(base, did)
        assert "historial_centros" not in f and "license_expiry" not in f
        await server.update_driver(did, {"center": "DGA2"}, DANI)
        assert len(_ficha(base, did)["historial_centros"]) == 1


# ══════════════════════════════════════════════════════════════════════ equipo-6

TID_C = "ACCCC33333DD"
JEFE_DGA1 = {"sub": "a2", "role": "admin", "name": "Marta", "account_type": "dsp", "allowed_centers": ["DGA1"]}


@pytest.fixture
def bajas(base):
    base["drivers"].docs += [
        {"id": "d-juan", "name": "JUAN REY", "email": "juan@x.test", "center": "OGA5", "active": False,
         "baja_en": "2026-11-05T10:00:00+00:00", "baja_por": "Dani"},
        {"id": "d-vieja", "name": "PACO SIN FECHA", "center": "DGA1", "active": False},
        {"id": "d-hoja", "name": "LOLA HOJA", "center": "OGA5", "active": False, "desactivada_por": "hoja",
         "desactivada_en": "2026-11-08T21:00:00+00:00"},
        {"id": "d-sin", "name": "SIN NAVE", "center": "", "active": False, "baja_en": "2026-10-01T09:00:00+00:00"},
        {"id": "d-fus", "name": "FUSIONADA", "email": "ana@x.test", "center": "OGA5", "active": False,
         "merged_into": "d-ana", "status": "fusionada"},
        {"id": "d-borr", "name": "BORRADA", "center": "OGA5", "active": False, "status": "deleted"},
        {"id": "d-dga2", "name": "DE DGA2", "center": "DGA2", "active": False,
         "baja_en": "2026-11-09T10:00:00+00:00"},
    ]
    return base


@pytest.mark.asyncio(loop_scope="session")
async def test_e6_dar_de_baja_apunta_cuando_y_quien_sin_pisar(bajas):
    await server.delete_driver("d-luis", DANI)
    f = _ficha(bajas, "d-luis")
    assert f["active"] is False and f["baja_por"] == "Dani" and f["baja_en"].startswith("20")
    await server.delete_driver("d-juan", {**DANI, "name": "Otra"})
    assert _ficha(bajas, "d-juan")["baja_en"] == "2026-11-05T10:00:00+00:00"
    assert _ficha(bajas, "d-juan")["baja_por"] == "Dani"
    with pytest.raises(HTTPException) as e:
        await server.delete_driver("d-nadie", DANI)
    assert e.value.status_code == 404


@pytest.mark.asyncio(loop_scope="session")
async def test_e6_la_lista_de_bajas_sin_fusionadas_ni_borradas_y_por_nave(bajas):
    todas = await server.get_drivers_bajas(None, DANI)
    assert [f["id"] for f in todas] == ["d-dga2", "d-hoja", "d-juan", "d-sin", "d-vieja"]
    assert set(todas[0]) == {"id", "name", "center", "email", "phone", "transporter_id", "baja_en", "baja_por",
                             "desactivada_por", "origen"}                     # `origen`: segunda revisión, F5/F6
    hoja = next(f for f in todas if f["id"] == "d-hoja")
    assert hoja["desactivada_por"] == "hoja" and hoja["baja_en"] == "2026-11-08T21:00:00+00:00"
    oga5 = await server.get_drivers_bajas("OGA5", DANI)
    assert [f["id"] for f in oga5] == ["d-hoja", "d-juan", "d-sin"]          # y las sin centro, como GET /drivers
    assert [f["id"] for f in await server.get_drivers_bajas(None, JEFE_DGA1)] == ["d-sin", "d-vieja"]
    with pytest.raises(HTTPException) as e:
        await server.get_drivers_bajas("OGA5", JEFE_DGA1)
    assert e.value.status_code == 403
    # Y GET /drivers sigue igual: ninguna de baja.
    assert {d["id"] for d in await server.get_drivers(None, DANI)} == {"d-ana", "d-luis"}


@pytest.mark.asyncio(loop_scope="session")
async def test_e6_reactivar_vuelve_activa_sin_tocar_desactivada_por(bajas):
    r = await server.reactivar_driver("d-hoja", {}, DANI)
    assert r["ok"] is True and r["driver"]["id"] == "d-hoja" and r["driver"]["active"] is True
    f = _ficha(bajas, "d-hoja")
    assert f["active"] is True and f["desactivada_por"] == "hoja"
    await server.reactivar_driver("d-juan", {}, DANI)
    f = _ficha(bajas, "d-juan")
    assert f["active"] is True and "baja_en" not in f and "baja_por" not in f
    assert [a["action"] for a in bajas["audit_log"].docs].count("driver_reactivar") == 2


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("did, codigo", [("d-nadie", 404), ("d-ana", 400), ("d-fus", 400), ("d-borr", 400)])
async def test_e6_reactivar_lo_que_no_es_una_baja(bajas, did, codigo):
    with pytest.raises(HTTPException) as e:
        await server.reactivar_driver(did, {}, DANI)
    assert e.value.status_code == codigo


@pytest.mark.asyncio(loop_scope="session")
async def test_e6_reactivar_una_nave_que_no_ve_da_403(bajas):
    with pytest.raises(HTTPException) as e:
        await server.reactivar_driver("d-juan", {}, JEFE_DGA1)
    assert e.value.status_code == 403 and _ficha(bajas, "d-juan")["active"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_e6_reactivar_con_el_correo_en_otra_activa_da_409_con_abrir_id(bajas):
    bajas["drivers"].docs.append({"id": "d-juan2", "name": "JUAN REY", "email": "JUAN@x.test", "center": "OGA5",
                                  "active": True})
    with pytest.raises(HTTPException) as e:
        await server.reactivar_driver("d-juan", {"quitar_id": True}, DANI)
    assert e.value.status_code == 409
    assert e.value.detail["abrir_id"] == "d-juan2" and e.value.detail["conflicto"] == "correo"
    assert _ficha(bajas, "d-juan")["active"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_e6_reactivar_con_el_id_en_otra_viva_pide_quitarlo(bajas):
    _ficha(bajas, "d-juan")["transporter_id"] = TID_A          # lo tiene Ana, viva
    with pytest.raises(HTTPException) as e:
        await server.reactivar_driver("d-juan", {}, DANI)
    d = e.value.detail
    assert e.value.status_code == 409 and d["conflicto"] == "id_reparto" and d["abrir_id"] == "d-ana"
    assert d["transporter_id"] == TID_A and _ficha(bajas, "d-juan")["active"] is False
    r = await server.reactivar_driver("d-juan", {"quitar_id": True}, DANI)
    f = _ficha(bajas, "d-juan")
    assert r["ok"] and f["active"] is True and "transporter_id" not in f
    assert _ficha(bajas, "d-ana")["transporter_id"] == TID_A
    [a] = _apuntes(bajas)
    assert a["transporter_id"] == TID_A and a["despues"] is None and a["antes"][0]["ficha_id"] == "d-juan"


@pytest.mark.asyncio(loop_scope="session")
async def test_e6_reactivar_con_su_propio_id_libre_lo_conserva(bajas):
    _ficha(bajas, "d-juan")["transporter_id"] = TID_C
    await server.reactivar_driver("d-juan", {}, DANI)
    assert _ficha(bajas, "d-juan")["transporter_id"] == TID_C and _apuntes(bajas) == []


@pytest.mark.asyncio(loop_scope="session")
async def test_e6_el_patch_que_reactiva_comprueba_el_id(bajas):
    """El 409 de «ya tiene una ficha de baja» del alta y el asistente reactivan con PATCH {active: true}."""
    _ficha(bajas, "d-juan")["transporter_id"] = TID_A
    with pytest.raises(HTTPException) as e:
        await server.update_driver("d-juan", {"active": True}, DANI)
    assert e.value.status_code == 409 and e.value.detail["abrir_id"] == "d-ana"
    assert _ficha(bajas, "d-juan")["active"] is False
    # Con el formulario del alta, que trae su ID vacío: se le quita y se reactiva.
    await server.update_driver("d-juan", {"name": "JUAN REY", "transporter_id": "", "active": True}, DANI)
    f = _ficha(bajas, "d-juan")
    assert f["active"] is True and "transporter_id" not in f and "baja_en" not in f


@pytest.mark.asyncio(loop_scope="session")
async def test_e6_el_patch_de_baja_apunta_y_el_de_una_activa_no_toca_nada_mas(bajas):
    await server.update_driver("d-luis", {"active": False}, DANI)            # el cuadrante da de baja así
    f = _ficha(bajas, "d-luis")
    assert f["active"] is False and f["baja_por"] == "Dani"
    # Guardar una ficha activa con active: true no añade ni quita nada (ni comprueba el ID).
    await server.update_driver("d-ana", {"active": True, "phone": "699"}, DANI)
    assert "baja_en" not in _ficha(bajas, "d-ana")


class _Fich:
    filename = "plantilla.xlsx"

    async def read(self):
        return b"x"


def _importacion(monkeypatch, filas):
    monkeypatch.setattr(server, "_read_table_any", lambda c, n: filas)

    async def _org(_oid):
        return {"centers": ["OGA5"]}
    monkeypatch.setattr(server, "get_org", _org)

    async def _centros():
        return ["OGA5", "DGA1", "DGA2"]
    monkeypatch.setattr(server, "_centros_de_la_empresa", _centros)


FILAS_IMP = [
    ["Nombre", "Email", "Centro"],
    ["Juan Rey", "juan@x.test", "OGA5"],        # de baja por correo
    ["Ana Ríos", "ana@x.test", "OGA5"],         # viva (y una fusionada con su correo)
    ["Paco Sin Fecha", "", "DGA1"],             # de baja por nombre, sin correo
    ["Luis Paz", "", "DGA1"],                   # vivo por nombre
    ["Nueva Persona", "nueva@x.test", "OGA5"],  # nueva
]


@pytest.mark.asyncio(loop_scope="session")
async def test_e6_importar_separa_las_bajas_sin_cambiar_ya_estaban(bajas, monkeypatch):
    _importacion(monkeypatch, FILAS_IMP)
    prev = await server.drivers_importar_prev(_Fich(), "OGA5", DANI)
    assert prev["nuevas"] == 1 and prev["ya_estaban"] == 4
    assert prev["de_baja"] == 2 and prev["nombres_de_baja"] == ["JUAN REY", "PACO SIN FECHA"]
    assert {p["name"]: p["de_baja"] for p in prev["muestra"]} == {
        "JUAN REY": True, "ANA RÍOS": False, "PACO SIN FECHA": True, "LUIS PAZ": False, "NUEVA PERSONA": False}
    antes = len(bajas["drivers"].docs)
    r = await server.drivers_importar(_Fich(), "OGA5", None, None, DANI)
    assert r["importados"] == 1 and r["ya_estaban"] == 4
    assert r["de_baja"] == 2 and r["nombres_de_baja"] == ["JUAN REY", "PACO SIN FECHA"]
    assert len(bajas["drivers"].docs) == antes + 1                       # nunca una segunda ficha
    assert _ficha(bajas, "d-juan")["active"] is False                     # ni se reactiva sola


@pytest.mark.asyncio(loop_scope="session")
async def test_e6_importar_un_nombre_con_una_viva_y_una_baja_no_es_de_baja(bajas, monkeypatch):
    bajas["drivers"].docs.append({"id": "d-luis-v", "name": "LUIS PAZ", "center": "DGA1", "active": False})
    _importacion(monkeypatch, [["Nombre"], ["Luis Paz"], ["Fusionada"]])
    prev = await server.drivers_importar_prev(_Fich(), "", DANI)
    assert prev["ya_estaban"] == 2 and prev["de_baja"] == 0


# ══════════════════════════════════════════════════════════════════════ historia-10

@pytest.mark.parametrize("valor, sale", [
    (datetime(2027, 3, 1, 10, 30), "2027-03-01"), (date(2027, 3, 1), "2027-03-01"), ("2027-03-01", "2027-03-01"),
    ("2027-03-01T00:00:00+00:00", "2027-03-01"), (" 2027-03-01 ", "2027-03-01"), ("31/12/2026", None), (123, None),
    ("", None), ("mañana", None), ("2027-02-30", None), ("2027-03-011", None), ([], None), ({"a": 1}, None)])
def test_h10_el_modelo_nunca_tumba_la_lista(valor, sale):
    assert server.Driver(id="d", name="X", license_expiry=valor).license_expiry == sale


@pytest.mark.asyncio(loop_scope="session")
async def test_h10_get_drivers_devuelve_la_fecha_y_tolera_las_raras(base):
    _ficha(base, "d-ana")["license_expiry"] = "2027-03-01"
    _ficha(base, "d-luis")["license_expiry"] = "31/12/2026"
    por_id = {d["id"]: server.Driver(**d).model_dump() for d in await server.get_drivers(None, DANI)}
    assert por_id["d-ana"]["license_expiry"] == "2027-03-01" and por_id["d-luis"]["license_expiry"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_h10_patch_guarda_quita_y_rechaza(base):
    await server.update_driver("d-ana", {"license_expiry": "2027-03-01"}, DANI)
    assert _ficha(base, "d-ana")["license_expiry"] == "2027-03-01"
    await server.update_driver("d-ana", {"license_expiry": "", "phone": "600"}, DANI)
    assert "license_expiry" not in _ficha(base, "d-ana")
    for malo in ("mañana", "31/12/2026", 123):
        with pytest.raises(HTTPException) as e:
            await server.update_driver("d-ana", {"license_expiry": malo}, DANI)
        assert e.value.status_code == 400 and "carnet" in e.value.detail


@pytest.mark.asyncio(loop_scope="session")
async def test_h10_un_valor_viejo_raro_no_se_borra_al_guardar_la_ficha(base):
    """La pantalla lo ve vacío (el modelo lo da como None) y manda null al guardar: no se toca."""
    _ficha(base, "d-luis")["license_expiry"] = "31/12/2026"
    await server.update_driver("d-luis", {"license_expiry": None, "phone": "611"}, DANI)
    assert _ficha(base, "d-luis")["license_expiry"] == "31/12/2026"


@pytest.mark.asyncio(loop_scope="session")
async def test_h10_alta_con_fecha_vacia_o_mala(base):
    d = await server.create_driver(server.DriverCreate(name="Eva Sol", license_expiry="2028-01-15"), admin=DANI)
    assert d.license_expiry == "2028-01-15" and _ficha(base, d.id)["license_expiry"] == "2028-01-15"
    d2 = await server.create_driver(server.DriverCreate(name="Eva Dos", license_expiry=""), admin=DANI)
    assert d2.license_expiry is None
    d3 = await server.create_driver(server.DriverCreate(name="Eva Tres"), admin=DANI)
    assert d3.license_expiry is None
    with pytest.raises(HTTPException) as e:
        await server.create_driver(server.DriverCreate(name="Eva Mal", license_expiry="15/01/2028"), admin=DANI)
    assert e.value.status_code == 400


# ══════════════════════════════════════════════════════════════════════ equipo-5

@pytest.fixture
def app_movil(base, monkeypatch):
    base["drivers"].docs += [
        {"id": "d-eva", "name": "EVA DGA2", "center": "DGA2", "active": True},
        {"id": "d-sin", "name": "SIN NAVE", "center": "", "active": True},
        {"id": "d-baja", "name": "DE BAJA", "center": "OGA5", "active": False},
    ]
    server.global_db["push_tokens"] = Col([
        # Ana: dos móviles, se queda el más reciente.
        {"user_id": "d-ana", "role": "driver", "db_name": server._DEFAULT_DB_NAME, "plataforma": "android",
         "app": "2.4.3", "token": "t1", "updated_at": "2026-11-01T08:00:00+00:00"},
        {"user_id": "d-ana", "role": "driver", "db_name": server._DEFAULT_DB_NAME, "plataforma": "android",
         "app": "2.4.6", "token": "t2", "updated_at": "2026-11-10T08:12:00+00:00"},
        # Luis: un registro de OTRA base con su mismo id (no cuenta) y uno sin db_name con otro org_id (tampoco).
        {"user_id": "d-luis", "role": "driver", "db_name": "dsp_otra", "app": "2.4.6", "updated_at": "2026-11-10T09:00:00"},
        {"user_id": "d-luis", "role": "driver", "org_id": "otra", "app": "2.4.6", "updated_at": "2026-11-10T09:00:00"},
        # Eva: role de admin con su id (no es la app del conductor).
        {"user_id": "d-eva", "role": "admin", "db_name": server._DEFAULT_DB_NAME, "app": "2.4.6",
         "updated_at": "2026-11-10T09:00:00"},
        # La sin nave: un registro viejo sin db_name ni org_id (de antes): cuenta.
        {"user_id": "d-sin", "role": "driver", "app": "2.3.0", "updated_at": "2026-10-01T09:00:00"},
        # La de baja tiene la app, pero no sale en la lista.
        {"user_id": "d-baja", "role": "driver", "db_name": server._DEFAULT_DB_NAME, "app": "2.4.6",
         "updated_at": "2026-11-10T09:00:00"},
    ])
    monkeypatch.setenv("APP_ANDROID_PLAY", "26 2.4.6")
    monkeypatch.setenv("APP_ANDROID_WEB", "30 2.4.10")
    return base


@pytest.mark.asyncio(loop_scope="session")
async def test_e5_quien_tiene_la_app_el_mas_reciente_y_solo_de_esta_base(app_movil):
    r = await server.get_drivers_app(None, {**DANI, "org_id": "o1"})
    assert r["ultima"] == "2.4.10"                                      # número a número, no como texto
    assert set(r["conductores"]) == {"d-ana", "d-sin"}
    assert r["conductores"]["d-ana"] == {"app": "2.4.6", "plataforma": "android", "visto": "2026-11-10T08:12:00+00:00"}
    assert r["conductores"]["d-sin"]["app"] == "2.3.0"


@pytest.mark.asyncio(loop_scope="session")
async def test_e5_con_nave_solo_los_suyos_y_los_sin_nave(app_movil):
    r = await server.get_drivers_app("DGA1", DANI)
    assert set(r["conductores"]) == {"d-sin"}
    jefe = {"sub": "a2", "role": "admin", "name": "Marta", "account_type": "dsp", "allowed_centers": ["DGA1"]}
    with pytest.raises(HTTPException) as e:
        await server.get_drivers_app("OGA5", jefe)
    assert e.value.status_code == 403


@pytest.mark.asyncio(loop_scope="session")
async def test_e5_sin_versiones_publicadas_ultima_es_null(app_movil, monkeypatch):
    monkeypatch.delenv("APP_ANDROID_PLAY", raising=False)
    monkeypatch.delenv("APP_ANDROID_WEB", raising=False)
    r = await server.get_drivers_app(None, DANI)
    assert r["ultima"] is None and "d-ana" in r["conductores"]


@pytest.mark.asyncio(loop_scope="session")
async def test_e5_sin_conductores_no_mira_push_tokens(base):
    class _Prohibida(Col):
        def find(self, *a, **k):
            raise AssertionError("no hace falta mirar push_tokens")
    base["drivers"].docs.clear()
    server.global_db["push_tokens"] = _Prohibida([])
    assert (await server.get_drivers_app(None, DANI))["conductores"] == {}


# ══════════════════════════════════════════════════════════════════════ equipo-11

@pytest.fixture
def onb(base, monkeypatch):
    base["drivers"].docs += [
        {"id": "d-dni", "name": "DANI DNI", "center": "OGA5", "active": True, "dni": "12345678-z"},
        {"id": "d-tel", "name": "TOMÁS TEL", "center": "DGA1", "active": True, "phone": "+34 611 22 33 44"},
        {"id": "d-movil", "name": "MÓNICA MÓVIL", "center": "DGA1", "active": True, "movil_personal": "+34622334455"},
        {"id": "d-juan-baja", "name": "JUAN REY", "email": "juan@x.test", "center": "OGA5", "active": False},
        {"id": "d-fus", "name": "FUSIONADA", "dni": "99999999R", "center": "OGA5", "active": False,
         "merged_into": "d-ana", "status": "fusionada"},
    ]
    base["incorporaciones"] = Col([
        {"id": "p-dni", "nombre": "DANIEL DNI", "telefono": "699000001", "dni": "12345678Z", "centro": "OGA5"},
        {"id": "p-correo", "nombre": "ANA RÍOS", "telefono": "699000002", "email": "ANA@x.test", "centro": "OGA5"},
        {"id": "p-tel", "nombre": "TOMÁS T.", "telefono": "611223344", "centro": "DGA1"},
        {"id": "p-movil", "nombre": "MONI", "telefono": "622334455", "centro": "DGA1"},
        {"id": "p-nueva", "nombre": "  NUEVA   PERSONA ", "telefono": "699000003", "dni": "11111111H",
         "email": "cuenta.ett@ett.test", "centro": "OGA5"},
        {"id": "p-baja", "nombre": "JUAN REY", "telefono": "699000004", "email": "juan@x.test", "centro": "OGA5"},
        {"id": "p-fus", "nombre": "FUSI", "telefono": "699000005", "dni": "99999999R", "centro": "OGA5"},
        {"id": "p-sin", "nombre": "SIN NAVE", "telefono": "699000006", "centro": ""},
    ])

    async def _plantilla():
        return {"motivos": {}}
    monkeypatch.setattr(server, "_onb_plantilla", _plantilla)
    return base


@pytest.mark.asyncio(loop_scope="session")
async def test_e11_la_lista_dice_quien_tiene_ya_ficha(onb):
    r = await server.onb_listar(None, DANI)
    fichas = {p["id"]: p["ficha"] for p in r["personas"]}
    assert fichas["p-dni"] == {"id": "d-dni", "nombre": "DANI DNI", "centro": "OGA5", "por": "dni"}
    assert fichas["p-correo"]["id"] == "d-ana" and fichas["p-correo"]["por"] == "correo"
    assert fichas["p-tel"]["id"] == "d-tel" and fichas["p-tel"]["por"] == "telefono"
    assert fichas["p-movil"]["id"] == "d-movil" and fichas["p-movil"]["por"] == "telefono"
    # Las fusionadas no cuentan. Las de baja sí, dichas como tales (segunda revisión, F2: antes daba None).
    assert fichas["p-nueva"] is None and fichas["p-fus"] is None
    assert fichas["p-baja"] == {"id": "d-juan-baja", "nombre": "JUAN REY", "centro": "OGA5", "por": "correo",
                                "baja": True}
    # Y lo de siempre no cambia: el camino y los contadores siguen ahí, igual.
    assert all("camino" in p and "columna" in p for p in r["personas"])


@pytest.mark.asyncio(loop_scope="session")
async def test_e11_si_mirar_las_fichas_falla_la_lista_sale_igual(onb, monkeypatch):
    async def _rota():
        raise RuntimeError("sin base")
    monkeypatch.setattr(server, "_onb_casar_fichas", _rota)
    r = await server.onb_listar(None, DANI)
    assert len(r["personas"]) == 8 and all(p["ficha"] is None for p in r["personas"])


@pytest.mark.asyncio(loop_scope="session")
async def test_e11_si_ya_la_tiene_se_enlaza_y_la_siguiente_lista_lo_dice(onb):
    r = await server.onb_ficha_conductor("p-dni", {}, DANI)
    assert r["ya_tenia"] is True and r["ficha"] == {"id": "d-dni", "name": "DANI DNI", "center": "OGA5"}
    assert (await onb["incorporaciones"].find_one({"id": "p-dni"}))["driver_id"] == "d-dni"
    fichas = {p["id"]: p["ficha"] for p in (await server.onb_listar(None, DANI))["personas"]}
    assert fichas["p-dni"]["por"] == "enlazada"
    antes = len(onb["drivers"].docs)
    await server.onb_ficha_conductor("p-correo", {}, DANI)
    assert len(onb["drivers"].docs) == antes                     # no se crea ninguna


@pytest.mark.asyncio(loop_scope="session")
async def test_e11_por_telefono_no_se_enlaza_sola_y_se_crea_otra(onb):
    r = await server.onb_ficha_conductor("p-tel", {}, DANI)
    assert r["ya_tenia"] is False and r["ficha"]["id"] != "d-tel"


@pytest.mark.asyncio(loop_scope="session")
async def test_e11_crear_sin_correo_no_crea_cuenta(onb, monkeypatch):
    async def _inicial(_user):
        return {"hash": server.hash_password("inicial-de-prueba-1")}
    monkeypatch.setattr(server, "_contrasena_inicial", _inicial)
    r = await server.onb_ficha_conductor("p-nueva", {}, DANI)
    f = _ficha(onb, r["ficha"]["id"])
    assert f["name"] == "NUEVA PERSONA" and f["phone"] == "699000003" and f["dni"] == "11111111H"
    assert f["center"] == "OGA5" and not f.get("email")
    assert onb["driver_accounts"].docs == []
    p = await onb["incorporaciones"].find_one({"id": "p-nueva"})
    assert p["driver_id"] == f["id"] and p["ficha_por"] == "Dani" and p["ficha_en"]


@pytest.mark.asyncio(loop_scope="session")
async def test_e11_con_usar_correo_y_contrasena_inicial_crea_su_cuenta(onb, monkeypatch):
    async def _inicial(_user):
        return {"hash": server.hash_password("inicial-de-prueba-1")}
    monkeypatch.setattr(server, "_contrasena_inicial", _inicial)
    r = await server.onb_ficha_conductor("p-nueva", {"usar_correo": True}, DANI)
    assert _ficha(onb, r["ficha"]["id"])["email"] == "cuenta.ett@ett.test"
    [cuenta] = onb["driver_accounts"].docs
    assert cuenta["driver_id"] == r["ficha"]["id"]


@pytest.mark.asyncio(loop_scope="session")
async def test_e11_correo_de_una_baja_da_el_409_de_reactivar_y_con_nueva_crea(onb):
    with pytest.raises(HTTPException) as e:
        await server.onb_ficha_conductor("p-baja", {"usar_correo": True}, DANI)
    assert e.value.status_code == 409 and e.value.detail["reactivar_id"] == "d-juan-baja"
    assert "driver_id" not in await onb["incorporaciones"].find_one({"id": "p-baja"})
    # «Es otra persona» (nueva=true), como en Conductores: se crea con el correo.
    r = await server.onb_ficha_conductor("p-baja", {"usar_correo": True, "nueva": True}, DANI)
    assert r["ya_tenia"] is False and _ficha(onb, r["ficha"]["id"])["email"] == "juan@x.test"


@pytest.mark.asyncio(loop_scope="session")
async def test_e11_la_nave_la_elige_la_oficina_y_se_respeta_quien_la_ve(onb):
    r = await server.onb_ficha_conductor("p-sin", {"centro": "dga2"}, DANI)
    assert _ficha(onb, r["ficha"]["id"])["center"] == "DGA2"
    jefe = {"sub": "a2", "role": "admin", "name": "Marta", "account_type": "dsp", "allowed_centers": ["DGA1"]}
    with pytest.raises(HTTPException) as e:
        await server.onb_ficha_conductor("p-nueva", {}, jefe)
    assert e.value.status_code == 403
    with pytest.raises(HTTPException) as e:
        await server.onb_ficha_conductor("p-nadie", {}, DANI)
    assert e.value.status_code == 404


# ══════════════════════════════════════════════════════════════════════ F2, F10, F13 (segunda revisión)

@pytest.mark.asyncio(loop_scope="session")
async def test_f2_quien_vuelve_con_su_ficha_de_baja_no_se_duplica(onb):
    """Por correo (sin marcar la casilla) o por DNI: el 409 de reactivar, como create_driver; nunca otra ficha."""
    onb["drivers"].docs.append({"id": "d-rosa-baja", "name": "ROSA VUELVE", "center": "OGA5", "active": False,
                                "dni": "22222222J"})
    onb["incorporaciones"].docs.append({"id": "p-rosa", "nombre": "ROSA VUELVE", "telefono": "699000009",
                                        "dni": "22222222-j", "centro": "OGA5"})
    antes = len(onb["drivers"].docs)
    for pid, did in (("p-baja", "d-juan-baja"), ("p-rosa", "d-rosa-baja")):
        with pytest.raises(HTTPException) as e:
            await server.onb_ficha_conductor(pid, {}, DANI)
        d = e.value.detail
        assert e.value.status_code == 409 and d["reactivar_id"] == did and d["nombre"] and d["mensaje"]
        assert "driver_id" not in await onb["incorporaciones"].find_one({"id": pid})
    assert len(onb["drivers"].docs) == antes
    # Reactivada, la siguiente vez se enlaza (es lo que hace el panel después de reactivar).
    await server.reactivar_driver("d-rosa-baja", {}, DANI)
    r = await server.onb_ficha_conductor("p-rosa", {}, DANI)
    assert r["ya_tenia"] is True and r["ficha"]["id"] == "d-rosa-baja" and r["por"] == "dni"
    # «Es otra persona» (nueva: true): se crea, como antes.
    r = await server.onb_ficha_conductor("p-baja", {"nueva": True}, DANI)
    assert r["ya_tenia"] is False and r["ficha"]["id"] != "d-juan-baja"


@pytest.mark.asyncio(loop_scope="session")
async def test_f2_una_viva_gana_a_una_de_baja_y_la_fusionada_no_cuenta(onb):
    onb["drivers"].docs.append({"id": "d-dni-baja", "name": "DANI DNI VIEJA", "center": "OGA5", "active": False,
                                "dni": "12345678Z"})
    fichas = {p["id"]: p["ficha"] for p in (await server.onb_listar(None, DANI))["personas"]}
    assert fichas["p-dni"]["id"] == "d-dni" and "baja" not in fichas["p-dni"]
    assert fichas["p-fus"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_f13_enlazar_tambien_deja_rastro(onb):
    await server.onb_ficha_conductor("p-dni", {}, DANI)
    [a] = [a for a in onb["audit_log"].docs if a["action"] == "onb_ficha_conductor"]
    assert a["detail"] == {"persona": "p-dni", "driver_id": "d-dni", "por": "dni"}


@pytest.mark.asyncio(loop_scope="session")
async def test_f10_un_usuario_limitado_no_ve_fichas_de_otras_naves(onb):
    onb["incorporaciones"].docs.append({"id": "p-tel-oga5", "nombre": "PISTA", "telefono": "699 000 001",
                                        "centro": "DGA1"})
    onb["drivers"].docs.append({"id": "d-tel-oga5", "name": "TEL OGA5", "center": "OGA5", "active": True,
                                "phone": "699000001"})
    fichas = {p["id"]: p["ficha"] for p in (await server.onb_listar(None, JEFE_DGA1))["personas"]}
    assert fichas["p-dni"] == {"por": "dni", "centro": "OGA5"}                     # OGA5: ni id ni nombre
    assert fichas["p-baja"] == {"por": "correo", "centro": "OGA5", "baja": True}
    assert fichas["p-tel"]["id"] == "d-tel" and fichas["p-tel"]["nombre"]           # DGA1, la suya: entera
    assert fichas["p-tel-oga5"] is None                                            # la pista por teléfono, nada
    # Al enlazar, la respuesta tampoco dice id ni nombre.
    r = await server.onb_ficha_conductor("p-dni", {}, JEFE_DGA1)
    assert r["ya_tenia"] is True and r["ficha"] == {"center": "OGA5"}
    # Para el dueño, todo igual que antes.
    fichas = {p["id"]: p["ficha"] for p in (await server.onb_listar(None, DANI))["personas"]}
    assert fichas["p-tel-oga5"]["id"] == "d-tel-oga5" and fichas["p-dni"]["nombre"] == "DANI DNI"


@pytest.mark.asyncio(loop_scope="session")
async def test_f10_el_409_de_reactivar_por_correo_sin_abrir_id_si_no_ve_la_nave(bajas):
    bajas["drivers"].docs.append({"id": "d-vieja-oga5", "name": "PACO OGA5", "email": "paco@x.test", "center": "OGA5",
                                  "active": True})
    _ficha(bajas, "d-vieja")["email"] = "Paco@x.test"                              # de baja en DGA1
    with pytest.raises(HTTPException) as e:
        await server.reactivar_driver("d-vieja", {}, JEFE_DGA1)
    d = e.value.detail
    assert e.value.status_code == 409 and d["conflicto"] == "correo"
    assert "abrir_id" not in d and "nombre" not in d and "PACO OGA5" not in d["mensaje"]
    with pytest.raises(HTTPException) as e:
        await server.reactivar_driver("d-vieja", {}, DANI)
    assert e.value.detail["abrir_id"] == "d-vieja-oga5" and e.value.detail["nombre"] == "PACO OGA5"


# ══════════════════════════════════════════════════════════════════════ F3 (segunda revisión)

@pytest.mark.asyncio(loop_scope="session")
async def test_f3_reactivar_con_el_id_en_el_campo_viejo_driver_id(bajas):
    """El ID de reparto guardado en `driver_id` (gotcha 79) también se comprueba, y con quitar_id se vacía ESE campo."""
    _ficha(bajas, "d-juan")["driver_id"] = " aaaaa11111bb "                   # el de Ana (viva), en el campo viejo
    with pytest.raises(HTTPException) as e:
        await server.reactivar_driver("d-juan", {}, DANI)
    d = e.value.detail
    assert e.value.status_code == 409 and d["conflicto"] == "id_reparto" and d["abrir_id"] == "d-ana"
    assert d["transporter_id"] == TID_A and _ficha(bajas, "d-juan")["active"] is False
    await server.reactivar_driver("d-juan", {"quitar_id": True}, DANI)
    f = _ficha(bajas, "d-juan")
    assert f["active"] is True and "driver_id" not in f
    [a] = _apuntes(bajas)
    assert a["transporter_id"] == TID_A and a["antes"][0]["campos"] == ["driver_id"]


@pytest.mark.asyncio(loop_scope="session")
async def test_f3_el_patch_que_reactiva_tambien_mira_driver_id(bajas):
    _ficha(bajas, "d-juan")["driver_id"] = TID_A
    with pytest.raises(HTTPException) as e:
        await server.update_driver("d-juan", {"active": True}, DANI)
    assert e.value.status_code == 409 and e.value.detail["abrir_id"] == "d-ana"
    assert _ficha(bajas, "d-juan")["active"] is False
    # Un nº de empleado normal en `driver_id` no es un ID de reparto: no se mira.
    _ficha(bajas, "d-juan")["driver_id"] = "EMP-0042"
    await server.update_driver("d-juan", {"active": True}, DANI)
    assert _ficha(bajas, "d-juan")["active"] is True


# ══════════════════════════════════════════════════════════════════════ F4 + F7 + F14 + F13 (segunda revisión)

FORM_JUAN = {"name": "JUAN REY", "email": "juan@x.test", "phone": "600123123", "center": "DGA1", "dni": "",
             "license_number": "", "license_expiry": None, "transporter_id": "", "driver_id": "", "contrato": "empresa",
             "nivel": "pleno", "zona": "", "alojamiento": "", "notas": "", "movil_personal": "", "login": ""}


@pytest.mark.asyncio(loop_scope="session")
async def test_f4_el_flujo_de_main_un_jefe_reactiva_desde_el_alta_a_quien_viene_de_otra_nave(bajas, monkeypatch):
    """Jefe limitado a DGA1; Juan tiene su ficha de baja en OGA5. El alta da el 409 de reactivar y «reactivar su
    ficha» manda el formulario entero con su nave (DGA1) y active: true: 200, y la ficha queda en DGA1 con su apunte."""
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)
    with pytest.raises(HTTPException) as e:
        await server.create_driver(server.DriverCreate(name="Juan Rey", email="juan@x.test", center="DGA1"),
                                   admin=JEFE_DGA1)
    assert e.value.status_code == 409 and e.value.detail["reactivar_id"] == "d-juan"
    r = await server.update_driver("d-juan", {**FORM_JUAN, "active": True}, JEFE_DGA1)
    assert r["success"] is True and r["centro_cambiado"] == {"de": "OGA5", "a": "DGA1"}
    f = _ficha(bajas, "d-juan")
    assert f["active"] is True and f["center"] == "DGA1" and "baja_en" not in f and "baja_por" not in f
    [h] = f["historial_centros"]
    assert (h["de"], h["a"], h["desde"], h["programado_por"]) == ("OGA5", "DGA1", HOY, "Marta")
    [a] = [a for a in bajas["audit_log"].docs if a["action"] == "driver_reactivar"]
    assert a["detail"]["baja_en"] == "2026-11-05T10:00:00+00:00" and a["detail"]["baja_por"] == "Dani"


@pytest.mark.asyncio(loop_scope="session")
async def test_f4_reactivar_sin_ver_la_nave_en_la_que_queda_da_403(bajas):
    # Sin centro en el cuerpo, queda en la suya (OGA5), que no ve.
    with pytest.raises(HTTPException) as e:
        await server.update_driver("d-juan", {"active": True}, JEFE_DGA1)
    assert e.value.status_code == 403
    with pytest.raises(HTTPException) as e:
        await server.update_driver("d-juan", {**FORM_JUAN, "center": "OGA5", "active": True}, JEFE_DGA1)
    assert e.value.status_code == 403
    with pytest.raises(HTTPException) as e:
        await server.reactivar_driver("d-juan", {}, JEFE_DGA1)
    assert e.value.status_code == 403
    assert _ficha(bajas, "d-juan")["active"] is False and "historial_centros" not in _ficha(bajas, "d-juan")


@pytest.mark.asyncio(loop_scope="session")
async def test_f4_una_fusionada_o_borrada_no_se_reactiva_por_el_patch(bajas):
    for did in ("d-fus", "d-borr"):
        with pytest.raises(HTTPException) as e:
            await server.update_driver(did, {"active": True}, DANI)
        assert e.value.status_code == 400 and _ficha(bajas, did)["active"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_f4_a_una_activa_de_otra_nave_sigue_sin_poder_cambiarle_la_nave(bajas):
    with pytest.raises(HTTPException) as e:
        await server.update_driver("d-ana", {"center": "DGA1", "active": True}, JEFE_DGA1)
    assert e.value.status_code == 403 and _ficha(bajas, "d-ana")["center"] == "OGA5"


@pytest.mark.asyncio(loop_scope="session")
async def test_f4_post_reactivar_con_la_nave_de_destino(bajas, monkeypatch):
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)
    _ficha(bajas, "d-juan")["historial_centros"] = None                  # una de antes del arreglo F1
    r = await server.reactivar_driver("d-juan", {"center": "DGA1"}, JEFE_DGA1)
    f = _ficha(bajas, "d-juan")
    assert r["ok"] and f["active"] is True and f["center"] == "DGA1"
    assert [(h["de"], h["a"]) for h in f["historial_centros"]] == [("OGA5", "DGA1")]
    acciones = {a["action"]: a["detail"] for a in bajas["audit_log"].docs}
    assert acciones["driver_reactivar"]["baja_por"] == "Dani" and acciones["driver_reactivar"]["centro"]["a"] == "DGA1"
    assert acciones["driver_centro"] == {"driver_id": "d-juan", "de": "OGA5", "a": "DGA1"}
    # En su misma nave no se apunta ningún cambio.
    await server.reactivar_driver("d-vieja", {"center": "dga1"}, JEFE_DGA1)
    assert "historial_centros" not in _ficha(bajas, "d-vieja") and _ficha(bajas, "d-vieja")["center"] == "DGA1"


# ══════════════════════════════════════════════════════════════════════ F8 (segunda revisión)

@pytest.mark.asyncio(loop_scope="session")
async def test_f8_el_alias_put_hace_lo_mismo_que_el_patch(bajas):
    # Un campo que el PATCH no admite no se escribe.
    r = await server.put_driver("d-ana", {"name": "ANA RÍOS", "historial_centros": "falso", "baja_en": "x"}, DANI)
    assert r == {"success": True}
    f = _ficha(bajas, "d-ana")
    assert "historial_centros" not in f and "baja_en" not in f
    # Las mismas comprobaciones: la nave de un usuario limitado y el ID de reparto repetido.
    with pytest.raises(HTTPException) as e:
        await server.put_driver("d-luis", {"center": "OGA5"}, JEFE_DGA1)
    assert e.value.status_code == 403
    with pytest.raises(HTTPException) as e:
        await server.put_driver("d-luis", {"transporter_id": TID_A}, DANI)
    assert e.value.status_code == 409
    # Y la misma respuesta al cambiar de nave, con su apunte.
    r = await server.put_driver("d-luis", {"center": "DGA2"}, DANI)
    assert r["centro_cambiado"] == {"de": "DGA1", "a": "DGA2"} and len(_ficha(bajas, "d-luis")["historial_centros"]) == 1


# ══════════════════════════════════════════════════════════════════════ F5 + F6 (segunda revisión)

@pytest.mark.asyncio(loop_scope="session")
async def test_f5_hoja_reactivar_y_baja_de_la_oficina_dice_de_baja_desde(bajas):
    """La hoja la sacó (desactivada_por 'hoja'), la oficina la reactivó y luego la dio de baja desde el panel."""
    await server.reactivar_driver("d-hoja", {}, DANI)
    assert _ficha(bajas, "d-hoja")["desactivada_por"] == "hoja"            # la sincronización lo sigue viendo
    await server.delete_driver("d-hoja", {**DANI, "name": "Fran"})
    hoja = next(f for f in await server.get_drivers_bajas(None, DANI) if f["id"] == "d-hoja")
    assert hoja["origen"] == "oficina" and hoja["baja_por"] == "Fran"
    assert hoja["baja_en"] == _ficha(bajas, "d-hoja")["baja_en"]


@pytest.mark.parametrize("ficha, origen, fecha", [
    ({"desactivada_por": "hoja", "desactivada_en": "2026-11-08T21:00:00+00:00"}, "hoja", "2026-11-08T21:00:00+00:00"),
    ({"baja_en": "2026-11-05T10:00:00+00:00", "baja_por": "Dani"}, "oficina", "2026-11-05T10:00:00+00:00"),
    # Las dos: manda la más reciente (comparando el momento, no el texto).
    ({"baja_en": "2026-11-05T10:00:00+00:00", "desactivada_por": "hoja", "desactivada_en": "2026-11-08T21:00:00+00:00"},
     "hoja", "2026-11-08T21:00:00+00:00"),
    ({"baja_en": "2026-11-09T10:00:00+00:00", "desactivada_por": "hoja", "desactivada_en": "2026-11-08T21:00:00+00:00"},
     "oficina", "2026-11-09T10:00:00+00:00"),
    ({"baja_en": "2026-11-09T00:30:00+01:00", "desactivada_por": "hoja", "desactivada_en": "2026-11-08T23:45:00+00:00"},
     "hoja", "2026-11-08T23:45:00+00:00"),
    ({"desactivada_por": "hoja"}, "hoja", None),
    ({}, None, None)])
def test_f5_el_origen_lo_resuelve_el_servidor(ficha, origen, fecha):
    assert server._baja_origen(ficha) == (origen, fecha)


@pytest.mark.asyncio(loop_scope="session")
async def test_f5_si_gana_la_hoja_no_se_dice_quien_de_la_oficina(bajas):
    _ficha(bajas, "d-hoja").update({"baja_en": "2026-10-01T10:00:00+00:00", "baja_por": "Dani"})
    hoja = next(f for f in await server.get_drivers_bajas(None, DANI) if f["id"] == "d-hoja")
    assert hoja["origen"] == "hoja" and hoja["baja_por"] is None and hoja["baja_en"] == "2026-11-08T21:00:00+00:00"


# ══════════════════════════════════════════════════════════════════════ F11 (segunda revisión)

@pytest.mark.asyncio(loop_scope="session")
async def test_f11_el_registro_de_esta_base_gana_a_uno_sin_base_mas_reciente(app_movil):
    server.global_db["push_tokens"].docs.append(
        {"user_id": "d-ana", "role": "driver", "app": "1.0.0", "updated_at": "2026-11-11T08:00:00+00:00"})
    r = await server.get_drivers_app(None, DANI)
    assert r["conductores"]["d-ana"]["app"] == "2.4.6"
    # Sin ninguno de esta base, el sin base sí cuenta (apps viejas).
    assert r["conductores"]["d-sin"]["app"] == "2.3.0"


# ══════════════════════════════════════════════════════════════════════ W1 a W4 (tercera revisión, 11-11-2026)

@pytest.mark.asyncio(loop_scope="session")
async def test_w1_el_rodeo_de_la_baja_da_403_en_el_primer_paso(bajas):
    """Un jefe limitado a DGA1 no puede dar de baja a Ana, ACTIVA en OGA5, para luego reactivarla en DGA1: ni con
    «Dar de baja» (DELETE), ni con el PATCH o el PUT con active:false. Y no se escribe nada."""
    for dar_de_baja in (lambda: server.delete_driver("d-ana", JEFE_DGA1),
                        lambda: server.update_driver("d-ana", {"active": False}, JEFE_DGA1),
                        lambda: server.put_driver("d-ana", {"active": False, "phone": "611"}, JEFE_DGA1)):
        with pytest.raises(HTTPException) as e:
            await dar_de_baja()
        assert e.value.status_code == 403 and e.value.detail == "No tienes acceso a ese centro"
    f = _ficha(bajas, "d-ana")
    assert f["active"] is True and "baja_en" not in f and "baja_por" not in f and "phone" not in f
    assert bajas["correo_personal_limpiado"].docs == [] and bajas["audit_log"].docs == []
    # El segundo paso del rodeo ya no tiene nada que reactivar.
    with pytest.raises(HTTPException) as e:
        await server.reactivar_driver("d-ana", {"center": "DGA1"}, JEFE_DGA1)
    assert e.value.status_code == 400 and _ficha(bajas, "d-ana")["center"] == "OGA5"


@pytest.mark.asyncio(loop_scope="session")
async def test_w1_en_su_nave_y_sin_nave_se_da_de_baja_como_siempre(bajas):
    bajas["drivers"].docs += [
        {"id": "d-dga1b", "name": "OTRO DGA1", "center": "dga1 ", "active": True},
        {"id": "d-sin-nave", "name": "SIN NAVE ACTIVO", "center": "", "active": True},
        {"id": "d-blanco", "name": "NAVE EN BLANCO", "center": "  ", "active": True}]
    await server.delete_driver("d-luis", JEFE_DGA1)                              # «Dar de baja» en Conductores
    await server.update_driver("d-dga1b", {"active": False}, JEFE_DGA1)          # el cuadrante
    await server.put_driver("d-sin-nave", {"active": False}, JEFE_DGA1)
    await server.delete_driver("d-blanco", JEFE_DGA1)                            # sale en su lista, como las sin centro
    for did in ("d-luis", "d-dga1b", "d-sin-nave", "d-blanco"):
        f = _ficha(bajas, did)
        assert f["active"] is False and f["baja_por"] == "Marta", did
    # Una que YA está de baja en otra nave: como antes (no es dar de baja a una activa) y sin pisar la fecha.
    await server.delete_driver("d-juan", JEFE_DGA1)
    assert _ficha(bajas, "d-juan")["baja_en"] == "2026-11-05T10:00:00+00:00"
    # Y la que no existe sigue dando 404.
    with pytest.raises(HTTPException) as e:
        await server.delete_driver("d-nadie", JEFE_DGA1)
    assert e.value.status_code == 404


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("quien", [DANI, {**JEFE_DGA1, "allowed_centers": []}, {**JEFE_DGA1, "sa": True}])
async def test_w1_el_duenio_el_superadmin_y_quien_no_tiene_naves_igual_que_antes(bajas, quien):
    await server.delete_driver("d-ana", quien)
    assert _ficha(bajas, "d-ana")["active"] is False
    _ficha(bajas, "d-ana")["active"] = True
    await server.update_driver("d-ana", {"active": False}, quien)
    assert _ficha(bajas, "d-ana")["active"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_w4_el_patch_que_reactiva_mira_el_correo_como_reactivar(bajas):
    bajas["drivers"].docs.append({"id": "d-juan2", "name": "JUAN REY", "email": "JUAN@X.test", "center": "OGA5",
                                  "active": True})
    with pytest.raises(HTTPException) as e:
        await server.update_driver("d-juan", {"active": True}, DANI)              # el asistente reactiva así
    d = e.value.detail
    assert e.value.status_code == 409 and d["conflicto"] == "correo" and d["abrir_id"] == "d-juan2"
    assert _ficha(bajas, "d-juan")["active"] is False and "baja_en" in _ficha(bajas, "d-juan")
    # El correo que QUEDA es el del cuerpo si viene: uno que no tiene nadie, pasa.
    await server.update_driver("d-juan", {"email": "juan.nuevo@x.test", "active": True}, DANI)
    assert _ficha(bajas, "d-juan")["active"] is True and _ficha(bajas, "d-juan")["email"] == "juan.nuevo@x.test"


@pytest.mark.asyncio(loop_scope="session")
async def test_w4_con_el_correo_del_cuerpo_de_otra_activa_tambien_da_409(bajas):
    with pytest.raises(HTTPException) as e:
        await server.update_driver("d-juan", {"email": " Ana@X.TEST ", "active": True}, DANI)
    assert e.value.status_code == 409 and e.value.detail["abrir_id"] == "d-ana"
    assert _ficha(bajas, "d-juan")["active"] is False and _ficha(bajas, "d-juan")["email"] == "juan@x.test"


@pytest.mark.asyncio(loop_scope="session")
async def test_w4_sin_ver_la_nave_de_la_otra_el_409_va_sin_abrir_id(bajas):
    bajas["drivers"].docs.append({"id": "d-vieja-oga5", "name": "PACO OGA5", "email": "paco@x.test", "center": "OGA5",
                                  "active": True})
    _ficha(bajas, "d-vieja")["email"] = "Paco@x.test"                              # de baja en DGA1
    with pytest.raises(HTTPException) as e:
        await server.update_driver("d-vieja", {"active": True}, JEFE_DGA1)
    d = e.value.detail
    assert e.value.status_code == 409 and d["conflicto"] == "correo" and d["centro"] == "OGA5"
    assert "abrir_id" not in d and "nombre" not in d and "PACO OGA5" not in d["mensaje"]
    assert _ficha(bajas, "d-vieja")["active"] is False
    with pytest.raises(HTTPException) as e:
        await server.update_driver("d-vieja", {"active": True}, DANI)
    assert e.value.detail["abrir_id"] == "d-vieja-oga5"


@pytest.mark.asyncio(loop_scope="session")
async def test_w4_el_flujo_del_alta_con_su_propio_correo_sigue_dando_200(bajas, monkeypatch):
    """El 409 de «ya tiene una ficha de baja» y el PATCH con el formulario entero: el correo es el de la propia ficha
    (con otras mayúsculas) y otra ficha DE BAJA con el mismo correo no cuenta."""
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)
    bajas["drivers"].docs.append({"id": "d-juan-viejo", "name": "JUAN REY", "email": "juan@x.test", "center": "DGA1",
                                  "active": False})
    r = await server.update_driver("d-juan", {**FORM_JUAN, "email": "Juan@X.test", "active": True}, JEFE_DGA1)
    assert r["success"] is True and _ficha(bajas, "d-juan")["active"] is True


@pytest.mark.asyncio(loop_scope="session")
async def test_w2_el_409_por_id_de_reactivar_sin_abrir_id_si_no_ve_la_nave(bajas):
    _ficha(bajas, "d-vieja")["transporter_id"] = TID_A                          # el de Ana, viva en OGA5
    with pytest.raises(HTTPException) as e:
        await server.reactivar_driver("d-vieja", {}, JEFE_DGA1)
    d = e.value.detail
    assert e.value.status_code == 409
    assert set(d) == {"mensaje", "centro", "conflicto", "transporter_id"}
    assert (d["conflicto"], d["transporter_id"], d["centro"]) == ("id_reparto", TID_A, "OGA5")
    assert "ANA" not in d["mensaje"] and TID_A in d["mensaje"]
    assert _ficha(bajas, "d-vieja")["active"] is False
    # Con eso el panel ofrece «sin el ID», y reactivar sin él funciona igual.
    r = await server.reactivar_driver("d-vieja", {"quitar_id": True}, JEFE_DGA1)
    assert r["ok"] and "transporter_id" not in _ficha(bajas, "d-vieja")
    assert _ficha(bajas, "d-ana")["transporter_id"] == TID_A
    # Para quien ve la nave de la otra, lo de antes.
    _ficha(bajas, "d-juan")["transporter_id"] = TID_A
    with pytest.raises(HTTPException) as e:
        await server.reactivar_driver("d-juan", {}, DANI)
    assert e.value.detail["abrir_id"] == "d-ana" and e.value.detail["nombre"] == "ANA RÍOS"


def _con_una_rota(base, ids_rotos=("d-rota",)):
    """Las fichas de `ids_rotos` fallan al APLICAR el traslado (el update con `$push`), no al programarlo."""
    class _UnaRota(ColMongo):
        async def update_one(self, q, u, upsert=False, **k):
            if q.get("id") in ids_rotos and "$push" in u:
                raise RuntimeError("ficha rota")
            return await super().update_one(q, u, upsert=upsert, **k)
    base["drivers"] = _UnaRota(base["drivers"].docs)


@pytest.mark.asyncio(loop_scope="session")
async def test_w3_el_fallo_de_una_ficha_sale_en_el_latido(base, monkeypatch):
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)
    traslado = {"centro": "DGA2", "desde": HOY, "por": "Fran"}
    base["drivers"].docs += [
        {"id": "d-rota", "name": "ROTA", "center": "OGA5", "active": True, "traslado": dict(traslado)},
        {"id": "d-sigue", "name": "SIGUE", "center": "OGA5", "active": True, "traslado": dict(traslado)}]
    _con_una_rota(base)
    await _bucle_una_vuelta(monkeypatch)()
    latido = server.global_db["app_meta"].docs[-1]
    assert latido["aplicados"] == 1 and _ficha(base, "d-sigue")["center"] == "DGA2"
    assert latido["error"].startswith(server._DEFAULT_DB_NAME + ": ficha d-rota")
    assert "ficha rota" in latido["error"]
    # La siguiente vuelta, ya sin fallos, lo limpia.
    _ficha(base, "d-rota").pop("traslado")
    await _bucle_una_vuelta(monkeypatch)()
    assert server.global_db["app_meta"].docs[-1]["error"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_w3_aplicar_traslados_apunta_sus_fallos_y_devuelve_lo_de_siempre(base):
    base["drivers"].docs.append({"id": "d-rota", "name": "ROTA", "center": "OGA5", "active": True,
                                 "traslado": {"centro": "DGA2", "desde": HOY}})
    _con_una_rota(base)
    fallos = []
    assert await server.aplicar_traslados(HOY, fallos=fallos) == []
    assert [(f["id"], f["nombre"]) for f in fallos] == [("d-rota", "ROTA")] and "ficha rota" in fallos[0]["error"]
    assert await server.aplicar_traslados(HOY) == []                            # sin la lista, como siempre


@pytest.mark.asyncio(loop_scope="session")
async def test_w3_programar_con_fecha_de_hoy_que_no_se_aplica_lo_dice(base, monkeypatch):
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)

    async def _centros():
        return ["OGA5", "DGA1", "DGA2"]
    monkeypatch.setattr(server, "_centros_de_la_empresa", _centros)
    _con_una_rota(base, ids_rotos=("d-luis",))
    r = await server.programar_traslado("d-luis", {"centro": "OGA5", "desde": HOY}, DANI)
    assert r["aplicado"] is False and r["traslado"]["centro"] == "OGA5"       # no se da por hecho
    assert "no se ha podido aplicar" in r["error"] and "ficha rota" not in r["error"]
    f = _ficha(base, "d-luis")
    assert f["center"] == "DGA1" and f["traslado"]["centro"] == "OGA5"         # queda programado para el bucle
    # La de otra ficha que falla no se le cuenta a esta; y la que se aplica no lleva `error`.
    base["drivers"].docs.append({"id": "d-rota", "name": "ROTA", "center": "OGA5", "active": True,
                                 "traslado": {"centro": "DGA2", "desde": HOY}})
    _con_una_rota(base, ids_rotos=("d-rota",))
    r = await server.programar_traslado("d-ana", {"centro": "DGA1", "desde": HOY}, DANI)
    assert r == {"traslado": None, "aplicado": True}
    # Con fecha de mañana, lo de siempre: programado, sin aplicar y sin `error`.
    r = await server.programar_traslado("d-ana", {"centro": "DGA2", "desde": "2026-11-12"}, DANI)
    assert r["aplicado"] is False and "error" not in r
