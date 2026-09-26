"""Por qué una casa paga de más: los puntos flacos de su software.

Una ventaja sin explicación es sospechosa. Una ventaja con una causa conocida
y comprobable es la buena. Estas son las tres causas que se buscan, de más a
menos habitual:

1. CASA LENTA. Entra dinero en el mercado afilado (una baja, la alineación,
   un profesional grande) y Pinnacle mueve la cuota en segundos. Muchas casas
   blandas copian ese precio con retraso, o solo lo revisan cada pocos
   minutos. Mientras tanto pagan un precio que ya no existe. Se detecta con el
   histórico: la referencia se ha movido y la casa no ha tocado su cuota.

2. CASA DESALINEADA. Una casa paga claramente más que TODAS las demás. Si
   fuera el mercado el que dudara, las demás estarían repartidas; cuando una
   sola se sale, el fallo es suyo (un ajuste manual, un error de su modelo).

3. INCOHERENCIA INTERNA. La casa se contradice a sí misma. Las líneas de goles
   secundarias (más de 1,5 / 3,5…) las calcula un modelo a partir de la
   principal, y a veces se quedan descolgadas: «más de 2,5» no puede ser más
   probable que «más de 1,5», y si la casa lo paga así, una de las dos está mal.

Nada de esto sustituye a la cuota justa: el detector ya exigió que la cuota
tuviera valor contra Pinnacle. Esto dice POR QUÉ lo tiene, y el aprendizaje
mide por separado qué causa funciona de verdad.
"""
from __future__ import annotations

import statistics
from datetime import datetime, timedelta
from typing import Iterable, List, Optional, Tuple

from .nucleo.modelo import Cuota, Oportunidad

LENTA, DESALINEADA, INCOHERENTE, VALOR = "casa lenta", "casa desalineada", "incoherencia interna", "valor"


def casa_lenta(o: Oportunidad, reg, ahora: datetime) -> Optional[str]:
    desde = ahora - timedelta(hours=3)
    for ref in o.referencia:
        hist = reg.historial(o.evento.id, ref, o.mercado, o.linea, o.seleccion, desde)
        if len(hist) < 2:
            continue
        # Desde el precio más alto de la referencia hasta el actual: es la caída
        # que la casa blanda aún no ha copiado.
        pico = max(hist, key=lambda x: x[1])
        actual = hist[-1]
        if pico[0] >= actual[0] or pico[1] / actual[1] - 1 < 0.03:
            continue
        propia = reg.historial(o.evento.id, o.casa, o.mercado, o.linea, o.seleccion, desde)
        antes_del_pico = [c for t, c in propia if t <= pico[0]]
        despues = [c for t, c in propia if t > pico[0]]
        # La casa no se ha movido: mismo precio (o más alto) que antes de la caída.
        if antes_del_pico and despues and min(despues) >= antes_del_pico[-1] - 1e-9:
            mins = int((actual[0] - pico[0]).total_seconds() // 60)
            return (f"CASA LENTA: {ref} ha bajado esta cuota de {pico[1]:.2f} a {actual[1]:.2f} en "
                    f"{mins} min (está entrando dinero) y {o.casa} sigue a {o.cuota:.2f} sin tocarla.")
        if not propia or len(propia) == 1:
            mins = int((actual[0] - pico[0]).total_seconds() // 60)
            return (f"{ref} ha bajado esta cuota de {pico[1]:.2f} a {actual[1]:.2f} en {mins} min; "
                    f"{o.casa} sigue a {o.cuota:.2f}.")
    return None


def desalineada(o: Oportunidad, cuotas: Iterable[Cuota], afiladas: Tuple[str, ...]) -> Optional[str]:
    otras = sorted({c.casa: c.cuota for c in cuotas
                    if c.evento_id == o.evento.id and c.mercado == o.mercado and c.linea == o.linea
                    and c.seleccion == o.seleccion and c.casa != o.casa and c.casa not in afiladas}.values())
    if len(otras) < 2:
        return None
    mediana = statistics.median(otras)
    if o.cuota >= mediana * 1.05 and o.cuota > max(otras):
        return (f"CASA DESALINEADA: {o.casa} paga {o.cuota:.2f} y las otras {len(otras)} casas entre "
                f"{otras[0]:.2f} y {otras[-1]:.2f}. El fallo es de {o.casa}, no del mercado.")
    return None


def _prob_mas(fila: dict) -> Optional[float]:
    mas, menos = fila.get("mas"), fila.get("menos")
    if mas and menos:
        return (1 / mas) / (1 / mas + 1 / menos)
    return None


def incoherente(o: Oportunidad, cuotas: Iterable[Cuota]) -> Optional[str]:
    if o.mercado != "totales":
        return None
    lineas: dict = {}
    for c in cuotas:
        if c.evento_id == o.evento.id and c.casa == o.casa and c.mercado == "totales":
            lineas.setdefault(c.linea, {})[c.seleccion] = c.cuota
    probs = sorted((l, _prob_mas(f)) for l, f in lineas.items() if _prob_mas(f) is not None)
    for (l1, p1), (l2, p2) in zip(probs, probs[1:]):
        # Con más goles exigidos la probabilidad de «más» TIENE que bajar.
        if p2 > p1 + 0.01 and o.linea in (l1, l2):
            return (f"INCOHERENCIA INTERNA: {o.casa} da «más de {l2:g}» ({p2:.0%}) como más probable "
                    f"que «más de {l1:g}» ({p1:.0%}), y eso es imposible. Una de sus líneas está descolgada.")
    return None


def analizar(o: Oportunidad, cuotas: List[Cuota], reg, ahora: datetime, afiladas: Tuple[str, ...]) -> None:
    """Pone en `o.fallo` la causa principal y la explica la primera en los motivos."""
    hallazgos = [(LENTA, casa_lenta(o, reg, ahora)), (DESALINEADA, desalineada(o, cuotas, afiladas)),
                 (INCOHERENTE, incoherente(o, cuotas))]
    hallados = [(t, txt) for t, txt in hallazgos if txt]
    for _, txt in reversed(hallados):
        o.motivos.insert(0, txt)
    o.fallo = next((t for t, txt in hallados if txt.startswith(t.upper())), VALOR)
    if len(hallados) >= 2:
        o.motivos.insert(0, f"{len(hallados)} puntos flacos a la vez en esta cuota.")
