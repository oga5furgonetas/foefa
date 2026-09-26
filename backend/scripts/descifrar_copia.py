# -*- coding: utf-8 -*-
"""Descifra una copia de seguridad de Flota (`*.jsonl.gz.cifrada`).

    python backend/scripts/descifrar_copia.py <copia.cifrada> <salida.jsonl.gz> [fichero_clave]

La clave (32 bytes en base64) se lee del fichero indicado, o de la variable
COPIAS_CLAVE. En el PC de Dani está en C:\\Users\\Usuario\\.flota-copias-clave.txt.
Sin la clave la copia NO se puede leer: es a propósito (ver
`_cifrar_fichero` en server.py).

La salida es el JSONL.gz de siempre: una línea por documento con
{"_db", "_col", "d"}.
"""
import ast
import base64
import io
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _cargar():
    """Usa la función REAL de server.py, no una copia que pueda desviarse."""
    fuente = io.open(os.path.join(RAIZ, "server.py"), encoding="utf-8-sig").read()
    arbol = ast.parse(fuente)
    cuerpo = [n for n in arbol.body
              if (isinstance(n, ast.FunctionDef) and n.name == "_descifrar_fichero")
              or (isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") == "_COPIA_MAGIA")]
    ns = {"os": os}
    exec(compile(ast.Module(body=cuerpo, type_ignores=[]), "server.py", "exec"), ns)
    return ns["_descifrar_fichero"]


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    origen, destino = sys.argv[1], sys.argv[2]
    txt = io.open(sys.argv[3], encoding="utf-8-sig").read().strip() if len(sys.argv) > 3 \
        else os.environ.get("COPIAS_CLAVE", "").strip()
    clave = base64.b64decode(txt) if txt else b""
    if len(clave) != 32:
        print("Falta la clave (32 bytes en base64).")
        return 2
    _cargar()(origen, destino, clave)
    print("Descifrada en", destino)
    return 0


if __name__ == "__main__":
    sys.exit(main())
