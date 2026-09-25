# -*- coding: utf-8 -*-
"""FlotaDSP AI monta la plantilla de otro dia y guarda las furgonetas que dice
la oficina (rama `ia-tareas`, fusionada el 21-09-2026).

Lo que se prueba es lo que, si se rompe, NO da error: poner en la plantilla la
furgoneta de otro Juan (el cruce es por NOMBRE contra lo que da Cortex), montar
la hoja de mañana dentro de la de hoy, o dar por buena una fecha absurda que
dijo un LLM. Las funciones son las REALES de `server.py` (gotcha 40).
"""
import ast
import io
import re
from datetime import datetime, timedelta
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
_TEXTO = io.open(RAIZ / "server.py", encoding="utf-8-sig").read()
_ARBOL = ast.parse(_TEXTO)

_FUNCS = ("_texto_cuerpo", "_matricula_norm", "_norm_name_words", "_furgos_por_conductor",
          "_plantilla_elegir_furgo", "_plantilla_emparejar_pares",
          "_plantilla_quitar_furgos_repetidas", "_ia_pares_limpiar", "_ia_pares_clave",
          "_ia_pares_fundir", "_plantilla_misma_fecha", "_plantilla_fecha_es",
          "_ia_tarea_aviso_texto", "_ia_dia_valido")
_CONSTS = ("_PLANTILLA_FURGO_NO_SALE", "_IA_PARES_MAX", "_IA_TAREA_DIAS_ADELANTE",
           "_IA_TAREA_CERRADAS")


class _HTTP(Exception):
    def __init__(self, code, detail):
        super().__init__(detail)
        self.status_code, self.detail = code, detail


def _cargar():
    amb = {"re": re, "datetime": datetime, "timedelta": timedelta, "HTTPException": _HTTP,
           "_dia_negocio": lambda: HOY}
    for n in _ARBOL.body:
        if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") in _CONSTS:
            exec(compile(ast.Module(body=[n], type_ignores=[]), "<s>", "exec"), amb)  # noqa: S102
        if isinstance(n, ast.FunctionDef) and n.name in _FUNCS:
            exec(compile(ast.Module(body=[n], type_ignores=[]), "<s>", "exec"), amb)  # noqa: S102
    faltan = [f for f in _FUNCS if f not in amb]
    assert not faltan, "no existen en server.py: %s" % faltan
    return amb


HOY = "2026-09-21"
A = _cargar()


def test_el_cruce_es_por_nombre_y_solo_si_es_inequivoco():
    """«Juan Perez» casa con «JUAN PEREZ GARCIA»; con dos Juan Perez en Cortex no
    se elige ninguno: poner la furgoneta del otro es peor que dejarla en blanco."""
    pares = [{"conductor_nombre": "Juan Perez", "matricula": "1111AAA"}]
    ok, sin_usar, notas = A["_plantilla_emparejar_pares"]({"R1": "JUAN PEREZ GARCIA", "R2": "ANA LOPEZ"}, pares)
    assert ok == {"R1": "1111AAA"} and not sin_usar and not notas
    ok, sin_usar, notas = A["_plantilla_emparejar_pares"](
        {"R1": "JUAN PEREZ GARCIA", "R2": "JUAN PEREZ RUIZ"}, pares)
    assert ok == {}, "elige a uno de dos tocayos"
    assert set(notas) == {"R1", "R2"}


def test_apellidos_al_reves_y_tildes_casan():
    pares = [{"conductor_nombre": "Perez Garcia, Juan", "matricula": "2222BBB"}]
    ok, _, _ = A["_plantilla_emparejar_pares"]({"R1": "Juan Pérez García"}, pares)
    assert ok == {"R1": "2222BBB"}


def test_dos_parejas_para_la_misma_ruta_no_se_resuelven():
    pares = [{"conductor_nombre": "Juan Perez", "matricula": "1111AAA"},
             {"conductor_nombre": "Juan Perez Garcia", "matricula": "3333CCC"}]
    ok, _, notas = A["_plantilla_emparejar_pares"]({"R1": "JUAN PEREZ GARCIA"}, pares)
    assert ok == {} and "R1" in notas


def test_el_orden_de_preferencia_de_la_furgoneta():
    E = A["_plantilla_elegir_furgo"]
    # 1) lo que puso la oficina para ese dia manda; 2) el chat; 3) la ficha si es UNA
    assert E("1234 abc", "9999ZZZ", ["5555EEE"])[0] == "1234ABC"
    assert E("", "9999ZZZ", ["5555EEE"])[:1] == ("9999ZZZ",)
    assert E("", "", ["5555EEE"]) == ("5555EEE", "", "ficha")
    # con dos fijas NO se elige y se dice en la nota
    furgo, nota, origen = E("", "", ["5555EEE", "6666FFF"])
    assert furgo == "" and "2 furgonetas" in nota and origen == ""
    assert E("", "", []) == ("", "", "")


def test_una_furgoneta_en_taller_o_de_baja_no_se_ofrece():
    r = A["_furgos_por_conductor"]([
        {"current_driver_id": "d1", "license_plate": "1111 AAA", "status": "active"},
        {"current_driver_id": "d1", "license_plate": "2222BBB", "status": "taller"},
        {"current_driver_id": "d2", "license_plate": "3333CCC", "status": "baja"},
        {"current_driver_id": "d3", "license_plate": "", "status": "active"}])
    assert r == {"d1": ["1111AAA"]}


def test_la_misma_furgoneta_fija_a_dos_personas_no_va_a_ninguna():
    filas = [{"furgo": "1111AAA", "_furgo_origen": "ficha", "observaciones": ""},
             {"furgo": "1111AAA", "_furgo_origen": "ficha", "observaciones": ""},
             {"furgo": "2222BBB", "_furgo_origen": "cuadrante", "observaciones": ""},
             {"furgo": "2222BBB", "_furgo_origen": "cuadrante", "observaciones": ""}]
    A["_plantilla_quitar_furgos_repetidas"](filas)
    assert filas[0]["furgo"] == "" and filas[1]["furgo"] == "" and "mas de una persona" in filas[0]["observaciones"]
    # lo que puso la oficina no se toca aunque repita: es decision suya
    assert filas[2]["furgo"] == "2222BBB" and filas[3]["furgo"] == "2222BBB"


def test_las_parejas_del_llm_se_sanean_y_se_funden_sin_duplicar():
    L, F = A["_ia_pares_limpiar"], A["_ia_pares_fundir"]
    assert L("no es una lista") == [] and L([{"conductor_nombre": "Ana"}]) == []
    p = L([{"conductor_nombre": "  Ana   Lopez ", "matricula": "1234-abc"}, "basura", 3])
    assert p == [{"conductor_nombre": "Ana Lopez", "matricula": "1234ABC"}]
    ya = [{"conductor_nombre": "Ana Lopez", "matricula": "1111AAA"},
          {"conductor_nombre": "Luis Diaz", "matricula": "2222BBB"}]
    nuevo = [{"conductor_nombre": "Lopez Ana", "matricula": "9999ZZZ"}]     # corrige a Ana
    r = F(ya, nuevo)
    assert len(r) == 2 and {"conductor_nombre": "Luis Diaz", "matricula": "2222BBB"} in r
    assert nuevo[0] in r and not any(x["matricula"] == "1111AAA" for x in r)
    # y si otro conductor pasa a llevar la misma matricula, sustituye
    r = F(ya, [{"conductor_nombre": "Pepe Gil", "matricula": "2222BBB"}])
    assert not any(x["conductor_nombre"] == "Luis Diaz" for x in r)


def test_el_borrador_de_hoy_no_se_confunde_con_el_de_mañana():
    """Los codigos de ruta se repiten cada dia: si se uniera la hoja de mañana a
    la de hoy, las rutas se darian por «ya existentes» y no entraria ninguna."""
    M = A["_plantilla_misma_fecha"]
    assert M("21/09/2026", "2026-09-21") and not M("21/09/2026", "2026-09-22")
    assert M("2026-09-22", "2026-09-22") and not M("2026-09-21", "2026-09-22")
    assert M("6/9/26", "2026-09-06")
    # una fecha que no se entiende: se sigue uniendo, como siempre
    assert M("", "2026-09-22") and M("lunes", "2026-09-22") and M(None, "2026-09-22")
    assert A["_plantilla_fecha_es"]("2026-09-22") == "22/09/2026"


def test_un_dia_dicho_por_la_ia_se_comprueba():
    V = A["_ia_dia_valido"]
    assert V("2026-09-22") == "2026-09-22"
    assert V("2026-09-28") == "2026-09-28"                   # 7 dias vista
    for malo in ("2026-09-29", "2026-09-20", "mañana", "2026-13-40", "", None, "2026/09/22"):
        try:
            V(malo)
        except _HTTP as e:
            assert e.status_code == 400
        else:
            raise AssertionError("acepto la fecha %r" % (malo,))
    assert V("2026-09-20", atras=1) == "2026-09-20"          # ayer, para cancelar


def test_el_aviso_dice_lo_que_paso():
    T = A["_ia_tarea_aviso_texto"]
    t = {"dia": "2026-09-22", "center": "DGA1"}
    assert "DGA1" in T(t, {"filas_cortex": 40, "con_furgo": 31}, "hecha") and "40 rutas" in T(t, {"filas_cortex": 40, "con_furgo": 31}, "hecha")
    assert "extensión" in T(t, {}, "caducada") and "No he podido" in T(t, {}, "fallida")


def test_la_ia_puede_programar_pero_el_servidor_lo_ejecuta():
    """El prompt YA NO dice que no puede: dejo de ser verdad con el bucle. Pero
    sigue sin prometer horas ni acciones fuera de la lista."""
    src = "\n".join(_TEXTO.splitlines())
    assert "programar_plantilla" in src and "preasignar_furgonetas" in src and "cancelar_tarea" in src
    assert "NO propongas \"generar_plantilla\"" not in src, "el prompt sigue prohibiendo programar"
    assert "peticion_no_soportada" in src
    assert '"tareas"' in src


def test_el_bucle_arranca_deja_latido_y_una_tarea_pendiente_es_unica():
    assert "asyncio.create_task(_bucle_ia_tareas())" in _TEXTO
    assert '_latido("ia_tareas"' in _TEXTO
    assert 'name="tarea_pendiente_unica"' in _TEXTO and 'name="preasig_unica"' in _TEXTO
