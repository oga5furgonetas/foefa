# -*- coding: utf-8 -*-
"""Las horas de la plantilla diaria: forma HH:MM, redondeo por tramos y las
dos horas que cuelgan de la salida.

Hay empresas que salen por tandas fijas (a en punto, y 20 y menos 20) y cuya
lista de rutas enseña la hora unos minutos DESPUÉS de la tanda. En FlotaDSP
se restaban 12 minutos fijos y eso solo acertaba si el desfase era justo 12:
8 de 18 filas de una plantilla real salían con horas que no existían (11:50).
Bajar al tramo corrige cualquier desfase entre 0 y el tamaño del tramo.

Lo que se prueba:
  1. con tramo, la hora resultante SIEMPRE cae en la rejilla;
  2. donde restar 12 ya acertaba (tramos de 20), el tramo da EXACTAMENTE lo mismo;
  3. sin tramo (0, lo normal), la hora queda tal cual, solo bien escrita.

Se lee la función real de server.py con `ast`.
"""
import ast
import io
import os
import sys
from datetime import datetime, timedelta

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUTA = os.path.join(RAIZ, "server.py")


def _cargar():
    arbol = ast.parse(io.open(RUTA, encoding="utf-8-sig").read())
    quiero = ("_hora_hhmm", "_redondear_hora", "_calc_horas")
    cuerpo = [n for n in arbol.body if isinstance(n, ast.FunctionDef) and n.name in quiero]
    ns = {"datetime": datetime, "timedelta": timedelta}
    exec(compile(ast.Module(body=cuerpo, type_ignores=[]), RUTA, "exec"), ns)
    for f in quiero:
        assert f in ns, "no encontrado en server.py: %s" % f
    return ns


NS = _cargar()
redondear = NS["_redondear_hora"]


def _mins(h):
    a, b = h.split(":")
    return int(a) * 60 + int(b)


def test_con_tramo_la_hora_siempre_cae_en_la_rejilla():
    for tramo in (10, 15, 20, 30):
        for hh in range(0, 24):
            for mm in range(0, 60):
                r = redondear("%02d:%02d" % (hh, mm), tramo)
                assert r, "no debería quedarse vacía con %02d:%02d" % (hh, mm)
                assert _mins(r) % tramo == 0, "%02d:%02d -> %s, fuera de la rejilla de %d" % (hh, mm, r, tramo)


def test_no_cambia_lo_que_ya_salia_bien():
    """Donde restar 12 minutos acertaba, el tramo de 20 da lo mismo."""
    for hh in range(0, 24):
        for mm in range(0, 60):
            crudo = "%02d:%02d" % (hh, mm)
            viejo = (datetime.strptime(crudo, "%H:%M") - timedelta(minutes=12)).strftime("%H:%M")
            if _mins(viejo) % 20 == 0:
                assert redondear(crudo, 20) == viejo, crudo


def test_los_casos_reales():
    assert redondear("12:02", 20) == "12:00"
    assert redondear("11:32", 20) == "11:20"
    assert redondear("11:59", 20) == "11:40"
    assert redondear("12:00", 20) == "12:00"


def test_sin_tramo_la_hora_queda_tal_cual():
    assert redondear("11:32", 0) == "11:32"
    assert redondear("9:05") == "09:05"
    assert redondear("10h30") == "10:30"
    assert redondear("10.45") == "10:45"


def test_llegada_y_carga_cuelgan_de_la_salida():
    """Llegada 30 minutos antes y carga 10 antes."""
    llegada, carga = NS["_calc_horas"]("12:00")
    assert llegada == "11:30" and carga == "11:50"
    assert NS["_calc_horas"]("") == ("", "")
    assert NS["_calc_horas"]("no es una hora") == ("", "")


def test_lo_que_no_es_hora_no_se_inventa():
    for malo in ("", None, "abc", "25:99", "null"):
        assert redondear(malo, 20) == "", malo
        assert NS["_hora_hhmm"](malo) == "", malo


def main() -> int:
    fallos = 0
    for nombre, fn in sorted(globals().items()):
        if nombre.startswith("test_") and callable(fn) and nombre != "test_todos_los_casos":
            try:
                fn()
                print("  ok  %s" % nombre)
            except AssertionError as e:
                fallos += 1
                print("  MAL %s: %s" % (nombre, e))
    print("%d fallos" % fallos)
    return 1 if fallos else 0


def test_todos_los_casos():
    assert main() == 0


if __name__ == "__main__":
    sys.exit(main())
