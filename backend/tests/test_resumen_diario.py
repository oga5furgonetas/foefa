# -*- coding: utf-8 -*-
"""El resumen del día a cada destinatario de su centro (06-11-2026). El bucle de las 21:00 moría cada noche con
KeyError 'entrega' («Bucle de aviso resumen_diario: 'entrega'» en el registro del 03-11): el resumen de un centro
(resumen_dia_centro) dejó de traer «entrega» el 25-09 (era la parte de Amazon) y lo que se devolvía al panel la seguía
pidiendo, después de mandar los correos del primer centro: los demás centros se quedaban sin resumen y el botón de
probar del panel daba error. Sin Mongo: base de mentira."""
import pytest

import server
from base_de_mentira import Col, Db


@pytest.fixture
def base(monkeypatch):
    tenant = Db()
    tenant["aviso_destinatarios"] = Col([
        {"id": "a1", "nombre": "Judyt", "email": "judyt@empresa.es", "centers": ["OGA5", "DGA1"],
         "avisos": ["resumen_diario"], "activo": True},
        {"id": "a2", "nombre": "Sin correo", "centers": ["OGA5"], "avisos": ["resumen_diario"], "activo": True},
    ])
    monkeypatch.setattr(server, "db", tenant)
    correos, grupo = [], []

    async def enviar(to, subject, html, **kw):
        correos.append((to, subject))
        return True
    monkeypatch.setattr(server, "_enviar_email", enviar)

    async def telegram(texto, *a, **kw):
        grupo.append(texto)
    monkeypatch.setattr(server, "_telegram_aviso", telegram)

    async def sin_whatsapp(_db, _que):
        return False
    monkeypatch.setattr(server.whatsapp, "puede_avisar", sin_whatsapp)
    tenant.correos, tenant.grupo = correos, grupo
    return tenant


@pytest.mark.asyncio(loop_scope="session")
async def test_el_resumen_llega_a_todos_los_centros_y_lo_que_vuelve_al_panel_existe(base):
    salida = await server.enviar_resumen_diario("2026-11-03")
    assert [s["center"] for s in salida] == ["DGA1", "OGA5"]          # los dos, no solo el primero
    assert base.correos == [("judyt@empresa.es", "DGA1 — 03/11/2026 · sin vehículos activos revisados"),
                            ("judyt@empresa.es", "OGA5 — 03/11/2026 · sin vehículos activos revisados")]
    assert len(base.grupo) == 2
    for s in salida:
        assert "entrega" not in s
        assert s["inspecciones"] == "sin vehículos activos" and s["golpes"] == "ninguno" and s["checklist"] == "sin checklist"
        assert s["correos"] == ["judyt@empresa.es"]
    assert salida[1]["destinatarios"] == ["Judyt", "Sin correo"]


@pytest.mark.asyncio(loop_scope="session")
async def test_la_prueba_a_una_persona_va_solo_a_ella_y_no_al_grupo(base):
    salida = await server.enviar_resumen_diario("2026-11-03", solo_id="a1")
    assert [s["center"] for s in salida] == ["DGA1", "OGA5"]
    assert base.grupo == [] and [c[0] for c in base.correos] == ["judyt@empresa.es"] * 2
