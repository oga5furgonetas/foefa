# -*- coding: utf-8 -*-
"""La scorecard de ESTA semana, dia a dia (`/scorecard/hoy`, 21-09-2026).

Dani: «hoy es lunes, vas bien en esto y esto, tienes 99,54 % de DCR y ya tienes
los puntos de DCR... el miercoles: ahora estas en Fair, pero si consigues X en
cada cosa eres Fantastic». Lo que se prueba aqui es lo que, si se rompe, da un
numero FALSO sin ningun error: puntos mal repartidos, una metrica que no se
mide hoy contada como medida, o un dia sin clasificar leido como perfecto.

Se ejecuta la funcion REAL de `server.py` (gotcha 40), con umbrales de una nave.
"""
import ast
import io
import json
import math
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
_TEXTO = io.open(RAIZ / "server.py", encoding="utf-8-sig").read()
_ARBOL = ast.parse(_TEXTO)

_FUNCS = ("_interp", "_metric_subscore", "_sc_tier", "_sc_next_target", "_overall_score",
          "_score_to_tier", "_sc_fmt", "_sc_hoy_construir", "_bandas_desde_sls", "_sls_publicado",
          "_sc_hoy_tier", "_sc_hoy_calibrar")
_CONSTS = ("_SC_METRICS", "_SC_SEED_WEIGHTS", "_SC_SEED_THR", "_OVERALL_TIER_BANDS",
           "_SC_HOY_VIVAS", "_SC_HOY_CAL", "_SC_HOY_MARGEN", "_TIER_ORDER", "_SC_DCR_AMAZON_MAS",
           "_SC_GREAT_FIJO", "_SC_MID_Q", "_SC_SLS_PUBLICADOS")


def _cargar():
    amb = {"math": math, "re": re}
    for n in _ARBOL.body:
        if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") in _CONSTS:
            exec(compile(ast.Module(body=[n], type_ignores=[]), "<s>", "exec"), amb)  # noqa: S102
        if isinstance(n, ast.FunctionDef) and n.name in _FUNCS:
            exec(compile(ast.Module(body=[n], type_ignores=[]), "<s>", "exec"), amb)  # noqa: S102
    faltan = [f for f in _FUNCS + _CONSTS if f not in amb]
    assert not faltan, "no existen en server.py: %s" % faltan
    return amb


A = _cargar()
CONSTRUIR = A["_sc_hoy_construir"]
PESOS = dict(A["_SC_SEED_WEIGHTS"])
THR = {k: dict(v) for k, v in A["_SC_SEED_THR"].items()}
# Umbrales de la propia nave: sin `fantastic_plus`, como salen de la tabla SLS.
for _k in THR:
    THR[_k].pop("fantastic_plus", None)


def _vivo(v, **extra):
    return {"valor": v, "provisional": True, "extra": extra}


def _arr(v, semana=29):
    return {"valor": v, "semana": semana, "origen": "oficial"}


def _m(r, key):
    return next(x for x in r["metricas"] if x["key"] == key)


ARRASTRADOS = {"fico": _arr(839), "speeding": _arr(0), "mentor": _arr(100), "vsa": _arr(100),
               "ndcr": _arr(100), "cec_dpmo": _arr(31), "lor_dpmo": _arr(110),
               "pod": _arr(95), "cc": _arr(97),
               # las tres que SI se miden a diario tambien tienen referencia, pero
               # si estan medidas la referencia NO las pisa:
               "dcr": _arr(90), "dsc_dpmo": _arr(5000), "whc": _arr(50)}


def test_el_dcr_de_99_54_da_todos_los_puntos_de_dcr():
    """Fantastic (>= 99) en DCR: el peso entero. 15,625 puntos con estos pesos."""
    r = CONSTRUIR({"dcr": _vivo(99.54)}, {}, THR, PESOS, {"dias_cerrados": 1})
    dcr = _m(r, "dcr")
    assert dcr["tier"] == "Fantastic" and dcr["fuente"] == "hoy"
    assert dcr["peso"] == 15.625 and abs(dcr["puntos"] - 15.625) < 0.01
    assert dcr["provisional"] is True
    assert r["nota"]["cobertura_medida_hoy"] == 16          # 15,625 % del peso
    assert r["nota"]["score"] == 100.0                       # con Target sin Fantastic Plus, cumplirlo es el 100 % del peso
    # ...pero eso es el DCR, no la nave: con el 16 % del peso medido NO se afirma un tier global
    assert r["nota"]["estimable"] is False
    assert "99,54 %" in r["titulares"][0]["texto"]


def test_lo_arrastrado_es_una_referencia_y_NO_cuenta_como_medido():
    """El 21-09 se mezclaban: el CC de hace nueve semanas puntuaba como si fuera de
    esta. Ahora lo arrastrado no da puntos, ni entra en la nota, ni se llama medido."""
    r = CONSTRUIR({"dcr": _vivo(99.5)}, ARRASTRADOS, THR, PESOS, {"dias_cerrados": 3})
    # DCR es de hoy: el 90 arrastrado NO pisa el valor medido
    assert _m(r, "dcr")["valor"] == 99.5 and _m(r, "dcr")["fuente"] == "hoy"
    # DSC y WHC no se midieron hoy: su valor viejo es solo REFERENCIA, nunca medida
    for k in ("dsc_dpmo", "whc"):
        x = _m(r, k)
        assert x["valor"] is None and x["fuente"] is None and x["puntos"] is None and x["ref"]["semana"] == 29
    # el resto: valor None (no es de esta semana), pero con su referencia y su semana
    fico = _m(r, "fico")
    assert fico["valor"] is None and fico["fuente"] is None and fico["puntos"] is None
    assert fico["ref"]["semana"] == 29 and fico["ref"]["valor"] == 839 and fico["ref"]["puntos"] > 0
    # la nota se hace SOLO con lo medido: 15,625 puntos del DCR y nada mas
    assert r["nota"]["cobertura_medida_hoy"] == 16 and r["nota"]["estimable"] is False
    assert abs(r["nota"]["puntos"] - 15.625) < 0.01, "lo arrastrado esta puntuando"
    # la proyeccion lleva su margen de error y el tier solo se afirma si aguanta
    assert r["proyeccion"]["margen"] == 5.0 and "tier_min" in r["proyeccion"] and "tier_max" in r["proyeccion"]
    # la proyeccion existe, dice que es un supuesto y de que semana sale
    p = r["proyeccion"]
    assert p and p["cobertura_peso"] > 60 and "no es un dato de esta semana" in p["supuesto"]
    assert p["semanas_referencia"] == [29]
    # lo que no se midio sale en sin dato; las referencias, con su referencia
    sd = {s["key"]: s for s in r["sin_dato"]}
    assert {"dsc_dpmo", "whc", "fico"} <= set(sd) and sd["fico"]["referencia"]["semana"] == 29


def test_sin_nada_medido_lo_arrastrado_no_inventa_una_nota():
    """Solo referencias: no hay ninguna metrica de esta semana, luego no hay nota."""
    r = CONSTRUIR({}, ARRASTRADOS, THR, PESOS, {"dias_cerrados": 0})
    assert r["nota"]["score"] is None and r["nota"]["puntos"] == 0
    assert all(x["fuente"] is None and x["puntos"] is None for x in r["metricas"])


# Una nave con la semana regular: lo que llega arrastrado esta en Fair casi todo.
FLOJOS = {"fico": _arr(760), "speeding": _arr(8), "mentor": _arr(78), "vsa": _arr(96.5),
          "ndcr": _arr(92), "cec_dpmo": _arr(100), "lor_dpmo": _arr(110),
          "pod": _arr(92), "cc": _arr(96)}


def test_el_ejemplo_de_dani_fair_ahora_y_lo_que_falta_para_subir():
    """DCR y WHC bien, DSC en Fair y lo demas arrastrado flojo: la nota tiene que
    decir en que tier esta AHORA y que palancas la suben."""
    vivos = {"dcr": _vivo(99.54), "whc": _vivo(100.0), "dsc_dpmo": _vivo(1000)}
    r = CONSTRUIR(vivos, FLOJOS, THR, PESOS, {"dias_cerrados": 3})
    n = r["proyeccion"]                       # medido + el resto como la ultima scorecard
    assert _m(r, "dsc_dpmo")["tier"] == "Fair" and _m(r, "lor_dpmo")["ref"]["tier"] == "Poor"
    assert n["score"] is not None and n["tier"] in ("Fair", "Great"), n
    esc = r["escenarios"]
    # si TODO lo que va por debajo llegara a su objetivo, la nota sube hasta Fantastic
    assert esc["si_todo_fantastic"]["score"] > n["score"] + 10
    assert esc["si_todo_fantastic"]["tier"] in ("Fantastic", "Fantastic Plus")
    # y hay un siguiente escalon con palancas de mas a menos puntos
    sig = esc.get("siguiente")
    assert sig and sig["palancas"] and sig["faltan"] > 0 and sig["tier"] != n["tier"]
    ss = [p["sube_la_nota"] for p in sig["palancas"]]
    assert ss == sorted(ss, reverse=True), "palancas mal ordenadas"
    # las que pesan mas (DSC 15,6 pts) estan entre las primeras
    assert "dsc_dpmo" in [p["key"] for p in sig["palancas"][:3]]
    p0 = sig["palancas"][0]
    assert p0["puntos"] > 0 and p0["a"] is not None and p0["de"] is not None and p0["a_tier"]


def test_los_puntos_cuadran_con_la_nota():
    """Nota = suma de puntos / suma de pesos con dato. Si no cuadra, la pantalla
    enseña dos numeros distintos para lo mismo."""
    vivos = {"dcr": _vivo(98.6), "whc": _vivo(100.0), "dsc_dpmo": _vivo(700)}
    r = CONSTRUIR(vivos, FLOJOS, THR, PESOS, {"dias_cerrados": 4})
    puntos = sum(x["puntos"] for x in r["metricas"] if x["puntos"] is not None)
    pesos = sum(x["peso"] for x in r["metricas"] if x["puntos"] is not None)
    assert pesos == PESOS["dcr"] + PESOS["whc"] + PESOS["dsc_dpmo"], "puntua algo que no es medido"
    assert abs(r["nota"]["puntos"] - round(puntos, 2)) < 0.02
    assert abs(r["nota"]["score"] - round(puntos / pesos * 100, 2)) < 0.05


def test_sin_ningun_dato_no_se_inventa_nota():
    r = CONSTRUIR({}, {}, THR, PESOS, {"dias_cerrados": 0})
    assert r["nota"]["score"] is None and r["nota"]["tier"] is None
    assert r["escenarios"] == {"score": None, "tier": None}
    assert r["titulares"] == [] and len(r["sin_dato"]) == len(r["metricas"]) and r["proyeccion"] is None
    assert r["confianza"] == "baja"


def test_lo_que_ya_esta_en_fantastic_no_sale_como_palanca():
    r = CONSTRUIR({"dcr": _vivo(99.9), "whc": _vivo(100.0), "dsc_dpmo": _vivo(500)},
                  {}, THR, PESOS, {"dias_cerrados": 5})
    palancas = (r["escenarios"].get("siguiente") or {}).get("palancas") or []
    assert not [p for p in palancas if p["key"] in ("dcr", "whc", "dsc_dpmo")]


def test_la_confianza_depende_de_cuantos_dias_hay():
    for dias, esperado in ((0, "baja"), (1, "baja"), (2, "baja"), (3, "media"), (5, "media"), (6, "alta"), (7, "alta")):
        assert CONSTRUIR({"dcr": _vivo(99.0)}, {}, THR, PESOS, {"dias_cerrados": dias})["confianza"] == esperado


def test_un_dcr_por_debajo_dice_que_hace_falta_y_cuantos_puntos():
    r = CONSTRUIR({"dcr": _vivo(98.7)}, {}, THR, PESOS, {"dias_cerrados": 4})
    dcr = _m(r, "dcr")
    assert dcr["tier"] == "Great"
    s = dcr["siguiente"]
    assert s["to_tier"] == "Fantastic" and s["target"] == 99 and s["puntos_extra"] > 0
    assert "Para Fantastic hace falta 99,00 %" in r["titulares"][0]["texto"]


def test_el_formato_es_a_la_española():
    F = A["_sc_fmt"]
    assert F(99.54, "%") == "99,54 %".replace(".", ",") and F(606.4, "DPMO") == "606 DPMO"
    assert F(839.0, "score") == "839" and F(None, "%") == "—"


def test_los_endpoints_y_las_reglas_de_lo_que_se_mide_hoy():
    """El servidor solo mide hoy DCR, DSC y WHC; y un dia sin reporte NO es un
    dia sin defectos (gotcha 25)."""
    src = _TEXTO
    assert '_SC_HOY_VIVAS = ("dcr", "dsc_dpmo", "whc")' in src
    assert 'db.daily_reports.distinct(' in src, "hay que comprobar que el reporte de ese dia entro"
    assert '_SC_HOY_DIAS_DSC' in src and "edad >= _SC_HOY_DIAS_DSC or con_y.get(dia)" in src
    assert '@api_router.get("/scorecard/hoy")' in src and "_user_can_see_center(user, center)" in src


def test_lo_que_falta_por_medir_se_enseña_como_un_rango_y_no_como_una_nota_exacta():
    """OGA5 salia Fantastic (87) sin DCR ni DSC y su ultima oficial fue Fair (69):
    normalizar solo sobre lo medido da nota alta a quien solo tiene datos buenos."""
    vivos = {"whc": _vivo(100.0)}
    r = CONSTRUIR(vivos, FLOJOS, THR, PESOS, {"dias_cerrados": 1})
    rg = r["nota"]["rango"]
    assert rg["min"] < r["nota"]["score"] < rg["max"] + 0.01
    assert rg["max"] - rg["min"] > 10, "DCR y DSC pesan 31 puntos: el abanico no puede ser estrecho"
    assert rg["tier_min"] != rg["tier_max"]
    # con DCR, DSC y WHC medidos sigue faltando el 63 % del peso: lo arrastrado
    # NO cuenta, asi que el abanico sigue abierto
    todo = {"dcr": _vivo(98.6), "whc": _vivo(100.0), "dsc_dpmo": _vivo(700)}
    r2 = CONSTRUIR(todo, FLOJOS, THR, PESOS, {"dias_cerrados": 6})
    g = r2["nota"]["rango"]
    assert r2["nota"]["cobertura_medida_hoy"] == 37 and g["max"] - g["min"] > 10


def test_el_dcr_de_paquetes_es_una_cota_baja_y_lo_dice():
    """Amazon da 0,00-0,66 puntos MAS que entregados/despachados (OGA5, 17 semanas):
    un 98,7 % contado con paquetes puede ser Fantastic en Amazon si el Target es 99,
    y no se afirma un tier que el dato no sostiene."""
    r = CONSTRUIR({"dcr": _vivo(98.7)}, {}, THR, PESOS, {"dias_cerrados": 4})
    d = _m(r, "dcr")
    assert d["tier"] == "Great" and d["cota_alta"] == 99.4 and d["tier_posible"] == "Fantastic"
    assert "Amazon suele dar hasta 0,7 puntos más" in r["titulares"][0]["texto"]
    # cuando aun sumando lo maximo sigue en el mismo tier, no se dice nada
    r2 = CONSTRUIR({"dcr": _vivo(97.6)}, {}, THR, PESOS, {"dias_cerrados": 4})
    assert _m(r2, "dcr")["tier_posible"] is None
    assert "Amazon suele dar" not in r2["titulares"][0]["texto"]


def test_oga5_se_juzga_con_su_target_de_98_y_no_con_el_de_dga1():
    """El fallo de fondo del 21-09: OGA5 nunca tuvo un PDF subido y heredaba los
    umbrales de DGA1 (DCR 99). Con el suyo, un 98,6 % es Fantastic."""
    bandas, sem = A["_sls_publicado"]("AMZL OGA5 SANTIAGO XPT")      # el centro llega sucio (gotcha 6)
    assert sem == 31 and bandas["dcr"]["fantastic"] == 98.0 and bandas["dcr"]["fair"] == 97.0
    thr_oga5 = {k: {b: v[b] for b in ("fantastic", "great", "fair")} for k, v in bandas.items()}
    r = CONSTRUIR({"dcr": _vivo(98.6)}, {}, {**THR, **thr_oga5}, PESOS, {"dias_cerrados": 4})
    assert _m(r, "dcr")["tier"] == "Fantastic"
    r2 = CONSTRUIR({"dcr": _vivo(98.6)}, {}, THR, PESOS, {"dias_cerrados": 4})
    assert _m(r2, "dcr")["tier"] == "Great", "la semilla de DGA1 deberia seguir dando Great"
    # cada nave con el suyo
    assert A["_sls_publicado"]("DGA1")[0]["dcr"]["fantastic"] == 99.0
    assert A["_sls_publicado"]("dga2")[0]["dcr"]["fantastic"] == 98.5
    assert A["_sls_publicado"]("XYZ9") == (None, None) and A["_sls_publicado"]("") == (None, None)


def test_los_umbrales_publicados_son_los_de_la_ultima_scorecard_de_cada_nave():
    """Trinquete contra la copia: si `docs/scorecards.json` (las scorecards
    oficiales leidas del PDF) tiene una semana mas nueva, hay que actualizar la
    constante, no dejarla vieja."""
    fichero = RAIZ.parent / "docs" / "scorecards.json"
    if not fichero.exists():
        return
    todas = json.loads(io.open(fichero, encoding="utf-8").read())
    mapa = {"ce_dpmo": "cec_dpmo", "capacity": "ndcr"}
    for centro, dato in A["_SC_SLS_PUBLICADOS"].items():
        propias = [s for s in todas if s["centro"] == centro]
        ultima = max(propias, key=lambda s: s["semana"])
        assert dato["semana"] == ultima["semana"], "%s: hay una scorecard mas nueva (semana %s)" % (centro, ultima["semana"])
        for k, (t, m) in ultima["sls"].items():
            k = mapa.get(k, k)
            if k in dato["sls"]:
                assert dato["sls"][k] == (t, m), "%s %s: %s != %s" % (centro, k, dato["sls"][k], (t, m))


def test_el_endpoint_usa_los_publicados_solo_si_no_hay_pdf_subido():
    assert "pub, sem_pub = _sls_publicado(center)" in _TEXTO
    i = _TEXTO.index("pub, sem_pub = _sls_publicado(center)")
    assert "if not doc:" in _TEXTO[i - 200:i], "el publicado no puede pisar un PDF subido"


def _observaciones_reales():
    """Las scorecards oficiales (docs/scorecards.json): (real, modelo) de cada una,
    con SUS umbrales y sin fantastic_plus, como sale de Amazon."""
    fichero = RAIZ.parent / "docs" / "scorecards.json"
    if not fichero.exists():
        return None
    mapa = {"fico": "fico", "speeding": "speeding", "mentor": "mentor", "vsa": "vsa", "whc": "whc",
            "ce_dpmo": "cec_dpmo", "dcr": "dcr", "lor_dpmo": "lor_dpmo", "dsc_dpmo": "dsc_dpmo",
            "cc": "cc", "capacity": "ndcr", "pod": "pod"}
    sls_key = {"vsa": "vsa", "fico": "fico", "speeding": "speeding", "ce_dpmo": "cec_dpmo", "capacity": "ndcr",
               "dcr": "dcr", "dsc_dpmo": "dsc_dpmo", "pod": "pod", "cc": "cc", "lor_dpmo": "lor_dpmo"}
    dirs = {m["key"]: m["dir"] for m in A["_SC_METRICS"]}
    out = []
    for sc in json.loads(io.open(fichero, encoding="utf-8").read()):
        if sc.get("overall") is None:
            continue
        b = A["_bandas_desde_sls"]({sls_key[k]: {"target": t, "minimum": m}
                                    for k, (t, m) in sc["sls"].items() if k in sls_key})
        calc = []
        for src, k in mapa.items():
            v = sc.get(src)
            if v is None:
                continue
            thr = {x: (b[k] if k in b else THR[k])[x] for x in ("fantastic", "great", "fair")}
            calc.append({"key": k, "value": v, "thr": thr, "dir": dirs[k]})
        modelo, _d, _u = A["_overall_score"](calc, PESOS)
        if modelo is not None:
            out.append((sc["overall"], modelo, sc["centro"], sc["semana"]))
    return out


def test_la_calibracion_corrige_el_sesgo_del_modelo_contra_las_scorecards_reales():
    """El modelo sin corregir da +5,5 puntos de media (hasta +11 en semanas malas:
    un Fair de 69 salia como Great de 81). Con la recta queda sin sesgo y con un
    error tipico de 2,8. Si alguien toca los pesos o los baremos y esto salta, la
    proyeccion vuelve a mentir a favor."""
    obs = _observaciones_reales()
    if obs is None:
        return
    assert len(obs) >= 85
    bruto = [m - r for r, m, _c, _w in obs]
    cal = [A["_sc_hoy_calibrar"](m) - r for r, m, _c, _w in obs]
    assert sum(bruto) / max(len(bruto), 1) > 4, "el modelo sin corregir ya no sobreestima: revisa la recta"
    assert abs(sum(cal) / max(len(cal), 1)) < 0.5, "la calibracion deja sesgo"
    assert sum(abs(e) for e in cal) / max(len(cal), 1) < 3.3
    # el margen que se da cubre a la gran mayoria de las semanas
    assert sum(abs(e) <= A["_SC_HOY_MARGEN"] for e in cal) / max(len(cal), 1) > 0.8
    # las dos peores semanas de OGA5 (W28, W29: Fair de 69) mejoran mucho, aunque
    # siguen siendo las que mas se escapan: la nota corregida sigue algo alta (75)
    for r, m, c, w in obs:
        if c == "OGA5" and w in (28, 29):
            assert abs(A["_sc_hoy_calibrar"](m) - r) < abs(m - r) - 4


def test_amazon_no_da_fantastic_plus_ni_en_la_nota_ni_en_ninguna_metrica():
    T = A["_sc_hoy_tier"]
    assert T(94.2) == "Fantastic" and T(85) == "Fantastic" and T(84.9) == "Great" and T(70) == "Great"
    assert T(69.9) == "Fair" and T(50) == "Fair" and T(49.9) == "Poor" and T(None) is None
    # horas al 100 % (la semilla traia fantastic_plus) sale Fantastic, y no queda «siguiente» por encima
    thr = {k: dict(v) for k, v in A["_SC_SEED_THR"].items()}       # CON fantastic_plus, como la semilla
    r = CONSTRUIR({"whc": _vivo(100.0)}, {}, thr, PESOS, {"dias_cerrados": 1})
    w = _m(r, "whc")
    assert w["tier"] == "Fantastic" and w["siguiente"] is None and abs(w["puntos"] - PESOS["whc"]) < 0.01
    assert not any("Plus" in str(x) for x in r["titulares"])


def test_el_caso_real_oga5_semana_35_amazon_dijo_fair_68_82():
    """Scorecard oficial W35 de OGA5 (Downloads): Overall 68,82 Fair. Con sus
    valores y los umbrales de OGA5, el modelo sin corregir daba 76,3 (Great)."""
    bandas, _s = A["_sls_publicado"]("OGA5")
    valores = {"fico": 839, "speeding": 0.0, "mentor": 100.0, "vsa": 100.0, "whc": 100.0, "cec_dpmo": 33,
               "dcr": 97.88, "lor_dpmo": 332, "dsc_dpmo": 1559, "cc": 95.56, "ndcr": 100.0}
    dirs = {m["key"]: m["dir"] for m in A["_SC_METRICS"]}
    calc = [{"key": k, "value": v, "dir": dirs[k],
             "thr": {x: (bandas[k] if k in bandas else THR[k])[x] for x in ("fantastic", "great", "fair")}}
            for k, v in valores.items()]
    modelo, _d, _u = A["_overall_score"](calc, PESOS)
    assert 75 < modelo < 78, modelo                           # el fallo: Great
    cal = A["_sc_hoy_calibrar"](modelo)
    assert abs(cal - 68.82) < 3 and A["_sc_hoy_tier"](cal - A["_SC_HOY_MARGEN"]) == "Fair"   # ~70,4: en el corte, y la tarjeta lo dice con el margen
    # y los tiers de cada metrica con los umbrales de OGA5: Amazon dijo Great en DCR 97,88 (la semilla, Fair)
    thr_dcr = {x: bandas["dcr"][x] for x in ("fantastic", "great", "fair")}
    assert A["_sc_tier"](97.88, thr_dcr, 1) == "Great" and A["_sc_tier"](97.88, THR["dcr"], 1) == "Fair"
    assert A["_sc_tier"](1559, {x: bandas["dsc_dpmo"][x] for x in ("fantastic", "great", "fair")}, -1) == "Poor"
