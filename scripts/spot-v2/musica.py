"""Base musical del spot v2 (14-10-2026): 100 bpm, la menor, pad + bajo + bombo + hi-hat + arpegio,
con el pad «bombeando» al compás. Hecha a mano con numpy: sin derechos de nadie.
  py -3 scripts/spot-v2/musica.py  ->  docs/anuncios/reales/spot-v2/musica.wav (36 s, estéreo)"""
import os
import numpy as np
from scipy.io import wavfile

SR = 44100
BPM = 100
DUR = 44.0
beat = 60 / BPM
t = np.arange(int(SR * DUR)) / SR
raiz = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'docs', 'anuncios', 'reales', 'spot-v2')
os.makedirs(raiz, exist_ok=True)


def nota(semitono, octava=0):
    return 440.0 * 2 ** ((semitono - 9) / 12 + octava)   # A4 = 440; semitono 0 = C


# Progresión: Am · F · C · G (cada acorde, 2 compases = 8 tiempos = 4,8 s) -> 4 acordes = 19,2 s; se repite.
ACORDES = [[9, 0, 4], [5, 9, 0], [0, 4, 7], [7, 11, 2]]
compas = 4 * beat
dur_acorde = 2 * compas


def envolvente(n, ataque=0.01, caida=0.3):
    e = np.ones(n)
    a = int(SR * ataque)
    e[:a] = np.linspace(0, 1, a)
    d = int(SR * caida)
    if d < n:
        e[-d:] *= np.linspace(1, 0, d)
    return e


def sierra_suave(f, tt):
    return sum(np.sin(2 * np.pi * f * k * tt) / k for k in range(1, 6)) / 2.0


pad = np.zeros_like(t)
bajo = np.zeros_like(t)
arpa = np.zeros_like(t)
for i in range(int(np.ceil(DUR / dur_acorde))):
    ac = ACORDES[i % 4]
    ini = i * dur_acorde
    idx = (t >= ini) & (t < ini + dur_acorde)
    tt = t[idx] - ini
    env = envolvente(len(tt), 0.6, 0.8)
    for s in ac:
        for oct_ in (0, 1):
            f = nota(s, oct_ - 1)
            pad[idx] += 0.11 * env * (sierra_suave(f, tt) + 0.5 * np.sin(2 * np.pi * f * 1.003 * tt))
    # Bajo: la fundamental, negras con cola.
    fb = nota(ac[0], -2)
    for b in range(8):
        ini_b = b * beat
        j = (tt >= ini_b) & (tt < ini_b + beat * 0.95)
        tb = tt[j] - ini_b
        bajo[np.where(idx)[0][j]] += 0.33 * np.exp(-2.5 * tb) * np.sin(2 * np.pi * fb * tb) * (1 - np.exp(-200 * tb))
    # Arpegio de corcheas, suave, una octava arriba.
    orden = [0, 1, 2, 1] * 4
    for k, s in enumerate(orden):
        ini_a = k * beat / 2
        j = (tt >= ini_a) & (tt < ini_a + beat * 0.9)
        ta = tt[j] - ini_a
        fa = nota(ac[s], 1)
        arpa[np.where(idx)[0][j]] += 0.08 * np.exp(-5 * ta) * np.sin(2 * np.pi * fa * ta) * (1 - np.exp(-400 * ta))

# Bombo en cada tiempo y caja suave en 2 y 4; hi-hat en corcheas.
bombo = np.zeros_like(t)
caja = np.zeros_like(t)
hat = np.zeros_like(t)
rng = np.random.default_rng(7)
ruido = rng.standard_normal(len(t))
n_beats = int(DUR / beat)
for b in range(n_beats):
    ini = b * beat
    j = (t >= ini) & (t < ini + 0.35)
    tb = t[j] - ini
    bombo[j] += 0.9 * np.exp(-9 * tb) * np.sin(2 * np.pi * (55 + 60 * np.exp(-30 * tb)) * tb)
    if b % 2 == 1:
        caja[j] += 0.22 * np.exp(-18 * tb) * ruido[j] * 0.6 + 0.12 * np.exp(-20 * tb) * np.sin(2 * np.pi * 180 * tb)
    for h in (0, 0.5):
        jh = (t >= ini + h * beat) & (t < ini + h * beat + 0.06)
        th = t[jh] - (ini + h * beat)
        hat[jh] += (0.11 if h == 0 else 0.07) * np.exp(-60 * th) * ruido[jh]

# Pumping: el pad y el arpegio bajan en cada bombo y vuelven.
pump = 1 - 0.55 * np.exp(-6 * ((t % beat)))
mezcla = (pad + arpa) * pump + bajo + bombo + caja + hat

# Un eco corto para que suene a sala y no a cable.
eco = np.zeros_like(mezcla)
d = int(SR * 0.21)
eco[d:] = mezcla[:-d] * 0.22
d2 = int(SR * 0.37)
eco[d2:] += mezcla[:-d2] * 0.12
mezcla = mezcla + eco

# Entrada y salida.
fade_in = np.minimum(1, t / 1.5)
fade_out = np.minimum(1, (DUR - t) / 3.0)
mezcla *= fade_in * fade_out
mezcla /= np.max(np.abs(mezcla)) * 1.15

# Estéreo con un poco de anchura (el arpegio y el eco, ladeados).
izq = mezcla + 0.06 * np.roll(arpa * pump, int(SR * 0.012))
der = mezcla - 0.06 * np.roll(arpa * pump, -int(SR * 0.012))
est = np.stack([izq, der], axis=1)
est /= np.max(np.abs(est)) * 1.05
wavfile.write(os.path.join(raiz, 'musica.wav'), SR, (est * 32767).astype(np.int16))
print('ok', os.path.join(raiz, 'musica.wav'))
