"""La memoria: qué cuotas hubo, qué se recomendó, qué se apostó y cómo salió.

Sin esto no hay forma de saber si el sistema gana o si ha tenido suerte. Dos
números lo dicen:

  · BENEFICIO REAL: lo ganado. Con pocas apuestas es casi todo varianza: 200
    apuestas a cuota 2 con +3 % de EV terminan en pérdidas un tercio de las veces.
  · CLV (closing line value): cuánto mejor fue tu cuota que la cuota JUSTA al
    cerrar el mercado (Pinnacle sin margen justo antes de empezar). Es la
    señal que converge rápido: si el CLV medio es positivo tras 100-200
    apuestas, el método funciona aunque el beneficio aún no lo diga. Si es
    negativo, da igual lo que se haya ganado: es suerte y se acabará.
"""
from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional

from .nucleo.margen import justas
from .nucleo.modelo import RESULTADOS, Cuota, Evento, Oportunidad

ESQUEMA = """
CREATE TABLE IF NOT EXISTS eventos (
  id TEXT PRIMARY KEY, deporte TEXT, liga TEXT, local TEXT, visitante TEXT,
  inicio TEXT, en_vivo INTEGER);
CREATE TABLE IF NOT EXISTS cuotas (
  evento_id TEXT, casa TEXT, mercado TEXT, linea REAL, seleccion TEXT,
  cuota REAL, ts TEXT, fuente TEXT);
-- IFNULL: en SQLite dos NULL no chocan en un UNIQUE, y el 1X2 no tiene línea.
CREATE UNIQUE INDEX IF NOT EXISTS cuotas_unicas
  ON cuotas(evento_id, casa, mercado, IFNULL(linea, -999), seleccion, ts);
CREATE INDEX IF NOT EXISTS cuotas_mercado ON cuotas(evento_id, mercado, linea, casa, ts);
CREATE TABLE IF NOT EXISTS oportunidades (
  id INTEGER PRIMARY KEY AUTOINCREMENT, detectada TEXT, evento_id TEXT, mercado TEXT,
  linea REAL, seleccion TEXT, casa TEXT, cuota REAL, prob_justa REAL, ev REAL,
  importe REAL, en_vivo INTEGER, motivos TEXT, avisos TEXT, sospechosa INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS seguras (
  id INTEGER PRIMARY KEY AUTOINCREMENT, detectada TEXT, evento_id TEXT, mercado TEXT,
  linea REAL, patas TEXT, total REAL, beneficio REAL, rendimiento REAL, en_vivo INTEGER,
  avisos TEXT);
CREATE TABLE IF NOT EXISTS apuestas (
  id INTEGER PRIMARY KEY AUTOINCREMENT, creada TEXT, oportunidad_id INTEGER,
  evento_id TEXT, mercado TEXT, linea REAL, seleccion TEXT, casa TEXT,
  cuota REAL, importe REAL, prob_justa REAL, ev REAL,
  resultado TEXT DEFAULT 'pendiente',       -- pendiente | ganada | perdida | nula
  cuota_justa_cierre REAL, clv REAL);
CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY, valor TEXT);
"""

# Casas con licencia en España que alguna fuente trae por su web .es (OddsPapi).
# Las demás («williamhill», «bet365» a secas, «unibet_fr»...) son webs de otros
# países: su cuota no es la que te dan aquí.
CASAS_ESPANA = ("bet365.es", "bwin.es", "codere.es", "888sport.es", "betfair.es", "betway.es",
                "leovegas.es", "paf.es", "pokerstars.es", "winamax.es", "goldenpark.es")
# Donde apuesta Dani (27-09-2026): Codere, BetStars (= pokerstars.es) y Gamdom
# (sin licencia española; él la usa). Casino Barcelona: ninguna fuente la trae.
# Es lo que se recomienda mientras no elija otra cosa en la pantalla.
CASAS_DANI = ("codere.es", "pokerstars.es", "gamdom")


class SenalCaducada(ValueError):
    """«La he metido» sobre un aviso que ya no vale: sin confirmarlo, no se apunta."""


def _iso(d: datetime) -> str:
    return d.astimezone(timezone.utc).isoformat()


class Registro:
    def __init__(self, ruta: str = "valor.db"):
        self.ruta = ruta
        self.db = sqlite3.connect(ruta, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(ESQUEMA)
        # Columnas añadidas después: se crean en las bases que ya existían.
        for tabla, col, tipo in (("oportunidades", "cuota_justa_cierre", "REAL"),
                                 ("oportunidades", "clv", "REAL"),
                                 ("apuestas", "descripcion", "TEXT"),
                                 ("oportunidades", "fallo", "TEXT"),
                                 # La señal tal cual se vio (de cuándo eran sus cuotas,
                                 # contra qué se midió) y la apuesta tal cual se hizo.
                                 ("oportunidades", "ts_cuota", "TEXT"),
                                 ("oportunidades", "fuente", "TEXT"),
                                 ("oportunidades", "detalle", "TEXT"),
                                 ("apuestas", "cuota_senal", "REAL"),
                                 ("apuestas", "importe_senal", "REAL"),
                                 ("apuestas", "limitada", "INTEGER"),
                                 ("apuestas", "fuera_de_plazo", "INTEGER")):
            if col not in [c[1] for c in self.db.execute(f"PRAGMA table_info({tabla})")]:
                self.db.execute(f"ALTER TABLE {tabla} ADD COLUMN {col} {tipo}")
        self.db.commit()

    @contextmanager
    def _tx(self):
        try:
            yield self.db
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

    # ── lecturas ─────────────────────────────────────────────────────────
    def guarda_lectura(self, eventos: Iterable[Evento], cuotas: Iterable[Cuota]) -> None:
        with self._tx() as db:
            db.executemany(
                "INSERT INTO eventos VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET "
                "en_vivo=MAX(en_vivo, excluded.en_vivo)",
                [(e.id, e.deporte, e.liga, e.local, e.visitante, _iso(e.inicio), int(e.en_vivo))
                 for e in eventos])
            db.executemany(
                "INSERT OR IGNORE INTO cuotas VALUES (?,?,?,?,?,?,?,?)",
                [(c.evento_id, c.casa, c.mercado, c.linea, c.seleccion, c.cuota, _iso(c.ts), c.fuente)
                 for c in cuotas])

    def historial(self, evento_id: str, casa: str, mercado: str, linea: Optional[float],
                  seleccion: str, desde: datetime) -> List[tuple]:
        """[(ts, cuota)] de una selección en una casa, de más antigua a más reciente."""
        fl = "linea IS NULL" if linea is None else "linea = ?"
        args = [evento_id, casa, mercado] + ([] if linea is None else [linea]) + [seleccion, _iso(desde)]
        return [(datetime.fromisoformat(f["ts"]), f["cuota"]) for f in self.db.execute(
            f"SELECT ts, cuota FROM cuotas WHERE evento_id=? AND casa=? AND mercado=? AND {fl} "
            f"AND seleccion=? AND ts>=? ORDER BY ts", args).fetchall()]

    def guarda_oportunidades(self, ops: Iterable[Oportunidad], sospechosas: bool = False,
                             casi: bool = False) -> List[int]:
        """`sospechosa`: 0 recomendada, 1 sospechosa, 2 «casi» (no cumple las
        reglas; se guarda para enseñarla y para medir su CLV, nunca se apuesta)."""
        tipo = 2 if casi else int(sospechosas)
        ids = []
        with self._tx() as db:
            for o in ops:
                detalle = {
                    "cuota_justa": o.cuota_justa, "por_metodo": o.por_metodo,
                    "referencias": o.ref_cuotas, "otras": o.otras, "edad_max": o.edad_max,
                    "ts_referencia": _iso(o.ts_referencia) if o.ts_referencia else None}
                cur = db.execute(
                    "INSERT INTO oportunidades (detectada, evento_id, mercado, linea, seleccion, casa,"
                    " cuota, prob_justa, ev, importe, en_vivo, motivos, avisos, sospechosa, fallo,"
                    " ts_cuota, fuente, detalle) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (_iso(datetime.now(timezone.utc)), o.evento.id, o.mercado, o.linea, o.seleccion,
                     o.casa, o.cuota, o.prob_justa, o.ev, o.importe, int(o.evento.en_vivo),
                     json.dumps(o.motivos, ensure_ascii=False),
                     json.dumps(o.avisos, ensure_ascii=False), tipo, o.fallo,
                     _iso(o.ts_cuota) if o.ts_cuota else None, o.fuente or None,
                     json.dumps(detalle, ensure_ascii=False)))
                ids.append(cur.lastrowid)
        return ids

    def guarda_seguras(self, seguras) -> None:
        with self._tx() as db:
            for g in seguras:
                db.execute(
                    "INSERT INTO seguras (detectada, evento_id, mercado, linea, patas, total, beneficio,"
                    " rendimiento, en_vivo, avisos) VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (_iso(datetime.now(timezone.utc)), g.evento.id, g.mercado, g.linea,
                     json.dumps([p.__dict__ for p in g.patas]), g.total, g.beneficio, g.rendimiento,
                     int(g.evento.en_vivo), json.dumps(g.avisos, ensure_ascii=False)))

    def seguras_vigentes(self, minutos: float = 5) -> List[dict]:
        """Las seguras vistas hace nada. Una segura de hace diez minutos ya no existe."""
        ahora = datetime.now(timezone.utc)
        filas = self.db.execute(
            "SELECT g.*, e.local, e.visitante, e.liga, e.deporte, e.inicio FROM seguras g "
            "JOIN eventos e ON e.id=g.evento_id WHERE g.detectada>=? ORDER BY g.id DESC",
            (_iso(ahora - timedelta(minutes=minutos)),)).fetchall()
        vistas, out = set(), []
        for f in filas:
            clave = (f["evento_id"], f["mercado"], f["linea"])
            if clave in vistas:
                continue
            vistas.add(clave)
            out.append(dict(f, patas=json.loads(f["patas"]), avisos=json.loads(f["avisos"])))
        out.sort(key=lambda x: x["rendimiento"], reverse=True)
        return out

    # ── apuestas ─────────────────────────────────────────────────────────
    def apuesta_desde_oportunidad(self, op_id: int, cuota: Optional[float] = None,
                                  importe: Optional[float] = None, limitada: bool = False,
                                  aun_caducada: bool = False) -> int:
        """«La he metido». La cuota y el importe reales pueden diferir de los sugeridos.

        La SEÑAL no se toca nunca: la apuesta guarda aparte lo que se metió de
        verdad (y copia lo que decía la señal, para ver «avisó a 2,05, me la
        dieron a 1,98»). Una señal caducada no se apunta sin confirmarlo: así no
        se cuela como apuesta del sistema una cuota que ya no existía."""
        o = self.db.execute(
            "SELECT o.*, e.inicio FROM oportunidades o LEFT JOIN eventos e ON e.id=o.evento_id "
            "WHERE o.id=?", (op_id,)).fetchone()
        if o is None:
            raise KeyError(op_id)
        estado = self.estado_senal(dict(o))
        if estado["estado"] != "valida" and not aun_caducada:
            raise SenalCaducada(estado["motivo"])
        cuota = cuota or o["cuota"]
        importe = importe if importe is not None else o["importe"]
        with self._tx() as db:
            cur = db.execute(
                "INSERT INTO apuestas (creada, oportunidad_id, evento_id, mercado, linea, seleccion,"
                " casa, cuota, importe, prob_justa, ev, cuota_senal, importe_senal, limitada,"
                " fuera_de_plazo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (_iso(datetime.now(timezone.utc)), op_id, o["evento_id"], o["mercado"], o["linea"],
                 o["seleccion"], o["casa"], cuota, importe, o["prob_justa"],
                 o["prob_justa"] * cuota - 1, o["cuota"], o["importe"], int(bool(limitada)),
                 int(estado["estado"] != "valida")))
        return cur.lastrowid

    # ── el estado de una señal ───────────────────────────────────────────
    def _ultima_cuota(self, f: dict) -> Optional[tuple]:
        fl = "linea IS NULL" if f["linea"] is None else "linea = ?"
        args = ([f["evento_id"], f["casa"], f["mercado"]] + ([] if f["linea"] is None else [f["linea"]])
                + [f["seleccion"]])
        fila = self.db.execute(
            f"SELECT cuota, ts FROM cuotas WHERE evento_id=? AND casa=? AND mercado=? AND {fl} "
            f"AND seleccion=? ORDER BY ts DESC LIMIT 1", args).fetchone()
        return (fila["cuota"], fila["ts"]) if fila else None

    def estado_senal(self, f: dict, ahora: Optional[datetime] = None) -> dict:
        """VÁLIDA mientras sus cuotas tengan menos de 10 min (8 s en vivo) y el
        partido no haya empezado; si no, CADUCADA. CAMBIADA si una lectura
        posterior da otra cuota en esa casa. Nada se quita en silencio: la
        pantalla enseña las caducadas marcadas, no las esconde."""
        ahora = ahora or datetime.now(timezone.utc)
        det = json.loads(f.get("detalle") or "{}")
        edad_max = float(det.get("edad_max") or (8.0 if f.get("en_vivo") else 600.0))
        ts_c = datetime.fromisoformat(f.get("ts_cuota") or f["detectada"])
        ts_r = datetime.fromisoformat(det["ts_referencia"]) if det.get("ts_referencia") else ts_c
        hasta = min(ts_c, ts_r) + timedelta(seconds=edad_max)
        inicio = datetime.fromisoformat(f["inicio"]) if f.get("inicio") else None
        if inicio and not f.get("en_vivo"):
            hasta = min(hasta, inicio)
        out = {"estado": "valida", "motivo": "", "valida_hasta": _iso(hasta),
               "ts_cuota": _iso(ts_c), "ts_referencia": _iso(ts_r),
               "ultima_cuota": None, "ultima_ts": None}
        ultima = self._ultima_cuota(f)
        if ultima and datetime.fromisoformat(ultima[1]) > ts_c:
            out["ultima_cuota"], out["ultima_ts"] = ultima
            if abs(ultima[0] - f["cuota"]) > 1e-9:
                out["estado"] = "cambiada"
                out["motivo"] = (f"La señal era a {f['cuota']:.2f}; la última lectura de {f['casa']} "
                                 f"da {ultima[0]:.2f}. No uses la señal original.")
                return out
            out["estado"] = "caducada"
            out["motivo"] = "La última lectura ya no la da como apuesta (se ha movido la referencia)."
            return out
        if inicio and not f.get("en_vivo") and inicio <= ahora:
            out["estado"], out["motivo"] = "caducada", "El partido ya ha empezado."
        elif hasta <= ahora:
            out["estado"] = "caducada"
            out["motivo"] = (f"Sus cuotas tienen más de {edad_max / 60:.0f} min: ya no se sabe si siguen ahí."
                             if edad_max >= 60 else f"Sus cuotas tienen más de {edad_max:.0f} s.")
        return out

    def historial_senal(self, op_id: int, horas: float = 24) -> Optional[dict]:
        """Lo que se LEYÓ de verdad de esa selección, en su casa y en las
        referencias, antes y después de la señal. Sin interpolar nada."""
        o = self.db.execute("SELECT * FROM oportunidades WHERE id=?", (op_id,)).fetchone()
        if o is None:
            return None
        det = json.loads(o["detalle"] or "{}")
        casas = [o["casa"]] + sorted(det.get("referencias") or {"pinnacle": None})
        desde = datetime.fromisoformat(o["detectada"]) - timedelta(hours=horas)
        filas = []
        for casa in casas:
            for t, c in self.historial(o["evento_id"], casa, o["mercado"], o["linea"], o["seleccion"], desde):
                filas.append({"ts": _iso(t), "casa": casa, "cuota": c, "referencia": casa != o["casa"]})
        filas.sort(key=lambda x: x["ts"])
        return {"senal": {"detectada": o["detectada"], "cuota": o["cuota"], "ev": o["ev"],
                          "ts_cuota": o["ts_cuota"]}, "lecturas": filas[-200:]}

    # ── exposición: lo que hay en juego ahora ────────────────────────────
    def expuesto_por_evento(self) -> Dict[str, float]:
        out: Dict[str, float] = {}
        for f in self.db.execute("SELECT evento_id, importe FROM apuestas "
                                 "WHERE resultado='pendiente' AND evento_id IS NOT NULL"):
            out[f["evento_id"]] = out.get(f["evento_id"], 0.0) + (f["importe"] or 0.0)
        return out

    def exposicion(self, banca: float, tope_evento: float = 0.04) -> dict:
        partidos: Dict[str, dict] = {}
        total = 0.0
        for f in self.db.execute(
                "SELECT a.id, a.evento_id, a.importe, a.descripcion, e.local, e.visitante, e.inicio "
                "FROM apuestas a LEFT JOIN eventos e ON e.id=a.evento_id WHERE a.resultado='pendiente'"):
            total += f["importe"] or 0.0
            clave = f["evento_id"] or f"manual-{f['id']}"
            p = partidos.setdefault(clave, {
                "evento_id": f["evento_id"], "importe": 0.0, "inicio": f["inicio"],
                "partido": (f"{f['local']} – {f['visitante']}" if f["local"] else (f["descripcion"] or "a mano"))})
            p["importe"] += f["importe"] or 0.0
        lista = sorted(partidos.values(), key=lambda x: -x["importe"])
        for p in lista:
            p["importe"] = round(p["importe"], 2)
            p["pct"] = round(p["importe"] / banca, 4) if banca else None
            # Lo que aún cabe en ese partido con el tope del 4 % (las de a mano no
            # tienen partido, así que no se les calcula).
            p["queda"] = round(max(0.0, tope_evento * banca - p["importe"]), 2) if p["evento_id"] else None
        return {"total": round(total, 2), "pct": round(total / banca, 4) if banca else None,
                "tope_evento": tope_evento, "partidos": lista}

    # ── ajustes ──────────────────────────────────────────────────────────
    def ajuste(self, clave: str, defecto=None):
        f = self.db.execute("SELECT valor FROM ajustes WHERE clave=?", (clave,)).fetchone()
        return json.loads(f["valor"]) if f else defecto

    def pon_ajuste(self, clave: str, valor) -> None:
        with self._tx() as db:
            db.execute("INSERT INTO ajustes VALUES (?,?) ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor",
                       (clave, json.dumps(valor, ensure_ascii=False)))

    def casas_apostables(self) -> Optional[List[str]]:
        """Dónde se puede apostar. None = en todas (sin filtro). Manda lo que
        elijas en la pantalla; si no has elegido, VALOR_CASAS («*» = todas);
        y si tampoco, las de Dani."""
        v = self.ajuste("casas_apostables", None)
        if v is None:
            env = os.environ.get("VALOR_CASAS", "").strip()
            if env:
                return None if env == "*" else [x.strip() for x in env.split(",") if x.strip()]
            return list(CASAS_DANI)
        return None if v == "*" else [str(x) for x in v]

    def casas_vistas(self, dias: float = 7) -> List[dict]:
        desde = _iso(datetime.now(timezone.utc) - timedelta(days=dias))
        return [{"casa": f["casa"], "fuente": f["fuente"], "cuotas": f["n"], "ultima": f["ultima"]}
                for f in self.db.execute(
                    "SELECT casa, fuente, COUNT(*) AS n, MAX(ts) AS ultima FROM cuotas WHERE ts>=? "
                    "GROUP BY casa, fuente ORDER BY casa", (desde,))]

    def uso_por_fuente(self, dias: float = 30) -> Dict[str, dict]:
        """Lo gastado de cada cupo y las señales que ha dado: ¿merece la pena lo que gasta?"""
        desde = _iso(datetime.now(timezone.utc) - timedelta(days=dias))
        out: Dict[str, dict] = {}
        if self.db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='uso'").fetchone():
            for f in self.db.execute("SELECT fuente, SUM(coste) AS c, COUNT(*) AS n FROM uso WHERE ts>=? "
                                     "GROUP BY fuente", (desde,)):
                out[f["fuente"]] = {"gastado": f["c"] or 0, "lecturas": f["n"], "senales": 0}
        for f in self.db.execute(
                "SELECT fuente, COUNT(*) AS n FROM (SELECT fuente FROM oportunidades WHERE sospechosa=0 "
                "AND detectada>=? AND fuente IS NOT NULL GROUP BY evento_id, mercado, IFNULL(linea,-999),"
                " seleccion, casa) GROUP BY fuente", (desde,)):
            out.setdefault(f["fuente"], {"gastado": 0, "lecturas": 0, "senales": 0})["senales"] = f["n"]
        return out

    def liquida(self, apuesta_id: int, resultado: str) -> None:
        if resultado not in ("ganada", "perdida", "nula", "pendiente"):
            raise ValueError(resultado)
        with self._tx() as db:
            db.execute("UPDATE apuestas SET resultado=? WHERE id=?", (resultado, apuesta_id))

    def cierre_justo(self, evento_id: str, mercado: str, linea: Optional[float], seleccion: str,
                     referencia: str = "pinnacle") -> Optional[float]:
        """Cuota justa de la referencia en su ÚLTIMA lectura antes del inicio."""
        ev = self.db.execute("SELECT inicio FROM eventos WHERE id=?", (evento_id,)).fetchone()
        if ev is None:
            return None
        sels = RESULTADOS[mercado]
        filtro_linea = "linea IS NULL" if linea is None else "linea = ?"
        args = [evento_id, referencia, mercado] + ([] if linea is None else [linea]) + [ev["inicio"]]
        filas = self.db.execute(
            f"SELECT seleccion, cuota, ts FROM cuotas WHERE evento_id=? AND casa=? AND mercado=? "
            f"AND {filtro_linea} AND ts <= ? ORDER BY ts DESC", args).fetchall()
        ultimas: Dict[str, float] = {}
        for f in filas:
            ultimas.setdefault(f["seleccion"], f["cuota"])
        if any(s not in ultimas for s in sels):
            return None
        p = min(ps[sels.index(seleccion)] for ps in justas([ultimas[s] for s in sels]).values())
        return 1.0 / p

    def calcula_clv(self) -> int:
        """Rellena el CLV de apuestas Y avisos cuyo partido ya empezó. Devuelve cuántos.

        Los avisos cuentan aunque no se apostaran: son la materia prima del
        aprendizaje (aprendizaje.py), y hay muchos más avisos que apuestas.
        """
        ahora = _iso(datetime.now(timezone.utc))
        n = 0
        with self._tx() as db:
            for tabla in ("apuestas", "oportunidades"):
                pend = self.db.execute(
                    f"SELECT t.* FROM {tabla} t JOIN eventos e ON e.id=t.evento_id "
                    f"WHERE t.clv IS NULL AND e.inicio <= ?", (ahora,)).fetchall()
                for a in pend:
                    justa = self.cierre_justo(a["evento_id"], a["mercado"], a["linea"], a["seleccion"])
                    if justa:
                        db.execute(f"UPDATE {tabla} SET cuota_justa_cierre=?, clv=? WHERE id=?",
                                   (justa, a["cuota"] / justa - 1, a["id"]))
                        n += 1
        return n

    def apuesta_manual(self, descripcion: str, casa: str, cuota: float, importe: float) -> int:
        """«Le acabo de meter 100 € a esto», aunque no viniera de un aviso.

        Cuenta para el beneficio; para el CLV no, porque sin saber el partido
        exacto no hay cuota de cierre con la que compararla.
        """
        descripcion = (descripcion or "").strip()[:200]
        if not descripcion or not casa or cuota <= 1 or importe <= 0:
            raise ValueError("faltan datos")
        with self._tx() as db:
            cur = db.execute(
                "INSERT INTO apuestas (creada, descripcion, casa, cuota, importe, mercado, seleccion)"
                " VALUES (?,?,?,?,?,?,?)",
                (_iso(datetime.now(timezone.utc)), descripcion, casa.strip().lower()[:40], cuota, importe,
                 "manual", "manual"))
        return cur.lastrowid

    def resultado_de_hoy(self) -> float:
        """Ganado (+) o perdido (−) hoy (UTC) con las apuestas ya liquidadas."""
        hoy = datetime.now(timezone.utc).date().isoformat()
        total = 0.0
        for a in self.db.execute("SELECT * FROM apuestas WHERE substr(creada,1,10)=?", (hoy,)):
            if a["resultado"] == "ganada":
                total += a["importe"] * (a["cuota"] - 1)
            elif a["resultado"] == "perdida":
                total -= a["importe"]
        return total

    def balance(self) -> dict:
        filas = self.db.execute("SELECT * FROM apuestas").fetchall()
        cerradas = [a for a in filas if a["resultado"] in ("ganada", "perdida", "nula")]
        apostado = sum(a["importe"] for a in cerradas)
        ganado = sum(a["importe"] * (a["cuota"] - 1) if a["resultado"] == "ganada"
                     else -a["importe"] if a["resultado"] == "perdida" else 0.0 for a in cerradas)
        esperado = sum(a["importe"] * (a["ev"] or 0) for a in cerradas)
        con_clv = [a["clv"] for a in filas if a["clv"] is not None]
        return {
            "apuestas": len(filas), "cerradas": len(cerradas),
            "pendientes": sum(1 for a in filas if a["resultado"] == "pendiente"),
            "apostado": round(apostado, 2), "beneficio": round(ganado, 2),
            "roi": round(ganado / apostado, 4) if apostado else None,
            "beneficio_esperado": round(esperado, 2),
            "clv_medio": round(sum(con_clv) / len(con_clv), 4) if con_clv else None,
            "con_clv": len(con_clv),
        }

    def oportunidades_recientes(self, limite: int = 100, sospechosas: bool = False) -> List[dict]:
        filas = self.db.execute(
            "SELECT o.*, e.local, e.visitante, e.liga, e.deporte, e.inicio FROM oportunidades o "
            "JOIN eventos e ON e.id=o.evento_id WHERE o.sospechosa=? ORDER BY o.id DESC LIMIT ?",
            (int(sospechosas), limite)).fetchall()
        return [dict(f, motivos=json.loads(f["motivos"]), avisos=json.loads(f["avisos"]))
                for f in filas]

    def apuestas(self) -> List[dict]:
        return [dict(f) for f in self.db.execute(
            "SELECT a.*, e.local, e.visitante, e.inicio FROM apuestas a "
            "LEFT JOIN eventos e ON e.id=a.evento_id ORDER BY a.id DESC").fetchall()]

    def casi_recientes(self, horas: float = 4, limite: int = 12) -> List[dict]:
        """Lo que más se acercó en las últimas horas sin cumplir las reglas: la
        última vez que se vio cada selección y casa, de más ventaja a menos,
        solo de partidos que aún no han empezado."""
        ahora = datetime.now(timezone.utc)
        filas = self.db.execute(
            "SELECT o.*, e.local, e.visitante, e.liga, e.deporte, e.inicio FROM oportunidades o "
            "JOIN eventos e ON e.id=o.evento_id WHERE o.sospechosa=2 AND o.detectada>=? AND e.inicio>? "
            "ORDER BY o.id DESC", (_iso(ahora - timedelta(hours=horas)), _iso(ahora))).fetchall()
        vistas, out = set(), []
        for f in filas:
            clave = (f["evento_id"], f["mercado"], f["linea"], f["seleccion"], f["casa"])
            if clave in vistas:
                continue
            vistas.add(clave)
            out.append(dict(f, motivos=json.loads(f["motivos"]), avisos=json.loads(f["avisos"]),
                            detalle=json.loads(f["detalle"] or "{}")))
        out.sort(key=lambda x: -x["ev"])
        return out[:limite]

    def vigentes(self, en_vivo: bool, minutos: float, banca: Optional[float] = None,
                 tope_evento: float = 0.04) -> List[dict]:
        """Las oportunidades vistas hace poco (la última de cada selección y
        casa), con su estado: primero las VÁLIDAS, por ventaja; detrás las
        caducadas o cambiadas, marcadas, para que no desaparezcan sin más.
        Con `banca`, `importe_max` rebaja lo sugerido a lo que aún cabe en el
        partido con lo que ya tengas apostado (tope del 4 %)."""
        ahora = datetime.now(timezone.utc)
        expuesto = self.expuesto_por_evento() if banca else {}
        desde = _iso(ahora - timedelta(minutes=minutos))
        filas = self.db.execute(
            "SELECT o.*, e.local, e.visitante, e.liga, e.deporte, e.inicio FROM oportunidades o "
            "JOIN eventos e ON e.id=o.evento_id WHERE o.sospechosa=0 AND o.en_vivo=? AND o.detectada>=? "
            "ORDER BY o.id DESC", (int(en_vivo), desde)).fetchall()
        vistas, out = set(), []
        for f in filas:
            clave = (f["evento_id"], f["mercado"], f["linea"], f["seleccion"], f["casa"])
            if clave in vistas:
                continue
            vistas.add(clave)
            d = dict(f, motivos=json.loads(f["motivos"]), avisos=json.loads(f["avisos"]),
                     detalle=json.loads(f["detalle"] or "{}"))
            d.update(self.estado_senal(dict(f), ahora))
            if banca:
                cabe = max(0.0, tope_evento * banca - expuesto.get(f["evento_id"], 0.0))
                maximo = float(int(min(f["importe"] or 0.0, cabe)))
                d["importe_max"] = maximo if maximo >= 2 else 0.0
                d["ya_apostado"] = round(expuesto.get(f["evento_id"], 0.0), 2)
            out.append(d)
        validas = sorted((x for x in out if x["estado"] == "valida"), key=lambda x: -x["ev"])
        resto = sorted((x for x in out if x["estado"] != "valida"), key=lambda x: x["detectada"], reverse=True)
        return validas + resto
