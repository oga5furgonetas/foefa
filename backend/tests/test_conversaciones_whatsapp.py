# -*- coding: utf-8 -*-
"""Conversaciones de WhatsApp: lo que escriben y lo que se les manda.

Lo que se protege aqui:
  · que un mensaje caiga en la conversacion de SU empresa (el numero es unico
    para toda la plataforma y el webhook no lleva sesion: gotcha 26);
  · que un mensaje que Meta reenvia no salga repetido (indice unico por wamid);
  · que no se pueda mandar texto libre fuera de las 24 h (Meta lo rechaza y el
    boton, que se deja abierto toda la noche, lo intentaria);
  · que un «enviado» que luego falla no se quede diciendo «enviado».

Funciones REALES de `server.py`, sacadas con `ast` (gotcha 40).
"""
import ast
import io
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

_TEXTO = io.open(RAIZ / "server.py", encoding="utf-8-sig").read()
_ARBOL = ast.parse(_TEXTO)
_NOMBRES = ("_wa_ultimos9", "_wa_iso", "_wa_mensajes_del_webhook", "_wa_estados_del_webhook",
            "_wa_ventana", "_wa_estado_visible")
_CONSTANTES = ("_WA_VENTANA_H", "_WA_RANGO_ESTADO", "_WA_TIPOS_ADJUNTO")


def _cargar():
    amb = {"datetime": datetime, "timedelta": timedelta, "timezone": timezone}
    for n in _ARBOL.body:
        if (isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") in _CONSTANTES) or \
                (isinstance(n, ast.FunctionDef) and n.name in _NOMBRES):
            exec(compile(ast.fix_missing_locations(ast.Module(body=[n], type_ignores=[])),  # noqa: S102
                         "<server>", "exec"), amb)
    faltan = [x for x in _NOMBRES + _CONSTANTES if x not in amb]
    assert not faltan, "no se han cargado: %s" % faltan
    return amb


A = _cargar()
mensajes, estados, ventana, ultimos9, visible = (
    A["_wa_mensajes_del_webhook"], A["_wa_estados_del_webhook"], A["_wa_ventana"],
    A["_wa_ultimos9"], A["_wa_estado_visible"])


def _fuente(nombre):
    for n in ast.walk(_ARBOL):
        if isinstance(n, (ast.AsyncFunctionDef, ast.FunctionDef)) and n.name == nombre:
            return "\n".join(_TEXTO.splitlines()[n.lineno - 1:n.end_lineno])
    raise AssertionError("no existe %s" % nombre)


def _hook(mensajes=None, statuses=None, contactos=None):
    val = {}
    if mensajes is not None:
        val["messages"] = mensajes
    if statuses is not None:
        val["statuses"] = statuses
    if contactos is not None:
        val["contacts"] = contactos
    return {"entry": [{"changes": [{"value": val}]}]}


# ── Leer el webhook ─────────────────────────────────────────────────────────

def test_un_texto_normal():
    (m,) = mensajes(_hook([{"from": "34639448263", "id": "wamid.A", "timestamp": "1789819200",
                            "type": "text", "text": {"body": " no me acuerdo "}}],
                          contactos=[{"wa_id": "34639448263", "profile": {"name": "Sergio"}}]))
    assert m["telefono"] == "34639448263" and m["texto"] == "no me acuerdo"
    assert m["wamid"] == "wamid.A" and m["perfil"] == "Sergio" and m["at"].startswith("2026-")


def test_una_foto_se_apunta_aunque_no_se_descargue():
    """Un hilo que se salta lo que la persona mando parece que no contesto."""
    ms = mensajes(_hook([
        {"from": "34600000001", "id": "1", "timestamp": "1", "type": "image", "image": {"caption": "el golpe"}},
        {"from": "34600000001", "id": "2", "timestamp": "1", "type": "voice", "voice": {}},
        {"from": "34600000001", "id": "3", "timestamp": "1", "type": "location",
         "location": {"latitude": 42.8, "longitude": -8.5}},
        {"from": "34600000001", "id": "4", "timestamp": "1", "type": "reaction", "reaction": {}}]))
    assert [m["texto"] for m in ms] == ["[imagen] el golpe", "[nota de voz]", "[ubicación] 42.8,-8.5", "[reaction]"]


def test_respuesta_de_boton_toma_el_titulo():
    (m,) = mensajes(_hook([{"from": "34600000001", "id": "1", "timestamp": "1", "type": "interactive",
                            "interactive": {"button_reply": {"title": "Sí"}}}]))
    assert m["texto"] == "Sí"


def test_un_webhook_de_acuses_no_trae_mensajes_ni_revienta_con_basura():
    assert mensajes(_hook(statuses=[{"id": "x", "status": "sent"}])) == []
    assert mensajes({}) == [] and mensajes(None) == []
    assert mensajes(_hook(["basura", None, {"type": "text"}])) == []      # sin `from`


def test_los_acuses_se_leen_y_lo_desconocido_se_ignora():
    e = estados(_hook(statuses=[
        {"id": "w1", "status": "delivered", "timestamp": "1789819200"},
        {"id": "w2", "status": "failed", "timestamp": "1789819200",
         "errors": [{"code": 131026, "title": "Message undeliverable"}]},
        {"id": "w3", "status": "raro"}, {"status": "read"}]))
    assert [(x["id"], x["estado"]) for x in e] == [("w1", "delivered"), ("w2", "failed")]
    assert e[1]["error"] == "Message undeliverable" and e[0]["error"] == ""


def test_el_orden_de_los_acuses_solo_sube():
    r = A["_WA_RANGO_ESTADO"]
    assert r["sent"] < r["delivered"] < r["read"] < r["failed"]


# ── La ventana de 24 h ──────────────────────────────────────────────────────

AHORA = datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc)


def _hace(h):
    return (AHORA - timedelta(hours=h)).isoformat()


def test_la_ventana_esta_abierta_dentro_de_las_24_h():
    v = ventana([_hace(3)], AHORA)
    assert v["abierta"] and v["cierra_en"].startswith("2026-09-20T09:00")


def test_la_ventana_se_cierra_pasadas_las_24_h_y_sin_mensajes():
    assert not ventana([_hace(25)], AHORA)["abierta"]
    assert not ventana([], AHORA)["abierta"]
    assert not ventana([None, ""], AHORA)["abierta"]


def test_cuenta_el_ultimo_mensaje_de_ella_no_el_primero():
    assert ventana([_hace(30), _hace(2)], AHORA)["abierta"]


# ── Lo que se ve de un mensaje nuestro ──────────────────────────────────────

def test_un_enviado_que_fallo_no_se_enseña_como_enviado():
    assert visible({"ok": False, "error": "x"}) == "fallido"
    assert visible({"ok": True}) == "enviado"
    assert visible({"ok": True, "estado": "read"}) == "read"
    # Meta dijo «enviado» y luego «fallido»: el aviso del acuse manda.
    assert visible({"ok": True, "estado": "failed"}) == "failed"


def test_los_ultimos_9_igualan_las_seis_formas_de_escribir_un_numero():
    assert len({ultimos9(x) for x in ("639448263", "+34 639 44 82 63", "0034639448263",
                                       "34639448263")}) == 1


# ── El cableado ─────────────────────────────────────────────────────────────

def test_el_mensaje_va_a_la_empresa_de_quien_empezo_la_conversacion():
    f = _fuente("_wa_tenant_de_telefono")
    # 1) a quien se le mando; 2) solo si nadie, la ficha. Ese orden.
    assert f.index("COLECCION_ENVIOS") < f.index("_wa_personas")
    assert "set_current_org_db(base)" in _fuente("registrar_entrantes_whatsapp")


def test_sin_dueño_no_se_guarda_en_ninguna_empresa():
    """Lo que no encaja en ninguna empresa se queda para el flujo de talleres
    (`whatsapp_sin_asignar`): guardarlo en la principal por defecto seria el
    gotcha 26."""
    f = _fuente("registrar_entrantes_whatsapp")
    assert re.search(r"if not base:\s+continue", f)


def test_un_reenvio_de_meta_no_duplica():
    f = _fuente("registrar_entrantes_whatsapp")
    assert "$setOnInsert" in f and "upsert=True" in f and "DuplicateKeyError" in f
    assert '_idx_unico(tdb[whatsapp.COLECCION_MENSAJES], "wamid")' in _TEXTO


def test_responder_comprueba_la_ventana_en_el_servidor_antes_de_enviar():
    f = _fuente("wa_responder")
    assert f.index("_wa_ventana(") < f.index("enviar_texto(")
    assert "409" in f and "require_admin" in f


def test_el_webhook_registra_la_conversacion_y_no_rompe_el_flujo_de_talleres():
    f = _fuente("whatsapp_webhook_recibir")
    assert f.index("registrar_entrantes_whatsapp") < f.index("procesar_entrante_taller")
    assert "aplicar_estados_whatsapp" in f
    # Cada parte en su propio try: Meta desactiva el webhook si no ve un 200.
    assert f.count("try:") >= 3 and f.rstrip().endswith('return {"ok": True}')
    assert "omitir=" in f and "_wa_ultimos9(tel) in omitir" in _fuente("procesar_entrante_taller")


def test_no_leidas_se_declara_antes_que_la_ruta_con_parametro():
    a = _TEXTO.index('@api_router.get("/whatsapp/conversaciones/no-leidas")')
    b = _TEXTO.index('@api_router.get("/whatsapp/conversaciones/{tel}")')
    assert a < b


def test_todas_las_rutas_de_conversaciones_son_de_admin():
    for n in ("wa_conv_no_leidas", "wa_conversaciones", "wa_conversacion",
              "wa_conv_leido", "wa_responder"):
        assert "require_admin" in _fuente(n), n


def test_leer_el_hilo_no_marca_nada_como_leido():
    """Un GET sin efectos: marcar leido es su propia llamada."""
    f = _fuente("wa_conversacion")
    assert "update_many" not in f and "update_one" not in f
