# -*- coding: utf-8 -*-
"""LA FICHA DE LA APP STORE DESDE AQUÍ (30-10-2026): habla con la API de App Store Connect con la clave «GitHub» (la misma
que usa el CI) para no tener que rellenar a mano los textos de frontend/ios/listing/ en cada idioma.

    python scripts/app_store_connect.py apps                       # qué apps hay y qué versiones
    python scripts/app_store_connect.py version 2.4.1              # la versión de la App Store a 2.4.1 (la del build)
    python scripts/app_store_connect.py ficha                      # nombre, subtítulo, descripción, palabras clave, URLs,
                                                                   # en los 7 idiomas de frontend/ios/listing/
    python scripts/app_store_connect.py builds                     # los builds subidos (TestFlight) y su estado

Lee la clave de ASC_API_KEY_P8 (ruta del fichero .p8; por defecto ~/.flota-apple-AuthKey_<KEY>.p8), ASC_KEY_ID y
ASC_ISSUER_ID del entorno; nunca imprime la clave. Pide `pip install pyjwt cryptography`."""
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

import jwt

RAIZ = Path(__file__).resolve().parent.parent
LISTING = RAIZ / "frontend" / "ios" / "listing"
BUNDLE = "com.flotadsp.fds"
KEY_ID = os.environ.get("ASC_KEY_ID", "69L4YQTS65")
ISSUER = os.environ.get("ASC_ISSUER_ID", "3355c0c6-1478-4646-bcfc-7cc818d424cf")
P8 = os.environ.get("ASC_API_KEY_P8") or str(Path.home() / f".flota-apple-AuthKey_{KEY_ID}.p8")
API = "https://api.appstoreconnect.apple.com/v1"
# Carpeta de frontend/ios/listing -> locale de App Store Connect.
LOCALES = {"es-ES": "es-ES", "es-419": "es-MX", "en-US": "en-US", "pt-BR": "pt-BR", "fr-FR": "fr-FR", "it-IT": "it", "de-DE": "de-DE"}
URL_SOPORTE = "https://flotadsp.com"
URL_PRIVACIDAD = "https://flotadsp.com/privacidad"


def token() -> str:
    clave = Path(P8).read_text(encoding="utf-8")
    ahora = int(time.time())
    return jwt.encode({"iss": ISSUER, "iat": ahora, "exp": ahora + 15 * 60, "aud": "appstoreconnect-v1"}, clave, algorithm="ES256",
                      headers={"kid": KEY_ID, "typ": "JWT"})


def api(metodo: str, ruta: str, datos=None):
    req = urllib.request.Request(API + ruta if ruta.startswith("/") else ruta, method=metodo,
                                 headers={"Authorization": "Bearer " + token(), "Content-Type": "application/json"},
                                 data=json.dumps(datos).encode() if datos is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            cuerpo = r.read()
            return r.status, (json.loads(cuerpo) if cuerpo else {})
    except urllib.error.HTTPError as e:
        cuerpo = e.read()
        try:
            return e.code, json.loads(cuerpo)
        except Exception:  # noqa: BLE001
            return e.code, {"raw": cuerpo[:300].decode(errors="replace")}


def falla(estado, r, que):
    if estado >= 300:
        errores = "; ".join(f"{x.get('title')}: {x.get('detail')}" for x in r.get("errors", [])) or str(r)[:300]
        sys.exit(f"{que}: HTTP {estado} — {errores}")


def la_app() -> dict:
    estado, r = api("GET", f"/apps?filter[bundleId]={BUNDLE}")
    falla(estado, r, "apps")
    if not r.get("data"):
        sys.exit(f"no hay ninguna app con el bundle {BUNDLE}")
    return r["data"][0]


def version_abierta(app_id: str) -> dict:
    """La versión que aún no está en la tienda (la que se prepara)."""
    estado, r = api("GET", f"/apps/{app_id}/appStoreVersions?filter[platform]=IOS&limit=5")
    falla(estado, r, "appStoreVersions")
    for v in r.get("data", []):
        if v["attributes"].get("appStoreState") not in ("READY_FOR_SALE", "REPLACED_WITH_NEW_VERSION", "REMOVED_FROM_SALE"):
            return v
    sys.exit("no hay ninguna versión en preparación")


def cmd_apps():
    estado, r = api("GET", "/apps?limit=20")
    falla(estado, r, "apps")
    for a in r.get("data", []):
        at = a["attributes"]
        print(a["id"], "|", at.get("name"), "|", at.get("bundleId"), "|", at.get("sku"), "|", at.get("primaryLocale"))
        e2, v = api("GET", f"/apps/{a['id']}/appStoreVersions?limit=5")
        for x in v.get("data", []):
            print("    versión", x["attributes"].get("versionString"), x["attributes"].get("platform"), x["attributes"].get("appStoreState"), "| id", x["id"])


def cmd_version(nueva: str):
    app = la_app()
    v = version_abierta(app["id"])
    if v["attributes"]["versionString"] == nueva:
        print("la versión ya es", nueva)
        return
    estado, r = api("PATCH", f"/appStoreVersions/{v['id']}", {"data": {"type": "appStoreVersions", "id": v["id"], "attributes": {"versionString": nueva}}})
    falla(estado, r, "cambiar la versión")
    print("versión", v["attributes"]["versionString"], "->", nueva)


def lee(carpeta: Path, nombre: str) -> str:
    return (carpeta / nombre).read_text(encoding="utf-8").strip()


def cmd_ficha():
    app = la_app()
    v = version_abierta(app["id"])
    # 1. La información de la app (nombre, subtítulo, privacidad) por idioma: appInfoLocalizations.
    estado, r = api("GET", f"/apps/{app['id']}/appInfos")
    falla(estado, r, "appInfos")
    info = next((i for i in r["data"] if i["attributes"].get("appStoreState") not in ("READY_FOR_SALE",)), r["data"][0])
    def existentes():
        # Se vuelven a leer en cada idioma: al crear la localización de la info, App Store Connect crea sola la de la
        # versión (y al revés), y un POST sobre la que ya existe da 409.
        e1, r1 = api("GET", f"/appInfos/{info['id']}/appInfoLocalizations")
        falla(e1, r1, "appInfoLocalizations")
        e2, r2 = api("GET", f"/appStoreVersions/{v['id']}/appStoreVersionLocalizations")
        falla(e2, r2, "appStoreVersionLocalizations")
        return ({x["attributes"]["locale"]: x["id"] for x in r1["data"]}, {x["attributes"]["locale"]: x["id"] for x in r2["data"]})
    for carpeta, locale in LOCALES.items():
        d = LISTING / carpeta
        if not d.is_dir():
            continue
        hay_info, hay_ver = existentes()
        attrs_info = {"name": lee(d, "name.txt"), "subtitle": lee(d, "subtitle.txt"), "privacyPolicyUrl": URL_PRIVACIDAD}
        if locale in hay_info:
            estado, r = api("PATCH", f"/appInfoLocalizations/{hay_info[locale]}", {"data": {"type": "appInfoLocalizations", "id": hay_info[locale], "attributes": attrs_info}})
        else:
            estado, r = api("POST", "/appInfoLocalizations", {"data": {"type": "appInfoLocalizations", "attributes": {"locale": locale, **attrs_info},
                                                                        "relationships": {"appInfo": {"data": {"type": "appInfos", "id": info["id"]}}}}})
        falla(estado, r, f"info {locale}")
        _, hay_ver = existentes()   # la de la versión puede haber nacido con la de la info
        attrs_ver = {"description": lee(d, "description.txt"), "keywords": lee(d, "keywords.txt"), "promotionalText": lee(d, "promotional.txt"),
                     "supportUrl": URL_SOPORTE, "marketingUrl": URL_SOPORTE}
        if locale in hay_ver:
            estado, r = api("PATCH", f"/appStoreVersionLocalizations/{hay_ver[locale]}", {"data": {"type": "appStoreVersionLocalizations", "id": hay_ver[locale], "attributes": attrs_ver}})
        else:
            estado, r = api("POST", "/appStoreVersionLocalizations", {"data": {"type": "appStoreVersionLocalizations", "attributes": {"locale": locale, **attrs_ver},
                                                                               "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": v["id"]}}}}})
        falla(estado, r, f"versión {locale}")
        print("ficha", locale, "ok:", attrs_info["name"], "·", attrs_info["subtitle"])
    # 2. Categorías: Negocios y, secundaria, Navegación.
    estado, r = api("PATCH", f"/appInfos/{info['id']}", {"data": {"type": "appInfos", "id": info["id"], "relationships": {
        "primaryCategory": {"data": {"type": "appCategories", "id": "BUSINESS"}}, "secondaryCategory": {"data": {"type": "appCategories", "id": "NAVIGATION"}}}}})
    falla(estado, r, "categorías")
    print("categorías: Business + Navigation")


def cmd_capturas():
    """Las capturas de frontend/ios/listing/capturas/<idioma>/*.jpg (1290×2796, iPhone 6,7") a cada idioma de la versión."""
    import hashlib
    app = la_app()
    v = version_abierta(app["id"])
    estado, r = api("GET", f"/appStoreVersions/{v['id']}/appStoreVersionLocalizations")
    falla(estado, r, "appStoreVersionLocalizations")
    locs = {x["attributes"]["locale"]: x["id"] for x in r["data"]}
    for carpeta, locale in LOCALES.items():
        d = LISTING / "capturas" / carpeta
        if not d.is_dir() or locale not in locs:
            continue
        estado, sets = api("GET", f"/appStoreVersionLocalizations/{locs[locale]}/appScreenshotSets")
        falla(estado, sets, f"appScreenshotSets {locale}")
        set_id = next((s["id"] for s in sets["data"] if s["attributes"]["screenshotDisplayType"] == "APP_IPHONE_67"), None)
        if not set_id:
            estado, s = api("POST", "/appScreenshotSets", {"data": {"type": "appScreenshotSets", "attributes": {"screenshotDisplayType": "APP_IPHONE_67"},
                                                                     "relationships": {"appStoreVersionLocalization": {"data": {"type": "appStoreVersionLocalizations", "id": locs[locale]}}}}})
            falla(estado, s, f"crear el conjunto {locale}")
            set_id = s["data"]["id"]
        estado, ya = api("GET", f"/appScreenshotSets/{set_id}/appScreenshots")
        falla(estado, ya, f"appScreenshots {locale}")
        nombres = {x["attributes"]["fileName"] for x in ya["data"]}
        for f in sorted(d.glob("*.jpg")):
            if f.name in nombres:
                print("captura", locale, f.name, "ya estaba")
                continue
            datos = f.read_bytes()
            estado, s = api("POST", "/appScreenshots", {"data": {"type": "appScreenshots", "attributes": {"fileName": f.name, "fileSize": len(datos)},
                                                                  "relationships": {"appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": set_id}}}}})
            falla(estado, s, f"reservar {f.name}")
            sid = s["data"]["id"]
            for op in s["data"]["attributes"]["uploadOperations"]:
                trozo = datos[op["offset"]: op["offset"] + op["length"]]
                req = urllib.request.Request(op["url"], method=op["method"], data=trozo, headers={h["name"]: h["value"] for h in op["requestHeaders"]})
                with urllib.request.urlopen(req, timeout=180) as resp:
                    resp.read()
            estado, s2 = api("PATCH", f"/appScreenshots/{sid}", {"data": {"type": "appScreenshots", "id": sid,
                                                                           "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(datos).hexdigest()}}})
            falla(estado, s2, f"confirmar {f.name}")
            print("captura", locale, f.name, "subida")


def cmd_edad():
    """La clasificación por edades: nada de lo que pregunta Apple (4+)."""
    app = la_app()
    estado, r = api("GET", f"/apps/{app['id']}/appInfos")
    falla(estado, r, "appInfos")
    info = next((i for i in r["data"] if i["attributes"].get("appStoreState") not in ("READY_FOR_SALE",)), r["data"][0])
    estado, r = api("GET", f"/appInfos/{info['id']}/ageRatingDeclaration")
    falla(estado, r, "ageRatingDeclaration")
    decl = r["data"]["id"]
    nada = {k: "NONE" for k in ("alcoholTobaccoOrDrugUseOrReferences", "contests", "gamblingSimulated", "horrorOrFearThemes",
                                "matureOrSuggestiveThemes", "medicalOrTreatmentInformation", "profanityOrCrudeHumor",
                                "sexualContentGraphicAndNudity", "sexualContentOrNudity", "violenceCartoonOrFantasy",
                                "violenceRealistic", "violenceRealisticProlongedGraphicOrSadistic")}
    attrs = {**nada, "gunsOrOtherWeapons": "NONE", "gambling": False, "unrestrictedWebAccess": False, "lootBox": False,
             "advertising": False, "messagingAndChat": False, "userGeneratedContent": False, "parentalControls": False,
             "ageAssurance": False, "healthOrWellnessTopics": False, "socialMedia": False}
    estado, r = api("PATCH", f"/ageRatingDeclarations/{decl}", {"data": {"type": "ageRatingDeclarations", "id": decl, "attributes": attrs}})
    falla(estado, r, "clasificación por edades")
    print("clasificación por edades: sin contenido sensible (4+)")


def cmd_builds():
    app = la_app()
    estado, r = api("GET", f"/builds?filter[app]={app['id']}&sort=-uploadedDate&limit=10")
    falla(estado, r, "builds")
    for b in r.get("data", []):
        at = b["attributes"]
        print(b["id"], "| build", at.get("version"), "| estado", at.get("processingState"), "| subido", at.get("uploadedDate"), "| caduca", at.get("expired"))
    if not r.get("data"):
        print("ningún build todavía")


if __name__ == "__main__":
    orden = sys.argv[1] if len(sys.argv) > 1 else "apps"
    if orden == "apps":
        cmd_apps()
    elif orden == "version":
        cmd_version(sys.argv[2])
    elif orden == "ficha":
        cmd_ficha()
    elif orden == "builds":
        cmd_builds()
    elif orden == "capturas":
        cmd_capturas()
    elif orden == "edad":
        cmd_edad()
    else:
        sys.exit(__doc__)
