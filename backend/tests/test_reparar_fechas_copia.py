# -*- coding: utf-8 -*-
"""Las fechas que la copia deja en texto y la restauración tiene que devolver a fecha.

Lo que puede salir mal: convertir una fecha ISO que la app escribe ella misma (con «T»), tocar
texto que se parece a una fecha pero no lo es, o entrar en listas. Y que la restauración use la
misma conversión."""
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import reparar_fechas_copia as rf  # noqa: E402
import restaurar_copia as rc  # noqa: E402


def test_solo_el_formato_de_python_con_espacio_es_una_fecha():
    assert rf.a_fecha("2026-09-18 22:12:38.411000") == datetime(2026, 9, 18, 22, 12, 38, 411000)
    assert rf.a_fecha("2026-09-18 22:12:38") == datetime(2026, 9, 18, 22, 12, 38)
    assert rf.a_fecha("2026-10-20T23:23:11.123456") is None        # ISO de la app: se queda como está
    assert rf.a_fecha("2026-10-20") is None
    assert rf.a_fecha("2026-13-40 22:12:38") is None               # parece fecha y no lo es
    assert rf.a_fecha(datetime(2026, 1, 1)) is None
    assert rf.a_fecha(None) is None


def test_se_convierten_los_campos_de_arriba_y_un_nivel_dentro_pero_no_las_listas():
    doc = {"_id": 1, "ts": "2026-09-18 22:12:38.411000", "created_at": "2026-10-20T23:23:11",
           "meta": {"visto_en": "2026-09-19 08:00:00", "nombre": "x"},
           "lista": ["2026-09-19 08:00:00"], "hondo": {"a": {"b": "2026-09-19 08:00:00"}}}
    pares = dict(rf.campos_a_convertir(doc))
    assert pares == {"ts": datetime(2026, 9, 18, 22, 12, 38, 411000), "meta.visto_en": datetime(2026, 9, 19, 8, 0)}


def test_la_restauracion_devuelve_las_fechas_a_fecha():
    d = rc.con_fechas({"ts": "2026-09-18 22:12:38.411000", "meta": {"visto_en": "2026-09-19 08:00:00"}, "id": "abc"})
    assert d["ts"] == datetime(2026, 9, 18, 22, 12, 38, 411000)
    assert d["meta"]["visto_en"] == datetime(2026, 9, 19, 8, 0)
    assert d["id"] == "abc"


def test_sin_fechas_en_texto_no_hay_nada_que_convertir():
    assert rf.campos_a_convertir({"_id": 1, "id": "x", "created_at": "2026-10-20T23:23:11"}) == []
