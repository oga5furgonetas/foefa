# -*- coding: utf-8 -*-
"""Locución del anuncio de audio de Spotify (23-10-2026), con la voz neuronal de Microsoft (edge-tts).

    py -3 scripts/spotify/voz.py  ->  docs/anuncios/spotify/voz-<voz>.mp3 (+ .json con la duración)

Spotify Ad Studio: 30 s como mucho y unos 65 palabras. El guion dice solo lo que la app hace hoy
(foto a la etiqueta, ruta por tiempo, voz hasta la puerta, gratis sin tarjeta hasta fin de año) y
cierra con el gesto que entiende Spotify: «toca el anuncio». «FDS» se escribe como suena para que la
voz no lo deletree en inglés. Dos voces para que Dani elija: Ximena (la del sketch, «de persona
normal») y Álvaro (la del spot v2)."""
import asyncio
import json
import os
import subprocess

import edge_tts

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SALIDA = os.path.join(RAIZ, 'docs', 'anuncios', 'spotify')
GUION = (
    "¿Repartes paquetes y todavía ordenas la ruta a mano? "
    "Con efe-de-ese, haces una foto a la etiqueta y la dirección entra sola. "
    "La app te ordena las paradas por tiempo y te lleva con voz hasta cada puerta. "
    "Gratis, sin tarjeta y sin límite hasta fin de año. "
    "Efe-de-ese, la app de reparto gratis. Toca el anuncio y pruébala hoy."
)
VOCES = {'ximena': 'es-ES-XimenaNeural', 'alvaro': 'es-ES-AlvaroNeural'}


def duracion(f):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f],
                         capture_output=True, text=True).stdout.strip()
    return round(float(out or 0), 2)


async def main():
    os.makedirs(SALIDA, exist_ok=True)
    with open(os.path.join(SALIDA, 'guion.txt'), 'w', encoding='utf-8') as fh:
        fh.write(GUION.replace('efe-de-ese', 'FDS').replace('Efe-de-ese', 'FDS') + '\n')
    info = {'palabras': len(GUION.split()), 'voces': {}}
    for clave, voz in VOCES.items():
        destino = os.path.join(SALIDA, f'voz-{clave}.mp3')
        await edge_tts.Communicate(GUION, voz, rate='+2%', pitch='-1Hz').save(destino)
        info['voces'][clave] = {'voz': voz, 'segundos': duracion(destino)}
        print(clave, voz, info['voces'][clave]['segundos'], 's')
    with open(os.path.join(SALIDA, 'voz.json'), 'w', encoding='utf-8') as fh:
        json.dump(info, fh, ensure_ascii=False, indent=1)
    print('palabras:', info['palabras'])


if __name__ == '__main__':
    asyncio.run(main())
