# -*- coding: utf-8 -*-
"""Tres menores de la tercera revisión (14-11-2026, servidor3 MENOR 2, 3 y 4).

  M2 · En una cuenta sin la IA, «@flota» en el chat de la sala y en los privados es un mensaje más: ni contesta la IA
       ni se le apunta presencia (antes guardaba «No he podido mirarlo…» y la sacaba en la sala 60 minutos). Una
       cuenta de siempre (sin el campo `ia_danos`) sigue igual.
  M3 · `total_con_repaso` casa por la pieza FINA: dos puertas distintas en la misma foto son dos daños (antes, uno).
  M4 · `_repaso_avisar` apunta la base como mirada DESPUÉS de que la consulta conteste: si fallaba, el número del menú
       se quedaba apagado hasta reiniciar.

Antes de estos arreglos fallaban las de M2 (presencia y mensaje de la IA), M3 (1 en vez de 2) y M4."""
import pytest

import server
from base_de_mentira import Col
from test_tanda3_servidor_ia import gemini, base  # noqa: F401
from test_perito_ia import ADMIN_NUEVA, ADMIN_VIEJA


@pytest.fixture
def chat(monkeypatch, base):
    async def si(*a, **k):
        return True

    async def nada(*a, **k):
        return None
    monkeypatch.setattr(server, "_chat_room_can_access", si)
    monkeypatch.setattr(server, "push_center_event", nada)
    monkeypatch.setattr(server, "_push_enabled", False, raising=False)
    base["chat_messages"] = Col([])
    base["chat_ia_presencia"] = Col([])
    base["chat_dm"] = Col([])
    llamadas = []

    async def pensar(center, texto, user, hilo=None, **k):
        llamadas.append(hilo)
        return "Respuesta de prueba", None
    monkeypatch.setattr(server, "_ia_pensar", pensar)
    return llamadas


# ── M2 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_sala_con_arroba_sin_ia_no_habla_la_ia_ni_se_apunta_presencia(chat, base, gemini):
    r = await server.chat_post("OGA5", {"text": "@flota ¿quién lleva la 5678 KLM hoy?"}, user=ADMIN_NUEVA)
    assert r["respuesta_ia"] is None and chat == [] and gemini == []
    assert base["chat_ia_presencia"].docs == []
    assert [m["text"] for m in base["chat_messages"].docs] == ["@flota ¿quién lleva la 5678 KLM hoy?"]


@pytest.mark.asyncio(loop_scope="session")
async def test_sala_con_arroba_en_una_cuenta_de_siempre_sigue_igual(chat, base):
    r = await server.chat_post("OGA5", {"text": "@flota ¿quién lleva la 5678 KLM hoy?"}, user=ADMIN_VIEJA)
    assert chat == ["sala:OGA5"] and r["respuesta_ia"] and r["respuesta_ia"]["text"] == "Respuesta de prueba"


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("quien,habla", [(ADMIN_NUEVA, False), (ADMIN_VIEJA, True)])
async def test_privado_con_arroba_solo_habla_la_ia_si_la_cuenta_la_tiene(chat, base, gemini, monkeypatch, quien,
                                                                         habla):
    from base_de_mentira import Db
    g = Db()
    g["admin_users"] = Col([{"id": "a9", "name": "Pepa G.", "org_id": quien["org_id"]}])
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "_mensajes_org", lambda u: u.get("org_id"))

    async def centro(*a, **k):
        return "OGA5"
    monkeypatch.setattr(server, "_ia_centro_de", centro)
    r = await server.mensajes_enviar("a9", {"texto": "@flota ¿qué furgonetas tienen la ITV cerca?"}, user=quien)
    assert [m["texto"] for m in base["chat_dm"].docs][:1] == ["@flota ¿qué furgonetas tienen la ITV cerca?"]
    assert bool(r.get("respuesta_ia")) is habla and bool(chat) is habla
    assert gemini == []


# ── M3 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

def _golpe(part, pi=3):
    return {"part": part, "severity": "grave", "photo_index": pi, "origen": "repaso", "golpe_id": "g-" + part}


def test_dos_puertas_distintas_en_la_misma_foto_son_dos_danos():
    an = {"severity": "leve", "total_damages_count": 1,
          "damages": [{"part": "Puerta delantera izquierda", "severity": "leve", "photo_index": 3},
                      _golpe("Puerta lateral corredera izquierda")]}
    r = server._repaso_totales(an)
    assert r["total_con_repaso"] == 2 and r["severidad_con_repaso"] == "grave"


def test_la_misma_pieza_dicha_de_dos_formas_es_un_dano():
    an = {"severity": "leve", "total_damages_count": 1,
          "damages": [{"part": "Puerta corredera izq", "severity": "leve", "photo_index": 3},
                      _golpe("Puerta lateral corredera izquierda")]}
    assert server._repaso_totales(an)["total_con_repaso"] == 1
    # En otra foto, otro daño.
    an["damages"][1] = _golpe("Puerta lateral corredera izquierda", pi=4)
    assert server._repaso_totales(an)["total_con_repaso"] == 2


def test_una_pieza_que_no_se_reconoce_casa_solo_consigo_misma():
    an = {"severity": "leve", "total_damages_count": 1,
          "damages": [{"part": "Rear door", "severity": "leve", "photo_index": 3}, _golpe("Rear door"),
                      {**_golpe("Side panel"), "golpe_id": "g2"}]}
    assert server._repaso_totales(an)["total_con_repaso"] == 2


# ── M4 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_si_la_consulta_falla_se_vuelve_a_mirar_la_proxima_vez(monkeypatch, base):
    monkeypatch.setattr(server, "_REPASO_MIRADO", set())
    monkeypatch.setattr(server, "_REPASO_USADO", set())
    base["app_meta"] = Col([])
    veces = []

    class Lenta(Col):
        async def find_one(self, q=None, *a, **k):
            if "repaso.lados" in (q or {}):
                veces.append(1)
                if len(veces) == 1:
                    raise TimeoutError("Mongo no contesta")
            return await super().find_one(q, *a, **k)
    base["inspections"] = Lenta([{"id": "r1", "repaso": {"lados": {"1": {"veredicto": "igual"}}}}])
    with pytest.raises(TimeoutError):
        await server._repaso_avisar(ADMIN_VIEJA)
    assert await server._repaso_avisar(ADMIN_VIEJA) is True
    assert len(veces) == 2
