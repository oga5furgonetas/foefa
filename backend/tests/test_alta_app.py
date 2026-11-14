# -*- coding: utf-8 -*-
"""El alta dentro de la app de Android ya no expulsa, y cada alta dice de dónde viene (14-11-2026).

La app nativa guarda a qué portal va la sesión (`app_destino`) y, cada vez que la relee, BORRA la de un admin que no
diga «reparto» (`app-android/.../data/Cuenta.kt`, `cargar()`, desde el 28-10-2026). El alta del servidor no lo decía:
quien se creaba la cuenta DENTRO de la app era expulsado un segundo después (el aviso periódico relee la sesión),
volvía al formulario con sus datos puestos y, al repetir, «Ese usuario ya existe». Probado en el emulador con la 2.4.6.
Aquí: el alta de quien reparte solo lo dice (respuesta y token) como `/auth/app-login`; a las empresas no se les cambia
nada; y la cuenta guarda con qué se dio de alta y por dónde llegó, limpio. Sin Mongo: base de mentira."""
import asyncio
from types import SimpleNamespace

import httpx
import pytest

import server
from base_de_mentira import Col, Db

# La app de Play (okhttp y su cabecera con la versión) y un Chrome de Android cualquiera.
REQ_APP = SimpleNamespace(headers={"user-agent": "okhttp/4.12.0", "x-fds-app": "android-2.4.6"},
                          client=SimpleNamespace(host="198.51.100.9"))
REQ_WEB = SimpleNamespace(headers={"user-agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile"},
                          client=SimpleNamespace(host="198.51.100.10"))


async def _nada(*a, **k):
    return None


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
    # Sin claves de correo: el alta no intenta mandar nada (lo que se prueba es la sesión y lo que guarda la cuenta).
    for clave in ("RESEND_API_KEY", "BREVO_API_KEY", "FCM_SERVICE_ACCOUNT_JSON"):
        monkeypatch.delenv(clave, raising=False)
    monkeypatch.setattr(server, "_email_proveedores", lambda: [])

    async def enviar(*a, **k):
        return True
    monkeypatch.setattr(server, "_enviar_email", enviar)

    class ClienteHttp:
        def __init__(self, *a, **k):
            pass

        async def post(self, *a, **k):
            return SimpleNamespace(status_code=200)
    monkeypatch.setattr(httpx, "AsyncClient", ClienteHttp)
    return SimpleNamespace(g=g)


async def _alta(mundo, usuario, req, **kw):
    """Un alta como la que manda la app (`Repositorio.crearCuenta`) o la web (`AltaRapida.jsx`)."""
    server._public_actions.clear()
    datos = dict(sector="autonomo", plan="autonomo", org_name=usuario.split("@")[0].title(), username=usuario, email=usuario,
                 slug=usuario.split("@")[0] + "-4821", password="12345678", zona_horaria="Europe/Madrid", pais="es", idioma="es")
    datos.update(kw)
    r = await server.register_dsp(server.RegisterRequest(**datos), req)
    for _ in range(5):
        await asyncio.sleep(0)
    return r, await mundo.g["organizations"].find_one({"slug": datos["slug"]})


def _la_app_conserva_la_sesion(r) -> bool:
    """La regla de `Cuenta.cargar()` de la app de Android, tal cual: el destino es el que se guardó con la sesión (el de
    la respuesta) o, si no hay, el del token; y la sesión de un admin solo se conserva si ese destino es «reparto»."""
    datos = server.decode_token(r.access_token)
    destino = r.app_destino or datos.get("app_destino")
    return datos.get("role") == "admin" and destino == "reparto"


# ── LA SESIÓN DEL ALTA ───────────────────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_el_alta_dentro_de_la_app_dice_a_que_portal_va_y_la_app_no_la_borra(mundo):
    r, _ = await _alta(mundo, "ana@x.es", REQ_APP, desde_app=True)
    assert r.role == "admin" and r.app_destino == "reparto"
    assert server.decode_token(r.access_token).get("app_destino") == "reparto"
    assert _la_app_conserva_la_sesion(r)


@pytest.mark.asyncio(loop_scope="session")
async def test_el_alta_de_quien_reparte_desde_la_web_tambien_lo_dice(mundo):
    """Quien se da de alta en la web y luego abre la app con esa sesión (el pase) no puede quedarse fuera."""
    r, _ = await _alta(mundo, "luis@x.es", REQ_WEB)
    assert r.app_destino == "reparto" and server.decode_token(r.access_token).get("app_destino") == "reparto"


@pytest.mark.asyncio(loop_scope="session")
async def test_el_alta_de_una_empresa_sigue_como_estaba(mundo):
    r, org = await _alta(mundo, "oficina@x.es", REQ_WEB, sector="paqueteria", plan="pro")
    assert org["sector"] == "paqueteria"
    assert r.app_destino is None and "app_destino" not in server.decode_token(r.access_token)


# ── DE DÓNDE VIENE CADA ALTA ─────────────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_la_cuenta_guarda_con_que_se_dio_de_alta(mundo):
    _, app = await _alta(mundo, "app@x.es", REQ_APP, desde_app=True)
    assert (app["alta_plataforma"], app["alta_version"]) == ("android", "2.4.6")
    _, web = await _alta(mundo, "web@x.es", REQ_WEB)
    assert (web["alta_plataforma"], web["alta_version"]) == ("web", "")
    _, ios = await _alta(mundo, "ios@x.es", REQ_WEB, desde_ios=True)
    assert (ios["alta_plataforma"], ios["alta_version"]) == ("ios_app", "")
    # Una app vieja que dice `desde_app` y no manda la cabecera: Android, sin versión.
    _, vieja = await _alta(mundo, "vieja@x.es", REQ_WEB, desde_app=True)
    assert (vieja["alta_plataforma"], vieja["alta_version"]) == ("android", "")


@pytest.mark.asyncio(loop_scope="session")
async def test_el_origen_del_alta_se_guarda_limpio_y_solo_lo_que_toca(mundo):
    _, org = await _alta(mundo, "meta@x.es", REQ_WEB, origen={
        "utm_source": " Facebook ", "utm_campaign": "rep_invita10", "utm_content": "spot5", "entrada": "/repartidores",
        "referrer": "https://l.facebook.com/", "utm_medium": "juan@correo.es <script>", "ref": "ABC123",
        "otra_cosa": "no entra", "utm_term": 7})
    assert org["alta_origen"] == {
        "utm_source": "facebook", "utm_campaign": "rep_invita10", "utm_content": "spot5", "entrada": "/repartidores",
        "referrer": "https://l.facebook.com/", "utm_medium": "juancorreo.esscript", "ref": "abc123"}
    # Largo: se recorta a 80. Sin nada útil: no se guarda la clave.
    _, largo = await _alta(mundo, "largo@x.es", REQ_WEB, origen={"utm_campaign": "a" * 300, "utm_source": "  "})
    assert largo["alta_origen"] == {"utm_campaign": "a" * 80}
    for i, vacio in enumerate((None, {}, {"otra": "x"})):
        _, org = await _alta(mundo, f"nada{i}@x.es", REQ_WEB, origen=vacio)
        assert "alta_origen" not in org


def test_alta_origen_no_se_fia_de_lo_que_llega():
    assert server._alta_origen("texto") == {} and server._alta_origen(["utm_source"]) == {} and server._alta_origen(None) == {}
    assert server._alta_origen({"utm_source": ["facebook"], "ref": {"a": 1}}) == {}
