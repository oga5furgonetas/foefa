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
  · «primer_dia» y «recordatorio» salen POR LA MAÑANA de su hora (12-10-2026): de 7 a 9, de lunes a
    sábado, que es cuando carga la furgoneta y tiene los paquetes delante. Antes salían a la hora a la
    que se dio de alta (de tarde o de noche, desde el anuncio), cuando ya no hay nada que cargar.
  · «invita» (11-10-2026) — cuando ya lleva 10 entregas de verdad (direcciones
    distintas y repartidas en el día, como cuenta «Invita y gana»: marcar 11 en 20
    minutos a medianoche es probar, no repartir). Su enlace y las condiciones exactas.
  · El BONO DE BIENVENIDA (17-10-2026): mientras pueda ganarlo, la bienvenida, «primer_dia» y
    «recordatorio» lo dicen en un párrafo; y «bono» (una vez, por la mañana) se lo cuenta a quien se dio de
    alta antes y no ha recibido desde entonces ningún correo que lo diga.
  · «opinion» (17-10-2026) — a los 5 días, UNA vez, si no ha dado ya su opinión en la app: a quien ha
    cargado paradas, qué nota le da; a quien no, qué le frenó (después del recordatorio: primero se le
    ayuda y luego se le pregunta). Se contesta con un clic: cada opción es un enlace a la página
    /opinion, que pide confirmar con «Enviar» (los antivirus del correo abren los enlaces y eso no
    puede contar como respuesta). Lo que conteste le llega a Dani.

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

CLAVES = ("bienvenida", "primer_dia", "casi_fin", "recordatorio", "invita", "bono", "opinion")
# «br» es el portugués de Brasil (11-10-2026): mismos datos que «pt», escrito para allí (você, celular,
# paradas, pacotes). Sin él, a un brasileño le llegaba «telemóvel», «paragens» y «morada».
IDIOMAS = ("es", "pt", "en", "br")
SEPARACION = timedelta(hours=18)
BIENVENIDA_HASTA = timedelta(hours=2)      # si falló al darse de alta, se reintenta hasta aquí
PRIMER_DIA_DESDE = timedelta(hours=20)
PRIMER_DIA_HASTA = timedelta(hours=72)
CASI_FIN_ANTES = timedelta(days=2)
CASI_FIN_EDAD_MIN = timedelta(days=3)      # una prueba corta no recibe dos correos seguidos
RECORDATORIO_DESDE = timedelta(days=3)
RECORDATORIO_HASTA = timedelta(days=8)
MANANA_DESDE, MANANA_HASTA = 7, 9          # «primer_dia» y «recordatorio», de 7:00 a 8:59 de su hora
INVITA_ENTREGAS = 10                       # entregas suyas (no de ejemplo) para pedirle que invite
BONO_DESDE = datetime(2026, 10, 16, 22, 0, tzinfo=timezone.utc)   # 17-10-2026 00:00 en Madrid: nace el bono
BONO_ENTREGAS = 20                         # las del bono (las mismas que «Invita y gana»)
CON_BONO = ("bienvenida", "primer_dia", "recordatorio")   # correos que llevan el párrafo del bono
OPINION_DESDE = timedelta(days=5)          # «opinion», a los 5 días de darse de alta…
OPINION_HASTA = timedelta(days=30)         # …y no más tarde (ya no se acuerda de la app)
NOTAS = (5, 4, 3, 2, 1)                    # las respuestas de un clic de quien la usa
MOTIVOS = ("no_ruta", "no_supe", "otra_app", "empresa", "otro")   # y las de quien no ha cargado nada

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


_ZONAS_BR = {"America/Sao_Paulo", "America/Bahia", "America/Fortaleza", "America/Recife", "America/Belem",
             "America/Maceio", "America/Araguaina", "America/Santarem", "America/Manaus", "America/Cuiaba",
             "America/Campo_Grande", "America/Porto_Velho", "America/Boa_Vista", "America/Rio_Branco",
             "America/Eirunepe", "America/Noronha"}


def idioma_de(org: dict) -> str:
    """El idioma que eligió en la app; si no consta, el de su país; si no, español. En portugués,
    Brasil (por país o por su hora) lee el de allí."""
    o = org or {}
    i = str(o.get("idioma") or "").lower()[:2]
    pais = str(o.get("pais") or "").lower()
    brasil = pais == "br" or str(o.get("zona_horaria") or "") in _ZONAS_BR
    if i in IDIOMAS:
        return "br" if i == "pt" and brasil else i
    if pais in _PAISES_PT:
        return "br" if brasil else "pt"
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


def en_su_manana(org: dict, ahora: datetime) -> bool:
    """De 7 a 9 de la mañana de su hora (su zona; si no consta, Madrid), de lunes a sábado."""
    from zoneinfo import ZoneInfo
    try:
        zona = ZoneInfo(str((org or {}).get("zona_horaria") or "Europe/Madrid"))
    except Exception:                                            # noqa: BLE001 — zona rara: la de Madrid
        zona = ZoneInfo("Europe/Madrid")
    local = ahora.astimezone(zona)
    return local.weekday() != 6 and MANANA_DESDE <= local.hour < MANANA_HASTA


def en_su_dia(org: dict, ahora: datetime) -> bool:
    """De 9 a 21 de su hora (17-10-2026: el correo «bono» es un anuncio; no tiene que esperar a las 7 del lunes)."""
    from zoneinfo import ZoneInfo
    try:
        zona = ZoneInfo(str((org or {}).get("zona_horaria") or "Europe/Madrid"))
    except Exception:                                            # noqa: BLE001
        zona = ZoneInfo("Europe/Madrid")
    return 9 <= ahora.astimezone(zona).hour < 21


def toca(org: dict, uso: dict, ahora: datetime, promo: bool = False, bono: bool = False) -> str:
    """La clave del correo que toca mandar AHORA, o "" si ninguno. Con la promoción
    «gratis y sin límite» activa no hay «se acaba tu prueba»: no se acaba nada.
    `bono`: esta cuenta todavía puede ganar el bono de bienvenida."""
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
    manana = en_su_manana(org, ahora)
    if ("primer_dia" not in enviados and PRIMER_DIA_DESDE <= edad <= PRIMER_DIA_HASTA
            and not (uso or {}).get("paradas") and manana):
        return "primer_dia"
    if ("recordatorio" not in enviados and RECORDATORIO_DESDE <= edad <= RECORDATORIO_HASTA
            and not (uso or {}).get("paradas") and manana):
        return "recordatorio"
    # El bono, a quien no se le ha dicho: ningún correo suyo desde que existe (esos ya lo llevan).
    if (bono and "bono" not in enviados and edad >= PRIMER_DIA_DESDE and (manana or en_su_dia(org, ahora))
            and _reales(uso) < BONO_ENTREGAS
            and not any((_fecha((v or {}).get("at")) or alta) >= BONO_DESDE for v in enviados.values())):
        return "bono"
    if ("invita" not in enviados and _reales(uso) >= INVITA_ENTREGAS
            and str(org.get("pais") or "es").lower() != "cn"):        # en China no hay cómo pagar
        return "invita"
    # ¿Qué tal te va? / ¿Qué te frenó? Una vez, si no lo ha dicho ya en la app ni ha pulsado «Ahora no».
    if ("opinion" not in enviados and not org.get("opinion_dada") and not org.get("opinion_saltada")
            and OPINION_DESDE <= edad <= OPINION_HASTA and en_su_dia(org, ahora)
            and ((uso or {}).get("paradas") or "recordatorio" in enviados or edad > RECORDATORIO_HASTA)):
        return "opinion"
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
            "{cuando} creaste tu cuenta en {marca} y todavía no has cargado ninguna parada. "
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
            "cada uno. {promo_ref}Lo cobras por {cobro}. Tu enlace, tu QR y las condiciones están en la app, "
            "pestaña «Cuenta»: {cuenta}\n\n"
            "{ayuda_invita}"),
        "bono": (
            "{bono_euros} por tu primera ruta con {marca}",
            "Hola {nombre}:\n\n"
            "Hasta el {bono_hasta} tenemos un regalo para que pruebes {marca} con tu ruta de verdad:\n\n"
            "· {bono_euros} para ti cuando hagas tus primeras 20 entregas de verdad con la app, en 2 días distintos.\n"
            "· {euros} más por cada compañero que se registre con tu enlace y haga lo mismo.\n\n"
            "{progreso}"
            "Lo cobras por {cobro}. Cuando tengas los paquetes delante:\n"
            "1. Abre {ruta}\n"
            "2. «Cargar paquetes: uno tras otro» y una foto a cada etiqueta: la dirección entra sola.\n"
            "3. «Montar ruta y empezar»: te ordena las paradas y te guía con voz.\n\n"
            "Tu enlace para invitar: {invita}\n\n"
            "{ayuda_corta}"),
        "bono_linea": ("Y un regalo: hasta el {bono_hasta}, te damos {bono_euros} cuando hagas tus primeras 20 entregas "
                       "de verdad con la app (en 2 días distintos), y {euros} más por cada compañero que invites y "
                       "haga lo mismo."),
        "progreso": "Ya llevas {n} entregas que cuentan.\n\n",
        "cuando": ("Ayer", "Hace unos días"),
        "cobro_es": "Bizum o transferencia",
        "promo_ref": "Son {euros} por cada compañero que se registre con tu enlace hasta el {promo_hasta} (promoción). ",
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
                  "recordatorio": "Cargar mi ruta", "invita": "Ver mi enlace y mi QR", "bono": "Cargar mi ruta"},
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
            "{cuando} criaste a tua conta na {marca} e ainda não carregaste nenhuma paragem. "
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
            "cada um. {promo_ref}Recebes por {cobro}. O teu link, o teu QR e as condições estão na app, "
            "separador «Conta»: {cuenta}\n\n"
            "{ayuda_invita}"),
        "cobro_es": "Bizum ou transferência",
        "promo_ref": "São {euros} por cada colega que se registe com o teu link até {promo_hasta} (promoção). ",
        "bono": (
            "{bono_euros} pela tua primeira rota com a {marca}",
            "Olá {nombre}:\n\n"
            "Até {bono_hasta} temos um presente para experimentares a {marca} com a tua rota a sério:\n\n"
            "· {bono_euros} para ti quando fizeres as tuas primeiras 20 entregas a sério com a app, em 2 dias diferentes.\n"
            "· {euros} por cada colega que se registe com o teu link e faça o mesmo.\n\n"
            "{progreso}"
            "Recebes por {cobro}. Quando tiveres os volumes à frente:\n"
            "1. Abre {ruta}\n"
            "2. «Carregar volumes: um após outro» e uma foto a cada etiqueta: a morada entra sozinha.\n"
            "3. «Montar rota e começar»: ordena as paragens e guia-te por voz.\n\n"
            "O teu link para convidar: {invita}\n\n"
            "{ayuda_corta}"),
        "bono_linea": ("E um presente: até {bono_hasta}, damos-te {bono_euros} quando fizeres as tuas primeiras 20 entregas "
                       "a sério com a app (em 2 dias diferentes), e {euros} por cada colega que convidares e faça o mesmo."),
        "progreso": "Já levas {n} entregas que contam.\n\n",
        "cuando": ("Ontem", "Há uns dias"),
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
                  "recordatorio": "Carregar a minha rota", "invita": "Ver o meu link e o meu QR",
                  "bono": "Carregar a minha rota"},
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
            "You created your {marca} account {cuando} and haven't loaded any stops yet. "
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
            "for each one. {promo_ref}You get paid by {cobro}. Your link, your QR code and the terms are in the "
            "app, «Account» tab: {cuenta}\n\n"
            "{ayuda_invita}"),
        "cobro_es": "Bizum or bank transfer",
        "promo_ref": "It's {euros} for every colleague who signs up with your link until {promo_hasta} (promotion). ",
        "bono": (
            "{bono_euros} for your first route with {marca}",
            "Hi {nombre},\n\n"
            "Until {bono_hasta} we have a gift so you can try {marca} on your real route:\n\n"
            "· {bono_euros} for you when you make your first 20 real deliveries with the app, on 2 different days.\n"
            "· {euros} for every colleague who signs up with your link and does the same.\n\n"
            "{progreso}"
            "You get paid by {cobro}. When you have your parcels in front of you:\n"
            "1. Open {ruta}\n"
            "2. «Load parcels: one after another» and snap each label: the address goes in by itself.\n"
            "3. «Build route and start»: it orders your stops and guides you by voice.\n\n"
            "Your invite link: {invita}\n\n"
            "{ayuda_corta}"),
        "bono_linea": ("And a gift: until {bono_hasta}, you get {bono_euros} when you make your first 20 real deliveries "
                       "with the app (on 2 different days), plus {euros} for every colleague you invite who does the same."),
        "progreso": "You already have {n} deliveries that count.\n\n",
        "cuando": ("yesterday", "a few days ago"),
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
                  "recordatorio": "Load my route", "invita": "See my link and QR code", "bono": "Load my route"},
    },
}


# Portugués de Brasil: los mismos correos que «pt», escritos para allí. Los botones que se citan son los
# que enseña la app en Brasil (frontend/src/lib/textosBrasil.js); lo vigila test_los_botones_que_cita….
_T["br"] = {
    **_T["pt"],
    "bienvenida": (
        "Sua conta {marca} está pronta: veja como carregar sua primeira rota",
        "Olá {nombre}:\n\n"
        "{intro}"
        "Sua primeira rota, em 3 passos:\n"
        "1. Abra o app: {ruta}\n"
        "   No celular, «Instalar o app» deixa ele na tela inicial.\n"
        "2. Toque em «Carregar pacotes: um atrás do outro» e tire uma foto da etiqueta de cada pacote. "
        "O endereço entra sozinho; se algum não for lido, você digita.\n"
        "3. Toque em «Montar rota e começar»: o app organiza as paradas e te leva até cada porta.\n\n"
        "Sem pacotes à mão? Dentro do app, «Ver funcionando com 3 paradas de exemplo».\n\n"
        "{ayuda}"),
    "primer_dia": (
        "Posso te ajudar com a sua primeira rota?",
        "Olá {nombre}:\n\n"
        "Você criou sua conta no {marca} e ainda não carregou nenhuma parada. "
        "Se ficou pela metade, o mais rápido é:\n\n"
        "1. Abra {ruta}\n"
        "2. «Carregar pacotes: um atrás do outro» e uma foto de cada etiqueta.\n"
        "3. «Montar rota e começar».\n\n"
        "Hoje você não tem pacotes? No app, «Ver funcionando com 3 paradas de exemplo».\n\n"
        "{plazo}\n\n"
        "{ayuda_corta}"),
    "casi_fin": (
        "Faltam {quedan} dias do seu teste no {marca}",
        "Olá {nombre}:\n\n"
        "{hecho}"
        "Seu teste grátis termina em {fin}. Nada é cobrado automaticamente: se quiser continuar, entre no app, "
        "aba «Conta», e escolha {mes} por mês ou {anio} por ano. Se não, você não paga nada.\n\n"
        "Conta: {cuenta}\n\n"
        "{ayuda_corta}"),
    "recordatorio": (
        "Vai entregar esta semana? Sua rota pronta em 2 minutos",
        "Olá {nombre}:\n\n"
        "Há alguns dias você criou sua conta no {marca} e ainda não carregou nenhum pacote. "
        "Quando estiver com a rota em mãos, é rápido assim:\n\n"
        "1. Abra {ruta}\n"
        "2. «Carregar pacotes: um atrás do outro» e uma foto de cada etiqueta: o endereço entra sozinho.\n"
        "3. «Montar rota e começar»: o app organiza as paradas por tempo e te guia por voz.\n\n"
        "E duas coisas que economizam tempo: «Mãos livres» (no Android você diz \"entregue\" e continua "
        "dirigindo) e «O meu dinheiro hoje» (quanto você já ganhou e quanto foi de combustível).\n\n"
        "{plazo}\n\n"
        "{ayuda_corta}"),
    "invita": (
        "Você já fez {entregadas} entregas com o {marca}: indica para um colega?",
        "Olá {nombre}:\n\n"
        "Você já fez {entregadas} entregas com o {marca}. Se conhece outro entregador que possa usar, "
        "mande o seu link:\n\n"
        "{invita}\n\n"
        "Quando ele se cadastrar e fizer 20 entregas em 2 dias diferentes (no primeiro mês), você ganha {euros} "
        "por cada um. {promo_ref}Você recebe por {cobro}. Seu link, seu QR e as condições estão no app, "
        "aba «Conta»: {cuenta}\n\n"
        "{ayuda_invita}"),
    "promo_ref": "São {euros} por cada colega que se cadastrar com o seu link até {promo_hasta} (promoção). ",
    "bono": (
        "{bono_euros} pela sua primeira rota com o {marca}",
        "Olá {nombre}:\n\n"
        "Até {bono_hasta} temos um presente para você testar o {marca} com a sua rota de verdade:\n\n"
        "· {bono_euros} para você quando fizer suas primeiras 20 entregas de verdade com o app, em 2 dias diferentes.\n"
        "· Mais {euros} por cada colega que se cadastrar com o seu link e fizer o mesmo.\n\n"
        "{progreso}"
        "Você recebe por {cobro}. Quando estiver com os pacotes na sua frente:\n"
        "1. Abra {ruta}\n"
        "2. «Carregar pacotes: um atrás do outro» e uma foto de cada etiqueta: o endereço entra sozinho.\n"
        "3. «Montar rota e começar»: o app organiza as paradas e te guia por voz.\n\n"
        "Seu link para convidar: {invita}\n\n"
        "{ayuda_corta}"),
    "bono_linea": ("E um presente: até {bono_hasta}, você ganha {bono_euros} quando fizer suas primeiras 20 entregas "
                   "de verdade com o app (em 2 dias diferentes), e mais {euros} por cada colega que convidar e fizer o mesmo."),
    "progreso": "Você já tem {n} entregas que contam.\n\n",
    "ayuda_invita": "Falta alguma coisa no app para as suas entregas? Me responda com uma linha que eu vejo.",
    "ayuda_invita_sin": "Obrigado por usar o app.",
    "hecho_si": "Nesses dias você carregou {paradas} paradas{entregas}.\n\n",
    "entregas": " e entregou {n}",
    "hecho_no": "Você ainda não carregou nenhuma parada: ainda dá tempo de testar com a sua rota de verdade ({ruta}).\n\n",
    "ayuda": "Se algo não funcionar ou faltar alguma coisa, responda este e-mail: sou eu que leio.",
    "ayuda_sin": "Dica: faça o primeiro teste com 3 ou 4 pacotes antes de sair; em dois minutos você vê se serve.",
    "ayuda_corta": "O que te travou ou o que está faltando? Me responda em uma linha que eu vejo.",
    "ayuda_corta_sin": "Se não tiver pacotes à mão, dentro do app você pode ver ele funcionando com 3 paradas de exemplo.",
    "intro": (
        "Sua conta está pronta. Você tem {dias} dias grátis e não pedimos cartão, então no fim do teste "
        "nada é cobrado automaticamente. Se quiser continuar, é você quem escolhe ({mes} por mês ou {anio} por ano).\n\n"),
    "plazo": "Você ainda tem {quedan} dias de teste.",
    "plazo_promo": "Lembrete: é grátis e sem limite até {promo}.",
    "intro_promo": (
        "Sua conta está pronta. É grátis e sem limite até {promo} e não pedimos cartão. "
        "Depois você continua grátis com até {tope} paradas por dia; sem limite, {mes} por mês ou {anio} por ano, "
        "só se quiser.\n\n"),
    "firma": "Daniel, do {marca}",
    "baja": "Não quer mais e-mails como este? Cancele aqui: {baja}",
    "boton": {"bienvenida": "Abrir o app", "primer_dia": "Carregar minha primeira rota", "casi_fin": "Ver minha conta",
              "recordatorio": "Carregar minha rota", "invita": "Ver meu link e meu QR", "bono": "Carregar minha rota"},
}

# ¿QUÉ TAL TE VA? (17-10-2026) — «opinion». {opciones} son los enlaces de un clic (en el HTML, botones).
# Sin «comillas» a propósito: lo que va entre ellas tiene que ser un botón de la app (lo vigila un test).
_OPINION = {
    "es": {
        "opinion_usa": (
            "¿Qué tal te va con {marca}? (se contesta con un clic)",
            "Hola {nombre}:\n\n"
            "Llevas {paradas} paradas con {marca} y me gustaría saber qué tal te va. ¿Qué nota le das? "
            "Pulsa una:\n\n{opciones}\n\n"
            "Y si le falta algo o algo te estorba, dímelo: lo leo yo y lo arreglo. Puedes contestar a este correo."),
        "opinion_frena": (
            "¿Qué te frenó con {marca}? (se contesta con un clic)",
            "Hola {nombre}:\n\n"
            "Hace unos días creaste tu cuenta en {marca} y no has llegado a cargar ninguna ruta. No pasa nada, "
            "pero me ayudaría mucho saber por qué. Pulsa la que más se parezca:\n\n{opciones}\n\n"
            "Con eso me basta. Si quieres contarme más, contesta a este correo: lo leo yo."),
        "notas": ("Me encanta", "Bien", "Normal", "Regular", "Mal"),
        "regalo_linea": ("Por cierto: te hemos regalado {regalo} en tu cartera de {marca}, para que veas que va en "
                         "serio. Lo tienes en la app, en la pestaña Cuenta."),
        "motivos": {"no_ruta": "Todavía no he tenido reparto", "no_supe": "No supe cómo meter los paquetes",
                    "otra_app": "Ya uso otra app", "empresa": "Mi empresa no me deja", "otro": "Otra cosa"},
    },
    "pt": {
        "opinion_usa": (
            "Como te está a correr a {marca}? (responde com um clique)",
            "Olá {nombre}:\n\n"
            "Já levas {paradas} paragens com a {marca} e gostava de saber como te está a correr. Que nota lhe dás? "
            "Carrega numa:\n\n{opciones}\n\n"
            "E se faltar alguma coisa ou algo te atrapalhar, diz-me: leio eu e resolvo. Podes responder a este e-mail."),
        "opinion_frena": (
            "O que te travou na {marca}? (responde com um clique)",
            "Olá {nombre}:\n\n"
            "Há uns dias criaste a tua conta na {marca} e ainda não carregaste nenhuma rota. Não faz mal, "
            "mas ajudava-me muito saber porquê. Carrega na que mais se parecer:\n\n{opciones}\n\n"
            "Com isso chega. Se quiseres contar mais, responde a este e-mail: leio eu."),
        "notas": ("Adoro", "Bem", "Normal", "Mais ou menos", "Mal"),
        "regalo_linea": ("Já agora: oferecemos-te {regalo} na tua carteira da {marca}, para veres que é a sério. "
                         "Está na app, no separador Conta."),
        "motivos": {"no_ruta": "Ainda não tive entregas", "no_supe": "Não percebi como meter as encomendas",
                    "otra_app": "Já uso outra app", "empresa": "A minha empresa não deixa", "otro": "Outra coisa"},
    },
    "en": {
        "opinion_usa": (
            "How is {marca} working for you? (one click to answer)",
            "Hi {nombre}:\n\n"
            "You have done {paradas} stops with {marca} and I would love to know how it is going. What score "
            "would you give it? Tap one:\n\n{opciones}\n\n"
            "And if something is missing or gets in your way, tell me: I read it myself and fix it. "
            "You can just reply to this email."),
        "opinion_frena": (
            "What stopped you with {marca}? (one click to answer)",
            "Hi {nombre}:\n\n"
            "A few days ago you created your {marca} account and you have not loaded a route yet. That is fine, "
            "but it would really help me to know why. Tap the one that fits best:\n\n{opciones}\n\n"
            "That is all I need. If you want to tell me more, just reply to this email: I read it myself."),
        "notas": ("Love it", "Good", "OK", "So-so", "Bad"),
        "regalo_linea": ("By the way: we have added {regalo} to your {marca} wallet as a gift, so you can see it is "
                         "real. You will find it in the app, in the Account tab."),
        "motivos": {"no_ruta": "I have not had deliveries yet", "no_supe": "I did not know how to add the parcels",
                    "otra_app": "I already use another app", "empresa": "My company does not allow it",
                    "otro": "Something else"},
    },
    "br": {
        "opinion_usa": (
            "Como está indo com o {marca}? (responda com um clique)",
            "Olá {nombre}:\n\n"
            "Você já fez {paradas} paradas com o {marca} e eu queria saber como está indo. Que nota você dá? "
            "Toque em uma:\n\n{opciones}\n\n"
            "E se faltar algo ou alguma coisa atrapalhar, me fala: eu leio e resolvo. Pode responder este e-mail."),
        "opinion_frena": (
            "O que te travou no {marca}? (responda com um clique)",
            "Olá {nombre}:\n\n"
            "Há alguns dias você criou sua conta no {marca} e ainda não carregou nenhuma rota. Tudo bem, "
            "mas me ajudaria muito saber por quê. Toque na que mais combina:\n\n{opciones}\n\n"
            "Isso já basta. Se quiser contar mais, responda este e-mail: eu leio."),
        "notas": ("Adorei", "Bom", "Normal", "Mais ou menos", "Ruim"),
        "regalo_linea": ("Aliás: demos {regalo} de presente na sua carteira do {marca}, para você ver que é de "
                         "verdade. Está no app, na aba Conta."),
        "motivos": {"no_ruta": "Ainda não tive entregas", "no_supe": "Não entendi como colocar os pacotes",
                    "otra_app": "Já uso outro app", "empresa": "Minha empresa não deixa", "otro": "Outra coisa"},
    },
}
for _i, _d in _OPINION.items():
    _T[_i].update(_d)
_MARCA_OPCIONES = "\x00"                    # dónde van las opciones dentro del cuerpo


# Español de Latinoamérica (11-10-2026): los correos están en español de España; a quien es de allí se le
# cambian las palabras que allí suenan de fuera (las mismas que la app, lib/idioma.js → aLatam).
_LATAM = _PAISES_ES - {"es", "gq"}
_A_LATAM = (("En el móvil", "En el celular"), ("en el móvil", "en el celular"), ("tu móvil", "tu celular"),
            ("el móvil", "el celular"), ("móvil", "celular"), ("hazle una foto", "tómale una foto"),
            ("Haz una foto", "Toma una foto"), ("haz una foto", "toma una foto"), ("Pulsa ", "Toca "),
            ("pulsa ", "toca "), ("furgoneta", "camioneta"), ("ordenador", "computadora"))


def _a_latam(texto: str) -> str:
    for a, b in _A_LATAM:
        texto = texto.replace(a, b)
    return texto


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


_MESES["br"] = _MESES["pt"]


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
           ref_espana: bool = True, ref_min_cent: int = 6000, ref_promo_hasta: str = "",
           bono_hasta: str = "", bono_cent: int = 1000, opinion_url: str = "", regalo_cent: int = 0) -> dict:
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
    # 14-10-2026: el mínimo de retirada ya no se dice en el correo (solo al intentar cobrar); la promoción, sí.
    datos["promo_ref"] = (t["promo_ref"].format(euros=datos["euros"], promo_hasta=_dia_mes(ref_promo_hasta, idioma))
                          if ref_promo_hasta else "")
    # El bono de bienvenida (17-10-2026): solo si todavía puede ganarlo (lo decide el servidor).
    datos["bono_hasta"] = _dia_mes(bono_hasta, idioma) if bono_hasta else ""
    datos["bono_euros"] = _euros(bono_cent / 100, idioma)
    reales = _reales(uso)
    datos["progreso"] = t["progreso"].format(n=reales) if 0 < reales < BONO_ENTREGAS else ""
    # «Ayer» solo si fue ayer: «primer_dia» puede salir hasta 72 h después (17-10-2026, tras la caída del
    # 15 al 17, a los del 14 les iba a llegar «Ayer creaste tu cuenta» tres días más tarde).
    datos["cuando"] = t["cuando"][0] if ahora - alta < timedelta(hours=48) else t["cuando"][1]
    datos["intro"] = (t["intro_promo"] if promo_hasta else t["intro"]).format(**datos)
    # 10-10-2026: con la promoción no hay «días de prueba» que contar (el correo del día
    # siguiente decía «te quedan 6 días» a quien tiene la app gratis hasta el 31-12).
    datos["plazo"] = (t["plazo_promo"] if promo_hasta else t["plazo"]).format(**datos)
    opciones = []
    if clave == "opinion":
        if not opinion_url:
            raise ValueError("el correo de opinión necesita opinion_url")
        url = f"{opinion_url}{'&' if '?' in opinion_url else '?'}{utm}"
        if paradas:
            asunto_m, cuerpo_m = t["opinion_usa"]
            opciones = [("★" * n + "☆" * (5 - n) + "  " + t["notas"][i], f"{url}&r={n}") for i, n in enumerate(NOTAS)]
        else:
            asunto_m, cuerpo_m = t["opinion_frena"]
            opciones = [(t["motivos"][m], f"{url}&m={m}") for m in MOTIVOS]
        if idioma == "es" and str(org.get("pais") or "").lower() in _LATAM:
            opciones = [(_a_latam(a), b) for a, b in opciones]
        datos.update(paradas=paradas, opciones=_MARCA_OPCIONES, regalo=_euros(regalo_cent / 100, idioma))
        if regalo_cent:
            # El regalo de saldo (17-10-2026), antes del último párrafo: que vea que es de verdad.
            antes, _sep, ultimo = cuerpo_m.rpartition("\n\n")
            cuerpo_m = f"{antes}\n\n{t['regalo_linea']}\n\n{ultimo}"
    else:
        asunto_m, cuerpo_m = t[clave]
    asunto = asunto_m.format(**datos)
    cuerpo = cuerpo_m.format(**datos)
    if bono_hasta and clave in CON_BONO:
        # El párrafo del bono va antes del último (la ayuda), que es con lo que se despide.
        antes, _sep, ultimo = cuerpo.rpartition("\n\n")
        linea = t["bono_linea"].format(**datos)
        cuerpo = f"{antes}\n\n{linea}\n\n{ultimo}" if antes else f"{cuerpo}\n\n{linea}"
    if idioma == "es" and str(org.get("pais") or "").lower() in _LATAM:
        asunto, cuerpo = _a_latam(asunto), _a_latam(cuerpo)
    if not nombre:
        # «Hola :» queda feo: sin nombre, el saludo va sin él.
        cuerpo = cuerpo.replace(" :\n", ":\n").replace(" ,\n", ",\n")
    firma = t["firma"].format(marca=marca)
    pie = t["baja"].format(baja=baja)
    if clave == "opinion":
        lineas = "\n".join(f"· {a}: {b}" for a, b in opciones)
        texto = f"{cuerpo.replace(_MARCA_OPCIONES, lineas)}\n\n{firma}\n\n--\n{pie}"
        return {"asunto": asunto, "texto": texto, "idioma": idioma,
                "html": _html_opinion(cuerpo, opciones, firma, pie)}
    texto = f"{cuerpo}\n\n{firma}\n\n--\n{pie}"
    enlace = cuenta if clave in ("casi_fin", "invita") else ruta
    if clave == "bono" and not bono_hasta:
        raise ValueError("el correo del bono necesita bono_hasta")
    return {"asunto": asunto, "texto": texto, "idioma": idioma,
            "html": _html_de(cuerpo, firma, t["boton"][clave], enlace, pie)}


def _html_opinion(cuerpo, opciones, firma, pie):
    """El de la opinión: el mismo aspecto sobrio, con las opciones como botones claros uno debajo de otro."""
    import re
    antes, _sep, despues = cuerpo.partition(_MARCA_OPCIONES)

    def parrafos(texto, color="#0369a1"):
        esc = _html.escape(texto.strip("\n"))
        return re.sub(r"(https?://[^\s<]+)", r'<a href="\1" style="color:%s">\1</a>' % color, esc).replace("\n", "<br>")
    botones = "".join(
        f'<a href="{_html.escape(b)}" style="display:block;margin:0 0 8px;padding:11px 16px;border:1px solid #cbd5e1;'
        f'border-radius:8px;color:#0f172a;text-decoration:none;font-weight:600">{_html.escape(a)}</a>'
        for a, b in opciones)
    return (
        '<div style="font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;font-size:15px;'
        'line-height:1.6;color:#111827;max-width:560px">'
        f'<p style="margin:0">{parrafos(antes)}</p>'
        f'<div style="margin:18px 0 20px;max-width:380px">{botones}</div>'
        f'<p style="margin:0">{parrafos(despues)}</p>'
        f'<p style="margin:22px 0 0">{_html.escape(firma)}</p>'
        '<p style="margin:28px 0 0;color:#6b7280;font-size:12px">'
        f'{parrafos(pie, "#6b7280")}</p></div>')


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
