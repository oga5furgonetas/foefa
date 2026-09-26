"""The Odds API (the-odds-api.com), v4.

Gratis: 500 créditos al mes. Cada llamada cuesta (nº de mercados × nº de
regiones), así que con 3 mercados y 2 regiones una liga cuesta 6: da para
unas 80 lecturas al mes. Se usa para lo que más rinde: pocas ligas grandes,
con Pinnacle y Betfair como referencia (región «eu») y casas blandas europeas.

Los partidos ya empezados vienen en la misma respuesta: se marcan en vivo.

FORMATO: el de la documentación pública de la v4 (lista de eventos con
bookmakers → markets → outcomes). No verificado aún contra la API real desde
aquí (red bloqueada): el test usa una respuesta escrita según esa documentación.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

from ..nucleo.modelo import Cuota, Evento
from .base import Fuente, Lectura, log, ts
from .nombres import Cruce, id_evento

URL = "https://api.the-odds-api.com/v4/sports/{deporte}/odds"

# Nuestro deporte según la clave de la API.
def deporte_de(clave: str) -> str:
    if clave.startswith("soccer"):
        return "futbol"
    if clave.startswith("tennis"):
        return "tenis"
    if clave.startswith("basketball"):
        return "baloncesto"
    return clave.split("_")[0]


class TheOddsApi(Fuente):
    nombre = "the_odds_api"
    variable_clave = "ODDS_API_KEY"

    def __init__(self, *a, regiones: str = "eu,uk", mercados: str = "h2h,totals,spreads",
                 cruce: Optional[Cruce] = None, **k):
        super().__init__(*a, **k)
        self.regiones, self.mercados = regiones, mercados
        self.cruce = cruce or Cruce()

    def leer(self, deportes: List[str]) -> Lectura:
        self.exige_clave()
        out = Lectura()
        for d in deportes:
            r = self.cliente.get(URL.format(deporte=d), params={
                "apiKey": self.clave, "regions": self.regiones, "markets": self.mercados,
                "oddsFormat": "decimal", "dateFormat": "iso"})
            if r.status_code == 401:
                raise PermissionError("the_odds_api: clave no válida o cupo agotado")
            r.raise_for_status()
            restante = r.headers.get("x-requests-remaining")
            if restante is not None:
                out.cupo_restante = int(float(restante))
            parcial = self.traducir(d, r.json())
            out.eventos += parcial.eventos
            out.cuotas += parcial.cuotas
        if out.cupo_restante is not None and out.cupo_restante < 30:
            out.avisos.append(f"the_odds_api: quedan {out.cupo_restante} créditos este mes")
        return out

    def traducir(self, clave_deporte: str, datos: list,
                 ahora: Optional[datetime] = None) -> Lectura:
        ahora = ahora or datetime.now(timezone.utc)
        out = Lectura()
        deporte = deporte_de(clave_deporte)
        for ev in datos:
            inicio = ts(ev["commence_time"])
            local, visit = ev["home_team"], ev["away_team"]
            e = self.cruce.registra(Evento(
                id_evento(deporte, local, visit, inicio), deporte, ev.get("sport_title", ""),
                local, visit, inicio, en_vivo=inicio <= ahora))
            out.eventos.append(e)
            for bk in ev.get("bookmakers", []):
                casa = bk["key"]
                for m in bk.get("markets", []):
                    visto = ts(m.get("last_update") or bk.get("last_update"))
                    for c in self._mercado(e, casa, m, local, visit, visto):
                        out.cuotas.append(c)
        return out

    def _mercado(self, e: Evento, casa: str, m: Dict, local: str, visit: str, visto: datetime):
        clave, outs = m["key"], m.get("outcomes", [])

        def cuota(mercado, linea, sel, precio):
            return Cuota(e.id, casa, mercado, linea, sel, float(precio), visto, self.nombre)

        if clave == "h2h":
            mercado = "1x2" if any(o["name"] == "Draw" for o in outs) else "ganador"
            for o in outs:
                sel = {local: "local", visit: "visitante", "Draw": "empate"}.get(o["name"])
                if sel:
                    yield cuota(mercado, None, sel, o["price"])
        elif clave == "totals":
            for o in outs:
                sel = {"Over": "mas", "Under": "menos"}.get(o["name"])
                if sel and o.get("point") is not None:
                    yield cuota("totales", float(o["point"]), sel, o["price"])
        elif clave == "spreads":
            # La línea del mercado es la del LOCAL; la del visitante es la opuesta.
            puntos = {o["name"]: o.get("point") for o in outs}
            if puntos.get(local) is None or puntos.get(visit) is None:
                return
            if abs(puntos[local] + puntos[visit]) > 1e-9:
                log.warning("spreads descuadrado en %s/%s: %s", e.id, casa, puntos)
                return
            for o in outs:
                sel = {local: "local", visit: "visitante"}.get(o["name"])
                if sel:
                    yield cuota("handicap", float(puntos[local]), sel, o["price"])
