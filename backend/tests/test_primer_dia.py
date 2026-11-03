# -*- coding: utf-8 -*-
"""El primer día de quien se acaba de registrar (02-11-2026): el aviso al móvil entre 30 y 90 min, el correo de la
oferta entre 20 y 40 h (de día), cada uno una vez, nunca con paradas propias ni a empresas ni a demos; los eventos
que el servidor manda a Meta (registro, primera entrada, primera ruta: una vez por cuenta, solo con el permiso de
píxeles, de cuentas de 30 días o menos y nada de la app sin META_APP_EVENTS) y el embudo del super-admin. Sin Mongo:
base de mentira."""
import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest

import server
from base_de_mentira import Col, Db

AHORA = datetime(2026, 11, 2, 11, 0, tzinfo=timezone.utc)       # 12:00 en Madrid
DANI = {"sub": "a0", "role": "admin", "name": "Dani", "org_id": "owner", "account_type": "owner", "sa": True}


def _org(i, hace, **extra):
    o = {"id": f"o{i}", "name": f"Rep {i} Apellido", "account_type": "dsp", "db_name": f"dsp_o{i}", "status": "trial",
         "plan": "autonomo", "sector": "autonomo", "email": f"r{i}@x.es", "pais": "es", "zona_horaria": "Europe/Madrid",
         "created_at": (AHORA - hace).isoformat(), "trial_ends": (AHORA + timedelta(days=7)).isoformat()}
    o.update(extra)
    return o


async def _nada(*a, **k):
    return None


_META_ENVIAR = server._meta_enviar          # el de verdad: el `mundo` lo cambia por uno que solo apunta


def _con_permiso(mundo, *ids):
    """Esas cuentas aceptaron los píxeles al darse de alta y se crearon ahora mismo (a Meta solo van las de 30 días
    o menos: con la fecha fija de AHORA, la prueba caducaría en un mes)."""
    for o in mundo.g["organizations"].docs:
        if o["id"] in ids:
            o.update(meta_ok=True, created_at=datetime.now(timezone.utc).isoformat())


def _alta(**kw):
    """Los datos de un alta de prueba (con la contraseña de mentira de siempre)."""
    return server.RegisterRequest(password="12345678", **kw)


@pytest.fixture
def mundo(monkeypatch):
    bases = {}

    class Cliente(dict):
        def __getitem__(self, nombre):
            return bases.setdefault(nombre, Db())

    g = Db()
    g["organizations"] = Col([
        _org(1, timedelta(minutes=45)),                                           # le toca el aviso
        _org(2, timedelta(minutes=10)),                                           # aún no (menos de 30 min)
        _org(3, timedelta(minutes=45)),                                           # ya tiene una parada suya
        _org(4, timedelta(minutes=45), sector="paqueteria", plan="pro"),          # una empresa: nunca
        _org(5, timedelta(hours=24)),                                             # le toca el correo
        _org(6, timedelta(minutes=45)),                                           # solo paradas de ejemplo: le toca
        _org(7, timedelta(minutes=45), demo=True),                                # una demo: nunca
        _org(8, timedelta(hours=24), email=None),                                 # sin correo
        _org(9, timedelta(hours=24), correos_baja=True),                          # se dio de baja
        _org(10, timedelta(hours=24), status="cancelled"),                        # cancelada
    ])
    g["admin_users"] = Col([{"id": f"a{i}", "org_id": f"o{i}", "username": f"r{i}@x.es", "role": "admin",
                             "name": f"Rep {i}", "email": f"r{i}@x.es"} for i in range(1, 11)])
    g["correos_enviados"] = Col([])
    cli = Cliente()
    cli["dsp_o3"]["reparto_pedidos"].docs.append({"id": "p3", "fecha": "2026-11-02", "estado": "pendiente"})
    cli["dsp_o6"]["reparto_pedidos"].docs.append({"id": "e6", "fecha": "2026-11-02", "estado": "pendiente", "ejemplo": True})
    monkeypatch.setattr(server, "client", cli)
    monkeypatch.setattr(server, "global_db", g)
    pushes, enviados, meta = [], [], []

    async def push(ids, titulo, cuerpo, url="/panel"):
        pushes.append((sorted(ids), titulo, cuerpo, url))
    monkeypatch.setattr(server, "send_web_push_to_users", push)
    monkeypatch.delenv("FCM_SERVICE_ACCOUNT_JSON", raising=False)
    server._FCM_CRED.clear()

    async def enviar(to, subject, html, responder_a="", copia=None, texto="", cabeceras=None, solo=""):
        enviados.append({"para": to, "asunto": subject, "texto": texto, "html": html, "cabeceras": cabeceras or {}})
        return True
    monkeypatch.setattr(server, "_enviar_email", enviar)
    monkeypatch.setattr(server, "_email_proveedores", lambda: ["brevo"])
    monkeypatch.setattr(server, "_rep_promo_activa", lambda: True)
    monkeypatch.setattr(server, "REP_GRATIS_HASTA", "2026-12-31")
    monkeypatch.setattr(server, "_PORTAL_BASE_FRONT", "https://flotadsp.com")
    monkeypatch.setenv("EMAIL_FROM", "FDS <contacto@flotadsp.com>")

    def grabar(nombre, event_id, **kw):
        meta.append((nombre, event_id, kw))
        return SimpleNamespace(nombre=nombre)          # como la tarea que devuelve _meta_enviar cuando manda
    monkeypatch.setattr(server, "_meta_enviar", grabar)
    return SimpleNamespace(g=g, cli=cli, pushes=pushes, enviados=enviados, meta=meta)


# ── (a) EL AVISO AL MÓVIL ─────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_el_aviso_sale_una_vez_entre_30_y_90_min_y_solo_a_quien_toca(mundo):
    r = await server._primer_dia_vuelta(AHORA)
    assert r["avisos"] == 2 and r["correos"] == 1
    # o1 y o6 (la de ejemplo no cuenta); o2 aún no, o3 ya carga, o4 es empresa, o7 es demo.
    assert [p[0] for p in mundo.pushes] == [["a1"], ["a6"]]
    assert mundo.pushes[0][1] == "Tu primera ruta con FDS"
    assert mundo.pushes[0][2] == "Escanea tu primer paquete y FDS te ordena la ruta sola."
    assert mundo.pushes[0][3].startswith("/ruta?")
    # A la bandeja de SU empresa (la app nativa la lee), no a otra.
    bandeja = mundo.cli["dsp_o1"]["avisos_movil"].docs
    assert len(bandeja) == 1 and bandeja[0]["user_id"] == "a1" and bandeja[0]["url"].startswith("/ruta")
    assert mundo.cli["dsp_o3"]["avisos_movil"].docs == [] and mundo.cli["dsp_o4"]["avisos_movil"].docs == []
    o1 = await mundo.g["organizations"].find_one({"id": "o1"})
    assert o1["primer_dia_aviso_en"] == AHORA.isoformat()
    # La segunda tanda no repite a nadie.
    r2 = await server._primer_dia_vuelta(AHORA)
    assert r2["avisos"] == 0 and r2["correos"] == 0 and len(mundo.pushes) == 2
    # o2, a sus 35 min, sí; a los 91 min ya es tarde.
    r3 = await server._primer_dia_vuelta(AHORA + timedelta(minutes=25))
    assert r3["avisos"] == 1 and mundo.pushes[-1][0] == ["a2"]
    mundo.g["organizations"].docs.append(_org(11, timedelta(minutes=91)))
    mundo.g["admin_users"].docs.append({"id": "a11", "org_id": "o11"})
    assert (await server._primer_dia_vuelta(AHORA))["avisos"] == 0


@pytest.mark.asyncio(loop_scope="session")
async def test_el_aviso_va_en_el_idioma_de_la_cuenta(mundo):
    mundo.g["organizations"].docs.append(_org(12, timedelta(minutes=45), pais="br", zona_horaria="America/Sao_Paulo"))
    mundo.g["admin_users"].docs.append({"id": "a12", "org_id": "o12"})
    mundo.g["organizations"].docs.append(_org(13, timedelta(minutes=45), idioma="de"))
    mundo.g["admin_users"].docs.append({"id": "a13", "org_id": "o13"})
    await server._primer_dia_vuelta(AHORA)
    textos = {p[0][0]: p[2] for p in mundo.pushes}
    assert textos["a12"].startswith("Escaneie seu primeiro pacote")
    assert textos["a13"].startswith("Scanne dein erstes Paket")


# ── (b) EL CORREO DE LA OFERTA ────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_el_correo_sale_una_vez_a_las_20_40_h_con_la_ruta_y_la_invitacion(mundo):
    r = await server._primer_dia_vuelta(AHORA)
    assert r["correos"] == 1 and [e["para"] for e in mundo.enviados] == ["r5@x.es"]
    e = mundo.enviados[0]
    assert e["asunto"] == "Tu primera ruta con FDS: gratis hasta el 31 de diciembre y 25 € por tu primera ruta de verdad"
    assert "Hola Rep:" in e["texto"] and "Ayer creaste tu cuenta en FDS" in e["texto"]
    assert "https://flotadsp.com/pase?ir=ruta&" in e["texto"] and "#p=" in e["texto"]       # entra sin contraseña
    assert "https://flotadsp.com/invita?ref=" in e["texto"]                                   # su enlace de invitación
    assert "25 €" in e["texto"] and "20 entregas en 2 días" in e["texto"]
    assert "/api/correo/baja?o=o5" in e["cabeceras"]["List-Unsubscribe"]
    assert 'href="https://flotadsp.com/pase?ir=ruta&' in e["html"] and "Cargar mi primera ruta" in e["html"]
    o5 = await mundo.g["organizations"].find_one({"id": "o5"})
    assert o5["primer_dia_correo_en"] == AHORA.isoformat() and o5.get("ref_codigo")
    copia = await mundo.g["correos_enviados"].find_one({"org_id": "o5"})
    assert copia["por"] == "primer_dia:correo" and copia["ok"] and "#p=…" in copia["cuerpo"]
    # Ni a quien no tiene correo, ni a quien se dio de baja, ni a la cancelada; y la segunda tanda no repite.
    assert (await server._primer_dia_vuelta(AHORA))["correos"] == 0 and len(mundo.enviados) == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_el_correo_no_sale_de_noche_ni_sin_proveedor_ni_con_paradas_ni_fuera_de_la_ventana(mundo, monkeypatch):
    assert (await server._primer_dia_vuelta(AHORA.replace(hour=22)))["correos"] == 0          # 23:00 en Madrid
    monkeypatch.setattr(server, "_email_proveedores", lambda: [])
    assert (await server._primer_dia_vuelta(AHORA))["correos"] == 0
    monkeypatch.setattr(server, "_email_proveedores", lambda: ["resend"])
    mundo.cli["dsp_o5"]["reparto_pedidos"].docs.append({"id": "p5", "fecha": "2026-11-02", "estado": "pendiente"})
    assert (await server._primer_dia_vuelta(AHORA))["correos"] == 0                            # ya carga paradas
    mundo.cli["dsp_o5"]["reparto_pedidos"].docs.clear()
    with monkeypatch.context() as m:                       # «de día» siempre: aquí solo cuenta la ventana
        m.setattr(server.ciclo_correos, "en_su_dia", lambda org, ahora: True)
        assert (await server._primer_dia_vuelta(AHORA + timedelta(hours=17)))["correos"] == 0  # a las 41 h, tarde
    assert (await server._primer_dia_vuelta(AHORA - timedelta(hours=5)))["correos"] == 0       # a las 19 h, pronto
    assert (await server._primer_dia_vuelta(AHORA))["correos"] == 1
    assert mundo.enviados[0]["para"] == "r5@x.es"


@pytest.mark.asyncio(loop_scope="session")
async def test_si_el_correo_no_sale_se_desmarca_y_se_reintenta(mundo, monkeypatch):
    async def falla(*a, **k):
        return False
    monkeypatch.setattr(server, "_enviar_email", falla)
    assert (await server._primer_dia_vuelta(AHORA))["correos"] == 0
    o5 = await mundo.g["organizations"].find_one({"id": "o5"})
    assert "primer_dia_correo_en" not in o5
    assert (await mundo.g["correos_enviados"].find_one({"org_id": "o5"}))["ok"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_si_algo_falla_antes_de_mandar_el_correo_tambien_se_desmarca(mundo, monkeypatch):
    """Entre la marca y el envío pueden fallar el pase, el código de invitación o Mongo: con la marca puesta, esa
    persona no lo recibiría nunca."""
    async def roto(org):
        raise RuntimeError("Mongo no contesta")
    with monkeypatch.context() as m:
        m.setattr(server, "_pase_de_correo", roto)
        assert (await server._primer_dia_vuelta(AHORA))["correos"] == 0
    o5 = await mundo.g["organizations"].find_one({"id": "o5"})
    assert "primer_dia_correo_en" not in o5 and mundo.enviados == []
    # La tanda siguiente, ya sin el fallo, lo manda.
    assert (await server._primer_dia_vuelta(AHORA))["correos"] == 1 and mundo.enviados[0]["para"] == "r5@x.es"


@pytest.mark.asyncio(loop_scope="session")
async def test_quien_se_registra_de_madrugada_tambien_recibe_el_correo(mundo):
    """Con la ventana de 20 a 28 h, un alta de 1 a 5 de la madrugada no tenía ninguna hora de 9 a 21 dentro y el
    correo no salía nunca. Con 20 a 40 h, se registre a la hora que se registre hay alguna tanda (cada 15 min) de día."""
    madrid = ZoneInfo("Europe/Madrid")
    desde, hasta = server.PRIMER_DIA_CORREO

    def tandas_de_dia(alta, org):
        ticks = (alta + desde + timedelta(minutes=15 * k) for k in range(int((hasta - desde) / timedelta(minutes=15)) + 1))
        return [t for t in ticks if server.ciclo_correos.en_su_dia(org, t)]
    for minutos in range(0, 24 * 60, 15):
        alta = (datetime(2026, 11, 2, tzinfo=madrid) + timedelta(minutes=minutos)).astimezone(timezone.utc)
        assert tandas_de_dia(alta, {"zona_horaria": "Europe/Madrid"}), alta
    # El alta de las 02:00 de Madrid, de punta a punta: sale en la primera tanda de día, a las 9 del día siguiente.
    alta = datetime(2026, 11, 2, 2, 0, tzinfo=madrid).astimezone(timezone.utc)
    o = _org(30, timedelta(0), created_at=alta.isoformat())
    mundo.g["organizations"].docs.append(o)
    mundo.g["admin_users"].docs.append({"id": "a30", "org_id": "o30"})
    primera = tandas_de_dia(alta, o)[0]
    assert primera.astimezone(madrid).hour == 9 and primera - alta > timedelta(hours=28)
    await server._primer_dia_vuelta(primera)
    assert "r30@x.es" in [e["para"] for e in mundo.enviados]


@pytest.mark.asyncio(loop_scope="session")
async def test_el_correo_en_portugues_de_brasil_y_sin_bono(mundo, monkeypatch):
    o = _org(14, timedelta(hours=24), pais="br", zona_horaria="America/Sao_Paulo", email="r14@x.br")
    mundo.g["organizations"].docs.append(o)
    mundo.g["admin_users"].docs.append({"id": "a14", "org_id": "o14"})
    monkeypatch.setattr(server, "_bono_resumen", lambda org, ahora=None: None)
    await server._primer_dia_vuelta(AHORA.replace(hour=15))            # 12:00 en São Paulo (16:00 en Madrid)
    e = next(x for x in mundo.enviados if x["para"] == "r14@x.br")
    assert e["asunto"] == "Sua primeira rota com FDS: grátis até 31 de dezembro"
    assert "Ontem você criou sua conta no FDS" in e["texto"] and "carteira" not in e["texto"]


# ── LOS EVENTOS A META ────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_el_alta_de_quien_reparte_solo_manda_complete_registration_con_el_event_id(mundo, monkeypatch):
    monkeypatch.setattr(server, "_ensure_tenant_indexes", _nada)
    server._public_actions.clear()
    req = SimpleNamespace(headers={"user-agent": "Mozilla/5.0 (Android)"}, client=SimpleNamespace(host="198.51.100.7"))
    fbp, fbc = "fb.1.1730000000000.1234567890", "fb.1.1730000000000.IwAR0abc"
    datos = _alta(org_name="Rosa Reparte", username="rosa-reparte", slug="rosa-reparte", sector="autonomo",
                  email="Rosa@X.es", anuncios=True, fbp=fbp, fbc=fbc)
    r = await server.register_dsp(datos, req)
    assert r.meta_event_id == f"reg-{r.id}"                    # estable: el mismo que la web le pasa al píxel
    assert len(mundo.meta) == 1
    nombre, event_id, kw = mundo.meta[0]
    assert nombre == "CompleteRegistration" and event_id == r.meta_event_id
    assert kw["correo"] == "rosa@x.es" and kw["action_source"] == "website" and kw["ip"] == "198.51.100.7"
    assert kw["agente"].startswith("Mozilla") and kw["url"] == "https://flotadsp.com/registro"
    assert kw["fbp"] == fbp and kw["fbc"] == fbc              # las cookies del píxel: Meta casa el clic del anuncio
    rosa = await mundo.g["organizations"].find_one({"slug": "rosa-reparte"})
    assert rosa["meta_ok"] is True and rosa["meta_fbp"] == fbp and rosa["meta_fbc"] == fbc
    assert "meta_app_login_en" not in rosa                    # en la web, «entró» es abrir la ruta (otra prueba)
    # Una empresa no es un registro de los anuncios: ni evento ni event_id.
    server._public_actions.clear()
    r2 = await server.register_dsp(_alta(org_name="Paquetes SL", username="paquetes-sl", slug="paquetes-sl",
                                         sector="paqueteria", email="p@x.es", anuncios=True), req)
    assert r2.meta_event_id is None and len(mundo.meta) == 1
    # Sin el permiso de píxeles («Solo necesarias», o una web que no lo manda): nada a Meta, y sus cookies del píxel
    # no se guardan aunque lleguen.
    for i, permiso in enumerate((False, None)):
        server._public_actions.clear()
        r3 = await server.register_dsp(_alta(org_name="Ana", username=f"ana-reparte-{i}", slug=f"ana-reparte-{i}",
                                             sector="autonomo", email=f"ana{i}@x.es", anuncios=permiso, fbp=fbp), req)
        ana = await mundo.g["organizations"].find_one({"slug": f"ana-reparte-{i}"})
        assert r3.meta_event_id is None and ana["meta_ok"] is False and "meta_fbp" not in ana
    assert len(mundo.meta) == 1
    # Lo que no tiene pinta de cookie del píxel («fb.…», 200 caracteres como mucho) no se guarda ni se manda.
    server._public_actions.clear()
    await server.register_dsp(_alta(org_name="Eva", username="eva-reparte", slug="eva-reparte", sector="autonomo",
                                    email="e@x.es", anuncios=True, fbp="otra-cosa", fbc="fb." + "x" * 200), req)
    eva = await mundo.g["organizations"].find_one({"slug": "eva-reparte"})
    assert eva["meta_ok"] is True and "meta_fbp" not in eva and "meta_fbc" not in eva
    assert mundo.meta[-1][2]["fbp"] is None and mundo.meta[-1][2]["fbc"] is None
    # Desde la app de Play (aquí con permiso, como la web abierta desde Play), el alta va como «app» y ya es entrar
    # en ella: «app_login» en el acto. Que no salga nada «app» sin META_APP_EVENTS lo mira otra prueba.
    server._public_actions.clear()
    r4 = await server.register_dsp(_alta(org_name="Luis", username="luis-reparte", slug="luis-reparte", sector="autonomo",
                                         email="l@x.es", desde_app=True, anuncios=True), req)
    luis = await mundo.g["organizations"].find_one({"slug": "luis-reparte"})
    assert [(n, e, k["action_source"]) for n, e, k in mundo.meta[-2:]] == [
        ("CompleteRegistration", f"reg-{r4.id}", "app"), ("app_login", f"login-{luis['id']}", "app")]
    assert luis["meta_app_login_en"]


@pytest.mark.asyncio(loop_scope="session")
async def test_app_login_la_primera_vez_que_entra_y_solo_una(mundo):
    _con_permiso(mundo, "o1", "o2", "o4", "o7")
    user = {"id": "a1", "role": "admin", "name": "Rep 1", "org_id": "o1", "email": "r1@x.es"}
    app = SimpleNamespace(headers={"x-fds-app": "android-2.4.3", "user-agent": "okhttp/4"},
                          client=SimpleNamespace(host="203.0.113.9"))
    s = await server._sesion_de_admin(user, app)
    assert s.app_destino == "reparto" and s.access_token
    assert len(mundo.meta) == 1
    nombre, event_id, kw = mundo.meta[0]
    assert nombre == "app_login" and event_id == "login-o1" and kw["correo"] == "r1@x.es"
    assert kw["action_source"] == "app" and kw["version_app"] == "2.4.3" and kw["ip"] == "203.0.113.9"
    o1 = await mundo.g["organizations"].find_one({"id": "o1"})
    assert o1["meta_app_login_en"]
    # Vuelve a entrar (web, sin cabecera): nada nuevo.
    await server._sesion_de_admin(user, SimpleNamespace(headers={}, client=None))
    await server._sesion_de_admin(user)
    assert len(mundo.meta) == 1
    # Una empresa no cuenta; una demo tampoco.
    await server._sesion_de_admin({"id": "a4", "role": "admin", "name": "Emp", "org_id": "o4"}, app)
    await server._sesion_de_admin({"id": "a7", "role": "admin", "name": "Demo", "org_id": "o7"}, app)
    assert len(mundo.meta) == 1
    # Desde la web, «website».
    await server._sesion_de_admin({"id": "a2", "role": "admin", "name": "Rep 2", "org_id": "o2"},
                                  SimpleNamespace(headers={"user-agent": "Mozilla"}, client=SimpleNamespace(host="1.2.3.4")))
    assert mundo.meta[-1][1] == "login-o2" and mundo.meta[-1][2]["action_source"] == "website"


@pytest.mark.asyncio(loop_scope="session")
async def test_primera_ruta_al_terminar_el_dia_con_una_entrega_real_y_una_sola_vez(mundo, monkeypatch):
    _con_permiso(mundo, "o1", "o4")
    t = Db()
    monkeypatch.setattr(server, "db", t)
    yo = {"sub": "a1", "role": "admin", "name": "Rep 1", "org_id": "o1", "db_name": "dsp_o1"}
    hoy = server._dia_negocio()
    # Solo paradas de ejemplo entregadas: no es una ruta de verdad.
    t["reparto_pedidos"].docs.append({"id": "e1", "conductor_id": "a1", "fecha": hoy, "estado": "entregado", "ejemplo": True})
    assert (await server.reparto_jornada({"accion": "terminar"}, yo))["terminada"]
    assert mundo.meta == []
    # Una entrega real: el evento, con sus 25 €, una vez.
    t["reparto_pedidos"].docs.append({"id": "p1", "conductor_id": "a1", "fecha": hoy, "estado": "entregado"})
    app = SimpleNamespace(headers={"x-fds-app": "android-2.4.3"}, client=SimpleNamespace(host="203.0.113.9"))
    await server.reparto_jornada({"accion": "terminar"}, yo, app)
    assert len(mundo.meta) == 1
    nombre, event_id, kw = mundo.meta[0]
    assert nombre == "primera_ruta" and event_id == "ruta-o1" and kw["valor"] == 25 and kw["moneda"] == "EUR"
    assert kw["action_source"] == "app" and kw["correo"] == "r1@x.es"
    assert (await mundo.g["organizations"].find_one({"id": "o1"}))["meta_primera_ruta_en"]
    await server.reparto_jornada({"accion": "terminar"}, yo, app)
    assert len(mundo.meta) == 1
    # Directo (lo llama también el bono al pagarse): una cuenta que no reparte sola, nunca; sin org, nada.
    assert await server._meta_primera_ruta(await server.get_org("o4"), "a4") is False
    assert await server._meta_primera_ruta(None, "a1") is False


@pytest.mark.asyncio(loop_scope="session")
async def test_app_login_al_abrir_la_ruta_del_dia_sin_pasar_por_el_login(mundo, monkeypatch):
    """El alta ya da la sesión (y la de la app dura un mes): «entró» es abrir la ruta del día, no volver a entrar."""
    monkeypatch.setattr(server, "db", Db())
    monkeypatch.setattr(server, "_ensure_tenant_indexes", _nada)
    server._public_actions.clear()
    web = SimpleNamespace(headers={"user-agent": "Mozilla/5.0"}, client=SimpleNamespace(host="198.51.100.7"))
    r = await server.register_dsp(_alta(org_name="Rosa Reparte", username="rosa-reparte", slug="rosa-reparte",
                                        sector="autonomo", email="rosa@x.es", anuncios=True), web)
    rosa = await mundo.g["organizations"].find_one({"slug": "rosa-reparte"})
    assert "meta_app_login_en" not in rosa and [m[0] for m in mundo.meta] == ["CompleteRegistration"]
    yo = {"sub": r.id, "role": "admin", "name": "Rosa Reparte", "org_id": rosa["id"], "db_name": rosa["db_name"]}
    ruta = await server.reparto_mi_ruta(yo, web)
    assert ruta["activo"] and ruta["autonomo"]
    assert [(m[0], m[1], m[2]["action_source"]) for m in mundo.meta[1:]] == [("app_login", f"login-{rosa['id']}", "website")]
    assert (await mundo.g["organizations"].find_one({"id": rosa["id"]}))["meta_app_login_en"]
    # Volver a abrirla, o entrar con su contraseña, no lo repite.
    await server.reparto_mi_ruta(yo, web)
    await server._sesion_de_admin({"id": r.id, "role": "admin", "name": "Rosa Reparte", "org_id": rosa["id"]}, web)
    assert len(mundo.meta) == 2


@pytest.mark.asyncio(loop_scope="session")
async def test_desde_la_app_no_sale_nada_a_meta_sin_meta_app_events_pero_el_embudo_lo_cuenta(mundo, monkeypatch):
    """La ficha de «Seguridad de los datos» de Play dice que la app no comparte nada: hasta que lo declare (y el
    dataset esté enlazado a la app) el servidor no manda nada con origen «app». Las marcas del embudo, sí."""
    monkeypatch.setattr(server, "_meta_enviar", _META_ENVIAR)
    monkeypatch.setattr(server, "_ensure_tenant_indexes", _nada)
    monkeypatch.setenv("META_PIXEL_ID", "123456789012345")
    monkeypatch.setenv("META_CAPI_TOKEN", "token-de-prueba")
    monkeypatch.delenv("META_APP_EVENTS", raising=False)
    mandados = []

    async def enviar(nombre, event_id, **datos):
        mandados.append((nombre, event_id, datos.get("action_source")))
        return True
    monkeypatch.setattr(server.meta_capi, "enviar_evento", enviar)
    app = SimpleNamespace(headers={"x-fds-app": "android-2.4.4", "user-agent": "FDS-Android/2.4.4"},
                          client=SimpleNamespace(host="203.0.113.9"))
    # La app nativa no manda el permiso: ni CompleteRegistration ni event_id; la marca de «entró», sí.
    server._public_actions.clear()
    r = await server.register_dsp(_alta(org_name="Luis", username="luis@x.es", slug="luis-1234", sector="autonomo",
                                        email="luis@x.es", desde_app=True), app)
    luis = await mundo.g["organizations"].find_one({"slug": "luis-1234"})
    assert r.meta_event_id is None and luis["meta_ok"] is False and luis["meta_app_login_en"]
    # Aunque hubiera permiso, con origen «app» no sale nada sin META_APP_EVENTS=1.
    server._public_actions.clear()
    r2 = await server.register_dsp(_alta(org_name="Marta", username="marta@x.es", slug="marta-1234", sector="autonomo",
                                         email="marta@x.es", desde_app=True, anuncios=True), app)
    marta = await mundo.g["organizations"].find_one({"slug": "marta-1234"})
    await asyncio.gather(*list(server._META_TAREAS))
    assert r2.meta_event_id is None and marta["meta_app_login_en"] and mandados == []
    # Cuando Play lo declare, META_APP_EVENTS=1: sale, con su event_id estable.
    monkeypatch.setenv("META_APP_EVENTS", "1")
    server._public_actions.clear()
    r3 = await server.register_dsp(_alta(org_name="Sara", username="sara@x.es", slug="sara-1234", sector="autonomo",
                                         email="sara@x.es", desde_app=True, anuncios=True), app)
    sara = await mundo.g["organizations"].find_one({"slug": "sara-1234"})
    await asyncio.gather(*list(server._META_TAREAS))
    assert r3.meta_event_id == f"reg-{r3.id}"
    assert mandados == [("CompleteRegistration", f"reg-{r3.id}", "app"), ("app_login", f"login-{sara['id']}", "app")]


@pytest.mark.asyncio(loop_scope="session")
async def test_a_meta_solo_van_cuentas_con_permiso_y_de_30_dias_o_menos_pero_la_marca_se_pone_igual(mundo, monkeypatch):
    """Al desplegar, cada cuenta vieja que reparte mandaría su «primera ruta» (25 €) como si viniera de los anuncios
    de hoy; y sin el permiso de píxeles no se le cuenta nada a Meta. El embudo (/admin/primer-dia) las cuenta igual."""
    t = Db()
    monkeypatch.setattr(server, "db", t)
    ahora = datetime.now(timezone.utc)
    orgs = mundo.g["organizations"].docs
    orgs.append(_org(20, timedelta(0), meta_ok=True, created_at=(ahora - timedelta(days=31)).isoformat()))   # vieja
    orgs.append(_org(21, timedelta(0), meta_ok=True, created_at=(ahora - timedelta(days=29)).isoformat()))   # reciente
    orgs.append(_org(22, timedelta(0), created_at=ahora.isoformat()))                                        # sin permiso
    for i in (20, 21, 22):
        t["reparto_pedidos"].docs.append({"id": f"p{i}", "conductor_id": f"a{i}", "fecha": "2026-11-02", "estado": "entregado"})
        org = await server.get_org(f"o{i}")
        assert await server._meta_app_login(org, {"id": f"a{i}", "email": f"r{i}@x.es"}) is True
        assert await server._meta_primera_ruta(org, f"a{i}") is True
        o = await mundo.g["organizations"].find_one({"id": f"o{i}"})
        assert o["meta_app_login_en"] and o["meta_primera_ruta_en"]
    assert [(m[0], m[1]) for m in mundo.meta] == [("app_login", "login-o21"), ("primera_ruta", "ruta-o21")]


@pytest.mark.asyncio(loop_scope="session")
async def test_el_bono_cobrado_al_abrir_la_ruta_en_la_app_es_origen_app(mundo, monkeypatch):
    """«primera_ruta» también sale al cobrar el bono, al abrir la ruta: con la petición, para que lo de la app nativa
    vaya como «app» (y no salga sin META_APP_EVENTS) y no como «website»."""
    llamadas = []

    async def primera_ruta(org, conductor_id, fecha=None, request=None):
        llamadas.append((org["id"], conductor_id, server._meta_origen(request)))
        return True
    monkeypatch.setattr(server, "_meta_primera_ruta", primera_ruta)
    monkeypatch.setattr(server, "db", Db())
    monkeypatch.setattr(server, "_bono_resumen", lambda org, ahora=None: {"pagado": False, "limite": "2099-12-31"})
    monkeypatch.setattr(server, "_ref_uso_real", lambda hechas: (server._REF_ENTREGAS_CARTERA, server._REF_DIAS_DISTINTOS))
    org = {**await server.get_org("o5"), "created_at": (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()}
    app = SimpleNamespace(headers={"x-fds-app": "android-2.4.4"}, client=SimpleNamespace(host="203.0.113.9"))
    assert (await server._bono_estado(org, "a5", app))["nuevo"] is True
    assert llamadas == [("o5", "a5", "app")]


@pytest.mark.asyncio(loop_scope="session")
async def test_la_tarea_de_envio_a_meta_se_guarda_hasta_que_acaba(monkeypatch):
    """El bucle de asyncio solo guarda referencias débiles a las tareas: sin guardarla, el recolector se la puede
    llevar a medias y el evento se pierde sin que nadie lo vea."""
    monkeypatch.setenv("META_PIXEL_ID", "123456789012345")
    monkeypatch.setenv("META_CAPI_TOKEN", "token-de-prueba")
    sigue = asyncio.Event()

    async def enviar(nombre, event_id, **datos):
        await sigue.wait()
        return True
    monkeypatch.setattr(server.meta_capi, "enviar_evento", enviar)
    t = server._meta_enviar("primera_ruta", "ruta-o1", action_source="website")
    assert t in server._META_TAREAS
    sigue.set()
    assert await t is True
    await asyncio.sleep(0)
    assert t not in server._META_TAREAS
    # Sin META_*, ni tarea.
    monkeypatch.delenv("META_CAPI_TOKEN")
    assert server._meta_enviar("primera_ruta", "ruta-o1", action_source="website") is None


# ── EL EMBUDO DEL SUPER-ADMIN ─────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_el_embudo_de_los_ultimos_30_dias(mundo, monkeypatch):
    g = mundo.g
    ahora = datetime.now(timezone.utc)
    g["organizations"] = Col([
        {"id": "n1", "sector": "autonomo", "plan": "autonomo", "db_name": "dsp_n1", "created_at": (ahora - timedelta(days=1)).isoformat(),
         "meta_app_login_en": "x", "meta_primera_ruta_en": "x", "bono_pagado": True, "primer_dia_aviso_en": "x", "primer_dia_correo_en": "x"},
        {"id": "n2", "sector": "autonomo", "plan": "autonomo", "db_name": "dsp_n2", "created_at": (ahora - timedelta(days=2)).isoformat(),
         "meta_app_login_en": "x", "primer_dia_aviso_en": "x"},
        {"id": "n3", "sector": "autonomo", "plan": "autonomo", "db_name": "dsp_n3", "created_at": (ahora - timedelta(days=29)).isoformat()},
        {"id": "n4", "sector": "autonomo", "plan": "autonomo", "db_name": "dsp_n4", "created_at": (ahora - timedelta(days=31)).isoformat(),
         "meta_app_login_en": "x"},                                                   # fuera de los 30 días
        {"id": "n5", "sector": "paqueteria", "plan": "pro", "db_name": "dsp_n5", "created_at": (ahora - timedelta(days=1)).isoformat()},
        {"id": "n6", "sector": "autonomo", "plan": "autonomo", "db_name": "dsp_n6", "created_at": (ahora - timedelta(days=1)).isoformat(),
         "demo": True, "meta_app_login_en": "x"},
    ])
    mundo.cli["dsp_n1"]["reparto_pedidos"].docs.append({"id": "p", "estado": "entregado"})
    mundo.cli["dsp_n2"]["reparto_pedidos"].docs.append({"id": "p", "estado": "pendiente"})
    mundo.cli["dsp_n3"]["reparto_pedidos"].docs.append({"id": "e", "estado": "pendiente", "ejemplo": True})
    monkeypatch.delenv("META_PIXEL_ID", raising=False)
    r = await server.admin_primer_dia(30, DANI)
    assert r["registrados"] == 3 and r["con_app_login"] == 2 and r["con_parada"] == 2
    assert r["con_primera_ruta"] == 1 and r["con_bono"] == 1
    assert r["avisos_movil"] == 2 and r["correos"] == 1 and r["coste"] is None and r["meta_capi"] is False
    assert r["dias"] == 30 and r["desde"] == (ahora - timedelta(days=30)).date().isoformat()
    # Con 60 días entra la de hace 31; el tope es un año.
    assert (await server.admin_primer_dia(60, DANI))["registrados"] == 4
    assert (await server.admin_primer_dia(9999, DANI))["dias"] == 365


# ── RETIRAR EL PERMISO DE LOS ANUNCIOS (02-11-2026, revisión S2) ─────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_retirar_el_permiso_de_los_anuncios_llega_al_servidor(mundo):
    """Quien elige «Solo necesarias» con la sesión abierta deja de mandar a Meta y se borran sus cookies del píxel;
    aceptarlo otra vez lo da. Lo cambia cualquier usuario de la cuenta, nunca el dueño entrando como ella; y lo que no
    es `true` lo quita."""
    _con_permiso(mundo, "o1")
    o1 = next(o for o in mundo.g["organizations"].docs if o["id"] == "o1")
    o1.update(meta_fbp="fb.1.111.222", meta_fbc="fb.1.333.abc")
    yo = {"sub": "a1", "role": "admin", "name": "Rep 1", "org_id": "o1"}
    assert await server.cuenta_anuncios({"anuncios": False}, yo) == {"ok": True, "anuncios": False}
    assert o1["meta_ok"] is False and "meta_fbp" not in o1 and "meta_fbc" not in o1 and o1["meta_ok_en"]
    # Ya no sale nada a Meta: su primera entrada se apunta (el embudo), pero no se manda.
    assert await server._meta_app_login(dict(o1), {"id": "a1", "email": "r1@x.es"})
    assert o1["meta_app_login_en"] and mundo.meta == []
    assert (await server.cuenta_anuncios({"anuncios": True}, yo))["anuncios"] is True and o1["meta_ok"] is True
    conductor = {"sub": "d9", "role": "driver", "name": "Conductor", "org_id": "o1"}
    for cuerpo in ({"anuncios": "true"}, {"anuncios": 1}, {}, {"anuncios": None}):
        o1["meta_ok"] = True
        assert (await server.cuenta_anuncios(cuerpo, conductor))["anuncios"] is False and o1["meta_ok"] is False
    for u, codigo in (({**yo, "imp": True}, 403), ({**yo, "demo": True}, 403), ({"sub": "x", "role": "admin"}, 400)):
        with pytest.raises(server.HTTPException) as e:
            await server.cuenta_anuncios({"anuncios": True}, u)
        assert e.value.status_code == codigo
    assert o1["meta_ok"] is False
