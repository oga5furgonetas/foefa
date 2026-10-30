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
  · «primer_dia» — entre 8 y 72 h después, SOLO si no ha cargado ninguna
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
  · «bono25» (29-10-2026, Dani: «a todos los que se han registrado y no han completado ninguna ruta, un correo:
    enhorabuena, gana 25 €, completa tu primera ruta; el enlace de Google Play, un QR, que nos puntúen») —
    UNA vez, a toda cuenta de quien reparte solo que aún puede ganar el bono y no ha hecho su primera ruta,
    tenga la edad que tenga (no pasa por `toca`: lo decide `toca_bono25`). Lleva el enlace y el QR de Google
    Play, hasta cuándo puede ganarlo, pide una línea de respuesta y la valoración en Play.

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

CLAVES = ("bienvenida", "primer_dia", "casi_fin", "recordatorio", "invita", "bono", "opinion", "bono25")
# «br» es el portugués de Brasil (11-10-2026): mismos datos que «pt», escrito para allí (você, celular,
# paradas, pacotes). Sin él, a un brasileño le llegaba «telemóvel», «paragens» y «morada».
IDIOMAS = ("es", "pt", "en", "br", "fr", "it", "de")
SEPARACION = timedelta(hours=18)
BIENVENIDA_HASTA = timedelta(hours=2)      # si falló al darse de alta, se reintenta hasta aquí
# 8 h y no 20 (24-10-2026): se dan de alta de 13 a 23 h, y con 20 h la mañana siguiente (de 7 a 9) nunca
# llegaba: el correo salía la mañana de DESPUÉS, cuando ya se habían olvidado. Con 8 h, quien se apunta por la
# tarde o la noche lo recibe al cargar la furgoneta al día siguiente.
PRIMER_DIA_DESDE = timedelta(hours=8)
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
BONO25_FUERA = ("deleted", "baja", "cancelado", "cancelled", "canceled", "suspended")   # «bono25»: a todos menos estos
PLAY_URL = "https://play.google.com/store/apps/details?id=com.flotadsp.flota"   # la ficha de FDS en Google Play
OPINION_DESDE = timedelta(days=5)          # «opinion», a los 5 días de darse de alta…
OPINION_HASTA = timedelta(days=30)         # …y no más tarde (ya no se acuerda de la app)
NOTAS = (5, 4, 3, 2, 1)                    # las respuestas de un clic de quien la usa
MOTIVOS = ("no_ruta", "no_supe", "otra_app", "empresa", "otro")   # y las de quien no ha cargado nada

_PAISES_PT = {"pt", "br", "ao", "mz", "cv"}
_PAISES_ES = {"es", "mx", "ar", "co", "cl", "pe", "ve", "ec", "bo", "py", "uy", "cr", "pa",
              "gt", "hn", "sv", "ni", "do", "pr", "cu", "gq"}
# Sin idioma elegido, el del país (30-10-2026): Bélgica y Luxemburgo en francés, Suiza y Austria en alemán; el resto, inglés.
_PAISES_POR_IDIOMA = {"fr": {"fr", "be", "lu", "mc"}, "it": {"it", "sm"}, "de": {"de", "at", "ch", "li"}}


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
    for idioma, paises in _PAISES_POR_IDIOMA.items():
        if pais in paises:
            return idioma
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


def toca_bono25(org: dict, uso: dict, ahora: datetime, bono_pendiente: bool) -> bool:
    """¿Le toca el correo «tu primera ruta ahora vale 25 €»? A TODO el que creó una cuenta para repartir solo
    (Dani, 29-10: «a los 100; enviar a 5 y dejar a 1 no tendría sentido»), con correo, sin baja, con la cuenta no
    borrada ni cancelada, que todavía puede ganar el bono (`bono_pendiente`, lo decide el servidor) y no ha hecho
    su primera ruta (menos de 20 entregas de verdad). Una vez; nunca a menos de 18 h de otro correo del ciclo
    (se le manda al día siguiente, no se le salta); de 9 a 21 de su hora."""
    o = org or {}
    if not ((o.get("sector") == "autonomo" or o.get("plan") == "autonomo") and o.get("email")
            and not o.get("correos_baja") and not o.get("demo")
            and str(o.get("status") or "").lower() not in BONO25_FUERA):
        return False
    if not bono_pendiente or _reales(uso) >= BONO_ENTREGAS:
        return False
    enviados = o.get("ciclo_correos") or {}
    if "bono25" in enviados:
        return False
    ultimos = [u for u in (_fecha((v or {}).get("at")) for v in enviados.values()) if u]
    if ultimos and ahora - max(ultimos) < SEPARACION:
        return False
    return en_su_dia(o, ahora)


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
        "bono25": (
            "¡Enhorabuena! Tu primera ruta con {marca} ahora vale {bono_euros}",
            "Hola {nombre}:\n\n"
            "Te diste de alta en {marca} y todavía no has hecho tu primera ruta con la app. Buena noticia: ahora "
            "vale {bono_euros}. Es nuestra forma de darte las gracias por probarla con tu reparto de verdad.\n\n"
            "Cómo se gana:\n"
            "1. Abre la app ({ruta}) o descárgala en Google Play: {play}\n"
            "2. «Cargar paquetes: uno tras otro» y una foto a cada etiqueta (o escanea su código): la dirección "
            "entra sola.\n"
            "3. «Montar ruta y empezar»: te ordena las paradas y te guía con voz hasta cada puerta.\n\n"
            "Con 20 entregas de verdad en 2 días distintos, los {bono_euros} van a tu cartera y los cobras por "
            "{cobro}. Tienes hasta el {bono_limite}. Y si un compañero se registra con tu enlace (pestaña "
            "«Cuenta») y hace lo mismo, {euros} más para ti.\n\n"
            "{progreso}"
            "Si la app te sirve, puntúala en Google Play ({valorar}): nos ayuda a que la conozcan más "
            "repartidores.\n\n"
            "{ayuda_corta}"),
        "play": "Descargar en Google Play",
        "qr_pie": "¿Lo lees en el ordenador? Escanea el código con el móvil y la tienes.",
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
                  "recordatorio": "Cargar mi ruta", "invita": "Ver mi enlace y mi QR", "bono": "Cargar mi ruta", "bono25": "Abrir mi ruta"},
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
        "bono25": (
            "Parabéns! A tua primeira rota com a {marca} vale agora {bono_euros}",
            "Olá {nombre}:\n\n"
            "Criaste a tua conta na {marca} e ainda não fizeste a tua primeira rota com a app. Boa notícia: agora "
            "vale {bono_euros}. É a nossa forma de agradecer que a experimentes com a tua distribuição a sério.\n\n"
            "Como se ganha:\n"
            "1. Abre a app ({ruta}) ou descarrega-a no Google Play: {play}\n"
            "2. «Carregar volumes: um após outro» e uma foto a cada etiqueta (ou lê o seu código): a morada "
            "entra sozinha.\n"
            "3. «Montar rota e começar»: ordena as paragens e guia-te por voz até cada porta.\n\n"
            "Com 20 entregas a sério em 2 dias diferentes, os {bono_euros} vão para a tua carteira e recebes por "
            "{cobro}. Tens até {bono_limite}. E se um colega se registar com o teu link (separador «Conta») e "
            "fizer o mesmo, mais {euros} para ti.\n\n"
            "{progreso}"
            "Se a app te serve, avalia-a no Google Play ({valorar}): ajuda-nos a chegar a mais estafetas.\n\n"
            "{ayuda_corta}"),
        "play": "Descarregar no Google Play",
        "qr_pie": "A ler no computador? Lê o código com o telemóvel e já a tens.",
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
                  "bono": "Carregar a minha rota", "bono25": "Abrir a minha rota"},
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
        "bono25": (
            "Congratulations! Your first route with {marca} is now worth {bono_euros}",
            "Hi {nombre},\n\n"
            "You signed up for {marca} and haven't done your first route with the app yet. Good news: it is now "
            "worth {bono_euros}. It's our way of saying thanks for trying it on your real deliveries.\n\n"
            "How to earn it:\n"
            "1. Open the app ({ruta}) or get it on Google Play: {play}\n"
            "2. «Load parcels: one after another» and snap each label (or scan its code): the address goes in "
            "by itself.\n"
            "3. «Build route and start»: it orders your stops and guides you by voice to every door.\n\n"
            "With 20 real deliveries on 2 different days, the {bono_euros} go to your wallet and you get paid by "
            "{cobro}. You have until {bono_limite}. And if a colleague signs up with your link («Account» tab) "
            "and does the same, {euros} more for you.\n\n"
            "{progreso}"
            "If the app works for you, rate it on Google Play ({valorar}): it helps more couriers find it.\n\n"
            "{ayuda_corta}"),
        "play": "Get it on Google Play",
        "qr_pie": "Reading this on a computer? Scan the code with your phone.",
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
                  "recordatorio": "Load my route", "invita": "See my link and QR code", "bono": "Load my route", "bono25": "Open my route"},
    },
    "fr": {
        "bienvenida": (
            "Votre compte {marca} est prêt : voici comment charger votre première tournée",
            "Bonjour {nombre},\n\n"
            "{intro}"
            "Votre première tournée en 3 étapes :\n"
            "1. Ouvrez l’app : {ruta}\n"
            "   Sur le téléphone, «Installer l’app» la met sur votre écran d’accueil.\n"
            "2. Touchez «Charger les colis : l’un après l’autre» et prenez en photo l’étiquette de chaque colis. "
            "L’adresse s’inscrit toute seule ; si l’une d’elles ne se lit pas, tapez-la.\n"
            "3. Touchez «Créer la tournée et commencer» : l’app ordonne vos arrêts et vous mène à chaque porte.\n\n"
            "Pas de colis sous la main ? Dans l’app, «Le voir en action avec 3 arrêts d’exemple».\n\n"
            "{ayuda}"),
        "primer_dia": (
            "Un coup de main pour votre première tournée ?",
            "Bonjour {nombre},\n\n"
            "Vous avez créé votre compte {marca} {cuando} et vous n’avez encore chargé aucun arrêt. "
            "Si vous êtes resté bloqué, le plus rapide :\n\n"
            "1. Ouvrez {ruta}\n"
            "2. «Charger les colis : l’un après l’autre» et une photo de chaque étiquette.\n"
            "3. «Créer la tournée et commencer».\n\n"
            "Pas de colis aujourd’hui ? Dans l’app, «Le voir en action avec 3 arrêts d’exemple».\n\n"
            "{plazo}\n\n"
            "{ayuda_corta}"),
        "casi_fin": (
            "Il vous reste {quedan} jours d’essai sur {marca}",
            "Bonjour {nombre},\n\n"
            "{hecho}"
            "Votre essai gratuit se termine le {fin}. Rien n’est prélevé tout seul : pour continuer, ouvrez l’app, "
            "onglet «Compte», et choisissez {mes} par mois ou {anio} par an. Sinon, vous ne payez rien.\n\n"
            "Compte : {cuenta}\n\n"
            "{ayuda_corta}"),
        "recordatorio": (
            "Vous livrez cette semaine ? Votre tournée prête en 2 minutes",
            "Bonjour {nombre},\n\n"
            "Il y a quelques jours vous avez créé votre compte {marca} et vous n’avez encore chargé aucun colis. "
            "Quand vous aurez la tournée devant vous, c’est aussi rapide que ça :\n\n"
            "1. Ouvrez {ruta}\n"
            "2. «Charger les colis : l’un après l’autre» et une photo de chaque étiquette : l’adresse s’inscrit toute seule.\n"
            "3. «Créer la tournée et commencer» : l’app ordonne vos arrêts par temps de trajet et vous guide à la voix.\n\n"
            "Et deux choses qui font gagner du temps : «Mains libres» (sur Android, vous dites \"livré\" et vous "
            "continuez à rouler) et «Mon argent aujourd’hui» (ce que vous avez gagné et ce qui part en carburant).\n\n"
            "{plazo}\n\n"
            "{ayuda_corta}"),
        "invita": (
            "{entregadas} livraisons avec {marca} : vous la passez à un collègue ?",
            "Bonjour {nombre},\n\n"
            "Vous en êtes déjà à {entregadas} livraisons avec {marca}. Si vous connaissez un autre livreur à qui elle "
            "pourrait servir, envoyez-lui votre lien :\n\n"
            "{invita}\n\n"
            "Quand il s’inscrit et fait 20 livraisons sur 2 jours différents (dans son premier mois), vous gagnez {euros} "
            "pour chacun. {promo_ref}Vous êtes payé par {cobro}. Votre lien, votre QR et les conditions sont dans l’app, "
            "onglet «Compte» : {cuenta}\n\n"
            "{ayuda_invita}"),
        "cobro_es": "Bizum ou virement",
        "promo_ref": "C’est {euros} pour chaque collègue qui s’inscrit avec votre lien jusqu’au {promo_hasta} (promotion). ",
        "bono": (
            "{bono_euros} pour votre première tournée avec {marca}",
            "Bonjour {nombre},\n\n"
            "Jusqu’au {bono_hasta}, nous avons un cadeau pour que vous essayiez {marca} sur votre vraie tournée :\n\n"
            "· {bono_euros} pour vous quand vous faites vos 20 premières vraies livraisons avec l’app, sur 2 jours différents.\n"
            "· {euros} de plus pour chaque collègue qui s’inscrit avec votre lien et fait de même.\n\n"
            "{progreso}"
            "Vous êtes payé par {cobro}. Quand vous aurez les colis devant vous :\n"
            "1. Ouvrez {ruta}\n"
            "2. «Charger les colis : l’un après l’autre» et une photo de chaque étiquette : l’adresse s’inscrit toute seule.\n"
            "3. «Créer la tournée et commencer» : l’app ordonne vos arrêts et vous guide à la voix.\n\n"
            "Votre lien pour inviter : {invita}\n\n"
            "{ayuda_corta}"),
        "bono25": (
            "Félicitations ! Votre première tournée avec {marca} vaut maintenant {bono_euros}",
            "Bonjour {nombre},\n\n"
            "Vous vous êtes inscrit sur {marca} et vous n’avez pas encore fait votre première tournée avec l’app. Bonne "
            "nouvelle : elle vaut maintenant {bono_euros}. C’est notre façon de vous remercier de l’essayer sur vos vraies "
            "livraisons.\n\n"
            "Comment la gagner :\n"
            "1. Ouvrez l’app ({ruta}) ou téléchargez-la sur Google Play : {play}\n"
            "2. «Charger les colis : l’un après l’autre» et une photo de chaque étiquette (ou scannez son code) : "
            "l’adresse s’inscrit toute seule.\n"
            "3. «Créer la tournée et commencer» : l’app ordonne vos arrêts et vous guide à la voix jusqu’à chaque porte.\n\n"
            "Avec 20 vraies livraisons sur 2 jours différents, les {bono_euros} vont dans votre portefeuille et vous êtes "
            "payé par {cobro}. Vous avez jusqu’au {bono_limite}. Et si un collègue s’inscrit avec votre lien (onglet "
            "«Compte») et fait de même, {euros} de plus pour vous.\n\n"
            "{progreso}"
            "Si l’app vous sert, notez-la sur Google Play ({valorar}) : ça aide d’autres livreurs à la trouver.\n\n"
            "{ayuda_corta}"),
        "play": "Télécharger sur Google Play",
        "qr_pie": "Vous lisez ceci sur un ordinateur ? Scannez le code avec votre téléphone.",
        "bono_linea": ("Et un cadeau : jusqu’au {bono_hasta}, vous recevez {bono_euros} quand vous faites vos 20 premières "
                       "vraies livraisons avec l’app (sur 2 jours différents), plus {euros} pour chaque collègue que vous "
                       "invitez et qui fait de même."),
        "progreso": "Vous avez déjà {n} livraisons qui comptent.\n\n",
        "cuando": ("hier", "il y a quelques jours"),
        "ayuda_invita": "Il manque quelque chose à l’app pour vos livraisons ? Répondez-moi en une ligne et je regarde.",
        "ayuda_invita_sin": "Merci de l’utiliser.",
        "cobro_fuera": "PayPal",
        "hecho_si": "Ces jours-ci vous avez chargé {paradas} arrêts{entregas}.\n\n",
        "entregas": " et livré {n}",
        "hecho_no": "Vous n’avez encore chargé aucun arrêt : il est encore temps de l’essayer sur votre vraie tournée ({ruta}).\n\n",
        "ayuda": "Si quelque chose ne marche pas ou s’il vous manque quelque chose, répondez à cet e-mail : c’est moi qui le lis.",
        "ayuda_sin": "Conseil : faites un premier essai avec 3 ou 4 colis avant de partir ; en deux minutes vous saurez si elle vous convient.",
        "ayuda_corta": "Qu’est-ce qui vous a freiné, ou qu’est-ce qui manque ? Répondez-moi en une ligne et je regarde.",
        "ayuda_corta_sin": "Pas de colis sous la main ? Dans l’app, vous pouvez la voir fonctionner avec 3 arrêts d’exemple.",
        "intro": (
            "Votre compte est prêt. Vous avez {dias} jours gratuits et nous n’avons pas demandé de carte : à la fin de "
            "l’essai, rien n’est prélevé tout seul. Pour continuer, c’est vous qui choisissez ({mes} par mois ou {anio} par an).\n\n"),
        "plazo": "Il vous reste {quedan} jours d’essai.",
        "plazo_promo": "Rappel : c’est gratuit et sans limite jusqu’au {promo}.",
        "intro_promo": (
            "Votre compte est prêt. C’est gratuit et sans limite jusqu’au {promo}, et nous n’avons pas demandé de carte. "
            "Ensuite vous restez gratuit avec jusqu’à {tope} arrêts par jour ; sans limite, {mes} par mois ou {anio} par an, "
            "seulement si vous le voulez.\n\n"),
        "firma": "Daniel, {marca}",
        "baja": "Vous ne voulez plus d’e-mails comme celui-ci ? Désinscrivez-vous ici : {baja}",
        "boton": {"bienvenida": "Ouvrir l’app", "primer_dia": "Charger ma première tournée", "casi_fin": "Voir mon compte",
                  "recordatorio": "Charger ma tournée", "invita": "Voir mon lien et mon QR", "bono": "Charger ma tournée", "bono25": "Ouvrir ma tournée"},
    },
    "it": {
        "bienvenida": (
            "Il tuo account {marca} è pronto: ecco come caricare il tuo primo percorso",
            "Ciao {nombre},\n\n"
            "{intro}"
            "Il tuo primo percorso in 3 passi:\n"
            "1. Apri l’app: {ruta}\n"
            "   Sul telefono, «Installa l’app» la mette nella schermata iniziale.\n"
            "2. Tocca «Carica i pacchi: uno dopo l’altro» e fai una foto all’etichetta di ogni pacco. "
            "L’indirizzo entra da solo; se uno non si legge, lo scrivi.\n"
            "3. Tocca «Crea percorso e inizia»: ordina le fermate e ti porta a ogni porta.\n\n"
            "Nessun pacco a portata di mano? Nell’app, «Vedilo in azione con 3 fermate di esempio».\n\n"
            "{ayuda}"),
        "primer_dia": (
            "Ti aiuto con il tuo primo percorso?",
            "Ciao {nombre},\n\n"
            "Hai creato il tuo account {marca} {cuando} e non hai ancora caricato nessuna fermata. "
            "Se ti sei bloccato, la via più rapida è:\n\n"
            "1. Apri {ruta}\n"
            "2. «Carica i pacchi: uno dopo l’altro» e una foto a ogni etichetta.\n"
            "3. «Crea percorso e inizia».\n\n"
            "Oggi niente pacchi? Nell’app, «Vedilo in azione con 3 fermate di esempio».\n\n"
            "{plazo}\n\n"
            "{ayuda_corta}"),
        "casi_fin": (
            "Ti restano {quedan} giorni di prova su {marca}",
            "Ciao {nombre},\n\n"
            "{hecho}"
            "La tua prova gratuita finisce il {fin}. Non si addebita niente da solo: se vuoi continuare, apri l’app, "
            "scheda «Account», e scegli {mes} al mese o {anio} all’anno. Altrimenti non paghi nulla.\n\n"
            "Account: {cuenta}\n\n"
            "{ayuda_corta}"),
        "recordatorio": (
            "Consegni questa settimana? Il tuo percorso pronto in 2 minuti",
            "Ciao {nombre},\n\n"
            "Qualche giorno fa hai creato il tuo account {marca} e non hai ancora inserito nessun pacco. "
            "Quando avrai il giro davanti, è così veloce:\n\n"
            "1. Apri {ruta}\n"
            "2. «Carica i pacchi: uno dopo l’altro» e una foto a ogni etichetta: l’indirizzo entra da solo.\n"
            "3. «Crea percorso e inizia»: ordina le fermate per tempo e ti guida con la voce.\n\n"
            "E due cose che ti fanno risparmiare tempo: «Mani libere» (su Android dici \"consegnato\" e continui a "
            "guidare) e «I miei soldi oggi» (quanto hai guadagnato e quanto se ne va in carburante).\n\n"
            "{plazo}\n\n"
            "{ayuda_corta}"),
        "invita": (
            "{entregadas} consegne con {marca}: la passi a un collega?",
            "Ciao {nombre},\n\n"
            "Sei già a {entregadas} consegne con {marca}. Se conosci un altro corriere a cui può servire, "
            "mandagli il tuo link:\n\n"
            "{invita}\n\n"
            "Quando si registra e fa 20 consegne in 2 giorni diversi (nel suo primo mese), guadagni {euros} per "
            "ciascuno. {promo_ref}Lo ricevi con {cobro}. Il tuo link, il tuo QR e le condizioni sono nell’app, "
            "scheda «Account»: {cuenta}\n\n"
            "{ayuda_invita}"),
        "cobro_es": "Bizum o bonifico",
        "promo_ref": "Sono {euros} per ogni collega che si registra con il tuo link fino al {promo_hasta} (promozione). ",
        "bono": (
            "{bono_euros} per il tuo primo percorso con {marca}",
            "Ciao {nombre},\n\n"
            "Fino al {bono_hasta} abbiamo un regalo perché tu provi {marca} sul tuo giro vero:\n\n"
            "· {bono_euros} per te quando fai le tue prime 20 consegne vere con l’app, in 2 giorni diversi.\n"
            "· {euros} in più per ogni collega che si registra con il tuo link e fa lo stesso.\n\n"
            "{progreso}"
            "Lo ricevi con {cobro}. Quando avrai i pacchi davanti:\n"
            "1. Apri {ruta}\n"
            "2. «Carica i pacchi: uno dopo l’altro» e una foto a ogni etichetta: l’indirizzo entra da solo.\n"
            "3. «Crea percorso e inizia»: ordina le fermate e ti guida con la voce.\n\n"
            "Il tuo link per invitare: {invita}\n\n"
            "{ayuda_corta}"),
        "bono25": (
            "Complimenti! Il tuo primo percorso con {marca} ora vale {bono_euros}",
            "Ciao {nombre},\n\n"
            "Ti sei registrato su {marca} e non hai ancora fatto il tuo primo percorso con l’app. Buona notizia: ora "
            "vale {bono_euros}. È il nostro modo di ringraziarti per provarla sulle tue consegne vere.\n\n"
            "Come si guadagna:\n"
            "1. Apri l’app ({ruta}) o scaricala da Google Play: {play}\n"
            "2. «Carica i pacchi: uno dopo l’altro» e una foto a ogni etichetta (o scansiona il codice): l’indirizzo "
            "entra da solo.\n"
            "3. «Crea percorso e inizia»: ordina le fermate e ti guida con la voce fino a ogni porta.\n\n"
            "Con 20 consegne vere in 2 giorni diversi, i {bono_euros} vanno nel tuo portafoglio e li ricevi con "
            "{cobro}. Hai tempo fino al {bono_limite}. E se un collega si registra con il tuo link (scheda "
            "«Account») e fa lo stesso, {euros} in più per te.\n\n"
            "{progreso}"
            "Se l’app ti serve, valutala su Google Play ({valorar}): aiuta altri corrieri a trovarla.\n\n"
            "{ayuda_corta}"),
        "play": "Scarica da Google Play",
        "qr_pie": "Lo leggi dal computer? Inquadra il codice con il telefono.",
        "bono_linea": ("E un regalo: fino al {bono_hasta}, ricevi {bono_euros} quando fai le tue prime 20 consegne vere "
                       "con l’app (in 2 giorni diversi), più {euros} per ogni collega che inviti e che fa lo stesso."),
        "progreso": "Hai già {n} consegne che contano.\n\n",
        "cuando": ("ieri", "qualche giorno fa"),
        "ayuda_invita": "Manca qualcosa all’app per le tue consegne? Rispondimi con una riga e ci guardo.",
        "ayuda_invita_sin": "Grazie per usarla.",
        "cobro_fuera": "PayPal",
        "hecho_si": "In questi giorni hai caricato {paradas} fermate{entregas}.\n\n",
        "entregas": " e consegnato {n}",
        "hecho_no": "Non hai ancora caricato nessuna fermata: sei ancora in tempo per provarla sul tuo giro vero ({ruta}).\n\n",
        "ayuda": "Se qualcosa non funziona o ti manca qualcosa, rispondi a questa e-mail: la leggo io.",
        "ayuda_sin": "Consiglio: fai la prima prova con 3 o 4 pacchi prima di partire; in due minuti vedi se ti serve.",
        "ayuda_corta": "Cosa ti ha frenato, o cosa manca? Rispondimi con una riga e ci guardo.",
        "ayuda_corta_sin": "Nessun pacco a portata di mano? Nell’app puoi vederla funzionare con 3 fermate di esempio.",
        "intro": (
            "Il tuo account è pronto. Hai {dias} giorni gratis e non ti abbiamo chiesto la carta, quindi alla fine "
            "della prova non si addebita niente da solo. Se vuoi continuare, lo scegli tu ({mes} al mese o {anio} all’anno).\n\n"),
        "plazo": "Ti restano {quedan} giorni di prova.",
        "plazo_promo": "Ricorda: è gratis e senza limiti fino al {promo}.",
        "intro_promo": (
            "Il tuo account è pronto. È gratis e senza limiti fino al {promo}, e non ti abbiamo chiesto la carta. "
            "Dopo resti gratis con fino a {tope} fermate al giorno; senza limiti, {mes} al mese o {anio} all’anno, "
            "solo se vuoi.\n\n"),
        "firma": "Daniel, {marca}",
        "baja": "Non vuoi più e-mail come questa? Cancellati qui: {baja}",
        "boton": {"bienvenida": "Apri l’app", "primer_dia": "Carica il mio primo percorso", "casi_fin": "Vedi il mio account",
                  "recordatorio": "Carica il mio percorso", "invita": "Vedi il mio link e il mio QR", "bono": "Carica il mio percorso", "bono25": "Apri il mio percorso"},
    },
    "de": {
        "bienvenida": (
            "Dein {marca}-Konto ist bereit: So lädst du deine erste Route",
            "Hallo {nombre},\n\n"
            "{intro}"
            "Deine erste Route in 3 Schritten:\n"
            "1. Öffne die App: {ruta}\n"
            "   Auf dem Handy legt «App installieren» sie auf den Startbildschirm.\n"
            "2. Tippe auf «Pakete laden: eins nach dem anderen» und fotografiere das Etikett jedes Pakets. "
            "Die Adresse trägt sich von selbst ein; lässt sich eine nicht lesen, tippst du sie ein.\n"
            "3. Tippe auf «Route erstellen und starten»: Die App ordnet deine Stopps und führt dich zu jeder Tür.\n\n"
            "Keine Pakete zur Hand? In der App: «Mit 3 Beispielstopps in Aktion sehen».\n\n"
            "{ayuda}"),
        "primer_dia": (
            "Soll ich dir bei deiner ersten Route helfen?",
            "Hallo {nombre},\n\n"
            "Du hast dein {marca}-Konto {cuando} erstellt und noch keinen Stopp geladen. "
            "Falls du hängen geblieben bist, geht es am schnellsten so:\n\n"
            "1. Öffne {ruta}\n"
            "2. «Pakete laden: eins nach dem anderen» und ein Foto von jedem Etikett.\n"
            "3. «Route erstellen und starten».\n\n"
            "Heute keine Pakete? In der App: «Mit 3 Beispielstopps in Aktion sehen».\n\n"
            "{plazo}\n\n"
            "{ayuda_corta}"),
        "casi_fin": (
            "Dir bleiben noch {quedan} Testtage bei {marca}",
            "Hallo {nombre},\n\n"
            "{hecho}"
            "Dein kostenloser Test endet am {fin}. Es wird nichts automatisch abgebucht: Wenn du weitermachen willst, "
            "öffne die App, Reiter «Konto», und wähle {mes} im Monat oder {anio} im Jahr. Sonst zahlst du nichts.\n\n"
            "Konto: {cuenta}\n\n"
            "{ayuda_corta}"),
        "recordatorio": (
            "Lieferst du diese Woche? Deine Route in 2 Minuten fertig",
            "Hallo {nombre},\n\n"
            "Vor ein paar Tagen hast du dein {marca}-Konto erstellt und noch kein Paket geladen. "
            "Wenn du die Route vor dir hast, geht es so schnell:\n\n"
            "1. Öffne {ruta}\n"
            "2. «Pakete laden: eins nach dem anderen» und ein Foto von jedem Etikett: Die Adresse trägt sich von selbst ein.\n"
            "3. «Route erstellen und starten»: Die App ordnet deine Stopps nach Fahrzeit und führt dich per Sprache.\n\n"
            "Und zwei Dinge, die Zeit sparen: «Freisprechen» (auf Android sagst du \"zugestellt\" und fährst weiter) "
            "und «Mein Geld heute» (was du verdient hast und was für Sprit draufgeht).\n\n"
            "{plazo}\n\n"
            "{ayuda_corta}"),
        "invita": (
            "{entregadas} Zustellungen mit {marca}: Gibst du sie an einen Kollegen weiter?",
            "Hallo {nombre},\n\n"
            "Du hast schon {entregadas} Zustellungen mit {marca} gemacht. Wenn du einen anderen Fahrer kennst, dem sie "
            "helfen könnte, schick ihm deinen Link:\n\n"
            "{invita}\n\n"
            "Wenn er sich registriert und 20 Zustellungen an 2 verschiedenen Tagen macht (in seinem ersten Monat), "
            "bekommst du {euros} für jeden. {promo_ref}Ausgezahlt wird per {cobro}. Dein Link, dein QR-Code und die "
            "Bedingungen stehen in der App, Reiter «Konto»: {cuenta}\n\n"
            "{ayuda_invita}"),
        "cobro_es": "Bizum oder Überweisung",
        "promo_ref": "Es sind {euros} für jeden Kollegen, der sich bis zum {promo_hasta} mit deinem Link registriert (Aktion). ",
        "bono": (
            "{bono_euros} für deine erste Route mit {marca}",
            "Hallo {nombre},\n\n"
            "Bis zum {bono_hasta} haben wir ein Geschenk, damit du {marca} auf deiner echten Route ausprobierst:\n\n"
            "· {bono_euros} für dich, wenn du deine ersten 20 echten Zustellungen mit der App machst, an 2 verschiedenen Tagen.\n"
            "· {euros} mehr für jeden Kollegen, der sich mit deinem Link registriert und dasselbe macht.\n\n"
            "{progreso}"
            "Ausgezahlt wird per {cobro}. Wenn du die Pakete vor dir hast:\n"
            "1. Öffne {ruta}\n"
            "2. «Pakete laden: eins nach dem anderen» und ein Foto von jedem Etikett: Die Adresse trägt sich von selbst ein.\n"
            "3. «Route erstellen und starten»: Die App ordnet deine Stopps und führt dich per Sprache.\n\n"
            "Dein Einladungslink: {invita}\n\n"
            "{ayuda_corta}"),
        "bono25": (
            "Glückwunsch! Deine erste Route mit {marca} ist jetzt {bono_euros} wert",
            "Hallo {nombre},\n\n"
            "Du hast dich bei {marca} registriert und deine erste Route mit der App noch nicht gemacht. Gute Nachricht: "
            "Sie ist jetzt {bono_euros} wert. So sagen wir Danke, dass du sie auf deinen echten Zustellungen ausprobierst.\n\n"
            "So bekommst du sie:\n"
            "1. Öffne die App ({ruta}) oder hol sie dir bei Google Play: {play}\n"
            "2. «Pakete laden: eins nach dem anderen» und ein Foto von jedem Etikett (oder scanne den Code): Die Adresse "
            "trägt sich von selbst ein.\n"
            "3. «Route erstellen und starten»: Die App ordnet deine Stopps und führt dich per Sprache bis zu jeder Tür.\n\n"
            "Mit 20 echten Zustellungen an 2 verschiedenen Tagen landen die {bono_euros} in deinem Guthaben, ausgezahlt "
            "per {cobro}. Du hast Zeit bis zum {bono_limite}. Und wenn sich ein Kollege mit deinem Link registriert "
            "(Reiter «Konto») und dasselbe macht, gibt es {euros} mehr für dich.\n\n"
            "{progreso}"
            "Wenn dir die App hilft, bewerte sie bei Google Play ({valorar}): So finden sie mehr Fahrer.\n\n"
            "{ayuda_corta}"),
        "play": "Bei Google Play laden",
        "qr_pie": "Liest du das am Computer? Scanne den Code mit dem Handy.",
        "bono_linea": ("Und ein Geschenk: Bis zum {bono_hasta} bekommst du {bono_euros}, wenn du deine ersten 20 echten "
                       "Zustellungen mit der App machst (an 2 verschiedenen Tagen), plus {euros} für jeden eingeladenen "
                       "Kollegen, der dasselbe macht."),
        "progreso": "Du hast schon {n} Zustellungen, die zählen.\n\n",
        "cuando": ("gestern", "vor ein paar Tagen"),
        "ayuda_invita": "Fehlt der App etwas für deine Zustellungen? Antworte mir mit einer Zeile, ich schaue es mir an.",
        "ayuda_invita_sin": "Danke, dass du sie nutzt.",
        "cobro_fuera": "PayPal",
        "hecho_si": "In diesen Tagen hast du {paradas} Stopps geladen{entregas}.\n\n",
        "entregas": " und {n} zugestellt",
        "hecho_no": "Du hast noch keinen Stopp geladen: Du kannst sie noch auf deiner echten Route ausprobieren ({ruta}).\n\n",
        "ayuda": "Wenn etwas nicht funktioniert oder dir etwas fehlt, antworte auf diese E-Mail: Ich lese sie selbst.",
        "ayuda_sin": "Tipp: Mach den ersten Versuch mit 3 oder 4 Paketen, bevor du losfährst; in zwei Minuten siehst du, ob sie dir hilft.",
        "ayuda_corta": "Was hat dich gebremst, oder was fehlt? Antworte mir mit einer Zeile, ich schaue es mir an.",
        "ayuda_corta_sin": "Keine Pakete zur Hand? In der App kannst du sie mit 3 Beispielstopps laufen sehen.",
        "intro": (
            "Dein Konto ist bereit. Du hast {dias} Tage gratis und wir haben keine Karte verlangt: Am Ende des Tests "
            "wird nichts automatisch abgebucht. Wenn du weitermachen willst, entscheidest du ({mes} im Monat oder {anio} im Jahr).\n\n"),
        "plazo": "Dir bleiben noch {quedan} Testtage.",
        "plazo_promo": "Zur Erinnerung: Bis zum {promo} ist alles gratis und ohne Limit.",
        "intro_promo": (
            "Dein Konto ist bereit. Bis zum {promo} ist alles gratis und ohne Limit, und wir haben keine Karte verlangt. "
            "Danach bleibst du gratis mit bis zu {tope} Stopps am Tag; ohne Limit für {mes} im Monat oder {anio} im Jahr, "
            "nur wenn du willst.\n\n"),
        "firma": "Daniel, {marca}",
        "baja": "Keine E-Mails wie diese mehr? Hier abmelden: {baja}",
        "boton": {"bienvenida": "App öffnen", "primer_dia": "Meine erste Route laden", "casi_fin": "Mein Konto ansehen",
                  "recordatorio": "Meine Route laden", "invita": "Meinen Link und QR ansehen", "bono": "Meine Route laden", "bono25": "Meine Route öffnen"},
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
    "bono25": (
        "Parabéns! Sua primeira rota com o {marca} agora vale {bono_euros}",
        "Olá {nombre}:\n\n"
        "Você criou sua conta no {marca} e ainda não fez sua primeira rota com o app. Boa notícia: agora vale "
        "{bono_euros}. É o nosso jeito de agradecer por testar com as suas entregas de verdade.\n\n"
        "Como ganhar:\n"
        "1. Abra o app ({ruta}) ou baixe no Google Play: {play}\n"
        "2. «Carregar pacotes: um atrás do outro» e uma foto de cada etiqueta (ou leia o código): o endereço "
        "entra sozinho.\n"
        "3. «Montar rota e começar»: o app organiza as paradas e te guia por voz até cada porta.\n\n"
        "Com 20 entregas de verdade em 2 dias diferentes, os {bono_euros} vão para a sua carteira e você recebe "
        "por {cobro}. Você tem até {bono_limite}. E se um colega se cadastrar com o seu link (aba «Conta») e "
        "fizer o mesmo, mais {euros} para você.\n\n"
        "{progreso}"
        "Se o app te ajuda, avalie no Google Play ({valorar}): isso ajuda mais entregadores a conhecerem.\n\n"
        "{ayuda_corta}"),
    "play": "Baixar no Google Play",
    "qr_pie": "Lendo no computador? Leia o código com o celular e pronto.",
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
              "recordatorio": "Carregar minha rota", "invita": "Ver meu link e meu QR", "bono": "Carregar minha rota", "bono25": "Abrir minha rota"},
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
    "fr": {
        "opinion_usa": (
            "Comment ça se passe avec {marca} ? (un clic pour répondre)",
            "Bonjour {nombre},\n\n"
            "Vous en êtes à {paradas} arrêts avec {marca} et j’aimerais savoir comment ça se passe. Quelle note lui "
            "donnez-vous ? Touchez-en une :\n\n{opciones}\n\n"
            "Et s’il manque quelque chose ou si quelque chose vous gêne, dites-le-moi : je le lis moi-même et je corrige. "
            "Vous pouvez simplement répondre à cet e-mail."),
        "opinion_frena": (
            "Qu’est-ce qui vous a freiné avec {marca} ? (un clic pour répondre)",
            "Bonjour {nombre},\n\n"
            "Il y a quelques jours vous avez créé votre compte {marca} et vous n’avez pas encore chargé de tournée. "
            "Pas de souci, mais ça m’aiderait beaucoup de savoir pourquoi. Touchez ce qui correspond le mieux :\n\n{opciones}\n\n"
            "Ça me suffit. Si vous voulez m’en dire plus, répondez à cet e-mail : c’est moi qui le lis."),
        "notas": ("J’adore", "Bien", "Correct", "Moyen", "Mauvais"),
        "regalo_linea": ("Au fait : nous avons ajouté {regalo} dans votre portefeuille {marca}, en cadeau, pour que vous "
                         "voyiez que c’est sérieux. Vous le trouverez dans l’app, onglet Compte."),
        "motivos": {"no_ruta": "Je n’ai pas encore eu de livraisons", "no_supe": "Je n’ai pas su comment ajouter les colis",
                    "otra_app": "J’utilise déjà une autre app", "empresa": "Mon entreprise ne le permet pas",
                    "otro": "Autre chose"},
    },
    "it": {
        "opinion_usa": (
            "Come va con {marca}? (si risponde con un clic)",
            "Ciao {nombre},\n\n"
            "Sei a {paradas} fermate con {marca} e mi piacerebbe sapere come va. Che voto le dai? "
            "Toccane uno:\n\n{opciones}\n\n"
            "E se manca qualcosa o qualcosa ti intralcia, dimmelo: lo leggo io e lo sistemo. Puoi rispondere a questa e-mail."),
        "opinion_frena": (
            "Cosa ti ha frenato con {marca}? (si risponde con un clic)",
            "Ciao {nombre},\n\n"
            "Qualche giorno fa hai creato il tuo account {marca} e non hai ancora caricato nessun percorso. Non fa niente, "
            "ma mi aiuterebbe molto sapere perché. Tocca quello che somiglia di più:\n\n{opciones}\n\n"
            "Mi basta questo. Se vuoi raccontarmi di più, rispondi a questa e-mail: la leggo io."),
        "notas": ("La adoro", "Bene", "Normale", "Così così", "Male"),
        "regalo_linea": ("A proposito: ti abbiamo regalato {regalo} nel tuo portafoglio {marca}, per farti vedere che "
                         "facciamo sul serio. Lo trovi nell’app, nella scheda Account."),
        "motivos": {"no_ruta": "Non ho ancora avuto consegne", "no_supe": "Non ho capito come inserire i pacchi",
                    "otra_app": "Uso già un’altra app", "empresa": "La mia azienda non me lo permette", "otro": "Altro"},
    },
    "de": {
        "opinion_usa": (
            "Wie läuft es mit {marca}? (ein Klick zum Antworten)",
            "Hallo {nombre},\n\n"
            "Du bist bei {paradas} Stopps mit {marca} und ich würde gern wissen, wie es läuft. Welche Note gibst du ihr? "
            "Tippe auf eine:\n\n{opciones}\n\n"
            "Und wenn etwas fehlt oder stört, sag es mir: Ich lese es selbst und behebe es. Du kannst einfach auf diese "
            "E-Mail antworten."),
        "opinion_frena": (
            "Was hat dich bei {marca} gebremst? (ein Klick zum Antworten)",
            "Hallo {nombre},\n\n"
            "Vor ein paar Tagen hast du dein {marca}-Konto erstellt und noch keine Route geladen. Kein Problem, aber es "
            "würde mir sehr helfen zu wissen, warum. Tippe auf das, was am besten passt:\n\n{opciones}\n\n"
            "Das reicht mir. Wenn du mir mehr erzählen willst, antworte auf diese E-Mail: Ich lese sie selbst."),
        "notas": ("Super", "Gut", "Okay", "Geht so", "Schlecht"),
        "regalo_linea": ("Übrigens: Wir haben dir {regalo} in dein {marca}-Guthaben gelegt, als Geschenk, damit du siehst, "
                         "dass es ernst gemeint ist. Du findest es in der App im Reiter Konto."),
        "motivos": {"no_ruta": "Ich hatte noch keine Zustellungen", "no_supe": "Ich wusste nicht, wie ich die Pakete eingebe",
                    "otra_app": "Ich nutze schon eine andere App", "empresa": "Meine Firma erlaubt es nicht",
                    "otro": "Etwas anderes"},
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
    "fr": ("janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre",
           "octobre", "novembre", "décembre"),
    "it": ("gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre",
           "ottobre", "novembre", "dicembre"),
    "de": ("Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September",
           "Oktober", "November", "Dezember"),
}


_MESES["br"] = _MESES["pt"]


def _dia_mes(iso, idioma):
    """'2026-12-31' -> «31 de diciembre» / «31 de dezembro» / «31 December»."""
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", str(iso or ""))
    if not m:
        return ""
    dia, mes = int(m.group(3)), _MESES[idioma][int(m.group(2)) - 1]
    if idioma in ("en", "fr", "it"):
        return f"{dia} {mes}"
    if idioma == "de":
        return f"{dia}. {mes}"
    return f"{dia} de {mes}"


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
           bono_hasta: str = "", bono_cent: int = 1000, opinion_url: str = "", regalo_cent: int = 0,
           pase: str = "", play_url: str = "", qr_url: str = "", bono_limite: str = "") -> dict:
    """{asunto, texto, html} del correo `clave` para esta cuenta.

    `pase` (24-10-2026): con él, los enlaces a la app entran sin contraseña (página /pase). El correo se
    abre en Gmail o Chrome y la sesión se quedó en el navegador de Facebook donde se dio de alta: sin pase
    caía en «crear cuenta». Va tras «#», que no viaja al servidor ni a la analítica."""
    if clave not in CLAVES:
        raise ValueError(clave)
    idioma = idioma_de(org)
    t = _T[idioma]
    utm = "utm_source=correo&utm_medium=email&utm_campaign=ciclo&utm_content=" + clave
    if pase:
        ruta = f"{base}/pase?ir=ruta&{utm}#p={pase}"
        cuenta = f"{base}/pase?ir=cuenta&{utm}#p={pase}"
    else:
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
    # «bono25» (29-10-2026): el enlace de Google Play (con su atribución), que también sirve para valorarla,
    # y hasta cuándo puede ganar el bono ESTA cuenta (30 días desde el alta o desde que nació el bono).
    play_url = play_url or PLAY_URL
    datos["play"] = datos["valorar"] = play_url
    datos["bono_limite"] = _dia_mes(bono_limite, idioma) if bono_limite else datos["bono_hasta"]
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
    if clave == "bono25":
        return {"asunto": asunto, "texto": texto, "idioma": idioma,
                "html": _html_bono25(cuerpo, firma, t["boton"][clave], enlace, t["play"], play_url, qr_url, t["qr_pie"], pie)}
    return {"asunto": asunto, "texto": texto, "idioma": idioma,
            "html": _html_de(cuerpo, firma, t["boton"][clave], enlace, pie)}


def _html_bono25(cuerpo, firma, boton, enlace, boton_play, play_url, qr_url, qr_pie, pie):
    """El del bono de 25 € (29-10-2026): el mismo aspecto sobrio, con dos botones (abrir la ruta y Google Play)
    y, si hay, el QR de Play debajo para quien lo lee en el ordenador. Las imágenes remotas las bloquean muchos
    clientes: el texto y los botones dicen lo mismo sin ella."""
    import re

    def enlaces(texto, color):
        return re.sub(r"(https?://[^\s<]+)", r'<a href="\1" style="color:%s">\1</a>' % color, texto)

    # En el HTML las dos direcciones largas (el pase y Google Play) se enseñan cortas: el texto plano las lleva
    # enteras, pero en pantalla una URL de 120 caracteres parte el párrafo (y Gmail la corta).
    esc = _html.escape(cuerpo)
    for url, corto in ((enlace, "flotadsp.com"), (play_url, "play.google.com")):
        if url:
            esc = esc.replace(_html.escape(url), f'<a href="{_html.escape(url)}" style="color:#0369a1">{corto}</a>')
    esc = enlaces(esc, "#0369a1").replace("\n", "<br>")
    qr = ""
    if qr_url:
        qr = (f'<p style="margin:0 0 22px"><img src="{_html.escape(qr_url)}" width="150" height="150" alt="QR Google Play" '
              'style="display:block;border:1px solid #e5e7eb;border-radius:8px"><span style="display:block;margin-top:6px;'
              f'color:#6b7280;font-size:12px">{_html.escape(qr_pie)}</span></p>')
    return (
        '<div style="font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;font-size:15px;'
        'line-height:1.6;color:#111827;max-width:560px">'
        f'{esc}'
        f'<p style="margin:22px 0 12px"><a href="{_html.escape(enlace)}" style="display:inline-block;'
        'background:#0369a1;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;'
        f'font-weight:700">{_html.escape(boton)}</a></p>'
        f'<p style="margin:0 0 18px"><a href="{_html.escape(play_url)}" style="display:inline-block;'
        'border:1px solid #0369a1;color:#0369a1;text-decoration:none;padding:11px 20px;border-radius:8px;'
        f'font-weight:700">{_html.escape(boton_play)}</a></p>'
        f'{qr}'
        f'<p style="margin:0">{_html.escape(firma)}</p>'
        '<p style="margin:28px 0 0;color:#6b7280;font-size:12px">'
        f'{enlaces(_html.escape(pie), "#6b7280")}</p></div>')


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
