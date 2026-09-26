"""Apuestas seguras (surebets): ganar pase lo que pase.

Si cogiendo la MEJOR cuota de cada resultado, cada una en la casa que la paga,
las probabilidades implícitas suman menos de 1, repartiendo el dinero en
proporción a 1/cuota se cobra lo mismo salga el resultado que salga, y ese
cobro es mayor que lo apostado.

    1X2: local 2,30 (Bet365) · empate 3,60 (Codere) · visitante 4,00 (Bwin)
    1/2,30 + 1/3,60 + 1/4,00 = 0,9626  → +3,9 % de beneficio seguro

EL RIESGO NO ES EL RESULTADO, ES METERLAS. Una segura solo es segura si se
meten TODAS las patas a ESAS cuotas. Si una casa cambia la cuota o rechaza la
apuesta a mitad, queda una apuesta suelta. Por eso:
  · solo cuotas muy recientes, y todas de la misma vuelta;
  · beneficio mínimo que compense (0,8 %) y máximo creíble (8 %): por encima
    casi siempre es un dato mal cruzado o un error de la casa que anulará;
  · la pata más difícil de meter se apuesta PRIMERO (lo dice el aviso);
  · importes redondeados sin romper la garantía.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Tuple

from .modelo import RESULTADOS, Cuota, Evento


@dataclass(frozen=True)
class ReglasSeguras:
    beneficio_minimo: float = 0.008
    beneficio_maximo: float = 0.08
    edad_max: float = 120.0             # segundos; en vivo se usa 5
    edad_max_vivo: float = 5.0
    cuota_maxima: float = 15.0
    # Exchanges: su comisión se descuenta antes de calcular.
    comisiones: Dict[str, float] = field(default_factory=lambda: {
        "betfair_ex_eu": 0.05, "betfair_ex_uk": 0.05, "matchbook": 0.02})
    # Casas en las que se puede apostar. Pinnacle no tiene licencia en España.
    excluir: Tuple[str, ...] = ()


@dataclass
class Pata:
    seleccion: str
    casa: str
    cuota: float
    importe: float


@dataclass
class Segura:
    evento: Evento
    mercado: str
    linea: Optional[float]
    patas: List[Pata]
    total: float
    cobro_minimo: float                 # lo que se cobra en el peor resultado
    beneficio: float                    # euros seguros (peor resultado)
    rendimiento: float                  # beneficio / total
    edad_segundos: float
    avisos: List[str] = field(default_factory=list)


def _efectiva(c: Cuota, r: ReglasSeguras) -> float:
    return 1.0 + (c.cuota - 1.0) * (1.0 - r.comisiones.get(c.casa, 0.0))


def repartir(cuotas: List[float], total: float, redondeo: float = 1.0) -> List[float]:
    """Reparte `total` para cobrar lo mismo en cada resultado, redondeando.

    Tras redondear se comprueba que TODAS las patas siguen cobrando más de lo
    apostado; si no, se prueba a subir de uno en uno la pata que queda corta.
    """
    inv = [1 / c for c in cuotas]
    s = sum(inv)
    brutos = [total * x / s for x in inv]
    if redondeo <= 0:
        return brutos
    imp = [max(redondeo, round(b / redondeo) * redondeo) for b in brutos]
    for _ in range(20):
        t = sum(imp)
        cobros = [i * c for i, c in zip(imp, cuotas)]
        peor = min(range(len(cobros)), key=lambda k: cobros[k])
        if cobros[peor] > t:
            return imp
        imp[peor] += redondeo
    return imp


def buscar(eventos: Dict[str, Evento], cuotas: Iterable[Cuota], total: float,
           ahora: Optional[datetime] = None, reglas: ReglasSeguras = ReglasSeguras(),
           redondeo: float = 1.0) -> List[Segura]:
    ahora = ahora or datetime.now(timezone.utc)
    # La mejor cuota vigente de cada resultado, por mercado.
    mejores: Dict[Tuple, Dict[str, Cuota]] = {}
    for c in cuotas:
        e = eventos.get(c.evento_id)
        if e is None or c.casa in reglas.excluir or c.cuota > reglas.cuota_maxima:
            continue
        if not e.en_vivo and e.inicio <= ahora:
            continue
        limite = reglas.edad_max_vivo if e.en_vivo else reglas.edad_max
        if (ahora - c.ts).total_seconds() > limite:
            continue
        if c.linea is not None and abs(abs(c.linea) % 1 - 0.5) > 1e-9:
            continue                    # líneas con devolución: la garantía no es exacta
        k = c.clave_mercado
        previa = mejores.setdefault(k, {}).get(c.seleccion)
        if previa is None or _efectiva(c, reglas) > _efectiva(previa, reglas):
            mejores[k][c.seleccion] = c

    out: List[Segura] = []
    for (evento_id, mercado, linea), sel in mejores.items():
        res = RESULTADOS.get(mercado)
        if not res or any(s not in sel for s in res):
            continue
        patas_c = [sel[s] for s in res]
        if len({c.casa for c in patas_c}) < 2:
            continue                    # una sola casa nunca da segura: sería un error de datos
        ef = [_efectiva(c, reglas) for c in patas_c]
        suma = sum(1 / x for x in ef)
        rend_teorico = 1 / suma - 1
        if rend_teorico < reglas.beneficio_minimo:
            continue
        e = eventos[evento_id]
        imp = repartir(ef, total, redondeo)
        t = sum(imp)
        cobro = min(i * x for i, x in zip(imp, ef))
        seg = Segura(
            evento=e, mercado=mercado, linea=linea,
            patas=[Pata(c.seleccion, c.casa, c.cuota, i) for c, i in zip(patas_c, imp)],
            total=t, cobro_minimo=cobro, beneficio=cobro - t, rendimiento=(cobro - t) / t,
            edad_segundos=max((ahora - c.ts).total_seconds() for c in patas_c))
        if rend_teorico > reglas.beneficio_maximo:
            seg.avisos.append("Demasiado buena para ser verdad: casi siempre es un dato mal "
                              "cruzado o un error de la casa que luego anula. No la metas sin mirarla.")
        # Primero la pata más difícil: la cuota más alta es la que más se mueve y
        # la que antes rechazan o recortan.
        seg.patas.sort(key=lambda p: -p.cuota)
        seg.avisos.append(f"Mete primero la de {seg.patas[0].casa}; si no te la aceptan a "
                          f"{seg.patas[0].cuota:.2f}, no metas las demás.")
        if e.en_vivo:
            seg.avisos.append("En vivo: dura segundos. Si alguna cuota ha cambiado, déjala.")
        out.append(seg)
    out.sort(key=lambda s: s.rendimiento, reverse=True)
    return out
