"""Lo común a todas las fuentes de cuotas."""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional

import httpx

from ..nucleo.modelo import Cuota, Evento

log = logging.getLogger("valor.fuentes")


@dataclass
class Lectura:
    eventos: List[Evento] = field(default_factory=list)
    cuotas: List[Cuota] = field(default_factory=list)
    # Las gratuitas se acaban enseguida: cada fuente dice cuánto le queda.
    cupo_restante: Optional[int] = None
    avisos: List[str] = field(default_factory=list)


class SinClave(RuntimeError):
    pass


class Fuente:
    nombre = "base"
    variable_clave = ""

    def __init__(self, clave: Optional[str] = None, cliente: Optional[httpx.Client] = None):
        self.clave = clave or os.environ.get(self.variable_clave, "")
        self.cliente = cliente or httpx.Client(timeout=20)

    def exige_clave(self) -> None:
        if not self.clave:
            raise SinClave(f"{self.nombre}: falta la variable de entorno {self.variable_clave}")

    def leer(self, deportes: List[str]) -> Lectura:   # pragma: no cover - lo hace cada fuente
        raise NotImplementedError


def ts(valor) -> datetime:
    """ISO 8601 o epoch (s) → datetime UTC."""
    if isinstance(valor, (int, float)):
        return datetime.fromtimestamp(valor, tz=timezone.utc)
    s = str(valor).replace("Z", "+00:00")
    d = datetime.fromisoformat(s)
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
