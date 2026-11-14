# -*- coding: utf-8 -*-
"""Segunda pasada de verdad (14-11-2026): lo que dice el servidor de la IA, del «peritaje» y de quién la llevaba.

La IA, donde existe, marca posibles daños, se equivoca a menudo y decide una persona. Nada de «peritaje», «pericial»,
«cadena de custodia» ni «daños detectados» como hecho; «quién la llevaba», nunca «quién causa».
"""
import ast
import re
from pathlib import Path

import pytest

import afinidad
import demo_comercial
import salud_flota
import server

RAIZ = Path(__file__).resolve().parents[2]


def _textos(ruta: Path) -> str:
    """Solo las cadenas del código (lo que se enseña), sin los comentarios que cuentan lo que decía antes."""
    arbol = ast.parse(ruta.read_text(encoding="utf-8-sig"))
    return "\n".join(n.value for n in ast.walk(arbol) if isinstance(n, ast.Constant) and isinstance(n.value, str))


TEXTOS = _textos(RAIZ / "backend" / "server.py")


@pytest.mark.parametrize("vieja", [
    "PERITAJE — DAÑOS DETECTADOS", "DAÑOS NUEVOS (", "Sin daños nuevos respecto al peritaje anterior",
    "Daños nuevos detectados:", "Daños detectados en ", "nueva inspección con daño",
    "Peritaje técnico de inspección", "Revisión firmada con cadena de custodia", "Resumen del peritaje IA",
    "daño confirmado por dos modelos", "Daños incluidos en el peritaje", "no entran en el peritaje",
    "Firma electrónica y cadena de custodia", "evidencia técnica con cadena de custodia hash",
    "Informe de peritaje IA", "LOCALIZACION DE DAÑOS (IA)", "DAÑOS DETECTADOS", "Peritaje IA - Documento",
    "Evidencia técnica con cadena de custodia hash", "Hash no encontrado", "Hash inválido",
    "Informes periciales con IA", "Validar los daños que ve la IA", "IA no incluida en tu plan",
    "revisiones con IA desde el móvil", "es lo ÚNICO que la hace", "Informe pericial firmado",
    "para reclamar al renting o al seguro", "Quien causa los golpes", "(cadena de custodia cerrada)",
])
def test_el_servidor_ya_no_dice_lo_viejo(vieja):
    assert vieja not in TEXTOS


def test_los_modulos_no_prometen_la_ia_ni_quien_causa():
    que = {m["clave"]: m["que"] for m in server.MODULOS_PANEL}
    assert que["origen-danos"].lower().startswith("quien llevaba")
    assert "pericial" not in que["ia-peritaje"].lower() and "marca la ia" in que["ia-peritaje"].lower()
    assert "posibles" in que["revision"]


def test_la_salud_de_la_flota_no_afirma_lo_que_dice_la_ia():
    textos = _textos(Path(salud_flota.__file__))
    assert "La IA dice que no es seguro circular" not in textos
    assert "La IA marca que puede no ser seguro circular: que lo mire una persona" in textos


def test_la_demo_no_firma_como_ia():
    textos = _textos(Path(demo_comercial.__file__))
    assert "IA de inspección" not in textos and "Aviso automático (sin confirmar)" in textos


def test_afinidad_habla_como_la_pantalla():
    dias = {"c%d" % i: ["2026-%02d-%02d" % (1 + d // 28, 1 + d % 28) for d in range(40)] for i in range(3)}
    ok, por = afinidad.cuidado_predice([], dias)
    assert not ok and por.startswith("solo 0 golpes con una sola persona al volante en la segunda mitad")
    assert "seguros" not in por


# ── Los planes: el respaldo de la web dice LO MISMO que el servidor ───────────

def _lista_js(bloque: str, campo: str) -> list:
    m = re.search(r"(?<![a-z_])" + campo + r": \[(.*?)\]", bloque, re.S)
    assert m, campo
    return [s.replace("\\'", "'") for s in re.findall(r"'((?:[^'\\]|\\.)*)'", m.group(1))]


def _planes_js() -> dict:
    js = (RAIZ / "frontend" / "src" / "lib" / "precios.js").read_text(encoding="utf-8")
    trozos = re.split(r"(?=clave: ')", js)
    planes = {}
    for t in trozos[1:]:
        clave = re.match(r"clave: '([a-z_]+)'", t).group(1)
        if "incluye: [" in t and clave not in planes:
            fin = t.find("clave: '", 10)
            bloque = t if fin < 0 else t[:fin]
            if re.search(r"(?<![a-z_])incluye: \[", bloque):
                planes[clave] = {"incluye": _lista_js(bloque, "incluye"), "no_incluye": _lista_js(bloque, "no_incluye")}
    return planes


@pytest.mark.asyncio(loop_scope="session")
async def test_precios_js_dice_exactamente_lo_que_billing_planes(monkeypatch):
    async def cat(forzar=False):
        return server._catalogo_por_defecto()
    monkeypatch.setattr(server, "_catalogo_planes", cat)
    r = await server.billing_planes()
    servidor = {p["clave"]: p for p in r["planes"]}
    web = _planes_js()
    assert {"operacion", "completo", "holding", "reparto"} <= set(web), sorted(web)
    for clave, p in web.items():
        assert clave in servidor, clave
        assert p["incluye"] == servidor[clave]["incluye"], clave
        assert p["no_incluye"] == servidor[clave]["no_incluye"], clave


@pytest.mark.asyncio(loop_scope="session")
async def test_los_planes_no_venden_peritajes(monkeypatch):
    async def cat(forzar=False):
        return server._catalogo_por_defecto()
    monkeypatch.setattr(server, "_catalogo_planes", cat)
    r = await server.billing_planes()
    junto = " · ".join(x for p in r["planes"] for x in p["incluye"] + p["no_incluye"]).lower()
    for prohibido in ("pericial", "peritaje", "renting o al seguro", "causa los golpes", "detectad"):
        assert prohibido not in junto, prohibido
