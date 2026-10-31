# -*- coding: utf-8 -*-
"""Lee, sin aapt ni SDK, lo que importa de un APK: paquete, versionCode, versionName y si va firmado.

    python scripts/apk_version.py FICHERO.apk                 -> JSON con todo
    python scripts/apk_version.py FICHERO.apk --campo code    -> solo ese campo (code, nombre, paquete, firmado,
                                                                 sha256, bytes); los booleanos salen como true/false

Lo usan deploy-frontend.ps1 y desplegar.yml para NO coser en la web (/descargas/FDS.apk) un APK más viejo que el que
ya sirve producción ni que el que anuncia el servidor (31-10-2026: el de reserva del repo era la 1.0.3, code 4, y sin
`gh` cualquier despliegue pasadas 24 h la habría servido como «nueva versión»). Los nombres de fichero pueden mentir;
el manifiesto, no.

El AndroidManifest.xml de un APK va en XML binario (AXML): una reserva de cadenas, un mapa de ids de recurso y los
elementos. versionCode y versionName se buscan por su id de recurso (0x0101021b y 0x0101021c), el paquete por el
nombre del atributo (`package`, sin id). Solo biblioteca estándar: vale en el PC de Dani, en el de Winiw y en el
runner de GitHub tal cual.
"""
import hashlib
import json
import os
import struct
import sys
import zipfile

ID_VERSION_CODE = 0x0101021B
ID_VERSION_NAME = 0x0101021C
TIPO_RESERVA, TIPO_MAPA, TIPO_INICIO_ELEMENTO = 0x0001, 0x0180, 0x0102
VALOR_CADENA, VALOR_INT_DEC, VALOR_INT_HEX = 0x03, 0x10, 0x11


def _reserva_de_cadenas(datos, ini):
    """Las cadenas de la reserva (chunk 0x0001), en UTF-8 o UTF-16 según sus flags."""
    _tipo, cabecera, _tam, n, _estilos, flags, inicio, _inicio_estilos = struct.unpack_from("<HHIIIIII", datos, ini)
    utf8 = bool(flags & 0x100)
    desplazamientos = struct.unpack_from("<%dI" % n, datos, ini + cabecera)
    base = ini + inicio
    cadenas = []
    for d in desplazamientos:
        p = base + d
        if utf8:
            if datos[p] & 0x80:  # longitud en caracteres, 1 o 2 bytes (no se usa)
                p += 1
            p += 1
            largo = datos[p]
            p += 1
            if largo & 0x80:
                largo = ((largo & 0x7F) << 8) | datos[p]
                p += 1
            cadenas.append(datos[p:p + largo].decode("utf-8", "replace"))
        else:
            largo = struct.unpack_from("<H", datos, p)[0]
            p += 2
            if largo & 0x8000:
                largo = ((largo & 0x7FFF) << 16) | struct.unpack_from("<H", datos, p)[0]
                p += 2
            cadenas.append(datos[p:p + 2 * largo].decode("utf-16-le", "replace"))
    return cadenas


def atributos_del_manifest(datos):
    """(nombre del primer elemento, {atributo: valor}) del AXML. Los atributos con id de recurso van por su id en hexadecimal
    ("0x0101021b"); los demás, por su nombre ("package")."""
    if len(datos) < 8 or struct.unpack_from("<H", datos, 0)[0] != 0x0003:
        raise ValueError("no es un AndroidManifest.xml binario")
    cadenas, mapa = [], []
    p = 8
    while p + 8 <= len(datos):
        tipo, cabecera, tam = struct.unpack_from("<HHI", datos, p)
        if tam < 8:
            raise ValueError("chunk roto en el manifiesto")
        if tipo == TIPO_RESERVA:
            cadenas = _reserva_de_cadenas(datos, p)
        elif tipo == TIPO_MAPA:
            mapa = list(struct.unpack_from("<%dI" % ((tam - cabecera) // 4), datos, p + cabecera))
        elif tipo == TIPO_INICIO_ELEMENTO:
            _ns, nombre, ini_attr, tam_attr, n_attr = struct.unpack_from("<IIHHH", datos, p + cabecera)
            elemento = cadenas[nombre] if nombre < len(cadenas) else "?"
            atributos = {}
            q = p + cabecera + ini_attr
            for _ in range(n_attr):
                _ans, anombre, bruto, _vtam, _res0, vtipo, vdato = struct.unpack_from("<IIIHBBI", datos, q)
                rid = mapa[anombre] if anombre < len(mapa) else 0
                clave = ("0x%08x" % rid) if rid else (cadenas[anombre] if anombre < len(cadenas) else str(anombre))
                if vtipo == VALOR_CADENA:
                    indice = vdato if vdato < len(cadenas) else bruto
                    valor = cadenas[indice] if indice < len(cadenas) else None
                elif vtipo in (VALOR_INT_DEC, VALOR_INT_HEX):
                    valor = vdato
                else:
                    valor = vdato
                atributos[clave] = valor
                q += tam_attr
            return elemento, atributos
        p += tam
    raise ValueError("el manifiesto no tiene ningún elemento")


def _firma_v2_v3(ruta):
    """True si justo antes del directorio central está el bloque «APK Sig Block 42» (firma v2/v3 de Android)."""
    with open(ruta, "rb") as f:
        f.seek(0, 2)
        total = f.tell()
        f.seek(max(0, total - 65557))
        cola = f.read()
        i = cola.rfind(b"PK\x05\x06")
        if i < 0 or i + 20 > len(cola):
            return False
        inicio_directorio = struct.unpack_from("<I", cola, i + 16)[0]
        if inicio_directorio < 16:
            return False
        f.seek(inicio_directorio - 16)
        return f.read(16) == b"APK Sig Block 42"


def info_apk(ruta):
    with zipfile.ZipFile(ruta) as z:
        nombres = z.namelist()
        if "AndroidManifest.xml" not in nombres:
            raise ValueError("%s no trae AndroidManifest.xml: no es un APK" % ruta)
        elemento, atributos = atributos_del_manifest(z.read("AndroidManifest.xml"))
        v1 = sorted(n for n in nombres if n.startswith("META-INF/") and n.rsplit(".", 1)[-1] in ("RSA", "DSA", "EC"))
    if elemento != "manifest":
        raise ValueError("el primer elemento del manifiesto es <%s>, no <manifest>" % elemento)
    sha = hashlib.sha256()
    with open(ruta, "rb") as f:
        for trozo in iter(lambda: f.read(1 << 20), b""):
            sha.update(trozo)
    v2v3 = _firma_v2_v3(ruta)
    code = atributos.get("0x%08x" % ID_VERSION_CODE)
    return {
        "fichero": ruta,
        "paquete": atributos.get("package"),
        "code": int(code) if isinstance(code, int) else None,
        "nombre": atributos.get("0x%08x" % ID_VERSION_NAME),
        "firmado": bool(v2v3 or v1),
        "firma": {"v2v3": v2v3, "v1": v1},
        "bytes": os.path.getsize(ruta),
        "sha256": sha.hexdigest(),
    }


def main(argv):
    if not argv or argv[0].startswith("-"):
        sys.exit("uso: apk_version.py FICHERO.apk [--campo code|nombre|paquete|firmado|sha256|bytes]")
    try:
        info = info_apk(argv[0])
    except (OSError, ValueError, zipfile.BadZipFile, struct.error) as e:
        sys.exit("apk_version: %s" % e)
    if len(argv) >= 3 and argv[1] == "--campo":
        valor = info.get(argv[2])
        if valor is None and argv[2] not in info:
            sys.exit("apk_version: no existe el campo %s" % argv[2])
        print("true" if valor is True else "false" if valor is False else "" if valor is None else valor)
    else:
        print(json.dumps(info, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main(sys.argv[1:])
