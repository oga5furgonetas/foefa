# -*- coding: utf-8 -*-
"""El mercadillo de repartidores (17-10-2026). Lo que se vigila, por orden de lo que más daño haría:
que nada salga sin que Dani lo apruebe; que esté oculto hasta que él lo encienda; que las fotos no lleven la
ubicación del móvil; que los mensajes solo los lean sus dos personas; que quien publica sepa por qué se le
rechaza o retira y quien denuncia reciba acuse y decisión (DSA); y que todo se borre a su tiempo.

Y bloquear a una persona (10-11-2026; Apple, guideline 1.2): que quien bloquea deje de ver al otro AL INSTANTE
y por todos los caminos (lista, ficha, foto, buzón, globito), que ninguno pueda escribir al otro, que al
bloqueado no se le diga nada, que desbloquear lo devuelva todo, que Dani se entere y que la clave de nadie
salga hacia la web."""
import ast
import inspect
import io as _io
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
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
    pendiente = await _anuncio(LUIS, "Botas", "20")                           # sin aprobar: Pepe no lo ve
    cid = (await server.merc_contactar(a["id"], {"texto": "hola"}, PEPE))["conversacion_id"]
    # Sin decir a quién, lo que no existe, lo que no ve, lo de otros, lo suyo: nada de eso bloquea a nadie.
    await _falla(server.merc_bloquear({}, PEPE), 400, "Falta a quién bloqueas")
    await _falla(server.merc_bloquear([], PEPE), 400, "Falta a quién bloqueas")
    # Un cuerpo con los tipos cambiados (una lista o un número donde va un id) no es un 500: no encuentra nada.
    for raro in ({"anuncio_id": ["x"]}, {"anuncio_id": {"a": 1}}, {"conversacion_id": 5}, {"conversacion_id": True}):
        await _falla(server.merc_bloquear(raro, PEPE), 404)
    await _falla(server.merc_desbloquear("../../no-es-un-id", PEPE), 404, "Ese bloqueo ya no está")
    await _falla(server.merc_bloquear({"anuncio_id": "no-existe"}, PEPE), 404, "Ese anuncio ya no está")
    await _falla(server.merc_bloquear({"anuncio_id": pendiente["id"]}, PEPE), 404, "Ese anuncio ya no está")
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


def _textos_de_error(*funciones) -> list:
    """Los textos que esas funciones de server.py le dan a la persona: el de cada HTTPException y el del cupo del día
    (los f-string, con «0» en cada hueco; `_MERC_CERRADA` y demás constantes, con su valor)."""
    arbol, fuera = ast.parse(Path(server.__file__).read_text(encoding="utf-8-sig")), []
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


def test_los_textos_del_bloqueo_se_leen_tambien_en_el_iphone():
    """Dentro de la app del iPhone la web cambia por un texto neutro («No se ha podido completar…») todo error del
    servidor que «hable de pagos» (`HABLA_DE_PAGOS` en frontend/src/lib/plataforma.js: plan, gratis, tope, bono,
    cartera…). Bloquear es justo lo que Apple va a mirar allí: ninguno de sus mensajes puede caer en esa red."""
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
