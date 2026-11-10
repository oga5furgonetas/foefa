# -*- coding: utf-8 -*-
"""Arreglos de Horas (WHC) y de la subida de la DNR, 10-11-2026
(docs/REVISION-FLOTA-PROPIA-10-11.md: horas_dnr-1, -2, -3, -8, historia-2 y el
«de paso» de la DNR sin clasificar).

Sin MongoDB: la base de mentira de las pruebas vecinas (`base_de_mentira`).
"""
from datetime import date, datetime, timezone

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

CABECERA = "Programación\nOpciones\n%s\nIr a esta semana\n\nSemana 46:\n\nnov. 08 - nov. 14, 2026\n\n"
DIAS = "dom., nov. 08\n\nlun., nov. 09\n\nmar., nov. 10\n\nmié., nov. 11\n\njue., nov. 12\n\nvie., nov. 13\n\nsáb., nov. 14\n\n"


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
    monkeypatch.setattr(server, "_dia_negocio", lambda: "2026-11-12")   # jueves
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
    assert [(d["center"], d["week"]) for d in mundo["whc_planes"].docs] == [("DGA1", "2026-11-08")]


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_cabecera_mandan_las_fichas_si_hay_mayoria(mundo):
    r = await _analizar(texto=_plan(None), center="OGA5")
    assert r["guardado"] is False
    assert r["otra_nave"]["centro"] == "DGA1" and r["otra_nave"]["por"] == "fichas"
    assert r["otra_nave"]["casan_alli"] == 6
    assert mundo["whc_planes"].docs == []


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_cabecera_ni_mayoria_se_guarda_como_siempre(mundo):
    # Tres de DGA1 no son mayoría clara: manda la nave elegida.
    r = await _analizar(texto=_plan(None, NOMBRES_DGA1[:3] + ["ANA OGA CINCO"]), center="OGA5")
    assert r["guardado"] is True and r["otra_nave"] is None
    assert mundo["whc_planes"].docs[0]["center"] == "OGA5"


@pytest.mark.asyncio(loop_scope="session")
async def test_la_misma_nave_se_guarda(mundo):
    r = await _analizar(texto=_plan("DGA1"), center="DGA1")
    assert r["guardado"] is True and r["otra_nave"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_con_todos_la_cabecera_sigue_mandando(mundo):
    r = await _analizar(texto=_plan("DGA1"), center="Todos")
    assert r["guardado"] is True and r["centro"] == "DGA1" and r["otra_nave"] is None


# ── H3 · un plan viejo no se ve como de ahora ────────────────────────────────
@pytest.mark.asyncio(loop_scope="session")
async def test_abrir_un_plan_guardado_no_lo_reescribe_y_cuenta_desde_que_se_pego(mundo):
    texto = _plan("DGA1").strip()
    pegado = "2026-11-10T08:00:00+00:00"           # martes, 9:00 en España
    mundo["whc_planes"].docs.append({"center": "DGA1", "week": "2026-11-08", "texto": texto,
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
    mundo["whc_planes"].docs.append({"center": "DGA1", "week": "2026-11-08", "texto": texto,
                                     "n_conductores": 6, "updated_at": "2026-11-09T07:30:00+00:00"})
    r = await _analizar(texto=texto, center="DGA1", guardar=False)
    assert r["pegado_en"] == "2026-11-09T07:30:00+00:00" and r["pegado_hoy"] is False
    assert r["ritmo"]["dia_semana"] == 2


@pytest.mark.asyncio(loop_scope="session")
async def test_recalcular_el_mismo_plan_no_cambia_cuando_se_pego(mundo):
    texto = _plan("DGA1").strip()
    pegado = "2026-11-10T08:00:00+00:00"
    mundo["whc_planes"].docs.append({"center": "DGA1", "week": "2026-11-08", "texto": texto,
                                     "n_conductores": 6, "pegado_en": pegado, "updated_at": pegado})
    r = await _analizar(texto=texto, center="DGA1", excepciones=1)
    assert r["guardado"] is True
    doc = mundo["whc_planes"].docs[0]
    assert doc["pegado_en"] == pegado and doc["excepciones"] == 1


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
async def test_get_y_delete_con_semana(mundo):
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
    assert len(f["avisos"]) == 1 and "sin clasificar" in f["avisos"][0] and "volver a subir" in f["avisos"][0]


@pytest.mark.asyncio(loop_scope="session")
async def test_subir_un_reporte_clasificado_no_avisa(mundo):
    r = await server.subir_diarios([_Fichero("ok.html", _html(["Y", "N"]))], None, "", YO)
    f = r["resultados"][0]
    assert f["sin_clasificar"] == 0 and f["avisos"] == []


@pytest.mark.asyncio(loop_scope="session")
async def test_un_reporte_viejo_conserva_su_aviso_sin_duplicar(mundo):
    r = await server.subir_diarios([_Fichero("viejo.html", _html(["", ""], dsc_col=False))], None, "", YO)
    f = r["resultados"][0]
    assert f["sin_clasificar"] == 2
    assert len(f["avisos"]) == 1 and "13-05-2026" in f["avisos"][0]
