# -*- coding: utf-8 -*-
"""Arreglos de Horas (WHC) y de la subida de la DNR, 10-11-2026
(docs/REVISION-FLOTA-PROPIA-10-11.md: horas_dnr-1, -2, -3, -8, historia-2 y el
«de paso» de la DNR sin clasificar).

Sin MongoDB: la base de mentira de las pruebas vecinas (`base_de_mentira`).
"""
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Db

DB_ACTUAL = server._current_db_name.get()


# ── H1 · la semana de Año Nuevo ───────────────────────────────────────────────
PLAN_ANO_NUEVO = """Semana 53:
dom., dic. 27

lun., dic. 28

mar., dic. 29

mié., dic. 30

jue., dic. 31

vie., ene. 01

sáb., ene. 02
"""


def test_ano_nuevo_mirado_el_29_de_diciembre():
    # Antes: «ene 01/02» se leían como enero de 2026 (pasado) y salía día 5.
    assert server._whc_dias_del_plan(PLAN_ANO_NUEVO, date(2026, 12, 29)) == (3, True)


def test_ano_nuevo_mirado_el_1_de_enero():
    # Antes: «dic 27…31» se leían como diciembre de 2027 (futuro) y salía día 1.
    assert server._whc_dias_del_plan(PLAN_ANO_NUEVO, date(2027, 1, 1)) == (6, True)


def test_sin_fecha_usa_el_dia_de_negocio_de_espana(monkeypatch):
    # Sin `hoy`, el día de negocio (España), no el UTC.
    monkeypatch.setattr(server, "_dia_negocio", lambda: "2027-01-01")
    assert server._whc_dias_del_plan(PLAN_ANO_NUEVO) == (6, True)
    monkeypatch.setattr(server, "_dia_negocio", lambda: "2026-12-29")
    assert server._whc_dias_del_plan(PLAN_ANO_NUEVO) == (3, True)


def test_una_semana_normal_no_cambia():
    plan = "dom., nov. 08\nlun., nov. 09\nmar., nov. 10\nmié., nov. 11\njue., nov. 12\nvie., nov. 13\nsáb., nov. 14\n"
    assert server._whc_dias_del_plan(plan, date(2026, 11, 10)) == (3, True)
    assert server._whc_dias_del_plan(plan, date(2026, 11, 20)) == (7, True)


# ── El mundo de mentira para /whc/analizar ────────────────────────────────────
def _conductor(nombre, horas="20h 10m"):
    return "%s\nEstándar\n%s / 54h 30m\n\n9:00am - 6:10pm\nStandard Parcel\n\n" % (nombre, horas)


NOMBRES_DGA1 = ["LAURA PEREZ CASTRO", "MARTA RIAL SOUTO", "PEDRO LOPEZ VARELA",
                "IRENE OTERO DIAZ", "BRAIS GOMEZ SILVA", "NURIA CASAL PENA"]

# LA SEMANA DEL PLAN SALE DE LA DE HOY, NO ES FIJA (11-11-2026). `_whc_semana_del_plan`
# le pone el año con el reloj REAL (el más cercano a hoy, a 200 días o menos): con
# «nov. 08» fijo, desde el 22-04-2027 el plan pasaba a ser de 2027 y las pruebas que
# buscan su documento dejaban de encontrarlo. El plan es el de la semana en curso
# (domingo DOM) y el día de negocio de las pruebas es su jueves; las horas de
# «pegado» van a las 7-8 UTC, que en España son del mismo día con y sin horario de verano.
_MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
_NOMBRES_DIA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]
_HOY_REAL = datetime.now(timezone.utc).date()
DOM = _HOY_REAL - timedelta(days=(_HOY_REAL.weekday() + 1) % 7)
SEMANA = DOM.isoformat()


def _dia(n):
    return DOM + timedelta(days=n)


def _mes_dia(n):
    f = _dia(n)
    return "%s. %02d" % (_MESES[f.month - 1], f.day)


def _pegado(n, hora):
    """El instante ISO (UTC) del día `n` de la semana del plan (0 = domingo)."""
    return "%sT%s:00+00:00" % (_dia(n).isoformat(), hora)


CABECERA = ("Programación\nOpciones\n%s\nIr a esta semana\n\nSemana 46:\n\n"
            + "%s - %s, %d\n\n" % (_mes_dia(0), _mes_dia(6), _dia(6).year))
DIAS = "".join("%s., %s\n\n" % (_NOMBRES_DIA[i], _mes_dia(i)) for i in range(7))


def _plan(nave=None, nombres=NOMBRES_DGA1):
    cab = (CABECERA % nave) if nave else "Buscar asociados\n"
    return cab + DIAS + "".join(_conductor(n) for n in nombres)


@pytest.fixture
def mundo(monkeypatch):
    t = Db()
    t["whc_planes"] = Col([])
    t["drivers"] = Col([{"id": "d%d" % i, "name": n, "center": "DGA1", "active": True}
                        for i, n in enumerate(NOMBRES_DGA1)]
                       + [{"id": "o1", "name": "ANA OGA CINCO", "center": "OGA5", "active": True}])
    g = Db()
    g["organizations"] = Col([{"db_name": DB_ACTUAL, "account_type": "owner",
                               "centers": ["OGA5", "DGA1", "DGA2"]}])
    monkeypatch.setattr(server, "db", t)
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "_dia_negocio", lambda: _dia(4).isoformat())   # jueves
    return t


async def _analizar(**cuerpo):
    return await server.whc_analizar({"limite_horas": 54.5, **cuerpo}, None)


# ── H2 · el plan de una nave no se guarda en otra ────────────────────────────
@pytest.mark.asyncio(loop_scope="session")
async def test_cabecera_de_otra_nave_no_se_guarda_y_se_puede_mandar_alli(mundo):
    r = await _analizar(texto=_plan("DGA1"), center="OGA5")
    assert r["guardado"] is False
    assert r["otra_nave"] == {"centro": "DGA1", "por": "cabecera"}
    assert "DGA1" in r["aviso_guardado"] and "OGA5" in r["aviso_guardado"]
    assert mundo["whc_planes"].docs == []
    # «Guardarlo en DGA1»: el mismo pegado con la nave buena.
    r2 = await _analizar(texto=_plan("DGA1"), center="DGA1")
    assert r2["guardado"] is True and r2["otra_nave"] is None
    assert [(d["center"], d["week"]) for d in mundo["whc_planes"].docs] == [("DGA1", SEMANA)]


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_cabecera_las_fichas_solo_avisan_y_se_guarda_como_en_main(mundo):
    # G1/G9 (11-11-2026): LAS FICHAS SOLO AVISAN. La petición es la de la web vieja
    # en caché (sin ningún campo nuevo): se guarda en la elegida como en main, sin
    # `aviso_guardado` ni `otra_nave`, y lo de las fichas va aparte en `parece_de`.
    r = await _analizar(texto=_plan(None), center="OGA5")
    assert r["guardado"] is True and r["centro"] == "OGA5"
    assert r["otra_nave"] is None and r["aviso_guardado"] is None
    assert r["parece_de"] == {"centro": "DGA1", "casan_alli": 6, "casan_aqui": 0}
    assert [(d["center"], d["week"], d["n_conductores"]) for d in mundo["whc_planes"].docs] \
        == [("OGA5", SEMANA, 6)]


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_cabecera_ni_mayoria_se_guarda_como_siempre(mundo):
    # Tres de DGA1 no son mayoría clara: manda la nave elegida.
    r = await _analizar(texto=_plan(None, NOMBRES_DGA1[:3] + ["ANA OGA CINCO"]), center="OGA5")
    assert r["guardado"] is True and r["otra_nave"] is None and r["parece_de"] is None
    assert mundo["whc_planes"].docs[0]["center"] == "OGA5"


@pytest.mark.asyncio(loop_scope="session")
async def test_la_misma_nave_se_guarda(mundo):
    r = await _analizar(texto=_plan("DGA1"), center="DGA1")
    assert r["guardado"] is True and r["otra_nave"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_con_todos_la_cabecera_sigue_mandando(mundo):
    r = await _analizar(texto=_plan("DGA1"), center="Todos")
    assert r["guardado"] is True and r["centro"] == "DGA1" and r["otra_nave"] is None


# ── Revisión del 11-11-2026 (R8/R12, R9/R10, R44) ────────────────────────────
OTROS_DGA1 = ["ALBA RIOS MOURE", "HUGO PAZ REY", "LUCIA VAZQUEZ RUA",
              "DIEGO NOVO SANZ", "SARA FRAGA LEIRO", "IVAN CID BAO"]


@pytest.mark.asyncio(loop_scope="session")
async def test_un_plan_de_otra_nave_guardado_aqui_antes_no_se_abre_como_de_hoy(mundo):
    # R8/R12: el plan de DGA1 quedó guardado en OGA5 el martes (antes del
    # arreglo) y se abre el jueves. Está guardado (en OGA5) y es del martes.
    texto = _plan("DGA1").strip()
    pegado = _pegado(2, "08:00")                    # martes
    mundo["whc_planes"].docs.append({"center": "OGA5", "week": SEMANA, "texto": texto,
                                     "n_conductores": 6, "pegado_en": pegado, "updated_at": pegado})
    r = await _analizar(texto=texto, center="OGA5", guardar=False)
    assert r["otra_nave"]["centro"] == "DGA1" and r["guardado"] is False
    assert r["es_el_guardado"] is True
    assert r["pegado_en"] == pegado and r["pegado_hoy"] is False
    assert r["ritmo"]["dia_semana"] == 3
    assert "parece de DGA1" in r["aviso_guardado"] and "no se ha guardado" not in r["aviso_guardado"]
    assert len(mundo["whc_planes"].docs) == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_guardarlo_en_otra_nave_no_pisa_sin_preguntar(mundo):
    # R8: DGA1 ya tiene OTRO plan de esa semana (más nuevo). «Guardarlo en DGA1»
    # manda sustituir=false: no se pisa y se dice qué hay.
    nuevo = _plan("DGA1", OTROS_DGA1).strip()
    mundo["whc_planes"].docs.append({"center": "DGA1", "week": SEMANA, "texto": nuevo,
                                     "n_conductores": 6, "excepciones": 1,
                                     "pegado_en": _pegado(3, "07:00"),
                                     "updated_at": _pegado(3, "07:00")})
    viejo = _plan("DGA1").strip()
    r = await _analizar(texto=viejo, center="DGA1", sustituir=False)
    assert r["guardado"] is False
    assert r["ya_hay_plan"] == {"pegado_en": _pegado(3, "07:00"), "n_conductores": 6}
    assert mundo["whc_planes"].docs[0]["texto"] == nuevo
    # Confirmado en la pantalla: se sustituye.
    r = await _analizar(texto=viejo, center="DGA1", sustituir=True)
    assert r["guardado"] is True and r["ya_hay_plan"] is None
    assert mundo["whc_planes"].docs[0]["texto"] == viejo


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_sustituir_se_pisa_como_siempre_y_el_mismo_texto_se_guarda(mundo):
    # La web vieja (sin el campo) y el pegado normal sustituyen, como antes.
    mundo["whc_planes"].docs.append({"center": "DGA1", "week": SEMANA,
                                     "texto": _plan("DGA1", OTROS_DGA1), "n_conductores": 6})
    r = await _analizar(texto=_plan("DGA1"), center="DGA1")
    assert r["guardado"] is True and r["ya_hay_plan"] is None
    # Con sustituir=false y el MISMO texto no hay nada que preguntar.
    r = await _analizar(texto=_plan("DGA1"), center="DGA1", sustituir=False)
    assert r["guardado"] is True and r["ya_hay_plan"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_excepciones_se_conservan_las_del_plan(mundo):
    # R9/R10: «Guardarlo en DGA1» no manda excepciones; las de DGA1 se quedan.
    mundo["whc_planes"].docs.append({"center": "DGA1", "week": SEMANA,
                                     "texto": _plan("DGA1"), "n_conductores": 6, "excepciones": 3})
    r = await _analizar(texto=_plan("DGA1", OTROS_DGA1), center="DGA1")
    assert r["guardado"] is True
    assert mundo["whc_planes"].docs[0]["excepciones"] == 3
    # S9 (11-11-2026): y la respuesta usa esa cifra, no «no se sabe».
    assert r["whc"]["excepciones_conocidas"] is True and r["whc"]["excepciones"] == 3
    assert r["whc"]["porcentaje"] == 50.0               # 6 con horas, 3 excepciones
    # Con la cifra, se guarda la cifra (como siempre).
    await _analizar(texto=_plan("DGA1"), center="DGA1", excepciones=1)
    assert mundo["whc_planes"].docs[0]["excepciones"] == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_null_explicito_quita_las_excepciones(mundo):
    # S9: la casilla vaciada a propósito al recalcular manda null y la cifra se
    # quita (antes null conservaba: no había forma de volver a «no se sabe»).
    texto = _plan("DGA1").strip()
    mundo["whc_planes"].docs.append({"center": "DGA1", "week": SEMANA, "texto": texto,
                                     "n_conductores": 6, "excepciones": 2})
    r = await _analizar(texto=texto, center="DGA1", excepciones=None)
    assert r["guardado"] is True
    assert "excepciones" not in mundo["whc_planes"].docs[0]
    assert r["whc"]["excepciones_conocidas"] is False and r["whc"]["porcentaje"] is None
    # Y al volver a abrirlo (sin la clave), sigue sin saberse.
    r = await _analizar(texto=texto, center="DGA1", guardar=False)
    assert r["whc"]["excepciones_conocidas"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_abrir_sin_la_clave_usa_la_cifra_del_plan_guardado(mundo):
    # S9: el plan guardado tiene su cifra; si la petición no la trae, el WHC sale
    # con ella. Un pegado de OTRO centro no se lleva la cifra de la elegida.
    texto = _plan("DGA1").strip()
    mundo["whc_planes"].docs.append({"center": "DGA1", "week": SEMANA, "texto": texto,
                                     "n_conductores": 6, "excepciones": 1})
    r = await _analizar(texto=texto, center="DGA1", guardar=False)
    assert r["whc"]["excepciones"] == 1 and r["whc"]["excepciones_conocidas"] is True
    r = await _analizar(texto=_plan("OGA5"), center="DGA1", guardar=False)
    assert r["otra_nave"]["centro"] == "OGA5"
    assert r["whc"]["excepciones_conocidas"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_un_plan_nuevo_sin_excepciones_no_guarda_un_cero(mundo):
    await _analizar(texto=_plan("DGA1"), center="DGA1")
    assert "excepciones" not in mundo["whc_planes"].docs[0]


@pytest.mark.asyncio(loop_scope="session")
async def test_ignorar_fichas_se_acepta_y_no_cambia_nada(mundo):
    # G1/G9 (11-11-2026): el parámetro de la tanda anterior ya no hace nada; con
    # él o sin él, el plan sin cabecera se guarda en la elegida y se avisa igual.
    r = await _analizar(texto=_plan(None), center="OGA5", ignorar_fichas=True)
    assert r["guardado"] is True and r["otra_nave"] is None and r["aviso_guardado"] is None
    assert r["parece_de"]["centro"] == "DGA1"
    assert mundo["whc_planes"].docs[0]["center"] == "OGA5"


@pytest.mark.asyncio(loop_scope="session")
async def test_ignorar_fichas_no_salta_la_cabecera(mundo):
    r = await _analizar(texto=_plan("DGA1"), center="OGA5", ignorar_fichas=True)
    assert r["guardado"] is False and r["otra_nave"]["por"] == "cabecera"
    assert mundo["whc_planes"].docs == []


@pytest.mark.asyncio(loop_scope="session")
async def test_con_cabecera_de_otro_centro_sigue_sin_guardarse_aunque_las_fichas_digan_aqui(mundo):
    # G1/G9: `otra_nave` (lo que impide guardar) queda SOLO para la cabecera, y
    # manda aunque las fichas apunten a la elegida. Sin `parece_de` (no se miran).
    r = await _analizar(texto=_plan("OGA5"), center="DGA1")
    assert r["guardado"] is False and r["otra_nave"] == {"centro": "OGA5", "por": "cabecera"}
    assert r["parece_de"] is None and "no se ha guardado" in r["aviso_guardado"]
    assert mundo["whc_planes"].docs == []


# ── S1 (11-11-2026): un plan ya guardado en la elegida no se juzga por las fichas ─
@pytest.mark.asyncio(loop_scope="session")
async def test_guardado_sin_cabecera_se_abre_y_se_recalcula_sin_aviso(mundo):
    # Las fichas de esta gente dicen DGA1; la oficina de OGA5 lo pega en OGA5.
    texto = _plan(None)
    r = await _analizar(texto=texto, center="OGA5")
    assert r["guardado"] is True and r["parece_de"]["centro"] == "DGA1"
    # Abrir la pantalla (guardar=false): no se miran las fichas, ni «parece de DGA1».
    r = await _analizar(texto=texto, center="OGA5", guardar=False)
    assert r["otra_nave"] is None and r["es_el_guardado"] is True
    assert r["aviso_guardado"] is None and r["parece_de"] is None
    # «Recalcular» con la hoja de Amazon: se guarda la cifra, sin fichas.
    r = await _analizar(texto=texto, center="OGA5", excepciones=1, recalcular=True)
    assert r["otra_nave"] is None and r["guardado"] is True and r["parece_de"] is None
    assert [(d["center"], d.get("excepciones")) for d in mundo["whc_planes"].docs] == [("OGA5", 1)]


@pytest.mark.asyncio(loop_scope="session")
async def test_un_plan_sin_cabecera_guardado_antes_se_abre_sin_aviso(mundo):
    # Los planes sin cabecera que ya hay en producción (guardados sin comprobar
    # fichas) no se señalan al abrirlos aunque las fichas digan otro centro.
    texto = _plan(None).strip()
    mundo["whc_planes"].docs.append({"center": "OGA5", "week": SEMANA, "texto": texto,
                                     "n_conductores": 6, "pegado_en": _pegado(2, "08:00")})
    r = await _analizar(texto=texto, center="OGA5", guardar=False)
    assert r["otra_nave"] is None and r["es_el_guardado"] is True and r["parece_de"] is None
    # Un pegado NUEVO con esas fichas se guarda en la elegida (G1/G9: las fichas
    # solo avisan) y lo de las fichas va en `parece_de`.
    nuevo = _plan(None, NOMBRES_DGA1 + ["ANA OGA CINCO"]).strip()
    r = await _analizar(texto=nuevo, center="OGA5")
    assert r["otra_nave"] is None and r["guardado"] is True and r["aviso_guardado"] is None
    assert r["parece_de"] == {"centro": "DGA1", "casan_alli": 6, "casan_aqui": 1}
    assert mundo["whc_planes"].docs[0]["texto"] == nuevo


@pytest.mark.asyncio(loop_scope="session")
async def test_un_plan_guardado_con_cabecera_de_otro_centro_sigue_avisando(mundo):
    texto = _plan("DGA1").strip()
    mundo["whc_planes"].docs.append({"center": "OGA5", "week": SEMANA, "texto": texto,
                                     "n_conductores": 6, "pegado_en": _pegado(2, "08:00")})
    r = await _analizar(texto=texto, center="OGA5", guardar=False)
    assert r["otra_nave"] == {"centro": "DGA1", "por": "cabecera"} and r["es_el_guardado"] is True
    r = await _analizar(texto=texto, center="OGA5", excepciones=1)
    assert r["guardado"] is False and "excepciones" not in mundo["whc_planes"].docs[0]


# ── H3 · un plan viejo no se ve como de ahora ────────────────────────────────
@pytest.mark.asyncio(loop_scope="session")
async def test_abrir_un_plan_guardado_no_lo_reescribe_y_cuenta_desde_que_se_pego(mundo):
    texto = _plan("DGA1").strip()
    pegado = _pegado(2, "08:00")                    # martes, 9:00 (o 10:00) en España
    mundo["whc_planes"].docs.append({"center": "DGA1", "week": SEMANA, "texto": texto,
                                     "n_conductores": 6, "excepciones": 2,
                                     "pegado_en": pegado, "updated_at": pegado})
    r = await _analizar(texto=texto, center="DGA1", guardar=False, excepciones=2)
    assert r["guardado"] is False and r["solo_analisis"] is True
    assert r["pegado_en"] == pegado and r["pegado_hoy"] is False
    # Día 3 (dom, lun, mar), no el 5 del jueves en que se abre.
    assert r["ritmo"]["dia_semana"] == 3
    doc = mundo["whc_planes"].docs[0]
    assert doc["updated_at"] == pegado and doc["pegado_en"] == pegado


@pytest.mark.asyncio(loop_scope="session")
async def test_un_plan_guardado_antes_usa_su_updated_at(mundo):
    texto = _plan("DGA1").strip()
    mundo["whc_planes"].docs.append({"center": "DGA1", "week": SEMANA, "texto": texto,
                                     "n_conductores": 6, "updated_at": _pegado(1, "07:30")})
    r = await _analizar(texto=texto, center="DGA1", guardar=False)
    assert r["pegado_en"] == _pegado(1, "07:30") and r["pegado_hoy"] is False
    assert r["ritmo"]["dia_semana"] == 2


@pytest.mark.asyncio(loop_scope="session")
async def test_recalcular_el_mismo_plan_no_cambia_cuando_se_pego(mundo):
    texto = _plan("DGA1").strip()
    pegado = _pegado(2, "08:00")
    mundo["whc_planes"].docs.append({"center": "DGA1", "week": SEMANA, "texto": texto,
                                     "n_conductores": 6, "pegado_en": pegado, "updated_at": pegado})
    # G8 (11-11-2026): «Recalcular» de la pantalla nueva manda `recalcular`.
    r = await _analizar(texto=texto, center="DGA1", excepciones=1, recalcular=True)
    assert r["guardado"] is True
    assert r["pegado_en"] == pegado and r["pegado_hoy"] is False and r["ritmo"]["dia_semana"] == 3
    doc = mundo["whc_planes"].docs[0]
    assert doc["pegado_en"] == pegado and doc["excepciones"] == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_el_mismo_texto_pegado_otra_vez_es_de_ahora(mundo):
    # G8 (11-11-2026): el portal da el mismo texto el martes temprano que el lunes
    # por la noche. Un pegado nuevo (o cualquier petición que guarda sin
    # `recalcular`, como la web vieja) cuenta como pegado ahora, igual que en main:
    # día de hoy, «Pegado hoy», y se guarda esa hora.
    texto = _plan("DGA1").strip()
    pegado = _pegado(2, "08:00")                    # martes
    mundo["whc_planes"].docs.append({"center": "DGA1", "week": SEMANA, "texto": texto,
                                     "n_conductores": 6, "pegado_en": pegado, "updated_at": pegado})
    antes = datetime.now(timezone.utc).isoformat()
    r = await _analizar(texto=texto, center="DGA1")
    assert r["guardado"] is True and r["es_el_guardado"] is True
    assert r["pegado_hoy"] is True and r["pegado_en"] >= antes
    assert r["ritmo"]["dia_semana"] == 5            # el jueves de hoy, no el martes
    assert mundo["whc_planes"].docs[0]["pegado_en"] == r["pegado_en"]
    # Con `recalcular: false` (o cualquier cosa que no sea true), lo mismo.
    r = await _analizar(texto=texto, center="DGA1", recalcular="si")
    assert r["pegado_hoy"] is True and r["ritmo"]["dia_semana"] == 5


@pytest.mark.asyncio(loop_scope="session")
async def test_un_pegado_nuevo_es_de_hoy(mundo):
    antes = datetime.now(timezone.utc).isoformat()
    r = await _analizar(texto=_plan("DGA1"), center="DGA1")
    assert r["guardado"] is True and r["pegado_hoy"] is True
    assert r["pegado_en"] >= antes
    assert mundo["whc_planes"].docs[0]["pegado_en"] == r["pegado_en"]
    assert r["ritmo"]["dia_semana"] == 5           # jueves 12-11


# ── H4 · ver y borrar el plan de una semana concreta ─────────────────────────
@pytest.mark.asyncio(loop_scope="session")
async def test_get_y_delete_con_semana(mundo, monkeypatch):
    # Esta no pasa por la semana del plan: su propio «hoy», fijo.
    monkeypatch.setattr(server, "_dia_negocio", lambda: "2026-11-12")
    col = mundo["whc_planes"]
    col.docs += [{"center": "OGA5", "week": "2026-11-01", "texto": "pasada"},
                 {"center": "OGA5", "week": "2026-11-08", "texto": "esta"}]
    # Sin semana, la en curso (como antes).
    r = await server.whc_plan_get("OGA5", None, None)
    assert r["hay"] and r["semana"] == "2026-11-08" and r["texto"] == "esta"
    # Con semana (vale cualquier día de ella), esa.
    r = await server.whc_plan_get("OGA5", "2026-11-03", None)
    assert r["semana"] == "2026-11-01" and r["texto"] == "pasada"
    # Borrar la pasada no toca la de esta semana.
    r = await server.whc_plan_delete("OGA5", "2026-11-01", None)
    assert r["borrados"] == 1 and r["semana"] == "2026-11-01"
    assert [d["week"] for d in col.docs] == ["2026-11-08"]
    # Sin semana, borra la en curso, como siempre.
    r = await server.whc_plan_delete("OGA5", None, None)
    assert r["borrados"] == 1 and col.docs == []


@pytest.mark.asyncio(loop_scope="session")
async def test_semana_mal_escrita_es_un_400(mundo):
    with pytest.raises(HTTPException) as e:
        await server.whc_plan_get("OGA5", "la-pasada", None)
    assert e.value.status_code == 400


# ── H5 · subir el .html avisa de lo que viene sin clasificar ─────────────────
class _Fichero:
    def __init__(self, nombre, contenido):
        self.filename, self._c = nombre, contenido.encode("utf-8")

    async def read(self):
        return self._c


def _html(filas_dnr, dsc_col=True):
    cab_dsc = "<th>DSC</th>" if dsc_col else ""
    filas = "".join(
        "<tr><td>TBA%d</td><td>A1B2C3D4E5F6G7</td><td>2026-11-06</td>%s<td>Front door</td>"
        "<td>&euro;10.00</td><td>15001</td></tr>" % (i, ("<td>%s</td>" % d) if dsc_col else "")
        for i, d in enumerate(filas_dnr))
    return ("<html><body><h1>ES TDSL OGA5 Daily Report 2026-11-08</h1><h2>DNR (2026-11-06)</h2>"
            "<table><tr><th>Transporter ID</th><th>RTS</th><th>DNR</th><th>POD Fails</th><th>CC Fails</th></tr>"
            "<tr><td>A1B2C3D4E5F6G7</td><td>0</td><td>%d</td><td>0</td><td>0</td></tr></table>"
            "<table><tr><th>Tracking ID</th><th>Transporter ID</th><th>Delivery Date</th>%s"
            "<th>Delivery Scan</th><th>Value</th><th>Postal Code</th></tr>%s</table></body></html>"
            % (len(filas_dnr), cab_dsc, filas))


YO = {"sub": "a1", "role": "admin", "account_type": "owner", "org_id": "owner"}


@pytest.mark.asyncio(loop_scope="session")
async def test_subir_un_reporte_sin_clasificar_lo_dice(mundo):
    r = await server.subir_diarios([_Fichero("hoy.html", _html(["N", "N", "N"]))], None, "", YO)
    f = r["resultados"][0]
    assert f["sin_clasificar"] == 3
    # R48: en un campo aparte, que la web vieja no lee (si no, lo presentaría
    # como «anterior al 13-05-2026»).
    assert f["avisos"] == []
    assert "sin clasificar" in f["aviso_sin_clasificar"] and "volver a subir" in f["aviso_sin_clasificar"]


@pytest.mark.asyncio(loop_scope="session")
async def test_subir_un_reporte_clasificado_no_avisa(mundo):
    r = await server.subir_diarios([_Fichero("ok.html", _html(["Y", "N"]))], None, "", YO)
    f = r["resultados"][0]
    assert f["sin_clasificar"] == 0 and f["avisos"] == [] and f["aviso_sin_clasificar"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_un_reporte_viejo_conserva_su_aviso_sin_duplicar(mundo):
    r = await server.subir_diarios([_Fichero("viejo.html", _html(["", ""], dsc_col=False))], None, "", YO)
    f = r["resultados"][0]
    assert f["sin_clasificar"] == 2
    assert len(f["avisos"]) == 1 and "13-05-2026" in f["avisos"][0]
    assert f["aviso_sin_clasificar"] is None
