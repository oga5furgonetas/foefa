# -*- coding: utf-8 -*-
"""scripts/apk_version.py: paquete, versionCode, versionName y firma de un APK, sin aapt ni SDK. Lo usan
deploy-frontend.ps1 y desplegar.yml para no coser en la web (/descargas/FDS.apk) un APK más viejo que el que sirve
producción (31-10-2026: el de reserva del repo era la 1.0.3, code 4, y sin `gh` cualquier despliegue pasadas 24 h la
habría servido como «nueva versión»). Aquí se fabrica un manifiesto binario (AXML) mínimo, en UTF-16 y en UTF-8, y un
zip con firma v1, con firma v2/v3 (el bloque antes del directorio central) y sin firma."""
import io
import struct
import sys
import zipfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
import apk_version  # noqa: E402

NADIE = 0xFFFFFFFF
APK_REAL = Path(__file__).resolve().parents[2] / "app-android" / "app" / "build" / "outputs" / "apk" / "release" / "app-release.apk"


def _reserva(cadenas, utf8):
    cuerpo = b""
    desplazamientos = []
    for c in cadenas:
        desplazamientos.append(len(cuerpo))
        if utf8:
            b = c.encode("utf-8")
            cuerpo += bytes([len(c), len(b)]) + b + b"\x00"
        else:
            cuerpo += struct.pack("<H", len(c)) + c.encode("utf-16-le") + b"\x00\x00"
    while len(cuerpo) % 4:
        cuerpo += b"\x00"
    cabecera = 28
    inicio = cabecera + 4 * len(cadenas)
    return (struct.pack("<HHIIIIII", 0x0001, cabecera, inicio + len(cuerpo), len(cadenas), 0, 0x100 if utf8 else 0, inicio, 0)
            + struct.pack("<%dI" % len(cadenas), *desplazamientos) + cuerpo)


def manifiesto(paquete="com.flotadsp.flota.web", code=21, nombre="2.4.2", utf8=False):
    """Un AndroidManifest.xml binario con solo <manifest android:versionCode android:versionName package>: la reserva de
    cadenas, el mapa de ids de recurso (versionCode y versionName; `package` no tiene id) y el elemento."""
    cadenas = ["versionCode", "versionName", "package", "manifest", nombre, paquete]
    reserva = _reserva(cadenas, utf8)
    mapa = struct.pack("<HHI", 0x0180, 8, 16) + struct.pack("<II", 0x0101021B, 0x0101021C)
    atributos = (struct.pack("<IIIHBBI", NADIE, 0, NADIE, 8, 0, 0x10, code)   # versionCode: entero
                 + struct.pack("<IIIHBBI", NADIE, 1, 4, 8, 0, 0x03, 4)        # versionName: la cadena 4
                 + struct.pack("<IIIHBBI", NADIE, 2, 5, 8, 0, 0x03, 5))       # package: la cadena 5
    ext = struct.pack("<IIHHHHHH", NADIE, 3, 20, 20, 3, 0, 0, 0)
    elemento = struct.pack("<HHIII", 0x0102, 16, 16 + len(ext) + len(atributos), 1, NADIE) + ext + atributos
    return struct.pack("<HHI", 0x0003, 8, 8 + len(reserva) + len(mapa) + len(elemento)) + reserva + mapa + elemento


def apk(manifest, firma_v1=False, firma_v2=False, con_manifest=True):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        if con_manifest:
            z.writestr("AndroidManifest.xml", manifest)
        z.writestr("classes.dex", b"dex\n035\x00")
        if firma_v1:
            z.writestr("META-INF/CERT.SF", b"Signature-Version: 1.0\n")
            z.writestr("META-INF/CERT.RSA", b"\x30\x82")
    datos = buf.getvalue()
    if firma_v2:
        # El bloque de firma v2/v3 va entre las entradas y el directorio central y acaba en «APK Sig Block 42»;
        # el fin de directorio (EOCD) pasa a apuntar al directorio desplazado, como hace apksigner.
        fin = datos.rfind(b"PK\x05\x06")
        inicio_directorio = struct.unpack_from("<I", datos, fin + 16)[0]
        bloque = struct.pack("<Q", 24) + b"\x00" * 8 + b"APK Sig Block 42"
        datos = datos[:inicio_directorio] + bloque + datos[inicio_directorio:]
        fin += len(bloque)
        datos = datos[:fin + 16] + struct.pack("<I", inicio_directorio + len(bloque)) + datos[fin + 20:]
    return datos


def _guardar(tmp_path, nombre, datos):
    ruta = tmp_path / nombre
    ruta.write_bytes(datos)
    return str(ruta)


def test_lee_paquete_code_y_nombre_del_manifiesto(tmp_path):
    for utf8 in (False, True):
        ruta = _guardar(tmp_path, "a%d.apk" % utf8, apk(manifiesto(utf8=utf8), firma_v1=True))
        info = apk_version.info_apk(ruta)
        assert (info["paquete"], info["code"], info["nombre"]) == ("com.flotadsp.flota.web", 21, "2.4.2"), utf8
        assert info["firmado"] is True
        assert info["firma"] == {"v2v3": False, "v1": ["META-INF/CERT.RSA"]}
        assert info["bytes"] == len(Path(ruta).read_bytes())
        assert len(info["sha256"]) == 64


def test_la_firma_v2_v3_es_el_bloque_antes_del_directorio(tmp_path):
    ruta = _guardar(tmp_path, "v2.apk", apk(manifiesto(code=4, nombre="1.0.3-web"), firma_v2=True))
    info = apk_version.info_apk(ruta)
    assert (info["code"], info["nombre"]) == (4, "1.0.3-web")
    assert info["firma"] == {"v2v3": True, "v1": []}
    assert info["firmado"] is True
    with zipfile.ZipFile(ruta) as z:   # el zip sigue siendo legible con el bloque dentro, como para Android
        assert "classes.dex" in z.namelist()


def test_sin_firma_lo_dice(tmp_path):
    info = apk_version.info_apk(_guardar(tmp_path, "nada.apk", apk(manifiesto())))
    assert info["firmado"] is False
    assert info["firma"] == {"v2v3": False, "v1": []}


def test_rechaza_lo_que_no_es_un_apk(tmp_path):
    with pytest.raises(ValueError, match="AndroidManifest"):
        apk_version.info_apk(_guardar(tmp_path, "sin.zip", apk(b"", con_manifest=False)))
    with pytest.raises(ValueError, match="binario"):
        apk_version.info_apk(_guardar(tmp_path, "texto.apk", apk(b"<manifest/>")))
    with pytest.raises(zipfile.BadZipFile):
        apk_version.info_apk(_guardar(tmp_path, "no.apk", b"esto no es un zip"))
    with pytest.raises(SystemExit) as e:   # la línea de órdenes sale con error, nunca con una traza
        apk_version.main([_guardar(tmp_path, "no2.apk", b"tampoco")])
    assert e.value.code != 0


def test_campo_suelto_para_los_scripts(tmp_path, capsys):
    ruta = _guardar(tmp_path, "c.apk", apk(manifiesto(code=21), firma_v2=True))
    apk_version.main([ruta, "--campo", "code"])
    assert capsys.readouterr().out.strip() == "21"
    apk_version.main([ruta, "--campo", "firmado"])
    assert capsys.readouterr().out.strip() == "true"
    apk_version.main([ruta, "--campo", "paquete"])
    assert capsys.readouterr().out.strip() == "com.flotadsp.flota.web"
    with pytest.raises(SystemExit):
        apk_version.main([ruta, "--campo", "inventado"])
    with pytest.raises(SystemExit):
        apk_version.main([])
    apk_version.main([ruta])
    assert '"code": 21' in capsys.readouterr().out


@pytest.mark.skipif(not APK_REAL.exists(), reason="sin APK compilado en este PC")
def test_con_un_apk_de_verdad():
    info = apk_version.info_apk(str(APK_REAL))
    assert info["paquete"].startswith("com.flotadsp.flota")
    assert info["code"] >= 21
    assert info["firma"]["v2v3"] is True
