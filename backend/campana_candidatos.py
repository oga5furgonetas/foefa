# -*- coding: utf-8 -*-
"""CAMPAÑA «10 € CON LA APP» A LOS CANDIDATOS DE EMPLEO (17-10-2026).

Dani: «envía los correos a todo el mundo y ponles un botón de desuscribirse… es la última promo que vamos a
hacer así». Se le avisó de que ninguno de los candidatos había marcado «Novedades FDS» (LSSI art. 21: correo
comercial sin consentimiento) y de que Resend puede cerrar la cuenta; decidió mandarlo. Lo que se hace para que
moleste lo menos posible:

  · UN correo por persona, nunca dos (se apunta por dirección antes de enviar).
  · Dice por qué le llega (envió su candidatura de repartidor) y quién escribe.
  · Botón de baja de un clic en el propio correo y cabecera List-Unsubscribe (Gmail enseña «Cancelar
    suscripción»). Quien se da de baja no recibe nada más, de esta ni de ninguna otra campaña.
  · No se escribe a quien dijo que no (`novedades_fds: false` o baja), ni a quien ya tiene cuenta en la app
    (a esos ya les llega el ciclo de correos con el bono), ni a direcciones mal escritas.
  · Sale por tandas de día (10:00-21:00 de Madrid) y deja siempre cuota del día para los correos de la propia
    app: Resend da 100 al día en el plan gratuito.

El módulo no toca la base ni manda nada: decide a quién y devuelve el texto (tests/test_campana_candidatos.py).
"""
import html as _html
import re

CLAVE = "bono10"
_RE_CORREO = re.compile(r"^[^@\s]{1,64}@[^@\s]+\.[a-z]{2,}$", re.I)


def destinatarios(fichas: list, excluir=(), ya=(), bajas=()) -> list:
    """[{email, nombre}] a quien toca escribir: una persona por dirección (la misma persona puede tener varias
    candidaturas), sin quien dijo que no en ninguna de ellas, sin bajas, sin los ya escritos y sin `excluir`."""
    fuera = {str(x).strip().lower() for x in (*excluir, *ya, *bajas) if x}
    for f in fichas:
        if f.get("novedades_fds") is False or f.get("baja_comercial"):
            fuera.add(str(f.get("email") or "").strip().lower())
    vistos, salida = {}, []
    for f in fichas:
        correo = str(f.get("email") or "").strip().lower()
        if not _RE_CORREO.match(correo) or correo in fuera:
            continue
        nombre = str(f.get("nombre") or "").strip()
        if correo in vistos:
            if not vistos[correo]["nombre"] and nombre:
                vistos[correo]["nombre"] = nombre
            continue
        vistos[correo] = {"email": correo, "nombre": nombre}
        salida.append(vistos[correo])
    return salida


def correo(nombre: str, enlace: str, baja: str, marca: str = "FDS") -> dict:
    """{asunto, texto, html}. Sobrio, como el resto de correos: parece una persona, no un folleto."""
    pila = (str(nombre or "").strip().split(" ")[0] or "")[:40]
    saludo = f"Hola {pila}:" if pila else "Hola:"
    asunto = f"10 € para ti con {marca}, la app para repartir"
    cuerpo = (
        f"{saludo}\n\n"
        "Te escribo porque hace un tiempo enviaste tu candidatura para repartir con nosotros. "
        f"Hemos hecho {marca}, una app gratis para quien reparte:\n\n"
        "· Foto a la etiqueta de cada paquete y la dirección entra sola.\n"
        "· La ruta se ordena sola, con el tráfico de cada hora, y te guía con voz hasta cada puerta.\n"
        "· Sabes cuánto llevas ganado en el día y lo que se va en gasolina.\n\n"
        "Y hasta el 31 de diciembre, la última promoción así que vamos a hacer:\n"
        "· 10 € para ti cuando hagas tus primeras 20 entregas con la app (en 2 días distintos).\n"
        "· 10 € más por cada compañero que se registre con tu enlace y haga lo mismo.\n\n"
        "Es gratis y sin límite hasta el 31 de diciembre, no pide tarjeta y lo que ganes lo cobras por Bizum "
        "o transferencia.\n\n"
        f"Pruébala aquí: {enlace}")
    firma = f"Daniel, de {marca}"
    pie = ("Te ha llegado porque enviaste tu candidatura de repartidor. Si no quieres más correos nuestros, "
           f"date de baja con un clic: {baja}")
    texto = f"{cuerpo}\n\n{firma}\n\n--\n{pie}"
    esc = _html.escape(cuerpo).replace(_html.escape(enlace), "").rstrip().replace("\n", "<br>")
    html = (
        '<div style="font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;font-size:15px;'
        'line-height:1.6;color:#111827;max-width:560px">'
        f'{esc}'
        f'<p style="margin:22px 0"><a href="{_html.escape(enlace)}" style="display:inline-block;background:#0369a1;'
        'color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700">'
        'Probar la app gratis</a></p>'
        f'<p style="margin:0">{_html.escape(firma)}</p>'
        '<p style="margin:28px 0 8px;color:#6b7280;font-size:12px">Te ha llegado porque enviaste tu candidatura '
        'de repartidor. Si no quieres más correos nuestros:</p>'
        f'<p style="margin:0"><a href="{_html.escape(baja)}" style="display:inline-block;border:1px solid #d1d5db;'
        'color:#374151;text-decoration:none;padding:8px 14px;border-radius:8px;font-size:13px">'
        'Darme de baja</a></p></div>')
    return {"asunto": asunto, "texto": texto, "html": html}
