# -*- coding: utf-8 -*-
"""Las fotos «con el golpe» de la demo pública del panel (14-11-2026).

POR QUÉ. La demo (`_seed_demo_data` en backend/server.py) ponía las MISMAS dos
fotos en todas sus inspecciones. En «Origen de daños», que enseña la última
foto en la que la furgoneta estaba bien junto a la del golpe, las dos eran la
misma imagen: no había «antes y después» y la caja naranja marcaba chapa
limpia. Este guion parte de las dos fotos de siempre (`frontend/public/demo/
van-lateral.jpg` y `van-frontal.jpg`) y dibuja el golpe DENTRO de la caja de
cada pieza de la demo (`sitio_golpe` en `_seed_demo_data`): una abolladura con
su sombreado y una rozadura de rayas finas, con el grano de la foto. Sale una
imagen por cada combinación de golpes que la siembra necesita, del mismo
tamaño que la original y de menos de 200 KB.

Determinista (semilla fija): rehacerlas da los mismos píxeles con la misma
versión de Pillow y numpy. Se rehacen con:

    python scripts/demo-fotos-golpes.py

y se miran antes de subirlas. Si cambia una caja de `sitio_golpe`, hay que
cambiar aquí la misma caja (`CAJAS`) y volver a generarlas: la prueba
`backend/tests/test_demo_fotos.py` comprueba que cada foto que siembra la demo
existe y que la variante solo cambia dentro de las cajas de sus golpes.
"""
from pathlib import Path

import numpy as np
from PIL import Image

DEMO = Path(__file__).resolve().parents[1] / "frontend" / "public" / "demo"

# Las mismas cajas que `sitio_golpe` (backend/server.py): [ymin, xmin, ymax, xmax] en 0-1000.
CAJAS = {
    "puerta": [590, 500, 700, 600],      # puerta corredera, lateral
    "paragolpes": [690, 233, 785, 290],  # paragolpes trasero, lateral
    "porton": [380, 238, 640, 275],      # canto de las puertas traseras, lateral
    "aleta": [615, 308, 708, 425],       # aleta trasera derecha, encima de la rueda trasera, lateral
}

# Qué imagen lleva qué golpes. Los nombres son los que usa la siembra.
VARIANTES = {
    "van-lateral-golpe-puerta.jpg": ("van-lateral.jpg", ["puerta"]),
    "van-lateral-golpe-paragolpes.jpg": ("van-lateral.jpg", ["paragolpes"]),
    "van-lateral-golpe-paragolpes-porton.jpg": ("van-lateral.jpg", ["paragolpes", "porton"]),
    # La 2462 JKL: la puerta (07-11) y, después, la aleta trasera derecha.
    "van-lateral-golpe-puerta-aleta.jpg": ("van-lateral.jpg", ["puerta", "aleta"]),
}
# La aleta era la DELANTERA IZQUIERDA, en la frontal, sin variante: allí la
# furgoneta va lejos y a 600 px la aleta son unos 10 px (14-11-2026). Se cambió
# en la siembra por la TRASERA DERECHA, que en la lateral es grande.

TOPE_BYTES = 200_000


def _desenfoca(a: np.ndarray, sigma: float) -> np.ndarray:
    """Desenfoque gaussiano separable (Pillow no lo hace sobre imágenes de coma flotante)."""
    if sigma <= 0:
        return a
    r = max(1, int(3 * sigma))
    x = np.arange(-r, r + 1, dtype=np.float32)
    k = np.exp(-(x * x) / (2 * sigma * sigma))
    k /= k.sum()
    p = np.pad(a, r, mode="edge")
    p = np.apply_along_axis(lambda f: np.convolve(f, k, mode="valid"), 1, p)
    return np.apply_along_axis(lambda f: np.convolve(f, k, mode="valid"), 0, p)


def _ruido_suave(rng, h, w, escala):
    """Ruido de baja frecuencia en [0, 1] (manchas irregulares, no un óvalo perfecto)."""
    peq = rng.random((max(2, h // escala + 2), max(2, w // escala + 2))).astype(np.float32)
    im = Image.fromarray((peq * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    return np.asarray(im, dtype=np.float32) / 255.0


def _rayas(rng, h, w, n, cx, cy, largo, grueso, angulo, s=4):
    """Máscara (h×w, 0-1) de `n` rayas finas casi paralelas, dibujadas a `s`× y reducidas (bordes suaves)."""
    from PIL import ImageDraw
    lienzo = Image.new("L", (w * s, h * s), 0)
    d = ImageDraw.Draw(lienzo)
    ca, sa = np.cos(np.radians(angulo)), np.sin(np.radians(angulo))
    for _ in range(n):
        # Más rayas en el centro de la banda que en los bordes.
        off = rng.normal(0, grueso / 2.2)
        a0 = rng.uniform(-largo / 2, largo / 2 - largo * 0.15)
        a1 = a0 + rng.uniform(largo * 0.15, largo * 0.7)
        a1 = min(a1, largo / 2)
        ang = np.radians(rng.normal(0, 1.2))
        c2, s2 = np.cos(ang), np.sin(ang)
        pts = []
        for t in (a0, a1):
            x = t * c2 - off * s2
            y = t * s2 + off * c2
            pts.append(((cx + x * ca - y * sa) * s, (cy + x * sa + y * ca) * s))
        valor = int(rng.uniform(70, 255))
        d.line(pts, fill=valor, width=max(1, int(rng.uniform(0.5, 1.6) * s)))
    m = np.asarray(lienzo.resize((w, h), Image.LANCZOS), dtype=np.float32) / 255.0
    return np.clip(m, 0, 1)


def _abolladura(h, w, cx, cy, rx, ry, rng, fuerza=0.16):
    """Sombreado de una abolladura: un hundimiento irregular iluminado desde arriba.

    Devuelve un factor multiplicativo de luz (1 = sin cambio): el borde de
    arriba del hundimiento queda en sombra y el de abajo recibe algo más de luz."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d2 = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
    irregular = 0.75 + 0.5 * _ruido_suave(rng, h, w, max(3, int(min(rx, ry) / 2)))
    prof = np.exp(-d2 * 1.6 / irregular)
    prof = _desenfoca(prof, 1.0)
    gy, gx = np.gradient(prof)
    # Luz de arriba y un poco de la izquierda.
    luz = -(gy * 0.9 + gx * 0.35)
    luz = luz / (np.abs(luz).max() + 1e-6)
    return 1.0 + fuerza * luz - fuerza * 0.3 * prof


P_ENV = 1.6   # > 1: la mancha llena su óvalo y se apaga en el borde irregular


def _envoltura(rng, h, w, cx, cy, rx, ry, angulo=0.0):
    """Mancha alargada de borde irregular (0-1) que hace que el golpe se apague antes del borde de la caja."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    ca, sa = np.cos(np.radians(angulo)), np.sin(np.radians(angulo))
    u = ((xx - cx) * ca + (yy - cy) * sa) / rx
    v = (-(xx - cx) * sa + (yy - cy) * ca) / ry
    borde = 0.7 + 0.6 * _ruido_suave(rng, h, w, 4)
    return np.clip(P_ENV - (u * u + v * v) / borde, 0, 1) ** 0.8


def _pinta_golpe(arr: np.ndarray, pieza: str, rng) -> None:
    """Dibuja en `arr` (alto×ancho×3, float 0-255) el golpe de `pieza`, dentro de su caja."""
    H, W = arr.shape[:2]
    y0, x0, y1, x1 = CAJAS[pieza]
    bx0, by0, bx1, by1 = int(x0 * W / 1000), int(y0 * H / 1000), int(x1 * W / 1000), int(y1 * H / 1000)
    reg = arr[by0:by1, bx0:bx1]
    h, w = reg.shape[:2]
    P = PARAMS[pieza]
    cx, cy = w * P["c"][0], h * P["c"][1]
    env = _envoltura(rng, h, w, cx, cy, w * P["env"][0], h * P["env"][1], P["ang"])
    luz = _abolladura(h, w, cx + w * P["dent"][0], cy + h * P["dent"][1], w * P["dent"][2], h * P["dent"][3],
                      rng, P["fuerza"])
    largo, grueso = (h, w) if abs(P["ang"]) > 45 else (w, h)
    r = _rayas(rng, h, w, P["n"], cx, cy, largo * P["largo"], grueso * P["grueso"], P["ang"])
    r = _desenfoca(r, 0.35) * env
    man = _ruido_suave(rng, h, w, 5)
    # Lo arrancado: rayas + una veladura difusa (pintura del otro, polvo de la chapa rozada).
    velo = _desenfoca(r, 2.2) * 1.8
    marca = np.clip(r * (0.35 + 0.65 * man) * P["rayas"] + velo * P["velo"], 0, 0.95)
    # Y unos pocos brillos finos al lado (el rayado refleja la luz).
    cla = _rayas(rng, h, w, P["n"] // 4, cx, cy - h * 0.04, largo * P["largo"] * 0.8,
                 grueso * P["grueso"] * 0.8, P["ang"])
    cla = _desenfoca(cla, 0.3) * env * P["brillo"]
    lum = reg.mean(axis=2, keepdims=True)
    reg *= luz[..., None]
    color = np.array(P["color"], np.float32)
    reg[:] = reg * (1 - marca[..., None]) + color * marca[..., None]
    color_cla = np.clip(lum * 0.3 + 170, 0, 240)
    reg[:] = reg * (1 - cla[..., None]) + color_cla * cla[..., None]
    # El grano de la foto también encima del golpe, o se vería pegado.
    toca = np.clip((np.abs(luz - 1) * 6 + marca + cla), 0, 1)[..., None]
    reg += rng.normal(0, 4.5, (h, w, 1)).astype(np.float32) * toca


# Cada golpe: centro (fracción de la caja), envoltura, abolladura (desplazamiento y radios, fracción),
# su fuerza, número de rayas, largo y grueso de la banda, ángulo, y cuánto pesan rayas, veladura y brillos.
PARAMS = {
    # Puerta corredera: abolladura ancha y rozadura horizontal (un bolardo o un retrovisor al pasar).
    "puerta": dict(c=(0.5, 0.52), env=(0.44, 0.34), dent=(0.02, -0.02, 0.34, 0.36), fuerza=0.22, n=90,
                   largo=0.85, grueso=0.32, ang=-3.0, rayas=0.75, velo=0.22, brillo=0.35, color=(96, 97, 100)),
    # Paragolpes de plástico negro: el plástico rozado queda gris claro.
    "paragolpes": dict(c=(0.36, 0.4), env=(0.3, 0.22), dent=(0.0, 0.0, 0.3, 0.2), fuerza=0.1, n=70,
                       largo=0.75, grueso=0.3, ang=6.0, rayas=0.9, velo=0.35, brillo=0.0, color=(178, 177, 175)),
    # Canto de la puerta trasera: hundido y rayado casi en vertical (marcha atrás contra un poste).
    "porton": dict(c=(0.72, 0.5), env=(0.28, 0.34), dent=(0.0, 0.0, 0.3, 0.24), fuerza=0.4, n=90,
                   largo=0.55, grueso=0.38, ang=84.0, rayas=1.0, velo=0.6, brillo=0.3, color=(72, 73, 78)),
    # Aleta trasera derecha (chapa blanca sobre la rueda): rozadura casi horizontal sobre el arco y una
    # abolladura poco honda (al arrimarse a un bolardo o a una columna de garaje).
    "aleta": dict(c=(0.46, 0.58), env=(0.42, 0.3), dent=(0.04, -0.06, 0.3, 0.34), fuerza=0.26, n=90,
                  largo=0.8, grueso=0.28, ang=-8.0, rayas=0.75, velo=0.25, brillo=0.3, color=(92, 93, 97)),
}


def genera(nombre: str) -> Path:
    base, piezas = VARIANTES[nombre]
    with Image.open(DEMO / base) as im:
        arr = np.asarray(im.convert("RGB"), dtype=np.float32).copy()
    # Semilla POR GOLPE, no por imagen (14-11-2026): el mismo golpe sale igual en
    # todas las fotos que lo llevan. Si no, en el antes y después de «Origen de
    # daños» (la limpia ya lleva la puerta; la del golpe, la puerta y la aleta)
    # la rozadura de la puerta cambiaba de forma entre las dos fotos.
    for p in piezas:
        _pinta_golpe(arr, p, np.random.default_rng(sum(map(ord, p))))
    out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    destino = DEMO / nombre
    for calidad in (86, 82, 78, 74, 70):
        out.save(destino, "JPEG", quality=calidad, optimize=True, progressive=True)
        if destino.stat().st_size < TOPE_BYTES:
            break
    return destino


if __name__ == "__main__":
    for n in VARIANTES:
        p = genera(n)
        print(f"{p.name}: {p.stat().st_size} bytes")
