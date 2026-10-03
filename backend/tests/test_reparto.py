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
