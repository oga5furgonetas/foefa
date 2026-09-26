# -*- coding: utf-8 -*-
"""La rotación de copias de seguridad solo toca las copias de ESTE producto.

Flota comparte el almacenamiento R2 con las copias antiguas de FlotaDSP
(`backups/flotadsp_…`). Rotando con el prefijo «backups/» a secas y ordenando
por nombre, `flotadsp_…` va por delante de `flota_…`: las 14 viejas se
quedaban para siempre y cada copia nueva de Flota se borraba nada más subirse.
"""
import ast
import io
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUENTE = io.open(os.path.join(RAIZ, "server.py"), encoding="utf-8-sig").read()


def _cuerpo(nombre):
    for n in ast.walk(ast.parse(FUENTE)):
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == nombre:
            return ast.get_source_segment(FUENTE, n)
    raise AssertionError("no existe %s" % nombre)


def test_la_rotacion_solo_mira_las_copias_propias():
    c = _cuerpo("backup_database_to_r2")
    assert 'key = f"backups/{MARCA.lower()}_{stamp}.jsonl.gz"' in c
    assert 'Prefix=f"backups/{MARCA.lower()}_"' in c, "la rotación vuelve a mirar todas las copias"
    assert 'Prefix="backups/")' not in c


def test_el_orden_que_rompia():
    """Lo que pasaba: ordenado al revés, lo de FlotaDSP va primero."""
    claves = sorted(["backups/flotadsp_2026-09-24_0200.jsonl.gz", "backups/flota_2026-09-27_0400.jsonl.gz"], reverse=True)
    assert claves[0].startswith("backups/flotadsp_")
