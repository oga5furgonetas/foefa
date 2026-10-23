# -*- coding: utf-8 -*-
"""El embudo de activación: lo que inflaría o hundiría la cifra, probado con cuentas a mano.

`activacion.py` no toca la base en sus cálculos, así que aquí se fabrican cuentas con sus
eventos, paradas y entregas, y se comprueba lo que un embudo así suele contar mal: testers
de Play como repartidores, las demos, el ejemplo como «parada suya», veinte «entregadas»
de golpe como día real, o la visita del mismo día del alta como «vuelve».
"""
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import activacion as ac  # noqa: E402

AHORA = datetime(2026, 10, 23, 12, 0, tzinfo=timezone.utc)


def _org(nombre, hace_min, **extra):
    o = {"id": nombre, "name": nombre, "sector": "autonomo",
         "created_at": (AHORA - timedelta(minutes=hace_min)).replace(tzinfo=None).isoformat()}
    o.update(extra)
    return o


def _uso_real_sencillo(entregadas):
    """Imita la vara del servidor sin copiarla: un día cuenta con 2+ entregas a direcciones distintas."""
    por_dia = {}
    for p in entregadas:
        por_dia.setdefault(p.get("fecha"), set()).add(p.get("direccion"))
    dias = sum(1 for d in por_dia.values() if len(d) >= 2)
    return sum(len(d) for d in por_dia.values()), dias


def _cuenta(hace_dias=5, eventos=(), paradas=0, entregadas=()):
    return {"id": "x", "creada": AHORA - timedelta(days=hace_dias), "eventos": list(eventos),
            "paradas": paradas, "entregadas": list(entregadas)}


# ── quién cuenta ───────────────────────────────────────────────────────────
def test_fuera_demos_propia_pruebas_y_otros_sectores():
    orgs = [_org("Pepe", 10), _org("Demo Noroeste", 20, demo=True), _org("Dani", 30, account_type="owner"),
            _org("Prueba Claude", 40), _org("Transportes SL", 50, sector="mensajeria")]
    assert [o["name"] for o in ac.filtrar_reales(orgs)] == ["Pepe"]


def test_los_testers_de_play_no_son_repartidores():
    # Tres altas en el mismo minuto = lote de testers; el correo como nombre, igual.
    orgs = [_org("t1", 100), _org("t2", 100), _org("t3", 100), _org("Luis", 200), _org("ana@gmail.com", 300)]
    assert [o["name"] for o in ac.filtrar_reales(orgs)] == ["Luis"]


def test_dos_altas_en_el_mismo_minuto_siguen_siendo_reales():
    # Las 4 de Meta de la noche del 10-10 llegaron en 4 minutos y eran de verdad.
    orgs = [_org("a", 100), _org("b", 100)]
    assert len(ac.filtrar_reales(orgs)) == 2


def test_sin_fecha_de_alta_no_entra():
    assert ac.filtrar_reales([{"id": "z", "name": "Zoe", "sector": "autonomo"}]) == []


# ── los pasos de una cuenta ────────────────────────────────────────────────
def test_el_alta_sola_solo_toca_el_primer_paso():
    p = ac.pasos_de(_cuenta(), _uso_real_sencillo)
    assert p["alta"] and not any(v for k, v in p.items() if k != "alta")


def test_abrir_la_app_el_mismo_dia_del_alta_no_es_volver():
    creada = AHORA - timedelta(days=5)
    mismo_dia = [{"nombre": None, "ts": creada + timedelta(hours=3)}]
    otro_dia = [{"nombre": None, "ts": creada + timedelta(days=1, hours=2)}]
    assert ac.pasos_de({"creada": creada, "eventos": mismo_dia}, _uso_real_sencillo)["vuelve"] is False
    assert ac.pasos_de({"creada": creada, "eventos": otro_dia}, _uso_real_sencillo)["vuelve"] is True


def test_navegar_sale_de_las_acciones_de_la_app_y_ordenar_no_es_un_paso():
    evs = [{"nombre": "ruta_ordenar", "ts": AHORA}, {"nombre": "ruta_foto_etiqueta", "ts": AHORA}]
    p = ac.pasos_de(_cuenta(eventos=evs), _uso_real_sencillo)
    assert p["navega"] is False and "ordena" not in p
    assert ac.pasos_de(_cuenta(eventos=[{"nombre": "ruta_navegar", "ts": AHORA}]), _uso_real_sencillo)["navega"] is True


def test_una_entrega_no_es_un_dia_real_pero_si_una_entrega():
    ent = [{"fecha": "2026-10-20", "direccion": "Rúa Real 5", "cerrado_en": AHORA}]
    p = ac.pasos_de(_cuenta(paradas=3, entregadas=ent), _uso_real_sencillo)
    assert p["parada"] and p["entrega"] and not p["dia_real"]


def test_el_dia_real_lo_decide_la_vara_que_le_pasan():
    ent = [{"fecha": "2026-10-20", "direccion": "Rúa Real 5"}, {"fecha": "2026-10-20", "direccion": "Rúa Nova 2"}]
    assert ac.pasos_de(_cuenta(paradas=2, entregadas=ent), _uso_real_sencillo)["dia_real"] is True
    assert ac.pasos_de(_cuenta(paradas=2, entregadas=ent), lambda e: (len(e), 0))["dia_real"] is False


# ── el embudo ──────────────────────────────────────────────────────────────
def test_el_embudo_cuenta_cuentas_y_senala_la_peor_caida():
    ent = [{"fecha": "2026-10-20", "direccion": "A"}, {"fecha": "2026-10-20", "direccion": "B"}]
    cuentas = [
        _cuenta(hace_dias=1),
        _cuenta(hace_dias=2),
        _cuenta(hace_dias=3, eventos=[{"nombre": "ruta_ordenar", "ts": AHORA}], paradas=4),
        _cuenta(hace_dias=4, eventos=[{"nombre": "ruta_ordenar", "ts": AHORA}, {"nombre": "ruta_navegar", "ts": AHORA}],
                paradas=9, entregadas=ent),
    ]
    out = ac.embudo(cuentas, AHORA, 30, _uso_real_sencillo)
    por = {p["clave"]: p["n"] for p in out["pasos"]}
    assert out["cuentas"] == 4
    assert por == {"alta": 4, "vuelve": 2, "parada": 2, "navega": 1, "entrega": 1, "dia_real": 1}
    assert out["pasos"][2]["pct"] == 50.0
    # La mayor caída es la primera (2 cuentas); con empate manda la primera que aparece.
    assert out["peor_caida"] == {"de": "Se dan de alta", "a": "Abren la app otro día", "cuentas": 2}
    assert [p["fuente"] for p in out["pasos"]][:2] == ["base", "eventos"]


def test_las_cuentas_fuera_del_periodo_no_cuentan():
    out = ac.embudo([_cuenta(hace_dias=40), _cuenta(hace_dias=2)], AHORA, 30, _uso_real_sencillo)
    assert out["cuentas"] == 1


def test_la_serie_por_semana_sale_entera_y_a_cero_donde_no_hay_nada():
    out = ac.embudo([_cuenta(hace_dias=2, paradas=1)], AHORA, 14, _uso_real_sencillo)
    semanas = out["semanas"]
    assert len(semanas) == 3                                 # 09-10 → 23-10 toca 3 lunes (05, 12 y 19)
    assert semanas[0]["semana"] == "2026-10-05" and semanas[-1]["semana"] == "2026-10-19"
    assert [s["altas"] for s in semanas] == [0, 0, 1]
    assert semanas[-1]["parada"] == 1 and semanas[-1]["dia_real"] == 0


def test_sin_cuentas_no_revienta_ni_inventa():
    out = ac.embudo([], AHORA, 30, _uso_real_sencillo)
    assert out["cuentas"] == 0 and out["peor_caida"] is None
    assert all(p["n"] == 0 and p["pct"] is None for p in out["pasos"])


def test_las_fechas_como_texto_iso_se_entienden():
    c = {"creada": (AHORA - timedelta(days=3)).replace(tzinfo=None).isoformat(),
         "eventos": [{"nombre": None, "ts": (AHORA - timedelta(days=1)).isoformat()}]}
    assert ac.pasos_de(c, _uso_real_sencillo)["vuelve"] is True
    assert ac.embudo([c], AHORA, 30, _uso_real_sencillo)["cuentas"] == 1
