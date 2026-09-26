# -*- coding: utf-8 -*-
"""QUIÉN LLEVA QUÉ FURGONETA — afinidad conductor↔furgoneta y reparto de cada mañana.

Funciones PURAS (sin base de datos): server.py junta los datos y llama aquí.
Probado en `tests/test_afinidad.py`.

POR QUÉ ASÍ Y NO «APRENDER DEL PASADO» SIN MÁS
══════════════════════════════════════════════════════════════════════════════
Medido el 26-09-2026 con el historial real (asignación diaria e inspecciones):
hoy casi nadie repite furgoneta. En OGA5 un conductor lleva la misma que su
último día el 29 % de las veces, y la que más usa es solo el 19 % de sus días;
en DGA1, el 17 %. Un sistema que adivinara la furgoneta por el historial
acertaría menos de dos de cada tres veces en lo poco que se atreviera a
proponer: rellenaría la plantilla con furgonetas equivocadas.

Así que la afinidad se CREA, no se adivina:
  · cada conductor tiene una furgoneta PRINCIPAL y, si se quiere, una
    SECUNDARIA, que pone un jefe (o salen de la propuesta inicial, que sí mira
    el historial para no empezar de cero);
  · la plantilla solo se rellena sola donde hay un motivo (principal o
    secundaria); el historial ORDENA el desplegable y SUGIERE fijas, pero no
    rellena nada por su cuenta;
  · y lo que un jefe pone a mano manda siempre sobre lo que diga esto.

LA PUNTUACIÓN (puntos por pareja conductor↔furgoneta)
══════════════════════════════════════════════════════════════════════════════
  PRINCIPAL      100   (+15 si es el TITULAR de esa furgoneta)
  SECUNDARIA      60
  HISTORIAL    0..30   parte de sus días recientes en esa furgoneta
                       (media vida de 21 días: lo de ayer pesa más que lo de
                       hace dos meses)
  CONTINUIDAD      5   la llevó su último día de trabajo
  RESPONSABILIDAD      nota de 1 a 10 que pone la oficina a cada conductor.
                       Multiplica por lo que vale la furgoneta: ±20 en una
                       nueva, ±16 recién reparada, ±8 normal, ±4 si ya está
                       muy golpeada. 5-6 es neutro. Es juicio de la oficina, así
                       que cuenta siempre.
  GOLPES               lo mismo con los golpes seguros, pero SOLO si se ha
                       comprobado que predicen (ver `cuidado_predice`); con
                       nota y golpes, cuenta la media de los dos.
  VETADA / no operativa (taller, bloqueada, baja): no se puede.

Se rellena sola solo la principal o la secundaria. El resto de filas se
quedan vacías para elegir a mano, con la mejor opción como sugerencia arriba
del desplegable (o se completan con «Completar»).

EL REPARTO ES ÓPTIMO, NO «EL PRIMERO QUE LLEGA»
══════════════════════════════════════════════════════════════════════════════
Si dos conductores tienen la misma principal y trabajan los dos, gana la
suma: uno se queda la suya y el otro pasa a su secundaria, pero decidido
mirando a TODOS a la vez (algoritmo húngaro / programación entera), no fila
a fila. Fila a fila, el primero de la lista se queda la furgoneta aunque al
segundo le deje sin ninguna.

LA FILA DE OGA5
══════════════════════════════════════════════════════════════════════════════
Las furgonetas se aparcan en fila, pegadas: la de detrás no sale hasta que
sale la de delante. Es el «problema del despacho en cocheras» de autobuses y
tranvías (Winter y Zimmermann; Hamdouni, Desaulniers y Soumis): en cada fila,
las de delante tienen que salir ANTES o a la vez que las de detrás, y una
furgoneta que hoy no sale y tapa a otra hay que MOVERLA. Se resuelve como
programa entero: máximo de puntos, con esa regla, y cada movimiento cuesta
250 puntos (más que perder dos principales: mover una furgoneta es trabajo de
verdad y solo se propone si no hay otra manera).
"""
from __future__ import annotations

import math
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

PRINCIPAL = 100.0
TITULAR = 15.0
SECUNDARIA = 60.0
HIST_MAX = 30.0
CONTINUIDAD = 5.0
CUIDADO_MAX = 20.0
LIBRE_BASE = 10.0           # «Completar»: cualquier furgoneta operativa vale esto de base
MOVER = 250.0               # coste de mover una furgoneta que tapa la fila
MEDIA_VIDA = 21.0           # días
VENTANA_HIST = 90           # días de historial que se miran
PRIOR_DIAS = 30.0           # «días de media» con los que se suaviza el cuidado


def matricula_norm(p) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(p or "").upper())


def _d(s) -> Optional[date]:
    try:
        return date.fromisoformat(str(s)[:10])
    except (TypeError, ValueError):
        return None


def hora_min(h) -> Optional[int]:
    """'11:40' -> 700. None si no es una hora."""
    m = re.match(r"^\s*([01]?\d|2[0-3])[:.hH]([0-5]\d)\s*$", str(h or ""))
    return int(m.group(1)) * 60 + int(m.group(2)) if m else None


# ── HISTORIAL ─────────────────────────────────────────────────────────────────

@dataclass
class Historial:
    """Quién llevó qué y cuándo, ya digerido por conductor."""
    peso: Dict[str, Dict[str, float]]          # conductor -> furgo -> peso con media vida
    total: Dict[str, float]                    # conductor -> suma de pesos
    dias: Dict[str, List[Tuple[date, str]]]    # conductor -> [(día, furgo)] de más reciente a más antiguo

    def cuota(self, c: str, v: str) -> float:
        t = self.total.get(c) or 0.0
        return (self.peso.get(c, {}).get(v, 0.0) / t) if t > 0 else 0.0

    def ultima(self, c: str) -> Optional[str]:
        d = self.dias.get(c) or []
        return d[0][1] if d else None

    def recientes(self, c: str, n: int) -> List[str]:
        return [v for _, v in (self.dias.get(c) or [])[:n]]


def historial(pares: Iterable[Tuple[str, str, str]], hoy: date,
              ventana: int = VENTANA_HIST, media_vida: float = MEDIA_VIDA) -> Historial:
    """pares: (día 'YYYY-MM-DD', conductor, furgoneta). Un conductor, un día, una furgoneta:
    si hay dos para el mismo día (la inspección y la asignación), vale la primera que llega."""
    visto: Dict[Tuple[str, date], str] = {}
    for dia, c, v in pares:
        f = _d(dia)
        if not (f and c and v) or f >= hoy or (hoy - f).days > ventana:
            continue
        visto.setdefault((c, f), v)
    peso: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
    total: Dict[str, float] = defaultdict(float)
    dias: Dict[str, List[Tuple[date, str]]] = defaultdict(list)
    for (c, f), v in visto.items():
        w = 0.5 ** ((hoy - f).days / media_vida)
        peso[c][v] += w
        total[c] += w
        dias[c].append((f, v))
    for c in dias:
        dias[c].sort(key=lambda x: x[0], reverse=True)
    return Historial({c: dict(x) for c, x in peso.items()}, dict(total), dict(dias))


# ── CUIDADO ───────────────────────────────────────────────────────────────────

PESO_GOLPE = {"moderado": 1.0, "grave": 2.0, "critico": 3.0}


@dataclass
class Cuidado:
    dias: int = 0                   # días conduciendo en la ventana
    seguros: float = 0.0            # golpes con certeza ALTA (una persona, ≤1 día, dos fotos), pesados
    posibles: float = 0.0           # golpes en los que estaba en la ventana, repartidos entre los que la llevaron
    indice: Optional[float] = None  # -1 (más golpes que la media) .. +1 (menos); None sin datos


def cuidado(dias: Dict[str, int], golpes_seguros: Dict[str, float],
            golpes_posibles: Dict[str, float], min_dias: int = 10) -> Dict[str, Cuidado]:
    """Hechos de cada conductor y un índice SUAVIZADO: con pocos días nadie es
    «malo» ni «bueno». Tasa = (golpes + 30 días de la media) / (días + 30)."""
    exp = sum(dias.values())
    tasa0 = (sum(golpes_seguros.values()) / exp) if exp else 0.0
    out = {}
    for c, n in dias.items():
        g = golpes_seguros.get(c, 0.0)
        ind = None
        if n >= min_dias and tasa0 > 0:
            tasa = (g + PRIOR_DIAS * tasa0) / (n + PRIOR_DIAS)
            ind = max(-1.0, min(1.0, math.log2(tasa0 / tasa) / 2.0)) if tasa > 0 else 1.0
        out[c] = Cuidado(n, round(g, 2), round(golpes_posibles.get(c, 0.0), 2), ind)
    return out


def cuidado_predice(eventos: Iterable[Tuple[str, str, float]], dias: Dict[str, List[str]],
                    minimo_eventos: int = 15, ventaja: float = 1.5) -> Tuple[bool, str]:
    """¿Los golpes del pasado de cada conductor predicen los del futuro EN ESTOS DATOS?

    Se parte el tiempo en dos: con la primera mitad se ordena a los conductores,
    con la segunda se mira si el tercio «más cuidadoso» dio de verdad menos
    golpes que el «menos cuidadoso». Si no hay golpes suficientes o no se nota,
    el cuidado NO entra en el reparto: solo se enseña como dato.
    eventos: (día, conductor, peso). dias: conductor -> [días conduciendo].
    """
    todos = sorted({x for ds in dias.values() for x in ds})
    if len(todos) < 20:
        return False, "hay menos de 20 días de datos"
    corte = todos[len(todos) // 2]
    g1, g2 = defaultdict(float), defaultdict(float)
    for dia, c, w in eventos:
        (g1 if str(dia) < corte else g2)[c] += w
    if sum(g2.values()) < minimo_eventos:
        return False, "solo %g golpes seguros en la segunda mitad (hacen falta %d para comprobarlo)" % (
            sum(g2.values()), minimo_eventos)
    e1 = {c: sum(1 for x in ds if x < corte) for c, ds in dias.items()}
    e2 = {c: sum(1 for x in ds if x >= corte) for c, ds in dias.items()}
    tasa0 = sum(g1.values()) / max(sum(e1.values()), 1)
    # Se ordena SOLO por lo de antes; los empates (casi todos: 0 golpes antes),
    # por el id. Ordenar las tuplas enteras desempataba por los golpes de
    # DESPUÉS, que es mirar el futuro: daba «predice» con golpes al azar la mitad
    # de las veces.
    orden = sorted((c for c in dias if e1.get(c, 0) >= 10 and e2.get(c, 0) >= 10),
                   key=lambda c: ((g1.get(c, 0) + PRIOR_DIAS * tasa0) / (e1[c] + PRIOR_DIAS), c))
    if len(orden) < 15:
        return False, "pocos conductores con días en las dos mitades"
    t = len(orden) // 3
    a, ea = sum(g2.get(c, 0) for c in orden[:t]), sum(e2[c] for c in orden[:t])     # los «cuidadosos»
    b, eb = sum(g2.get(c, 0) for c in orden[-t:]), sum(e2[c] for c in orden[-t:])   # los «menos cuidadosos»
    arriba, abajo = a / max(ea, 1), b / max(eb, 1)
    # Contraste exacto: si el pasado no dijera nada, los golpes de después se
    # repartirían entre los dos grupos según sus días. ¿Es raro ver tantos en el
    # grupo «malo»? Sin esto, con pocos golpes, un «1,5 veces más» sale por
    # pura casualidad (medido: 1 de cada 4 repartos al azar lo daba).
    n, k = int(round(a + b)), int(round(b))
    p0 = eb / max(ea + eb, 1)
    pval = sum(math.comb(n, j) * p0 ** j * (1 - p0) ** (n - j) for j in range(k, n + 1)) if n else 1.0
    if n >= 8 and pval < 0.05 and abajo >= ventaja * arriba and abajo > 0:
        return True, "el tercio con más golpes antes dio %.1f veces más después (p=%.3f)" % (
            abajo / max(arriba, 1e-9), pval)
    return False, "los golpes de antes no predicen los de después en estos datos (p=%.2f)" % pval


def valor_furgo(trato: Optional[str], trato_desde: Optional[str], vuelta_taller: Optional[str],
                danos_abiertos: int, hoy: date) -> Tuple[float, str]:
    """Cuánto hay que perder con esta furgoneta (0..1) y por qué."""
    desde = _d(trato_desde)
    if trato == "nueva" and (not desde or (hoy - desde).days <= 120):
        return 1.0, "nueva"
    vuelta = _d(vuelta_taller) or (desde if trato == "reparada" else None)
    if vuelta and (hoy - vuelta).days <= 30:
        return 0.8, "recién salida del taller"
    if danos_abiertos >= 3:
        return 0.2, "%d daños sin reparar" % danos_abiertos
    return 0.4, ""


# ── PUNTUACIÓN ────────────────────────────────────────────────────────────────

@dataclass
class Fija:
    principal: Optional[str] = None
    secundaria: Optional[str] = None
    titular: bool = False           # si la principal es compartida, él tiene preferencia
    sin_auto: bool = False          # «sin furgoneta fija»: nunca se le pone sola
    vetadas: Tuple[str, ...] = ()
    responsabilidad: Optional[int] = None   # 1..10, la nota de la oficina; None = sin nota


@dataclass
class Contexto:
    fijas: Dict[str, Fija]
    hist: Historial
    cuidado: Dict[str, Cuidado] = field(default_factory=dict)
    cuidado_activo: bool = False
    valor: Dict[str, float] = field(default_factory=dict)       # furgo -> 0..1


def puntos(c: str, v: str, ctx: Contexto, placa: Dict[str, str] = None) -> Tuple[float, List[str]]:
    """Puntos de la pareja y los motivos, en cristiano. -inf si no se puede."""
    f = ctx.fijas.get(c) or Fija()
    if v in f.vetadas:
        return float("-inf"), ["vetada para este conductor"]
    s, por = 0.0, []
    if f.principal == v:
        s += PRINCIPAL + (TITULAR if f.titular else 0.0)
        por.append("su furgoneta principal" + (" (titular)" if f.titular else ""))
    elif f.secundaria == v:
        s += SECUNDARIA
        por.append("su secundaria")
    cuota = ctx.hist.cuota(c, v)
    if cuota > 0:
        s += HIST_MAX * cuota
        n = sum(1 for x in ctx.hist.recientes(c, 12) if x == v)
        if n:
            por.append("la ha llevado %d de sus últimos %d días" % (n, min(12, len(ctx.hist.dias.get(c) or []))))
    if ctx.hist.ultima(c) == v:
        s += CONTINUIDAD
        por.append("la llevó su último día")
    ind = indice_cuidado(c, ctx)
    if ind is not None:
        val = ctx.valor.get(v, 0.4)
        s += CUIDADO_MAX * ind * val
        if ind > 0.3 and val >= 0.8:
            por.append("furgoneta cuidada para alguien de confianza")
    return s, por


def indice_cuidado(c: str, ctx: Contexto) -> Optional[float]:
    """-1..+1: la nota de la oficina (1..10, 5,5 es neutro) y, si se ha
    comprobado que predicen, los golpes; con las dos, la media."""
    f = ctx.fijas.get(c) or Fija()
    manual = (max(1, min(10, f.responsabilidad)) - 5.5) / 4.5 if f.responsabilidad else None
    cu = ctx.cuidado.get(c)
    datos = cu.indice if (ctx.cuidado_activo and cu and cu.indice is not None) else None
    if manual is not None and datos is not None:
        return (manual + datos) / 2
    return manual if manual is not None else datos


# ── EL REPARTO ────────────────────────────────────────────────────────────────

@dataclass
class Fila:
    i: int                          # índice en la plantilla
    conductor: Optional[str]        # id, o None si el nombre no casa con nadie
    furgo: Optional[str] = None     # id de la furgoneta ya puesta a mano (manda)
    salida: Optional[int] = None    # minutos desde las 00:00


@dataclass
class Propuesta:
    fila: int
    furgo: str
    puntos: float
    tipo: str                       # principal | secundaria | historial | libre
    motivos: List[str]
    aplicar: bool = True            # False: solo sugerencia (no se rellena sola)


def _tipo(c: str, v: str, ctx: Contexto) -> str:
    f = ctx.fijas.get(c) or Fija()
    if f.principal == v:
        return "principal"
    if f.secundaria == v:
        return "secundaria"
    return "historial" if ctx.hist.cuota(c, v) > 0 else "libre"


def repartir(filas: Sequence[Fila], furgos: Sequence[str], ctx: Contexto,
             completar: bool = False, filas_aparcamiento: Optional[Sequence[Sequence[str]]] = None,
             no_operativas: Iterable[str] = ()) -> dict:
    """Propone furgoneta para las filas que no la tienen.

    furgos: ids OPERATIVAS hoy. Las filas con furgoneta puesta a mano se
    respetan (y ocupan su furgoneta). Con `filas_aparcamiento` (listas de
    furgonetas de delante a atrás) se respeta el orden de salida de la fila.

    El reparto se calcula con TODAS las furgonetas libres, para que sepa qué
    alternativas hay (en la fila de OGA5, dar otra que está a mano en vez de
    mover una). Pero solo se RELLENA sola la principal o la secundaria
    (`aplicar`); lo demás viaja como sugerencia para el desplegable, salvo con
    `completar`. A los «sin furgoneta fija» nunca se les rellena.

    Devuelve {"propuestas": [...], "mover": [...], "sin_furgo": [...], "metodo": str}.
    """
    ocupadas = {r.furgo for r in filas if r.furgo}
    libres = [v for v in furgos if v not in ocupadas]
    pendientes = [r for r in filas if r.conductor and not r.furgo]
    cand: Dict[Tuple[int, str], Tuple[float, List[str]]] = {}
    for r in pendientes:
        for v in libres:
            s, por = puntos(r.conductor, v, ctx)
            if s != float("-inf"):
                cand[(r.i, v)] = (s + LIBRE_BASE, por)
    usar_fila = bool(filas_aparcamiento) and any(len(x) for x in filas_aparcamiento)
    if usar_fila:
        res = _repartir_fila(filas, pendientes, libres, cand, filas_aparcamiento, set(no_operativas))
    else:
        res = _repartir_libre(pendientes, libres, cand)
    props = []
    for i, v in res["pares"]:
        r = next(x for x in pendientes if x.i == i)
        s, por = cand[(i, v)]
        tipo = _tipo(r.conductor, v, ctx)
        sin_auto = (ctx.fijas.get(r.conductor) or Fija()).sin_auto
        aplicar = not sin_auto and (tipo in ("principal", "secundaria") or completar)
        props.append(Propuesta(i, v, round(s - LIBRE_BASE, 1), tipo, por, aplicar))
    props.sort(key=lambda p: p.fila)
    puestas = {p.fila for p in props if p.aplicar}
    sin = [r.i for r in pendientes if r.i not in puestas]
    return {"propuestas": props, "mover": res.get("mover", []), "sin_furgo": sin,
            "metodo": res.get("metodo", "")}


def _repartir_libre(pendientes, libres, cand) -> dict:
    """Asignación óptima (húngaro): primero cuantas más filas mejor, luego más puntos."""
    if not pendientes or not libres or not cand:
        return {"pares": [], "metodo": "húngaro"}
    import numpy as np
    from scipy.optimize import linear_sum_assignment
    fi = [r.i for r in pendientes]
    PROHIBIDO = -1e7
    m = np.full((len(fi), len(libres)), PROHIBIDO)
    for a, i in enumerate(fi):
        for b, v in enumerate(libres):
            if (i, v) in cand:
                m[a, b] = 1e4 + cand[(i, v)][0]
    ra, cb = linear_sum_assignment(m, maximize=True)
    pares = [(fi[a], libres[b]) for a, b in zip(ra, cb) if m[a, b] > PROHIBIDO / 2]
    return {"pares": pares, "metodo": "húngaro"}


def _repartir_fila(filas, pendientes, libres, cand, carriles, no_operativas) -> dict:
    """Programa entero (HiGHS) con la regla de la fila: en cada fila, la de
    delante sale antes o a la vez que la de detrás, o se mueve (cuesta MOVER)."""
    import numpy as np
    from scipy.optimize import Bounds, LinearConstraint, milp

    TARDE = 24 * 60                          # sin hora de salida: la última
    hora = {r.i: (r.salida if r.salida is not None else TARDE) for r in filas}
    fijas = {r.furgo: hora[r.i] for r in filas if r.furgo}
    pares = list(cand.keys())
    xi = {p: k for k, p in enumerate(pares)}
    en_fila = [v for car in carriles for v in car]
    mi = {v: len(pares) + k for k, v in enumerate(en_fila)}
    n = len(pares) + len(en_fila)
    obj = np.zeros(n)
    for p, k in xi.items():
        obj[k] = -(1e4 + cand[p][0])        # milp minimiza
    for v, k in mi.items():
        obj[k] = MOVER
    filas_A, lo, hi = [], [], []

    def fila(coef: Dict[int, float], a: float, b: float):
        row = np.zeros(n)
        for k, c in coef.items():
            row[k] += c
        filas_A.append(row)
        lo.append(a)
        hi.append(b)

    for r in pendientes:                     # una furgoneta por fila de la plantilla
        ks = [xi[p] for p in pares if p[0] == r.i]
        if ks:
            fila({k: 1 for k in ks}, 0, 1)
    for v in libres:                         # una fila de la plantilla por furgoneta
        ks = [xi[p] for p in pares if p[1] == v]
        if ks:
            fila({k: 1 for k in ks}, 0, 1)

    def uso(v):                              # (coeficientes de "se usa", constante)
        if v in fijas:
            return {}, 1.0
        return {xi[p]: 1.0 for p in pares if p[1] == v}, 0.0

    def tiempo(v):                           # (coeficientes de "a qué hora sale", constante)
        if v in fijas:
            return {}, float(fijas[v])
        return {xi[p]: float(hora[p[0]]) for p in pares if p[1] == v}, 0.0

    M = float(TARDE + 1)
    for car in carriles:
        for a in range(len(car)):
            for b in range(a + 1, len(car)):
                va, vb = car[a], car[b]
                ub, cb_ = uso(vb)
                if not ub and cb_ == 0:
                    continue                 # la de detrás no puede salir hoy: no obliga a nada
                ua, ca = uso(va)
                # 1) si sale la de detrás, la de delante sale o se mueve:  u_b - u_a - m_a <= c_a - c_b
                coef = dict(ub)
                for k, c in ua.items():
                    coef[k] = coef.get(k, 0) - c
                coef[mi[va]] = coef.get(mi[va], 0) - 1
                fila(coef, -np.inf, ca - cb_)
                # 2) y antes o a la vez:  t_a - t_b <= M(1 - u_b) + M m_a
                ta, cta = tiempo(va)
                tb, ctb = tiempo(vb)
                coef = dict(ta)
                for k, c in tb.items():
                    coef[k] = coef.get(k, 0) - c
                for k, c in ub.items():
                    coef[k] = coef.get(k, 0) + M * c
                coef[mi[va]] = coef.get(mi[va], 0) - M
                fila(coef, -np.inf, M - M * cb_ - cta + ctb)
    integr = np.ones(n)
    restr = LinearConstraint(np.array(filas_A), lo, hi) if filas_A else None
    res = milp(obj, integrality=integr, bounds=Bounds(0, 1),
               constraints=[restr] if restr is not None else None,
               options={"time_limit": 20})
    if res.x is None:
        return {"pares": [], "mover": [], "metodo": "sin solución (%s)" % res.message}
    x = res.x
    pares_ok = [p for p, k in xi.items() if x[k] > 0.5]
    usada_hora = {v: fijas[v] for v in fijas}
    for i, v in pares_ok:
        usada_hora[v] = hora[i]
    mover = []
    for car in carriles:
        for a, v in enumerate(car):
            if x[mi[v]] > 0.5:
                detras = [usada_hora[w] for w in car[a + 1:] if w in usada_hora]
                if detras:
                    mover.append({"furgo": v, "antes_de": min(detras),
                                  "motivo": "no sale hoy" if v not in usada_hora or v in no_operativas
                                  else "sale más tarde que las de detrás"})
    return {"pares": pares_ok, "mover": mover, "metodo": "programa entero con la fila"}


def conflictos_fila(filas: Sequence[Fila], carriles: Sequence[Sequence[str]]) -> List[dict]:
    """Con la plantilla COMO ESTÁ (a mano o no): qué furgoneta tapa a cuál."""
    hora = {r.furgo: (r.salida if r.salida is not None else None) for r in filas if r.furgo}
    out = []
    for n, car in enumerate(carriles):
        for b in range(len(car)):
            vb = car[b]
            if vb not in hora or hora[vb] is None:
                continue
            for a in range(b):
                va = car[a]
                ha = hora.get(va)
                if va not in hora:
                    out.append({"fila": n, "tapa": va, "a": vb, "hora": hora[vb], "motivo": "no_sale"})
                elif ha is not None and ha > hora[vb]:
                    out.append({"fila": n, "tapa": va, "a": vb, "hora": hora[vb], "hora_tapa": ha,
                                "motivo": "sale_despues"})
    return out


# ── SUGERENCIAS QUE APRENDEN ──────────────────────────────────────────────────

def sugerir_fijas(conductores: Iterable[str], ctx: Contexto, operativas: set,
                  ultimos: int = 6, veces: int = 4) -> List[dict]:
    """Quien lleva la misma furgoneta 4 de sus últimos 6 días y no la tiene de
    principal: se le propone. No se cambia nada solo."""
    out = []
    for c in conductores:
        rec = ctx.hist.recientes(c, ultimos)
        if len(rec) < veces:
            continue
        v, n = max(((v, rec.count(v)) for v in set(rec)), key=lambda x: x[1])
        f = ctx.fijas.get(c) or Fija()
        if n >= veces and v != f.principal and v in operativas and v not in f.vetadas and not f.sin_auto:
            out.append({"conductor": c, "furgo": v, "veces": n, "de": len(rec),
                        "tenia": f.principal})
    return out


def propuesta_inicial(conductores: Iterable[str], furgos: Sequence[str], hist: Historial,
                      dias_trabajados: Dict[str, set], fijas: Dict[str, Fija],
                      minimo_dias: int = 3, carga_max: float = 1.1) -> Dict[str, dict]:
    """Principal y secundaria para quien aún no tiene, a partir del historial.

    Una furgoneta puede ser principal de varios SI casi no coinciden: se suma
    la «carga» (qué parte de los días trabaja cada uno) y no se pasa de 1,1.
    Entre dos que la comparten, el titular es quien más la ha llevado.
    """
    todos_dias = sorted({d for ds in dias_trabajados.values() for d in ds})
    n_dias = max(len(todos_dias), 1)
    frec = {c: len(dias_trabajados.get(c) or ()) / n_dias for c in conductores}
    dueños: Dict[str, List[str]] = defaultdict(list)
    for c, f in fijas.items():
        if f.principal:
            dueños[f.principal].append(c)
    carga = defaultdict(float)
    for v, cs in dueños.items():
        carga[v] = sum(frec.get(c, 0.3) for c in cs)
    orden = sorted((c for c in conductores
                    if len(dias_trabajados.get(c) or ()) >= minimo_dias
                    and not (fijas.get(c) or Fija()).principal
                    and not (fijas.get(c) or Fija()).sin_auto),
                   key=lambda c: -len(dias_trabajados.get(c) or ()))
    operativas = set(furgos)
    out = {}
    titular_de: Dict[str, str] = {}
    for c in orden:
        f = fijas.get(c) or Fija()

        def coste(v):
            coinc = sum(len((dias_trabajados.get(c) or set()) & (dias_trabajados.get(o) or set()))
                        for o in dueños[v])
            base = len(dias_trabajados.get(c) or ()) or 1
            return hist.cuota(c, v) - 0.6 * coinc / base

        posibles = sorted((v for v in operativas if v not in f.vetadas
                           and carga[v] + frec.get(c, 0) <= carga_max),
                          key=coste, reverse=True)
        if not posibles:
            continue
        v = posibles[0]
        comparte = list(dueños[v])
        dueños[v].append(c)
        carga[v] += frec.get(c, 0)
        # UN titular por furgoneta: el que más la ha llevado. Si el nuevo la ha
        # llevado más que el titular de la propuesta, pasa a serlo él.
        previo = titular_de.get(v)
        titular = False
        if previo is None and not any((fijas.get(o) or Fija()).titular for o in comparte):
            titular = True
        elif previo is not None and hist.cuota(c, v) > hist.cuota(previo, v):
            titular = True
            out[previo]["titular"] = False
        if titular:
            titular_de[v] = c
        out[c] = {"principal": v, "secundaria": None, "titular": titular,
                  "comparte_con": comparte,
                  "motivo": ("la ha llevado el %d %% de sus días" % round(100 * hist.cuota(c, v))
                             if hist.cuota(c, v) > 0 else "libre y sin coincidir con nadie")}
    # Segunda pasada, ya sabiendo de quién es cada una: la SECUNDARIA solo sirve
    # si suele estar libre los días que él trabaja. Se elige la que menos
    # coincide con los días de sus dueños y, a igualdad, la que más ha llevado.
    # (Elegirla solo por historial daba como secundaria de tres personas la
    # principal de alguien que trabaja todos los días: nunca estaría libre.)
    for c, x in out.items():
        dias_c = dias_trabajados.get(c) or set()
        vet = (fijas.get(c) or Fija()).vetadas

        def libre(w):
            coinc = sum(len(dias_c & (dias_trabajados.get(o) or set())) for o in dueños[w] if o != c)
            return (-coinc / max(len(dias_c), 1), hist.cuota(c, w))
        cands = [w for w in operativas if w != x["principal"] and w not in vet]
        if cands:
            x["secundaria"] = max(sorted(cands), key=libre)
    return out


def a_quien(furgo: str, conductores: Iterable[str], ctx: Contexto,
            nombres: Dict[str, str] = None) -> List[dict]:
    """Furgoneta nueva o recién arreglada: a quién dársela. En orden: la nota de
    responsabilidad de la oficina y después HECHOS (menos golpes seguros, menos
    posibles, los que no tienen fija, más días conduciendo). El jefe decide."""
    filas = []
    for c in conductores:
        f = ctx.fijas.get(c) or Fija()
        if f.sin_auto or furgo in f.vetadas:
            continue
        cu = ctx.cuidado.get(c) or Cuidado()
        if cu.dias < 5:
            continue
        filas.append({
            "conductor": c, "nombre": (nombres or {}).get(c, c), "dias": cu.dias,
            "golpes_seguros": cu.seguros, "golpes_posibles": cu.posibles,
            "tiene_fija": bool(f.principal), "indice": cu.indice,
            "responsabilidad": f.responsabilidad,
        })
    # Primero la nota de la oficina (sin nota = 5,5, neutro), luego los hechos.
    filas.sort(key=lambda x: (-(x["responsabilidad"] or 5.5),
                              x["golpes_seguros"] / max(x["dias"], 1),
                              x["golpes_posibles"] / max(x["dias"], 1),
                              x["tiene_fija"], -x["dias"]))
    return filas
