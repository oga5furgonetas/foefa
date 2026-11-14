# -*- coding: utf-8 -*-
"""«Antes del perito», arreglos tras la revisión (14-11-2026): la pieza se elige, no se adivina (R1, R2, R3).

La pantalla del repaso manda la CLAVE de la pieza (`pieza_clave`); de ella salen la pieza gruesa del libro y el
nombre en español. Antes se leía el texto con `_canon_panel`, que solo entiende español: dos golpes escritos en
inglés iban los dos a «otros» (y el segundo salía «ya apuntado» en el primero) y «Motorhaube» (capó, en alemán)
daba «Esa pieza no es de la carrocería».
"""
import re
from pathlib import Path

import pytest

import server
from test_perito_repaso import MARTA, falla, insp, marca, marcar, revision, t  # noqa: F401

RAIZ = Path(__file__).resolve().parents[2]
V = "veh-5678"
CAJA = {"severity": "leve", "box_2d": [10, 10, 200, 200]}


def test_la_lista_de_piezas_es_la_misma_que_la_de_la_pantalla():
    """Las claves de `PIEZAS` de la pantalla del repaso (y su `repaso.p.<clave>` en las 6 lenguas) son las del
    servidor, más «otra». Si alguien añade una pieza en un lado y no en el otro, esta prueba lo dice."""
    logica = (RAIZ / "frontend" / "src" / "panel" / "components" / "repaso" / "logica.js").read_text("utf-8")
    bloque = re.search(r"export const PIEZAS = \{(.*?)\n\}", logica, re.S).group(1)
    pantalla = dict(re.findall(r"^\s*(\w+): '([^']+)',?$", bloque, re.M))
    assert pantalla, "no se ha encontrado PIEZAS en logica.js"
    assert set(server._REPASO_PIEZAS) == set(pantalla) | {"otra"}
    for clave, nombre in pantalla.items():
        assert server._REPASO_PIEZAS[clave][1] == nombre, clave
    dic = (RAIZ / "frontend" / "src" / "i18nDict.js").read_text("utf-8")
    for clave in pantalla:
        assert f"'repaso.p.{clave}':" in dic, clave


def test_cada_clave_va_a_la_pieza_gruesa_que_diria_el_libro():
    """La pieza gruesa de cada clave es la que `_canon_panel` da a su nombre en español: el libro, el taller y la
    IA (`_known_damaged_panels`) siguen hablando el mismo idioma."""
    for clave, (panel, nombre) in server._REPASO_PIEZAS.items():
        if clave != "otra":
            assert server._canon_panel(nombre) == panel, clave
    assert server._REPASO_PIEZAS["otra"] == ("otros", None)


@pytest.mark.asyncio(loop_scope="session")
async def test_con_la_clave_manda_la_clave_y_no_el_texto(t):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    # La pantalla en alemán manda el nombre traducido; con la clave, da igual.
    r = await marcar("r12", 1, "golpe", pieza_clave="capo", part="Motorhaube", **CAJA)
    g = r["lado"]["golpe"]
    assert (g["pieza"], g["pieza_clave"], g["panel"]) == ("Capó", "capo", "capo")
    r = await marcar("r12", 2, "golpe", pieza_clave="puerta_tras_der", part="Rear right door", **CAJA)
    assert r["libro"]["accion"] == "nuevo" and r["libro"]["pieza_clave"] == "puerta_tras_der"
    # R2: la clave va en el lado, en la ficha y en el libro.
    d = insp(t, "r12")
    assert d["repaso"]["lados"]["1"]["golpe"]["pieza_clave"] == "capo"
    assert [x["pieza_clave"] for x in d["analysis"]["damages"]] == ["capo", "puerta_tras_der"]
    assert {e["panel"]: e["pieza_clave"] for e in t["vehicle_damage_ledger"].docs} == {
        "capo": "capo", "puerta": "puerta_tras_der"}


@pytest.mark.asyncio(loop_scope="session")
async def test_otra_pieza_va_a_otros_con_su_texto_y_nunca_da_no_es_de_la_carroceria(t):
    t["inspections"].docs.append(revision("r12", V, "drv-ana", marca(12)))
    r = await marcar("r12", 1, "golpe", pieza_clave="otra", part="Motorhaube-Scharnier", **CAJA)
    g = r["lado"]["golpe"]
    assert (g["pieza"], g["pieza_clave"], g["panel"]) == ("Motorhaube-Scharnier", "otra", "otros")
    with falla(400, "Indica la pieza"):
        await marcar("r12", 2, "golpe", pieza_clave="otra", part="", **CAJA)


@pytest.mark.asyncio(loop_scope="session")
async def test_dos_piezas_en_otro_idioma_no_chocan(t):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    a = await marcar("r12", 1, "golpe", pieza_clave="paragolpes_del", part="Front bumper", **CAJA)
    b = await marcar("r12", 2, "golpe", pieza_clave="puerta_tras_izq", part="Rear door", **CAJA)
    assert a["libro"]["accion"] == "nuevo" and b["libro"]["accion"] == "nuevo"
    assert sorted(e["panel"] for e in t["vehicle_damage_ledger"].docs) == ["paragolpes", "puerta"]


@pytest.mark.asyncio(loop_scope="session")
async def test_una_clave_que_no_existe_da_400(t):
    t["inspections"].docs.append(revision("r12", V, "drv-ana", marca(12)))
    for mala in ("motor", "", 7, ["capo"]):
        with falla(400, "Esa pieza no está en la lista"):
            await marcar("r12", 1, "golpe", pieza_clave=mala, part="Capó", **CAJA)
    assert "repaso" not in insp(t, "r12")


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_clave_sigue_como_antes(t):
    t["inspections"].docs.append(revision("r12", V, "drv-ana", marca(12)))
    r = await marcar("r12", 1, "golpe", part="Paragolpes delantero", **CAJA)
    assert r["lado"]["golpe"]["pieza_clave"] is None and r["lado"]["golpe"]["panel"] == "paragolpes"
    with falla(400, "no es de la carrocería"):
        await marcar("r12", 2, "golpe", part="Salpicadero", **CAJA)


@pytest.mark.asyncio(loop_scope="session")
async def test_ya_apuntado_nombra_la_pieza_que_estaba_con_su_clave(t):
    t["inspections"].docs += [revision("r11", V, "drv-ana", marca(11)), revision("r12", V, "drv-ana", marca(12))]
    await marcar("r12", 3, "golpe", pieza_clave="corredera_izq", **CAJA)
    r = await marcar("r12", 4, "golpe", pieza_clave="puerta_del_der", **CAJA)
    assert r["libro"]["accion"] == "ya_apuntado"
    assert (r["libro"]["pieza"], r["libro"]["pieza_clave"]) == ("Puerta lateral corredera izquierda", "corredera_izq")
    exp = await server.expediente_antes_del_perito(V, user=MARTA)
    assert sorted(g["pieza_clave"] for g in exp["golpes"]) == ["corredera_izq", "puerta_del_der"]
