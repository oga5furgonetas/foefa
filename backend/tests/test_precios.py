# -*- coding: utf-8 -*-
"""Precios del 06-10-2026 (docs/PRECIOS.md): Esencial 5 €, Pro 9 €, Empresa a medida desde 12 €,
descuento por volumen y lo que abre cada plan. Lo que dice la página de precios tiene que ser lo
que se cobra y lo que la app abre."""
import pytest

import server


@pytest.mark.parametrize("n,pct", [(0, 0), (49, 0), (50, 10), (149, 10), (150, 15), (299, 15), (300, 20), (5000, 20)])
def test_descuento_por_volumen(n, pct):
    assert server._descuento_volumen(n) == pct


def test_precio_con_minimo_y_volumen():
    assert server._precio_mensual("operacion", 3) == 50            # mínimo de 10 en Esencial
    assert server._precio_mensual("completo", 10) == 180           # mínimo de 20 en Pro
    assert server._precio_mensual("completo", 49) == 441           # sin descuento
    assert server._precio_mensual("completo", 50) == 405           # 450 − 10 %
    assert server._precio_mensual("completo", 150) == 1147.5       # 1.350 − 15 %: lo de Auto Radio
    assert server._precio_mensual("completo", 300) == 2160         # 2.700 − 20 %
    assert server._precio_mensual("holding", 150) == 0             # Empresa: a medida
    assert server._precio_mensual("autonomo", 150) == 9.99         # el repartidor no va por vehículo


@pytest.mark.asyncio(loop_scope="session")
async def test_la_pagina_de_precios_dice_lo_mismo_que_se_cobra(monkeypatch):
    async def cat(forzar=False):
        return server._catalogo_por_defecto()
    monkeypatch.setattr(server, "_catalogo_planes", cat)
    r = await server.billing_planes()
    nombres = {p["clave"]: p["nombre"] for p in r["planes"]}
    assert nombres["operacion"] == "Esencial" and nombres["completo"] == "Pro" and nombres["holding"] == "Empresa"
    pro = next(p for p in r["planes"] if p["clave"] == "completo")
    assert pro["por_vehiculo"] == 9 and pro["minimo_vehiculos"] == 20 and pro["recomendado"] is True
    assert r["descuentos_volumen"] == [{"desde": 50, "pct": 10}, {"desde": 150, "pct": 15}, {"desde": 300, "pct": 20}]
    assert r["desde_empresa"] == 12
    assert {c["clave"] for c in r["complementos"]} >= {"reparto", "whatsapp", "implantacion", "colaboradores"}
    # Y el precio que calcula la app para 150 Pro es el mismo que la web.
    assert await server._precio_vigente("completo", 150) == 1147.5


def test_esencial_no_abre_lo_de_pro_y_pro_si():
    base = {"account_type": "dsp", "modulos": ["vehiculos", "inspecciones", "cuadrante", "turnos",
                                                "asignacion", "origen-danos", "chat"]}
    esencial = server.org_modulos({**base, "plan": "operacion"})
    pro = server.org_modulos({**base, "plan": "completo"})
    assert "cuadrante" not in esencial and "asignacion" not in esencial and "origen-danos" not in esencial
    assert {"vehiculos", "inspecciones", "chat", "dashboard", "configuracion"} <= set(esencial)
    assert {"cuadrante", "turnos", "asignacion", "origen-danos"} <= set(pro)
    # El plan viejo «basico» es Esencial; «pro» es Pro.
    assert "cuadrante" not in server.org_modulos({**base, "plan": "basico"})
    assert "cuadrante" in server.org_modulos({**base, "plan": "pro"})
    # La cuenta de Dani y la demo lo ven todo, tengan el plan que tengan.
    assert server.org_modulos({"account_type": "owner", "plan": "operacion"}) is None


def test_los_textos_de_cada_plan_casan_con_lo_que_abre_la_app():
    """Lo que Esencial dice que NO lleva tiene que estar de verdad cerrado."""
    cerrado = set(server._MODULOS_SOLO_PRO)
    assert {"origen-danos", "asignacion", "cuadrante", "turnos"} <= cerrado
    assert server.PLAN_LIMITS["operacion"]["max_centers"] == 1           # «Varias delegaciones»: no
    assert server.PLAN_LIMITS["completo"]["max_centers"] == -1
    assert server.PLAN_LIMITS["operacion"]["ai"] is True                 # la IA va en todos
