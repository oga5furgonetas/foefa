# -*- coding: utf-8 -*-
"""El cuadrante sincronizado con Google Sheets (18-10-2026). Dani: «que se vaya actualizando según los cambios que
hacemos [en la hoja]. O que se actualice según lo que hacemos en la aplicación».

Lo que se vigila: que cada celda vaya hacia donde cambió (la hoja → la app, la app → la hoja); que lo protegido en la
app (día concedido, suspensión, candado) no lo pise la hoja y vuelva a ella con su nota; que una celda vacía en la hoja
no borre nada; que el día extra (1 rosa en la hoja, EXTRA en la app) sea lo mismo; que el mes de una pestaña con solo
el número del día salga de las letras de la semana y no de «el más cercano a hoy»; que en prueba no se toque nada; que
lo masivo se retenga; y que la llave fije la empresa y deje de valer al desconectar."""
import datetime as dt
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import cuadrante_excel as cx
import server
from base_de_mentira import Col, Db

HOY = "2026-10-18"
DIAS = [(dt.date(2026, 10, 12) + dt.timedelta(days=i)).isoformat() for i in range(14)]   # 12-10 .. 25-10
OFI = {"sub": "a1", "role": "admin", "name": "Oficina", "org_id": "owner"}
SIN_CUADRANTE = {"sub": "a3", "role": "admin", "name": "Mira", "org_id": "owner", "permissions": ["turnos"]}
OTRO_CENTRO = {"sub": "a2", "role": "admin", "name": "Jefe DGA1", "org_id": "owner", "allowed_centers": ["DGA1"]}


# ── La hoja, como la manda el script ─────────────────────────────────────────

def pestana(filas, nombre="OCTUBRE", maximas=None, rosas=(), dias=DIAS, con_fechas=True):
    """filas: {nombre: [código o None por día]}. Fila 1 «Nº / NOMBRE / fechas», luego una fila por persona, luego
    RUTAS y MÁXIMA. `rosas`: [(nombre, fecha)] con el fondo rosa."""
    cab = ["Nº", "NOMBRE"] + [("@D:" + d) if con_fechas else int(d[-2:]) for d in dias]
    valores, fondos = [cab], [[""] * len(cab)]
    if not con_fechas:
        letras = ["L", "M", "X", "J", "V", "S", "D"]
        valores.insert(0, ["", ""] + [letras[dt.date.fromisoformat(d).weekday()] for d in dias])
        fondos.insert(0, [""] * len(cab))
    for k, (nom, cods) in enumerate(filas.items()):
        valores.append([k + 1, nom] + [("" if c is None else (1 if c == "1" else c)) for c in cods])
        fondos.append(["", ""] + ["#ff66cc" if (nom, d) in rosas else "" for d in dias])
    valores.append(["", "RUTAS (contador de 1)"] + [""] * len(dias))
    fondos.append([""] * len(cab))
    valores.append(["", "MÁXIMA"] + [(maximas or {}).get(d, "") for d in dias])
    fondos.append([""] * len(cab))
    return {"nombre": nombre, "valores": valores, "fondos": fondos}


def fila_de(pest, nombre):
    """La fila (1, 2…) de esa persona en la pestaña, como la ve Google Sheets."""
    return next(i + 1 for i, f in enumerate(pest["valores"]) if len(f) > 1 and f[1] == nombre)


def col_de(fecha, dias=DIAS):
    return 3 + dias.index(fecha)


class Peticion:
    def __init__(self, llave, cuerpo=None):
        import json
        self.headers = {"X-Flota-Sync": llave} if llave else {}
        self._crudo = json.dumps(cuerpo or {}).encode()

    async def body(self):
        return self._crudo


@pytest.fixture
def nave(monkeypatch):
    t, g = Db(), Db()
    t["drivers"] = Col([{"id": "d1", "name": "ANA PEREZ LOPEZ", "center": "OGA5", "active": True},
                        {"id": "d2", "name": "LUIS GOMEZ RIAL", "center": "OGA5", "active": True},
                        {"id": "d3", "name": "SARA VILA OTERO", "center": "OGA5", "active": True}])
    t["shifts"] = Col([])
    t["shift_requests"] = Col([])
    t["suspensiones"] = Col([])
    t["route_demand"] = Col([])
    hoy = {"d": HOY}
    monkeypatch.setattr(server, "db", t)
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "_dia_negocio", lambda: hoy["d"])

    async def nada(*a, **k):
        return None
    monkeypatch.setattr(server, "_audit", nada)
    return SimpleNamespace(t=t, g=g, hoy=hoy)


def turno(t, did, fecha):
    return next((s for s in t.shifts.docs if s["driver_id"] == did and s["date"] == fecha), None)


def poner(t, did, fecha, cod, **extra):
    tipo = {"1": "trabaja", "EXTRA": "extra"}.get(cod, "libre")
    doc = turno(t, did, fecha)
    if doc:
        doc.update({"cod": cod, "type": tipo, **extra})
    else:
        t.shifts.docs.append({"driver_id": did, "date": fecha, "center": "OGA5", "cod": cod, "type": tipo, **extra})


async def conectar(modo="activo"):
    r = await server.cuadrante_sync_conectar({"center": "OGA5"}, OFI)
    if modo == "activo":
        await server.cuadrante_sync_modo({"center": "OGA5", "modo": "activo"}, OFI)
    return r["llave"]


async def sync(llave, *pestanas, nave=None):
    if nave is not None:                          # el freno de 15 s entre llamadas no cuenta en las pruebas
        for d in nave.g[server._SYNC_COL].docs:
            d.pop("ultimo_contacto", None)
    return await server.cuadrante_sync_hoja(Peticion(llave, {"hoja": "CUADRANTE OGA5", "hoja_id": "x" * 30,
                                                             "pestanas": list(pestanas)}))


SEMANA_ANA = ["1", "1", "1", "1", "1", "N/T", "N/T"] * 2
SEMANA_LUIS = ["N/T", "N/T", "1", "1", "1", "1", "1"] * 2


# ── Lo puro ──────────────────────────────────────────────────────────────────

def test_el_1_rosa_de_la_hoja_es_el_extra_de_la_app():
    assert server._sync_canon("1", extra=True) == server._sync_canon("EXTRA") == "EXTRA"
    assert server._sync_canon(1.0) == "1"
    assert server._sync_canon("V", hora="05:43") == "V@05:43"
    assert server._sync_valor_hoja("EXTRA") == (1, True)          # un NÚMERO: su fila de RUTAS es una suma
    assert server._sync_valor_hoja("1") == (1, False)
    assert server._sync_valor_hoja("V@05:43") == ("V (05:43)", False)


@pytest.mark.parametrize("S,A,B,prot,esperado", [
    ("1", "1", None, "", ("igual", "")),
    ("N/T", "1", None, "", ("a_app", "primera")),               # la primera vez manda la hoja
    ("N/T", "1", "1", "", ("a_app", "hoja")),                   # solo cambió la hoja
    ("1", "N/T", "1", "", ("a_hoja", "app")),                   # solo cambió la app
    ("V", "N/T", "1", "", ("a_app", "conflicto")),              # las dos: la hoja
    ("1", "N/T APROB", "1", "aprobado", ("a_hoja", "aprobado")),
    ("APROBADO", "N/T APROB", None, "aprobado", ("igual", "")),  # las dos formas del día concedido
    ("1", "SUSP", None, "suspension", ("a_hoja", "suspension")),
    ("", "1", "1", "", ("nada", "")),                           # vaciar la hoja no borra la app
    ("", "N/T", "1", "", ("a_hoja", "app")),                    # pero lo que cambia la app llega a una celda vacía
    ("", "1", None, "", ("nada", "")),
    ("EXTRA", "", "EXTRA", "", ("a_hoja", "quitado")),          # la app lo quitó: si no se vacía, volvería
    ("1", "", None, "", ("a_app", "nuevo")),
    ("1", "", "N/T", "", ("a_app", "nuevo")),
])
def test_quien_gana_en_cada_celda(S, A, B, prot, esperado):
    assert server._sync_decide(S, A, B, prot) == esperado


def test_maximas():
    assert server._sync_decide_maxima(44, 48, None) == "a_app"
    assert server._sync_decide_maxima(44, 44, None) == "igual"
    assert server._sync_decide_maxima(48, 44, 48) == "a_hoja"
    assert server._sync_decide_maxima(None, 44, 48) == "a_hoja"
    assert server._sync_decide_maxima(None, 44, None) == "nada"


def test_la_pestana_con_solo_numeros_toma_el_mes_de_las_letras_de_la_semana():
    """Como «12 A 26» de OGA5: 1..31 y 1, 2 debajo de «J V S D…». El 10-10 «el mes más cercano a hoy» habría puesto
    del 01-09 al 02-10: un mes entero corrido."""
    dias = [(dt.date(2026, 10, 1) + dt.timedelta(days=i)).isoformat() for i in range(33)]
    p = pestana({"ANA PEREZ": ["1"] * 33}, dias=dias, con_fechas=False)
    for ref in (dt.date(2026, 10, 10), dt.date(2026, 10, 18), dt.date(2026, 10, 31)):
        leida = cx.leer_pestanas([p], ref)["pestanas"][0]
        assert (leida["fechas"][0], leida["fechas"][-1], leida["fechas_seguras"]) == ("2026-10-01", "2026-11-02", True)
    sin_letras = {**p, "valores": p["valores"][1:], "fondos": p["fondos"][1:]}
    assert cx.leer_pestanas([sin_letras], dt.date(2026, 10, 18))["pestanas"][0]["fechas_seguras"] is False


def test_la_diaria_de_un_solo_dia_se_salta_y_se_dice():
    diaria = {"nombre": "DIARIO", "valores": [["Orden", "Nombre", 14], [1, "ANA PEREZ", "N/T"], [2, "LUIS", 1]],
              "fondos": []}
    r = cx.leer_pestanas([diaria, pestana({"ANA PEREZ": SEMANA_ANA})], dt.date(2026, 10, 18))
    assert [p["hoja"] for p in r["pestanas"]] == ["OCTUBRE"]
    assert r["saltadas"][0]["nombre"] == "DIARIO"


# ── De punta a punta ─────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_en_prueba_cuenta_pero_no_toca_nada(nave):
    llave = await conectar(modo="prueba")
    r = await sync(llave, pestana({"ANA PEREZ LOPEZ": SEMANA_ANA}, maximas={DIAS[7]: 44}))
    assert r["modo"] == "prueba" and r["escribir"] == []
    assert "Modo prueba" in r["mensaje"] and "15 celdas en Flota" in r["mensaje"]      # 14 días y la máxima
    assert nave.t.shifts.docs == [] and nave.t.route_demand.docs == []
    conf = nave.g[server._SYNC_COL].docs[0]
    assert conf["ultima"]["a_app"] == 14 and conf["ultima"]["maximas_app"] == 1
    assert not nave.t[server._SYNC_BASE].docs                     # la prueba no deja base


@pytest.mark.asyncio(loop_scope="session")
async def test_la_primera_vez_manda_la_hoja_y_lo_protegido_vuelve_a_ella(nave):
    t = nave.t
    poner(t, "d1", DIAS[6], "1")                                   # la app decía que Ana trabajaba el domingo
    poner(t, "d1", DIAS[8], "N/T APROB", aprobado_req="q1", fijada=True)   # día concedido en la app
    poner(t, "d2", DIAS[9], "SUSP", suspension_id="s1", fijada=True)      # Luis, suspendido
    t.suspensiones.docs.append({"id": "s1", "driver_id": "d2", "desde": DIAS[9], "hasta": DIAS[9], "estado": "activa"})
    llave = await conectar()
    p = pestana({"ANA PEREZ LOPEZ": SEMANA_ANA, "LUIS GOMEZ RIAL": SEMANA_LUIS}, maximas={DIAS[7]: 44})
    r = await sync(llave, p, nave=nave)
    assert turno(t, "d1", DIAS[6])["cod"] == "N/T"                  # la hoja manda
    assert turno(t, "d1", DIAS[0])["cod"] == "1" and turno(t, "d2", DIAS[0])["cod"] == "N/T"
    assert turno(t, "d1", DIAS[8])["cod"] == "N/T APROB"            # lo concedido no se pisa…
    assert turno(t, "d2", DIAS[9])["cod"] == "SUSP"                 # …ni la suspensión
    w = {(x["fila"], x["col"]): x for x in r["escribir"]}           # …y vuelven a la hoja con su nota
    assert w[(fila_de(p, "ANA PEREZ LOPEZ"), col_de(DIAS[8]))]["valor"] == "N/T APROB"
    assert "día concedido en la app" in w[(fila_de(p, "ANA PEREZ LOPEZ"), col_de(DIAS[8]))]["nota"]
    assert w[(fila_de(p, "LUIS GOMEZ RIAL"), col_de(DIAS[9]))]["valor"] == "SUSP"
    assert len(r["escribir"]) == 2
    assert t.route_demand.docs[0]["maximo"] == 44
    assert any(c["que"].startswith("Sincronizar con Google Sheets") for c in t[server._CUA_CAMBIOS].docs)


@pytest.mark.asyncio(loop_scope="session")
async def test_despues_cada_cambio_va_hacia_donde_se_hizo(nave):
    t = nave.t
    llave = await conectar()
    p = pestana({"ANA PEREZ LOPEZ": SEMANA_ANA, "LUIS GOMEZ RIAL": SEMANA_LUIS}, maximas={DIAS[7]: 48})
    await sync(llave, p, nave=nave)
    # En la hoja: de 48 piden 44, y Ana pasa a N/T el lunes 19.
    p2 = pestana({"ANA PEREZ LOPEZ": ["N/T" if i == 7 else c for i, c in enumerate(SEMANA_ANA)],
                  "LUIS GOMEZ RIAL": SEMANA_LUIS}, maximas={DIAS[7]: 44})
    # En la app, a la vez: Luis pasa a V el martes 20.
    poner(t, "d2", DIAS[8], "V")
    r = await sync(llave, p2, nave=nave)
    assert turno(t, "d1", DIAS[7])["cod"] == "N/T"
    assert t.route_demand.docs[0]["maximo"] == 44
    assert [(x["fila"], x["col"], x["valor"]) for x in r["escribir"]] == [
        (fila_de(p2, "LUIS GOMEZ RIAL"), col_de(DIAS[8]), "V")]
    assert "cambiado en la app" in r["escribir"][0]["nota"]
    # El script lo escribe; la siguiente vez todo coincide y no se mueve nada.
    p3 = pestana({"ANA PEREZ LOPEZ": ["N/T" if i == 7 else c for i, c in enumerate(SEMANA_ANA)],
                  "LUIS GOMEZ RIAL": ["V" if i == 8 else c for i, c in enumerate(SEMANA_LUIS)]}, maximas={DIAS[7]: 44})
    r = await sync(llave, p3, nave=nave)
    assert r["escribir"] == [] and r["mensaje"] == "Todo igual en Flota y en la hoja."
    # La máxima cambiada en la app también llega a la hoja, a su fila.
    t.route_demand.docs[0]["maximo"] = 46
    r = await sync(llave, p3, nave=nave)
    assert [(x["fila"], x["col"], x["valor"]) for x in r["escribir"]] == [
        (len(p3["valores"]), col_de(DIAS[7]), 46)]


@pytest.mark.asyncio(loop_scope="session")
async def test_el_extra_aprobado_va_en_rosa_y_si_se_quita_se_vacia(nave):
    t = nave.t
    llave = await conectar()
    p = pestana({"ANA PEREZ LOPEZ": SEMANA_ANA})
    await sync(llave, p, nave=nave)
    # Un refuerzo aprobado en la app: el sábado 24, que libraba.
    poner(t, "d1", DIAS[12], "EXTRA", aprobado_req="q9", fijada=True, extra=False)
    r = await sync(llave, p, nave=nave)
    w = r["escribir"][0]
    assert (w["valor"], w["fondo"]) == (1, "#ff66cc")
    # El script lo pone en rosa; leído de vuelta, es lo mismo y no se mueve.
    p2 = pestana({"ANA PEREZ LOPEZ": ["1" if i == 12 else c for i, c in enumerate(SEMANA_ANA)]},
                 rosas=[("ANA PEREZ LOPEZ", DIAS[12])])
    assert (await sync(llave, p2, nave=nave))["escribir"] == []
    # Se desaprueba y el día vuelve a lo de antes (no había nada): en la hoja se vacía y se le quita el rosa.
    t.shifts.docs.remove(turno(t, "d1", DIAS[12]))
    poner(t, "d1", DIAS[12], "N/T")
    r = await sync(llave, p2, nave=nave)
    w = r["escribir"][0]
    assert (w["valor"], w["fondo"]) == ("N/T", "")


@pytest.mark.asyncio(loop_scope="session")
async def test_una_celda_vacia_en_la_hoja_no_borra_y_un_codigo_raro_no_se_mete(nave):
    t = nave.t
    poner(t, "d1", DIAS[3], "V")
    llave = await conectar()
    cods = list(SEMANA_ANA)
    cods[3], cods[4] = None, "1.EXTRA"
    r = await sync(llave, pestana({"ANA PEREZ LOPEZ": cods}), nave=nave)
    assert turno(t, "d1", DIAS[3])["cod"] == "V"                    # vacía en la hoja: se queda lo de la app
    assert turno(t, "d1", DIAS[4]) is None                          # «1.EXTRA» no se sabe qué es: no entra
    conf = nave.g[server._SYNC_COL].docs[0]
    assert conf["ultima"]["codigos_desconocidos"] == {"1.EXTRA": 1}
    assert not any(x["col"] == col_de(DIAS[3]) for x in r["escribir"])


@pytest.mark.asyncio(loop_scope="session")
async def test_lo_masivo_se_retiene_hasta_aceptarlo(nave):
    t = nave.t
    personas = {f"PERSONA NUMERO {k}": ["1"] * 14 for k in range(8)}
    for k in range(8):
        t.drivers.docs.append({"id": f"p{k}", "name": f"PERSONA NUMERO {k}", "center": "OGA5", "active": True})
    llave = await conectar()
    await sync(llave, pestana(personas), nave=nave)                  # al activar se acepta lo de la prueba
    assert turno(t, "p0", DIAS[0])["cod"] == "1"
    # Alguien ordena mal la hoja y 112 celdas pasan a N/T de golpe.
    r = await sync(llave, pestana({k: ["N/T"] * 14 for k in personas}), nave=nave)
    assert "Retenido" in r["mensaje"] and r["escribir"] == []
    assert turno(t, "p0", DIAS[0])["cod"] == "1"
    await server.cuadrante_sync_aceptar({"center": "OGA5"}, OFI)
    await sync(llave, pestana({k: ["N/T"] * 14 for k in personas}), nave=nave)
    assert turno(t, "p0", DIAS[0])["cod"] == "N/T"
    assert nave.g[server._SYNC_COL].docs[0]["forzar_una_vez"] is False      # solo esa vez


@pytest.mark.asyncio(loop_scope="session")
async def test_los_nombres_que_no_casan_se_dicen_y_la_hoja_de_otro_centro_no_entra(nave):
    llave = await conectar()
    r = await sync(llave, pestana({"ANA PEREZ LOPEZ": SEMANA_ANA, "LUIS GOMEZ RIAL": SEMANA_LUIS,
                                   "PERSONA DESCONOCIDA": SEMANA_ANA}), nave=nave)
    assert nave.g[server._SYNC_COL].docs[0]["ultima"]["sin_ficha"] == ["PERSONA DESCONOCIDA"]
    assert turno(nave.t, "d1", DIAS[0]) is not None
    # Una hoja con la gente de otro centro no se usa.
    for k in range(6):
        nave.t.drivers.docs.append({"id": f"g{k}", "name": f"GENTE DE DGA {k}", "center": "DGA1", "active": True})
    r = await sync(llave, pestana({f"GENTE DE DGA {k}": ["1"] * 14 for k in range(6)}), nave=nave)
    assert not r["ok"] and "ninguna pestaña" in r["mensaje"]
    assert "DGA1" in nave.g[server._SYNC_COL].docs[0]["ultima"]["pestanas"][0]["motivo"]


@pytest.mark.asyncio(loop_scope="session")
async def test_la_llave(nave):
    with pytest.raises(HTTPException) as e:
        await server.cuadrante_sync_hoja(Peticion(""))
    assert e.value.status_code == 401
    llave = await conectar()
    conf = nave.g[server._SYNC_COL].docs[0]
    assert llave.startswith("fs_") and conf["token_hash"] != llave and llave not in str(conf)
    assert conf["db_name"] == server._current_db_name.get()
    estado = await server.cuadrante_sync_estado("OGA5", OFI)
    assert estado["conectado"] and "token_hash" not in estado and estado["modo"] == "activo"
    # Volver a conectar hace otra llave: la de antes deja de valer.
    nueva = await conectar()
    with pytest.raises(HTTPException) as e:
        await sync(llave, pestana({"ANA PEREZ LOPEZ": SEMANA_ANA}), nave=nave)
    assert e.value.status_code == 401
    await server.cuadrante_sync_desconectar({"center": "OGA5"}, OFI)
    with pytest.raises(HTTPException) as e:
        await sync(nueva, pestana({"ANA PEREZ LOPEZ": SEMANA_ANA}), nave=nave)
    assert e.value.status_code == 401
    assert (await server.cuadrante_sync_estado("OGA5", OFI)) == {"conectado": False}


@pytest.mark.asyncio(loop_scope="session")
async def test_quien_puede_conectarla(nave):
    for quien, codigo in ((SIN_CUADRANTE, 403), (OTRO_CENTRO, 403)):
        with pytest.raises(HTTPException) as e:
            await server.cuadrante_sync_conectar({"center": "OGA5"}, quien)
        assert e.value.status_code == codigo
    r = await server.cuadrante_sync_conectar({"center": "OGA5"}, OFI)
    assert r["llave"] in r["script"] and "@OnlyCurrentDoc" in r["script"]
    assert "/api/cuadrante/sync/hoja" in r["script"] and "cuadrante de OGA5" in r["script"]
    assert nave.g[server._SYNC_COL].docs[0]["modo"] == "prueba"    # siempre empieza en prueba


@pytest.mark.asyncio(loop_scope="session")
async def test_no_se_llama_dos_veces_seguidas(nave):
    llave = await conectar()
    await sync(llave, pestana({"ANA PEREZ LOPEZ": SEMANA_ANA}), nave=nave)
    with pytest.raises(HTTPException) as e:
        await sync(llave, pestana({"ANA PEREZ LOPEZ": SEMANA_ANA}))
    assert e.value.status_code == 429
