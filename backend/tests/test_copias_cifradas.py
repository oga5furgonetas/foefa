# -*- coding: utf-8 -*-
"""Las copias de seguridad van cifradas y no se suben nunca en claro.

EL CASO (26-09-2026): el almacenamiento de ficheros es público por enlace y
las copias iban en claro con nombre predecible; la base ENTERA se podía bajar
sin contraseña (HTTP 200, 112 MB). Estos casos fijan que:
  · lo cifrado se descifra igual, byte a byte, también con varios trozos;
  · una copia cortada, con trozos añadidos o reordenados, o con otra clave,
    NO se descifra (no se acepta a medias);
  · sin clave no se sube ninguna copia y el nombre no es adivinable.
Se usan las funciones REALES de server.py.
"""
import ast
import io
import os
import struct
import tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUENTE = io.open(os.path.join(RAIZ, "server.py"), encoding="utf-8-sig").read()
ARBOL = ast.parse(FUENTE)


def _ns():
    cuerpo = [n for n in ARBOL.body
              if (isinstance(n, ast.FunctionDef) and n.name in ("_cifrar_fichero", "_descifrar_fichero"))
              or (isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") in ("_COPIA_MAGIA", "_COPIA_TROZO"))]
    ns = {"os": os}
    exec(compile(ast.Module(body=cuerpo, type_ignores=[]), "server.py", "exec"), ns)
    ns["_COPIA_TROZO"] = 1000          # trozos pequeños: se prueban varios
    return ns


NS = _ns()
CLAVE = os.urandom(32)


def _tmp(datos=b""):
    fd, ruta = tempfile.mkstemp()
    with os.fdopen(fd, "wb") as f:
        f.write(datos)
    return ruta


def _ida_y_vuelta(datos, clave=CLAVE, manipular=None):
    a, b, c = _tmp(datos), _tmp(), _tmp()
    NS["_cifrar_fichero"](a, b, CLAVE)
    if manipular:
        cif = open(b, "rb").read()
        open(b, "wb").write(manipular(cif))
    NS["_descifrar_fichero"](b, c, clave)
    return open(c, "rb").read(), open(b, "rb").read()


def test_ida_y_vuelta_con_varios_trozos():
    for datos in (b"x", b"a" * 999, b"b" * 1000, os.urandom(3500)):
        claro, cif = _ida_y_vuelta(datos)
        assert claro == datos
        assert datos[:50] not in cif or len(datos) < 8


def _falla(**kw):
    try:
        _ida_y_vuelta(os.urandom(3500), **kw)
    except Exception:                                             # noqa: BLE001
        return True
    return False


def test_otra_clave_no_descifra():
    assert _falla(clave=os.urandom(32))


def test_cortada_no_se_acepta():
    magia = len(b"FLOTACOPIA1\n")
    primer = 16 + 1000 + 16
    assert _falla(manipular=lambda c: c[:magia + primer])      # solo el primer trozo
    assert _falla(manipular=lambda c: c[:-5])                   # a medio trozo


def test_trozos_reordenados_o_repetidos_no_se_aceptan():
    magia = len(b"FLOTACOPIA1\n")
    t = 16 + 1000 + 16

    def cambia_orden(c):
        cuerpo = c[magia:]
        return c[:magia] + cuerpo[t:2 * t] + cuerpo[:t] + cuerpo[2 * t:]
    assert _falla(manipular=cambia_orden)
    assert _falla(manipular=lambda c: c + c[magia:magia + t])


def test_sin_clave_no_se_sube_y_el_nombre_no_se_adivina():
    c = next(ast.get_source_segment(FUENTE, n) for n in ARBOL.body
             if isinstance(n, ast.AsyncFunctionDef) and n.name == "backup_database_to_r2")
    assert "_clave_copias()" in c and "Sin COPIAS_CLAVE" in c
    assert "token_hex(16)" in c and ".cifrada" in c
    assert "_cifrar_fichero" in c and "open(ruta_cif" in c, "tiene que subir el fichero cifrado, no el claro"
    assert 'Prefix=f"backups/{MARCA.lower()}_"' in c


def test_el_formato_lleva_su_marca():
    a, b = _tmp(b"hola"), _tmp()
    NS["_cifrar_fichero"](a, b, CLAVE)
    cif = open(b, "rb").read()
    assert cif.startswith(b"FLOTACOPIA1\n")
    assert struct.unpack(">I", cif[len(b"FLOTACOPIA1\n") + 12:len(b"FLOTACOPIA1\n") + 16])[0] == 4 + 16
