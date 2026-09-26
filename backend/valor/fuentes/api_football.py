"""API-Football (api-sports.io), v3. Solo fútbol.

Gratis: 100 llamadas al día. Cuotas PREPARTIDO de unas quince casas (entre
ellas Pinnacle y Bet365). Las cuotas no traen el nombre de los equipos: hay
que pedir también los partidos del día y cruzarlos por el id del partido.

En vivo tiene su propio endpoint (/odds/live) con otro formato; no se usa
hasta verificarlo contra la API real.

FORMATO: según la documentación pública de la v3. No verificado aún contra la
API real desde aquí (red bloqueada).
"""
from __future__ import annotations

import re
from datetime import date, datetime, timezone
from typing import Dict, List, Optional

from ..nucleo.modelo import Cuota, Evento
from .base import Fuente, Lectura, ts
from .nombres import Cruce, id_evento

BASE = "https://v3.football.api-sports.io"

# Nombre de la casa en esta API → nuestra clave. «Betfair» aquí NO se toma por
# el exchange: no está claro que lo sea, y confundirlo metería una casa blanda
# como referencia.
CASAS = {"pinnacle": "pinnacle", "bet365": "bet365", "bwin": "bwin", "william hill": "williamhill",
         "unibet": "unibet", "marathonbet": "marathonbet", "1xbet": "onexbet", "betfair": "betfair_sb",
         "888sport": "sport888", "betway": "betway", "10bet": "tenbet", "betsson": "betsson"}

_OU = re.compile(r"^(Over|Under)\s+([0-9.]+)$")
_AH = re.compile(r"^(Home|Away)\s+([+-]?[0-9.]+)$")


class ApiFootball(Fuente):
    nombre = "api_football"
    variable_clave = "APISPORTS_KEY"

    def __init__(self, *a, cruce: Optional[Cruce] = None, **k):
        super().__init__(*a, **k)
        self.cruce = cruce or Cruce()

    def _get(self, ruta: str, **params) -> dict:
        r = self.cliente.get(BASE + ruta, params=params, headers={"x-apisports-key": self.clave})
        r.raise_for_status()
        self._restante = r.headers.get("x-ratelimit-requests-remaining")
        datos = r.json()
        if datos.get("errors"):
            raise PermissionError(f"api_football: {datos['errors']}")
        return datos

    def leer(self, deportes: List[str], dia: Optional[date] = None) -> Lectura:
        self.exige_clave()
        dia = dia or datetime.now(timezone.utc).date()
        partidos = self._get("/fixtures", date=dia.isoformat())["response"]
        cuotas, pagina = [], 1
        while True:
            d = self._get("/odds", date=dia.isoformat(), page=pagina)
            cuotas += d["response"]
            total = (d.get("paging") or {}).get("total", 1)
            if pagina >= total or pagina >= 5:      # tope: 5 páginas para no fundir el cupo
                break
            pagina += 1
        out = self.traducir(partidos, cuotas)
        if getattr(self, "_restante", None) is not None:
            out.cupo_restante = int(self._restante)
        return out

    def traducir(self, partidos: list, cuotas: list) -> Lectura:
        out = Lectura()
        por_id: Dict[int, Evento] = {}
        for p in partidos:
            fx, eq = p["fixture"], p["teams"]
            estado = (fx.get("status") or {}).get("short", "NS")
            if estado in ("FT", "AET", "PEN", "CANC", "PST", "ABD", "AWD", "WO"):
                continue
            inicio = ts(fx["date"])
            local, visit = eq["home"]["name"], eq["away"]["name"]
            e = self.cruce.registra(Evento(
                id_evento("futbol", local, visit, inicio), "futbol",
                (p.get("league") or {}).get("name", ""), local, visit, inicio,
                en_vivo=estado not in ("NS", "TBD")))
            por_id[fx["id"]] = e
            out.eventos.append(e)
        for o in cuotas:
            e = por_id.get(o["fixture"]["id"])
            if e is None:
                continue
            visto = ts(o.get("update") or o["fixture"]["date"])
            for bk in o.get("bookmakers", []):
                casa = CASAS.get(bk["name"].strip().lower())
                if not casa:
                    continue
                for apuesta in bk.get("bets", []):
                    out.cuotas += list(self._apuesta(e, casa, apuesta, visto))
        return out

    def _apuesta(self, e: Evento, casa: str, a: dict, visto: datetime):
        def c(mercado, linea, sel, odd):
            return Cuota(e.id, casa, mercado, linea, sel, float(odd), visto, self.nombre)

        nombre = a.get("name")
        for v in a.get("values", []):
            val, odd = str(v.get("value")), v.get("odd")
            if nombre == "Match Winner":
                sel = {"Home": "local", "Draw": "empate", "Away": "visitante"}.get(val)
                if sel:
                    yield c("1x2", None, sel, odd)
            elif nombre == "Goals Over/Under":
                m = _OU.match(val)
                if m:
                    yield c("totales", float(m.group(2)), "mas" if m.group(1) == "Over" else "menos", odd)
            elif nombre == "Both Teams Score":
                sel = {"Yes": "si", "No": "no"}.get(val)
                if sel:
                    yield c("ambos_marcan", None, sel, odd)
            elif nombre == "Asian Handicap":
                m = _AH.match(val)
                if m:
                    punto = float(m.group(2))
                    # Línea del mercado = la del local (la del visitante es la opuesta).
                    linea = punto if m.group(1) == "Home" else -punto
                    yield c("handicap", linea, "local" if m.group(1) == "Home" else "visitante", odd)
