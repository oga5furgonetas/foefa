# -*- coding: utf-8 -*-
"""Locución del spot v3 (23-10-2026), frase a frase para sincronizarla con las escenas.

    py -3 scripts/spot-v3/voz.py  ->  docs/anuncios/reales/spot-v3/voz-<n>.mp3 + voz.json (duraciones)

Voz: es-ES-XimenaNeural (la que Dani dio por buena en el sketch: «de persona normal»), un pelín más
lenta y grave para que no suene a locutora de centralita. Si Dani graba las frases él mismo (s1..s5.mp3
en la misma carpeta, mismo orden), el montaje las usa en vez de estas: voz humana siempre gana."""
import asyncio
import json
import os
import subprocess

import edge_tts

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SALIDA = os.path.join(RAIZ, 'docs', 'anuncios', 'reales', 'spot-v3')
VOZ = 'es-ES-XimenaNeural'
FRASES = [
    "¿Repartes paquetes y todavía ordenas la ruta a mano?",
    "Con efe-de-ese, haces una foto a la etiqueta y la dirección entra sola.",
    "La app te ordena las paradas por tiempo y te lleva con voz hasta cada puerta.",
    "Gratis, sin tarjeta y sin límite hasta fin de año.",
    "Efe-de-ese, la app de reparto gratis. Pruébala hoy.",
]


def duracion(f):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f],
                         capture_output=True, text=True).stdout.strip()
    return round(float(out or 0), 2)


async def main():
    os.makedirs(SALIDA, exist_ok=True)
    salida = []
    for i, frase in enumerate(FRASES, 1):
        humana = os.path.join(SALIDA, f's{i}.mp3')
        destino = humana if os.path.exists(humana) else os.path.join(SALIDA, f'voz-{i}.mp3')
        if not os.path.exists(humana):
            await edge_tts.Communicate(frase, VOZ, rate='-3%', pitch='-2Hz').save(destino)
        salida.append({'n': i, 'texto': frase.replace('efe-de-ese', 'FDS').replace('Efe-de-ese', 'FDS'),
                       'fichero': os.path.basename(destino), 'dur': duracion(destino), 'humana': os.path.exists(humana)})
        print(i, salida[-1]['dur'], 's', '(humana)' if salida[-1]['humana'] else '')
    with open(os.path.join(SALIDA, 'voz.json'), 'w', encoding='utf-8') as fh:
        json.dump(salida, fh, ensure_ascii=False, indent=1)
    with open(os.path.join(SALIDA, 'guion.txt'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(f"{s['n']}. {s['texto']}" for s in salida) + '\n')


if __name__ == '__main__':
    asyncio.run(main())
