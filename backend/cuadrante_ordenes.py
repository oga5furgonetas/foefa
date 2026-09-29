# -*- coding: utf-8 -*-
"""LAS ÓRDENES DEL CUADRANTE — lo que se escribe en el chat o en la nota de cada
persona, convertido en algo que el motor (`cuadrante_motor.py`) sabe aplicar.

Funciones PURAS (sin base de datos). Probado en `tests/test_cuadrante_ordenes.py`.

POR QUÉ HAY UN INTÉRPRETE SIN IA DELANTE DE GEMINI
══════════════════════════════════════════════════════════════════════════════
La clave de Gemini es del nivel gratuito y se agota casi a diario (~20
peticiones por modelo). Un chat del cuadrante que se queda mudo a media mañana
no sirve. Así que lo de todos los días —«Juanmi esta semana no puede», «dale
libre a Taofik el sábado», «Kevin nunca los martes», «el viernes ponme +3»—
lo entiende este fichero al instante y sin gastar nada. Solo cuando la frase
no encaja con seguridad se pregunta a Gemini, y si Gemini tampoco está, se dice
claramente que no se ha entendido. NUNCA se aplica nada sin que una persona
pulse «Confirmar»: el intérprete propone, no decide.

Y la regla de oro de la casa, «sin falsos positivos»: con un nombre que encaja
con dos personas no se elige ninguna, se pregunta. Con una nota que tiene un
trozo que no se sabe aplicar, se dice qué trozo es en vez de ignorarlo.
"""
from __future__ import annotations

import datetime as dt
import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple

DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
_DIA_N = {"lunes": 0, "martes": 1, "miercoles": 2, "jueves": 3, "viernes": 4,
          "sabado": 5, "sabados": 5, "domingo": 6, "domingos": 6}
_DIA_RE = r"(?:lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)"
_NUM = {"un": 1, "uno": 1, "una": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5,
        "seis": 6, "siete": 7}
_NUM_RE = r"(?:\d{1,2}|un|uno|una|dos|tres|cuatro|cinco|seis|siete)"
_MESES = {"enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
          "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
          "noviembre": 11, "diciembre": 12}
_MES_RE = r"(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)"

# Códigos que se pueden poner con una orden (los demás son de la oficina).
AUSENCIAS = {"N/D", "BAJA", "V", "APROBADO", "N/P"}
AUSENCIAS_TODAS = AUSENCIAS | {"N/T APROB", "COMP", "SUSP"}


def norm(s: str) -> str:
    """minúsculas, sin tildes, sin signos raros y con un espacio entre palabras.
    La ñ pasa a n («mañana» -> «manana»): da igual para entender órdenes."""
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode()
    s = s.lower().replace("\n", " . ")
    s = re.sub(r"[^a-z0-9+?/:.,;\- ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _num(x: str) -> Optional[int]:
    x = (x or "").strip()
    if x.isdigit():
        return int(x)
    return _NUM.get(x)


def _dias_de(texto: str) -> List[int]:
    return sorted({_DIA_N[m] for m in re.findall(_DIA_RE, texto)})


def lista_dias(dias) -> str:
    nombres = [DIAS[d] for d in sorted(set(dias))]
    if len(nombres) <= 1:
        return "".join(nombres)
    return ", ".join(nombres[:-1]) + " y " + nombres[-1]


# ══════════════════════════════════════════════════════════════════════════
# 1. LA NOTA DE CADA PERSONA
# ══════════════════════════════════════════════════════════════════════════

_RELLENO_NOTA = {
    "este", "esta", "ese", "esa", "el", "la", "los", "las", "lo", "le", "les", "que", "y",
    "e", "o", "ni", "de", "del", "a", "al", "en", "por", "pero", "tambien", "tb", "solo",
    "solamente", "siempre", "se", "su", "sus", "es", "son", "un", "una", "con", "para",
    "porque", "ya", "si", "trabaja", "trabajar", "dias", "dia", "semana", "semanas",
    "puede", "va", "hace", "tiene", "quiere", "chico", "chica", "persona", "conductor",
    "conductora", "nota", "ojo", "cuidado", "mejor", "vale", "ok", "hay", "como",
    "mucho", "maximo", "max", "nunca", "no", "curra", "viene", "libra", "le", "pongas",
    "metas", "des", "cada", "x", "por", "horario", "fijo", "entre", "turno",
}


def interpretar_nota(texto: str) -> Dict[str, Any]:
    """La nota de una persona -> reglas del motor.

    Devuelve {"reglas": {dias_semana?, max_seguidos?, dias_no?, sin_extra?},
    "entendido": [frases], "sin_entender": "trozo que no se sabe aplicar"}.
    """
    t = norm(texto)
    reglas: Dict[str, Any] = {}
    usados: List[Tuple[int, int]] = []

    def usa(m):
        usados.append(m.span())

    # Días seguidos: «máximo 3 días seguidos», «no más de 2 seguidos».
    for m in re.finditer(r"(?:max(?:imo)?|como mucho|no mas de|hasta|solo)\s+(" + _NUM_RE
                         + r")\s+(?:dias?\s+)?seguid\w*", t):
        n = _num(m.group(1))
        if n and 1 <= n <= 6:
            reglas["max_seguidos"] = n
            usa(m)
    for m in re.finditer(r"(" + _NUM_RE + r")\s+dias?\s+seguid\w*\s+(?:como mucho|maximo|max)", t):
        n = _num(m.group(1))
        if n and 1 <= n <= 6:
            reglas["max_seguidos"] = n
            usa(m)
    # Días alternos: «alternos», «alternados», «nunca dos seguidos».
    semanas_alternas = re.search(r"semanas?\s+altern\w*|altern\w*\s+(?:de\s+)?semanas?|semana si", t)
    if not semanas_alternas:
        for m in re.finditer(r"(?:(?:en|a|los|dias|trabaja)\s+)*altern\w*", t):
            reglas["max_seguidos"] = 1
            usa(m)
    for m in re.finditer(r"(?:nunca|no)\s+(?:puede\s+|trabaja\s+|curra\s+|hace\s+)?(?:trabajar\s+)?dos\s+(?:dias\s+)?seguid\w*", t):
        reglas["max_seguidos"] = 1
        usa(m)
    # Días por semana: «solo trabaja 4 días», «4 días a la semana».
    for m in re.finditer(r"(?:(?:solo|solamente|unicamente|trabaja|hace|curra|viene|maximo|max)\s+)*("
                         + _NUM_RE + r")\s+dias?\b(?!\s+seguid)(?:\s+(?:a|por|x|cada|en)\s+(?:la\s+)?semanas?"
                         r"|\s*/\s*semana|\s+semanales)?", t):
        n = _num(m.group(1))
        if n and 1 <= n <= 6 and not re.search(r"\bdel?\s*$", t[:m.start()]):
            if n != 5:
                reglas["dias_semana"] = n
            usa(m)
    # Días que nunca trabaja.
    lista = _DIA_RE + r"(?:\s*(?:,|y|ni|o)\s*(?:los\s+|el\s+)?" + _DIA_RE + r")*"
    for m in re.finditer(r"(?:nunca|no puede|no trabaja|no curra|no viene|libra siempre|siempre libra|"
                         r"libra todos|no le pongas|no le toca)\s+(?:(?:a\s+)?trabajar\s+)?(?:(?:los|el|en|todos los)\s+)?(" + lista + r")", t):
        reglas["dias_no"] = sorted(set(reglas.get("dias_no", [])) | set(_dias_de(m.group(1))))
        usa(m)
    for m in re.finditer(r"(?:nunca|no puede|no trabaja|no curra|no viene|libra siempre|siempre libra|libra)\s+"
                         r"(?:(?:los|el|en)\s+)?(?:fines? de semana|findes?)", t):
        reglas["dias_no"] = sorted(set(reglas.get("dias_no", [])) | {5, 6})
        usa(m)
    # Solo unos días: «solo fines de semana», «de martes a sábado», «entre semana».
    solo_dias = None
    m = re.search(r"(?:solo|solamente|unicamente)\s+(?:trabaja\s+|puede\s+|viene\s+|curra\s+)?"
                  r"(?:(?:los|el|en)\s+)?(fines? de semana|findes?)", t)
    if m:
        solo_dias = {5, 6}
        usa(m)
    m = re.search(r"(?:solo\s+)?(?:trabaja\s+|curra\s+|viene\s+)?(?:solo\s+)?entre semana", t)
    if m:
        solo_dias = {0, 1, 2, 3, 4}
        usa(m)
    m = re.search(r"(?:(?:solo|trabaja|curra|viene|horario)\s+)*(?:fijo\s+)?de\s+(" + _DIA_RE + r")\s+a\s+(" + _DIA_RE + r")", t)
    if m:
        a, b = _DIA_N[m.group(1)], _DIA_N[m.group(2)]
        solo_dias = set(range(a, b + 1)) if a <= b else set(range(a, 7)) | set(range(0, b + 1))
        usa(m)
    if solo_dias is None:
        m = re.search(r"(?:solo|solamente|unicamente)\s+(?:trabaja\s+|puede\s+|viene\s+|curra\s+)?(?:(?:los|el|en)\s+)?(" + lista + r")", t)
        if m:
            solo_dias = set(_dias_de(m.group(1)))
            usa(m)
    if solo_dias:
        reglas["dias_no"] = sorted(set(reglas.get("dias_no", [])) | (set(range(7)) - solo_dias))
    # Sin días extra.
    for m in re.finditer(r"(?:sin|no le (?:pongas|metas|des)|nunca|no hace|no quiere|no)\s+(?:(?:hace|haga|hacer)\s+)?(?:dias?\s+)?extras?", t):
        reglas["sin_extra"] = True
        usa(m)

    # ¿Qué ha quedado sin entender?
    resto = list(t)
    for a, b in usados:
        for i in range(a, b):
            resto[i] = " "
    palabras = [p for p in re.split(r"[\s,.;:]+", "".join(resto)) if p]
    sobrantes = [p for p in palabras if p not in _RELLENO_NOTA and not p.isdigit()]
    sin_entender = ""
    if semanas_alternas:
        sin_entender = "semanas alternas"
    elif sobrantes:
        sin_entender = " ".join(sobrantes)
    if reglas.get("dias_no") and len(reglas["dias_no"]) >= 7:
        reglas.pop("dias_no")
        sin_entender = (sin_entender + " (no puede ningún día)").strip()
    return {"reglas": reglas, "entendido": describir_reglas(reglas), "sin_entender": sin_entender}


def describir_reglas(reglas: Dict[str, Any]) -> List[str]:
    out = []
    if reglas.get("dias_semana"):
        out.append(f"Trabaja {reglas['dias_semana']} días por semana, sin día extra")
    ms = reglas.get("max_seguidos")
    if ms == 1:
        out.append("Días alternos: nunca dos días seguidos")
    elif ms:
        out.append(f"Como mucho {ms} días seguidos")
    if reglas.get("dias_no"):
        out.append("Nunca trabaja " + lista_dias(reglas["dias_no"]))
    if reglas.get("sin_extra") and not reglas.get("dias_semana"):
        out.append("Sin días extra")
    return out


# ══════════════════════════════════════════════════════════════════════════
# 2. PERSONAS Y FECHAS DENTRO DE UNA FRASE
# ══════════════════════════════════════════════════════════════════════════

# Palabras de un nombre que no identifican a nadie en una frase.
_NO_NOMBRE = {"de", "del", "la", "las", "los", "da", "do", "dos", "das", "y", "e", "san",
              "el", "mar", "sol", "luz", "paz", "dia", "dias", "rey", "flor", "leal", "blanco",
              "negro", "moreno", "rubio", "sierra", "vega", "campo", "campos", "prado",
              "iglesias", "cruz", "leon", "mayo", "abril", "junio", "julio", "santos"}


def _palabras(nombre: str) -> List[str]:
    return [p for p in norm(nombre).replace(",", " ").replace(".", " ").split()
            if len(p) > 2 and p not in _NO_NOMBRE]


def personas_en(texto: str, personas: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Quién se nombra en la frase. Cada mención: {"ids": [...], "texto": ...}.
    Una mención con varios ids es AMBIGUA: hay que preguntar."""
    t = norm(texto)
    tokens = [(m.group(0), m.start()) for m in re.finditer(r"[a-z0-9]+", t)]
    candidatos = []   # (id, puntos, posiciones)
    for p in personas:
        pos, puntos = set(), 0
        for apodo in p.get("apodos") or []:
            a = norm(apodo)
            if not a:
                continue
            for m in re.finditer(r"(?<![a-z0-9])" + re.escape(a) + r"(?![a-z0-9])", t):
                pos.update(range(m.start(), m.end()))
                puntos = max(puntos, 10)
        vistas = set()
        for w in _palabras(p.get("nombre") or ""):
            for tok, ini in tokens:
                if tok == w and w not in vistas:
                    vistas.add(w)
                    pos.update(range(ini, ini + len(tok)))
        puntos = max(puntos, len(vistas))
        if puntos:
            candidatos.append((p["id"], puntos, pos))
    # Agrupar las que compiten por el mismo trozo de la frase.
    grupos: List[Dict[str, Any]] = []
    for cid, puntos, pos in candidatos:
        sitio = None
        for g in grupos:
            if g["pos"] & pos:
                sitio = g
                break
        if sitio is None:
            grupos.append({"pos": set(pos), "cands": [(cid, puntos)]})
        else:
            sitio["pos"] |= pos
            sitio["cands"].append((cid, puntos))
    out = []
    for g in grupos:
        mejor = max(p for _, p in g["cands"])
        ids = [c for c, p in g["cands"] if p == mejor]
        ini, fin = min(g["pos"]), max(g["pos"]) + 1
        out.append({"ids": ids, "texto": t[ini:fin], "inicio": ini})
    out.sort(key=lambda x: x["inicio"])
    return out


def _siguiente(hoy: dt.date, dia_semana: int, incluir_hoy=False) -> dt.date:
    delta = (dia_semana - hoy.weekday()) % 7
    if delta == 0 and not incluir_hoy:
        delta = 7
    return hoy + dt.timedelta(days=delta)


def _fecha_num(dia: int, mes: Optional[int], hoy: dt.date) -> Optional[dt.date]:
    try:
        if mes:
            f = dt.date(hoy.year, mes, dia)
            if f < hoy - dt.timedelta(days=60):
                f = dt.date(hoy.year + 1, mes, dia)
            return f
        f = dt.date(hoy.year, hoy.month, dia)
        if f < hoy:                      # «el 3» a día 29 es el 3 del mes que viene
            m = hoy.month + 1
            f = dt.date(hoy.year + (m > 12), (m - 1) % 12 + 1, dia)
        return f
    except ValueError:
        return None


def fechas_en(texto: str, hoy: dt.date) -> Dict[str, Any]:
    """Las fechas de una frase: {"dias": [...], "desde", "hasta", "semana"} (lo que haya)."""
    t = norm(texto)
    manana = hoy + dt.timedelta(days=1)
    out: Dict[str, Any] = {"dias": []}

    def punto(s: str) -> Optional[dt.date]:
        s = s.strip()
        if s in ("hoy",):
            return hoy
        if s in ("manana",):
            return manana
        if s in ("pasado manana",):
            return hoy + dt.timedelta(days=2)
        # «el viernes 9»: manda el número, que es lo exacto.
        m = re.fullmatch(r"(?:el\s+|este\s+)?" + _DIA_RE + r"\s+(?:dia\s+)?(\d{1,2})(?:\s*(?:/|-)\s*(\d{1,2}))?"
                         r"(?:\s+de\s+(" + _MES_RE + r"))?", s)
        if m:
            mes = int(m.group(2)) if m.group(2) else (_MESES[m.group(3)] if m.group(3) else None)
            return _fecha_num(int(m.group(1)), mes, hoy)
        m = re.fullmatch(r"(?:el\s+|este\s+|proximo\s+|el proximo\s+)?(" + _DIA_RE + r")(?:\s+que viene)?", s)
        if m:
            return _siguiente(hoy, _DIA_N[m.group(1)])
        m = re.fullmatch(r"(?:el\s+)?(?:dia\s+)?(\d{1,2})(?:\s*(?:/|-)\s*(\d{1,2}))?(?:\s+de\s+(" + _MES_RE + r"))?", s)
        if m:
            mes = int(m.group(2)) if m.group(2) else (_MESES[m.group(3)] if m.group(3) else None)
            return _fecha_num(int(m.group(1)), mes, hoy)
        return None

    P = (r"(hoy|pasado manana|manana|(?:el\s+|este\s+)?" + _DIA_RE + r"\s+(?:dia\s+)?\d{1,2}(?:\s*(?:/|-)\s*\d{1,2})?"
         r"(?:\s+de\s+" + _MES_RE + r")?|(?:el\s+|este\s+|proximo\s+)?" + _DIA_RE +
         r"(?:\s+que viene)?|(?:el\s+)?(?:dia\s+)?\d{1,2}(?:\s*(?:/|-)\s*\d{1,2})?(?:\s+de\s+" + _MES_RE + r")?)")
    m = re.search(r"\b(?:del|de|desde el|desde)\s+" + P + r"\s+(?:al|a|hasta el|hasta)\s+" + P, t)
    if m:
        a, b = punto(m.group(1)), punto(m.group(2))
        if a and b:
            if b < a and re.fullmatch(r"(?:el\s+)?(?:dia\s+)?\d{1,2}", m.group(2).strip()):
                b = _fecha_num(int(re.sub(r"\D", "", m.group(2))), None, a)
            if a and b and b >= a:
                out["desde"], out["hasta"] = a, b
                t = t[:m.start()] + " " + t[m.end():]
    m = re.search(r"\b(?:la\s+)?semana\s+del\s+(\d{1,2})(?:\s*(?:/|-)\s*(\d{1,2}))?", t)
    if m and "desde" not in out:
        f = _fecha_num(int(m.group(1)), int(m.group(2)) if m.group(2) else None, hoy)
        if f:
            lun = f - dt.timedelta(days=f.weekday())
            out["desde"], out["hasta"] = max(lun, manana), lun + dt.timedelta(days=6)
            out["semana"] = lun
            t = t[:m.start()] + " " + t[m.end():]
    if "desde" not in out:
        if re.search(r"\b(?:la\s+)?(?:semana que viene|proxima semana|semana proxima|semana siguiente)", t):
            lun = hoy - dt.timedelta(days=hoy.weekday()) + dt.timedelta(days=7)
            out["desde"], out["hasta"], out["semana"] = lun, lun + dt.timedelta(days=6), lun
        elif re.search(r"\besta semana\b", t):
            lun = hoy - dt.timedelta(days=hoy.weekday())
            if hoy.weekday() == 6:
                lun += dt.timedelta(days=7)
            out["desde"], out["hasta"], out["semana"] = max(manana, lun), lun + dt.timedelta(days=6), lun
        elif re.search(r"\b(?:este|el)\s+(?:finde|fin de semana)\b", t):
            sab = _siguiente(hoy, 5, incluir_hoy=True)
            if hoy.weekday() == 6:
                sab = hoy - dt.timedelta(days=1)
            out["dias"] = [d for d in (sab, sab + dt.timedelta(days=1)) if d >= hoy]
    m = re.search(r"\bdesde\s+(?:el\s+)?" + P, t)
    if m and "desde" not in out:
        f = punto(m.group(1))
        if f:
            out["desde"] = f
            t = t[:m.start()] + " " + t[m.end():]
    m = re.search(r"\bhasta\s+(?:el\s+)?" + P, t)
    if m and "hasta" not in out:
        f = punto(m.group(1))
        if f:
            out["hasta"] = f
            t = t[:m.start()] + " " + t[m.end():]
    # Días sueltos. Primero «el viernes 9» (el número manda), y se tacha del
    # texto para que el «viernes» suelto no se lea luego como el próximo.
    for m in list(re.finditer(r"\b(?:el\s+|este\s+)?" + _DIA_RE + r"\s+(?:dia\s+)?\d{1,2}(?:\s*(?:/|-)\s*\d{1,2})?"
                              r"(?:\s+de\s+" + _MES_RE + r")?\b", t))[::-1]:
        f1 = punto(m.group(0))
        if f1 and f1 not in out["dias"]:
            out["dias"].append(f1)
        t = t[:m.start()] + " " * (m.end() - m.start()) + t[m.end():]
    for m in re.finditer(r"\b(hoy|pasado manana|manana)\b|\b(?:el\s+|este\s+|proximo\s+)?(" + _DIA_RE
                         + r")\b|\b(?:el\s+|dia\s+|el dia\s+)(\d{1,2})(?:\s*(?:/|-)\s*(\d{1,2}))?(?:\s+de\s+(" + _MES_RE + r"))?"
                         r"|\b(\d{1,2})\s*/\s*(\d{1,2})\b|\b(\d{1,2})\s+de\s+(" + _MES_RE + r")", t):
        if m.group(1):
            f = punto(m.group(1))
        elif m.group(2):
            if re.match(r"\s*(?:,|y|ni|o)?\s*$", t[m.end():m.end() + 1]) and re.search(
                    r"\b(?:nunca|siempre|todos los|los)\s*$", t[:m.start()]):
                f = None                  # «nunca los martes» no es una fecha
            else:
                f = _siguiente(hoy, _DIA_N[m.group(2)])
        elif m.group(3):
            mes = int(m.group(4)) if m.group(4) else (_MESES[m.group(5)] if m.group(5) else None)
            f = _fecha_num(int(m.group(3)), mes, hoy)
        elif m.group(6):
            f = _fecha_num(int(m.group(6)), int(m.group(7)), hoy)
        else:
            f = _fecha_num(int(m.group(8)), _MESES[m.group(9)], hoy)
        if f and f not in out["dias"]:
            out["dias"].append(f)
    out["dias"].sort()
    return out


# ══════════════════════════════════════════════════════════════════════════
# 3. EL CHAT SIN IA
# ══════════════════════════════════════════════════════════════════════════

def _rango(f: Dict[str, Any], hoy: dt.date, fin_periodo: dt.date,
           por_defecto_hasta_fin=False) -> Optional[Tuple[dt.date, dt.date]]:
    if f.get("desde") or f.get("hasta"):
        a = f.get("desde") or (f["dias"][0] if f.get("dias") else hoy + dt.timedelta(days=1))
        b = f.get("hasta") or (fin_periodo if por_defecto_hasta_fin else a)
        return (a, b) if b >= a else None
    if f.get("dias"):
        return f["dias"][0], f["dias"][-1]
    return None


def _fmt(d: dt.date) -> str:
    return d.strftime("%d/%m")


def interpretar_mensaje(texto: str, ctx: Dict[str, Any]) -> Dict[str, Any]:
    """Una orden del chat -> {"resumen", "acciones", "seguro": bool}.

    `seguro` dice si se ha entendido del todo (intención, personas y fechas).
    Si no, el servidor prueba con Gemini antes de enseñar esto.
    ctx: {"hoy": date, "desde": date, "hasta": date, "personas": [{id, nombre,
    apodos}], "celdas": {"id|fecha": cod}, "maximas": {fecha: n}, "colchon": 2}
    """
    hoy = ctx["hoy"]
    fin_periodo = ctx.get("hasta") or hoy + dt.timedelta(days=13)
    t = norm(texto)
    personas = ctx.get("personas") or []
    nombre = {p["id"]: p.get("nombre") or p["id"] for p in personas}
    menciones = personas_en(texto, personas)
    amb = [m for m in menciones if len(m["ids"]) > 1]
    ids = [m["ids"][0] for m in menciones if len(m["ids"]) == 1]
    f = fechas_en(texto, hoy)

    def pregunta(txt, opciones=None):
        return {"resumen": txt, "seguro": True,
                "acciones": [{"accion": "preguntar", "texto": txt, "opciones": opciones or []}]}

    # ── Preguntas ────────────────────────────────────────────────────────────
    if "?" in texto or re.match(r"^(?:quien|quienes|cuantos|cuantas|que|como|cual|cuando)\b", t):
        return _responder(t, f, ctx)

    if amb:
        g = amb[0]
        return pregunta(f"¿A quién te refieres con «{g['texto']}»?",
                        [{"id": i, "nombre": nombre[i]} for i in g["ids"]])

    acciones: List[Dict[str, Any]] = []
    resumen: List[str] = []
    no_recalcular = bool(re.search(r"no (?:lo )?recalcul|no rehagas|todavia no|aun no", t))

    def necesita_personas():
        return pregunta("¿De quién hablas? No he encontrado el nombre en el cuadrante.")

    # ── Se ha ido ──
    if re.search(r"se (?:ha ido|va|fue|marcha|ha marchado)|ya no (?:esta|trabaja|viene)|deja la empresa|"
                 r"baja (?:voluntaria|definitiva)|lo (?:hemos )?(?:echado|despedido)|despedid|finiquito", t):
        if not ids:
            return necesita_personas()
        desde = f.get("desde") or (f["dias"][0] if f["dias"] else hoy + dt.timedelta(days=1))
        for cid in ids:
            acciones.append({"accion": "baja_definitiva", "conductor_id": cid, "desde": desde.isoformat()})
        resumen.append(", ".join(nombre[i] for i in ids) + f" deja{'n' if len(ids) > 1 else ''} el cuadrante desde el {_fmt(desde)}")
    # ── Vuelve de la baja ──
    elif re.search(r"vuelve|se reincorpora|reincorpor|le dan el alta|le han dado el alta|ya (?:esta|puede) (?:bien|trabajar)|alta medica", t) \
            and not re.search(r"nuevo|ha entrado|empieza", t):
        if not ids:
            return necesita_personas()
        fecha = f.get("desde") or (f["dias"][0] if f["dias"] else hoy + dt.timedelta(days=1))
        for cid in ids:
            acciones.append({"accion": "vuelve_de_baja", "conductor_id": cid, "fecha": fecha.isoformat()})
        resumen.append(", ".join(nombre[i] for i in ids) + f" vuelve{'n' if len(ids) > 1 else ''} el {_fmt(fecha)}")
    # ── Conductor nuevo ──
    elif re.search(r"(?:conductor|conductora|chico|chica|persona)\s+nuev|nuev[oa]\s+(?:conductor|conductora)|ha entrado|ha empezado|entra (?:un|una)|alta de", t):
        m = re.search(r"(?:nuev[oa]|entrado|alta de|entra (?:un|una)(?: conductor| conductora)?)[,:\s]+(?:conductor(?:a)?[,:\s]+)?([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+){0,3})", texto)
        if not m:
            return pregunta("¿Cómo se llama la persona nueva? Escríbelo con nombre y apellido.")
        nom = m.group(1).strip()
        alta = f.get("desde") or (f["dias"][0] if f["dias"] else hoy + dt.timedelta(days=1))
        tipo = "finde" if re.search(r"fin(?:es)? de semana|finde", t) else \
            "empresa" if re.search(r"horario fijo|de lunes a viernes|plantilla", t) else "normal"
        acciones.append({"accion": "nuevo_conductor", "nombre": nom, "tipo": tipo, "alta_desde": alta.isoformat()})
        resumen.append(f"Alta de {nom} ({'solo fines de semana' if tipo == 'finde' else 'horario fijo' if tipo == 'empresa' else 'normal'}) desde el {_fmt(alta)}")
    # ── Regla para siempre: «nunca los martes» ──
    elif re.search(r"\b(?:nunca|siempre libra|libra siempre|todos los)\b", t) and re.search(_DIA_RE + r"|finde|fines de semana", t) \
            and not f.get("desde"):
        if not ids:
            return necesita_personas()
        dias = _dias_de(t)
        if re.search(r"finde|fines de semana", t):
            dias = sorted(set(dias) | {5, 6})
        for cid in ids:
            acciones.append({"accion": "regla_fija", "conductor_id": cid, "dias": dias,
                             "nota": f"Nunca trabaja {lista_dias(dias)}."})
        resumen.append(", ".join(nombre[i] for i in ids) + f": nunca trabaja{'n' if len(ids) > 1 else ''} {lista_dias(dias)} (para siempre)")
    # ── Límite de días en una semana ──
    elif re.search(r"(?:maximo|como mucho|solo|no mas de)\s+" + _NUM_RE + r"\s+dias?", t) and ids:
        n = _num(re.search(r"(?:maximo|como mucho|solo|no mas de)\s+(" + _NUM_RE + r")\s+dias?", t).group(1))
        base = f.get("semana") or f.get("desde") or (f["dias"][0] if f["dias"] else hoy + dt.timedelta(days=1))
        lun = base - dt.timedelta(days=base.weekday())
        for cid in ids:
            acciones.append({"accion": "limite_semana", "conductor_id": cid, "lunes": lun.isoformat(), "max_dias": n})
        resumen.append(", ".join(nombre[i] for i in ids) + f": como mucho {n} días la semana del {_fmt(lun)}")
    # ── Colchón: «el viernes ponme +3» ──
    elif re.search(r"\+\s*\d|colchon|por encima", t) and not ids:
        m = re.search(r"\+\s*(\d)|colchon\s+(?:de\s+)?\+?\s*(\d)|(\d)\s+por encima", t)
        if not m:
            return pregunta("¿Cuántas rutas por encima de la máxima quieres?")
        n = int(next(g for g in m.groups() if g))
        dias = _dias_rango(f)
        if dias:
            for d in dias:
                acciones.append({"accion": "colchon_dia", "fecha": d.isoformat(), "colchon": n})
            resumen.append(f"+{n} el " + ", ".join(_fmt(d) for d in dias))
        else:
            acciones.append({"accion": "cambiar_colchon", "colchon": n})
            resumen.append(f"A partir de ahora, +{n} todos los días")
    # ── La máxima de un día ──
    elif re.search(r"\bmaxim[ao]s?\b", t) and not ids:
        m = re.search(r"\bmaxim[ao]s?\b(?:\s+(?:del?|el|es|son|va a ser|sera|de)){0,3}\s+(?:[a-z]+\s+){0,3}?(\d{2,3})\b", t) \
            or re.search(r"(\d{2,3})\s+(?:de\s+)?maxim", t)
        dias = _dias_rango(f)
        if not m or not dias:
            return pregunta("¿Qué máxima y para qué día? Por ejemplo: «la máxima del viernes 9 es 45».")
        n = int(m.group(1))
        for d in dias:
            acciones.append({"accion": "cambiar_maxima", "fecha": d.isoformat(), "maxima": n})
        resumen.append(f"Máxima {n} el " + ", ".join(_fmt(d) for d in dias))
    # ── Dale libre / que trabaje ──
    elif re.search(r"\bdale (?:el )?(?:dia )?libre\b|\bdale fiesta\b|\bque libre\b|\blibra el\b|\blibrar el\b|"
                   r"\bdale descanso\b|\bque descanse\b|\bquitale el dia\b|\bdale el dia\b", t):
        if not ids:
            return necesita_personas()
        dias = _dias_rango(f)
        if not dias:
            return pregunta("¿Qué día le das libre?")
        for cid in ids:
            for d in dias:
                acciones.append({"accion": "fijar_dia", "conductor_id": cid, "fecha": d.isoformat(), "valor": "N/T"})
        resumen.append(", ".join(nombre[i] for i in ids) + (" libran" if len(ids) > 1 else " libra")
                       + " el " + ", ".join(_fmt(d) for d in dias))
    elif re.search(r"\bque trabaje\b|\bponle a trabajar\b|\bpon(?:lo|la|le)? a trabajar\b|\bque venga\b|"
                   r"\bque haga (?:el )?(?:dia|ruta)\b|\bmetele\b", t):
        if not ids:
            return necesita_personas()
        dias = _dias_rango(f)
        if not dias:
            return pregunta("¿Qué día tiene que trabajar?")
        for cid in ids:
            for d in dias:
                acciones.append({"accion": "fijar_dia", "conductor_id": cid, "fecha": d.isoformat(), "valor": "1"})
        resumen.append(", ".join(nombre[i] for i in ids) + (" trabajan" if len(ids) > 1 else " trabaja")
                       + " el " + ", ".join(_fmt(d) for d in dias))
    # ── Ausencias: baja, vacaciones, no puede ──
    elif re.search(r"\bde baja\b|baja medica|esta malo|esta mala|enferm|\bbaja\b", t):
        if not ids:
            return necesita_personas()
        r = _rango(f, hoy, fin_periodo, por_defecto_hasta_fin=True) or (hoy + dt.timedelta(days=1), fin_periodo)
        for cid in ids:
            acciones.append({"accion": "marcar_ausencia", "conductor_id": cid, "desde": r[0].isoformat(),
                             "hasta": r[1].isoformat(), "codigo": "BAJA"})
        resumen.append(", ".join(nombre[i] for i in ids) + f" de baja del {_fmt(r[0])} al {_fmt(r[1])}")
        if not f.get("hasta"):
            resumen.append("Cuando sepas la fecha de alta, dímela")
    elif re.search(r"vacacion", t):
        if not ids:
            return necesita_personas()
        r = _rango(f, hoy, fin_periodo)
        if not r:
            return pregunta("¿De qué día a qué día son las vacaciones?")
        for cid in ids:
            acciones.append({"accion": "marcar_ausencia", "conductor_id": cid, "desde": r[0].isoformat(),
                             "hasta": r[1].isoformat(), "codigo": "V"})
        resumen.append(", ".join(nombre[i] for i in ids) + f" de vacaciones del {_fmt(r[0])} al {_fmt(r[1])}")
    elif re.search(r"no (?:puede|podra|viene|vendra|esta disponible|va a poder|estara)|no disponible|imposible", t):
        if not ids:
            return necesita_personas()
        r = _rango(f, hoy, fin_periodo)
        if not r:
            return pregunta("¿Qué días no puede?")
        for cid in ids:
            acciones.append({"accion": "marcar_ausencia", "conductor_id": cid, "desde": r[0].isoformat(),
                             "hasta": r[1].isoformat(), "codigo": "N/D"})
        resumen.append(", ".join(nombre[i] for i in ids) + f" no puede{'n' if len(ids) > 1 else ''} del {_fmt(r[0])} al {_fmt(r[1])}"
                       if r[0] != r[1] else ", ".join(nombre[i] for i in ids) + f" no puede el {_fmt(r[0])}")
    # ── Una nota para esa persona ──
    elif re.search(r"\b(?:apunta|anota|nota)\b", t) and ids:
        cuerpo = re.sub(r"^.*?\b(?:apunta|anota|nota)\b\s*(?:que\s+)?", "", texto, flags=re.I)
        for cid in ids:
            acciones.append({"accion": "nota", "conductor_id": cid, "texto": cuerpo.strip()})
        resumen.append(f"Nota para {', '.join(nombre[i] for i in ids)}: «{cuerpo.strip()}»")
    # ── Solo recalcular ──
    elif re.search(r"recalcul|rehaz|rehacer|recalibr|vuelve a hacer|haz(?:me)? el cuadrante|cuadra(?:me)? el", t):
        pass
    else:
        return {"resumen": "", "acciones": [], "seguro": False}

    cambia = any(a["accion"] not in ("responder", "preguntar") for a in acciones)
    quiere = bool(re.search(r"recalcul|rehaz|rehacer|recalibr|vuelve a hacer|haz(?:me)? el cuadrante|cuadra", t))
    if (cambia or quiere) and not no_recalcular:
        acciones.append({"accion": "recalcular"})
        resumen.append("y rehago el cuadrante")
    elif cambia and no_recalcular:
        resumen.append("sin rehacer el cuadrante todavía")
    if not acciones:
        return {"resumen": "", "acciones": [], "seguro": False}
    txt = ". ".join(r for r in resumen if r)
    return {"resumen": txt[:1].upper() + txt[1:] + ".", "acciones": acciones, "seguro": True}


def _dias_rango(f: Dict[str, Any]) -> List[dt.date]:
    if f.get("desde") and f.get("hasta"):
        n = (f["hasta"] - f["desde"]).days
        return [f["desde"] + dt.timedelta(days=i) for i in range(n + 1)] if 0 <= n <= 31 else []
    return list(f.get("dias") or ([f["desde"]] if f.get("desde") else []))


_RUTA = {"1", "T", "X", "EXTRA"}
_TRABAJA = {"1", "T", "X", "EXTRA", "BKP", "S", "RA", "RIDE"}
_LIBRA = {"N/T", "L", "N/T APROB", "APROBADO", "COMP"}
_FUERA = {"BAJA": "de baja", "V": "de vacaciones", "N/D": "no disponibles", "N/P": "no presentados",
          "SUSP": "suspendidos"}


def _responder(t: str, f: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    """Preguntas sobre el cuadrante, contestadas con los datos, sin inventar."""
    hoy = ctx["hoy"]
    personas = ctx.get("personas") or []
    celdas = ctx.get("celdas") or {}
    extras = ctx.get("extras") or set()
    nombre = {p["id"]: p.get("nombre") or p["id"] for p in personas}

    def cod(cid, d):
        return str(celdas.get(f"{cid}|{d.isoformat()}") or "")

    def resp(txt):
        return {"resumen": txt, "seguro": True, "acciones": [{"accion": "responder", "texto": txt}]}

    dias = _dias_rango(f)
    if re.search(r"quien(?:es)?\s+(?:libra|libran|descansa|no trabaja|tiene libre|esta libre)", t):
        if not dias:
            return resp("¿Qué día? Por ejemplo: «¿quién libra el sábado?».")
        partes = []
        for d in dias[:7]:
            # «Libra» es el día libre (N/T, aprobado, compensa). Quien está de
            # baja, de vacaciones o no disponible NO libra: se cuenta aparte. Y
            # quien ya se fue no cuenta: la primera versión metía entre los que
            # libraban a los que dejaron el cuadrante el día 1 (tenían N/D).
            vivos = [p for p in personas if p.get("tipo") != "inactivo"
                     and not (p.get("inactivo_desde") and p["inactivo_desde"] <= d.isoformat())]
            libres = sorted(nombre[p["id"]] for p in vivos if cod(p["id"], d) in _LIBRA)
            fuera: Dict[str, int] = {}
            for p in vivos:
                c = cod(p["id"], d)
                if c in _FUERA:
                    fuera[_FUERA[c]] = fuera.get(_FUERA[c], 0) + 1
            txt = (f"El {DIAS[d.weekday()]} {_fmt(d)} libran {len(libres)}: " + ", ".join(libres)
                   if libres else f"El {DIAS[d.weekday()]} {_fmt(d)} no libra nadie")
            if fuera:
                txt += ". No están: " + ", ".join(f"{n} {k}" for k, n in fuera.items())
            partes.append(txt)
        return resp(". ".join(partes) + ".")
    if re.search(r"quien(?:es)?\s+(?:trabaja|trabajan|sale|salen|va|van|esta|estan)", t):
        if not dias:
            return resp("¿Qué día? Por ejemplo: «¿quién trabaja el lunes?».")
        partes = []
        for d in dias[:3]:
            van = sorted(nombre[p["id"]] for p in personas if cod(p["id"], d) in _RUTA)
            mx = (ctx.get("maximas") or {}).get(d.isoformat())
            partes.append(f"El {DIAS[d.weekday()]} {_fmt(d)} salen {len(van)}"
                          + (f" (máxima {mx})" if mx else "") + ": " + ", ".join(van))
        return resp(". ".join(partes) + ".")
    if re.search(r"cuant[oa]s?\s+(?:dias\s+)?extras?", t):
        a, b = (dias[0], dias[-1]) if dias else (ctx.get("desde") or hoy, ctx.get("hasta") or hoy)
        if re.search(r"esta semana", t) and not dias:
            a = hoy - dt.timedelta(days=hoy.weekday())
            b = a + dt.timedelta(days=6)
        n = [k for k in extras if a.isoformat() <= k.split("|")[1] <= b.isoformat()]
        por = {}
        for k in n:
            por.setdefault(k.split("|")[1], []).append(nombre.get(k.split("|")[0], "?"))
        det = "; ".join(f"{_fmt(dt.date.fromisoformat(d))}: " + ", ".join(sorted(v)) for d, v in sorted(por.items()))
        return resp(f"Del {_fmt(a)} al {_fmt(b)} hay {len(n)} días extra" + (f". {det}." if det else "."))
    if re.search(r"(?:mas|mayor)\s+(?:dias\s+)?seguid|racha", t):
        filas = []
        for p in personas:
            run = 0
            d = hoy
            while cod(p["id"], d) in _TRABAJA and run < 60:
                run += 1
                d -= dt.timedelta(days=1)
            if run:
                filas.append((run, nombre[p["id"]]))
        filas.sort(reverse=True)
        if not filas:
            return resp("Hoy nadie lleva días seguidos trabajando.")
        top = ", ".join(f"{n} ({r})" for r, n in filas[:5])
        return resp(f"Más días seguidos hasta hoy: {top}.")
    if re.search(r"cuant[oa]s?\s+(?:rutas|salen|trabajan|van|gente|personas|conductores)", t):
        if not dias:
            dias = [hoy + dt.timedelta(days=1)]
        partes = []
        for d in dias[:7]:
            n = sum(1 for p in personas if cod(p["id"], d) in _RUTA)
            mx = (ctx.get("maximas") or {}).get(d.isoformat())
            partes.append(f"el {DIAS[d.weekday()]} {_fmt(d)} {n} rutas" + (f", máxima {mx} ({n - mx:+d})" if mx else ""))
        return resp("Hay " + "; ".join(partes) + ".")
    return {"resumen": "", "acciones": [], "seguro": False}


# ══════════════════════════════════════════════════════════════════════════
# 4. VALIDAR LO QUE LLEGUE (de aquí o de Gemini) Y CONTARLO EN CRISTIANO
# ══════════════════════════════════════════════════════════════════════════

ACCIONES = {"marcar_ausencia", "quitar_ausencia", "vuelve_de_baja", "baja_definitiva",
            "nuevo_conductor", "fijar_dia", "limite_semana", "colchon_dia", "cambiar_colchon",
            "cambiar_maxima", "regla_fija", "quitar_regla", "nota", "recalcular",
            "responder", "preguntar"}


def _iso(x) -> Optional[str]:
    try:
        return dt.date.fromisoformat(str(x)[:10]).isoformat()
    except (TypeError, ValueError):
        return None


def validar_acciones(acciones: Any, personas: List[Dict[str, Any]],
                     hoy: dt.date) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Solo pasa lo que tiene sentido: conductor que existe, fechas válidas y
    no más atrás de ayer, códigos de la lista. Lo demás se dice, no se aplica."""
    por_id = {p["id"]: p for p in personas}
    por_nombre = {norm(p.get("nombre") or ""): p["id"] for p in personas}
    ok, malas = [], []
    if not isinstance(acciones, list):
        return [], ["La respuesta no traía una lista de acciones."]
    ayer = (hoy - dt.timedelta(days=1)).isoformat()
    for a in acciones[:40]:
        if not isinstance(a, dict):
            continue
        acc = str(a.get("accion") or a.get("tipo_accion") or "").strip()
        if acc not in ACCIONES:
            malas.append(f"Acción desconocida: {acc or '(vacía)'}")
            continue
        b = {"accion": acc}
        if acc in ("marcar_ausencia", "quitar_ausencia", "vuelve_de_baja", "baja_definitiva",
                   "fijar_dia", "limite_semana", "regla_fija", "quitar_regla", "nota"):
            cid = str(a.get("conductor_id") or "").strip()
            if cid not in por_id:
                cid = por_nombre.get(norm(a.get("conductor") or a.get("nombre") or cid), "")
            if cid not in por_id:
                malas.append(f"{acc}: no encuentro a esa persona en el cuadrante")
                continue
            b["conductor_id"] = cid
        if acc in ("marcar_ausencia", "quitar_ausencia"):
            d, h = _iso(a.get("desde")), _iso(a.get("hasta") or a.get("desde"))
            if not d or not h or h < d:
                malas.append(f"{acc}: fechas no válidas")
                continue
            if d < ayer:
                malas.append(f"{acc}: no se cambian días ya pasados")
                continue
            if (dt.date.fromisoformat(h) - dt.date.fromisoformat(d)).days > 92:
                malas.append(f"{acc}: más de tres meses de golpe")
                continue
            b.update(desde=d, hasta=h)
            if acc == "marcar_ausencia":
                codigo = str(a.get("codigo") or "N/D").strip().upper()
                if codigo not in AUSENCIAS:
                    malas.append(f"Código no permitido: {codigo}")
                    continue
                b["codigo"] = codigo
        elif acc in ("vuelve_de_baja",):
            f = _iso(a.get("fecha") or a.get("desde"))
            if not f:
                malas.append("vuelve_de_baja: falta la fecha")
                continue
            b["fecha"] = f
        elif acc == "baja_definitiva":
            f = _iso(a.get("desde") or a.get("fecha"))
            if not f:
                malas.append("baja_definitiva: falta la fecha")
                continue
            b["desde"] = f
        elif acc == "nuevo_conductor":
            nom = " ".join(str(a.get("nombre") or "").split())[:80]
            if len(nom) < 3:
                malas.append("nuevo_conductor: falta el nombre")
                continue
            tipo = str(a.get("tipo") or a.get("tipo_conductor") or "normal")
            b.update(nombre=nom, tipo=tipo if tipo in ("normal", "empresa", "finde") else "normal",
                     alta_desde=_iso(a.get("alta_desde")) or (hoy + dt.timedelta(days=1)).isoformat())
            if isinstance(a.get("patron"), list):
                b["patron"] = sorted({int(x) for x in a["patron"] if str(x).isdigit() and 0 <= int(x) <= 6})
        elif acc == "fijar_dia":
            f = _iso(a.get("fecha"))
            v = str(a.get("valor") or "").strip().upper()
            if not f or v not in ("1", "N/T"):
                malas.append("fijar_dia: fecha o valor no válidos")
                continue
            if f < ayer:
                malas.append("fijar_dia: no se cambian días ya pasados")
                continue
            b.update(fecha=f, valor=v)
        elif acc == "limite_semana":
            f = _iso(a.get("lunes") or a.get("fecha"))
            try:
                n = int(a.get("max_dias"))
            except (TypeError, ValueError):
                n = -1
            if not f or not 0 <= n <= 6:
                malas.append("limite_semana: semana o número de días no válidos")
                continue
            lun = dt.date.fromisoformat(f)
            b.update(lunes=(lun - dt.timedelta(days=lun.weekday())).isoformat(), max_dias=n)
        elif acc == "colchon_dia":
            f = _iso(a.get("fecha"))
            try:
                n = int(a.get("colchon"))
            except (TypeError, ValueError):
                n = -1
            if not f or not 0 <= n <= 10:
                malas.append("colchon_dia: día o colchón no válidos")
                continue
            b.update(fecha=f, colchon=n)
        elif acc == "cambiar_colchon":
            try:
                n = int(a.get("colchon"))
            except (TypeError, ValueError):
                n = -1
            if not 0 <= n <= 10:
                malas.append("cambiar_colchon: colchón no válido")
                continue
            b["colchon"] = n
        elif acc == "cambiar_maxima":
            f = _iso(a.get("fecha"))
            try:
                n = int(a.get("maxima"))
            except (TypeError, ValueError):
                n = -1
            if not f or not 0 <= n <= 999:
                malas.append("cambiar_maxima: día o máxima no válidos")
                continue
            b.update(fecha=f, maxima=n)
        elif acc == "regla_fija":
            dias = a.get("dias") or []
            dias = sorted({int(x) for x in dias if str(x).strip().isdigit() and 0 <= int(x) <= 6}) \
                if isinstance(dias, list) else []
            if not dias:
                malas.append("regla_fija: faltan los días de la semana")
                continue
            b.update(dias=dias, nota=str(a.get("nota") or f"Nunca trabaja {lista_dias(dias)}.")[:200])
        elif acc == "quitar_regla":
            if isinstance(a.get("dias"), list):
                b["dias"] = sorted({int(x) for x in a["dias"] if str(x).strip().isdigit() and 0 <= int(x) <= 6})
        elif acc == "nota":
            txt = str(a.get("texto") or "").strip()[:500]
            if not txt:
                malas.append("nota: está vacía")
                continue
            b["texto"] = txt
        elif acc == "recalcular":
            for k in ("desde", "hasta"):
                if _iso(a.get(k)):
                    b[k] = _iso(a.get(k))
        elif acc in ("responder", "preguntar"):
            b["texto"] = str(a.get("texto") or "").strip()[:1500]
            if acc == "preguntar" and isinstance(a.get("opciones"), list):
                b["opciones"] = [o for o in a["opciones"][:8] if isinstance(o, (str, dict))]
        ok.append(b)
    return ok, malas


_NOMBRE_COD = {"N/D": "N/D (no disponible)", "BAJA": "BAJA", "V": "vacaciones",
               "APROBADO": "APROBADO", "N/P": "N/P"}


def describir(a: Dict[str, Any], personas: List[Dict[str, Any]]) -> str:
    """Una línea que se entiende sin saber nada de la app."""
    nom = {p["id"]: p.get("nombre") or p["id"] for p in personas}.get(a.get("conductor_id"), "")

    def f(x):
        return dt.date.fromisoformat(x).strftime("%d/%m")

    acc = a["accion"]
    if acc == "marcar_ausencia":
        rango = f"el {f(a['desde'])}" if a["desde"] == a["hasta"] else f"del {f(a['desde'])} al {f(a['hasta'])}"
        return f"{nom} → {_NOMBRE_COD.get(a['codigo'], a['codigo'])} {rango}"
    if acc == "quitar_ausencia":
        return f"{nom} → quitar ausencias del {f(a['desde'])} al {f(a['hasta'])}"
    if acc == "vuelve_de_baja":
        return f"{nom} → vuelve de la baja el {f(a['fecha'])}"
    if acc == "baja_definitiva":
        return f"{nom} → deja el cuadrante desde el {f(a['desde'])}"
    if acc == "nuevo_conductor":
        t = {"finde": "solo fines de semana", "empresa": "horario fijo"}.get(a.get("tipo"), "normal")
        return f"Alta: {a['nombre']} ({t}) desde el {f(a['alta_desde'])}"
    if acc == "fijar_dia":
        return f"{nom} → {'trabaja' if a['valor'] == '1' else 'libra'} el {f(a['fecha'])} (fijado)"
    if acc == "limite_semana":
        return f"{nom} → como mucho {a['max_dias']} días la semana del {f(a['lunes'])}"
    if acc == "colchon_dia":
        return f"El {f(a['fecha'])} → +{a['colchon']} sobre la máxima"
    if acc == "cambiar_colchon":
        return f"Todos los días → +{a['colchon']} sobre la máxima"
    if acc == "cambiar_maxima":
        return f"Máxima del {f(a['fecha'])} → {a['maxima']}"
    if acc == "regla_fija":
        return f"{nom} → nunca trabaja {lista_dias(a['dias'])} (regla fija)"
    if acc == "quitar_regla":
        return f"{nom} → quitar su regla fija" + (f" de {lista_dias(a['dias'])}" if a.get("dias") else "")
    if acc == "nota":
        return f"{nom} → nota: «{a['texto']}»"
    if acc == "recalcular":
        return "Rehacer el cuadrante"
    return a.get("texto") or ""


PROMPT_SISTEMA = """Eres el asistente del cuadrante de conductores de una empresa de reparto.
Tu trabajo es convertir las instrucciones del jefe de tráfico en ACCIONES de la lista.
No calculas el cuadrante: eso lo hace el motor. No inventes conductores ni fechas.

Acciones (campo "accion"):
- marcar_ausencia: conductor_id, desde, hasta, codigo (N/D | BAJA | V | APROBADO | N/P)
- quitar_ausencia: conductor_id, desde, hasta
- vuelve_de_baja: conductor_id, fecha
- baja_definitiva: conductor_id, desde            (se ha ido, ya no está)
- nuevo_conductor: nombre, tipo (normal | empresa | finde), alta_desde, patron? [0=lun..6=dom]
- fijar_dia: conductor_id, fecha, valor ("1" trabaja | "N/T" libra)
- limite_semana: conductor_id, lunes, max_dias
- colchon_dia: fecha, colchon                      (rutas por encima de la máxima ese día)
- cambiar_colchon: colchon                         (para todos los días)
- cambiar_maxima: fecha, maxima
- regla_fija: conductor_id, dias [0=lun..6=dom], nota   (nunca trabaja esos días, para siempre)
- quitar_regla: conductor_id, dias?
- nota: conductor_id, texto                        (nota permanente: "solo trabaja 4 días", "días alternos"...)
- recalcular: desde?, hasta?
- responder: texto                                 (para preguntas; solo con los datos que te paso)
- preguntar: texto, opciones?                      (si dudas: nombre ambiguo, fecha poco clara)

Reglas:
- Identifica a cada conductor por nombre, apellido o apodo con la lista que te paso. Usa su id.
  Si hay más de un candidato o ninguno claro, usa "preguntar" con las opciones.
- Fechas en formato AAAA-MM-DD. Convierte las relativas ("esta semana", "el viernes", "mañana",
  "desde el lunes") con la fecha de hoy que te paso. "Esta semana" = de mañana al domingo.
  Las semanas van de lunes a domingo.
- "No puede trabajar" / "no está disponible" = marcar_ausencia con N/D.
- "Está de baja" = marcar_ausencia con BAJA (sin fecha de fin: hasta el fin del periodo, y dilo).
- "Se ha ido" / "ya no está" = baja_definitiva.
- "Nunca puede X día" / "siempre libra X" = regla_fija. "Este X no puede" = marcar_ausencia.
  Si no está claro si es puntual o para siempre, pregunta.
- "Dale libre" = fijar_dia con N/T. "Que trabaje" = fijar_dia con 1.
- Nunca cambies días ya pasados ni el de hoy salvo que te lo pidan explícitamente.
- No toques APROBADO, V ni BAJA existentes salvo orden explícita.
- Tras cualquier acción que cambie datos, añade al final {"accion": "recalcular"} salvo que digan
  que no recalcules.
- Responde SIEMPRE y SOLO en JSON: {"resumen": "frase corta en español de lo que vas a hacer",
  "acciones": [ ... ]}"""
