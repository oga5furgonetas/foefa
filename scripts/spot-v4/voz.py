# -*- coding: utf-8 -*-
"""Locución del spot v4 y del anuncio de Spotify v2 (24-10-2026), con el instante de CADA palabra.

    py -3 scripts/spot-v4/voz.py   ->  docs/anuncios/reales/spot-v4/voz-<n>.mp3 + voz.json
                                      docs/anuncios/spotify/v2/voz.mp3 + voz.json

Los tiempos de las palabras salen del propio motor de voz (WordBoundary) y dan los subtítulos «palabra a
palabra» del vídeo (como los de TikTok). El texto que se LEE escribe la web como suena («flota de ese pe
punto com») y el que se VE la escribe bien (flotadsp.com).

Si Dani graba las frases (s1.mp3…s6.mp3 en docs/anuncios/reales/spot-v4/), el montaje usa su voz; los
subtítulos siguen saliendo de estos tiempos, ajustados a la duración de su grabación."""
import asyncio
import json
import os
import subprocess

import edge_tts

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
V4 = os.path.join(RAIZ, 'docs', 'anuncios', 'reales', 'spot-v4')
SP = os.path.join(RAIZ, 'docs', 'anuncios', 'spotify', 'v2')
VOZ = 'es-ES-XimenaNeural'

# (lo que se lee, lo que se ve en pantalla)
FRASES_VIDEO = [
    ("¿Todavía ordenas la ruta a mano cada mañana?", "¿Todavía ordenas la ruta a mano cada mañana?"),
    ("Hazle una foto a la etiqueta… y la dirección entra sola.", "Hazle una foto a la etiqueta… y la dirección entra sola."),
    ("Pulsas ordenar, y la ruta se pone en orden, con la hora de cada parada.", "Pulsas ordenar, y la ruta se pone en orden, con la hora de cada parada."),
    ("Y te lleva con voz hasta cada puerta.", "Y te lleva con voz hasta cada puerta."),
    ("Gratis. Y sin tarjeta.", "Gratis. Y sin tarjeta."),
    ("Entra en flota de ese pe punto com, y crea tu cuenta en un minuto.", "Entra en flotadsp.com y crea tu cuenta en un minuto."),
]

# Spotify (≤65 palabras, marca al final de la primera frase, la web dicha y deletreada, qué hacer).
SPOTIFY = ("Repartidor, esto es para ti: FDS. "
           "Una app gratis que te ordena la ruta sola. Le haces una foto a la etiqueta, "
           "y te lleva con voz hasta cada puerta. Sin tarjeta, y sin límite hasta fin de año. "
           "Entra en flota de ese pe punto com. Flota, de, ese, pe, punto com. "
           "O toca este anuncio, y crea tu cuenta en un minuto.")


def duracion(f):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f],
                         capture_output=True, text=True).stdout.strip()
    return round(float(out or 0), 3)


async def hablar(texto, destino, rate='+4%', pitch='-1Hz'):
    """Genera el mp3 y devuelve las palabras con su inicio y fin en segundos."""
    com = edge_tts.Communicate(texto, VOZ, rate=rate, pitch=pitch, boundary='WordBoundary')
    palabras = []
    with open(destino, 'wb') as fh:
        async for trozo in com.stream():
            if trozo['type'] == 'audio':
                fh.write(trozo['data'])
            elif trozo['type'] == 'WordBoundary':
                ini = trozo['offset'] / 1e7
                palabras.append({'p': trozo['text'], 'ini': round(ini, 3), 'fin': round(ini + trozo['duration'] / 1e7, 3)})
    return palabras


async def main():
    os.makedirs(V4, exist_ok=True)
    os.makedirs(SP, exist_ok=True)
    salida = []
    for i, (leido, visto) in enumerate(FRASES_VIDEO, 1):
        destino = os.path.join(V4, f'voz-{i}.mp3')
        palabras = await hablar(leido, destino)
        humana = os.path.join(V4, f's{i}.mp3')
        fichero = humana if os.path.exists(humana) else destino
        d_tts, d = duracion(destino), duracion(fichero)
        if fichero != destino and d_tts:
            k = d / d_tts
            palabras = [{**w, 'ini': round(w['ini'] * k, 3), 'fin': round(w['fin'] * k, 3)} for w in palabras]
        salida.append({'n': i, 'leido': leido, 'visto': visto, 'fichero': os.path.basename(fichero), 'dur': d,
                       'humana': fichero == humana, 'palabras': palabras})
        print(i, d, 's', len(palabras), 'palabras', '(humana)' if fichero == humana else '')
    with open(os.path.join(V4, 'voz.json'), 'w', encoding='utf-8') as fh:
        json.dump(salida, fh, ensure_ascii=False, indent=1)
    with open(os.path.join(V4, 'guion.txt'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(f"s{s['n']}. {s['visto']}" for s in salida) + '\n')

    destino = os.path.join(SP, 'voz.mp3')
    palabras = await hablar(SPOTIFY, destino, rate='+2%')
    with open(os.path.join(SP, 'voz.json'), 'w', encoding='utf-8') as fh:
        json.dump({'texto': SPOTIFY, 'dur': duracion(destino), 'palabras_n': len(SPOTIFY.split()), 'palabras': palabras}, fh, ensure_ascii=False, indent=1)
    with open(os.path.join(SP, 'guion.txt'), 'w', encoding='utf-8') as fh:
        fh.write(SPOTIFY.replace('flota de ese pe punto com', 'flotadsp.com').replace('Flota, de, ese, pe, punto com', 'F-L-O-T-A-D-S-P punto com') + '\n')
    print('spotify', duracion(destino), 's', len(SPOTIFY.split()), 'palabras')


if __name__ == '__main__':
    asyncio.run(main())
