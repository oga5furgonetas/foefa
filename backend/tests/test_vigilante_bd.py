# -*- coding: utf-8 -*-
"""El vigilante de la base (23-10-2026): cuándo avisa y cuándo calla.

Dos caídas de la base en ocho días sin que nadie se enterase hasta un día después.
Aquí se prueba la decisión (pura) y el aviso con Telegram cacheado y correo."""
import asyncio

import server

H = 3600.0


def _secuencia(resultados, paso=60.0, t0=1000.0):
    """Aplica una lista de pings (True/False) y devuelve los avisos que salen, con su momento."""
    estado, salida, t = {}, [], t0
    for ok in resultados:
        tipo = server._vigilante_decide(estado, ok, t)
        if tipo:
            salida.append((tipo, round(t - t0)))
        t += paso
    return estado, salida


def test_un_fallo_suelto_no_es_nada():
    estado, avisos = _secuencia([True, False, True, False, True])
    assert avisos == []
    assert estado["fallos"] == 0 and estado["caida_desde"] is None


def test_tres_fallos_seguidos_avisan_una_vez_y_luego_cada_seis_horas():
    pings = [True] + [False] * 400     # 400 minutos caída
    estado, avisos = _secuencia(pings)
    assert avisos[0] == ("caida", 180)             # al tercer fallo (minuto 3)
    assert avisos[1] == ("recordatorio", 180 + 6 * 3600)
    assert len(avisos) == 2
    assert estado["caida_desde"] == 1000.0 + 180


def test_cuando_vuelve_lo_dice_y_queda_limpio():
    estado, avisos = _secuencia([False, False, False, False, True, True])
    assert [a for a, _ in avisos] == ["caida", "vuelta"]
    assert estado == {"fallos": 0, "caida_desde": None, "avisado_en": None}
    # Una segunda caída avisa otra vez desde cero.
    for _ in range(3):
        tipo = server._vigilante_decide(estado, False, 99999.0)
    assert tipo == "caida"


def test_el_texto_dice_cuanto_lleva_y_que_mirar():
    estado = {"caida_desde": 0.0}
    asunto, texto = server._vigilante_texto("caida", estado, "ServerSelectionTimeoutError: x", 25 * 60.0)
    assert "25 min" in asunto and "NO contesta" in asunto
    assert "fly status -a flota-mongo" in texto and "ServerSelectionTimeoutError" in texto
    asunto, _ = server._vigilante_texto("vuelta", estado, "", 30 * 60.0)
    assert "ha vuelto" in asunto


def test_avisa_por_telegram_cacheado_y_por_correo(monkeypatch):
    """Con la base caída no se puede leer la configuración de Telegram: se usa la cacheada."""
    mandado = []

    async def tg(config, texto):
        mandado.append(("tg", config.get("bot_token"), texto[:20]))
        return True

    async def mail(to, subject, html, **kw):
        mandado.append(("mail", to, subject[:12]))
        return True

    monkeypatch.setattr(server, "_telegram_enviar", tg)
    monkeypatch.setattr(server, "_enviar_email", mail)
    monkeypatch.setattr(server, "CORREO_CONTACTO", "avisos@ejemplo.test")
    server._TG_CACHE.clear()
    server._TG_CACHE.update({"enabled": True, "bot_token": "t0k", "chat_ids": ["1"]})
    asyncio.run(server._vigilante_avisar("caida", {"caida_desde": 0.0}, "x", 600.0))
    assert [m for m in mandado if m[0] == "tg" and m[1] == "t0k" and m[2].startswith("<b>🚨")]
    assert [m for m in mandado if m[0] == "mail" and m[1] == "avisos@ejemplo.test" and m[2].startswith("🚨")]


def test_el_ping_refresca_la_cache_de_telegram(monkeypatch):
    class Admin:
        async def command(self, *_):
            return {"ok": 1}

    class Cliente:
        admin = Admin()

    class Col:
        async def find_one(self, *_, **__):
            return {"enabled": True, "bot_token": "nuevo", "chat_ids": ["7"]}

    class DbFalso:
        telegram_config = Col()

    monkeypatch.setattr(server, "client", Cliente())
    monkeypatch.setattr(server, "db", DbFalso())
    server._TG_CACHE.clear()
    ok, error = asyncio.run(server._vigilante_ping())
    assert ok and error == ""
    assert server._TG_CACHE["bot_token"] == "nuevo"
