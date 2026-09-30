# -*- coding: utf-8 -*-
"""Móviles de empresa (30-09-2026, Dani: «pestaña de móviles: las extensiones
de todos los móviles, asignarlos a cada uno y poder ponerle 2 por si uno se
lleva otro»). Las piezas puras: cómo se escribe una extensión, cómo se leen
las líneas pegadas de su hoja y cómo se reparten sin repetir ninguno."""
import server

P = server.MOV_PROPIO


def test_la_extension_como_en_la_hoja():
    assert server._mov_ext("4114") == "4114"
    assert server._mov_ext(4114.0) == "4114"            # Excel copia los números así
    assert server._mov_ext(" 4114.0 ") == "4114"
    assert server._mov_ext("600 12 34 56") == "600123456"
    assert server._mov_ext("+34 600-123-456") == "34600123456"
    assert server._mov_ext("propio") == P
    for mala in ("", None, "1", "ABC", "41a4", "2865NGX", "4114.5"):
        assert server._mov_ext(mala) == "", mala


def test_lee_la_tabla_de_su_hoja():
    texto = ("CONDUCTOR\tMOVIL\tFURGO\n"
             "ALEX FANDIÑO OTERO\t1117.0\t2865NGX\n"
             "ALINNE SOARES CARLVALHO\tPROPIO\n"
             "BORJA BLANCO GUZMAN 4114 4115\n"
             "\n"
             "JOSE JORGE VAZQUEZ CASAL\t4106\tM1234AB\n"
             "SOLO NOMBRE\n")
    lineas = server._mov_leer_lineas(texto)
    por = {x["nombre"]: x["moviles"] for x in lineas}
    assert por["ALEX FANDIÑO OTERO"] == ["1117"]          # la matrícula de al lado no es un móvil
    assert por["ALINNE SOARES CARLVALHO"] == [P]
    assert por["BORJA BLANCO GUZMAN"] == ["4114", "4115"]  # el suyo y el de reserva
    assert por["JOSE JORGE VAZQUEZ CASAL"] == ["4106"]
    assert por["SOLO NOMBRE"] == []
    assert por["CONDUCTOR MOVIL FURGO"] == []              # la cabecera no casa con nadie


def test_cada_uno_el_suyo():
    puestos, sin = server._mov_repartir([(0, "4114", None), (1, "1117", "4864")], set())
    assert puestos == {0: ("4114", "suyo"), 1: ("1117", "suyo")} and sin == []


def test_si_ya_lo_lleva_otro_de_la_hoja_el_de_reserva():
    # 4114 ya está escrito a mano en la hoja: Borja se lleva el de reserva.
    puestos, _ = server._mov_repartir([(3, "4114", "4115")], {"4114"})
    assert puestos == {3: ("4115", "reserva")}


def test_dos_con_el_mismo_se_lo_queda_quien_no_tiene_reserva():
    # Ana (fila 0) tiene reserva libre; Luis (fila 1) no: el 4114 es para Luis.
    puestos, sin = server._mov_repartir([(0, "4114", "1117"), (1, "4114", None)], set())
    assert puestos == {1: ("4114", "suyo"), 0: ("1117", "reserva")} and sin == []


def test_el_suyo_de_uno_manda_sobre_la_reserva_de_otro():
    puestos, sin = server._mov_repartir([(0, "4864", "1117"), (1, "1117", None)], {"4864"})
    assert puestos == {1: ("1117", "suyo")}
    assert sin == [(0, ["4864", "1117"])]                  # los dos ocupados: se dice, no se inventa


def test_propio_no_ocupa_nada_y_nunca_se_repite_un_movil():
    pedidos = [(0, P, None), (1, P, None), (2, "4114", None), (3, "4114", None), (4, "4114", "4114")]
    puestos, sin = server._mov_repartir(pedidos, set())
    assert puestos[0] == (P, "propio") and puestos[1] == (P, "propio")
    moviles = [m for m, _ in puestos.values() if m != P]
    assert len(moviles) == len(set(moviles)) == 1
    assert len(sin) == 2
