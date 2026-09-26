# -*- coding: utf-8 -*-
"""Cuando se borra un candidato (a mano o a los 12 meses), se borra también su
CV del almacenamiento, que es público por enlace.

Antes la papelera y la caducidad quitaban la ficha y el PDF seguía ahí para
siempre (26-09-2026). Se lee el código REAL de server.py.
"""
import ast
import io
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUENTE = io.open(os.path.join(RAIZ, "server.py"), encoding="utf-8-sig").read()
ARBOL = ast.parse(FUENTE)


def _fuente(nombre):
    for n in ast.walk(ARBOL):
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == nombre:
            return ast.get_source_segment(FUENTE, n)
    raise AssertionError("no existe %s" % nombre)


def _clave_cv():
    ns = {"os": os}
    exec(compile(ast.Module(body=[n for n in ARBOL.body if isinstance(n, ast.FunctionDef) and n.name == "_clave_cv"],
                            type_ignores=[]), "server.py", "exec"), ns)
    return ns["_clave_cv"]


def test_la_clave_del_cv_sale_del_enlace_y_solo_si_es_un_cv():
    os.environ["R2_PUBLIC_URL"] = "https://pub-x.r2.dev"
    f = _clave_cv()
    assert f("https://pub-x.r2.dev/cv/of1/abc.pdf") == "cv/of1/abc.pdf"
    assert f("cv/of1/abc.pdf") == "cv/of1/abc.pdf"
    # Nada que no sea un CV nuestro: ni otras carpetas, ni otros dominios, ni trucos.
    for malo in ("https://pub-x.r2.dev/backups/x.gz", "https://join.com/cv/1.pdf", "", None,
                 "https://pub-x.r2.dev/cv/../backups/x", "docs/v/contrato.pdf"):
        assert f(malo) == "", malo


def test_la_papelera_borra_el_cv_antes_que_la_ficha():
    c = _fuente("empleo_borrar_candidato")
    assert "_borrar_cv_de(" in c
    assert c.index("_borrar_cv_de(") < c.index("candidatos.delete_one"), "si se borra antes la ficha, se pierde el enlace"


def test_la_caducidad_se_adelanta_al_ttl():
    c = _fuente("_purgar_candidatos_que_caducan")
    assert "timedelta(days=1)" in c and "_borrar_cv_de(" in c
    assert "global_db.organizations" in c, "tiene que recorrer todas las empresas"
