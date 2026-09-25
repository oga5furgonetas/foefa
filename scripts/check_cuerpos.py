# -*- coding: utf-8 -*-
"""El cuerpo de una peticion no se lee a pelo.

POR QUE EXISTE
══════════════════════════════════════════════════════════════════════════════
Lo que llega de un cliente viejo, de un formulario a medio migrar o de alguien
probando no es un cuerpo vacio: es un campo con el TIPO cambiado. Una lista
donde se espera texto, un booleano donde se espera un codigo.

    for x in (data.get("y") or []):   correcto con lista, 500 con un booleano
    (data.get("z") or {}).items()     correcto con objeto, 500 con un numero
    data.get("w", [])                 el defecto solo entra si el campo NO viene

Y un 500 no es solo un codigo feo: dispara la alerta de Telegram por un dato
mal escrito, y al usuario le sale «Error interno del servidor» en vez del 400
que explica que falta.

Medido contra staging el 20-09-2026 con `backend/scripts/smoke_cuerpos_raros.py`
—que manda a cada mutacion SUS PROPIOS campos con el tipo cambiado—: **31 de
288 endpoints devolvian 5xx**. Se arreglaron metiendo los tres ayudantes
(`_texto_cuerpo`, `_lista_cuerpo`, `_dict_cuerpo`), y esto existe para que no
vuelvan: el smoke necesita staging desplegado y una clave, asi que no corre en
cada commit. Este checker si.

POR QUE CON `ast` Y NO CON UNA EXPRESION REGULAR
══════════════════════════════════════════════════════════════════════════════
La primera version buscaba `data.get(...)` por texto y dio **nueve avisos, los
nueve en falso**: ese `data` era la respuesta JSON de Gemini o del servicio de
IA (`data = json.loads(resp.text)`), no el cuerpo de nadie. Un checker que
grita en falso deja de leerse — es como se colo el cuarto ObjectId del gotcha
42 — asi que ahora se mira SOLO dentro de funciones que son endpoints y SOLO
la variable que lleva el cuerpo de verdad, declarada en su firma.

QUE MIRA, Y POR QUE SOLO ESO
══════════════════════════════════════════════════════════════════════════════
Las formas que revientan: recorrer algo que puede no ser una lista, o pedirle
`.get`/`.items` a algo que puede no ser un objeto. `or ""` no entra a
proposito: `str(x)` lo salva casi siempre y meterlo daria decenas de avisos
que nadie leeria.

Probado en los dos sentidos, que es la unica forma de saber que mira de
verdad: con el arbol limpio calla, y reintroduciendo `for x in (data.get("y")
or [])` da su aviso.

Uso:  python scripts/check_cuerpos.py
"""
import ast
import io
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUENTE = os.path.join(RAIZ, "backend", "server.py")
ROUTERS = ("api_router", "app", "auth_router")
METODOS = ("post", "put", "patch", "delete", "get")


def es_endpoint(fn):
    for d in fn.decorator_list:
        f = d.func if isinstance(d, ast.Call) else d
        if (getattr(f, "attr", "") in METODOS
                and getattr(getattr(f, "value", None), "id", "") in ROUTERS):
            return True
    return False


def vars_de_cuerpo(fn):
    """Los parametros que llevan el cuerpo: `data: dict`, `body: dict = Body(...)`.

    Se exige el nombre Y que sea un `dict`: asi un `data` que sea otra cosa
    —un modelo de Pydantic, que ya valida solo— no entra aqui.
    """
    fuera = set()
    args = list(fn.args.args) + list(fn.args.kwonlyargs)
    for a in args:
        if a.arg not in ("data", "body"):
            continue
        an = a.annotation
        if isinstance(an, ast.Name) and an.id == "dict":
            fuera.add(a.arg)
    return fuera


def _es_get_de(nodo, nombres):
    return (isinstance(nodo, ast.Call)
            and isinstance(nodo.func, ast.Attribute) and nodo.func.attr == "get"
            and isinstance(nodo.func.value, ast.Name) and nodo.func.value.id in nombres)


def revisa(fn, nombres):
    avisos = []
    for n in ast.walk(fn):
        # `data.get("x", [])` / `data.get("x", {})`
        if _es_get_de(n, nombres) and len(n.args) > 1 and isinstance(n.args[1], (ast.List, ast.Dict)):
            avisos.append((n.lineno, "el defecto de `.get` solo entra si el campo NO viene; "
                                     "usa _lista_cuerpo / _dict_cuerpo"))
        # `data.get("x") or []` / `or {}`
        if isinstance(n, ast.BoolOp) and isinstance(n.op, ast.Or):
            for i, v in enumerate(n.values[:-1]):
                sig = n.values[i + 1]
                if _es_get_de(v, nombres) and isinstance(sig, (ast.List, ast.Dict)):
                    cual = "_lista_cuerpo" if isinstance(sig, ast.List) else "_dict_cuerpo"
                    avisos.append((n.lineno, "`or %s` no salva de un booleano ni de un "
                                             "numero; usa %s"
                                             % ("[]" if isinstance(sig, ast.List) else "{}", cual)))
        # `for x in data.get("y")` sin pasar por el ayudante
        if isinstance(n, (ast.For, ast.AsyncFor)) and _es_get_de(n.iter, nombres):
            avisos.append((n.lineno, "recorre el cuerpo sin _lista_cuerpo"))
    return avisos


def main():
    if not os.path.exists(FUENTE):
        print("check_cuerpos: no encuentro backend/server.py")
        return 1
    arbol = ast.parse(io.open(FUENTE, encoding="utf-8-sig").read())
    avisos, endpoints = [], 0
    for n in ast.walk(arbol):
        if not isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) or not es_endpoint(n):
            continue
        nombres = vars_de_cuerpo(n)
        if not nombres:
            continue
        endpoints += 1
        for linea, motivo in revisa(n, nombres):
            avisos.append((linea, n.name, motivo))

    if not avisos:
        print("cuerpos OK: %d endpoints leen el cuerpo con sus ayudantes" % endpoints)
        return 0

    print("EL CUERPO SE LEE A PELO EN %d SITIO(S):" % len(avisos))
    print("")
    for linea, fn, motivo in sorted(set(avisos)):
        print("  backend/server.py:%d  (%s)" % (linea, fn))
        print("     -> %s" % motivo)
    print("")
    print("Los tres ayudantes son seguros por construccion: con datos buenos")
    print("devuelven exactamente lo mismo, y con datos raros devuelven vacio")
    print("para que la validacion de despues conteste su 400 con su mensaje.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
