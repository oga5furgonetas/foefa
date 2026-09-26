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
"""


def _iso(d: datetime) -> str:
    return d.astimezone(timezone.utc).isoformat()


class Registro:
    def __init__(self, ruta: str = "valor.db"):
        self.db = sqlite3.connect(ruta, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(ESQUEMA)
        # Columnas añadidas después: se crean en las bases que ya existían.
        for tabla, col, tipo in (("oportunidades", "cuota_justa_cierre", "REAL"),
                                 ("oportunidades", "clv", "REAL"),
                                 ("apuestas", "descripcion", "TEXT"),
                                 ("oportunidades", "fallo", "TEXT")):
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

    def guarda_oportunidades(self, ops: Iterable[Oportunidad], sospechosas: bool = False) -> List[int]:
        ids = []
        with self._tx() as db:
            for o in ops:
                cur = db.execute(
                    "INSERT INTO oportunidades (detectada, evento_id, mercado, linea, seleccion, casa,"
                    " cuota, prob_justa, ev, importe, en_vivo, motivos, avisos, sospechosa, fallo)"
                    " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (_iso(datetime.now(timezone.utc)), o.evento.id, o.mercado, o.linea, o.seleccion,
                     o.casa, o.cuota, o.prob_justa, o.ev, o.importe, int(o.evento.en_vivo),
                     json.dumps(o.motivos, ensure_ascii=False),
                     json.dumps(o.avisos, ensure_ascii=False), int(sospechosas), o.fallo))
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
                                  importe: Optional[float] = None) -> int:
        """«La he metido». La cuota y el importe reales pueden diferir de los sugeridos."""
        o = self.db.execute("SELECT * FROM oportunidades WHERE id=?", (op_id,)).fetchone()
        if o is None:
            raise KeyError(op_id)
        cuota = cuota or o["cuota"]
        importe = importe if importe is not None else o["importe"]
        with self._tx() as db:
            cur = db.execute(
                "INSERT INTO apuestas (creada, oportunidad_id, evento_id, mercado, linea, seleccion,"
                " casa, cuota, importe, prob_justa, ev) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (_iso(datetime.now(timezone.utc)), op_id, o["evento_id"], o["mercado"], o["linea"],
                 o["seleccion"], o["casa"], cuota, importe, o["prob_justa"],
                 o["prob_justa"] * cuota - 1))
        return cur.lastrowid

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

    def vigentes(self, en_vivo: bool, minutos: float) -> List[dict]:
        """Las oportunidades que siguen valiendo: vistas hace poco y, si son de
        prepartido, de partidos que aún no han empezado. Una por selección y
        casa (la última vista)."""
        ahora = datetime.now(timezone.utc)
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
            if not en_vivo and f["inicio"] <= _iso(ahora):
                continue
            out.append(dict(f, motivos=json.loads(f["motivos"]), avisos=json.loads(f["avisos"])))
        out.sort(key=lambda x: x["ev"], reverse=True)
        return out
