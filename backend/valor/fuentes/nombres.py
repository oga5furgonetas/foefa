"""Que «Real Betis Balompié», «Betis» y «R. Betis» sean el mismo equipo.

Cada fuente escribe los nombres a su manera. Si el cruce falla hay dos
errores posibles, y los dos son caros:
  · no cruzar el mismo partido  → se pierde una oportunidad (malo);
  · cruzar dos partidos distintos → la cuota de uno se compara con la
    referencia de otro y sale un «chollo» falso (MUCHO peor).
Por eso el cruce es conservador: mismo deporte, inicio a menos de 20 minutos
y LOS DOS equipos parecidos. Ante la duda, no se cruza.
"""
from __future__ import annotations

import hashlib
import re
import unicodedata
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from typing import Dict, Iterable, List, Optional

from ..nucleo.modelo import Evento

# Palabras que no distinguen a un equipo de otro.
_RELLENO = {
    "fc", "cf", "cd", "ud", "sd", "sc", "ac", "as", "afc", "club", "de", "del", "la", "el",
    "balompie", "futbol", "football", "calcio", "sporting", "ssc", "sv", "vfb", "vfl", "tsg",
    "bk", "if", "fk", "sk", "nk", "rc", "rcd", "ca", "cp", "ad", "the", "and", "&",
}
# Alias que no se deducen por parecido. Se amplía cuando salga un fallo real.
ALIAS: Dict[str, str] = {
    "man utd": "manchester united", "man united": "manchester united",
    "man city": "manchester city", "spurs": "tottenham hotspur", "wolves": "wolverhampton",
    "psg": "paris saint germain", "inter": "internazionale", "inter milan": "internazionale",
    "atletico": "atletico madrid", "atl madrid": "atletico madrid",
    "athletic": "athletic bilbao", "barca": "barcelona", "bayern": "bayern munchen",
    "bayern munich": "bayern munchen", "gladbach": "borussia monchengladbach",
    "leverkusen": "bayer leverkusen", "dortmund": "borussia dortmund",
}


def normaliza(nombre: str) -> str:
    s = unicodedata.normalize("NFKD", nombre or "").encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = " ".join(s.split())
    s = ALIAS.get(s, s)
    palabras = [p for p in s.split() if p not in _RELLENO]
    return " ".join(palabras) or s


def parecido(a: str, b: str) -> float:
    """0..1. Un nombre contenido en el otro («betis» en «real betis») cuenta alto."""
    na, nb = normaliza(a), normaliza(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    ta, tb = set(na.split()), set(nb.split())
    if ta <= tb or tb <= ta:
        return 0.9
    return SequenceMatcher(None, na, nb).ratio()


def id_evento(deporte: str, local: str, visitante: str, inicio: datetime) -> str:
    base = f"{deporte}|{normaliza(local)}|{normaliza(visitante)}|{inicio:%Y-%m-%d}"
    return hashlib.sha1(base.encode()).hexdigest()[:16]


class Cruce:
    """Registro de eventos conocidos: da el MISMO id al mismo partido venga de donde venga."""

    UMBRAL = 0.82
    VENTANA = timedelta(minutes=20)

    def __init__(self) -> None:
        self.eventos: Dict[str, Evento] = {}

    def buscar(self, deporte: str, local: str, visitante: str, inicio: datetime) -> Optional[Evento]:
        mejor, nota = None, 0.0
        for e in self.eventos.values():
            if e.deporte != deporte or abs(e.inicio - inicio) > self.VENTANA:
                continue
            n = min(parecido(e.local, local), parecido(e.visitante, visitante))
            if n >= self.UMBRAL and n > nota:
                mejor, nota = e, n
        return mejor

    def registra(self, e: Evento) -> Evento:
        """Devuelve el evento con el que se queda (el ya conocido si es el mismo)."""
        previo = self.buscar(e.deporte, e.local, e.visitante, e.inicio)
        if previo is None:
            self.eventos[e.id] = e
            return e
        if e.en_vivo and not previo.en_vivo:
            previo = Evento(previo.id, previo.deporte, previo.liga, previo.local,
                            previo.visitante, previo.inicio, True)
            self.eventos[previo.id] = previo
        return previo

    def todos(self) -> Iterable[Evento]:
        return list(self.eventos.values())
