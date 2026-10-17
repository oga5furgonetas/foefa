# -*- coding: utf-8 -*-
"""El mercadillo de repartidores (17-10-2026). Lo que se vigila, por orden de lo que más daño haría:
que nada salga sin que Dani lo apruebe; que esté oculto hasta que él lo encienda; que las fotos no lleven la
ubicación del móvil; que los mensajes solo los lean sus dos personas; que quien publica sepa por qué se le
rechaza o retira y quien denuncia reciba acuse y decisión (DSA); y que todo se borre a su tiempo."""
import io as _io
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from PIL import Image

import mercadillo as mc
import server
from base_de_mentira import Col, Db

_CORREO_DE_REAL = server._merc_correo_de          # la de verdad (el fixture la simula)

DANI = {"sub": "dani", "role": "admin", "sa": True, "org_id": "owner", "name": "Dani"}
ANA = {"sub": "d1", "role": "driver", "org_id": "owner", "name": "ANA PÉREZ LÓPEZ"}          # conductora de OGA5
LUIS = {"sub": "d2", "role": "driver", "org_id": "owner", "name": "Luis Gómez"}
PEPE = {"sub": "a1", "role": "admin", "org_id": "o1", "name": "Pepe"}                        # autónomo
OFICINA = {"sub": "a9", "role": "admin", "org_id": "empresa", "name": "Oficina"}


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
