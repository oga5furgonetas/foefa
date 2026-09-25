# -*- coding: utf-8 -*-
"""Poda del monolito: quita lo que es de Amazon y lo que se queda huérfano.

POR QUÉ UNA HERRAMIENTA Y NO A MANO. `server.py` tiene ~56.000 líneas y 553
endpoints. Borrar a mano los de Amazon deja dos tipos de restos, los dos
silenciosos: ayudantes que ya no usa nadie (código muerto que confunde al que
venga detrás) y ayudantes que SÍ usa código que se queda (se rompe al llamarlo,
no al arrancar). Esto resuelve el primero solo y señala el segundo.

CÓMO DECIDE
  1. SEMILLAS: los endpoints cuya ruta es de Amazon, y los nombres que lo son
     por construcción (`_cortex_*`, `_dnr_*`, `_scorecard_*`…).
  2. CIERRE: un nodo de nivel superior se quita si TODOS los que lo nombran ya
     se han quitado. Solo si alguien lo nombraba: un endpoint no lo nombra
     nadie (se registra por decorador) y no por eso sobra.
  3. Lo que se quita arrastra el bloque de comentarios que tiene justo encima,
     que es su documentación.

Después hay que pasar pyflakes: cada «undefined name» es código que se queda y
llamaba a algo que se ha ido, y eso se decide caso a caso, no a ciegas.

Uso:  python tools/podar.py backend/server.py [--escribir]
"""
import ast
import io
import json
import re
import sys

RUTAS_AMAZON = re.compile(
    r'^/(cortex|scorecard|dnr|whc|apoyo|diarios|transporter-ids|route-demand|mery|asociados)(/|$)'
    r'|^/(api/)?tools/plantilla'
    r'|^/metrics/(upload-routeplan|routeplan|routeplan-available|upload-report'
    r'|driver-history|reports|upload-daily|daily-week)(/|$)'
    r'|^/portal/(mis-numeros|mis-ayudas)$')

NOMBRES_AMAZON = re.compile(
    r'^_*(cortex|cx|dnr|scorecard|whc|apoyo|dsc|debrief|diarios|transporter|route_?demand'
    r'|routeplan|dcr|captura_viva|congelar|nomen|geo_rescate|predn|pre_dnr|amazon'
    r'|edge_?os|edgeos|mis_numeros|mis_ayudas|mery|asoc|plantilla|sc_|sls|official_sc'
    r'|bucle_(congelar|apoyo|dnr|captura)|drivers_sin_transporter|drivers_telefonos'
    r'|procesar_(respuestas|predns)|ayudas|cierre_entrega|cuenta_paquetes'
    r'|consolidar_direcciones|conductores_rendimiento)', re.I)
# Algunos van en mayúsculas o a mitad del nombre (`_PROMPT_CORTEX`,
# `revisar_dcr_diario`): se mira también si la palabra aparece entera.
PALABRAS_AMAZON = re.compile(
    r'(^|_)(cortex|cx|dnr|scorecard|whc|dsc|dcr|predn|amazon|edgeos|routeplan)(_|$)', re.I)

# Nombres que CASAN con los patrones pero NO son de Amazon: se quedan.
#  · `plantilla` cubre tres cosas y solo la de TURNO es de Amazon (se llena de
#    Cortex y exporta el Excel de reparto). Las de WhatsApp, taller y empleo son
#    genéricas y se quedan.
#  · `_sc_*` casa `_sc_...` de scorecard, pero también hay `_scoring_*` propio.
NO_SEMILLA = {
    'whatsapp_crear_plantillas', 'taller_plantilla_set', '_seg_plantillas',
    'onb_plantillas', '_onb_plantilla', '_invita_plantilla',
    'empleo_invitados_plantilla', '_gemini_client_plantilla',
    # Solo da la fecha de hoy en Madrid; lo usan las candidaturas de empleo.
    '_apoyo_hoy',
}


def ruta_de(nodo):
    for d in getattr(nodo, 'decorator_list', []):
        if (isinstance(d, ast.Call) and isinstance(d.func, ast.Attribute)
                and d.func.attr in ('get', 'post', 'put', 'patch', 'delete')
                and d.args and isinstance(d.args[0], ast.Constant)
                and isinstance(d.args[0].value, str)):
            return d.args[0].value
    return None


def definidos(nodo):
    if isinstance(nodo, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
        return {nodo.name}
    out = set()
    if isinstance(nodo, (ast.Assign, ast.AnnAssign, ast.AugAssign)):
        objetivos = nodo.targets if isinstance(nodo, ast.Assign) else [nodo.target]
        for t in objetivos:
            for n in ast.walk(t):
                if isinstance(n, ast.Name):
                    out.add(n.id)
    return out


def nombrados(nodo):
    return {n.id for n in ast.walk(nodo) if isinstance(n, ast.Name)}


def principal(ruta, escribir):
    texto = io.open(ruta, encoding='utf-8-sig').read()
    lineas = texto.split('\n')
    arbol = ast.parse(texto)
    nodos = arbol.body

    defs = [definidos(n) for n in nodos]
    refs = [nombrados(n) - defs[i] for i, n in enumerate(nodos)]
    es_endpoint = [ruta_de(n) is not None for n in nodos]

    quitar = set()
    motivo = {}
    for i, n in enumerate(nodos):
        # NOTAS DE SECCIÓN SUELTAS. El código usa cadenas `"""..."""` a nivel de
        # módulo como cabeceras entre funciones. No definen ni nombran nada, así
        # que el cierre nunca las toca: al quitar las funciones de Amazon se
        # quedaban huérfanas, contando cosas que ya no existen. Se van si hablan
        # de Amazon.
        if (isinstance(n, ast.Expr) and isinstance(n.value, ast.Constant)
                and isinstance(n.value.value, str)
                and re.search(r'\b(amazon|cortex|dnr|pre-?dnr|whc|dsc|scorecard'
                              r'|asociados|debrief|portal del dsp)\b',
                              n.value.value, re.I)):
            quitar.add(i)
            motivo[i] = 'nota de sección'
            continue
        r = ruta_de(n)
        if r and RUTAS_AMAZON.search(r):
            quitar.add(i)
            motivo[i] = 'ruta ' + r
            continue
        for nombre in defs[i]:
            if nombre in NO_SEMILLA:
                continue
            if NOMBRES_AMAZON.search(nombre) or PALABRAS_AMAZON.search(nombre):
                quitar.add(i)
                motivo[i] = 'nombre ' + nombre
                break

    # Cierre: quien solo es nombrado por lo que se quita, se quita.
    quien_nombra = {}
    for i in range(len(nodos)):
        for nombre in refs[i]:
            quien_nombra.setdefault(nombre, set()).add(i)
    cambio = True
    while cambio:
        cambio = False
        for i, n in enumerate(nodos):
            if i in quitar or es_endpoint[i] or not defs[i]:
                continue
            referidores = set()
            for nombre in defs[i]:
                referidores |= quien_nombra.get(nombre, set())
            referidores.discard(i)
            if referidores and referidores <= quitar:
                quitar.add(i)
                motivo[i] = 'huérfano de ' + ', '.join(sorted(
                    next(iter(defs[j])) if defs[j] else (ruta_de(nodos[j]) or '?')
                    for j in list(referidores)[:3]))
                cambio = True

    # Rangos de líneas (1-based, inclusivos), con decoradores y el bloque de
    # comentarios pegado encima.
    rangos = []
    for i in sorted(quitar):
        n = nodos[i]
        ini = min([n.lineno] + [d.lineno for d in getattr(n, 'decorator_list', [])])
        fin = n.end_lineno
        k = ini - 1
        while k - 1 >= 1 and lineas[k - 2].lstrip().startswith('#'):
            k -= 1
        rangos.append((k, fin, i))

    borrar = set()
    for a, b, _ in rangos:
        borrar.update(range(a, b + 1))

    resumen = {
        'nodos_totales': len(nodos),
        'nodos_quitados': len(quitar),
        'endpoints_quitados': sum(1 for i in quitar if es_endpoint[i]),
        'lineas_antes': len(lineas),
        'lineas_quitadas': len(borrar),
    }
    print(json.dumps(resumen, ensure_ascii=False, indent=1))
    por_motivo = {}
    for i in quitar:
        clave = motivo[i].split(' ')[0]
        por_motivo[clave] = por_motivo.get(clave, 0) + 1
    print('por motivo:', por_motivo)

    with io.open('tools/podado.txt', 'w', encoding='utf-8') as f:
        for a, b, i in rangos:
            nombre = next(iter(defs[i])) if defs[i] else (ruta_de(nodos[i]) or '?')
            f.write('%6d-%-6d %-45s %s\n' % (a, b, nombre[:45], motivo[i]))

    if escribir:
        nuevas = [l for k, l in enumerate(lineas, 1) if k not in borrar]
        # Nunca dos huecos seguidos de más de 3 líneas en blanco.
        limpias, blancos = [], 0
        for l in nuevas:
            blancos = blancos + 1 if not l.strip() else 0
            if blancos <= 2:
                limpias.append(l)
        io.open(ruta, 'w', encoding='utf-8-sig', newline='').write('\n'.join(limpias))
        print('escrito:', ruta, len(limpias), 'líneas')


if __name__ == '__main__':
    principal(sys.argv[1], '--escribir' in sys.argv)
