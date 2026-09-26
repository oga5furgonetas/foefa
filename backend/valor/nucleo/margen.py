"""Quitar el margen de la casa: de cuotas a probabilidades justas.

Una casa nunca paga lo justo. Si un partido a dos resultados sale a 1,90 y
1,90, las probabilidades implícitas suman 1/1,90 + 1/1,90 = 1,0526: ese 5,26 %
de más es el margen (overround). Para saber cuánto vale de verdad cada
resultado hay que repartir ese margen, y NO hay una única forma correcta:

  · proporcional (multiplicativo): reparte el margen en proporción a cada
    probabilidad. Sencillo, pero infravalora el sesgo favorito/tapado;
  · aditivo: resta lo mismo a cada resultado;
  · potencia: p_i = q_i ** k, con k tal que sumen 1. Carga más margen en los
    tapados, que es donde las casas lo meten de verdad;
  · Shin: modela que una parte del dinero viene de gente con información
    privilegiada. Es el que mejor se ajusta en los estudios con cuotas de
    cierre (Shin 1993; Štrumbelj 2014).

Por eso el motor no se casa con ninguno: calcula varios y, para decidir si una
apuesta tiene valor, usa el MENOS favorable para nosotros. Si solo sale valor
con un método, no hay valor: es ruido del método.
"""
from __future__ import annotations

import math
from typing import Callable, Dict, List, Sequence


def implicitas(cuotas: Sequence[float]) -> List[float]:
    if any(c <= 1.0 for c in cuotas):
        raise ValueError(f"cuota no válida (tiene que ser > 1): {list(cuotas)}")
    return [1.0 / c for c in cuotas]


def margen(cuotas: Sequence[float]) -> float:
    """Overround: 0,0526 para 1,90/1,90."""
    return sum(implicitas(cuotas)) - 1.0


def proporcional(cuotas: Sequence[float]) -> List[float]:
    q = implicitas(cuotas)
    s = sum(q)
    return [x / s for x in q]


def aditivo(cuotas: Sequence[float]) -> List[float]:
    q = implicitas(cuotas)
    exceso = (sum(q) - 1.0) / len(q)
    p = [x - exceso for x in q]
    if any(x <= 0 for x in p):
        # Con un tapado muy largo el aditivo da probabilidades negativas: ahí
        # no sirve y se cae al proporcional, que siempre es válido.
        return proporcional(cuotas)
    return p


def _biseccion(f: Callable[[float], float], a: float, b: float, iters: int = 200) -> float:
    fa = f(a)
    for _ in range(iters):
        m = (a + b) / 2
        fm = f(m)
        if (fm > 0) == (fa > 0):
            a, fa = m, fm
        else:
            b = m
    return (a + b) / 2


def potencia(cuotas: Sequence[float]) -> List[float]:
    q = implicitas(cuotas)
    s = sum(q)
    if abs(s - 1.0) < 1e-12:
        return list(q)
    # sum(q_i ** k) es decreciente en k (q_i < 1). Con margen positivo k > 1.
    a, b = (1.0, 50.0) if s > 1 else (0.02, 1.0)
    k = _biseccion(lambda k: sum(x ** k for x in q) - 1.0, a, b)
    p = [x ** k for x in q]
    t = sum(p)
    return [x / t for x in p]


def shin(cuotas: Sequence[float]) -> List[float]:
    q = implicitas(cuotas)
    s = sum(q)
    if s <= 1.0:
        # Sin margen (o con margen negativo, que pasa en exchanges) Shin no
        # tiene solución: z = 0 y queda el proporcional.
        return proporcional(cuotas)

    def probs(z: float) -> List[float]:
        return [(math.sqrt(z * z + 4 * (1 - z) * x * x / s) - z) / (2 * (1 - z)) for x in q]

    z = _biseccion(lambda z: sum(probs(z)) - 1.0, 0.0, 0.4)
    p = probs(z)
    t = sum(p)
    return [x / t for x in p]


METODOS: Dict[str, Callable[[Sequence[float]], List[float]]] = {
    "proporcional": proporcional,
    "aditivo": aditivo,
    "potencia": potencia,
    "shin": shin,
}


def justas(cuotas: Sequence[float]) -> Dict[str, List[float]]:
    """Las probabilidades justas por cada método."""
    return {nombre: f(cuotas) for nombre, f in METODOS.items()}
