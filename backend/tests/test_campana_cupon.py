# -*- coding: utf-8 -*-
"""El cupon de la campana de candidatos vale para las TRES prendas.

EL FALLO, VISTO EL 19-09-2026 ANTES DE QUE LO SUFRIERA NADIE. El cupon se
creaba con `max_redemptions=1`: se gastaba entero en la primera compra. Pero la
tienda, al entrar con el cupon en la URL, ensena el precio tachado en las TRES
tarjetas a la vez -hoodie, cortavientos y gorra-. Quien comprara el hoodie con
sus 10 EUR de menos y volviera a por el cortavientos se lo encontraba a precio
entero en la pantalla de pago, despues de haberlo visto rebajado en el
escaparate. El descuento no "fallaba": es que ya no existia, y solo se
descubria pagando.

Las dos mitades tienen que decir lo mismo, y ninguna de las dos sabe de la
otra: el numero de usos vive en `server.py` y el escaparate en `app.js`. Por
eso este fichero los lee como TEXTO (gotcha 40: se lee el codigo real, no una
copia) y los compara entre si y contra el catalogo de la tienda.

No hace falta ni Mongo ni Stripe: aqui no se cobra nada, se comprueba que lo
que promete la tienda es lo que el backend le pide a Stripe.
"""
import io
import os
import re

AQUI = os.path.dirname(__file__)
SERVER = os.path.join(AQUI, "..", "server.py")


def _servidor() -> str:
    return io.open(SERVER, encoding="utf-8-sig").read()


def _constante(nombre: str) -> str:
    m = re.search(r"^%s = (.+)$" % nombre, _servidor(), re.M)
    assert m, "ha desaparecido %s de server.py" % nombre
    return m.group(1).strip()


def test_la_campana_no_vuelve_al_cupon_de_un_solo_uso():
    """La forma exacta que fallaba, por si vuelve con otro nombre."""
    s = _servidor()
    assert "un_solo_uso" not in s, (
        "ha vuelto el booleano de un solo uso; el cupon de la campana lleva "
        "`usos=_CAMPANA_CUPON_USOS`")
    assert re.search(
        r"_stripe_crear_cupon\(\s*\n?\s*_CAMPANA_CUPON_EUR, _CAMPANA_CUPON_HORAS,"
        r"\s*usos=_CAMPANA_CUPON_USOS\)", s), (
        "la campana ya no crea el cupon con las constantes; un 1 escrito a mano "
        "ahi dentro es justo el fallo que este fichero vigila")


def test_max_redemptions_solo_cuando_se_pide():
    """`usos=0` es un cupon SIN limite: no puede colarse un `max_redemptions=0`,
    que Stripe entenderia como un cupon inservible."""
    s = _servidor()
    assert 'if usos > 0:\n        datos.append(("max_redemptions", str(usos)))' in s, (
        "ha cambiado la guarda de max_redemptions en _stripe_crear_cupon")


def test_un_cupon_mayor_que_el_pedido_no_marca_descuadre():
    """El webhook compara lo cobrado con lo esperado y, si no cuadra, deja el
    pedido SIN enviar. Con un cupon que descuente mas de lo que vale la prenda,
    Stripe cobra 0 y el esperado se iria a negativo: una venta legitima
    marcada de descuadre, en silencio. Es la trampa que espera al dia que se
    suba el importe del cupon, que es justo lo que se estuvo pensando hoy."""
    assert re.search(r"esperado = max\(0, int\(round\(", _servidor()), (
        "el importe esperado del webhook vuelve a poder ser negativo")


def test_la_campana_no_manda_dos_veces_al_mismo_correo():
    """La misma persona se postula a varias ofertas y deja varias fichas: el
    19-09-2026 habia 253 fichas con correo para 224 direcciones distintas. Una
    campana sobre las FICHAS le manda dos correos identicos y crea DOS cupones
    personales -60 EUR regalados a la misma persona en vez de 30- y encima
    parece spam justo a quien se esta intentando recuperar."""
    ent = {}
    exec(_fuente_de("_campana_destinatarios"), ent)
    salida = ent["_campana_destinatarios"]([
        {"email": "ana@correo.com", "nombre": ""},
        {"email": "  Ana@Correo.com ", "nombre": "Ana"},
        {"email": "berto@correo.com", "nombre": "Berto"},
        {"email": "", "nombre": "sin correo"},
        {"nombre": "ni campo"},
    ])
    assert [d["email"] for d in salida] == ["ana@correo.com", "berto@correo.com"]
    # Y el nombre se rescata de la otra ficha: la primera lo tenia vacio.
    assert salida[0]["nombre"] == "Ana"


def _fuente_de(nombre):
    """El codigo REAL de una funcion de server.py, sin importar el modulo (que
    arrancaria conexiones). Gotcha 40: una copia deja de probar lo que corre."""
    import ast
    fuente = _servidor()
    for n in ast.parse(fuente).body:
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == nombre:
            return ast.get_source_segment(fuente, n)
    raise AssertionError(nombre + " ya no existe en server.py")


def test_la_campana_se_puede_reanudar_sin_repetirsela_a_nadie():
    """Resend corta por cuota DIARIA (100 correos al dia en el plan gratuito) y
    la campana son dos correos por cabeza: el 19-09-2026 salieron 97 personas y
    se quedaron 127 sin nada. Repetirla tal cual al dia siguiente le manda otra
    vez los dos correos -y un cupon nuevo- a quien ya los tenia. Con lo enviado
    apuntado por (tipo, correo), la siguiente vuelta manda SOLO lo que falta."""
    ent = {}
    exec(_fuente_de("_campana_pendientes"), ent)
    ent["_CAMPANA_CORREOS"] = ("cupon", "suscripcion")
    gente = [{"email": "ana@correo.com", "nombre": "Ana"},
             {"email": "berto@correo.com", "nombre": "Berto"},
             {"email": "cris@correo.com", "nombre": "Cris"}]

    # Ana recibio los dos; Berto solo el del cupon (la cuota corto en medio).
    ya = {"cupon:ana@correo.com", "suscripcion:ana@correo.com", "cupon:berto@correo.com"}
    quedan = ent["_campana_pendientes"](gente, ya)
    assert [d["email"] for d in quedan] == ["berto@correo.com", "cris@correo.com"]
    assert quedan[0]["faltan"] == ["suscripcion"], "a Berto no se le repite el cupon"
    assert quedan[1]["faltan"] == ["cupon", "suscripcion"]
    # Sin nada apuntado, la primera vuelta manda los dos a todo el mundo.
    assert len(ent["_campana_pendientes"](gente, set())) == 3
    # Y con todo apuntado no queda nadie: no se puede mandar dos veces.
    todo = {f"{t}:{d['email']}" for d in gente for t in ("cupon", "suscripcion")}
    assert ent["_campana_pendientes"](gente, todo) == []


def test_la_cuota_diaria_agotada_corta_la_campana_en_seco():
    """Seguir cuando Resend ya dijo que no solo sirve para crear un cupon de
    Stripe por cabeza que nadie va a recibir: 127 tirados el 19-09-2026."""
    servidor = _servidor()
    assert "daily_quota_exceeded" in servidor, (
        "el remitente ya no reconoce la cuota diaria agotada de Resend")
    assert "if _email_sin_cuota_hoy():" in servidor, (
        "la campana ya no mira si la cuota del dia esta agotada")
    assert "pendientes = len(destinatarios) - n" in servidor, (
        "la campana ya no apunta cuantos se quedan sin correo")


def main():
    """Para el runner que ejecuta ficheros sueltos (run_all.py aguanta las dos
    formas)."""
    for nombre, fn in sorted(globals().items()):
        if nombre.startswith("test_") and callable(fn):
            fn()
    print("cupon de campana: todo en su sitio")


if __name__ == "__main__":
    main()
