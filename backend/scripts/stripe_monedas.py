# -*- coding: utf-8 -*-
"""EL PLAN REPARTIDOR EN LA MONEDA DE CADA PAÍS, EN STRIPE (30-10-2026).

Pone `currency_options` en los dos Price del plan (mensual y anual) con los precios de PRECIOS_REPARTIDOR (los mismos
que enseña la app) para que Checkout cobre en dólares, pesos, reales… Se ejecuta DONDE ESTÁN LOS SECRETOS, nunca con
la clave escrita:

    fly ssh console -a flota-backend -C "python scripts/stripe_monedas.py"            # enseña lo que hay y lo que pondría
    fly ssh console -a flota-backend -C "python scripts/stripe_monedas.py --aplicar"  # lo pone

Lee STRIPE_SECRET_KEY, STRIPE_PRICE_AUTONOMO y STRIPE_PRICE_AUTONOMO_ANNUAL del entorno. No imprime la clave. Stripe solo
devuelve `currency_options` si se pide con `expand[]` (sin eso parecía que no se ponían, 30-10). Las
monedas que Stripe rechace se dicen y se saltan (la app sigue cobrando esas cuentas en euros).
"""
import os
import sys
import urllib.parse
import urllib.request

# Los mismos precios que PRECIOS_REPARTIDOR en server.py / precios.js (mensual, anual).
PRECIOS = {
    "USD": (9.99, 99), "GBP": (8.99, 89), "CHF": (9.90, 99), "MXN": (149, 1490), "BRL": (39.90, 399), "COP": (29900, 299000),
    "CLP": (7990, 79900), "PEN": (29.90, 299), "UYU": (349, 3490), "CRC": (4990, 49900), "GTQ": (59, 590), "DOP": (499, 4990),
    "BOB": (59, 590), "PYG": (59900, 599000), "HNL": (199, 1990), "NIO": (299, 2990), "CNY": (69, 690),
}
SIN_DECIMALES = {"CLP", "PYG", "JPY", "KRW", "VND", "XOF", "XAF", "UGX", "ISK", "HUF", "TWD"}   # Stripe: unidades enteras


def pide(clave, metodo, ruta, datos=None):
    req = urllib.request.Request("https://api.stripe.com/v1" + ruta, method=metodo,
                                 data=urllib.parse.urlencode(datos).encode() if datos else None,
                                 headers={"Authorization": "Bearer " + clave, "Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            import json
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        import json
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:  # noqa: BLE001
            return e.code, {}


def main():
    clave = os.environ.get("STRIPE_SECRET_KEY", "")
    if not clave:
        sys.exit("falta STRIPE_SECRET_KEY en el entorno")
    aplicar = "--aplicar" in sys.argv
    for nombre, var, indice in (("mensual", "STRIPE_PRICE_AUTONOMO", 0), ("anual", "STRIPE_PRICE_AUTONOMO_ANNUAL", 1)):
        pid = os.environ.get(var, "")
        if not pid:
            print(f"{nombre}: falta {var}")
            continue
        estado, p = pide(clave, "GET", f"/prices/{pid}?expand[]=currency_options")
        if estado != 200:
            print(f"{nombre}: Stripe contesta {estado} al leer el Price")
            continue
        tiene = sorted((p.get("currency_options") or {}).keys())
        print(f"{nombre} ({p.get('currency', '?').upper()} {p.get('unit_amount')}): monedas ya puestas: {tiene or 'ninguna'}")
        if not aplicar:
            continue
        for moneda, (mensual, anual) in PRECIOS.items():
            valor = (mensual, anual)[indice]
            unidad = int(round(valor)) if moneda in SIN_DECIMALES else int(round(valor * 100))
            estado, r = pide(clave, "POST", f"/prices/{pid}", {f"currency_options[{moneda.lower()}][unit_amount]": unidad})
            if estado == 200:
                print(f"  {moneda}: {valor} ok")
            else:
                print(f"  {moneda}: Stripe no lo acepta ({estado}): {(r.get('error') or {}).get('message', '')[:120]}")
        estado, p = pide(clave, "GET", f"/prices/{pid}?expand[]=currency_options")
        print(f"  {nombre} queda con: {sorted((p.get('currency_options') or {}).keys())}")


if __name__ == "__main__":
    main()
