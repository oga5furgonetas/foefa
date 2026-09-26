import pytest
from datetime import datetime, timedelta, timezone

from valor.escaner import Escaner, Presupuesto, texto_aviso
from valor.fuentes.base import Fuente, Lectura
from valor.fuentes.nombres import id_evento
from valor.nucleo.modelo import Cuota, Evento
from valor.registro import Registro

AHORA = datetime(2026, 9, 27, 12, 0, tzinfo=timezone.utc)



@pytest.fixture(autouse=True)
def _modo_antiguo(monkeypatch):
    # Estas pruebas usan una apuesta del 46 % y una segura: se abren los filtros.
    monkeypatch.setenv("VALOR_PROB_MINIMA", "0")
    monkeypatch.setenv("VALOR_SEGURAS", "1")


class Falsa(Fuente):
    nombre = "falsa"

    def __init__(self, cruce):
        self.cruce, self.lecturas = cruce, 0

    def leer(self, deportes):
        self.lecturas += 1
        inicio = AHORA + timedelta(hours=3)
        e = self.cruce.registra(Evento(id_evento("futbol", "Betis", "Sevilla", inicio), "futbol",
                                       "LaLiga", "Betis", "Sevilla", inicio))
        t = AHORA - timedelta(seconds=30)
        c = [Cuota(e.id, "pinnacle", "1x2", None, s, v, t) for s, v in
             (("local", 2.10), ("empate", 3.45), ("visitante", 3.70))]
        c.append(Cuota(e.id, "bet365", "1x2", None, "local", 2.30, t))
        return Lectura([e], c)


def _escaner(tmp_path, avisos):
    reg = Registro(str(tmp_path / "v.db"))
    esc = Escaner(reg, 1000, fuentes={}, aviso=avisos.append)
    f = Falsa(esc.cruce)
    # 100 al día, 25 por vuelta → 4 vueltas al día, una cada 6 h
    esc.fuentes = {f: Presupuesto("falsa", 100, timedelta(days=1), 25)}
    return esc, f, reg


def test_vuelta_guarda_y_avisa_una_vez(tmp_path):
    avisos = []
    esc, f, reg = _escaner(tmp_path, avisos)
    r = esc.vuelta(AHORA)
    assert len(r.oportunidades) == 1 and len(avisos) == 1
    assert "meter" in avisos[0] and "bet365" in avisos[0]
    assert reg.oportunidades_recientes()[0]["casa"] == "bet365"
    esc._ultima.clear()
    esc.vuelta(AHORA + timedelta(hours=7))
    assert len(avisos) == 1                     # misma oportunidad: no se repite el aviso


def test_respeta_el_presupuesto(tmp_path):
    esc, f, _ = _escaner(tmp_path, [])
    esc.vuelta(AHORA)
    assert esc.vuelta(AHORA + timedelta(hours=1)) is None      # aún no toca (cada 6 h)
    esc.vuelta(AHORA + timedelta(hours=6))
    esc.vuelta(AHORA + timedelta(hours=12))
    esc.vuelta(AHORA + timedelta(hours=18))
    assert f.lecturas == 4
    # 4 × 25 = 100: una quinta vuelta dentro de las 24 h se pasaría del cupo
    esc._ultima.clear()
    assert esc.vuelta(AHORA + timedelta(hours=23)) is None


def test_intervalo():
    assert Presupuesto("x", 500, timedelta(days=30), 6).intervalo() == timedelta(days=30) / 83


def test_texto_aviso_totales():
    e = Evento("e", "futbol", "L", "A", "B", AHORA)
    from valor.nucleo.modelo import Oportunidad
    o = Oportunidad(e, "totales", 2.5, "mas", "bwin", 2.1, 0.5, 2.0, 0.05, 10, ["pinnacle"], {}, 5)
    assert "más de 2.5" in texto_aviso(o)


def test_tipster_favorito_con_la_linea_movida(tmp_path, monkeypatch):
    """El caso bueno: Pinnacle baja al Sevilla de 1,90 a 1,62; Bet365 sigue a 1,80."""
    monkeypatch.setenv("VALOR_PROB_MINIMA", "0.60")
    monkeypatch.setenv("VALOR_SEGURAS", "0")
    reg = Registro(str(tmp_path / "v.db"))
    esc = Escaner(reg, 6000, fuentes={})
    inicio = AHORA + timedelta(hours=2)
    e = esc.cruce.registra(Evento(id_evento("futbol", "Getafe", "Sevilla", inicio), "futbol",
                                  "LaLiga", "Getafe", "Sevilla", inicio))

    def lectura(t, ref, blanda):
        c = [Cuota(e.id, "pinnacle", "1x2", None, s, v, t) for s, v in zip(("local", "empate", "visitante"), ref)]
        c.append(Cuota(e.id, "bet365", "1x2", None, "visitante", blanda, t))
        return Lectura([e], c)

    class Dos(Fuente):
        nombre = "dos"
        def __init__(self):
            self.n = 0
        def leer(self, d):
            self.n += 1
            return (lectura(AHORA - timedelta(minutes=40), (4.60, 3.70, 1.90), 1.80) if self.n == 1
                    else lectura(AHORA - timedelta(seconds=20), (6.00, 4.30, 1.62), 1.80))

    esc.fuentes = {Dos(): Presupuesto("dos", 1000, timedelta(days=1), 1)}
    r1 = esc.vuelta(AHORA - timedelta(minutes=40))
    assert r1.oportunidades == []                          # a 1,90 Bet365 no tenía valor
    r2 = esc.vuelta(AHORA)
    (o,) = r2.oportunidades
    assert (o.casa, o.seleccion, o.cuota) == ("bet365", "visitante", 1.80)
    assert o.prob_justa >= 0.60 and 1.6 < o.cuota_justa < 1.7
    assert o.fallo == "casa lenta"
    assert o.motivos[0].startswith("CASA LENTA") and "de 1.90 a 1.62" in o.motivos[0]
    assert r2.descartes.get("poca probabilidad de acertar", 0) == 0
    assert o.importe > 0


def test_poca_probabilidad_se_descarta(tmp_path, monkeypatch):
    monkeypatch.setenv("VALOR_PROB_MINIMA", "0.60")
    reg = Registro(str(tmp_path / "v.db"))
    esc = Escaner(reg, 1000, fuentes={})
    f = Falsa(esc.cruce)
    esc.fuentes = {f: Presupuesto("falsa", 100, timedelta(days=1), 25)}
    r = esc.vuelta(AHORA)
    assert r.oportunidades == [] and r.descartes["poca probabilidad de acertar"] == 1


def _fuente_fija(esc, pinnacle, blanda):
    inicio = AHORA + timedelta(hours=2)
    e = esc.cruce.registra(Evento(id_evento("futbol", "Getafe", "Sevilla", inicio), "futbol",
                                  "LaLiga", "Getafe", "Sevilla", inicio))

    class Fija(Fuente):
        nombre = "fija"
        def __init__(self):
            pass
        def leer(self, d):
            t = AHORA - timedelta(seconds=20)
            c = [Cuota(e.id, "pinnacle", "1x2", None, s, v, t)
                 for s, v in zip(("local", "empate", "visitante"), pinnacle)]
            c.append(Cuota(e.id, "bet365", "1x2", None, "visitante", blanda, t))
            return Lectura([e], c)
    esc.fuentes = {Fija(): Presupuesto("fija", 1000, timedelta(days=1), 1)}


def test_cuota_baja_solo_con_mucho_valor(tmp_path, monkeypatch):
    monkeypatch.setenv("VALOR_PROB_MINIMA", "0.60")
    # Pinnacle 1,45 (justa ~1,48). Bet365 1,52: +2,7 %, poco para una cuota baja → fuera.
    esc = Escaner(Registro(str(tmp_path / "a.db")), 6000, fuentes={})
    _fuente_fija(esc, (8.50, 5.00, 1.45), 1.52)
    r = esc.vuelta(AHORA)
    assert r.oportunidades == [] and r.descartes["cuota baja sin valor suficiente"] == 1
    # Bet365 1,60: +8 % → sí, aunque esté por debajo de 1,70.
    esc = Escaner(Registro(str(tmp_path / "b.db")), 6000, fuentes={})
    _fuente_fija(esc, (8.50, 5.00, 1.45), 1.60)
    (o,) = esc.vuelta(AHORA).oportunidades
    assert o.cuota == 1.60 and o.ev >= 0.05
    # Y por debajo de 1,50, nunca.
    esc = Escaner(Registro(str(tmp_path / "c.db")), 6000, fuentes={})
    _fuente_fija(esc, (15.0, 7.00, 1.25), 1.45)
    r = esc.vuelta(AHORA)
    assert r.oportunidades == [] and r.descartes["cuota fuera de rango"] == 1


def test_freno_de_perdidas(tmp_path, monkeypatch):
    monkeypatch.setenv("VALOR_PROB_MINIMA", "0.60")
    reg = Registro(str(tmp_path / "v.db"))
    esc = Escaner(reg, 6000, fuentes={})
    _fuente_fija(esc, (6.00, 4.30, 1.62), 1.80)
    # Hoy ya se han perdido 400 € (tope: 6 % de 6000 = 360 €)
    from datetime import datetime as _dt
    reg.db.execute("INSERT INTO apuestas (creada, evento_id, mercado, seleccion, casa, cuota, importe,"
                   " prob_justa, ev, resultado) VALUES (?,?,?,?,?,?,?,?,?,?)",
                   (_dt.now(timezone.utc).isoformat(), "x", "1x2", "local", "bwin", 1.9, 400, 0.55, 0.04, "perdida"))
    avisos = []
    esc.aviso = avisos.append
    (o,) = esc.vuelta(AHORA).oportunidades
    assert o.importe == 0 and o.avisos[0].startswith("FRENO") and avisos == []
