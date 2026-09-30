# -*- coding: utf-8 -*-
"""Importar la hoja en el centro equivocado (30-09-2026): con DGA1 elegido
arriba, la hoja de OGA5 salió con 67 de 68 «no tiene ficha» y «Crear ficha
nueva» ya elegido. El único que casó fue Fran Gil, que tiene la ficha en DGA1.
Sin base de datos: las funciones puras que deciden de qué centro es la hoja y
qué se ofrece para quien se cambia de centro."""
import server

OGA5 = ["ALBERTO FERNANDEZ BARREIRO", "ALEX FANDINO OTERO", "BORJA SALVADO VARELA", "BRAIS NEGREIRA TEIGA",
        "DENIS MIGUEZ RIOS", "ERICK VILELA CHANGIR", "KEVIN ARIAS ARIAS", "LOIS BARREIRO FIGUEIRA"]


def _ficha(i, nombre, centro, activa=True):
    return {"id": f"id{i}", "name": nombre, "center": centro, "active": activa}


def _empresa():
    fichas = [_ficha(i, n, "OGA5") for i, n in enumerate(OGA5)]
    fichas.append(_ficha(90, "FRANCISCO JAVIER GIL ADAMUZ", "DGA1"))
    fichas += [_ficha(91, "LAURA PEREZ CASTRO", "DGA1"), _ficha(92, "MARTA RIAL SOUTO", "DGA1")]
    return fichas


def test_la_hoja_de_oga5_con_dga1_elegido_se_detecta():
    hoja = OGA5 + ["FRANCISCO GIL", "CAROLINA CRESPO SEGOVIA"]
    r = server._cua_centro_de_la_hoja(hoja, _empresa(), {}, "DGA1")
    assert r == {"centro": "OGA5", "casan_alli": len(OGA5), "casan_aqui": 1}


def test_en_su_centro_no_avisa_aunque_uno_venga_de_otro():
    hoja = OGA5 + ["FRANCISCO GIL"]
    assert server._cua_centro_de_la_hoja(hoja, _empresa(), {}, "OGA5") is None


def test_una_empresa_nueva_sin_fichas_no_avisa():
    assert server._cua_centro_de_la_hoja(OGA5, [], {}, "OGA5") is None


def test_pocos_de_otro_centro_no_bastan():
    # Un centro pequeño con cuatro prestados de OGA5 sigue siendo su hoja.
    hoja = OGA5[:4] + ["LAURA PEREZ CASTRO", "MARTA RIAL SOUTO"]
    assert server._cua_centro_de_la_hoja(hoja, _empresa(), {}, "DGA1") is None


def test_las_fichas_de_baja_no_cuentan():
    fichas = [{**f, "active": False} if f["center"] == "OGA5" else f for f in _empresa()]
    assert server._cua_centro_de_la_hoja(OGA5, fichas, {}, "DGA1") is None


def test_el_alias_guardado_cuenta_donde_este_la_ficha():
    # «EL FRAN» no se parece a nadie, pero alguien ya dijo quién es.
    hoja = [f"PERSONA {i}" for i in range(6)]
    fichas = [_ficha(i, f"OTRO NOMBRE {i}", "OGA5") for i in range(6)]
    alias = {f"PERSONA {i}": f"id{i}" for i in range(6)}
    assert server._cua_centro_de_la_hoja(hoja, fichas, alias, "DGA1")["centro"] == "OGA5"


def test_la_ficha_de_otro_centro_se_ofrece_con_su_centro_y_sin_elegirla_sola():
    fran = {**_ficha(90, "FRANCISCO JAVIER GIL ADAMUZ", "DGA1"), "_otro_centro": True}
    opciones, sugerida = server._cua_opciones_para("FRANCISCO GIL", "no_encontrado", [fran], set())
    assert sugerida is None
    assert opciones and opciones[0]["id"] == "id90" and opciones[0]["centro"] == "DGA1"


def test_la_del_centro_se_sigue_proponiendo():
    benja = _ficha(7, "BENJAMIN MOREIRA CASAL", "OGA5")
    opciones, sugerida = server._cua_opciones_para("BENJAMIN MOREIRA CASAL", "no_encontrado", [benja], set())
    assert sugerida == "id7" and opciones[0]["centro"] is None
