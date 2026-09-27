"""Aprender de lo que pasa, sin aprender de la suerte.

QUÉ SE MIDE. No se aprende de si una apuesta se ganó o se perdió: con una
cuota de 1,80, ganar o perder es casi una moneda al aire, y aprender de eso es
aprender del ruido. Hacen falta miles de apuestas para que el resultado diga
algo. Se aprende del CLV: si la cuota que dio el aviso era mejor que la cuota
JUSTA al empezar el partido. Converge con decenas de datos, no con miles, y
está demostrado que quien bate el cierre de forma sostenida gana a la larga.

DE QUÉ. De TODOS los avisos, se apostaran o no. Hay muchos más avisos que
apuestas, y el sistema aprende igual de rápido aunque no apuestes nada.

QUÉ SE DECIDE. Los avisos se agrupan por segmento (casa + tipo de apuesta +
rango de cuota + vivo/prepartido + punto flaco). Con al menos 30 avisos:
  · si el CLV medio es negativo con claridad (todo su intervalo del 95 %
    por debajo de cero), ese segmento se APAGA: sus «chollos» eran falsos;
  · si es positivo con claridad, se marca DE CONFIANZA y se dice en el aviso.
Con menos de 30 no se decide nada: menos que eso es suerte.
"""
from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Tuple

from .nucleo.modelo import Oportunidad
from .registro import Registro

MINIMO = 30
Z = 1.96


def rango_cuota(c: float) -> str:
    for tope, nombre in ((1.70, "1,50-1,69"), (2.0, "1,70-1,99"), (2.5, "2,00-2,49"), (3.5, "2,50-3,49")):
        if c < tope:
            return nombre
    return "3,50+"


def segmento(casa: str, mercado: str, cuota: float, en_vivo: bool,
             fallo: str = "valor") -> Tuple[str, str, str, str, str]:
    return (casa, mercado, rango_cuota(cuota), "vivo" if en_vivo else "prepartido", fallo or "valor")


@dataclass
class Segmento:
    clave: Tuple[str, str, str, str, str]
    n: int
    clv_medio: float
    margen: float           # medio intervalo del 95 %
    clvs: List[float] = field(default_factory=list, repr=False)
    apuestas: int = 0       # de esos avisos, cuántos apostaste

    @property
    def estado(self) -> str:
        if self.n < MINIMO:
            return "aprendiendo"
        if self.clv_medio + self.margen < 0:
            return "apagado"
        if self.clv_medio - self.margen > 0:
            return "de confianza"
        return "neutro"

    def dict(self) -> dict:
        casa, mercado, rango, momento, fallo = self.clave
        return {"casa": casa, "mercado": mercado, "rango": rango, "momento": momento, "fallo": fallo, "n": self.n,
                "clv_medio": round(self.clv_medio, 4), "margen": round(self.margen, 4),
                # La mediana no se la llevan dos o tres avisos extremos; el % dice
                # cuántas veces se batió el cierre, no por cuánto.
                "clv_mediana": round(statistics.median(self.clvs), 4) if self.clvs else None,
                "pct_bate": round(sum(1 for x in self.clvs if x > 0) / max(len(self.clvs), 1), 4) if self.clvs else None,
                "apuestas": self.apuestas, "estado": self.estado}


def segmentos(reg: Registro) -> List[Segmento]:
    # Un aviso se repite en cada vuelta mientras dura: cuenta UNA vez, con la
    # cuota con la que apareció por primera vez.
    filas = _primeros_avisos(reg)
    grupos: Dict[tuple, List[float]] = {}
    for f in filas:
        grupos.setdefault(segmento(f["casa"], f["mercado"], f["cuota"], bool(f["en_vivo"]), f["fallo"]),
                          []).append(f["clv"])
    apostadas: Dict[tuple, int] = {}
    for f in reg.db.execute(
            "SELECT o.casa, o.mercado, o.cuota, o.en_vivo, o.fallo FROM apuestas a "
            "JOIN oportunidades o ON o.id=a.oportunidad_id"):
        k = segmento(f["casa"], f["mercado"], f["cuota"], bool(f["en_vivo"]), f["fallo"])
        apostadas[k] = apostadas.get(k, 0) + 1
    out = []
    for k, xs in grupos.items():
        n = len(xs)
        media = sum(xs) / n
        de = math.sqrt(sum((x - media) ** 2 for x in xs) / (n - 1)) if n > 1 else float("inf")
        out.append(Segmento(k, n, media, Z * de / math.sqrt(n) if n > 1 else float("inf"),
                            clvs=xs, apuestas=apostadas.get(k, 0)))
    out.sort(key=lambda s: (-s.n, s.clave))
    return out


def _primeros_avisos(reg: Registro) -> list:
    """Cada aviso UNA vez (se repite en cada vuelta mientras dura), con la cuota
    con la que apareció por primera vez, y solo los que ya tienen CLV."""
    return reg.db.execute(
        "SELECT o.detectada, o.casa, o.mercado, o.cuota, o.en_vivo, o.clv, o.fallo FROM oportunidades o "
        "JOIN (SELECT MIN(id) AS id FROM oportunidades WHERE sospechosa=0 "
        "      GROUP BY evento_id, mercado, IFNULL(linea, -999), seleccion, casa) p ON p.id=o.id "
        "WHERE o.clv IS NOT NULL ORDER BY o.detectada").fetchall()


def resumen(reg: Registro) -> dict:
    """Lo que dice TODO junto: CLV medio y mediano, cuántas veces se batió el
    cierre, el CLV acumulado aviso a aviso y el de cada semana (para ver si el
    método se degrada). Todo de avisos reales ya cerrados; nada estimado."""
    filas = _primeros_avisos(reg)
    xs = [f["clv"] for f in filas]
    acumulado, suma = [], 0.0
    for f in filas:
        suma += f["clv"]
        acumulado.append({"fecha": f["detectada"][:10], "clv": round(suma, 4)})
    semanas: Dict[str, List[float]] = {}
    for f in filas:
        a, sem, _ = datetime.fromisoformat(f["detectada"]).isocalendar()
        semanas.setdefault(f"{a}-S{sem:02d}", []).append(f["clv"])
    bets = [f["clv"] for f in reg.db.execute("SELECT clv FROM apuestas WHERE clv IS NOT NULL")]
    return {
        "avisos": len(xs), "apuestas_con_clv": len(bets),
        "clv_medio": round(sum(xs) / max(len(xs), 1), 4) if xs else None,
        "clv_mediana": round(statistics.median(xs), 4) if xs else None,
        "pct_bate": round(sum(1 for x in xs if x > 0) / max(len(xs), 1), 4) if xs else None,
        "clv_medio_apuestas": round(sum(bets) / max(len(bets), 1), 4) if bets else None,
        "acumulado": acumulado[-300:],
        "semanas": [{"semana": k, "n": len(v), "clv_medio": round(sum(v) / max(len(v), 1), 4)}
                    for k, v in sorted(semanas.items())][-26:],
    }


def limitaciones(reg: Registro) -> List[dict]:
    """Por casa: cuántas apuestas y en cuántas marcaste que no te dejó meter lo
    que querías. Es TU registro: no se afirma que la casa te haya limitado."""
    return [{"casa": f["casa"], "apuestas": f["n"], "limitadas": f["lim"] or 0,
             "ultima_limitada": f["ult"]} for f in reg.db.execute(
        "SELECT casa, COUNT(*) AS n, SUM(COALESCE(limitada,0)) AS lim, "
        "MAX(CASE WHEN limitada=1 THEN creada END) AS ult FROM apuestas GROUP BY casa ORDER BY n DESC")]


def aplicar(reg: Registro, ops: List[Oportunidad], descartes: Dict[str, int]) -> List[Oportunidad]:
    """Quita los avisos de segmentos apagados y marca los de confianza."""
    estado = {s.clave: s for s in segmentos(reg)}
    quedan = []
    for o in ops:
        s = estado.get(segmento(o.casa, o.mercado, o.cuota, o.evento.en_vivo, o.fallo))
        if s and s.estado == "apagado":
            descartes["segmento que no bate el cierre"] = descartes.get("segmento que no bate el cierre", 0) + 1
            continue
        if s and s.estado == "de confianza":
            o.motivos.insert(0, f"DE CONFIANZA: {s.n} avisos parecidos ({o.casa}, {o.mercado}, cuota "
                                f"{s.clave[2]}) han batido la cuota de cierre de media un {s.clv_medio:+.1%}.")
        quedan.append(o)
    return quedan
