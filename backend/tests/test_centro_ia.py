# -*- coding: utf-8 -*-
"""El Centro de IA (19-10-2026), con una IA de mentira que contesta lo que le dice cada prueba: no se gasta nada.

Lo que se vigila: que solo lo use la oficina de la empresa dueña; que las instrucciones y las herramientas no cambien
entre mensajes (el modelo lo exige) y el historial solo crezca; que las herramientas respeten los centros; que una
propuesta no cambie nada hasta que se confirma, y al confirmar se haga con el usuario que confirma y la IA se entere;
que descartar no haga nada; el tope de gasto; y que fusionar fichas dobles lo pase TODO (la furgoneta del día
incluida) a la que se conserva, archivando lo que choca."""
import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import centro_ia
import server
from base_de_mentira import Col, Db

HOY = "2026-10-19"
DANI = {"sub": "u1", "role": "admin", "name": "Dani", "org_id": "owner", "account_type": "owner", "sa": True}
OFICINA = {"sub": "u2", "role": "admin", "name": "Zeus", "org_id": "owner", "account_type": "owner"}
CLIENTE = {"sub": "u9", "role": "admin", "name": "Otra empresa", "org_id": "org9", "account_type": "dsp"}


class Respuesta:
    def __init__(self, contenido, stop="end_turn", entrada=1000, salida=200):
        self._c, self.stop_reason = contenido, stop
        self.usage = SimpleNamespace(input_tokens=entrada, output_tokens=salida, cache_read_input_tokens=0,
                                     cache_creation_input_tokens=0)

    def to_dict(self):
        return {"content": [dict(b) for b in self._c]}


class IA:
    """Contesta por orden lo que tiene en `guion`; guarda cada petición para mirarla."""
    def __init__(self, guion):
        self.guion, self.peticiones = list(guion), []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._crear))

    async def _crear(self, **kw):
        import copy
        self.peticiones.append(copy.deepcopy(kw))
        return self.guion.pop(0)


def usa(nombre, entrada, i="t1"):
    return {"type": "tool_use", "id": i, "name": nombre, "input": entrada}


def texto(t):
    return {"type": "text", "text": t}


@pytest.fixture
def nave(monkeypatch):
    t, g = Db(), Db()
    t["drivers"] = Col([{"id": "d1", "name": "ANA PEREZ LOPEZ", "center": "OGA5", "active": True},
                        {"id": "d2", "name": "LUIS GOMEZ RIAL", "center": "OGA5", "active": True}])
    t["shifts"] = Col([{"driver_id": "d1", "date": HOY, "center": "OGA5", "cod": "1", "type": "trabaja"}])
    t["route_demand"] = Col([{"center": "OGA5", "date": HOY, "maximo": 48}])
    estado = {"ia": None}
    monkeypatch.setattr(server, "db", t)
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)
    monkeypatch.setattr(server, "_cia_dia", lambda: HOY)
    monkeypatch.setattr(server, "_cia_cliente", lambda: estado["ia"])

    async def nada(*a, **k):
        return None
    monkeypatch.setattr(server, "_audit", nada)
    return SimpleNamespace(t=t, g=g, estado=estado)


async def esperar():
    while server._CIA_TAREAS:
        await asyncio.gather(*list(server._CIA_TAREAS))


async def hablar(nave, guion, texto_usuario, quien=DANI, conv=None):
    nave.estado["ia"] = IA(guion)
    conv = conv or await server.cia_nueva(quien)
    await server.cia_mensaje(conv["id"], {"texto": texto_usuario, "center": "OGA5"}, quien)
    await esperar()
    return conv, await server.cia_ver(conv["id"], quien)


@pytest.mark.asyncio(loop_scope="session")
async def test_solo_la_oficina_de_la_empresa(nave):
    with pytest.raises(HTTPException) as e:
        await server.cia_nueva(CLIENTE)
    assert e.value.status_code == 403
    assert (await server.cia_estado(OFICINA))["modelo"] == "Claude Sonnet 5.5"


@pytest.mark.asyncio(loop_scope="session")
async def test_consulta_y_contesta_con_lo_que_ve(nave):
    guion = [Respuesta([texto("Lo miro."), usa("buscar_conductores", {"texto": "ana"})], stop="tool_use"),
             Respuesta([texto("Está **Ana Pérez López**, en OGA5.")])]
    conv, v = await hablar(nave, guion, "¿Está Ana en OGA5?")
    pasos = [x for x in v["vista"] if x["tipo"] == "paso"]
    assert pasos[0]["texto"].startswith("Busco conductores")
    assert v["vista"][-1] == {**v["vista"][-1], "tipo": "ia", "texto": "Está **Ana Pérez López**, en OGA5."}
    assert v["estado"] == "lista" and v["titulo"] == "¿Está Ana en OGA5?" and v["coste_usd"] > 0
    ia = nave.estado["ia"]
    # Lo que la herramienta devolvió a la IA: Ana, y nadie más.
    resultado = ia.peticiones[1]["messages"][-1]["content"][0]
    assert resultado["type"] == "tool_result" and "ANA PEREZ LOPEZ" in resultado["content"]
    assert "LUIS" not in resultado["content"]
    # Las instrucciones y las herramientas no cambian; lo del día va dentro del mensaje.
    assert ia.peticiones[0]["system"] == ia.peticiones[1]["system"] == centro_ia.SISTEMA
    assert ia.peticiones[0]["tools"] == centro_ia.HERRAMIENTAS
    assert ia.peticiones[0]["model"] == "claude-sonnet-5-5"
    assert ia.peticiones[0]["messages"][0]["content"].startswith("[Contexto: hoy es lunes 19/10/2026")
    # Segundo mensaje: el historial de antes va tal cual, y solo se añade.
    _, v2 = await hablar(nave, [Respuesta([texto("Sí.")])], "¿Seguro?", conv=conv)
    ant, nueva = ia.peticiones[1]["messages"], nave.estado["ia"].peticiones[0]["messages"]
    assert nueva[:len(ant)] == ant and nueva[len(ant)]["role"] == "assistant"
    assert nueva[-1]["role"] == "user" and nueva[-1]["content"].endswith("¿Seguro?")


@pytest.mark.asyncio(loop_scope="session")
async def test_una_propuesta_no_cambia_nada_hasta_confirmarla(nave):
    guion = [Respuesta([usa("proponer_maximas", {"centro": "OGA5", "maximas": [{"fecha": HOY, "maximo": 44}],
                                                 "explicacion": "Amazon pide 44"})], stop="tool_use"),
             Respuesta([texto("Te he dejado preparada la máxima de hoy en 44. Confírmala.")])]
    conv, v = await hablar(nave, guion, "Hoy nos piden 44")
    prop = next(iter(v["propuestas"].values()))
    assert prop["estado"] == "pendiente" and "lun 19/10: 48 → 44" in prop["lineas"]
    assert nave.t.route_demand.docs[0]["maximo"] == 48                     # nada todavía
    # Confirma: se hace, y la IA lo sabe y contesta.
    nave.estado["ia"] = IA([Respuesta([texto("Hecho: hoy la máxima es 44.")])])
    r = await server.cia_propuesta(conv["id"], prop["id"], {"accion": "confirmar"}, DANI)
    await esperar()
    assert r["estado"] == "hecha" and nave.t.route_demand.docs[0]["maximo"] == 44
    ultimo = nave.estado["ia"].peticiones[0]["messages"][-1]["content"]
    assert ultimo.startswith("[Confirmado] Dani ha confirmado la propuesta")
    v = await server.cia_ver(conv["id"], DANI)
    assert v["vista"][-1]["texto"] == "Hecho: hoy la máxima es 44."
    assert v["propuestas"][prop["id"]]["estado"] == "hecha"
    with pytest.raises(HTTPException) as e:                                 # no se confirma dos veces
        await server.cia_propuesta(conv["id"], prop["id"], {"accion": "confirmar"}, DANI)
    assert e.value.status_code == 409


@pytest.mark.asyncio(loop_scope="session")
async def test_descartar_no_hace_nada(nave):
    guion = [Respuesta([usa("proponer_maximas", {"centro": "OGA5", "maximas": [{"fecha": HOY, "maximo": 40}],
                                                 "explicacion": "x"})], stop="tool_use"),
             Respuesta([texto("Preparado.")])]
    conv, v = await hablar(nave, guion, "Pon 40")
    pid = next(iter(v["propuestas"]))
    await server.cia_propuesta(conv["id"], pid, {"accion": "descartar"}, DANI)
    assert nave.t.route_demand.docs[0]["maximo"] == 48
    doc = nave.t[server._CIA_COL].docs[0]
    assert doc["api"][-1]["content"].startswith("[Descartado]") and doc["propuestas"][pid]["estado"] == "descartada"


@pytest.mark.asyncio(loop_scope="session")
async def test_lo_que_el_panel_no_deja_la_ia_tampoco(nave):
    """Un error del panel (aquí, un código que no existe) vuelve a la IA como error, no rompe la conversación."""
    guion = [Respuesta([usa("proponer_cambios_cuadrante", {"centro": "OGA5", "explicacion": "x", "cambios": [
        {"driver_id": "d1", "fecha": HOY, "codigo": "VACACIONES"}]})], stop="tool_use"),
             Respuesta([texto("Ese código no existe.")])]
    _, v = await hablar(nave, guion, "Ponle vacaciones")
    res = nave.estado["ia"].peticiones[1]["messages"][-1]["content"][0]
    assert res["is_error"] is True and "no existe" in res["content"]
    assert v["propuestas"] == {} and v["vista"][-1]["texto"] == "Ese código no existe."


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_clave_y_con_el_tope_gastado(nave):
    conv = await server.cia_nueva(DANI)
    with pytest.raises(HTTPException) as e:
        await server.cia_mensaje(conv["id"], {"texto": "hola"}, DANI)
    assert e.value.status_code == 503
    nave.estado["ia"] = IA([])
    nave.g[server._CIA_USO].docs.append({"org_id": "owner", "user": "u1", "fecha": HOY, "coste_usd": 99})
    with pytest.raises(HTTPException) as e:
        await server.cia_mensaje(conv["id"], {"texto": "hola"}, DANI)
    assert e.value.status_code == 429


@pytest.mark.asyncio(loop_scope="session")
async def test_cada_uno_ve_sus_conversaciones(nave):
    conv = await server.cia_nueva(DANI)
    with pytest.raises(HTTPException) as e:
        await server.cia_ver(conv["id"], OFICINA)
    assert e.value.status_code == 404
    assert [c["id"] for c in (await server.cia_conversaciones(DANI))["conversaciones"]] == [conv["id"]]


@pytest.mark.asyncio(loop_scope="session")
async def test_fusionar_pasa_todo_a_la_ficha_que_se_queda(nave):
    """El caso de Álvaro (18-10-2026): la furgoneta del día estaba en la ficha que no usa."""
    t = nave.t
    t.drivers.docs += [{"id": "a_vieja", "name": "ALVARO RODRIGUEZ BLANCO", "center": "OGA5", "active": True},
                       {"id": "a_buena", "name": "Alvaro rodriguez blanco", "center": "OGA5", "active": True,
                        "email": "alvaro@x.es"}]
    t.shifts.docs += [{"driver_id": "a_vieja", "date": HOY, "center": "OGA5", "cod": "1"},
                      {"driver_id": "a_vieja", "date": "2026-10-20", "center": "OGA5", "cod": "N/T"},
                      {"driver_id": "a_buena", "date": HOY, "center": "OGA5", "cod": "1"}]
    t.daily_assignments.docs.append({"date": HOY, "center": "OGA5", "slots": [
        {"vehicle_id": "v1", "vehicle_plate": "8627MPH", "driver_id": "a_vieja", "driver_name": "ALVARO RODRIGUEZ BLANCO"}]})
    t[server._CUA_PERSONAS].docs += [{"center": "OGA5", "driver_id": "a_vieja", "en_cuadrante": True},
                                     {"center": "OGA5", "driver_id": "a_buena", "en_cuadrante": True}]
    guion = [Respuesta([usa("proponer_fusionar_fichas", {"conservar": "a_buena", "absorber": ["a_vieja"],
                                                         "explicacion": "Es la misma persona"})], stop="tool_use"),
             Respuesta([texto("Preparado.")])]
    conv, v = await hablar(nave, guion, "Fusiona a Álvaro")
    pid = next(iter(v["propuestas"]))
    nave.estado["ia"] = IA([Respuesta([texto("Hecho.")])])
    r = await server.cia_propuesta(conv["id"], pid, {"accion": "confirmar"}, DANI)
    await esperar()
    assert r["estado"] == "hecha"
    slot = t.daily_assignments.docs[0]["slots"][0]
    assert (slot["driver_id"], slot["driver_name"]) == ("a_buena", "Alvaro rodriguez blanco")
    assert sorted(s["date"] for s in t.shifts.docs if s["driver_id"] == "a_buena") == [HOY, "2026-10-20"]
    assert not [s for s in t.shifts.docs if s["driver_id"] == "a_vieja"]
    vieja = next(d for d in t.drivers.docs if d["id"] == "a_vieja")
    assert (vieja["merged_into"], vieja["active"], vieja["status"]) == ("a_buena", False, "fusionada")
    archivo = t.fusion_archivo.docs
    assert any(a["col"] == "shifts" and a["doc"]["driver_id"] == "a_vieja" for a in archivo)   # el día que chocaba
    assert [p["driver_id"] for p in t[server._CUA_PERSONAS].docs] == ["a_buena"]


@pytest.mark.asyncio(loop_scope="session")
async def test_no_fusiona_personas_distintas(nave):
    guion = [Respuesta([usa("proponer_fusionar_fichas", {"conservar": "d1", "absorber": ["d2"],
                                                         "explicacion": "x"})], stop="tool_use"),
             Respuesta([texto("No parecen la misma.")])]
    _, v = await hablar(nave, guion, "Fusiona a Ana con Luis")
    res = nave.estado["ia"].peticiones[1]["messages"][-1]["content"][0]
    assert res["is_error"] and "no parecen la misma persona" in res["content"] and v["propuestas"] == {}


@pytest.mark.asyncio(loop_scope="session")
async def test_un_fallo_de_la_ia_se_explica_y_deja_seguir(nave):
    class Rota(IA):
        async def _crear(self, **kw):
            raise RuntimeError("se cayó")
    nave.estado["ia"] = Rota([])
    conv = await server.cia_nueva(DANI)
    await server.cia_mensaje(conv["id"], {"texto": "hola"}, DANI)
    await esperar()
    v = await server.cia_ver(conv["id"], DANI)
    assert v["estado"] == "lista" and v["vista"][-1]["tipo"] == "aviso"


def test_los_pasos_se_leen_bien():
    assert centro_ia.texto_paso("ver_cuadrante", {"centro": "OGA5", "desde": "2026-10-19", "hasta": "2026-10-25"}) \
        == "Miro el cuadrante (OGA5, 19/10 → 25/10)"
    assert centro_ia.texto_paso("proponer_maximas", {}) == "Preparo una propuesta para que la confirmes"
    assert centro_ia.coste_usd({"input_tokens": 1_000_000, "output_tokens": 100_000}) == 3.0
    assert {h["name"] for h in centro_ia.HERRAMIENTAS} == set(server._CIA_LEER) | set(server._CIA_PROPONER)
