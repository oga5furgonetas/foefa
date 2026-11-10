# -*- coding: utf-8 -*-
"""El mercadillo de repartidores (17-10-2026).

Dani: «montar tipo mercadillo que le salga a ellos y lo vea todo el mundo: ¿quieres vender algo que no uses
por si un compañero lo quiere?», «que yo pueda aprobar los anuncios» y «un canal de mensajes entre ellos que
le llegue a su propio buzón», «de manera legal, que nosotros no tengamos ningún problema».

Cómo queda legal (resumen; el detalle está en Términos → «Mercadillo» y en la Privacidad):
  · Es un tablón entre PARTICULARES: FDS no vende, no cobra, no interviene en el pago ni en la entrega.
    Las ventas profesionales no se admiten (así no hay obligaciones de «comerciante» en la plataforma).
  · Prestador de alojamiento (Reglamento de Servicios Digitales, DSA): no responde de lo que publican
    mientras no sepa que es ilegal y lo quite en cuanto lo sabe. Por eso: cada anuncio se REVISA antes de
    salir, hay botón «Denunciar» en cada anuncio y en cada conversación (art. 16), quien denuncia recibe
    acuse y la decisión (art. 16.4-5), y quien publica recibe el MOTIVO si se rechaza o se retira (art. 17).
  · Normas claras con lo prohibido (art. 14), entre ellas el material de la empresa, de la plataforma de reparto o de clientes.
  · Datos: se enseña nombre e inicial; las fotos pierden la ubicación (se vuelven a codificar); el contacto
    es por mensajes dentro de la app, sin teléfonos; los mensajes son privados y solo se revisan si alguien
    los denuncia; todo se borra solo (ver los plazos abajo).
  · Bloquear (10-11-2026): cualquiera puede bloquear a quien vende un anuncio o a quien le escribe. Dejan de
    verse los anuncios el uno al otro y ninguno puede escribir al otro; a quien se bloquea no se le avisa y a
    quien modera sí. Un bloqueo no retira nada por sí solo. Se guarda quién bloquea a quién y cuándo, solo lo
    ve quien modera, y se borra al desbloquear o al pedir la baja de la cuenta.
  · Lo que Apple pide además a una app con contenido de usuarios (guideline 1.2; 10-11-2026): aceptar las normas
    la primera vez que se entra (`NORMAS_VERSION`), un filtro automático del lenguaje ofensivo en anuncios y
    mensajes (`ofensivo`, abajo: un filtro básico de lista) y poder quitarle el mercadillo a quien incumple, con
    su motivo y cómo reclamar (`MOTIVOS_EXPULSION`).

El módulo no toca la base: valida y decide. Se prueba entero sin red (tests/test_mercadillo.py).
"""
import re
import unicodedata

CATEGORIAS = {
    "movil": "Móviles y electrónica",
    "furgoneta": "Furgoneta y accesorios",
    "herramientas": "Herramientas y carga",
    "ropa": "Ropa de trabajo",
    "otros": "Otras cosas",
}
ESTADOS_ARTICULO = {
    "nuevo": "Nuevo",
    "como_nuevo": "Como nuevo",
    "buen_estado": "Buen estado",
    "con_marcas": "Con marcas de uso",
}
# Por qué se rechaza o se retira un anuncio: lo que recibe quien lo publicó (DSA art. 17).
MOTIVOS_RECHAZO = {
    "prohibido": "Es un artículo que las normas no permiten vender.",
    "empresa": "Parece material de una empresa, de la plataforma de reparto o de un cliente, y eso no se puede vender aquí.",
    "fotos": "Las fotos no enseñan el artículo o no se ve bien lo que se vende.",
    "datos": "Falta información o lo que se cuenta no cuadra con las fotos o el precio.",
    "profesional": "Parece una venta profesional; el mercadillo es solo entre particulares.",
    "denuncias": "Lo hemos retirado tras revisar los avisos de otros usuarios.",
    "otro": "No cumple las normas del mercadillo.",
}
# Por qué se denuncia (DSA art. 16): lo elige quien avisa, y explica con sus palabras.
MOTIVOS_DENUNCIA = {
    "prohibido": "Está prohibido o es ilegal",
    "estafa": "Es un engaño o una posible estafa",
    "robado": "Es robado o de una empresa",
    "ofensivo": "Es ofensivo o es acoso",
    "otro": "Otra cosa",
}
# Por qué se le quita a alguien el mercadillo: lo que se le dice a esa persona, con cómo reclamar (DSA art. 17).
MOTIVOS_EXPULSION = {
    "ofensivo": "Has publicado o enviado contenido ofensivo.",
    "acoso": "Has acosado o molestado a otra persona.",
    "prohibido": "Has intentado vender algo que las normas no permiten.",
    "estafa": "Hemos visto un engaño o un intento de estafa.",
    "repetido": "Has incumplido las normas varias veces.",
    "otro": "Has incumplido las normas del mercadillo.",
}
# Las normas que se aceptan la primera vez que se entra. Al cambiar las normas se cambia esta fecha, y la web
# vuelve a pedirlas a todo el mundo (lo aceptado queda en `mercadillo_prefs.normas`: qué versión y cuándo).
NORMAS_VERSION = "2026-11-10"

TITULO_MIN, TITULO_MAX = 4, 80
DESCRIPCION_MAX = 1000
ZONA_MAX = 60
PRECIO_MIN_CENT, PRECIO_MAX_CENT = 100, 2_000_000          # de 1 € a 20.000 € (una furgoneta cabe)
FOTOS_MIN, FOTOS_MAX = 1, 6
ACTIVOS_MAX = 3                                           # anuncios en revisión o publicados a la vez
DIAS_PUBLICADO = 30
MENSAJE_MAX = 1000
DENUNCIAS_PARA_OCULTAR = 3                                # avisos de 3 personas: se oculta hasta revisarlo
# Bloquear a una persona (10-11-2026; lo pide Apple a toda app con contenido de usuarios, guideline 1.2):
BLOQUEOS_MAX = 200                                        # personas que alguien puede tener bloqueadas a la vez
BLOQUEOS_DIA = 30                                         # bloqueos nuevos por persona y día
BLOQUEOS_PARA_AVISAR = 2                                  # bloqueada por 2 personas distintas: aviso a quien modera
# Plazos de borrado (lo que dice la Privacidad):
DIAS_BORRAR_ANUNCIO = 60                                  # tras acabar (vendido, caducado, quitado…)
DIAS_BORRAR_CONVERSACION = 180                            # tras el último mensaje
DIAS_BORRAR_AVISO = 180

ESTADOS_ACTIVOS = ("pendiente", "publicado", "en_revision")
ESTADOS_FINALES = ("rechazado", "retirado", "vendido", "quitado", "caducado")


class Invalido(ValueError):
    """Lo que manda el formulario no vale; el texto es para enseñárselo tal cual."""


def _texto(v, maximo: int) -> str:
    s = re.sub(r"[ \t]+", " ", str(v or "")).strip()
    return s[:maximo]


# ── EL FILTRO DEL LENGUAJE OFENSIVO (10-11-2026) ─────────────────────────────
# Apple (guideline 1.2) pide «a method for filtering objectionable content». Cada anuncio lo sigue revisando una
# persona antes de salir; esto es lo automático, para los anuncios y los mensajes. ES UN FILTRO BÁSICO DE LISTA:
# compara palabras y frases enteras, sin mayúsculas ni tildes. No entiende el contexto ni las letras cambiadas
# («h1jo de…») y no lo detecta todo: para lo demás están «Denunciar», «Bloquear» y quien modera.
#
# Qué entra: insultos inequívocos, insultos racistas u homófobos y amenazas; en español y en inglés, y los pocos de
# gallego, catalán, portugués, francés, italiano y alemán que no significan otra cosa.
# Qué NO entra, a propósito (mejor corto y sin falsos positivos que largo):
#   · las palabrotas sueltas EN ESPAÑOL, que entre compañeros se usan sin ir contra nadie: «puta» («está de puta
#     madre» es un elogio), «puto», «coño», «joder», «mierda», «hostia», «cabrón» (en España también es un piropo y
#     en México «está cabrón» es «está difícil»): entran cuando van CONTRA alguien («hijo de puta», «eres una mierda»).
#     En inglés es al revés (10-11-2026): el mercadillo está en español y una palabrota suelta en inglés («fuck»,
#     «shit», «bullshit»…) no es el habla normal de aquí, así que pararla no molesta a nadie: entran también sueltas.
#     Las que NO entran son las palabras inglesas que aquí significan otra cosa o son nombres: «rape» (el pescado, y
#     «pelado al rape»), «dick» («Moby Dick», la ropa Dickies), «cock», «ass», «sex», «sexy» y «porno»;
#   · lo que tiene un uso normal en un mercadillo de repartidores: «negro» (un chaleco negro), «moro», «gitano» o
#     «chino» sin más, «marica» (en Colombia es «tío»), «bastardo» (hay limas bastardas), «retard» (en catalán
#     es «retraso»: una palabra de repartidor), «retrasado» (un pedido), «polla», «zorra», «perra», «cerdo»…;
#   · los insultos flojos («tonto», «idiota», «imbécil», «payaso»): «perdona, soy idiota» no ofende a nadie;
#   · amenazas que también son frases normales: «te voy a buscar» (a la nave), «sé dónde vives» (te lo acerco).
# Solo palabras ENTERAS: «disputa», «computadora», «mariconera» (se venden) y «Scunthorpe» pasan.
# Cada entrada, como la compara `_palabras`: en minúsculas, sin tildes (con su ñ) y con un espacio entre palabras.
OFENSIVO = (
    # Insultos (español de aquí y de América).
    "hijo de puta", "hija de puta", "hijos de puta", "hijas de puta", "hijo de la gran puta", "hija de la gran puta",
    "hijo puta", "hijoputa", "hijaputa", "hijodeputa", "hijueputa", "joputa", "tu puta madre", "puta de tu madre",
    "me cago en tu madre", "me cago en tus muertos", "gilipollas", "jilipollas", "subnormal", "subnormales",
    "retrasado mental", "retrasada mental", "mongolo", "mongolos", "malnacido", "malnacida", "malparido", "malparida",
    "soplapollas", "chupapollas", "comepollas", "comemierda", "comemierdas", "mamaguevo", "mamahuevo",
    "eres una mierda", "eres un mierda", "chupame la polla", "comeme la polla", "chinga tu madre",
    "hijo de la chingada", "concha de tu madre", "conchetumadre", "conchatumadre", "coño de tu madre",
    # Racistas y homófobos (español). El color, el origen o el pueblo, solos, no: solo con el insulto pegado.
    "negrata", "negratas", "sudaca", "sudacas",
    "negro de mierda", "negra de mierda", "negros de mierda", "puto negro", "puta negra", "putos negros",
    "moro de mierda", "mora de mierda", "moros de mierda", "puto moro", "puta mora", "putos moros",
    "gitano de mierda", "gitana de mierda", "gitanos de mierda", "puto gitano", "puta gitana", "putos gitanos",
    "maricon", "maricones", "maricona", "mariconas", "bollera", "bolleras",
    # Amenazas (español).
    "te voy a matar", "voy a matarte", "te vamos a matar", "os voy a matar", "te voy a rajar", "te voy a violar",
    "voy a violarte", "te parto la cara", "te voy a partir la cara", "te rompo la cara", "te voy a romper la cara",
    "te parto las piernas", "te voy a partir las piernas", "te rompo las piernas", "te voy a romper las piernas",
    "ojala te mueras",
    # Inglés: insultos, racistas y homófobos, y amenazas.
    "fuck you", "fuck u", "fuck off", "fuck yourself", "fucker", "fuckers", "motherfucker", "motherfuckers",
    "son of a bitch", "bitch", "bitches", "asshole", "assholes", "arsehole", "arseholes", "dickhead", "dickheads",
    "cunt", "cunts", "cocksucker", "cocksuckers", "wanker", "wankers", "whore", "whores", "slut", "sluts",
    "shithead", "shitheads", "suck my dick", "nigger", "niggers", "nigga", "niggas", "faggot", "faggots",
    "kill you", "kill u", "kill yourself", "hope you die",
    # Inglés: las palabrotas, también sueltas (aquí no son el habla normal; lo que NO entra, arriba).
    "fuck", "fucking", "fuckin", "fucked", "shit", "shitty", "bullshit", "pussy", "porn",
    # Gallego, catalán y portugués.
    "fillo de puta", "filla de puta", "fillo da puta", "filla da puta", "fill de puta", "fills de puta",
    "filho da puta", "filha da puta", "vai tomar no cu", "vai se foder", "vai te foder",
    # Francés, italiano y alemán.
    "connard", "connards", "connasse", "salope", "salopes", "encule", "encules", "fils de pute", "nique ta mere",
    "stronzo", "stronza", "stronzi", "vaffanculo", "figlio di puttana", "testa di cazzo", "frocio", "froci",
    "arschloch", "arschlocher", "hurensohn", "hurensohne", "fotze", "wichser", "schlampe", "schwuchtel", "fick dich",
)
MENSAJE_OFENSIVO = ("Ese mensaje no se puede enviar: no se permiten insultos, amenazas ni contenido ofensivo. "
                    "Cámbialo y vuelve a enviarlo.")
ANUNCIO_OFENSIVO = "Ese anuncio no se puede enviar: quita los insultos o el contenido ofensivo del texto."


# Lo que no se ve ni ocupa sitio (10-11-2026): los caracteres de formato (`Cf`: guion blando, espacios y uniones de
# ancho cero, marcas de dirección, BOM, etiquetas) y las marcas que van encima de otra letra sin ser una tilde (`Mn` y
# `Me`: los selectores de variación de los emojis, el «une grafemas»). Metido dentro de una palabra, uno de estos la
# partía en dos («gili» + «pollas»), el filtro no la reconocía y al otro le llegaba el insulto entero.
_NO_SE_VE = ("Cf", "Mn", "Me")


def _palabras(texto) -> str:
    """El texto como lo compara el filtro: en minúsculas, sin tildes (la ñ se queda: «año» no es «ano»), sin los
    caracteres que no se ven (`_NO_SE_VE`: no parten una palabra, se quitan) y palabra a palabra, con un espacio a cada
    lado («¡Hijo de PUTA!» → « hijo de puta »). Así una entrada de la lista solo casa con palabras enteras, nunca con
    un trozo de otra. Es una COPIA para comparar: lo que se guarda es lo que se escribió, con sus emojis."""
    plano = []
    for c in unicodedata.normalize("NFKD", unicodedata.normalize("NFC", str(texto or "")).casefold()):
        if c == "̃" and plano and plano[-1] == "n":          # la virgulilla de la ñ no es una tilde
            plano[-1] = "ñ"
        elif not unicodedata.combining(c) and unicodedata.category(c) not in _NO_SE_VE:
            plano.append(c)
    return " " + " ".join(re.findall(r"[^\W_]+", "".join(plano))) + " "


def ofensivo(texto) -> bool:
    """¿Lleva algún insulto o amenaza de `OFENSIVO`? Un filtro básico de lista, por palabras y frases enteras."""
    palabras = _palabras(texto)
    return any(f" {frase} " in palabras for frase in OFENSIVO)


def precio_cent(v) -> int:
    """«1.300», «1300,50», 1300 o 1300.5 € → céntimos. Lanza Invalido si no es un precio razonable."""
    if isinstance(v, bool) or v is None or v == "":
        raise Invalido("Pon el precio.")
    if isinstance(v, (int, float)):
        euros = float(v)
    else:
        s = str(v).replace("€", "").replace(" ", "").strip()
        if re.fullmatch(r"\d{1,3}(\.\d{3})+(,\d{1,2})?", s):        # 1.300 o 1.300,50
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", ".")
        try:
            euros = float(s)
        except ValueError:
            raise Invalido("El precio tiene que ser un número.") from None
    cent = int(round(euros * 100))
    if not PRECIO_MIN_CENT <= cent <= PRECIO_MAX_CENT:
        raise Invalido("El precio va de 1 € a 20.000 €.")
    return cent


def validar(d: dict) -> dict:
    """Los datos de un anuncio, limpios. Lanza Invalido con un texto para el usuario."""
    d = d or {}
    titulo = _texto(d.get("titulo"), TITULO_MAX)
    if len(titulo) < TITULO_MIN:
        raise Invalido("Pon qué vendes (al menos 4 letras).")
    categoria = str(d.get("categoria") or "")
    if categoria not in CATEGORIAS:
        raise Invalido("Elige una categoría.")
    estado = str(d.get("estado_articulo") or "")
    if estado not in ESTADOS_ARTICULO:
        raise Invalido("Di en qué estado está.")
    fotos = [str(f) for f in (d.get("fotos") or []) if f]
    if not FOTOS_MIN <= len(fotos) <= FOTOS_MAX:
        raise Invalido("Sube entre 1 y 6 fotos del artículo.")
    if len(set(fotos)) != len(fotos):
        raise Invalido("Hay una foto repetida.")
    if d.get("acepto") is not True:
        raise Invalido("Confirma que es tuyo, que lo que cuentas es verdad y que cumple las normas.")
    descripcion = str(d.get("descripcion") or "").strip()[:DESCRIPCION_MAX]
    zona = _texto(d.get("zona"), ZONA_MAX)
    # Lo que va a leer la gente (y antes, Dani): sin insultos. Campo a campo, que una frase no se forme a caballo.
    if ofensivo(titulo) or ofensivo(descripcion) or ofensivo(zona):
        raise Invalido(ANUNCIO_OFENSIVO)
    return {"titulo": titulo, "categoria": categoria, "estado_articulo": estado,
            "precio_cent": precio_cent(d.get("precio")), "zona": zona,
            "descripcion": descripcion, "fotos": fotos}


def nombre_publico(nombre: str) -> str:
    """«ANA PÉREZ LÓPEZ» → «Ana P.». Lo que ven los demás de quien vende o escribe."""
    partes = [p for p in re.split(r"\s+", str(nombre or "").strip()) if p]
    if not partes:
        return "Repartidor"
    primero = partes[0][:1].upper() + partes[0][1:].lower()
    if len(partes) == 1:
        return primero[:24]
    return f"{primero[:24]} {partes[1][:1].upper()}."


def mensaje(texto) -> str:
    """Un mensaje de una conversación, listo para guardar. (El texto de una denuncia no pasa por aquí: quien
    denuncia puede tener que citar lo que le han dicho.)"""
    s = str(texto or "").strip()[:MENSAJE_MAX]
    if not s:
        raise Invalido("Escribe el mensaje.")
    if ofensivo(s):
        raise Invalido(MENSAJE_OFENSIVO)
    return s


def euros(cent: int) -> str:
    """1300 00 → «1.300 €»; 2550 → «25,50 €»."""
    cent = int(cent or 0)
    entero, resto = divmod(abs(cent), 100)
    txt = f"{entero:,}".replace(",", ".")
    return f"{'-' if cent < 0 else ''}{txt}{',%02d' % resto if resto else ''} €"
