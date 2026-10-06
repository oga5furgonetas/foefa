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


# ── Colaboradores, campaña y reparto: lo que /planes vende como complemento se cobra así ──

@pytest.mark.parametrize("desde,hasta,mes,dias", [
    ("2026-11-20", "2026-12-10", "2026-11", 11),     # del 20 al 30 de noviembre
    ("2026-11-20", "2026-12-10", "2026-12", 10),     # y del 1 al 10 de diciembre
    ("2026-11-20", None, "2026-12", 31),             # sin fin: sigue de alta todo el mes
    ("2027-01-05", None, "2026-12", 0),              # aún no había empezado
    ("2026-11-01", "2026-11-01", "2026-11", 1),      # un solo día
])
def test_dias_de_campana(desde, hasta, mes, dias):
    assert server._dias_de_campana({"campana_desde": desde, "campana_hasta": hasta}, mes) == dias


def test_mes_anterior():
    assert server._mes_anterior("2027-01") == "2026-12"
    assert server._mes_anterior("2026-10") == "2026-09"


def test_alta_limpia_valida_y_rellena(monkeypatch):
    monkeypatch.setattr(server, "_dia_negocio", lambda: "2026-12-24")
    with pytest.raises(server.HTTPException):
        server._alta_limpia({"alta": "alquilada"})
    with pytest.raises(server.HTTPException):
        server._alta_limpia({"alta": "campana", "campana_desde": "2026-12-10", "campana_hasta": "2026-12-01"})
    with pytest.raises(server.HTTPException):
        server._alta_limpia({"campana_desde": "24/12/2026"})
    # La campaña sin fecha empieza hoy.
    assert server._alta_limpia({"alta": "Campana"})["campana_desde"] == "2026-12-24"
    # Una de campaña que se da de baja deja de sumar días hoy.
    previo = {"alta": "campana", "campana_desde": "2026-11-20"}
    assert server._alta_limpia({"status": "baja"}, previo)["campana_hasta"] == "2026-12-24"
    # Una propia que se da de baja no se toca.
    assert "campana_hasta" not in server._alta_limpia({"status": "baja"}, {"alta": "propia"})


@pytest.mark.asyncio(loop_scope="session")
async def test_la_factura_cobra_cada_furgoneta_a_su_precio(monkeypatch):
    from base_de_mentira import Col, Db
    propias = [{"id": f"p{i}", "status": "active"} for i in range(28)]
    propias += [{"id": "t1", "status": "taller", "alta": "propia"},      # la del taller cuenta
                {"id": "b1", "status": "baja"}]                           # la de baja, no
    colab = [{"id": f"c{i}", "status": "active", "alta": "colaborador"} for i in range(4)]
    campana = [{"id": "k1", "status": "baja", "alta": "campana",          # 10 días de septiembre
                "campana_desde": "2026-09-21", "campana_hasta": "2026-09-30"},
               {"id": "k2", "status": "deleted", "alta": "campana",       # borrada por error: no
                "campana_desde": "2026-09-01"}]
    t = Db()
    t["vehicles"] = Col(propias + [{"id": "p_otra", "status": "active"}] + colab + campana)
    t["reparto_pedidos"] = Col([
        {"id": "r1", "fecha": "2026-09-03", "conductor_id": "d1"},
        {"id": "r2", "fecha": "2026-09-30", "conductor_id": "d1"},
        {"id": "r3", "fecha": "2026-09-15", "conductor_id": "d2"},
        {"id": "r4", "fecha": "2026-09-15", "conductor_id": "d3", "ejemplo": True},   # de ejemplo: no
        {"id": "r5", "fecha": "2026-10-02", "conductor_id": "d4"},                    # es de este mes
    ])
    g = Db()
    g["cobros"] = Col([])
    g["organizations"] = Col([
        {"id": "o1", "name": "Norte", "account_type": "dsp", "status": "active", "plan": "completo",
         "db_name": "dsp_norte"},
        {"id": "o2", "name": "Repartidor", "account_type": "dsp", "status": "active", "plan": "autonomo",
         "db_name": "dsp_rep"},
    ])
    monkeypatch.setattr(server, "db", t)
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "set_current_org_db", lambda *_: None)

    async def cat(forzar=False):
        return server._catalogo_por_defecto()
    monkeypatch.setattr(server, "_catalogo_planes", cat)

    cobros = await server._cobros_del_mes("2026-10")
    assert [c["org_nombre"] for c in cobros] == ["Norte"]          # el repartidor paga con tarjeta
    c = cobros[0]
    lineas = {li["clave"]: li for li in c["lineas"]}
    assert c["vehiculos"] == 30 and lineas["plan"]["importe"] == 270            # 30 propias × 9 €
    assert lineas["colaboradores"]["cantidad"] == 4 and lineas["colaboradores"]["importe"] == 12
    assert lineas["campana"]["cantidad"] == 10 and lineas["campana"]["importe"] == 3
    assert lineas["reparto"]["cantidad"] == 2 and lineas["reparto"]["importe"] == 12
    assert c["base"] == 297 and c["total"] == round(297 * 1.21, 2)


@pytest.mark.asyncio(loop_scope="session")
async def test_precio_pactado_sustituye_al_plan_no_a_los_complementos(monkeypatch):
    from base_de_mentira import Col, Db
    t = Db()
    t["vehicles"] = Col([{"id": f"p{i}", "status": "active"} for i in range(150)]
                        + [{"id": "c1", "status": "active", "alta": "colaborador"}])
    t["reparto_pedidos"] = Col([])
    g = Db()
    g["cobros"] = Col([])
    g["organizations"] = Col([{"id": "o1", "name": "Auto", "account_type": "dsp", "status": "active",
                               "plan": "holding", "db_name": "dsp_auto", "precio_mes_pactado": 900}])
    monkeypatch.setattr(server, "db", t)
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "set_current_org_db", lambda *_: None)

    async def cat(forzar=False):
        return server._catalogo_por_defecto()
    monkeypatch.setattr(server, "_catalogo_planes", cat)
    c = (await server._cobros_del_mes("2026-10"))[0]
    assert c["base"] == 903 and c["lineas"][0]["pactado"] is True


@pytest.mark.asyncio(loop_scope="session")
async def test_el_informe_pericial_va_en_pro_y_no_se_vende_aparte(monkeypatch):
    """La web decía «9 € cada uno» y la app lo daba gratis en Pro: ahora dice lo que hace."""
    async def cat(forzar=False):
        return server._catalogo_por_defecto()
    monkeypatch.setattr(server, "_catalogo_planes", cat)
    r = await server.billing_planes()
    por_clave = {p["clave"]: p for p in r["planes"]}
    assert any("pericial" in x for x in por_clave["completo"]["incluye"])
    assert server.PLAN_LIMITS["completo"]["forensics"] is True
    assert any("pericial" in x for x in por_clave["operacion"]["no_incluye"])
    assert server.PLAN_LIMITS["operacion"]["forensics"] is False
    assert "peritaje" not in {c["clave"] for c in r["complementos"]}
    # Los complementos que se cobran solos tienen su precio en el código, el mismo que la web.
    precios = {c["clave"]: c["precio"] for c in r["complementos"]}
    assert precios["colaboradores"].startswith(f"{server.PRECIO_COLABORADOR:g} €")
    assert precios["campana"].startswith("0,30 €") and server.PRECIO_CAMPANA_DIA == 0.30
    assert precios["reparto"].startswith(f"{server.PRECIO_REPARTO_CONDUCTOR:g} €")


# ── Plan Reparto (06-10-2026): súper y distribución pagan por repartidor activo, furgonetas incluidas ──

def test_reparto_se_cobra_por_repartidor_con_minimo_y_volumen():
    assert server._precio_mensual("reparto", 0) == 36          # mínimo 3 × 12 €
    assert server._precio_mensual("reparto", 2) == 36
    assert server._precio_mensual("reparto", 5) == 60
    assert server._precio_mensual("reparto", 60) == 648        # 720 − 10 %
    assert server.PLAN_LIMITS["reparto"]["max_centers"] == -1  # tiendas y almacenes sin tope
    # Sin lo de Pro, como Esencial.
    assert "cuadrante" not in server.org_modulos({"account_type": "dsp", "plan": "reparto",
                                                   "modulos": ["reparto", "vehiculos", "cuadrante"]})
    assert "reparto" in server.org_modulos({"account_type": "dsp", "plan": "reparto",
                                            "modulos": ["reparto", "vehiculos", "cuadrante"]})


@pytest.mark.asyncio(loop_scope="session")
async def test_la_pagina_de_precios_trae_el_plan_reparto(monkeypatch):
    async def cat(forzar=False):
        return server._catalogo_por_defecto()
    monkeypatch.setattr(server, "_catalogo_planes", cat)
    r = await server.billing_planes()
    rep = next(p for p in r["planes"] if p["clave"] == "reparto")
    assert rep["por_repartidor"] == 12 and rep["minimo_repartidores"] == 3 and rep["desde"] == 36
    assert rep["sectores"] == ["supermercado", "distribucion"]
    assert any("furgonetas incluidas" in x.lower() for x in rep["incluye"])


@pytest.mark.asyncio(loop_scope="session")
async def test_el_catalogo_de_la_base_no_pierde_lo_que_el_codigo_sabe(monkeypatch):
    """El catálogo «vigente» de producción se guardó sin por_repartidor: se rellena del código."""
    class Cat:
        async def find_one(self, *a, **k):
            return {"planes": [{"clave": "reparto", "nombre": "Reparto", "por_vehiculo": 0, "minimo_vehiculos": 0},
                               {"clave": "completo", "nombre": "Pro", "por_vehiculo": 9, "minimo_vehiculos": 20}]}

    class G:
        plan_catalog = Cat()
    monkeypatch.setattr(server, "global_db", G())
    server._CATALOGO_CACHE.update({"ts": 0.0, "datos": None})
    cat = await server._catalogo_planes(forzar=True)
    rep = server._tarifa_de(cat, "reparto")
    assert rep["por_repartidor"] == 12 and rep["minimo_repartidores"] == 3
    assert server._tarifa_de(cat, "operacion")["por_vehiculo"] == 5      # el que la base no trae sigue
    assert await server._precio_vigente("reparto", 5) == 60
    server._CATALOGO_CACHE.update({"ts": 0.0, "datos": None})


@pytest.mark.asyncio(loop_scope="session")
async def test_la_factura_del_plan_reparto_cuenta_repartidores_no_furgonetas(monkeypatch):
    from base_de_mentira import Col, Db
    t = Db()
    t["vehicles"] = Col([{"id": f"v{i}", "status": "active"} for i in range(3)])
    t["reparto_pedidos"] = Col([{"id": f"r{i}", "fecha": "2026-09-%02d" % (i % 9 + 11), "conductor_id": f"d{i % 5}"}
                                for i in range(20)])
    g = Db()
    g["cobros"] = Col([])
    g["organizations"] = Col([{"id": "o1", "name": "Súper Centro", "account_type": "dsp", "status": "active",
                               "plan": "reparto", "db_name": "dsp_super"}])
    monkeypatch.setattr(server, "db", t)
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "set_current_org_db", lambda *_: None)

    async def cat(forzar=False):
        return server._catalogo_por_defecto()
    monkeypatch.setattr(server, "_catalogo_planes", cat)

    c = (await server._cobros_del_mes("2026-10"))[0]
    lineas = {li["clave"]: li for li in c["lineas"]}
    assert lineas["plan"]["cantidad"] == 5 and lineas["plan"]["importe"] == 60     # 5 repartidores × 12 €
    assert "reparto" not in lineas                                                  # la app va incluida
    assert c["base"] == 60 and "5 repartidores" in c["concepto"]
