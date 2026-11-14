# -*- coding: utf-8 -*-
"""Una empresa NUEVA no tropieza (14-11-2026).

El código por correo del conductor (/auth/driver-lookup y /auth/driver-code/verify) cargaba las empresas con
`to_list(500)` y sin orden: al pasar de 500 (cada autónomo que se da de alta crea una), la que quedase fuera —la más
nueva— dejaba a sus conductores sin código y sin poder verificarlo, sin ningún error. Aquí, con la base de mentira (que
devuelve en orden de alta, así que el tope dejaba fuera justo a las últimas)."""
import re
from types import SimpleNamespace

import pytest

import server
from base_de_mentira import Col, Db

PETICION = SimpleNamespace(headers={}, client=SimpleNamespace(host="10.0.0.1"))


class _Cliente(dict):
    """`client[nombre]` de Motor: una base de mentira por nombre."""
    def __missing__(self, nombre):
        self[nombre] = Db()
        return self[nombre]


class _ColConId(Col):
    """Como Mongo, `insert_one` pone `_id` (la base de mentira no lo hace y el código se borra por `_id`)."""
    async def insert_one(self, doc):
        doc = {"_id": f"id{len(self.docs)}", **doc}
        self.docs.append(doc)
        return SimpleNamespace(inserted_id=doc["_id"])


def _montar(monkeypatch, n_empresas, conductor_en, slug_conductor=None):
    """`n_empresas` en prueba; el conductor, en la de índice `conductor_en`. Devuelve los correos enviados."""
    orgs = [{"id": f"o{i}", "slug": f"empresa-{i}", "name": f"Empresa {i}", "account_type": "dsp",
             "status": "trial", "db_name": f"dsp_o{i}"} for i in range(n_empresas)]
    if slug_conductor:
        orgs[conductor_en]["slug"] = slug_conductor
    g = Db()
    g["organizations"] = Col(orgs)
    cli = _Cliente()
    cli[f"dsp_o{conductor_en}"]["drivers"] = Col([{"id": "d1", "name": "Ana", "email": "ana@correo.es",
                                                  "center": "NORTE", "active": True, "created_at": "2026-11-14"}])
    cli[f"dsp_o{conductor_en}"]["driver_login_codes"] = _ColConId()
    enviados = []

    async def _enviar(destino, asunto, html, texto=None, **_):
        enviados.append({"a": destino, "texto": texto or html})
        return True

    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "client", cli)
    monkeypatch.setattr(server, "_enviar_email", _enviar)
    monkeypatch.setattr(server, "_rl_public_action", lambda *a, **k: None)
    return cli, enviados


async def _pedir_y_verificar(enviados, slug=""):
    r = await server.driver_lookup({"email": "Ana@Correo.es", "slug": slug}, PETICION)
    # No revela si hay ficha ni de qué empresa: el mismo mensaje siempre.
    assert r == {"message": "Si el correo está habilitado para el portal, recibirás un código de acceso en unos minutos."}
    assert len(enviados) == 1 and enviados[0]["a"] == "ana@correo.es", "el código no se envió"
    codigo = re.search(r"\b(\d{6})\b", enviados[0]["texto"]).group(1)
    return await server.driver_code_verify({"email": "ana@correo.es", "code": codigo, "slug": slug}, PETICION)


@pytest.mark.asyncio(loop_scope="session")
async def test_con_620_empresas_el_conductor_de_la_ultima_recibe_y_verifica_su_codigo(monkeypatch):
    cli, enviados = _montar(monkeypatch, 620, 619)
    r = await _pedir_y_verificar(enviados)
    assert r["role"] == "driver" and r["id"] == "d1" and r["access_token"]
    # El código se guardó en la base de SU empresa y se consumió al entrar.
    assert cli["dsp_o619"]["driver_login_codes"].docs == []


@pytest.mark.asyncio(loop_scope="session")
async def test_con_620_empresas_y_el_slug_de_la_ultima_tambien(monkeypatch):
    _, enviados = _montar(monkeypatch, 620, 619)
    r = await _pedir_y_verificar(enviados, slug="empresa-619")
    assert r["id"] == "d1"


@pytest.mark.asyncio(loop_scope="session")
async def test_pocas_empresas_sin_slug_y_con_slug_sigue_igual(monkeypatch):
    _, enviados = _montar(monkeypatch, 3, 1)
    assert (await _pedir_y_verificar(enviados))["id"] == "d1"
    _, enviados = _montar(monkeypatch, 3, 1)
    assert (await _pedir_y_verificar(enviados, slug="empresa-1"))["id"] == "d1"


@pytest.mark.asyncio(loop_scope="session")
async def test_con_el_slug_de_otra_empresa_el_codigo_no_vale(monkeypatch):
    """Lo de siempre: al verificar, el slug manda; un código de una empresa no abre otra."""
    _, enviados = _montar(monkeypatch, 3, 1)
    await server.driver_lookup({"email": "ana@correo.es"}, PETICION)
    codigo = re.search(r"\b(\d{6})\b", enviados[0]["texto"]).group(1)
    with pytest.raises(server.HTTPException) as e:
        await server.driver_code_verify({"email": "ana@correo.es", "code": codigo, "slug": "empresa-2"}, PETICION)
    assert e.value.status_code == 401


@pytest.mark.asyncio(loop_scope="session")
async def test_un_correo_sin_ficha_no_recibe_nada_y_la_respuesta_es_la_misma(monkeypatch):
    _, enviados = _montar(monkeypatch, 620, 619)
    r = await server.driver_lookup({"email": "nadie@correo.es"}, PETICION)
    assert r["message"].startswith("Si el correo está habilitado") and enviados == []


@pytest.mark.asyncio(loop_scope="session")
async def test_con_620_empresas_el_conductor_de_la_ultima_entra_con_su_contrasena(monkeypatch):
    """/auth/driver-login sin slug tenía el mismo `to_list(500)`: con la contraseña buena, «incorrectos»."""
    cli, _ = _montar(monkeypatch, 620, 619)
    cli["dsp_o619"]["driver_accounts"] = Col([{"driver_id": "d1", "email": "ana@correo.es", "active": True,
                                              "hashed_password": server.hash_password("clave-de-ana"),
                                              "password_changed_at": "2026-11-14"}])
    r = await server.driver_login(server.DriverLoginRequest(email="Ana@Correo.es", password="clave-de-ana"), PETICION)
    assert r.id == "d1" and r.role == "driver" and r.access_token
