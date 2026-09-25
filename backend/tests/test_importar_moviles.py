# -*- coding: utf-8 -*-
"""Importar los moviles personales desde la agenda del telefono.

Lo que se protege aqui es que un movil NO acabe en la ficha de quien no es: no
se nota nunca —la ficha parece completa— y el dia que sale el WhatsApp de una
pre-DNR le llega a otra persona (gotchas 57 y 66). Por eso no se adivina: con
dos fichas posibles no se propone ninguna, y un numero que saldria en dos
personas se enseña aparte.

Y la otra regla: la agenda del que exporta trae a toda su familia, asi que el
fichero se lee y se descarta; nada de el se guarda.

Las funciones son las REALES de `server.py`, sacadas con `ast` sin ejecutar el
modulo (gotcha 40).
"""
import ast
import io
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))
import whatsapp  # noqa: E402

_TEXTO = io.open(RAIZ / "server.py", encoding="utf-8-sig").read()
_ARBOL = ast.parse(_TEXTO)

_NOMBRES = ("_vcf_lineas", "_vcf_valor", "_vcf_contactos", "_tabla_contactos",
            "_movil_de_contacto", "_moviles_propone", "_sin_tildes", "_clave_nombre",
            "_palabras_nombre", "_empareja_conductor")
_CONSTANTES = ("_MOV_COL_NOMBRE_COMPLETO", "_MOV_COL_NOMBRE_PARTE", "_RELLENO_NOMBRE")


def _cargar():
    amb = {"whatsapp": whatsapp, "re": re}
    for n in _ARBOL.body:
        if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") in _CONSTANTES:
            exec(compile(ast.fix_missing_locations(ast.Module(body=[n], type_ignores=[])),  # noqa: S102
                         "<server>", "exec"), amb)
        elif isinstance(n, ast.FunctionDef) and n.name in _NOMBRES:
            exec(compile(ast.fix_missing_locations(ast.Module(body=[n], type_ignores=[])),  # noqa: S102
                         "<server>", "exec"), amb)
    faltan = [x for x in _NOMBRES + _CONSTANTES if x not in amb]
    assert not faltan, "no se han cargado: %s" % faltan
    return amb


A = _cargar()
vcf, tabla, movil, propone = (A["_vcf_contactos"], A["_tabla_contactos"],
                              A["_movil_de_contacto"], A["_moviles_propone"])


def _fuente(nombre):
    for n in ast.walk(_ARBOL):
        if isinstance(n, (ast.AsyncFunctionDef, ast.FunctionDef)) and n.name == nombre:
            return "\n".join(_TEXTO.splitlines()[n.lineno - 1:n.end_lineno])
    raise AssertionError("no existe %s" % nombre)


# ── vCard ───────────────────────────────────────────────────────────────────

def test_vcf_normal():
    c = vcf("BEGIN:VCARD\nVERSION:3.0\nFN:Sergio Rojas\nTEL;TYPE=CELL:+34 639 44 82 63\nEND:VCARD\n")
    assert c == [{"nombre": "Sergio Rojas", "telefonos": ["+34 639 44 82 63"]}]


def test_vcf_android_viejo_con_quoted_printable():
    """`=C3=A9` es una e con tilde; y las lineas largas se parten con `=` al final."""
    txt = ("BEGIN:VCARD\nVERSION:2.1\n"
           "FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Jos=C3=A9 Garc=\n=C3=ADa\n"
           "TEL;CELL:639448263\nEND:VCARD\n")
    assert vcf(txt) == [{"nombre": "José García", "telefonos": ["639448263"]}]


def test_vcf_con_lineas_plegadas_y_prefijo_de_grupo():
    txt = ("BEGIN:VCARD\nVERSION:3.0\nFN:Maria del Carmen\n  Lopez\n"
           "item1.TEL;type=pref:+34600111222\nEND:VCARD\n")
    (c,) = vcf(txt)
    assert c["nombre"] == "Maria del Carmen Lopez" and c["telefonos"] == ["+34600111222"]


def test_vcf_sin_fn_usa_el_n():
    (c,) = vcf("BEGIN:VCARD\nN:Rojas;Sergio Luis;;;\nTEL:600111222\nEND:VCARD\n")
    assert c["nombre"] == "Sergio Luis Rojas"


def test_vcf_v4_con_tel_uri():
    (c,) = vcf("BEGIN:VCARD\nVERSION:4.0\nFN:Ana Perez\nTEL;VALUE=uri:tel:+34-600-111-222\nEND:VCARD\n")
    assert c["telefonos"] == ["+34-600-111-222"]
    assert movil(c["telefonos"][0]) == "34600111222"


def test_vcf_con_saltos_de_windows():
    assert len(vcf("BEGIN:VCARD\r\nFN:A B\r\nTEL:600111222\r\nEND:VCARD\r\n"
                   "BEGIN:VCARD\r\nFN:C D\r\nTEL:600111333\r\nEND:VCARD\r\n")) == 2


# ── Que cuenta como movil ───────────────────────────────────────────────────

def test_solo_valen_moviles():
    assert movil("639 44 82 63") == "34639448263"
    assert movil("+34 700 111 222") == "34700111222"
    assert movil("0034 639448263") == "34639448263"
    # Un fijo no recibe WhatsApp: en la ficha seria un numero que no llega a nadie.
    assert movil("981 57 41 78") == ""
    assert movil("881 000 000") == ""
    assert movil("") == "" and movil("abc") == ""


def test_un_movil_extranjero_pasa():
    assert movil("+351 912 345 678") == "351912345678"


# ── CSV / Excel ─────────────────────────────────────────────────────────────

def test_csv_de_google_contactos():
    filas = [["First Name", "Middle Name", "Last Name", "Phonetic First Name", "Phone 1 - Label",
              "Phone 1 - Value", "Phone 2 - Label", "Phone 2 - Value"],
             ["Sergio", "Luis", "Rojas", "sérjio", "Mobile", "639448263", "Home", "981574178"],
             ["Ana", "", "Perez", "", "Mobile", "600111222 ::: 600111333", "", ""]]
    c = tabla(filas)
    assert c[0]["nombre"] == "Sergio Luis Rojas"
    # La fonetica no es un telefono, y las etiquetas tampoco.
    assert c[0]["telefonos"] == ["639448263", "981574178"]
    assert c[1]["telefonos"] == ["600111222", "600111333"]


def test_csv_en_espanol_con_nombre_completo():
    c = tabla([["Nombre", "Teléfono móvil"], ["Sergio Rojas", "639 44 82 63"]])
    assert c == [{"nombre": "Sergio Rojas", "telefonos": ["639 44 82 63"]}]


def test_un_csv_sin_columna_de_telefono_no_da_nada():
    assert tabla([["Nombre", "Correo"], ["Sergio Rojas", "s@x.com"]]) == []


# ── El emparejado ───────────────────────────────────────────────────────────

def _f(i, nombre, movil="", centro="OGA5"):
    return {"id": i, "name": nombre, "center": centro, "movil_personal": movil}


FICHAS = [_f("1", "SERGIO LUIS ROJAS PEREZ"), _f("2", "ANA PEREZ LOPEZ"),
          _f("3", "MARCOS SUAREZ LORENZO"), _f("4", "MARCOS SUAREZ GARCIA")]


def _c(nombre, *tels):
    return {"nombre": nombre, "telefonos": list(tels)}


def test_un_nombre_corto_encaja_con_la_ficha_larga():
    r = propone([_c("Sergio Rojas", "639448263")], FICHAS)
    (p,) = r["propuestas"]
    assert p["driver_id"] == "1" and p["movil"] == "+34639448263" and p["estado"] == "nuevo"
    assert p["contacto"] == "Sergio Rojas" and not p["compartido"]


def test_con_dos_fichas_posibles_no_se_propone_ninguna():
    """'Marcos Suarez' es de los dos: elegir uno seria adivinar."""
    r = propone([_c("Marcos Suarez", "600111222")], FICHAS)
    assert r["propuestas"] == [] and r["ambiguos"] == 1


def test_un_solo_nombre_no_se_empareja():
    r = propone([_c("Sergio", "639448263")], FICHAS)
    assert r["propuestas"] == [] and r["sin_ficha"] == 1


def test_lo_que_no_es_conductor_solo_se_cuenta():
    r = propone([_c("Mama", "600000001"), _c("Fontanero Juan", "600000002")], FICHAS)
    assert r["propuestas"] == [] and r["sin_ficha"] == 2
    # Ni el nombre ni el numero de esos contactos viajan al panel.
    assert "Mama" not in repr(r) and "600000001" not in repr(r)


def test_un_contacto_sin_movil_no_cuenta_como_candidato():
    r = propone([_c("Sergio Rojas", "981574178"), _c("Ana Perez")], FICHAS)
    assert r["propuestas"] == [] and r["sin_movil"] == 2


def test_de_varios_numeros_se_propone_el_primer_movil_y_se_ofrecen_los_demas():
    (p,) = propone([_c("Ana Perez", "981574178", "600111222", "600111333")], FICHAS)["propuestas"]
    assert p["movil"] == "+34600111222" and p["otros"] == ["+34600111333"]


def test_el_mismo_numero_en_dos_personas_se_marca_compartido():
    r = propone([_c("Sergio Rojas", "600111222"), _c("Ana Perez", "600111222")], FICHAS)
    assert len(r["propuestas"]) == 2 and all(p["compartido"] for p in r["propuestas"])


def test_un_numero_que_ya_es_de_otra_ficha_se_marca_compartido():
    fichas = FICHAS + [_f("9", "PABLO OTERO GENDRA", "+34600111222")]
    (p,) = propone([_c("Sergio Rojas", "600111222")], fichas)["propuestas"]
    assert p["compartido"]


def test_si_ya_lo_tiene_igual_no_se_toca():
    fichas = [_f("1", "SERGIO LUIS ROJAS PEREZ", "+34639448263")] + FICHAS[1:]
    r = propone([_c("Sergio Rojas", "639 44 82 63")], fichas)
    assert r["propuestas"] == [] and r["ya_estaban"] == 1


def test_si_ya_tenia_otro_se_propone_como_cambio_y_no_como_nuevo():
    fichas = [_f("1", "SERGIO LUIS ROJAS PEREZ", "+34600000000")] + FICHAS[1:]
    (p,) = propone([_c("Sergio Rojas", "639448263")], fichas)["propuestas"]
    assert p["estado"] == "cambia" and p["actual"] == "+34600000000"


def test_los_nuevos_salen_antes_que_los_cambios_y_los_compartidos_al_final():
    fichas = [_f("1", "SERGIO LUIS ROJAS PEREZ", "+34600000000")] + FICHAS[1:]
    r = propone([_c("Sergio Rojas", "639448263"),            # cambia
                 _c("Ana Perez", "600111222"),               # nuevo
                 _c("Marcos Suarez Lorenzo", "600111333"),   # nuevo
                 _c("Marcos Suarez Garcia", "600111333")],   # comparte con el anterior
                fichas)
    assert [p["driver_id"] for p in r["propuestas"]] == ["2", "1", "4", "3"]
    assert [p["compartido"] for p in r["propuestas"]] == [False, False, True, True]


# ── Los endpoints ───────────────────────────────────────────────────────────

def test_analizar_no_escribe_nada_ni_guarda_el_fichero():
    f = _fuente("drivers_moviles_analizar")
    for prohibido in ("insert_one", "insert_many", "update_one", "update_many",
                      "replace_one", "upload", "put_object", "open("):
        assert prohibido not in f, prohibido


def test_aplicar_recalcula_en_el_servidor_y_no_pisa_a_otra_ficha():
    f = _fuente("drivers_moviles_aplicar")
    assert "_movil_de_contacto(" in f            # que sea un movil, lo dice el servidor
    assert '"movil_personal": "+" + e164, "id": {"$ne": did}' in f   # que no sea de otra
    assert "respaldo_moviles_personales" in f     # y se puede deshacer el lote
    assert "require_admin" in f
    # Solo escribe el movil: nada mas de la ficha.
    assert re.findall(r'"\$set": \{([^}]*)\}', f) == ['"movil_personal": "+" + e164']


def test_las_dos_rutas_son_de_admin_y_no_chocan_con_las_de_una_ficha():
    for nombre in ("drivers_moviles_analizar", "drivers_moviles_aplicar"):
        assert "require_admin" in _fuente(nombre), nombre
    assert '@api_router.post("/drivers/moviles/analizar")' in _TEXTO
    assert '@api_router.post("/drivers/moviles/aplicar")' in _TEXTO
