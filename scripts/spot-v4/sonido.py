# -*- coding: utf-8 -*-
"""Música y efectos del spot v4 (24-10-2026), hechos con numpy: sin derechos de nadie.

    py -3 scripts/spot-v4/sonido.py  ->  docs/anuncios/reales/spot-v4/{musica.wav, whoosh.wav, pop.wav,
                                         obturador.wav, ding.wav, subida.wav}

Música: 122 bpm, la menor (Am–F–C–G), bombo a negras, palmada en 2 y 4, charles a semicorcheas, bajo
sintetizado y acordes cortos a contratiempo: el pulso de un anuncio de TikTok, no una melodía de ascensor.
Los efectos subrayan lo que pasa en pantalla: barrido en cada corte, «pop» en cada toque, obturador en la
foto, campanita en «Entregado» y una subida antes del cierre."""
import os

import numpy as np
from scipy.io import wavfile

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SALIDA = os.path.join(RAIZ, 'docs', 'anuncios', 'reales', 'spot-v4')
SR = 48000
rng = np.random.default_rng(7)


def guardar(nombre, x, estereo=True):
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.89
    if estereo and x.ndim == 1:
        x = np.stack([x, x], axis=1)
    wavfile.write(os.path.join(SALIDA, nombre), SR, (x * 32767).astype(np.int16))


def env(n, a=0.002, d=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)


def nota(semi):
    return 440.0 * 2 ** (semi / 12)


def paso_bajo(x, corte):
    # Filtro de un polo (suficiente para suavizar ruido y pads).
    a = np.exp(-2 * np.pi * corte / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def musica(dur=32.0, bpm=122):
    n = int(SR * dur)
    t = np.arange(n) / SR
    L = np.zeros(n); R = np.zeros(n)
    beat = 60 / bpm
    compas = 4 * beat
    acordes = [(-12, [0, 3, 7]), (-16, [0, 4, 7]), (-9, [0, 4, 7]), (-14, [0, 4, 7])]   # Am F C G (raíz respecto a A4)

    def poner(dst, muestra, t0, g=1.0):
        i = int(t0 * SR)
        if i >= n: return
        m = muestra[: n - i]
        dst[i:i + len(m)] += g * m

    # Bombo: seno que cae de 120 a 45 Hz.
    nb = int(0.32 * SR); tb = np.arange(nb) / SR
    bombo = np.sin(2 * np.pi * np.cumsum(45 + 75 * np.exp(-tb * 28)) / SR) * env(nb, 0.001, 0.12)
    # Palmada: ruido filtrado en ráfagas.
    npm = int(0.18 * SR)
    palmada = rng.standard_normal(npm) * (env(npm, 0.001, 0.05) + 0.6 * np.roll(env(npm, 0.001, 0.03), int(0.012 * SR)))
    palmada = palmada - paso_bajo(palmada, 900)
    # Charles: ruido agudo muy corto.
    nh = int(0.05 * SR)
    charles = rng.standard_normal(nh) * env(nh, 0.0005, 0.012)
    charles = charles - paso_bajo(charles, 6000)

    k = 0.0
    while k < dur:
        for b in range(4):
            tb0 = k + b * beat
            poner(L, bombo, tb0, 1.0); poner(R, bombo, tb0, 1.0)
            if b in (1, 3):
                poner(L, palmada, tb0, 0.45); poner(R, palmada, tb0 + 0.004, 0.45)
            for s in range(4):
                g = 0.16 if s % 2 else 0.10
                poner(L, charles, tb0 + s * beat / 4, g * 1.1); poner(R, charles, tb0 + s * beat / 4 + 0.003, g)
        k += compas

    # Bajo (diente de sierra filtrado, corcheas) y acordes cortos a contratiempo.
    bajo = np.zeros(n); pad = np.zeros(n)
    for c in range(int(dur / compas) + 1):
        raiz, triada = acordes[c % 4]
        for corchea in range(8):
            t0 = c * compas + corchea * beat / 2
            i0 = int(t0 * SR); i1 = min(n, i0 + int(beat / 2 * SR * 0.9))
            if i0 >= n: break
            tt = np.arange(i1 - i0) / SR
            f = nota(raiz - 12)
            saw = 2 * ((tt * f) % 1) - 1
            bajo[i0:i1] += saw * env(i1 - i0, 0.003, 0.16)
            if corchea % 2 == 1:
                st = np.zeros(i1 - i0)
                for s in triada:
                    st += np.sin(2 * np.pi * nota(raiz + s + 12) * tt) + 0.3 * np.sin(2 * np.pi * nota(raiz + s + 24) * tt)
                pad[i0:i1] += st * env(i1 - i0, 0.004, 0.09)
    bajo = paso_bajo(bajo, 380)
    L += 0.55 * bajo + 0.16 * pad; R += 0.55 * bajo + 0.16 * np.roll(pad, int(0.009 * SR))
    fin = np.minimum(1, (dur - t) / 1.5)
    L *= fin; R *= fin
    est = np.stack([L, R], axis=1)
    est = np.tanh(est / (np.max(np.abs(est)) + 1e-9) * 1.6)
    guardar('musica.wav', est)


def efectos():
    # Barrido («whoosh»): ruido con un paso banda que sube y baja.
    nw = int(0.42 * SR); tw = np.arange(nw) / SR
    ruido = rng.standard_normal(nw)
    lento = paso_bajo(ruido, 2500) - paso_bajo(ruido, 300)
    forma = np.sin(np.pi * tw / tw[-1]) ** 2
    guardar('whoosh.wav', lento * forma)
    # Pop del toque.
    npop = int(0.09 * SR); tp = np.arange(npop) / SR
    guardar('pop.wav', np.sin(2 * np.pi * np.cumsum(1100 - 500 * tp / tp[-1]) / SR) * env(npop, 0.001, 0.025))
    # Obturador: dos clics.
    no = int(0.22 * SR)
    clic = rng.standard_normal(no) * (env(no, 0.0005, 0.008) + 0.8 * np.roll(env(no, 0.0005, 0.01), int(0.09 * SR)))
    guardar('obturador.wav', clic - paso_bajo(clic, 1500))
    # Campanita de «Entregado».
    nd = int(0.9 * SR); td = np.arange(nd) / SR
    ding = (np.sin(2 * np.pi * 1318.5 * td) + 0.5 * np.sin(2 * np.pi * 1975.5 * td)) * env(nd, 0.002, 0.25)
    ding[int(0.11 * SR):] += (np.sin(2 * np.pi * 1975.5 * td[:nd - int(0.11 * SR)]) * 0.7) * env(nd - int(0.11 * SR), 0.002, 0.3)
    guardar('ding.wav', ding)
    # Subida antes del cierre.
    ns = int(1.3 * SR); ts = np.arange(ns) / SR
    r = rng.standard_normal(ns)
    barrido = np.sin(2 * np.pi * np.cumsum(220 + 1100 * (ts / ts[-1]) ** 2) / SR)
    sube = ((r - paso_bajo(r, 1200)) * 0.8 + 0.35 * barrido) * (ts / ts[-1]) ** 2.2
    guardar('subida.wav', sube)


if __name__ == '__main__':
    os.makedirs(SALIDA, exist_ok=True)
    musica()
    efectos()
    print('ok música y efectos')
