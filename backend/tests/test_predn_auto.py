# -*- coding: utf-8 -*-
"""La pre-DNR que se pregunta sola y se contesta sola.

QUE HAY QUE VIGILAR, porque aqui un fallo no es un 500: es un WhatsApp a quien no
es, o una declaracion a Amazon que nadie ha hecho.

  · SOLO el movil personal. El de la ficha puede ser el de la ruta y el de Cortex
    es el del dia (gotchas 57 y 66): un enlace con los datos de un paquete no se
    manda a un numero que puede ser de otra persona.
  · TODO EMPIEZA APAGADO, y una nave nueva tambien. Un cliente futuro no hereda
    el automatismo de otro.
  · «No me acuerdo» NO sale a Amazon. Es la unica opcion que no es una declaracion.
  · El enlace se cierra al contestar, y dos toques a la vez no dejan la segunda
    respuesta encima de la primera.
  · El aviso no sale dos veces (cerrojo atomico), y el correo a Amazon lo monta UN
    solo codigo, el mismo que usa el boton de la oficina.

Las funciones se sacan del propio `server.py` (gotcha 40): una copia deja de
probar el codigo que corre en cuanto alguien toca el original.
"""
import ast
import asyncio
import io
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))
import whatsapp  # noqa: E402

SERVER = RAIZ / "server.py"
_TEXTO = io.open(SERVER, encoding="utf-8-sig").read()
_ARBOL = ast.parse(_TEXTO)


def _fuente(nombre):
    for n in ast.walk(_ARBOL):
        if isinstance(n, (ast.AsyncFunctionDef, ast.FunctionDef)) and n.name == nombre:
            return chr(10).join(_TEXTO.splitlines()[n.lineno - 1:n.end_lineno])
    raise AssertionError("no existe %s en server.py" % nombre)


def _constante(nombre):
    for n in _ARBOL.body:
        if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") == nombre:
            return ast.literal_eval(n.value)
    raise AssertionError("no existe %s en server.py" % nombre)


def _cargar(*nombres):
    amb = {"whatsapp": whatsapp, "_centro_norm": lambda c: (c or "").strip().upper()}
    for n in _ARBOL.body:
        if isinstance(n, ast.FunctionDef) and n.name in nombres:
            exec(compile(ast.fix_missing_locations(ast.Module(body=[n], type_ignores=[])),  # noqa: S102
                         "<server>", "exec"), amb)
    faltan = [x for x in nombres if x not in amb]
    assert not faltan, "no se han cargado: %s" % faltan
    return [amb[x] for x in nombres]


(_destino, _nave_activa, _parametros, _valida) = _cargar(
    "_predn_destino", "_predn_nave_activa", "_predn_parametros", "_dnr_valida_opcion")


# ── A QUIEN SE LE MANDA ─────────────────────────────────────────────────────

def _ctx(**kw):
    base = {"en_cortex": True, "conductor": "SERGIO LUIS ROJAS PEREZ",
            "telefono": "612345678", "movil_personal": None, "opt_in": None,
            "dia": "2026-09-17", "ruta": "XA_C18"}
    base.update(kw)
    return base


def test_solo_manda_al_movil_personal_nunca_al_de_la_ficha():
    """Con telefono de ficha pero SIN movil personal no se manda nada."""
    movil, motivo = _destino(_ctx())
    assert movil == "" and motivo == "sin_movil_personal"


def test_con_movil_personal_sale_en_formato_meta():
    movil, motivo = _destino(_ctx(movil_personal="+34 626 92 51 99"))
    assert (movil, motivo) == ("34626925199", "")
    # Y sin prefijo tambien: 9 cifras es un movil espanol.
    assert _destino(_ctx(movil_personal="626925199"))[0] == "34626925199"


def test_quien_apago_el_whatsapp_no_lo_recibe():
    movil, motivo = _destino(_ctx(movil_personal="626925199", opt_in=False))
    assert movil == "" and motivo == "sin_permiso"
    # None = no se ha decidido = SI (igual que con el resto de avisos).
    assert _destino(_ctx(movil_personal="626925199", opt_in=None))[0]


def test_un_paquete_que_cortex_ya_no_tiene_no_se_avisa_a_ciegas():
    assert _destino({"en_cortex": False})[1] == "sin_conductor"
    assert _destino(_ctx(conductor=None))[1] == "sin_conductor"


def test_un_movil_mal_escrito_no_pasa():
    assert _destino(_ctx(movil_personal="12345"))[1] == "sin_movil_personal"


# ── LAS NAVES: APAGADO DE ENTRADA ───────────────────────────────────────────

def test_ninguna_nave_esta_encendida_por_defecto():
    assert _nave_activa({}, "OGA5") is False
    assert _nave_activa({"predn_centros": {}}, "DGA1") is False


def test_solo_las_naves_encendidas_cuentan():
    cfg = {"predn_centros": {"OGA5": True, "DGA1": False}}
    assert _nave_activa(cfg, "OGA5") is True
    assert _nave_activa(cfg, "DGA1") is False
    assert _nave_activa(cfg, "DGA2") is False      # nunca se ha tocado: apagada
    assert _nave_activa(cfg, "") is False


def test_el_centro_llega_sucio_y_sigue_acertando():
    """`center` esta guardado como 'OGA5 ' o 'oga5' (gotcha 6)."""
    cfg = {"predn_centros": {"OGA5": True}}
    assert _nave_activa(cfg, "oga5") is True
    assert _nave_activa(cfg, "OGA5 ") is True


def test_la_configuracion_nace_toda_apagada():
    class _Col:
        async def find_one(self, *a, **k):
            return None

    class _Db:
        def __getitem__(self, _):
            return _Col()

    c = asyncio.run(whatsapp.config(_Db()))
    assert c["avisar_predn"] is False
    assert c["dnr_auto_amazon"] is False
    assert c["predn_centros"] == {}
    assert c["plantilla_predn"] == "pre_dnr"


# ── EL TEXTO QUE RECIBE EL CONDUCTOR ────────────────────────────────────────

def test_las_variables_de_la_plantilla_nunca_van_vacias():
    """Meta rechaza la plantilla ENTERA con un parametro en blanco."""
    p = _parametros({}, _ctx(ruta=None, conductor=None), "https://x/dnr/t/abc")
    assert len(p) == 4 and all(str(x).strip() for x in p)
    assert p[3] == "https://x/dnr/t/abc"


def test_el_dia_va_como_dia_y_mes():
    assert _parametros({}, _ctx(), "u")[1] == "17/09"


def test_el_nombre_va_con_la_primera_letra_en_mayuscula():
    assert _parametros({}, _ctx(), "u")[0] == "Sergio"


def _plantilla():
    for pl in whatsapp.PLANTILLAS_BASE:
        if pl["name"] == "pre_dnr":
            return pl
    raise AssertionError("falta la plantilla pre_dnr")


def test_la_plantilla_cumple_lo_que_exige_meta():
    """Sin variable al principio ni al final, cuatro ejemplos, y de utilidad."""
    pl = _plantilla()
    texto = pl["components"][0]["text"]
    assert pl["category"] == "UTILITY" and pl["language"] == "es"
    assert not texto.lstrip().startswith("{{")
    assert not texto.rstrip().endswith("}}")
    assert len(re.findall(r"\{\{\d+\}\}", texto)) == 4
    assert len(pl["components"][0]["example"]["body_text"][0]) == 4


def test_la_plantilla_deja_claro_lo_del_bono_y_no_lleva_direccion():
    texto = _plantilla()["components"][0]["text"].lower()
    assert "bono" in texto and "contest" in texto
    # La direccion de un cliente de Amazon se ve detras del enlace, no aqui.
    assert "direcci" not in texto and "calle" not in texto


def test_el_texto_renderizado_sustituye_las_cuatro_variables():
    t = whatsapp.render_plantilla("pre_dnr", ["Carlos", "17/09", "XA_C18", "https://x/1"])
    assert "{{" not in t and "Carlos" in t and "https://x/1" in t


# ── EL ENLACE SE CIERRA AL CONTESTAR ────────────────────────────────────────

def test_se_contesta_una_sola_vez():
    src = _fuente("dnr_publico_responder")
    assert "409" in src and "Ya has contestado" in src
    # Y condicionado en la base: dos toques a la vez no dejan la segunda encima.
    assert '"respuesta_conductor": {"$exists": False}' in src
    assert "matched_count" in src


def test_la_pagina_recibe_el_estado_para_pintar_el_ya_has_contestado():
    src = _fuente("dnr_publico")
    for estado in ("contestada", "cerrada", "caducada", "abierta"):
        assert '"%s"' % estado in src


# ── LO QUE NO SE MANDA A AMAZON ─────────────────────────────────────────────

def test_no_me_acuerdo_no_es_una_declaracion():
    filas = {f[0]: f for f in _constante("_DNR_LO_QUE_DIJO")}
    assert filas["nose"][2] == "", "«No me acuerdo» no puede llevar tipo de entrega"


def test_a_amazon_solo_sale_lo_que_tiene_tipo_de_entrega():
    src = _fuente("procesar_respuestas_a_amazon")
    assert '"respuesta_conductor.completion": {"$exists": True, "$nin": ["", None]}' in src


def test_lo_que_ya_se_envio_o_ya_esta_contestado_no_se_reenvia():
    src = _fuente("procesar_respuestas_a_amazon")
    assert '"enviada_en": {"$exists": False}' in src
    assert '"contestada": {"$ne": True}' in src
    assert '"cerrada_en": {"$exists": False}' in src


def test_pasado_el_plazo_no_se_manda():
    """A las 24 h la pagina de Amazon pone una X: se queda para la oficina."""
    assert '{"vence": {"$gte": ahora}}' in _fuente("procesar_respuestas_a_amazon")
    assert '{"vence": {"$gte": ahora}}' in _fuente("procesar_predns_automaticas")


def test_una_opcion_que_amazon_no_reconoce_se_aparta_sin_tumbar_el_lote():
    src = _fuente("procesar_respuestas_a_amazon")
    assert "_dnr_valida_opcion" in src and "descartadas" in src


def test_la_validacion_usa_el_catalogo_real():
    op = json.load(io.open(RAIZ / "datos" / "dnr_opciones.json", encoding="utf-8"))
    comp = next(iter(op["completion"]))
    loc = next(iter(op["location"].get(comp) or {}), "")
    assert _valida(op, comp, loc, "", "") == ""
    assert _valida(op, "NO_EXISTE", "", "", "")
    if loc:
        assert _valida(op, comp, "TAMBIEN_NO_EXISTE", "", "")


# ── QUE NO SALGA DOS VECES, Y QUE HAYA UN SOLO CORREO ───────────────────────

def test_el_aviso_toma_el_cerrojo_antes_de_enviar():
    src = _fuente("procesar_predns_automaticas")
    cerrojo = src.index('"wa_predn": {"$exists": False}')
    envio = src.index("whatsapp.enviar_plantilla")
    assert cerrojo < envio and src.index("matched_count") < envio


def test_un_aviso_fallido_se_reintenta_pero_con_limite():
    src = _fuente("procesar_predns_automaticas")
    assert "_PREDN_INTENTOS" in src and '"wa_predn.estado": "fallo"' in src
    assert _constante("_PREDN_INTENTOS") == 3


def test_un_solo_codigo_monta_el_correo_a_amazon():
    """El boton de la oficina y el automatico pasan por la MISMA funcion."""
    assert "_dnr_enviar_lote" in _fuente("dnr_enviar")
    auto = _fuente("procesar_respuestas_a_amazon")
    assert "_dnr_enviar_lote" in auto and "_enviar_email" not in auto


def test_la_pre_dnr_se_pregunta_con_el_mismo_enlace_que_el_boton():
    assert "_dnr_enlace" in _fuente("dnr_preguntar")
    assert "_dnr_enlace" in _fuente("procesar_predns_automaticas")


def test_el_bucle_deja_latido_y_esta_arrancado():
    assert '_latido("dnr_auto"' in _fuente("_bucle_dnr_auto")
    assert "_bucle_dnr_auto()" in _fuente("start_itv_whatsapp_scheduler")


# ── EL MOVIL PERSONAL DE LA FICHA ───────────────────────────────────────────

def test_el_movil_personal_llega_hasta_la_ficha():
    """En el modelo Y en la whitelist, o se descarta en silencio (gotcha 1)."""
    assert "movil_personal" in _fuente("update_driver")
    assert "whatsapp.normaliza_telefono" in _fuente("update_driver")
    assert re.search(r"class Driver\(BaseModel\):.*?movil_personal", _TEXTO, re.S)
    assert re.search(r"class DriverCreate\(BaseModel\):.*?movil_personal", _TEXTO, re.S)


def test_cada_nave_se_guarda_sola():
    """Un `$set` por clave: dos personas tocando dos naves no se pisan."""
    assert 'predn_centros.%s' in _fuente("whatsapp_guardar_config")


# ── LA PRUEBA EN TU MOVIL: NUNCA LLEGA A AMAZON NI SE VE EN LAS LISTAS ─────

def test_una_prueba_se_rechaza_antes_de_montar_nada_para_amazon():
    """`dnr_responder` es la puerta del boton Y del envio automatico."""
    f = _fuente("dnr_responder")
    assert 'doc.get("prueba")' in f
    assert f.index('doc.get("prueba")') < f.index("_dnr_valida_opcion")
    # El envio por correo pasa por ella: no hay otro camino a `_enviar_email`.
    assert "dnr_responder(" in _fuente("_dnr_enviar_lote")


def test_todo_lector_de_investigaciones_deja_fuera_las_de_prueba():
    """Listas, contadores, naves, ingesta y los dos procesos automaticos."""
    for nombre in ("_dnr_naves", "dnr_contar_pendientes", "dnr_investigaciones",
                   "procesar_predns_automaticas", "procesar_respuestas_a_amazon"):
        assert '"prueba": {"$ne": True}' in _fuente(nombre), nombre
    # La ingesta no puede dar por cerrada una prueba (el informe nunca la trae).
    assert re.search(r'cerradas = await db\[_DNR_COL\]\.update_many\(.*?"prueba": \{"\$ne": True\}',
                     _TEXTO, re.S)


def test_la_prueba_se_marca_y_no_se_sirve_con_datos_de_cortex():
    f = _fuente("dnr_probar")
    assert '"prueba": True' in f and "PRUEBA-" in f
    assert "require_admin" in f
    # El enlace sale del mismo sitio que el de verdad: es lo que se prueba.
    assert "_dnr_enlace" in f and "plantilla_predn" in f
    # La pagina publica no busca el paquete inventado en Cortex.
    assert "_dnr_ctx_prueba()" in _fuente("dnr_publico")


def test_el_contexto_de_prueba_lleva_lo_que_pinta_la_pagina():
    (ctx_prueba,) = _cargar_ctx()
    c = ctx_prueba()
    for k in ("dia", "ruta", "direccion", "dest", "escaneo", "metros"):
        assert c.get(k), k
    assert set(c["dest"]) == {"lat", "lng"} and set(c["escaneo"]) == {"lat", "lng"}


def _cargar_ctx():
    amb = {"_dia_negocio": lambda: "2026-09-19"}
    for n in _ARBOL.body:
        if isinstance(n, ast.FunctionDef) and n.name == "_dnr_ctx_prueba":
            exec(compile(ast.fix_missing_locations(ast.Module(body=[n], type_ignores=[])),  # noqa: S102
                         "<server>", "exec"), amb)
    return [amb["_dnr_ctx_prueba"]]
