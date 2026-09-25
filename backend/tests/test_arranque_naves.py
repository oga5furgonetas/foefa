# -*- coding: utf-8 -*-
"""Una sede nueva —o una empresa nueva— tiene que poder arrancar sin que nada
este escrito para las sedes de otra empresa.

Medido el 16-09-2026 entrando como una empresa recien creada:
  · dar de alta una alquiladora exigia las sedes de otra empresa escritas a mano;
  · la ubicacion de las sedes le devolvia las de otra empresa como si fueran suyas.
"""
import ast
import io
from pathlib import Path

SERVER = Path(__file__).resolve().parents[1] / "server.py"
TXT = io.open(SERVER, encoding="utf-8-sig").read()


def _funcion(nombre):
    lineas = TXT.split("\n")
    for n in ast.walk(ast.parse(TXT)):
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == nombre:
            return "\n".join(lineas[n.lineno - 1:n.end_lineno])
    raise AssertionError("no existe %s" % nombre)


def test_la_guia_mira_cada_nave():
    c = _funcion("onboarding_status")
    assert "_arranque_naves(await _centros_de_la_empresa())" in c
    assert '"naves": naves' in c


def test_la_guia_no_se_da_por_completa_con_una_nave_sin_cortex():
    c = _funcion("onboarding_status")
    assert '"completo": hechos == len(obligatorios) and naves_ok' in c


def test_lo_obligatorio_es_tener_flota_gente_y_uso_y_lo_recomendado_no_bloquea():
    """Una sede funciona cuando tiene vehiculos, conductores y una inspeccion
    reciente —la prueba de que se USA, no solo de que se dio de alta—. Talleres
    y cuadrante ayudan, pero no pueden dejar la guia abierta para siempre."""
    c = _funcion("_arranque_naves")
    for obligatorio in ("vehiculos", "conductores", "inspeccion"):
        linea = [l for l in c.splitlines() if '{"id": "%s"' % obligatorio in l][0]
        assert '"opcional"' not in linea, "%s tiene que ser obligatorio" % obligatorio
    for opcional in ("talleres", "turnos"):
        linea = [l for l in c.splitlines() if '{"id": "%s"' % opcional in l][0]
        assert '"opcional": True' in linea, "%s no puede dejar la guia abierta" % opcional
    assert 'if not x.get("opcional")' in c


def test_el_centro_sucio_no_deja_a_una_nave_sin_datos():
    c = _funcion("_arranque_naves")
    assert 're.escape(c)' in c, "centro por igualdad: 'OGA5 ' contaria cero (gotcha 6)"


def test_alquiladora_en_cualquier_nave_de_la_empresa():
    c = _funcion("create_rental")
    assert '("OGA5", "DGA1", "DGA2")' not in c
    assert "_centros_de_la_empresa()" in c


def test_la_ubicacion_solo_de_las_naves_de_la_empresa():
    c = _funcion("org_centros_geo")
    assert "_centros_de_la_empresa()" in c
    assert "if c in naves" in c
