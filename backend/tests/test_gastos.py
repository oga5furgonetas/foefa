# -*- coding: utf-8 -*-
"""Gastos: leer una factura, saber de que es y sumar el mes.

La pantalla contesta dos preguntas —«de que es esto» y «cuanto sale al mes»— y
las dos se apoyan en funciones puras: leer el importe de una linea, leer la
fecha, reconocer al proveedor y repartir en cajones. Aqui se prueban esas, que
es donde estan los fallos que no se ven: un importe mal leido no falla, sale un
numero distinto y parece medido.

Las funciones se SACAN de `server.py` con `ast` en vez de copiarlas (gotcha
40): una copia deja de probar el codigo que corre en cuanto alguien toca el
original, y eso ya costo dar por buenas tres hipotesis falsas.
"""
import ast
import io
import re
import unicodedata
from datetime import datetime, timezone, timedelta
from pathlib import Path

SERVER = Path(__file__).resolve().parent.parent / "server.py"

# Lo que hace falta del modulo, en el orden en que se define.
_NOMBRES = [
    "GASTO_CATEGORIAS", "_GASTO_CAT_CLAVES", "_GASTO_CAT_NOMBRE", "_gasto_norm",
    "_GASTO_CATALOGO", "_GASTO_INGRESOS", "_GASTO_FIJO_MESES", "_GASTO_SALTO_MIN",
    "_GASTO_SALTO_PCT", "_GASTO_MAX_PEGADO", "_gasto_quien_es", "_gasto_es_ingreso",
    "_gasto_importe", "_GASTO_MESES_TXT", "_gasto_fecha", "_gasto_concepto",
    "_gasto_huella", "_GASTO_SIN_FECHA", "_gasto_analizar", "_gasto_mes", "_gasto_fijos",
    "_gasto_resumen",
    "_gasto_dominio_de", "_gasto_norm_suave", "_gasto_moneda_de",
    "_GASTO_ETIQUETAS_TOTAL", "_GASTO_MONEDAS", "_GASTO_DOMINIOS", "_gasto_total_correo",
    "_texto_cuerpo",
]


def _cargar():
    fuente = io.open(SERVER, encoding="utf-8-sig").read()
    arbol = ast.parse(fuente)
    quiero = set(_NOMBRES)
    trozos = []
    for n in arbol.body:
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name in quiero:
            trozos.append(n)
        elif isinstance(n, ast.Assign):
            for t in n.targets:
                if isinstance(t, ast.Name) and t.id in quiero:
                    trozos.append(n)
                    break
    ambito = {"re": re, "unicodedata": unicodedata, "datetime": datetime,
              "timezone": timezone, "timedelta": timedelta}
    mod = ast.Module(body=trozos, type_ignores=[])
    exec(compile(ast.fix_missing_locations(mod), "<server>", "exec"), ambito)  # noqa: S102
    faltan = [x for x in _NOMBRES if x not in ambito]
    assert not faltan, "no estan en server.py: %s" % faltan
    return ambito


G = _cargar()
HOY = "2026-09-20"


# ── LEER EL IMPORTE ─────────────────────────────────────────────────────────
# Las dos formas de escribir un numero conviven en el mismo extracto segun de
# donde venga el cargo, y confundirlas cambia el importe por mil.
def test_importe_las_dos_formas_de_escribir_un_numero():
    casos = [
        ("57,30", 57.30),
        ("57.30", 57.30),
        ("1.234,56", 1234.56),
        ("1,234.56", 1234.56),
        ("-57,30", 57.30),          # el extracto pone los gastos en negativo
        ("57,30 €", 57.30),
        ("1.234", 1234.0),          # punto + tres cifras son MILES
        ("12.34", 12.34),           # punto + dos cifras son decimales
        ("900", 900.0),
    ]
    for texto, esperado in casos:
        assert G["_gasto_importe"](texto) == esperado, texto


def test_importe_de_una_linea_de_banco_entera():
    """La fecha y el numero de factura NO son el importe."""
    casos = [
        ("20/09/2026 RECIBO FLY.IO INC -57,30", 57.30),
        ("2026-09-20;Cloudflare;12,50", 12.50),
        ("FACTURA 2026/0412 AYVENS ESPANA 1.842,90", 1842.90),
        ("18-09-26  REPSOL SOLRED         -1.203,45", 1203.45),
    ]
    for linea, esperado in casos:
        assert G["_gasto_importe"](linea) == esperado, linea


def test_una_linea_sin_importe_no_inventa_ninguno():
    assert G["_gasto_importe"]("RECIBO DOMICILIADO SIN IMPORTE") is None
    assert G["_gasto_importe"]("") is None


# ── LEER LA FECHA ───────────────────────────────────────────────────────────
def test_fecha_en_los_formatos_que_llegan():
    casos = [
        ("20/09/2026 algo", "2026-09-20"),
        ("2026-09-20 algo", "2026-09-20"),
        ("20-09-26 algo", "2026-09-20"),
        ("20 sep algo", "2026-09-20"),
        ("1 de marzo de 2026", "2026-03-01"),
    ]
    for texto, esperado in casos:
        assert G["_gasto_fecha"](texto, HOY) == esperado, texto


def test_una_fecha_sin_anio_que_caeria_en_el_futuro_es_del_anio_pasado():
    """Un extracto de enero con «28 dic» es de diciembre pasado: un gasto ya
    pagado no puede tener fecha futura."""
    assert G["_gasto_fecha"]("28 dic", "2026-01-05") == "2025-12-28"


def test_lo_que_no_es_una_fecha_no_se_convierte_en_una():
    assert G["_gasto_fecha"]("FACTURA 99/99/9999", HOY) is None
    assert G["_gasto_fecha"]("REPSOL SOLRED", HOY) is None


# ── SABER DE QUE ES ─────────────────────────────────────────────────────────
def test_reconoce_a_los_proveedores_que_de_verdad_llegan():
    casos = [
        ("RECIBO FLY.IO INC", "Fly.io", "software"),
        ("CLOUDFLARE, INC.", "Cloudflare", "software"),
        ("MONGODB INC", "MongoDB Atlas", "software"),
        ("AYVENS ESPANA SAU", "Ayvens (antes ALD / LeasePlan)", "flota"),
        ("NORTHGATE RENTING FLEXIBLE", "Northgate", "flota"),
        ("REPSOL SOLRED SA", "Repsol / Solred", "combustible"),
        ("SEGUROS MAPFRE", "Seguro", "seguros"),
        ("TGSS CUOTA EMPRESARIAL", "Seguridad Social", "personal"),
        ("AGENCIA TRIBUTARIA MODELO 303", "Agencia Tributaria", "impuestos"),
        ("AUDASA PEAJE AP-9", "Peajes", "peajes"),
        ("MIDAS SANTIAGO", "Midas", "taller"),
    ]
    for texto, prov, cat in casos:
        r = G["_gasto_quien_es"](texto)
        assert r["proveedor"] == prov, (texto, r)
        assert r["categoria"] == cat, (texto, r)
        assert r["que_es"], "sin explicacion: %s" % texto


def test_lo_que_no_reconoce_lo_DICE_en_vez_de_adivinar():
    """El cajon de sobras (gotcha 17/30): lo que no encaja sigue contando en el
    total, pero sale sin etiqueta y se pregunta. Adivinar la categoria colgaria
    la factura de la parte del negocio que no es, y eso no se nota nunca."""
    r = G["_gasto_quien_es"]("TRANSFERENCIA A J.R. FERNANDEZ")
    assert r["categoria"] == "otros"
    assert r["que_es"] == ""
    assert r["fuente"] == ""


def test_gana_la_clave_mas_larga_no_la_primera_escrita():
    """«amazon business» es material; «amazon logistics» es lo que COBRAS."""
    assert G["_gasto_quien_es"]("AMAZON BUSINESS EU")["categoria"] == "material"
    assert G["_gasto_es_ingreso"]("AMAZON LOGISTICS ESPANA") is True
    assert G["_gasto_es_ingreso"]("AMAZON BUSINESS EU") is False


def test_lo_aprendido_manda_sobre_el_catalogo():
    aprendidos = {"talleres muniz": {"proveedor": "Talleres Muniz", "categoria": "taller",
                                     "que_es": "El taller de siempre"}}
    r = G["_gasto_quien_es"]("TRANSFER TALLERES MUNIZ SL", aprendidos)
    assert r["proveedor"] == "Talleres Muniz"
    assert r["fuente"] == "aprendido"


# ── ANALIZAR UN PEGADO ──────────────────────────────────────────────────────
EXTRACTO = """20/09/2026 RECIBO FLY.IO INC -57,30
19/09/2026 CLOUDFLARE, INC. -12,50
18/09/2026 TRANSFERENCIA RECIBIDA AMAZON LOGISTICS 24.310,55
17/09/2026 REPSOL SOLRED SA -1.203,45
16/09/2026 PAGO TPV LA TABERNA -18,40"""


def test_un_extracto_se_convierte_en_filas_con_fecha_importe_y_categoria():
    filas = G["_gasto_analizar"](EXTRACTO, {}, HOY)
    assert len(filas) == 5, [f["linea"] for f in filas]
    por_prov = {f["proveedor"]: f for f in filas}
    assert por_prov["Fly.io"]["importe"] == 57.30
    assert por_prov["Fly.io"]["fecha"] == "2026-09-20"
    assert por_prov["Fly.io"]["categoria"] == "software"
    assert por_prov["Repsol / Solred"]["importe"] == 1203.45


def test_lo_que_ENTRA_no_se_cuenta_como_gasto():
    """Si el cobro de Amazon se cuela, el mes sale inflado por lo que ingresas,
    que es justo al reves de lo que pregunta la pantalla."""
    filas = G["_gasto_analizar"](EXTRACTO, {}, HOY)
    ingresos = [f for f in filas if f["ingreso"]]
    assert len(ingresos) == 1
    assert ingresos[0]["importe"] == 24310.55


def test_el_signo_solo_se_usa_si_el_pegado_trae_signos():
    """Una lista de facturas no lleva signos y ahi TODO es gasto. Decidirlo por
    el signo sin mirar el pegado entero marcaria las cinco como ingresos."""
    lista = ("20/09/2026 FLY.IO 57,30\n"
             "19/09/2026 CLOUDFLARE 12,50")
    filas = G["_gasto_analizar"](lista, {}, HOY)
    assert len(filas) == 2
    assert [f["ingreso"] for f in filas] == [False, False]


def test_lo_que_no_tiene_importe_no_entra():
    filas = G["_gasto_analizar"]("20/09/2026 APUNTE SIN IMPORTE\n\n   ", {}, HOY)
    assert filas == []


# ── LOS NUMEROS DE LA PANTALLA ──────────────────────────────────────────────
def _g(fecha, prov, imp, cat="software", que="x"):
    return {"fecha": fecha, "proveedor": prov, "importe": imp, "categoria": cat,
            "que_es": que, "concepto": ""}


def test_los_cajones_suman_el_total():
    """Gotcha 30: lo que no entra en ningun cajon desaparece sin error."""
    gastos = [_g("2026-09-01", "Fly.io", 57.30),
              _g("2026-09-02", "Northgate", 1842.90, "flota"),
              _g("2026-08-15", "Raro", 100.0, "otros", "")]
    r = G["_gasto_resumen"](gastos, 12, HOY, 138)
    assert r["cuadra"] is True
    assert round(sum(c["importe"] for c in r["categorias"]), 2) == r["total"]
    assert r["total"] == 2000.20


def test_lo_de_fuera_del_rango_no_entra_en_el_total():
    """Si el total contara algo que el grafico no pinta, los dos numeros de la
    misma pantalla dirian cosas distintas."""
    gastos = [_g("2026-09-01", "Fly.io", 10.0), _g("2020-01-01", "Viejo", 999.0)]
    r = G["_gasto_resumen"](gastos, 3, HOY, 138)
    assert r["total"] == 10.0
    assert sum(m["importe"] for m in r["meses"]) == 10.0


def test_por_furgoneta_solo_donde_significa_algo():
    """El alquiler de la nave dividido entre 138 furgonetas no dice nada."""
    gastos = [_g("2026-09-01", "Northgate", 1380.0, "flota"),
              _g("2026-09-01", "Alquiler", 1380.0, "nave")]
    r = G["_gasto_resumen"](gastos, 12, HOY, 138)
    porcat = {c["clave"]: c for c in r["categorias"]}
    assert porcat["flota"]["por_furgo_eur"] == 10.0
    assert porcat["nave"]["por_furgo_eur"] is None


def test_sin_furgonetas_no_se_divide_entre_cero():
    """Gotcha 31: un cociente con el denominador a cero da un numero y miente."""
    r = G["_gasto_resumen"]([_g("2026-09-01", "Northgate", 100.0, "flota")], 12, HOY, 0)
    assert r["categorias"][0]["por_furgo_eur"] is None


def test_la_media_mensual_se_calcula_sobre_los_meses_CON_datos():
    """Tres meses de uso y doce de rango darian una media a la cuarta parte."""
    gastos = [_g("2026-08-01", "Fly.io", 100.0), _g("2026-07-01", "Fly.io", 100.0)]
    r = G["_gasto_resumen"](gastos, 12, HOY, 138)
    assert r["media_mensual"] == 100.0


# ── LO QUE SALE TODOS LOS MESES ─────────────────────────────────────────────
def test_un_gasto_de_un_solo_mes_NO_es_un_gasto_fijo():
    """Con una sola medida no se puede decir que algo se repita."""
    fijos = G["_gasto_fijos"]([_g("2026-09-01", "Fly.io", 57.30)], "2026-09")
    assert fijos == []


def test_un_fijo_dice_en_CUANTOS_meses_se_ha_visto():
    gastos = [_g("2026-07-01", "Fly.io", 57.30), _g("2026-08-01", "Fly.io", 57.30),
              _g("2026-09-01", "Fly.io", 57.30)]
    f = G["_gasto_fijos"](gastos, "2026-09")[0]
    assert f["meses"] == 3 and f["veces"] == 3
    assert f["tipico"] == 57.30
    assert f["falta_este_mes"] is False


def test_avisa_de_un_fijo_que_NO_ha_llegado_este_mes():
    gastos = [_g("2026-07-01", "Fly.io", 57.30), _g("2026-08-01", "Fly.io", 57.30)]
    f = G["_gasto_fijos"](gastos, "2026-09")[0]
    assert f["falta_este_mes"] is True
    assert f["importe_mes"] is None


def test_el_importe_tipico_es_la_MEDIANA_no_la_media():
    """Una factura anual de golpe dispara la media y dejaria de parecerse a lo
    que se paga cada mes."""
    gastos = [_g("2026-06-01", "X", 50.0), _g("2026-07-01", "X", 50.0),
              _g("2026-08-01", "X", 50.0), _g("2026-09-01", "X", 600.0)]
    f = G["_gasto_fijos"](gastos, "2026-09")[0]
    assert f["tipico"] == 50.0


def test_para_decir_que_te_han_cobrado_de_mas_hacen_falta_TRES_medidas():
    """Gotcha 31: con dos, la segunda siempre «se desvia» de la primera."""
    dos = [_g("2026-08-01", "X", 50.0), _g("2026-09-01", "X", 500.0)]
    assert G["_gasto_fijos"](dos, "2026-09")[0]["salto_pct"] is None
    tres = [_g("2026-07-01", "X", 50.0), _g("2026-08-01", "X", 50.0),
            _g("2026-09-01", "X", 500.0)]
    assert G["_gasto_fijos"](tres, "2026-09")[0]["salto_pct"] == 900


def test_un_cambio_pequenio_no_se_marca_como_salto():
    gastos = [_g("2026-07-01", "X", 50.0), _g("2026-08-01", "X", 50.0),
              _g("2026-09-01", "X", 55.0)]
    assert G["_gasto_fijos"](gastos, "2026-09")[0]["salto_pct"] is None


def test_la_huella_reconoce_lo_ya_apuntado_y_distingue_lo_que_no_lo_es():
    a = G["_gasto_huella"]("2026-09-20", "FLY.IO INC", 57.30)
    b = G["_gasto_huella"]("2026-09-20", "fly.io  inc", 57.3)
    c = G["_gasto_huella"]("2026-09-20", "FLY.IO INC", 57.31)
    assert a == b and a != c


def test_todas_las_categorias_del_catalogo_existen():
    """Una categoria mal escrita en el catalogo manda la factura al limbo."""
    for claves, nombre, cat, que in G["_GASTO_CATALOGO"]:
        assert cat in G["_GASTO_CAT_CLAVES"], (nombre, cat)
        assert que, nombre
        for c in claves:
            assert c == G["_gasto_norm"](c), "clave sin normalizar: %r" % c


def test_hay_un_cajon_de_sobras():
    assert "otros" in G["_GASTO_CAT_CLAVES"]


# ── EL BUZON DE FACTURAS ────────────────────────────────────────────────────
# Las facturas de Fly, Atlas y Cloudflare no se pueden pedir por API —se
# comprobo el 20-09-2026 introspeccionando el esquema de Fly entero—, pero
# todas llegan por correo. Esto prueba lo que lee ese correo, que es donde
# esta el riesgo: un total mal leido no falla, sale otro numero.
def test_el_dominio_de_quien_manda():
    """Mas fiable que el texto: «Fly.io» sale en el cuerpo de cualquier correo,
    pero solo Fly manda DESDE fly.io."""
    casos = [
        ("billing@fly.io", "fly.io"),
        ("Fly.io <noreply@mail.fly.io>", "fly.io"),
        ("no-reply@stripe.com", "stripe.com"),
        ("facturacion@mongodb.com", "mongodb.com"),
        ("x@algo.co.uk", "algo.co.uk"),
        ("sin arroba", ""),
    ]
    for correo, esperado in casos:
        assert G["_gasto_dominio_de"](correo) == esperado, correo


def test_el_dominio_lleva_a_un_proveedor_conocido():
    for dominio in ("fly.io", "cloudflare.com", "mongodb.com", "stripe.com"):
        assert G["_GASTO_DOMINIOS"][dominio]


def test_el_total_de_una_factura_sale_por_su_ETIQUETA():
    """No por «el numero mas grande»: en una factura de Fly el mas grande puede
    ser el numero de cuenta, y en una de renting, los kilometros."""
    correo = chr(10).join([
        "Invoice 4021 for organization personal",
        "Account ID 9912834771",
        "Subtotal $54.20",
        "Total due $57.30",
    ])
    importe, moneda = G["_gasto_total_correo"](correo)
    assert importe == 57.30, importe
    assert moneda == "USD", moneda


def test_lee_un_total_en_euros_a_la_espanola():
    correo = chr(10).join(["Factura 2026/0412", "Importe total: 1.842,90 EUR"])
    importe, moneda = G["_gasto_total_correo"](correo)
    assert importe == 1842.90, importe
    assert moneda == "EUR", moneda


def test_los_dolares_NO_se_cuentan_como_euros():
    """57 dolares apuntados como 57 euros es un numero falso con pinta de
    medido, y encima siempre hacia abajo."""
    assert G["_gasto_total_correo"]("Total charged: $57.30")[1] == "USD"
    assert G["_gasto_total_correo"]("Importe total: 57,30 €")[1] == "EUR"


def test_un_correo_sin_total_no_inventa_uno():
    """Mejor pedir que lo mires que apuntar una cifra que no estaba."""
    importe, _ = G["_gasto_total_correo"](
        "Tu factura de septiembre ya esta disponible en tu panel.")
    assert importe is None


def test_la_normalizacion_suave_conserva_los_numeros():
    """`_gasto_norm` se carga puntos y comas, que es lo unico que hace falta
    para leer un importe: por eso son dos funciones y no una."""
    assert G["_gasto_norm_suave"]("Importe TOTAL: 1.842,90 €") == "importe total: 1.842,90 €"
    assert "1.842,90" in G["_gasto_norm_suave"]("1.842,90")


def test_gana_la_etiqueta_mas_especifica():
    """«total a pagar» antes que «total»: al reves se coge el subtotal."""
    t = G["_GASTO_ETIQUETAS_TOTAL"]
    assert t.index("total a pagar") < t.index("total")
    assert t.index("amount due") < t.index("total")


def test_las_monedas_reconocidas_estan_completas():
    for simbolo in ("€", "$", "£"):
        assert simbolo in G["_GASTO_MONEDAS"], simbolo


def main():
    fallos = 0
    for nombre, fn in sorted(globals().items()):
        if nombre.startswith("test_") and callable(fn):
            try:
                fn()
            except AssertionError as e:
                fallos += 1
                print("FALLO %s: %s" % (nombre, e))
    print("gastos: %s" % ("TODO OK" if not fallos else "%d fallos" % fallos))
    return 1 if fallos else 0


if __name__ == "__main__":
    raise SystemExit(main())
