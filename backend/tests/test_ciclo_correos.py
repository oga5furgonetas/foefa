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
    assert cc.toca(_org(horas=6, ciclo_correos=env), {"paradas": 0}, AHORA) == ""    # demasiado pronto
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
    assert ("5 €" if cent == 500 else "2,50 €") in t and cobro in t
    assert "desde 10 €" not in t and "desde 60 €" not in t    # el mínimo solo se dice al intentar cobrar (14-10-2026)
    assert "20 entregas en 2 días distintos" in t
    assert "ruta?tab=cuenta" in c["html"]                       # el botón lleva a su enlace y su QR


@pytest.mark.parametrize("idioma,frase", [("es", "10 € por cada compañero que se registre con tu enlace hasta el 31 de octubre"),
                                          ("pt", "10 € por cada colega que se registe com o teu link até 31 de outubro"),
                                          ("en", "10 € for every colleague who signs up with your link until 31 October"),
                                          ("br", "10 € por cada colega que se cadastrar com o seu link até 31 de outubro")])
def test_invita_con_la_promocion_de_10_euros_dice_hasta_cuando(idioma, frase):
    """14-10-2026: 10 € por cada invitado que se registre hasta el 31-10; el correo lo dice solo mientras dura."""
    org = _org(horas=30, idioma=idioma, pais="br" if idioma == "br" else "es")
    con = cc.correo("invita", org, {"paradas": 36, "entregadas": 11}, AHORA, marca="FDS", base="https://flotadsp.com",
                    baja="https://b", mensual=9.99, anual=99, con_respuesta=True, ref_cent=1000, ref_promo_hasta="2026-10-31")["texto"]
    assert frase in con
    sin = cc.correo("invita", org, {"paradas": 36, "entregadas": 11}, AHORA, marca="FDS", base="https://flotadsp.com",
                    baja="https://b", mensual=9.99, anual=99, con_respuesta=True, ref_cent=250)["texto"]
    assert "promo" not in sin.lower() and ("2.50 €" if idioma == "en" else "2,50 €") in sin


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
    ({"idioma": "pt", "pais": "es"}, "pt"), ({"pais": "pt"}, "pt"), ({"pais": "br"}, "br"), ({"idioma": "pt", "pais": "br"}, "br"),
    ({"pais": "pt", "zona_horaria": "America/Sao_Paulo"}, "br"), ({"idioma": "pt", "pais": "pt"}, "pt"),
    ({"pais": "mx"}, "es"), ({}, "es"), ({"pais": "fr"}, "en"), ({"idioma": "fr", "pais": "fr"}, "en"),
])
def test_idioma(org, idioma):
    assert cc.idioma_de(org) == idioma


# ── LOS TEXTOS ──────────────────────────────────────────────────────────────
def _correo(clave, org=None, uso=None, con_respuesta=True, **extra):
    if clave == "bono":
        extra.setdefault("bono_hasta", "2026-12-31")
    if clave == "opinion":
        extra.setdefault("opinion_url", "https://flotadsp.com/opinion?o=o1&t=abc")
    return cc.correo(clave, org or _org(horas=24 * 5.5), uso or {}, AHORA, marca="FDS",
                     base="https://flotadsp.com", baja="https://api.x/api/correo/baja?o=o1&t=abc",
                     mensual=9.99, anual=99, con_respuesta=con_respuesta, **extra)


# ── ¿QUÉ TAL TE VA? (17-10-2026) ─────────────────────────────────────────────
DIEZ = AHORA + timedelta(hours=2)            # lunes 12-10 a las 10:00 de Madrid
_ENV_VIEJO = {"bienvenida": {"at": "2026-10-01T00:00:00+00:00"}, "primer_dia": {"at": "2026-10-02T00:00:00+00:00"}}


def test_opinion_a_los_5_dias_a_quien_la_usa():
    org = _org(horas=24 * 6, dias_prueba=60, ciclo_correos=_ENV_VIEJO)
    assert cc.toca(org, {"paradas": 3}, DIEZ) == "opinion"
    assert cc.toca(_org(horas=24 * 4, dias_prueba=60, ciclo_correos=_ENV_VIEJO), {"paradas": 3}, DIEZ) == ""
    assert cc.toca(_org(horas=24 * 31, dias_prueba=60, ciclo_correos=_ENV_VIEJO), {"paradas": 3}, DIEZ) == ""
    assert cc.toca(org, {"paradas": 3}, DIEZ + timedelta(hours=12)) == ""             # a las 22:00, no
    assert cc.toca(org, {"paradas": 3}, DIEZ, promo=True) == "opinion"                # con la promoción, también


def test_opinion_a_quien_no_la_usa_despues_del_recordatorio():
    """Primero se le ayuda (recordatorio, del día 3 al 8) y luego se le pregunta qué le frenó."""
    assert cc.toca(_org(horas=24 * 6, dias_prueba=60, ciclo_correos=_ENV_VIEJO), {"paradas": 0}, DIEZ) == ""
    con_rec = {**_ENV_VIEJO, "recordatorio": {"at": "2026-10-05T06:00:00+00:00"}}
    assert cc.toca(_org(horas=24 * 6, dias_prueba=60, ciclo_correos=con_rec), {"paradas": 0}, DIEZ) == "opinion"
    assert cc.toca(_org(horas=24 * 9, dias_prueba=60, ciclo_correos=_ENV_VIEJO), {"paradas": 0}, DIEZ) == "opinion"


@pytest.mark.parametrize("extra", [{"opinion_dada": True}, {"opinion_saltada": True},
                                   {"ciclo_correos": {**_ENV_VIEJO, "opinion": {"at": "2026-10-09T08:00:00+00:00"}}}])
def test_opinion_una_vez_y_nunca_a_quien_ya_contesto(extra):
    org = _org(horas=24 * 6, dias_prueba=60, **{"ciclo_correos": _ENV_VIEJO, **extra})
    assert cc.toca(org, {"paradas": 3}, DIEZ) == ""


@pytest.mark.parametrize("idioma", cc.IDIOMAS)
def test_correo_opinion_nota_de_un_clic_a_quien_la_usa(idioma):
    c = _correo("opinion", _org(horas=24 * 6, idioma=idioma), {"paradas": 7, "entregadas": 5})
    for n in cc.NOTAS:
        assert f"opinion?o=o1&t=abc&utm_source=correo&utm_medium=email&utm_campaign=ciclo&utm_content=opinion&r={n}" in c["texto"]
        assert f"utm_content=opinion&amp;r={n}" in c["html"]
    assert "7" in c["texto"] and "&m=" not in c["texto"]
    assert c["html"].count("display:block") == 5 and "★★★★★" in c["html"]
    assert "https://api.x/api/correo/baja?o=o1&amp;t=abc" in c["html"]
    assert "{" not in c["texto"] and "\x00" not in c["texto"] and "\x00" not in c["html"]


@pytest.mark.parametrize("idioma", cc.IDIOMAS)
def test_correo_opinion_que_te_freno_a_quien_no_la_usa(idioma):
    c = _correo("opinion", _org(horas=24 * 9, idioma=idioma), {"paradas": 0})
    for m in cc.MOTIVOS:
        assert f"utm_content=opinion&m={m}" in c["texto"]
    assert "&r=" not in c["texto"] and c["html"].count("display:block") == len(cc.MOTIVOS)


def test_correo_opinion_en_latinoamerica_y_sin_enlace():
    mx = _correo("opinion", _org(horas=24 * 9, pais="mx"), {"paradas": 0})["texto"]
    assert "Toca la que" in mx and "Pulsa" not in mx
    with pytest.raises(ValueError):
        cc.correo("opinion", _org(horas=24 * 9), {}, AHORA, marca="FDS", base="https://flotadsp.com",
                  baja="https://b", mensual=9.99, anual=99, con_respuesta=True)


def test_primer_dia_solo_dice_ayer_si_fue_ayer():
    assert "Ayer creaste tu cuenta" in _correo("primer_dia", _org(horas=30))["texto"]
    t = _correo("primer_dia", _org(horas=60))["texto"]
    assert "Hace unos días creaste tu cuenta" in t and "Ayer" not in t
    assert "account a few days ago" in _correo("primer_dia", _org(horas=60, idioma="en"))["texto"]


def test_el_bono_va_en_los_correos_de_arrancar_y_solo_si_puede_ganarlo():
    """17-10-2026: 10 € por la primera ruta de verdad. Lo dicen la bienvenida, «primer_dia» y «recordatorio»
    (antes de la despedida) mientras pueda ganarlo; sin `bono_hasta`, ni una palabra."""
    for clave in cc.CON_BONO:
        t = _correo(clave, bono_hasta="2026-12-31", ref_cent=1000)["texto"]
        assert "te damos 10 € cuando hagas tus primeras 20 entregas" in t and "31 de diciembre" in t
        assert t.index("te damos 10 €") < t.index("Daniel, de FDS")
        assert "te damos" not in _correo(clave)["texto"]
    assert "te damos" not in _correo("casi_fin", bono_hasta="2026-12-31")["texto"]
    c = _correo("bono", uso={"paradas": 9, "entregadas": 7, "entregadas_reales": 7}, ref_cent=1000)
    assert c["asunto"] == "10 € por tu primera ruta con FDS"
    assert "Ya llevas 7 entregas que cuentan" in c["texto"] and "10 € más por cada compañero" in c["texto"]
    assert "Ya llevas" not in _correo("bono", uso={"paradas": 0})["texto"]
    with pytest.raises(ValueError):
        cc.correo("bono", _org(horas=30), {}, AHORA, marca="FDS", base="https://x", baja="https://b",
                  mensual=9.99, anual=99, con_respuesta=True)


def test_el_correo_del_bono_solo_a_quien_no_lo_sabe_y_por_la_manana():
    lunes = datetime(2026, 10, 19, 6, 30, tzinfo=timezone.utc)          # 8:30 en Madrid
    org = {"id": "o1", "name": "A", "email": "a@a.com", "sector": "autonomo", "status": "trial",
           "created_at": "2026-10-05T18:56:00+00:00",
           "ciclo_correos": {"bienvenida": {"at": "2026-10-05T18:56:00+00:00"},
                             "primer_dia": {"at": "2026-10-07T05:10:00+00:00"}}}
    assert cc.toca(org, {"paradas": 4, "entregadas_reales": 3}, lunes, promo=True, bono=True) == "bono"
    assert cc.toca(org, {"paradas": 4}, lunes, promo=True, bono=False) == ""
    assert cc.toca(org, {"paradas": 4}, lunes + timedelta(hours=8), promo=True, bono=True) == "bono"  # de día, sí
    assert cc.toca(org, {"paradas": 4}, lunes + timedelta(hours=16), promo=True, bono=True) == ""     # de noche, no
    assert cc.toca(org, {"paradas": 40, "entregadas_reales": 20}, lunes, promo=True, bono=True) == "invita"
    # Ya le llegó un correo del ciclo desde que existe el bono (ese lo llevaba): no se le repite.
    ya = dict(org, ciclo_correos={**org["ciclo_correos"], "recordatorio": {"at": "2026-10-17T06:00:00+00:00"}})
    assert cc.toca(ya, {"paradas": 4}, lunes, promo=True, bono=True) == ""
    hecho = dict(org, ciclo_correos={**org["ciclo_correos"], "bono": {"at": "2026-10-18T06:00:00+00:00"}})
    assert cc.toca(hecho, {"paradas": 4}, lunes + timedelta(days=1), promo=True, bono=True) == ""


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
    pt_de = {}
    for f in raiz.glob("textosRuta*.js"):
        for m in re.finditer(r'^\s*"((?:[^"\\]|\\.)+)":\s*\["((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"',
                             f.read_text(encoding="utf-8"), re.M):
            es.add(m.group(1)); en.add(m.group(2)); pt.add(m.group(3)); pt_de[m.group(1)] = m.group(3)
    # En Brasil la app enseña textosBrasil.js y, lo que no está ahí, el portugués de siempre.
    br_dic = {}
    for m in re.finditer(r"^\s*'((?:[^'\\]|\\.)+)':\s*\n?\s*'((?:[^'\\]|\\.)*)'",
                         (raiz / "textosBrasil.js").read_text(encoding="utf-8"), re.M):
        br_dic[m.group(1)] = m.group(2)
    br = set(br_dic.values()) | {v for k, v in pt_de.items() if k not in br_dic}
    return {"es": es, "en": en, "pt": pt, "br": br}


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


def test_en_latinoamerica_celular_y_toca_y_en_espana_movil_y_pulsa():
    """11-10-2026: los correos decían «móvil», «Pulsa» y «haz una foto» también en México o Colombia."""
    mx = _correo("bienvenida", _org(horas=0.5, pais="mx"))["texto"]
    assert "celular" in mx and "Toca «" in mx and "móvil" not in mx and "Pulsa" not in mx
    es = _correo("bienvenida", _org(horas=0.5, pais="es"))["texto"]
    assert "móvil" in es and "Pulsa «" in es and "celular" not in es
    # Los botones que cita siguen siendo los de la app (aLatam no los toca).
    assert "«Cargar paquetes: uno tras otro»" in mx


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
async def test_el_correo_de_opinion_lleva_su_enlace_firmado(mundo):
    # Con el bono ya contado (si no, le toca antes el del bono).
    env = {**_ENV_VIEJO, "bono": {"at": "2026-10-05T08:00:00+00:00"}}
    mundo.g["organizations"].docs.append(_org(horas=24 * 9, dias_prueba=60, ciclo_correos=env))
    assert await server._ciclo_enviar("o1", "opinion", DIEZ) is True
    assert await server._ciclo_enviar("o1", "opinion", DIEZ) is False
    cuerpo = mundo.g["correos_enviados"].docs[-1]["cuerpo"]
    assert f"/opinion?o=o1&t={server._opinion_firma('o1')}&utm_source=correo" in cuerpo and "&m=no_supe" in cuerpo
    assert mundo.g["correos_enviados"].docs[-1]["por"] == "ciclo:opinion"


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
    r = await server.ciclo_correos_vuelta(AHORA)
    assert "primer_dia" not in r and "recordatorio" not in r          # (el del bono sí le puede llegar)


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
async def test_el_correo_del_bono_sale_de_verdad(mundo):
    """17-10-2026: la vuelta decía «bono» pero _ciclo_enviar lo volvía a mirar sin el bono y no salía ninguno."""
    # Todo respecto a ese lunes, no a hoy: con «hace 9 días» de verdad, la prueba dejó de pasar al irse alejando la
    # fecha fija (el 26-10 la cuenta ya no tenía la edad del bono ese lunes).
    a_las_11 = datetime(2026, 10, 19, 9, 0, tzinfo=timezone.utc)                  # lunes, 11:00 en Madrid
    alta = (a_las_11 - timedelta(days=9)).isoformat()
    mundo.g["organizations"].docs.append({
        "id": "o7", "name": "Juan", "sector": "autonomo", "plan": "autonomo", "status": "trial", "email": "juan@x.es",
        "pais": "es", "db_name": "dsp_o7", "created_at": alta, "zona_horaria": "Europe/Madrid",
        "trial_ends": (datetime.now(timezone.utc) + timedelta(days=60)).isoformat(),
        "ciclo_correos": {"bienvenida": {"at": alta}}})
    mundo.uso.update({"paradas": 2, "entregadas": 1, "entregadas_reales": 1})
    mundo.monkeypatch.setenv("CICLO_CORREOS", "1")
    assert await server.ciclo_correos_vuelta(a_las_11) == {"bono": 1}
    assert mundo.enviados[-1].subject.startswith(f"{server._BONO_CENT // 100} € por tu primera ruta con ")
    assert "bono" in next(o for o in mundo.g["organizations"].docs if o["id"] == "o7")["ciclo_correos"]
    assert await server.ciclo_correos_vuelta(a_las_11 + timedelta(hours=1)) == {}  # una sola vez


@pytest.mark.asyncio(loop_scope="session")
async def test_el_de_invita_sale_con_su_codigo_de_invitacion(mundo):
    alta = (datetime.now(timezone.utc) - timedelta(hours=30)).isoformat()
    mundo.g["organizations"].docs.append({
        "id": "o9", "name": "Barry", "sector": "autonomo", "plan": "autonomo", "status": "trial", "bono_pagado": True,
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


@pytest.mark.asyncio(loop_scope="session")
async def test_los_enlaces_entran_sin_contrasena_y_la_copia_no_guarda_el_pase(mundo):
    """24-10-2026: de 29 clics en los correos hacia /ruta solo 7 entraban; el resto caía en «crear cuenta»."""
    mundo.g["admin_users"].docs.append({"id": "u1", "org_id": "o1", "username": "pepe@x.es"})
    mundo.g["pases_movil"] = Col([])
    mundo.g["organizations"].docs.append(_org(horas=0.2))
    html = {}

    async def enviar(to, subject, h, responder_a="", copia=None, texto="", cabeceras=None):
        html["h"], html["t"] = h, texto
        return True
    mundo.monkeypatch.setattr(server, "_enviar_email", enviar)
    assert await server._ciclo_enviar("o1", "bienvenida", AHORA) is True
    assert "/pase?ir=ruta&amp;utm_source=correo" in html["h"] or "/pase?ir=ruta&utm_source=correo" in html["h"]
    assert "#p=" in html["t"] and "/ruta?utm_source" not in html["t"]
    pase = html["t"].split("#p=")[1].split()[0].rstrip(").,")
    copia = mundo.g["correos_enviados"].docs[-1]["cuerpo"]
    assert pase not in copia and "#p=…" in copia
    assert mundo.g["pases_movil"].docs[0]["tipo"] == "correo"


def test_sin_pase_los_enlaces_de_siempre():
    c = cc.correo("bienvenida", _org(), {}, AHORA, marca="FDS", base="https://x", baja="https://x/b",
                  mensual=9.99, anual=99, con_respuesta=True)
    assert "https://x/ruta?utm_source=correo" in c["texto"] and "/pase" not in c["texto"]
    c = cc.correo("primer_dia", _org(horas=24), {}, AHORA, marca="FDS", base="https://x", baja="https://x/b",
                  mensual=9.99, anual=99, con_respuesta=True, pase="abc123")
    assert "https://x/pase?ir=ruta&utm_source=correo&utm_medium=email&utm_campaign=ciclo&utm_content=primer_dia#p=abc123" in c["texto"]


def test_quien_se_apunta_por_la_noche_lo_recibe_a_la_manana_siguiente():
    """24-10-2026: con 20 h de espera, el alta de las 21:00 no lo recibía al día siguiente a las 7-9, sino al otro."""
    env = {"bienvenida": {"at": "x"}}
    manana = AHORA                                            # lunes 8:00 de Madrid
    for alta_madrid in (13, 18, 21, 23):                      # el domingo anterior, hora de Madrid
        alta = manana.replace(hour=alta_madrid - 2) - timedelta(days=1)
        org = _org(ciclo_correos=env, created_at=alta.isoformat())
        assert cc.toca(org, {"paradas": 0}, manana) == "primer_dia", alta_madrid
        assert "Ayer creaste tu cuenta" in _correo("primer_dia", org)["texto"]
    # De madrugada (a la 1:00) no: le llegaría a las 6 h del alta; mejor la mañana de después.
    org = _org(ciclo_correos=env, created_at=(manana - timedelta(hours=7)).isoformat())
    assert cc.toca(org, {"paradas": 0}, manana) == ""
