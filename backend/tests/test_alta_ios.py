# -*- coding: utf-8 -*-
"""El alta desde la app del iPhone (09-11-2026, rechazo de Apple 2.1(b) y 3.1.1): la cuenta se crea igual, pero no recibe NINGÚN
correo con plan, prueba gratuita, precios, bono o «Invita y gana» (ni la bienvenida, ni los del ciclo, ni la campaña del bono), y a
su aviso de la mañana no se le pone la frase del bono. En la web y en Android el alta es la de siempre: lo prueba cada caso con su
control. El campo `desde_ios` lo manda la web solo dentro de la app del iPhone y un servidor sin él lo ignora. Sin Mongo: base de mentira."""
import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import httpx
import pytest

import ciclo_correos
import server
from base_de_mentira import Col, Db

AHORA = datetime(2026, 11, 2, 11, 0, tzinfo=timezone.utc)       # lunes, 12:00 en Madrid
# Una llamada de la web (en la app del iPhone la web va dentro de la app): lo que importa es el cuerpo del alta.
REQ = SimpleNamespace(headers={"user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148"},
                      client=SimpleNamespace(host="198.51.100.7"))


def _alta(**kw):
    """Los datos de un alta de prueba de quien reparte solo (con la contraseña de mentira de siempre)."""
    base = dict(sector="autonomo", plan="autonomo")
    base.update(kw)
    return server.RegisterRequest(password="12345678", **base)


async def _nada(*a, **k):
    return None


async def _dejar_correr():
    """Deja terminar las tareas que el alta lanza en segundo plano (la bienvenida del ciclo)."""
    for _ in range(5):
        await asyncio.sleep(0)
    await asyncio.sleep(0.02)


@pytest.fixture
def mundo(monkeypatch):
    bases = {}

    class Cliente(dict):
        def __getitem__(self, nombre):
            return bases.setdefault(nombre, Db())

    g = Db()
    for col in ("organizations", "admin_users", "correos_enviados", "pases_movil", "push_subscriptions", "push_tokens"):
        g[col] = Col([])
    monkeypatch.setattr(server, "client", Cliente())
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "_ensure_tenant_indexes", _nada)
    monkeypatch.setattr(server, "_meta_enviar", lambda *a, **k: None)
    server._public_actions.clear()
    monkeypatch.delenv("FCM_SERVICE_ACCOUNT_JSON", raising=False)
    server._FCM_CRED.clear()
    # Con la clave de correo puesta, el alta intenta mandar su bienvenida: lo que se prueba es QUÉ sale.
    monkeypatch.setenv("RESEND_API_KEY", "re_de_mentira")
    monkeypatch.setenv("EMAIL_FROM", "FDS <contacto@flotadsp.com>")
    monkeypatch.setattr(server, "_email_proveedores", lambda: ["brevo"])
    monkeypatch.setattr(server, "_rep_promo_activa", lambda: True)
    monkeypatch.setattr(server, "REP_GRATIS_HASTA", "2026-12-31")
    monkeypatch.setattr(server, "_PORTAL_BASE_FRONT", "https://flotadsp.com")
    enviados, resend, pushes = [], [], []

    async def enviar(to, subject, html, responder_a="", copia=None, texto="", cabeceras=None, solo=""):
        enviados.append({"para": to, "asunto": subject, "texto": texto, "html": html})
        return True
    monkeypatch.setattr(server, "_enviar_email", enviar)

    class ClienteHttp:                                  # la bienvenida «genérica» (la de las empresas) va directa a Resend
        def __init__(self, *a, **k):
            pass

        async def post(self, url, headers=None, json=None, timeout=None):
            resend.append({"url": url, "json": json})
            return SimpleNamespace(status_code=200)
    monkeypatch.setattr(httpx, "AsyncClient", ClienteHttp)

    async def push(usuarios, titulo, cuerpo, url="/panel"):
        pushes.append(SimpleNamespace(usuarios=list(usuarios), titulo=titulo, cuerpo=cuerpo, url=url))
    monkeypatch.setattr(server, "send_web_push_to_users", push)
    monkeypatch.setattr(server, "_push_enabled", True)
    return SimpleNamespace(g=g, enviados=enviados, resend=resend, pushes=pushes)


async def _dar_de_alta(mundo, usuario, **kw):
    server._public_actions.clear()
    r = await server.register_dsp(_alta(org_name=usuario.split("@")[0].title() + " Reparte", username=usuario, slug=usuario.split("@")[0] + "-1234",
                                        email=usuario, **kw), REQ)
    await _dejar_correr()
    return r, await mundo.g["organizations"].find_one({"slug": usuario.split("@")[0] + "-1234"})


# ── EL ALTA ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_el_alta_desde_el_iphone_queda_sin_correos_y_no_manda_ni_la_bienvenida(mundo):
    r, ana = await _dar_de_alta(mundo, "ana@x.es", desde_ios=True)
    assert ana["alta_ios"] is True and ana["correos_baja"] is True and ana["correos_baja_motivo"] == "alta_ios"
    assert ana["correos_baja_at"] == ana["created_at"]
    # La cuenta es la de siempre (prueba, plan, sesión): solo cambian los correos.
    assert ana["status"] == "trial" and ana["plan"] == "autonomo" and ana["sector"] == "autonomo" and r.access_token
    assert not ciclo_correos.es_candidata(ana)
    # Ni la bienvenida del ciclo («Tu cuenta de FDS está lista…», con «Es gratis y sin límite hasta…») ni la genérica («Tu prueba gratuita…»).
    assert mundo.enviados == [] and mundo.resend == []
    assert await server._ciclo_enviar(ana["id"], "bienvenida") is False and mundo.enviados == []


@pytest.mark.asyncio(loop_scope="session")
async def test_el_alta_desde_el_iphone_de_cualquier_tipo_no_manda_la_bienvenida_generica(mundo):
    """La web de la app solo manda «autonomo», pero el servidor no se fía: con `desde_ios` no sale la que habla de la prueba gratuita."""
    _, pepe = await _dar_de_alta(mundo, "pepe@x.es", desde_ios=True, sector="paqueteria", plan="pro")
    assert pepe["alta_ios"] is True and pepe["correos_baja"] is True
    assert mundo.resend == [] and mundo.enviados == []


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("desde_ios", [None, False])
async def test_el_alta_sin_desde_ios_sigue_igual_con_la_bienvenida_del_ciclo(mundo, desde_ios):
    r, luis = await _dar_de_alta(mundo, "luis@x.es", desde_ios=desde_ios)
    assert "alta_ios" not in luis and "correos_baja" not in luis and "correos_baja_at" not in luis and "correos_baja_motivo" not in luis
    assert ciclo_correos.es_candidata(luis) and r.access_token
    assert [e["para"] for e in mundo.enviados] == ["luis@x.es"] and mundo.resend == []
    assert mundo.enviados[0]["asunto"] == "Tu cuenta de FDS está lista: así cargas tu primera ruta"
    assert "gratis" in mundo.enviados[0]["texto"].lower()          # lo que dice (plan, promoción) a quien no viene del iPhone
    assert luis["ciclo_correos"]["bienvenida"]["ok"] is True


@pytest.mark.asyncio(loop_scope="session")
async def test_la_empresa_que_se_da_de_alta_fuera_del_iphone_sigue_con_su_bienvenida_generica(mundo):
    _, empresa = await _dar_de_alta(mundo, "paquetes@x.es", sector="paqueteria", plan="pro")
    assert "alta_ios" not in empresa and "correos_baja" not in empresa
    assert mundo.enviados == []
    assert len(mundo.resend) == 1 and mundo.resend[0]["url"] == "https://api.resend.com/emails"
    assert mundo.resend[0]["json"]["to"] == ["paquetes@x.es"] and mundo.resend[0]["json"]["subject"] == "Tu cuenta de FDS está lista"
    assert "con el plan Pro y 14 días de prueba" in mundo.resend[0]["json"]["text"]


def test_el_servidor_acepta_desde_ios_y_se_traga_los_campos_que_no_conoce():
    """Un build del iPhone puede salir antes que el servidor: lo que no se conoce se ignora, no rompe el alta."""
    assert server.RegisterRequest.model_config.get("extra") != "forbid"
    nuevo = server.RegisterRequest.model_validate({"org_name": "Ana", "username": "ana", "password": "12345678", "desde_ios": True})
    assert nuevo.desde_ios is True
    futuro = server.RegisterRequest.model_validate({"org_name": "Ana", "username": "ana", "password": "12345678", "desde_ios": True,
                                                    "un_campo_de_un_build_futuro": 1})
    assert futuro.desde_ios is True and not hasattr(futuro, "un_campo_de_un_build_futuro")
    assert _alta(org_name="Ana", username="ana").desde_ios is None        # web y Android: no lo mandan


# ── NINGUNA OTRA VÍA ──────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_ninguna_otra_via_le_manda_correos_a_la_cuenta_del_iphone(mundo, monkeypatch):
    """Los correos que salen después del alta (el ciclo entero, el del primer día y la campaña del bono de 25 €) saltan a la cuenta
    de la web (el control) y NO a la del iPhone, a ninguna hora ni edad."""
    monkeypatch.setenv("CICLO_CORREOS", "1")                      # el seguimiento del ciclo, encendido
    await _dar_de_alta(mundo, "ana@x.es", desde_ios=True)
    await _dar_de_alta(mundo, "luis@x.es")
    mundo.enviados.clear()
    mundo.resend.clear()
    # Fechas fijas (el bono y la promoción tienen fin): las dos cuentas se crearon «ayer» a las 10:00, sin ninguna parada.
    for o in mundo.g["organizations"].docs:
        o["created_at"] = (AHORA - timedelta(hours=26)).isoformat()
        o["trial_ends"] = (AHORA + timedelta(days=6)).isoformat()
        o.pop("ciclo_correos", None)
    para = lambda: [e["para"] for e in mundo.enviados]            # noqa: E731
    # A mediodía: el correo del primer día (20-40 h), el del bono del ciclo y la campaña de «25 €».
    pendientes = await server._campana_bono25_pendientes(AHORA)
    assert [o["email"] for o, _, _ in pendientes] == ["luis@x.es"]
    await server.ciclo_correos_vuelta(AHORA)
    r = await server._primer_dia_vuelta(AHORA)
    assert r["correos"] == 1
    await server._campana_bono25_vuelta(AHORA)
    # Y por la mañana de los días siguientes: el primer día del ciclo, el recordatorio, la opinión, el aviso de que se acaba la prueba.
    for dias in (1, 2, 3, 4, 5, 6, 7):
        await server.ciclo_correos_vuelta(AHORA - timedelta(hours=3) + timedelta(days=dias))       # 09:00 en Madrid
        await server.ciclo_correos_vuelta(AHORA - timedelta(hours=4) + timedelta(days=dias))       # 08:00 en Madrid
    assert "luis@x.es" in para(), "el control no recibió nada: la prueba no mide"
    assert "ana@x.es" not in para(), f"a la cuenta del iPhone le han llegado correos: {[e['asunto'] for e in mundo.enviados if e['para'] == 'ana@x.es']}"
    assert mundo.resend == []
    ana = await mundo.g["organizations"].find_one({"slug": "ana-1234"})
    assert "ciclo_correos" not in ana and "primer_dia_correo_en" not in ana


@pytest.mark.asyncio(loop_scope="session")
async def test_el_aviso_de_la_manana_no_habla_del_bono_a_quien_viene_del_iphone(mundo):
    """El aviso de la mañana es un push (no mira `correos_baja`): a quien se dio de alta desde el iPhone no se le pone la frase del
    bono de 25 €; a la cuenta de la web, sí. Siguen llegando los dos, con el mismo título."""
    _, ana = await _dar_de_alta(mundo, "ana@x.es", desde_ios=True)
    _, luis = await _dar_de_alta(mundo, "luis@x.es")
    for o in (ana, luis):
        o["created_at"] = (AHORA - timedelta(days=10)).isoformat()                  # fecha fija: el bono tiene fin
        await mundo.g["push_subscriptions"].insert_one({"endpoint": "e-" + o["id"], "user_id": "u-" + o["id"], "org_id": o["id"]})
    lunes_8 = datetime(2026, 11, 2, 7, 10, tzinfo=timezone.utc)                    # 08:10 en Madrid
    assert await server._aviso_manana_vuelta(lunes_8) == 2
    por_cuenta = {p.usuarios[0]: p for p in mundo.pushes}
    de_ana, de_luis = por_cuenta["u-" + ana["id"]], por_cuenta["u-" + luis["id"]]
    assert de_ana.titulo == de_luis.titulo == "¿Empezamos la ruta?"
    assert de_ana.cuerpo == server._AVISO_MANANA_TEXTOS["es"][1] and "25" not in de_ana.cuerpo
    assert "25 €" in de_luis.cuerpo
