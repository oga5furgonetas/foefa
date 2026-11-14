# -*- coding: utf-8 -*-
"""«Antes del perito», tercera tanda (14-11-2026): SIN LA IA, NINGUNA LLAMADA A GEMINI (R9, R10, R11; S1).

Una empresa sin la IA de daños (`ia_danos: False`, las altas nuevas) ya no mandaba sus fotos a Gemini, pero el
asistente, importar el cuadrante pegado o en foto, el chat del cuadrante y la plantilla sí mandaban nombres de
conductores, matrículas y lo que escribe la oficina a la clave general (que puede ser del nivel gratuito). Ahora
pasan todas por `_ia_con_datos_o_403` ANTES de crear el cliente.

Se blinda de dos maneras:
  (a) dinámica: con un doble del módulo de Gemini (`google.genai`) que apunta y revienta si alguien lo usa, una
      empresa sin IA llama a cada ruta (las siete de R11 y las que ya estaban tapadas) y ninguna llega al doble. Su
      control: la empresa de siempre SÍ llega.
  (b) estática: se lee server.py, se busca cada sitio donde se crea un cliente de Gemini y la función que lo contiene
      tiene que estar en una de las listas de abajo, con su porqué. Quien añada mañana otra llamada tiene que decidir.

Además: R9 (`sin_ia` en /auth/me/assigned-vehicle), R10 (`ia` en /org/billing) y quién entra en el Centro de IA.
"""
import ast
import re
import sys
import types
from pathlib import Path

import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Db
from test_perito_ia import ADMIN_NUEVA, ADMIN_VIEJA, DE_SIEMPRE, NUEVA, Fichero, _jpeg, _subir

SERVER = Path(__file__).resolve().parents[1] / "server.py"


# ── El doble de Gemini ────────────────────────────────────────────────────────

class _GeminiDeMentira(types.ModuleType):
    """`google.genai` (y `google.genai.types`) que apunta cualquier uso y revienta."""
    def __init__(self, nombre, usos):
        super().__init__(nombre)
        self.__dict__["_usos"] = usos

    def __getattr__(self, k):
        if k.startswith("__"):
            raise AttributeError(k)
        self._usos.append(f"{self.__name__}.{k}")
        raise RuntimeError("doble de Gemini: aquí no se podía llegar")


@pytest.fixture
def gemini(monkeypatch):
    usos = []
    g = _GeminiDeMentira("google.genai", usos)
    monkeypatch.setitem(sys.modules, "google.genai", g)
    monkeypatch.setitem(sys.modules, "google.genai.types", _GeminiDeMentira("google.genai.types", usos))
    import google
    monkeypatch.setattr(google, "genai", g, raising=False)
    # Con clave: sin ella, algunos caminos ni lo intentan y la prueba no probaría nada.
    monkeypatch.setenv("GEMINI_API_KEY", "clave-de-mentira")
    monkeypatch.delenv("USE_VERTEX_AI", raising=False)
    monkeypatch.delenv("IA_DANOS_DE_PAGO", raising=False)
    monkeypatch.setattr(server, "AI_SERVICE_URL", "")
    return usos


@pytest.fixture
def base(monkeypatch):
    t = Db()
    t["vehicles"] = Col([{"id": "v1", "license_plate": "5678 KLM", "center": "OGA5", "status": "active",
                          "mileage": 48210, "brand": "Ford", "model": "Transit"}])
    t["drivers"] = Col([{"id": "drv-ana", "name": "Ana L.", "center": "OGA5", "active": True}])
    t["inspections"] = Col([])
    t["daily_assignments"] = Col([])
    t["incidents"] = Col([])
    monkeypatch.setattr(server, "db", t)
    orgs = {"org-nueva": NUEVA, "org-vieja": DE_SIEMPRE}

    async def get_org(org_id):
        return dict(orgs[org_id]) if org_id in orgs else None
    monkeypatch.setattr(server, "get_org", get_org)

    async def con_el_plan(*a, **k):
        return None
    monkeypatch.setattr(server, "_require_plan_feature", con_el_plan)
    return t


def _foto_con_datos():
    import base64
    return "data:image/jpeg;base64," + base64.b64encode(_jpeg()).decode()


def _rutas_r11(user):
    """Las siete rutas de R11, cada una con lo mínimo para llegar hasta Gemini si nadie la para."""
    return {
        "POST /assistant/ask": lambda: server.assistant_ask({"question": "¿Qué furgonetas tienen la ITV cerca?"},
                                                            user=user),
        "POST /ai/asistente": lambda: server.ai_asistente_hablar(
            server._IAAsistenteEntrada(mensaje="¿Quién libra el sábado?", center="OGA5"), user=user),
        "POST /ai/asistente/fichas-tecnicas": lambda: server.ai_fichas_tecnicas_proponer(
            center="OGA5", files=[Fichero("ficha.jpg", _jpeg())], user=user),
        "POST /cuadrante/chat": lambda: server.cuadrante_chat({"center": "OGA5", "mensaje": "cámbiame lo de Ana"},
                                                              user=user),
        "POST /assignments/import-text": lambda: server.import_roster_text(
            {"text": "5678 KLM Ana L.\n1234 BCD Luis P.", "center": "OGA5"}, user=user),
        "POST /assignments/import-image": lambda: server.import_roster_image(
            file=Fichero("cuadrante.jpg", _jpeg()), date=None, center="OGA5", user=user),
        "POST /tools/plantilla-extraer": lambda: server.plantilla_extraer(_PeticionConCaptura(), admin=user),
    }


class _PeticionConCaptura:
    """La petición multipart de «importar plantilla» con una captura de la lista de vehículos."""
    async def form(self):
        class _Form(dict):
            def getlist(self, campo):
                return [Fichero("captura.jpg", _jpeg())] if campo == "vehiculos" else []
        return _Form()


@pytest.fixture
def cuadrante_sin_entender(monkeypatch):
    """El chat del cuadrante con una orden que las reglas NO entienden: es la que iría a la IA."""
    async def ctx(*a, **k):
        return {"personas": [], "hoy": server.date_cls(2026, 11, 14), "desde": server.date_cls(2026, 11, 15),
                "hasta": server.date_cls(2026, 11, 15), "celdas": {}, "maximas": {}, "colchon": 0}
    monkeypatch.setattr(server, "_cua_contexto_chat", ctx)
    monkeypatch.setattr(server, "_cua_acceso", lambda *a, **k: None)
    monkeypatch.setattr(server._co, "interpretar_mensaje", lambda m, c: {"seguro": False, "acciones": []})


# ── (a) dinámica ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_sin_ia_las_siete_rutas_de_r11_contestan_403_sin_tocar_gemini(base, gemini, cuadrante_sin_entender):
    for nombre, llamada in _rutas_r11(ADMIN_NUEVA).items():
        with pytest.raises(HTTPException) as e:
            await llamada()
        assert e.value.status_code == 403, (nombre, e.value.detail)
        assert e.value.detail == "Esta cuenta no tiene esa función.", nombre
    assert gemini == [], f"sin la IA se ha llegado a Gemini: {gemini}"


@pytest.mark.asyncio(loop_scope="session")
async def test_control_la_empresa_de_siempre_si_llega_a_gemini(base, gemini, cuadrante_sin_entender,
                                                                  monkeypatch):
    """El control: con la IA, las mismas llamadas SÍ llegan al doble (si no, la prueba de arriba no probaría nada)."""
    monkeypatch.setattr(server, "get_r2", lambda: object())      # las fichas técnicas esperan a R2
    for nombre, llamada in _rutas_r11(ADMIN_VIEJA).items():
        antes = len(gemini)
        try:
            await llamada()
        except HTTPException as e:
            assert e.status_code != 403, (nombre, e.detail)
        except Exception:                                        # noqa: BLE001
            pass                                                 # el doble revienta: es justo lo que se mira
        assert len(gemini) > antes, f"{nombre}: con la IA tendría que haber llegado a Gemini"


@pytest.mark.asyncio(loop_scope="session")
async def test_el_chat_del_cuadrante_sin_ia_sigue_con_lo_que_entienden_las_reglas(base, gemini, monkeypatch):
    """R11: «solo la parte que llama a la IA». Una orden que entienden las reglas funciona igual sin IA."""
    async def ctx(*a, **k):
        return {"personas": []}
    monkeypatch.setattr(server, "_cua_contexto_chat", ctx)
    monkeypatch.setattr(server, "_cua_acceso", lambda *a, **k: None)
    monkeypatch.setattr(server._co, "interpretar_mensaje",
                        lambda m, c: {"seguro": True, "resumen": "", "acciones": [
                            {"accion": "responder", "texto": "El sábado no libra nadie."}]})
    r = await server.cuadrante_chat({"center": "OGA5", "mensaje": "¿quién libra el sábado?"}, user=ADMIN_NUEVA)
    assert gemini == []
    assert "El sábado no libra nadie." in str(r)


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_ia_las_que_ya_estaban_tapadas_tampoco_tocan_gemini(base, gemini, monkeypatch):
    """Subida de la revisión, reanálisis, identify-model, subida masiva, validate-photo, cuentakilómetros, foto
    anotada y PDF con cajas: lo que ya hacían sin la IA, ahora con el doble del módulo entero."""
    base["inspections"].docs.append({"id": "i-1", "vehicle_id": "v1", "driver_id": "drv-ana", "photos": [
        _foto_con_datos()], "created_at": "2026-11-12T07:00:00+00:00", "analysis_status": "ok",
        "analysis": {"severity": "leve", "damages": [{"part": "Capó", "severity": "leve", "photo_index": 1,
                                                      "box_2d": [1, 1, 400, 400]}], "new_damages": []}})
    r, tareas = await _subir(monkeypatch, ADMIN_NUEVA)
    assert r["analysis_status"] == "sin_ia"
    for c in tareas:
        c.close()
    for llamada in (lambda: server.reanalyze_inspection("i-1", False, _=ADMIN_NUEVA),
                    lambda: server.identify_vehicle_model("v1", _admin=ADMIN_NUEVA),
                    lambda: server.batch_upload_inspections(plates=["5678 KLM"], files=[Fichero("a.jpg", _jpeg())],
                                                            file_plates=["5678 KLM"], _=ADMIN_NUEVA)):
        with pytest.raises(HTTPException) as e:
            await llamada()
        assert e.value.status_code == 403
    assert (await server.validate_inspection_photo(vehicle_id="v1", expected_zone="frontal",
                                                   file=Fichero("f.jpg", _jpeg()), user=ADMIN_NUEVA))["checked"] is False
    odo = await server.read_odometer_photo("v1", file=Fichero("odometro.jpg", _jpeg()), user=ADMIN_NUEVA)
    assert odo["sin_lector"] is True
    assert (await server.inspection_annotated("i-1", 0, _=ADMIN_NUEVA)).status_code == 200
    pdf = await server.inspection_pdf("i-1", boxes=1, _=ADMIN_NUEVA)
    assert pdf.status_code == 200
    assert gemini == [], f"sin la IA se ha llegado a Gemini: {gemini}"


# ── (b) estática ──────────────────────────────────────────────────────────────

# Las que crean el cliente y lo devuelven: el sitio es quien las llama.
FABRICAS = {
    "_gemini_client_plantilla": "crea el cliente de la clave general; el sitio es quien la llama",
    "_rep_cliente_ia": "crea el cliente del reparto (REPARTO_IA_CLAVE o la general); el sitio es quien la llama",
}
# Tapadas EN LA PROPIA FUNCIÓN, antes de crear el cliente: {función: puerta que tiene que aparecer antes}.
TAPADAS = {
    "assistant_ask": "_ia_con_datos_o_403(",
    "import_roster_text": "_ia_con_datos_o_403(",
    "import_roster_image": "_ia_con_datos_o_403(",
    "plantilla_extraer": "_ia_con_datos_o_403(",
    "identify_vehicle_model": "_ia_danos_de(",            # fotos de la empresa: la regla de la IA de daños
    "validate_inspection_photo": "_ia_danos_de(",
}
# Tapadas POR QUIEN LAS LLAMA: cada llamador tiene la puerta antes de la llamada (o es otra de esta lista).
TAPADAS_POR_QUIEN_LLAMA = {
    "analyze_images_with_gemini": ("_ia_danos_activa(", "_ia_danos_de("),   # subida, reanálisis, subida masiva
    "_odo_leer_foto": ("_ia_danos_de(",),
    "_detectar_cajas_danos": ("_ia_danos_de(",),
    "_ai_llamar_gemini": ("_ia_con_datos_o_403(",),
    "_cua_chat_ia": ("_ia_con_datos_o_403(",),
}
# Con su PROPIA regla (no la de la IA de daños): el reparto de los autónomos. `_rep_ia_permitida` exige una clave de
# pago (REPARTO_IA_PERMITIDA=1 o REPARTO_IA_CLAVE) y el interruptor de la cuenta (`_rep_ia_activa`). No cambia.
CON_SU_REGLA = {
    "reparto_ticket": ("_rep_ia_activa(",),
    "_rep_ia_entrega_llamada": ("_rep_ia_entrega_activa(",),
}
# Los eslabones de en medio (no crean el cliente, llaman a quien lo crea): la puerta está en quien los llama.
ESLABONES = {
    "_process_single_inspection": ("_ia_danos_de(",),       # la subida masiva
    "_rep_ia_entrega": ("_rep_ia_entrega_activa(",),          # la foto de entrega del reparto, en segundo plano
}
# Las que no mandan datos de una empresa cliente: ninguna hoy. Si mañana hay una (p. ej. algo solo del dueño del
# producto), va aquí con su porqué.
NO_MANDAN_DATOS = {}


def _arbol():
    src = SERVER.read_text(encoding="utf-8-sig")
    return src, ast.parse(src)


def _funciones(arbol):
    out = []
    for n in ast.walk(arbol):
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
            out.append(n)
    return out


def _crea_cliente(nodo) -> bool:
    if not isinstance(nodo, ast.Call):
        return False
    f = nodo.func
    if isinstance(f, ast.Attribute) and f.attr == "Client" and isinstance(f.value, ast.Name) \
            and f.value.id in ("genai_sdk", "genai"):
        return True
    return isinstance(f, ast.Name) and f.id in FABRICAS


def _llama_a(nodo, nombre) -> bool:
    return isinstance(nodo, ast.Call) and isinstance(nodo.func, ast.Name) and nodo.func.id == nombre


def _contenedoras(funcs, linea):
    """De la más pequeña a la más grande, las funciones que contienen esa línea."""
    return sorted([f for f in funcs if f.lineno <= linea <= f.end_lineno], key=lambda f: f.end_lineno - f.lineno)


def _sitios(arbol):
    funcs = _funciones(arbol)
    sitios = {}
    for n in ast.walk(arbol):
        if _crea_cliente(n):
            dentro = _contenedoras(funcs, n.lineno)
            assert dentro, f"un cliente de Gemini fuera de toda función, línea {n.lineno}"
            sitios.setdefault(dentro[0].name, []).append(n.lineno)
    return sitios, funcs


def _puerta_antes(src_lineas, f, puertas, linea) -> bool:
    for k in range(f.lineno, linea + 1):
        if any(p in src_lineas[k - 1] for p in puertas):
            return True
    return False


def test_cada_cliente_de_gemini_esta_decidido():
    src, arbol = _arbol()
    sitios, _ = _sitios(arbol)
    sitios = {k: v for k, v in sitios.items() if k not in FABRICAS}
    decididos = set(TAPADAS) | set(TAPADAS_POR_QUIEN_LLAMA) | set(CON_SU_REGLA) | set(NO_MANDAN_DATOS)
    nuevos = set(sitios) - decididos
    assert not nuevos, (f"Llamadas nuevas a Gemini sin decidir: {sorted(nuevos)}. Ponles la puerta "
                        "(_ia_con_datos_o_403) y añádelas a TAPADAS, o explica en NO_MANDAN_DATOS por qué no hace falta.")
    # Y que lo de las listas siga existiendo (una lista que se queda vieja no protege nada).
    sobran = (set(TAPADAS) | set(CON_SU_REGLA)) - set(sitios)
    assert not sobran, f"En las listas, pero ya no crean el cliente: {sorted(sobran)}"


def test_las_tapadas_tienen_la_puerta_antes_del_cliente():
    src, arbol = _arbol()
    lineas = src.splitlines()
    sitios, funcs = _sitios(arbol)
    por_nombre = {f.name: f for f in funcs}
    for nombre, puerta in TAPADAS.items():
        f = por_nombre[nombre]
        for linea in sitios[nombre]:
            assert _puerta_antes(lineas, f, (puerta,), linea), f"{nombre}: la puerta {puerta} no está antes de la línea {linea}"
    for nombre, puertas in CON_SU_REGLA.items():
        if nombre in sitios and _puerta_antes(lineas, por_nombre[nombre], puertas, sitios[nombre][0]):
            continue
        _comprobar_llamadores(nombre, puertas, lineas, arbol, funcs, set())


def _comprobar_llamadores(nombre, puertas, lineas, arbol, funcs, vistos):
    llamadas = [n for n in ast.walk(arbol) if _llama_a(n, nombre)]
    assert llamadas, f"{nombre}: nadie la llama (sácala de la lista)"
    for n in llamadas:
        dentro = _contenedoras(funcs, n.lineno)
        assert dentro, f"{nombre} llamada fuera de toda función (línea {n.lineno})"
        exterior = dentro[-1]
        if any(_puerta_antes(lineas, f, puertas, n.lineno) for f in dentro):
            continue
        cadena = {**TAPADAS_POR_QUIEN_LLAMA, **ESLABONES}
        siguiente = next((f.name for f in dentro if f.name in cadena), None)
        assert siguiente and siguiente not in vistos, \
            f"{nombre} la llama {exterior.name} (línea {n.lineno}) sin puerta antes ({puertas})"
        _comprobar_llamadores(siguiente, cadena[siguiente], lineas, arbol, funcs, vistos | {nombre})


def test_las_tapadas_por_quien_llama_tienen_la_puerta_en_cada_llamador():
    src, arbol = _arbol()
    lineas = src.splitlines()
    _, funcs = _sitios(arbol)
    for nombre, puertas in TAPADAS_POR_QUIEN_LLAMA.items():
        _comprobar_llamadores(nombre, puertas, lineas, arbol, funcs, set())


def test_la_puerta_es_la_de_la_ia_de_danos():
    """Una sola regla: la de `_ia_danos_activa` (con `IA_DANOS_DE_PAGO=1` se la devuelve a todas)."""
    import inspect
    cuerpo = inspect.getsource(server._ia_con_datos_o_403)
    assert "_ia_danos_de(" in cuerpo and "Esta cuenta no tiene esa función." in cuerpo


@pytest.mark.asyncio(loop_scope="session")
async def test_la_clave_de_pago_abre_la_puerta(monkeypatch, base):
    monkeypatch.setenv("IA_DANOS_DE_PAGO", "1")
    await server._ia_con_datos_o_403(ADMIN_NUEVA)               # no levanta
    monkeypatch.delenv("IA_DANOS_DE_PAGO")
    with pytest.raises(HTTPException):
        await server._ia_con_datos_o_403(ADMIN_NUEVA)
    await server._ia_con_datos_o_403(ADMIN_VIEJA)
    await server._ia_con_datos_o_403({"sub": "x", "role": "admin"})   # sin empresa (pruebas): como siempre


# ── El Centro de IA (otra API, Claude): solo la oficina del dueño del producto ──

def test_el_centro_de_ia_es_solo_del_dueno_del_producto():
    """`/centro-ia/*` usa Claude (Anthropic), no Gemini, y su puerta es `_cia_acceso`: solo el super-admin o una
    cuenta del dueño del producto. Una empresa cliente no entra, tenga o no la IA de daños."""
    for quien in ({"sub": "a1", "role": "admin", "org_id": "org-nueva", "account_type": "dsp"},
                  {"sub": "a2", "role": "admin", "org_id": "org-vieja", "account_type": "dsp"}):
        with pytest.raises(HTTPException) as e:
            server._cia_acceso(quien)
        assert e.value.status_code == 403
    server._cia_acceso({"sub": "d", "role": "admin", "account_type": "owner"})
    server._cia_acceso({"sub": "s", "role": "admin", "sa": True})
    rutas = re.findall(r'@api_router\.\w+\("(/centro-ia/[^"]*)"\)\s*\nasync def (\w+)', SERVER.read_text("utf-8-sig"))
    assert rutas
    fuente = SERVER.read_text("utf-8-sig")
    for ruta, fn in rutas:
        cuerpo = fuente[fuente.index(f"async def {fn}("):][:1500]
        assert "_cia_acceso(" in cuerpo, f"{ruta} ({fn}) sin `_cia_acceso`"


# ── R9 y R10 ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_r9_la_furgoneta_del_conductor_dice_si_su_empresa_no_tiene_la_ia(base, monkeypatch):
    async def fichas(f):
        return {f.get("id")}, None
    monkeypatch.setattr(server, "_fichas_misma_persona", fichas)
    monkeypatch.setattr(server, "_dia_negocio", lambda: "2026-11-14")
    nuevo = {"sub": "drv-ana", "role": "driver", "org_id": "org-nueva"}
    viejo = {"sub": "drv-ana", "role": "driver", "org_id": "org-vieja"}
    assert await server.get_my_assigned_vehicle(user=nuevo) == {"assigned": False, "vehicle": None, "sin_ia": True}
    assert await server.get_my_assigned_vehicle(user=viejo) == {"assigned": False, "vehicle": None, "sin_ia": False}
    base["daily_assignments"].docs.append({"date": "2026-11-14", "center": "OGA5",
                                           "slots": [{"driver_id": "drv-ana", "vehicle_id": "v1"}]})
    r = await server.get_my_assigned_vehicle(user=nuevo)
    assert r["assigned"] is True and r["sin_ia"] is True and r["vehicle"]["id"] == "v1"
    assert (await server.get_my_assigned_vehicle(user=viejo))["sin_ia"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_r10_la_facturacion_dice_si_la_cuenta_tiene_la_ia(base, monkeypatch):
    async def region(_oid):
        return "es", "Europe/Madrid"
    monkeypatch.setattr(server, "_region_de_org", region)
    assert (await server.org_billing(user=ADMIN_NUEVA))["ia"] is False
    assert (await server.org_billing(user=ADMIN_VIEJA))["ia"] is True
    monkeypatch.setenv("IA_DANOS_DE_PAGO", "1")
    assert (await server.org_billing(user=ADMIN_NUEVA))["ia"] is True
