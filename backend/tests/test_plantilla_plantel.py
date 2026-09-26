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
    funciones = {"_plantilla_por_plantel", "_normalize_name", "_name_tokens", "_casar_linea",
                 "_parece_persona", "_es_cabecera_ruta", "_plantilla_por_bloques", "_nombre_de_texto"}
    constantes = {"_PLACA_RE", "_HORA_EN_TEXTO_RE", "_RUTA_EN_TEXTO_RE", "_CONTRATO_RE", "_NO_ES_PERSONA"}
    cuerpo = [n for n in arbol.body if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") in constantes]
    cuerpo += [n for n in arbol.body if isinstance(n, ast.FunctionDef) and n.name in funciones]
    assert len(cuerpo) == len(funciones) + len(constantes), "faltan piezas en server.py"
    ns = {}
    exec("import re\nfrom typing import Optional", ns)
    exec(compile(ast.fix_missing_locations(ast.Module(body=cuerpo, type_ignores=[])), "<server>", "exec"), ns)
    return ns


NS = _cargar()
leer = NS["_plantilla_por_plantel"]
bloques = NS["_plantilla_por_bloques"]
persona = NS["_parece_persona"]
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



# ── La lista tal como sale al copiar la pantalla de progreso de rutas ────────
# Estructura medida con la lista real de Dani (27-09-2026); nombres inventados.
BLOQUES = """CA_A22

7h 27m
10:10
ANDREA RODRIGUEZ ARIAS

Cierre de sesión en la aplicación: 19:09

|

Promedio: 7 paradas/hora

Luis Gomez Vidal

Cierre de sesión en la aplicación: 20:16

|

Promedio: 3 paradas/hora

76/76 paradas

115/115 entregas

CA_A24

7h 49m
11:30
Persona Sin Ficha Nueva

Cierre de sesión en la aplicación: 18:54

|

Promedio: 5 paradas/hora

59/59 paradas

79/79 entregas

CA_A27

7h 22m
11:30
Sara Martinez

Cierre de sesión en la aplicación: 19:35

88/88 paradas
"""


def test_por_bloques_ruta_hora_de_salida_y_solo_el_primer_conductor():
    r = bloques(BLOQUES, PLANTEL)
    assert [(f["ruta"], f["conductor"], f["h_salida"], f["driver_id"]) for f in r["filas"]] == [
        ("CA_A22", "ANDREA RODRÍGUEZ ARIAS", "10:10", "a"),     # el apoyo (Luis) no va en la hoja
        ("CA_A24", "PERSONA SIN FICHA NUEVA", "11:30", None),  # sin ficha: sale tal cual, para corregirlo
        ("CA_A27", "SARA MARTÍNEZ PEÑA", "11:30", "s"),
    ]


def test_por_bloques_no_es_este_formato_si_no_hay_cabeceras():
    assert bloques("R1\tAndrea Rodriguez\t10:00\nR2\tLuis Gomez\t10:20\n", PLANTEL) is None


def test_ni_la_duracion_ni_el_recuento_ni_el_cierre_son_ruta_u_hora():
    texto = "7h 27m\n10:10\nANDREA RODRIGUEZ ARIAS\nCierre de sesión en la aplicación: 19:09\n115/115 entregas\n"
    assert filas(texto) == [("a", "", "10:10")]


def test_una_palabra_repetida_del_nombre_no_cuenta_dos_veces():
    """«ARIAS» dos veces en la ficha de Kevin no puede casar con «DAVID GARCIA
    ARIAS»: le habría dado a David la furgoneta de Kevin."""
    plantel = [("k", "Kevin Ferney Arias Arias")]
    assert leer("CA_A32\nDavid Garcia Arias\n", plantel)["filas"] == []
    assert [f["driver_id"] for f in leer("Kevin Arias Arias\n", plantel)["filas"]] == ["k"]


def test_que_parece_una_persona():
    assert persona("Allan Zarate Largo") and persona("RODRIGUEZ ARIAS, ANDREA")
    for no in ("115/115 entregas", "PARADAS", "Cierre de sesión en la aplicación: 19:09",
               "Promedio: 7 paradas/hora", "7h 27m", "|", "Standard Parcel Large Van", "Ruta Conductor Salida"):
        assert not persona(no), no
