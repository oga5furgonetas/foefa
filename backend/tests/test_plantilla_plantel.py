# -*- coding: utf-8 -*-
"""Pegar la lista de rutas tal cual: se encuentra a los conductores DE LA EMPRESA.

Lo que se copia de una pantalla de rutas llega de muchas formas: en columnas
con tabuladores, con cada celda en su propia línea, con los nombres al revés
(«Apellidos, Nombre»), sin tildes o cortados, y con columnas de texto (el tipo
de servicio) que tienen más letras que el propio nombre. Leer por columnas se
equivocaba; aquí se busca a cada persona del plantel. Se prueba la función real
de server.py, sacada con `ast`.
"""
import ast
import io
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUTA = os.path.join(RAIZ, "server.py")


def _cargar():
    arbol = ast.parse(io.open(RUTA, encoding="utf-8-sig").read())
    funciones = {"_plantilla_por_plantel", "_normalize_name", "_name_tokens"}
    constantes = {"_PLACA_RE", "_HORA_EN_TEXTO_RE", "_RUTA_EN_TEXTO_RE", "_CONTRATO_RE"}
    cuerpo = [n for n in arbol.body if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") in constantes]
    cuerpo += [n for n in arbol.body if isinstance(n, ast.FunctionDef) and n.name in funciones]
    assert len(cuerpo) == 7, "faltan piezas en server.py"
    ns = {}
    exec("import re", ns)
    exec(compile(ast.fix_missing_locations(ast.Module(body=cuerpo, type_ignores=[])), "<server>", "exec"), ns)
    return ns["_plantilla_por_plantel"]


leer = _cargar()
PLANTEL = [("a", "Andrea Rodríguez Arias"), ("l", "Luis Gómez Vidal"), ("s", "Sara Martínez Peña"),
           ("p", "Pedro Rodríguez Arias"), ("x", "José María Núñez")]


def filas(texto, plantel=PLANTEL):
    return [(f["driver_id"], f["ruta"], f["h_salida"]) for f in leer(texto, plantel)["filas"]]


def test_columnas_con_tabuladores_y_el_id_largo_no_es_ruta():
    texto = ("Ruta\tConductor\tID\tServicio\tSalida\n"
             "CA_A44\tRodriguez Arias, Andrea\tA2S2HK9FC8JOUX\tStandard Parcel - Large Van\t10:25\n"
             "CA_A45\tGomez Vidal, Luis\tA1B9QW7ER5TY3U\tStandard Parcel - Large Van\t10:45\n")
    assert filas(texto) == [("a", "CA_A44", "10:25"), ("l", "CA_A45", "10:45")]
    f = leer(texto, PLANTEL)["filas"][0]
    assert f["conductor"] == "ANDREA RODRÍGUEZ ARIAS"          # tal como está en su ficha


def test_una_celda_por_linea():
    texto = "\n".join([
        "CA_A44", "Rodriguez Arias, Andrea", "A2S2HK9FC8JOUX", "Standard Parcel - Large Van", "10:25",
        "CA_A45", "Gomez Vidal, Luis", "A1B9QW7ER5TY3U", "Standard Parcel - Large Van", "10:45",
        "CA_A46", "Martinez Pena, Sara", "A7K2LM4NB8VC1X", "Standard Parcel - Large Van", "11:05",
    ])
    assert filas(texto) == [("a", "CA_A44", "10:25"), ("l", "CA_A45", "10:45"), ("s", "CA_A46", "11:05")]


def test_nombre_cortado_sin_tildes_y_al_derecho():
    texto = "R1  ANDREA RODRIGUEZ AR...  9:40\nR2  luis gomez  10.05\n"
    assert filas(texto) == [("a", "R1", "09:40"), ("l", "R2", "10:05")]


def test_dos_hermanos_sin_nombre_de_pila_no_se_adivina():
    r = leer("R1\tRODRIGUEZ ARIAS\t10:00\n", PLANTEL)
    assert r["filas"] == [] and r["dudosos"] == ["R1 RODRIGUEZ ARIAS 10:00"]


def test_con_el_nombre_de_pila_si_se_distingue():
    assert filas("R1\tRodriguez Arias, Pedro\t10:00\n") == [("p", "R1", "10:00")]


def test_solo_nombres_uno_por_linea():
    assert filas("Andrea Rodriguez\nSara Martinez\n") == [("a", "", ""), ("s", "", "")]


def test_quien_no_esta_en_el_plantel_no_sale_y_el_servicio_no_es_un_nombre():
    texto = "R1\tFulano Desconocido Perez\tStandard Parcel - Large Van\t10:00\nR2\tLuis Gomez Vidal\t10:20\n"
    assert filas(texto) == [("l", "R2", "10:20")]


def test_nombre_compuesto_y_la_misma_persona_una_vez():
    texto = "R3 Nuñez, Jose Maria 11:00\nResumen: Jose Maria Nuñez (R3)\n"
    assert filas(texto) == [("x", "R3", "11:00")]


def test_matricula_y_contrato_no_son_ruta():
    assert filas("Gomez Vidal, Luis    0116 MBP   ETT11   10:10\n") == [("l", "", "10:10")]


def test_lista_de_vehiculos_nombre_y_matricula():
    r = leer("Rodriguez Arias, Andrea\t7906NFX\nGomez Vidal, Luis\t0116 MBP\n", PLANTEL)["filas"]
    assert [(f["driver_id"], f["furgo"]) for f in r] == [("a", "7906NFX"), ("l", "0116MBP")]


def test_a_igualdad_gana_el_del_centro():
    plantel = [("c", "Juan Lopez Diaz"), ("o", "Juan Lopez Ruiz")]
    r = leer("R1 Juan Lopez 10:00\n", plantel, frozenset({"c"}))
    assert [f["driver_id"] for f in r["filas"]] == ["c"] and r["dudosos"] == []
    assert leer("R1 Juan Lopez 10:00\n", plantel)["dudosos"] == ["R1 Juan Lopez 10:00"]
