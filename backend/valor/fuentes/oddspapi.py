"""OddsPapi (oddspapi.io), v4. La que trae las casas de Dani.

The Odds API da, en la región «eu», las webs de Francia, Alemania, Suecia...
y ninguna .es; API-Football da Bet365 o Bwin sin decir de qué país. OddsPapi
separa cada casa por país: codere.es, pokerstars.es, bet365.es... (y Gamdom). Es
justo el hueco que tenían las otras dos: las cuotas de las webs donde de
verdad se puede apostar desde España.

Gratis: 250 peticiones al mes y UNA casa por petición (con dos contesta 400:
«provide exactly one bookmaker»), y como mucho 5 torneos por petición (con
más, 400: «maximum of 5 tournament IDs»). Así que cada lectura son dos
peticiones: Pinnacle (la referencia) y UNA casa de Dani, que va rotando de
lectura en lectura (ODDSPAPI_CASAS), con los 5 torneos que el escáner elige
(los que juegan antes).

TODOS LOS DEPORTES. El 27-09-2026, con el parón de selecciones, el único valor
real en las casas de Dani estaba en la NFL. Aquí van fútbol, fútbol americano
(NFL, NCAA), béisbol (MLB), baloncesto (NBA, WNBA, Euroliga), hockey (NHL),
tenis y MMA. Los mercados salen de `oddspapi_mercados.json`, generado del
catálogo REAL de /markets: de cada deporte UN periodo (fútbol, los 90 min; el
resto, el partido con prórroga), nunca cuartos, mitades ni jugadores. Así el
mismo número de mercado es siempre el mismo mercado en todas las casas.

FORMATO: comprobado contra la API real el 27-09-2026. Los equipos vienen por
número: su nombre sale de /participants DE CADA DEPORTE (el de fútbol, 20.000
equipos y 550 KB), que se guarda en disco y se renueva cada semana, o antes si
aparece un equipo que no está. En el hándicap la línea es la del LOCAL
(comprobado en fútbol: el −0,5 del local paga lo que su 1X2; y en la NFL: la
escalera de Pinnacle del Dolphins–Chiefs cuadra con su ganador).

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

# Deporte de OddsPapi → el nuestro (el mismo nombre que da The Odds API, para
# que un partido leído por las dos fuentes se cruce).
DEPORTES = {10: "futbol", 11: "baloncesto", 12: "tenis", 13: "baseball", 14: "americanfootball",
            15: "icehockey", 20: "mma"}

# Torneo → (deporte, nombre, su clave en The Odds API para el calendario gratis).
# Los números, de /tournaments de la API real (27-09-2026).
TORNEOS: Dict[int, Tuple[int, str, Optional[str]]] = {
    8: (10, "LaLiga", "soccer_spain_la_liga"),
    54: (10, "LaLiga 2", "soccer_spain_segunda_division"),
    17: (10, "Premier League", "soccer_epl"),
    7: (10, "UEFA Champions League", "soccer_uefa_champs_league"),
    679: (10, "UEFA Europa League", "soccer_uefa_europa_league"),
    34480: (10, "UEFA Conference League", "soccer_uefa_europa_conference_league"),
    23755: (10, "UEFA Nations League", "soccer_uefa_nations_league"),
    23: (10, "Serie A", "soccer_italy_serie_a"),
    35: (10, "Bundesliga", "soccer_germany_bundesliga"),
    34: (10, "Ligue 1", "soccer_france_ligue_one"),
    242: (10, "MLS", "soccer_usa_mls"),
    27464: (10, "Liga MX", "soccer_mexico_ligamx"),
    31: (14, "NFL", "americanfootball_nfl"),
    27653: (14, "NCAA", "americanfootball_ncaaf"),
    109: (13, "MLB", "baseball_mlb"),
    132: (11, "NBA", "basketball_nba"),
    486: (11, "WNBA", "basketball_wnba"),
    138: (11, "Euroliga", "basketball_euroleague"),
    234: (15, "NHL", "icehockey_nhl"),
    957: (15, "NHL pretemporada", "icehockey_nhl_preseason"),
}

# {mercado: (deporte, nuestro mercado, línea, {resultado: nuestra selección})}
MERCADOS: Dict[int, Tuple[int, str, Optional[float], Dict[int, str]]] = {
    int(mid): (sid, mercado, linea, {int(o): s for o, s in sels.items()})
    for mid, (sid, mercado, linea, sels) in json.loads(
        Path(__file__).with_name("oddspapi_mercados.json").read_text(encoding="utf-8")).items()}

UNA_SEMANA = 7 * 24 * 3600
UN_DIA = 24 * 3600
# Dos peticiones seguidas en menos de ~1 s: 429 «You are being rate limited»
# (visto en la API real el 27-09-2026). Se espera entre una y otra, y si aun así
# llega un 429, se reintenta UNA vez tras lo que pida.
PAUSA = 1.2
# Y como mucho 5 torneos por petición («Please provide a maximum of 5 tournament
# IDs», también visto en la API real el 27-09): con más, se parten en tandas.
TORNEOS_POR_PETICION = 5


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
        # Por deporte: {deporte: {id: nombre}} y {deporte: cuándo se pidió}.
        self.equipos: Dict[int, Dict[str, str]] = {}
        self._equipos_de: Dict[int, float] = {}
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
            if isinstance(d.get("de"), (int, float)):
                # Formato del primer día: solo fútbol.
                self.equipos, self._equipos_de = {10: dict(d["equipos"])}, {10: float(d["de"])}
            else:
                self.equipos = {int(s): dict(v) for s, v in d["equipos"].items()}
                self._equipos_de = {int(s): float(v) for s, v in d["de"].items()}
        except (OSError, ValueError, KeyError, TypeError, AttributeError):
            self.equipos, self._equipos_de = {}, {}

    def _pide_equipos(self, deporte: int) -> None:
        r = self._get("/participants", sportId=deporte)
        comprueba(r, self.nombre)
        datos = r.json()
        if not isinstance(datos, dict):
            raise ValueError("oddspapi: /participants no devolvió la lista de equipos")
        self.equipos[deporte] = {str(k): str(v) for k, v in datos.items()}
        self._equipos_de[deporte] = time.time()
        if self.cache:
            try:
                self.cache.parent.mkdir(parents=True, exist_ok=True)
                self.cache.write_text(json.dumps(
                    {"de": {str(s): v for s, v in self._equipos_de.items()},
                     "equipos": {str(s): v for s, v in self.equipos.items()}}, ensure_ascii=False), encoding="utf-8")
            except OSError as e:
                log.warning("oddspapi: no se pudo guardar la lista de equipos: %s", e)

    def _nombre(self, deporte, id_) -> Optional[str]:
        return self.equipos.get(deporte, {}).get(str(id_))

    def _asegura_equipos(self, fixtures: List[dict]) -> None:
        for deporte in sorted({f.get("sportId") for f in fixtures if f.get("sportId") in DEPORTES}):
            edad = time.time() - self._equipos_de.get(deporte, 0.0)
            faltan = any(self._nombre(deporte, f.get(k)) is None
                         for f in fixtures if f.get("sportId") == deporte
                         for k in ("participant1Id", "participant2Id"))
            # Una semana de vida; si falta un equipo, se pide antes, pero no más
            # de una vez al día (un equipo que OddsPapi no tenga no funde el cupo).
            if edad > UNA_SEMANA or (faltan and edad > UN_DIA):
                self._pide_equipos(deporte)

    # ── las cuotas ─────────────────────────────────────────────────────────
    def casa_del_turno(self) -> str:
        return self.casas[self.vueltas_previas % len(self.casas)]

    def _cuotas_de(self, casa: str, torneos: List[int]) -> List[dict]:
        datos: List[dict] = []
        for i in range(0, len(torneos), TORNEOS_POR_PETICION):
            tanda = torneos[i:i + TORNEOS_POR_PETICION]
            r = self._get("/odds-by-tournaments", bookmaker=casa, tournamentIds=",".join(str(t) for t in tanda))
            if r.status_code in (401, 403):
                raise PermissionError("oddspapi: clave no válida o cupo agotado")
            comprueba(r, self.nombre)
            parte = r.json()
            if not isinstance(parte, list):
                raise ValueError("oddspapi: la respuesta de cuotas no es una lista")
            datos += parte
        return datos

    def peticiones_por_lectura(self, torneos: Optional[int] = None) -> int:
        n = len(self.torneos) if torneos is None else torneos
        tandas = -(-n // TORNEOS_POR_PETICION)
        return tandas * (1 if self.casas == [REFERENCIA] else 2)

    def leer(self, deportes: List[str]) -> Lectura:
        """`deportes`: los torneos que elige el escáner (los que juegan antes).
        Vacío: los suyos por defecto."""
        self.exige_clave()
        self._llamadas = 0
        torneos = [int(x) for x in deportes if str(x).isdigit()] if deportes else list(self.torneos)
        ahora = datetime.now(timezone.utc)
        casa = self.casa_del_turno()
        fixtures = self._cuotas_de(REFERENCIA, torneos)
        if casa != REFERENCIA:
            fixtures += self._cuotas_de(casa, torneos)
        self._asegura_equipos(fixtures)
        out = self.traducir(fixtures, ahora)
        nombres = ", ".join(TORNEOS.get(t, (0, f"torneo {t}", None))[1] for t in torneos)
        out.coste, out.detalle = self._llamadas, f"{REFERENCIA} + {casa} · {nombres}"
        return out

    def traducir(self, fixtures: List[dict], ahora: Optional[datetime] = None) -> Lectura:
        ahora = ahora or datetime.now(timezone.utc)
        out = Lectura()
        vistos: Dict[str, Evento] = {}
        sin_nombre = 0
        for f in fixtures:
            fid = str(f.get("fixtureId"))
            sid = f.get("sportId", 10)
            if sid not in DEPORTES:
                continue
            e = vistos.get(fid)
            if e is None:
                local = self._nombre(sid, f.get("participant1Id"))
                visit = self._nombre(sid, f.get("participant2Id"))
                if not (local and visit and f.get("startTime")):
                    sin_nombre += 1
                    continue
                inicio = ts(f["startTime"])
                if inicio <= ahora:
                    continue            # en vivo no: ver arriba
                torneo = TORNEOS.get(f.get("tournamentId"))
                e = self.cruce.registra(Evento(
                    id_evento(DEPORTES[sid], local, visit, inicio), DEPORTES[sid],
                    torneo[1] if torneo else f"torneo {f.get('tournamentId')}", local, visit, inicio))
                vistos[fid] = e
                out.eventos.append(e)
            for casa, b in (f.get("bookmakerOdds") or {}).items():
                if not b.get("bookmakerIsActive", True) or b.get("suspended"):
                    continue
                for mid, m in (b.get("markets") or {}).items():
                    out.cuotas += list(self._mercado(e, sid, casa, mid, m, ahora))
        if sin_nombre:
            out.avisos.append(f"oddspapi: {sin_nombre} partidos sin nombre de equipo: no se usan")
        return out

    def _mercado(self, e: Evento, sid: int, casa: str, mid, m: dict, ahora: datetime):
        try:
            deporte, mercado, linea, resultados = MERCADOS[int(mid)]
        except (KeyError, ValueError):
            return
        if deporte != sid or not m.get("marketActive", True):
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
    # Candidatos: todos los de TORNEOS (o los de ODDSPAPI_TORNEOS). El escáner
    # lee en cada vuelta los 5 que juegan antes (5 caben en una petición).
    torneos = [int(x) for x in os.environ.get("ODDSPAPI_TORNEOS", ",".join(map(str, TORNEOS))).split(",")
               if x.strip().isdigit()]
    # Las casas de Dani (27-09-2026): Codere, BetStars (PokerStars) y Gamdom.
    # Casino Barcelona no lo trae ninguna fuente. Lo que trae OddsPapi de cada
    # una (llamadas reales del 27-09): Gamdom, todo; Codere, sin el 1X2 del
    # fútbol; PokerStars ES, poco, y en la NFL con líneas de hándicap cruzadas
    # (las filtra el detector). Por eso Gamdom va una lectura sí y otra no.
    casas = [x.strip() for x in os.environ.get(
        "ODDSPAPI_CASAS", "gamdom,codere.es,gamdom,pokerstars.es").split(",") if x.strip()]
    return OddsPapi(torneos=torneos, casas=casas, cruce=cruce, cache=cache)
