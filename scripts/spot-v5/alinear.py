# -*- coding: utf-8 -*-
"""Tiempos REALES de cada palabra de la locución del spot v5 (24-10-2026), para que los subtítulos entren
justo cuando suena la palabra. Gemini TTS no da tiempos y el reparto por sílabas de voz_gemini.py se puede ir
un par de décimas; aquí se escucha cada frase con faster-whisper (modelo «small», en el propio PC) y se
casan sus palabras con las del guion.

    py -3 scripts/spot-v5/alinear.py [voz ...]   ->  reescribe docs/anuncios/reales/spot-v5/voces/<voz>/voz.json

Cada palabra del guion toma el tiempo de la palabra que oyó whisper; si alguna no casa (whisper la oyó
distinta), se interpola entre las vecinas. Se guarda cuánto se desviaba el reparto por sílabas."""
import difflib
import json
import os
import re
import subprocess
import sys
import unicodedata

import numpy as np
from faster_whisper import WhisperModel

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
V5 = os.path.join(RAIZ, 'docs', 'anuncios', 'reales', 'spot-v5')


def norma(w):
    w = unicodedata.normalize('NFD', w.lower())
    return re.sub(r'[^a-z0-9ñ]', '', ''.join(c for c in w if unicodedata.category(c) != 'Mn'))


def leer_audio(wav):
    # El audio se decodifica con ffmpeg (16 kHz mono): el PyAV que trae faster-whisper 1.2.1 choca con la
    # versión de av instalada («metadata_errors»).
    crudo = subprocess.run(['ffmpeg', '-v', 'error', '-i', wav, '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'],
                           capture_output=True, check=True).stdout
    return np.frombuffer(crudo, dtype=np.float32)


def alinear(modelo, wav, leido):
    segs, _ = modelo.transcribe(leer_audio(wav), language='es', word_timestamps=True, beam_size=5,
                                initial_prompt=leido, vad_filter=False)
    oidas = [w for s in segs for w in s.words]
    guion = leido.split()
    a = [norma(w) for w in guion]
    b = [norma(w.word) for w in oidas]
    tiempos = [None] * len(guion)
    for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            w = oidas[blk.b + k]
            tiempos[blk.a + k] = (w.start, w.end)
    casadas = sum(t is not None for t in tiempos)
    # Interpola las que no casaron entre la anterior y la siguiente conocidas.
    for i, t in enumerate(tiempos):
        if t is None:
            prev = next((tiempos[j][1] for j in range(i - 1, -1, -1) if tiempos[j]), 0.0)
            sig_j = next((j for j in range(i + 1, len(guion)) if tiempos[j]), None)
            sig = tiempos[sig_j][0] if sig_j is not None else prev + 0.3
            huecos = (sig_j if sig_j is not None else len(guion)) - i + 1
            paso = (sig - prev) / huecos
            tiempos[i] = (prev + paso * 0.1, prev + paso)
    return [{'p': w, 'ini': round(t[0], 3), 'fin': round(t[1], 3)} for w, t in zip(guion, tiempos)], casadas, ' '.join(w.word.strip() for w in oidas)


def main():
    voces = [a for a in sys.argv[1:] if not a.startswith('--')] or ['Achird', 'Puck', 'Laomedeia']
    modelo = WhisperModel('small', device='cpu', compute_type='int8')
    for voz in voces:
        f = os.path.join(V5, 'voces', voz, 'voz.json')
        d = json.load(open(f, encoding='utf-8'))
        for fr in d['frases']:
            wav = os.path.join(V5, fr['fichero'])
            nuevas, casadas, oido = alinear(modelo, wav, fr['leido'])
            viejas = fr.get('palabras_silabas') or fr['palabras']
            desv = [abs(n['ini'] - v['ini']) for n, v in zip(nuevas, viejas)]
            fr['palabras_silabas'] = viejas
            fr['palabras'] = nuevas
            fr['alineado'] = {'modelo': 'faster-whisper small', 'casadas': casadas, 'de': len(nuevas),
                              'desvio_silabas_medio': round(sum(desv) / len(desv), 3),
                              'desvio_silabas_max': round(max(desv), 3), 'oido': oido}
            print(f"{voz:10s} f{fr['n']} casadas {casadas}/{len(nuevas)} · el reparto por sílabas se iba "
                  f"{fr['alineado']['desvio_silabas_medio']:.2f} s de media, {fr['alineado']['desvio_silabas_max']:.2f} máx · oído: {oido}")
        json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
