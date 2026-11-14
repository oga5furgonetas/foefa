# -*- coding: utf-8 -*-
"""Origen de daños: QUÉ foto viaja como prueba (14-11-2026).

Hasta hoy la «foto limpia» y la «foto con el golpe» eran siempre la primera de
cada inspección, sin mirar dónde estaba el golpe: con el golpe en la tercera
foto, la pantalla enseñaba dos frontales donde no se ve nada, y en la demo
(mismas fotos en todas las inspecciones) las dos eran la misma imagen.

Aquí se llama a `danos_atribucion` entera sobre una base de mentira y se mira
la regla de `_atr_fotos_prueba`: la del golpe es la del `photo_index` de ESE
daño en la inspección que lo vio; la limpia, la de la MISMA vista (o, sin
vistas, el mismo índice); y si no se puede, lo de siempre (la primera). La
certeza y los conductores no cambian.
"""
from datetime import datetime, timedelta, timezone

import pytest

import server
from base_de_mentira import Col, Db

YO = {"sub": "u1", "role": "admin", "name": "Jefe"}
PIEZA = "puerta lateral izquierda"


def _dia(atras):
    return (datetime.now(timezone.utc) - timedelta(days=atras)).replace(
        hour=19, minute=0, second=0, microsecond=0).isoformat()


def _fotos(prefijo, n):
    return [f"https://fotos.test/{prefijo}-{k + 1}.jpg" for k in range(n)]


def _base(limpia: dict, golpe: dict, dano: dict = None):
    """Una furgoneta, un conductor, la revisión limpia de ayer y la de hoy con el golpe."""
    t = Db()
    t["vehicles"] = Col([{"id": "v1", "license_plate": "1234BCD", "center": "MADRID", "status": "activo"}])
    t["drivers"] = Col([{"id": "d1", "name": "Ana", "email": "ana@x.es"}])
    li = {"id": "i1", "vehicle_id": "v1", "driver_id": "d1", "created_at": _dia(2), **limpia}
    go = {"id": "i2", "vehicle_id": "v1", "driver_id": "d1", "created_at": _dia(1), **golpe}
    t["inspections"] = Col([li, go])
    t["vehicle_damage_ledger"] = Col([{
        "_id": "l1", "vehicle_id": "v1", "panel": server._canon_panel(PIEZA), "part": PIEZA,
        "severity": "grave", "status": "open", "first_seen": go["created_at"][:10],
        # Confirmado por una persona (tercera tanda, S7): lo que solo marcó la IA no pasa nunca de «media», y aquí se
        # prueba qué foto viaja con un «alta».
        "first_seen_inspection": "i2", "source": "human", **(dano or {})}])
    return t


def _analisis(pi):
    d = {"part": PIEZA, "severity": "grave"}
    if pi is not None:
        d["photo_index"] = pi
    return {"analysis": {"damages": [d], "new_damages": [dict(d)]}}


async def _uno(monkeypatch, t):
    monkeypatch.setattr(server, "db", t)
    r = await server.danos_atribucion(center="", dias=120, solo_alta=False, _=YO)
    assert r["total"] == 1, r
    return r["danos"][0]


@pytest.mark.asyncio(loop_scope="session")
async def test_golpe_en_la_tercera_foto_viaja_la_tercera_de_las_dos(monkeypatch):
    d = await _uno(monkeypatch, _base({"photos": _fotos("limpia", 4)},
                                      {"photos": _fotos("golpe", 4), **_analisis(3)}))
    assert d["foto_golpe"] == "https://fotos.test/golpe-3.jpg"
    assert d["foto_limpia"] == "https://fotos.test/limpia-3.jpg"
    # Lo demás, como siempre: un día, una persona, grave -> se nombra.
    assert d["certeza"] == "alta" and [c["nombre"] for c in d["conductores"]] == ["Ana"]


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_photo_index_es_como_hasta_hoy(monkeypatch):
    d = await _uno(monkeypatch, _base({"photos": _fotos("limpia", 4)},
                                      {"photos": _fotos("golpe", 4), **_analisis(None)}))
    assert d["foto_golpe"] == "https://fotos.test/golpe-1.jpg"
    assert d["foto_limpia"] == "https://fotos.test/limpia-1.jpg"


@pytest.mark.asyncio(loop_scope="session")
async def test_photo_index_fuera_de_rango_es_como_hasta_hoy(monkeypatch):
    d = await _uno(monkeypatch, _base({"photos": _fotos("limpia", 4)},
                                      {"photos": _fotos("golpe", 2), **_analisis(7)}))
    assert d["foto_golpe"] == "https://fotos.test/golpe-1.jpg"
    assert d["foto_limpia"] == "https://fotos.test/limpia-1.jpg"


@pytest.mark.asyncio(loop_scope="session")
async def test_la_limpia_tiene_menos_fotos_cae_a_la_primera(monkeypatch):
    d = await _uno(monkeypatch, _base({"photos": _fotos("limpia", 2)},
                                      {"photos": _fotos("golpe", 4), **_analisis(3)}))
    assert d["foto_golpe"] == "https://fotos.test/golpe-3.jpg"
    assert d["foto_limpia"] == "https://fotos.test/limpia-1.jpg"


@pytest.mark.asyncio(loop_scope="session")
async def test_con_vistas_en_otro_orden_empareja_por_vista(monkeypatch):
    # Hoy el lateral izquierdo es la 3.ª; ayer era la 4.ª. El mismo índice daría la frontal.
    d = await _uno(monkeypatch, _base(
        {"photos": _fotos("limpia", 4), "photo_vistas": ["trasera", "lateral_der", "frontal", "lateral_izq"]},
        {"photos": _fotos("golpe", 4), "photo_vistas": ["frontal", "trasera", "lateral_izq", "lateral_der"],
         **_analisis(3)}))
    assert d["foto_golpe"] == "https://fotos.test/golpe-3.jpg"
    assert d["foto_limpia"] == "https://fotos.test/limpia-4.jpg"


@pytest.mark.asyncio(loop_scope="session")
async def test_vistas_por_roles_del_portal(monkeypatch):
    # Inspección vieja sin `photo_vistas` pero con `photo_roles`: el cuentakilómetros va
    # delante, así que el lateral izquierdo de ayer es la 4.ª y no la 3.ª.
    d = await _uno(monkeypatch, _base(
        {"photos": _fotos("limpia", 5), "photo_roles": ["odometer", "angle", "angle", "angle", "angle"]},
        {"photos": _fotos("golpe", 4), "photo_vistas": ["frontal", "trasera", "lateral_izq", "lateral_der"],
         **_analisis(3)}))
    assert d["foto_limpia"] == "https://fotos.test/limpia-4.jpg"


@pytest.mark.asyncio(loop_scope="session")
async def test_la_limpia_no_tiene_esa_vista_cae_a_la_primera(monkeypatch):
    d = await _uno(monkeypatch, _base(
        {"photos": _fotos("limpia", 2), "photo_vistas": ["frontal", "trasera"]},
        {"photos": _fotos("golpe", 4), "photo_vistas": ["frontal", "trasera", "lateral_izq", "lateral_der"],
         **_analisis(3)}))
    assert d["foto_golpe"] == "https://fotos.test/golpe-3.jpg"
    assert d["foto_limpia"] == "https://fotos.test/limpia-1.jpg"


@pytest.mark.asyncio(loop_scope="session")
async def test_se_prefiere_la_anotada_de_esa_misma_foto(monkeypatch):
    anot = ["https://fotos.test/anot-1.jpg", None, "https://fotos.test/anot-3.jpg", None]
    d = await _uno(monkeypatch, _base({"photos": _fotos("limpia", 4)},
                                      {"photos": _fotos("golpe", 4), "annotated_photos": anot,
                                       **_analisis(3)}))
    assert d["foto_golpe"] == "https://fotos.test/anot-3.jpg"
    # Sin anotada en esa posición, la original de esa posición (no la anotada de otra).
    anot2 = ["https://fotos.test/anot-1.jpg", None, None, None]
    d = await _uno(monkeypatch, _base({"photos": _fotos("limpia", 4)},
                                      {"photos": _fotos("golpe", 4), "annotated_photos": anot2,
                                       **_analisis(3)}))
    assert d["foto_golpe"] == "https://fotos.test/golpe-3.jpg"


@pytest.mark.asyncio(loop_scope="session")
async def test_se_casa_por_panel_si_la_pieza_va_escrita_distinto(monkeypatch):
    t = _base({"photos": _fotos("limpia", 4)}, {"photos": _fotos("golpe", 4), **_analisis(3)},
              dano={"part": "Puerta Lateral Izquierda (golpe)"})
    d = await _uno(monkeypatch, t)
    assert d["foto_golpe"] == "https://fotos.test/golpe-3.jpg"


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_foto_limpia_no_se_senala_a_nadie_igual_que_antes(monkeypatch):
    d = await _uno(monkeypatch, _base({"photos": []}, {"photos": _fotos("golpe", 4), **_analisis(3)}))
    assert d["foto_limpia"] is None and d["foto_golpe"] == "https://fotos.test/golpe-3.jpg"
    assert d["certeza"] == "media" and "falta una de las dos fotos" in d["motivo"]


# ── Lo que cerró la segunda revisión (14-11-2026) ─────────────────────────────
# Un análisis con forma rara (guardado a mano o por una ruta vieja) no puede
# tumbar «Origen de daños» con un 500: sale lo mismo que con el código de antes
# del arreglo de las fotos (la certeza, los conductores) y las dos primeras fotos.

async def _todo(monkeypatch, t):
    monkeypatch.setattr(server, "db", t)
    return await server.danos_atribucion(center="", dias=120, solo_alta=False, _=YO)


async def _como_antes(monkeypatch, t):
    """Lo que daba la ruta antes de elegir la foto del golpe: siempre las primeras."""
    with monkeypatch.context() as m:
        m.setattr(server, "_atr_fotos_prueba",
                  lambda limpia, actual, d: (server._atr_foto_primera(limpia), server._atr_foto_primera(actual)))
        return await _todo(m, t)


_D = {"part": PIEZA, "severity": "grave", "photo_index": 3}
FORMAS_RARAS = {
    "analisis_texto": {"analysis": "roto"},
    "analisis_lista": {"analysis": [_D]},
    "damages_objeto": {"analysis": {"damages": dict(_D), "new_damages": dict(_D)}},
    "damages_texto": {"analysis": {"damages": "puerta", "new_damages": 7}},
    "danos_no_objeto": {"analysis": {"damages": ["puerta", 5, None], "new_damages": [[_D]]}},
    "part_numero": {"analysis": {"damages": [{**_D, "part": 5}], "new_damages": [{**_D, "part": ["x"]}]}},
    "photo_index_bool": {"analysis": {"damages": [{**_D, "photo_index": True}]}},
    "photo_index_texto": {"analysis": {"damages": [{**_D, "photo_index": "3"}]}},
    "photo_index_decimal": {"analysis": {"damages": [{**_D, "photo_index": 3.0}]}},
    "photo_index_negativo": {"analysis": {"damages": [{**_D, "photo_index": -1}]}},
    "photo_index_cero": {"analysis": {"damages": [{**_D, "photo_index": 0}]}},
    "photo_index_enorme": {"analysis": {"damages": [{**_D, "photo_index": 10 ** 30}]}},
    "photos_objeto": {"photos": {"a": "https://fotos.test/golpe-1.jpg"}, **_analisis(3)},
    "photos_texto": {"photos": "https://fotos.test/golpe-1.jpg", **_analisis(1)},
}
# Con el golpe bien apuntado (foto 3) pero otro campo raro: no lanza, la certeza y
# los conductores son los de antes, y viaja la 3.ª (la anotada que no es lista no
# cuenta; las vistas que no se entienden, el mismo índice).
OTRAS_RARAS = {
    "anotadas_texto": {"annotated_photos": "https://fotos.test/anot.jpg"},
    "anotadas_objeto": {"annotated_photos": {"2": "https://fotos.test/anot.jpg"}},
    "anotada_no_texto": {"annotated_photos": [None, None, 5, None]},
    "vistas_raras": {"photo_vistas": {"x": 1}, "photo_roles": 5},
}


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("forma", sorted(FORMAS_RARAS))
async def test_un_analisis_con_forma_rara_no_tumba_la_pantalla(monkeypatch, forma):
    golpe = {"photos": _fotos("golpe", 4), **FORMAS_RARAS[forma]}
    limpia = {"photos": _fotos("limpia", 4)}
    # La función de dentro tampoco lanza (el `try` de la ruta es la última red).
    t = _base(limpia, golpe)
    server._atr_fotos_prueba(t["inspections"].docs[0], t["inspections"].docs[1],
                             t["vehicle_damage_ledger"].docs[0])
    r = await _todo(monkeypatch, _base(limpia, golpe))
    antes = await _como_antes(monkeypatch, _base(limpia, golpe))
    assert r == antes
    if isinstance(golpe["photos"], list):
        d = r["danos"][0]
        assert d["foto_golpe"] == "https://fotos.test/golpe-1.jpg"
        assert d["foto_limpia"] == "https://fotos.test/limpia-1.jpg"
        assert d["certeza"] == "alta"


@pytest.mark.asyncio(loop_scope="session")
async def test_si_elegir_la_foto_falla_salen_las_dos_de_siempre(monkeypatch):
    def revienta(*a):
        raise TypeError("forma rara")
    monkeypatch.setattr(server, "_atr_fotos_prueba", revienta)
    d = await _uno(monkeypatch, _base({"photos": _fotos("limpia", 4)},
                                      {"photos": _fotos("golpe", 4), **_analisis(3)}))
    assert d["foto_golpe"] == "https://fotos.test/golpe-1.jpg"
    assert d["foto_limpia"] == "https://fotos.test/limpia-1.jpg"
    assert d["certeza"] == "alta"


@pytest.mark.asyncio(loop_scope="session")
async def test_si_la_foto_del_golpe_esta_vacia_salen_las_dos_primeras(monkeypatch):
    # El golpe dice «foto 3», pero la 3.ª está vacía: no se enseña la limpia de la
    # vista 3 contra la del golpe de la vista 1, sino las dos primeras.
    fotos = _fotos("golpe", 2) + [""]
    d = await _uno(monkeypatch, _base({"photos": _fotos("limpia", 3)},
                                      {"photos": fotos, **_analisis(3)}))
    assert d["foto_golpe"] == "https://fotos.test/golpe-1.jpg"
    assert d["foto_limpia"] == "https://fotos.test/limpia-1.jpg"


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("forma", sorted(OTRAS_RARAS))
async def test_otro_campo_raro_con_el_golpe_bien_apuntado(monkeypatch, forma):
    golpe = {"photos": _fotos("golpe", 4), **_analisis(3), **OTRAS_RARAS[forma]}
    limpia = {"photos": _fotos("limpia", 4)}
    r = await _todo(monkeypatch, _base(limpia, golpe))
    antes = await _como_antes(monkeypatch, _base(limpia, golpe))
    quita = lambda x: [{k: v for k, v in d.items() if not k.startswith("foto_")} for d in x["danos"]]  # noqa: E731
    assert quita(r) == quita(antes) and r["resumen"] == antes["resumen"]
    d = r["danos"][0]
    assert d["foto_golpe"] == "https://fotos.test/golpe-3.jpg"
    assert d["foto_limpia"] == "https://fotos.test/limpia-3.jpg"
