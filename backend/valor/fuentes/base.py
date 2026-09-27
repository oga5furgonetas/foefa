"""Lo común a todas las fuentes de cuotas."""
from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional

import httpx

from ..nucleo.modelo import Cuota, Evento

log = logging.getLogger("valor.fuentes")

# httpx apunta cada petición en INFO con la URL entera, y The Odds API y
# OddsPapi llevan la clave EN la URL (?apiKey=…): con el registro del servidor
# en INFO, cada lectura dejaría la clave escrita en los logs de Fly.
logging.getLogger("httpx").setLevel(logging.WARNING)

_CLAVE_EN_TEXTO = re.compile(r"(?i)(api_?key|apikey|x-apisports-key|token|key)=([^&\s'\"]+)")


def limpia(texto) -> str:
    """Un error o un aviso sin claves dentro: se enseñan en pantalla y se guardan."""
    return _CLAVE_EN_TEXTO.sub(r"\1=***", str(texto))


class FalloFuente(httpx.HTTPError):
    """Una respuesta que no es 200, contada sin la URL (que lleva la clave)."""


def comprueba(r: httpx.Response, nombre: str) -> None:
    """`raise_for_status` sin la URL: el mensaje de httpx la incluye entera."""
    if r.status_code >= 400:
        raise FalloFuente(f"{nombre}: la API contestó {r.status_code}")


@dataclass
class Lectura:
    eventos: List[Evento] = field(default_factory=list)
    cuotas: List[Cuota] = field(default_factory=list)
    # Las gratuitas se acaban enseguida: cada fuente dice cuánto le queda.
    cupo_restante: Optional[int] = None
    avisos: List[str] = field(default_factory=list)
    # Lo que ha gastado DE VERDAD esta lectura (llamadas o créditos). None: lo
    # que diga su presupuesto. The Odds API lo cuenta en su cabecera.
    coste: Optional[int] = None
    # Qué se ha leído, para la pantalla: «LaLiga», «bet365.es»...
    detalle: str = ""


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
