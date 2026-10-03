# -*- coding: utf-8 -*-
"""El 10 % de primera compra de la tienda de ropa (Dani, 03-10-2026, al subir
a precios de lujo: gorra 79, sudadera 129, cortavientos 149).

Una vez por persona: en el portal, por su ficha; desde el enlace publico -el
que se anuncia-, por su correo. Quien ya tiene una compra pagada no lo tiene,
y si el pedido que lo uso se cae (anulado, pago caducado, Stripe que falla),
vuelve. Contra una base de mentira, con los flujos del servidor enteros; Stripe
se simula y se mira lo que se le manda.
"""
import base64
import json
from types import SimpleNamespace
from urllib.parse import parse_qs

import httpx
import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Db

ANA = {"sub": "d1", "role": "driver", "name": "ANA"}
DANI = {"sub": "a1", "role": "admin", "name": "Dani", "sa": True}


class _Resp:
    def __init__(self, status, datos):
        self.status_code = status
        self._d = datos
        self.text = json.dumps(datos)

    def json(self):
        return self._d


class _Stripe:
    """Lo justo de httpx.AsyncClient: apunta lo que se le manda a Stripe."""

    def __init__(self):
        self.pagos = []
        self.falla = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, url, content=None, **_):
        self.pagos.append(parse_qs(content.decode()))
        if self.falla:
            return _Resp(500, {"error": {"message": "caida"}})
        return _Resp(200, {"id": "cs_%d" % len(self.pagos), "url": "https://checkout.stripe.com/x"})

    async def get(self, url, **_):
        return _Resp(200, {"amount_off": 1000})


@pytest.fixture
def base(monkeypatch):
    db = Db()
    db["tienda_config"] = Col([{"_id": "config", "visible": True, "publico": True, "nombre": "FDs"}])
    db["tienda_prendas"] = Col([
        {"id": "g1", "nombre": "Gorra FDs", "tipo": "gorra", "tallas": ["U"], "pvp": 79.0,
         "estado": "publicada", "unidades": 20, "vendidas": 0, "foto_ver": "v1", "creada_en": "1"},
        {"id": "b1", "nombre": "Borrador", "tipo": "gorra", "tallas": ["U"], "pvp": 50.0,
         "estado": "borrador", "creada_en": "2"},
    ])
    db["tienda_fotos"] = Col([
        {"prenda": "g1", "datos": base64.b64encode(b"FOTO-GORRA").decode(), "mime": "image/jpeg"},
        {"prenda": "b1", "datos": base64.b64encode(b"FOTO-BORRADOR").decode(), "mime": "image/jpeg"},
    ])
    db["drivers"] = Col([{"id": "d1", "name": "ANA PEREZ", "center": "OGA5"}])
    glob = Db()
    glob["taller_enlaces"] = Col([{"token": "tok", "tipo": "tienda", "db_name": "flota"}])
    devueltas = []

    async def reservar(prenda_id, cuantas):
        return True

    async def devolver(prenda_id, cuantas):
        devueltas.append((prenda_id, cuantas))

    stripe = _Stripe()
    monkeypatch.setattr(server, "db", db)
    monkeypatch.setattr(server, "global_db", glob)
    monkeypatch.setattr(server, "_tienda_reservar", reservar)
    monkeypatch.setattr(server, "_tienda_devolver", devolver)
    monkeypatch.setattr(server, "_stripe_encendido", lambda: True)
    monkeypatch.setattr(server, "_stripe_clave", lambda: "sk_test_prueba")
    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **k: stripe)
    return SimpleNamespace(db=db, stripe=stripe, devueltas=devueltas)


def _quien(db):
    return (next((d for d in db["tienda_config"].docs if d.get("_id") == "descuento"), {})
            .get("quien") or [])


async def _pedido_portal(n=1):
    return await server.tienda_crear_pedido(
        {"lineas": [{"prenda": "g1", "talla": "U", "cantidad": n}]}, ANA)


async def _compra_fuera(**extra):
    return await server.tienda_publica_comprar("tok", {"prenda": "g1", "talla": "U", **extra})


def _pedidos(db):
    return db["tienda_pedidos"].docs


# ── EN EL PORTAL: POR SU FICHA ───────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_el_conductor_tiene_el_10_en_su_primer_pedido_y_no_en_el_segundo(base):
    primero = await _pedido_portal()
    assert primero["total"] == 71.10 and primero["descuento_pct"] == 0.10
    assert primero["lineas"][0]["precio_sin_descuento"] == 79.0
    segundo = await _pedido_portal()
    assert segundo["total"] == 79.0 and segundo["descuento_pct"] == 0.0
    assert _quien(base.db) == ["d1"]


@pytest.mark.asyncio(loop_scope="session")
async def test_si_anula_el_primero_el_descuento_vuelve(base):
    primero = await _pedido_portal()
    await server.tienda_marcar_pedido(primero["id"], {"estado": "anulado"}, DANI)
    assert _quien(base.db) == []
    otra_vez = await _pedido_portal()
    assert otra_vez["descuento_pct"] == 0.10
    # Y si la oficina lo reactiva, vuelve a ocupar su plaza: no hay dos.
    await server.tienda_marcar_pedido(otra_vez["id"], {"estado": "anulado"}, DANI)
    await server.tienda_marcar_pedido(otra_vez["id"], {"estado": "pendiente_pago"}, DANI)
    assert _quien(base.db) == ["d1"]
    assert (await _pedido_portal())["descuento_pct"] == 0.0


@pytest.mark.asyncio(loop_scope="session")
async def test_quien_ya_compro_no_tiene_primera_compra(base):
    base.db["tienda_pedidos"].docs.append({"id": "viejo", "driver_id": "d1", "estado": "entregado", "total": 79.0})
    escaparate = await server.tienda_escaparate(ANA)
    assert escaparate["descuento"]["para_ti"] is False
    assert (await _pedido_portal())["descuento_pct"] == 0.0


@pytest.mark.asyncio(loop_scope="session")
async def test_el_escaparate_se_lo_ofrece_a_quien_no_ha_comprado(base):
    escaparate = await server.tienda_escaparate(ANA)
    assert escaparate["descuento"]["para_ti"] is True and escaparate["descuento"]["pct"] == 0.10
    assert "plazas" not in escaparate["descuento"], "ya no hay tope de plazas que enseñar"


# ── DESDE EL ENLACE PUBLICO: POR SU CORREO ───────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_de_fuera_el_10_va_por_el_correo_y_solo_la_primera_vez(base):
    r = await _compra_fuera(email="Ana@Correo.ES ")
    assert r["descuento_pct"] == 0.10
    pago = base.stripe.pagos[-1]
    assert pago["line_items[0][price_data][unit_amount]"] == ["7110"]
    assert pago["customer_email"] == ["ana@correo.es"], "el 10 % es de ese correo: va fijo"
    assert "primera compra" in pago["line_items[0][price_data][product_data][name]"][0]
    ped = _pedidos(base.db)[-1]
    assert ped["email"] == "ana@correo.es" and ped["total"] == 71.10
    assert ped["descuento_clave"] == "correo:ana@correo.es"
    # Con la primera aun viva, la segunda con el mismo correo va a precio completo.
    r2 = await _compra_fuera(email="ana@correo.es")
    assert r2["descuento_pct"] == 0.0
    assert base.stripe.pagos[-1]["line_items[0][price_data][unit_amount]"] == ["7900"]


@pytest.mark.asyncio(loop_scope="session")
async def test_un_correo_que_ya_compro_no_tiene_descuento(base):
    base.db["tienda_pedidos"].docs.append({"id": "v", "email": "ana@correo.es", "estado": "pagado", "total": 79.0})
    r = await _compra_fuera(email="ana@correo.es")
    assert r["descuento_pct"] == 0.0


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_correo_se_compra_a_precio_completo(base):
    r = await _compra_fuera()
    assert r["descuento_pct"] == 0.0
    pago = base.stripe.pagos[-1]
    assert pago["line_items[0][price_data][unit_amount]"] == ["7900"]
    assert "customer_email" not in pago, "sin correo, lo pide Stripe en su pantalla"


@pytest.mark.asyncio(loop_scope="session")
async def test_un_correo_mal_escrito_se_dice(base):
    with pytest.raises(HTTPException) as e:
        await _compra_fuera(email="ana@")
    assert e.value.status_code == 400
    assert base.stripe.pagos == [] and _quien(base.db) == []


@pytest.mark.asyncio(loop_scope="session")
async def test_con_cupon_de_campana_no_se_suman_los_dos(base):
    r = await _compra_fuera(email="ana@correo.es", cupon="BIENVENIDA10")
    assert r["descuento_pct"] == 0.0
    pago = base.stripe.pagos[-1]
    assert pago["discounts[0][coupon]"] == ["BIENVENIDA10"]
    assert pago["line_items[0][price_data][unit_amount]"] == ["7900"]
    assert _quien(base.db) == []


@pytest.mark.asyncio(loop_scope="session")
async def test_si_stripe_falla_el_descuento_vuelve(base):
    base.stripe.falla = True
    with pytest.raises(HTTPException) as e:
        await _compra_fuera(email="ana@correo.es")
    assert e.value.status_code == 502
    assert _quien(base.db) == [] and base.devueltas == [("g1", 1)]
    base.stripe.falla = False
    assert (await _compra_fuera(email="ana@correo.es"))["descuento_pct"] == 0.10


@pytest.mark.asyncio(loop_scope="session")
async def test_si_el_pago_caduca_el_descuento_vuelve(base):
    await _compra_fuera(email="ana@correo.es")
    _pedidos(base.db)[-1]["reserva_hasta"] = "2000-01-01T00:00:00+00:00"
    await server._tienda_soltar_caducadas()
    assert _pedidos(base.db)[-1]["estado"] == "anulado"
    assert _quien(base.db) == [] and base.devueltas == [("g1", 1)]
    # Y una segunda pasada no devuelve dos veces.
    await server._tienda_soltar_caducadas()
    assert base.devueltas == [("g1", 1)]


# ── LO QUE VE QUIEN TIENE EL ENLACE ──────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_el_catalogo_publico_dice_nombre_descuento_y_foto(base):
    c = await server.tienda_publica("tok")
    assert c["nombre"] == "FDs" and c["descuento_pct"] == 0.10
    assert [p["id"] for p in c["prendas"]] == ["g1"], "el borrador no sale"
    assert c["prendas"][0]["foto_ver"] == "v1"


@pytest.mark.asyncio(loop_scope="session")
async def test_la_foto_publica_solo_de_lo_que_esta_a_la_venta(base):
    r = await server.tienda_publica_foto("tok", "g1")
    assert r.body == b"FOTO-GORRA" and "public" in r.headers["cache-control"]
    with pytest.raises(HTTPException) as e:
        await server.tienda_publica_foto("tok", "b1")
    assert e.value.status_code == 404, "un borrador no se enseña por el enlace"
    with pytest.raises(HTTPException) as e:
        await server.tienda_publica_foto("otro", "g1")
    assert e.value.status_code == 404, "sin el enlace bueno no hay foto"


@pytest.mark.asyncio(loop_scope="session")
async def test_el_nombre_de_la_tienda_se_guarda_recortado(base):
    conf = await server.tienda_guardar_config({"nombre": "  FDs Galicia  "}, DANI)
    assert conf["nombre"] == "FDs Galicia"


# ── EL ENVIO: ESPAÑA O EL RESTO DEL MUNDO (03-10-2026) ───────────────────────

def _paises(pago):
    return [v[0] for k, v in pago.items() if k.startswith("shipping_address_collection[allowed_countries]")]


@pytest.mark.asyncio(loop_scope="session")
async def test_en_espana_solo_espana_y_sin_suplemento(base):
    await _compra_fuera(envio="es")
    pago = base.stripe.pagos[-1]
    assert _paises(pago) == ["ES"]
    assert not any(k.startswith("shipping_options") for k in pago)
    ped = _pedidos(base.db)[-1]
    assert ped["envio"] == 0.0 and ped["envio_destino"] == "es" and ped["total"] == 79.0


@pytest.mark.asyncio(loop_scope="session")
async def test_fuera_de_espana_todo_el_mundo_con_15_de_envio(base):
    await _compra_fuera(email="ana@correo.es", envio="fuera")
    pago = base.stripe.pagos[-1]
    paises = _paises(pago)
    assert len(paises) > 200 and {"FR", "PT", "GB", "US", "MX", "AR", "JP"} <= set(paises)
    # España va en la otra opcion; Rusia, Cuba o Iran no se pueden elegir.
    assert not {"ES", "RU", "BY", "CU", "IR", "KP", "SY"} & set(paises)
    assert pago["shipping_options[0][shipping_rate_data][fixed_amount][amount]"] == ["1500"]
    # El 10 % va sobre la prenda, no sobre el envio: 71,10 + 15.
    assert pago["line_items[0][price_data][unit_amount]"] == ["7110"]
    ped = _pedidos(base.db)[-1]
    assert ped["envio"] == 15.0 and ped["envio_destino"] == "fuera" and ped["total"] == 86.10


@pytest.mark.asyncio(loop_scope="session")
async def test_el_catalogo_dice_el_suplemento(base):
    assert (await server.tienda_publica("tok"))["envio_fuera"] == 15.0


class _Peticion:
    def __init__(self, crudo, firma):
        self._crudo = crudo
        self.headers = {"Stripe-Signature": firma}

    async def body(self):
        return self._crudo


@pytest.mark.asyncio(loop_scope="session")
async def test_el_pago_de_fuera_cuadra_y_su_correo_ya_no_tiene_primera_compra(base, monkeypatch):
    """Stripe cobra prenda + envio; el pedido guarda ese mismo total, asi que
    el aviso de pago lo marca pagado sin descuadre. Y desde ahi ese correo ya
    ha comprado: la siguiente vez, a precio completo."""
    import hashlib
    import hmac
    import time
    await _compra_fuera(email="ana@correo.es", envio="fuera")
    ped = _pedidos(base.db)[-1]
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_prueba")
    ev = {"id": "evt_1", "type": "checkout.session.completed",
          "data": {"object": {"metadata": {"pedido_id": ped["id"], "db_name": server._DEFAULT_DB_NAME},
                              "amount_total": 8610, "payment_intent": "pi_1"}}}
    crudo = json.dumps(ev).encode()
    ts = int(time.time())
    firma = hmac.new(b"whsec_prueba", str(ts).encode() + b"." + crudo, hashlib.sha256).hexdigest()
    r = await server.tienda_stripe_webhook(_Peticion(crudo, f"t={ts},v1={firma}"))
    assert r == {"ok": True, "pedido": ped["id"]}
    assert _pedidos(base.db)[-1]["estado"] == "pagado"
    assert (await _compra_fuera(email="ana@correo.es"))["descuento_pct"] == 0.0
