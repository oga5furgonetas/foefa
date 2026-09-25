# -*- coding: utf-8 -*-
"""Los avisos que Meta no entrega no se pierden: salen a mano por `wa.me`.

POR QUE EXISTE ESTO. El 20-09-2026 Meta contesto, preguntandole por la salud
del numero de FlotaDSP, `can_send_message: LIMITED` con el error 141010 («The
Business has not passed business verification»). El numero esta CONNECTED, la
calidad GREEN y la plantilla aprobada: lo que falta es la verificacion de la
empresa, que no se arregla desde el codigo ni en un dia.

Hasta que eso se resuelva, cada ITV vencida y cada pre-DNR se apuntaba en
`whatsapp_envios` con su error y moria ahi. Lo que se protege aqui es la salida
de emergencia: que esos avisos aparezcan en pantalla con el texto ya escrito y
un enlace `wa.me` —publico, sin API, sin nada que verificar— para mandarlos a
mano.

Funciones REALES de `server.py`, sacadas con `ast` (gotcha 40).
"""
import ast
import asyncio
import io
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote as _url_quote

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

_TEXTO = io.open(RAIZ / "server.py", encoding="utf-8-sig").read()
_ARBOL = ast.parse(_TEXTO)
_FUNCS = ("wa_pendientes", "wa_pendientes_hecho", "_texto_cuerpo", "_lista_cuerpo",
          "_wa_ultimos9", "enlace_wa")


class _ErrorHTTP(Exception):
    def __init__(self, codigo, detalle=""):
        self.status_code, self.detail = codigo, detalle
        super().__init__(detalle)


class _WhatsAppFalso:
    COLECCION_ENVIOS = "whatsapp_envios"
    QUE_HACER_ENTREGA = {"Business eligibility payment issue": "verificar la empresa"}


def _cargar(docs):
    """El endpoint de verdad, con una base de datos de mentira debajo."""
    visto = {}

    class _Cursor:
        def sort(self, *a, **k):
            return self

        async def to_list(self, _n):
            return list(docs)

    class _Col:
        def find(self, filtro, *a, **k):
            visto["filtro"] = filtro
            return _Cursor()

        async def update_many(self, filtro, cambio):
            visto["update"] = (filtro, cambio)

            class _R:
                modified_count = len(filtro.get("_id", {}).get("$in", []))
            return _R()

    class _Db:
        def __getitem__(self, _):
            return _Col()

    async def _personas(_):
        return {"617993913": {"nombre": "Dani", "tipo": "admin"}}

    amb = {"datetime": datetime, "timedelta": timedelta, "timezone": timezone,
           "db": _Db(), "whatsapp": _WhatsAppFalso(), "_wa_personas": _personas,
           "HTTPException": _ErrorHTTP, "PREFIJO_WA_DEFECTO": "34",
           "_url_quote": _url_quote, "Depends": lambda f: None,
           "require_admin": None, "api_router": None}
    for n in _ARBOL.body:
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name in _FUNCS:
            n = ast.parse(ast.unparse(n)).body[0]
            n.decorator_list = []          # el `@api_router.get` no pinta aqui
            mod = ast.fix_missing_locations(ast.Module(body=[n], type_ignores=[]))
            exec(compile(mod, "<server>", "exec"), amb)                    # noqa: S102
    faltan = [x for x in _FUNCS if x not in amb]
    assert not faltan, "no se han cargado: %s" % faltan
    return amb, visto


_UNO = {"_id": "a1", "at": "2026-09-20T18:58:49", "telefono": "34617993913",
        "texto": "La furgoneta 0000ABC tiene la ITV vencida.", "ok": True,
        "estado": "failed", "estado_error": "Business eligibility payment issue",
        "plantilla": "itv_vencida", "motivo": "itv"}


# ── QUE SALGA LO QUE NO LLEGO ───────────────────────────────────────────────

def test_un_aviso_caido_sale_con_su_enlace_a_mano():
    amb, _ = _cargar([_UNO])
    r = asyncio.run(amb["wa_pendientes"]())
    assert r["total"] == 1
    g = r["pendientes"][0]
    assert g["nombre"] == "Dani"
    assert g["clase"] == "no_entregado"
    assert g["fallo"] == "Business eligibility payment issue"
    assert g["que_hacer"] == "verificar la empresa"
    # El enlace lleva el texto YA ESCRITO: sin eso hay que copiarlo a mano, que
    # es justo lo que no se hace un martes con cuarenta rutas fuera.
    assert g["enlace"].startswith("https://wa.me/34617993913?text=")
    assert "ITV" in g["enlace"]


def test_lo_que_rechaza_la_api_y_lo_que_no_entrega_meta_se_distinguen():
    """Se arreglan de formas distintas: uno es nuestro, el otro es de Meta."""
    rechazado = {**_UNO, "_id": "b1", "ok": False, "estado": None,
                 "error": "(#132001) Template name does not exist",
                 "texto": "otro aviso"}
    amb, _ = _cargar([rechazado])
    g = asyncio.run(amb["wa_pendientes"]())["pendientes"][0]
    assert g["clase"] == "rechazado"
    assert "132001" in g["fallo"]


def test_el_mismo_aviso_reintentado_es_UNA_cosa_que_hacer():
    """41 renglones iguales no son una lista: son ruido, y no se mira."""
    docs = [{**_UNO, "_id": "a%d" % i} for i in range(5)]
    amb, _ = _cargar(docs)
    r = asyncio.run(amb["wa_pendientes"]())
    assert r["total"] == 1 and r["envios"] == 5
    g = r["pendientes"][0]
    assert g["veces"] == 5
    # Los cinco ids viajan juntos: «ya lo mande» tiene que vaciar el grupo
    # entero, no dejar cuatro copias detras.
    assert len(g["ids"]) == 5


def test_dos_personas_distintas_no_se_juntan():
    otro = {**_UNO, "_id": "c1", "telefono": "34606712480"}
    amb, _ = _cargar([_UNO, otro])
    r = asyncio.run(amb["wa_pendientes"]())
    assert r["total"] == 2
    assert {g["telefono"] for g in r["pendientes"]} == {"34617993913", "34606712480"}


def test_sin_texto_no_hay_nada_que_mandar():
    """Un `wa.me` vacio abre un chat en blanco: peor que no ofrecer el enlace."""
    amb, _ = _cargar([{**_UNO, "texto": ""}, {**_UNO, "_id": "z", "texto": None}])
    assert asyncio.run(amb["wa_pendientes"]())["total"] == 0


def test_sin_telefono_tampoco():
    amb, _ = _cargar([{**_UNO, "telefono": ""}])
    assert asyncio.run(amb["wa_pendientes"]())["total"] == 0


# ── QUE LA LISTA SE VACIE ───────────────────────────────────────────────────

def test_la_consulta_deja_fuera_los_ya_mandados_a_mano():
    """Una lista que no se vacia se deja de mirar."""
    amb, visto = _cargar([_UNO])
    asyncio.run(amb["wa_pendientes"]())
    f = visto["filtro"]
    assert f["a_mano"] == {"$ne": True}
    assert {"ok": False} in f["$or"] and {"estado": "failed"} in f["$or"]
    assert "$gte" in f["at"]


def test_marcar_a_mano_no_borra_el_envio():
    """Queda el registro de que fallo y de que se resolvio a mano."""
    amb, visto = _cargar([])
    r = asyncio.run(amb["wa_pendientes_hecho"](
        {"ids": ["64b7f3a1c2d4e5f6a7b8c9d0"]}, {"username": "dani"}))
    assert r["ok"] is True
    _filtro, cambio = visto["update"]
    assert "$set" in cambio and "$unset" not in cambio
    assert cambio["$set"]["a_mano"] is True
    assert cambio["$set"]["a_mano_por"] == "dani"


def test_ids_que_no_son_ids_no_tumban_nada():
    amb, _ = _cargar([])
    for malo in ({"ids": "64b7f3a1c2d4e5f6a7b8c9d0"}, {"ids": ["no-soy-un-id"]},
                 {"ids": []}, {"ids": None}, {}):
        try:
            asyncio.run(amb["wa_pendientes_hecho"](malo, {}))
            raise AssertionError("deberia haber contestado 400 con %r" % (malo,))
        except _ErrorHTTP as e:
            assert e.status_code == 400


# ── QUE EL PANEL LO ENSEÑE ──────────────────────────────────────────────────

def test_el_estado_cuenta_los_que_esperan_a_mano():
    assert re.search(r'"pendientes_a_mano": pendientes', _TEXTO)
    assert re.search(r"pendientes = await col\.count_documents\(", _TEXTO)


def test_la_pantalla_los_ensena():
    jsx = io.open(RAIZ.parent / "frontend-v2/src/panel/pages/Configuracion.jsx",
                  encoding="utf-8").read()
    assert "AvisosSinSalir" in jsx
    assert "n={est.pendientes_a_mano || 0}" in jsx
    # Pestana nueva sin poder tocar esta, y sin decirle a Meta de donde venimos.
    assert 'rel="noopener noreferrer"' in jsx
