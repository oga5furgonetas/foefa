# -*- coding: utf-8 -*-
"""Teselas de mapa REAL para grabar la app sin red (29-10-2026).

Sin salida a tile.openstreetmap.org, la grabación del anuncio salía con un callejero inventado. Pero en
docs/play-store/captura-4-oficina-mapa.png (la captura del panel para Google Play) está el mapa de verdad de
A Coruña, de OpenStreetMap, a 2x (zoom 14 del panel = resolución de zoom 15). Este script:
  1. georreferencia la captura casando sus 12 marcadores con las coordenadas de los pedidos de la demo
     (_DEMO_REP_PEDIDOS en backend/server.py): error < 1 px;
  2. limpia el mapa (marcadores, líneas de ruta, control de zoom, atribución) y lo amplía por reflejo en los
     bordes para que no se acabe el mundo en el borde de la captura;
  3. corta teselas 256×256 de los zooms 13-17 en <salida>/{z}/{x}/{y}.jpg, que sirve e2e/spot-ruta.spec.js
     (variable TESELAS) en lugar de las de OSM.

    python scripts/spot-ruta/teselas.py <carpeta de salida>
Deja también docs/anuncios/super-anuncio/mapa-coruna.jpg (+ .json con la georreferencia) para mirarlo."""
import itertools
import json
import math
import os
import sys

import cv2
import numpy as np

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CAPTURA = os.path.join(RAIZ, 'docs', 'play-store', 'captura-4-oficina-mapa.png')
SA = os.path.join(RAIZ, 'docs', 'anuncios', 'super-anuncio')

# Los pedidos de la demo (código, lat, lng, color del marcador en el panel).
PEDIDOS = [
    ("DEMO1001", 43.3703, -8.3982, 'azul'), ("DEMO1002", 43.3690, -8.4030, 'azul'), ("DEMO1009", 43.3713, -8.4040, 'azul'),
    ("DEMO1003", 43.3668, -8.4040, 'naranja'), ("DEMO1004", 43.3560, -8.4060, 'naranja'),
    ("DEMO1006", 43.3560, -8.4120, 'verde'), ("DEMO1011", 43.3600, -8.3960, 'verde'),
    ("DEMO1005", 43.3638, -8.4065, 'gris'), ("DEMO1007", 43.3585, -8.4150, 'gris'), ("DEMO1008", 43.3690, -8.4060, 'gris'),
    ("DEMO1010", 43.3610, -8.4140, 'gris'), ("DEMO1012", 43.3580, -8.4020, 'gris'),
]
COLOR = {'azul': (14, 165, 233), 'naranja': (249, 115, 22), 'verde': (34, 197, 94), 'gris': (100, 116, 139)}  # RGB
# El rectángulo del mapa dentro de la captura (sin el borde redondeado del panel).
X0, Y0, X1, Y1 = 584, 672, 2472, 1400
PAD = 420  # ampliación por reflejo (px) en cada lado


def merc(lat, lon):
    x = (lon + 180) / 360
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2
    return x, y


def marcadores(rgb):
    """Centros de los marcadores redondos (40 px) de cada color."""
    out = {}
    for nombre, c in COLOR.items():
        mask = (np.abs(rgb - np.array(c)).sum(axis=2) < 40).astype(np.uint8)
        mask[:Y0] = 0; mask[Y1:] = 0; mask[:, :X0] = 0; mask[:, X1:] = 0
        n, _, st, cen = cv2.connectedComponentsWithStats(mask, 8)
        out[nombre] = [(cen[i][0], cen[i][1]) for i in range(1, n) if 24 <= st[i][2] <= 60 and 24 <= st[i][3] <= 60 and st[i][4] > 300]
    return out


def georreferenciar(rgb):
    vistos = marcadores(rgb)
    grupos = {c: [p for p in PEDIDOS if p[3] == c] for c in COLOR}
    for c in COLOR:
        if len(vistos[c]) != len(grupos[c]):
            raise SystemExit(f'marcadores {c}: vistos {len(vistos[c])}, esperados {len(grupos[c])}')

    def ajustar(pares):
        A, b = [], []
        for (mx, my), (px, py) in pares:
            A.append([mx, 1, 0]); b.append(px)
            A.append([my, 0, 1]); b.append(py)
        A, b = np.array(A, float), np.array(b, float)
        sol = np.linalg.lstsq(A, b, rcond=None)[0]
        err = np.sqrt(((A @ sol - b) ** 2).reshape(-1, 2).sum(axis=1))
        return sol, err

    mejor = None
    for perm in itertools.product(*[itertools.permutations(range(len(vistos[c]))) for c in COLOR]):
        pares = [(merc(p[1], p[2]), vistos[c][i]) for c, pm in zip(COLOR, perm) for p, i in zip(grupos[c], pm)]
        sol, err = ajustar(pares)
        if mejor is None or err.max() < mejor[1].max():
            mejor = (sol, err, pares)
    sol, err, pares = mejor
    print(f'georreferencia: escala {sol[0]:.1f} px/mercator (zoom {math.log2(sol[0] / 256):.4f}), error máx {err.max():.2f} px')
    return sol, pares


def limpiar(im, pares):
    """Quita marcadores, líneas de ruta, el control de zoom y la atribución; devuelve el recorte ampliado."""
    rgb = im[:, :, ::-1].astype(int)
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    mask = np.zeros(im.shape[:2], np.uint8)
    # Marcadores: círculo de radio 27 (relleno 20 + borde blanco + sombra).
    for _, (px, py) in pares:
        cv2.circle(mask, (int(round(px)), int(round(py))), 27, 255, -1)
    # El marcador negro de «dónde estoy» del panel (círculo oscuro de ~40 px).
    oscuro = (hsv[:, :, 2] < 80).astype(np.uint8); oscuro[:Y0] = 0; oscuro[Y1:] = 0; oscuro[:, :X0] = 0; oscuro[:, X1:] = 0
    n, _, st, cen = cv2.connectedComponentsWithStats(oscuro, 8)
    for i in range(1, n):
        if 24 <= st[i][2] <= 70 and 24 <= st[i][3] <= 70 and st[i][4] > 350:
            cv2.circle(mask, (int(cen[i][0]), int(cen[i][1])), 34, 255, -1)
    # Líneas de ruta (discontinuas, saturadas) de los tres colores vivos: por tono y saturación.
    for c in ('azul', 'naranja', 'verde'):
        h = cv2.cvtColor(np.uint8([[COLOR[c][::-1]]]), cv2.COLOR_BGR2HSV)[0, 0, 0]
        dh = np.minimum(np.abs(hsv[:, :, 0].astype(int) - int(h)), 180 - np.abs(hsv[:, :, 0].astype(int) - int(h)))
        mask |= ((dh <= 7) & (hsv[:, :, 1] > 105) & (hsv[:, :, 2] > 90)).astype(np.uint8) * 255
    # Las grises (azul apagado, más oscuro que el fondo del mapa).
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    mask |= ((b - r >= 9) & (b - g >= 4) & (r < 178) & (hsv[:, :, 2] > 115) & (hsv[:, :, 2] < 188)).astype(np.uint8) * 255
    mask = cv2.dilate(mask, np.ones((7, 7), np.uint8))
    # Fuera del mapa no se toca nada.
    mask[:Y0] = 0; mask[Y1:] = 0; mask[:, :X0] = 0; mask[:, X1:] = 0
    # La atribución de Leaflet (abajo a la derecha).
    mask[1372:Y1, 2140:X1] = 255
    # Relleno en dos pasos: primero a 1/4 (un parche suave, sin las «estrellas» que deja el relleno a tamaño
    # real en los círculos de los marcadores) y luego el detalle fino sobre ese parche.
    peq = cv2.inpaint(cv2.resize(im, None, fx=0.25, fy=0.25, interpolation=cv2.INTER_AREA),
                      cv2.dilate(cv2.resize(mask, None, fx=0.25, fy=0.25, interpolation=cv2.INTER_NEAREST), np.ones((3, 3), np.uint8)), 4, cv2.INPAINT_NS)
    suave = cv2.resize(peq, (im.shape[1], im.shape[0]), interpolation=cv2.INTER_CUBIC)
    limpio = np.where(mask[:, :, None] > 0, suave, im).astype(np.uint8)
    # El control +/- (arriba a la izquierda): se tapa con el trozo de mapa de al lado.
    limpio[Y0:Y0 + 150, X0:X0 + 90] = limpio[Y0:Y0 + 150, X0 + 90:X0 + 180]
    recorte = limpio[Y0:Y1, X0:X1]
    return cv2.copyMakeBorder(recorte, PAD, PAD, PAD, PAD, cv2.BORDER_REFLECT_101)


def ampliar(mapa, veces, modelo=None):
    """El mapa a ×2 o ×4 para los zooms 16 y 17: con superresolución (FSRCNN, si está el modelo) o, si no,
    Lanczos + máscara de enfoque, que deja las calles nítidas aunque los rótulos sigan borrosos."""
    if modelo and os.path.exists(modelo) and hasattr(cv2, 'dnn_superres'):
        sr = cv2.dnn_superres.DnnSuperResImpl_create(); sr.readModel(modelo); sr.setModel('fsrcnn', veces)
        return sr.upsample(mapa)
    g = cv2.resize(mapa, None, fx=veces, fy=veces, interpolation=cv2.INTER_LANCZOS4)
    return cv2.addWeighted(g, 1.55, cv2.GaussianBlur(g, (0, 0), 1.2 * veces), -0.55, 0)


def recortar(fuentes, px, py, lado):
    """La tesela (256×256) cuyo origen en el mapa base es (px, py) y mide `lado` px: se corta de la versión
    ampliada más parecida a su resolución, para no interpolar dos veces."""
    veces = max(1, min(4, int(round(256 / lado)))) if lado < 256 else 1
    veces = 4 if veces >= 3 else veces
    img = fuentes[veces]
    M = np.float32([[256 / (lado * veces), 0, -px * 256 / lado], [0, 256 / (lado * veces), -py * 256 / lado]])
    return cv2.warpAffine(img, M, (256, 256), flags=cv2.INTER_AREA if lado * veces >= 256 else cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT_101)


def teselas(mapa, sol, salida, zooms=range(13, 18)):
    s, ox, oy = sol[0], sol[1] - X0 + PAD, sol[2] - Y0 + PAD
    H, W = mapa.shape[:2]
    sr = os.environ.get('SR_MODELOS', '')
    fuentes = {1: mapa, 2: ampliar(mapa, 2, os.path.join(sr, 'FSRCNN_x2.pb') if sr else None), 4: ampliar(mapa, 4, os.path.join(sr, 'FSRCNN_x4.pb') if sr else None)}
    n = 0
    for z in zooms:
        lado = s / 2 ** z  # px de imagen por tesela
        x0, x1 = int((0 - ox) / lado) - 1, int((W - ox) / lado) + 1
        y0, y1 = int((0 - oy) / lado) - 1, int((H - oy) / lado) + 1
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                px, py = x * lado + ox, y * lado + oy
                if px + lado <= 0 or py + lado <= 0 or px >= W or py >= H:
                    continue
                t = recortar(fuentes, px, py, lado)
                d = os.path.join(salida, str(z), str(x)); os.makedirs(d, exist_ok=True)
                cv2.imwrite(os.path.join(d, f'{y}.jpg'), t, [cv2.IMWRITE_JPEG_QUALITY, 92])
                n += 1
    return n


def main():
    salida = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'frontend', 'test-results', 'teselas')
    im = cv2.imread(CAPTURA)
    sol, pares = georreferenciar(im[:, :, ::-1].astype(int))
    mapa = limpiar(im, pares)
    cv2.imwrite(os.path.join(SA, 'mapa-coruna.jpg'), mapa, [cv2.IMWRITE_JPEG_QUALITY, 90])
    json.dump({'escala_px_por_mercator': sol[0], 'ox': sol[1] - X0 + PAD, 'oy': sol[2] - Y0 + PAD, 'ancho': mapa.shape[1], 'alto': mapa.shape[0],
               'nota': 'px = escala*mercator + o; mercator en [0,1] (web mercator). Zoom nativo 15 (256 px por tesela).'},
              open(os.path.join(SA, 'mapa-coruna.json'), 'w'), indent=1)
    n = teselas(mapa, sol, salida)
    print(f'{n} teselas en {salida}')


if __name__ == '__main__':
    main()
