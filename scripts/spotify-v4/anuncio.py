# -*- coding: utf-8 -*-
"""Anuncio de Spotify v4 (26-10-2026): QUÉ BUSCAR y DÓNDE ENTRAR, coherente con la app.

Dani: «que sea coherente en Spotify para que sepan dónde tienen que entrar y qué deben buscar». La v3 decía
«una app» y «entra en flotadsp.com», pero quien oye «app» la busca en la tienda, y FDS todavía no está publicada
en Google Play (el 26-10 la ficha pública da 404: sigue en prueba cerrada). Dos versiones, con la voz que eligió
Dani (Puck) y la misma mezcla medida que la v3 (scripts/spot-v5/spotify.py):

  · ahora: «No la busques en la tienda: entra en flotadsp.com (deletreada). Ahí creas tu cuenta
    e instalas la app». Es lo que pasa de verdad: tras el alta, la web ofrece «Instala FDS en tu móvil»
    (en Android, la descarga; en iPhone, añadirla desde Safari).
  · play: para cuando la ficha de Play sea pública: «Búscala en Google Play: FDS. O entra en flotadsp.com».
    Sirve también al iPhone (FDS no está en la App Store: la web).

    GEMINI_API_KEY=… py -3 scripts/spotify-v4/anuncio.py [ahora|play ...]
      ->  docs/anuncios/spotify/v4/{v4-<v>.wav, fds-spotify-v4-<v>.mp3, mezcla-v4-<v>.json, guion-<v>.txt, oido-<v>.txt}

La web se escribe como se dice («flota de ese pe punto com») y FDS letra a letra («efe, de, ese»): así lo lee bien
Gemini (gotchas en scripts/spot-v5/voz_gemini.py). Al final, Whisper transcribe el MP3 SIN el guion (oido-<v>.txt):
si no oye la web o lo que hay que hacer, el script lo dice."""
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(AQUI), 'spot-v5'))
import spotify  # noqa: E402
from alinear import leer_audio  # noqa: E402
from voz_gemini import duracion, tts  # noqa: E402

RAIZ = os.path.dirname(os.path.dirname(AQUI))
SP = os.path.join(RAIZ, 'docs', 'anuncios', 'spotify', 'v4')
VOZ = 'Puck'

COMUN = ("Oye, repartidor. Esto es para ti: efe, de, ese. "
         "La app gratis que te ordena la ruta sola. Le haces una foto a la etiqueta, y te lleva con voz hasta cada puerta. "
         "Sin tarjeta, y sin límite hasta fin de año. ")
GUIONES = {
    # Con «Creas tu cuenta en un minuto, y desde ahí instalas la app» salía de 30,4 s (Spotify: 30 como máximo).
    'ahora': COMUN + ("No la busques en la tienda: entra en flota de ese pe punto com. "
                      "Te lo repito: flota, de, ese, pe, punto com. "
                      "Ahí creas tu cuenta, e instalas la app. O toca este anuncio."),
    'play': COMUN + ("Búscala en Google Play: efe, de, ese. "
                     "O entra en flota de ese pe punto com: flota, de, ese, pe, punto com. "
                     "O toca este anuncio, y en un minuto tienes tu cuenta."),
}
# Antes de la llamada a la acción, 0,6 s de pausa (spotify.pausas_objetivo).
LLAMADA = ('No', 'Búscala')
# Lo que tiene que entenderse sí o sí al oírlo (en la transcripción de Whisper, sin el guion).
DEBE_OIRSE = {
    'ahora': [r'flota\s*(de\s*)?(ese|s)\s*(pe|p)|flotadsp', r'punto\s*com|\.com', r'tienda', r'cuenta', r'instal'],
    'play': [r'google\s*play', r'flota\s*(de\s*)?(ese|s)\s*(pe|p)|flotadsp', r'punto\s*com|\.com'],
}


def visto(t):
    return (t.replace('efe, de, ese', 'FDS').replace('flota de ese pe punto com', 'flotadsp.com')
            .replace('flota, de, ese, pe, punto com', 'F-L-O-T-A-D-S-P punto com'))


def oido(mp3):
    from faster_whisper import WhisperModel
    modelo = WhisperModel('small', device='cpu', compute_type='int8')
    segs, _ = modelo.transcribe(leer_audio(mp3), language='es', beam_size=5)   # sin initial_prompt: oído «limpio»
    return ' '.join(s.text.strip() for s in segs)


def una(v):
    os.makedirs(SP, exist_ok=True)
    texto = GUIONES[v]
    nombre = f'v4-{v}'
    wav = os.path.join(SP, f'{nombre}.wav')
    if not os.path.exists(wav):
        open(wav, 'wb').write(tts(texto, VOZ))
    print(f'{v}: locución {duracion(wav):.2f} s · {len(texto.split())} palabras leídas')
    with open(os.path.join(SP, f'guion-{v}.txt'), 'w', encoding='utf-8') as fh:
        fh.write(visto(texto) + '\n')
    spotify.una(VOZ, sp=SP, texto=texto, nombre=nombre, llamada=LLAMADA)
    mp3 = os.path.join(SP, f'fds-spotify-{nombre}.mp3')
    t = oido(mp3)
    with open(os.path.join(SP, f'oido-{v}.txt'), 'w', encoding='utf-8') as fh:
        fh.write(t + '\n')
    faltan = [p for p in DEBE_OIRSE[v] if not re.search(p, t, re.I)]
    print(f'   Whisper (sin guion): «{t}»')
    print('   se entiende lo que hay que hacer' if not faltan else f'   OJO, no se oye claro: {faltan}')
    return not faltan


if __name__ == '__main__':
    ok = all([una(v) for v in (sys.argv[1:] or ['ahora', 'play'])])
    sys.exit(0 if ok else 1)
