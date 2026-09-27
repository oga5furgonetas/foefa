"""El formato común. Cada fuente de cuotas traduce lo suyo a esto.

Un MERCADO es una pregunta con resultados excluyentes que suman el 100 %:
«1X2», «más/menos de 2,5 goles», «hándicap −1,5». La línea (2,5; −1,5) es
parte del mercado: una cuota de «más de 2,5» y otra de «más de 3» NO se
comparan nunca. Mezclarlas es el falso positivo más típico de estas
herramientas.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Tuple


@dataclass(frozen=True)
class Evento:
    id: str                      # id estable nuestro (ver valor.fuentes.nombres.id_evento)
    deporte: str                 # "futbol", "tenis", "baloncesto"...
    liga: str
    local: str
    visitante: str
    inicio: datetime             # UTC
    en_vivo: bool = False


@dataclass(frozen=True)
class Cuota:
    evento_id: str
    casa: str                    # "pinnacle", "bet365", "betfair_ex"...
    mercado: str                 # "1x2", "ganador", "totales", "handicap"
    linea: Optional[float]       # 2.5, -1.5... None si el mercado no tiene línea
    seleccion: str               # "local", "empate", "visitante", "mas", "menos"
    cuota: float                 # decimal
    ts: datetime                 # cuándo la vio la fuente (UTC)
    fuente: str = ""             # de qué API vino
    limite: Optional[float] = None   # máximo aceptado, si la fuente lo da

    @property
    def clave_mercado(self) -> Tuple[str, str, Optional[float]]:
        return (self.evento_id, self.mercado, self.linea)


# Qué resultados forman cada mercado completo. Sin TODOS los resultados no se
# puede quitar el margen, así que un mercado a medias no se usa.
class _Resultados(dict):
    """Los resultados de cada mercado. Además de los de la lista, los mercados
    con periodo o con apellido («totales_1p», «handicap_juegos», «corners»,
    «totales_local»...) salen de su primera palabra: son el MISMO tipo de
    apuesta sobre otra cosa, y siguen siendo mercados distintos entre sí
    (distinto nombre = nunca se comparan)."""

    POR_BASE = {"1x2": ("local", "empate", "visitante"), "ganador": ("local", "visitante"),
                "handicap": ("local", "visitante"), "ambos": ("si", "no"),
                "totales": ("mas", "menos"), "juegos": ("mas", "menos"), "corners": ("mas", "menos"),
                "tarjetas": ("mas", "menos")}

    def __missing__(self, mercado):
        v = self.POR_BASE.get(str(mercado).split("_")[0])
        if v is None:
            raise KeyError(mercado)
        return v

    def get(self, mercado, defecto=None):
        try:
            return self[mercado]
        except KeyError:
            return defecto


RESULTADOS: Dict[str, Tuple[str, ...]] = _Resultados({
    "1x2": ("local", "empate", "visitante"),
    "ganador": ("local", "visitante"),          # sin empate: tenis, baloncesto con prórroga
    "totales": ("mas", "menos"),
    "handicap": ("local", "visitante"),         # asiático, sin empate posible
    "ambos_marcan": ("si", "no"),
})


@dataclass
class Oportunidad:
    evento: Evento
    mercado: str
    linea: Optional[float]
    seleccion: str
    casa: str
    cuota: float
    prob_justa: float            # la conservadora (la menos favorable)
    cuota_justa: float
    ev: float                    # 0.05 = +5 % por euro apostado
    importe: float               # euros sugeridos
    referencia: List[str]        # casas afiladas en las que se basa
    por_metodo: Dict[str, float] # prob. justa según cada método
    edad_segundos: float
    motivos: List[str] = field(default_factory=list)   # por qué sí
    avisos: List[str] = field(default_factory=list)    # qué mirar antes de apostar
    fallo: str = "valor"         # el punto flaco de la casa (puntos_flacos.py)
    # Para auditarla después con los datos de entonces: de cuándo eran las
    # cuotas, las referencias y lo que pagaban las demás casas en ese momento.
    ts_cuota: Optional[datetime] = None
    ts_referencia: Optional[datetime] = None
    ref_cuotas: Dict[str, float] = field(default_factory=dict)
    otras: Dict[str, float] = field(default_factory=dict)
    fuente: str = ""
    edad_max: float = 600.0      # segundos que vale (10 min prepartido, 8 s en vivo)
