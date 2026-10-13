# -*- coding: utf-8 -*-
"""EL MOTOR DEL CUADRANTE — quién trabaja cada día para ir a +2 de la máxima.

Funciones PURAS (sin base de datos): server.py junta los datos y llama aquí.
Probado en `tests/test_cuadrante_motor.py`.

DE DÓNDE SALE
══════════════════════════════════════════════════════════════════════════════
Es el modelo de `cuadrante_solver.py`, el que Dani preparó el 29-09-2026 con su
Excel de septiembre (hoja MENSUAL) y que dio la «opción B»: +2 todos los días
del 29-09 al 12-10 con 35 días extra y nadie 7 días seguidos. Mismas reglas y
mismos pesos, pero resuelto con HiGHS (scipy), que ya va en el servidor para el
reparto de furgonetas: sin instalar nada nuevo ni lanzar un programa aparte.

Cambia en tres cosas, las tres por el mismo motivo —que el número que se
enseña sea el mismo que cuenta Dani en su hoja—:

  1. LA FILA DE RUTAS CUENTA SOLO LO QUE SACA RUTA. El original sumaba BKP y RA
     como rutas. En la hoja, la fila azul cuenta los «1»; la reserva y el
     acompañante trabajan (cuentan para los días seguidos y para la semana)
     pero no sacan furgoneta. Contarlos daba un +2 que en la calle era +0.
  2. NUNCA SE QUEDA SIN RESPUESTA. El original tenía como límites duros el
     tope del día y el de la semana: con una celda fijada a mano de más
     (alguien a trabajar el día de una máxima baja) el programa no tenía
     solución y devolvía basura. Aquí pasarse cuesta muchísimo pero se puede,
     y se avisa de qué celda lo provoca.
  3. LO QUE NO ENTIENDE NO LO TOCA. Solo decide las celdas vacías o con 1/T/X/
     N/T/L. Cualquier otro código (vacaciones, baja, aprobado, reserva, uno que
     se invente la oficina mañana) se queda como está.

LAS REGLAS, POR ORDEN DE PESO
══════════════════════════════════════════════════════════════════════════════
  · Ley: como mucho 6 días seguidos (contando los días de antes del periodo y
    el paso de un mes a otro, que para el motor no existe: son fechas).
  · Cada día: máxima + colchón (+2 por defecto) personas en ruta. Faltar la
    primera cuesta 100, la segunda 150, la tercera 400, la cuarta 500 y cada
    una más 1.500. Pasarse, 3.000 cada una.
  · Semana de lunes a domingo: 5 días y 2 libres. Quedarse por debajo cuesta
    1.000 por día (se hace si sobra gente: alguien trabaja 4).
  · Si con 5+2 no se llega, un 6º día EXTRA (90) solo donde haga falta, uno por
    persona y semana, y marcado para poder quitarlo el mismo día si sobra.
  · Cambiar lo que ya estaba puesto cuesta 3 en la primera semana y 1 después:
    se mueve lo mínimo.
  · 2 puntos de premio si la persona libra dos días seguidos en la semana.

TIPOS DE PERSONA
══════════════════════════════════════════════════════════════════════════════
  normal   5+2 donde haga falta (la mayoría).
  empresa  horario fijo (por defecto de lunes a viernes; `patron` lo cambia:
           0=lunes ... 6=domingo). Sus celdas vacías se rellenan con el patrón;
           lo que ya tenga puesto se respeta.
  finde    solo sábado y domingo.
  inactivo no entra en rutas en todo el periodo (baja larga, oficina).
Y por persona: `alta_desde` (empieza ese día), `inactivo_desde` (se ha ido),
`dias_no` (nunca trabaja esos días de la semana).

LAS NOTAS DE CADA PERSONA (Dani, 29-09-2026: «añadirle notas a cada uno tipo
este solo trabaja 4 días, este alternados… y que las aplique»). La nota se
escribe en texto y `cuadrante_ordenes.interpretar_nota` la convierte en estos
campos, que son lo único que lee el motor:
  dias_semana   sus días por semana si no son 5 (y entonces sin día extra:
                si trabaja 4 es por algo, no se le pone un 5º para cuadrar)
  max_seguidos  su tope de días seguidos si es menor que el legal
                (1 = días alternos: nunca dos seguidos)
  dias_no       días de la semana que nunca trabaja
  sin_extra     nunca se le pone día extra

REPARTO JUSTO (mejora propia, 29-09-2026: «añade trucos si se puede hacer mejor»)
══════════════════════════════════════════════════════════════════════════════
El modelo original elegía a quién ponerle el día extra por pura casualidad del
cálculo: podía caerle a la misma persona dos semanas seguidas mientras otras no
hacían ninguno. Ahora:
  · el 2º día extra de una persona en el periodo cuesta un poco más que el 1º,
    el 3º algo más… y los extras que ya hizo en las 4 semanas anteriores cuentan
    igual (`extras_recientes`). Se reparten solos entre quien menos lleva, SIN
    dejar nunca un día corto por repartir (el reparto solo desempata);
  · cada día de fin de semana cuesta 0,2 por cada día de finde trabajado en las
    4 semanas anteriores (`findes_recientes`, tope 5): los findes rotan. Es poco
    a propósito, menos que mover una celda ya puesta: rota al rellenar semanas
    nuevas, no desordena lo que ya estaba hecho.
Los dos son DESEMPATES. La cuenta que lo garantiza: un extra cuesta 90, mover
una celda hasta 3, perder dos libres seguidos 2, el reparto de extras hasta 3 y
el de findes hasta 1: 99, por debajo de los 100 de la primera ruta que falta.
Así nunca sale más barato quedarse corto que repartir (lo cazó una prueba con
pesos más altos: el motor prefería dejar un día a +1).
"""
from __future__ import annotations

import datetime as dt
import math
from typing import Any, Dict, List, Optional, Tuple

# ── LOS CÓDIGOS ──────────────────────────────────────────────────────────────
# Trabajar (cuenta para los 6 seguidos y para los 5 de la semana).
TRABAJO = {"1", "T", "X", "EXTRA", "BKP", "S", "RA", "RIDE"}
# Salir a ruta (lo único que se compara con la máxima: la fila azul de la hoja).
RUTA = {"1", "T", "X", "EXTRA"}
# Lo único que el motor puede decidir. Todo lo demás es de una persona.
MOVIBLES = {"", "1", "T", "X", "N/T", "L"}
DE_TRABAJO = {"1", "T", "X"}
DE_LIBRE = {"N/T", "L"}
LIBRE = "N/T"

# Pesos (los del modelo original).
TRAMOS_FALTA = [(1, 100.0), (1, 150.0), (1, 400.0), (1, 500.0), (None, 1500.0)]
PESO_SOBRA = 3000.0
PESO_EXTRA = 90.0
PESO_SEMANA_CORTA = 1000.0
PREMIO_LIBRES_JUNTOS = 2.0
PESO_RACHA = 2.0                 # libra antes quien lleva más días seguidos (por día de racha previa, decae en los 4 primeros días)
PESO_JUNTOS = 40.0               # que dos personas (pareja) libren y trabajen los mismos días: preferencia, cede ante cubrir rutas
# Reparto justo: desempates, ver la cuenta de los 99 en la cabecera.
PESO_EXTRA_REPETIDO = 1.0
TOPE_REPETIDOS = 3
PESO_FINDE_RECIENTE = 0.2       # por día de finde trabajado en las 4 semanas de antes (tope 5)
PESO_FINDE_ALTERNAR = 0.25    # desempate suave para alternar respecto al finde anterior

TIPOS = ("normal", "empresa", "finde", "inactivo")


def _d(x) -> dt.date:
    if isinstance(x, dt.datetime):
        return x.date()
    if isinstance(x, dt.date):
        return x
    return dt.date.fromisoformat(str(x)[:10])


def _cod(v) -> str:
    """El código tal cual se guarda: en mayúsculas, sin espacios de más y sin la
    hora entre paréntesis ('V (05:43)' -> 'V'). Un 1 que llega como número de
    Excel (1.0) es un '1'."""
    if v is None:
        return ""
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return "1" if float(v) == 1.0 else str(v)
    s = " ".join(str(v).split()).upper()
    if "(" in s:
        s = s.split("(")[0].strip()
    return "1" if s in ("1.0", "1,0") else s


class _Programa:
    """Programa entero pequeño con matriz DISPERSA sobre scipy (HiGHS).

    Dispersa a propósito: son unas 5.000 variables y 6.000 filas; en matriz
    llena serían 30 millones de ceros y 240 MB para nada."""

    def __init__(self):
        self.lb: List[float] = []
        self.ub: List[float] = []
        self.entera: List[int] = []
        self.c: List[float] = []
        self.fil: List[int] = []
        self.col: List[int] = []
        self.val: List[float] = []
        self.lo: List[float] = []
        self.hi: List[float] = []
        self.constante = 0.0

    def var(self, lb=0.0, ub=1.0, entera=True, coste=0.0) -> int:
        self.lb.append(float(lb))
        self.ub.append(math.inf if ub is None else float(ub))
        self.entera.append(1 if entera else 0)
        self.c.append(float(coste))
        return len(self.c) - 1

    def restr(self, coef: Dict[int, float], lo: float, hi: float):
        r = len(self.lo)
        for k, v in coef.items():
            if v:
                self.fil.append(r)
                self.col.append(k)
                self.val.append(float(v))
        self.lo.append(lo)
        self.hi.append(hi)

    def resolver(self, segundos: float):
        import numpy as np
        from scipy.optimize import Bounds, LinearConstraint, milp
        from scipy.sparse import csr_matrix

        n = len(self.c)
        restr = None
        if self.lo:
            a = csr_matrix((self.val, (self.fil, self.col)), shape=(len(self.lo), n))
            restr = LinearConstraint(a, np.array(self.lo, dtype=float), np.array(self.hi, dtype=float))
        return milp(np.array(self.c, dtype=float),
                    integrality=np.array(self.entera),
                    bounds=Bounds(np.array(self.lb, dtype=float), np.array(self.ub, dtype=float)),
                    constraints=[restr] if restr is not None else None,
                    options={"time_limit": float(segundos), "mip_rel_gap": 1e-6})


def generar_cuadrante(entrada: Dict[str, Any]) -> Dict[str, Any]:
    """
    entrada = {
      "fecha_inicio": "2026-09-30",     # primer día que se puede cambiar (normalmente mañana)
      "fecha_fin":    "2026-10-12",
      "colchon": 2,                     # rutas por encima de la máxima
      "permitir_extra": True,           # 6º día donde no se llegue
      "max_seguidos": 6, "dias_semana": 5,
      "maximas": {"2026-09-30": 44, ...},   # obligatoria cada día del periodo
      "conductores": [{"id", "nombre", "tipo", "patron"?, "alta_desde"?,
                       "inactivo_desde"?, "dias_no"?}],
      "celdas": {"id|AAAA-MM-DD": "1" | "N/T" | "V" | ...},   # incluir 6 días antes
      "bloqueadas": ["id|AAAA-MM-DD", ...],   # fijadas a mano: no se tocan
      "colchon_por_dia": {"2026-10-09": 3},
      "refuerzo_por_dia": {"2026-10-09": 4},   # gente que BAJA de otros centros ese día: cuenta como rutas hechas
      "libran_juntos": [["id_a", "id_b"]],     # parejas que preferimos que libren (y trabajen) los mismos días
      "limites_semana": [{"conductor_id", "lunes", "max_dias"}],
      "extras": ["id|AAAA-MM-DD", ...],   # las celdas que ya son día extra (rosa)
      "segundos": 60,                   # tope de cálculo por fase
    }
    Devuelve {"estado", "celdas": {"id|fecha": {"valor", "antes", "extra",
    "cambiado"}}, "resumen_dias": [...], "avisos": [...], "extras",
    "faltan_conductores"}.
    """
    ini, fin = _d(entrada["fecha_inicio"]), _d(entrada["fecha_fin"])
    if fin < ini:
        raise ValueError("La fecha de fin es anterior a la de inicio")
    if (fin - ini).days > 62:
        raise ValueError("Como mucho dos meses de una vez")
    colchon = int(entrada.get("colchon", 2))
    max_seg = int(entrada.get("max_seguidos", 6))
    dsem = int(entrada.get("dias_semana", 5))
    permitir_extra = bool(entrada.get("permitir_extra", True))
    segundos = float(entrada.get("segundos", 60))
    maximas = {_d(k): int(v) for k, v in (entrada.get("maximas") or {}).items()
               if v is not None and str(v).strip() != ""}
    conductores = [dict(c) for c in (entrada.get("conductores") or []) if c.get("id")]
    celdas = {k: _cod(v) for k, v in (entrada.get("celdas") or {}).items()}
    bloqueadas = set(entrada.get("bloqueadas") or [])
    extras_ya = set(entrada.get("extras") or [])
    colchon_dia = {_d(k): int(v) for k, v in (entrada.get("colchon_por_dia") or {}).items()}
    refuerzo = {_d(k): max(0, int(v)) for k, v in (entrada.get("refuerzo_por_dia") or {}).items()}
    ids_ok = {str(c["id"]) for c in conductores}
    juntos = [(str(a), str(b)) for a, b in (entrada.get("libran_juntos") or [])
              if str(a) in ids_ok and str(b) in ids_ok and str(a) != str(b)]
    limites = {(str(l["conductor_id"]), _d(l["lunes"])): int(l["max_dias"])
               for l in (entrada.get("limites_semana") or [])}

    plan = [ini + dt.timedelta(i) for i in range((fin - ini).days + 1)]
    faltan = [d for d in plan if d not in maximas]
    if faltan:
        raise ValueError("Faltan las máximas de: " + ", ".join(d.strftime("%d/%m") for d in faltan))
    hist = [ini - dt.timedelta(i) for i in range(max_seg, 0, -1)]
    lunes = sorted({d - dt.timedelta(d.weekday()) for d in plan})
    semanas = [[l + dt.timedelta(i) for i in range(7)] for l in lunes]
    todos = sorted(set(hist) | set(plan) | {d for s in semanas for d in s})
    en_plan = set(plan)

    def cur(cid, d) -> str:
        return celdas.get(f"{cid}|{d}", "")

    # ── Qué celdas están decididas de antemano ──────────────────────────────
    # (trabaja, ruta, valor_de_salida) o None si decide el motor.
    def fijo(c, d) -> Optional[Tuple[int, int, str]]:
        cid, v = c["id"], cur(c["id"], d)
        de_v = (1 if v in TRABAJO else 0, 1 if v in RUTA else 0, v)
        if d not in en_plan:
            return de_v
        if v not in MOVIBLES or f"{cid}|{d}" in bloqueadas:
            return de_v
        tipo = c.get("tipo") or "normal"
        if (c.get("inactivo_desde") and d >= _d(c["inactivo_desde"])) or tipo == "inactivo":
            # No se rellena a quien no está; lo que tuviera de trabajo pasa a N/D.
            return (0, 0, "N/D" if v in DE_TRABAJO else v)
        if c.get("alta_desde") and d < _d(c["alta_desde"]):
            return (0, 0, v if v in DE_LIBRE else "")
        if d.weekday() in set(c.get("dias_no") or []):
            return (0, 0, LIBRE)
        if tipo == "empresa":
            if v in DE_TRABAJO:
                return (1, 1, v)
            if v in DE_LIBRE:
                return (0, 0, v)
            patron = c.get("patron")
            patron = set(patron if patron else [0, 1, 2, 3, 4])
            return (1, 1, "1") if d.weekday() in patron else (0, 0, LIBRE)
        if tipo == "finde" and d.weekday() < 5:
            if v in DE_TRABAJO:
                return (1, 1, v)
            return (0, 0, v if v in DE_LIBRE else LIBRE)
        return None

    fijos = {(c["id"], d): fijo(c, d) for c in conductores for d in todos}

    def racha_previa(c) -> int:
        """Días seguidos trabajados justo antes del periodo (0 si libró ayer)."""
        run = 0
        for d in reversed(hist):
            if fijos[c["id"], d][0] == 1:
                run += 1
            else:
                break
        return run

    def descanso_prioritario(c) -> bool:
        """A quien tiene el horario marcado (L-V, solo finde, días que no puede, nº de días
        propio) no se le reparte el descanso por racha: lo suyo ya está dicho."""
        return ((c.get("tipo") or "normal") == "normal" and not c.get("patron") and not c.get("dias_no")
                and not c.get("dias_semana"))

    racha0 = {c["id"]: racha_previa(c) for c in conductores if descanso_prioritario(c)}

    def tope_de(c, lunes_sem) -> int:
        lim = limites.get((c["id"], lunes_sem))
        if lim is not None:
            return lim
        propio = c.get("dias_semana")
        return int(propio) if propio else dsem

    def seguidos_de(c) -> int:
        propio = c.get("max_seguidos")
        return max(1, min(max_seg, int(propio))) if propio else max_seg

    def admite_extra(c, lunes_sem) -> bool:
        return (permitir_extra and (c.get("tipo") or "normal") == "normal"
                and not c.get("sin_extra") and not c.get("dias_semana")
                and (c["id"], lunes_sem) not in limites)

    def construir(fase: int, base: Optional[Dict]):
        m = _Programa()
        xv: Dict[Tuple[str, dt.date], int] = {}
        for c in conductores:
            for d in todos:
                if fijos[c["id"], d] is None:
                    k = m.var()
                    xv[c["id"], d] = k
                    if fase == 2 and base[c["id"], d] == 1:
                        m.lb[k] = 1.0               # la fase 2 solo añade días extra

        def suma(pares, que=0):
            """Σ de celdas -> (coeficientes, constante). que=0 trabaja, 1 ruta."""
            coef, cte = {}, 0
            for cid, d in pares:
                k = xv.get((cid, d))
                if k is not None:
                    coef[k] = coef.get(k, 0) + 1
                else:
                    cte += fijos[cid, d][que]
            return coef, cte

        vars_dia = {}
        # ── Cada día: máxima + colchón ──
        for d in plan:
            coef, cte = suma([(c["id"], d) for c in conductores], que=1)
            objetivo = max(0, maximas[d] + colchon_dia.get(d, colchon) - refuerzo.get(d, 0))
            faltas = [m.var(0, ub, entera=False, coste=pen) for ub, pen in TRAMOS_FALTA]
            sobra = m.var(0, None, entera=False, coste=PESO_SOBRA)
            c1 = dict(coef)
            for f in faltas:
                c1[f] = 1
            m.restr(c1, objetivo - cte, math.inf)
            c2 = dict(coef)
            c2[sobra] = -1
            m.restr(c2, -math.inf, objetivo - cte)
            vars_dia[d] = (faltas, sobra)

        # ── Parejas: que libren (y trabajen) los mismos días. Preferencia, no obligación:
        # cede ante cubrir las rutas. |A - B| <= holgura, con coste por día en que difieran.
        for a, b in juntos:
            for d in plan:
                ca, ka = suma([(a, d)])
                cb, kb = suma([(b, d)])
                dif = dict(ca)
                for k, v in cb.items():
                    dif[k] = dif.get(k, 0) - v
                dif = {k: v for k, v in dif.items() if v}
                if not dif:
                    continue                      # los dos ya decididos: nada que repartir
                h = m.var(0, 1, entera=False, coste=PESO_JUNTOS)
                c1 = dict(dif); c1[h] = -1
                m.restr(c1, -math.inf, kb - ka)           # A - B - h <= kb - ka
                c2 = {k: -v for k, v in dif.items()}; c2[h] = -1
                m.restr(c2, -math.inf, ka - kb)           # B - A - h <= ka - kb

        extras_sem = {}
        for c in conductores:
            cid, tipo = c["id"], c.get("tipo") or "normal"
            # Los findes rotan: primero se intenta alternar un finde trabajado y
            # uno libre; el historial de cuatro semanas desempata después.
            fr = min(5, int(c.get("findes_recientes") or 0))
            if fr:
                for d in plan:
                    k = xv.get((cid, d))
                    if k is not None and d.weekday() >= 5:
                        m.c[k] += PESO_FINDE_RECIENTE * fr
            anterior = bool(c.get("finde_previo", False))
            # Incentivo ligero en el primer fin de semana del periodo. El
            # siguiente cálculo leerá ese fin de semana como historial; así
            # alterna sin añadir binarias al optimizador.
            sabado = next((d for d in plan if d.weekday() == 5), None)
            if sabado is not None:
                for d in (sabado, sabado + dt.timedelta(days=1)):
                    k = xv.get((cid, d))
                    if k is not None:
                        m.c[k] += PESO_FINDE_ALTERNAR * (1 if anterior else -1)
            # Quien lleva más días seguidos libra antes (desempate suave: el tope de 6 sigue siendo ley).
            r0 = racha0.get(cid, 0)
            if r0:
                for i, d in enumerate(plan[:4]):
                    k = xv.get((cid, d))
                    if k is not None:
                        m.c[k] += PESO_RACHA * r0 / (i + 1)
            # ── Semana de lunes a domingo: 5 + 2 (o 6 con el extra en la fase 2) ──
            for sem in semanas:
                if not any((cid, d) in xv for d in sem):
                    continue
                coef, cte = suma([(cid, d) for d in sem])
                tope = tope_de(c, sem[0])
                techo = max(tope, cte)          # lo ya fijado no se puede deshacer
                if fase == 2 and admite_extra(c, sem[0]):
                    e = m.var(0, 1, entera=False, coste=PESO_EXTRA)
                    extras_sem[cid, sem[0]] = e
                    c1 = dict(coef)
                    c1[e] = -1
                    m.restr(c1, -math.inf, techo - cte)
                else:
                    m.restr(coef, -math.inf, techo - cte)
                # Mínimo de la semana (blando). Una semana que acaba después del
                # periodo cuenta en proporción: con solo el lunes dentro, no se
                # obliga a nadie a trabajarlo por cumplir una semana que no se ve.
                disponibles = sum(1 for d in sem if (cid, d) in xv or fijos[cid, d][0] == 1)
                objetivo = min(2 if tipo == "finde" else tope, disponibles)
                dentro = sum(1 for d in sem if d <= fin)
                if dentro < 7:
                    objetivo = min(objetivo, (tope * dentro) // 7)
                if objetivo > cte:
                    s = m.var(0, None, entera=False, coste=PESO_SEMANA_CORTA)
                    c1 = dict(coef)
                    c1[s] = 1
                    m.restr(c1, objetivo - cte, math.inf)
            # Extras repartidos: el n-ésimo extra de la misma persona cuesta más
            # (contando los que ya hizo antes). Tramos crecientes: el cálculo
            # llena primero el barato, así que el reparto sale solo.
            suyos = [extras_sem[cid, sem[0]] for sem in semanas if (cid, sem[0]) in extras_sem]
            if suyos:
                previos = int(c.get("extras_recientes") or 0)
                tramos = [m.var(0, 1, entera=False,
                                coste=PESO_EXTRA_REPETIDO * min(TOPE_REPETIDOS, previos + i))
                          for i in range(len(suyos))]
                c1 = {e: 1 for e in suyos}
                for y in tramos:
                    c1[y] = -1
                m.restr(c1, 0, 0)
            # ── Como mucho `max_seg` días seguidos (o menos si su nota lo dice) ──
            ms = seguidos_de(c)
            for i in range(len(todos) - ms):
                ventana = todos[i:i + ms + 1]
                coef, cte = suma([(cid, d) for d in ventana])
                if coef:
                    m.restr(coef, -math.inf, max(ms, cte) - cte)
            # ── Cambiar lo mínimo lo ya puesto (más peso la primera semana) ──
            for d in plan:
                k = xv.get((cid, d))
                if k is None:
                    continue
                v = cur(cid, d)
                w = 3.0 if (d - ini).days < 7 else 1.0
                if v in DE_TRABAJO:
                    m.c[k] -= w                  # w·(1 - x): la constante no cambia nada
                    m.constante += w
                elif v in DE_LIBRE:
                    m.c[k] += w
            # ── Premio a librar dos días seguidos dentro de la semana ──
            for sem in semanas:
                pares, gratis = [], 0
                for a, b in zip(sem, sem[1:]):
                    ka, kb = xv.get((cid, a)), xv.get((cid, b))
                    if ka is None and kb is None:
                        if fijos[cid, a][0] == 0 and fijos[cid, b][0] == 0:
                            gratis += 1
                        continue
                    tope_p = 1.0
                    for k, dd in ((ka, a), (kb, b)):
                        if k is None:
                            tope_p = min(tope_p, 1.0 - fijos[cid, dd][0])
                    if tope_p <= 0:
                        continue
                    p = m.var(0, tope_p, entera=True)
                    for k in (ka, kb):
                        if k is not None:
                            m.restr({p: 1, k: 1}, -math.inf, 1)
                    pares.append(p)
                if pares and not gratis:
                    z = m.var(0, 1, entera=True, coste=-PREMIO_LIBRES_JUNTOS)
                    c1 = {z: 1}
                    for p in pares:
                        c1[p] = -1
                    m.restr(c1, -math.inf, 0)

        res = m.resolver(segundos)
        if res.x is None:
            raise RuntimeError("El cálculo no ha encontrado solución: %s" % res.message)
        x = res.x
        valores = {}
        for c in conductores:
            for d in todos:
                k = xv.get((c["id"], d))
                valores[c["id"], d] = int(round(x[k])) if k is not None else fijos[c["id"], d][0]
        estado = "Optimal" if res.status == 0 else ("TimeLimit" if res.status == 1 else str(res.message))
        return estado, valores, xv

    estado, base, _ = construir(1, None)
    final = base
    if permitir_extra:
        estado, final, _ = construir(2, base)

    # ── La marca de día extra (el rosa) ──────────────────────────────────────
    # Un día que ya se trabajaba y se sigue trabajando se queda con su marca,
    # la tenga o no: el rosa de la hoja lo pone quien la hace. El cálculo la
    # ponía en el día que dejaba fuera su fase 1 y la propuesta salía con
    # cambios que no lo eran (30-09-2026, hoja de OGA5: 22 de 49). Y la hoja no
    # sigue la cuenta de lunes a domingo: hay rosas en semanas de 5 días y
    # semanas de 6 sin rosa. Solo un día NUEVO por encima de los 5 de la semana
    # sale en rosa, si en esa semana no hay ya tantas marcas como extras.
    marca: Dict[Tuple[str, dt.date], bool] = {}
    for c in conductores:
        cid = c["id"]
        for sem in semanas:
            movibles = [d for d in sem if d in en_plan and fijos[cid, d] is None]
            for d in movibles:
                if final[cid, d] == 1 and cur(cid, d) in DE_TRABAJO:
                    marca[cid, d] = f"{cid}|{d}" in extras_ya
            del_calculo = [d for d in movibles if final[cid, d] == 1 and base[cid, d] == 0]
            hueco = len(del_calculo) - sum(1 for d in sem if final[cid, d] == 1 and f"{cid}|{d}" in extras_ya)
            for d in del_calculo:
                if hueco <= 0:
                    break
                if cur(cid, d) not in DE_TRABAJO:
                    marca[cid, d] = True
                    hueco -= 1

    # ── Salida ───────────────────────────────────────────────────────────────
    out, avisos = {}, []
    for c in conductores:
        cid = c["id"]
        for d in plan:
            v = cur(cid, d)
            f = fijos[cid, d]
            if f is not None:
                # Lo que no mueve el motor conserva su marca mientras no cambie.
                val = f[2]
                extra = f"{cid}|{d}" in extras_ya and val == v
            else:
                val = "1" if final[cid, d] == 1 else LIBRE
                extra = marca.get((cid, d), False)
            out[f"{cid}|{d}"] = {"valor": val, "antes": v, "extra": extra,
                                 "cambiado": val != v}

    def ruta_final(cid, d):
        f = fijos[cid, d]
        return f[1] if f is not None else final[cid, d]

    resumen, deficit_total = [], 0
    for d in plan:
        n = sum(ruta_final(c["id"], d) for c in conductores)
        cz = colchon_dia.get(d, colchon)
        r = refuerzo.get(d, 0)                   # los que bajan de otros centros ese día
        objetivo = maximas[d] + cz
        tot = n + r                              # rutas de aquí + refuerzo
        resumen.append({"fecha": d.isoformat(), "maxima": maximas[d], "colchon": cz, "refuerzo": r,
                        "objetivo": objetivo, "planificadas": n, "diferencia": tot - maximas[d]})
        deficit_total += max(0, objetivo - tot)
        suf = f" (con {r} que bajan de otros centros)" if r else ""
        if tot < maximas[d]:
            avisos.append(f"{d:%d/%m}: {tot} rutas{suf} para una máxima de {maximas[d]}. Falta gente.")
        elif tot < objetivo:
            avisos.append(f"{d:%d/%m}: {tot} rutas{suf}, no se llega al colchón de +{cz}.")
        elif tot > objetivo:
            avisos.append(f"{d:%d/%m}: {tot} rutas{suf}, {tot - objetivo} por encima de +{cz} "
                          "por celdas fijadas a mano.")
    # Rachas que no se pueden arreglar (días ya pasados, celdas protegidas o fijadas)
    nombre = {c["id"]: c.get("nombre") or c["id"] for c in conductores}
    for c in conductores:
        run, avisada, ms = 0, False, seguidos_de(c)
        for d in todos:
            run = run + 1 if final[c["id"], d] else 0
            if run > ms and d >= ini and not avisada:
                avisos.append(f"{nombre[c['id']]}: {run} días seguidos el {d:%d/%m}. "
                              "Revisa sus celdas fijadas o protegidas.")
                avisada = True
    n_extra = sum(1 for v in out.values() if v["extra"])
    if n_extra:
        avisos.append(f"{n_extra} días EXTRA (6º día de la semana) para llegar a +{colchon}. "
                      "Si ese día sobra gente, se pueden quitar.")
    # Cuántos conductores más harían falta para no depender de días extra.
    por_persona = dsem * len(plan) / 7.0
    faltan_c = math.ceil((n_extra + deficit_total) / por_persona - 1e-9) if por_persona else 0
    return {"estado": estado, "celdas": out, "resumen_dias": resumen, "avisos": avisos,
            "extras": n_extra, "deficit": deficit_total, "faltan_conductores": max(0, faltan_c)}


def rachas(celdas: Dict[str, str], ids: List[str], desde, hasta) -> Dict[str, int]:
    """Racha más larga de días trabajados de cada persona entre dos fechas."""
    a, b = _d(desde), _d(hasta)
    dias = [a + dt.timedelta(i) for i in range((b - a).days + 1)]
    out = {}
    for cid in ids:
        run = mejor = 0
        for d in dias:
            run = run + 1 if _cod(celdas.get(f"{cid}|{d}")) in TRABAJO else 0
            mejor = max(mejor, run)
        out[cid] = mejor
    return out
