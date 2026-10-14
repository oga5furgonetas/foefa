"""Locución del spot v2 (14-10-2026) con la voz neuronal de Microsoft (edge-tts; `py -3 -m pip install -U edge-tts`
cuando dé 403: con la 7.2.8 falló y al actualizar volvió a funcionar).
  py -3 scripts/spot-v2/voz.py  ->  docs/anuncios/reales/spot-v2/vo1..N.mp3 + voz.json (duraciones)"""
import asyncio
import json
import os
import subprocess

import edge_tts

VOZ = 'es-ES-AlvaroNeural'
FRASES = [
    'Sesenta paquetes. Y la ruta… a ojo.',
    'Cada minuto ordenando es un minuto sin repartir.',
    'Foto a la etiqueta, y la dirección entra sola.',
    'La ruta se ordena sola, con el tráfico de cada hora.',
    'Y te guía por voz hasta cada puerta.',
    'Y sabes cuánto has ganado hoy.',
    'Gratis y sin límite hasta fin de año. Sin tarjeta.',
    'Y hasta el treinta y uno de octubre, diez euros por cada compañero que invites.',
    'FDS. Pruébala ya en flotadsp punto com.',
]
raiz = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'docs', 'anuncios', 'reales', 'spot-v2')
os.makedirs(raiz, exist_ok=True)


def duracion(f):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True)
    return float(out.stdout.strip() or 0)


async def main():
    datos = []
    for i, frase in enumerate(FRASES, 1):
        destino = os.path.join(raiz, f'vo{i}.mp3')
        await edge_tts.Communicate(frase, VOZ, rate='-2%', pitch='-2Hz').save(destino)
        datos.append({'n': i, 'texto': frase, 'fichero': os.path.basename(destino), 'dur': round(duracion(destino), 2)})
        print(i, round(datos[-1]['dur'], 2), frase)
    with open(os.path.join(raiz, 'voz.json'), 'w', encoding='utf-8') as f:
        json.dump(datos, f, ensure_ascii=False, indent=1)

asyncio.run(main())
