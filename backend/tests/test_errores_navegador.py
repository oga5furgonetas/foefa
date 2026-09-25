# -*- coding: utf-8 -*-
"""El buzon de errores del navegador: lo que se guarda y lo que NO se pierde.

`client_errors` es como se han encontrado los fallos que no fallan de forma
visible: el chunk envenenado que dejaba la pantalla en blanco (gotcha 8) y las
dos importaciones que se olvidaron y tumbaban Vehiculos (gotcha 68). Los dos se
vieron ahi y en ningun otro sitio.

Por eso este fichero prueba dos cosas que, si se rompen, no avisan:

  · QUE EL LIMITE NO CUESTE LA INFORMACION. Medido el 20-09-2026: 81 reportes
    devueltos con 429 en siete dias. Y un error que se repite tanto como para
    gastar el cupo es justo el que le esta rompiendo la pantalla a alguien una
    y otra vez. Pasado el cupo se SUMA al que ya esta guardado.
  · QUE LO QUE NO ES NUESTRO NO ENTRE. Una extension de Chrome ajena metia
    cinco de cada catorce errores, y con el registro lleno de ruido los de
    verdad no se ven.

Se lee el codigo REAL de `server.py` con `ast` (gotcha 40): una copia deja de
probar lo que corre en cuanto alguien toca el original.
"""
import ast
import io
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUENTE = io.open(os.path.join(RAIZ, "server.py"), encoding="utf-8-sig").read()
_ARBOL = ast.parse(FUENTE)


def _cuerpo(nombre):
    for n in ast.walk(_ARBOL):
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == nombre:
            return ast.get_source_segment(FUENTE, n)
    raise AssertionError("no existe %s en server.py" % nombre)


def test_pasado_el_cupo_se_cuenta_en_vez_de_tirarlo():
    c = _cuerpo("report_client_error")
    assert "_cupo_lleno" in c, "el limite vuelve a tirar los reportes"
    assert '"$inc": {"veces": 1}' in c, "no suma la repeticion al error ya guardado"
    # Y el 429 sigue existiendo para quien no tiene nada que sumar: si no,
    # cualquiera podria llenar la coleccion con mensajes distintos.
    assert c.count("429") >= 2, "se ha quedado sin freno para el abuso"


def test_pasado_el_cupo_NO_se_inserta_ni_se_avisa_otra_vez():
    """Es de lo que protegia el limite: una insercion y un Telegram por cada
    repeticion. Contar tiene que ser mas barato que guardar, o no sirve."""
    c = _cuerpo("report_client_error")
    i_cupo = c.index("if _cupo_lleno:")
    i_insert = c.index("client_errors.insert_one")
    assert i_cupo < i_insert, "la rama del cupo lleno va DESPUES de insertar"
    # Entre una cosa y otra tiene que haber un `return` o un `raise`: si no, se
    # cuenta Y se inserta, que es peor que antes.
    entre = c[i_cupo:i_insert]
    assert "return" in entre and "raise" in entre, "la rama del cupo no corta"
    assert "_notify_error_once" not in entre, "sigue avisando por cada repeticion"


def test_lo_de_una_extension_del_navegador_no_se_guarda():
    c = _cuerpo("report_client_error")
    for marca in ("chrome-extension://", "moz-extension://", "safari-web-extension://"):
        assert marca in c, "deja entrar los errores de %s" % marca


def test_el_error_se_guarda_en_la_empresa_que_lo_sufre():
    """Gotcha 26: es un endpoint PUBLICO y `_current_db_name` tiene valor por
    defecto, asi que sin fijar la empresa todos los errores caian en la base
    principal — la empresa que los sufre no los ve y en la principal salen
    mezclados sin saber de quien son."""
    c = _cuerpo("report_client_error")
    assert "set_current_org_db" in c, "no fija la empresa del token"


def main():
    fallos = 0
    for nombre, fn in sorted(globals().items()):
        if nombre.startswith("test_") and callable(fn):
            try:
                fn()
                print("ok  ", nombre)
            except AssertionError as e:
                fallos += 1
                print("FALLA", nombre, e)
    print("errores de navegador: %s" % ("TODO OK" if not fallos else "%d fallos" % fallos))
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
