#!/usr/bin/env bash
# Monta «Where's Tony?», la versión en inglés de «¿Y Manolo?» (docs/anuncios/historia/GUION.md): los mismos planos de
# Lucía, voz en off en inglés (Artlist, Eleven v3), la app grabada en inglés dentro de un móvil, y el lema y la tarjeta
# en inglés. Uso: bash scripts/montar-spot-manolo-en.sh   (necesita ffmpeg y la fuente Inter)
set -euo pipefail
cd "$(dirname "$0")/.."
H=docs/anuncios/historia; P=$H/planos; C=docs/anuncios/internacional/capas/en; VZ=$H/voz-en
F=/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
ff() { ffmpeg -v error -y "$@"; }
COD=(-an -c:v libx264 -preset medium -crf 15 -pix_fmt yuv420p -r 30)
LOOK="eq=contrast=1.05:saturation=0.96,vignette=PI/5.5,noise=alls=4:allf=t,fps=30,format=yuv420p,setsar=1"
sub() { printf '%b' "$2" > "$T/$1.txt"; echo "drawtext=fontfile=$F:textfile=$T/$1.txt:fontsize=${3:-60}:fontcolor=white:borderw=7:bordercolor=black@0.78:shadowcolor=black@0.5:shadowx=0:shadowy=4:line_spacing=10:text_align=C:x=(w-text_w)/2:y=${4:-1400}"; }

# 1 · La nave, un poco ralentizada para que quepa la frase (5,1 s)
ff -i $P/5-nave.mp4 -vf "setpts=1.28*PTS,scale=1080:1920,$LOOK,$(sub s1 "Second week on the job.\nAnd today they hand me Tony's route." 50):enable='gte(t,0.1)'" -t 5.1 "${COD[@]}" "$T/1.mp4"

# 2 · La libreta (2,4 s)
ff -ss 0.3 -t 2.4 -i $P/6-libreta.mp4 -vf "scale=1080:1920,$LOOK,$(sub s2 'The one only Tony knows.' 58)" "${COD[@]}" "$T/2.mp4"

# 3 · Lucía escanea (1,8 s)
ff -ss 0.2 -t 1.8 -i $P/7-escaneo.mp4 -vf "scale=1080:1920,$LOOK,$(sub s3 'So I scan the parcels…' 58)" "${COD[@]}" "$T/3.mp4"

# 4 · La app real en inglés, dentro de un móvil, sobre el plano de Lucía desenfocado (3,2 s):
#     la cámara leyendo la etiqueta (1,1 s) y la ruta ya ordenada con la hora de cada parada (2,1 s).
RR="lte(hypot(max(abs(X-W/2)-(W/2-R),0),max(abs(Y-H/2)-(H/2-R),0)),R)"
ff -f lavfi -i "color=c=white:s=700x1518" -vf "format=gray,geq=lum='255*${RR//R/56}'" -frames:v 1 "$T/m-pantalla.png"
ff -f lavfi -i "color=c=white:s=728x1546" -vf "format=gray,geq=lum='255*${RR//R/68}'" -frames:v 1 "$T/m-marco.png"
ff -framerate 6.4 -start_number 8 -i $H/app-en/%05d.jpg -frames:v 7 -vf "fps=30,scale=700:1518" -c:v libx264 -crf 12 -pix_fmt yuv420p "$T/a1.mp4"
ff -framerate 9 -start_number 160 -i $H/app-en/%05d.jpg -frames:v 19 -vf "fps=30,scale=700:1518" -c:v libx264 -crf 12 -pix_fmt yuv420p "$T/a2.mp4"
ff -ss 1.5 -t 2.5 -i $P/7-escaneo.mp4 -i "$T/a1.mp4" -i "$T/a2.mp4" -loop 1 -framerate 30 -t 3.2 -i "$T/m-pantalla.png" -loop 1 -framerate 30 -t 3.2 -i "$T/m-marco.png" \
  -filter_complex "[0:v]setpts=1.3*PTS,scale=1080:1920,boxblur=24:2,eq=brightness=-0.24:saturation=0.8,fps=30[bg];
    [1:v][2:v]concat=n=2:v=1:a=0,fps=30,tpad=stop_mode=clone:stop_duration=1,format=rgba[app];[3:v]format=gray[mp];[app][mp]alphamerge[pant];
    color=c=0x0b0f14:s=728x1546:r=30,format=rgba[neg];[4:v]format=gray[mm];[neg][mm]alphamerge[marco];
    [marco][pant]overlay=14:14[movil];
    [bg][movil]overlay=x=176:y='90+max(0,(0.35-t))*2600':shortest=0,format=yuv420p,noise=alls=3:allf=t,$(sub s4 '…and the route sorts itself.' 58 1700):enable='gte(t,1.2)'[v]" \
  -map "[v]" -t 3.2 "${COD[@]}" "$T/4.mp4"

# 5 · La señora (2,1 s)
ff -ss 1.1 -t 2.1 -i $P/2-senora.mp4 -vf "crop=1080:1620:0:150,scale=1280:1920,crop=1080:1920,$LOOK,$(sub s5 'At every door,\nthe same question:' 58)" "${COD[@]}" "$T/5.mp4"

# 6 · El perro (1,9 s)
ff -ss 1.5 -t 1.9 -i $P/3-perro.mp4 -vf "scale=1080:1920,colortemperature=temperature=5200,eq=saturation=0.88,$LOOK,$(sub s6 "Where's Tony?" 78):enable='gte(t,0.6)'" "${COD[@]}" "$T/6.mp4"

# 7 · Lucía cierra la furgoneta y habla por teléfono (5,0 s); al final entra el lema
ff -t 5.0 -i $P/4-lucia.mp4 -loop 1 -framerate 30 -t 5.0 -i $C/manana.png \
  -filter_complex "[0:v]crop=1080:1584:0:168,scale=1310:1920,crop=1080:1920,$LOOK,$(sub s7a 'By the time Tony called\nto check on me…' 54 1160):enable='between(t,0.4,2.9)',$(sub s7b 'I was done.' 70 1180):enable='between(t,3.1,3.9)'[b];
    [1:v]format=rgba,fade=t=in:st=4.0:d=0.25:alpha=1[m];[b][m]overlay=0:0:enable='gte(t,4.0)',format=yuv420p[v]" \
  -map "[v]" -t 5.0 "${COD[@]}" "$T/7.mp4"

# 8 · Tarjeta de cierre (3,2 s)
ff -f lavfi -t 3.2 -i "color=c=0x06161c:s=1080x1920:r=30" -loop 1 -framerate 30 -t 3.2 -i $C/cierre-B.png \
  -filter_complex "[0:v][1:v]overlay=0:0,fade=t=in:st=0:d=0.2,format=yuv420p[v]" -map "[v]" -t 3.2 "${COD[@]}" "$T/8.mp4"

for n in 1 2 3 4 5 6 7 8; do echo "file '$T/$n.mp4'"; done > "$T/lista.txt"
ff -f concat -safe 0 -i "$T/lista.txt" -c copy "$T/video.mp4"
DUR=24.7

# Sonido. La pausa larga de dos frases se recorta (l5 en dos trozos; l6 con menos silencio tras «FDS»).
ff -f lavfi -i "sine=frequency=1900:sample_rate=48000:duration=0.09" -af "afade=t=out:st=0.06:d=0.03,volume=0.45" "$T/bip.wav"
A="aresample=48000,aformat=channel_layouts=stereo"
ff -i $VZ/l1.mp3 -i $VZ/l2.mp3 -i $VZ/l3.mp3 -i $VZ/l4.mp3 -i $VZ/l5.mp3 -i $VZ/l5.mp3 -i $VZ/l6.mp3 -i $VZ/l6.mp3 \
  -i $H/musica-lyria.mp3 -i "$T/bip.wav" -i "$T/bip.wav" \
  -ss 1.5 -t 1.9 -i $P/3-perro.mp4 -t 1.7 -i $P/4-lucia.mp4 \
  -filter_complex "
  [0:a]$A,adelay=100:all=1[v1];[1:a]$A,adelay=5200:all=1[v2];[2:a]$A,adelay=7600:all=1[v3];[3:a]$A,adelay=12600:all=1[v4];
  [4:a]$A,atrim=end=2.5,adelay=16900:all=1[v5a];[5:a]$A,atrim=start=3.85,asetpts=PTS-STARTPTS,adelay=19600:all=1[v5b];
  [6:a]$A,atrim=end=1.0,adelay=20700:all=1[v6a];[7:a]$A,atrim=start=1.6,asetpts=PTS-STARTPTS,adelay=21950:all=1[v6b];
  [v1][v2][v3][v4][v5a][v5b][v6a][v6b]amix=inputs=8:normalize=0,loudnorm=I=-15:TP=-2:LRA=9,$A,asplit[voz][llave];
  [8:a]$A,atrim=duration=$DUR,volume=-11dB,afade=t=in:d=0.3,afade=t=out:st=23.2:d=1.5[mus0];
  [mus0][llave]sidechaincompress=threshold=0.03:ratio=5:attack=20:release=350[mus];
  [9:a]$A,adelay=9500:all=1[b1];[10:a]$A,adelay=9950:all=1[b2];
  [11:a]$A,volume=-7dB,afade=t=in:d=0.05,afade=t=out:st=1.7:d=0.2,adelay=14600:all=1[perro];
  [12:a]$A,volume=-9dB,afade=t=in:d=0.05,afade=t=out:st=1.4:d=0.3,adelay=16500:all=1[puerta];
  [voz][mus][b1][b2][perro][puerta]amix=inputs=6:normalize=0:duration=longest,atrim=duration=$DUR,alimiter=limit=0.9[a]" \
  -map "[a]" -ar 48000 -ac 2 "$T/audio.wav"

ff -i "$T/video.mp4" -i "$T/audio.wav" -t $DUR -c:v libx264 -preset medium -crf 25 -maxrate 9M -bufsize 18M -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart $H/salida/spot-tony-en-9x16.mp4
echo "$H/salida/spot-tony-en-9x16.mp4"
