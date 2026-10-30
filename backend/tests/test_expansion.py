# -*- coding: utf-8 -*-
"""Expansión fuera de España (30-10-2026, docs/EXPANSION-INTERNACIONAL-30-10.md): la moneda, las unidades y el precio
del plan Repartidor salen del país de la cuenta, sin tocar Mongo."""
import server


def test_la_moneda_y_las_unidades_salen_del_pais():
    assert server._moneda_de("es") == "EUR"
    assert server._moneda_de("mx") == "MXN"
    assert server._moneda_de("us") == "USD"
    assert server._moneda_de("gb") == "GBP"
    assert server._moneda_de(None) == "EUR"
    assert server._moneda_de("xx") == "EUR"
    assert server._unidades_de("us") == "mi"
    assert server._unidades_de("gb") == "mi"
    assert server._unidades_de("es") == "km"
    assert server._unidades_de("mx") == "km"
    assert server._unidades_de("") == "km"


def test_el_plan_repartidor_en_la_moneda_del_pais():
    tarifa = {"mensual": 9.99, "anual": 99}
    assert server._precios_repartidor("es", tarifa) == {"moneda": "EUR", "mensual": 9.99, "anual": 99}
    # En euros manda la tarifa editable, no la tabla.
    assert server._precios_repartidor("fr", {"mensual": 8.5, "anual": 85}) == {"moneda": "EUR", "mensual": 8.5, "anual": 85}
    assert server._precios_repartidor("us", tarifa) == {"moneda": "USD", "mensual": 9.99, "anual": 99}
    assert server._precios_repartidor("mx", tarifa) == {"moneda": "MXN", "mensual": 149, "anual": 1490}
    assert server._precios_repartidor("br", tarifa) == {"moneda": "BRL", "mensual": 39.90, "anual": 399}
    # Sin precio en su moneda (Argentina, Venezuela), en dólares.
    assert server._precios_repartidor("ar", tarifa) == {"moneda": "USD", "mensual": 9.99, "anual": 99}
    assert server._precios_repartidor("ve", tarifa)["moneda"] == "USD"
    # Lo editado desde el panel de negocio pisa la tabla.
    cat = {"precios_repartidor": {"mxn": [129, 1290], "ars": ["9999", "99990"], "rota": "x"}}
    assert server._precios_repartidor("mx", tarifa, cat) == {"moneda": "MXN", "mensual": 129.0, "anual": 1290.0}
    assert server._precios_repartidor("ar", tarifa, cat) == {"moneda": "ARS", "mensual": 9999.0, "anual": 99990.0}
    # Todas las monedas de la tabla son de verdad (3 letras) y el año cuesta menos que doce meses.
    for moneda, (mes, anio) in server.PRECIOS_REPARTIDOR.items():
        assert len(moneda) == 3 and moneda.isupper()
        assert 0 < mes and anio < 12 * mes


def test_todo_pais_de_reparto_tiene_moneda():
    for pais in server.PAISES_REPARTO:
        assert pais in server.MONEDA_PAIS, pais
