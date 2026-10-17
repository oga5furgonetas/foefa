# -*- coding: utf-8 -*-
"""Opinión de quien ya usa la app (05-10-2026): se pregunta una vez, solo a quien
la ha usado de verdad (entregas reales, más de 20 h de cuenta), y queda guardada."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import ciclo_correos
import server
from base_de_mentira import Col, Db

YO = {"sub": "a1", "role": "admin", "name": "Pepe", "org_id": "o1", "db_name": "dsp_o1", "email": "pepe@x.es"}


def _iso(dias):
    return (datetime.now(timezone.utc) + timedelta(days=dias)).isoformat()


@pytest.fixture
def mundo(monkeypatch):
    g = Db()
    g["organizations"] = Col([{"id": "o1", "name": "Pepe", "account_type": "dsp", "db_name": "dsp_o1", "status": "trial",
                               "plan": "autonomo", "sector": "autonomo", "email": "pepe@x.es", "created_at": _iso(-2)}])
    g["opiniones_repartidores"] = Col([])
    g["correos_enviados"] = Col([])
    t = Db()
    t["reparto_pedidos"] = Col([])
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "db", t)
    avisos, uso = [], {"paradas": 0, "entregadas": 0}

    async def org(_id):
        return await g.organizations.find_one({"id": _id}, {"_id": 0})

    async def enviar(to, subject, html, responder_a="", copia=None, texto="", cabeceras=None):
        avisos.append(SimpleNamespace(to=to, subject=subject, responder_a=responder_a, texto=texto))
        return True

    async def ciclo_uso(_org):
        return dict(uso)
    monkeypatch.setattr(server, "get_org", org)
    monkeypatch.setattr(server, "_enviar_email", enviar)
    monkeypatch.setattr(server, "_ciclo_uso", ciclo_uso)
    monkeypatch.setattr(server, "CORREO_CONTACTO", "contacto@x.es")
    monkeypatch.setattr(server, "SECRET_KEY", "secreto-de-prueba")
    return SimpleNamespace(g=g, t=t, avisos=avisos, uso=uso)


def _entregas(mundo, n, ejemplo=False):
    for _ in range(n):
        mundo.t["reparto_pedidos"].docs.append({"id": f"p{len(mundo.t['reparto_pedidos'].docs)}", "estado": "entregado",
                                                **({"ejemplo": True} if ejemplo else {})})


@pytest.mark.asyncio(loop_scope="session")
async def test_solo_se_pregunta_a_quien_la_usa_de_verdad(mundo):
    assert (await server.opinion_estado(YO))["pedir"] is False            # sin entregas
    _entregas(mundo, 5, ejemplo=True)
    assert (await server.opinion_estado(YO))["pedir"] is False            # las de ejemplo no cuentan
    _entregas(mundo, 2)
    assert (await server.opinion_estado(YO))["pedir"] is True
    mundo.g["organizations"].docs[0]["created_at"] = _iso(0)              # cuenta de hoy mismo
    assert (await server.opinion_estado(YO))["pedir"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_se_guarda_y_no_se_vuelve_a_preguntar(mundo):
    _entregas(mundo, 3)
    assert (await server.opinion_estado(YO))["pedir"] is True
    await server.opinion_enviar({"valor": 4, "texto": "  Me falta poder importar un Excel  "}, YO)
    d = mundo.g["opiniones_repartidores"].docs[0]
    assert d["valor"] == 4 and d["texto"] == "Me falta poder importar un Excel" and d["entregas"] == 3 and d["org_id"] == "o1"
    assert (await server.opinion_estado(YO))["pedir"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_saltar_no_guarda_nada_y_no_insiste(mundo):
    _entregas(mundo, 3)
    await server.opinion_enviar({"saltar": True}, YO)
    assert mundo.g["opiniones_repartidores"].docs == []
    assert (await server.opinion_estado(YO))["pedir"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_cada_opinion_le_llega_a_dani_y_responder_va_a_quien_la_dio(mundo):
    """17-10-2026: las opiniones se guardaban y nadie las leía."""
    _entregas(mundo, 3)
    await server.opinion_enviar({"valor": 2, "texto": "Se me cierra al hacer la foto"}, YO)
    a = mundo.avisos[-1]
    assert a.to == "contacto@x.es" and a.responder_a == "pepe@x.es"
    assert "★★☆☆☆" in a.subject and "Pepe" in a.subject
    assert "Se me cierra al hacer la foto" in a.texto and "3 paradas y 3 entregas" in a.texto and "desde la app" in a.texto
    assert mundo.g["correos_enviados"].docs[-1]["por"] == "aviso:opinion"


@pytest.mark.asyncio(loop_scope="session")
async def test_una_idea_se_puede_mandar_siempre(mundo):
    mundo.g["organizations"].docs[0]["opinion_dada"] = True
    await server.opinion_enviar({"tipo": "sugerencia", "texto": "Que lea los códigos de barras"}, YO)
    d = mundo.g["opiniones_repartidores"].docs[-1]
    assert d["tipo"] == "sugerencia" and d["origen"] == "app" and d["texto"] == "Que lea los códigos de barras"
    assert "idea" in mundo.avisos[-1].subject


def _del_enlace(org_id="o1"):
    from urllib.parse import parse_qs, urlparse
    q = parse_qs(urlparse(server._opinion_url(org_id)).query)
    return q["o"][0], q["t"][0]


@pytest.mark.asyncio(loop_scope="session")
async def test_el_enlace_del_correo_se_contesta_sin_entrar(mundo):
    o, t = _del_enlace()
    assert await server.opinion_correo_estado(o, t) == {"usa": False, "ya": False}
    mundo.uso.update(paradas=4, entregadas=2)
    assert (await server.opinion_correo_estado(o, t))["usa"] is True
    mundo.uso.update(paradas=0, entregadas=0)
    await server.opinion_correo_enviar({"o": o, "t": t, "motivo": "no_supe", "texto": "No encontraba el botón"})
    d = mundo.g["opiniones_repartidores"].docs[-1]
    assert d["origen"] == "correo" and d["motivo"] == "no_supe" and d["valor"] is None
    assert mundo.g["organizations"].docs[0]["opinion_dada"] is True
    assert (await server.opinion_correo_estado(o, t))["ya"] is True
    assert "No supe cómo meter los paquetes" in mundo.avisos[-1].subject
    assert "contestando al correo" in mundo.avisos[-1].texto


@pytest.mark.asyncio(loop_scope="session")
async def test_el_enlace_solo_vale_para_su_cuenta(mundo):
    o, t = _del_enlace()
    for mal in [(o, "x" * 24), ("o2", t), ("", t), (o, "")]:
        with pytest.raises(HTTPException) as e:
            await server.opinion_correo_estado(*mal)
        assert e.value.status_code == 404
    with pytest.raises(HTTPException) as e:
        await server.opinion_correo_enviar({"o": o, "t": t, "motivo": "inventado", "valor": 7})
    assert e.value.status_code == 400 and mundo.g["opiniones_repartidores"].docs == []


@pytest.mark.asyncio(loop_scope="session")
async def test_no_es_un_buzon_sin_fondo(mundo):
    o, t = _del_enlace()
    for i in range(server._OPINION_TOPE_DIA):
        await server.opinion_correo_enviar({"o": o, "t": t, "valor": 5, "texto": f"vale {i}"})
    with pytest.raises(HTTPException) as e:
        await server.opinion_correo_enviar({"o": o, "t": t, "valor": 5})
    assert e.value.status_code == 429


@pytest.mark.asyncio(loop_scope="session")
async def test_negocio_ve_todas_con_su_resumen(mundo):
    o, t = _del_enlace()
    await server.opinion_correo_enviar({"o": o, "t": t, "valor": 4})
    await server.opinion_correo_enviar({"o": o, "t": t, "motivo": "no_ruta"})
    await server.opinion_correo_enviar({"o": o, "t": t, "valor": 2, "texto": "Lenta"})
    r = await server.admin_opiniones({})
    assert r["resumen"]["total"] == 3 and r["resumen"]["media"] == 3.0 and r["resumen"]["con_texto"] == 1
    assert r["resumen"]["motivos"] == [{"motivo": "no_ruta", "texto": "Todavía no he tenido reparto", "n": 1}]
    assert r["opiniones"][0]["ts"] >= r["opiniones"][-1]["ts"]


def test_los_motivos_son_los_del_correo():
    assert set(server._OPINION_MOTIVOS) == set(ciclo_correos.MOTIVOS)


@pytest.mark.asyncio(loop_scope="session")
async def test_vacio_o_demo_se_rechaza(mundo):
    with pytest.raises(HTTPException) as e:
        await server.opinion_enviar({"texto": "   ", "valor": 9}, YO)
    assert e.value.status_code == 400
    with pytest.raises(HTTPException) as e2:
        await server.opinion_enviar({"texto": "hola"}, {**YO, "demo": True})
    assert e2.value.status_code == 403
    assert (await server.opinion_estado({**YO, "demo": True}))["pedir"] is False
