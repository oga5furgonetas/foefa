# -*- coding: utf-8 -*-
"""Lo que se escribe en el chat del cuadrante y en las notas de cada persona,
convertido en órdenes para el motor. Sin IA y sin base de datos."""
import datetime as dt

import cuadrante_ordenes as co

HOY = dt.date(2026, 9, 29)          # martes
PERSONAS = [
    {"id": "jcl", "nombre": "JUAN CARLOS LOPEZ GARCIA", "apodos": ["juanmi"]},
    {"id": "jp", "nombre": "JUAN PEREZ RIVAS", "apodos": []},
    {"id": "kev", "nombre": "Kevin Ferney Arias Arias", "apodos": []},
    {"id": "tao", "nombre": "AFILAL TAOUFIK AFILAL", "apodos": ["taofik"]},
    {"id": "ale", "nombre": "ALEX FANDIÑO OTERO", "apodos": []},
    {"id": "bra", "nombre": "BRAIS NEGREIRA TEIGA", "apodos": []},
    {"id": "iag", "nombre": "IAGO BARREIRO OTERO", "apodos": []},
    {"id": "hel", "nombre": "HELENA SOUTO VAZQUEZ", "apodos": []},
    {"id": "pab", "nombre": "PABLO OTERO GENDRA", "apodos": []},
    {"id": "mar", "nombre": "MARIO CASTRO DIAZ", "apodos": []},
]


def ctx(**k):
    c = {"hoy": HOY, "desde": HOY + dt.timedelta(days=1), "hasta": dt.date(2026, 10, 12),
         "personas": PERSONAS, "celdas": {}, "maximas": {}}
    c.update(k)
    return c


def acciones(texto, **k):
    r = co.interpretar_mensaje(texto, ctx(**k))
    return r, [a for a in r["acciones"] if a["accion"] != "recalcular"]


# ── NOTAS ────────────────────────────────────────────────────────────────────

def test_nota_solo_cuatro_dias():
    r = co.interpretar_nota("Este solo trabaja 4 días")
    assert r["reglas"] == {"dias_semana": 4} and not r["sin_entender"]


def test_nota_alternados():
    r = co.interpretar_nota("este alternados")
    assert r["reglas"] == {"max_seguidos": 1} and not r["sin_entender"]


def test_nota_varias_cosas_a_la_vez():
    r = co.interpretar_nota("Nunca los martes ni los jueves. Máximo 3 días seguidos y sin días extra")
    assert r["reglas"] == {"dias_no": [1, 3], "max_seguidos": 3, "sin_extra": True}
    assert not r["sin_entender"]


def test_nota_de_martes_a_sabado():
    r = co.interpretar_nota("trabaja de martes a sábado")
    assert r["reglas"] == {"dias_no": [0, 6]}


def test_nota_solo_fines_de_semana_y_no_findes():
    assert co.interpretar_nota("solo fines de semana")["reglas"] == {"dias_no": [0, 1, 2, 3, 4]}
    assert co.interpretar_nota("no trabaja los fines de semana")["reglas"] == {"dias_no": [5, 6]}


def test_nota_seis_seguidos_no_es_dias_por_semana():
    r = co.interpretar_nota("como mucho 4 días seguidos")
    assert r["reglas"] == {"max_seguidos": 4}


def test_nota_que_no_se_entiende_se_dice():
    r = co.interpretar_nota("prefiere turno de tarde")
    assert r["reglas"] == {} and "tarde" in r["sin_entender"]


def test_semanas_alternas_no_se_confunde_con_dias_alternos():
    r = co.interpretar_nota("trabaja semanas alternas")
    assert "max_seguidos" not in r["reglas"] and r["sin_entender"]


def test_describir_reglas():
    assert co.describir_reglas({"dias_semana": 4, "max_seguidos": 1, "dias_no": [1]}) == [
        "Trabaja 4 días por semana, sin día extra", "Días alternos: nunca dos días seguidos",
        "Nunca trabaja martes"]


# ── PERSONAS Y FECHAS ────────────────────────────────────────────────────────

def test_apodo_y_nombre_completo():
    assert co.personas_en("Juanmi no puede", PERSONAS)[0]["ids"] == ["jcl"]
    assert co.personas_en("juan carlos lopez no puede", PERSONAS)[0]["ids"] == ["jcl"]


def test_juan_a_secas_es_ambiguo():
    m = co.personas_en("dale libre a Juan el sábado", PERSONAS)
    assert sorted(m[0]["ids"]) == ["jcl", "jp"]


def test_fechas_relativas():
    f = co.fechas_en("el viernes", HOY)
    assert f["dias"] == [dt.date(2026, 10, 2)]
    f = co.fechas_en("mañana", HOY)
    assert f["dias"] == [dt.date(2026, 9, 30)]
    f = co.fechas_en("del 5 al 11", HOY)
    assert (f["desde"], f["hasta"]) == (dt.date(2026, 10, 5), dt.date(2026, 10, 11))
    f = co.fechas_en("esta semana", HOY)
    assert (f["desde"], f["hasta"]) == (dt.date(2026, 9, 30), dt.date(2026, 10, 4))
    f = co.fechas_en("la semana que viene", HOY)
    assert (f["desde"], f["hasta"]) == (dt.date(2026, 10, 5), dt.date(2026, 10, 11))
    f = co.fechas_en("el viernes 9", HOY)
    assert dt.date(2026, 10, 9) in f["dias"]


def test_el_30_al_1_cruza_de_mes():
    f = co.fechas_en("del 30 al 2", HOY)
    assert (f["desde"], f["hasta"]) == (dt.date(2026, 9, 30), dt.date(2026, 10, 2))


# ── ÓRDENES DEL CHAT (las del Prompt 2 de Dani) ─────────────────────────────

def test_juanmi_esta_semana_no_puede():
    r, a = acciones("Ten en cuenta que Juanmi esta semana no puede trabajar")
    assert a == [{"accion": "marcar_ausencia", "conductor_id": "jcl", "desde": "2026-09-30",
                  "hasta": "2026-10-04", "codigo": "N/D"}]
    assert r["acciones"][-1]["accion"] == "recalcular" and r["seguro"]


def test_juan_carlos_la_semana_del_5_al_11():
    _, a = acciones("Juan Carlos López no puede trabajar la semana del 5 al 11")
    assert a[0]["desde"] == "2026-10-05" and a[0]["hasta"] == "2026-10-11" and a[0]["codigo"] == "N/D"


def test_tres_de_baja_desde_hoy():
    _, a = acciones("Recalibra el cuadrante, Brais, Iago y Helena están de baja desde hoy")
    assert sorted(x["conductor_id"] for x in a) == ["bra", "hel", "iag"]
    assert all(x["codigo"] == "BAJA" and x["desde"] == "2026-09-29" and x["hasta"] == "2026-10-12" for x in a)


def test_vuelve_de_la_baja_el_lunes():
    _, a = acciones("Pablo Otero vuelve de la baja el lunes")
    assert a == [{"accion": "vuelve_de_baja", "conductor_id": "pab", "fecha": "2026-10-05"}]


def test_kevin_nunca_los_martes():
    _, a = acciones("Kevin nunca puede los martes")
    assert a[0]["accion"] == "regla_fija" and a[0]["dias"] == [1] and a[0]["conductor_id"] == "kev"


def test_el_viernes_9_mas_tres():
    _, a = acciones("El viernes 9 ponme +3 que viene mucho volumen")
    assert a == [{"accion": "colchon_dia", "fecha": "2026-10-09", "colchon": 3}]


def test_alex_maximo_cuatro_dias():
    _, a = acciones("Alex esta semana máximo 4 días")
    assert a == [{"accion": "limite_semana", "conductor_id": "ale", "lunes": "2026-09-28", "max_dias": 4}]


def test_dale_libre_a_taofik_el_sabado():
    _, a = acciones("Dale libre a Taofik el sábado")
    assert a == [{"accion": "fijar_dia", "conductor_id": "tao", "fecha": "2026-10-03", "valor": "N/T"}]


def test_dale_libre_a_juan_pregunta():
    r, a = acciones("Dale libre a Juan el sábado")
    assert a[0]["accion"] == "preguntar" and len(a[0]["opciones"]) == 2


def test_nuevo_conductor():
    _, a = acciones("Ha entrado un conductor nuevo, Marcos Pérez, empieza el día 6, normal")
    assert a == [{"accion": "nuevo_conductor", "nombre": "Marcos Pérez", "tipo": "normal", "alta_desde": "2026-10-06"}]


def test_mario_se_ha_ido():
    _, a = acciones("Mario se ha ido, desde mañana ya no está")
    assert a == [{"accion": "baja_definitiva", "conductor_id": "mar", "desde": "2026-09-30"}]


def test_no_recalcules_todavia():
    r = co.interpretar_mensaje("Dale libre a Taofik el sábado, no recalcules todavía", ctx())
    assert all(x["accion"] != "recalcular" for x in r["acciones"])


def test_lo_que_no_entiende_lo_dice():
    r = co.interpretar_mensaje("qué tiempo hará mañana en Santiago", ctx())
    assert not r["seguro"]


# ── PREGUNTAS ────────────────────────────────────────────────────────────────

def test_quien_libra_el_sabado():
    # Libra quien tiene el día libre; el de vacaciones «no está», no «libra»; y
    # quien ya dejó el cuadrante no cuenta (tenía N/D: salía como que libraba).
    personas = PERSONAS + [{"id": "ido", "nombre": "PEPE SEVA", "apodos": [], "inactivo_desde": "2026-10-01"}]
    celdas = {"jcl|2026-10-03": "N/T", "kev|2026-10-03": "1", "tao|2026-10-03": "V", "ido|2026-10-03": "N/D"}
    r = co.interpretar_mensaje("¿Quién libra el sábado?", ctx(celdas=celdas, personas=personas))
    txt = r["acciones"][0]["texto"]
    assert "libran 1: JUAN CARLOS" in txt and "No están: 1 de vacaciones" in txt
    assert "AFILAL" not in txt and "Kevin" not in txt and "PEPE" not in txt


def test_cuantos_extra_esta_semana():
    r = co.interpretar_mensaje("¿Cuántos días extra hay esta semana?",
                               ctx(extras={"kev|2026-10-01", "tao|2026-10-02", "ale|2026-10-08"}))
    assert "hay 2 días extra" in r["acciones"][0]["texto"]


# ── VALIDAR ──────────────────────────────────────────────────────────────────

def test_validar_quita_lo_que_no_cuadra():
    ok, malas = co.validar_acciones([
        {"accion": "marcar_ausencia", "conductor_id": "jcl", "desde": "2026-10-05", "hasta": "2026-10-11", "codigo": "N/D"},
        {"accion": "marcar_ausencia", "conductor_id": "nadie", "desde": "2026-10-05", "hasta": "2026-10-11"},
        {"accion": "marcar_ausencia", "conductor_id": "jcl", "desde": "2026-10-05", "hasta": "2026-10-11", "codigo": "BORRAR"},
        {"accion": "fijar_dia", "conductor_id": "kev", "fecha": "2026-08-01", "valor": "N/T"},
        {"accion": "borrar_todo"},
        {"accion": "fijar_dia", "conductor": "Kevin Ferney Arias Arias", "fecha": "2026-10-03", "valor": "N/T"},
    ], PERSONAS, HOY)
    assert [a["accion"] for a in ok] == ["marcar_ausencia", "fijar_dia"]
    assert ok[1]["conductor_id"] == "kev"
    assert len(malas) == 4


def test_describir():
    a = {"accion": "marcar_ausencia", "conductor_id": "jcl", "desde": "2026-10-05", "hasta": "2026-10-11", "codigo": "N/D"}
    assert co.describir(a, PERSONAS) == "JUAN CARLOS LOPEZ GARCIA → N/D (no disponible) del 05/10 al 11/10"
