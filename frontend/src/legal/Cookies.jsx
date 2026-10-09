import LegalLayout from './LegalLayout'
import { COMPANY } from './config'
import { hayPixel } from '../lib/metaPixel'

export default function Cookies() {
  return (
    <LegalLayout title="Política de Cookies">
      <h2>1. ¿Qué son las cookies?</h2>
      <p>Las cookies (y tecnologías similares como el <em>localStorage</em>) son pequeños archivos que un sitio web guarda en tu dispositivo para que funcione correctamente o para recordar información entre visitas.</p>

      <h2>2. Cookies que utiliza {COMPANY.brand}</h2>
      {hayPixel()
        ? <p>{COMPANY.brand} utiliza almacenamiento estrictamente necesario para el funcionamiento del Servicio y, <strong>solo si lo aceptas</strong> en el aviso de cookies, los píxeles de Meta y de TikTok para medir qué anuncios nos traen visitas, altas y suscripciones. Si eliges «Solo necesarias», no se carga ninguno.</p>
        : <p>Actualmente {COMPANY.brand} utiliza <strong>únicamente almacenamiento estrictamente necesario</strong> para el funcionamiento del Servicio. No usamos cookies de seguimiento publicitario ni analítica de terceros.</p>}
      <table className="w-full text-xs">
        <thead><tr className="border-b border-dark-800 text-left text-dark-500"><th className="py-1">Nombre</th><th>Finalidad</th><th>Duración</th><th>Tipo</th></tr></thead>
        <tbody className="text-dark-300">
          <tr className="border-b border-dark-800/60"><td className="py-1.5"><code>flota_token</code></td><td>Mantener tu sesión iniciada</td><td>Hasta cerrar sesión</td><td>Necesaria</td></tr>
          <tr className="border-b border-dark-800/60"><td className="py-1.5"><code>flota_admin</code></td><td>Recordar tu cuenta y permisos</td><td>Hasta cerrar sesión</td><td>Necesaria</td></tr>
          <tr className="border-b border-dark-800/60"><td className="py-1.5"><code>panel_tab</code>, <code>panel_center</code></td><td>Recordar tu pestaña y centro activo</td><td>Hasta limpiar el navegador</td><td>Preferencia</td></tr>
          <tr className="border-b border-dark-800/60"><td className="py-1.5"><code>flota_plan</code></td><td>Recordar el plan elegido durante el registro</td><td>Sesión</td><td>Necesaria</td></tr>
          <tr className="border-b border-dark-800/60"><td className="py-1.5"><code>cookie_consent</code></td><td>Recordar que has visto este aviso{hayPixel() ? ' y lo que elegiste' : ''}</td><td>12 meses</td><td>Necesaria</td></tr>
          {hayPixel() && <tr className="border-b border-dark-800/60"><td className="py-1.5"><code>_fbp</code> (Meta)</td><td>Medir los anuncios de Facebook e Instagram: visitas, altas, pruebas y suscripciones</td><td>3 meses</td><td>Marketing (solo si aceptas)</td></tr>}
          {hayPixel() && <tr><td className="py-1.5"><code>_ttp</code>, <code>_tt_enable_cookie</code>, <code>ttcsid</code> (TikTok)</td><td>Medir los anuncios de TikTok: visitas, altas, pruebas y suscripciones</td><td>Hasta 13 meses</td><td>Marketing (solo si aceptas)</td></tr>}
        </tbody>
      </table>

      <h2>3. Cookies de terceros</h2>
      <p>Durante el proceso de pago serás redirigido a <strong>Stripe</strong>, que puede establecer sus propias cookies necesarias para procesar el pago. Consulta su política en <a href="https://stripe.com/es/privacy" target="_blank" rel="noreferrer">stripe.com/es/privacy</a>.</p>
      {hayPixel() && <p>Si aceptas la medición de anuncios, <strong>Meta Platforms Ireland</strong> y <strong>TikTok Technology Limited</strong> (Irlanda) reciben a través de sus píxeles la página visitada y los eventos (alta, prueba, suscripción, regalo), sin tu correo ni tus datos de reparto. Consulta sus políticas en <a href="https://www.facebook.com/privacy/policy" target="_blank" rel="noreferrer">facebook.com/privacy/policy</a> y <a href="https://www.tiktok.com/legal/page/eea/privacy-policy/es" target="_blank" rel="noreferrer">tiktok.com/legal</a>.</p>}

      <h2>4. Gestión y consentimiento</h2>
      {hayPixel()
        ? <p>Los píxeles de Meta y TikTok solo se cargan si pulsas «Aceptar» en el aviso; «Solo necesarias» es igual de fácil y no carga nada. Puedes cambiar de opinión borrando el almacenamiento del navegador (volverá a salir el aviso; también cerrará tu sesión).</p>
        : <p>Como solo usamos almacenamiento estrictamente necesario, no requerimos consentimiento previo según la guía de la AEPD; aun así, te mostramos un aviso informativo al entrar. Puedes borrar el almacenamiento desde la configuración de tu navegador en cualquier momento (esto cerrará tu sesión).</p>}

      <h2>5. Cambios</h2>
      <p>Si añadimos cookies analíticas o de marketing en el futuro, te pediremos consentimiento previo explícito y actualizaremos esta página.</p>
    </LegalLayout>
  )
}
