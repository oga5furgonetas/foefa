# -*- coding: utf-8 -*-
"""Reparto: zonas, orden de la ruta, la lista pegada y la privacidad."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import reparto as R  # noqa: E402

ZONAS = [
    {"nombre": "Centro", "cps": ["15001", "15003"], "palabras": ["Montero Rios", "Orzan"]},
    {"nombre": "Os Mallos", "cps": ["15007"], "palabras": ["Ronda de Outeiro", "Mallos"]},
    {"nombre": "Oleiros", "cps": [], "palabras": ["Oleiros", "Santa Cristina"]},
]


def test_zona_por_cp_manda_sobre_la_palabra():
    z = R.zona_de("Rúa Mallos 4, 15003 A Coruña", "", ZONAS)
    assert z["nombre"] == "Centro"


def test_zona_por_palabra_sin_acentos_ni_mayusculas():
    assert R.zona_de("Avda. de MONTERO RÍOS 12, 3º", "", ZONAS)["nombre"] == "Centro"
    assert R.zona_de("Rúa Santa Cristina 8", "", ZONAS)["nombre"] == "Oleiros"


def test_zona_palabra_entera_y_sin_zona():
    # «ria» no puede casar con «María»: no hay ninguna zona que diga eso.
    assert R.zona_de("Calle María Pita 3", "", ZONAS) == {}
    assert R.zona_de("", "", ZONAS) == {}


def test_ruta_recorre_en_orden_y_deja_al_final_las_sin_coordenadas():
    base = (43.3700, -8.4000)
    paradas = [
        {"id": "lejos", "lat": 43.40, "lng": -8.40},
        {"id": "sin", "lat": None, "lng": None},
        {"id": "cerca", "lat": 43.371, "lng": -8.40},
        {"id": "medio", "lat": 43.385, "lng": -8.40},
    ]
    orden = [p["id"] for p in R.ordena_ruta(base, paradas)]
    assert orden == ["cerca", "medio", "lejos", "sin"]


def test_ruta_2opt_no_es_peor_que_el_vecino_mas_cercano():
    import random
    rnd = random.Random(7)
    base = (43.36, -8.41)
    paradas = [{"id": str(i), "lat": 43.30 + rnd.random() * 0.1, "lng": -8.45 + rnd.random() * 0.1}
               for i in range(25)]
    ruta = R.ordena_ruta(base, paradas)
    assert sorted(p["id"] for p in ruta) == sorted(p["id"] for p in paradas)
    assert R.largo_ruta_km(base, ruta) <= R.largo_ruta_km(base, paradas)


def test_pegado_con_cabeceras_de_excel():
    texto = ("Ticket\tCliente\tDirección\tTeléfono\tLleva\tBultos\n"
             "0012 3456\tAna López\tAvda Montero Ríos 12, 15003 A Coruña\t612 345 678\t3 cajas y agua\t4\n"
             "\t\t\t\t\t\n")
    ps = R.lee_pegado(texto)
    assert len(ps) == 1
    p = ps[0]
    assert p["codigo"] == "00123456" and p["cliente"] == "Ana López"
    assert p["telefono"] == "612345678" and p["cp"] == "15003" and p["bultos"] == 4


def test_pegado_sin_cabeceras_y_una_columna():
    ps = R.lee_pegado("A1;Taller Pérez;Polígono de Sabón parcela 7, 15142 Arteixo;981 000 111;2 cajas\n"
                      "Rúa Real 5, A Coruña 655111222\n")
    assert ps[0]["codigo"] == "A1" and ps[0]["telefono"] == "981000111" and ps[0]["cp"] == "15142"
    assert ps[1]["direccion"].startswith("Rúa Real") and ps[1]["telefono"] == "655111222"


def test_pegado_basura_no_revienta():
    assert R.lee_pegado(None) == []
    assert R.lee_pegado("hola;;") == []


def test_tapar_quita_todo_lo_personal():
    p = R.tapar({"id": "x", "cliente": "Ana", "telefono": "6", "direccion": "Real 5",
                 "lat": 43.1, "lng": -8.1, "zona": "Centro", "estado": "entregado"})
    assert p["cliente"] == "•••" and p["telefono"] == "•••" and p["direccion"] == "•••"
    assert p["lat"] is None and p["lng"] is None
    assert p["zona"] == "Centro" and p["estado"] == "entregado" and p["tapado"]


def test_caducado_cuenta_desde_la_fecha_del_reparto():
    assert R.caducado({"fecha": "2026-08-01"}, "2026-10-03")
    assert not R.caducado({"fecha": "2026-09-20"}, "2026-10-03")
    assert not R.caducado({"fecha": "2026-08-01", "anonimizado": True}, "2026-10-03")
    assert not R.caducado({"fecha": "basura"}, "2026-10-03")


def test_limpia_ticket_de_la_ia():
    d = R.limpia_ticket({"codigo": " 84 1234 ", "telefono": "Tel: +34 600 11 22 33",
                         "direccion": "Rúa Real 5, 15003", "bultos": "x", "cliente": ["raro"]})
    assert d["codigo"] == "841234" and d["telefono"] == "600112233"
    assert d["cp"] == "15003" and d["bultos"] == 1 and d["cliente"] == ""
    assert R.limpia_ticket("no es json")["bultos"] == 1


# ── LA RUTA POR TIEMPO ─────────────────────────────────────────────────────────

def test_trafico_tipico_por_hora():
    assert R.factor_trafico(8 * 60 + 15, 0) > 1.3        # lunes a las 8:15
    assert R.factor_trafico(11 * 60, 0) < R.factor_trafico(8 * 60 + 15, 0)
    assert R.factor_trafico(8 * 60 + 15, 6) == 1.0       # domingo
    assert R.factor_trafico(8 * 60 + 15, 0, con_trafico=False) == 1.0


def test_lee_ventana():
    assert R.lee_ventana("Entregar de 10 a 12") == (600, 720)
    assert R.lee_ventana("10:30-13") == (630, 780)
    assert R.lee_ventana("entre 17 y 19 h") == (1020, 1140)
    assert R.lee_ventana("por la tarde") == (960, 1260)
    assert R.lee_ventana("3º izq, llamar al timbre") == (None, None)
    assert R.lee_ventana("") == (None, None)


def _matriz(n, f):
    return [[0 if i == j else f(i, j) for j in range(n)] for i in range(n)]


def test_por_tiempo_respeta_la_franja_aunque_quede_mas_lejos():
    # Cuatro paradas en una línea a 5 min cada una; la más lejana (4) solo
    # puede recibir de 9:00 a 9:10. Por distancia iría la última (9:20 + paradas).
    m = _matriz(5, lambda i, j: abs(i - j) * 300)
    paradas = [{"servicio": 3}, {"servicio": 3}, {"servicio": 3}, {"servicio": 3, "desde": 540, "hasta": 550}]
    r = R.optimiza_por_tiempo(m, paradas, salida=530, dia_semana=6)
    assert r["orden"][0] == 3 and r["tarde"] == 0
    eta = {i: l["eta"] for i, l in zip(r["orden"], r["llegadas"])}
    assert 540 <= eta[3] <= 550


def test_por_tiempo_sin_franjas_no_es_peor_que_el_orden_de_llegada():
    import random
    rnd = random.Random(3)
    pts = [(rnd.random(), rnd.random()) for _ in range(16)]
    m = _matriz(16, lambda i, j: ((pts[i][0] - pts[j][0]) ** 2 + (pts[i][1] - pts[j][1]) ** 2) ** .5 * 3600)
    paradas = [{"servicio": 4} for _ in range(15)]
    r = R.optimiza_por_tiempo(m, paradas, salida=600, dia_semana=6)
    assert sorted(r["orden"]) == list(range(15))
    tal_cual = R._evalua(list(range(1, 16)), m, 600, paradas, 6, False, False)[2] - 600
    assert r["minutos"] <= round(tal_cual)


def test_el_trafico_de_la_hora_punta_alarga_la_ruta():
    m = _matriz(3, lambda i, j: 600)
    paradas = [{"servicio": 2}, {"servicio": 2}]
    punta = R.optimiza_por_tiempo(m, paradas, salida=8 * 60, dia_semana=1)
    valle = R.optimiza_por_tiempo(m, paradas, salida=11 * 60, dia_semana=1)
    assert punta["minutos"] > valle["minutos"]


def test_urgente_primero_si_no_cuesta_casi_nada():
    m = _matriz(3, lambda i, j: 300)
    paradas = [{"servicio": 3}, {"servicio": 3, "prioridad": True}]
    assert R.optimiza_por_tiempo(m, paradas, salida=600, dia_semana=6)["orden"][0] == 1


def test_pegado_lee_horario():
    ps = R.lee_pegado("Cliente;Dirección;Horario\nAna;Rúa Real 5;de 10 a 12\n")
    assert ps[0]["horario"] == "de 10 a 12"


def test_linea_recta_de_respaldo():
    seg, met = R.matriz_en_linea_recta([(43.37, -8.40), (43.38, -8.40)])
    assert 1000 < met[0][1] < 2000 and seg[0][1] > 0 and seg[1][1] == 0


def test_numeros_de_portal_no_son_franjas():
    assert R.lee_ventana("portal 5-7") == (None, None)
    assert R.ventana_de_nota("Portal 12-14, 3º") == (None, None)
    assert R.ventana_de_nota("Entregar de 10 a 12, portal 2") == (600, 720)
    assert R.ventana_de_nota("solo por la tarde") == (960, 1260)


def test_aligera_linea_quita_puntos_pegados_y_guarda_extremos():
    linea = [[43.0 + i * 0.00001, -8.0] for i in range(1000)]   # ~1,1 m entre puntos
    fuera = R.aligera_linea(linea, metros=12)
    assert fuera[0] == linea[0] and fuera[-1] == linea[-1]
    assert 80 < len(fuera) < 120
    assert R.aligera_linea(linea[:2]) == linea[:2]
    assert len(R.aligera_linea([[43 + i * 0.01, -8] for i in range(9000)], tope=500)) == 500
