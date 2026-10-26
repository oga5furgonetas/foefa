# Una etiqueta como cartel para la cámara virtual del emulador: así se prueba el escáner EN VIVO (CameraX + ML Kit +
# servidor), no solo la lectura de una imagen. Los códigos salen de pruebas/generar-etiquetas.mjs.
#   py -3 app-android/pruebas/cartel_etiqueta.py <salida.png> [seur|barra]
#     seur  → Aztec con la dirección + su barra: la parada entra sola.
#     barra → solo la barra (como Correos o MRW): la dirección se lee del TEXTO de la foto y se abre la ficha.
#   emulator -avd FDS_Pixel -virtualscene-poster wall=<salida.png> ...    (o, en marcha: adb emu virtualscene-image wall <png>)
# La cámara virtual se coloca delante del cartel por gRPC (setPhysicalModel): posición (-1.407, 0.32, 4.277), giro
# (0, -150, 0); el cartel «wall» está en emulator/resources/Toren1BD.posters.
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

dir_ = Path(__file__).resolve().parent.parent / "app" / "src" / "androidTest" / "assets" / "etiquetas"
salida = Path(sys.argv[1])
tipo = sys.argv[2] if len(sys.argv) > 2 else "seur"
TEXTO = {
    "seur": (["SEUR · ENTREGA 24H", "María López", "Rúa Real 5, 2º B", "15003 A Coruña"], ["seur-aztec", "seur-barra"]),
    "barra": (["DESTINATARIO:", "Juan Pérez García", "Calle de la Paz 12, 3º A", "28012 Madrid", "Tel. 612 345 678"], ["solo-barra"]),
}
lineas, codigos = TEXTO[tipo]
cartel = Image.new("RGB", (1200, 1600), "white")
d = ImageDraw.Draw(cartel)
try:
    letra = ImageFont.truetype("arialbd.ttf" if tipo == "barra" else "arial.ttf", 60 if tipo == "barra" else 44)
except OSError:
    letra = ImageFont.load_default()
paso = 80 if tipo == "barra" else 60
for i, t in enumerate(lineas):
    d.text((70, 60 + i * paso), t, fill="black", font=letra)
y = 120 + len(lineas) * paso
for nombre in codigos:
    img = Image.open(dir_ / f"{nombre}.png").convert("RGB")
    escala = 700 / img.width if nombre == "seur-aztec" else min(1.0, 1000 / img.width)
    img = img.resize((int(img.width * escala), int(img.height * escala)), Image.NEAREST)
    cartel.paste(img, ((1200 - img.width) // 2, y))
    y += img.height + 80
cartel.save(salida)
print(salida, cartel.size)
