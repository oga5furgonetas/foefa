# -*- coding: utf-8 -*-
"""PROBAR EL GEOCODIFICADOR DEL REPARTO (02-11-2026): qué devuelve cada fuente y qué decide la cadena, paso a paso.

    python backend/scripts/probar_geocodificador.py "Rúa Real 1, 15003 A Coruña"
    python backend/scripts/probar_geocodificador.py "Calle Mayor 5" --cp 28013 --localidad Madrid
    python backend/scripts/probar_geocodificador.py "10 Downing Street, London" --pais gb
    python backend/scripts/probar_geocodificador.py --corpus corpus.json [--cache cache_http.json] [--sin-red]

Con una dirección: lo leído de la etiqueta, cada petición (servicio, lo que se pidió, estado, segundos, cuántos
resultados), lo que decidió CartoCiudad, el resultado (portal, calle o zona) y los candidatos que vería la app al
situar la parada. Es la misma cadena que usa el servidor (backend/geocodificador.py), con la red de este PC.

Con --corpus (una lista de {"id", "etiqueta": {"direccion", "cp", "localidad"}, "verdad": {"lat", "lng"}}, como la del
laboratorio del 02-11-2026): cuántas quedan bien situadas como portal (a 150 m o menos de la verdad), como calle (600 m)
o como zona (5 km), cuántas sin punto y cuántas mal situadas, y la latencia. --mal saca las mal situadas y las sin punto.

--cache: respuestas guardadas con el formato del laboratorio ({sha1: {status, json, lat}}): lo que esté ahí no se pide
y lo que falte se pide a la red al ritmo de cada servicio (Nominatim 1 por segundo; Photon 1; CartoCiudad 2), salvo con
--sin-red. El fichero no se toca. --caido photon (o «photon,nominatim», «cartociudad»…): como si ese servicio no
contestara, para ver qué queda. --sin-cartociudad: la cadena sin preguntarle nada a CartoCiudad (02-11-2026: la de las
cuentas de empresa hasta CARTOCIUDAD_EMPRESAS_DESDE, en server.py). Sin datos de nadie dentro: las direcciones se
escriben al llamarlo.
"""
import argparse
import asyncio
import hashlib
import json
import math
import os
import statistics
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))
import geocodificador as G  # noqa: E402

UA = "FDS/1.0 (pruebas)"
INTERVALO = {"nominatim": 1.05, "photon": 1.0, "cartociudad": 0.5}
M_PORTAL, M_CALLE, M_ZONA = 150, 600, 5000


class RedScript:
    """La red de este PC, con las respuestas guardadas delante (si las hay) y el ritmo de cada servicio."""

    def __init__(self, cache=None, sin_red=False, caidos=()):
        self.cache = cache or {}
        self.sin_red = sin_red
        self.caidos = set(caidos)
        self.ultima = {s: 0.0 for s in INTERVALO}
        self.candados = None
        self.cliente = None
        self.cuenta = {"cache": 0, "red": 0, "sin_red": 0}

    @staticmethod
    def clave(url, params):
        txt = url + "?" + json.dumps(sorted((str(k), str(v)) for k, v in (params or {}).items()), ensure_ascii=False)
        return hashlib.sha1(txt.encode("utf-8")).hexdigest()

    async def get(self, srv, url, params, tope, idioma=None):
        if srv in self.caidos:                               # como si no contestara en su tope
            return {"status": "tope", "json": None, "cache": True, "lat": tope}
        fila = self.cache.get(self.clave(url, params))
        if fila is not None:
            self.cuenta["cache"] += 1
            return {"status": fila.get("status"), "json": fila.get("json"), "cache": True, "lat": fila.get("lat")}
        if self.sin_red:
            self.cuenta["sin_red"] += 1
            return {"status": -2, "json": None}
        if self.candados is None:
            self.candados = {s: asyncio.Lock() for s in INTERVALO}
        if self.cliente is None:
            import httpx
            self.cliente = httpx.AsyncClient(timeout=10, follow_redirects=True, headers={"User-Agent": UA})
        async with self.candados[srv]:
            espera = INTERVALO[srv] - (time.monotonic() - self.ultima[srv])
            if espera > 0:
                await asyncio.sleep(espera)
            self.cuenta["red"] += 1
            try:
                r = await asyncio.wait_for(self.cliente.get(url, params=params, headers={"Accept-Language": idioma}
                                                            if idioma else {}), timeout=tope)
                js = r.json() if r.status_code == 200 else None
                return {"status": r.status_code, "json": js}
            except asyncio.TimeoutError:
                return {"status": "tope", "json": None}
            except Exception as e:                           # noqa: BLE001
                return {"status": -1, "json": None, "error": type(e).__name__}
            finally:
                self.ultima[srv] = time.monotonic()


class RedConReloj:
    """La red de una etiqueta del corpus con su propio reloj: cada respuesta guardada hace pasar el tiempo que tardó
    cuando se pidió (la latencia del laboratorio) y una pedida ahora, lo que tarde. Así la cadena ve los tiempos de
    verdad sin esperar. Lo que va a la vez se cuenta en serie: la media sale un poco por encima de la real."""

    def __init__(self, red):
        self.red, self.t = red, 0.0

    def ahora(self):
        return self.t

    async def get(self, srv, url, params, tope, idioma=None):
        t0 = time.monotonic()
        r = await self.red.get(srv, url, params, tope, idioma=idioma)
        self.t += min(float(tope), float(r.get("lat") or 0.0) if r.get("cache") else time.monotonic() - t0)
        if r.get("cache") and float(r.get("lat") or 0.0) > float(tope):
            return {"status": "tope", "json": None}
        return r


def _mostrar(direccion, cp, localidad, pais, res, traza):
    print(f"\n» {direccion}" + (f"  · CP {cp}" if cp else "") + (f"  · {localidad}" if localidad else "") + f"  · {pais}")
    lec = traza.get("lectura") or {}
    print("  leído:   " + "  ".join(f"{k}={v!r}" for k, v in lec.items() if v not in ("", [], False)))
    for i, paso in enumerate(traza.get("pasos") or [], 1):
        params = {k: v for k, v in (paso.get("params") or {}).items() if k not in ("format", "addressdetails")}
        print(f"  {i:>2}. {paso['srv']:<11} {str(paso['estado']):<10} {paso['seg']:>5.2f} s"
              f"{'  (guardada)' if paso.get('cache') else ''}  {json.dumps(params, ensure_ascii=False)}")
    if traza.get("cc_consultas"):
        print(f"  CartoCiudad: {traza.get('cc_estado') or 'sin portal'}  · consultas {traza['cc_consultas']}")
    if traza.get("nominatim"):
        print(f"  Nominatim: {traza['nominatim']}")
    for k in ("portal_osm_descartado", "fuera_del_pais"):
        if traza.get(k):
            print(f"  ¡{k}!")
    if res:
        print(f"  => {res['precision'].upper()} ({res['fuente']})  {res['lat']:.6f}, {res['lng']:.6f}  «{res.get('direccion')}»")
    else:
        print("  => SIN PUNTO")
    for c in traza.get("candidatos") or []:
        print(f"     · {c['precision']:<6} {c['lat']:.6f}, {c['lng']:.6f}  {c['direccion']}  [{c['fuente']}]")
    if traza.get("saltados"):
        print(f"  sin tiempo para: {', '.join(traza['saltados'])}")
    print(f"  {traza.get('segundos', 0):.2f} s, {len(traza.get('pasos') or [])} peticiones, {traza.get('fallos', 0)} fallos"
          f"{' (INCOMPLETA)' if traza.get('incompleta') else ''}"
          f"  ·  {G.atribucion([c['fuente'] for c in traza.get('candidatos') or []], pais)}")


def _metros(a, b):
    return G.metros(a, b)


def _veredicto(res, verdad):
    if not res:
        return "sin_punto", None
    d = _metros((res["lat"], res["lng"]), (verdad["lat"], verdad["lng"]))
    tope = {"portal": M_PORTAL, "calle": M_CALLE}.get(res["precision"], M_ZONA)
    return (f"{res['precision']}_ok" if d <= tope else "mal_situada"), d


async def _corpus(ruta, red, pais, ver_mal, a_la_vez, opciones=None):
    with open(ruta, encoding="utf-8") as f:
        corpus = json.load(f)
    sem = asyncio.Semaphore(a_la_vez)

    async def una(c):
        e = c.get("etiqueta") or c
        r = RedConReloj(red)
        async with sem:
            res, traza = await G.ubicar(r, e.get("direccion"), e.get("cp") or "", e.get("localidad") or "", pais=pais,
                                        reloj=G.Reloj(ahora=r.ahora), opciones=opciones)
        ver, d = _veredicto(res, c["verdad"])
        return {"id": c.get("id"), "direccion": e.get("direccion"), "veredicto": ver, "metros": d,
                "precision": (res or {}).get("precision", ""), "fuente": (res or {}).get("fuente", ""),
                "segundos": traza.get("segundos", 0.0), "peticiones": len(traza.get("pasos") or []),
                "incompleta": bool(traza.get("incompleta"))}
    filas = await asyncio.gather(*(una(c) for c in corpus))
    from collections import Counter
    cuenta = Counter(f["veredicto"] for f in filas)
    lat = sorted(f["segundos"] for f in filas)
    p95 = lat[min(len(lat) - 1, max(0, math.ceil(0.95 * len(lat)) - 1))] if lat else 0.0
    print(f"{os.path.basename(ruta)}: {len(filas)} etiquetas")
    print(f"  portal bien {cuenta['portal_ok']:>3}   calle bien {cuenta['calle_ok']:>3}   zona bien {cuenta['zona_ok']:>3}"
          f"   sin punto {cuenta['sin_punto']:>3}   MAL {cuenta['mal_situada']:>3} "
          f"(diciendo portal {sum(1 for f in filas if f['veredicto'] == 'mal_situada' and f['precision'] == 'portal')})")
    if lat:
        print(f"  segundos: media {statistics.mean(lat):.2f}  p95 {p95:.2f}  máx {max(lat):.2f}"
              f"   peticiones de media {statistics.mean(f['peticiones'] for f in filas):.2f}")
    print("  de dónde sale cada punto:", dict(Counter(f"{f['precision'] or '-'} · {f['fuente'] or '-'}" for f in filas).most_common()))
    print(f"  incompletas (un servicio caído o sin tiempo): {sum(1 for f in filas if f['incompleta'])}")
    if ver_mal:
        for f in filas:
            if f["veredicto"] in ("mal_situada", "sin_punto"):
                m = f"{f['metros']:.0f} m" if f["metros"] is not None else ""
                print(f"    {f['veredicto']:<11} {f['id']}  {f['direccion']}  {f['precision']} {f['fuente']} {m}")
    return filas


async def principal(a):
    cache = {}
    if a.cache:
        with open(a.cache, encoding="utf-8") as f:
            cache = json.load(f)
    red = RedScript(cache, sin_red=a.sin_red, caidos=[s.strip() for s in a.caido.split(",") if s.strip()])
    base = None
    if a.base:
        la, lo = (float(x) for x in a.base.split(","))
        base = (la, lo)
    opciones = {"cc": False} if a.sin_cartociudad else None
    try:
        if a.corpus:
            await _corpus(a.corpus, red, a.pais, a.mal, 1 if not cache or not a.sin_red else 6, opciones)
        else:
            r = RedConReloj(red)
            res, traza = await G.ubicar(r, a.direccion, a.cp, a.localidad, base=base, pais=a.pais,
                                        reloj=G.Reloj(ahora=r.ahora), opciones=opciones)
            _mostrar(a.direccion, a.cp, a.localidad, a.pais, res, traza)
    finally:
        if red.cliente is not None:
            await red.cliente.aclose()
    print(f"\npeticiones: {red.cuenta}")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="La cadena de geocodificación del reparto, paso a paso.")
    ap.add_argument("direccion", nargs="?", default="", help="la dirección tal como sale de la etiqueta")
    ap.add_argument("--cp", default="", help="el CP, si llega aparte (del código de la etiqueta)")
    ap.add_argument("--localidad", default="", help="la población, si llega aparte")
    ap.add_argument("--pais", default="es", help="el país de la cuenta (es, pt, fr, gb, mx…)")
    ap.add_argument("--base", default="", help="«lat,lng» del almacén, si lo hay")
    ap.add_argument("--corpus", default="", help="un corpus como el del laboratorio (JSON)")
    ap.add_argument("--cache", default="", help="respuestas guardadas con el formato del laboratorio (JSON)")
    ap.add_argument("--sin-red", action="store_true", help="solo lo guardado: no se pide nada a la red")
    ap.add_argument("--mal", action="store_true", help="con --corpus, lista las mal situadas y las sin punto")
    ap.add_argument("--caido", default="", help="servicios que no contestan, p. ej. «photon» o «photon,nominatim»")
    ap.add_argument("--sin-cartociudad", action="store_true",
                    help="sin preguntar nada a CartoCiudad: la cadena de las empresas hasta CARTOCIUDAD_EMPRESAS_DESDE")
    a = ap.parse_args()
    if not a.direccion and not a.corpus:
        ap.error("falta la dirección (o --corpus)")
    asyncio.run(principal(a))


if __name__ == "__main__":
    main()
