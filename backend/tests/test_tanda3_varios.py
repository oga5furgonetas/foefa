# -*- coding: utf-8 -*-
"""Tanda 3, zona «varios» (11-11-2026), portal_inicio-5: el resumen diario de cada nave (correo y Telegram, a las
21:00) dice qué furgonetas de la Asignación diaria salieron sin auditoría y quién las llevaba, y cuenta «el día» en
hora de Madrid (_rango_dia_negocio) en vez de con la fecha UTC de la marca (`^{dia}`). /stats/hoy, igual.

Lo que NO cambia y se comprueba aquí: el asunto del correo, la clave `inspecciones`, la plantilla de WhatsApp (sus
cuatro parámetros) y que sin asignación cargada el resumen no dice nada de salidas. Y que un fallo al calcular las
salidas no deja sin resumen a ninguna nave.

Sin Mongo: base de mentira. Las fechas son fijas (03-11-2026, en horario de invierno: Madrid = UTC+1) y se pasan a
mano; la zona se fija a Madrid en cada prueba, así que nada depende del reloj ni de otra prueba.
"""
import time

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

import server
from base_de_mentira import Col, Db

pytestmark = pytest.mark.asyncio(loop_scope="session")

DIA = "2026-11-03"
# 00:30 del 03-11 en Madrid: la fecha UTC de la marca aún dice 02-11.
MADRUGADA = "2026-11-02T23:30:00+00:00"
# 00:30 del 04-11 en Madrid: ya NO es del 03, aunque la marca UTC diga 03.
MADRUGADA_SIGUIENTE = "2026-11-03T23:30:00+00:00"


@pytest.fixture(autouse=True)
def _madrid():
    t = server._region_actual.set(("es", "Europe/Madrid"))
    yield
    server._region_actual.reset(t)


def _flota(b):
    b.vehicles.docs += [
        {"id": "v1", "license_plate": "1111AAA", "center": "OGA5", "status": "active"},
        {"id": "v2", "license_plate": "2222BBB", "center": "OGA5", "status": "active"},
        {"id": "v3", "license_plate": "3333CCC", "center": "OGA5", "status": "active"},
        {"id": "v4", "license_plate": "4444DDD", "center": "OGA5", "status": "active"},
        {"id": "v9", "license_plate": "9999ZZZ", "center": "DGA1", "status": "active"},
    ]


def _asignacion(b, dia=DIA):
    b.daily_assignments.docs.append(
        {"center": "OGA5", "date": dia, "slots": [
            {"vehicle_id": "v1", "vehicle_plate": "1111AAA", "driver_name": "Ana"},
            {"vehicle_id": "v2", "vehicle_plate": "2222BBB", "driver_name": "Pepe"},
            # Sin conductor: la furgoneta se quedó en la nave, no es una salida (P37, 11-11-2026).
            {"vehicle_id": "v3"},
            # Sin matrícula en el hueco: sale de la ficha de la furgoneta.
            {"vehicle_id": "v4", "driver_name": "Luis"},
            # La misma furgoneta en otro hueco: cuenta una vez.
            {"vehicle_id": "v1", "vehicle_plate": "1111AAA", "driver_name": "Otro"},
            # Hueco sin furgoneta: no es una salida.
            {"driver_name": "Sin furgo"},
        ]})


# ── _salidas_sin_auditoria ───────────────────────────────────────────────────────

async def test_salidas_dice_cuales_salieron_sin_auditoria_y_con_quien(monkeypatch):
    b = Db()
    _flota(b)
    _asignacion(b)
    b.inspections.docs += [
        {"id": "i1", "vehicle_id": "v1", "created_at": f"{DIA}T07:10:00+00:00"},
        # Borrada: no cuenta.
        {"id": "i2", "vehicle_id": "v2", "created_at": f"{DIA}T07:15:00+00:00", "deleted": True},
    ]
    monkeypatch.setattr(server, "db", b)
    s = await server._salidas_sin_auditoria("OGA5", DIA)
    assert s == {"total": 3, "revisadas": 1, "sin_auditoria": [
        {"matricula": "4444DDD", "conductor": "Luis"},
        {"matricula": "2222BBB", "conductor": "Pepe"},
    ]}


async def test_salidas_cuenta_la_madrugada_de_madrid_y_no_la_del_dia_siguiente(monkeypatch):
    b = Db()
    _flota(b)
    _asignacion(b)
    b.inspections.docs += [
        {"id": "i1", "vehicle_id": "v1", "created_at": MADRUGADA},            # 00:30 del 03 en Madrid: cuenta
        {"id": "i2", "vehicle_id": "v2", "created_at": MADRUGADA_SIGUIENTE},  # 00:30 del 04 en Madrid: no
    ]
    monkeypatch.setattr(server, "db", b)
    s = await server._salidas_sin_auditoria("OGA5", DIA)
    assert s["revisadas"] == 1
    assert [x["matricula"] for x in s["sin_auditoria"]] == ["4444DDD", "2222BBB"]


async def test_salidas_sin_asignacion_es_cero(monkeypatch):
    b = Db()
    _flota(b)
    monkeypatch.setattr(server, "db", b)
    assert await server._salidas_sin_auditoria("OGA5", DIA) == {"total": 0, "revisadas": 0, "sin_auditoria": []}


async def test_p37_un_hueco_sin_conductor_no_es_una_salida(monkeypatch):
    """P37 (11-11-2026, revisión de la tanda 3): una furgoneta en la asignación sin conductor se quedó en la nave. Solo
    cuentan los huecos con furgoneta Y conductor (driver_id o driver_name); el nombre, del hueco o, si solo trae el id,
    de la ficha. La misma furgoneta, primero sin conductor y luego con él, cuenta una vez y con ese conductor."""
    b = Db()
    _flota(b)
    b.drivers.docs.append({"id": "d7", "name": "Marta Ficha"})
    b.daily_assignments.docs.append({"center": "OGA5", "date": DIA, "slots": [
        {"vehicle_id": "v1", "vehicle_plate": "1111AAA"},
        {"vehicle_id": "v1", "vehicle_plate": "1111AAA", "driver_name": "Ana"},
        {"vehicle_id": "v2", "vehicle_plate": "2222BBB", "driver_id": "", "driver_name": ""},
        {"vehicle_id": "v3", "vehicle_plate": "3333CCC", "driver_id": "d7", "driver_name": ""},
    ]})
    monkeypatch.setattr(server, "db", b)
    s = await server._salidas_sin_auditoria("OGA5", DIA)
    assert s == {"total": 2, "revisadas": 0, "sin_auditoria": [
        {"matricula": "1111AAA", "conductor": "Ana"},
        {"matricula": "3333CCC", "conductor": "Marta Ficha"},
    ]}


async def test_p37_solo_furgonetas_sin_conductor_no_pinta_nada(envio):
    envio.daily_assignments.docs.append({"center": "OGA5", "date": DIA, "slots": [
        {"vehicle_id": "v1", "vehicle_plate": "1111AAA"}, {"vehicle_id": "v2", "vehicle_plate": "2222BBB"}]})
    salida = await server.enviar_resumen_diario(DIA)
    assert next(s for s in salida if s["center"] == "OGA5")["salidas"] == {"total": 0, "revisadas": 0,
                                                                            "sin_auditoria": []}
    oga5 = next(t for t in envio.grupo if "OGA5 —" in t)
    assert "Salidas" not in oga5
    assert all("SALIDAS SIN AUDITORÍA" not in h for _, _, h in envio.correos)


async def test_los_tres_contadores_del_resumen_usan_el_dia_de_madrid(monkeypatch):
    b = Db()
    _flota(b)
    b.inspections.docs += [
        {"id": "i1", "vehicle_id": "v1", "created_at": MADRUGADA,
         "analysis": {"new_damages": [{"part": "puerta", "severity": "leve"}]}},
        {"id": "i2", "vehicle_id": "v2", "created_at": MADRUGADA_SIGUIENTE,
         "analysis": {"new_damages": [{"part": "capó", "severity": "leve"}]}},
    ]
    b.incidents.docs += [
        {"id": "x1", "vehicle_id": "v1", "created_at": MADRUGADA, "severity": "grave"},
        {"id": "x2", "vehicle_id": "v2", "created_at": MADRUGADA_SIGUIENTE, "severity": "grave"},
    ]
    monkeypatch.setattr(server, "db", b)
    assert await server._inspecciones_del_dia("OGA5", DIA) == {"hechas": 1, "flota": 4}
    assert [d["matricula"] for d in await server._danos_nuevos_hoy("OGA5", DIA)] == ["1111AAA"]
    assert await server._incidencias_flota_dia("OGA5", DIA) == {"nuevas": 1, "graves": 1}


# ── El resumen que se manda ──────────────────────────────────────────────────────

@pytest.fixture
def envio(monkeypatch):
    b = Db()
    _flota(b)
    b["aviso_destinatarios"] = Col([
        {"id": "a1", "nombre": "Judyt", "email": "judyt@empresa.es", "telefono": "+34600000000",
         "centers": ["OGA5", "DGA1"], "avisos": ["resumen_diario"], "activo": True},
    ])
    monkeypatch.setattr(server, "db", b)
    b.correos, b.grupo, b.wasap = [], [], []

    async def enviar(to, subject, html, **kw):
        b.correos.append((to, subject, html))
        return True
    monkeypatch.setattr(server, "_enviar_email", enviar)

    async def telegram(texto, *a, **kw):
        b.grupo.append(texto)
    monkeypatch.setattr(server, "_telegram_aviso", telegram)

    async def si_whatsapp(_db, _que):
        return True
    monkeypatch.setattr(server.whatsapp, "puede_avisar", si_whatsapp)

    async def config(_db):
        return {"plantilla_resumen": "resumen"}
    monkeypatch.setattr(server.whatsapp, "config", config)

    async def plantilla(_db, tel, nombre, params, motivo=None):
        b.wasap.append(params)
        return {"ok": True}
    monkeypatch.setattr(server.whatsapp, "enviar_plantilla", plantilla)
    return b


async def test_el_resumen_dice_quien_salio_sin_auditoria(envio):
    _asignacion(envio)
    envio.inspections.docs.append({"id": "i1", "vehicle_id": "v1", "created_at": MADRUGADA})
    salida = await server.enviar_resumen_diario(DIA)
    por = {s["center"]: s for s in salida}

    # Lo que vuelve al botón de probar: la clave nueva.
    assert por["OGA5"]["salidas"] == {"total": 3, "revisadas": 1, "sin_auditoria": [
        {"matricula": "4444DDD", "conductor": "Luis"}, {"matricula": "2222BBB", "conductor": "Pepe"}]}
    # DGA1 no tiene asignación: total 0.
    assert por["DGA1"]["salidas"]["total"] == 0
    # Y la madrugada cuenta como revisada en «inspecciones» (antes salía «0 de 4»).
    assert por["OGA5"]["inspecciones"] == "1 de 4"

    tg = {t.split("</b>")[0]: t for t in envio.grupo}
    oga5 = next(t for k, t in tg.items() if "OGA5" in k)
    dga1 = next(t for k, t in tg.items() if "DGA1" in k)
    assert "🚚 <b>Salidas de la asignación:</b> 1 de 3 revisadas" in oga5
    assert "Sin auditoría: Luis (4444DDD), Pepe (2222BBB)" in oga5
    # La furgoneta sin conductor se quedó en la nave: no sale (P37).
    assert "3333CCC" not in oga5
    assert "Salidas" not in dga1 and "Sin auditoría" not in dga1

    html = {asunto: h for _, asunto, h in envio.correos}
    # El asunto NO cambia: sigue siendo «nave — fecha · inspecciones revisados».
    assert set(html) == {"OGA5 — 03/11/2026 · 1 de 4 revisados", "DGA1 — 03/11/2026 · 0 de 1 revisados"}
    h_oga5 = html["OGA5 — 03/11/2026 · 1 de 4 revisados"]
    assert "SALIDAS SIN AUDITORÍA (2) · 1 de 3 revisadas" in h_oga5
    assert "Pepe" in h_oga5 and "2222BBB" in h_oga5 and "Luis" in h_oga5 and "4444DDD" in h_oga5
    assert "3333CCC" not in h_oga5 and "sin conductor en la asignación" not in h_oga5
    assert "SALIDAS SIN AUDITORÍA" not in html["DGA1 — 03/11/2026 · 0 de 1 revisados"]

    # WhatsApp: la plantilla sigue con sus cuatro parámetros de siempre.
    assert envio.wasap and all(len(p) == 4 for p in envio.wasap)
    assert envio.wasap[0] == ["DGA1 03/11/2026", "0 de 1", "0", "sin checklist"]


async def test_con_todas_revisadas_el_correo_lo_dice(envio):
    envio.daily_assignments.docs.append(
        {"center": "OGA5", "date": DIA, "slots": [{"vehicle_id": "v1", "vehicle_plate": "1111AAA", "driver_name": "Ana"}]})
    envio.inspections.docs.append({"id": "i1", "vehicle_id": "v1", "created_at": f"{DIA}T06:00:00+00:00"})
    await server.enviar_resumen_diario(DIA)
    h = next(h for _, asunto, h in envio.correos if asunto.startswith("OGA5"))
    assert "SALIDAS SIN AUDITORÍA (0) · 1 de 1 revisadas" in h and "Todas revisadas ✓" in h
    oga5 = next(t for t in envio.grupo if "OGA5 —" in t)
    assert "1 de 1 revisadas" in oga5 and "Sin auditoría" not in oga5


async def test_mas_de_quince_sin_auditoria_se_cortan_en_telegram(envio):
    envio.daily_assignments.docs.append(
        {"center": "OGA5", "date": DIA, "slots": [
            {"vehicle_id": f"w{i:02d}", "vehicle_plate": f"{i:04d}XYZ", "driver_name": f"C{i:02d}"} for i in range(18)]})
    await server.enviar_resumen_diario(DIA)
    oga5 = next(t for t in envio.grupo if "OGA5 —" in t)
    assert "0 de 18 revisadas" in oga5
    assert "C14 (0014XYZ), …y 3 más" in oga5 and "C15" not in oga5


async def test_un_nombre_con_signos_no_rompe_el_html_de_telegram(envio):
    envio.daily_assignments.docs.append(
        {"center": "OGA5", "date": DIA, "slots": [{"vehicle_id": "v1", "vehicle_plate": "1111AAA", "driver_name": "A<b>&C"}]})
    await server.enviar_resumen_diario(DIA)
    oga5 = next(t for t in envio.grupo if "OGA5 —" in t)
    assert "A&lt;b&gt;&amp;C (1111AAA)" in oga5


async def test_si_las_salidas_fallan_todas_las_naves_reciben_su_resumen(envio, monkeypatch):
    _asignacion(envio)

    async def revienta(center, dia):
        raise RuntimeError("base caída")
    monkeypatch.setattr(server, "_salidas_sin_auditoria", revienta)
    salida = await server.enviar_resumen_diario(DIA)
    assert [s["center"] for s in salida] == ["DGA1", "OGA5"]
    assert all(s["salidas"] is None for s in salida)
    assert len(envio.correos) == 2 and len(envio.grupo) == 2
    assert all("SALIDAS SIN AUDITORÍA" not in h for _, _, h in envio.correos)


# ── P36 (11-11-2026, revisión de la tanda 3): el corte de Telegram ──────────────────
# Un día cargado (mucho checklist) que hoy llega entero tiene que seguir llegando entero: el bloque de salidas va AL
# FINAL y, si no cabe en los 4.000 caracteres, se cortan líneas enteras de ese final (nunca a mitad de una etiqueta).

def _dia_cargado(center, total_objetivo=3950):
    """Un resumen cuyo texto de SIEMPRE (sin salidas) más el «Para:» mide entre 3.900 y 4.000 caracteres."""
    items, r = [], None
    while True:
        r = {"center": center, "fecha": "03/11/2026", "inspecciones": "10 de 40", "checklist": "x", "golpes": "ninguno",
             "placas": [], "danos": [], "incidencias": {"nuevas": 0}, "salidas": None,
             "turnos": [{"turno": "mañana", "hechas": 0, "total": len(items), "items": list(items)}]}
        largo = len(server._texto_resumen_largo(r)) + len("\n\n<i>Para: Judyt</i>")
        if largo >= total_objetivo:
            return r
        items.append({"text": f"Tarea {len(items):02d} de la nave con un texto largo", "done": False})


def _salidas_quince():
    return {"total": 20, "revisadas": 5, "sin_auditoria": [
        {"matricula": f"{i:04d}XYZ", "conductor": f"Conductor número {i:02d}"} for i in range(15)]}


def _equilibrado(texto):
    return all(texto.count(f"<{t}>") == texto.count(f"</{t}>") for t in ("b", "i"))


async def test_p36_un_dia_cargado_sigue_llegando_entero_a_telegram(envio, monkeypatch):
    sin_salidas = {}

    async def resumen(center, dia):
        r = _dia_cargado(center)
        sin_salidas[center] = server._texto_resumen_largo(r)
        return {**r, "salidas": _salidas_quince()}
    monkeypatch.setattr(server, "resumen_dia_centro", resumen)
    await server.enviar_resumen_diario(DIA)
    assert len(envio.grupo) == 2
    for texto in envio.grupo:
        center = "OGA5" if "OGA5 —" in texto else "DGA1"
        assert len(texto) <= 4000, len(texto)
        # Lo de siempre llega entero y seguido, y el «Para:» también.
        assert texto.startswith(sin_salidas[center])
        assert texto.endswith("<i>Para: Judyt</i>")
        assert _equilibrado(texto)


async def test_p36_con_sitio_las_salidas_van_al_final_antes_del_para(envio):
    envio.daily_assignments.docs.append(
        {"center": "OGA5", "date": DIA, "slots": [{"vehicle_id": "v2", "vehicle_plate": "2222BBB", "driver_name": "Pepe"}]})
    await server.enviar_resumen_diario(DIA)
    oga5 = next(t for t in envio.grupo if "OGA5 —" in t)
    lineas = oga5.split("\n")
    i_sal = next(i for i, x in enumerate(lineas) if x.startswith("🚚 <b>Salidas"))
    i_chk = next(i for i, x in enumerate(lineas) if "Checklist" in x)
    assert i_sal > i_chk
    assert lineas[i_sal + 1] == "   Sin auditoría: Pepe (2222BBB)"
    assert oga5.endswith("<i>Para: Judyt</i>")


def test_p36_el_corte_va_por_lineas_enteras():
    texto = "\n".join(f"<b>línea {i:03d}</b> con algo de texto" for i in range(300))
    corto = server._cortar_por_lineas(texto, 1000)
    assert len(corto) <= 1000 and _equilibrado(corto)
    assert corto.endswith("\n…")
    assert all(x in texto.split("\n") for x in corto.split("\n")[:-1])
    # Lo que ya cabe no se toca.
    assert server._cortar_por_lineas("hola\nadiós", 1000) == "hola\nadiós"


@pytest_asyncio.fixture(loop_scope="session")
async def cliente():
    async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://testserver") as c:
        yield c


# ── P19 (11-11-2026, revisión de la tanda 3): el botón de probar el resumen ─────────
# A un usuario de oficina limitado a una nave, la respuesta de POST /avisos/enviar-resumen-diario le traía también las
# demás naves, con quién llevó qué furgoneta sin auditoría. Ahora solo le vuelven las que ve; el envío por correo y
# Telegram a los destinatarios configurados NO cambia (sigue yendo a todas sus naves).

def _usuario(uid, centros, cuenta):
    server._ADMIN_EXISTS_CACHE[uid] = (time.time() + 600, True, centros, None, None)
    tok = server.create_token(uid, "admin", uid, org_id="o1", account_type=cuenta)
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture
def envio_api(envio, monkeypatch):
    g = Db()
    g.organizations.docs.append({"id": "o1", "account_type": "dsp", "db_name": server._current_db_name.get(),
                                 "centers": ["OGA5", "DGA1"]})
    monkeypatch.setattr(server, "global_db", g)
    _asignacion(envio)
    envio.daily_assignments.docs.append(
        {"center": "DGA1", "date": DIA, "slots": [{"vehicle_id": "v9", "vehicle_plate": "9999ZZZ",
                                                    "driver_name": "Eva de DGA1"}]})
    server._ADMIN_EXISTS_CACHE.clear()
    yield envio
    server._ADMIN_EXISTS_CACHE.clear()


async def test_p19_probar_el_resumen_solo_devuelve_las_naves_que_ve(cliente, envio_api):
    r = await cliente.post("/api/avisos/enviar-resumen-diario", json={"date": DIA},
                           headers=_usuario("u-oga5", ["OGA5"], "dsp"))
    assert r.status_code == 200, r.text
    enviados = r.json()["enviados"]
    assert [e["center"] for e in enviados] == ["OGA5"]
    assert "Eva de DGA1" not in r.text and "9999ZZZ" not in r.text
    # El envío no cambia: los destinatarios reciben las dos naves por correo y por Telegram.
    assert len(envio_api.correos) == 2 and len(envio_api.grupo) == 2


@pytest.mark.parametrize("centros,cuenta", [(None, "dsp"), ([], "dsp"), (["OGA5"], "owner")])
async def test_p19_sin_limite_o_en_la_cuenta_duena_vuelven_todas(cliente, envio_api, centros, cuenta):
    r = await cliente.post("/api/avisos/enviar-resumen-diario", json={"date": DIA},
                           headers=_usuario("u-x", centros, cuenta))
    assert r.status_code == 200, r.text
    assert [e["center"] for e in r.json()["enviados"]] == ["DGA1", "OGA5"]


# ── /stats/hoy ───────────────────────────────────────────────────────────────────


@pytest.fixture
def base_stats(monkeypatch):
    b = Db()
    g = Db()
    g.organizations.docs.append({"id": "o1", "account_type": "owner", "db_name": server._current_db_name.get(),
                                 "centers": ["OGA5", "DGA1"]})
    monkeypatch.setattr(server, "db", b)
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "_hoy_madrid", lambda: DIA)
    monkeypatch.setattr(server, "_dia_negocio", lambda: DIA)
    server._ADMIN_EXISTS_CACHE.clear()
    yield b
    server._ADMIN_EXISTS_CACHE.clear()


def _cab():
    server._ADMIN_EXISTS_CACHE["u-dani"] = (time.time() + 600, True, None, None, None)
    tok = server.create_token("u-dani", "admin", "Dani", org_id="o1", account_type="owner")
    return {"Authorization": f"Bearer {tok}"}


async def test_stats_hoy_cuenta_la_madrugada_de_madrid(cliente, base_stats):
    _flota(base_stats)
    base_stats.daily_assignments.docs.append(
        {"center": "OGA5", "date": DIA, "slots": [
            {"vehicle_id": "v1", "vehicle_plate": "1111AAA", "driver_name": "Ana"},
            {"vehicle_id": "v2", "vehicle_plate": "2222BBB", "driver_name": "Pepe"}]})
    base_stats.inspections.docs += [
        {"id": "i1", "vehicle_id": "v1", "created_at": MADRUGADA,
         "analysis": {"severity": "leve", "new_damages": [{"part": "puerta"}]}},
        {"id": "i2", "vehicle_id": "v2", "created_at": MADRUGADA_SIGUIENTE,
         "analysis": {"severity": "leve", "new_damages": [{"part": "capó"}]}},
    ]
    base_stats.incidents.docs += [
        {"id": "x1", "vehicle_id": "v1", "created_at": MADRUGADA, "severity": "leve"},
        {"id": "x2", "vehicle_id": "v2", "created_at": MADRUGADA_SIGUIENTE, "severity": "leve"},
    ]
    r = await cliente.get("/api/stats/hoy", headers=_cab())
    assert r.status_code == 200, r.text
    j = r.json()
    # La misma forma de siempre; solo cambia qué cuenta como «hoy».
    assert set(j) == {"dia", "salidas", "revision", "checklist", "golpes", "incidencias", "por_centro"}
    assert (j["salidas"]["total"], j["salidas"]["revisadas"]) == (2, 1)
    assert [x["matricula"] for x in j["salidas"]["lista"] if x["revisada"]] == ["1111AAA"]
    assert j["revision"]["hechas"] == 1
    assert j["golpes"]["n"] == 1 and j["golpes"]["lista"][0]["matricula"] == "1111AAA"
    assert j["incidencias"]["nuevas"] == 1
