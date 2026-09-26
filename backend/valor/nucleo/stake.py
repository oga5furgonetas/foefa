"""Cuánto meter: Kelly fraccionado con topes.

Kelly completo, f = (p·c − 1) / (c − 1), maximiza el crecimiento de la banca
A LA LARGA si p fuera exacta. Nunca lo es: nuestra p es una estimación, y
apostar Kelly completo con una p un poco optimista arruina. Por eso:

  · se apuesta una FRACCIÓN de Kelly (¼ por defecto);
  · con tope por apuesta y por evento (varias apuestas del mismo partido están
    correlacionadas: no son apuestas distintas);
  · y se redondea a importes normales. Apostar 13,47 € es la forma más rápida
    de que una casa te marque como apostador profesional y te limite.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ReglasStake:
    fraccion_kelly: float = 0.25
    tope_apuesta: float = 0.02      # 2 % de la banca como máximo por apuesta
    tope_evento: float = 0.04       # 4 % de la banca entre todas las del mismo partido
    minimo: float = 2.0             # por debajo no merece la pena (y se ve raro)
    redondeo: float = 1.0           # a euros enteros; 5.0 para importes altos


def kelly(p: float, cuota: float) -> float:
    """Fracción de Kelly completa. 0 si no hay ventaja."""
    if cuota <= 1.0 or not (0.0 < p < 1.0):
        return 0.0
    f = (p * cuota - 1.0) / (cuota - 1.0)
    return max(0.0, f)


def importe(p: float, cuota: float, banca: float, reglas: ReglasStake = ReglasStake(),
            ya_en_evento: float = 0.0) -> float:
    """Euros a apostar. 0 si no hay que apostar."""
    f = kelly(p, cuota) * reglas.fraccion_kelly
    f = min(f, reglas.tope_apuesta)
    euros = f * banca
    queda_evento = max(0.0, reglas.tope_evento * banca - ya_en_evento)
    euros = min(euros, queda_evento)
    if reglas.redondeo > 0:
        euros = int(euros // reglas.redondeo) * reglas.redondeo   # hacia abajo, nunca de más
    return float(euros) if euros >= reglas.minimo else 0.0
