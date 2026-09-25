# -*- coding: utf-8 -*-
"""Cadenas del backend que nombran una marca o plataforma concreta.

Mira solo CADENAS DE CÓDIGO (lo que puede llegar a una persona: un correo, un
mensaje, una respuesta de la API), no comentarios ni docstrings, que son notas
para quien mantiene el código. Un producto que se vende a cualquier empresa no
puede firmar sus correos con el nombre de otra ni hablar de una plataforma que
el cliente no usa.

Uso:  python tools/cadenas_marca.py backend/server.py [patrón]
"""
import io
import re
import sys
import tokenize

ruta = sys.argv[1]
patron = re.compile(sys.argv[2] if len(sys.argv) > 2 else
                    r'flotadsp|winiw|amazon|\bdsps?\b|cortex|\bdnr\b|scorecard', re.I)
src = io.open(ruta, encoding='utf-8-sig').read()
toks = list(tokenize.generate_tokens(io.StringIO(src).readline))

SUELTA = {tokenize.NEWLINE, tokenize.NL, tokenize.INDENT, tokenize.DEDENT,
          tokenize.COMMENT, tokenize.ENCODING}
hallados = []
for i, t in enumerate(toks):
    es_texto = t.type == tokenize.STRING or (
        hasattr(tokenize, 'FSTRING_MIDDLE') and t.type == tokenize.FSTRING_MIDDLE)
    if not es_texto or not patron.search(t.string):
        continue
    # Docstring / nota suelta: la cadena es una sentencia entera.
    j = i - 1
    while j >= 0 and toks[j].type in SUELTA - {tokenize.NEWLINE}:
        j -= 1
    antes_linea = j < 0 or toks[j].type in (tokenize.NEWLINE, tokenize.INDENT, tokenize.DEDENT) \
        or toks[j].string == ':'
    k = i + 1
    while k < len(toks) and toks[k].type in (tokenize.NL, tokenize.COMMENT):
        k += 1
    despues_fin = k >= len(toks) or toks[k].type == tokenize.NEWLINE
    if t.type == tokenize.STRING and antes_linea and despues_fin:
        continue
    hallados.append((t.start[0], t.string.replace('\n', '⏎')[:160]))

vistos = set()
for linea, texto in hallados:
    if (linea, texto) in vistos:
        continue
    vistos.add((linea, texto))
    print('%6d  %s' % (linea, texto))
print('\n%d cadenas' % len(vistos))
