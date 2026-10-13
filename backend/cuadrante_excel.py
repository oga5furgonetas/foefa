# -*- coding: utf-8 -*-
"""LEER LA HOJA MENSUAL DE DANI — el Excel del cuadrante tal como lo lleva él.

Función PURA (recibe los bytes del fichero): server.py empareja los nombres con
las fichas y guarda. Probado en `tests/test_cuadrante_excel.py`.

CÓMO ES LA HOJA (la de septiembre-octubre de 2026, OGA5)
══════════════════════════════════════════════════════════════════════════════
  · Una fila de cabecera con «Orden» y «Nombre»; a su derecha, una columna por
    día con una FECHA de verdad (D18 =DATE(2026,9,1) y cada una la de la
    izquierda +1). Después del 30 viene el 1 del mes siguiente, y el último día
    puede ir detrás de columnas de horas ocultas (el 12-10 estaba en BD, tras
    AS..BC): se toma como día toda columna cuya cabecera sea una fecha, esté
    donde esté, y se comprueba que no falte ni se repita ninguna.
  · Debajo, una fila por persona. Los códigos: 1, N/T, V (05:43), BAJA, N/D,
    APROBADO, N/T APROB, BKP, RA, S, N/P… El 1 puede venir como número.
  · Al final, «RUTAS PLANIFICADAS (contador de 1)», «MÁXIMAS» y «DIFERENCIA».
  · El COLOR DEL NOMBRE dice cómo trabaja la persona, y lo explica la propia
    hoja en su leyenda (una celda de color y el texto a su derecha):
      azul 00B0F0       «solo trabaja de lunes a viernes» (horario fijo)
      melocotón FABF8F  «solo trabajan sábado y domingo»
      amarillo FFFF00   «desde el día 1 se van de inactividad»
      rosa FF66CC       «DÍA EXTRA (6º día)» — este va en la CELDA, no en el nombre
    Se lee la leyenda si está; si no, esos mismos colores por defecto.
  · Los demás colores de las celdas NO significan nada para el cuadrante. Dani:
    «los que tienen un 1 aunque sea de color son rutas… lo de colores, la regla
    de debajo, solo aplícalo si lo tienen en el nombre».
"""
from __future__ import annotations

import datetime as dt
import io
import re
import unicodedata
from collections import Counter
from typing import Any, Dict, List, Optional

ROSAS = {"FF66CC", "FF99CC", "FFC0CB"}
POR_DEFECTO = {"00B0F0": "empresa", "FABF8F": "finde", "FFFF00": "sale"}
_PARADA = ("RUTAS", "MAXIMA", "DIFERENCIA", "TOTAL", "LEYENDA")


def _n(s) -> str:
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip().upper()


def _rgb(celda) -> str:
    """El color de fondo en RRGGBB, o '' si no tiene o es blanco."""
    f = celda.fill
    if not f or not f.fill_type:
        return ""
    # Algunos Excel guardan el color visible en bgColor aunque el patrón sea
    # sólido y fgColor sea theme=0 (blanco). La plantilla definitiva usa justo
    # esa forma: ignorarlo convertía los colores de categoría en "normal".
    for c in (f.fgColor, f.bgColor):
        if c is None or c.type != "rgb" or not isinstance(c.rgb, str):
            continue
        v = c.rgb[-6:].upper()
        if v != "FFFFFF":
            return v
    return ""


def _codigo(v):
    """(código, hora). 'V (05:43)' -> ('V', '05:43'); 1.0 -> ('1', '')."""
    if v is None or isinstance(v, bool):
        return "", ""
    if isinstance(v, (int, float)):
        return (str(int(v)) if float(v).is_integer() else str(v)), ""
    txt = str(v).strip()
    hora = ""
    m = re.search(r"\(([^)]*)\)", txt)
    if m:
        dentro = m.group(1).strip()
        if re.fullmatch(r"\d{1,2}[:.]\d{2}", dentro):
            hora = dentro.replace(".", ":")
        txt = re.sub(r"\s*\(.*?\)", "", txt)
    return re.sub(r"\s+", " ", txt).strip().upper(), hora


def _fecha(v) -> Optional[dt.date]:
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, dt.date):
        return v
    return None


def _fechas_por_formula(ws_f, fila: int, cols: List[int]) -> Dict[int, dt.date]:
    """Sin valores guardados (un fichero que nunca abrió Excel): se calculan
    las fórmulas de la cabecera, que son =DATE(a,m,d) y =<celda>+1."""
    from openpyxl.utils import column_index_from_string
    out: Dict[int, dt.date] = {}
    for c in cols:
        v = ws_f.cell(fila, c).value
        if isinstance(v, str):
            m = re.fullmatch(r"=\s*DATE\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})\)", v.strip(), re.I)
            if m:
                out[c] = dt.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
                continue
            m = re.fullmatch(r"=\s*\$?([A-Z]{1,3})\$?(\d+)\s*\+\s*1", v.strip(), re.I)
            if m and int(m.group(2)) == fila:
                ref = column_index_from_string(m.group(1).upper())
                if ref in out:
                    out[c] = out[ref] + dt.timedelta(days=1)
        else:
            f = _fecha(v)
            if f:
                out[c] = f
    return out


def _rango_titulo(ws, fila: int) -> tuple[Optional[dt.date], Optional[dt.date]]:
    """Rango explícito del cuadrante, si el título contiene dos fechas."""
    texto = " ".join(str(ws.cell(r, c).value or "")
                     for r in range(1, min(fila, 8) + 1)
                     for c in range(1, min(ws.max_column, 8) + 1))
    halladas = re.findall(r"(?<!\d)(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?!\d)", texto)
    if len(halladas) < 2:
        return None, None
    try:
        inicio = dt.date(*(int(x) for x in reversed(halladas[0])))
        fin = dt.date(*(int(x) for x in reversed(halladas[1])))
    except ValueError:
        return None, None
    if fin < inicio or (fin - inicio).days > 75:
        return None, None
    return inicio, fin


def _fechas_por_titulo(ws, fila: int, cols: List[int]) -> Dict[int, dt.date]:
    """Resuelve días numéricos con el rango mensual explícito del título.

    La hoja de octubre puede tener 1..31 y después 1,2 del mes siguiente.
    Inferir el mes desde hoy elige mal ese último 2 (y puede producir un
    septiembre 31); el título «del 01-10-2026 al 31-10-2026» fija el ancla.
    """
    inicio, fin_titulo = _rango_titulo(ws, fila)
    if not inicio or not fin_titulo:
        return {}

    nums = {}
    for c in cols:
        v = ws.cell(fila, c).value
        if isinstance(v, (int, float)) and not isinstance(v, bool) and float(v).is_integer() and 1 <= int(v) <= 31:
            nums[c] = int(v)
    if not nums:
        return {}

    actual = inicio
    out: Dict[int, dt.date] = {}
    for c in sorted(nums):
        n = nums[c]
        if n != actual.day:
            ultimo_dia = (_primero_mes_siguiente(actual) - dt.timedelta(days=1)).day
            if n != 1 or actual.day != ultimo_dia:
                return {}
            actual = _primero_mes_siguiente(actual)
        if n != actual.day:
            return {}
        out[c] = actual
        actual += dt.timedelta(days=1)
    if fin_titulo not in out.values():
        return {}
    return out


def _leyenda(ws) -> Dict[str, str]:
    """Color -> significado, leído de la propia hoja (celda de color + texto)."""
    out: Dict[str, str] = {}
    for fila in ws.iter_rows(min_row=1, max_row=min(ws.max_row, 400)):
        for c in fila:
            if not isinstance(c.value, str) or c.column < 2:
                continue
            t = _n(c.value)
            color = _rgb(ws.cell(c.row, c.column - 1))
            if not color:
                continue
            if "SABADO Y DOMINGO" in t and "LIBRA" not in t:
                out[color] = "finde"
            elif "LUNES A VIERNES" in t:
                out[color] = "empresa"
            elif "INACTIV" in t or "SE VAN" in t:
                out[color] = "sale"
            elif "EXTRA" in t:
                out[color] = "extra"
    return out


def _primero_mes_siguiente(d: dt.date) -> dt.date:
    return (d.replace(day=28) + dt.timedelta(days=4)).replace(day=1)


def _fechas_por_numero(ws, fila: int, cols: List[int], ref: dt.date) -> Dict[int, dt.date]:
    """Hojas SEMANALES de otros centros: la cabecera trae solo el NÚMERO del día
    (7, 8, 9… y a veces 29, 30, 1, 2…), sin mes ni año. El mes se deduce de la
    fecha de hoy (el primer día se coloca en el mes más cercano a `ref`) y, al
    bajar el número, se pasa al mes siguiente. DGA2, 05-10-2026: «semanal» tenía
    7..18 y 21..29 y el importador solo conocía fechas de verdad."""
    nums = {}
    for c in cols:
        v = ws.cell(fila, c).value
        if isinstance(v, (int, float)) and not isinstance(v, bool) and float(v).is_integer() and 1 <= int(v) <= 31:
            nums[c] = int(v)
    if len(nums) < 7:
        return {}
    orden = sorted(nums)
    # Una hoja semanal llega hasta hoy (o poco después): el ÚLTIMO día se coloca
    # en el mes más cercano a `ref` y se cuenta hacia atrás (si el número SUBE al
    # ir hacia atrás, era del mes anterior). DGA2: «semanal 2» = 7..18, 29, 30,
    # 1..5 es del 07-09 al 05-10, no octubre y noviembre.
    ultimo = None
    for delta in (-1, 0, 1):
        m = ref.month + delta
        y = ref.year + (m - 1) // 12
        m = (m - 1) % 12 + 1
        try:
            cand = dt.date(y, m, nums[orden[-1]])
        except ValueError:
            continue
        if ultimo is None or abs((cand - ref).days) < abs((ultimo - ref).days):
            ultimo = cand
    if ultimo is None:
        return {}
    out = {orden[-1]: ultimo}
    actual, siguiente = ultimo, nums[orden[-1]]
    for c in reversed(orden[:-1]):
        n = nums[c]
        y, m = actual.year, actual.month
        if n > siguiente:                                    # al ir hacia atrás: mes anterior
            m -= 1
            if m == 0:
                y, m = y - 1, 12
        try:
            actual = dt.date(y, m, n)
        except ValueError:
            return {}
        out[c] = actual
        siguiente = n
    if (max(out.values()) - min(out.values())).days > 75:
        return {}
    return out


def _cabecera(ws, ws_f, ref: dt.date):
    """(fila_cab, col_nombre, col_orden, {columna: fecha}) de esta hoja, o ValueError."""
    fila_cab = col_nombre = col_orden = None
    for fila in ws.iter_rows(min_row=1, max_row=min(ws.max_row, 80)):
        for c in fila[:10]:
            if _n(c.value) == "NOMBRE":
                fila_cab, col_nombre = c.row, c.column
                break
        if fila_cab:
            break
    if not fila_cab:
        raise ValueError("No encuentro la fila de cabecera con la columna «Nombre».")
    for c in range(1, col_nombre):
        if _n(ws.cell(fila_cab, c).value) == "ORDEN":
            col_orden = c
    # ── Los días: toda columna con una fecha en la cabecera ──
    cols = list(range(col_nombre + 1, ws.max_column + 1))
    fechas_col = {c: _fecha(ws.cell(fila_cab, c).value) for c in cols}
    fechas_col = {c: f for c, f in fechas_col.items() if f}
    if len(fechas_col) < 7:
        fechas_col = _fechas_por_formula(ws_f, fila_cab, cols)
    if len(fechas_col) < 7:
        fechas_col = _fechas_por_titulo(ws, fila_cab, cols)
    if len(fechas_col) < 7:
        fechas_col = _fechas_por_numero(ws, fila_cab, cols, ref)
    if len(fechas_col) < 7:
        raise ValueError("La fila de «Nombre» no tiene fechas en las columnas de los días. "
                         "¿Es la hoja MENSUAL del cuadrante?")
    return fila_cab, col_nombre, col_orden, fechas_col


def leer_mensual(contenido: bytes, hoja: str = "", ref: Optional[dt.date] = None) -> Dict[str, Any]:
    """Los bytes del .xlsx -> {fechas, filas, maximas, codigos, avisos, leyenda}.

    Lanza ValueError con un mensaje para la pantalla si no es la hoja esperada.
    Se prueban todas las pestañas (la pedida, MENSUAL, y las demás por orden) y
    se usa la primera que tiene una cabecera con días; `ref` (hoy por defecto)
    sirve para poner mes y año cuando la cabecera solo trae el número del día.
    """
    import openpyxl
    ref = ref or dt.date.today()
    try:
        wb_v = openpyxl.load_workbook(io.BytesIO(contenido), data_only=True)
        wb_f = openpyxl.load_workbook(io.BytesIO(contenido), data_only=False)
    except Exception as e:                                        # noqa: BLE001
        raise ValueError("No se puede abrir el Excel: %s" % str(e)[:120])
    preferidas = ([hoja] if hoja in wb_v.sheetnames else []) + (["MENSUAL"] if "MENSUAL" in wb_v.sheetnames else [])
    validas, ultimo_error = [], None
    for nombre_hoja in preferidas + [n for n in wb_v.sheetnames if n not in preferidas]:
        ws_i, ws_fi = wb_v[nombre_hoja], wb_f[nombre_hoja]
        try:
            validas.append((nombre_hoja, ws_i, ws_fi) + _cabecera(ws_i, ws_fi, ref))
        except ValueError as e:
            ultimo_error = ultimo_error or e
            continue
        if nombre_hoja in preferidas:
            break                                              # la pedida / MENSUAL manda
    if not validas:
        raise ultimo_error or ValueError("No encuentro la hoja del cuadrante.")
    # Entre varias semanales, la que llega más tarde (la última, hasta hoy).
    nombre_hoja, ws, ws_f, fila_cab, col_nombre, col_orden, fechas_col = max(validas, key=lambda v: max(v[6].values()))
    rango = _rango_titulo(ws, fila_cab)
    # El título es el periodo autorizado. Algunas plantillas incluyen días
    # auxiliares del mes siguiente para completar la cuadrícula; no se importan.
    if rango[0] and rango[1]:
        fechas_col = {c: d for c, d in fechas_col.items() if rango[0] <= d <= rango[1]}
    orden_cols = sorted(fechas_col, key=lambda c: fechas_col[c])
    fechas = [fechas_col[c] for c in orden_cols]
    repetidas = [f for f, n in Counter(fechas).items() if n > 1]
    if repetidas:
        raise ValueError("Hay días repetidos en la cabecera: " + ", ".join(f.strftime("%d/%m") for f in repetidas))
    avisos = []
    huecos = [fechas[i] + dt.timedelta(days=1) for i in range(len(fechas) - 1)
              if fechas[i + 1] != fechas[i] + dt.timedelta(days=1)]
    if huecos:
        avisos.append("Faltan días en la hoja: " + ", ".join(f.strftime("%d/%m") for f in huecos[:10]))

    primera = orden_cols[0]
    if not rango[0] and not _fecha(ws.cell(fila_cab, primera).value) and not isinstance(ws_f.cell(fila_cab, primera).value, str):
        avisos.append("La hoja solo trae el número del día, sin mes: se ha puesto del %s al %s (contando hacia atrás desde hoy). "
                      "Compruébalo antes de guardar." % (fechas[0].strftime("%d/%m/%Y"), fechas[-1].strftime("%d/%m/%Y")))

    leyenda = _leyenda(ws_f)
    colores = dict(POR_DEFECTO)
    colores.update({k: v for k, v in leyenda.items() if v != "extra"})
    rosas = ROSAS | {k for k, v in leyenda.items() if v == "extra"}

    # ── Las personas y la fila de máximas ──
    filas: List[Dict[str, Any]] = []
    maximas: Dict[str, int] = {}
    codigos: Counter = Counter()
    en_personas = True
    for r in range(fila_cab + 1, ws.max_row + 1):
        nom = " ".join(str(ws.cell(r, col_nombre).value or "").split())
        clave = _n(nom)
        if not nom:
            continue
        if any(clave.startswith(p) for p in _PARADA):
            en_personas = False
            if clave.startswith("MAXIMA"):
                for c in orden_cols:
                    v = ws.cell(r, c).value
                    if isinstance(v, (int, float)) and not isinstance(v, bool) and 0 <= v <= 999:
                        maximas[fechas_col[c].isoformat()] = int(v)
            continue
        if not en_personas:
            continue
        color = _rgb(ws_f.cell(r, col_nombre))
        celdas: Dict[str, Dict[str, Any]] = {}
        for c in orden_cols:
            cod, hora = _codigo(ws.cell(r, c).value)
            if not cod:
                continue
            extra = cod == "1.EXTRA" or (cod == "1" and _rgb(ws_f.cell(r, c)) in rosas)
            celdas[fechas_col[c].isoformat()] = {"cod": cod, "hora": hora, "extra": extra}
            codigos[cod] += 1
        orden = ws.cell(r, col_orden).value if col_orden else None
        filas.append({"fila": r, "nombre": nom,
                      "orden": int(orden) if isinstance(orden, (int, float)) and not isinstance(orden, bool) else None,
                      "color": color, "tipo": colores.get(color, "normal"), "celdas": celdas})

    # ── Lo que se deduce de cada uno ──
    inicio = fechas[0]
    trabajo = {"1", "T", "X", "RA", "RIDE", "BKP", "S", "EXTRA"}
    for f in filas:
        cel = f["celdas"]
        # CUÁNDO EMPIEZA quien entra nuevo. En la hoja, antes de su primer día
        # hay N/T («no trabaja»), no huecos: Francisco Gil tenía N/T del 24-09
        # al 05-10 y empezaba el 06-10. Leídos como libres normales, el motor lo
        # ponía a trabajar el 1, 2, 3 y 4 (lo cazó la revisión de la propuesta).
        # Se toma como entrada el primer día de trabajo cuando antes solo hay
        # N/T y, o son 3 o más seguidos, o ese primer día es el de acompañante
        # (RA: así empiezan los nuevos).
        primero = next((d for d in fechas if d.isoformat() in cel and cel[d.isoformat()]["cod"] in trabajo), None)
        if primero and primero > inicio:
            previos = [cel[d.isoformat()]["cod"] for d in fechas if d < primero and d.isoformat() in cel]
            empieza_ra = cel[primero.isoformat()]["cod"] in ("RA", "RIDE")
            if previos and all(x in ("N/T", "L") for x in previos) and (len(previos) >= 3 or empieza_ra):
                f["alta_desde"] = primero.isoformat()
        if f["tipo"] == "sale":
            f["inactivo_desde"] = _primero_mes_siguiente(inicio).isoformat()
            f["tipo"] = "normal"
        if f["tipo"] == "empresa":
            # Su patrón, de lo que de verdad trabaja: José Jorge libra el
            # miércoles y trabaja el sábado; Benjamín, de martes a sábado.
            unos, libres = Counter(), Counter()
            for d, v in cel.items():
                wd = dt.date.fromisoformat(d).weekday()
                if v["cod"] == "1":
                    unos[wd] += 1
                elif v["cod"] in ("N/T", "L"):
                    libres[wd] += 1
            patron = sorted(wd for wd in range(7) if unos[wd] >= 2 and unos[wd] > libres[wd])
            if len(patron) == 5 and patron != [0, 1, 2, 3, 4]:
                f["patron"] = patron
        # Oficina: «S» en casi todo lo último que tiene puesto -> no entra en rutas.
        ultimos = [cel[d.isoformat()]["cod"] for d in fechas[-14:] if d.isoformat() in cel]
        if ultimos and sum(1 for x in ultimos if x == "S") >= 0.6 * len(ultimos):
            f["tipo"] = "inactivo"
            f["nota_import"] = "Oficina (S): no entra en rutas"
    return {"hoja": nombre_hoja, "fechas": [d.isoformat() for d in fechas],
            "periodo_desde": fechas[0].isoformat(), "periodo_hasta": fechas[-1].isoformat(), "filas": filas,
            "maximas": maximas, "codigos": dict(codigos.most_common()), "avisos": avisos,
            "leyenda": leyenda}


# ── «DEBER HORAS» ────────────────────────────────────────────────────────────
# La tercera hoja de su libro (30-09-2026): un registro de quién hizo horas o
# días de más y cómo se saldó. Una FECHA (celda con fecha, en azul) abre un
# bloque; debajo, un nombre por fila (B), a veces algo en C («2 dias
# 27-28/07», «llaves ribeira») y en D cómo se saldó («fichado 05/09», «reten
# 24/07»). Sin nada en D, sigue pendiente. Los nombres van como se escribieron
# («biri», «marcio 3h»): se guardan TAL CUAL; casarlos con una ficha a ojo
# sería inventarse a quién se le debe.

def _texto_celda(v) -> str:
    if v is None:
        return ""
    if isinstance(v, dt.datetime):
        v = v.date()
    if isinstance(v, dt.date):
        return v.strftime("%d/%m/%Y")
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return " ".join(str(v).split())


def leer_deber_horas(contenido: bytes) -> Dict[str, Any]:
    """Los bytes del .xlsx -> {hoja, filas: [{fila, fecha, persona, nota, saldado}]}.

    `fecha` es la del último bloque de fecha por encima ('' si la fila va antes
    de la primera fecha). Lanza ValueError si no hay hoja de «deber horas»."""
    import openpyxl
    try:
        wb = openpyxl.load_workbook(io.BytesIO(contenido), data_only=True)
    except Exception as e:                                        # noqa: BLE001
        raise ValueError("No se puede abrir el Excel: %s" % str(e)[:120])
    ws = next((w for w in wb.worksheets if "DEBER" in _n(w.title)), None)
    if ws is None:
        raise ValueError("Ese Excel no tiene la hoja «deber horas»")
    fecha, filas = "", []
    for r in range(1, ws.max_row + 1):
        b = ws.cell(r, 2).value
        if isinstance(b, (dt.datetime, dt.date)):
            fecha = (b.date() if isinstance(b, dt.datetime) else b).isoformat()
            continue
        persona = _texto_celda(b)
        if not persona or _n(persona) in ("DIAS", "DIA", "NOMBRE", "FECHA"):
            continue
        filas.append({"fila": r, "fecha": fecha, "persona": persona[:80],
                      "nota": _texto_celda(ws.cell(r, 3).value)[:200],
                      "saldado": _texto_celda(ws.cell(r, 4).value)[:120]})
    return {"hoja": ws.title, "filas": filas}
