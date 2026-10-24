# -*- coding: utf-8 -*-
"""Anuncio de Spotify v3 (24-10-2026): la locución de Gemini (voz_gemini.py --spotify) con música debajo,
mezclado con niveles MEDIDOS, como el spot v5.

    py -3 scripts/spot-v5/spotify.py [voz ...]
      ->  docs/anuncios/spotify/v3/fds-spotify-v3-<voz>.mp3 + mezcla-<voz>.json

1. Pausas: Achird y Puck leen deprisa (unos 19 s), y la web deletreada se pisa con lo anterior. Se alargan
   SOLO los silencios entre frases (nunca se estira la voz, que suena a cinta): mínimo 0,42 s tras un punto,
   0,32 s tras dos puntos, 0,6 s antes de «Entra en…» (la llamada) y nada por encima de 0,75 s. Dónde está
   cada frase lo dice faster-whisper (tiempos reales de cada palabra), no una estimación.
2. Niveles: voz a -16 LUFS; música a -22 LUFS que baja sola cuando habla la voz (sidechain, igual que el
   vídeo); máster a -16 LUFS integrados con el pico real a -2,5 dBTP (dos pasadas de loudnorm, lineal). Se
   comprueba cuántos LU queda la música por debajo de la voz mientras habla.
3. Lo que pide Spotify (ads.spotify.com, «audio ads specs» y la guía de anuncios, leídas el 24-10-2026):
   -16 LUFS ±1,5; pico real ≤ -2,0 dBTP; 0,5 s de silencio al principio y al final; MP3 a 44,1 kHz,
   estéreo, 192-320 kbps; 30 s como máximo; ≤ 65 palabras. Se sale a 192 kbps (alguna guía de terceros habla
   de 1 MB como tope en Ad Studio; así ocupa ~0,7 MB) y el script PARA si el MP3 final no cumple."""
import json
import os
import re
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from alinear import leer_audio, norma  # noqa: E402
from voz_gemini import SPOTIFY  # noqa: E402

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SP = os.path.join(RAIZ, 'docs', 'anuncios', 'spotify', 'v3')
MUSICA = os.path.join(RAIZ, 'docs', 'anuncios', 'reales', 'spot-v4', 'musica.wav')
SR = 24000
SILENCIO, ANTES, COLA, MAXIMO = 0.5, 0.4, 1.4, 30.0


def ff(args, cwd=None):
    # Los WAV intermedios van en coma flotante: al sumar voz y música no se recorta nada antes del máster.
    a = []
    for k, x in enumerate(args):
        if x.endswith('.wav') and (k == 0 or args[k - 1] != '-i'):
            a += ['-c:a', 'pcm_f32le']
        a.append(x)
    args = a
    r = subprocess.run(['ffmpeg', '-y', '-hide_banner', *args], capture_output=True, text=True, cwd=cwd,
                       encoding='utf-8', errors='replace')
    if r.returncode:
        raise SystemExit(r.stderr[-1500:])
    return r.stderr


def medir(f, extra=''):
    err = ff(['-i', f, '-af', f'{extra}ebur128=peak=true:framelog=quiet', '-f', 'null', '-'])
    i = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', err)[-1])
    pico = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', err)[-1])
    return i, pico


def momentanea(f):
    """Sonoridad momentánea (400 ms) cada 100 ms."""
    err = ff(['-i', f, '-af', 'ebur128=metadata=1,ametadata=print:key=lavfi.r128.M', '-f', 'null', '-'])
    t = [float(x) for x in re.findall(r'pts_time:([\d.]+)', err)]
    m = [float(x) for x in re.findall(r'lavfi\.r128\.M=(-?[\d.]+|-inf)', err)]
    return np.array(t[:len(m)]), np.array(m[:len(t)])


def palabras_oidas(wav):
    from faster_whisper import WhisperModel
    modelo = WhisperModel('small', device='cpu', compute_type='int8')
    segs, _ = modelo.transcribe(leer_audio(wav), language='es', word_timestamps=True, beam_size=5,
                                initial_prompt=SPOTIFY)
    return [w for s in segs for w in s.words]


def pausas_objetivo(voz_wav):
    """[(inicio_silencio, fin_silencio, objetivo)] de cada frontera de frase."""
    import difflib
    guion = SPOTIFY.split()
    oidas = palabras_oidas(voz_wav)
    casa = {}
    for blk in difflib.SequenceMatcher(None, [norma(w) for w in guion], [norma(w.word) for w in oidas],
                                       autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            casa[blk.a + k] = oidas[blk.b + k]
    err = ff(['-i', voz_wav, '-af', 'silencedetect=noise=-42dB:d=0.06', '-f', 'null', '-'])
    sil = list(zip([float(x) for x in re.findall(r'silence_start: ([\d.]+)', err)],
                   [float(x) for x in re.findall(r'silence_end: ([\d.]+)', err)]))
    fronteras = []
    for i, w in enumerate(guion[:-1]):
        if not re.search(r'[.:?!]$', w):
            continue
        objetivo = 0.42 if w.endswith('.') else 0.32
        if guion[i + 1] == 'Entra':
            objetivo = 0.6
        # El silencio de la frontera: el que acaba justo antes de la palabra siguiente (si whisper la casó) o
        # el que empieza justo después de esta.
        if i + 1 in casa:
            ref = casa[i + 1].start
            cand = [s for s in sil if abs(s[1] - ref) < 0.3]
        elif i in casa:
            ref = casa[i].end
            cand = [s for s in sil if abs(s[0] - ref) < 0.3]
        else:
            cand = []
        if not cand:
            print(f'   (sin silencio claro tras «{w}»: se deja como está)')
            continue
        s = min(cand, key=lambda x: abs((x[1] if i + 1 in casa else x[0]) - ref))
        fronteras.append((s[0], s[1], objetivo, w))
    return fronteras, oidas


def con_pausas(voz_wav, destino):
    x = leer_audio_24k(voz_wav)
    fronteras, _ = pausas_objetivo(voz_wav)
    trozos, pos, cambios = [], 0, []
    for a, b, obj, w in fronteras:
        dur = b - a
        nuevo = min(max(dur, obj), 0.75)
        medio = int((a + b) / 2 * SR)
        trozos.append(x[pos:medio])
        delta = int((nuevo - dur) * SR)
        if delta > 0:
            trozos.append(np.zeros(delta, dtype=np.float32))
            pos = medio
        else:
            pos = medio - delta  # se quita del centro del silencio
        cambios.append(f'«{w}» {dur:.2f}→{nuevo:.2f}')
    trozos.append(x[pos:])
    y = np.concatenate(trozos)
    (y * 32767).clip(-32768, 32767).astype('<i2').tofile(destino + '.raw')
    ff(['-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', destino + '.raw', destino])
    os.remove(destino + '.raw')
    print('   pausas:', ' · '.join(cambios))


def leer_audio_24k(wav):
    crudo = subprocess.run(['ffmpeg', '-v', 'error', '-i', wav, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                           capture_output=True, check=True).stdout
    return np.frombuffer(crudo, dtype=np.float32)


def recortar_bordes(wav, destino):
    """Quita el silencio de delante y de detrás (deja 40 ms)."""
    ff(['-i', wav, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04,'
        'areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04,areverse', destino])


def una(voz):
    tmp = os.path.join(SP, f'_tmp_{voz}')
    os.makedirs(tmp, exist_ok=True)
    print(f'== {voz}')
    crudo = os.path.join(SP, f'{voz}.wav')
    recortada = os.path.join(tmp, 'recortada.wav')
    recortar_bordes(crudo, recortada)
    pausada = os.path.join(tmp, 'pausada.wav')
    con_pausas(recortada, pausada)
    dv = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', pausada],
                              capture_output=True, text=True).stdout)
    total = ANTES + dv + COLA
    if total + 2 * SILENCIO > MAXIMO:
        raise SystemExit(f'{voz}: {total + 2 * SILENCIO:.1f} s, pasa de {MAXIMO} s')
    # Voz a -16 LUFS y música a -22 LUFS, por ganancia medida (lineal: no cambia la dinámica).
    iv, _ = medir(pausada)
    im, _ = medir(MUSICA, f'atrim=0:{total},')
    gv, gm = -16 - iv, -22 - im
    voz_ok = os.path.join(tmp, 'voz.wav')
    ff(['-i', pausada, '-af', f'aresample=44100,volume={gv:.2f}dB,adelay={int(ANTES * 1000)}:all=1,apad=whole_dur={total}',
        '-ac', '2', voz_ok])
    mus = os.path.join(tmp, 'musica.wav')
    ff(['-i', MUSICA, '-af', f'atrim=0:{total},asetpts=PTS-STARTPTS,aresample=44100,volume={gm:.2f}dB,'
        f'afade=t=in:d=0.25,afade=t=out:st={total - 1.4:.2f}:d=1.4', '-ac', '2', mus])
    # La música baja cuando habla la voz (mismos ajustes que el vídeo).
    mezcla = os.path.join(tmp, 'mezcla.wav')
    musica_bajo = os.path.join(tmp, 'musica-bajo.wav')
    ff(['-i', voz_ok, '-i', mus, '-filter_complex',
        '[0:a]asplit=2[v1][v2];[1:a][v1]sidechaincompress=threshold=0.05:ratio=2.2:attack=40:release=500[m];'
        '[m]asplit=2[m1][m2];[v2][m1]amix=inputs=2:normalize=0:duration=first[out]',
        '-map', '[out]', mezcla, '-map', '[m2]', musica_bajo])
    # Máster: loudnorm lineal en dos pasadas a -16 LUFS / -1 dBTP.
    err = ff(['-i', mezcla, '-af', 'loudnorm=I=-16:TP=-2.5:LRA=11:print_format=json', '-f', 'null', '-'])
    j = json.loads(err[err.rindex('{'):err.rindex('}') + 1])
    ln = (f"loudnorm=I=-16:TP=-2.5:LRA=11:linear=true:measured_I={j['input_i']}:measured_TP={j['input_tp']}:"
          f"measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}")
    master = os.path.join(tmp, 'master.wav')
    # Medio segundo de silencio delante y detrás, como pide Spotify.
    ms = int(SILENCIO * 1000)
    ff(['-i', mezcla, '-af', ln + f',aresample=44100,adelay={ms}:all=1,apad=pad_dur={SILENCIO}', master])
    destino = os.path.join(SP, f'fds-spotify-v3-{voz.lower()}.mp3')
    ff(['-i', master, '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100', '-ac', '2', destino])
    # Comprobación: misma ganancia de máster a cada pista para comparar.
    i_m, pico = medir(destino)
    gmaster = i_m - medir(mezcla)[0]
    tv, mv = momentanea(voz_ok)
    tm, mm = momentanea(musica_bajo)
    habla = mv > -30
    n = min(len(mv), len(mm))
    voz_lu = float(np.median(mv[:n][habla[:n]])) + gmaster
    mus_lu = float(np.median(mm[:n][habla[:n] & np.isfinite(mm[:n])])) + gmaster
    mus_sola = float(np.median(mm[:n][(~habla[:n]) & (mm[:n] > -60)])) + gmaster if ((~habla[:n]) & (mm[:n] > -60)).any() else None
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', destino],
                               capture_output=True, text=True).stdout)
    fallos = [m for m, mal in [(f'{i_m} LUFS fuera de -16±1,5', abs(i_m + 16) > 1.5),
                               (f'pico {pico} dBTP por encima de -2', pico > -2.0),
                               (f'{dur:.2f} s, más de 30', dur > MAXIMO + 0.05)] if mal]
    if fallos:
        raise SystemExit(f'{voz}: no cumple lo de Spotify: ' + '; '.join(fallos))
    r = {'voz': voz, 'duracion': round(dur, 2), 'master_lufs': i_m, 'pico_dbtp': pico,
         'voz_momentanea_mediana': round(voz_lu, 1), 'musica_bajo_voz': round(mus_lu, 1),
         'musica_lu_por_debajo': round(voz_lu - mus_lu, 1), 'musica_sola': mus_sola and round(mus_sola, 1),
         'mb': round(os.path.getsize(destino) / 1e6, 2)}
    json.dump(r, open(os.path.join(SP, f'mezcla-{voz}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"   {dur:.1f} s · máster {i_m} LUFS, pico {pico} dBTP · voz {voz_lu:.1f} · música bajo la voz "
          f"{mus_lu:.1f} ({voz_lu - mus_lu:.1f} LU por debajo) · música sola {r['musica_sola']} · {r['mb']} MB")
    for f in os.listdir(tmp):
        os.remove(os.path.join(tmp, f))
    os.rmdir(tmp)


if __name__ == '__main__':
    for v in [a for a in sys.argv[1:] if not a.startswith('--')] or ['Achird', 'Puck', 'Laomedeia']:
        una(v)
