# -*- coding: utf-8 -*-
"""Que el producto dé lo que promete /empresas (14-11-2026, CORRECCIONES-EMPRESAS-PRODUCTO).

· P1: «Origen de daños» es de Pro y una empresa nueva con Pro no lo tenía (solo nacía con él el sector de la flota
  de Dani). Ahora va en el estándar y en la mensajería; Esencial y Reparto lo siguen sin ver.
· P2: la ficha de la furgoneta solo podía ver sus 50 últimas revisiones. `GET /inspections/vehicle/{id}` acepta un
  cursor (`antes_de` + `antes_de_id`) y `primera=true` (la foto de entrada); sin nada, lo de antes.

Con la base de mentira (base_de_mentira.py): sin MongoDB.
"""
from datetime import datetime, timedelta, timezone

import pytest

import server
from base_de_mentira import Col, Db

ADMIN = {"sub": "a1", "name": "Oficina", "role": "admin", "account_type": "dsp"}


# ── P1: «Origen de daños» en una empresa nueva con Pro ──────────────────────

def test_empresa_nueva_estandar_con_pro_tiene_origen_de_danos():
    """Falla con el código de antes: MODULOS_ESTANDAR no lo llevaba."""
    assert "origen-danos" in server.org_modulos({"account_type": "dsp", "plan": "completo"})
    assert "origen-danos" in server.org_modulos({"account_type": "dsp", "modulos": "estandar", "plan": "completo"})
    # En la prueba, sin plan elegido todavía, se ve lo de Pro (como el resto de pantallas de Pro).
    assert "origen-danos" in server.org_modulos({"account_type": "dsp", "plan": None})


def test_con_esencial_o_reparto_no_lo_tiene():
    for plan in ("operacion", "basico", "reparto"):
        assert "origen-danos" not in server.org_modulos({"account_type": "dsp", "plan": plan})
        mensajeria = list(server.SECTORES_REGISTRO["mensajeria"])
        assert "origen-danos" not in server.org_modulos({"account_type": "dsp", "plan": plan, "modulos": mensajeria})


def test_mensajeria_con_pro_lo_tiene():
    """Falla con el código de antes: _MODULOS_MENSAJERIA no lo llevaba."""
    mensajeria = list(server.SECTORES_REGISTRO["mensajeria"])
    assert "origen-danos" in server.org_modulos({"account_type": "dsp", "plan": "completo", "modulos": mensajeria})


def test_una_empresa_con_su_lista_guardada_no_cambia():
    propia = ["dashboard", "vehiculos", "inspecciones", "chat", "configuracion"]
    vistos = server.org_modulos({"account_type": "dsp", "plan": "completo", "modulos": propia})
    assert vistos == [k for k in server._MODULOS_CLAVES if k in set(propia)]
    assert "origen-danos" not in vistos
    # Una lista vacía sigue siendo «solo lo fijo».
    assert server.org_modulos({"account_type": "dsp", "plan": "completo", "modulos": []}) == ["dashboard", "configuracion"]


def test_super_y_distribucion_no_cambian():
    """No se ha añadido a _MODULOS_REPARTO: nacen con el plan Reparto, que no abre lo de Pro."""
    assert "origen-danos" not in server.SECTORES_REGISTRO["supermercado"]
    assert "origen-danos" not in server.SECTORES_REGISTRO["distribucion"]


def test_el_catalogo_del_super_admin_lo_da_como_estandar():
    assert "origen-danos" in server.MODULOS_ESTANDAR
    assert "origen-danos" in server._MODULOS_CLAVES
    # Y no repetido en ninguna lista.
    assert len(server.MODULOS_ESTANDAR) == len(set(server.MODULOS_ESTANDAR))
    assert len(server._MODULOS_MENSAJERIA) == len(set(server._MODULOS_MENSAJERIA))


# ── P2: el historial entero de la furgoneta ────────────────────────────────

T0 = datetime(2025, 1, 1, 8, 0, tzinfo=timezone.utc)


def _insp(n, vid="v1", **extra):
    return {"id": "i%04d" % n, "vehicle_id": vid, "driver_id": "d1",
            "created_at": (T0 + timedelta(days=n)).isoformat(), "photos": ["f%d.jpg" % n], **extra}


@pytest.fixture
def base(monkeypatch):
    tenant = Db()
    docs = [_insp(n) for n in range(120)]
    # Dos revisiones en el MISMO instante (una importación): no se puede saltar ninguna.
    docs.append({**_insp(60), "id": "i0060b"})
    docs.append(_insp(500, deleted=True))           # borrada: no sale
    docs.append(_insp(7, vid="v2"))                 # de otra furgoneta: no sale
    tenant["inspections"] = Col(docs)
    tenant["drivers"] = Col([{"id": "d1", "name": "ANA"}])
    monkeypatch.setattr(server, "db", tenant)
    return tenant


def _todas_v1(base):
    vivas = [d for d in base["inspections"].docs if d["vehicle_id"] == "v1" and not d.get("deleted")]
    return [d["id"] for d in sorted(vivas, key=lambda d: (d["created_at"], d["id"]), reverse=True)]


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_parametros_es_lo_de_siempre(base):
    r = await server.get_vehicle_inspections("v1", user=ADMIN)
    assert isinstance(r, list) and len(r) == 50
    assert [i["id"] for i in r] == _todas_v1(base)[:50]
    assert r[0]["id"] == "i0119" and r[0]["driver_name"] == "ANA"


@pytest.mark.asyncio(loop_scope="session")
async def test_paginar_no_repite_ni_salta(base):
    """Falla con el código de antes: sin cursor, nunca se llegaba a la revisión 50 empezando por arriba."""
    vistas, tanda = [], await server.get_vehicle_inspections("v1", user=ADMIN)
    vistas += [i["id"] for i in tanda]
    # Entra una revisión nueva mientras se pagina: con un `skip` la siguiente tanda repetiría una.
    base["inspections"].docs.append(_insp(999))
    while len(tanda) == 50:
        ult = tanda[-1]
        tanda = await server.get_vehicle_inspections("v1", antes_de=ult["created_at"], antes_de_id=ult["id"],
                                                     user=ADMIN)
        vistas += [i["id"] for i in tanda]
    esperado = [x for x in _todas_v1(base) if x != "i0999"]
    assert vistas == esperado                    # en orden, sin repetir y sin saltar
    assert len(vistas) == len(set(vistas)) == 121
    assert "i0060" in vistas and "i0060b" in vistas


@pytest.mark.asyncio(loop_scope="session")
async def test_limite_con_tope(base):
    assert len(await server.get_vehicle_inspections("v1", limite=10, user=ADMIN)) == 10
    assert len(await server.get_vehicle_inspections("v1", limite=5000, user=ADMIN)) == 121   # tope 200
    assert len(await server.get_vehicle_inspections("v1", limite=-3, user=ADMIN)) == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_la_primera_revision(base):
    r = await server.get_vehicle_inspections("v1", primera=True, user=ADMIN)
    assert [i["id"] for i in r] == ["i0000"] and r[0]["driver_name"] == "ANA"
    # Una sin fecha no se toma por la primera.
    base["inspections"].docs.append({"id": "i-sin-fecha", "vehicle_id": "v1", "photos": []})
    assert [i["id"] for i in await server.get_vehicle_inspections("v1", primera=True, user=ADMIN)] == ["i0000"]
    # Furgoneta sin revisiones: lista vacía, no un error.
    assert await server.get_vehicle_inspections("v9", primera=True, user=ADMIN) == []
