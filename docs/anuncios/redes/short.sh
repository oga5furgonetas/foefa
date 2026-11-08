#!/usr/bin/env bash
# Short vertical (1080x1920) a partir de un carrusel ya generado: bash docs/anuncios/redes/short.sh G
# Sale frontend/public/redes/short-G.mp4 (portada 2,5 s, cada punto 3,5 s, cierre 4 s, fundido de 0,4 s; pista de
# audio en silencio para que YouTube lo acepte como Short; la música, si se quiere, desde la app de YouTube).
set -euo pipefail
P="${1:?prefijo del carrusel, p. ej. G}"
cd "$(dirname "$0")/../../.."
D=frontend/public/redes
mapfile -t F < <(ls "$D"/"$P"-*.png | sort -V)
[ "${#F[@]}" -ge 3 ] || { echo "No hay carrusel $P en $D"; exit 1; }
X=0.4; ins=(); dur=()
for i in "${!F[@]}"; do
  t=3.5; [ "$i" -eq 0 ] && t=2.5; [ "$i" -eq $(( ${#F[@]} - 1 )) ] && t=4
  ins+=(-loop 1 -t "$t" -i "${F[$i]}"); dur+=("$t")
done
f=""; prev="[0:v]"; off=0
for i in $(seq 1 $(( ${#F[@]} - 1 ))); do
  off=$(echo "$off + ${dur[$((i-1))]} - $X" | bc)
  out="[v$i]"; f+="${prev}[$i:v]xfade=transition=fade:duration=$X:offset=$off$out;"; prev="$out"
done
total=$(echo "$off + ${dur[-1]}" | bc)
ffmpeg -y -loglevel error "${ins[@]}" -f lavfi -t "$total" -i anullsrc=r=44100:cl=stereo \
  -filter_complex "${f}${prev}format=yuv420p,fps=30[v]" -map "[v]" -map "${#F[@]}:a" \
  -c:v libx264 -crf 22 -preset medium -c:a aac -b:a 96k -shortest -movflags +faststart "$D/short-$P.mp4"
echo "→ $D/short-$P.mp4 ($total s)"
