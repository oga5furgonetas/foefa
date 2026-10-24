# -*- coding: utf-8 -*-
"""Un día de reparto creíble para grabar el spot v5 (24-10-2026): 15 paradas en calles reales del centro de
A Coruña, con su posición (Nominatim/OpenStreetMap) y la ruta por carretera de verdad (OSRM), para que el
mapa del anuncio enseñe lo que ve un repartidor un día normal y no tres paradas.

    py -3 scripts/spot-v5/ruta.py  ->  frontend/e2e/fixtures/coruna-dia.json

Los destinatarios son inventados (nombre de pila e inicial, o un tipo de negocio genérico); las calles son
reales. La primera parada es la de coruna-real.json (Farmacia Sol), así la guía por voz grabada sigue valiendo.
Se respeta el uso de los servicios públicos: una consulta por segundo a Nominatim, con agente identificado, y la
geocodificación queda guardada (no se repite)."""
import json
import math
import os
import time
import urllib.parse
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FIX = os.path.join(RAIZ, 'frontend', 'e2e', 'fixtures')
CACHE = os.path.join(RAIZ, 'scripts', 'spot-v5', 'geocodificado.json')
AGENTE = 'FDS-spot/1.0 (contacto@flotadsp.com)'
YO = (43.3636, -8.4118)

PARADAS = [
    ('p1', 'Farmacia Sol', 'Rúa Sinfónica de Galicia 8', 'A Coruña', (43.363889, -8.409899)),
    ('p2', 'Lucía M.', 'Rúa Emilia Pardo Bazán 14', 'A Coruña', (43.363999, -8.407109)),
    ('p3', 'Bar Pepe', 'Rúa Marcial del Adalid 5', 'A Coruña', (43.36219, -8.407002)),
    ('p4', 'Marta G.', 'Rúa Juan Flórez 46', 'A Coruña', None),
    ('p5', 'Panadería', 'Rúa Fernando Macías 12', 'A Coruña', None),
    ('p6', 'Iván R.', 'Avenida de Finisterre 50', 'A Coruña', None),
    ('p7', 'Óptica', 'Rúa Ramón y Cajal 20', 'A Coruña', None),
    ('p8', 'Sara P.', 'Rúa Médico Rodríguez 6', 'A Coruña', None),
    ('p9', 'Ferretería', 'Rúa Pérez Cepeda 20', 'A Coruña', None),
    ('p10', 'Nuria V.', 'Rúa Alfredo Vicenti 9', 'A Coruña', None),
    ('p11', 'Kiosko', 'Rúa Barcelona 40', 'A Coruña', None),
    ('p12', 'Andrés C.', 'Rúa Ronda de Outeiro 120', 'A Coruña', None),
    ('p13', 'Floristería', 'Rúa Fernández Latorre 30', 'A Coruña', None),
    ('p14', 'Elena F.', 'Rúa Cidade de Lugo 15', 'A Coruña', None),
    ('p15', 'Taller', 'Rúa Galera 12', 'A Coruña', None),
]


def obtener(url):
    req = urllib.request.Request(url, headers={'User-Agent': AGENTE})
    return json.load(urllib.request.urlopen(req, timeout=40))


def geocodificar(calle, ciudad, cache):
    clave = f'{calle}, {ciudad}'
    if clave in cache:
        return cache[clave]
    # Solo dentro de la ciudad (sin «bounded», «Avenida de Finisterre» caía a 40 km).
    q = urllib.parse.urlencode({'q': f'{clave}, España', 'format': 'json', 'limit': 1, 'countrycodes': 'es',
                                'viewbox': '-8.45,43.39,-8.37,43.34', 'bounded': 1})
    r = obtener(f'https://nominatim.openstreetmap.org/search?{q}')
    time.sleep(1.1)
    cache[clave] = [float(r[0]['lat']), float(r[0]['lon'])] if r else None
    return cache[clave]


def distancia(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


def main():
    cache = json.load(open(CACHE, encoding='utf-8')) if os.path.exists(CACHE) else {}
    paradas = []
    for pid, cliente, calle, ciudad, pos in PARADAS:
        pos = pos or geocodificar(calle, ciudad, cache)
        if pos and distancia(YO, pos) > 4000:
            print('demasiado lejos, se descarta:', calle, pos); cache.pop(f'{calle}, {ciudad}', None); pos = None
        if not pos:
            print('sin posición, se salta:', calle); continue
        paradas.append({'id': pid, 'cliente': cliente, 'direccion': f'{calle}, {ciudad}', 'lat': pos[0], 'lng': pos[1]})
        print(f'{pid:4s} {calle:32s} {pos[0]:.5f},{pos[1]:.5f}')
    json.dump(cache, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    # Orden: la primera, Farmacia Sol; después, el vecino más cercano (como haría quien conoce la zona).
    orden = [paradas[0]]
    resto = paradas[1:]
    while resto:
        sig = min(resto, key=lambda p: distancia((orden[-1]['lat'], orden[-1]['lng']), (p['lat'], p['lng'])))
        orden.append(sig); resto.remove(sig)
    puntos = [YO] + [(p['lat'], p['lng']) for p in orden]
    coords = ';'.join(f'{lo},{la}' for la, lo in puntos)
    r = obtener(f'https://router.project-osrm.org/route/v1/driving/{coords}?overview=full&geometries=geojson&steps=false')
    ruta = r['routes'][0]
    linea = [[round(la, 6), round(lo, 6)] for lo, la in ruta['geometry']['coordinates']]
    # Horas: salida 09:35, el tiempo de cada tramo por carretera + 4 min en cada puerta.
    t = 9 * 60 + 35
    for p, tramo in zip(orden, ruta['legs']):
        t += tramo['duration'] / 60 + 4
        p['eta'] = f'{int(t // 60):02d}:{int(t % 60):02d}'
    for i, p in enumerate(orden, 1):
        p['orden'] = i
    fin = f'{int(t // 60):02d}:{int(t % 60):02d}'
    real = json.load(open(os.path.join(FIX, 'coruna-real.json'), encoding='utf-8'))
    salida = {
        'paradas_ordenadas': orden,
        'fin': fin,
        'trazado': {'linea': linea, 'fuente': 'carreteras', 'km': round(ruta['distance'] / 1000, 1),
                    'minutos': round(ruta['duration'] / 60)},
        'navegar': real['navegar'],
    }
    json.dump(salida, open(os.path.join(FIX, 'coruna-dia.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(orden)} paradas · {salida["trazado"]["km"]} km · acaba {fin} · {len(linea)} puntos de trazado')


if __name__ == '__main__':
    main()
