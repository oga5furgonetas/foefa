# -*- coding: utf-8 -*-
"""La demo pública del panel, CON FOTOS (14-11-2026).

La página de venta promete «cada conductor revisa su furgoneta con fotos; si
aparece un golpe, sabes qué día fue y quién la llevaba» y lleva a «Ver la demo
del panel» (`POST /auth/demo-login`, base `dsp_demo`). La demo se sembraba con
`photos: []`: quien la abría veía inspecciones vacías. Aquí se siembra en una
base de mentira y se comprueba que cada inspección trae fotos que existen en la
web, que cada golpe se puede pintar EN SU SITIO sobre la foto, y que los
números de la demo (inspecciones, golpes, euros) son los de siempre.
"""
from pathlib import Path
from urllib.parse import urlparse

import pytest

import server
from base_de_mentira import Db

PUBLICO = Path(__file__).resolve().parents[2] / "frontend" / "public"

# Los números de la demo ANTES de las fotos (calculados a mano sobre el bucle
# de `_seed_demo_data`: hay golpe cuando (día*5 + j) % 9 == 0, o sea en
# (0,0) (1,4) (3,3) (5,2) (7,1) (9,0); importes 90+520+90+240+520+90).
N_INSPECCIONES = 50
N_GOLPES = 6
SUMA_IMPORTES = 1550


class _Cliente(dict):
    """`server.client[nombre]` -> una base de mentira por nombre."""
    def __missing__(self, nombre):
        self[nombre] = Db()
        return self[nombre]


@pytest.fixture
def demo(monkeypatch):
    cli = _Cliente()
    monkeypatch.setattr(server, "client", cli)
    return cli


async def _sembrar(cli):
    await server._seed_demo_data()
    return cli[server._DEMO_DB].inspections.docs


def _fichero_de(url):
    """La ruta de la foto en `frontend/public` (vale absoluta o relativa)."""
    ruta = urlparse(url).path if "://" in url else url
    assert ruta.startswith("/demo/"), f"la foto no sale de /demo/: {url}"
    return PUBLICO / ruta.lstrip("/")


@pytest.mark.asyncio(loop_scope="session")
async def test_todas_las_inspecciones_llevan_foto_que_existe(demo):
    insps = await _sembrar(demo)
    assert insps, "la demo no sembró inspecciones"
    for i in insps:
        fotos = i.get("photos") or []
        assert fotos, f"{i['id']} sin fotos"
        for url in fotos:
            assert isinstance(url, str) and url
            assert _fichero_de(url).is_file(), f"{url} no está en frontend/public"
        # Sin foto anotada: si la hubiera, el panel no pinta las cajas encima.
        assert not any(i.get("annotated_photos") or [])


@pytest.mark.asyncio(loop_scope="session")
async def test_la_url_es_absoluta_para_que_el_pdf_la_pueda_bajar(demo):
    # `/inspections/{id}/pdf`, el parte de daño y `/annotated` descargan la foto
    # desde el servidor: solo saben de «http…», de «/uploads/…» o de base64.
    insps = await _sembrar(demo)
    assert insps[0]["photos"]
    for url in insps[0]["photos"]:
        assert url.startswith(server._PORTAL_BASE_FRONT + "/demo/"), url


@pytest.mark.asyncio(loop_scope="session")
async def test_cada_golpe_se_puede_pintar_en_su_sitio(demo):
    from PIL import Image
    insps = await _sembrar(demo)
    golpes = 0
    for i in insps:
        a = i["analysis"]
        for d in a["damages"] + a["new_damages"]:
            golpes += 1
            pi = d.get("photo_index")
            assert isinstance(pi, int) and 1 <= pi <= len(i["photos"]), d
            caja = d.get("box_2d")
            assert isinstance(caja, list) and len(caja) == 4 and all(isinstance(v, int) for v in caja), d
            y0, x0, y1, x1 = caja
            assert 0 <= y0 < y1 <= 1000 and 0 <= x0 < x1 <= 1000, f"caja fuera de la foto: {caja}"
            # Lo que exige el PDF para dibujarla y la cola de «IA para revisar» para enseñarla.
            assert server._is_box_valid(caja), f"caja demasiado pequeña para el PDF: {caja}"
            assert d.get("confidence", 0) >= server._FORENSIC_CONFIDENCE_MIN
            assert d.get("part") and d.get("severity") and d.get("confirmed") is True
            # La pieza cuadra con la foto: la aleta, en la frontal; lo demás, en la lateral.
            foto = Path(urlparse(i["photos"][pi - 1]).path).name
            esperada = "van-frontal.jpg" if d["part"] == "aleta delantera izquierda" else "van-lateral.jpg"
            assert foto == esperada, (d["part"], foto)
            # Y la caja cae sobre la furgoneta, no en el cielo: dentro de la mitad
            # de abajo de la lateral (la furgoneta va de y≈320 a y≈860 en 0-1000).
            if foto == "van-lateral.jpg":
                assert 300 <= y0 and y1 <= 880 and 220 <= x0 and x1 <= 950, (d["part"], caja)
            with Image.open(_fichero_de(i["photos"][pi - 1])) as im:
                assert im.size[0] > 0 and im.size[1] > 0
    assert golpes == 2 * N_GOLPES  # cada golpe va en `damages` y en `new_damages`


@pytest.mark.asyncio(loop_scope="session")
async def test_los_numeros_de_la_demo_no_cambian(demo):
    insps = await _sembrar(demo)
    assert len(insps) == N_INSPECCIONES
    con_golpe = [i for i in insps if i["analysis"]["total_damages_count"]]
    assert len(con_golpe) == N_GOLPES
    assert sum(len(i["analysis"]["damages"]) for i in insps) == N_GOLPES
    assert sum(i["analysis"]["total_estimated_cost"] for i in insps) == SUMA_IMPORTES
    assert sum(d["estimated_cost"] for i in insps for d in i["analysis"]["damages"]) == SUMA_IMPORTES


@pytest.mark.asyncio(loop_scope="session")
async def test_es_determinista(demo):
    a = await _sembrar(demo)
    otra = _Cliente()
    server.client = otra
    b = await _sembrar(otra)
    quita = lambda xs: [{k: v for k, v in x.items() if k != "created_at"} for x in xs]  # noqa: E731
    assert quita(a) == quita(b)


# ── Lo que cerró la revisión (14-11-2026) ────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_la_aleta_lleva_la_zona_del_vocabulario_de_la_ia(demo):
    # La aleta se ve en la frontal (foto 2), pero es chapa del lateral izquierdo:
    # la pista de zona usa el vocabulario de la IA y `salud_flota.zona` le hace caso.
    import salud_flota as sf
    insps = await _sembrar(demo)
    aletas = [d for i in insps for d in i["analysis"]["damages"] if d["part"] == "aleta delantera izquierda"]
    assert aletas, "la demo ya no siembra la aleta"
    for d in aletas:
        assert d["photo_index"] == 2
        assert d["location_hint"] == "lateral_izquierdo"
        assert sf.zona(d["part"], "", d["location_hint"]) == "lat_izq"
    vocab = {"frontal", "trasera", "lateral_izquierdo", "lateral_derecho", "techo", "otra"}
    assert all(d["location_hint"] in vocab for i in insps for d in i["analysis"]["damages"])


async def _origen_de_la_demo():
    """«Origen de daños» de la demo, con la base de la demo puesta como en una petición suya."""
    tok = server._current_db_name.set(server._DEMO_DB)
    try:
        return await server.danos_atribucion(center="", dias=120, solo_alta=False,
                                             _={"sub": "demo-user", "role": "admin", "demo": True})
    finally:
        server._current_db_name.reset(tok)


def _fechas_de(ddb):
    return {i["id"]: i["created_at"][:10] for i in ddb.inspections.docs}


@pytest.mark.asyncio(loop_scope="session")
async def test_al_regenerar_origen_de_danos_sale_lleno_sin_abrir_ninguna_ficha(demo):
    # Antes (14-11-2026, segunda revisión) el libro se borraba al regenerar y no lo
    # rellenaba nadie: «Origen de daños» salía vacía hasta abrir las fichas una a una.
    ddb = demo[server._DEMO_DB]
    await server._demo_regenerar()
    r = await _origen_de_la_demo()
    assert r["total"] == 5, r          # 6 golpes sembrados en 5 paneles de furgoneta distintos
    assert r["resumen"] == {"alta": 0, "media": 1, "baja": 4}, r["resumen"]
    fechas = _fechas_de(ddb)
    # (La base de mentira no pone `_id`: se casa cada fila con su apunte por furgoneta y panel.)
    apuntes = {(e["vehicle_id"], e["panel"]): e for e in ddb.vehicle_damage_ledger.docs}
    assert len(apuntes) == len(ddb.vehicle_damage_ledger.docs) == 5
    for d in r["danos"]:
        e = apuntes[(d["vehicle_id"], d["panel"])]
        assert d["aparecio"] == fechas[e["first_seen_inspection"]], (d, e)
        assert d["foto_golpe"], d


@pytest.mark.asyncio(loop_scope="session")
async def test_el_libro_rehecho_es_identico_al_que_crea_abrir_las_fichas(demo):
    ddb = demo[server._DEMO_DB]
    await server._demo_regenerar()
    rehecho = list(ddb.vehicle_damage_ledger.docs)
    assert rehecho
    # Lo que habría creado `_get_vehicle_ledger` abriendo cada ficha sobre el libro vacío.
    ddb.vehicle_damage_ledger.docs.clear()
    tok = server._current_db_name.set(server._DEMO_DB)
    try:
        for v in ddb.vehicles.docs:
            await server._get_vehicle_ledger(v["id"])
    finally:
        server._current_db_name.reset(tok)
    quita = lambda xs: sorted(({k: v for k, v in x.items() if k not in ("_id", "updated_at")}  # noqa: E731
                               for x in xs), key=lambda x: (x["vehicle_id"], x["panel"]))
    assert quita(rehecho) == quita(ddb.vehicle_damage_ledger.docs)


@pytest.mark.asyncio(loop_scope="session")
async def test_regenerar_deja_la_base_de_la_peticion_como_estaba(demo, monkeypatch):
    # `_demo_regenerar` corre dentro de la petición de `demo-login`, con otra base puesta.
    tok = server._current_db_name.set("empresa_x")
    try:
        await server._demo_regenerar()
        assert server._current_db_name.get() == "empresa_x"
        assert demo["empresa_x"].vehicle_damage_ledger.docs == []
        # Y aunque rehacer el libro falle a medias.
        async def revienta(*a, **k):
            raise RuntimeError("fallo")
        monkeypatch.setattr(server, "_get_vehicle_ledger", revienta)
        await demo[server._DEMO_DB].app_meta.update_one({"_id": "demo_dia"}, {"$set": {"clave": "otra-hora"}})
        await server._demo_regenerar()
        assert server._current_db_name.get() == "empresa_x"
        assert len(demo[server._DEMO_DB].inspections.docs) == N_INSPECCIONES
    finally:
        server._current_db_name.reset(tok)


@pytest.mark.asyncio(loop_scope="session")
async def test_al_regenerar_no_queda_libro_de_danos_de_la_tanda_anterior(demo):
    ddb = demo[server._DEMO_DB]
    await server._demo_regenerar()
    # La cache de cajas de `/annotated`.
    await ddb.inspection_ai_results.insert_one({"inspection_id": "demo-i0-0", "photo_index": 0,
                                                "source": "gemini_anotada", "detections": []})
    # Lo que quedaría de la tanda anterior: un apunte con fecha vieja.
    vid = next(i["vehicle_id"] for i in ddb.inspections.docs if i["analysis"]["damages"])
    await ddb.vehicle_damage_ledger.insert_one({"vehicle_id": vid, "panel": "x", "status": "open",
                                                "first_seen": "2026-01-01", "first_seen_inspection": "vieja"})
    # Pasa la hora: se regenera.
    await ddb.app_meta.update_one({"_id": "demo_dia"}, {"$set": {"clave": "otra-hora"}})
    await server._demo_regenerar()
    assert ddb.inspection_ai_results.docs == []
    assert len(ddb.inspections.docs) == N_INSPECCIONES
    # El libro está lleno, y solo con lo de las inspecciones nuevas: cada fecha, la de la suya.
    assert ddb.vehicle_damage_ledger.docs
    fechas = _fechas_de(ddb)
    for e in ddb.vehicle_damage_ledger.docs:
        assert e["first_seen_inspection"] in fechas, e
        assert e["first_seen"] == fechas[e["first_seen_inspection"]], e


@pytest.mark.asyncio(loop_scope="session")
async def test_la_regeneracion_no_toca_otra_base(demo):
    otra = demo["flota"]
    await otra.vehicle_damage_ledger.insert_one({"vehicle_id": "v-real", "panel": "puerta", "status": "open"})
    await otra.inspection_ai_results.insert_one({"inspection_id": "real", "photo_index": 0})
    await server._demo_regenerar()
    assert len(otra.vehicle_damage_ledger.docs) == 1 and len(otra.inspection_ai_results.docs) == 1


def _jpeg():
    import base64
    import io
    from PIL import Image
    b = io.BytesIO()
    Image.new("RGB", (64, 48), (200, 200, 200)).save(b, format="JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()


async def _ia_vigilada(monkeypatch, demo, base):
    """Una inspección SIN golpes (la que hacía ir a la IA) en `base`, y una IA de mentira que apunta si la llaman."""
    llamadas = []

    async def ia(img_bytes):
        llamadas.append(len(img_bytes))
        return [], True
    monkeypatch.setattr(server, "_detectar_cajas_danos", ia)
    foto = _jpeg()
    await demo[base].inspections.insert_one({
        "id": "sin-golpes", "vehicle_id": "v", "photos": [foto, foto], "annotated_photos": [],
        "analysis": {"severity": "sin_danos", "damages": [], "new_damages": []}, "created_at": "2026-11-14T10:00:00"})
    return llamadas


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("ruta", ["annotated", "annotated_una", "pdf"])
async def test_con_la_demo_las_rutas_get_no_gastan_la_ia(demo, monkeypatch, ruta):
    llamadas = await _ia_vigilada(monkeypatch, demo, server._DEMO_DB)
    tok = server._current_db_name.set(server._DEMO_DB)
    try:
        yo = {"sub": "demo-user", "role": "admin", "demo": True}
        if ruta == "annotated":
            r = await server.inspection_annotated("sin-golpes", 0, _=yo)
        elif ruta == "annotated_una":
            r = await server.inspection_annotated("sin-golpes", 1, _=yo)
        else:
            r = await server.inspection_pdf("sin-golpes", boxes=1, _=yo)
    finally:
        server._current_db_name.reset(tok)
    assert r.status_code == 200 and r.body
    assert llamadas == [], "con el token de la demo se ha llamado a la IA"
    assert demo[server._DEMO_DB].inspection_ai_results.docs == []


@pytest.mark.asyncio(loop_scope="session")
async def test_con_la_base_de_la_demo_aunque_el_token_no_lo_diga(demo, monkeypatch):
    llamadas = await _ia_vigilada(monkeypatch, demo, server._DEMO_DB)
    tok = server._current_db_name.set(server._DEMO_DB)
    try:
        await server.inspection_annotated("sin-golpes", 0, _={"sub": "x", "role": "admin"})
    finally:
        server._current_db_name.reset(tok)
    assert llamadas == []


@pytest.mark.asyncio(loop_scope="session")
async def test_una_empresa_de_verdad_sigue_usando_la_ia(demo, monkeypatch):
    # El control: sin él, la prueba de arriba pasaría también si la IA no se llamase nunca.
    llamadas = await _ia_vigilada(monkeypatch, demo, "empresa_x")
    tok = server._current_db_name.set("empresa_x")
    try:
        await server.inspection_annotated("sin-golpes", 0, _={"sub": "u", "role": "admin"})
    finally:
        server._current_db_name.reset(tok)
    assert len(llamadas) == 2


# ── `/inspections/{id}/pdf` y su `?boxes=` (14-11-2026) ──────────────────────
# La lista de las tres cajas del resumen se llamaba `boxes` y pisaba el
# parámetro: la IA se llamaba en cada descarga, aunque se pidiera `boxes=0`.

def _texto_del_pdf(cuerpo: bytes) -> str:
    """El texto de las páginas: ReportLab las guarda en ASCII85 + Flate."""
    import base64
    import re
    import zlib
    trozos = [cuerpo]
    for m in re.finditer(rb"stream\r?\n(.*?)endstream", cuerpo, re.S):
        datos = m.group(1).strip()
        try:
            trozos.append(zlib.decompress(base64.a85decode(datos.replace(b"~>", b""))))
        except Exception:                                    # noqa: BLE001
            pass
    return b"".join(trozos).decode("latin-1")


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("boxes,esperadas", [(0, 0), (1, 1)])
async def test_el_pdf_solo_llama_a_la_ia_si_se_pide(demo, monkeypatch, boxes, esperadas):
    llamadas = []

    async def ia(img_bytes):
        llamadas.append(len(img_bytes))
        return [{"box_2d": [100, 100, 600, 600], "label": "Rozadura", "severity": "leve"}], True
    monkeypatch.setattr(server, "_detectar_cajas_danos", ia)
    foto = _jpeg()
    await demo["empresa_x"].inspections.insert_one({
        "id": "con-golpe", "vehicle_id": "v", "photos": [foto, foto], "annotated_photos": [],
        "created_at": "2026-11-14T10:00:00",
        "analysis": {"severity": "leve", "total_estimated_cost": 90, "executive_summary": "Una rozadura.",
                     "damages": [{"part": "puerta", "severity": "leve", "estimated_cost": 90}]}})
    tok = server._current_db_name.set("empresa_x")
    try:
        r = await server.inspection_pdf("con-golpe", boxes=boxes, _={"sub": "u", "role": "admin"})
    finally:
        server._current_db_name.reset(tok)
    assert len(llamadas) == esperadas
    assert r.status_code == 200 and r.body.startswith(b"%PDF")
    texto = _texto_del_pdf(r.body)
    # El resumen de las tres cajas sigue saliendo.
    for rotulo in ("SEVERIDAD", "COSTE ESTIMADO", "LEVE", "90 EUR"):
        assert rotulo in texto, rotulo
    assert ("LOCALIZACION DE DA" in texto) == bool(esperadas)
