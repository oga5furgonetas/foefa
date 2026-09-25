# -*- coding: utf-8 -*-
"""FlotaDSP AI como uno mas de la sala: se la llama y contesta ahi.

Lo pidio Dani el 19-09-2026: «tipo flota, ensenale a Mery cuales son sus peores
conductores... si lo llamas aparece y desaparece si lleva 1h inactivo».

Lo que se prueba aqui es lo que, si se rompe, no falla de forma visible:

  · QUE SOLO CONTESTE CUANDO LA LLAMAN. Un asistente que responde a todo
    convierte la sala del turno en un hilo suyo. Y al reves: si deja de
    reconocer su nombre, no contesta nunca y parece que esta rota.
  · QUE EL MENSAJE DE LA PERSONA SE GUARDE ANTES. Si la IA falla —cuota de
    Gemini agotada, que pasa de verdad— lo que escribio no se puede perder.
  · QUE UN FALLO SE DIGA. Un asistente mudo parece que se ha ido.
"""
import ast
import io
import os
import re
import sys
import unicodedata

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUENTE = io.open(os.path.join(RAIZ, "server.py"), encoding="utf-8-sig").read()


# El arbol se parsea UNA vez: son 55.000 lineas y `_cuerpo` se llama docenas de
# veces. Sin esto el fichero tardaba mas de dos minutos en correr, y un test que
# tarda tanto acaba sin ejecutarse.
_ARBOL = ast.parse(FUENTE)


def _cuerpo(nombre):
    for n in ast.walk(_ARBOL):
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == nombre:
            return ast.get_source_segment(FUENTE, n)
    raise AssertionError("no existe %s en server.py" % nombre)


def _llamada():
    """La funcion REAL que decide si la llaman (gotcha 40: nada de copias)."""
    amb = {"re": re}
    for n in _ARBOL.body:
        if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") == "_IA_LLAMADA":
            exec(ast.get_source_segment(FUENTE, n), amb)         # noqa: S102
    exec(_cuerpo("_ia_la_llaman"), amb)                          # noqa: S102
    exec(_cuerpo("_ia_sin_llamarla"), amb)                       # noqa: S102
    return amb["_ia_la_llaman"], amb["_ia_sin_llamarla"]


def test_contesta_cuando_la_llaman_por_su_nombre():
    llaman, _ = _llamada()
    for texto in ("@flota quienes son los peores conductores",
                  "flota, ensenale a Mery sus peores conductores",
                  "Flota: cuantas ITV caducan este mes",
                  "@flotia ai dame las ITV del mes",
                  "flotia: cuantos daños hay abiertos",
                  "oye @flota mira los daños de hoy"):
        assert llaman(texto), "no reconoce que la llaman: %r" % texto


def test_no_se_mete_en_una_conversacion_que_no_va_con_ella():
    llaman, _ = _llamada()
    for texto in ("mañana repasamos la flota entera",
                  "la flotilla de la sede norte esta parada",
                  "flotilla, mañana hay revision",
                  "¿alguien sabe si vino el de la ITV?",
                  "hoy salen 42 rutas"):
        assert not llaman(texto), "se mete donde no la llaman: %r" % texto


def test_se_le_quita_el_nombre_antes_de_preguntarle():
    """Lo que se le pasa es la PREGUNTA, no el «flota,» de delante: con el
    dentro, el modelo contesta a su propio nombre."""
    _, limpiar = _llamada()
    assert limpiar("@flota quienes son los peores conductores") == "quienes son los peores conductores"
    assert limpiar("flota, dame las ITV") == "dame las ITV"
    assert limpiar("@flotia ai cuantas furgonetas hay") == "cuantas furgonetas hay"


def test_el_mensaje_de_la_persona_se_guarda_antes_de_llamar_a_la_ia():
    cuerpo = _cuerpo("chat_post")
    pos_insert = cuerpo.index("chat_messages.insert_one")
    pos_ia = cuerpo.index("_ia_la_llaman")
    assert pos_insert < pos_ia, (
        "la IA se llama antes de guardar el mensaje: si falla, lo que escribio "
        "la persona se pierde")


def test_si_la_ia_falla_lo_dice_en_vez_de_quedarse_muda():
    """La guarda vive en `_ia_pensar`, que es la cabeza compartida por la sala
    y los privados: asi un fallo se dice en los dos sitios y no en uno solo."""
    pensar = _cuerpo("_ia_pensar")
    assert "except Exception" in pensar and "No he podido mirarlo" in pensar, (
        "un fallo de la IA la deja muda y parece que se ha ido")
    assert "except HTTPException" in pensar, "un 503 de cuota tiene que decirse tal cual"
    assert "insert_one(dict(doc))" in _cuerpo("_ia_sala_responder"), (
        "gotcha 42: insert_one muta el dict")


def test_se_queda_una_hora_y_se_va_sola():
    assert "_IA_SALA_MINUTOS = 60" in FUENTE
    cuerpo = _cuerpo("_ia_sala_responder")
    assert "chat_ia_presencia" in cuerpo and "_IA_SALA_MINUTOS" in cuerpo


def test_todos_los_casos():
    fallos = 0
    for nombre, f in sorted(globals().items()):
        if nombre.startswith("test_") and callable(f) and nombre != "test_todos_los_casos":
            try:
                f()
                print("ok  ", nombre)
            except Exception as ex:                              # noqa: BLE001
                fallos += 1
                print("FALLA", nombre, repr(ex))
    assert fallos == 0, "%d fallos" % fallos




def test_tambien_contesta_en_un_privado():
    """Dani la llamo en su conversacion con Mery -«@flota dile a mery quien es
    su peor conductor»- y no pasaba nada: solo estaba montada en la sala del
    centro. En un privado hacen falta dos cosas mas que en la sala: que el
    mensaje lleve la MISMA clave de conversacion (si no, lo ve uno solo) y que
    el «no leido» se le cuelgue al OTRO, que es quien no esta mirando."""
    cuerpo = _cuerpo("mensajes_enviar")
    assert "_ia_la_llaman(texto)" in cuerpo, "en privado no se la llama nunca"
    assert 'doc["conv"]' in cuerpo, "su respuesta iria a otra conversacion y la veria uno solo"
    assert '"para": otro_id' in cuerpo, "el no leido tiene que ser del otro"
    assert "_ia_pensar(" in cuerpo, "deberia usar la misma cabeza que en la sala"


def test_un_privado_no_es_de_ninguna_nave_y_aun_asi_mira_datos():
    """La sala es de un centro; un privado no. Sin centro, la consulta no sabe
    contra que flota mirar y contestaria vacio pareciendo que no hay datos."""
    cuerpo = _cuerpo("_ia_centro_de")
    assert "allowed_centers" in cuerpo and "_centro_por_defecto()" in cuerpo


def test_una_respuesta_sin_un_solo_dato_no_vale():
    """«Los peores son los que acumulan mas incidencias»: parece una respuesta
    y no dice nada. Paso de verdad el 19-09-2026 preguntandole en un privado
    por el peor conductor de Mery. Es peor que un «no lo se», porque cierra la
    pregunta y nadie vuelve a preguntarla.

    Cuando la pregunta solo se contesta con datos y lo que sale no trae ni una
    cifra ni una tarjeta, se le vuelve a preguntar UNA vez obligandola a mirar.
    """
    import re as _re
    amb = {"re": _re}
    arbol = ast.parse(FUENTE)
    for n in arbol.body:
        if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") in (
                "_IA_PIDE_DATOS", "_IA_CON_CIFRA"):
            exec(ast.get_source_segment(FUENTE, n), amb)                 # noqa: S102
    exec(_cuerpo("_ia_respuesta_hueca"), amb)                            # noqa: S102
    hueca = amb["_ia_respuesta_hueca"]

    assert hueca("quien es su peor conductor",
                 "Los peores son los que acumulan mas incidencias.", None), (
        "una tautologia sin cifras tiene que detectarse")
    assert not hueca("quien es su peor conductor",
                     "El peor es MAXIMILIANO con 7 incidencias y 3 golpes.", None)
    assert not hueca("quien es su peor conductor", "Aqui los tienes.",
                     {"titulo": "x", "filas": []}), "con tarjeta si hay datos"
    assert not hueca("gracias, buen trabajo", "De nada.", None), (
        "una conversacion normal no es una pregunta de datos")

    # Y que el reintento este enganchado de verdad, no solo la funcion.
    hablar = _cuerpo("ai_asistente_hablar")
    assert "_ia_respuesta_hueca(" in hablar, "el detector no se usa en ningun sitio"
    assert "no dice nada" in hablar, "no se le dice al modelo que vuelva a mirar"


def test_en_un_privado_la_nave_sale_de_lo_que_dice_el_mensaje():
    """Dani escribio «y el de dga1? @flota» en su privado con Mery y le
    contesto «yo solo veo este centro, OGA5»: tiene tres naves y no podia
    preguntar por dos de ellas, porque un privado no es de ninguna y se cogia
    la suya por defecto.

    Ahora manda lo que diga el mensaje, con dos guardas: solo vale una nave de
    verdad de su empresa que el pueda ver, y si nombra DOS no se adivina (misma
    regla que `_centro_norm`)."""
    cuerpo = _cuerpo("_ia_centro_de")
    assert "_centros_de_la_empresa()" in cuerpo, (
        "acepta cualquier texto como nave en vez de las de la empresa")
    assert "allowed_centers" in cuerpo, "no comprueba que pueda ver esa nave"
    assert "len(dichas) == 1" in cuerpo, "con dos naves nombradas adivinaria"
    # Y que se le pase el texto de verdad, no solo el centro de la sesion.
    envio = _cuerpo("mensajes_enviar")
    assert "_ia_centro_de(user, _texto_cuerpo(data.get(\"center\"), 20), texto)" in envio, (
        "el mensaje no llega a la eleccion de nave")


def _hilo_real():
    """`_ia_hilo_historial` de verdad, con una base de datos de mentira.

    Se ejecuta la funcion sacada de `server.py` (gotcha 40) con un `db` falso y
    un `_chat_room_can_access` falso: asi se prueba QUIEN puede leer que, que es
    la parte peligrosa, sin levantar Mongo.
    """
    import asyncio

    class _Cursor:
        def __init__(self, docs):
            self._docs = docs

        def __call__(self, *a, **kw):
            return self

        async def to_list(self, n):
            return list(self._docs[:n])

    class _Col:
        def __init__(self, docs):
            self._docs = docs
            self.pedido = None

        def find(self, filtro, proy=None, sort=None, limit=100):
            self.pedido = filtro
            fuera = []
            for d in self._docs:
                if all(d.get(k) == v for k, v in filtro.items()):
                    fuera.append(d)
            return _Cursor(list(reversed(fuera)))

    class _Db:
        def __init__(self, sala, privados):
            self.chat_messages = _Col(sala)
            self.chat_dm = _Col(privados)

    sala = [{"center": "OGA5", "author_name": "Mery", "text": "hoy faltan dos", "created_at": "1"},
            {"center": "OGA5", "author_name": "Dani", "text": "@flota y ahora?", "created_at": "2"},
            {"center": "DGA1", "author_name": "Otro", "text": "de otra nave", "created_at": "3"}]
    privados = [{"conv": "aaa:bbb", "de_nombre": "Dani", "texto": "mira esto", "creado_en": "1"},
                {"conv": "aaa:bbb", "de_nombre": "Mery", "texto": "vale", "creado_en": "2"},
                {"conv": "ccc:ddd", "de_nombre": "Ajeno", "texto": "privado de otros", "creado_en": "3"}]

    amb = {"re": re, "db": _Db(sala, privados), "Optional": __import__("typing").Optional}

    async def _acceso(user, centro):
        return centro in (user.get("allowed_centers") or [])
    amb["_chat_room_can_access"] = _acceso

    for n in _ARBOL.body:
        if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") in (
                "_IA_HILO", "_IA_HILO_MENSAJES", "_IA_HILO_LARGO", "_IA_HILO_INSTRUCCION"):
            exec(ast.get_source_segment(FUENTE, n), amb)         # noqa: S102
    exec(_cuerpo("_ia_hilo_historial"), amb)                     # noqa: S102
    return amb, asyncio


def test_el_hilo_del_chat_trae_la_conversacion_de_VERDAD():
    """El 19-09-2026 Dani escribio «@flota y ahora?» en su privado con Mery y le
    contesto de la plantilla diaria: los tres sitios donde vive la IA compartian
    un unico historial, el de la pantalla del panel. Medido en produccion antes
    de arreglarlo: de 148 mensajes de ese historial, 7 se habian escrito en
    realidad en el chat."""
    amb, asyncio = _hilo_real()
    fn = amb["_ia_hilo_historial"]
    user = {"sub": "aaa", "allowed_centers": ["OGA5"]}

    lineas = asyncio.run(fn(user, "sala:OGA5"))
    assert lineas is not None, "no deja leer su propia sala"
    assert any("Mery: hoy faltan dos" in x for x in lineas), lineas
    assert not any("de otra nave" in x for x in lineas), "se cuela otra nave"

    lineas = asyncio.run(fn(user, "dm:aaa:bbb"))
    assert lineas is not None and any("Dani: mira esto" in x for x in lineas), lineas


def test_nadie_lee_por_la_IA_una_conversacion_que_no_es_suya():
    """El hilo lo manda el cliente. Sin comprobarlo en el servidor, cualquier
    administrador podria leer el privado de otros dos pidiendole a la IA que
    «recuerde» de que estaban hablando."""
    amb, asyncio = _hilo_real()
    fn = amb["_ia_hilo_historial"]
    user = {"sub": "aaa", "allowed_centers": ["OGA5"]}

    assert asyncio.run(fn(user, "dm:ccc:ddd")) is None, (
        "deja leer el privado de otras dos personas")
    assert asyncio.run(fn(user, "sala:DGA1")) is None, (
        "deja leer la sala de una nave que no puede ver")
    for malo in ("", "otracosa:x", "dm:", "sala:", "dm:" + "x" * 200, "../../etc"):
        assert asyncio.run(fn(user, malo)) is None, malo


def test_lo_del_chat_no_se_guarda_en_el_hilo_del_panel():
    """La otra mitad del mismo fallo: cada `@flota` del chat se apuntaba tambien
    en el historial de la pantalla del asistente, y era eso lo que luego leia."""
    cuerpo = _cuerpo("ai_asistente_hablar")
    assert "if not hilo:" in cuerpo, "sigue guardando lo del chat en el hilo del panel"
    assert 'hilo = _texto_cuerpo(data.hilo, 120)' in cuerpo, "no lee el hilo del cuerpo"
    assert '_ia_hilo_historial(user, hilo)' in cuerpo, "no usa la conversacion real"
    # Y el historial del panel se lee filtrado, para que lo viejo siga valiendo.
    assert '"hilo": {"$in": [None, ""]}' in cuerpo, "no filtra el hilo al leer"


def test_cada_sitio_dice_de_donde_viene():
    assert 'hilo="sala:%s" % center' in _cuerpo("_ia_sala_responder"), (
        "la sala no dice que es la sala")
    assert 'hilo="dm:%s" % doc["conv"]' in _cuerpo("mensajes_enviar"), (
        "el privado no dice que es un privado")


def test_se_le_dice_que_esta_en_una_conversacion():
    """Sin esto contesta como si le hubieran abierto una ventana de soporte:
    saluda, se presenta, repite la pregunta y cierra con «¿algo mas?»."""
    for n in _ARBOL.body:
        if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") == "_IA_HILO_INSTRUCCION":
            texto = ast.literal_eval(n.value)
            break
    else:
        raise AssertionError("no existe _IA_HILO_INSTRUCCION")
    for pista in ("no saludes", "no repitas la pregunta", "por su nombre"):
        assert pista in texto.lower(), pista


def _si_puede():
    """La guarda REAL de «no puedo» a cosas que si puede."""
    amb = {"re": re, "_IA_CONSULTA_TIPOS": None}
    for n in _ARBOL.body:
        if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") in (
                "_IA_CONSULTA_TIPOS", "_IA_SE_RINDE", "_IA_NO_PUEDE_DE_VERDAD",
                "_IA_LO_QUE_SI_PUEDE"):
            exec(ast.get_source_segment(FUENTE, n), amb)         # noqa: S102
    exec(_cuerpo("_ia_si_puede"), amb)                           # noqa: S102
    return amb["_ia_si_puede"], amb


def test_se_nego_a_lo_que_SI_puede_y_se_le_saca_el_dato():
    """Las tres negativas FALSAS medidas en produccion el 20-09-2026, leyendo
    las 74 respuestas guardadas: de doce negativas, estas tres eran mentira."""
    fn, _ = _si_puede()
    casos = [
        ("que furgonetas tienen la ITV caducada",
         "No puedo darte ese listado desde aqui.",
         "vehiculos"),
        ("cuantas inspecciones se hicieron ayer",
         "No tengo acceso a ese dato en este centro.",
         "inspecciones"),
        ("si te paso 20 fichas tecnicas puedes analizarlas?",
         "No puedo procesar fichas tecnicas masivas. Tendras que subirlas una a una.",
         "vehiculos"),
    ]
    for pregunta, respuesta, esperado in casos:
        assert fn(pregunta, respuesta, None) == esperado, (pregunta, fn(pregunta, respuesta, None))


def test_lo_que_de_verdad_NO_puede_se_queda_como_esta():
    """Prometer que dejara algo programado para manana ya se corrigio una vez
    (43ed7ec). Esta guarda no puede deshacer aquello."""
    fn, _ = _si_puede()
    casos = [
        ("dejalo programado y tu montas el cuadrante de manana",
         "Eso no es posible: no tengo procesos de fondo."),
        ("genera el informe de la sede norte manana cuando salgan los turnos",
         "No puedo dejar nada programado para manana."),
        ("puedes mandarle tu el whatsapp cada dia?",
         "No puedo, eso lo tienes que hacer tu."),
    ]
    for pregunta, respuesta in casos:
        assert fn(pregunta, respuesta, None) == "", (pregunta, fn(pregunta, respuesta, None))


def test_una_negativa_CON_datos_no_es_una_negativa():
    """Si ha dado la tarjeta, ha contestado: el «no puedo» sera un matiz."""
    fn, _ = _si_puede()
    tarjeta = {"titulo": "ITV", "filas": [{"etiqueta": "Caducadas", "valor": "1"}]}
    assert fn("que furgonetas tienen la ITV caducada", "No puedo darte mas detalle que esto.", tarjeta) == ""


def test_una_respuesta_normal_no_dispara_nada():
    fn, _ = _si_puede()
    assert fn("que furgonetas tienen la ITV caducada", "Caducada la 1234-ABC y la 5678-DEF.", None) == ""
    assert fn("", "", None) == ""


def test_solo_propone_consultas_que_existen_de_verdad():
    """La lista sale del codigo y no de lo que yo recuerde (gotcha 40): una
    consulta inventada aqui seria una rama que nunca se ejecuta."""
    fn, amb = _si_puede()
    for tipo, _patron in amb["_IA_LO_QUE_SI_PUEDE"]:
        assert tipo in amb["_IA_CONSULTA_TIPOS"], tipo


def test_la_guarda_esta_enganchada_y_ejecuta_la_consulta_ella_misma():
    """Pedirle otra vez al modelo que pida la consulta es justo lo que acaba de
    fallar: se ejecuta aqui y se le pone el resultado delante."""
    c = _cuerpo("ai_asistente_hablar")
    assert "_ia_si_puede(" in c, "la guarda no esta enganchada"
    assert '_ai_ejecutar_consulta(user, center, {"tipo": _tipo_si})' in c, (
        "no ejecuta la consulta por su cuenta")
    assert "Has dicho que no puedes, y SI puedes" in c


if __name__ == "__main__":
    try:
        test_todos_los_casos()
    except AssertionError as ex:
        print(ex)
        sys.exit(1)
    sys.exit(0)
