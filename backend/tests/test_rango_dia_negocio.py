# -*- coding: utf-8 -*-
"""«La inspección de hoy» a medianoche (01-11-2026): las marcas `created_at` van en UTC y el día de negocio en hora
local, así que entre las 00:00 y la 01:00 de Madrid (02:00 en verano) el regex `^AAAA-MM-DD` dejaba la inspección
recién hecha fuera de «hoy»: la app dejaba repetirla y `already_inspected` salía False. La prueba de contrato del CI
fallaba cada noche a esa hora. `_rango_dia_negocio` da el tramo del día local pasado a UTC, para comparar como texto."""
from datetime import datetime, timezone

import server


def _con_zona(zona):
    server._region_actual.set(("es", zona))


def test_madrid_en_invierno_las_doce_y_media_son_de_hoy():
    _con_zona("Europe/Madrid")
    try:
        r = server._rango_dia_negocio("2026-11-01")
        assert r == {"$gte": "2026-10-31T23:00:00+00:00", "$lt": "2026-11-01T23:00:00+00:00"}
        # Las 00:30 de Madrid (23:30 UTC del día anterior) SON de hoy; el regex ^2026-11-01 las dejaba fuera.
        marca = datetime(2026, 10, 31, 23, 30, 12, 345678, tzinfo=timezone.utc).isoformat()
        assert r["$gte"] <= marca < r["$lt"]
        # Las 23:30 de hoy en Madrid (22:30 UTC) también; las 00:30 de mañana (23:30 UTC de hoy), no.
        assert r["$gte"] <= datetime(2026, 11, 1, 22, 30, tzinfo=timezone.utc).isoformat() < r["$lt"]
        assert not (datetime(2026, 11, 1, 23, 30, tzinfo=timezone.utc).isoformat() < r["$lt"])
        # Y una marca de ayer por la tarde queda fuera por abajo.
        assert not (r["$gte"] <= datetime(2026, 10, 31, 15, 0, tzinfo=timezone.utc).isoformat())
    finally:
        _con_zona("Europe/Madrid")


def test_verano_y_otra_zona_horaria():
    try:
        _con_zona("Europe/Madrid")
        assert server._rango_dia_negocio("2026-07-15") == {"$gte": "2026-07-14T22:00:00+00:00", "$lt": "2026-07-15T22:00:00+00:00"}
        _con_zona("America/Mexico_City")
        assert server._rango_dia_negocio("2026-11-01") == {"$gte": "2026-11-01T06:00:00+00:00", "$lt": "2026-11-02T06:00:00+00:00"}
    finally:
        _con_zona("Europe/Madrid")


def test_sin_dia_usa_el_de_hoy():
    _con_zona("Europe/Madrid")
    r = server._rango_dia_negocio()
    hoy = server._dia_negocio()
    assert r == server._rango_dia_negocio(hoy)
    assert r["$gte"] < r["$lt"]
