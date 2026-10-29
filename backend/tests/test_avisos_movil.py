# -*- coding: utf-8 -*-
"""AVISOS AL MÓVIL (29-10-2026). Dani: «si le apruebo días a alguien que tiene la app, que le salte la notificación;
y si hay un día que puedan solicitar trabajar». Lo que se vigila: que cada aviso se guarde en la bandeja de la
persona (la app nativa la lee: hasta hoy solo salía web push, que la app de Play no recibe); que cada uno vea solo
lo suyo y lo marque leído; que el móvil se apunte con o sin token de FCM y se borre al cerrar sesión; y que el aviso
de la mañana cuente a quien tiene la app aunque no tenga web push. Sin Mongo: base de mentira."""
import pytest

import server
from base_de_mentira import Col, Db

D1 = {"sub": "d1", "role": "driver", "org_id": "o1", "db_name": "dsp_o1"}
D2 = {"sub": "d2", "role": "driver", "org_id": "o1", "db_name": "dsp_o1"}


@pytest.fixture
def bases(monkeypatch):
    t = Db()
    g = Db()
    monkeypatch.setattr(server, "db", t)
    monkeypatch.setattr(server, "global_db", g)
    enviados = []

    async def push(ids, titulo, cuerpo, url="/panel"):
        enviados.append((sorted(ids), titulo, url))
    monkeypatch.setattr(server, "send_web_push_to_users", push)
    monkeypatch.delenv("FCM_SERVICE_ACCOUNT_JSON", raising=False)
    server._FCM_CRED.clear()
    return t, g, enviados


@pytest.mark.asyncio(loop_scope="session")
async def test_el_aviso_va_a_la_bandeja_y_al_web_push(bases):
    t, _g, enviados = bases
    n = await server._avisar_usuarios(["d1", "d1", "d2", None], "Tu petición del 2026-11-03: aprobada",
                                      "Ya puedes verlo en tus turnos.", "/conductor")
    assert n == 2
    docs = await t["avisos_movil"].find({}, {"_id": 0}).to_list(10)
    assert sorted(d["user_id"] for d in docs) == ["d1", "d2"]
    assert all(d["id"] and d["leido_en"] is None and d["url"] == "/conductor" and d["creado_en"] for d in docs)
    # El web push sigue saliendo (la web), una vez por persona.
    assert enviados == [(["d1", "d2"], "Tu petición del 2026-11-03: aprobada", "/conductor")]
    # Sin nadie, nada.
    assert await server._avisar_usuarios([], "x", "y") == 0


@pytest.mark.asyncio(loop_scope="session")
async def test_la_app_lee_su_bandeja_y_marca_leido(bases):
    t, _g, _ = bases
    await server._avisar_usuarios(["d1"], "Uno", "a", "/conductor")
    await server._avisar_usuarios(["d2"], "De otro", "b", "/conductor")
    r = await server.avisos_mios(None, D1)
    assert [a["titulo"] for a in r["avisos"]] == ["Uno"] and r["sin_leer"] == 1
    # `desde`: solo lo posterior a esa fecha (la app guarda la del último que enseñó).
    r2 = await server.avisos_mios(r["avisos"][0]["creado_en"], D1)
    assert r2["avisos"] == [] and r2["sin_leer"] == 1
    # Leído: deja de contar. Lo de otra persona no se toca.
    assert (await server.avisos_leidos({"ids": [r["avisos"][0]["id"]]}, D1))["ok"]
    assert (await server.avisos_mios(None, D1))["sin_leer"] == 0
    assert (await server.avisos_mios(None, D2))["sin_leer"] == 1
    # Sin ids: todo lo de la persona.
    await server._avisar_usuarios(["d2"], "Dos", "c")
    assert (await server.avisos_mios(None, D2))["sin_leer"] == 2
    assert (await server.avisos_leidos({}, D2))["leidos"] == 2
    assert (await server.avisos_mios(None, D2))["sin_leer"] == 0


@pytest.mark.asyncio(loop_scope="session")
async def test_la_bandeja_se_ordena_de_nuevo_a_viejo_y_corta_en_50(bases):
    t, _g, _ = bases
    t["avisos_movil"] = Col([{"id": f"a{i}", "user_id": "d1", "titulo": f"T{i}", "cuerpo": "", "url": "/conductor",
                              "creado_en": f"2026-10-29T10:{i:02d}:00+00:00", "leido_en": None} for i in range(60)])
    r = await server.avisos_mios(None, D1)
    assert len(r["avisos"]) == 50 and r["avisos"][0]["id"] == "a59" and r["sin_leer"] == 60


@pytest.mark.asyncio(loop_scope="session")
async def test_el_movil_se_apunta_con_o_sin_token_y_se_borra_al_salir(bases):
    _t, g, _ = bases
    r = await server.push_fcm_token({"token": "", "plataforma": "android", "app": "2.3.0"}, D1)
    assert r == {"ok": True, "fcm": False}
    assert await g["push_tokens"].count_documents({"user_id": "d1", "token": None}) == 1
    # Otra vez sin token: el mismo registro, no dos.
    await server.push_fcm_token({"token": "", "app": "2.3.1"}, D1)
    assert await g["push_tokens"].count_documents({"user_id": "d1"}) == 1
    assert (await g["push_tokens"].find_one({"user_id": "d1"}))["app"] == "2.3.1"
    # Con token de FCM: aparte, y el mismo token dos veces es uno.
    await server.push_fcm_token({"token": "tok-1"}, D1)
    await server.push_fcm_token({"token": "tok-1"}, D1)
    assert await g["push_tokens"].count_documents({"user_id": "d1"}) == 2
    assert (await g["push_tokens"].find_one({"token": "tok-1"}))["org_id"] == "o1"
    # Al cerrar sesión, fuera todo lo de esa persona; lo de otra, no.
    await server.push_fcm_token({"token": "tok-2"}, D2)
    await server.push_fcm_token_quitar({}, D1)
    assert await g["push_tokens"].count_documents({"user_id": "d1"}) == 0
    assert await g["push_tokens"].count_documents({"user_id": "d2"}) == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_fcm_configurado_no_se_manda_nada_por_fcm(bases):
    _t, g, _ = bases
    await server.push_fcm_token({"token": "tok-1"}, D1)
    assert not server._fcm_configurado()
    assert await server._fcm_enviar([{"id": "a", "user_id": "d1", "titulo": "t", "cuerpo": "c", "url": "/conductor",
                                      "creado_en": "2026-10-29T10:00:00+00:00"}]) == 0
    # Con FCM configurado, un token que Google ya no reconoce (404) se borra; uno que acepta cuenta como enviado.
    monkeypatch_env = {"FCM_SERVICE_ACCOUNT_JSON": '{"project_id": "fds-prueba"}'}
    import os
    os.environ.update(monkeypatch_env)
    try:
        codigos = {"tok-1": 404, "tok-3": 200}

        async def falso(token, datos):
            assert set(datos) == {"id", "titulo", "cuerpo", "url", "creado_en"}
            return codigos[token]
        import pytest as _pt
        mp = _pt.MonkeyPatch()
        mp.setattr(server, "_fcm_enviar_token", falso)
        try:
            await server.push_fcm_token({"token": "tok-3"}, D1)
            docs = [{"id": "a", "user_id": "d1", "titulo": "t", "cuerpo": "c", "url": "/conductor", "creado_en": "x"}]
            assert await server._fcm_enviar(docs) == 1
            assert await g["push_tokens"].count_documents({"token": "tok-1"}) == 0
            assert await g["push_tokens"].count_documents({"token": "tok-3"}) == 1
        finally:
            mp.undo()
    finally:
        os.environ.pop("FCM_SERVICE_ACCOUNT_JSON", None)
        server._FCM_CRED.clear()


@pytest.mark.asyncio(loop_scope="session")
async def test_el_aviso_de_la_manana_cuenta_a_quien_tiene_la_app_sin_web_push(bases, monkeypatch):
    """Sin web push configurado y sin móviles apuntados no se hace nada; con un móvil apuntado, sí se mira."""
    _t, g, _ = bases
    monkeypatch.setattr(server, "_push_enabled", False)
    assert await server._aviso_manana_vuelta() == 0
    await server.push_fcm_token({"token": ""}, {"sub": "u1", "role": "admin", "org_id": "o1", "db_name": "dsp_o1"})
    # Hay un móvil: la vuelta mira las empresas con la app (ninguna es autónoma aquí, así que manda 0, sin fallar).
    assert await server._aviso_manana_vuelta() == 0
    assert await g["push_tokens"].distinct("org_id") == ["o1"]
