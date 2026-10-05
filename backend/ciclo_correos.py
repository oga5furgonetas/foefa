# -*- coding: utf-8 -*-
"""Correos a quien reparte solo, del alta al final de la prueba (05-10-2026).

POR QUÉ. Medido el 05-10: de los repartidores que se dieron de alta, casi
ninguno cargó una sola parada (Guilherme y Juanjo, 0). Se registraban de noche
desde un anuncio, cerraban el móvil y no volvían. Lo que se hace aquí es lo que
haría alguien que lleva la app y se fija en cada alta:

  · «bienvenida» — al darse de alta. Los tres pasos para la primera ruta con los
    nombres REALES de los botones, y lo que de verdad pasa al acabar la prueba
    (el correo de antes decía «se cobra salvo cancelación» a quien no había
    metido ninguna tarjeta: era falso).
  · «primer_dia» — entre 20 y 72 h después, SOLO si no ha cargado ninguna
    parada suya (las de ejemplo no cuentan). Corto y personal: ¿te ayudo?
  · «casi_fin» — cuando quedan 2 días o menos de prueba. Lo que lleva hecho,
    cuándo acaba y que no se cobra nada solo.

Reglas que no se rompen:
  · Uno por persona y clave, nunca dos (el servidor lo marca ANTES de mandar).
  · Nunca dos correos del ciclo en menos de 18 h (la bienvenida aparte).
  · Quien se da de baja no recibe ninguno más (`correos_baja`).
  · Ni cifras ni testimonios inventados: solo lo que la cuenta ha hecho.

El módulo no toca la base ni manda nada: decide QUÉ toca y DEVUELVE el texto.
Así se prueba entero sin red ni Mongo (tests/test_ciclo_correos.py).
"""
import html as _html
from datetime import datetime, timedelta, timezone

CLAVES = ("bienvenida", "primer_dia", "casi_fin")
IDIOMAS = ("es", "pt", "en")
SEPARACION = timedelta(hours=18)
BIENVENIDA_HASTA = timedelta(hours=2)      # si falló al darse de alta, se reintenta hasta aquí
PRIMER_DIA_DESDE = timedelta(hours=20)
PRIMER_DIA_HASTA = timedelta(hours=72)
CASI_FIN_ANTES = timedelta(days=2)
CASI_FIN_EDAD_MIN = timedelta(days=3)      # una prueba corta no recibe dos correos seguidos

_PAISES_PT = {"pt", "br", "ao", "mz", "cv"}
_PAISES_ES = {"es", "mx", "ar", "co", "cl", "pe", "ve", "ec", "bo", "py", "uy", "cr", "pa",
              "gt", "hn", "sv", "ni", "do", "pr", "cu", "gq"}


def _fecha(v):
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    try:
        d = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def idioma_de(org: dict) -> str:
    """El idioma que eligió en la app; si no consta, el de su país; si no, español."""
    i = str((org or {}).get("idioma") or "").lower()[:2]
    if i in IDIOMAS:
        return i
    pais = str((org or {}).get("pais") or "").lower()
    if pais in _PAISES_PT:
        return "pt"
    if not pais or pais in _PAISES_ES:
        return "es"
    return "en"


def es_candidata(org: dict) -> bool:
    """Reparte solo, sigue en prueba, tiene correo y no se ha dado de baja."""
    o = org or {}
    return ((o.get("sector") == "autonomo" or o.get("plan") == "autonomo")
            and o.get("status") == "trial" and bool(o.get("email"))
            and not o.get("correos_baja"))


def toca(org: dict, uso: dict, ahora: datetime) -> str:
    """La clave del correo que toca mandar AHORA, o "" si ninguno."""
    if not es_candidata(org):
        return ""
    enviados = org.get("ciclo_correos") or {}
    alta = _fecha(org.get("created_at"))
    if not alta:
        return ""
    edad = ahora - alta
    if "bienvenida" not in enviados and edad <= BIENVENIDA_HASTA:
        return "bienvenida"
    ultimos = [_fecha((v or {}).get("at")) for k, v in enviados.items() if k != "bienvenida"]
    ultimos = [u for u in ultimos if u]
    if ultimos and ahora - max(ultimos) < SEPARACION:
        return ""
    if ("primer_dia" not in enviados and PRIMER_DIA_DESDE <= edad <= PRIMER_DIA_HASTA
            and not (uso or {}).get("paradas")):
        return "primer_dia"
    fin = _fecha(org.get("trial_ends"))
    if ("casi_fin" not in enviados and fin and timedelta(0) < fin - ahora <= CASI_FIN_ANTES
            and edad >= CASI_FIN_EDAD_MIN):
        return "casi_fin"
    return ""


# ── LOS TEXTOS ──────────────────────────────────────────────────────────────
# En texto plano con {marcas}; el HTML sale de aquí mismo (escapado), así el
# correo y su versión en texto dicen exactamente lo mismo.

_T = {
    "es": {
        "bienvenida": (
            "Tu cuenta de {marca} está lista: así cargas tu primera ruta",
            "Hola {nombre}:\n\n"
            "Ya tienes tu cuenta. Tienes {dias} días gratis y no te hemos pedido tarjeta, así que al acabar "
            "la prueba no se cobra nada solo. Si quieres seguir, lo eliges tú ({mes} al mes o {anio} al año).\n\n"
            "Tu primera ruta, en 3 pasos:\n"
            "1. Abre la app: {ruta}\n"
            "   En el móvil, «Instalar la app» te la deja en la pantalla de inicio.\n"
            "2. Pulsa «Cargar paquetes: uno tras otro» y haz una foto a la etiqueta de cada paquete. "
            "La dirección entra sola; si alguna no se lee, la escribes.\n"
            "3. Pulsa «Montar ruta y empezar»: te ordena las paradas y te lleva a cada puerta.\n\n"
            "¿Sin paquetes a mano? Dentro de la app, «Verlo en acción con 3 paradas de ejemplo».\n\n"
            "{ayuda}"),
        "primer_dia": (
            "¿Te ayudo con tu primera ruta?",
            "Hola {nombre}:\n\n"
            "Ayer creaste tu cuenta en {marca} y todavía no has cargado ninguna parada. "
            "Si te quedaste a medias, lo más rápido es:\n\n"
            "1. Abre {ruta}\n"
            "2. «Cargar paquetes: uno tras otro» y una foto a cada etiqueta.\n"
            "3. «Montar ruta y empezar».\n\n"
            "Te quedan {quedan} días de prueba.\n\n"
            "{ayuda_corta}"),
        "casi_fin": (
            "Te quedan {quedan} días de prueba en {marca}",
            "Hola {nombre}:\n\n"
            "{hecho}"
            "Tu prueba gratis acaba el {fin}. No se cobra nada solo: si quieres seguir, entra en la app, "
            "pestaña «Cuenta», y elige {mes} al mes o {anio} al año. Si no, no pagas nada.\n\n"
            "Cuenta: {cuenta}\n\n"
            "{ayuda_corta}"),
        "hecho_si": "En estos días has cargado {paradas} paradas{entregas}.\n\n",
        "entregas": " y entregado {n}",
        "hecho_no": "Todavía no has cargado ninguna parada: aún estás a tiempo de probarla con tu ruta de verdad ({ruta}).\n\n",
        "ayuda": "Si algo no te funciona o te falta algo para tu reparto, contesta a este correo: lo leo yo.",
        "ayuda_sin": "Consejo: haz la primera prueba con 3 o 4 paquetes antes de salir; en dos minutos ves si te sirve.",
        "ayuda_corta": "¿Qué te frenó o qué le falta? Contéstame con una línea y lo miro.",
        "ayuda_corta_sin": "Si no tienes paquetes a mano, dentro de la app puedes verla funcionar con 3 paradas de ejemplo.",
        "firma": "Daniel, de {marca}",
        "baja": "¿No quieres más correos como este? Date de baja aquí: {baja}",
        "boton": {"bienvenida": "Abrir la app", "primer_dia": "Cargar mi primera ruta", "casi_fin": "Ver mi cuenta"},
    },
    "pt": {
        "bienvenida": (
            "A tua conta {marca} está pronta: assim carregas a tua primeira rota",
            "Olá {nombre}:\n\n"
            "Já tens a tua conta. Tens {dias} dias grátis e não te pedimos cartão, por isso no fim do teste "
            "não é cobrado nada automaticamente. Se quiseres continuar, és tu que escolhes ({mes} por mês ou {anio} por ano).\n\n"
            "A tua primeira rota, em 3 passos:\n"
            "1. Abre a app: {ruta}\n"
            "   No telemóvel, «Instalar a app» deixa-a no ecrã inicial.\n"
            "2. Carrega em «Carregar volumes: um após outro» e tira uma foto à etiqueta de cada volume. "
            "A morada entra sozinha; se alguma não se ler, escreves.\n"
            "3. Carrega em «Montar rota e começar»: ordena as paragens e leva-te a cada porta.\n\n"
            "Sem volumes à mão? Dentro da app, «Ver em ação com 3 paragens de exemplo».\n\n"
            "{ayuda}"),
        "primer_dia": (
            "Ajudo-te com a tua primeira rota?",
            "Olá {nombre}:\n\n"
            "Ontem criaste a tua conta na {marca} e ainda não carregaste nenhuma paragem. "
            "Se ficaste a meio, o mais rápido é:\n\n"
            "1. Abre {ruta}\n"
            "2. «Carregar volumes: um após outro» e uma foto a cada etiqueta.\n"
            "3. «Montar rota e começar».\n\n"
            "Ainda tens {quedan} dias de teste.\n\n"
            "{ayuda_corta}"),
        "casi_fin": (
            "Faltam {quedan} dias do teu teste na {marca}",
            "Olá {nombre}:\n\n"
            "{hecho}"
            "O teu teste grátis acaba a {fin}. Não é cobrado nada automaticamente: se quiseres continuar, entra na app, "
            "separador «Conta», e escolhe {mes} por mês ou {anio} por ano. Se não, não pagas nada.\n\n"
            "Conta: {cuenta}\n\n"
            "{ayuda_corta}"),
        "hecho_si": "Nestes dias carregaste {paradas} paragens{entregas}.\n\n",
        "entregas": " e entregaste {n}",
        "hecho_no": "Ainda não carregaste nenhuma paragem: ainda vais a tempo de a testar com a tua rota real ({ruta}).\n\n",
        "ayuda": "Se algo não funcionar ou te faltar alguma coisa, responde a este e-mail: sou eu que leio.",
        "ayuda_sin": "Dica: faz o primeiro teste com 3 ou 4 volumes antes de sair; em dois minutos vês se te serve.",
        "ayuda_corta": "O que te travou ou o que falta? Responde-me numa linha e eu vejo.",
        "ayuda_corta_sin": "Se não tens volumes à mão, dentro da app podes vê-la a funcionar com 3 paragens de exemplo.",
        "firma": "Daniel, da {marca}",
        "baja": "Não queres mais e-mails como este? Cancela aqui: {baja}",
        "boton": {"bienvenida": "Abrir a app", "primer_dia": "Carregar a minha primeira rota", "casi_fin": "Ver a minha conta"},
    },
    "en": {
        "bienvenida": (
            "Your {marca} account is ready: here's how to load your first route",
            "Hi {nombre},\n\n"
            "Your account is ready. You have {dias} free days and we didn't ask for a card, so nothing is "
            "charged automatically when the trial ends. If you want to keep going, you choose ({mes} a month or {anio} a year).\n\n"
            "Your first route in 3 steps:\n"
            "1. Open the app: {ruta}\n"
            "   On your phone, «Install the app» puts it on your home screen.\n"
            "2. Tap «Load parcels: one after another» and take a photo of each parcel's label. "
            "The address goes in by itself; if one can't be read, type it.\n"
            "3. Tap «Build route and start»: it orders your stops and takes you to each door.\n\n"
            "No parcels at hand? Inside the app, «See it in action with 3 sample stops».\n\n"
            "{ayuda}"),
        "primer_dia": (
            "Can I help with your first route?",
            "Hi {nombre},\n\n"
            "You created your {marca} account yesterday and haven't loaded any stops yet. "
            "If you got stuck, the quickest way is:\n\n"
            "1. Open {ruta}\n"
            "2. «Load parcels: one after another» and a photo of each label.\n"
            "3. «Build route and start».\n\n"
            "You have {quedan} trial days left.\n\n"
            "{ayuda_corta}"),
        "casi_fin": (
            "{quedan} days left in your {marca} trial",
            "Hi {nombre},\n\n"
            "{hecho}"
            "Your free trial ends on {fin}. Nothing is charged automatically: to keep going, open the app, "
            "«Account» tab, and choose {mes} a month or {anio} a year. Otherwise you pay nothing.\n\n"
            "Account: {cuenta}\n\n"
            "{ayuda_corta}"),
        "hecho_si": "So far you've loaded {paradas} stops{entregas}.\n\n",
        "entregas": " and delivered {n}",
        "hecho_no": "You haven't loaded any stops yet: there's still time to try it with your real route ({ruta}).\n\n",
        "ayuda": "If something doesn't work or you're missing something, just reply to this email: I read it myself.",
        "ayuda_sin": "Tip: try it first with 3 or 4 parcels before you head out; in two minutes you'll know if it works for you.",
        "ayuda_corta": "What stopped you, or what's missing? Reply with one line and I'll look into it.",
        "ayuda_corta_sin": "No parcels at hand? Inside the app you can see it working with 3 sample stops.",
        "firma": "Daniel, {marca}",
        "baja": "Don't want emails like this? Unsubscribe here: {baja}",
        "boton": {"bienvenida": "Open the app", "primer_dia": "Load my first route", "casi_fin": "See my account"},
    },
}


def _euros(v, idioma):
    s = ("%.2f" % v).rstrip("0").rstrip(".") if isinstance(v, float) and v != int(v) else str(int(v))
    return (s.replace(".", ",") if idioma != "en" else s) + " €"


def _fin_legible(org):
    fin = _fecha(org.get("trial_ends"))
    if not fin:
        return ""
    return fin.strftime("%d/%m/%Y")


def _quedan(org, ahora):
    fin = _fecha(org.get("trial_ends"))
    if not fin:
        return 0
    return max(0, -(-(fin - ahora).total_seconds() // 86400))   # redondeo hacia arriba


def correo(clave: str, org: dict, uso: dict, ahora: datetime, *, marca: str, base: str,
           baja: str, mensual: float, anual: float, con_respuesta: bool) -> dict:
    """{asunto, texto, html} del correo `clave` para esta cuenta."""
    if clave not in CLAVES:
        raise ValueError(clave)
    idioma = idioma_de(org)
    t = _T[idioma]
    utm = "utm_source=correo&utm_medium=email&utm_campaign=ciclo&utm_content=" + clave
    ruta = f"{base}/ruta?{utm}"
    cuenta = f"{base}/ruta?tab=cuenta&{utm}"
    uso = uso or {}
    paradas, entregadas = int(uso.get("paradas") or 0), int(uso.get("entregadas") or 0)
    if paradas:
        hecho = t["hecho_si"].format(paradas=paradas,
                                     entregas=t["entregas"].format(n=entregadas) if entregadas else "")
    else:
        hecho = t["hecho_no"].format(ruta=ruta)
    alta = _fecha(org.get("created_at")) or ahora
    fin = _fecha(org.get("trial_ends")) or ahora
    dias = max(1, round((fin - alta).total_seconds() / 86400))
    nombre = (str(org.get("name") or "").strip().split(" ")[0] or "").strip()[:40]
    datos = {
        "marca": marca, "nombre": nombre, "ruta": ruta, "cuenta": cuenta,
        "dias": dias, "quedan": int(_quedan(org, ahora)), "fin": _fin_legible(org),
        "mes": _euros(mensual, idioma), "anio": _euros(anual, idioma), "hecho": hecho,
        "ayuda": t["ayuda"] if con_respuesta else t["ayuda_sin"],
        "ayuda_corta": t["ayuda_corta"] if con_respuesta else t["ayuda_corta_sin"],
    }
    asunto_m, cuerpo_m = t[clave]
    asunto = asunto_m.format(**datos)
    cuerpo = cuerpo_m.format(**datos)
    if not nombre:
        # «Hola :» queda feo: sin nombre, el saludo va sin él.
        cuerpo = cuerpo.replace(" :\n", ":\n").replace(" ,\n", ",\n")
    firma = t["firma"].format(marca=marca)
    pie = t["baja"].format(baja=baja)
    texto = f"{cuerpo}\n\n{firma}\n\n--\n{pie}"
    enlace = cuenta if clave == "casi_fin" else ruta
    return {"asunto": asunto, "texto": texto, "idioma": idioma,
            "html": _html_de(cuerpo, firma, t["boton"][clave], enlace, pie)}


def _html_de(cuerpo, firma, boton, enlace, pie):
    """Sobrio a propósito: parece un correo de una persona, no un folleto (y los
    filtros de spam lo puntúan mejor). Los enlaces del texto se hacen clicables."""
    import re

    def enlaces(texto, color):
        return re.sub(r"(https?://[^\s<]+)", r'<a href="\1" style="color:%s">\1</a>' % color, texto)

    esc = enlaces(_html.escape(cuerpo), "#0369a1").replace("\n", "<br>")
    return (
        '<div style="font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;font-size:15px;'
        'line-height:1.6;color:#111827;max-width:560px">'
        f'{esc}'
        f'<p style="margin:22px 0"><a href="{_html.escape(enlace)}" style="display:inline-block;'
        'background:#0369a1;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;'
        f'font-weight:700">{_html.escape(boton)}</a></p>'
        f'<p style="margin:0">{_html.escape(firma)}</p>'
        '<p style="margin:28px 0 0;color:#6b7280;font-size:12px">'
        f'{enlaces(_html.escape(pie), "#6b7280")}</p></div>')
