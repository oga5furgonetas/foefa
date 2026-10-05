# -*- coding: utf-8 -*-
"""La voz del sketch «¿Aún repartes a ojo?» (05-10-2026).

Dani: «con voz de persona normal, que no se note que es IA». Lo que se hace:
  · voz es-ES-XimenaNeural (la más natural de España en edge-tts), un poco más
    rápida y con el tono algo distinto en cada frase, como habla alguien de verdad;
  · después, en montar-sketch-repartidora.mjs, se trata como una grabación de
    móvil (sala pequeña, compresión, ruido de fondo muy bajo).
Lo 100 % natural es una persona leyendo guion.txt en una nota de voz: guardarla
como sketch/s1..s8.mp3 (una frase por fichero) y volver a montar.

    py -3 scripts/voz_sketch.py
"""
import asyncio
import io
import os

import edge_tts

DIR = os.path.join(os.path.dirname(__file__), "..", "docs", "anuncios", "reales", "sketch")
VOZ = os.environ.get("VOZ_SKETCH", "es-ES-XimenaNeural")
# (velocidad, tono) por frase: la pregunta del gancho más viva, los pasos más firmes.
AJUSTES = [("+8%", "+4Hz"), ("+4%", "-2Hz"), ("+4%", "-3Hz"), ("+6%", "+2Hz"),
           ("+10%", "+0Hz"), ("+8%", "+1Hz"), ("+8%", "+2Hz"), ("+6%", "+3Hz")]


async def main():
    lineas = [l.strip() for l in io.open(os.path.join(DIR, "guion.txt"), encoding="utf-8") if l.strip()]
    for i, texto in enumerate(lineas, 1):
        rate, pitch = AJUSTES[(i - 1) % len(AJUSTES)]
        await edge_tts.Communicate(texto, VOZ, rate=rate, pitch=pitch).save(os.path.join(DIR, f"s{i}.mp3"))
        print(f"s{i}.mp3")


asyncio.run(main())
