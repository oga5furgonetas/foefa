# -*- coding: utf-8 -*-
"""El mercadillo de repartidores (17-10-2026). Lo que se vigila, por orden de lo que más daño haría:
que nada salga sin que Dani lo apruebe; que esté oculto hasta que él lo encienda; que las fotos no lleven la
ubicación del móvil; que los mensajes solo los lean sus dos personas; que quien publica sepa por qué se le
rechaza o retira y quien denuncia reciba acuse y decisión (DSA); y que todo se borre a su tiempo.

Y bloquear a una persona (10-11-2026; Apple, guideline 1.2): que quien bloquea deje de ver al otro AL INSTANTE
y por todos los caminos (lista, ficha, foto, buzón, globito), que ninguno pueda escribir al otro, que al
bloqueado no se le diga nada, que desbloquear lo devuelva todo, que Dani se entere y que la clave de nadie
salga hacia la web.

Y lo que faltaba de esa misma guideline (10-11-2026): quitarle el mercadillo a quien incumple («ejecting the user»:
403 en TODAS las rutas, recorridas de verdad, y `expulsado` en el estado) y devolvérselo; las normas aceptadas
(`normas_ok`); el filtro básico de insultos y amenazas, con el mismo cuidado lo que entra que lo que NO entra; y
que borrar una empresa, un conductor o alguien de oficina se lleve su mercadillo sin impedir nunca el borrado."""
import ast
import functools
import inspect
import io as _io
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.routing import APIRoute
from httpx import ASGITransport, AsyncClient
from PIL import Image
from pymongo.errors import DuplicateKeyError

import mercadillo as mc
import server
from base_de_mentira import Col, Db

_CORREO_DE_REAL = server._merc_correo_de          # la de verdad (el fixture la simula)

DANI = {"sub": "dani", "role": "admin", "sa": True, "org_id": "owner", "name": "Dani"}
ANA = {"sub": "d1", "role": "driver", "org_id": "owner", "name": "ANA PÉREZ LÓPEZ"}          # conductora de OGA5
LUIS = {"sub": "d2", "role": "driver", "org_id": "owner", "name": "Luis Gómez"}
PEPE = {"sub": "a1", "role": "admin", "org_id": "o1", "name": "Pepe"}                        # autónomo
OFICINA = {"sub": "a9", "role": "admin", "org_id": "empresa", "name": "Oficina"}
# Cómo es cada uno por dentro (su clave): un autónomo, dos conductores y alguien de oficina. Dani es «fds».
CLAVES = {"pepe": "o:o1", "ana": "d:owner:d1", "luis": "d:owner:d2", "oficina": "a:empresa:a9"}


@pytest.fixture
def mundo(monkeypatch):
    g = Db()
    g["organizations"] = Col([
        {"id": "owner", "name": "Administrador", "account_type": "owner"},
        {"id": "o1", "name": "Pepe Pérez", "plan": "autonomo", "sector": "autonomo", "email": "pepe@x.es"},
        {"id": "empresa", "name": "Transportes", "plan": "completo", "sector": "reparto"},
        {"id": "apagada", "name": "Apagada", "plan": "completo", "mercadillo_off": True},
    ])
    correos, enviados = {"o:o1": "pepe@x.es", "d:owner:d1": "ana@x.es", "d:owner:d2": "luis@x.es"}, []

    async def org(_id):
        return await g.organizations.find_one({"id": _id}, {"_id": 0})

    async def enviar(to, subject, html, responder_a="", copia=None, texto="", cabeceras=None):
        enviados.append(SimpleNamespace(to=to, subject=subject, texto=texto))
        return True

    async def correo_de(clave):
        return correos.get(clave, "")

    async def entregas(yo):
        return 7 if yo["tipo"] == "autonomo" else None
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "get_org", org)
    monkeypatch.setattr(server, "_enviar_email", enviar)
    monkeypatch.setattr(server, "_merc_correo_de", correo_de)
    monkeypatch.setattr(server, "_merc_entregas", entregas)
    monkeypatch.setattr(server, "CORREO_CONTACTO", "contacto@x.es")
    # El cupo de bloqueos del día vive en memoria: cada prueba empieza con el suyo a cero.
    for cupo in [k for k in server._public_actions if k.startswith("merc_bloquear:")]:
        del server._public_actions[cupo]
    # Y lo mismo la memoria de «de esta pareja ya se le avisó a Dani» (desbloquear y volver a bloquear no repite).
    monkeypatch.setattr(server, "_MERC_PAR_AVISADO", {})
    return SimpleNamespace(g=g, enviados=enviados)


def _jpeg_con_gps() -> bytes:
    """Una foto de móvil con ubicación (GPS) en sus metadatos."""
    im = Image.new("RGB", (2400, 1800), (200, 30, 30))
    exif = Image.Exif()
    exif[0x8825] = {1: "N", 2: (43.0, 22.0, 10.0), 3: "W", 4: (8.0, 24.0, 5.0)}   # GPSInfo
    exif[0x0110] = "iPhone de prueba"                                                 # modelo
    out = _io.BytesIO()
    im.save(out, "JPEG", exif=exif)
    return out.getvalue()


class _Fichero:
    def __init__(self, datos):
        self.datos, self.filename = datos, "foto.jpg"

    async def read(self, n=-1):
        return self.datos


async def _abrir(mundo):
    await server.admin_mercadillo_visible({"visible": True}, DANI)


async def _anuncio(user, titulo="Soporte de móvil", precio="15", **extra):
    f = await server.merc_subir_foto(_Fichero(_jpeg_con_gps()), user)
    return await server.merc_crear({"titulo": titulo, "categoria": "furgoneta", "estado_articulo": "buen_estado",
                                    "precio": precio, "zona": "A Coruña", "fotos": [f["id"]], "acepto": True, **extra}, user)


# ── EL MÓDULO ────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("entrada,cent", [("1.300", 130000), ("1300", 130000), ("1.300,50", 130050), ("25,5", 2550),
                                          (1300, 130000), ("15 €", 1500)])
def test_precio_se_entiende_como_lo_escribe_la_gente(entrada, cent):
    assert mc.precio_cent(entrada) == cent


@pytest.mark.parametrize("malo", ["", "gratis", "0", "0,5", "25000", None, True])
def test_precio_fuera_de_rango_o_raro(malo):
    with pytest.raises(mc.Invalido):
        mc.precio_cent(malo)


def test_validar_exige_lo_necesario_y_la_aceptacion():
    base = {"titulo": "iPhone 18 Pro", "categoria": "movil", "estado_articulo": "como_nuevo", "precio": "1.300",
            "fotos": ["a"], "acepto": True}
    assert mc.validar(base)["precio_cent"] == 130000
    for cambio, texto in [({"titulo": "x"}, "qué vendes"), ({"categoria": "armas"}, "categoría"),
                          ({"fotos": []}, "fotos"), ({"fotos": list("abcdefg")}, "fotos"),
                          ({"acepto": False}, "Confirma"), ({"estado_articulo": ""}, "estado")]:
        with pytest.raises(mc.Invalido, match=texto):
            mc.validar({**base, **cambio})


def test_de_quien_vende_solo_nombre_e_inicial():
    assert mc.nombre_publico("ANA PÉREZ LÓPEZ") == "Ana P."
    assert mc.nombre_publico("luis") == "Luis"
    assert mc.nombre_publico("") == "Repartidor"
    assert mc.euros(130000) == "1.300 €" and mc.euros(2550) == "25,50 €"


# ── QUIÉN ENTRA ─────────────────────────────────────────────────────────────
@pytest.mark.asyncio(loop_scope="session")
async def test_quien_es_quien(mundo):
    assert (await server._merc_yo(ANA))["clave"] == "d:owner:d1" and (await server._merc_yo(ANA))["nombre"] == "Ana P."
    assert (await server._merc_yo(PEPE))["clave"] == "o:o1"
    assert (await server._merc_yo(DANI))["clave"] == "fds"
    oficina = await server._merc_yo(OFICINA)                              # 17-10: la oficina también entra
    assert oficina["clave"] == "a:empresa:a9" and oficina["tipo"] == "oficina" and oficina["nombre"] == "Oficina"
    for nadie in ({**ANA, "demo": True}, {"sub": "x", "role": "driver", "org_id": "apagada", "name": "X"},
                  {"sub": "y", "role": "admin", "org_id": "apagada", "name": "Y"}, {**OFICINA, "imp": True}):
        with pytest.raises(HTTPException) as e:
            await server._merc_yo(nadie)
        assert e.value.status_code == 403


@pytest.mark.asyncio(loop_scope="session")
async def test_oculto_hasta_que_dani_lo_enciende(mundo):
    assert (await server.merc_estado(ANA))["visible"] is False
    with pytest.raises(HTTPException) as e:
        await server.merc_lista("", ANA)
    assert e.value.status_code == 404
    assert (await server.merc_estado(DANI))["visible"] is True          # él lo ve para probarlo
    assert (await server.merc_lista("", DANI))["anuncios"] == []
    await _abrir(mundo)
    assert (await server.merc_estado(ANA))["visible"] is True
    assert (await server.merc_estado(OFICINA))["visible"] is True       # la oficina también lo ve


# ── PUBLICAR ────────────────────────────────────────────────────────────────
@pytest.mark.asyncio(loop_scope="session")
async def test_la_foto_pierde_la_ubicacion_y_se_reduce(mundo):
    await _abrir(mundo)
    f = await server.merc_subir_foto(_Fichero(_jpeg_con_gps()), ANA)
    import base64
    datos = base64.b64decode(mundo.g["mercadillo_fotos"].docs[0]["datos"])
    im = Image.open(_io.BytesIO(datos))
    assert max(im.size) <= 1280 and not im.getexif() and b"iPhone de prueba" not in datos
    assert f["bytes"] == len(datos)
    with pytest.raises(HTTPException):
        await server.merc_subir_foto(_Fichero(b"no soy una foto"), ANA)


@pytest.mark.asyncio(loop_scope="session")
async def test_nada_sale_sin_que_dani_lo_apruebe(mundo):
    await _abrir(mundo)
    a = await _anuncio(PEPE, "Carretilla plegable", "35")
    assert a["estado"] == "pendiente" and a["vendedor"] == {"nombre": "Pepe P.", "tipo": "autonomo", "entregas": 7}
    assert "Mercadillo: anuncio para revisar" in mundo.enviados[-1].subject and mundo.enviados[-1].to == "contacto@x.es"
    assert (await server.merc_lista("", ANA))["anuncios"] == []           # Ana no lo ve todavía
    assert (await server.merc_lista("", PEPE))["mios"][0]["estado"] == "pendiente"
    await server.admin_mercadillo_anuncio(a["id"], {"accion": "aprobar"}, DANI)
    vista = (await server.merc_lista("", ANA))["anuncios"]
    assert [x["titulo"] for x in vista] == ["Carretilla plegable"] and vista[0]["mio"] is False
    assert "clave" not in vista[0]["vendedor"] and "org_id" not in vista[0]["vendedor"]   # nada de quién es por dentro
    aviso = mundo.g["mercadillo_avisos"].docs[-1]
    assert aviso["para"] == "o:o1" and "ya está publicado" in aviso["texto"]
    assert mundo.enviados[-1].to == "pepe@x.es"


@pytest.mark.asyncio(loop_scope="session")
async def test_la_oficina_puede_vender_y_se_le_avisa_a_su_correo(mundo):
    await _abrir(mundo)
    mundo.g["admin_users"] = Col([{"id": "a9", "username": "oficina@x.es", "org_id": "empresa"}])
    a = await _anuncio(OFICINA, "Silla de oficina", "40")
    assert a["vendedor"] == {"nombre": "Oficina", "tipo": "oficina", "entregas": None}
    # El correo de la persona de oficina sale de su usuario (la función de verdad, no la simulada).
    assert await _CORREO_DE_REAL("a:empresa:a9") == "oficina@x.es"
    assert await _CORREO_DE_REAL("a:empresa:nadie") == ""


@pytest.mark.asyncio(loop_scope="session")
async def test_rechazar_dice_siempre_el_motivo(mundo):
    await _abrir(mundo)
    a = await _anuncio(ANA, "Escáner de la nave", "50")
    with pytest.raises(HTTPException):
        await server.admin_mercadillo_anuncio(a["id"], {"accion": "rechazar"}, DANI)       # sin motivo, no
    await server.admin_mercadillo_anuncio(a["id"], {"accion": "rechazar", "motivo": "empresa", "nota": "Es de Amazon."}, DANI)
    mio = (await server.merc_lista("", ANA))["mios"][0]
    assert mio["estado"] == "rechazado" and "material de una empresa" in mio["motivo"] and "Es de Amazon." in mio["motivo"]
    assert "Motivo:" in mundo.g["mercadillo_avisos"].docs[-1]["texto"]


@pytest.mark.asyncio(loop_scope="session")
async def test_tope_de_tres_y_fotos_solo_propias(mundo):
    await _abrir(mundo)
    for i in range(3):
        await _anuncio(ANA, f"Cosa {i}", "10")
    with pytest.raises(HTTPException) as e:
        await _anuncio(ANA, "La cuarta", "10")
    assert "3 anuncios" in e.value.detail
    foto_de_ana = mundo.g["mercadillo_fotos"].docs[0]["id"]
    with pytest.raises(HTTPException):
        await server.merc_crear({"titulo": "Robando fotos", "categoria": "otros", "estado_articulo": "nuevo",
                                 "precio": "5", "fotos": [foto_de_ana], "acepto": True}, LUIS)


@pytest.mark.asyncio(loop_scope="session")
async def test_vendido_sale_de_la_lista_y_corregir_vuelve_a_revision(mundo):
    await _abrir(mundo)
    a = await _anuncio(ANA, "Gorra", "8")
    await server.admin_mercadillo_anuncio(a["id"], {"accion": "aprobar"}, DANI)
    fotos = (await server.merc_lista("", ANA))["mios"][0]["fotos"]
    await server.merc_cambiar(a["id"], {"titulo": "Gorra nueva", "categoria": "ropa", "estado_articulo": "nuevo",
                                        "precio": "9", "fotos": fotos, "acepto": True}, ANA)
    assert (await server.merc_lista("", LUIS))["anuncios"] == []           # corregido: a revisión otra vez
    await server.admin_mercadillo_anuncio(a["id"], {"accion": "aprobar"}, DANI)
    await server.merc_cambiar(a["id"], {"accion": "vendido"}, ANA)
    assert (await server.merc_lista("", LUIS))["anuncios"] == []
    with pytest.raises(HTTPException):
        await server.merc_cambiar(a["id"], {"accion": "vendido"}, LUIS)    # no es suyo


# ── MENSAJES PRIVADOS ───────────────────────────────────────────────────────
@pytest.mark.asyncio(loop_scope="session")
async def test_me_interesa_abre_una_conversacion_privada_con_buzon(mundo):
    await _abrir(mundo)
    a = await _anuncio(ANA, "Soporte de móvil", "15")
    await server.admin_mercadillo_anuncio(a["id"], {"accion": "aprobar"}, DANI)
    r = await server.merc_contactar(a["id"], {"texto": "¿Sigue disponible?"}, PEPE)
    # A Ana le llega a su buzón (y un correo SIN el mensaje dentro).
    assert (await server.merc_estado(ANA))["sin_leer"] >= 1
    buzon = (await server.merc_buzon(ANA))["conversaciones"]
    assert buzon[0]["con"] == "Pepe P." and buzon[0]["sin_leer"] is True and buzon[0]["soy"] == "vendedor"
    correo = mundo.enviados[-1]
    assert correo.to == "ana@x.es" and "¿Sigue disponible?" not in correo.texto
    conv = await server.merc_conversacion(r["conversacion_id"], ANA)
    assert [m["texto"] for m in conv["mensajes"]] == ["¿Sigue disponible?"] and conv["mensajes"][0]["mio"] is False
    assert not (await server.merc_buzon(ANA))["conversaciones"][0]["sin_leer"]          # leído
    await server.merc_responder(r["conversacion_id"], {"texto": "Sí, mañana en la nave"}, ANA)
    assert (await server.merc_buzon(PEPE))["conversaciones"][0]["sin_leer"] is True
    # Luis no puede leerla, ni escribir en ella.
    for f in (server.merc_conversacion(r["conversacion_id"], LUIS),
              server.merc_responder(r["conversacion_id"], {"texto": "hola"}, LUIS)):
        with pytest.raises(HTTPException) as e:
            await f
        assert e.value.status_code == 404
    with pytest.raises(HTTPException):
        await server.merc_contactar(a["id"], {"texto": "me lo compro"}, ANA)          # su propio anuncio
    # Un segundo «Me interesa» de Pepe sigue en la misma conversación.
    r2 = await server.merc_contactar(a["id"], {"texto": "Vale"}, PEPE)
    assert r2["conversacion_id"] == r["conversacion_id"] and len(mundo.g["mercadillo_conversaciones"].docs) == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_correo_de_aviso_como_mucho_cada_6_horas(mundo):
    await _abrir(mundo)
    a = await _anuncio(ANA, "Botas", "20")
    await server.admin_mercadillo_anuncio(a["id"], {"accion": "aprobar"}, DANI)
    antes = len(mundo.enviados)
    r = await server.merc_contactar(a["id"], {"texto": "uno"}, PEPE)
    await server.merc_responder(r["conversacion_id"], {"texto": "dos"}, PEPE)
    await server.merc_responder(r["conversacion_id"], {"texto": "tres"}, PEPE)
    assert len([e for e in mundo.enviados[antes:] if e.to == "ana@x.es"]) == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_si_ya_lo_habia_leido_el_siguiente_mensaje_vuelve_a_avisar(mundo):
    await _abrir(mundo)
    a = await _anuncio(ANA, "Mochila", "12")
    await server.admin_mercadillo_anuncio(a["id"], {"accion": "aprobar"}, DANI)
    r = await server.merc_contactar(a["id"], {"texto": "hola"}, PEPE)
    await server.merc_conversacion(r["conversacion_id"], ANA)               # Ana lo lee…
    await server.merc_responder(r["conversacion_id"], {"texto": "sí"}, ANA)
    antes = len([e for e in mundo.enviados if e.to == "ana@x.es"])
    await server.merc_responder(r["conversacion_id"], {"texto": "¿cuándo?"}, PEPE)   # …y le llega el nuevo
    assert len([e for e in mundo.enviados if e.to == "ana@x.es"]) == antes + 1


@pytest.mark.asyncio(loop_scope="session")
async def test_a_dani_le_llegan_los_mensajes_de_sus_anuncios(mundo):
    """17-10: Dani vende su iPhone como «fds»: antes no se le avisaba de nada."""
    await _abrir(mundo)
    a = await _anuncio(DANI, "iPhone 18 Pro · 256 GB", "1.300")
    await server.admin_mercadillo_anuncio(a["id"], {"accion": "aprobar"}, DANI)
    await server.merc_contactar(a["id"], {"texto": "¿Lo tienes aún?"}, ANA)
    correo = mundo.enviados[-1]
    assert correo.to == "contacto@x.es" and "iPhone 18 Pro" in correo.subject and "¿Lo tienes aún?" not in correo.texto
    buzon = await server.merc_buzon(DANI)
    assert buzon["conversaciones"][0]["sin_leer"] is True and buzon["conversaciones"][0]["con"] == "Ana P."


@pytest.mark.asyncio(loop_scope="session")
async def test_avisos_al_movil_solo_si_los_quiere_y_sin_el_mensaje(mundo, monkeypatch):
    """17-10: «si quiere que le salte en el móvil, que reciba notificaciones»."""
    pushes = []

    async def push(ids, titulo, cuerpo, url="/panel"):
        pushes.append(SimpleNamespace(ids=ids, titulo=titulo, cuerpo=cuerpo, url=url))
    monkeypatch.setattr(server, "send_web_push_to_users", push)
    monkeypatch.setattr(server, "_push_enabled", True)
    mundo.g["push_subscriptions"] = Col([{"endpoint": "e1", "user_id": "d1"}])     # el móvil de Ana, apuntado
    await _abrir(mundo)
    a = await _anuncio(ANA, "Linterna frontal", "9")
    await server.admin_mercadillo_anuncio(a["id"], {"accion": "aprobar"}, DANI)
    r = await server.merc_contactar(a["id"], {"texto": "dato secreto 666"}, PEPE)
    assert pushes == []                                                    # no los ha pedido: nada
    assert (await server.merc_estado(ANA))["avisos_movil"] is False
    assert (await server.merc_avisos_movil({"activo": True}, ANA))["avisos_movil"] is True
    assert (await server.merc_estado(ANA))["avisos_movil"] is True
    await server.merc_responder(r["conversacion_id"], {"texto": "otro dato secreto 777"}, PEPE)
    p = pushes[-1]
    assert p.ids == ["d1"] and p.url == "/conductor?vista=mercadillo"
    assert "Pepe P." in p.titulo and "Linterna frontal" in p.cuerpo and "777" not in p.cuerpo + p.titulo
    # Los avisos de FDS (publicado, rechazado…) también le saltan.
    b2 = await _anuncio(ANA, "Funda", "5")
    await server.admin_mercadillo_anuncio(b2["id"], {"accion": "aprobar"}, DANI)
    assert "ya está publicado" in pushes[-1].cuerpo
    # Y lo puede quitar.
    await server.merc_avisos_movil({"activo": False}, ANA)
    n = len(pushes)
    await server.merc_responder(r["conversacion_id"], {"texto": "¿sigue?"}, PEPE)
    assert len(pushes) == n


@pytest.mark.asyncio(loop_scope="session")
async def test_con_el_movil_puesto_no_se_gasta_correo(mundo, monkeypatch):
    """17-10: «correo vamos a quemar la cuota, mejor que me salte aviso». Al móvil si lo tiene; si no, correo."""
    pushes = []

    async def push(ids, titulo, cuerpo, url="/panel"):
        pushes.append(SimpleNamespace(ids=ids, titulo=titulo, url=url))
    monkeypatch.setattr(server, "send_web_push_to_users", push)
    monkeypatch.setattr(server, "_push_enabled", True)
    mundo.g["admin_users"] = Col([{"id": "dani", "super_admin": True}])
    await _abrir(mundo)
    # Dani sin los avisos puestos: el anuncio nuevo le llega por correo.
    a = await _anuncio(ANA, "Gafas", "10")
    assert mundo.enviados[-1].to == "contacto@x.es" and pushes == []
    # Con los avisos puestos PERO sin ningún móvil apuntado: sigue por correo (no se pierde nada).
    await server.merc_avisos_movil({"activo": True}, DANI)
    antes = len(mundo.enviados)
    await _anuncio(ANA, "Guantes", "6")
    assert len(mundo.enviados) == antes + 1 and pushes == []
    assert (await server.admin_mercadillo(DANI))["avisos"] == {"activo": True, "movil": False}
    # Con su móvil apuntado: solo al móvil, y al panel donde se aprueba.
    mundo.g["push_subscriptions"] = Col([{"endpoint": "dani-movil", "user_id": "dani"}, {"endpoint": "ana-movil", "user_id": "d1"}])
    antes = len(mundo.enviados)
    await _anuncio(LUIS, "Botas", "15")
    assert len(mundo.enviados) == antes and pushes[-1].ids == ["dani"] and pushes[-1].url == "/panel/admin?s=mercadillo"
    assert (await server.admin_mercadillo(DANI))["avisos"] == {"activo": True, "movil": True}
    # Igual para quien vende: con su móvil puesto, el mensaje le llega al móvil y no por correo.
    await server.merc_avisos_movil({"activo": True}, ANA)
    await server.admin_mercadillo_anuncio(a["id"], {"accion": "aprobar"}, DANI)
    antes = len([e for e in mundo.enviados if e.to == "ana@x.es"])
    await server.merc_contactar(a["id"], {"texto": "hola"}, PEPE)
    assert len([e for e in mundo.enviados if e.to == "ana@x.es"]) == antes and pushes[-1].ids == ["d1"]


# ── DENUNCIAS (DSA) ─────────────────────────────────────────────────────────
@pytest.mark.asyncio(loop_scope="session")
async def test_denuncia_acuse_ocultar_con_tres_y_decision(mundo):
    await _abrir(mundo)
    a = await _anuncio(ANA, "Algo raro", "99")
    await server.admin_mercadillo_anuncio(a["id"], {"accion": "aprobar"}, DANI)
    mundo.g["organizations"].docs += [{"id": "o2", "name": "Rosa", "plan": "autonomo"}, {"id": "o3", "name": "Juan", "plan": "autonomo"}]
    quienes = [PEPE, {"sub": "x", "role": "admin", "org_id": "o2", "name": "Rosa"}, {"sub": "y", "role": "admin", "org_id": "o3", "name": "Juan"}]
    for i, q in enumerate(quienes):
        await server.merc_denunciar({"anuncio_id": a["id"], "motivo": "estafa", "texto": "pide pago por adelantado"}, q)
        assert "Hemos recibido tu aviso" in mundo.g["mercadillo_avisos"].docs[-1]["texto"]
        visible = [x["id"] for x in (await server.merc_lista("", LUIS))["anuncios"]]
        assert (a["id"] in visible) is (i < 2)                            # con la tercera, se oculta
    assert "denuncia" in mundo.enviados[-1].subject.lower()
    pend = await server.admin_mercadillo(DANI)
    assert pend["totales"]["denuncias"] == 3 and pend["por_revisar"][0]["estado"] == "en_revision"
    await server.admin_mercadillo_denuncia(pend["denuncias"][0]["id"], {"decision": "actuar", "motivo": "denuncias"}, DANI)
    assert (await server.merc_lista("", ANA))["mios"][0]["estado"] == "retirado"
    decisiones = [x for x in mundo.g["mercadillo_avisos"].docs if "Sobre tu aviso" in x["texto"]]
    assert len(decisiones) == 3 and all("retirado" in x["texto"] for x in decisiones)
    assert any("Motivo:" in x["texto"] and x["para"] == "d:owner:d1" for x in mundo.g["mercadillo_avisos"].docs)


@pytest.mark.asyncio(loop_scope="session")
async def test_denunciar_una_conversacion_la_deja_leer_a_dani_y_puede_cerrarla(mundo):
    await _abrir(mundo)
    a = await _anuncio(ANA, "Cascos", "30")
    await server.admin_mercadillo_anuncio(a["id"], {"accion": "aprobar"}, DANI)
    r = await server.merc_contactar(a["id"], {"texto": "insulto feo"}, PEPE)
    await server.merc_denunciar({"conversacion_id": r["conversacion_id"], "motivo": "ofensivo"}, ANA)
    den = (await server.admin_mercadillo(DANI))["denuncias"][0]
    assert den["mensajes"][0]["texto"] == "insulto feo" and den["mensajes"][0]["de"] == "Pepe P."
    await server.admin_mercadillo_denuncia(den["id"], {"decision": "actuar"}, DANI)
    with pytest.raises(HTTPException) as e:
        await server.merc_responder(r["conversacion_id"], {"texto": "otra"}, PEPE)
    assert e.value.status_code == 403


# ── LIMPIEZA ────────────────────────────────────────────────────────────────
@pytest.mark.asyncio(loop_scope="session")
async def test_caduca_a_los_30_dias_y_se_borra_a_su_tiempo(mundo):
    await _abrir(mundo)
    a = await _anuncio(ANA, "Linterna", "5")
    await server.admin_mercadillo_anuncio(a["id"], {"accion": "aprobar"}, DANI)
    r = await server.merc_contactar(a["id"], {"texto": "hola"}, PEPE)
    ahora = datetime.now(timezone.utc)
    h = await server.merc_limpieza(ahora + timedelta(days=31))
    assert h["caducados"] == 1 and "ha cumplido" in mundo.g["mercadillo_avisos"].docs[-1]["texto"]
    assert (await server.merc_lista("", LUIS))["anuncios"] == []
    h = await server.merc_limpieza(ahora + timedelta(days=31 + 61))
    assert h["anuncios_borrados"] == 1 and mundo.g["mercadillo_fotos"].docs == []
    h = await server.merc_limpieza(ahora + timedelta(days=200))
    assert h["conversaciones_borradas"] == 1 and mundo.g["mercadillo_mensajes"].docs == []
    assert r["conversacion_id"]


@pytest.mark.asyncio(loop_scope="session")
async def test_fotos_que_no_llegan_a_un_anuncio_se_borran(mundo):
    await _abrir(mundo)
    await server.merc_subir_foto(_Fichero(_jpeg_con_gps()), ANA)
    h = await server.merc_limpieza(datetime.now(timezone.utc) + timedelta(days=3))
    assert h["fotos_sueltas"] == 1 and mundo.g["mercadillo_fotos"].docs == []


# ── BLOQUEAR A UNA PERSONA (10-11-2026) ─────────────────────────────────────
# Si A bloquea a B: ninguno ve los anuncios del otro (lista, ficha y foto: 404), ninguno escribe al otro, en el
# buzón de A sus conversaciones desaparecen y en el de B salen cerradas, a B no se le dice nada y desbloquear lo
# devuelve todo. Cada regla va con su control: quien no tiene un bloqueo por medio ve lo de siempre.
HAS_BLOQUEADO = "Has bloqueado a esta persona. Desbloquéala para escribirle."
CERRADA = "Esta conversación está cerrada"
A_LA_VENTA = "Ese anuncio ya no está a la venta"


async def _publicado(user, titulo, precio="15"):
    a = await _anuncio(user, titulo, precio)
    await server.admin_mercadillo_anuncio(a["id"], {"accion": "aprobar"}, DANI)
    return a


async def _falla(intento, codigo, texto=None):
    """El intento da ese error y, si se dice, con ese texto EXACTO (es lo que lee la persona)."""
    with pytest.raises(HTTPException) as e:
        await intento
    assert e.value.status_code == codigo, f"{e.value.status_code}: {e.value.detail}"
    if texto is not None:
        assert e.value.detail == texto
    return e.value


async def _titulos(user) -> set:
    return {a["titulo"] for a in (await server.merc_lista("", user))["anuncios"]}


@pytest.mark.asyncio(loop_scope="session")
async def test_bloquear_desde_un_anuncio_y_dejan_de_verse_los_dos(mundo):
    await _abrir(mundo)
    de_ana, de_pepe, de_luis = (await _publicado(ANA, "Soporte de móvil"), await _publicado(PEPE, "Carretilla"),
                                await _publicado(LUIS, "Botas"))
    todos = {"Soporte de móvil", "Carretilla", "Botas"}
    for quien in (ANA, PEPE, LUIS, DANI):
        assert await _titulos(quien) == todos
    avisos, correos = len(mundo.g["mercadillo_avisos"].docs), len(mundo.enviados)
    r = await server.merc_bloquear({"anuncio_id": de_ana["id"]}, PEPE)
    assert set(r) == {"ok", "bloqueo"} and r["ok"] is True and set(r["bloqueo"]) == {"id", "nombre", "desde"}
    assert r["bloqueo"]["nombre"] == "Ana P." and re.fullmatch(r"[0-9a-f]{16}", r["bloqueo"]["id"])
    assert datetime.fromisoformat(r["bloqueo"]["desde"]).tzinfo is not None
    guardado = mundo.g["mercadillo_bloqueos"].docs
    assert len(guardado) == 1 and {k: guardado[0][k] for k in ("de", "a", "de_nombre", "a_nombre", "origen")} == {
        "de": CLAVES["pepe"], "a": CLAVES["ana"], "de_nombre": "Pepe P.", "a_nombre": "Ana P.",
        "origen": {"tipo": "anuncio", "id": de_ana["id"], "titulo": "Soporte de móvil"}}
    # LA LISTA: Pepe ya no ve lo de Ana, ni Ana lo de Pepe (es mutuo: que no le pueda rondar). Luis y Dani, lo de siempre.
    assert await _titulos(PEPE) == {"Carretilla", "Botas"} and await _titulos(ANA) == {"Soporte de móvil", "Botas"}
    assert await _titulos(LUIS) == todos and await _titulos(DANI) == todos
    assert [(await server.merc_lista("", q))["bloqueados"] for q in (PEPE, ANA, LUIS, DANI)] == [1, 0, 0, 0]
    assert [(await server.merc_estado(q))["bloqueados"] for q in (PEPE, ANA)] == [1, 0]
    # LA FICHA Y LA FOTO por su dirección (y denunciarlo): 404, como un anuncio que se ha quitado.
    for intento in (server.merc_anuncio(de_ana["id"], PEPE), server.merc_ver_foto(de_ana["fotos"][0], PEPE),
                    server.merc_anuncio(de_pepe["id"], ANA), server.merc_ver_foto(de_pepe["fotos"][0], ANA),
                    server.merc_denunciar({"anuncio_id": de_ana["id"], "motivo": "ofensivo"}, PEPE)):
        await _falla(intento, 404, "Ese anuncio ya no está")
    for quien in (LUIS, DANI, ANA):                                        # los demás, y ella misma, lo siguen viendo
        assert (await server.merc_anuncio(de_ana["id"], quien))["titulo"] == "Soporte de móvil"
        assert (await server.merc_ver_foto(de_ana["fotos"][0], quien)).status_code == 200
    # «ME INTERESA», en los dos sentidos: ninguno escribe al otro y no se abre ninguna conversación.
    await _falla(server.merc_contactar(de_pepe["id"], {"texto": "hola"}, ANA), 404, A_LA_VENTA)
    await _falla(server.merc_contactar(de_ana["id"], {"texto": "hola"}, PEPE), 400, HAS_BLOQUEADO)
    assert mundo.g["mercadillo_conversaciones"].docs == [] and mundo.g["mercadillo_mensajes"].docs == []
    assert all(a["interesados"] == 0 for a in mundo.g["mercadillo_anuncios"].docs)
    # A ANA NO SE LE AVISA: ni un aviso en su buzón ni un correo (y a Dani, sin avisos al móvil, no se le gasta uno).
    assert (len(mundo.g["mercadillo_avisos"].docs), len(mundo.enviados)) == (avisos, correos)
    # Con quien no hay un bloqueo por medio, todo sigue igual.
    assert (await server.merc_contactar(de_ana["id"], {"texto": "hola"}, LUIS))["ok"] is True
    assert (await server.merc_contactar(de_luis["id"], {"texto": "hola"}, PEPE))["ok"] is True


@pytest.mark.asyncio(loop_scope="session")
async def test_bloquear_desde_una_conversacion_el_buzon_y_escribir_de_cada_lado(mundo):
    await _abrir(mundo)
    a = await _publicado(ANA, "Soporte de móvil")
    cid = (await server.merc_contactar(a["id"], {"texto": "¿Sigue disponible?"}, PEPE))["conversacion_id"]
    await server.merc_responder(cid, {"texto": "Sí"}, ANA)
    await server.merc_responder(cid, {"texto": "un insulto feo"}, PEPE)        # Ana lo tiene sin leer
    await server.merc_avisos_leidos(ANA)                                       # (que no cuente su aviso de «publicado»)
    assert (await server.merc_estado(ANA))["sin_leer"] == 1
    sin_leer_de_pepe = (await server.merc_estado(PEPE))["sin_leer"]
    avisos, correos, mensajes = (len(mundo.g["mercadillo_avisos"].docs), len(mundo.enviados),
                                 len(mundo.g["mercadillo_mensajes"].docs))
    r = await server.merc_bloquear({"conversacion_id": cid}, ANA)              # la que vende bloquea a quien le escribe
    assert r["bloqueo"]["nombre"] == "Pepe P." and "ya" not in r
    guardado = mundo.g["mercadillo_bloqueos"].docs[0]
    assert (guardado["de"], guardado["a"], guardado["origen"]) == (
        CLAVES["ana"], CLAVES["pepe"], {"tipo": "conversacion", "id": cid, "titulo": "Soporte de móvil"})
    # ANA (la que bloquea): la conversación sale de su buzón y de su globito, su contador queda a cero, por su
    # dirección no existe (ni para denunciarla) y, si le escribe, se le dice cómo deshacerlo.
    assert (await server.merc_buzon(ANA))["conversaciones"] == []
    assert (await server.merc_estado(ANA))["sin_leer"] == 0
    assert mundo.g["mercadillo_conversaciones"].docs[0]["sin_leer"][CLAVES["ana"]] == 0
    await _falla(server.merc_conversacion(cid, ANA), 404, "Esa conversación no existe")
    await _falla(server.merc_denunciar({"conversacion_id": cid, "motivo": "ofensivo"}, ANA), 404, "Esa conversación no existe")
    await _falla(server.merc_responder(cid, {"texto": "y tú más"}, ANA), 400, HAS_BLOQUEADO)
    # PEPE (el bloqueado): la conserva, que es su historial, pero cerrada; del anuncio de Ana solo le queda el título.
    suyas = (await server.merc_buzon(PEPE))["conversaciones"]
    assert len(suyas) == 1 and suyas[0]["bloqueada"] is True and suyas[0]["con"] == "Ana P." and suyas[0]["soy"] == "comprador"
    assert (suyas[0]["titulo"], suyas[0]["foto"], suyas[0]["precio_cent"], suyas[0]["estado_anuncio"]) == (
        "Soporte de móvil", None, None, "borrado")
    conv = await server.merc_conversacion(cid, PEPE)
    assert conv["bloqueada"] is True and conv["anuncio"] == {"titulo": "Soporte de móvil", "estado": "borrado"}
    assert [m["texto"] for m in conv["mensajes"]] == ["¿Sigue disponible?", "Sí", "un insulto feo"]
    await _falla(server.merc_responder(cid, {"texto": "¿hola?"}, PEPE), 403, CERRADA)      # no se le dice quién ni por qué
    await _falla(server.merc_contactar(a["id"], {"texto": "¿hola?"}, PEPE), 404, A_LA_VENTA)
    # Ni un mensaje nuevo, ni un aviso, ni un correo: a Pepe no le llega nada, y su globito no cambia.
    assert (len(mundo.g["mercadillo_avisos"].docs), len(mundo.enviados), len(mundo.g["mercadillo_mensajes"].docs)) == (
        avisos, correos, mensajes)
    assert (await server.merc_estado(PEPE))["sin_leer"] == sin_leer_de_pepe
    # El control: la conversación de Ana con otra persona ni se esconde ni se cierra.
    con_luis = (await server.merc_contactar(a["id"], {"texto": "¿y a mí?"}, LUIS))["conversacion_id"]
    assert [(c["id"], c["bloqueada"], c["foto"]) for c in (await server.merc_buzon(ANA))["conversaciones"]] == [
        (con_luis, False, a["fotos"][0])]
    assert (await server.merc_buzon(LUIS))["conversaciones"][0]["estado_anuncio"] == "publicado"


@pytest.mark.asyncio(loop_scope="session")
async def test_si_bloquea_quien_compraba_la_que_vende_conserva_su_anuncio_y_tampoco_le_escribe(mundo):
    await _abrir(mundo)
    a = await _publicado(ANA, "Soporte de móvil")
    cid = (await server.merc_contactar(a["id"], {"texto": "hola"}, PEPE))["conversacion_id"]
    assert (await server.merc_bloquear({"conversacion_id": cid}, PEPE))["bloqueo"]["nombre"] == "Ana P."
    assert (await server.merc_buzon(PEPE))["conversaciones"] == []
    await _falla(server.merc_responder(cid, {"texto": "nada"}, PEPE), 400, HAS_BLOQUEADO)
    # Ana ve la conversación cerrada, con SU anuncio entero (es suyo: eso no se le tapa).
    suya = (await server.merc_buzon(ANA))["conversaciones"][0]
    assert (suya["bloqueada"], suya["soy"], suya["foto"], suya["estado_anuncio"]) == (True, "vendedor", a["fotos"][0], "publicado")
    conv = await server.merc_conversacion(cid, ANA)
    assert conv["bloqueada"] is True and conv["anuncio"]["id"] == a["id"] and conv["anuncio"]["mio"] is True
    await _falla(server.merc_responder(cid, {"texto": "¿hola?"}, ANA), 403, CERRADA)


@pytest.mark.asyncio(loop_scope="session")
async def test_si_los_dos_se_bloquean_manda_el_bloqueo_de_cada_uno(mundo):
    """El bloqueado puede bloquear a su vez (desde la conversación, que conserva). Entonces a cada uno se le aplica
    lo SUYO —no la ve y, si escribe, se le dice que desbloquee—, y quitar uno de los dos bloqueos no quita el otro."""
    await _abrir(mundo)
    a, p = await _publicado(ANA, "Soporte de móvil"), await _publicado(PEPE, "Carretilla")
    cid = (await server.merc_contactar(a["id"], {"texto": "hola"}, PEPE))["conversacion_id"]
    de_ana = (await server.merc_bloquear({"conversacion_id": cid}, ANA))["bloqueo"]
    await _falla(server.merc_bloquear({"anuncio_id": a["id"]}, PEPE), 404, "Ese anuncio ya no está")   # por su anuncio ya no puede
    de_pepe = (await server.merc_bloquear({"conversacion_id": cid}, PEPE))["bloqueo"]                  # por la conversación, sí
    assert (de_ana["nombre"], de_pepe["nombre"]) == ("Pepe P.", "Ana P.")
    for quien in (ANA, PEPE):
        assert (await server.merc_buzon(quien))["conversaciones"] == [] and (await server.merc_lista("", quien))["bloqueados"] == 1
        await _falla(server.merc_conversacion(cid, quien), 404, "Esa conversación no existe")
        await _falla(server.merc_responder(cid, {"texto": "eh"}, quien), 400, HAS_BLOQUEADO)
    await _falla(server.merc_contactar(p["id"], {"texto": "eh"}, ANA), 400, HAS_BLOQUEADO)
    assert (await _titulos(ANA), await _titulos(PEPE)) == ({"Soporte de móvil"}, {"Carretilla"})
    # Ana desbloquea: sigue en pie el de Pepe, así que ella pasa a ser «la bloqueada» (la ve cerrada y no ve lo de él).
    await server.merc_desbloquear(de_ana["id"], ANA)
    assert (await _titulos(ANA), await _titulos(PEPE)) == ({"Soporte de móvil"}, {"Carretilla"})
    assert [(c["id"], c["bloqueada"]) for c in (await server.merc_buzon(ANA))["conversaciones"]] == [(cid, True)]
    await _falla(server.merc_responder(cid, {"texto": "¿hola?"}, ANA), 403, CERRADA)
    await _falla(server.merc_contactar(p["id"], {"texto": "¿hola?"}, ANA), 404, A_LA_VENTA)
    assert (await server.merc_buzon(PEPE))["conversaciones"] == []
    await _falla(server.merc_responder(cid, {"texto": "eh"}, PEPE), 400, HAS_BLOQUEADO)
    # Y cuando desbloquea también Pepe, vuelve todo.
    await server.merc_desbloquear(de_pepe["id"], PEPE)
    assert await _titulos(ANA) == await _titulos(PEPE) == {"Soporte de móvil", "Carretilla"}
    await server.merc_responder(cid, {"texto": "perdona"}, PEPE)
    assert [(c["id"], c["bloqueada"]) for c in (await server.merc_buzon(ANA))["conversaciones"]] == [(cid, False)]


@pytest.mark.asyncio(loop_scope="session")
async def test_lo_bloqueado_no_cuenta_sin_leer_ni_aunque_un_mensaje_se_cruce_con_el_bloqueo(mundo):
    await _abrir(mundo)
    a = await _publicado(ANA, "Soporte de móvil")
    await server.merc_avisos_leidos(ANA)
    cid = (await server.merc_contactar(a["id"], {"texto": "hola"}, PEPE))["conversacion_id"]
    await server.merc_contactar(a["id"], {"texto": "hola"}, LUIS)
    assert (await server.merc_estado(ANA))["sin_leer"] == 2
    b = (await server.merc_bloquear({"conversacion_id": cid}, ANA))["bloqueo"]
    assert (await server.merc_estado(ANA))["sin_leer"] == 1                  # la de Luis sigue contando
    # Un mensaje de Pepe guardado a la vez que el bloqueo (su contador ya no está a cero): tampoco cuenta.
    await mundo.g["mercadillo_conversaciones"].update_one({"id": cid}, {"$set": {f"sin_leer.{CLAVES['ana']}": 3}})
    assert (await server.merc_estado(ANA))["sin_leer"] == 1
    # Al desbloquear vuelve la conversación a su buzón, y con ella lo que tenga sin leer.
    await server.merc_desbloquear(b["id"], ANA)
    assert (await server.merc_estado(ANA))["sin_leer"] == 2


@pytest.mark.asyncio(loop_scope="session")
async def test_desbloquear_lo_devuelve_todo_menos_lo_que_cerro_la_moderacion(mundo):
    await _abrir(mundo)
    a, a2, p = await _publicado(ANA, "Soporte de móvil"), await _publicado(ANA, "Cascos"), await _publicado(PEPE, "Carretilla")
    cid = (await server.merc_contactar(a["id"], {"texto": "¿Sigue disponible?"}, PEPE))["conversacion_id"]
    cerrada = (await server.merc_contactar(a2["id"], {"texto": "insulto feo"}, PEPE))["conversacion_id"]
    await server.merc_denunciar({"conversacion_id": cerrada, "motivo": "ofensivo"}, ANA)
    den = (await server.admin_mercadillo(DANI))["denuncias"][0]
    await server.admin_mercadillo_denuncia(den["id"], {"decision": "actuar"}, DANI)      # esa la cierra la moderación
    b = (await server.merc_bloquear({"conversacion_id": cid}, ANA))["bloqueo"]
    assert (await server.merc_buzon(ANA))["conversaciones"] == [] and await _titulos(PEPE) == {"Carretilla"}
    # La que cerró la moderación está cerrada para los dos, con bloqueo o sin él (no se le manda a desbloquear).
    await _falla(server.merc_responder(cerrada, {"texto": "hola"}, ANA), 403, CERRADA)
    # «Personas bloqueadas»: a quién, desde cuándo y desde qué. Cada uno ve y quita solo las suyas.
    assert await server.merc_bloqueados(ANA) == {"bloqueados": [
        {"id": b["id"], "nombre": "Pepe P.", "desde": b["desde"], "titulo": "Soporte de móvil"}]}
    assert await server.merc_bloqueados(PEPE) == {"bloqueados": []}
    await _falla(server.merc_desbloquear(b["id"], PEPE), 404, "Ese bloqueo ya no está")
    assert len(mundo.g["mercadillo_bloqueos"].docs) == 1
    assert await server.merc_desbloquear(b["id"], ANA) == {"ok": True}
    await _falla(server.merc_desbloquear(b["id"], ANA), 404, "Ese bloqueo ya no está")
    assert mundo.g["mercadillo_bloqueos"].docs == [] and (await server.merc_lista("", ANA))["bloqueados"] == 0
    # Vuelven los anuncios (lista, ficha y foto), en los dos sentidos…
    assert await _titulos(PEPE) == await _titulos(ANA) == {"Soporte de móvil", "Cascos", "Carretilla"}
    assert (await server.merc_anuncio(a["id"], PEPE))["conversacion_id"] == cid
    assert (await server.merc_ver_foto(a["fotos"][0], PEPE)).status_code == 200
    assert (await server.merc_anuncio(p["id"], ANA))["titulo"] == "Carretilla"
    # …y las conversaciones: la del bloqueo, abierta y ya leída (su contador se puso a cero al bloquear); la que
    # cerró la moderación sigue cerrada.
    de_ana = {c["id"]: c for c in (await server.merc_buzon(ANA))["conversaciones"]}
    assert (de_ana[cid]["bloqueada"], de_ana[cid]["sin_leer"], de_ana[cerrada]["bloqueada"]) == (False, False, True)
    de_pepe = {c["id"]: c for c in (await server.merc_buzon(PEPE))["conversaciones"]}
    assert (de_pepe[cid]["bloqueada"], de_pepe[cid]["foto"], de_pepe[cid]["estado_anuncio"]) == (False, a["fotos"][0], "publicado")
    assert de_pepe[cerrada]["bloqueada"] is True
    assert (await server.merc_conversacion(cid, PEPE))["anuncio"]["id"] == a["id"]
    await server.merc_responder(cid, {"texto": "perdona"}, PEPE)
    await server.merc_responder(cid, {"texto": "vale"}, ANA)
    for quien in (ANA, PEPE):
        await _falla(server.merc_responder(cerrada, {"texto": "hola"}, quien), 403, CERRADA)


@pytest.mark.asyncio(loop_scope="session")
async def test_bloquear_dos_veces_no_falla_y_no_se_bloquea_lo_que_no_se_ve_ni_a_uno_mismo(mundo, monkeypatch):
    await _abrir(mundo)
    a = await _publicado(ANA, "Soporte de móvil")
    cid = (await server.merc_contactar(a["id"], {"texto": "hola"}, PEPE))["conversacion_id"]
    # Sin decir a quién, lo que no existe, la conversación de otros, lo suyo: nada de eso bloquea a nadie. (Un anuncio
    # que existe pero no está publicado SÍ vale para bloquear a quien lo vende: es la prueba siguiente.)
    await _falla(server.merc_bloquear({}, PEPE), 400, "Falta a quién bloqueas")
    await _falla(server.merc_bloquear([], PEPE), 400, "Falta a quién bloqueas")
    # Un cuerpo con los tipos cambiados (una lista o un número donde va un id) no es un 500: no encuentra nada.
    for raro in ({"anuncio_id": ["x"]}, {"anuncio_id": {"a": 1}}, {"conversacion_id": 5}, {"conversacion_id": True}):
        await _falla(server.merc_bloquear(raro, PEPE), 404)
    await _falla(server.merc_desbloquear("../../no-es-un-id", PEPE), 404, "Ese bloqueo ya no está")
    await _falla(server.merc_bloquear({"anuncio_id": "no-existe"}, PEPE), 404, "Ese anuncio ya no está")
    await _falla(server.merc_bloquear({"conversacion_id": cid}, LUIS), 404, "Esa conversación no existe")
    await _falla(server.merc_bloquear({"anuncio_id": a["id"]}, ANA), 400, "Es tu anuncio")
    await mundo.g["mercadillo_conversaciones"].insert_one({
        "id": "consigo", "anuncio_id": "x", "anuncio_titulo": "Raro",
        "comprador": {"clave": CLAVES["pepe"], "nombre": "Pepe P."}, "vendedor": {"clave": CLAVES["pepe"], "nombre": "Pepe P."}})
    await _falla(server.merc_bloquear({"conversacion_id": "consigo"}, PEPE), 400, "No puedes bloquearte a ti")
    # Un anuncio sin dueño conocido (un dato viejo o roto) no deja un bloqueo «a nadie».
    await mundo.g["mercadillo_anuncios"].insert_one({
        "id": "sindueno", "titulo": "Sin dueño", "estado": "publicado", "vendedor": {"nombre": "Fantasma"},
        "caduca": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()})
    await _falla(server.merc_bloquear({"anuncio_id": "sindueno"}, PEPE), 404, "Esa persona ya no está en el mercadillo")
    assert mundo.g["mercadillo_bloqueos"].docs == []
    # Dos veces a la misma persona (desde el anuncio y desde la conversación): no falla, dice que ya estaba y no hay dos.
    primero = await server.merc_bloquear({"anuncio_id": a["id"]}, PEPE)
    for cuerpo in ({"anuncio_id": a["id"]}, {"conversacion_id": cid}):
        assert await server.merc_bloquear(cuerpo, PEPE) == {"ok": True, "ya": True, "bloqueo": primero["bloqueo"]}
    assert len(mundo.g["mercadillo_bloqueos"].docs) == 1
    # Dos toques A LA VEZ: los dos pasan el «¿ya estaba?», el índice único (de, a) rechaza el segundo, y este
    # contesta lo mismo sin dejar otro bloqueo ni avisar otra vez a Dani.
    await server.merc_desbloquear(primero["bloqueo"]["id"], PEPE)
    col, avisado = mundo.g["mercadillo_bloqueos"], []
    guardar = col.insert_one

    async def el_otro_toque_llego_antes(doc):
        await guardar({**doc, "id": "0000elotrotoque0"})
        raise DuplicateKeyError("E11000 duplicate key error collection: mercadillo_bloqueos index: mercadillo_bloqueo_unico")

    async def a_dani(b):
        avisado.append(b)
    monkeypatch.setattr(col, "insert_one", el_otro_toque_llego_antes)
    monkeypatch.setattr(server, "_merc_bloqueo_a_dani", a_dani)
    r = await server.merc_bloquear({"anuncio_id": a["id"]}, PEPE)
    assert r == {"ok": True, "ya": True, "bloqueo": {"id": "0000elotrotoque0", "nombre": "Ana P.", "desde": col.docs[0]["ts"]}}
    assert len(col.docs) == 1 and avisado == []


async def _no_se_ve(anuncio: dict, user) -> None:
    """Ese anuncio, para esa persona, no está: ni su ficha, ni su foto, ni se puede denunciar, ni «Me interesa»."""
    for intento in (server.merc_anuncio(anuncio["id"], user), server.merc_ver_foto(anuncio["fotos"][0], user),
                    server.merc_denunciar({"anuncio_id": anuncio["id"], "motivo": "ofensivo"}, user)):
        await _falla(intento, 404, "Ese anuncio ya no está")
    await _falla(server.merc_contactar(anuncio["id"], {"texto": "hola"}, user), 404, A_LA_VENTA)


@pytest.mark.asyncio(loop_scope="session")
async def test_se_bloquea_tambien_desde_un_anuncio_que_ya_no_esta_publicado(mundo):
    """La web manda la denuncia ANTES del bloqueo («Denunciar también este anuncio»). Si esa denuncia es la tercera, el
    anuncio pasa a revisión y deja de verse: quien denunciaba por acoso se quedaba sin poder bloquear (404 para siempre).
    Para BLOQUEAR basta con que el anuncio exista (en el estado que sea), no sea suyo y quien lo vende no le haya
    bloqueado a él. Ver la ficha, sus fotos, denunciarlo y «Me interesa» NO cambian: lo que no está publicado no se ve."""
    await _abrir(mundo)
    a = await _publicado(ANA, "Algo raro")
    mundo.g["organizations"].docs += [{"id": "o2", "name": "Rosa", "plan": "autonomo"}, {"id": "o3", "name": "Juan", "plan": "autonomo"}]
    for quien in ({"sub": "x", "role": "admin", "org_id": "o2", "name": "Rosa"}, {"sub": "y", "role": "admin", "org_id": "o3", "name": "Juan"}):
        await server.merc_denunciar({"anuncio_id": a["id"], "motivo": "ofensivo"}, quien)
    # Pepe marca «Denunciar también este anuncio»: primero va su denuncia, que es la tercera y oculta el anuncio…
    assert await server.merc_denunciar({"anuncio_id": a["id"], "motivo": "ofensivo", "texto": "me insulta"}, PEPE) == {"ok": True}
    assert mundo.g["mercadillo_anuncios"].docs[0]["estado"] == "en_revision" and await _titulos(PEPE) == set()
    await _no_se_ve(a, PEPE)
    # …y después el bloqueo, que se hace igual.
    r = await server.merc_bloquear({"anuncio_id": a["id"]}, PEPE)
    assert set(r) == {"ok", "bloqueo"} and r["ok"] is True and r["bloqueo"]["nombre"] == "Ana P."
    assert [(b["de"], b["a"], b["origen"]) for b in mundo.g["mercadillo_bloqueos"].docs] == [
        (CLAVES["pepe"], CLAVES["ana"], {"tipo": "anuncio", "id": a["id"], "titulo": "Algo raro"})]
    assert await server.merc_bloquear({"anuncio_id": a["id"]}, PEPE) == {"ok": True, "ya": True, "bloqueo": r["bloqueo"]}
    # DESDE CUALQUIER ESTADO: un anuncio de Luis en cada uno de los que no se ven.
    casos = {}
    for titulo, cierre in (("Quitado", lambda x: server.merc_cambiar(x["id"], {"accion": "quitar"}, LUIS)),
                           ("Vendido", lambda x: server.merc_cambiar(x["id"], {"accion": "vendido"}, LUIS)),
                           ("Retirado", lambda x: server.admin_mercadillo_anuncio(x["id"], {"accion": "retirar", "motivo": "otro"}, DANI)),
                           ("Caducado", lambda x: mundo.g["mercadillo_anuncios"].update_one(
                               {"id": x["id"]}, {"$set": {"caduca": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()}}))):
        casos[titulo] = await _publicado(LUIS, titulo)
        await cierre(casos[titulo])
    casos["Rechazado"] = await _anuncio(LUIS, "Rechazado")
    await server.admin_mercadillo_anuncio(casos["Rechazado"]["id"], {"accion": "rechazar", "motivo": "fotos"}, DANI)
    casos["Pendiente"] = await _anuncio(LUIS, "Pendiente")
    ahora = datetime.now(timezone.utc)
    estados = {x["titulo"]: server._merc_estado(x, ahora) for x in mundo.g["mercadillo_anuncios"].docs if x["titulo"] in casos}
    assert estados == {"Quitado": "quitado", "Vendido": "vendido", "Retirado": "retirado", "Caducado": "caducado",
                       "Rechazado": "rechazado", "Pendiente": "pendiente"}
    assert await _titulos(PEPE) == set()
    for titulo, anuncio in casos.items():
        await _no_se_ve(anuncio, PEPE)                                         # no lo ve (como siempre)…
        r = await server.merc_bloquear({"anuncio_id": anuncio["id"]}, PEPE)   # …y puede bloquear a quien lo vende
        assert set(r) == {"ok", "bloqueo"} and r["bloqueo"]["nombre"] == "Luis G.", titulo
        guardado = await mundo.g["mercadillo_bloqueos"].find_one({"id": r["bloqueo"]["id"]})
        assert (guardado["de"], guardado["a"], guardado["origen"]) == (
            CLAVES["pepe"], CLAVES["luis"], {"tipo": "anuncio", "id": anuncio["id"], "titulo": titulo})
        await _no_se_ve(anuncio, PEPE)                                         # bloquear no le abre nada
        assert await server.merc_desbloquear(r["bloqueo"]["id"], PEPE) == {"ok": True}
    # LO QUE SIGUE IGUAL. Un anuncio que no existe; el suyo (aunque no esté publicado)…
    await _falla(server.merc_bloquear({"anuncio_id": "no-existe"}, PEPE), 404, "Ese anuncio ya no está")
    for anuncio in casos.values():
        await _falla(server.merc_bloquear({"anuncio_id": anuncio["id"]}, LUIS), 400, "Es tu anuncio")
    # …y si quien lo vende le ha bloqueado a ÉL, por su anuncio no puede (esté como esté el anuncio).
    de_pepe = await _publicado(PEPE, "Carretilla")
    await server.merc_bloquear({"anuncio_id": de_pepe["id"]}, LUIS)
    for anuncio in casos.values():
        await _falla(server.merc_bloquear({"anuncio_id": anuncio["id"]}, PEPE), 404, "Ese anuncio ya no está")
    assert sorted((b["de"], b["a"]) for b in mundo.g["mercadillo_bloqueos"].docs) == [
        (CLAVES["luis"], CLAVES["pepe"]), (CLAVES["pepe"], CLAVES["ana"])]


@pytest.mark.asyncio(loop_scope="session")
async def test_tope_de_bloqueos_al_dia_y_de_personas_bloqueadas(mundo):
    await _abrir(mundo)
    a, de_luis = await _publicado(ANA, "Soporte de móvil"), await _publicado(LUIS, "Botas")
    # 30 bloqueos al día. Cuentan los HECHOS (ni los que fallan ni los repetidos) y desbloquear no devuelve cupo:
    # bloquear y desbloquear en bucle no puede servir para llenarle el móvil de avisos a Dani.
    for _ in range(3):
        await _falla(server.merc_bloquear({"anuncio_id": "no-existe"}, PEPE), 404)
    for _ in range(mc.BLOQUEOS_DIA):
        b = (await server.merc_bloquear({"anuncio_id": a["id"]}, PEPE))["bloqueo"]
        assert (await server.merc_bloquear({"anuncio_id": a["id"]}, PEPE))["ya"] is True
        await server.merc_desbloquear(b["id"], PEPE)
    await _falla(server.merc_bloquear({"anuncio_id": a["id"]}, PEPE), 429, "Has bloqueado a mucha gente hoy. Prueba mañana.")
    assert mundo.g["mercadillo_bloqueos"].docs == [] and "Soporte de móvil" in await _titulos(PEPE)
    assert (await server.merc_bloquear({"anuncio_id": a["id"]}, LUIS))["ok"] is True        # el cupo es de cada uno
    cupo = server._public_actions["merc_bloquear:" + CLAVES["pepe"]]
    assert len(cupo) == mc.BLOQUEOS_DIA == 30
    server._public_actions["merc_bloquear:" + CLAVES["pepe"]] = [t - 86401 for t in cupo]     # al día siguiente…
    assert (await server.merc_bloquear({"anuncio_id": a["id"]}, PEPE))["ok"] is True          # …puede otra vez
    # 200 personas bloqueadas a la vez como mucho. A quien ya lo estaba se le sigue contestando «ya».
    mundo.g["mercadillo_bloqueos"].docs += [{"id": f"viejo{i}", "de": CLAVES["pepe"], "a": f"o:otra{i}", "a_nombre": "Otra",
                                             "ts": "2026-11-01T10:00:00+00:00"} for i in range(mc.BLOQUEOS_MAX - 1)]
    assert (await server.merc_lista("", PEPE))["bloqueados"] == mc.BLOQUEOS_MAX == 200
    e = await _falla(server.merc_bloquear({"anuncio_id": de_luis["id"]}, PEPE), 400)
    assert e.detail.startswith("Tienes 200 personas bloqueadas") and "Desbloquea a alguna" in e.detail
    assert "Botas" in await _titulos(PEPE) and len(mundo.g["mercadillo_bloqueos"].docs) == mc.BLOQUEOS_MAX + 1   # (+ el de Luis a Ana)
    assert (await server.merc_bloquear({"anuncio_id": a["id"]}, PEPE))["ya"] is True


@pytest.mark.asyncio(loop_scope="session")
async def test_a_dani_se_le_puede_bloquear_pero_el_modera_lo_ve_todo_y_no_bloquea(mundo):
    await _abrir(mundo)
    iphone, soporte, botas = (await _publicado(DANI, "iPhone 18 Pro · 256 GB", "1.300"), await _publicado(ANA, "Soporte de móvil"),
                              await _publicado(LUIS, "Botas"))
    le_compra = (await server.merc_contactar(iphone["id"], {"texto": "¿Lo tienes aún?"}, ANA))["conversacion_id"]
    le_vende = (await server.merc_contactar(soporte["id"], {"texto": "Me lo quedo"}, DANI))["conversacion_id"]
    # Él no bloquea: modera (retira el anuncio o cierra la conversación).
    for cuerpo in ({"anuncio_id": soporte["id"]}, {"conversacion_id": le_vende}, {}):
        await _falla(server.merc_bloquear(cuerpo, DANI), 400,
                     "Tú moderas el mercadillo: retira el anuncio o cierra la conversación en Negocio")
    assert await server.merc_bloqueados(DANI) == {"bloqueados": []} and (await server.merc_estado(DANI))["bloqueados"] == 0
    # Cualquiera puede bloquearle como vendedor (es lo que probará el revisor de Apple: su anuncio es el publicado).
    b = (await server.merc_bloquear({"anuncio_id": iphone["id"]}, ANA))["bloqueo"]
    assert b["nombre"] == "Dani · FDS" and mundo.g["mercadillo_bloqueos"].docs[0]["a"] == "fds"
    assert await _titulos(ANA) == {"Soporte de móvil", "Botas"}
    await _falla(server.merc_anuncio(iphone["id"], ANA), 404, "Ese anuncio ya no está")
    await _falla(server.merc_ver_foto(iphone["fotos"][0], ANA), 404, "Ese anuncio ya no está")
    assert (await server.merc_buzon(ANA))["conversaciones"] == []
    # A Dani no se le filtra nada: sigue viendo los anuncios de quien le bloqueó, enteros…
    assert await _titulos(DANI) == {"iPhone 18 Pro · 256 GB", "Soporte de móvil", "Botas"}
    assert (await server.merc_anuncio(soporte["id"], DANI))["titulo"] == "Soporte de móvil"
    assert (await server.merc_ver_foto(soporte["fotos"][0], DANI)).status_code == 200
    # …pero sus conversaciones con ella le salen cerradas y no puede escribirle, tampoco por otro anuncio suyo.
    de_dani = {c["id"]: c for c in (await server.merc_buzon(DANI))["conversaciones"]}
    assert de_dani[le_compra]["bloqueada"] is True and de_dani[le_vende]["bloqueada"] is True
    assert (de_dani[le_vende]["foto"], de_dani[le_vende]["estado_anuncio"]) == (soporte["fotos"][0], "publicado")
    conv = await server.merc_conversacion(le_vende, DANI)
    assert conv["bloqueada"] is True and conv["anuncio"]["id"] == soporte["id"]
    for cid in (le_compra, le_vende):
        await _falla(server.merc_responder(cid, {"texto": "hola"}, DANI), 403, CERRADA)
    cascos = await _publicado(ANA, "Cascos")
    for anuncio in (cascos, soporte):
        await _falla(server.merc_contactar(anuncio["id"], {"texto": "¿y esto?"}, DANI), 403, CERRADA)
    assert len(mundo.g["mercadillo_conversaciones"].docs) == 2
    # LOS AVISOS DE FDS son de moderación, no de una persona: a quien le bloqueó le siguen llegando (publicado,
    # rechazado, el acuse y la respuesta a una denuncia), a su buzón y a su correo.
    assert mundo.enviados[-1].to == "ana@x.es" and mundo.enviados[-1].subject == "Publicado en el mercadillo: Cascos"
    escaner = await _anuncio(ANA, "Escáner de la nave", "50")
    await server.admin_mercadillo_anuncio(escaner["id"], {"accion": "rechazar", "motivo": "empresa"}, DANI)
    await server.merc_denunciar({"anuncio_id": botas["id"], "motivo": "estafa"}, ANA)
    den = (await server.admin_mercadillo(DANI))["denuncias"][0]
    await server.admin_mercadillo_denuncia(den["id"], {"decision": "no_infringe"}, DANI)
    avisos = " | ".join(x["texto"] for x in (await server.merc_buzon(ANA))["avisos"])
    for trozo in ("«Cascos» ya está publicado", "«Escáner de la nave» no se ha publicado. Motivo:",
                  "Hemos recibido tu aviso sobre «Botas»", "Sobre tu aviso de «Botas»"):
        assert trozo in avisos
    # Y Dani lo ve en su panel.
    panel = (await server.admin_mercadillo(DANI))["bloqueos"]
    assert [(x["de_nombre"], x["a_nombre"], x["a_clave"], x["origen"]) for x in panel] == [
        ("Ana P.", "Dani · FDS", "fds", {"tipo": "anuncio", "titulo": "iPhone 18 Pro · 256 GB"})]


@pytest.mark.asyncio(loop_scope="session")
async def test_dani_ve_cada_bloqueo_y_se_le_avisa_sin_que_el_bloqueo_retire_nada(mundo, monkeypatch):
    """Apple: «blocking should also notify the developer». Un bloqueo suelto, al móvil si lo tiene puesto (queda en su
    panel); desde que a alguien le bloquean 2 personas distintas, el aviso normal (móvil o correo) cada vez."""
    pushes = []

    async def push(ids, titulo, cuerpo, url="/panel"):
        pushes.append(SimpleNamespace(ids=ids, titulo=titulo, cuerpo=cuerpo, url=url))
    monkeypatch.setattr(server, "send_web_push_to_users", push)
    monkeypatch.setattr(server, "_push_enabled", True)
    mundo.g["admin_users"] = Col([{"id": "dani", "super_admin": True}, {"id": "a9", "username": "oficina@x.es", "org_id": "empresa"}])
    await _abrir(mundo)
    a = await _publicado(ANA, "Soporte de móvil")
    cid = (await server.merc_contactar(a["id"], {"texto": "hola"}, LUIS))["conversacion_id"]
    correos = len(mundo.enviados)
    # 1) Dani SIN los avisos al móvil: el primer bloqueo queda en su panel y no gasta un correo.
    await server.merc_bloquear({"anuncio_id": a["id"]}, PEPE)
    assert len(mundo.enviados) == correos and pushes == []
    panel = await server.admin_mercadillo(DANI)
    assert panel["totales"]["bloqueos"] == 1 and panel["bloqueados_varios"] == [] and len(panel["bloqueos"]) == 1
    b = panel["bloqueos"][0]
    assert set(b) == {"id", "de_nombre", "a_nombre", "a_clave", "ts", "origen"} and set(b["origen"]) == {"tipo", "titulo"}
    assert (b["de_nombre"], b["a_nombre"], b["a_clave"], b["origen"]) == (
        "Pepe P.", "Ana P.", CLAVES["ana"], {"tipo": "anuncio", "titulo": "Soporte de móvil"})
    assert b["id"] == mundo.g["mercadillo_bloqueos"].docs[0]["id"] and b["ts"] == mundo.g["mercadillo_bloqueos"].docs[0]["ts"]
    mundo.g["mercadillo_bloqueos"].docs[0]["ts"] = "2026-11-09T10:00:00+00:00"       # (ayer: para el orden de abajo)
    # 2) La SEGUNDA persona distinta que la bloquea: el aviso normal (aquí, un correo), con quién, a quién y desde dónde.
    await server.merc_bloquear({"conversacion_id": cid}, LUIS)
    assert len(mundo.enviados) == correos + 1 and mundo.enviados[-1].to == "contacto@x.es"
    assert mundo.enviados[-1].subject == "Mercadillo: 2 personas han bloqueado a Ana P."
    assert "Luis G. ha bloqueado a Ana P. desde una conversación sobre «Soporte de móvil»." in mundo.enviados[-1].texto
    assert "Un bloqueo no retira nada por sí solo" in mundo.enviados[-1].texto
    panel = await server.admin_mercadillo(DANI)
    assert panel["bloqueados_varios"] == [{"clave": CLAVES["ana"], "nombre": "Ana P.", "n": 2}] and panel["totales"]["bloqueos"] == 2
    assert [x["de_nombre"] for x in panel["bloqueos"]] == ["Luis G.", "Pepe P."]            # lo último primero
    # Repetir un bloqueo no vuelve a avisar.
    assert (await server.merc_bloquear({"conversacion_id": cid}, LUIS))["ya"] is True and len(mundo.enviados) == correos + 1
    # 3) Un bloqueo NO retira ni esconde nada por sí solo (se podría usar para ir a por alguien): decide Dani.
    assert mundo.g["mercadillo_anuncios"].docs[0]["estado"] == "publicado" and "Soporte de móvil" in await _titulos(OFICINA)
    # 4) Con los avisos al móvil puestos, cada bloqueo le salta: UNO por bloqueo, y sin gastar correo.
    await server.merc_avisos_movil({"activo": True}, DANI)
    await server.merc_avisos_movil({"activo": True}, ANA)                      # Ana también los tiene: a ella, nada
    mundo.g["push_subscriptions"] = Col([{"endpoint": "dani-movil", "user_id": "dani"}, {"endpoint": "ana-movil", "user_id": "d1"}])
    botas = await _publicado(LUIS, "Botas")
    pushes.clear()
    correos = len(mundo.enviados)
    await server.merc_bloquear({"anuncio_id": botas["id"]}, PEPE)             # la primera persona que bloquea a Luis
    assert len(pushes) == 1 and (pushes[0].ids, pushes[0].url) == (["dani"], "/panel/admin?s=mercadillo")
    assert (pushes[0].titulo, pushes[0].cuerpo) == ("Mercadillo · bloqueo", "Pepe P. ha bloqueado a Luis G. desde el anuncio «Botas».")
    await server.merc_bloquear({"anuncio_id": a["id"]}, OFICINA)              # la tercera que bloquea a Ana
    assert len(pushes) == 2 and (pushes[1].ids, pushes[1].url) == (["dani"], "/panel/admin?s=mercadillo")
    assert pushes[1].titulo == "Mercadillo · 3 personas han bloqueado a Ana P." and "Oficina ha bloqueado a Ana P." in pushes[1].cuerpo
    assert len(mundo.enviados) == correos
    # A quien bloquean no le llega nada por ningún lado: ni un aviso en su buzón ni al móvil.
    assert not [x for x in mundo.g["mercadillo_avisos"].docs if "bloque" in x["texto"].lower()]
    de_mas_a_menos = (await server.admin_mercadillo(DANI))["bloqueados_varios"]
    assert [(x["nombre"], x["n"]) for x in de_mas_a_menos] == [("Ana P.", 3)]


@pytest.mark.asyncio(loop_scope="session")
async def test_desbloquear_y_volver_a_bloquear_no_le_repite_a_dani_el_aviso_de_varias_personas(mundo, monkeypatch):
    """El aviso normal «N personas han bloqueado a X» (al móvil o, si no, un correo) es para cuando SE SUMA alguien.
    Antes, quien ya la tenía bloqueada podía desbloquearla y volver a bloquearla, y cada vez salía otro: hasta 30
    correos al día por cuenta, de una cuota de 100. Ahora, si de esa pareja ya se avisó en los últimos 7 días, ese
    bloqueo va solo al móvil, como uno suelto. La memoria vive en el proceso y NO en la base: allí, de un bloqueo no
    queda nada al desbloquear (es lo que dice la Privacidad)."""
    pushes = []

    async def push(ids, titulo, cuerpo, url="/panel"):
        pushes.append(SimpleNamespace(titulo=titulo, cuerpo=cuerpo))
    monkeypatch.setattr(server, "send_web_push_to_users", push)
    mundo.g["admin_users"] = Col([{"id": "dani", "super_admin": True}, {"id": "a9", "username": "oficina@x.es", "org_id": "empresa"}])
    mundo.g["organizations"].docs.append({"id": "o2", "name": "Rosa", "plan": "autonomo"})
    rosa = {"sub": "x", "role": "admin", "org_id": "o2", "name": "Rosa"}
    await _abrir(mundo)
    a = await _publicado(ANA, "Soporte de móvil")

    def normales() -> list:
        return [c.subject for c in mundo.enviados if c.to == "contacto@x.es" and "han bloqueado a" in c.subject]

    async def va_y_vuelve(quien, veces=1):
        for _ in range(veces):
            await server.merc_desbloquear((await server.merc_bloqueados(quien))["bloqueados"][0]["id"], quien)
            assert "ya" not in await server.merc_bloquear({"anuncio_id": a["id"]}, quien)
    await server.merc_bloquear({"anuncio_id": a["id"]}, LUIS)
    assert normales() == []                                                  # una sola persona: queda en el panel
    await server.merc_bloquear({"anuncio_id": a["id"]}, PEPE)
    assert normales() == ["Mercadillo: 2 personas han bloqueado a Ana P."]   # se suma la segunda: el aviso normal
    # PEPE, que es quien hizo saltar el aviso, la desbloquea y la vuelve a bloquear 5 veces: ni un aviso normal más.
    await va_y_vuelve(PEPE, 5)
    assert len(normales()) == 1
    # LUIS, que ya la tenía bloqueada (iba en la cuenta de esas «2 personas»), tampoco lo repite.
    await va_y_vuelve(LUIS, 5)
    assert len(normales()) == 1 and len(mundo.g["mercadillo_bloqueos"].docs) == 2
    # Una TERCERA persona sí avisa: se ha sumado alguien. Y después, ninguna de las tres lo repite.
    await server.merc_bloquear({"anuncio_id": a["id"]}, OFICINA)
    assert normales()[1:] == ["Mercadillo: 3 personas han bloqueado a Ana P."]
    for quien in (OFICINA, PEPE, LUIS):
        await va_y_vuelve(quien)
    assert len(normales()) == 2
    # Con los avisos al móvil puestos, el bloqueo repetido le salta a Dani como uno suelto: UNO por bloqueo, nunca
    # los dos, y sin gastar un correo.
    monkeypatch.setattr(server, "_push_enabled", True)
    await server.merc_avisos_movil({"activo": True}, DANI)
    mundo.g["push_subscriptions"] = Col([{"endpoint": "dani-movil", "user_id": "dani"}])
    correos = len(mundo.enviados)
    await va_y_vuelve(PEPE)
    assert [(p.titulo, p.cuerpo) for p in pushes] == [
        ("Mercadillo · bloqueo", "Pepe P. ha bloqueado a Ana P. desde el anuncio «Soporte de móvil».")]
    # A LOS 7 DÍAS se olvida: si entonces vuelve a bloquearla (y siguen siendo varias), se avisa otra vez.
    par = (CLAVES["pepe"], CLAVES["ana"])
    assert set(server._MERC_PAR_AVISADO) == {(CLAVES[q], CLAVES["ana"]) for q in ("pepe", "luis", "oficina")}
    server._MERC_PAR_AVISADO[par] -= 7 * 86400 - 60                          # hace 7 días menos un minuto: todavía no
    await va_y_vuelve(PEPE)
    assert [p.titulo for p in pushes] == ["Mercadillo · bloqueo"] * 2
    server._MERC_PAR_AVISADO[par] -= 120                                     # hace 7 días y un minuto: ya sí
    await va_y_vuelve(PEPE)
    assert pushes[-1].titulo == "Mercadillo · 3 personas han bloqueado a Ana P." and len(pushes) == 3
    await va_y_vuelve(PEPE)
    assert pushes[-1].titulo == "Mercadillo · bloqueo" and len(pushes) == 4 and len(mundo.enviados) == correos
    # LA MEMORIA ESTÁ ACOTADA: llena, tira primero lo caducado y, si no basta, todo (lo peor es un aviso de más).
    monkeypatch.setattr(server, "_MERC_PAR_AVISADO_MAX", 6)
    ahora = server.time.time()
    server._MERC_PAR_AVISADO.update({("o:viejo1", "o:z"): ahora - 8 * 86400, ("o:viejo2", "o:z"): ahora - 30 * 86400,
                                     ("o:reciente", "o:z"): ahora - 3600})
    assert len(server._MERC_PAR_AVISADO) == 6
    await server.merc_bloquear({"anuncio_id": a["id"]}, rosa)                 # la cuarta: aviso, y hace sitio
    assert pushes[-1].titulo == "Mercadillo · 4 personas han bloqueado a Ana P."
    assert set(server._MERC_PAR_AVISADO) == {("o:reciente", "o:z")} | {(CLAVES[q], CLAVES["ana"]) for q in ("pepe", "luis", "oficina")} | {
        ("o:o2", CLAVES["ana"])}
    monkeypatch.setattr(server, "_MERC_PAR_AVISADO_MAX", 3)                  # ya no cabe ni tirando lo caducado
    server._MERC_PAR_AVISADO[(CLAVES["luis"], CLAVES["ana"])] -= 8 * 86400
    await va_y_vuelve(LUIS)
    assert set(server._MERC_PAR_AVISADO) == {(CLAVES[q], CLAVES["ana"]) for q in ("pepe", "luis", "oficina")} | {("o:o2", CLAVES["ana"])}
    # Y NO ESTÁ EN LA BASE: cuando Pepe desbloquea, allí no queda nada que diga que la tuvo bloqueada.
    await server.merc_desbloquear((await server.merc_bloqueados(PEPE))["bloqueados"][0]["id"], PEPE)
    assert [n for n, col in mundo.g.items() if any(CLAVES["pepe"] in repr(d) and CLAVES["ana"] in repr(d) for d in col.docs)] == []


_CAMPOS_DE_CLAVE = {"clave", "a_clave", "de_clave", "de", "a", "para", "dueno", "org_id"}


def _claves_en(x, donde="") -> list:
    """Dónde lleva `x` la clave de alguien: como campo o dentro de un texto. Vacío si no la lleva."""
    if isinstance(x, dict):
        return [f"{donde}.{k}" for k in x if k in _CAMPOS_DE_CLAVE] + [
            h for k, v in x.items() for h in _claves_en(v, f"{donde}.{k}")]
    if isinstance(x, (list, tuple)):
        return [h for i, v in enumerate(x) for h in _claves_en(v, f"{donde}[{i}]")]
    return [donde] if isinstance(x, str) and any(c in x for c in CLAVES.values()) else []


@pytest.mark.asyncio(loop_scope="session")
async def test_la_clave_de_nadie_sale_hacia_la_web_solo_en_el_panel_de_dani(mundo):
    """A quién se bloquea se dice con un anuncio o con una conversación, y lo que vuelve es su nombre corto: ninguna
    respuesta (ni un mensaje de error) lleva la clave de nadie, ni la de quien bloquea ni la del bloqueado."""
    await _abrir(mundo)
    mundo.g["admin_users"] = Col([{"id": "a9", "username": "oficina@x.es", "org_id": "empresa"}])
    de_ana, de_pepe, de_oficina = (await _publicado(ANA, "Soporte de móvil"), await _publicado(PEPE, "Carretilla"),
                                   await _publicado(OFICINA, "Silla de oficina"))
    cid = (await server.merc_contactar(de_ana["id"], {"texto": "hola"}, PEPE))["conversacion_id"]
    cid2 = (await server.merc_contactar(de_oficina["id"], {"texto": "hola"}, ANA))["conversacion_id"]
    vistas = [await server.merc_contactar(de_pepe["id"], {"texto": "¿sigue?"}, OFICINA),
              await server.merc_responder(cid, {"texto": "sí"}, ANA),
              await server.merc_denunciar({"conversacion_id": cid2, "motivo": "otro"}, ANA),
              await server.merc_bloquear({"conversacion_id": cid}, ANA),            # la conductora, al autónomo
              await server.merc_bloquear({"conversacion_id": cid}, ANA),            # (ya estaba)
              await server.merc_bloquear({"anuncio_id": de_oficina["id"]}, PEPE),   # el autónomo, a la de oficina
              await server.merc_bloquear({"conversacion_id": cid2}, OFICINA),       # la de oficina, a la conductora
              await server.merc_bloquear({"anuncio_id": de_pepe["id"]}, LUIS)]      # y un segundo que bloquea al autónomo
    errores = [await _falla(server.merc_responder(cid, {"texto": "eh"}, PEPE), 403),
               await _falla(server.merc_responder(cid, {"texto": "eh"}, ANA), 400),
               await _falla(server.merc_anuncio(de_ana["id"], PEPE), 404),
               await _falla(server.merc_contactar(de_ana["id"], {"texto": "eh"}, PEPE), 404),
               await _falla(server.merc_conversacion(cid, ANA), 404),
               await _falla(server.merc_desbloquear("no-es-mio", PEPE), 404)]
    for quien in (PEPE, ANA, OFICINA, LUIS, DANI):
        vistas += [await server.merc_lista("", quien), await server.merc_estado(quien), await server.merc_buzon(quien),
                   await server.merc_bloqueados(quien)]
    vistas += [await server.merc_conversacion(cid, PEPE), await server.merc_conversacion(cid2, ANA),
               await server.merc_anuncio(de_ana["id"], LUIS),
               await server.merc_desbloquear((await server.merc_bloqueados(PEPE))["bloqueados"][0]["id"], PEPE)]
    assert len(vistas) == 32 and [h for v in vistas for h in _claves_en(v)] == []
    assert [h for e in errores for h in _claves_en(e.detail)] == []
    # El control: el panel de Dani SÍ las lleva (así que el buscador de arriba las habría visto), y solo entra él.
    en_el_panel = _claves_en(await server.admin_mercadillo(DANI))
    assert ".bloqueos[0].a_clave" in en_el_panel and ".bloqueados_varios[0].clave" in en_el_panel
    assert inspect.signature(server.admin_mercadillo).parameters["_"].default.dependency is server.require_superadmin
    for quien in (PEPE, ANA, OFICINA):
        await _falla(server.require_superadmin(quien), 403)


@pytest.mark.asyncio(loop_scope="session")
async def test_se_bloquean_igual_un_autonomo_una_conductora_y_alguien_de_oficina(mundo):
    await _abrir(mundo)
    mundo.g["admin_users"] = Col([{"id": "a9", "username": "oficina@x.es", "org_id": "empresa"}])
    carretilla, soporte, silla = (await _publicado(PEPE, "Carretilla"), await _publicado(ANA, "Soporte de móvil"),
                                  await _publicado(OFICINA, "Silla de oficina"))
    # Cada clase bloquea a otra: el autónomo a la de oficina (desde su anuncio), la de oficina a la conductora (desde
    # una conversación) y la conductora al autónomo.
    b1 = (await server.merc_bloquear({"anuncio_id": silla["id"]}, PEPE))["bloqueo"]
    cid = (await server.merc_contactar(soporte["id"], {"texto": "hola"}, OFICINA))["conversacion_id"]
    b2 = (await server.merc_bloquear({"conversacion_id": cid}, OFICINA))["bloqueo"]
    b3 = (await server.merc_bloquear({"anuncio_id": carretilla["id"]}, ANA))["bloqueo"]
    assert [b["nombre"] for b in (b1, b2, b3)] == ["Oficina", "Ana P.", "Pepe P."]
    assert sorted((b["de"], b["a"]) for b in mundo.g["mercadillo_bloqueos"].docs) == [
        (CLAVES["oficina"], CLAVES["ana"]), (CLAVES["ana"], CLAVES["pepe"]), (CLAVES["pepe"], CLAVES["oficina"])]
    # Con un bloqueo en cada pareja, cada uno ve solo lo suyo…
    assert [await _titulos(q) for q in (PEPE, ANA, OFICINA)] == [{"Carretilla"}, {"Soporte de móvil"}, {"Silla de oficina"}]
    await _falla(server.merc_responder(cid, {"texto": "¿hola?"}, ANA), 403, CERRADA)
    # …y al desbloquear vuelve, pareja a pareja.
    await server.merc_desbloquear(b1["id"], PEPE)
    assert [await _titulos(q) for q in (PEPE, ANA, OFICINA)] == [
        {"Carretilla", "Silla de oficina"}, {"Soporte de móvil"}, {"Silla de oficina", "Carretilla"}]
    await server.merc_desbloquear(b2["id"], OFICINA)
    await server.merc_desbloquear(b3["id"], ANA)
    assert [await _titulos(q) for q in (PEPE, ANA, OFICINA)] == [{"Carretilla", "Soporte de móvil", "Silla de oficina"}] * 3
    await server.merc_responder(cid, {"texto": "¿hola?"}, ANA)


@pytest.mark.asyncio(loop_scope="session")
async def test_bloquear_es_de_quien_esta_dentro_del_mercadillo(mundo):
    """Las tres rutas nuevas pasan por la misma puerta que el resto: cerrado, solo entra Dani; y las demos, «entrar
    como» y las empresas que lo han apagado, nunca."""
    a = await _publicado(DANI, "iPhone 18 Pro · 256 GB", "1.300")            # todavía cerrado: solo lo ve él
    for intento in (server.merc_bloquear({"anuncio_id": a["id"]}, ANA), server.merc_bloqueados(ANA),
                    server.merc_desbloquear("x", ANA)):
        await _falla(intento, 404, "El mercadillo todavía no está abierto")
    await _abrir(mundo)
    apagada = {"sub": "x", "role": "driver", "org_id": "apagada", "name": "X"}
    for nadie in ({**ANA, "demo": True}, {**PEPE, "imp": True}, apagada):
        for intento in (server.merc_bloquear({"anuncio_id": a["id"]}, nadie), server.merc_bloqueados(nadie),
                        server.merc_desbloquear("x", nadie)):
            await _falla(intento, 403)
    assert mundo.g["mercadillo_bloqueos"].docs == []
    assert (await server.merc_bloquear({"anuncio_id": a["id"]}, ANA))["ok"] is True


@pytest.mark.asyncio(loop_scope="session")
async def test_bloquear_como_lo_llama_la_web_rutas_sesion_y_json(mundo, monkeypatch):
    """El contrato tal como lo usa la web (que en sus pruebas lo simula): las rutas y los verbos de verdad, con su
    sesión, y el JSON exacto de cada respuesta. El resto de este fichero llama a las funciones; esto pasa por FastAPI."""
    async def la_misma(driver_id):
        return driver_id
    monkeypatch.setattr(server, "_ficha_activa_de", la_misma)               # (la ficha vive en la base de su empresa)
    monkeypatch.setattr(server, "_ADMIN_EXISTS_CACHE", {})
    mundo.g["admin_users"] = Col([{"id": "a1", "username": "pepe@x.es", "org_id": "o1"},
                                  {"id": "dani", "username": "dani", "super_admin": True}])

    def de(user):
        return {"Authorization": "Bearer " + server.create_token(user["sub"], user["role"], user["name"], org_id=user["org_id"],
                                                                 super_admin=bool(user.get("sa")))}
    await _abrir(mundo)
    a = await _publicado(ANA, "Soporte de móvil")
    async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://testserver") as web:
        for sin_sesion in (await web.post("/api/mercadillo/bloquear", json={"anuncio_id": a["id"]}),
                           await web.get("/api/mercadillo/bloqueados"), await web.delete("/api/mercadillo/bloqueados/x")):
            assert sin_sesion.status_code == 401
        # POST /mercadillo/bloquear: el bloqueo, y «ya» si se repite.
        r = await web.post("/api/mercadillo/bloquear", json={"anuncio_id": a["id"]}, headers=de(PEPE))
        assert r.status_code == 200 and set(r.json()) == {"ok", "bloqueo"} and set(r.json()["bloqueo"]) == {"id", "nombre", "desde"}
        b = r.json()["bloqueo"]
        assert b["nombre"] == "Ana P." and re.fullmatch(r"[0-9a-f]{16}", b["id"])
        r = await web.post("/api/mercadillo/bloquear", json={"anuncio_id": a["id"]}, headers=de(PEPE))
        assert (r.status_code, r.json()) == (200, {"ok": True, "ya": True, "bloqueo": b})
        for cuerpo, quien, codigo, texto in (
                ({}, PEPE, 400, "Falta a quién bloqueas"), ({"anuncio_id": "no-existe"}, PEPE, 404, "Ese anuncio ya no está"),
                ({"conversacion_id": "no-existe"}, PEPE, 404, "Esa conversación no existe"), ({"anuncio_id": a["id"]}, ANA, 400, "Es tu anuncio"),
                ({"anuncio_id": a["id"]}, DANI, 400, "Tú moderas el mercadillo: retira el anuncio o cierra la conversación en Negocio")):
            r = await web.post("/api/mercadillo/bloquear", json=cuerpo, headers=de(quien))
            assert (r.status_code, r.json()) == (codigo, {"detail": texto})
        # GET /mercadillo y /mercadillo/estado: ya filtrados y con cuántas personas tiene bloqueadas.
        r = await web.get("/api/mercadillo", headers=de(PEPE))
        assert r.status_code == 200 and r.json()["anuncios"] == [] and r.json()["bloqueados"] == 1
        r = await web.get("/api/mercadillo/estado", headers=de(PEPE))
        assert r.status_code == 200 and (r.json()["bloqueados"], r.json()["sin_leer"]) == (1, 0)
        # La ficha, la foto y «Me interesa», según las reglas.
        for ruta in (f"/api/mercadillo/anuncio/{a['id']}", f"/api/mercadillo/foto/{a['fotos'][0]}"):
            r = await web.get(ruta, headers=de(PEPE))
            assert (r.status_code, r.json()) == (404, {"detail": "Ese anuncio ya no está"})
        r = await web.post(f"/api/mercadillo/anuncio/{a['id']}/contactar", json={"texto": "hola"}, headers=de(PEPE))
        assert (r.status_code, r.json()) == (400, {"detail": HAS_BLOQUEADO})
        r = await web.get(f"/api/mercadillo/foto/{a['fotos'][0]}", headers=de(ANA))
        assert r.status_code == 200 and r.headers["content-type"] == "image/jpeg"
        # GET /mercadillo/bloqueados y el panel de Dani (solo él).
        r = await web.get("/api/mercadillo/bloqueados", headers=de(PEPE))
        assert (r.status_code, r.json()) == (200, {"bloqueados": [{**b, "titulo": "Soporte de móvil"}]})
        assert (await web.get("/api/admin/mercadillo", headers=de(PEPE))).status_code == 403
        r = await web.get("/api/admin/mercadillo", headers=de(DANI))
        assert r.status_code == 200 and r.json()["totales"]["bloqueos"] == 1 and r.json()["bloqueados_varios"] == []
        assert r.json()["bloqueos"] == [{"id": b["id"], "de_nombre": "Pepe P.", "a_nombre": "Ana P.", "a_clave": CLAVES["ana"],
                                         "ts": b["desde"], "origen": {"tipo": "anuncio", "titulo": "Soporte de móvil"}}]
        # DELETE /mercadillo/bloqueados/{id}: solo el suyo, y vuelve todo.
        r = await web.delete(f"/api/mercadillo/bloqueados/{b['id']}", headers=de(ANA))
        assert (r.status_code, r.json()) == (404, {"detail": "Ese bloqueo ya no está"})
        r = await web.delete(f"/api/mercadillo/bloqueados/{b['id']}", headers=de(PEPE))
        assert (r.status_code, r.json()) == (200, {"ok": True})
        r = await web.get("/api/mercadillo", headers=de(PEPE))
        assert [x["titulo"] for x in r.json()["anuncios"]] == ["Soporte de móvil"] and r.json()["bloqueados"] == 0


@functools.lru_cache(maxsize=1)
def _arbol_del_servidor():
    """server.py, leído una sola vez (son casi 60.000 líneas: cada lectura tarda segundos)."""
    return ast.parse(Path(server.__file__).read_text(encoding="utf-8-sig"))


def _textos_de_error(*funciones) -> list:
    """Los textos que esas funciones de server.py le dan a la persona: el de cada HTTPException y el del cupo del día
    (los f-string, con «0» en cada hueco; `_MERC_CERRADA` y demás constantes, con su valor)."""
    arbol, fuera = _arbol_del_servidor(), []
    for fn in ast.walk(arbol):
        if not (isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)) and fn.name in funciones):
            continue
        for n in ast.walk(fn):
            nombre = getattr(getattr(n, "func", None), "id", "") if isinstance(n, ast.Call) else ""
            t = n.args[1] if nombre == "HTTPException" and len(n.args) > 1 else (
                n.args[3] if nombre == "_rl_public_action" and len(n.args) > 3 else None)
            if isinstance(t, ast.Constant):
                fuera.append(t.value)
            elif isinstance(t, ast.JoinedStr):
                fuera.append("".join(v.value if isinstance(v, ast.Constant) else "0" for v in t.values))
            elif isinstance(t, ast.Name):
                fuera.append(getattr(server, t.id))
    return fuera


def _textos_de_invalido() -> list:
    """Todo lo que `mercadillo.py` le dice a quien rellena un anuncio o escribe un mensaje: el texto de cada
    `Invalido(…)`, que el servidor devuelve tal cual en un 400 (las constantes, con su valor)."""
    fuera = []
    for n in ast.walk(ast.parse(Path(mc.__file__).read_text(encoding="utf-8"))):
        if isinstance(n, ast.Call) and getattr(n.func, "id", "") == "Invalido" and n.args:
            t = n.args[0]
            fuera.append(t.value if isinstance(t, ast.Constant) else getattr(mc, t.id))
    return fuera


def test_los_textos_del_bloqueo_se_leen_tambien_en_el_iphone(monkeypatch):
    """Dentro de la app del iPhone la web cambia por un texto neutro («No se ha podido completar…») todo error del
    servidor que «hable de pagos» (`HABLA_DE_PAGOS` en frontend/src/lib/plataforma.js: plan, gratis, tope, bono,
    cartera…). Bloquear es justo lo que Apple va a mirar allí: ninguno de sus mensajes puede caer en esa red.
    Y lo mismo todo lo del 10-11-2026: a quien se le quita el mercadillo tiene que poder leer POR QUÉ, y quien no
    puede enviar un mensaje, que es por un insulto."""
    web = (Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "plataforma.js").read_text(encoding="utf-8")
    red = re.search(r"HABLA_DE_PAGOS\s*=\s*/(.+)/i\s*$", web, re.M)
    assert red, "no encuentro HABLA_DE_PAGOS en plataforma.js: ¿se ha movido?"
    habla_de_pagos = re.compile(red.group(1), re.I)
    # El control: la red es la de verdad (así se habría quedado sin leer «…que es el tope»).
    assert habla_de_pagos.search("Tienes 200 personas bloqueadas, que es el tope.") and habla_de_pagos.search("Tu plan gratis")
    textos = _textos_de_error("merc_bloquear", "merc_bloqueados", "merc_desbloquear", "_merc_escribirle", "_merc_conv_mia",
                              "_merc_anuncio_visible", "merc_contactar", "merc_responder")
    for esperado in (HAS_BLOQUEADO, CERRADA, A_LA_VENTA, "Falta a quién bloqueas", "Es tu anuncio", "No puedes bloquearte a ti",
                     "Ese bloqueo ya no está", "Ese anuncio ya no está", "Esa conversación no existe",
                     "Has bloqueado a mucha gente hoy. Prueba mañana."):
        assert esperado in textos, f"el buscador de textos no ha visto «{esperado}»"
    assert any(t.startswith("Tienes 0 personas bloqueadas") for t in textos) and len(set(textos)) >= 13
    assert [t for t in textos if habla_de_pagos.search(t)] == []
    # LO NUEVO (expulsar, normas, filtro). Primero, lo que dicen las rutas nuevas y la puerta…
    nuevos = _textos_de_error("merc_normas", "admin_mercadillo_expulsar", "admin_mercadillo_readmitir", "_merc_dentro")
    for esperado in ("Tienes que aceptar las normas para usar el mercadillo", "A quien modera no se le puede quitar el mercadillo",
                     "Esa clave no es de una persona del mercadillo", "Elige el motivo: es lo que se le dice a esa persona",
                     "Esa persona no ha usado el mercadillo", "Esa persona ya tiene acceso al mercadillo"):
        assert esperado in nuevos, f"el buscador de textos no ha visto «{esperado}»"
    # …lo que lee la persona a la que se le quita el mercadillo (el 403 de cada ruta, el estado, su aviso y su correo),
    # con cada motivo, con nota y sin ella, y con el contacto de verdad; cuando se le devuelve; y los dos asuntos…
    monkeypatch.setattr(server, "CORREO_CONTACTO", "contacto@flotadsp.com")
    de_expulsion = [server._merc_texto_expulsion({"motivo": motivo, "nota": nota})
                    for motivo in mc.MOTIVOS_EXPULSION.values() for nota in ("", "Insultos en dos conversaciones.")]
    assert len(set(de_expulsion)) == 12 and all(t.startswith("Te hemos quitado el acceso al mercadillo. Motivo: ") for t in de_expulsion)
    nuevos += de_expulsion + list(mc.MOTIVOS_EXPULSION.values()) + [
        server._MERC_READMITIDO, "Te hemos quitado el acceso al mercadillo", "Vuelves a tener acceso al mercadillo"]
    # …y lo que contesta el filtro (con todo lo demás que `mercadillo.py` le dice a quien escribe).
    de_validar = _textos_de_invalido()
    for esperado in ("Ese mensaje no se puede enviar: no se permiten insultos, amenazas ni contenido ofensivo. Cámbialo y vuelve a enviarlo.",
                     "Ese anuncio no se puede enviar: quita los insultos o el contenido ofensivo del texto.", "Escribe el mensaje."):
        assert esperado in de_validar, f"el buscador de textos no ha visto «{esperado}»"
    nuevos += de_validar
    assert len(set(nuevos)) >= 36 and [t for t in nuevos if habla_de_pagos.search(t)] == []


@pytest.mark.asyncio(loop_scope="session")
async def test_el_indice_unico_de_los_bloqueos_es_por_pareja(mundo, monkeypatch):
    """Sin un índice ÚNICO detrás, el `except DuplicateKeyError` de bloquear sería papel mojado; y si fuera único solo
    por `a`, a cada persona solo la podría bloquear UNA (a la segunda se le contestaría un «ya» falso)."""
    creados = []

    async def idx(coleccion, *args, **kwargs):
        creados.append((coleccion, args, kwargs))

    async def nada(*a, **k):
        return []
    monkeypatch.setattr(server, "_idx", idx)
    monkeypatch.setattr(server, "_ensure_tenant_indexes", nada)
    mundo.g.list_collection_names = nada
    await server.create_indexes()
    de_bloqueos = [(args, kwargs) for col, args, kwargs in creados if col is mundo.g["mercadillo_bloqueos"]]
    assert (([("de", 1), ("a", 1)],), {"unique": True, "name": "mercadillo_bloqueo_unico"}) in de_bloqueos
    assert (("a",), {}) in de_bloqueos                                       # quién ha bloqueado a alguien
    assert [args for args, kwargs in de_bloqueos if kwargs.get("unique")] == [([("de", 1), ("a", 1)],)]


# ── LA BAJA DE LA CUENTA (10-11-2026) ───────────────────────────────────────
def _es_fecha(v) -> bool:
    return datetime.fromisoformat(v).tzinfo is not None


def _con_cuenta(mundo):
    """Pepe con su usuario y su contraseña, que es lo que pide borrar la cuenta."""
    mundo.g["admin_users"] = Col([{"id": "a1", "username": "pepe@x.es", "role": "admin", "org_id": "o1",
                                   "hashed_password": server.hash_password("secreta123")},
                                  {"id": "a9", "username": "oficina@x.es", "org_id": "empresa"}])
    server._public_actions.pop("borrar:a1", None)


@pytest.mark.asyncio(loop_scope="session")
async def test_la_baja_de_la_cuenta_se_lleva_su_mercadillo(mundo):
    """Antes la cuenta quedaba desactivada pero sus anuncios seguían publicados hasta caducar, a nombre de alguien que ya
    no puede contestar. Al pedir la baja: anuncios activos quitados, conversaciones cerradas, y fuera sus bloqueos (los
    que hizo y los que le hicieron) y sus preferencias. Lo de los demás no se toca."""
    await _abrir(mundo)
    _con_cuenta(mundo)
    publicado, pendiente, vendido = (await _publicado(PEPE, "Carretilla"), await _anuncio(PEPE, "Mochila", "12"),
                                     await _publicado(PEPE, "Gorra", "8"))
    await server.merc_cambiar(vendido["id"], {"accion": "vendido"}, PEPE)
    de_ana, de_luis = await _publicado(ANA, "Soporte de móvil"), await _publicado(LUIS, "Botas")
    le_compran = (await server.merc_contactar(publicado["id"], {"texto": "¿Sigue?"}, ANA))["conversacion_id"]
    compra = (await server.merc_contactar(de_ana["id"], {"texto": "Me interesa"}, PEPE))["conversacion_id"]
    ajena = (await server.merc_contactar(de_ana["id"], {"texto": "hola"}, OFICINA))["conversacion_id"]
    await server.merc_bloquear({"anuncio_id": de_luis["id"]}, PEPE)            # uno que hizo él
    await server.merc_bloquear({"anuncio_id": publicado["id"]}, OFICINA)       # uno que le hicieron
    await server.merc_bloquear({"anuncio_id": de_ana["id"]}, LUIS)             # uno que no va con él: se queda
    await server.merc_avisos_movil({"activo": True}, PEPE)
    await server.merc_avisos_movil({"activo": True}, ANA)
    fin_de_la_gorra = (await mundo.g["mercadillo_anuncios"].find_one({"id": vendido["id"]}))["fin"]
    assert await server.borrar_cuenta({"password": "secreta123"}, PEPE) == {"ok": True}
    assert (await mundo.g["admin_users"].find_one({"id": "a1"}))["disabled"] is True
    # Sus anuncios en revisión o publicados quedan quitados, con su fecha (se borran a su plazo); lo ya acabado y
    # lo de los demás, como estaba.
    por_titulo = {a["titulo"]: a for a in mundo.g["mercadillo_anuncios"].docs}
    assert (por_titulo["Carretilla"]["estado"], por_titulo["Mochila"]["estado"]) == ("quitado", "quitado")
    assert _es_fecha(por_titulo["Carretilla"]["fin"]) and _es_fecha(por_titulo["Mochila"]["fin"])
    assert (por_titulo["Gorra"]["estado"], por_titulo["Gorra"]["fin"]) == ("vendido", fin_de_la_gorra)
    assert (por_titulo["Soporte de móvil"]["estado"], por_titulo["Botas"]["estado"]) == ("publicado", "publicado")
    assert await _titulos(DANI) == {"Soporte de móvil", "Botas"} and "Carretilla" not in await _titulos(ANA)
    assert pendiente["titulo"] == "Mochila"                                  # (el que estaba en revisión)
    assert (await server.merc_anuncio(publicado["id"], ANA))["estado"] == "quitado"     # ella lo tenía hablado: lo ve, quitado
    await _falla(server.merc_contactar(publicado["id"], {"texto": "¿sigue?"}, LUIS), 404, A_LA_VENTA)
    # Sus conversaciones quedan cerradas para la otra persona, que conserva su historial; las ajenas, abiertas.
    convs = {c["id"]: c for c in mundo.g["mercadillo_conversaciones"].docs}
    assert (convs[le_compran]["bloqueada"], convs[compra]["bloqueada"], convs[ajena].get("bloqueada")) == (True, True, None)
    de_ana_ahora = {c["id"]: c["bloqueada"] for c in (await server.merc_buzon(ANA))["conversaciones"]}
    assert de_ana_ahora == {le_compran: True, compra: True, ajena: False}
    for cid in (le_compran, compra):
        await _falla(server.merc_responder(cid, {"texto": "¿hola?"}, ANA), 403, CERRADA)
    # Se borran sus bloqueos (los que hizo y los que le hicieron) y sus preferencias; los de los demás, no.
    assert [(b["de"], b["a"]) for b in mundo.g["mercadillo_bloqueos"].docs] == [(CLAVES["luis"], CLAVES["ana"])]
    assert [p["clave"] for p in mundo.g["mercadillo_prefs"].docs] == [CLAVES["ana"]]
    # Y a su plazo (60 días desde que se quitaron) sus anuncios se borran, como cualquier anuncio quitado.
    h = await server.merc_limpieza(datetime.now(timezone.utc) + timedelta(days=mc.DIAS_BORRAR_ANUNCIO + 1))
    assert h["anuncios_borrados"] == 3 and {a["titulo"] for a in mundo.g["mercadillo_anuncios"].docs} == {"Soporte de móvil", "Botas"}


@pytest.mark.asyncio(loop_scope="session")
async def test_la_baja_no_se_para_si_el_mercadillo_falla(mundo, monkeypatch):
    await _abrir(mundo)
    _con_cuenta(mundo)
    await _publicado(PEPE, "Carretilla")

    async def roto(clave):
        raise RuntimeError("la base no contesta")
    monkeypatch.setattr(server, "_merc_baja", roto)
    assert await server.borrar_cuenta({"password": "secreta123"}, PEPE) == {"ok": True}
    assert (await mundo.g["admin_users"].find_one({"id": "a1"}))["disabled"] is True
    assert mundo.g["bajas_cuentas"].docs[0]["org_id"] == "o1" and "petición de borrar una cuenta" in mundo.enviados[-1].subject


@pytest.mark.asyncio(loop_scope="session")
async def test_tras_la_baja_la_misma_sesion_ya_no_entra_ni_un_minuto_mas(mundo, monkeypatch):
    """`get_current_user` recuerda 60 s que un usuario existe. Sin olvidarlo al dar la baja, con el MISMO token se seguía
    entrando un minuto más; y lo que se abriera en ese minuto (una conversación) se quedaba abierto para siempre, porque
    `_merc_baja` ya había pasado. Va por HTTP: esa memoria vive en la sesión, no en las funciones."""
    _por_http(mundo, monkeypatch)
    _con_cuenta(mundo)
    await _abrir(mundo)
    a = await _publicado(ANA, "Soporte de móvil")
    sesion = _sesion(PEPE)
    async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://testserver") as web:
        # El control: antes de la baja su sesión entra (y la memoria de los 60 s queda cargada, como en la vida real).
        for ruta in ("/api/mercadillo", "/api/mercadillo/buzon", "/api/auth/me"):
            assert (await web.get(ruta, headers=sesion)).status_code == 200, ruta
        assert server._ADMIN_EXISTS_CACHE["a1"][1] is True
        r = await web.post("/api/auth/borrar-cuenta", json={"password": "secreta123"}, headers=sesion)
        assert (r.status_code, r.json()) == (200, {"ok": True})
        # Con el mismo token, al instante, ya no entra: ni al mercadillo ni a nada.
        for verbo, ruta, cuerpo in (("POST", f"/api/mercadillo/anuncio/{a['id']}/contactar", {"texto": "sigo aquí"}),
                                    ("GET", "/api/mercadillo", None), ("GET", "/api/mercadillo/buzon", None),
                                    ("POST", "/api/mercadillo/bloquear", {"anuncio_id": a["id"]}),
                                    ("GET", "/api/auth/me", None), ("POST", "/api/auth/borrar-cuenta", {"password": "secreta123"})):
            r = await web.request(verbo, ruta, json=cuerpo, headers=sesion)
            assert (r.status_code, r.json()) == (401, {"detail": "Sesión revocada: el usuario ya no existe"}), ruta
        assert (await web.get("/api/mercadillo/estado", headers=sesion)).status_code == 401
        # A los demás no les cambia nada.
        assert (await web.get("/api/mercadillo", headers=_sesion(ANA))).status_code == 200
    # Y no ha quedado ni una conversación nueva, ni un mensaje, ni un bloqueo suyo.
    assert mundo.g["mercadillo_conversaciones"].docs == [] and mundo.g["mercadillo_mensajes"].docs == []
    assert mundo.g["mercadillo_bloqueos"].docs == [] and len(mundo.g["bajas_cuentas"].docs) == 1


# ── QUITARLE EL MERCADILLO A UNA PERSONA (10-11-2026) ───────────────────────
# Apple (guideline 1.2): ante una denuncia, «removing the content and ejecting the user». Lo que se vigila: que quien
# está fuera no entre por NINGUNA ruta (se recorren las de verdad, sacadas del router), que se le diga el motivo y cómo
# reclamar, que lo suyo desaparezca al instante, que solo pueda hacerlo Dani y que la clave de nadie salga de su panel.
MOTIVOS_EXPULSION = {                     # el contrato, letra a letra: es lo que lee la persona y lo que pinta la web
    "ofensivo": "Has publicado o enviado contenido ofensivo.",
    "acoso": "Has acosado o molestado a otra persona.",
    "prohibido": "Has intentado vender algo que las normas no permiten.",
    "estafa": "Hemos visto un engaño o un intento de estafa.",
    "repetido": "Has incumplido las normas varias veces.",
    "otro": "Has incumplido las normas del mercadillo.",
}
SOLO_DANI = "Acceso solo para el super-admin"
YA_TIENE_ACCESO = "Esa persona ya tiene acceso al mercadillo"
READMITIDO = ("Vuelves a tener acceso al mercadillo. Los anuncios que se retiraron no vuelven solos: si todavía vendes "
              "algo, publícalo otra vez. Y recuerda cumplir las normas.")


def _fuera(motivo="ofensivo", nota="") -> str:
    """Lo que lee la persona a la que se le ha quitado el mercadillo: el motivo, la nota si la hay y cómo reclamar."""
    return (f"Te hemos quitado el acceso al mercadillo. Motivo: {MOTIVOS_EXPULSION[motivo]}{' ' + nota if nota else ''} "
            "Si crees que es un error, escribe a contacto@x.es y lo revisamos.")


async def _expulsar(quien: str, motivo="ofensivo", **extra) -> dict:
    return await server.admin_mercadillo_expulsar({"clave": CLAVES[quien], "motivo": motivo, **extra}, DANI)


def _por_http(mundo, monkeypatch):
    """Lo que hace falta para pasar por FastAPI con la sesión de cada uno (la ficha vive en la base de su empresa)."""
    async def la_misma(driver_id):
        return driver_id
    monkeypatch.setattr(server, "_ficha_activa_de", la_misma)
    monkeypatch.setattr(server, "_ADMIN_EXISTS_CACHE", {})
    mundo.g["admin_users"] = Col([{"id": "a1", "username": "pepe@x.es", "org_id": "o1"},
                                  {"id": "a9", "username": "oficina@x.es", "org_id": "empresa"},
                                  {"id": "dani", "username": "dani", "super_admin": True}])


def _sesion(user) -> dict:
    return {"Authorization": "Bearer " + server.create_token(user["sub"], user["role"], user["name"], org_id=user["org_id"],
                                                             super_admin=bool(user.get("sa")))}


def _rutas_del_mercadillo() -> list:
    """Las rutas `/api/mercadillo…` QUE TIENE MONTADAS LA APP, con su verbo. Salen del router y no de una lista escrita
    a mano: una ruta nueva entra sola en el recorrido, y sin la guarda lo hace fallar."""
    return sorted((r.path, verbo) for r in server.app.routes if isinstance(r, APIRoute)
                  and (r.path + "/").startswith("/api/mercadillo/") for verbo in r.methods)


async def _llamar(web, ruta: str, verbo: str, sesion: dict):
    """Una llamada cualquiera a esa ruta: aquí importa si la puerta deja pasar, no lo que se conteste dentro."""
    url = re.sub(r"\{[^}]+\}", "x", ruta)
    if verbo in ("GET", "DELETE"):
        return await web.request(verbo, url, headers=sesion)
    r = await web.request(verbo, url, json={}, headers=sesion)
    if r.status_code == 422:                                     # esa ruta pide un fichero (la foto), no un JSON
        r = await web.request(verbo, url, files={"file": ("foto.jpg", b"no-es-una-foto", "image/jpeg")}, headers=sesion)
    return r


@pytest.mark.asyncio(loop_scope="session")
async def test_a_quien_se_le_quita_el_mercadillo_no_entra_por_ninguna_ruta(mundo, monkeypatch):
    """La guarda está UNA vez, en la puerta (`_merc_dentro`). Aquí se llama a CADA ruta del mercadillo con la sesión
    de una persona expulsada —un autónomo, una conductora y alguien de oficina—: todas contestan 403 con su motivo
    y cómo reclamar, menos `/mercadillo/estado`, que es la que se lo explica a la web."""
    _por_http(mundo, monkeypatch)
    await _abrir(mundo)
    for quien in (PEPE, ANA, OFICINA, LUIS):
        await _publicado(quien, f"Cosa de {quien['name']}")
    rutas = _rutas_del_mercadillo()
    # El recorrido no está vacío ni es de otra cosa: están las de siempre y las de hoy, y ninguna del panel de Dani.
    assert len(rutas) >= 18 and len(rutas) == len(set(rutas)) and not [r for r, _ in rutas if "/admin/" in r]
    assert {("/api/mercadillo", "GET"), ("/api/mercadillo", "POST"), ("/api/mercadillo/estado", "GET"),
            ("/api/mercadillo/buzon", "GET"), ("/api/mercadillo/fotos", "POST"), ("/api/mercadillo/foto/{foto_id}", "GET"),
            ("/api/mercadillo/anuncio/{anuncio_id}", "PATCH"), ("/api/mercadillo/conversacion/{conv_id}", "POST"),
            ("/api/mercadillo/bloquear", "POST"), ("/api/mercadillo/bloqueados/{bloqueo_id}", "DELETE"),
            ("/api/mercadillo/denunciar", "POST"), ("/api/mercadillo/normas", "POST")} <= set(rutas)
    fuera = {"pepe": (PEPE, "estafa", ""), "ana": (ANA, "ofensivo", "Insultos en dos conversaciones."),
             "oficina": (OFICINA, "otro", "")}
    async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://testserver") as web:
        async def recorrido(user) -> dict:
            return {(ruta, verbo): await _llamar(web, ruta, verbo, _sesion(user)) for ruta, verbo in rutas}

        def entra(respuestas: dict) -> bool:
            """Con llamadas de relleno cada ruta contesta 200, 400 o 404 (nunca que no hay sesión, ni un 422, ni un
            500) y ninguna dice que está fuera."""
            return (all(r.status_code in (200, 400, 404) for r in respuestas.values())
                    and not [k for k, r in respuestas.items() if "Te hemos quitado" in r.text or "expulsado" in r.text])
        # EL CONTROL: antes, todos entran por todas (así el 403 de después solo puede ser el de la expulsión).
        for user in (PEPE, ANA, OFICINA, LUIS, DANI):
            assert entra(await recorrido(user)), user["name"]
        for nombre, (user, motivo, nota) in fuera.items():
            r = await web.post("/api/admin/mercadillo/expulsar", headers=_sesion(DANI),
                               json={"clave": CLAVES[nombre], "motivo": motivo, "nota": nota})
            assert r.status_code == 200 and r.json()["ok"] is True and r.json()["anuncios"] == 1
        for nombre, (user, motivo, nota) in fuera.items():
            texto, yo = _fuera(motivo, nota), await server._merc_yo(user)
            respuestas = await recorrido(user)
            assert len(respuestas) == len(rutas)
            for (ruta, verbo), r in respuestas.items():
                if ruta == "/api/mercadillo/estado":
                    assert (r.status_code, r.json()) == (200, {
                        "visible": True, "abierto": True, "expulsado": True, "texto": texto, "sin_leer": 0,
                        "yo": {"nombre": yo["nombre"], "tipo": yo["tipo"]}}), nombre
                else:
                    assert (r.status_code, r.json()) == (403, {"detail": texto}), (nombre, verbo, ruta)
        # A los demás no les cambia nada. Y a quien modera no se le puede dejar fuera ni con un dato a mano.
        await mundo.g["mercadillo_expulsados"].insert_one({"clave": "fds", "motivo": MOTIVOS_EXPULSION["otro"]})
        for user in (LUIS, DANI):
            assert entra(await recorrido(user)), user["name"]
        assert "expulsado" not in await server.merc_estado(DANI)
        # Con el mercadillo apagado nadie lo ve, tampoco quien está fuera (no se le cuenta nada de más).
        await server.admin_mercadillo_visible({"visible": False}, DANI)
        assert (await web.get("/api/mercadillo/estado", headers=_sesion(ANA))).json() == {"visible": False}
        r = await web.get("/api/mercadillo", headers=_sesion(ANA))
        assert (r.status_code, r.json()) == (404, {"detail": "El mercadillo todavía no está abierto"})


@pytest.mark.asyncio(loop_scope="session")
async def test_quitarle_el_mercadillo_a_alguien_retira_lo_suyo_cierra_sus_conversaciones_y_se_lo_dice(mundo):
    assert mc.MOTIVOS_EXPULSION == MOTIVOS_EXPULSION
    await _abrir(mundo)
    publicado, pendiente, vendido = (await _publicado(ANA, "Soporte de móvil"), await _anuncio(ANA, "Mochila", "12"),
                                     await _publicado(ANA, "Gorra", "8"))
    await server.merc_cambiar(vendido["id"], {"accion": "vendido"}, ANA)
    de_pepe, de_luis = await _publicado(PEPE, "Carretilla"), await _publicado(LUIS, "Botas")
    le_compran = (await server.merc_contactar(publicado["id"], {"texto": "¿Sigue?"}, PEPE))["conversacion_id"]
    compra = (await server.merc_contactar(de_pepe["id"], {"texto": "Me interesa"}, ANA))["conversacion_id"]
    ajena = (await server.merc_contactar(de_luis["id"], {"texto": "hola"}, PEPE))["conversacion_id"]
    await server.merc_denunciar({"anuncio_id": publicado["id"], "motivo": "ofensivo", "texto": "insulta en el anuncio"}, LUIS)
    await server.merc_denunciar({"anuncio_id": de_pepe["id"], "motivo": "otro"}, LUIS)       # la de otro anuncio sigue abierta
    await server.merc_bloquear({"anuncio_id": de_luis["id"]}, ANA)                           # un bloqueo que hizo ella
    await server.merc_bloquear({"anuncio_id": publicado["id"]}, OFICINA)                     # y uno que le hicieron
    fin_de_la_gorra = (await mundo.g["mercadillo_anuncios"].find_one({"id": vendido["id"]}))["fin"]
    avisos, correos = len(mundo.g["mercadillo_avisos"].docs), len(mundo.enviados)
    r = await _expulsar("ana", "ofensivo", nota="  Insultos en dos conversaciones.  ")
    texto = _fuera("ofensivo", "Insultos en dos conversaciones.")
    # LA RESPUESTA (solo para Dani: lleva la clave) y lo que queda guardado.
    assert set(r) == {"ok", "expulsado", "anuncios", "conversaciones"} and (r["ok"], r["anuncios"], r["conversaciones"]) == (True, 2, 2)
    e = r["expulsado"]
    assert {k: v for k, v in e.items() if k != "ts"} == {
        "clave": CLAVES["ana"], "nombre": "Ana P.", "motivo_clave": "ofensivo", "motivo": MOTIVOS_EXPULSION["ofensivo"],
        "nota": "Insultos en dos conversaciones."} and _es_fecha(e["ts"])
    assert mundo.g["mercadillo_expulsados"].docs == [e]
    # NO ENTRA, y el estado se lo explica.
    await _falla(server.merc_lista("", ANA), 403, texto)
    assert await server.merc_estado(ANA) == {"visible": True, "abierto": True, "expulsado": True, "texto": texto, "sin_leer": 0,
                                             "yo": {"nombre": "Ana P.", "tipo": "conductor"}}
    # SUS ANUNCIOS en revisión o publicados quedan retirados, con el motivo y su fecha; lo ya acabado y lo de los
    # demás, como estaba.
    por_titulo = {a["titulo"]: a for a in mundo.g["mercadillo_anuncios"].docs}
    for titulo in ("Soporte de móvil", "Mochila"):
        a = por_titulo[titulo]
        assert (a["estado"], a["motivo"], a["motivo_clave"]) == (
            "retirado", MOTIVOS_EXPULSION["ofensivo"] + " Insultos en dos conversaciones.", "expulsion") and _es_fecha(a["fin"])
    assert pendiente["titulo"] == "Mochila"                                  # (el que estaba en revisión)
    assert (por_titulo["Gorra"]["estado"], por_titulo["Gorra"]["fin"], por_titulo["Gorra"]["motivo_clave"]) == ("vendido", fin_de_la_gorra, "")
    assert (por_titulo["Carretilla"]["estado"], por_titulo["Botas"]["estado"]) == ("publicado", "publicado")
    assert await _titulos(PEPE) == await _titulos(DANI) == {"Carretilla", "Botas"}
    assert (await server.admin_mercadillo(DANI))["por_revisar"] == []
    await _falla(server.merc_contactar(publicado["id"], {"texto": "¿sigue?"}, OFICINA), 404, A_LA_VENTA)
    # LA DENUNCIA que tenía su anuncio se cierra como «retirado» y a quien denunció se le dice; la del otro, abierta.
    den = {d["objetivo"]["titulo"]: d for d in mundo.g["mercadillo_denuncias"].docs}
    assert (den["Soporte de móvil"]["estado"], den["Soporte de móvil"]["decision"]) == ("resuelta", "retirado")
    assert den["Carretilla"]["estado"] == "abierta"
    nuevos = mundo.g["mercadillo_avisos"].docs[avisos:]
    assert [x["texto"] for x in nuevos if x["para"] == CLAVES["luis"]] == [
        "Sobre tu aviso de «Soporte de móvil»: lo hemos retirado. Gracias por avisar."]
    # SUS CONVERSACIONES (donde vendía y donde compraba) quedan cerradas para la otra persona; las ajenas, abiertas.
    convs = {c["id"]: c for c in mundo.g["mercadillo_conversaciones"].docs}
    assert [(convs[c]["bloqueada"], convs[c]["cerrada_por"]) for c in (le_compran, compra)] == [(True, "expulsion")] * 2
    assert convs[ajena].get("bloqueada") is None and "cerrada_por" not in convs[ajena]
    assert {c["id"]: c["bloqueada"] for c in (await server.merc_buzon(PEPE))["conversaciones"]} == {
        le_compran: True, compra: True, ajena: False}
    for cid in (le_compran, compra):
        await _falla(server.merc_responder(cid, {"texto": "¿hola?"}, PEPE), 403, CERRADA)
    await server.merc_responder(ajena, {"texto": "¿sigue?"}, PEPE)
    # SE LE DICE, con el motivo y cómo reclamar: un aviso (que leerá si vuelve) y, como al buzón ya no entra, un correo.
    assert [x["texto"] for x in nuevos if x["para"] == CLAVES["ana"]] == [texto]
    a_ana = [c for c in mundo.enviados[correos:] if c.to == "ana@x.es"]
    assert len(a_ana) == 1 and a_ana[0].subject == "Te hemos quitado el acceso al mercadillo" and texto in a_ana[0].texto
    # QUEDA APUNTADO quién lo hizo, a quién y por qué.
    rastro = mundo.g["audit_log"].docs[-1]
    assert (rastro["action"], rastro["actor_id"]) == ("mercadillo_expulsar", "dani") and rastro["detail"] == {
        "clave": CLAVES["ana"], "nombre": "Ana P.", "motivo": "ofensivo", "nota": "Insultos en dos conversaciones.",
        "anuncios": 2, "conversaciones": 2}
    # SUS BLOQUEOS no se tocan.
    assert sorted((b["de"], b["a"]) for b in mundo.g["mercadillo_bloqueos"].docs) == sorted([
        (CLAVES["ana"], CLAVES["luis"]), (CLAVES["oficina"], CLAVES["ana"])])
    # DOS VECES no falla: dice que ya estaba, con la expulsión de antes, y no se le avisa otra vez.
    avisos, correos, rastros = len(mundo.g["mercadillo_avisos"].docs), len(mundo.enviados), len(mundo.g["audit_log"].docs)
    assert await _expulsar("ana", "estafa", nota="otra cosa") == {"ok": True, "ya": True, "expulsado": e, "anuncios": 0, "conversaciones": 0}
    assert mundo.g["mercadillo_expulsados"].docs == [e]
    assert (len(mundo.g["mercadillo_avisos"].docs), len(mundo.enviados), len(mundo.g["audit_log"].docs)) == (avisos, correos, rastros)
    # Y si una expulsión se quedó A MEDIAS (apuntada, pero falló la base antes de retirar lo suyo), repetirla lo termina.
    await mundo.g["mercadillo_anuncios"].update_one({"id": publicado["id"]}, {"$set": {"estado": "publicado"}})
    await mundo.g["mercadillo_conversaciones"].update_one({"id": compra}, {"$unset": {"bloqueada": "", "cerrada_por": ""}})
    r = await _expulsar("ana")
    assert (r["ya"], r["anuncios"], r["conversaciones"]) == (True, 1, 1)
    assert (await mundo.g["mercadillo_anuncios"].find_one({"id": publicado["id"]}))["estado"] == "retirado"
    assert (await mundo.g["mercadillo_conversaciones"].find_one({"id": compra}))["cerrada_por"] == "expulsion"
    # Un apunte viejo o roto (sin su motivo) no deja a nadie sin explicación: se le dice el motivo general.
    assert server._merc_texto_expulsion({"clave": CLAVES["ana"]}) == _fuera("otro")


@pytest.mark.asyncio(loop_scope="session")
async def test_no_se_expulsa_a_quien_modera_ni_una_clave_mal_escrita_ni_sin_motivo_ni_a_un_desconocido(mundo):
    await _abrir(mundo)
    await _publicado(ANA, "Soporte de móvil")
    # A quien modera, nunca (aunque falte lo demás).
    for cuerpo in ({"clave": "fds", "motivo": "ofensivo"}, {"clave": " fds ", "motivo": "ofensivo"}, {"clave": "fds"}):
        await _falla(server.admin_mercadillo_expulsar(cuerpo, DANI), 400, "A quien modera no se le puede quitar el mercadillo")
    # Una clave es `o:<org>`, `d:<org>:<id>` o `a:<org>:<id>`: lo demás (también un tipo cambiado) no es de nadie.
    mal_escritas = ["", "ana", "Ana P.", "owner", "o:", "d:owner", "d:owner:", "a::a9", "x:owner:d1", "o:o1:de-mas",
                    "d:ow ner:d1", "fds:1", "O:o1", "d:owner:d1 y más", None, 5, True, ["o:o1"], {"clave": "o:o1"}]
    for clave in mal_escritas:
        await _falla(server.admin_mercadillo_expulsar({"clave": clave, "motivo": "ofensivo"}, DANI), 400,
                     "Esa clave no es de una persona del mercadillo")
    for cuerpo in ({}, [], {"motivo": "ofensivo"}):
        await _falla(server.admin_mercadillo_expulsar(cuerpo, DANI), 400, "Esa clave no es de una persona del mercadillo")
    # Siempre con uno de SUS motivos (los de rechazar un anuncio son otros): es lo que se le dice a esa persona.
    assert "denuncias" in mc.MOTIVOS_RECHAZO and "denuncias" not in mc.MOTIVOS_EXPULSION
    for motivo in (None, "", "porque sí", "denuncias", ["ofensivo"], 3):
        await _falla(server.admin_mercadillo_expulsar({"clave": CLAVES["ana"], "motivo": motivo}, DANI), 400,
                     "Elige el motivo: es lo que se le dice a esa persona")
    await _falla(server.admin_mercadillo_expulsar({"clave": CLAVES["ana"], "nota": "sin motivo"}, DANI), 400,
                 "Elige el motivo: es lo que se le dice a esa persona")
    # Una clave bien escrita que no ha pasado por el mercadillo (mal copiada, quizá): no se deja fuera a nadie a ciegas.
    for nadie in ("o:nunca-ha-entrado", "d:owner:d999", CLAVES["oficina"], CLAVES["luis"], CLAVES["ana"] + "0"):
        await _falla(server.admin_mercadillo_expulsar({"clave": nadie, "motivo": "otro"}, DANI), 404,
                     "Esa persona no ha usado el mercadillo")
    assert mundo.g["mercadillo_expulsados"].docs == [] and mundo.g["audit_log"].docs == []
    assert (await server.merc_lista("", ANA))["mios"][0]["estado"] == "publicado"
    # El control: con su clave y un motivo, sí (y una nota kilométrica se queda en 500 letras).
    hecho = (await _expulsar("ana", "repetido", nota="muy largo " * 80))["expulsado"]
    assert hecho["motivo"] == "Has incumplido las normas varias veces." and len(hecho["nota"]) == 500


@pytest.mark.asyncio(loop_scope="session")
async def test_el_nombre_de_la_persona_expulsada_sale_de_su_dato_mas_reciente(mundo):
    """A quien se expulsa se le nombra con lo último que dejó en el mercadillo: un anuncio, una conversación o un
    bloqueo (también el que le hicieron). Con uno solo de los tres ya «ha usado el mercadillo»."""
    g = mundo.g
    g["mercadillo_anuncios"].docs.append({"id": "viejo", "titulo": "Viejo", "estado": "vendido", "creado": "2026-10-01T10:00:00+00:00",
                                          "actualizado": "2026-10-02T10:00:00+00:00", "vendedor": {"clave": "o:x1", "nombre": "Pepe P."}})
    g["mercadillo_conversaciones"].docs.append({"id": "c1", "anuncio_id": "otro", "anuncio_titulo": "Otro", "creada": "2026-10-05T10:00:00+00:00",
                                                "ultimo": "2026-11-01T10:00:00+00:00", "comprador": {"clave": "o:x1", "nombre": "José P."},
                                                "vendedor": {"clave": "d:x2:d7", "nombre": "Rosa M."}})
    g["mercadillo_bloqueos"].docs.append({"id": "b1", "de": "a:x3:a7", "a": "o:x1", "de_nombre": "Juan", "a_nombre": "Pepe Pérez",
                                          "ts": "2026-10-20T10:00:00+00:00"})
    assert await server._merc_nombre_de("o:x1") == "José P."                 # su conversación es lo último
    g["mercadillo_bloqueos"].docs[0]["ts"] = "2026-11-05T10:00:00+00:00"
    assert await server._merc_nombre_de("o:x1") == "Pepe Pérez"              # ahora lo último es el bloqueo que le hicieron
    g["mercadillo_anuncios"].docs[0]["actualizado"] = "2026-11-08T10:00:00+00:00"
    assert await server._merc_nombre_de("o:x1") == "Pepe P."                 # y ahora, su anuncio
    assert await server._merc_nombre_de("d:x2:d7") == "Rosa M." and await server._merc_nombre_de("a:x3:a7") == "Juan"
    assert await server._merc_nombre_de("o:x4") is None and await server._merc_nombre_de("o:x") is None
    # Solo con una conversación (la que vendía) o solo con un bloqueo (que hizo), se les puede quitar; y cada uno
    # queda con su nombre. La conversación de Rosa se cierra.
    for clave, nombre, conversaciones in (("d:x2:d7", "Rosa M.", 1), ("a:x3:a7", "Juan", 0)):
        r = await server.admin_mercadillo_expulsar({"clave": clave, "motivo": "acoso"}, DANI)
        assert (r["expulsado"]["clave"], r["expulsado"]["nombre"], r["anuncios"], r["conversaciones"]) == (clave, nombre, 0, conversaciones)
    assert g["mercadillo_conversaciones"].docs[0]["cerrada_por"] == "expulsion"


@pytest.mark.asyncio(loop_scope="session")
async def test_devolver_el_acceso_deja_entrar_otra_vez_pero_no_resucita_nada(mundo):
    await _abrir(mundo)
    a = await _publicado(ANA, "Soporte de móvil")
    cid = (await server.merc_contactar(a["id"], {"texto": "¿Sigue?"}, PEPE))["conversacion_id"]
    # A quien no está fuera no hay nada que devolverle (ni a una clave rara, ni a quien modera).
    for cuerpo in ({"clave": CLAVES["ana"]}, {}, [], {"clave": None}, {"clave": ["x"]}, {"clave": "fds"}, {"clave": ""}):
        await _falla(server.admin_mercadillo_readmitir(cuerpo, DANI), 404, YA_TIENE_ACCESO)
    await _expulsar("ana", "acoso")
    await _expulsar("pepe", "otro")                                          # el control: Pepe sigue fuera hasta el final
    await _falla(server.merc_lista("", ANA), 403, _fuera("acoso"))
    avisos, correos = len(mundo.g["mercadillo_avisos"].docs), len(mundo.enviados)
    assert await server.admin_mercadillo_readmitir({"clave": f"  {CLAVES['ana']} "}, DANI) == {"ok": True}
    assert [e["clave"] for e in mundo.g["mercadillo_expulsados"].docs] == [CLAVES["pepe"]]
    # ENTRA otra vez, y el estado ya no dice que está fuera.
    estado = await server.merc_estado(ANA)
    assert "expulsado" not in estado and "texto" not in estado and (estado["visible"], estado["yo"]["nombre"]) == (True, "Ana P.")
    # NO RESUCITA su anuncio ni reabre su conversación…
    assert [(m["titulo"], m["estado"], m["motivo"]) for m in (await server.merc_lista("", ANA))["mios"]] == [
        ("Soporte de móvil", "retirado", MOTIVOS_EXPULSION["acoso"])]
    assert [(c["id"], c["bloqueada"]) for c in (await server.merc_buzon(ANA))["conversaciones"]] == [(cid, True)]
    await _falla(server.merc_responder(cid, {"texto": "ya estoy"}, ANA), 403, CERRADA)
    assert await _titulos(LUIS) == set()
    # …pero puede volver a enviar lo que venda, y escribir.
    cascos = await _publicado(ANA, "Cascos")
    assert await _titulos(LUIS) == {"Cascos"}
    assert (await server.merc_contactar(cascos["id"], {"texto": "hola"}, LUIS))["ok"] is True
    # SE LE AVISA (a su buzón, que ya puede abrir, y a su correo) y queda apuntado.
    de_ana = [x["texto"] for x in mundo.g["mercadillo_avisos"].docs[avisos:] if x["para"] == CLAVES["ana"]]
    assert de_ana[0] == READMITIDO and READMITIDO in [x["texto"] for x in (await server.merc_buzon(ANA))["avisos"]]
    vuelta = [c for c in mundo.enviados[correos:] if c.to == "ana@x.es" and c.subject == "Vuelves a tener acceso al mercadillo"]
    assert len(vuelta) == 1 and READMITIDO in vuelta[0].texto
    rastros = [(x["action"], x["actor_id"], x["detail"]) for x in mundo.g["audit_log"].docs]
    assert ("mercadillo_readmitir", "dani", {"clave": CLAVES["ana"]}) in rastros
    # A Pepe no se le ha devuelto nada; y devolvérselo dos veces a Ana dice que ya lo tiene.
    await _falla(server.merc_lista("", PEPE), 403, _fuera("otro"))
    await _falla(server.admin_mercadillo_readmitir({"clave": CLAVES["ana"]}, DANI), 404, YA_TIENE_ACCESO)


@pytest.mark.asyncio(loop_scope="session")
async def test_el_panel_de_dani_ensena_a_quien_ha_dejado_fuera_y_de_quien_es_cada_denuncia(mundo):
    await _abrir(mundo)
    de_ana, de_pepe = await _publicado(ANA, "Soporte de móvil"), await _publicado(PEPE, "Carretilla")
    cid = (await server.merc_contactar(de_ana["id"], {"texto": "hola"}, PEPE))["conversacion_id"]
    await server.merc_denunciar({"anuncio_id": de_pepe["id"], "motivo": "estafa"}, LUIS)
    await server.merc_denunciar({"conversacion_id": cid, "motivo": "ofensivo"}, ANA)
    # Denuncias de algo que ya se borró (a su plazo): no hay a quién señalar, y el panel no se cae.
    for tipo in ("anuncio", "conversacion"):
        await mundo.g["mercadillo_denuncias"].insert_one({
            "id": f"huerfana-{tipo}", "objetivo": {"tipo": tipo, "id": "ya-no-existe", "titulo": "Borrado"}, "motivo": "otro",
            "texto": "", "de": CLAVES["luis"], "de_nombre": "Luis G.", "ts": "2026-11-11T10:00:00+00:00", "estado": "abierta"})
    panel = await server.admin_mercadillo(DANI)
    assert panel["expulsados"] == [] and panel["totales"]["expulsados"] == 0
    assert panel["motivos_expulsion"] == MOTIVOS_EXPULSION == mc.MOTIVOS_EXPULSION
    # EN CADA DENUNCIA, de quién es lo denunciado (con su clave: aquí sí): de un anuncio, quien vende; de una
    # conversación, los dos, cada uno con su papel.
    personas = {d["id"] if d["id"].startswith("huerfana") else d["objetivo"]["tipo"]: d["personas"] for d in panel["denuncias"]}
    assert personas == {
        "anuncio": [{"clave": CLAVES["pepe"], "nombre": "Pepe P.", "papel": "vendedor"}],
        "conversacion": [{"clave": CLAVES["ana"], "nombre": "Ana P.", "papel": "vendedor"},
                         {"clave": CLAVES["pepe"], "nombre": "Pepe P.", "papel": "comprador"}],
        "huerfana-anuncio": [], "huerfana-conversacion": []}
    # LOS QUE ESTÁN FUERA, lo último primero, con el motivo y la nota (para devolvérselo).
    e1 = (await _expulsar("pepe", "estafa", nota="Pedía el pago por adelantado."))["expulsado"]
    mundo.g["mercadillo_expulsados"].docs[0]["ts"] = e1["ts"] = "2026-01-09T10:00:00+00:00"       # (hace meses: para el orden)
    e2 = (await _expulsar("ana", "acoso"))["expulsado"]
    panel = await server.admin_mercadillo(DANI)
    assert panel["expulsados"] == [e2, e1] and panel["totales"]["expulsados"] == 2
    assert all(list(x) == ["clave", "nombre", "ts", "motivo_clave", "motivo", "nota"] for x in panel["expulsados"])
    assert (e1["motivo"], e1["nota"], e2["motivo"], e2["nota"]) == (
        "Hemos visto un engaño o un intento de estafa.", "Pedía el pago por adelantado.", "Has acosado o molestado a otra persona.", "")
    # La denuncia del anuncio de Pepe se cerró al retirárselo; la de la conversación sigue para que Dani la resuelva.
    assert sorted(d["objetivo"]["tipo"] for d in panel["denuncias"] if not d["id"].startswith("huerfana")) == ["conversacion"]
    await server.admin_mercadillo_readmitir({"clave": CLAVES["pepe"]}, DANI)
    panel = await server.admin_mercadillo(DANI)
    assert panel["expulsados"] == [e2] and panel["totales"]["expulsados"] == 1
    # Con más anuncios guardados de los que el panel carga de una vez (2.000), la denuncia de uno que queda fuera de
    # esa tanda sigue diciendo de quién es.
    de_luis = await _publicado(LUIS, "Botas")
    await server.merc_denunciar({"anuncio_id": de_luis["id"], "motivo": "otro"}, OFICINA)
    mundo.g["mercadillo_anuncios"].docs[:0] = [
        {"id": f"relleno{i}", "titulo": "Relleno", "estado": "vendido", "creado": "2026-01-01T10:00:00+00:00",
         "vendedor": {"clave": "o:relleno", "nombre": "Relleno"}} for i in range(2000)]
    de_las_botas = [d["personas"] for d in (await server.admin_mercadillo(DANI))["denuncias"] if d["objetivo"]["titulo"] == "Botas"]
    assert de_las_botas == [[{"clave": CLAVES["luis"], "nombre": "Luis G.", "papel": "vendedor"}]]


@pytest.mark.asyncio(loop_scope="session")
async def test_solo_dani_quita_y_devuelve_el_mercadillo_como_lo_llama_la_web(mundo, monkeypatch):
    """Las dos rutas nuevas del panel, por FastAPI: sin sesión, 401; con la de cualquiera que no sea el super-admin,
    403 y no pasa nada; y con la de Dani, el JSON exacto del contrato (que la web simula en sus pruebas)."""
    _por_http(mundo, monkeypatch)
    await _abrir(mundo)
    a = await _publicado(ANA, "Soporte de móvil")
    for ruta in (server.admin_mercadillo_expulsar, server.admin_mercadillo_readmitir):
        assert inspect.signature(ruta).parameters["user"].default.dependency is server.require_superadmin
    cuerpo = {"clave": CLAVES["ana"], "motivo": "ofensivo", "nota": "Insultos."}
    async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://testserver") as web:
        for ruta in ("/api/admin/mercadillo/expulsar", "/api/admin/mercadillo/readmitir"):
            assert (await web.post(ruta, json=cuerpo)).status_code == 401
            for quien in (PEPE, ANA, OFICINA, LUIS):
                r = await web.post(ruta, json=cuerpo, headers=_sesion(quien))
                assert (r.status_code, r.json()) == (403, {"detail": SOLO_DANI})
        assert mundo.g["mercadillo_expulsados"].docs == [] and await _titulos(LUIS) == {"Soporte de móvil"}
        # POST /admin/mercadillo/expulsar
        r = await web.post("/api/admin/mercadillo/expulsar", json=cuerpo, headers=_sesion(DANI))
        e = {"clave": CLAVES["ana"], "nombre": "Ana P.", "ts": mundo.g["mercadillo_expulsados"].docs[0]["ts"],
             "motivo_clave": "ofensivo", "motivo": "Has publicado o enviado contenido ofensivo.", "nota": "Insultos."}
        assert (r.status_code, r.json()) == (200, {"ok": True, "expulsado": e, "anuncios": 1, "conversaciones": 0})
        r = await web.post("/api/admin/mercadillo/expulsar", json=cuerpo, headers=_sesion(DANI))
        assert (r.status_code, r.json()) == (200, {"ok": True, "ya": True, "expulsado": e, "anuncios": 0, "conversaciones": 0})
        for mal, codigo, detalle in (({"clave": "fds", "motivo": "otro"}, 400, "A quien modera no se le puede quitar el mercadillo"),
                                     ({"clave": "ana", "motivo": "otro"}, 400, "Esa clave no es de una persona del mercadillo"),
                                     ({"clave": CLAVES["pepe"]}, 400, "Elige el motivo: es lo que se le dice a esa persona"),
                                     ({"clave": CLAVES["pepe"], "motivo": "otro"}, 404, "Esa persona no ha usado el mercadillo")):
            r = await web.post("/api/admin/mercadillo/expulsar", json=mal, headers=_sesion(DANI))
            assert (r.status_code, r.json()) == (codigo, {"detail": detalle})
        # Lo que ve la persona: el estado se lo explica y lo demás es 403 con ese mismo texto.
        texto = _fuera("ofensivo", "Insultos.")
        r = await web.get("/api/mercadillo/estado", headers=_sesion(ANA))
        assert (r.status_code, r.json()) == (200, {"visible": True, "abierto": True, "expulsado": True, "texto": texto,
                                                   "sin_leer": 0, "yo": {"nombre": "Ana P.", "tipo": "conductor"}})
        r = await web.get(f"/api/mercadillo/anuncio/{a['id']}", headers=_sesion(ANA))
        assert (r.status_code, r.json()) == (403, {"detail": texto})
        # GET /admin/mercadillo: los campos nuevos.
        r = await web.get("/api/admin/mercadillo", headers=_sesion(DANI))
        assert r.status_code == 200 and r.json()["expulsados"] == [e] and r.json()["totales"]["expulsados"] == 1
        assert r.json()["motivos_expulsion"] == MOTIVOS_EXPULSION
        # POST /admin/mercadillo/readmitir: ella misma no se lo devuelve; Dani sí, y la segunda vez ya lo tiene.
        r = await web.post("/api/admin/mercadillo/readmitir", json={"clave": CLAVES["ana"]}, headers=_sesion(ANA))
        assert r.status_code == 403 and len(mundo.g["mercadillo_expulsados"].docs) == 1
        r = await web.post("/api/admin/mercadillo/readmitir", json={"clave": CLAVES["ana"]}, headers=_sesion(DANI))
        assert (r.status_code, r.json()) == (200, {"ok": True})
        r = await web.post("/api/admin/mercadillo/readmitir", json={"clave": CLAVES["ana"]}, headers=_sesion(DANI))
        assert (r.status_code, r.json()) == (404, {"detail": YA_TIENE_ACCESO})
        r = await web.get("/api/mercadillo/estado", headers=_sesion(ANA))
        assert r.status_code == 200 and "expulsado" not in r.json() and r.json()["visible"] is True
        # Y LAS NORMAS, por su ruta: sin sesión no; sin el «acepto», 400; con él, queda dicho en la lista y en el estado.
        assert (await web.post("/api/mercadillo/normas", json={"acepto": True})).status_code == 401
        for ruta in ("/api/mercadillo", "/api/mercadillo/estado"):
            assert (await web.get(ruta, headers=_sesion(ANA))).json()["normas_ok"] is False
        r = await web.post("/api/mercadillo/normas", json={}, headers=_sesion(ANA))
        assert (r.status_code, r.json()) == (400, {"detail": "Tienes que aceptar las normas para usar el mercadillo"})
        r = await web.post("/api/mercadillo/normas", json={"acepto": True}, headers=_sesion(ANA))
        assert (r.status_code, r.json()) == (200, {"ok": True, "normas_ok": True})
        for ruta in ("/api/mercadillo", "/api/mercadillo/estado"):
            assert (await web.get(ruta, headers=_sesion(ANA))).json()["normas_ok"] is True
            assert (await web.get(ruta, headers=_sesion(DANI))).json()["normas_ok"] is True


@pytest.mark.asyncio(loop_scope="session")
async def test_al_quitar_el_mercadillo_tampoco_sale_la_clave_de_nadie_fuera_del_panel(mundo):
    """Lo nuevo (el estado de quien está fuera, su 403, sus avisos y sus correos, las normas) sigue sin llevar la clave
    de nadie. El panel de Dani sí la lleva: es con lo que se le dice a quién quitarle el mercadillo."""
    await _abrir(mundo)
    de_ana, de_pepe, de_oficina, de_luis = (await _publicado(ANA, "Soporte de móvil"), await _publicado(PEPE, "Carretilla"),
                                            await _publicado(OFICINA, "Silla de oficina"), await _publicado(LUIS, "Botas"))
    cid = (await server.merc_contactar(de_ana["id"], {"texto": "hola"}, PEPE))["conversacion_id"]
    await server.merc_denunciar({"anuncio_id": de_ana["id"], "motivo": "ofensivo"}, LUIS)
    await server.merc_denunciar({"anuncio_id": de_luis["id"], "motivo": "otro"}, OFICINA)        # esta sigue abierta
    del_panel = [await _expulsar("pepe", "estafa", nota="Pedía el pago por adelantado."), await _expulsar("ana", "acoso"),
                 await _expulsar("oficina", "otro"), await _expulsar("ana", "acoso")]
    vistas, errores = [], []
    for user in (PEPE, ANA, OFICINA):
        vistas.append(await server.merc_estado(user))
        errores += [await _falla(intento, 403) for intento in (
            server.merc_lista("", user), server.merc_buzon(user), server.merc_normas({"acepto": True}, user),
            server.merc_conversacion(cid, user), server.merc_anuncio(de_luis["id"], user),
            server.merc_bloquear({"anuncio_id": de_luis["id"]}, user), server.merc_bloqueados(user))]
    await server.admin_mercadillo_readmitir({"clave": CLAVES["pepe"]}, DANI)
    vistas += [await server.merc_normas({"acepto": True}, LUIS), await server.merc_normas({"acepto": True}, PEPE)]
    for user in (LUIS, PEPE, DANI):
        vistas += [await server.merc_estado(user), await server.merc_lista("", user), await server.merc_buzon(user)]
    # Lo que les llega: cada aviso de su buzón y cada correo (asunto y texto).
    vistas += [x["texto"] for x in mundo.g["mercadillo_avisos"].docs] + [c.texto for c in mundo.enviados] + [
        c.subject for c in mundo.enviados]
    assert len(errores) == 21 and len(vistas) > 30
    assert [h for v in vistas for h in _claves_en(v)] == [] and [h for e in errores for h in _claves_en(e.detail)] == []
    assert {e.detail for e in errores} == {_fuera("estafa", "Pedía el pago por adelantado."), _fuera("acoso"), _fuera("otro")}
    # El control: lo de Dani SÍ las lleva (así que el buscador las habría visto).
    assert [_claves_en(r)[0] for r in del_panel] == [".expulsado.clave"] * 4
    en_el_panel = _claves_en(await server.admin_mercadillo(DANI))
    assert ".expulsados[0].clave" in en_el_panel and ".denuncias[0].personas[0].clave" in en_el_panel


@pytest.mark.asyncio(loop_scope="session")
async def test_a_una_persona_se_la_expulsa_una_vez_aunque_lleguen_dos_toques_a_la_vez(mundo, monkeypatch):
    """Sin un índice ÚNICO por `clave`, el `except DuplicateKeyError` de expulsar sería papel mojado: dos toques a la vez
    dejarían dos expulsiones y dos avisos a esa persona (y devolverle el acceso, borrando una, no se lo devolvería)."""
    creados = []

    async def idx(coleccion, *args, **kwargs):
        creados.append((coleccion, args, kwargs))

    async def nada(*a, **k):
        return []
    monkeypatch.setattr(server, "_idx", idx)
    monkeypatch.setattr(server, "_ensure_tenant_indexes", nada)
    mundo.g.list_collection_names = nada
    await server.create_indexes()
    col = mundo.g["mercadillo_expulsados"]
    assert [(args, kwargs) for c, args, kwargs in creados if c is col] == [
        (("clave",), {"unique": True, "name": "mercadillo_expulsado_unico"})]
    # Dos toques A LA VEZ: los dos pasan el «¿ya estaba?», el índice rechaza el segundo, y este contesta `ya` con la
    # expulsión que ganó, sin un segundo aviso; lo suyo queda retirado igual.
    await _abrir(mundo)
    a = await _publicado(ANA, "Soporte de móvil")
    guardar = col.insert_one

    async def el_otro_toque_llego_antes(doc):
        await guardar({**doc, "ts": "2026-11-10T09:00:00+00:00", "motivo_clave": "acoso", "motivo": MOTIVOS_EXPULSION["acoso"]})
        raise DuplicateKeyError("E11000 duplicate key error collection: mercadillo_expulsados index: mercadillo_expulsado_unico")
    monkeypatch.setattr(col, "insert_one", el_otro_toque_llego_antes)
    avisos, correos, rastros = len(mundo.g["mercadillo_avisos"].docs), len(mundo.enviados), len(mundo.g["audit_log"].docs)
    r = await _expulsar("ana", "ofensivo")
    assert (r["ok"], r["ya"]) == (True, True) and len(col.docs) == 1
    assert (r["expulsado"]["motivo_clave"], r["expulsado"]["ts"]) == ("acoso", "2026-11-10T09:00:00+00:00")
    assert (len(mundo.g["mercadillo_avisos"].docs), len(mundo.enviados), len(mundo.g["audit_log"].docs)) == (avisos, correos, rastros)
    assert (await mundo.g["mercadillo_anuncios"].find_one({"id": a["id"]}))["estado"] == "retirado"
    await _falla(server.merc_lista("", ANA), 403, _fuera("acoso"))


@pytest.mark.asyncio(loop_scope="session")
async def test_la_baja_de_la_cuenta_se_lleva_tambien_su_expulsion(mundo):
    await _abrir(mundo)
    _con_cuenta(mundo)
    await _publicado(PEPE, "Carretilla")
    await _publicado(ANA, "Soporte de móvil")
    await _expulsar("pepe", "estafa")
    await _expulsar("ana", "otro")
    assert await server.borrar_cuenta({"password": "secreta123"}, PEPE) == {"ok": True}
    assert [e["clave"] for e in mundo.g["mercadillo_expulsados"].docs] == [CLAVES["ana"]]


# ── LAS NORMAS, ACEPTADAS (10-11-2026) ──────────────────────────────────────
NORMAS_SIN_ACEPTAR = "Tienes que aceptar las normas para usar el mercadillo"


@pytest.mark.asyncio(loop_scope="session")
async def test_las_normas_se_aceptan_una_vez_por_version_y_el_servidor_solo_lo_dice(mundo, monkeypatch):
    """Apple: «require that users agree to terms». El servidor apunta quién, qué versión y cuándo, y lo dice con
    `normas_ok`; la pantalla la impone la WEB (solo con un `false` estricto). Las demás rutas NO lo exigen: la app de
    iPhone que está en revisión no conoce esa pantalla y dejaría de poder escribir."""
    await _falla(server.merc_normas({"acepto": True}, ANA), 404, "El mercadillo todavía no está abierto")   # pasa por la puerta
    await _abrir(mundo)
    a = await _publicado(PEPE, "Carretilla")
    assert mundo.g["mercadillo_prefs"].docs == []
    for quien in (ANA, PEPE, OFICINA):
        assert (await server.merc_estado(quien))["normas_ok"] is False and (await server.merc_lista("", quien))["normas_ok"] is False
    # A quien modera no se le piden.
    assert (await server.merc_estado(DANI))["normas_ok"] is True and (await server.merc_lista("", DANI))["normas_ok"] is True
    # SIN ACEPTARLAS se puede seguir usando todo (el servidor no lo exige).
    cid = (await server.merc_contactar(a["id"], {"texto": "¿Sigue?"}, ANA))["conversacion_id"]
    await server.merc_responder(cid, {"texto": "Sí"}, PEPE)
    assert (await server.merc_buzon(ANA))["conversaciones"][0]["id"] == cid and (await server.merc_estado(ANA))["normas_ok"] is False
    # Sin un «acepto» de verdad no vale (ni «true» en texto, ni un 1, ni otro campo).
    for cuerpo in ({}, [], {"acepto": False}, {"acepto": "true"}, {"acepto": 1}, {"acepto": None}, {"acepta": True}):
        await _falla(server.merc_normas(cuerpo, ANA), 400, NORMAS_SIN_ACEPTAR)
    assert mundo.g["mercadillo_prefs"].docs == [] and (await server.merc_estado(ANA))["normas_ok"] is False
    # «ACEPTO LAS NORMAS»: queda apuntado quién, qué versión y cuándo.
    assert await server.merc_normas({"acepto": True}, ANA) == {"ok": True, "normas_ok": True}
    guardado = mundo.g["mercadillo_prefs"].docs
    assert len(guardado) == 1 and guardado[0]["clave"] == CLAVES["ana"] and set(guardado[0]["normas"]) == {"v", "ts"}
    assert guardado[0]["normas"]["v"] == mc.NORMAS_VERSION == "2026-11-10" and _es_fecha(guardado[0]["normas"]["ts"])
    assert (await server.merc_estado(ANA))["normas_ok"] is True and (await server.merc_lista("", ANA))["normas_ok"] is True
    assert (await server.merc_estado(PEPE))["normas_ok"] is False            # cada uno, las suyas
    # Aceptarlas no toca sus avisos al móvil, ni ponerlos borra lo aceptado; y dos veces no deja dos apuntes.
    await server.merc_avisos_movil({"activo": True}, ANA)
    await server.merc_normas({"acepto": True}, ANA)
    estado = await server.merc_estado(ANA)
    assert (estado["normas_ok"], estado["avisos_movil"], len(mundo.g["mercadillo_prefs"].docs)) == (True, True, 1)
    assert await server.merc_normas({"acepto": True}, DANI) == {"ok": True, "normas_ok": True}      # él también puede pulsarlo
    # Un dato viejo o roto no es un «sí» (ni un 500).
    await mundo.g["mercadillo_prefs"].insert_one({"clave": CLAVES["oficina"], "normas": mc.NORMAS_VERSION})
    await mundo.g["mercadillo_prefs"].insert_one({"clave": CLAVES["luis"], "normas": {"ts": "2026-11-10T10:00:00+00:00"}})
    assert [(await server.merc_estado(q))["normas_ok"] for q in (OFICINA, LUIS)] == [False, False]
    # CAMBIAN LAS NORMAS: a todos se les vuelven a pedir (a quien modera, no), y al aceptar queda la versión nueva.
    monkeypatch.setattr(mc, "NORMAS_VERSION", "2027-01-15")
    assert (await server.merc_estado(ANA))["normas_ok"] is False and (await server.merc_lista("", ANA))["normas_ok"] is False
    assert (await server.merc_estado(DANI))["normas_ok"] is True
    assert await server.merc_normas({"acepto": True}, ANA) == {"ok": True, "normas_ok": True}
    de_ana = await mundo.g["mercadillo_prefs"].find_one({"clave": CLAVES["ana"]})
    assert (await server.merc_estado(ANA))["normas_ok"] is True and (de_ana["normas"]["v"], de_ana["push"]) == ("2027-01-15", True)


# ── EL FILTRO DEL LENGUAJE OFENSIVO (10-11-2026) ────────────────────────────
# Apple: «a method for filtering objectionable content». Es un filtro BÁSICO de lista (palabras y frases enteras, sin
# mayúsculas ni tildes): no lo detecta todo, y se prueba con el mismo cuidado lo que para que lo que NO puede parar.
MENSAJE_OFENSIVO = "Ese mensaje no se puede enviar: no se permiten insultos, amenazas ni contenido ofensivo. Cámbialo y vuelve a enviarlo."
ANUNCIO_OFENSIVO = "Ese anuncio no se puede enviar: quita los insultos o el contenido ofensivo del texto."
ENTRA = [
    # insultos, tal cual y disfrazados de mayúsculas, signos, saltos de línea o letras «anchas»
    "hijo de puta", "¡HIJO DE PUTA!", "Hijo-de-Puta", "hijo  de\nputa", "Vendo esto, hijos de puta", "ｈｉｊｏ ｄｅ ｐｕｔａ",
    "eres un gilipollas", "GILIPOLLAS.", "subnormal", "tu puta madre", "me cago en tus muertos", "coño de tu madre",
    "malparido", "eres una mierda",
    # racistas y homófobos
    "maricón", "MARICÓN", "Maricones todos", "no seas maricón", "negro de mierda", "puta negra", "puto moro",
    "moros de mierda", "sudaca", "gitanos de mierda",
    # amenazas
    "Te voy a matar", "te voy a partir la cara", "ojalá te mueras", "voy a matarte, ya lo sabes",
    # inglés y los pocos de otros idiomas
    "fuck you", "Fuck off!", "I'll kill you", "motherfucker", "you bitch", "nigger", "faggot", "kill yourself",
    "filho da puta", "fillo de puta", "fill de puta", "connard", "enculé", "nique ta mère", "vaffanculo", "Arschlöcher",
]
NO_ENTRA = [
    # dentro de otra palabra, nunca (Cuntis es un concello de Pontevedra; Dickies, ropa de trabajo; «salopette», un peto)
    "disputa", "computadora", "Scunthorpe", "mariconera Nike", "Assassin's Creed", "Essex", "analógico", "gilipollez",
    "Recojo en Cuntis", "Pantalón Dickies", "salopette de travail", "Impresora HP",
    # lo que se vende y cómo se habla en un mercadillo de repartidores
    "un chaleco negro", "Chaleco reflectante negro, talla L", "Funda negra para iPhone", "moro", "moros y cristianos",
    "gitano", "móvil chino de mierda", "Lima bastarda", "kill switch", "2 años de uso", "Níger", "Kike", "marica",
    "pedido retrasado", "el paquet porta retard", "mongola", "polla",
    # palabrotas sueltas, que entre compañeros no van contra nadie
    "puta", "está de puta madre", "ni puta idea", "el puto móvil no carga", "eres un puto crack", "eres una puta máquina",
    "coño", "joder", "mierda", "esta furgo es una mierda", "hostia", "qué cabrón, qué suerte", "fuck", "shit",
    "perdona, soy idiota", "te mato jaja",
    # frases normales que se parecen a una amenaza o a un insulto
    "te voy a buscar a la nave", "sé dónde vives, te lo acerco", "hijo de vecino", "me voy a matar a currar",
    "hay moros en la costa", "lo cobro en negro",
    # nada, o algo que no es texto
    "", "   ", None, 5,
]


@pytest.mark.parametrize("texto", ENTRA)
def test_el_filtro_para_insultos_y_amenazas(texto):
    assert mc.ofensivo(texto) is True
    with pytest.raises(mc.Invalido) as e:
        mc.mensaje(texto)
    assert str(e.value) == MENSAJE_OFENSIVO


@pytest.mark.parametrize("texto", NO_ENTRA)
def test_el_filtro_no_para_lo_que_se_dice_y_se_vende_en_un_mercadillo_de_repartidores(texto):
    assert mc.ofensivo(texto) is False
    if str(texto or "").strip():
        assert mc.mensaje(texto) == str(texto).strip()


def test_la_lista_del_filtro_es_corta_y_esta_escrita_como_se_compara():
    """Cada entrada, en minúsculas, sin tildes (con su ñ) y con un espacio entre palabras: si no, no casaría nunca.
    Y ninguna de las palabras que aquí tienen un uso normal está sola en la lista."""
    assert [x for x in mc.OFENSIVO if mc._palabras(x) != f" {x} "] == []
    assert len(set(mc.OFENSIVO)) == len(mc.OFENSIVO) and 80 <= len(mc.OFENSIVO) <= 200
    assert [x for x in mc.OFENSIVO if not mc.ofensivo(f"«{x.upper()}»")] == []
    de_uso_normal = {"puta", "puto", "coño", "joder", "mierda", "hostia", "cabron", "negro", "negra", "moro", "mora", "gitano",
                     "chino", "marica", "bastardo", "retard", "retrasado", "polla", "zorra", "perra", "cerdo", "idiota",
                     "tonto", "imbecil", "fuck", "shit", "kike", "ano"}
    assert de_uso_normal & set(mc.OFENSIVO) == set()
    # Cómo compara: sin mayúsculas ni tildes, palabra a palabra; la ñ no es una n («año» no es «ano»).
    assert mc._palabras("¡Hijo de PUTA!") == " hijo de puta " and mc._palabras("Año, año y São") == " año año y sao "
    assert mc._palabras(None) == mc._palabras("  ¡¿?!  ") == "  "


def test_el_filtro_mira_el_titulo_la_descripcion_y_la_zona_del_anuncio_y_no_los_nombres():
    base = {"titulo": "Chaleco negro", "categoria": "ropa", "estado_articulo": "como_nuevo", "precio": "15",
            "descripcion": "Está de puta madre, casi sin usar.", "zona": "Coruña (zona del Moro)", "fotos": ["a"], "acepto": True}
    assert mc.validar(base)["titulo"] == "Chaleco negro"
    for cambio in ({"titulo": "Chaleco para gilipollas"}, {"descripcion": "Si regateas eres un subnormal."},
                   {"zona": "donde los sudacas"}, {"titulo": "TE VOY A MATAR"}):
        with pytest.raises(mc.Invalido) as e:
            mc.validar({**base, **cambio})
        assert str(e.value) == ANUNCIO_OFENSIVO
    # Una frase no se forma a caballo entre dos campos (cada uno se mira por separado).
    assert mc.validar({**base, "titulo": "Regalo para tu hijo de", "descripcion": "puta madre de calidad"})["zona"] == "Coruña (zona del Moro)"
    # Los nombres no pasan por el filtro (salen de la cuenta, no los escribe en el mercadillo).
    assert mc.nombre_publico("Gilipollas Pérez") == "Gilipollas P."


@pytest.mark.asyncio(loop_scope="session")
async def test_el_filtro_en_me_interesa_al_responder_al_publicar_y_al_corregir_pero_no_en_una_denuncia(mundo):
    await _abrir(mundo)
    a = await _publicado(ANA, "Soporte de móvil")
    # «ME INTERESA»: no se abre la conversación ni se le cuenta un interesado.
    await _falla(server.merc_contactar(a["id"], {"texto": "Baja el precio, hijo de puta"}, PEPE), 400, MENSAJE_OFENSIVO)
    assert mundo.g["mercadillo_conversaciones"].docs == [] and mundo.g["mercadillo_mensajes"].docs == []
    assert mundo.g["mercadillo_anuncios"].docs[0]["interesados"] == 0
    cid = (await server.merc_contactar(a["id"], {"texto": "¿Sigue disponible? Está de puta madre"}, PEPE))["conversacion_id"]
    # RESPONDER, de cada lado: no se guarda ni le llega nada al otro.
    correos = len(mundo.enviados)
    for quien, texto in ((ANA, "te voy a matar"), (PEPE, "¡GILIPOLLAS!"), (PEPE, "fuck you")):
        await _falla(server.merc_responder(cid, {"texto": texto}, quien), 400, MENSAJE_OFENSIVO)
    assert len(mundo.g["mercadillo_mensajes"].docs) == 1 and len(mundo.enviados) == correos
    assert (await server.merc_responder(cid, {"texto": "Sí, el negro. ¡Joder, qué rápido!"}, ANA))["texto"] == "Sí, el negro. ¡Joder, qué rápido!"
    # PUBLICAR: en el título, en la descripción o en la zona; no queda ni el anuncio ni la foto cogida.
    f = await server.merc_subir_foto(_Fichero(_jpeg_con_gps()), LUIS)
    base = {"titulo": "Botas de seguridad", "categoria": "ropa", "estado_articulo": "buen_estado", "precio": "20",
            "zona": "A Coruña", "fotos": [f["id"]], "acepto": True}
    a_dani = len(mundo.enviados)
    for cambio in ({"titulo": "Botas para maricones"}, {"descripcion": "Si regateas, eres un subnormal."}, {"zona": "donde los sudacas"}):
        await _falla(server.merc_crear({**base, **cambio}, LUIS), 400, ANUNCIO_OFENSIVO)
    assert (await server.merc_lista("", LUIS))["mios"] == [] and len(mundo.enviados) == a_dani
    assert (await mundo.g["mercadillo_fotos"].find_one({"id": f["id"]}))["anuncio"] is None
    botas = await server.merc_crear({**base, "descripcion": "Negras, del 43. Están de puta madre."}, LUIS)
    await server.admin_mercadillo_anuncio(botas["id"], {"accion": "aprobar"}, DANI)
    # CORREGIR: el anuncio se queda como estaba (ni cambia ni vuelve a revisión).
    await _falla(server.merc_cambiar(botas["id"], {**base, "titulo": "Botas, hijos de puta"}, LUIS), 400, ANUNCIO_OFENSIVO)
    guardado = await mundo.g["mercadillo_anuncios"].find_one({"id": botas["id"]})
    assert (guardado["titulo"], guardado["estado"]) == ("Botas de seguridad", "publicado") and "Botas de seguridad" in await _titulos(PEPE)
    assert (await server.merc_cambiar(botas["id"], {**base, "titulo": "Botas de seguridad negras"}, LUIS))["estado"] == "pendiente"
    # LA DENUNCIA NO SE FILTRA: quien denuncia puede tener que citar lo que le han dicho.
    cita = "Me ha llamado hijo de puta y me ha escrito «te voy a matar»"
    assert await server.merc_denunciar({"conversacion_id": cid, "motivo": "ofensivo", "texto": cita}, ANA) == {"ok": True}
    assert mundo.g["mercadillo_denuncias"].docs[-1]["texto"] == cita
    assert await server.merc_denunciar({"anuncio_id": a["id"], "motivo": "ofensivo", "texto": "pone «sudacas»"}, PEPE) == {"ok": True}
    # LO QUE YA ESTABA GUARDADO no se toca: un mensaje de antes del filtro se sigue leyendo (y se puede denunciar).
    await mundo.g["mercadillo_mensajes"].insert_one({"id": "de-antes", "conv": cid, "de": CLAVES["pepe"], "texto": "gilipollas",
                                                    "ts": "2026-01-01T10:00:00+00:00"})
    assert "gilipollas" in [m["texto"] for m in (await server.merc_conversacion(cid, ANA))["mensajes"]]
    assert (await server.admin_mercadillo(DANI))["denuncias"][0]["mensajes"][0]["texto"] == "gilipollas"


# ── LA LIMPIEZA AL BORRAR (10-11-2026) ──────────────────────────────────────
# Quien deja de poder entrar no puede dejar anuncios publicados ni conversaciones abiertas a nombre de alguien que ya
# no contesta. Y al revés: un fallo del mercadillo no puede impedir NUNCA que se borre una empresa o una persona.
def _mercadillo_de(mundo, clave: str) -> dict:
    """Lo que queda en el mercadillo de esa persona: cuántos anuncios activos, conversaciones abiertas, bloqueos (hechos o
    recibidos), preferencias y expulsiones."""
    g = mundo.g
    return {"anuncios": len([a for a in g["mercadillo_anuncios"].docs
                             if a["vendedor"].get("clave") == clave and a["estado"] in mc.ESTADOS_ACTIVOS]),
            "conversaciones": len([c for c in g["mercadillo_conversaciones"].docs if not c.get("bloqueada")
                                   and clave in (c["comprador"]["clave"], c["vendedor"]["clave"])]),
            "bloqueos": len([b for b in g["mercadillo_bloqueos"].docs if clave in (b["de"], b["a"])]),
            "prefs": len([p for p in g["mercadillo_prefs"].docs if p["clave"] == clave]),
            "expulsiones": len([e for e in g["mercadillo_expulsados"].docs if e["clave"] == clave])}


VACIO = {"anuncios": 0, "conversaciones": 0, "bloqueos": 0, "prefs": 0, "expulsiones": 0}


async def _con_mercadillo(mundo, *personas) -> None:
    """Cada una con un anuncio publicado, una conversación abierta (Luis le escribe), un bloqueo (bloquea a Dani), sus
    avisos al móvil y las normas aceptadas."""
    dani = await _publicado(DANI, "iPhone 18 Pro · 256 GB", "1.300")
    for i, p in enumerate(personas):
        a = await _publicado(p, f"Cosa {i}")
        await server.merc_contactar(a["id"], {"texto": "¿Sigue?"}, LUIS)
        await server.merc_bloquear({"anuncio_id": dani["id"]}, p)
        await server.merc_avisos_movil({"activo": True}, p)
        await server.merc_normas({"acepto": True}, p)


async def _roto(clave):
    raise RuntimeError("la base no contesta")


@pytest.mark.asyncio(loop_scope="session")
async def test_borrar_una_empresa_se_lleva_el_mercadillo_de_todas_sus_personas_y_solo_el_suyo(mundo, monkeypatch):
    borradas = []

    async def tirar(nombre):
        borradas.append(nombre)
    monkeypatch.setattr(server, "client", SimpleNamespace(drop_database=tirar))
    mundo.g["organizations"].docs += [
        {"id": "emp", "name": "Reparto Norte", "account_type": "dsp", "plan": "completo", "sector": "reparto", "slug": "norte"},
        {"id": "emp2", "name": "Reparto Norte 2", "account_type": "dsp", "plan": "completo", "sector": "reparto", "slug": "norte2"},
        {"id": "sol", "name": "Sol Vila", "account_type": "dsp", "plan": "autonomo", "sector": "autonomo", "slug": "sol"},
        {"id": "sol2", "name": "Sol Díaz", "account_type": "dsp", "plan": "autonomo", "sector": "autonomo", "slug": "sol2"}]
    mundo.g["admin_users"] = Col([{"id": "j1", "org_id": "emp"}, {"id": "j1b", "org_id": "emp2"}, {"id": "s1", "org_id": "sol"},
                                  {"id": "s2", "org_id": "sol2"}, {"id": "a9", "org_id": "empresa"}])
    marta, carlos = ({"sub": "j1", "role": "admin", "org_id": "emp", "name": "Marta Ruiz"},
                     {"sub": "c1", "role": "driver", "org_id": "emp", "name": "Carlos Vez"})
    sol = {"sub": "s1", "role": "admin", "org_id": "sol", "name": "Sol"}
    # Las de control se llaman casi igual (mismo conductor «c1», y «emp2»/«sol2» EMPIEZAN por «emp»/«sol»).
    marta2, carlos2, sol2 = {**marta, "sub": "j1b", "org_id": "emp2"}, {**carlos, "org_id": "emp2"}, {**sol, "sub": "s2", "org_id": "sol2"}
    await _abrir(mundo)
    todas = (marta, carlos, sol, marta2, carlos2, sol2, ANA)
    await _con_mercadillo(mundo, *todas)
    claves = {n: (await server._merc_yo(p))["clave"] for n, p in zip(("marta", "carlos", "sol", "marta2", "carlos2", "sol2", "ana"), todas)}
    assert claves == {"marta": "a:emp:j1", "carlos": "d:emp:c1", "sol": "o:sol", "marta2": "a:emp2:j1b", "carlos2": "d:emp2:c1",
                      "sol2": "o:sol2", "ana": CLAVES["ana"]}
    await mundo.g["mercadillo_expulsados"].insert_one({"clave": "d:emp:c9", "nombre": "Uno de emp", "ts": "2026-11-10T10:00:00+00:00"})
    await mundo.g["mercadillo_expulsados"].insert_one({"clave": "d:emp2:c9", "nombre": "Uno de emp2", "ts": "2026-11-10T10:00:00+00:00"})
    entero = {"anuncios": 1, "conversaciones": 1, "bloqueos": 1, "prefs": 1, "expulsiones": 0}
    assert all(_mercadillo_de(mundo, c) == entero for c in claves.values())
    # NO ES DE CUALQUIERA, y lo que no es una cuenta de cliente no se borra (ni se toca su mercadillo).
    await _falla(server.require_superadmin(marta), 403)
    await _falla(server.admin_delete_org("owner", DANI), 404, "Empresa no encontrada")
    assert _mercadillo_de(mundo, claves["ana"]) == entero
    # SE BORRA «emp»: el mercadillo de su oficina y de su conductor se cierra (y la expulsión de uno de los suyos se va).
    assert await server.admin_delete_org("emp", DANI) == {"ok": True}
    assert borradas == ["dsp_emp"] and await server.get_org("emp") is None
    assert [u["id"] for u in mundo.g["admin_users"].docs] == ["j1b", "s1", "s2", "a9"]
    assert _mercadillo_de(mundo, claves["marta"]) == _mercadillo_de(mundo, claves["carlos"]) == VACIO
    assert [e["clave"] for e in mundo.g["mercadillo_expulsados"].docs] == ["d:emp2:c9"]
    quitados = [a for a in mundo.g["mercadillo_anuncios"].docs if a["estado"] == "quitado"]
    assert sorted(a["vendedor"]["clave"] for a in quitados) == ["a:emp:j1", "d:emp:c1"] and all(_es_fecha(a["fin"]) for a in quitados)
    cerradas = [c for c in mundo.g["mercadillo_conversaciones"].docs if c.get("bloqueada")]
    assert sorted(c["vendedor"]["clave"] for c in cerradas) == ["a:emp:j1", "d:emp:c1"] and {c["cerrada_por"] for c in cerradas} == {"baja"}
    # …y SOLO el suyo: «emp2», las dos autónomas y Ana siguen enteras.
    for n in ("marta2", "carlos2", "sol", "sol2", "ana"):
        assert _mercadillo_de(mundo, claves[n]) == entero, n
    assert len(await _titulos(DANI)) == 6                                    # (lo de Dani y lo de los cinco que siguen)
    # SE BORRA «sol» (quien reparte por su cuenta: su mercadillo es el de la cuenta) y «sol2» ni se entera.
    assert await server.admin_delete_org("sol", DANI) == {"ok": True}
    assert _mercadillo_de(mundo, claves["sol"]) == VACIO and _mercadillo_de(mundo, claves["sol2"]) == entero
    # Un punto en el id de la cuenta no es un comodín, y «o:emp» no es «o:emp2».
    filtro = server._merc_de_la_cuenta("a.b")["$regex"]
    assert [c for c in ("o:a.b", "d:a.b:x", "a:a.b:y", "o:aXb", "d:aXb:x", "o:a.b2", "d:a.b2:x", "xo:a.b", "o:a.b:z") if re.search(filtro, c)] == [
        "o:a.b", "d:a.b:x", "a:a.b:y"]
    # SI EL MERCADILLO FALLA, la empresa se borra igual.
    monkeypatch.setattr(server, "_merc_baja", _roto)
    assert await server.admin_delete_org("emp2", DANI) == {"ok": True}
    assert await server.get_org("emp2") is None and borradas == ["dsp_emp", "dsp_sol", "dsp_emp2"]
    assert [x["action"] for x in mundo.g["audit_log"].docs] == ["org_delete"] * 3
    assert _mercadillo_de(mundo, claves["marta2"]) == entero                 # (no se pudo cerrar: queda como estaba)


@pytest.mark.asyncio(loop_scope="session")
async def test_borrar_un_conductor_se_lleva_su_mercadillo_y_borrar_solo_su_cuenta_de_acceso_no(mundo, monkeypatch):
    tenant = Db()
    tenant["drivers"] = Col([{"id": "d1", "name": "Ana", "active": True}, {"id": "d2", "name": "Luis", "active": True},
                             {"id": "d3", "name": "Rosa", "active": True}])
    tenant["driver_accounts"] = Col([{"driver_id": "d1", "email": "ana@x.es"}, {"driver_id": "d3", "email": "rosa@x.es"}])
    limpiados = []

    async def correo_personal(driver_id, org_id):
        limpiados.append(driver_id)
    monkeypatch.setattr(server, "db", tenant)
    monkeypatch.setattr(server, "_limpiar_correo_personal_conductor", correo_personal)
    jefe = {"sub": "jefe", "role": "admin", "org_id": "owner", "name": "Jefe"}
    rosa = {"sub": "d3", "role": "driver", "org_id": "owner", "name": "Rosa Mar"}
    ana_de_otra = {**ANA, "org_id": "empresa"}                              # otra empresa con un conductor «d1»
    await _abrir(mundo)
    await _con_mercadillo(mundo, ANA, rosa, ana_de_otra, PEPE)
    entero = {"anuncios": 1, "conversaciones": 1, "bloqueos": 1, "prefs": 1, "expulsiones": 0}
    await _expulsar("ana", "otro")                                           # (Ana, además, estaba fuera: también se va)
    de_ana = {"anuncios": 0, "conversaciones": 0, "bloqueos": 1, "prefs": 1, "expulsiones": 1}
    assert _mercadillo_de(mundo, CLAVES["ana"]) == de_ana
    # BORRAR SOLO SU CUENTA DE ACCESO no deja fuera a nadie (vuelve a entrar con un código a su correo o con la
    # contraseña inicial): su mercadillo no se toca.
    assert await server.delete_driver_account("d3", jefe) == {"success": True, "driver_id": "d3"}
    assert tenant["driver_accounts"].docs == [{"driver_id": "d1", "email": "ana@x.es"}]
    assert _mercadillo_de(mundo, "d:owner:d3") == entero and "Cosa 1" in await _titulos(PEPE)
    # Un conductor que no existe: 404, y no se toca el mercadillo de nadie.
    await _falla(server.delete_driver("no-existe", jefe), 404, "Conductor no encontrado")
    assert _mercadillo_de(mundo, "d:owner:d3") == entero and _mercadillo_de(mundo, CLAVES["ana"]) == de_ana
    # BORRAR AL CONDUCTOR (la ficha queda de baja: ya no entra): su mercadillo se va con él, y solo el suyo.
    assert await server.delete_driver("d1", jefe) == {"success": True}
    assert (await tenant["drivers"].find_one({"id": "d1"}))["active"] is False and limpiados == ["d1"]
    assert _mercadillo_de(mundo, CLAVES["ana"]) == VACIO
    for clave in ("d:owner:d3", "d:empresa:d1", CLAVES["pepe"]):             # la compañera, el «d1» de otra empresa y Pepe
        assert _mercadillo_de(mundo, clave) == entero, clave
    assert mundo.g["audit_log"].docs[-1]["action"] == "driver_delete"
    # Quien borra desde la base por defecto no lleva la empresa en su sesión: es la del dueño.
    assert await server.delete_driver("d3", {"sub": "viejo", "role": "admin", "name": "Sin empresa"}) == {"success": True}
    assert _mercadillo_de(mundo, "d:owner:d3") == VACIO and _mercadillo_de(mundo, "d:empresa:d1") == entero
    # SI EL MERCADILLO FALLA, al conductor se le da de baja igual.
    monkeypatch.setattr(server, "_merc_baja", _roto)
    assert await server.delete_driver("d2", jefe) == {"success": True}
    assert (await tenant["drivers"].find_one({"id": "d2"}))["active"] is False and limpiados == ["d1", "d3", "d2"]


@pytest.mark.asyncio(loop_scope="session")
async def test_borrar_a_alguien_de_oficina_se_lleva_su_mercadillo_y_solo_el_suyo(mundo, monkeypatch):
    monkeypatch.setattr(server, "_ADMIN_EXISTS_CACHE", {})
    mundo.g["admin_users"] = Col([{"id": "a9", "username": "oficina@x.es", "org_id": "empresa"},
                                  {"id": "a8", "username": "otra@x.es", "org_id": "empresa"},
                                  {"id": "a1", "username": "pepe@x.es", "org_id": "o1"}, {"id": "a2", "username": "socio@x.es", "org_id": "o1"},
                                  {"id": "v1", "username": "viejo"}])
    otra = {"sub": "a8", "role": "admin", "org_id": "empresa", "name": "Otra Persona"}
    quien_borra = {"sub": "jefa", "role": "admin", "org_id": "empresa", "name": "Jefa", "sa": True}
    await _abrir(mundo)
    await _con_mercadillo(mundo, OFICINA, otra, PEPE)
    entero = {"anuncios": 1, "conversaciones": 1, "bloqueos": 1, "prefs": 1, "expulsiones": 0}
    # No puede cualquiera (como siempre): alguien de oficina sin ese permiso no borra a un compañero, ni su mercadillo.
    await _falla(server.delete_admin("a9", otra), 403, "Sin permisos para eliminar usuarios")
    assert _mercadillo_de(mundo, CLAVES["oficina"]) == entero
    # SE BORRA a la persona de oficina: ya no entra (su sesión deja de valer), y su mercadillo se va con ella.
    assert await server.delete_admin("a9", quien_borra) == {"success": True}
    assert await mundo.g["admin_users"].find_one({"id": "a9"}) is None and mundo.g["admin_tombstones"].docs[0]["username"] == "oficina@x.es"
    assert _mercadillo_de(mundo, CLAVES["oficina"]) == VACIO
    assert _mercadillo_de(mundo, "a:empresa:a8") == entero                   # su compañera, entera
    # En la cuenta de quien reparte por su cuenta el mercadillo es DE LA CUENTA («o:…»), que sigue viva con quien queda:
    # borrar a su otro usuario no lo toca.
    assert await server.delete_admin("a2", {**quien_borra, "org_id": "o1"}) == {"success": True}
    assert _mercadillo_de(mundo, CLAVES["pepe"]) == entero and "Cosa 2" in await _titulos(LUIS)
    # Un usuario de la base por defecto (sin empresa) nunca entró al mercadillo: no hay nada que cerrar.
    cerrados = []

    async def apuntar(clave):
        cerrados.append(clave)
    monkeypatch.setattr(server, "_merc_baja", apuntar)
    assert await server.delete_admin("v1", {"sub": "jefa", "role": "admin", "name": "Jefa", "sa": True}) == {"success": True}
    assert cerrados == []
    # SI EL MERCADILLO FALLA, el usuario se borra igual.
    monkeypatch.setattr(server, "_merc_baja", _roto)
    assert await server.delete_admin("a8", quien_borra) == {"success": True}
    assert await mundo.g["admin_users"].find_one({"id": "a8"}) is None and _mercadillo_de(mundo, "a:empresa:a8") == entero
