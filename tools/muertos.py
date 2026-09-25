# -*- coding: utf-8 -*-
"""Código muerto de nivel superior: privados que no nombra NADIE.

Complementa a `podar.py`. Aquel quita lo que se queda huérfano AL QUITAR otra
cosa con la herramienta; esto encuentra lo que se quedó sin nadie por una
edición a mano. Se repite hasta que no cae nada, porque al quitar una función
muerta puede quedarse muerta la constante que solo usaba ella.

Solo mira nombres PRIVADOS (`_algo`) y SIN decoradores: un endpoint o un
arranque (`@app.on_event`) no los nombra nadie y no por eso sobran. Y busca el
nombre también en los OTROS módulos del backend, por si se importa desde ahí.

Uso:  python tools/muertos.py backend/server.py [--escribir]
"""
import ast
import io
import pathlib
import re
import sys
from collections import Counter


def _cuenta(nodo):
    """Cuántas veces sale cada nombre dentro de `nodo` (como nombre o atributo)."""
    c = Counter()
    for n in ast.walk(nodo):
        if isinstance(n, ast.Name):
            c[n.id] += 1
        elif isinstance(n, ast.Attribute):
            c[n.attr] += 1
    return c


def pasada(texto, otros):
    arbol = ast.parse(texto)
    # UNA sola cuenta de todo el fichero. Recorrer el árbol entero por cada
    # función era cuadrático: con 39.000 líneas no acababa en diez minutos.
    total = _cuenta(arbol)
    muertos = []
    for nodo in arbol.body:
        if getattr(nodo, 'decorator_list', None):
            continue
        nombres = set()
        if isinstance(nodo, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            nombres = {nodo.name}
        elif isinstance(nodo, (ast.Assign, ast.AnnAssign)):
            objetivos = nodo.targets if isinstance(nodo, ast.Assign) else [nodo.target]
            nombres = {n.id for t in objetivos for n in ast.walk(t) if isinstance(n, ast.Name)}
        if not nombres or not all(x.startswith('_') for x in nombres):
            continue
        # ¿Lo nombra alguien que no sea él mismo? Se descuenta lo de su cuerpo
        # (una función recursiva, o la asignación que lo define).
        propias = _cuenta(nodo)
        vivo = False
        for x in nombres:
            if total[x] - propias[x] > 0 or re.search(r'\b%s\b' % re.escape(x), otros):
                vivo = True
        if not vivo:
            ini = min([nodo.lineno] + [d.lineno for d in getattr(nodo, 'decorator_list', [])])
            muertos.append((ini, nodo.end_lineno, sorted(nombres)[0]))
    return muertos


def principal(ruta, escribir):
    base = pathlib.Path(ruta).parent
    otros = '\n'.join(io.open(p, encoding='utf-8-sig').read()
                      for p in base.glob('*.py') if p.name != pathlib.Path(ruta).name)
    texto = io.open(ruta, encoding='utf-8-sig').read()
    total = []
    for vuelta in range(20):
        muertos = pasada(texto, otros)
        if not muertos:
            break
        lineas = texto.split('\n')
        borrar = set()
        for a, b, nombre in muertos:
            k = a
            while k - 1 >= 1 and lineas[k - 2].lstrip().startswith('#'):
                k -= 1
            borrar.update(range(k, b + 1))
            total.append(nombre)
        texto = '\n'.join(l for i, l in enumerate(lineas, 1) if i not in borrar)
        texto = re.sub(r'\n{4,}', '\n\n\n', texto)
    print('muertos:', len(total))
    for n in total:
        print('  ', n)
    if escribir and total:
        ast.parse(texto)
        io.open(ruta, 'w', encoding='utf-8-sig', newline='').write(texto)
        print('escrito:', ruta, len(texto.split(chr(10))), 'líneas')


if __name__ == '__main__':
    principal(sys.argv[1], '--escribir' in sys.argv)
