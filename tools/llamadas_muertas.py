# -*- coding: utf-8 -*-
"""Llamadas del frontend a endpoints que ya no existen en el backend.

Cruza dos listas: las rutas que el backend registra DE VERDAD (volcadas
importando `server`, no leídas del código) y cada `api.get/post/...('/ruta')`
del frontend. Un endpoint quitado deja la pantalla que lo llama rompiéndose
con un 404, y eso no lo ve ni el compilador ni el linter: compila perfecto.

Uso:  python tools/llamadas_muertas.py rutas_backend.json frontend/src
"""
import json
import pathlib
import re
import sys

rutas = json.load(open(sys.argv[1]))
raiz = pathlib.Path(sys.argv[2])


def patron(ruta_backend: str) -> re.Pattern:
    # /vehicles/{vid}/fotos -> ^/vehicles/[^/]+/fotos$
    trozos = re.split(r'\{[^}]+\}', ruta_backend)
    return re.compile('^' + '[^/]+'.join(re.escape(t) for t in trozos) + '$')


PATRONES = [(patron(r['path'].removeprefix('/api')), set(r['methods'])) for r in rutas]

LLAMADA = re.compile(
    r"""\b(?:api|apiLab|axios|http|cliente)\.(get|post|put|patch|delete)\(\s*[`'"]([^`'"]+)[`'"]""")


def normaliza(url: str) -> str:
    url = url.split('?')[0]
    url = re.sub(r'\$\{[^}]+\}', 'X', url)      # plantillas `${id}` -> X
    url = url.removeprefix('/api')
    return url.rstrip('/') or '/'


muertas = {}
for f in list(raiz.rglob('*.js')) + list(raiz.rglob('*.jsx')):
    texto = f.read_text(encoding='utf-8', errors='replace')
    for n, linea in enumerate(texto.split('\n'), 1):
        for m in LLAMADA.finditer(linea):
            metodo, url = m.group(1).upper(), m.group(2)
            if not url.startswith('/'):
                continue
            u = normaliza(url)
            vivo = any(p.match(u) and metodo in ms for p, ms in PATRONES)
            if not vivo:
                muertas.setdefault(str(f.relative_to(raiz)), []).append((n, metodo, url))

total = sum(len(v) for v in muertas.values())
print('llamadas a endpoints que no existen: %d en %d ficheros\n' % (total, len(muertas)))
for fichero in sorted(muertas, key=lambda k: -len(muertas[k])):
    print('%s (%d)' % (fichero, len(muertas[fichero])))
    for n, metodo, url in muertas[fichero][:40]:
        print('    %5d  %-6s %s' % (n, metodo, url))
