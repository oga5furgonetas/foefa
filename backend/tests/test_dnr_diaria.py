# -*- coding: utf-8 -*-
"""La DNR diaria lee bien los Daily Report que se suben a mano.

En Flota los informes no llegan solos (no hay extensión): se sube el .html
tal cual se descarga del portal, o se pegan las tablas. Si la lectura falla
en silencio, los DNR se cuelgan de quien no es o se pierden, y el número
«parece razonable» igual. Estos casos fijan lo que tiene que salir de un
reporte conocido. Se lee el código REAL de server.py con `ast`.
"""
import ast
import io
import os
import re
import sys
from datetime import datetime, timedelta

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUTA = os.path.join(RAIZ, "server.py")


class HTTPException(Exception):
    def __init__(self, status_code, detail=""):
        super().__init__(detail)
        self.status_code, self.detail = status_code, detail


def _cargar():
    arbol = ast.parse(io.open(RUTA, encoding="utf-8-sig").read())
    constantes = {"_DIARIO_TITULO", "_DIARIO_CENTRO", "_DNR_TITULO", "_DIA_FILA", "_DIA_CELDA",
                  "_DIA_TABLA", "_DIA_H", "_DIA_TID"}
    funciones = {"_dia_celda", "_dia_num", "_dia_euros", "_dia_menos", "_dia_semana",
                 "_dia_texto_html", "_dia_tablas_html", "_parsea_diario_html", "_parsea_diario"}
    cuerpo = [n for n in arbol.body if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") in constantes]
    cuerpo += [n for n in arbol.body if isinstance(n, ast.FunctionDef) and n.name in funciones]
    faltan = (constantes | funciones) - {getattr(n, "name", None) or n.targets[0].id for n in cuerpo}
    assert not faltan, "faltan en server.py: %s" % faltan
    ns = {"re": re, "datetime": datetime, "timedelta": timedelta, "HTTPException": HTTPException}
    exec(compile(ast.fix_missing_locations(ast.Module(body=cuerpo, type_ignores=[])), RUTA, "exec"), ns)
    return ns


NS = _cargar()
TID = "A1B2C3D4E5F6G7"

HTML = """<html><body>
<h1>ES TDSL OGA5 Daily Report 2026-09-20</h1>
<h2>DNR (2026-09-18)</h2>
<table><tr><th>Transporter ID</th><th>RTS</th><th>DNR</th><th>POD Fails</th><th>CC Fails</th></tr>
<tr><td>%(t)s</td><td>1</td><td>2</td><td>0</td><td>1</td></tr></table>
<table><tr><th>Download</th></tr>
<tr><th>Tracking ID</th><th>Transporter ID</th><th>Delivery Date</th><th>DSC</th><th>Delivery Scan</th><th>Value</th><th>Postal Code</th></tr>
<tr><td>TBA1111</td><td>%(t)s</td><td>2026-09-18</td><td>Y</td><td>Front door</td><td>&euro;130.57</td><td>15001</td></tr>
<tr><td>TBA2222</td><td>%(t)s</td><td>2026-09-18</td><td>N</td><td>Mailbox</td><td>&euro;10,50</td><td>15002</td></tr></table>
<table><tr><th>Tracking ID</th><th>Transporter ID</th><th>RTS Reason</th><th>Postal Code</th></tr>
<tr><td>TBA3333</td><td>%(t)s</td><td>Business closed</td><td>15003</td></tr></table>
</body></html>""" % {"t": TID}


def test_el_html_descargado_trae_las_tablas():
    p = NS["_parsea_diario_html"](HTML)
    assert (p["centro"], p["fecha_reporte"], p["fecha_dnr"]) == ("OGA5", "2026-09-20", "2026-09-18"), p
    assert p["resumen"] == [{"transporter_id": TID, "rts": 1, "dnr": 2, "pod_fails": 0, "cc_fails": 1}]
    assert [(r["tracking_id"], r["dsc"], r["valor_eur"]) for r in p["dnr"]] == [
        ("TBA1111", "Y", 130.57), ("TBA2222", "N", 10.5)], p["dnr"]
    assert [(r["tracking_id"], r["motivo"]) for r in p["rts"]] == [("TBA3333", "Business closed")]
    assert p["sin_clasificar"] is False


def test_pegar_las_tablas_de_la_pantalla():
    texto = ("ES TDSL DGA1 Daily Report 2026-09-20\n"
             "Transporter ID\tRTS\tDNR\tPOD Fails\tCC Fails\n"
             "%s\t0\t1\t0\t0\n\n"
             "DNR (2026-09-18)\n"
             "Tracking ID\tTransporter ID\tDelivery Date\tDSC\tValue\n"
             "TBA9999\t%s\t2026-09-18\tY\t€25.00\n" % (TID, TID))
    p = NS["_parsea_diario"](texto)
    assert (p["centro"], p["fecha_dnr"]) == ("DGA1", "2026-09-18")
    assert [(r["tracking_id"], r["dsc"], r["valor_eur"]) for r in p["dnr"]] == [("TBA9999", "Y", 25.0)]


def test_sin_dsc_clasificada_no_cuenta_como_dia_perfecto():
    """Amazon rellena la DSC dos a cuatro días tarde: todo a N es «aún no»."""
    texto = ("Tracking ID\tTransporter ID\tDSC\n"
             "TBA1\t%s\tN\nTBA2\t%s\tN\n" % (TID, TID))
    p = NS["_parsea_diario"]("DNR (2026-09-18)\n" + texto)
    assert p["sin_clasificar"] is True, p


def test_lo_que_no_es_un_reporte_se_rechaza():
    for malo in ("hola", "<html><h1>otra cosa</h1><table><tr><td>x</td></tr></table></html>"):
        try:
            (NS["_parsea_diario_html"] if "<" in malo else NS["_parsea_diario"])(malo)
        except HTTPException as e:
            assert e.status_code == 400
        else:
            raise AssertionError("aceptó algo que no es un reporte: %r" % malo[:30])


def test_euros_en_los_dos_formatos():
    e = NS["_dia_euros"]
    assert (e("€130.57"), e("1.234,56"), e("1,234.56"), e(""), e("n/a")) == (130.57, 1234.56, 1234.56, 0.0, 0.0)


def test_la_semana_de_amazon_empieza_en_domingo():
    assert NS["_dia_semana"]("2026-09-18") == "2026-09-13"     # viernes -> domingo anterior
    assert NS["_dia_semana"]("2026-09-13") == "2026-09-13"     # domingo -> el mismo


def main():
    fallos = 0
    for k, v in list(globals().items()):
        if k.startswith("test_") and callable(v):
            try:
                v()
                print("  ok  %s" % k)
            except AssertionError as ex:
                fallos += 1
                print("  MAL %s: %s" % (k, ex))
    print("%d fallos" % fallos)
    return fallos


if __name__ == "__main__":
    sys.exit(main())
