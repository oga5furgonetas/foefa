# -*- coding: utf-8 -*-
"""El acceso del conductor y la tienda (14-11-2026, tercera revisión, enlace3 hallazgos 2, 3 y 4).

  2 · Con la sesión del enlace personal no se crea la cuenta de la tienda (`POST /tienda/cuenta/vincular`): era una
      contraseña atada al conductor que seguía abriendo la tienda después de anular el enlace. 403
      `enlace_sin_contrasena`. Con la sesión de siempre (contraseña), se sigue creando.
  3 · El móvil que guardó el arranque (`movil_personal`) cuenta como teléfono: el portal no pide «¿Cuál es tu
      teléfono?» y la sesión del enlace no puede poner otro.
  4 · Un token de la TIENDA (`scope: "tienda"`, del registro público) no pasa por las rutas del portal ni del panel:
      401, también en `/auth/me` (antes 500). La tienda sigue funcionando entera con su token.

Antes de estos arreglos, las de 2, 3 y 4 fallaban (enlace3: test_tienda.py y test_enlace3.py)."""
import time

import server
from base_de_mentira import Col
from test_alta_enlace import mundo, _crear, _canjear, _mi_ficha, _sesion_admin, _h, TEL_ANA, TEL_OTRO  # noqa: F401


def _sesion_enlace(m, driver_id="d-luis", dispositivo=TEL_OTRO):
    token = _crear(m, driver_id).json()["token"]
    e = _canjear(m, token, dispositivo=dispositivo)
    assert e.status_code == 200, e.text
    return e.json()["access_token"]


# ── 2 · la cuenta de la tienda ──────────────────────────────────────────────────────────────────────────────────────

def test_la_sesion_del_enlace_no_crea_cuenta_de_tienda(mundo):
    sesion = _sesion_enlace(mundo)
    r = mundo.http.post("/api/tienda/cuenta/vincular",
                        json={"email": "intruso@ejemplo.es", "password": "intruso-1234"}, headers=_h(sesion))
    assert r.status_code == 403 and r.json()["codigo"] == "enlace_sin_contrasena", r.text
    assert mundo.a["tienda_clientes"].docs == []
    # Y nada que entre en la tienda con ese correo.
    e = mundo.http.post("/api/tienda/cuenta/entrar", json={"slug": "transportes-perez", "email": "intruso@ejemplo.es",
                                                           "password": "intruso-1234"})
    assert e.status_code == 401


def test_con_su_sesion_de_siempre_el_conductor_si_crea_su_cuenta_de_tienda(mundo):
    sesion = server.create_token("d-luis", "driver", "Luis Pérez", org_id="orga", db_name="dsp_orga",
                                 account_type="dsp", entrada=time.time() - 3600)
    r = mundo.http.post("/api/tienda/cuenta/vincular",
                        json={"email": "luis.tienda@ejemplo.es", "password": "la-de-la-tienda-1"}, headers=_h(sesion))
    assert r.status_code == 200, r.text
    assert r.json()["cliente"]["es_conductor"] is True
    assert [c["driver_id"] for c in mundo.a["tienda_clientes"].docs] == ["d-luis"]


# ── 3 · el móvil del arranque es su teléfono ────────────────────────────────────────────────────────────────────────

def test_el_movil_del_arranque_cuenta_como_telefono(mundo):
    """Ana (alta del arranque: `movil_personal`, sin `phone`): el portal no le pide el teléfono y el enlace no le pone
    otro (antes: falta_telefono true y se guardaba un `phone` distinto)."""
    sesion = _sesion_enlace(mundo, "d-ana", TEL_ANA)
    f = _mi_ficha(mundo, sesion).json()
    assert f["falta_telefono"] is False
    r = mundo.http.post("/api/portal/mi-telefono", json={"telefono": "699 999 999"}, headers=_h(sesion))
    assert r.status_code == 403 and r.json()["codigo"] == "enlace_sin_cambiar_telefono", r.text
    ana = next(d for d in mundo.a["drivers"].docs if d["id"] == "d-ana")
    assert "phone" not in ana and ana["movil_personal"] == "+34612345678"


def test_sin_ningun_telefono_se_sigue_pidiendo_y_poniendo(mundo):
    sesion = _sesion_enlace(mundo, "d-luis")
    luis = next(d for d in mundo.a["drivers"].docs if d["id"] == "d-luis")
    for campo in ("phone", "telefono", "movil_personal"):
        luis.pop(campo, None)
    assert _mi_ficha(mundo, sesion).json()["falta_telefono"] is True
    r = mundo.http.post("/api/portal/mi-telefono", json={"telefono": "699 111 222"}, headers=_h(sesion))
    assert r.status_code == 200 and luis["phone"] == "699111222"


# ── 4 · el token de la tienda ───────────────────────────────────────────────────────────────────────────────────────

def _token_tienda(m):
    r = m.http.post("/api/tienda/cuenta/registro",
                    json={"slug": "transportes-perez", "email": "cualquiera@ejemplo.es",
                          "password": "cualquiera-123", "nombre": "Cualquiera"},
                    headers={"X-Forwarded-For": "203.0.113.5"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def test_el_token_de_la_tienda_no_abre_el_portal_ni_el_panel(mundo):
    t = _token_tienda(mundo)
    mundo.a["vehicles"] = Col([{"id": "v1", "plate": "5678KLM", "status": "active", "center": "PRINCIPAL"}])
    for met, url in (("GET", "/api/auth/me"), ("GET", "/api/portal/mi-ficha"), ("GET", "/api/vehicles/portal"),
                     ("GET", "/api/auth/me/assigned-vehicle"), ("GET", "/api/drivers"), ("GET", "/api/vehicles"),
                     ("GET", "/api/conductores/accesos"), ("GET", "/api/tienda/escaparate"),
                     ("POST", "/api/portal/mi-telefono"), ("POST", "/api/auth/renovar")):
        x = mundo.http.request(met, url, headers=_h(t), json={"telefono": "699111222"} if met == "POST" else None)
        assert x.status_code == 401, (met, url, x.status_code, x.text)


def test_un_token_sin_rol_tampoco_pasa(mundo):
    from jose import jwt
    from datetime import datetime, timedelta, timezone
    t = jwt.encode({"sub": "x", "db_name": "dsp_orga", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
                   server.SECRET_KEY, algorithm=server.JWT_ALGORITHM)
    assert mundo.http.get("/api/auth/me", headers=_h(t)).status_code == 401


def test_la_tienda_sigue_funcionando_entera_con_su_token(mundo):
    t = _token_tienda(mundo)
    c = mundo.http.get("/api/tienda/cuenta", headers=_h(t))
    assert c.status_code == 200 and c.json()["via"] == "tienda" and c.json()["cliente"]["email"] == \
        "cualquiera@ejemplo.es", c.text
    a = mundo.http.post("/api/tienda/cuenta/avisos", json={"avisos": False}, headers=_h(t))
    assert a.status_code == 200 and a.json() == {"ok": True, "avisos": False}, a.text
    e = mundo.http.post("/api/tienda/cuenta/entrar", json={"slug": "transportes-perez",
                                                           "email": "cualquiera@ejemplo.es",
                                                           "password": "cualquiera-123"})
    assert e.status_code == 200 and e.json()["token"], e.text
    c2 = mundo.http.get("/api/tienda/cuenta", headers=_h(e.json()["token"]))
    assert c2.status_code == 200 and c2.json()["cliente"]["avisos"] is False
    # El conductor con su sesión de siempre sigue viendo «su» cuenta por la ficha (sin cuenta: nada).
    sesion = server.create_token("d-luis", "driver", "Luis Pérez", org_id="orga", db_name="dsp_orga",
                                 account_type="dsp", entrada=time.time() - 3600)
    assert mundo.http.get("/api/tienda/cuenta", headers=_h(sesion)).json() == {"cliente": None, "via": None}
