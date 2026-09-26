"""El bucle: leer, cruzar, detectar, guardar y avisar.

LOS CUPOS GRATIS MANDAN. 500 créditos al mes o 100 llamadas al día se funden
en una hora si se pregunta cada minuto. Cada fuente tiene su presupuesto y el
escáner reparte las lecturas a lo largo del periodo: más vale leer seis veces
al día todo el mes que cada minuto durante dos días.

TODAS LAS FUENTES EN LA MISMA VUELTA. Solo se comparan cuotas leídas juntas:
comparar la de una casa leída ahora con la de Pinnacle leída hace tres horas
es inventarse la oportunidad.
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
from .fuentes.base import Fuente, Lectura, SinClave
from .fuentes.nombres import Cruce
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

    def intervalo(self) -> timedelta:
        vueltas = max(1, self.llamadas // max(1, self.coste_vuelta))
        return self.periodo / vueltas


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
        # Lo que la pantalla enseña de cada fuente: cuándo leyó, qué le queda de
        # cupo y si la última falló. Sin esto, un buscador sin datos no dice si
        # es que no hay chollos o que no está leyendo nada.
        self.estado: Dict[str, dict] = {}
        self.reg.db.execute("CREATE TABLE IF NOT EXISTS uso (fuente TEXT, ts TEXT, coste INTEGER)")

    def _por_defecto(self) -> Dict[Fuente, Presupuesto]:
        out: Dict[Fuente, Presupuesto] = {}
        ligas = [x for x in os.environ.get(
            "VALOR_LIGAS", "soccer_spain_la_liga,soccer_epl,soccer_uefa_champs_league").split(",") if x]
        mercados = os.environ.get("VALOR_MERCADOS", "h2h,totals")
        regiones = os.environ.get("VALOR_REGIONES", "eu")
        if os.environ.get("ODDS_API_KEY"):
            f = TheOddsApi(regiones=regiones, mercados=mercados, cruce=self.cruce)
            coste = len(ligas) * len(mercados.split(",")) * len(regiones.split(","))
            out[f] = Presupuesto(f.nombre, int(os.environ.get("ODDS_API_CUPO", "500")),
                                 timedelta(days=30), coste)
            self.deportes.setdefault(f.nombre, ligas)
        if os.environ.get("APISPORTS_KEY"):
            f = ApiFootball(cruce=self.cruce)
            out[f] = Presupuesto(f.nombre, int(os.environ.get("APISPORTS_CUPO", "100")),
                                 timedelta(days=1), 6)
        return out

    def _toca(self, f: Fuente, p: Presupuesto, ahora: datetime) -> bool:
        ult = self._ultima.get(f.nombre)
        if ult is None:
            fila = self.reg.db.execute("SELECT MAX(ts) FROM uso WHERE fuente=?", (f.nombre,)).fetchone()
            ult = datetime.fromisoformat(fila[0]) if fila and fila[0] else None
        if ult is not None and ahora - ult < p.intervalo():
            return False
        usado = self.reg.db.execute(
            "SELECT COALESCE(SUM(coste),0) FROM uso WHERE fuente=? AND ts>=?",
            (f.nombre, (ahora - p.periodo).isoformat())).fetchone()[0]
        return usado + p.coste_vuelta <= p.llamadas

    def vuelta(self, ahora: Optional[datetime] = None) -> Optional[Resultado]:
        ahora = ahora or datetime.now(timezone.utc)
        lectura = Lectura()
        leidas = []
        for f, p in self.fuentes.items():
            est = self.estado.setdefault(f.nombre, {})
            est["cada_min"] = round(p.intervalo().total_seconds() / 60)
            if not self._toca(f, p, ahora):
                continue
            try:
                l = f.leer(self.deportes.get(f.nombre, []))
            except SinClave as e:
                log.warning("%s", e)
                est["error"] = "falta la clave"
                continue
            except (httpx.HTTPError, PermissionError) as e:
                # Una llamada fallida también gasta cupo (y reintentar en bucle lo
                # fundiría): cuenta y espera a su siguiente turno.
                log.error("%s ha fallado: %s", f.nombre, e)
                self._apunta(f, p, ahora)
                est.update(ultima=ahora.isoformat(), error=str(e)[:160])
                continue
            self._apunta(f, p, ahora)
            est.update(ultima=ahora.isoformat(), error=None, cuotas=len(l.cuotas), partidos=len(l.eventos))
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
        r = detectar(eventos, lectura.cuotas, self.banca, ahora, self.prepartido, self.vivo)
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

    def _apunta(self, f: Fuente, p: Presupuesto, ahora: datetime) -> None:
        self._ultima[f.nombre] = ahora
        self.reg.db.execute("INSERT INTO uso VALUES (?,?,?)", (f.nombre, ahora.isoformat(), p.coste_vuelta))
        self.reg.db.commit()

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
