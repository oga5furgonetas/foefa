# -*- coding: utf-8 -*-
"""Cómo reparte el motor del cuadrante los fines de semana (31-10-2026, Dani: «la misma persona tiene 3 findes
seguidos libres y otro no pilla un finde libre en 3 semanas»). Sin base de datos: llama a `cuadrante_motor` con
una entrada vacía (semanas por rellenar), N personas normales, S semanas y máxima M (+2 al día), y cuenta por
persona los días de finde trabajados, los findes LIBRES (sábado y domingo libres) y la racha más larga de findes
seguidos trabajando.

    python backend/scripts/simular_findes.py [semanas=4] [personas=12] [maxima=6] [findes_previos]

`findes_previos`, p. ej. `1111`: las personas pares vienen de trabajar esos 4 findes y las impares de librarlos
(para ver que el historial cuenta). MOTOR_DIR en el entorno prueba otro `cuadrante_motor.py` (una copia).

El 31-10-2026, antes del cambio (12 personas, 4 semanas, máxima 6): 5 personas sin NINGÚN finde libre y rachas de
4 findes seguidos trabajando, con días de finde de 2 a 8 por persona. Después: nadie sin finde libre, racha máxima
2 y de 4 a 6 días de finde cada uno. Con 60 personas y máxima 40: de 26 sin finde libre a 3, y de 46 s a 18 s."""
import datetime as dt
import os
import sys
import time

sys.path.insert(0, os.environ.get("MOTOR_DIR") or os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import cuadrante_motor as cm  # noqa: E402

print("motor:", cm.__file__)
LUNES = dt.date(2026, 11, 2)
SEMANAS = int(sys.argv[1]) if len(sys.argv) > 1 else 4
N = int(sys.argv[2]) if len(sys.argv) > 2 else 12
MAXIMA = int(sys.argv[3]) if len(sys.argv) > 3 else 6
PREVIOS = sys.argv[4] if len(sys.argv) > 4 else ""
dias = [LUNES + dt.timedelta(i) for i in range(7 * SEMANAS)]
conductores = []
for i in range(N):
    c = {"id": f"c{i:02d}", "nombre": f"Persona {i:02d}", "tipo": "normal"}
    if PREVIOS:
        if i % 2 == 0:
            c["findes_previos"] = [int(x) for x in PREVIOS]
            c["findes_recientes"] = 2 * sum(int(x) for x in PREVIOS)
        else:
            c["findes_previos"] = [0] * len(PREVIOS)
            c["findes_recientes"] = 0
    conductores.append(c)
entrada = {
    "fecha_inicio": dias[0].isoformat(), "fecha_fin": dias[-1].isoformat(), "colchon": 2, "permitir_extra": True,
    "maximas": {d.isoformat(): MAXIMA for d in dias},
    "conductores": conductores, "celdas": {}, "bloqueadas": [], "segundos": 45,
}
t0 = time.time()
res = cm.generar_cuadrante(entrada)
print(f"estado {res['estado']} · {time.time() - t0:.1f} s · extras {res['extras']} · déficit {res['deficit']}")
findes = [(d, d + dt.timedelta(1)) for d in dias if d.weekday() == 5]
print(f"{'persona':10} {'días finde':>10} {'findes libres':>13} {'racha máx trabajando':>21}  patrón (T=trabaja el finde, .=libre)")
peor_racha, sin_libre, dias_finde_tot = 0, 0, []
for c in entrada["conductores"]:
    cid = c["id"]
    trabaja = lambda d: res["celdas"][f"{cid}|{d.isoformat()}"]["valor"] in cm.TRABAJO  # noqa: E731
    dias_finde = sum(1 for s, dm in findes for d in (s, dm) if trabaja(d))
    patron = "".join("T" if (trabaja(s) or trabaja(dm)) else "." for s, dm in findes)
    libres = patron.count(".")
    racha = max((len(x) for x in patron.split(".")), default=0)
    peor_racha = max(peor_racha, racha)
    sin_libre += libres == 0
    dias_finde_tot.append(dias_finde)
    prev = f"  (antes: {''.join('T' if v else '.' for v in c.get('findes_previos', []))})" if c.get("findes_previos") else ""
    print(f"{cid:10} {dias_finde:>10} {libres:>13} {racha:>21}  {patron}{prev}")
print(f"\nfindes en el periodo: {len(findes)} · personas sin NINGÚN finde libre: {sin_libre} · peor racha de findes "
      f"seguidos trabajando: {peor_racha} · días de finde por persona: de {min(dias_finde_tot)} a {max(dias_finde_tot)}")
