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
  · «recordatorio» (11-10-2026) — entre el día 3 y el 8, si SIGUE sin cargar
    ninguna parada: muchos se dan de alta en fin de semana y el lunes ya no se
    acuerdan. Los tres pasos otra vez y lo que le ahorra (manos libres, su dinero).
  · «invita» (11-10-2026) — cuando ya lleva 10 entregas de verdad (direcciones
    distintas y repartidas en el día, como cuenta «Invita y gana»: marcar 11 en 20
    minutos a medianoche es probar, no repartir). Su enlace y las condiciones exactas.

Reglas que no se rompen:
  · Uno por persona y clave, nunca dos (el servidor lo marca ANTES de mandar).
  · Nunca dos correos del ciclo en menos de 18 h (la bienvenida aparte).
  · Quien se da de baja no recibe ninguno más (`correos_baja`).
  · Ni cifras ni testimonios inventados: solo lo que la cuenta ha hecho.

El módulo no toca la base ni manda nada: decide QUÉ toca y DEVUELVE el texto.
Así se prueba entero sin red ni Mongo (tests/test_ciclo_correos.py).
"""
import html as _html
import re
from datetime import datetime, timedelta, timezone

CLAVES = ("bienvenida", "primer_dia", "casi_fin", "recordatorio", "invita")
IDIOMAS = ("es", "pt", "en")
SEPARACION = timedelta(hours=18)
BIENVENIDA_HASTA = timedelta(hours=2)      # si falló al darse de alta, se reintenta hasta aquí
PRIMER_DIA_DESDE = timedelta(hours=20)
PRIMER_DIA_HASTA = timedelta(hours=72)
CASI_FIN_ANTES = timedelta(days=2)
CASI_FIN_EDAD_MIN = timedelta(days=3)      # una prueba corta no recibe dos correos seguidos
RECORDATORIO_DESDE = timedelta(days=3)
RECORDATORIO_HASTA = timedelta(days=8)
INVITA_ENTREGAS = 10                       # entregas suyas (no de ejemplo) para pedirle que invite

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


def _reales(uso: dict) -> int:
    """Entregas de reparto de verdad (las que cuenta «Invita y gana»); si no se sabe, todas."""
    u = uso or {}
    return int(u.get("entregadas_reales", u.get("entregadas")) or 0)


def toca(org: dict, uso: dict, ahora: datetime, promo: bool = False) -> str:
    """La clave del correo que toca mandar AHORA, o "" si ninguno. Con la promoción
    «gratis y sin límite» activa no hay «se acaba tu prueba»: no se acaba nada."""
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
    if ("recordatorio" not in enviados and RECORDATORIO_DESDE <= edad <= RECORDATORIO_HASTA
            and not (uso or {}).get("paradas")):
        return "recordatorio"
    if ("invita" not in enviados and _reales(uso) >= INVITA_ENTREGAS
            and str(org.get("pais") or "es").lower() != "cn"):        # en China no hay cómo pagar
        return "invita"
    fin = _fecha(org.get("trial_ends"))
    if promo:
        return ""
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
            "{intro}"
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
            "¿Hoy no tienes paquetes? En la app, «Verlo en acción con 3 paradas de ejemplo».\n\n"
            "{plazo}\n\n"
            "{ayuda_corta}"),
        "casi_fin": (
            "Te quedan {quedan} días de prueba en {marca}",
            "Hola {nombre}:\n\n"
            "{hecho}"
            "Tu prueba gratis acaba el {fin}. No se cobra nada solo: si quieres seguir, entra en la app, "
            "pestaña «Cuenta», y elige {mes} al mes o {anio} al año. Si no, no pagas nada.\n\n"
            "Cuenta: {cuenta}\n\n"
            "{ayuda_corta}"),
        "recordatorio": (
            "¿Repartes esta semana? Tu ruta, lista en 2 minutos",
            "Hola {nombre}:\n\n"
            "Hace unos días creaste tu cuenta en {marca} y todavía no has metido ningún paquete. "
            "Cuando tengas la ruta delante, es así de rápido:\n\n"
            "1. Abre {ruta}\n"
            "2. «Cargar paquetes: uno tras otro» y una foto a cada etiqueta: la dirección entra sola.\n"
            "3. «Montar ruta y empezar»: te ordena las paradas por tiempo y te guía con voz.\n\n"
            "Y dos cosas que te ahorran tiempo: «Manos libres» (en Android dices \"entregado\" y sigues "
            "conduciendo) y «Mi dinero hoy» (cuánto llevas ganado y lo que se va en gasolina).\n\n"
            "{plazo}\n\n"
            "{ayuda_corta}"),
        "invita": (
            "Llevas {entregadas} entregas con {marca}: ¿se la pasas a un compañero?",
            "Hola {nombre}:\n\n"
            "Ya llevas {entregadas} entregas con {marca}. Si conoces a otro repartidor al que le pueda servir, "
            "pásale tu enlace:\n\n"
            "{invita}\n\n"
            "Cuando se registre y haga 20 entregas en 2 días distintos (en su primer mes), ganas {euros} por "
            "cada uno. Lo cobras por {cobro} desde {minimo}. Tu enlace, tu QR y las condiciones están en la app, "
            "pestaña «Cuenta»: {cuenta}\n\n"
            "{ayuda_invita}"),
        "cobro_es": "Bizum o transferencia",
        "ayuda_invita": "¿Le falta algo a la app para tu reparto? Contéstame con una línea y lo miro.",
        "ayuda_invita_sin": "Gracias por usarla.",
        "cobro_fuera": "PayPal",
        "hecho_si": "En estos días has cargado {paradas} paradas{entregas}.\n\n",
        "entregas": " y entregado {n}",
        "hecho_no": "Todavía no has cargado ninguna parada: aún estás a tiempo de probarla con tu ruta de verdad ({ruta}).\n\n",
        "ayuda": "Si algo no te funciona o te falta algo para tu reparto, contesta a este correo: lo leo yo.",
        "ayuda_sin": "Consejo: haz la primera prueba con 3 o 4 paquetes antes de salir; en dos minutos ves si te sirve.",
        "ayuda_corta": "¿Qué te frenó o qué le falta? Contéstame con una línea y lo miro.",
        "ayuda_corta_sin": "Si no tienes paquetes a mano, dentro de la app puedes verla funcionar con 3 paradas de ejemplo.",
        "intro": (
            "Ya tienes tu cuenta. Tienes {dias} días gratis y no te hemos pedido tarjeta, así que al acabar "
            "la prueba no se cobra nada solo. Si quieres seguir, lo eliges tú ({mes} al mes o {anio} al año).\n\n"),
        "plazo": "Te quedan {quedan} días de prueba.",
        "plazo_promo": "Recuerda: es gratis y sin límite hasta el {promo}.",
        "intro_promo": (
            "Ya tienes tu cuenta. Es gratis y sin límite hasta el {promo} y no te hemos pedido tarjeta. "
            "Después sigues gratis con hasta {tope} paradas al día; sin tope, {mes} al mes o {anio} al año, "
            "solo si tú quieres.\n\n"),
        "firma": "Daniel, de {marca}",
        "baja": "¿No quieres más correos como este? Date de baja aquí: {baja}",
        "boton": {"bienvenida": "Abrir la app", "primer_dia": "Cargar mi primera ruta", "casi_fin": "Ver mi cuenta",
                  "recordatorio": "Cargar mi ruta", "invita": "Ver mi enlace y mi QR"},
    },
    "pt": {
        "bienvenida": (
            "A tua conta {marca} está pronta: assim carregas a tua primeira rota",
            "Olá {nombre}:\n\n"
            "{intro}"
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
            "Hoje não tens volumes? Na app, «Ver em ação com 3 paragens de exemplo».\n\n"
            "{plazo}\n\n"
            "{ayuda_corta}"),
        "casi_fin": (
            "Faltam {quedan} dias do teu teste na {marca}",
            "Olá {nombre}:\n\n"
            "{hecho}"
            "O teu teste grátis acaba a {fin}. Não é cobrado nada automaticamente: se quiseres continuar, entra na app, "
            "separador «Conta», e escolhe {mes} por mês ou {anio} por ano. Se não, não pagas nada.\n\n"
            "Conta: {cuenta}\n\n"
            "{ayuda_corta}"),
        "recordatorio": (
            "Vais distribuir esta semana? A tua rota pronta em 2 minutos",
            "Olá {nombre}:\n\n"
            "Há uns dias criaste a tua conta na {marca} e ainda não carregaste nenhum volume. "
            "Quando tiveres a rota à frente, é assim de rápido:\n\n"
            "1. Abre {ruta}\n"
            "2. «Carregar volumes: um após outro» e uma foto a cada etiqueta: a morada entra sozinha.\n"
            "3. «Montar rota e começar»: ordena as paragens por tempo e guia-te por voz.\n\n"
            "E duas coisas que te poupam tempo: «Mãos livres» (no Android dizes \"entregue\" e continuas a "
            "conduzir) e «O meu dinheiro hoje» (quanto já ganhaste e o que vai em combustível).\n\n"
            "{plazo}\n\n"
            "{ayuda_corta}"),
        "invita": (
            "Já levas {entregadas} entregas com a {marca}: passas a um colega?",
            "Olá {nombre}:\n\n"
            "Já levas {entregadas} entregas com a {marca}. Se conheces outro estafeta a quem possa servir, "
            "passa-lhe o teu link:\n\n"
            "{invita}\n\n"
            "Quando se registar e fizer 20 entregas em 2 dias diferentes (no primeiro mês), ganhas {euros} por "
            "cada um. Recebes por {cobro} a partir de {minimo}. O teu link, o teu QR e as condições estão na app, "
            "separador «Conta»: {cuenta}\n\n"
            "{ayuda_invita}"),
        "cobro_es": "Bizum ou transferência",
        "ayuda_invita": "Falta alguma coisa à app para a tua distribuição? Responde-me com uma linha e eu vejo.",
        "ayuda_invita_sin": "Obrigado por a usares.",
        "cobro_fuera": "PayPal",
        "hecho_si": "Nestes dias carregaste {paradas} paragens{entregas}.\n\n",
        "entregas": " e entregaste {n}",
        "hecho_no": "Ainda não carregaste nenhuma paragem: ainda vais a tempo de a testar com a tua rota real ({ruta}).\n\n",
        "ayuda": "Se algo não funcionar ou te faltar alguma coisa, responde a este e-mail: sou eu que leio.",
        "ayuda_sin": "Dica: faz o primeiro teste com 3 ou 4 volumes antes de sair; em dois minutos vês se te serve.",
        "ayuda_corta": "O que te travou ou o que falta? Responde-me numa linha e eu vejo.",
        "ayuda_corta_sin": "Se não tens volumes à mão, dentro da app podes vê-la a funcionar com 3 paragens de exemplo.",
        "intro": (
            "Já tens a tua conta. Tens {dias} dias grátis e não te pedimos cartão, por isso no fim do teste "
            "não é cobrado nada automaticamente. Se quiseres continuar, és tu que escolhes ({mes} por mês ou {anio} por ano).\n\n"),
        "plazo": "Ainda tens {quedan} dias de teste.",
        "plazo_promo": "Lembra-te: é grátis e sem limite até {promo}.",
        "intro_promo": (
            "Já tens a tua conta. É grátis e sem limite até {promo} e não te pedimos cartão. "
            "Depois continuas grátis com até {tope} paragens por dia; sem limite, {mes} por mês ou {anio} por ano, "
            "só se quiseres.\n\n"),
        "firma": "Daniel, da {marca}",
        "baja": "Não queres mais e-mails como este? Cancela aqui: {baja}",
        "boton": {"bienvenida": "Abrir a app", "primer_dia": "Carregar a minha primeira rota", "casi_fin": "Ver a minha conta",
                  "recordatorio": "Carregar a minha rota", "invita": "Ver o meu link e o meu QR"},
    },
    "en": {
        "bienvenida": (
            "Your {marca} account is ready: here's how to load your first route",
            "Hi {nombre},\n\n"
            "{intro}"
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
            "No parcels today? In the app, «See it in action with 3 sample stops».\n\n"
            "{plazo}\n\n"
            "{ayuda_corta}"),
        "casi_fin": (
            "{quedan} days left in your {marca} trial",
            "Hi {nombre},\n\n"
            "{hecho}"
            "Your free trial ends on {fin}. Nothing is charged automatically: to keep going, open the app, "
            "«Account» tab, and choose {mes} a month or {anio} a year. Otherwise you pay nothing.\n\n"
            "Account: {cuenta}\n\n"
            "{ayuda_corta}"),
        "recordatorio": (
            "Delivering this week? Your route ready in 2 minutes",
            "Hi {nombre},\n\n"
            "A few days ago you created your {marca} account and you haven't loaded any parcels yet. "
            "When you have your route in front of you, it's this quick:\n\n"
            "1. Open {ruta}\n"
            "2. «Load parcels: one after another» and snap each label: the address goes in by itself.\n"
            "3. «Build route and start»: it sorts your stops by time and guides you by voice.\n\n"
            "And two things that save you time: «Hands-free» (on Android you say \"delivered\" and keep "
            "driving) and «My money today» (how much you've earned and what goes on fuel).\n\n"
            "{plazo}\n\n"
            "{ayuda_corta}"),
        "invita": (
            "{entregadas} deliveries with {marca}: will you pass it on to a colleague?",
            "Hi {nombre},\n\n"
            "You've already made {entregadas} deliveries with {marca}. If you know another driver it could help, "
            "send them your link:\n\n"
            "{invita}\n\n"
            "When they sign up and make 20 deliveries on 2 different days (in their first month), you earn {euros} "
            "for each one. You get paid by {cobro} from {minimo}. Your link, your QR code and the terms are in the "
            "app, «Account» tab: {cuenta}\n\n"
            "{ayuda_invita}"),
        "cobro_es": "Bizum or bank transfer",
        "ayuda_invita": "Is anything missing for your deliveries? Reply with one line and I'll look into it.",
        "ayuda_invita_sin": "Thanks for using it.",
        "cobro_fuera": "PayPal",
        "hecho_si": "So far you've loaded {paradas} stops{entregas}.\n\n",
        "entregas": " and delivered {n}",
        "hecho_no": "You haven't loaded any stops yet: there's still time to try it with your real route ({ruta}).\n\n",
        "ayuda": "If something doesn't work or you're missing something, just reply to this email: I read it myself.",
        "ayuda_sin": "Tip: try it first with 3 or 4 parcels before you head out; in two minutes you'll know if it works for you.",
        "ayuda_corta": "What stopped you, or what's missing? Reply with one line and I'll look into it.",
        "ayuda_corta_sin": "No parcels at hand? Inside the app you can see it working with 3 sample stops.",
        "intro": (
            "Your account is ready. You have {dias} free days and we didn't ask for a card, so nothing is "
            "charged automatically when the trial ends. If you want to keep going, you choose ({mes} a month or {anio} a year).\n\n"),
        "plazo": "You have {quedan} trial days left.",
        "plazo_promo": "Remember: it's free with no limit until {promo}.",
        "intro_promo": (
            "Your account is ready. It's free with no limit until {promo}, and we didn't ask for a card. "
            "After that you stay free with up to {tope} stops a day; no limit for {mes} a month or {anio} a year, "
            "only if you want.\n\n"),
        "firma": "Daniel, {marca}",
        "baja": "Don't want emails like this? Unsubscribe here: {baja}",
        "boton": {"bienvenida": "Open the app", "primer_dia": "Load my first route", "casi_fin": "See my account",
                  "recordatorio": "Load my route", "invita": "See my link and QR code"},
    },
}


def _euros(v, idioma):
    # Con céntimos, siempre dos cifras: «2,50 €», no «2,5 €».
    s = ("%.2f" % v) if isinstance(v, float) and v != int(v) else str(int(v))
    return (s.replace(".", ",") if idioma != "en" else s) + " €"


_MESES = {
    "es": ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre",
           "octubre", "noviembre", "diciembre"),
    "pt": ("janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro",
           "outubro", "novembro", "dezembro"),
    "en": ("January", "February", "March", "April", "May", "June", "July", "August", "September",
           "October", "November", "December"),
}


def _dia_mes(iso, idioma):
    """'2026-12-31' -> «31 de diciembre» / «31 de dezembro» / «31 December»."""
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", str(iso or ""))
    if not m:
        return ""
    dia, mes = int(m.group(3)), _MESES[idioma][int(m.group(2)) - 1]
    return f"{dia} {mes}" if idioma == "en" else f"{dia} de {mes}"


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
           baja: str, mensual: float, anual: float, con_respuesta: bool,
           promo_hasta: str = "", tope: int = 15, ref_enlace: str = "", ref_cent: int = 250,
           ref_espana: bool = True, ref_min_cent: int = 1000) -> dict:
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
        "ayuda_invita": t["ayuda_invita"] if con_respuesta else t["ayuda_invita_sin"],
        "promo": _dia_mes(promo_hasta, idioma), "tope": tope, "entregadas": _reales(uso),
        # «Invita y gana»: su enlace (o, si no llega, la pestaña donde está), lo que gana y cómo cobra.
        "invita": ref_enlace or cuenta, "euros": _euros(ref_cent / 100, idioma),
        "cobro": t["cobro_es"] if ref_espana else t["cobro_fuera"], "minimo": _euros(ref_min_cent / 100, idioma),
    }
    datos["intro"] = (t["intro_promo"] if promo_hasta else t["intro"]).format(**datos)
    # 10-10-2026: con la promoción no hay «días de prueba» que contar (el correo del día
    # siguiente decía «te quedan 6 días» a quien tiene la app gratis hasta el 31-12).
    datos["plazo"] = (t["plazo_promo"] if promo_hasta else t["plazo"]).format(**datos)
    asunto_m, cuerpo_m = t[clave]
    asunto = asunto_m.format(**datos)
    cuerpo = cuerpo_m.format(**datos)
    if not nombre:
        # «Hola :» queda feo: sin nombre, el saludo va sin él.
        cuerpo = cuerpo.replace(" :\n", ":\n").replace(" ,\n", ",\n")
    firma = t["firma"].format(marca=marca)
    pie = t["baja"].format(baja=baja)
    texto = f"{cuerpo}\n\n{firma}\n\n--\n{pie}"
    enlace = cuenta if clave in ("casi_fin", "invita") else ruta
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
