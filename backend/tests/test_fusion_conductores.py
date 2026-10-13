# -*- coding: utf-8 -*-
"""Fusionar dos fichas de la misma persona: lo que falla es OLVIDARSE de un sitio.

Fusionar mal no es el riesgo —el correo tiene que coincidir y eso lo comprueba
el endpoint—. El riesgo es repuntar cuatro colecciones cuando hay seis: la
ficha absorbida se desactiva, todo parece bien, y el historial de esa persona
se queda partido en dos sin que nada falle ni nadie lo eche en falta.

Paso el 08-09-2026. `drivers_fusionar` movia `inspections`, `shifts`,
`shift_requests` y los slots de `daily_assignments`, y se dejaba fuera
`vehicles.mileage_history.driver_id`. Barriendo
produccion en busca de campos con forma de uuid de ficha —no de memoria—
quedaban **55 apuntes de kilometros y 14 inspecciones** colgando de fichas ya
absorbidas. Las inspecciones son las que mas duelen: ahi esta el historial de
danos con el que se le pide cuentas a alguien.

Lo que se prueba aqui es que la lista de sitios este COMPLETA respecto a lo que
se encontro en produccion, y que el repaso sepa arreglar lo que quedo atras.
Se lee de `server.py` (gotcha 40): una copia de la lista se queda vieja el dia
que alguien anada una coleccion.
"""
import ast
import io
from pathlib import Path

SERVER = Path(__file__).resolve().parent.parent / "server.py"
_TEXTO = io.open(SERVER, encoding="utf-8-sig").read()
_ARBOL = ast.parse(_TEXTO)


def _constante(nombre):
    for n in _ARBOL.body:
        if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") == nombre:
            return ast.literal_eval(n.value)
    raise AssertionError("no existe %s en server.py" % nombre)


def _fuente(nombre):
    for n in ast.walk(_ARBOL):
        if isinstance(n, (ast.AsyncFunctionDef, ast.FunctionDef)) and n.name == nombre:
            return chr(10).join(_TEXTO.splitlines()[n.lineno - 1:n.end_lineno])
    raise AssertionError("no existe %s en server.py" % nombre)


# Lo que se encontro barriendo produccion el 08-09-2026: todas las colecciones
# donde aparece el id de una ficha de conductor. Los dos ultimos estan dentro
# de un array y necesitan `array_filters`, por eso van aparte en el codigo.
SITIOS = [
    ("inspections", "driver_id"),
    ("shifts", "driver_id"),
    ("shift_requests", "driver_id"),
    ("incidents", "driver_id"),
    ("tienda_pedidos", "driver_id"),
    ("parking_assignments", "driver_id"),
    ("candidatos", "driver_id"),
    ("driver_accounts", "driver_id"),
]


def test_la_lista_de_sitios_esta_completa():
    donde = [tuple(x) for x in _constante("_DONDE_EL_CONDUCTOR")]
    faltan = [x for x in SITIOS if x not in donde]
    assert not faltan, "fusionar se dejaria sin repuntar: %s" % faltan


def test_los_dos_que_viven_dentro_de_un_array_tambien_se_repuntan():
    """`daily_assignments.slots` y `vehicles.mileage_history`.

    Un `$set` normal no entra en un array: hacen falta `array_filters`, y por
    eso van escritos aparte en vez de en la lista.
    """
    src = _fuente("_repuntar_conductor")
    assert "daily_assignments" in src and "slots.$[s].driver_id" in src
    assert "vehicles" in src and "mileage_history.$[m].driver_id" in src, (
        "los kilometros seguian colgando de la ficha absorbida: 55 apuntes en produccion")
    assert src.count("array_filters=[") == 2, "los dos, y solo los dos"


def test_se_admite_correo_igual_o_par_exacto_no_ambiguo():
    """El correo vale; sin correo, solo el par exacto y único revisado en UI."""
    src = _fuente("drivers_fusionar")
    assert "mismo correo" in src
    assert "mismo nombre y centro" in src
    assert "El nombre y centro no identifican un par único" in src
    assert "otro_correo" in src and "mismo_centro" in src


def test_la_fusion_conserva_la_ficha_con_correo_en_cuadrante():
    """También traslada o combina las reglas guardadas en cuadrante_personas."""
    src = _fuente("_repuntar_conductor")
    assert "_CUA_PERSONAS" in src
    assert '"en_cuadrante"' in src
    assert '"reglas_fijas"' in src
    assert '"fusionada_en"' in src
    assert '"en_cuadrante": False' in src


def test_la_absorbida_no_se_borra():
    """Se marca y se desactiva. Borrarla dejaria huerfano lo que se nos escape."""
    src = _fuente("drivers_fusionar")
    assert "merged_into" in src
    assert "delete_one" not in src and "delete_many" not in src


def test_hay_un_repaso_para_lo_que_quedo_atras():
    """Una inspeccion creada DESPUES de la fusion vuelve a quedarse huerfana.

    Con la ficha vieja aun abierta en el movil de alguien, eso pasa. El repaso
    tiene que poder correrse cuantas veces haga falta.
    """
    src = _fuente("drivers_fusiones_repasar")
    assert "merged_into" in src
    assert "_repuntar_conductor" in src
