# -*- coding: utf-8 -*-
"""Pegar la lista en la plantilla diaria funciona aunque la IA no conteste.

La plantilla se monta a primera hora pegando la lista de quién lleva qué
vehículo. Si la IA está sin cuota o saturada, el texto se lee por columnas
(`_plantilla_texto_sin_ia`): pegar tiene que funcionar siempre. Se prueba con
los formatos que se pegan de verdad: tabuladores (Excel, hojas de cálculo),
varios espacios (tablas de una web) y un solo espacio (texto de un chat).
Se lee la función real de server.py con `ast`.
"""
import ast
import io
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUTA = os.path.join(RAIZ, "server.py")


def _cargar():
    arbol = ast.parse(io.open(RUTA, encoding="utf-8-sig").read())
    funciones = {"_plantilla_texto_sin_ia", "_nombre_de_texto"}
    constantes = {"_PLACA_RE", "_HORA_EN_TEXTO_RE", "_RUTA_EN_TEXTO_RE", "_CONTRATO_RE"}
    cuerpo = [n for n in arbol.body if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") in constantes]
    cuerpo += [n for n in arbol.body if isinstance(n, ast.FunctionDef) and n.name in funciones]
    assert len(cuerpo) == 6, "faltan piezas en server.py"
    ns = {}
    exec("import re", ns)
    exec(compile(ast.fix_missing_locations(ast.Module(body=cuerpo, type_ignores=[])), "<server>", "exec"), ns)
    return ns


NS = _cargar()
leer = NS["_plantilla_texto_sin_ia"]


def test_tabuladores_apellido_coma_nombre():
    filas = leer("Rodriguez Arias, Andrea\t7906NFX\nGomez Vidal, Luis\t0116 MBP\n")
    assert [(f["conductor"], f["furgo"]) for f in filas] == [
        ("ANDREA RODRIGUEZ ARIAS", "7906NFX"), ("LUIS GOMEZ VIDAL", "0116MBP")], filas


def test_un_solo_espacio():
    filas = leer("Rodriguez Arias, Andrea 7906 NFX")
    assert filas == [{"ruta": "", "conductor": "ANDREA RODRIGUEZ ARIAS", "furgo": "7906NFX", "h_salida": ""}], filas


def test_ruta_nombre_y_hora():
    filas = leer("CA_A44   ANDREA RODRIGUEZ   10:20\nR12 LUIS GOMEZ 9.35\n")
    assert [(f["ruta"], f["conductor"], f["h_salida"]) for f in filas] == [
        ("CA_A44", "ANDREA RODRIGUEZ", "10:20"), ("R12", "LUIS GOMEZ", "09:35")], filas


def test_todo_en_una_linea():
    filas = leer("R7\tMaria Lopez\t1234 KLM\t08:40\tETT11")
    assert filas == [{"ruta": "R7", "conductor": "MARIA LOPEZ", "furgo": "1234KLM", "h_salida": "08:40"}], filas


def test_cabeceras_vacios_y_repetidos_fuera():
    texto = ("Conductor\tMatrícula\n\n"          # la cabecera no trae matrícula ni hora,
             "Ana Ruiz\t2222BBB\n"              # pero SÍ parece un nombre: se descarta
             "Ana Ruiz\t2222BBB\n"              # por repetida más abajo si hiciera falta
             "SIN ASIGNAR\t3333CCC\n"
             "\t\t\n")
    nombres = [f["conductor"] for f in leer(texto)]
    assert nombres.count("ANA RUIZ") == 1, nombres
    assert "SIN ASIGNAR" not in nombres, nombres


def test_el_contrato_no_es_una_ruta():
    """Visto con la IA caída (26-09-2026): la lista de vehículos trae el
    contrato de ETT en una columna y salía como ruta en las tres filas."""
    filas = leer("Rodriguez Arias, Andrea    7906NFX   ETT11\n"
                 "Gomez Vidal, Luis    0116 MBP   ETT20\n"
                 "Martinez Pena, Sara    4455NKC   ETT11\n")
    assert [f["ruta"] for f in filas] == ["", "", ""], filas
    assert [f["furgo"] for f in filas] == ["7906NFX", "0116MBP", "4455NKC"], filas


def test_un_codigo_repetido_no_es_una_ruta():
    filas = leer("T2\tAna Ruiz\t1111AAA\nT2\tLuis Gil\t2222BBB\nR9\tEva Sanz\t3333CCC\n")
    assert [f["ruta"] for f in filas] == ["", "", "R9"], filas


def test_sin_nombre_no_hay_fila():
    assert leer("7906NFX\t10:20\n12345\n") == []


def main():
    fallos = 0
    for k, v in list(globals().items()):
        if k.startswith("test_") and callable(v):
            try:
                v()
                print("  ok  %s" % k)
            except AssertionError as e:
                fallos += 1
                print("  MAL %s: %s" % (k, e))
    print("%d fallos" % fallos)
    return fallos


if __name__ == "__main__":
    sys.exit(main())
