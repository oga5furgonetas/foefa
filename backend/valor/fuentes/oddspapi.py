"""OddsPapi (oddspapi.io), v4. La que trae las casas ESPAÑOLAS.

The Odds API da, en la región «eu», las webs de Francia, Alemania, Suecia...
y ninguna .es; API-Football da Bet365 o Bwin sin decir de qué país. OddsPapi
separa cada casa por país: codere.es, pokerstars.es, bet365.es... (y Gamdom). Es
justo el hueco que tenían las otras dos: las cuotas de las webs donde de
verdad se puede apostar desde España.

Gratis: 250 peticiones al mes y UNA casa por petición (con dos contesta 400:
«provide exactly one bookmaker»), pero todas las ligas en la misma. Así que
cada lectura son dos peticiones: Pinnacle (la referencia) y UNA casa española,
que va rotando de lectura en lectura (ODDSPAPI_CASAS).

FORMATO: comprobado contra la API real el 27-09-2026 (LaLiga con Pinnacle:
20 partidos, 39 mercados). Los equipos vienen por número: su nombre sale de
/participants (20.000 equipos, 550 KB), que se guarda en disco y se renueva
cada semana, o antes si aparece un equipo que no está. Los números de mercado
y de resultado salen de /markets (fútbol, partido entero) y están abajo.

LA HORA DE CADA CUOTA. OddsPapi da cuándo CAMBIÓ cada precio («changedAt»),
no cuándo lo comprobó: un precio de dentro de dos semanas que no se ha movido
en tres días sigue siendo el precio de ahora. Se toma la hora de la lectura,
solo de casas activas, sin suspender y con el mercado abierto. NO se usa en
vivo: con una foto cada hora no se puede asegurar la regla de 8 segundos.
"""
from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from ..nucleo.modelo import Cuota, Evento
from .base import Fuente, Lectura, comprueba, ts
from .nombres import Cruce, id_evento

log = logging.getLogger("valor.fuentes")

BASE = "https://api.oddspapi.io/v4"
REFERENCIA = "pinnacle"

# Torneo de OddsPapi → nombre. Los que no estén salen como «torneo N».
TORNEOS = {8: "LaLiga", 17: "Premier League", 7: "UEFA Champions League", 679: "UEFA Europa League",
           34480: "UEFA Conference League", 23: "Serie A", 35: "Bundesliga", 34: "Ligue 1",
           54: "LaLiga 2", 329: "Copa del Rey", 238: "Liga Portugal", 37: "Eredivisie"}

# Mercado → (nuestro mercado, línea, {resultado de OddsPapi: nuestra selección}).
# De /markets, fútbol, «fulltime», sin apuestas a jugadores. Solo líneas x,5 en
# goles y hándicap: las enteras y las de cuarto devuelven dinero y el detector
# no las usa. En el hándicap la línea es la del LOCAL (comprobado: el −0,5 del
# local paga lo mismo que su victoria en el 1X2).
MERCADOS: Dict[int, Tuple[str, Optional[float], Dict[int, str]]] = {
    101: ("1x2", None, {101: "local", 102: "empate", 103: "visitante"}),
    104: ("ambos_marcan", None, {104: "si", 105: "no"}),
}
for _id, _linea in ((106, 0.5), (108, 1.5), (1010, 2.5), (1012, 3.5), (1014, 4.5), (1016, 5.5)):
    MERCADOS[_id] = ("totales", _linea, {_id: "mas", _id + 1: "menos"})
for _id, _linea in ((1044, -3.5), (1052, -2.5), (1060, -1.5), (1068, -0.5),
                    (1076, 0.5), (1084, 1.5), (1092, 2.5), (10100, 3.5)):
    MERCADOS[_id] = ("handicap", _linea, {_id: "local", _id + 1: "visitante"})

UNA_SEMANA = 7 * 24 * 3600
UN_DIA = 24 * 3600
# Dos peticiones seguidas en menos de ~1 s: 429 «You are being rate limited»
# (visto en la API real el 27-09-2026). Se espera entre una y otra, y si aun así
# llega un 429, se reintenta UNA vez tras lo que pida.
PAUSA = 1.2


class OddsPapi(Fuente):
    nombre = "oddspapi"
    variable_clave = "ODDSPAPI_KEY"

    def __init__(self, *a, torneos: Optional[List[int]] = None, casas: Optional[List[str]] = None,
                 cruce: Optional[Cruce] = None, cache: Optional[str] = None, **k):
        super().__init__(*a, **k)
        self.torneos = torneos or [8, 17, 7]
        self.casas = casas or ["bet365.es"]
        self.cruce = cruce or Cruce()
        self.cache = Path(cache) if cache else None
        self.equipos: Dict[str, str] = {}
        self._equipos_de = 0.0
        # Cuántas lecturas lleva: decide a qué casa le toca (el escáner lo pone
        # desde su registro, así la rotación no vuelve a empezar al reiniciar).
        self.vueltas_previas = 0
        self._ultima_peticion = 0.0
        self._dormir = time.sleep
        self._carga_cache()

    def _get(self, ruta: str, **params):
        for intento in (1, 2):
            falta = PAUSA - (time.monotonic() - self._ultima_peticion)
            if falta > 0:
                self._dormir(falta)
            r = self.cliente.get(f"{BASE}{ruta}", params={"apiKey": self.clave, **params})
            self._ultima_peticion = time.monotonic()
            self._llamadas += 1
            if r.status_code != 429 or intento == 2:
                return r
            try:
                espera = float(str((r.json().get("error") or {}).get("details", "")).split("wait ")[1].split()[0])
            except (IndexError, ValueError, AttributeError):
                espera = PAUSA
            self._dormir(min(max(espera, PAUSA), 10.0))
        return r

    # ── los nombres de los equipos ─────────────────────────────────────────
    def _carga_cache(self) -> None:
        if not self.cache or not self.cache.exists():
            return
        try:
            d = json.loads(self.cache.read_text(encoding="utf-8"))
            self.equipos, self._equipos_de = dict(d["equipos"]), float(d["de"])
        except (OSError, ValueError, KeyError, TypeError):
            self.equipos, self._equipos_de = {}, 0.0

    def _pide_equipos(self) -> None:
        r = self._get("/participants", sportId=10)
        comprueba(r, self.nombre)
        datos = r.json()
        if not isinstance(datos, dict):
            raise ValueError("oddspapi: /participants no devolvió la lista de equipos")
        self.equipos, self._equipos_de = {str(k): str(v) for k, v in datos.items()}, time.time()
        if self.cache:
            try:
                self.cache.parent.mkdir(parents=True, exist_ok=True)
                self.cache.write_text(json.dumps({"de": self._equipos_de, "equipos": self.equipos},
                                                 ensure_ascii=False), encoding="utf-8")
            except OSError as e:
                log.warning("oddspapi: no se pudo guardar la lista de equipos: %s", e)

    def _asegura_equipos(self, fixtures: List[dict]) -> None:
        edad = time.time() - self._equipos_de
        faltan = any(str(f.get(k)) not in self.equipos
                     for f in fixtures for k in ("participant1Id", "participant2Id"))
        # Una semana de vida; si falta un equipo, se pide antes, pero no más de
        # una vez al día (un equipo que OddsPapi no tenga no puede fundir el cupo).
        if edad > UNA_SEMANA or (faltan and edad > UN_DIA):
            self._pide_equipos()

    # ── las cuotas ─────────────────────────────────────────────────────────
    def casa_del_turno(self) -> str:
        return self.casas[self.vueltas_previas % len(self.casas)]

    def _cuotas_de(self, casa: str) -> List[dict]:
        r = self._get("/odds-by-tournaments", bookmaker=casa,
                      tournamentIds=",".join(str(t) for t in self.torneos))
        if r.status_code in (401, 403):
            raise PermissionError("oddspapi: clave no válida o cupo agotado")
        comprueba(r, self.nombre)
        datos = r.json()
        if not isinstance(datos, list):
            raise ValueError("oddspapi: la respuesta de cuotas no es una lista")
        return datos

    def leer(self, deportes: List[str]) -> Lectura:
        self.exige_clave()
        self._llamadas = 0
        ahora = datetime.now(timezone.utc)
        casa = self.casa_del_turno()
        fixtures = self._cuotas_de(REFERENCIA)
        if casa != REFERENCIA:
            fixtures += self._cuotas_de(casa)
        self._asegura_equipos(fixtures)
        out = self.traducir(fixtures, ahora)
        out.coste, out.detalle = self._llamadas, f"{REFERENCIA} + {casa}"
        return out

    def traducir(self, fixtures: List[dict], ahora: Optional[datetime] = None) -> Lectura:
        ahora = ahora or datetime.now(timezone.utc)
        out = Lectura()
        vistos: Dict[str, Evento] = {}
        sin_nombre = 0
        for f in fixtures:
            fid = str(f.get("fixtureId"))
            if f.get("sportId") not in (None, 10):
                continue
            e = vistos.get(fid)
            if e is None:
                local = self.equipos.get(str(f.get("participant1Id")))
                visit = self.equipos.get(str(f.get("participant2Id")))
                if not (local and visit and f.get("startTime")):
                    sin_nombre += 1
                    continue
                inicio = ts(f["startTime"])
                if inicio <= ahora:
                    continue            # en vivo no: ver arriba
                e = self.cruce.registra(Evento(
                    id_evento("futbol", local, visit, inicio), "futbol",
                    TORNEOS.get(f.get("tournamentId"), f"torneo {f.get('tournamentId')}"),
                    local, visit, inicio))
                vistos[fid] = e
                out.eventos.append(e)
            for casa, b in (f.get("bookmakerOdds") or {}).items():
                if not b.get("bookmakerIsActive", True) or b.get("suspended"):
                    continue
                for mid, m in (b.get("markets") or {}).items():
                    out.cuotas += list(self._mercado(e, casa, mid, m, ahora))
        if sin_nombre:
            out.avisos.append(f"oddspapi: {sin_nombre} partidos sin nombre de equipo: no se usan")
        return out

    def _mercado(self, e: Evento, casa: str, mid, m: dict, ahora: datetime):
        try:
            mercado, linea, resultados = MERCADOS[int(mid)]
        except (KeyError, ValueError):
            return
        if not m.get("marketActive", True):
            return
        for oid, o in (m.get("outcomes") or {}).items():
            try:
                sel = resultados.get(int(oid))
            except ValueError:
                continue
            p = ((o or {}).get("players") or {}).get("0") or {}
            precio = p.get("price")
            if not sel or not p.get("active", True) or not isinstance(precio, (int, float)) or precio <= 1:
                continue
            lim = p.get("limit")
            yield Cuota(e.id, casa, mercado, linea, sel, float(precio), ahora, self.nombre,
                        float(lim) if isinstance(lim, (int, float)) else None)


def de_entorno(cruce: Cruce, cache: Optional[str]) -> OddsPapi:
    torneos = [int(x) for x in os.environ.get("ODDSPAPI_TORNEOS", "8,17,7").split(",") if x.strip().isdigit()]
    # Las casas de Dani (27-09-2026): Codere, BetStars (PokerStars) y Gamdom.
    # Casino Barcelona no lo trae ninguna fuente. Lo que trae OddsPapi de cada
    # una en LaLiga (llamada real del 27-09): Gamdom, todo (1X2, goles,
    # hándicap); Codere, goles y hándicap pero no el 1X2; PokerStars ES, solo
    # «marcan los dos» y resultado exacto, que Pinnacle no da (sin referencia).
    # Por eso Gamdom va una lectura sí y otra no, y las otras dos se turnan.
    casas = [x.strip() for x in os.environ.get(
        "ODDSPAPI_CASAS", "gamdom,codere.es,gamdom,pokerstars.es").split(",") if x.strip()]
    return OddsPapi(torneos=torneos, casas=casas, cruce=cruce, cache=cache)
