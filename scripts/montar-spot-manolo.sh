#!/usr/bin/env bash
# Monta «¿Y Manolo?» (docs/anuncios/historia/GUION.md), segunda versión: una sola protagonista (Lucía), voz en off,
# la app real dentro del plano, música y los planos igualados de color.
# Uso: bash scripts/montar-spot-manolo.sh   (necesita ffmpeg y la fuente Inter)
set -euo pipefail
cd "$(dirname "$0")/.."
H=docs/anuncios/historia; P=$H/planos; R=docs/anuncios/super-anuncio
APP=$R/salida/spot-ruta-9x16-B.mp4
F=/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
ff() { ffmpeg -v error -y "$@"; }
COD=(-an -c:v libx264 -preset medium -crf 15 -pix_fmt yuv420p -r 30)
# El mismo acabado en todos los planos: un punto de contraste, viñeta y grano fino.
LOOK="eq=contrast=1.05:saturation=0.96,vignette=PI/5.5,noise=alls=5:allf=t,fps=30,format=yuv420p,setsar=1"
# Subtítulo: blanco con contorno, centrado, hasta dos líneas (el texto va en fichero).
sub() { printf '%b' "$2" > "$T/$1.txt"; echo "drawtext=fontfile=$F:textfile=$T/$1.txt:fontsize=${3:-60}:fontcolor=white:borderw=7:bordercolor=black@0.78:shadowcolor=black@0.5:shadowx=0:shadowy=4:line_spacing=10:text_align=C:x=(w-text_w)/2:y=${4:-1400}"; }

# 1 · La nave (4,1 s)
ff -t 4.1 -i $P/5-nave.mp4 -vf "scale=1080:1920,$LOOK,$(sub s1 'Segunda semana en la nave.\nY hoy me dan la zona de Manolo.' 52):enable='gte(t,0.15)'" "${COD[@]}" "$T/1.mp4"

# 2 · La libreta (1,9 s)
ff -ss 0.3 -t 1.9 -i $P/6-libreta.mp4 -vf "scale=1080:1920,$LOOK,$(sub s2 'La que solo se sabe Manolo.' 58)" "${COD[@]}" "$T/2.mp4"

# 3 · Lucía escanea (1,3 s) y la app real encima de su plano, desenfocado (3,0 s)
ff -ss 0.2 -t 1.3 -i $P/7-escaneo.mp4 -vf "scale=1080:1920,$LOOK,$(sub s3 'Escaneo los paquetes…' 58)" "${COD[@]}" "$T/3.mp4"
ff -ss 3.2 -t 1.8 -i $APP -an -c:v libx264 -crf 14 -r 30 "$T/a1.mp4"
ff -ss 9.3 -t 1.2 -i $APP -an -c:v libx264 -crf 14 -r 30 "$T/a2.mp4"
ff -ss 1.0 -t 3.0 -i $P/7-escaneo.mp4 -i "$T/a1.mp4" -i "$T/a2.mp4" -loop 1 -framerate 30 -t 3.0 -i $R/capas/marco-fondo.png \
  -filter_complex "[0:v]scale=1080:1920,boxblur=24:2,eq=brightness=-0.22:saturation=0.8,fps=30[bg];
    [1:v][2:v]concat=n=2:v=1:a=0,fps=30,format=rgba[app];[3:v]format=rgba,alphaextract[m];[app][m]alphamerge[panel];
    [bg][panel]overlay=x=0:y='-150+max(0,(0.3-t))*1400',format=yuv420p,noise=alls=4:allf=t,$(sub s3b '…y la ruta se ordena sola.' 58 1730):enable='gte(t,1.5)'[v]" \
  -map "[v]" -t 3.0 "${COD[@]}" "$T/4.mp4"

# 4 · La señora (1,8 s). Viene con bandas negras: se recorta y se llena el cuadro.
ff -ss 1.3 -t 1.8 -i $P/2-senora.mp4 -vf "crop=1080:1620:0:150,scale=1280:1920,crop=1080:1920,$LOOK,$(sub s4 'En cada puerta,\nla misma pregunta:' 58)" "${COD[@]}" "$T/5.mp4"

# 5 · El perro (1,9 s), templado para que no desentone con el resto
ff -ss 1.5 -t 1.9 -i $P/3-perro.mp4 -vf "scale=1080:1920,colortemperature=temperature=5200,eq=saturation=0.88,$LOOK,$(sub s5 '¿Y Manolo?' 78)" "${COD[@]}" "$T/6.mp4"

# 6 · Lucía cierra la furgoneta y llama (4,4 s); al final entra el lema
ff -t 4.4 -i $P/4-lucia.mp4 -loop 1 -framerate 30 -t 4.4 -i $R/capas/manana.png \
  -filter_complex "[0:v]crop=1080:1584:0:168,scale=1310:1920,crop=1080:1920,$LOOK,$(sub s6 'Manolo… ya he acabado.' 58 1180):enable='between(t,1.9,3.5)'[b];
    [1:v]format=rgba,fade=t=in:st=3.6:d=0.25:alpha=1[m];[b][m]overlay=0:0:enable='gte(t,3.6)',format=yuv420p[v]" \
  -map "[v]" -t 4.4 "${COD[@]}" "$T/7.mp4"

# 7 · Tarjeta de cierre (3,2 s)
ff -f lavfi -t 3.2 -i "color=c=0x06161c:s=1080x1920:r=30" -loop 1 -framerate 30 -t 3.2 -i $R/capas/cierre-B.png \
  -filter_complex "[0:v][1:v]overlay=0:0,fade=t=in:st=0:d=0.2,format=yuv420p[v]" -map "[v]" -t 3.2 "${COD[@]}" "$T/8.mp4"

for n in 1 2 3 4 5 6 7 8; do echo "file '$T/$n.mp4'"; done > "$T/lista.txt"
ff -f concat -safe 0 -i "$T/lista.txt" -c copy "$T/video.mp4"
DUR=21.6

# Sonido: voz en off (Lucía y la marca), música por debajo, bips del escáner, el ladrido y la puerta de la furgoneta.
ff -f lavfi -i "sine=frequency=1900:sample_rate=48000:duration=0.09" -af "afade=t=out:st=0.06:d=0.03,volume=0.45" "$T/bip.wav"
A="aresample=48000,aformat=channel_layouts=stereo"
ff -i $H/voz/l1.mp3 -i $H/voz/l2.mp3 -i $H/voz/l3.mp3 -i $H/voz/l4.mp3 -i $H/voz/l5.mp3 -i $H/voz/l6.mp3 \
  -i $H/musica-lyria.mp3 -i "$T/bip.wav" -i "$T/bip.wav" -i "$T/bip.wav" \
  -ss 1.5 -t 1.9 -i $P/3-perro.mp4 -t 1.7 -i $P/4-lucia.mp4 \
  -filter_complex "
  [0:a]$A,adelay=150:all=1[v1];[1:a]$A,adelay=4250:all=1[v2];[2:a]$A,adelay=6100:all=1[v3];
  [3:a]$A,adelay=10400:all=1[v4];[4:a]$A,adelay=16000:all=1[v5];[5:a]$A,adelay=17700:all=1[v6];
  [v1][v2][v3][v4][v5][v6]amix=inputs=6:normalize=0,loudnorm=I=-15:TP=-2:LRA=9,$A,asplit[voz][llave];
  [6:a]$A,atrim=duration=$DUR,volume=-11dB,afade=t=in:d=0.3,afade=t=out:st=20.2:d=1.4[mus0];
  [mus0][llave]sidechaincompress=threshold=0.03:ratio=5:attack=20:release=350[mus];
  [7:a]$A,adelay=7650:all=1[b1];[8:a]$A,adelay=8150:all=1[b2];[9:a]$A,adelay=8650:all=1[b3];
  [10:a]$A,volume=-7dB,afade=t=in:d=0.05,afade=t=out:st=1.7:d=0.2,adelay=12100:all=1[perro];
  [11:a]$A,volume=-9dB,afade=t=in:d=0.05,afade=t=out:st=1.4:d=0.3,adelay=14000:all=1[puerta];
  [voz][mus][b1][b2][b3][perro][puerta]amix=inputs=7:normalize=0:duration=longest,atrim=duration=$DUR,alimiter=limit=0.9[a]" \
  -map "[a]" -ar 48000 -ac 2 "$T/audio.wav"

ff -i "$T/video.mp4" -i "$T/audio.wav" -t $DUR -c:v libx264 -preset medium -crf 25 -maxrate 9M -bufsize 18M -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart $H/salida/spot-manolo-9x16.mp4
echo "$H/salida/spot-manolo-9x16.mp4"
