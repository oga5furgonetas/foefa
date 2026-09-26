# -*- coding: utf-8 -*-
"""La plantilla diaria se comprueba contra lo que la empresa ya sabe.

Sale de leer capturas o texto con la IA y de vez en cuando se cuela una hora
imposible, un nombre mal leído o una matrícula que no existe («que no tenga
errores de hora, nombres o furgonetas»). `_plantilla_validar_filas` caza esos
casos ANTES de generar el Excel y propone la corrección. Se lee del
server.py real con `ast`.
"""
import ast
import io
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUTA = os.path.join(RAIZ, "server.py")


def _cargar():
    arbol = ast.parse(io.open(RUTA, encoding="utf-8-sig").read())
    quiero = {"_plantilla_validar_filas", "_normalize_name", "_name_tokens", "_match_score",
              "_matricula_norm", "_calc_horas", "_hora_hhmm"}
    cuerpo = [n for n in arbol.body if isinstance(n, ast.FunctionDef) and n.name in quiero]
    cuerpo += [n for n in arbol.body if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") == "_HORA_RE"]
    faltan = quiero - {c.name for c in cuerpo if hasattr(c, "name")}
    assert not faltan, "faltan funciones en server.py: %s" % faltan
    ns = {}
    exec("import re", ns)
    exec(compile(ast.fix_missing_locations(ast.Module(body=cuerpo, type_ignores=[])), "<server>", "exec"), ns)
    return ns


NS = _cargar()
validar = NS["_plantilla_validar_filas"]
CONDUCTORES = [{"name": "JUAN FRANCISCO VIÑALS PRIMO"}, {"name": "VICTOR ANTELO NIETO"}]
MATRICULAS = {"2832NGX": "2832 NGX", "4455NKC": "4455 NKC"}


def _tipos(avisos):
    return sorted(a["tipo"] for a in avisos)


def test_fila_perfecta_sin_avisos():
    fila = {"ruta": "R30", "conductor": "Juan Francisco Viñals Primo", "furgo": "2832 NGX",
            "h_salida": "11:50", "h_llegada": "11:20", "h_bajada": "11:40"}
    assert validar([fila], CONDUCTORES, MATRICULAS, {}) == []


def test_la_asignacion_del_dia_propone_su_vehiculo():
    asignados = {"VICTOR ANTELO NIETO": "4455 NKC"}
    fila = {"ruta": "R31", "conductor": "VICTOR ANTELO NIETO", "furgo": "2832 NGX", "h_salida": "11:50"}
    avisos = validar([fila], CONDUCTORES, MATRICULAS, asignados)
    assert _tipos(avisos) == ["asignacion"], avisos
    assert avisos[0]["sugerencia"] == "4455NKC"
    # Sin vehículo escrito también lo propone: así se rellena de un clic.
    fila["furgo"] = ""
    assert _tipos(validar([fila], CONDUCTORES, MATRICULAS, asignados)) == ["asignacion"]
    # Y si ya coincide, nada.
    fila["furgo"] = "4455nkc"
    assert validar([fila], CONDUCTORES, MATRICULAS, asignados) == []


def test_nombre_mal_leido_se_sugiere():
    fila = {"ruta": "", "conductor": "JUAN FRANCISC VINALS", "furgo": "", "h_salida": ""}
    avisos = validar([fila], CONDUCTORES, MATRICULAS, {})
    assert _tipos(avisos) == ["nombre_parecido"]
    assert avisos[0]["sugerencia"] == "JUAN FRANCISCO VIÑALS PRIMO"


def test_una_sola_palabra_en_comun_no_sugiere_a_otra_persona():
    """«KEVIN FERNEY ARIAS» comparte «ARIAS» con otra ficha: antes proponía
    cambiarle el nombre por el de esa otra persona."""
    conductores = CONDUCTORES + [{"name": "ANDREA RODRIGUEZ ARIAS"}]
    fila = {"ruta": "", "conductor": "KEVIN FERNEY ARIAS", "furgo": "", "h_salida": ""}
    avisos = validar([fila], conductores, MATRICULAS, {})
    assert _tipos(avisos) == ["nombre_desconocido"] and avisos[0]["sugerencia"] is None


def test_nombre_desconocido():
    fila = {"ruta": "", "conductor": "PERSONA QUE NO EXISTE", "furgo": "", "h_salida": ""}
    assert _tipos(validar([fila], CONDUCTORES, MATRICULAS, {})) == ["nombre_desconocido"]


def test_empresa_sin_conductores_no_grita():
    """Una empresa que empieza no tiene la plantilla de conductores dada de
    alta: avisar de CADA nombre sería un aviso en falso en todas las filas."""
    fila = {"ruta": "", "conductor": "ANA RUIZ", "furgo": "9999ZZZ", "h_salida": ""}
    assert validar([fila], [], {}, {}) == []


def test_matricula_desconocida_con_sugerencia():
    fila = {"ruta": "", "conductor": "", "furgo": "2832 NGK", "h_salida": ""}
    avisos = validar([fila], CONDUCTORES, MATRICULAS, {})
    assert _tipos(avisos) == ["matricula_desconocida"]
    assert avisos[0]["sugerencia"] == "2832 NGX"


def test_horas():
    filas = [{"ruta": "X1", "conductor": "", "furgo": "", "h_salida": "25:99"},
             {"ruta": "X2", "conductor": "", "furgo": "", "h_salida": "02:00"},
             {"ruta": "X3", "conductor": "", "furgo": "", "h_salida": "11:50", "h_llegada": "10:00"},
             {"ruta": "X4", "conductor": "", "furgo": "", "h_salida": ""}]
    tipos = _tipos(validar(filas, CONDUCTORES, MATRICULAS, {}))
    # Salir a las 02:00 es normal en muchas empresas: ya no se avisa.
    assert tipos == ["hora_falta", "hora_incoherente", "hora_invalida"], tipos


def test_repetidos():
    filas = [{"ruta": "A", "conductor": "VICTOR ANTELO NIETO", "furgo": "4455NKC", "h_salida": "10:00"},
             {"ruta": "B", "conductor": "Victor Antelo Nieto", "furgo": "4455 NKC", "h_salida": "10:10"}]
    tipos = _tipos(validar(filas, CONDUCTORES, MATRICULAS, {}))
    assert tipos.count("repetido") == 2, tipos


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
