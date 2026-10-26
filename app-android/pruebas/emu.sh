#!/usr/bin/env bash
# Ayudas para probar la app en el emulador por adb (lo usa quien prueba a mano o desde una sesión).
#   source app-android/pruebas/emu.sh
#   tocar "Entregado"         # toca el primer elemento con ese texto o descripción
#   foto 10-algo              # captura de pantalla en $EMU_FOTOS/10-algo.png
#   hay "Añadida a tu ruta"   # ¿está ese texto en pantalla? (código de salida)
export MSYS_NO_PATHCONV=1
ADB="${ADB:-/c/Users/Usuario/AppData/Local/Android/Sdk/platform-tools/adb.exe}"
EMU_FOTOS="${EMU_FOTOS:-.}"

volcar() {
  "$ADB" shell uiautomator dump /data/local/tmp/ui.xml >/dev/null 2>&1
  "$ADB" exec-out cat /data/local/tmp/ui.xml | sed 's/></>\n</g'
}

tocar() {
  local buscado="$1" linea b x1 y1 x2 y2
  linea=$(volcar | grep -F -e "text=\"$buscado\"" -e "content-desc=\"$buscado\"" | head -1)
  if [ -z "$linea" ]; then echo "no encuentro «$buscado»" >&2; return 1; fi
  b=$(echo "$linea" | grep -o 'bounds="\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]"' | grep -o '[0-9]*' | tr '\n' ' ')
  read -r x1 y1 x2 y2 <<< "$b"
  "$ADB" shell input tap $(( (x1 + x2) / 2 )) $(( (y1 + y2) / 2 ))
}

hay() { volcar | grep -qF -e "text=\"$1" -e "content-desc=\"$1"; }

foto() { "$ADB" exec-out screencap -p > "$EMU_FOTOS/$1.png"; }

escribir() { "$ADB" shell input text "$(echo "$1" | sed 's/ /%s/g')"; }
