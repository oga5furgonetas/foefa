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

El módulo no toca la base: valida y decide. Se prueba entero sin red (tests/test_mercadillo.py).
"""
import re

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

TITULO_MIN, TITULO_MAX = 4, 80
DESCRIPCION_MAX = 1000
ZONA_MAX = 60
PRECIO_MIN_CENT, PRECIO_MAX_CENT = 100, 2_000_000          # de 1 € a 20.000 € (una furgoneta cabe)
FOTOS_MIN, FOTOS_MAX = 1, 6
ACTIVOS_MAX = 3                                           # anuncios en revisión o publicados a la vez
DIAS_PUBLICADO = 30
MENSAJE_MAX = 1000
DENUNCIAS_PARA_OCULTAR = 3                                # avisos de 3 personas: se oculta hasta revisarlo
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
    return {"titulo": titulo, "categoria": categoria, "estado_articulo": estado,
            "precio_cent": precio_cent(d.get("precio")), "zona": _texto(d.get("zona"), ZONA_MAX),
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
    s = str(texto or "").strip()
    if not s:
        raise Invalido("Escribe el mensaje.")
    return s[:MENSAJE_MAX]


def euros(cent: int) -> str:
    """1300 00 → «1.300 €»; 2550 → «25,50 €»."""
    cent = int(cent or 0)
    entero, resto = divmod(abs(cent), 100)
    txt = f"{entero:,}".replace(",", ".")
    return f"{'-' if cent < 0 else ''}{txt}{',%02d' % resto if resto else ''} €"
