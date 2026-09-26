"""Datos de ejemplo para ver la pantalla sin claves de API.

    python -m valor.demo valor-demo.db
    VALOR_DB=valor-demo.db VALOR_CLAVE=demo uvicorn valor.web:app --port 8100

Todo lo que sale es INVENTADO: sirve para ver cómo se ve, no para apostar.
"""
from __future__ import annotations

import sys
from dataclasses import replace
from datetime import datetime, timedelta, timezone

from .fuentes.nombres import Cruce, id_evento
from .nucleo.detector import EN_VIVO, PREPARTIDO, detectar
from .nucleo.modelo import Cuota, Evento
from .registro import Registro


def sembrar(ruta: str) -> None:
    reg = Registro(ruta)
    cr = Cruce()
    ahora = datetime.now(timezone.utc)
    t = ahora - timedelta(seconds=4)
    partidos = [
        ("Real Betis", "Sevilla", "LaLiga", timedelta(hours=5), False,
         {"pinnacle": (2.10, 3.45, 3.70), "bet365": (2.30, 3.30, 3.40), "codere": (2.12, 3.72, 3.50),
          "bwin": (2.05, 3.40, 4.10)}),
        ("Arsenal", "Chelsea", "Premier League", timedelta(hours=26), False,
         {"pinnacle": (1.80, 3.90, 4.60), "williamhill": (1.85, 3.80, 4.40),
          "betfair_ex_eu": (1.83, 4.00, 4.80)}),
        ("Getafe", "Sevilla", "LaLiga", timedelta(hours=2), False,
         {"pinnacle": (6.00, 4.30, 1.62), "bet365": (5.50, 4.00, 1.80), "codere": (5.80, 4.10, 1.66)}),
        ("Inter", "Napoli", "Serie A", timedelta(minutes=-38), True,
         {"pinnacle": (2.60, 2.90, 3.40), "bet365": (2.80, 2.80, 3.20)}),
    ]
    eventos, cuotas = [], []
    for local, visit, liga, dentro, vivo, casas in partidos:
        inicio = ahora + dentro
        e = cr.registra(Evento(id_evento("futbol", local, visit, inicio), "futbol", liga, local, visit,
                               inicio, vivo))
        eventos.append(e)
        for casa, (a, b, c) in casas.items():
            for sel, v in (("local", a), ("empate", b), ("visitante", c)):
                cuotas.append(Cuota(e.id, casa, "1x2", None, sel, v, t, "demo"))
    reg.guarda_lectura(eventos, cuotas)
    # Hace 25 min Pinnacle tenía al Sevilla a 1,90 y Bet365 ya a 1,80: la casa lenta.
    getafe = next(e for e in eventos if e.local == "Getafe")
    antes = ahora - timedelta(minutes=25)
    reg.guarda_lectura([getafe], [Cuota(getafe.id, "pinnacle", "1x2", None, "visitante", 1.90, antes, "demo"),
                                  Cuota(getafe.id, "bet365", "1x2", None, "visitante", 1.80, antes, "demo")])
    r = detectar({e.id: e for e in eventos}, cuotas, 6000, ahora,
                 replace(PREPARTIDO, prob_minima=0.6), replace(EN_VIVO, prob_minima=0.6))
    from . import puntos_flacos
    for o in r.oportunidades:
        puntos_flacos.analizar(o, cuotas, reg, ahora, PREPARTIDO.afiladas)
    reg.guarda_oportunidades(r.oportunidades)
    print(f"{len(r.oportunidades)} de valor, guardadas en {ruta}")


if __name__ == "__main__":
    sembrar(sys.argv[1] if len(sys.argv) > 1 else "valor-demo.db")
