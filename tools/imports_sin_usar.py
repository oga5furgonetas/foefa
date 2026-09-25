# -*- coding: utf-8 -*-
"""Quita los nombres IMPORTADOS que ESLint dice que no se usan.

Solo toca especificadores dentro de `import { a, b } from '...'` (y el alias
`b as c`): es un cambio mecánico que no puede alterar lo que hace la pantalla.
Variables, funciones y argumentos sin usar NO se tocan aquí: esos piden mirar
el caso, porque a veces son un resto y a veces un fallo (algo que se calculaba
para pintarlo y se dejó de pintar).

Uso:  npx eslint src -f json > lint.json
      python tools/imports_sin_usar.py lint.json [--escribir]
"""
import io
import json
import re
import sys

datos = json.load(io.open(sys.argv[1], encoding='utf-8'))
escribir = '--escribir' in sys.argv
IMPORT = re.compile(r"import\s*(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s*from\s*(['\"][^'\"]+['\"])", re.S)

total = 0
for f in datos:
    nombres = set()
    for m in f['messages']:
        if m.get('ruleId') != 'no-unused-vars':
            continue
        mm = re.match(r"'([\w$]+)' is defined but never used", m['message'])
        if mm:
            nombres.add(mm.group(1))
    if not nombres:
        continue
    texto = io.open(f['filePath'], encoding='utf-8').read()
    quitados = []

    def poda(m):
        espec = [e for e in (x.strip() for x in m.group(1).split(',')) if e]
        quedan = []
        for e in espec:
            local = e.split(' as ')[-1].strip()
            if local in nombres:
                quitados.append(local)
            else:
                quedan.append(e)
        if len(quedan) == len(espec):
            return m.group(0)
        cabeza = m.group(0)[:m.group(0).index('{')]
        if not quedan:
            # `import X, {} from` -> `import X from`; `import {} from` -> nada
            cabeza = cabeza.rstrip()
            if cabeza.endswith(','):
                return cabeza[:-1].rstrip() + ' from ' + m.group(2)
            return ''
        multilinea = '\n' in m.group(1)
        if multilinea:
            cuerpo = '\n' + '\n'.join('  ' + x for x in _en_lineas(quedan)) + '\n'
        else:
            cuerpo = ' ' + ', '.join(quedan) + ' '
        return cabeza + '{' + cuerpo + '} from ' + m.group(2)

    def _en_lineas(items, ancho=96):
        lineas, actual = [], ''
        for x in items:
            trozo = x + ','
            if actual and len(actual) + 1 + len(trozo) > ancho:
                lineas.append(actual)
                actual = trozo
            else:
                actual = (actual + ' ' + trozo).strip()
        if actual:
            lineas.append(actual)
        return lineas

    nuevo = IMPORT.sub(poda, texto)
    if quitados:
        total += len(quitados)
        print('%-60s %s' % (f['filePath'].split('src')[-1], ', '.join(quitados)))
        if escribir:
            io.open(f['filePath'], 'w', encoding='utf-8', newline='').write(nuevo)
print('\n%d nombres importados sin usar%s' % (total, ' — quitados' if escribir else ''))
