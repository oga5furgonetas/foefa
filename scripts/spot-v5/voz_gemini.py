# -*- coding: utf-8 -*-
"""Locución del spot v5 y del anuncio de Spotify con las voces de Gemini TTS (24-10-2026).

Dani: «busca una voz que no sea robótica». Las voces de Microsoft (edge-tts) suenan a locutora de centralita;
las de Gemini TTS entonan como una persona. Cada voz lee el guion ENTERO de una vez (así la entonación va
seguida, como alguien hablando) y luego se corta por los silencios entre frases.

    GEMINI_API_KEY=… py -3 scripts/spot-v5/voz_gemini.py [voz ...]
      ->  docs/anuncios/reales/spot-v5/voces/<voz>/{completo.wav, f1..f6.wav, voz.json}
    GEMINI_API_KEY=… py -3 scripts/spot-v5/voz_gemini.py --spotify [voz ...]
      ->  docs/anuncios/spotify/v3/<voz>.wav + guion.txt   (y nada más)
    Después de cortar frases nuevas, hay que pasar scripts/spot-v5/alinear.py (tiempos reales de cada palabra).

Gotchas (probados el 24-10): el modelo LEE en voz alta cualquier instrucción que se le ponga delante del texto
(«Dilo cercano: …» o «[alegre] …»), y no admite instrucción de sistema: el tono sale del propio texto y de su
puntuación. Devuelve WAV de 24 kHz mono. La web se escribe como se dice («flota de ese pe punto com»).
Los tiempos de cada palabra (para los subtítulos) se reparten por sílabas dentro de cada tramo de voz, porque
este modelo no los da."""
import base64
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
V5 = os.path.join(RAIZ, 'docs', 'anuncios', 'reales', 'spot-v5', 'voces')
SP = os.path.join(RAIZ, 'docs', 'anuncios', 'spotify', 'v3')
MODELO = 'gemini-3.8-flash-tts'

# (lo que se lee, lo que se ve en los subtítulos)
FRASES = [
    ("¿Todavía ordenas la ruta a mano cada mañana?", "¿Todavía ordenas la ruta a mano cada mañana?"),
    ("Mira: le haces una foto a la etiqueta, y la dirección entra sola.", "Mira: le haces una foto a la etiqueta, y la dirección entra sola."),
    ("Le das a ordenar, y tienes todas las paradas en orden, con la hora de cada una.", "Le das a ordenar, y tienes todas las paradas en orden, con la hora de cada una."),
    ("Ves la ruta en el mapa, y te lleva con voz, puerta a puerta.", "Ves la ruta en el mapa, y te lleva con voz, puerta a puerta."),
    ("Y lo mejor: es gratis, y sin tarjeta.", "Y lo mejor: es gratis, y sin tarjeta."),
    ("Entra en flota de ese pe punto com, y en un minuto tienes tu cuenta.", "Entra en flotadsp.com, y en un minuto tienes tu cuenta."),
]
SPOTIFY = ("Oye, repartidor. Esto es para ti: efe, de, ese. "
           "Una app gratis que te ordena la ruta sola. Le haces una foto a la etiqueta, y te lleva con voz hasta cada puerta. "
           "Sin tarjeta, y sin límite hasta fin de año. "
           "Entra en flota de ese pe punto com. Te lo repito: flota, de, ese, pe, punto com. "
           "O toca este anuncio, y en un minuto tienes tu cuenta.")


def tts(texto, voz):
    k = os.environ['GEMINI_API_KEY']
    body = {"contents": [{"parts": [{"text": texto}]}],
            "generationConfig": {"responseModalities": ["AUDIO"],
                                 "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voz}}}}}
    req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{MODELO}:generateContent?key={k}",
                                 data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
    d = json.load(urllib.request.urlopen(req, timeout=180))
    return base64.b64decode(d['candidates'][0]['content']['parts'][0]['inlineData']['data'])


def duracion(f):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f],
                                capture_output=True, text=True).stdout.strip() or 0)


def silencios(f, ruido=-40, minimo=0.16):
    err = subprocess.run(['ffmpeg', '-i', f, '-af', f'silencedetect=noise={ruido}dB:d={minimo}', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    ini = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', err)]
    fin = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', err)]
    return list(zip(ini, fin + [duracion(f)] * (len(ini) - len(fin))))


def silabas(palabra):
    p = re.sub(r'[^a-záéíóúüñ]', '', palabra.lower())
    return max(1, len(re.findall(r'[aeiouáéíóúü]+', p)))


def palabras_con_tiempo(leido, ini, fin, pausas):
    """Reparte el tramo [ini, fin] entre las palabras por sílabas, saltándose las pausas internas."""
    ws = leido.split()
    pesos = [silabas(w) for w in ws]
    habla = [(ini, fin)]
    for a, b in sorted(pausas):
        nuevo = []
        for x, y in habla:
            if a > x + 0.05 and b < y - 0.05:
                nuevo += [(x, a), (b, y)]
            else:
                nuevo.append((x, y))
        habla = nuevo
    total = sum(y - x for x, y in habla)
    por_peso = total / sum(pesos)
    # Recorre el tiempo de habla palabra a palabra.
    out, tramo, pos = [], 0, habla[0][0]
    for w, p in zip(ws, pesos):
        resto = p * por_peso
        t0 = None
        while resto > 1e-6 and tramo < len(habla):
            x, y = habla[tramo]
            pos = max(pos, x)
            if t0 is None:
                t0 = pos
            usa = min(resto, y - pos)
            pos += usa; resto -= usa
            if pos >= y - 1e-6 and resto > 1e-6:
                tramo += 1
        out.append({'p': w, 'ini': round(t0 if t0 is not None else pos, 3), 'fin': round(pos, 3)})
    return out


def una_voz(voz):
    carpeta = os.path.join(V5, voz)
    os.makedirs(carpeta, exist_ok=True)
    completo = os.path.join(carpeta, 'completo.wav')
    if not os.path.exists(completo):
        open(completo, 'wb').write(tts('\n'.join(l for l, _ in FRASES), voz))
    dur = duracion(completo)
    sil = silencios(completo)
    # Las pausas entre frases. No basta con coger las más largas: una coma a veces dura más que un punto.
    # Se prueban todas las combinaciones de pausas y se queda la que deja cada frase con la duración que
    # le toca por sus sílabas (y, a igualdad, la de pausas más largas).
    from itertools import combinations
    internas = [s for s in silencios(completo, -40, 0.10) if s[0] > 0.3 and s[1] < dur - 0.3]
    inicio = next((b for a, b in sil if a < 0.05), 0.0)
    final = next((a for a, b in sil if b >= dur - 0.05 and a > dur - 1.5), dur)
    syl = [sum(silabas(w) for w in l.split()) for l, _ in FRASES]
    habla = (final - inicio) - sum(b - a for a, b in internas) * 0.5
    ritmo = sum(syl) / habla
    mejor, cortes = None, None
    for comb in combinations(internas, len(FRASES) - 1):
        bordes_ = [inicio] + [b for _, b in comb]
        finales_ = [a for a, _ in comb] + [final]
        coste = sum(((b - a) - n / ritmo) ** 2 / (n / ritmo) for a, b, n in zip(bordes_, finales_, syl))
        coste -= 0.6 * sum(b - a for a, b in comb)
        if mejor is None or coste < mejor:
            mejor, cortes = coste, list(comb)
    if not cortes:
        raise SystemExit(f'{voz}: no encuentro {len(FRASES) - 1} pausas entre frases ({len(internas)})')
    bordes = [inicio] + [b for _, b in cortes]
    finales = [a for a, _ in cortes] + [final]
    salida = []
    for n, ((leido, visto), a, b) in enumerate(zip(FRASES, bordes, finales), 1):
        a0, b0 = max(0, a - 0.04), min(dur, b + 0.08)
        f = os.path.join(carpeta, f'f{n}.wav')
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', completo, '-ss', f'{a0:.3f}', '-to', f'{b0:.3f}',
                        '-af', 'afade=t=in:d=0.015,areverse,afade=t=in:d=0.04,areverse', f], check=True)
        d = duracion(f)
        pausas = [(x - a0, y - a0) for x, y in silencios(f, -40, 0.09) if x > 0.05 and y < d - 0.05]
        ws = palabras_con_tiempo(leido, 0.04, d - 0.06, pausas)
        salida.append({'n': n, 'leido': leido, 'visto': visto, 'fichero': f'voces/{voz}/f{n}.wav', 'dur': round(d, 3), 'palabras': ws})
    # Sílabas por segundo de cada frase: si una se sale mucho de la media, el corte está mal.
    vel = [sum(silabas(w) for w in s['leido'].split()) / s['dur'] for s in salida]
    media = sum(vel) / len(vel)
    raras = [s['n'] for s, v in zip(salida, vel) if abs(v - media) / media > 0.35]
    json.dump({'voz': voz, 'modelo': MODELO, 'frases': salida, 'silabas_por_segundo': round(media, 2), 'raras': raras},
              open(os.path.join(carpeta, 'voz.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{voz:12s} {dur:5.2f} s · {media:.1f} sílabas/s · frases', [s['dur'] for s in salida], '· raras', raras)


def spotify(voz):
    os.makedirs(SP, exist_ok=True)
    f = os.path.join(SP, f'{voz}.wav')
    if not os.path.exists(f):
        open(f, 'wb').write(tts(SPOTIFY, voz))
    with open(os.path.join(SP, 'guion.txt'), 'w', encoding='utf-8') as fh:
        fh.write(SPOTIFY.replace('efe, de, ese', 'FDS').replace('flota de ese pe punto com', 'flotadsp.com')
                 .replace('flota, de, ese, pe, punto com', 'F-L-O-T-A-D-S-P punto com') + '\n')
    print('spotify', voz, round(duracion(f), 2), 's ·', len(SPOTIFY.split()), 'palabras')


if __name__ == '__main__':
    # Con --spotify solo se genera el anuncio de Spotify: volver a cortar las frases del vídeo reescribiría
    # voz.json y se perderían los tiempos que pone scripts/spot-v5/alinear.py (hay que pasarlo DESPUÉS de esto).
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    for voz in args or ['Achird']:
        try:
            spotify(voz) if '--spotify' in sys.argv else una_voz(voz)
        except urllib.error.HTTPError as e:
            print(voz, 'HTTP', e.code, e.read().decode()[:200])
