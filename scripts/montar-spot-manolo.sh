#!/usr/bin/env bash
# Monta el corte corto de «¿Y Manolo?» (docs/anuncios/historia/GUION.md): cuatro planos de IA (Artlist, Veo 3.1 Fast,
# con su propio sonido), la app real sacada de «La ruta hecha» y la tarjeta de cierre.
# Uso: bash scripts/montar-spot-manolo.sh   (necesita ffmpeg y la fuente Inter)
set -euo pipefail
cd "$(dirname "$0")/.."
H=docs/anuncios/historia; P=$H/planos; R=docs/anuncios/super-anuncio
APP=$R/salida/spot-ruta-9x16-B.mp4
F=/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
SUB="fontfile=$F:fontcolor=white:box=1:boxcolor=black@0.62:boxborderw=22:x=(w-text_w)/2"
V="fps=30,format=yuv420p,setsar=1"
A="aresample=48000,aformat=channel_layouts=stereo"
COD=(-c:v libx264 -preset medium -crf 16 -pix_fmt yuv420p -r 30 -c:a pcm_s16le -ar 48000 -ac 2)
ff() { ffmpeg -v error -y "$@"; }

# Los textos van en ficheros: así drawtext no tropieza con comas, puntos ni signos.
printf 'Lucía. Hoy llevas la zona de Manolo.' > "$T/t1.txt"
printf '¿Y Manolo?' > "$T/t2.txt"
printf 'Manolo… ya he acabado.' > "$T/t3.txt"

# 1 · El encargado (3,4 s)
ff -ss 0 -t 3.4 -i $P/1-encargado.mp4 \
  -vf "scale=1080:1920,$V,drawtext=$SUB:fontsize=50:y=1500:textfile=$T/t1.txt" \
  -af "$A,afade=t=out:st=3.3:d=0.1" "${COD[@]}" "$T/1.mov"

# 2 · La app real: escanear (2,2 s) y la ruta ordenada (1,2 s), con tres bips
ff -ss 3.2 -t 2.2 -i $APP -an -vf "scale=1080:1920,$V" -c:v libx264 -crf 16 -pix_fmt yuv420p -r 30 "$T/2a.mp4"
ff -ss 9.3 -t 1.2 -i $APP -an -vf "scale=1080:1920,$V" -c:v libx264 -crf 16 -pix_fmt yuv420p -r 30 "$T/2b.mp4"
ff -f lavfi -i "sine=frequency=1900:sample_rate=48000:duration=0.09" \
  -af "afade=t=out:st=0.06:d=0.03,volume=0.5,$A" "$T/bip.wav"
ff -f lavfi -t 3.4 -i "anullsrc=r=48000:cl=stereo" -i "$T/bip.wav" -i "$T/bip.wav" -i "$T/bip.wav" \
  -filter_complex "[1:a]adelay=350:all=1[a];[2:a]adelay=900:all=1[b];[3:a]adelay=1450:all=1[c];[0:a][a][b][c]amix=inputs=4:normalize=0:duration=first" \
  "$T/bips.wav"
ff -i "$T/2a.mp4" -i "$T/2b.mp4" -i "$T/bips.wav" \
  -filter_complex "[0:v][1:v]concat=n=2:v=1:a=0[v]" -map "[v]" -map 2:a "${COD[@]}" "$T/2.mov"

# 3 · La señora (1,8 s). El plano viene con bandas negras: se recorta y se llena el cuadro.
ff -ss 1.3 -t 1.8 -i $P/2-senora.mp4 \
  -vf "crop=1080:1620:0:150,scale=1280:1920,crop=1080:1920,$V,drawtext=$SUB:fontsize=58:y=1500:textfile=$T/t2.txt:enable='gte(t,0.4)'" \
  -af "$A,afade=t=in:d=0.05,afade=t=out:st=1.7:d=0.1" "${COD[@]}" "$T/3.mov"

# 4 · El perro (1,9 s)
ff -ss 1.5 -t 1.9 -i $P/3-perro.mp4 \
  -vf "scale=1080:1920,$V,drawtext=$SUB:fontsize=58:y=1500:textfile=$T/t2.txt:enable='gte(t,0.5)'" \
  -af "$A,afade=t=in:d=0.05,afade=t=out:st=1.8:d=0.1" "${COD[@]}" "$T/4.mov"

# 5 · Lucía (4,0 s), con «Mañana sales con la ruta hecha» encima al final
ff -ss 0.6 -t 4.0 -i $P/4-lucia.mp4 -loop 1 -framerate 30 -t 4.0 -i $R/capas/manana.png \
  -filter_complex "[0:v]crop=1080:1584:0:168,scale=1310:1920,crop=1080:1920,$V,drawtext=$SUB:fontsize=58:y=1180:textfile=$T/t3.txt:enable='between(t,1.3,3.1)'[b];[1:v]format=rgba,fade=t=in:st=3.1:d=0.25:alpha=1[m];[b][m]overlay=0:0:enable='gte(t,3.1)',format=yuv420p[v];[0:a]$A,afade=t=in:d=0.05,afade=t=out:st=3.4:d=0.6[a]" \
  -map "[v]" -map "[a]" -t 4.0 "${COD[@]}" "$T/5.mov"

# 6 · La tarjeta de cierre (2,4 s)
ff -f lavfi -t 2.4 -i "color=c=0x06161c:s=1080x1920:r=30" -loop 1 -framerate 30 -t 2.4 -i $R/capas/cierre-B.png \
  -f lavfi -t 2.4 -i "anullsrc=r=48000:cl=stereo" \
  -filter_complex "[0:v][1:v]overlay=0:0,format=yuv420p[v]" -map "[v]" -map 2:a -t 2.4 "${COD[@]}" "$T/6.mov"

# Todo seguido, con el sonido a nivel de redes
for n in 1 2 3 4 5 6; do echo "file '$T/$n.mov'"; done > "$T/lista.txt"
ff -f concat -safe 0 -i "$T/lista.txt" -af "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000" \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart \
  $H/salida/spot-manolo-9x16.mp4
echo "$H/salida/spot-manolo-9x16.mp4"
