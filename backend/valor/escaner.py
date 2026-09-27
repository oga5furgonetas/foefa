"""El bucle: leer, cruzar, detectar, guardar y avisar.

LOS CUPOS GRATIS MANDAN. 500 créditos al mes o 100 llamadas al día se funden
en una hora si se pregunta cada minuto. Cada fuente tiene su presupuesto y el
escáner reparte las lecturas a lo largo del periodo: más vale leer seis veces
al día todo el mes que cada minuto durante dos días.

TODAS LAS FUENTES EN LA MISMA VUELTA. Solo se comparan cuotas leídas juntas:
comparar la de una casa leída ahora con la de Pinnacle leída hace tres horas
es inventarse la oportunidad. Por eso cada fuente trae su propia referencia
(Pinnacle) en cada lectura.

EL CUPO, DONDE HAY PARTIDO. Leer un martes a las 4 de la mañana gasta lo mismo
que leer una hora antes de un Betis–Sevilla, y vale mucho menos: las casas
lentas se quedan atrás cuando el mercado se mueve (alineaciones, lesiones), y
eso pasa cerca del inicio. Además la última lectura antes de empezar es la
cuota de CIERRE con la que se mide el CLV: cuanto más cerca, mejor medido.
Así que cada fuente lee:
  · a su ritmo rápido si hay partido en menos de 3 h;
  · a un tercio de ese ritmo si lo hay en menos de 24 h;
  · casi nada si no hay partido en un día.
Y nunca más de lo que da su cupo: ni en el periodo (30 días o un día), ni de
golpe (un día no puede gastar más de 3 veces su parte; con cupo diario, una
hora). The Odds API lee además solo las ligas que tienen partido en 24 h: su
calendario (/events) es gratis.
"""
from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import httpx

from .fuentes.api_football import ApiFootball
from .fuentes.base import Fuente, Lectura, SinClave, limpia
from .fuentes.nombres import Cruce
from .fuentes.oddspapi import TORNEOS as OP_TORNEOS, TORNEOS_POR_PETICION, OddsPapi
from .fuentes.oddspapi import de_entorno as oddspapi_de_entorno
from .fuentes.the_odds_api import TheOddsApi
from .nucleo.detector import EN_VIVO, PREPARTIDO, Resultado, detectar
from .nucleo.modelo import Oportunidad
from .nucleo.seguras import ReglasSeguras, Segura, buscar as buscar_seguras
from . import aprendizaje, puntos_flacos
from .registro import Registro

log = logging.getLogger("valor.escaner")


@dataclass
class Presupuesto:
    fuente: str
    llamadas: int                 # cuántas por periodo
    periodo: timedelta            # 30 días, 1 día...
    coste_vuelta: int             # cuánto gasta una lectura completa
    # Cada cuánto, como mucho, con partido a menos de 3 h. None: siempre al
    # ritmo de `intervalo()` (el cupo repartido por igual).
    rapido: Optional[timedelta] = None
    rafaga: float = 3.0           # un día (una hora, con cupo diario) gasta hasta 3 veces su parte

    def intervalo(self) -> timedelta:
        vueltas = max(1, self.llamadas // max(1, self.coste_vuelta))
        return self.periodo / vueltas

    def tope_rafaga(self) -> "tuple[timedelta, float]":
        trozo = timedelta(days=1) if self.periodo > timedelta(days=1) else timedelta(hours=1)
        parte = self.llamadas * (trozo / self.periodo)
        return trozo, max(float(self.coste_vuelta), self.rafaga * parte)

    def espera(self, falta: Optional[timedelta]) -> timedelta:
        """Cuánto esperar entre lecturas según lo que falta para el próximo partido."""
        if self.rapido is None or falta is None:
            return self.intervalo()
        if falta <= timedelta(hours=3):
            return self.rapido
        if falta <= timedelta(hours=24):
            return self.rapido * 3
        return max(self.intervalo(), self.rapido * 12)


class Escaner:
    def __init__(self, registro: Registro, banca: float,
                 fuentes: Optional[Dict[Fuente, Presupuesto]] = None,
                 deportes: Optional[Dict[str, List[str]]] = None,
                 aviso=None):
        self.reg = registro
        self.banca = banca
        self.cruce = Cruce()
        self.deportes: Dict[str, List[str]] = dict(deportes or {})
        self.fuentes = fuentes if fuentes is not None else self._por_defecto()
        self.aviso = aviso
        # Lo que se reparte en una segura y las casas donde NO se puede apostar
        # (Pinnacle no tiene licencia en España: sirve de referencia, no para meter).
        self.total_segura = float(os.environ.get("VALOR_SEGURA_TOTAL", "100"))
        self.reglas_seguras = ReglasSeguras(excluir=tuple(
            x for x in os.environ.get("VALOR_NO_APOSTAR", "pinnacle").split(",") if x))
        # Seguras (repartir entre casas): apagadas salvo que se pidan.
        self.con_seguras = os.environ.get("VALOR_SEGURAS") == "1"
        # Nada por debajo de 1,70: a 1,05-1,20 una sola derrota se come
        # quince aciertos. Y solo lo que se acierta 6 de cada 10 veces o más:
        # a la vez, eso deja solo apuestas con al menos un 2 % de ventaja.
        prob = float(os.environ.get("VALOR_PROB_MINIMA", "0.60"))
        cmin = float(os.environ.get("VALOR_CUOTA_MINIMA", "1.70"))
        # Por debajo de 1,70 solo si la ventaja es muy grande (5 % o más).
        excepcion = dict(cuota_minima_excepcion=float(os.environ.get("VALOR_CUOTA_MINIMA_VALOR", "1.50")),
                         ev_excepcion=float(os.environ.get("VALOR_EV_CUOTA_BAJA", "0.05")))
        self.prepartido = replace(PREPARTIDO, prob_minima=prob, cuota_minima=cmin, **excepcion)
        self.vivo = replace(EN_VIVO, prob_minima=prob, cuota_minima=cmin, **excepcion)
        # FRENO DE PÉRDIDAS. Una racha mala es normal (a 1,70 se pierde el 40 %),
        # pero cuando el día va muy mal lo sensato es parar: o es mala suerte y
        # mañana sigue igual de bien, o algo falla (una fuente, una casa) y hay
        # que mirarlo antes de meter más. Por defecto, el 6 % de la banca.
        self.freno_dia = float(os.environ.get("VALOR_FRENO_DIA", "0.06")) * banca
        self._ultima: Dict[str, datetime] = {}
        self._avisadas: Dict[tuple, tuple] = {}
        # {liga de The Odds API: [inicios]}, de su /events (gratis). Media hora de vida.
        self._calendario: Dict[str, List[datetime]] = {}
        self._calendario_de: Optional[datetime] = None
        # Lo que la pantalla enseña de cada fuente: cuándo leyó, qué le queda de
        # cupo y si la última falló. Sin esto, un buscador sin datos no dice si
        # es que no hay chollos o que no está leyendo nada.
        self.estado: Dict[str, dict] = {}
        self.reg.db.execute("CREATE TABLE IF NOT EXISTS uso (fuente TEXT, ts TEXT, coste INTEGER)")

    def _por_defecto(self) -> Dict[Fuente, Presupuesto]:
        out: Dict[Fuente, Presupuesto] = {}
        # Las grandes paran por las selecciones (del 27-09 al 09-10-2026 no había
        # ni LaLiga, ni Premier, ni Champions): con Segunda, la Nations League y
        # las otras copas europeas siempre hay algo que leer. Una liga solo gasta
        # si tiene partido en 24 h.
        ligas = [x for x in os.environ.get(
            "VALOR_LIGAS", "soccer_spain_la_liga,soccer_spain_segunda_division,soccer_epl,"
            "soccer_uefa_champs_league,soccer_uefa_europa_league,soccer_uefa_europa_conference_league,"
            "soccer_uefa_nations_league").split(",") if x]
        mercados = os.environ.get("VALOR_MERCADOS", "h2h,totals")
        regiones = os.environ.get("VALOR_REGIONES", "eu")
        def minutos(var, defecto):
            return timedelta(minutes=float(os.environ.get(var, defecto)))
        if os.environ.get("ODDS_API_KEY"):
            f = TheOddsApi(regiones=regiones, mercados=mercados, cruce=self.cruce)
            coste = len(ligas) * len(mercados.split(",")) * len(regiones.split(","))
            out[f] = Presupuesto(f.nombre, int(os.environ.get("ODDS_API_CUPO", "500")),
                                 timedelta(days=30), coste, rapido=minutos("ODDS_API_CADA_MIN", "40"))
            self.deportes.setdefault(f.nombre, ligas)
        if os.environ.get("ODDSPAPI_KEY"):
            ruta = getattr(self.reg, "ruta", "")
            cache = (os.path.join(os.path.dirname(os.path.abspath(ruta)), "oddspapi_equipos.json")
                     if ruta and ruta != ":memory:" else None)
            f = oddspapi_de_entorno(self.cruce, cache)
            # Pinnacle y una casa por lectura, con los (hasta) 5 torneos que
            # juegan antes: una tanda, dos peticiones. Con todos los deportes
            # casi siempre hay partido en 3 h, así que el ritmo rápido sería el
            # de siempre y el cupo se iría en 10 días: cada 3 h como mucho y un
            # día no gasta más de 1,2 veces su parte (~4 lecturas al día).
            out[f] = Presupuesto(f.nombre, int(os.environ.get("ODDSPAPI_CUPO", "250")),
                                 timedelta(days=30), f.peticiones_por_lectura(min(len(f.torneos),
                                                                                  TORNEOS_POR_PETICION)),
                                 rapido=minutos("ODDSPAPI_CADA_MIN", "180"),
                                 rafaga=float(os.environ.get("ODDSPAPI_RAFAGA", "1.2")))
        if os.environ.get("APISPORTS_KEY"):
            f = ApiFootball(cruce=self.cruce)
            out[f] = Presupuesto(f.nombre, int(os.environ.get("APISPORTS_CUPO", "100")),
                                 timedelta(days=1), 4, rapido=minutos("APISPORTS_CADA_MIN", "60"))
        return out

    # ── cuándo hay partido ────────────────────────────────────────────────
    def _refresca_calendario(self, ahora: datetime) -> None:
        if self._calendario_de and ahora - self._calendario_de < timedelta(minutes=30):
            return
        # Además de sus ligas, las de los torneos de OddsPapi: su calendario
        # también sale de aquí, gratis.
        claves = list(self.deportes.get("the_odds_api", []))
        for g in self.fuentes:
            if isinstance(g, OddsPapi):
                claves += [OP_TORNEOS[t][2] for t in g.torneos if t in OP_TORNEOS and OP_TORNEOS[t][2]]
        claves = list(dict.fromkeys(claves))
        for f in self.fuentes:
            if isinstance(f, TheOddsApi) and f.clave:
                try:
                    self._calendario = f.proximos(claves)
                except (httpx.HTTPError, PermissionError, ValueError, KeyError) as e:
                    log.warning("Calendario de the_odds_api: %s", limpia(e))
                self._calendario_de = ahora
                return

    def _inicios(self, ahora: datetime, solo_futbol: bool = False) -> List[datetime]:
        """Los partidos que vienen: el calendario gratis y los ya leídos.
        `solo_futbol`: para API-Football, que solo lee fútbol (la NFL no le toca)."""
        fechas = [t for k, ts in self._calendario.items() for t in ts
                  if t > ahora and (not solo_futbol or k.startswith("soccer_"))]
        filtro = " AND deporte='futbol'" if solo_futbol else ""
        for fila in self.reg.db.execute("SELECT inicio FROM eventos WHERE inicio > ? AND inicio < ?" + filtro,
                                        (ahora.isoformat(), (ahora + timedelta(days=14)).isoformat())):
            try:
                fechas.append(datetime.fromisoformat(fila[0]))
            except (TypeError, ValueError):
                continue
        return sorted(fechas)

    def _ligas(self, f: Fuente, ahora: datetime) -> List[str]:
        """The Odds API: solo las ligas con partido en 24 h (cada liga cuesta).
        Si su calendario no se pudo leer, todas."""
        ligas = self.deportes.get(f.nombre, [])
        if not isinstance(f, TheOddsApi) or not self._calendario:
            return ligas
        return [l for l in ligas if l not in self._calendario
                or any(ahora < t <= ahora + timedelta(hours=24) for t in self._calendario[l])]

    def _falta(self, f: Fuente, ligas: List[str], ahora: datetime) -> Optional[timedelta]:
        if isinstance(f, TheOddsApi) and self._calendario:
            ts = [t for l in ligas for t in self._calendario.get(l, []) if t > ahora]
        else:
            ts = self._inicios(ahora, solo_futbol=isinstance(f, ApiFootball))
        return (min(ts) - ahora) if ts else None

    def _torneos_oddspapi(self, f: "OddsPapi", ahora: datetime) -> "tuple[List[str], Optional[timedelta]]":
        """Los (hasta) 5 torneos de OddsPapi que juegan antes, en las próximas
        24 h, y cuánto falta para el primero. Lo que juega cada torneo sale del
        calendario gratis de The Odds API y de los partidos ya leídos. Sin
        ningún dato de calendario, los 5 primeros de la lista."""
        proximo: Dict[int, datetime] = {}
        for t in f.torneos:
            clave = OP_TORNEOS.get(t, (0, "", None))[2]
            for x in self._calendario.get(clave, []) if clave else []:
                if x > ahora and (t not in proximo or x < proximo[t]):
                    proximo[t] = x
        # Los ya leídos, solo para los torneos que el calendario NO conoce: por
        # nombre no son fiables. API-Football guarda «Premier League» y «Ligue 1»
        # de Egipto o Argelia igual que las de Inglaterra y Francia (visto en
        # producción el 27-09: elegía la Premier en pleno parón).
        nombres = {OP_TORNEOS[t][1]: t for t in f.torneos
                   if t in OP_TORNEOS and OP_TORNEOS[t][2] not in self._calendario}
        for fila in self.reg.db.execute(
                "SELECT liga, MIN(inicio) FROM eventos WHERE inicio > ? GROUP BY liga", (ahora.isoformat(),)):
            t = nombres.get(fila[0])
            try:
                x = datetime.fromisoformat(fila[1])
            except (TypeError, ValueError):
                continue
            if t is not None and (t not in proximo or x < proximo[t]):
                proximo[t] = x
        if not proximo:
            return [str(t) for t in f.torneos[:TORNEOS_POR_PETICION]], None
        pronto = sorted((x, t) for t, x in proximo.items() if x <= ahora + timedelta(hours=24))
        elegidos = [str(t) for _, t in pronto[:TORNEOS_POR_PETICION]]
        return elegidos, (min(proximo.values()) - ahora)

    def _usado(self, f: Fuente, desde: datetime) -> float:
        return self.reg.db.execute("SELECT COALESCE(SUM(coste),0) FROM uso WHERE fuente=? AND ts>=?",
                                   (f.nombre, desde.isoformat())).fetchone()[0]

    def _ultima_de(self, f: Fuente) -> Optional[datetime]:
        ult = self._ultima.get(f.nombre)
        if ult is None:
            fila = self.reg.db.execute("SELECT MAX(ts) FROM uso WHERE fuente=?", (f.nombre,)).fetchone()
            ult = datetime.fromisoformat(fila[0]) if fila and fila[0] else None
        return ult

    def _toca(self, f: Fuente, p: Presupuesto, ahora: datetime,
              coste: Optional[int] = None, falta: Optional[timedelta] = None) -> bool:
        coste = p.coste_vuelta if coste is None else coste
        if coste <= 0:
            return False
        ult = self._ultima_de(f)
        if ult is not None and ahora - ult < p.espera(falta):
            return False
        if self._usado(f, ahora - p.periodo) + coste > p.llamadas:
            return False
        trozo, tope = p.tope_rafaga()
        if self._usado(f, ahora - trozo) + coste > tope:
            return False
        # Lo que dice la propia API que queda manda sobre nuestra cuenta.
        cupo = self.estado.get(f.nombre, {}).get("cupo_restante")
        return cupo is None or cupo >= coste

    def vuelta(self, ahora: Optional[datetime] = None) -> Optional[Resultado]:
        ahora = ahora or datetime.now(timezone.utc)
        lectura = Lectura()
        leidas = []
        self._refresca_calendario(ahora)
        self._olvida_pasados(ahora)
        for f, p in self.fuentes.items():
            est = self.estado.setdefault(f.nombre, {})
            if isinstance(f, OddsPapi):
                ligas, falta = self._torneos_oddspapi(f, ahora)
                coste = f.peticiones_por_lectura(len(ligas)) if ligas else 0
            else:
                ligas = self._ligas(f, ahora)
                falta = self._falta(f, ligas, ahora)
            if isinstance(f, TheOddsApi):
                coste = len(ligas) * max(1, p.coste_vuelta // max(1, len(self.deportes.get(f.nombre, [])) or 1))
            elif not isinstance(f, OddsPapi):
                coste = p.coste_vuelta
            espera = p.espera(falta)
            ult = self._ultima_de(f)
            trozo, tope = p.tope_rafaga()
            # Tras un reinicio el estado (en memoria) está vacío, pero el registro
            # sabe cuándo leyó: sin esto la pantalla decía «esperando su primera
            # lectura» de una fuente que había leído hacía minutos (27-09).
            if ult is not None and not est.get("ultima"):
                est["ultima"] = ult.isoformat()
            est.update(
                cada_min=round(espera.total_seconds() / 60),
                proxima=((ult + espera) if ult else ahora).isoformat() if coste > 0 else None,
                proximo_partido=(ahora + falta).isoformat() if falta is not None else None,
                gastado=self._usado(f, ahora - p.periodo), cupo=p.llamadas,
                periodo_dias=p.periodo.total_seconds() / 86400,
                tope_rafaga=round(tope), rafaga_horas=trozo.total_seconds() / 3600,
                sin_partido=coste <= 0)
            if not self._toca(f, p, ahora, coste, falta):
                continue
            if hasattr(f, "vueltas_previas"):
                f.vueltas_previas = self.reg.db.execute(
                    "SELECT COUNT(*) FROM uso WHERE fuente=?", (f.nombre,)).fetchone()[0]
            try:
                l = f.leer(ligas)
            except SinClave as e:
                log.warning("%s", e)
                est["error"] = "falta la clave"
                continue
            except (httpx.HTTPError, PermissionError, ValueError, KeyError) as e:
                # Una llamada fallida también gasta cupo (y reintentar en bucle lo
                # fundiría): cuenta y espera a su siguiente turno. El error va sin
                # claves: se guarda y se enseña en pantalla.
                log.error("%s ha fallado: %s", f.nombre, limpia(e))
                self._apunta(f, p, ahora, coste)
                est.update(ultima=ahora.isoformat(), error=limpia(e)[:160])
                continue
            gasto = l.coste if l.coste is not None else coste
            self._apunta(f, p, ahora, gasto)
            est.update(ultima=ahora.isoformat(), error=None, cuotas=len(l.cuotas), partidos=len(l.eventos),
                       coste_ultima=gasto, leido=l.detalle or ", ".join(ligas),
                       gastado=self._usado(f, ahora - p.periodo),
                       proxima=(ahora + espera).isoformat())
            if l.cupo_restante is not None:
                est["cupo_restante"] = l.cupo_restante
            lectura.eventos += l.eventos
            lectura.cuotas += l.cuotas
            lectura.avisos += l.avisos
            leidas.append(f.nombre)
        if not leidas:
            return None
        self.reg.guarda_lectura(lectura.eventos, lectura.cuotas)
        eventos = {e.id: e for e in self.cruce.todos()}
        # Dónde apuestas lo decides tú desde la pantalla (Datos → Tus casas).
        apostables = self.reg.casas_apostables()
        apostables = tuple(apostables) if apostables is not None else None
        pre = replace(self.prepartido, apostables=apostables)
        viv = replace(self.vivo, apostables=apostables)
        r = detectar(eventos, lectura.cuotas, self.banca, ahora, pre, viv,
                     expuesto=self.reg.expuesto_por_evento())
        # Primero el porqué (qué punto flaco tiene la casa) y después lo
        # aprendido, que decide por segmento y el punto flaco es parte de él.
        for o in r.oportunidades:
            puntos_flacos.analizar(o, lectura.cuotas, self.reg, ahora, self.prepartido.afiladas)
        r.oportunidades = aprendizaje.aplicar(self.reg, r.oportunidades, r.descartes)
        self.reg.guarda_oportunidades(r.sospechosas, sospechosas=True)
        seguras = (buscar_seguras(eventos, lectura.cuotas, self.total_segura, ahora, self.reglas_seguras)
                   if self.con_seguras else [])
        self.reg.guarda_seguras(seguras)
        self.reg.calcula_clv()
        log.info("Vuelta (%s): %d cuotas, %d de valor, %d seguras, %d sospechosas, descartes %s",
                 ", ".join(leidas), len(lectura.cuotas), len(r.oportunidades), len(seguras),
                 len(r.sospechosas), r.descartes)
        for aviso in lectura.avisos:
            log.warning(aviso)
        perdido = -self.reg.resultado_de_hoy()
        frenado = perdido >= self.freno_dia > 0
        if frenado:
            for o in r.oportunidades:
                o.importe = 0.0
                o.avisos.insert(0, f"FRENO: hoy llevas {perdido:.0f} € perdidos (tope {self.freno_dia:.0f} €). "
                                   "No metas más hasta mañana.")
            log.warning("Freno de pérdidas: %.0f € hoy", perdido)
        self.reg.guarda_oportunidades(r.oportunidades)
        if not frenado:
            self._avisar(r.oportunidades)
        self._avisar_seguras(seguras)
        return r

    def _apunta(self, f: Fuente, p: Presupuesto, ahora: datetime, coste: Optional[int] = None) -> None:
        self._ultima[f.nombre] = ahora
        self.reg.db.execute("INSERT INTO uso VALUES (?,?,?)",
                            (f.nombre, ahora.isoformat(), p.coste_vuelta if coste is None else coste))
        self.reg.db.commit()

    def _olvida_pasados(self, ahora: datetime) -> None:
        """El cruce guarda los partidos en memoria: los de hace más de 6 h, fuera."""
        viejos = [k for k, e in self.cruce.eventos.items() if e.inicio < ahora - timedelta(hours=6)]
        for k in viejos:
            del self.cruce.eventos[k]

    def _avisar(self, ops: List[Oportunidad]) -> None:
        """Una vez por oportunidad; otra solo si el EV ha subido al menos un punto."""
        if not self.aviso:
            return
        for o in ops:
            clave = (o.evento.id, o.mercado, o.linea, o.seleccion, o.casa)
            previa = self._avisadas.get(clave)
            if previa and o.ev < previa[0] + 0.01:
                continue
            self._avisadas[clave] = (o.ev,)
            try:
                self.aviso(texto_aviso(o))
            except Exception as e:                      # noqa: BLE001 - un aviso no para el bucle
                log.error("No se pudo avisar: %s", e)

    def _avisar_seguras(self, seguras: List[Segura]) -> None:
        if not self.aviso:
            return
        for g in seguras:
            clave = ("segura", g.evento.id, g.mercado, g.linea, tuple((p.casa, p.cuota) for p in g.patas))
            if clave in self._avisadas:
                continue
            self._avisadas[clave] = (g.rendimiento,)
            try:
                self.aviso(texto_segura(g))
            except Exception as e:                      # noqa: BLE001
                log.error("No se pudo avisar: %s", e)

    def bucle(self, pausa: float = 30.0) -> None:
        while True:
            self.vuelta()
            time.sleep(pausa)


NOMBRE_SEL = {"local": "gana el local", "visitante": "gana el visitante", "empate": "empate",
              "mas": "más de", "menos": "menos de", "si": "ambos marcan: sí", "no": "ambos marcan: no"}


def texto_aviso(o: Oportunidad) -> str:
    sel = NOMBRE_SEL.get(o.seleccion, o.seleccion)
    if o.mercado == "totales":
        sel = f"{sel} {o.linea:g} goles/puntos"
    elif o.mercado == "handicap":
        l = o.linea if o.seleccion == "local" else -o.linea
        sel = f"{sel} ({l:+g})"
    cuando = "EN VIVO" if o.evento.en_vivo else o.evento.inicio.strftime("%d/%m %H:%M UTC")
    return (f"{'🔴' if o.evento.en_vivo else '🟢'} {o.evento.local} – {o.evento.visitante} ({cuando})\n"
            f"{sel} en {o.casa} a {o.cuota:.2f}\n"
            f"EV {o.ev:+.1%} · meter {o.importe:.0f} €\n"
            + "\n".join(f"· {m}" for m in o.motivos + o.avisos))


def _nombre_sel(mercado: str, linea, sel: str) -> str:
    t = NOMBRE_SEL.get(sel, sel)
    if mercado == "totales":
        return f"{t} {linea:g}"
    if mercado == "handicap":
        return f"{t} ({(linea if sel == 'local' else -linea):+g})"
    return t


def texto_segura(g: Segura) -> str:
    cuando = "EN VIVO" if g.evento.en_vivo else g.evento.inicio.strftime("%d/%m %H:%M UTC")
    patas = "\n".join(f"· Mete {p.importe:.0f} € a {_nombre_sel(g.mercado, g.linea, p.seleccion)} "
                      f"en {p.casa} a {p.cuota:.2f}" for p in g.patas)
    return (f"🟢 SEGURA · {g.evento.local} – {g.evento.visitante} ({cuando})\n{patas}\n"
            f"Ganas {g.beneficio:.2f} € pase lo que pase ({g.rendimiento:+.1%}).\n"
            + "\n".join(f"⚠ {a}" for a in g.avisos))


def aviso_telegram() -> Optional[callable]:
    token, chat = os.environ.get("TELEGRAM_TOKEN"), os.environ.get("TELEGRAM_CHAT")
    if not (token and chat):
        return None
    cli = httpx.Client(timeout=10)

    def enviar(texto: str) -> None:
        cli.post(f"https://api.telegram.org/bot{token}/sendMessage",
                 json={"chat_id": chat, "text": texto}).raise_for_status()
    return enviar
