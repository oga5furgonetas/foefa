# -*- coding: utf-8 -*-
"""Correos del alta al fin de la prueba de quien reparte solo (05-10-2026).
Lo que se vigila: que cada correo salga en su momento y UNA vez, que no prometa
nada falso (cobros sin tarjeta, botones que no existen) y que la baja funcione."""
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest

import ciclo_correos as cc
import server
from base_de_mentira import Col, Db

# Lunes 12-10-2026 a las 8:00 de Madrid: «primer_dia» y «recordatorio» solo salen por la mañana de su hora.
AHORA = datetime(2026, 10, 12, 6, 0, tzinfo=timezone.utc)


def _org(horas=1, dias_prueba=7, **extra):
    alta = AHORA - timedelta(hours=horas)
    o = {"id": "o1", "name": "Pepe Pérez", "sector": "autonomo", "plan": "autonomo", "status": "trial",
         "email": "pepe@x.es", "pais": "es", "db_name": "dsp_o1",
         "created_at": alta.isoformat(), "trial_ends": (alta + timedelta(days=dias_prueba)).isoformat()}
    o.update(extra)
    return o


# ── QUÉ TOCA ────────────────────────────────────────────────────────────────
def test_bienvenida_solo_recien_dado_de_alta():
    assert cc.toca(_org(horas=0.1), {}, AHORA) == "bienvenida"
    assert cc.toca(_org(horas=1.9), {}, AHORA) == "bienvenida"
    assert cc.toca(_org(horas=3), {}, AHORA) == ""            # tarde: ya no se manda


def test_primer_dia_solo_sin_paradas_y_en_su_ventana():
    env = {"bienvenida": {"at": (AHORA - timedelta(hours=24)).isoformat()}}
    assert cc.toca(_org(horas=24, ciclo_correos=env), {"paradas": 0}, AHORA) == "primer_dia"
    assert cc.toca(_org(horas=24, ciclo_correos=env), {"paradas": 3}, AHORA) == ""   # ya la usa
    assert cc.toca(_org(horas=10, ciclo_correos=env), {"paradas": 0}, AHORA) == ""   # demasiado pronto
    # Pasó su momento: ya no es el del día siguiente, sino el recordatorio (desde el día 3, 11-10-2026).
    assert cc.toca(_org(horas=80, ciclo_correos=env), {"paradas": 0}, AHORA) == "recordatorio"


def test_casi_fin_con_dos_dias_o_menos():
    env = {"bienvenida": {"at": "2026-10-04T12:00:00+00:00"}, "primer_dia": {"at": "2026-10-05T12:00:00+00:00"}}
    assert cc.toca(_org(horas=24 * 5.5, ciclo_correos=env), {"paradas": 5}, AHORA) == "casi_fin"
    assert cc.toca(_org(horas=24 * 4, ciclo_correos=env), {"paradas": 5}, AHORA) == ""   # quedan 3 días
    assert cc.toca(_org(horas=24 * 8, ciclo_correos=env), {"paradas": 5}, AHORA) == ""   # ya acabó


def test_prueba_corta_no_recibe_casi_fin_encima_del_alta():
    env = {"bienvenida": {"at": AHORA.isoformat()}}
    assert cc.toca(_org(horas=30, dias_prueba=2, ciclo_correos=env), {"paradas": 4}, AHORA) == ""


def test_recordatorio_entre_el_dia_3_y_el_8_si_sigue_sin_paradas():
    """11-10-2026: muchos se dan de alta en fin de semana; el lunes ya no se acuerdan."""
    env = {"bienvenida": {"at": "2026-10-01T00:00:00+00:00"}, "primer_dia": {"at": "2026-10-02T00:00:00+00:00"}}
    assert cc.toca(_org(horas=24 * 4, ciclo_correos=env), {"paradas": 0}, AHORA) == "recordatorio"
    assert cc.toca(_org(horas=24 * 4, ciclo_correos=env), {"paradas": 2}, AHORA) == ""      # ya la usa
    assert cc.toca(_org(horas=24 * 2, ciclo_correos=env), {"paradas": 0}, AHORA) == ""      # pronto
    assert cc.toca(_org(horas=24 * 9, ciclo_correos=env), {"paradas": 0}, AHORA) == ""      # tarde
    env["recordatorio"] = {"at": "2026-10-03T00:00:00+00:00"}
    assert cc.toca(_org(horas=24 * 4, ciclo_correos=env), {"paradas": 0}, AHORA) == ""      # una vez


def test_primer_dia_y_recordatorio_solo_por_la_manana_de_su_hora_y_no_en_domingo():
    env = {"bienvenida": {"at": "2026-10-01T00:00:00+00:00"}}
    sin = {"paradas": 0}
    for hora_utc, sale in ((4, False), (5, True), (6, True), (7, False), (15, False), (22, False)):
        ahora = AHORA.replace(hour=hora_utc)              # Madrid = UTC+2 en octubre: sale de 7:00 a 8:59
        org = _org(horas=30, ciclo_correos=env, created_at=(ahora - timedelta(hours=30)).isoformat())
        assert (cc.toca(org, sin, ahora) == "primer_dia") is sale, hora_utc
    # El domingo no: no se reparte (o no se carga) y molestar ese día no ayuda.
    domingo = AHORA - timedelta(days=1)
    org = _org(horas=30, ciclo_correos=env, created_at=(domingo - timedelta(hours=30)).isoformat())
    assert cc.toca(org, sin, domingo) == ""
    # Su zona manda: las 8:00 de Madrid son la 1:00 en Ciudad de México; allí sale a sus 7-8.
    org = _org(horas=24 * 4, ciclo_correos=env, zona_horaria="America/Mexico_City")
    assert cc.toca(org, sin, AHORA) == ""
    mx = AHORA + timedelta(hours=7)                       # 8:00 en Ciudad de México
    org = _org(horas=24 * 4, ciclo_correos=env, zona_horaria="America/Mexico_City",
               created_at=(mx - timedelta(days=4)).isoformat())
    assert cc.toca(org, sin, mx) == "recordatorio"
    # Una zona que no existe no rompe nada: cuenta la de Madrid.
    assert cc.en_su_manana({"zona_horaria": "Marte/Olimpo"}, AHORA) is True
    # Lo demás no espera a la mañana: la bienvenida sale al momento.
    tarde = AHORA.replace(hour=20)
    assert cc.toca(_org(horas=0.1, created_at=(tarde - timedelta(hours=0.1)).isoformat()), {}, tarde) == "bienvenida"


def test_invita_cuando_ya_lleva_10_entregas_de_verdad():
    env = {"bienvenida": {"at": "2026-10-01T00:00:00+00:00"}}
    assert cc.toca(_org(horas=30, ciclo_correos=env), {"paradas": 36, "entregadas": 11}, AHORA) == "invita"
    assert cc.toca(_org(horas=30, ciclo_correos=env), {"paradas": 9, "entregadas": 9}, AHORA) == ""
    # 11 «entregadas» en 20 minutos a medianoche: alguien probando, no repartiendo. No se le escribe.
    assert cc.toca(_org(horas=30, ciclo_correos=env), {"paradas": 36, "entregadas": 11, "entregadas_reales": 0}, AHORA) == ""
    assert cc.toca(_org(horas=30, ciclo_correos=env), {"paradas": 36, "entregadas": 11, "entregadas_reales": 10}, AHORA) == "invita"
    assert cc.toca(_org(horas=30, ciclo_correos=env, pais="cn"), {"paradas": 36, "entregadas": 11}, AHORA) == ""
    env["invita"] = {"at": "2026-10-09T00:00:00+00:00"}
    assert cc.toca(_org(horas=30, ciclo_correos=env), {"paradas": 50, "entregadas": 40}, AHORA) == ""


@pytest.mark.parametrize("pais,cent,cobro", [("es", 500, "Bizum o transferencia"), ("mx", 250, "PayPal")])
def test_invita_lleva_su_enlace_y_las_condiciones_de_verdad(pais, cent, cobro):
    c = cc.correo("invita", _org(horas=30, pais=pais), {"paradas": 36, "entregadas": 11}, AHORA, marca="FDS",
                  base="https://flotadsp.com", baja="https://b", mensual=9.99, anual=99, con_respuesta=True,
                  ref_enlace="https://flotadsp.com/repartidores?ref=AB12", ref_cent=cent, ref_espana=pais == "es")
    t = c["texto"]
    assert "Llevas 11 entregas" in c["asunto"]
    assert "https://flotadsp.com/repartidores?ref=AB12" in t
    assert ("5 €" if cent == 500 else "2,50 €") in t and cobro in t and "desde 10 €" in t
    assert "20 entregas en 2 días distintos" in t
    assert "ruta?tab=cuenta" in c["html"]                       # el botón lleva a su enlace y su QR


def test_nunca_dos_del_ciclo_en_menos_de_18_horas():
    env = {"bienvenida": {"at": "x"}, "primer_dia": {"at": (AHORA - timedelta(hours=10)).isoformat()}}
    assert cc.toca(_org(horas=24 * 5.5, ciclo_correos=env), {"paradas": 0}, AHORA) == ""


def test_no_se_repite_ninguno():
    env = {k: {"at": "2026-10-01T00:00:00+00:00"} for k in cc.CLAVES}
    for horas in (0.5, 24, 24 * 5.5):
        assert cc.toca(_org(horas=horas, ciclo_correos=env), {}, AHORA) == ""


@pytest.mark.parametrize("cambio", [
    {"correos_baja": True}, {"status": "active"}, {"email": ""},
    {"sector": "supermercado", "plan": "completo"},
])
def test_a_quien_no_se_le_escribe(cambio):
    assert cc.toca(_org(horas=0.5, **cambio), {}, AHORA) == ""


# ── EL IDIOMA ───────────────────────────────────────────────────────────────
@pytest.mark.parametrize("org,idioma", [
    ({"idioma": "pt", "pais": "es"}, "pt"), ({"pais": "pt"}, "pt"), ({"pais": "br"}, "pt"),
    ({"pais": "mx"}, "es"), ({}, "es"), ({"pais": "fr"}, "en"), ({"idioma": "fr", "pais": "fr"}, "en"),
])
def test_idioma(org, idioma):
    assert cc.idioma_de(org) == idioma


# ── LOS TEXTOS ──────────────────────────────────────────────────────────────
def _correo(clave, org=None, uso=None, con_respuesta=True):
    return cc.correo(clave, org or _org(horas=24 * 5.5), uso or {}, AHORA, marca="FDS",
                     base="https://flotadsp.com", baja="https://api.x/api/correo/baja?o=o1&t=abc",
                     mensual=9.99, anual=99, con_respuesta=con_respuesta)


@pytest.mark.parametrize("idioma", cc.IDIOMAS)
@pytest.mark.parametrize("clave", cc.CLAVES)
def test_todos_los_correos_se_montan_sin_huecos(clave, idioma):
    c = _correo(clave, _org(horas=24 * 5.5, idioma=idioma), {"paradas": 3, "entregadas": 2})
    assert c["idioma"] == idioma and c["asunto"]
    assert "{" not in c["texto"] and "}" not in c["texto"]            # ninguna marca sin rellenar
    assert "https://api.x/api/correo/baja?o=o1&amp;t=abc" in c["html"]   # la baja, siempre
    assert "utm_source=correo" in c["texto"] and f"utm_content={clave}" in c["texto"]


def test_nunca_dice_que_se_cobra_solo():
    for clave in cc.CLAVES:
        t = _correo(clave)["texto"].lower()
        assert "se cobra el plan" not in t and "salvo cancelación" not in t
        if clave in ("bienvenida", "casi_fin"):      # los demás no hablan de pagos
            assert "no se cobra nada solo" in t


def test_cuenta_lo_que_ha_hecho_y_no_inventa():
    c = _correo("casi_fin", uso={"paradas": 12, "entregadas": 9})
    assert "12 paradas y entregado 9" in c["texto"]
    c = _correo("casi_fin", uso={"paradas": 0})
    assert "Todavía no has cargado ninguna parada" in c["texto"]
    assert "entregado" not in c["texto"]


def test_precios_y_fechas():
    c = _correo("casi_fin")
    assert "9,99 €" in c["texto"] and "99 €" in c["texto"]
    fin = cc._fecha(_org(horas=24 * 5.5)["trial_ends"]).strftime("%d/%m/%Y")
    assert fin in c["texto"]
    assert "9.99 €" in _correo("casi_fin", _org(horas=24 * 5.5, idioma="en"))["texto"]


def test_nombre_escapado_y_saludo_sin_nombre():
    c = _correo("bienvenida", _org(horas=0.5, name="<script>x</script>"))
    assert "<script>" not in c["html"]
    c = _correo("bienvenida", _org(horas=0.5, name="   "))
    assert c["texto"].startswith("Hola:\n")


def test_sin_buzon_de_respuesta_no_pide_contestar():
    assert "contesta a este correo" in _correo("bienvenida", _org(horas=0.5))["texto"]
    t = _correo("bienvenida", _org(horas=0.5), con_respuesta=False)["texto"]
    assert "contesta" not in t.lower()


def _diccionario_app():
    """Claves (español) y traducciones (en, pt) de los textos de la app."""
    raiz = Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib"
    es, en, pt = set(), set(), set()
    for f in raiz.glob("textosRuta*.js"):
        for m in re.finditer(r'^\s*"((?:[^"\\]|\\.)+)":\s*\["((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"',
                             f.read_text(encoding="utf-8"), re.M):
            es.add(m.group(1)); en.add(m.group(2)); pt.add(m.group(3))
    return {"es": es, "en": en, "pt": pt}


@pytest.mark.parametrize("idioma", cc.IDIOMAS)
def test_primer_dia_con_promocion_no_cuenta_dias_de_prueba(idioma):
    """10-10-2026: con «gratis y sin límite hasta el 31-12» el correo del día siguiente
    decía «te quedan 6 días de prueba». Con la promoción se recuerda la fecha, no días."""
    org = _org(horas=26, idioma=idioma)
    con = cc.correo("primer_dia", org, {}, AHORA, marca="FDS", base="https://flotadsp.com", baja="https://api.x/b",
                    mensual=9.99, anual=99, con_respuesta=True, promo_hasta="2026-12-31")["texto"]
    sin = _correo("primer_dia", org)["texto"]
    assert "31" in con and not re.search(r"\b[0-9]+ (días|dias|trial days)", con)
    assert re.search(r"\b[0-9]+ (días|dias|trial days)", sin)          # sin promoción, como siempre


def test_los_botones_que_cita_existen_en_la_app():
    """Un correo que dice «pulsa X» y X no está en la pantalla es peor que nada."""
    dic = _diccionario_app()
    assert dic["es"], "no se ha podido leer el diccionario de la app"
    for idioma in cc.IDIOMAS:
        for clave in cc.CLAVES:
            texto = _correo(clave, _org(horas=24 * 5.5, idioma=idioma))["texto"]
            for cita in re.findall(r"«([^»]+)»", texto):
                assert cita in dic[idioma], f"{idioma}/{clave}: «{cita}» no es un texto de la app"


# ── EL SERVIDOR ─────────────────────────────────────────────────────────────
@pytest.fixture
def mundo(monkeypatch):
    g = Db()
    g["organizations"] = Col([])
    g["admin_users"] = Col([{"username": "dani", "email": "dani@x.es"}])
    g["correos_enviados"] = Col([])
    g["app_meta"] = Col([])
    enviados, uso = [], {"paradas": 0}

    async def enviar(to, subject, html, responder_a="", copia=None, texto="", cabeceras=None):
        enviados.append(SimpleNamespace(to=to, subject=subject, responder_a=responder_a, cabeceras=cabeceras))
        return mundo_ok["ok"]

    async def ciclo_uso(_org):
        return dict(uso)
    mundo_ok = {"ok": True}
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "_enviar_email", enviar)
    monkeypatch.setattr(server, "_ciclo_uso", ciclo_uso)
    monkeypatch.setattr(server, "SECRET_KEY", "secreto-de-prueba")
    monkeypatch.setattr(server, "CORREO_CONTACTO", "contacto@x.es")
    monkeypatch.setenv("SUPERADMIN_USERNAME", "dani")
    monkeypatch.delenv("CORREO_RESPUESTAS", raising=False)
    monkeypatch.setenv("RESEND_API_KEY", "x")
    return SimpleNamespace(g=g, enviados=enviados, uso=uso, ok=mundo_ok, monkeypatch=monkeypatch)


@pytest.mark.asyncio(loop_scope="session")
async def test_bienvenida_sale_una_sola_vez(mundo):
    mundo.g["organizations"].docs.append(_org(horas=0.2))
    assert await server._ciclo_enviar("o1", "bienvenida", AHORA) is True
    assert await server._ciclo_enviar("o1", "bienvenida", AHORA) is False
    assert len(mundo.enviados) == 1
    e = mundo.enviados[0]
    assert e.to == "pepe@x.es" and e.responder_a == "contacto@x.es"
    assert "contesta a este correo" in mundo.g["correos_enviados"].docs[0]["cuerpo"]
    assert e.cabeceras["List-Unsubscribe"].startswith("<") and "/api/correo/baja?o=o1&t=" in e.cabeceras["List-Unsubscribe"]
    org = mundo.g["organizations"].docs[0]
    assert org["ciclo_correos"]["bienvenida"]["ok"] is True
    assert mundo.g["correos_enviados"].docs[0]["por"] == "ciclo:bienvenida"


@pytest.mark.asyncio(loop_scope="session")
async def test_si_falla_se_reintenta_en_la_siguiente_vuelta(mundo):
    mundo.g["organizations"].docs.append(_org(horas=0.2))
    mundo.ok["ok"] = False
    assert await server._ciclo_enviar("o1", "bienvenida", AHORA) is False
    assert "bienvenida" not in (mundo.g["organizations"].docs[0].get("ciclo_correos") or {})
    mundo.ok["ok"] = True
    assert await server._ciclo_enviar("o1", "bienvenida", AHORA) is True


@pytest.mark.asyncio(loop_scope="session")
async def test_el_seguimiento_solo_con_el_interruptor(mundo):
    mundo.g["organizations"].docs.append(_org(horas=24, ciclo_correos={"bienvenida": {"at": "2026-10-09T12:00:00+00:00"}}))
    mundo.monkeypatch.delenv("CICLO_CORREOS", raising=False)
    assert await server.ciclo_correos_vuelta(AHORA) == {}
    mundo.monkeypatch.setenv("CICLO_CORREOS", "1")
    assert await server.ciclo_correos_vuelta(AHORA) == {"primer_dia": 1}
    assert await server.ciclo_correos_vuelta(AHORA) == {}                # y no se repite
    assert mundo.enviados[0].subject == "¿Te ayudo con tu primera ruta?"


@pytest.mark.asyncio(loop_scope="session")
async def test_quien_ya_carga_paradas_no_recibe_el_de_ayuda(mundo):
    mundo.g["organizations"].docs.append(_org(horas=24, ciclo_correos={"bienvenida": {"at": "2026-10-09T12:00:00+00:00"}}))
    mundo.monkeypatch.setenv("CICLO_CORREOS", "1")
    mundo.uso["paradas"] = 7
    assert await server.ciclo_correos_vuelta(AHORA) == {}


@pytest.mark.asyncio(loop_scope="session")
async def test_baja(mundo):
    mundo.g["organizations"].docs.append(_org(horas=0.2))
    r = await server.correo_baja(o="o1", t="falsa")
    assert b"no es v" in r.body and not mundo.g["organizations"].docs[0].get("correos_baja")
    r = await server.correo_baja(o="o1", t=server._baja_firma("o1"))
    assert b"Hecho" in r.body and mundo.g["organizations"].docs[0]["correos_baja"] is True
    assert await server._ciclo_enviar("o1", "bienvenida", AHORA) is False
    assert mundo.enviados == []


@pytest.mark.asyncio(loop_scope="session")
async def test_respuestas_al_buzon_de_contacto_nunca_al_personal(mundo):
    """Nunca el correo personal del dueño (Dani, 05-10): CORREO_RESPUESTAS o contacto@."""
    assert await server._ciclo_responder_a() == "contacto@x.es"
    mundo.monkeypatch.setenv("CORREO_RESPUESTAS", "soporte@x.es")
    assert await server._ciclo_responder_a() == "soporte@x.es"
    mundo.monkeypatch.setenv("CORREO_RESPUESTAS", "no-es-un-correo")
    assert await server._ciclo_responder_a() == "contacto@x.es"
    mundo.monkeypatch.setattr(server, "CORREO_CONTACTO", "")
    mundo.monkeypatch.delenv("CORREO_RESPUESTAS")
    assert await server._ciclo_responder_a() == ""              # sin buzón, el correo no invita a contestar


@pytest.mark.asyncio(loop_scope="session")
async def test_misma_persona_con_dos_cuentas_no_recibe_dos_seguidos(mundo):
    mundo.g["organizations"].docs.append(_org(horas=0.2))
    mundo.g["organizations"].docs.append({**_org(horas=24, ciclo_correos={"bienvenida": {"at": "x"}}), "id": "o2"})
    mundo.monkeypatch.setenv("CICLO_CORREOS", "1")
    assert await server._ciclo_enviar("o1", "bienvenida", AHORA) is True
    assert await server._ciclo_enviar("o2", "primer_dia", AHORA) is False      # mismo correo, hace nada
    assert len(mundo.enviados) == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_la_marca_es_la_del_remitente(mundo):
    mundo.monkeypatch.setenv("EMAIL_FROM", "FDS <contacto@x.es>")
    mundo.g["organizations"].docs.append(_org(horas=0.2))
    await server._ciclo_enviar("o1", "bienvenida", AHORA)
    assert mundo.enviados[0].subject.startswith("Tu cuenta de FDS")


@pytest.mark.asyncio(loop_scope="session")
async def test_el_de_invita_sale_con_su_codigo_de_invitacion(mundo):
    alta = (datetime.now(timezone.utc) - timedelta(hours=30)).isoformat()
    mundo.g["organizations"].docs.append({
        "id": "o9", "name": "Barry", "sector": "autonomo", "plan": "autonomo", "status": "trial",
        "email": "barry@x.es", "pais": "es", "db_name": "dsp_o9", "created_at": alta,
        "trial_ends": (datetime.now(timezone.utc) + timedelta(days=60)).isoformat(),
        "ciclo_correos": {"bienvenida": {"at": alta}}})
    mundo.uso.update({"paradas": 36, "entregadas": 11, "entregadas_reales": 11})
    mundo.monkeypatch.setenv("CICLO_CORREOS", "1")
    textos = []

    async def enviar(to, subject, html, responder_a="", copia=None, texto="", cabeceras=None):
        textos.append(texto)
        return True
    mundo.monkeypatch.setattr(server, "_enviar_email", enviar)
    assert await server._ciclo_enviar("o9", "invita")
    org = next(o for o in mundo.g["organizations"].docs if o["id"] == "o9")
    assert org.get("ref_codigo") and f"/invita?ref={org['ref_codigo']}&utm_source=referido" in textos[0]
    assert not await server._ciclo_enviar("o9", "invita")                       # una sola vez
