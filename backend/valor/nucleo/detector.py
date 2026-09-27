"""El detector: dónde paga una casa más de lo que vale el resultado.

EL MÉTODO (el único con respaldo sólido a largo plazo):
  1. La cuota JUSTA sale de las casas afiladas (Pinnacle, exchanges). Aceptan
     apuestas grandes de profesionales y corrigen la línea con ese dinero, así
     que su precio, sin margen, es la mejor estimación pública de la
     probabilidad real. Está medido: las cuotas de cierre de Pinnacle predicen
     los resultados mejor que cualquier modelo público.
  2. Una casa blanda (Bet365, Codere...) tarda en mover sus cuotas o las pone
     a ojo. Cuando paga más que la cuota justa, apostar ahí tiene EV positivo.
  3. Cuánto: Kelly fraccionado (stake.py).

CONTRA LOS FALSOS POSITIVOS, que en esto son la norma y no la excepción:
  · sin referencia afilada fresca no hay apuesta: no se «estima» a ojo;
  · el margen se quita con varios métodos y se usa el MENOS favorable;
  · si hay dos referencias y no coinciden, el mercado no está claro: fuera;
  · cuotas viejas (de la casa blanda o de la referencia) no cuentan: una
    cuota de hace dos minutos en vivo ya no existe;
  · un EV enorme casi nunca es un chollo, es un dato mal cruzado (otra línea,
    otro partido, un jugador retirado): se aparta como sospechoso;
  · tapados muy largos fuera: es donde quitar el margen se equivoca más;
  · un hándicap cuya escalera no cuadra (la casa paga MÁS por el +4,5 que por
    el +3,5, lo que es imposible) es un dato cruzado de la fuente, no un
    chollo: va a sospechosas. Pasó el 27-09-2026 con PokerStars y Codere en la
    NFL (daban «+6 %» que no existía);
  · si la casa da los dos lados y, quitándole su margen, ve una probabilidad a
    más de 6 puntos de la de Pinnacle, no hablan de la misma apuesta (lados
    cambiados, otra línea, otro periodo): sospechosa. Medido el 27-09 con 1.745
    comparaciones reales de las casas de Dani: la mitad se separa menos de 1,1
    puntos y 99 de cada 100 menos de 4,7; por encima de 6, con ventaja, solo las
    dos líneas cruzadas de PokerStars en la NFL (7,3 y 7,4). El Dolphins +13,5
    de Gamdom, bueno, se separa 3,4.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Tuple

from .margen import justas, margen
from .modelo import RESULTADOS, Cuota, Evento, Oportunidad
from .stake import ReglasStake, importe


@dataclass(frozen=True)
class ReglasDetector:
    afiladas: Tuple[str, ...] = ("pinnacle", "betfair_ex_eu", "betfair_ex_uk", "matchbook")
    # Comisión sobre la ganancia neta cuando la casa es un exchange.
    comisiones: Dict[str, float] = field(default_factory=lambda: {
        "betfair_ex_eu": 0.05, "betfair_ex_uk": 0.05, "matchbook": 0.02})
    ev_minimo: float = 0.02
    ev_sospechoso: float = 0.20
    cuota_minima: float = 1.20
    # Excepción: por debajo de la mínima, pero con MUCHO valor, también vale.
    # 0 = sin excepción.
    cuota_minima_excepcion: float = 0.0
    ev_excepcion: float = 0.05
    cuota_maxima: float = 8.0
    # Probabilidad mínima de acertar. 0,60 = solo apuestas que salen 6 de cada
    # 10 veces o más (cuota justa ≤ 1,67). Más alta = se acierta más, pero hay
    # menos avisos y menos ventaja por apuesta.
    prob_minima: float = 0.0
    # Segundos. En prepartido las líneas se mueven despacio salvo cerca del
    # inicio o con noticias (alineaciones, lesiones); 10 minutos es el límite
    # que admiten las fuentes gratuitas sin dar por buena una cuota que ya no
    # existe. Con una fuente de pago se baja (ver EN_VIVO).
    edad_max_casa: float = 600.0
    edad_max_referencia: float = 600.0
    margen_max_referencia: float = 0.08
    referencias_minimas: int = 1
    desacuerdo_max: float = 0.03        # diferencia de prob. entre referencias
    desvio_max: float = 0.06            # casa (sin su margen) frente a la referencia
    stake: ReglasStake = ReglasStake()
    # Casas donde se puede apostar. None = todas. Una cuota buena en una web
    # francesa o sueca no sirve de nada desde España: sigue contando como
    # «otras casas» para comparar, pero no se recomienda.
    apostables: Optional[Tuple[str, ...]] = None


PREPARTIDO = ReglasDetector()
EN_VIVO = replace(
    PREPARTIDO,
    ev_minimo=0.04, cuota_maxima=5.0, edad_max_casa=8.0, edad_max_referencia=8.0,
    margen_max_referencia=0.10, desacuerdo_max=0.025)


@dataclass
class Resultado:
    oportunidades: List[Oportunidad]
    sospechosas: List[Oportunidad]
    descartes: Dict[str, int]           # por qué se descartó cada cosa, contado
    # Lo que MÁS se acercó sin cumplir las reglas (con ventaja, en casas donde se
    # apuesta, con datos buenos). NO son recomendaciones: cada una lleva en
    # `avisos[0]` la regla que no cumple. Sirven para ver que el buscador lee y
    # dónde se queda cerca.
    casi: List[Oportunidad] = field(default_factory=list)


def _edad(ts: datetime, ahora: datetime) -> float:
    return (ahora - ts).total_seconds()


def _efectiva(c: Cuota, reglas: ReglasDetector) -> float:
    com = reglas.comisiones.get(c.casa, 0.0)
    return 1.0 + (c.cuota - 1.0) * (1.0 - com)


def _ultimas(cuotas: Iterable[Cuota]) -> Dict[Tuple, Dict[str, Dict[str, Cuota]]]:
    """{clave_mercado: {casa: {seleccion: la cuota más reciente}}}"""
    out: Dict[Tuple, Dict[str, Dict[str, Cuota]]] = defaultdict(lambda: defaultdict(dict))
    for c in cuotas:
        previa = out[c.clave_mercado][c.casa].get(c.seleccion)
        if previa is None or c.ts > previa.ts:
            out[c.clave_mercado][c.casa][c.seleccion] = c
    return out


TOLERANCIA_ESCALERA = 0.01


# Solo el hándicap. En los totales, que una línea contradiga a otra es una de
# las tres razones de valor de Valor («INCOHERENCIA INTERNA», puntos_flacos.py)
# y no hay ningún caso real de escalera de totales rota por un dato cruzado.
ESCALONADOS = ("handicap",)


def _escaleras(ultimas) -> Dict[Tuple, Dict[float, Dict[str, float]]]:
    """{(evento, casa, mercado): {línea: {selección: cuota}}} de hándicaps y totales."""
    out: Dict[Tuple, Dict[float, Dict[str, float]]] = defaultdict(dict)
    for (evento_id, mercado, linea), casas in ultimas.items():
        if mercado not in ESCALONADOS or linea is None:
            continue
        for casa, fila in casas.items():
            out[(evento_id, casa, mercado)][linea] = {s: c.cuota for s, c in fila.items()}
    return out


# Con la línea más alta, cómo tiene que moverse la cuota de cada selección:
# −1 no puede subir, +1 no puede bajar. La línea es la del LOCAL: con más
# puntos a su favor, lo suyo es más fácil y paga menos.
SENTIDO = {"handicap": {"local": -1, "visitante": 1}}


def escalera_rota(escalera: Dict[float, Dict[str, float]], linea: float,
                  mercado: str = "handicap") -> Optional[str]:
    """Si esta línea contradice a otra línea de la misma casa, en cualquiera de
    sus lados, no es fiable: una de las dos está mal y no se sabe cuál. Visto el
    27-09 en OddsPapi: PokerStars pagaba 1,80 al Bears +3,5 y 1,91 al +4,5."""
    if linea not in escalera:
        return None
    for otra in escalera:
        if otra == linea:
            continue
        baja, alta = sorted((linea, otra))
        for sel, sentido in SENTIDO.get(mercado, {}).items():
            c_baja, c_alta = escalera[baja].get(sel), escalera[alta].get(sel)
            if c_baja is None or c_alta is None:
                continue
            sube_de_mas = sentido < 0 and c_alta > c_baja + TOLERANCIA_ESCALERA
            baja_de_mas = sentido > 0 and c_alta + TOLERANCIA_ESCALERA < c_baja
            if sube_de_mas or baja_de_mas:
                cual = "de hándicap" if mercado == "handicap" else "de totales"
                return (f"La escalera {cual} de esta casa no cuadra: a «{sel}» le paga {c_baja:.2f} con "
                        f"{baja:+g} y {c_alta:.2f} con {alta:+g}, y eso es imposible. Casi seguro es un dato "
                        f"cruzado de la fuente, no un chollo.")
    return None


def detectar(eventos: Dict[str, Evento], cuotas: Iterable[Cuota], banca: float,
             ahora: Optional[datetime] = None,
             prepartido: ReglasDetector = PREPARTIDO,
             vivo: ReglasDetector = EN_VIVO,
             expuesto: Optional[Dict[str, float]] = None) -> Resultado:
    """`expuesto`: {evento_id: euros} ya apostados y sin liquidar. El tope por
    partido (4 %) cuenta con ellos: si ya llevas 30 € en el Betis–Sevilla, una
    apuesta nueva en ese partido solo puede llenar lo que queda."""
    ahora = ahora or datetime.now(timezone.utc)
    descartes: Dict[str, int] = defaultdict(int)
    candidatas: List[Oportunidad] = []
    sospechosas: List[Oportunidad] = []
    casi: List[Oportunidad] = []

    ultimas = _ultimas(cuotas)
    escaleras = _escaleras(ultimas)
    for (evento_id, mercado, linea), casas in ultimas.items():
        ev_obj = eventos.get(evento_id)
        if ev_obj is None:
            descartes["evento desconocido"] += 1
            continue
        if not ev_obj.en_vivo and ev_obj.inicio <= ahora:
            # Empezó y la fuente no lo da como en vivo: la cuota es de antes.
            descartes["ya empezado"] += 1
            continue
        reglas = vivo if ev_obj.en_vivo else prepartido
        sels = RESULTADOS.get(mercado)
        if not sels:
            descartes["mercado no soportado"] += 1
            continue
        if linea is not None and abs(abs(linea) % 1 - 0.5) > 1e-9:
            # Líneas enteras (2, −1) o de cuarto (2,25) devuelven todo o parte del
            # dinero en algún resultado: el EV de dos resultados ya no es exacto.
            # Solo x,5, donde no hay devolución posible.
            descartes["línea con devolución"] += 1
            continue

        # ── 1. La referencia ───────────────────────────────────────────
        refs: Dict[str, Dict[str, List[float]]] = {}
        for casa in reglas.afiladas:
            fila = casas.get(casa)
            if not fila or any(s not in fila for s in sels):
                continue
            if max(_edad(fila[s].ts, ahora) for s in sels) > reglas.edad_max_referencia:
                descartes["referencia vieja"] += 1
                continue
            precios = [fila[s].cuota for s in sels]
            if margen(precios) > reglas.margen_max_referencia:
                descartes["referencia con mucho margen"] += 1
                continue
            refs[casa] = justas(precios)
        if len(refs) < reglas.referencias_minimas:
            descartes["sin referencia afilada"] += 1
            continue

        if len(refs) > 1:
            base = [r["shin"] for r in refs.values()]
            dif = max(max(b[i] for b in base) - min(b[i] for b in base) for i in range(len(sels)))
            if dif > reglas.desacuerdo_max:
                descartes["referencias no coinciden"] += 1
                continue

        # ── 2. Las casas blandas ─────────────────────────────────────────
        for casa, fila in casas.items():
            if casa in reglas.afiladas and casa not in reglas.comisiones:
                continue            # Pinnacle es la vara de medir, no donde se apuesta
            if reglas.apostables is not None and casa not in reglas.apostables:
                descartes["casa donde no apuestas"] += 1
                continue
            # Un exchange puede ser referencia y sitio donde apostar, pero nunca
            # se mide contra sí mismo: se usa el resto de referencias.
            otras = {r: v for r, v in refs.items() if r != casa}
            if not otras:
                continue
            por_metodo = _media(otras, len(sels))
            for i, sel in enumerate(sels):
                c = fila.get(sel)
                if c is None:
                    continue
                edad = _edad(c.ts, ahora)
                if edad > reglas.edad_max_casa:
                    descartes["cuota vieja"] += 1
                    continue
                baja = c.cuota < reglas.cuota_minima
                suelo = reglas.cuota_minima_excepcion or reglas.cuota_minima
                metodo_p = {m: ps[i] for m, ps in por_metodo.items()}
                p = min(metodo_p.values())
                cuota_ef = _efectiva(c, reglas)
                ev = p * cuota_ef - 1.0
                desvio = None
                if all(s in fila for s in sels):
                    inv = [1.0 / fila[s].cuota for s in sels]
                    desvio = abs(inv[i] / sum(inv) - p)

                def nueva(c=c, p=p, ev=ev, metodo_p=metodo_p, sel=sel, casa=casa, edad=edad):
                    return Oportunidad(
                        evento=ev_obj, mercado=mercado, linea=linea, seleccion=sel,
                        casa=casa, cuota=c.cuota, prob_justa=p, cuota_justa=1.0 / p, ev=ev,
                        importe=0.0, referencia=sorted(otras), por_metodo=metodo_p,
                        edad_segundos=edad, ts_cuota=c.ts,
                        ts_referencia=min(casas[r][s].ts for r in otras for s in sels),
                        ref_cuotas={r: casas[r][sel].cuota for r in otras},
                        otras={k: f[sel].cuota for k, f in casas.items()
                               if k != casa and k not in reglas.afiladas and sel in f
                               and _edad(f[sel].ts, ahora) <= reglas.edad_max_casa},
                        fuente=c.fuente, edad_max=min(reglas.edad_max_casa, reglas.edad_max_referencia))

                if desvio is not None and desvio > reglas.desvio_max:
                    descartes["la casa y la referencia no hablan de la misma apuesta"] += 1
                    if ev > 0:
                        o_sosp = nueva()
                        o_sosp.avisos.append(
                            f"{casa} ve esta selección con un {inv[i] / sum(inv):.0%} de probabilidad y la "
                            f"referencia con un {p:.0%}: tanta diferencia no es una casa lenta, es otro "
                            f"mercado con el mismo nombre (lados cambiados, otra línea u otro periodo).")
                        sospechosas.append(o_sosp)
                    continue
                # Mismo orden de reglas que siempre; lo que se queda fuera por
                # POCO (con ventaja positiva) se guarda aparte, con el porqué.
                no = None
                if not (suelo <= c.cuota <= reglas.cuota_maxima):
                    descartes["cuota fuera de rango"] += 1
                    if c.cuota < suelo:
                        no = f"Cuota {c.cuota:.2f}: por debajo de tu mínimo ({suelo:.2f})."
                    else:
                        continue            # tapados larguísimos: ni «casi»
                elif p < reglas.prob_minima:
                    descartes["poca probabilidad de acertar"] += 1
                    # Con un decimal: «sale el 60 %, tu mínimo es el 60 %» (59,8 redondeado) no se entiende.
                    no = f"Sale el {p:.1%} de las veces; tu mínimo es el {reglas.prob_minima:.0%}."
                elif ev < reglas.ev_minimo:
                    no = f"Ventaja {ev:+.1%}; tu mínimo es {reglas.ev_minimo:+.0%}."
                elif baja and ev < reglas.ev_excepcion:
                    descartes["cuota baja sin valor suficiente"] += 1
                    no = (f"Cuota {c.cuota:.2f} (menos de {reglas.cuota_minima:.2f}) con ventaja {ev:+.1%}; "
                          f"por debajo de {reglas.cuota_minima:.2f} pides {reglas.ev_excepcion:+.0%}.")
                if no is not None:
                    if 0 < ev <= reglas.ev_sospechoso and not (
                            mercado in ESCALONADOS
                            and escalera_rota(escaleras.get((evento_id, casa, mercado), {}), linea, mercado)):
                        o_casi = nueva()
                        o_casi.avisos.append(no)
                        casi.append(o_casi)
                    continue
                refs_txt = ", ".join(
                    f"{r} {casas[r][sel].cuota:.2f}" for r in sorted(otras))
                op = nueva()
                op.motivos.append(
                    f"Cuota justa {1 / p:.2f} (prob. {p:.1%}, método más prudente de "
                    f"{len(metodo_p)}; referencia: {refs_txt}).")
                op.motivos.append(
                    f"{casa} paga {c.cuota:.2f}"
                    + (f" ({cuota_ef:.2f} tras comisión)" if cuota_ef != c.cuota else "")
                    + f": EV {ev:+.1%} por euro apostado.")
                if c.limite is not None:
                    op.avisos.append(f"Límite publicado: {c.limite:.0f}.")
                if ev > reglas.ev_sospechoso:
                    op.avisos.append(
                        "EV demasiado alto para ser real: casi siempre es un dato mal "
                        "cruzado (otra línea, otro partido, un retirado). Compruébalo "
                        "a mano antes de nada.")
                    sospechosas.append(op)
                    continue
                if mercado in ESCALONADOS:
                    rota = escalera_rota(escaleras.get((evento_id, casa, mercado), {}), linea, mercado)
                    if rota:
                        op.avisos.append(rota)
                        descartes["hándicap con la escalera rota" if mercado == "handicap"
                                  else "totales con la escalera rota"] += 1
                        sospechosas.append(op)
                        continue
                if ev_obj.en_vivo:
                    op.avisos.append(
                        f"En vivo: la cuota tiene {edad:.0f} s. Si al ir a apostar ha "
                        f"bajado de {(1 + reglas.ev_minimo) / p:.2f}, ya no hay valor.")
                candidatas.append(op)

    # ── 3. Cuánto, de más valor a menos, con tope por evento ───────────────
    candidatas.sort(key=lambda o: o.ev, reverse=True)
    expuesto = defaultdict(float, expuesto or {})
    finales: List[Oportunidad] = []
    for op in candidatas:
        reglas = vivo if op.evento.en_vivo else prepartido
        eur = importe(op.prob_justa, _efectiva_op(op, reglas), banca, reglas.stake,
                      expuesto[op.evento.id])
        if eur <= 0:
            descartes["importe demasiado pequeño"] += 1
            continue
        op.importe = eur
        op.motivos.append(
            f"Meter {eur:.0f} € ({eur / banca:.1%} de la banca): Kelly × "
            f"{reglas.stake.fraccion_kelly:g}, con tope.")
        expuesto[op.evento.id] += eur
        finales.append(op)
    casi.sort(key=lambda o: o.ev, reverse=True)
    return Resultado(finales, sospechosas, dict(descartes), casi)


def _media(refs: Dict[str, Dict[str, List[float]]], n: int) -> Dict[str, List[float]]:
    """Prob. justa por método = media de las referencias."""
    metodos = next(iter(refs.values()))
    return {m: [sum(r[m][i] for r in refs.values()) / len(refs) for i in range(n)]
            for m in metodos}


def _efectiva_op(op: Oportunidad, reglas: ReglasDetector) -> float:
    com = reglas.comisiones.get(op.casa, 0.0)
    return 1.0 + (op.cuota - 1.0) * (1.0 - com)
