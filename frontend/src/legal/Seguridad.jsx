import LegalLayout, { legalEnIngles } from './LegalLayout'
import SecurityEn from './en/SecurityEn'
import { useIdioma } from '../lib/idioma'
import { COMPANY, PROCESSORS, MAP_SERVICES, LEGAL_NOTES } from './config'

/* Trust center. REGLA DE ORO: aquí solo se afirma lo que es verdad HOY y se
   puede demostrar (código, infra o CI). Nada aspiracional: cada línea de esta
   página es una promesa comercial. */
export default function Seguridad() {
  useIdioma()
  // Fuera de España (30-10-2026): la traducción de cortesía al inglés; el español es la versión que vale.
  if (legalEnIngles()) return <SecurityEn />
  return (
    <LegalLayout title="Seguridad" lastUpdate="2026-11-03">
      <p>
        En {COMPANY.brand} gestionamos datos operativos de flotas: vehículos, conductores,
        fotografías de inspección y documentación. Esta página explica, sin humo, cómo los
        protegemos. Si evalúas {COMPANY.brand} para tu empresa y necesitas más detalle,
        escríbenos a <a href={`mailto:${COMPANY.contactEmail}`}>{COMPANY.contactEmail}</a>.
      </p>

      <h2>1. Aislamiento por cliente (multi-tenant)</h2>
      <ul>
        <li>Cada organización tiene su <strong>base de datos física separada</strong>. Los datos de una empresa no conviven en las mismas tablas que los de otra.</li>
        <li>El aislamiento se comprueba con un <strong>test automático en cada cambio de código</strong>: si una organización pudiera ver un vehículo de otra, la integración continua bloquea el despliegue.</li>
      </ul>

      <h2>2. Cifrado y autenticación</h2>
      <ul>
        <li>Todo el tráfico va cifrado con <strong>HTTPS forzado</strong> (HSTS activo). No servimos nada en claro.</li>
        <li>Las contraseñas se almacenan con <strong>hash bcrypt</strong> — nunca en claro, ni nosotros podemos leerlas.</li>
        <li>Sesiones con <strong>tokens JWT con caducidad</strong> y revocación: al eliminar un usuario, sus sesiones activas dejan de valer.</li>
        <li>Control de acceso por roles (propietario, administrador, conductor) con permisos distintos por rol.</li>
      </ul>

      <h2>3. Infraestructura</h2>
      <ul>
        {/* 03-11-2026: la base ya no está en MongoDB Atlas. Desde el 23-10-2026 es flota-mongo, en Fly y junto al
            servidor (flota-backend): primary_region "cdg" en backend/fly.toml y en infra/mongo/fly.toml. */}
        <li>El servidor (la API) y la base de datos están en Fly.io, en la Unión Europea (región de París).</li>
        <li>Frontend servido por la red global de Cloudflare, con cabeceras de seguridad (CSP) y lista blanca de orígenes (CORS).</li>
        <li>Limitación de peticiones (rate limiting) en los endpoints públicos para frenar abusos.</li>
        <li>Los pagos los procesa Stripe (y Google Play dentro de la app de Play): <strong>nunca vemos ni almacenamos tarjetas</strong>. Sus notificaciones se verifican con firma criptográfica y se rechazan si no están firmadas.</li>
      </ul>

      <h2>4. Copias de seguridad y continuidad</h2>
      <ul>
        <li><strong>Copia de seguridad diaria automática</strong> de todas las bases de datos, transferida cifrada a almacenamiento independiente.</li>
        <li>Entorno de pruebas (staging) separado de producción: los cambios de riesgo se validan antes de llegar a los clientes.</li>
        <li>Comprobación de salud del servicio cada 30 segundos con reinicio automático si algo falla.</li>
      </ul>

      <h2>5. Ciclo de desarrollo</h2>
      <ul>
        <li>Cada cambio pasa por integración continua: compilación, pruebas de API contra base de datos real, tests de aislamiento entre clientes y verificadores de contratos.</li>
        <li>Los errores de la aplicación se reportan automáticamente al equipo en el momento en que ocurren.</li>
      </ul>

      <h2>6. Encargados del tratamiento</h2>
      {/* 03-11-2026 (el revisor): decía «todos con garantías RGPD» de una lista con Telegram y con servicios a los que se
          pregunta sin contrato. Ahora cada grupo con su frase (LEGAL_NOTES en legal/config.js, la misma en Privacidad y
          en el Encargo). */}
      <p>Proveedores que tratan datos por encargo nuestro, con contrato:</p>
      <ul>
        {PROCESSORS.map((p) => (
          <li key={p.name}><strong>{p.name}</strong> — {p.purpose} ({p.country}).</li>
        ))}
      </ul>
      <p><strong>Servicios de mapas y de búsqueda de direcciones.</strong> {LEGAL_NOTES.es.mapServices}</p>
      <ul>
        {MAP_SERVICES.map((p) => (
          <li key={p.name}><strong>{p.name}</strong> — {p.purpose} ({p.country}).</li>
        ))}
      </ul>
      <p><strong>Avisos por Telegram.</strong> {LEGAL_NOTES.es.telegram}</p>
      <p><strong>Avisos en el navegador.</strong> {LEGAL_NOTES.es.browserPush}</p>
      <p>{LEGAL_NOTES.es.transfers}</p>
      <p>El detalle completo está en la <a href="/privacidad">Política de Privacidad</a>.</p>

      <h2>7. Comunicación de vulnerabilidades</h2>
      <p>
        Si encuentras un fallo de seguridad, escríbenos a{' '}
        <a href={`mailto:${COMPANY.contactEmail}`}>{COMPANY.contactEmail}</a> con el asunto
        «Seguridad». Respondemos con prioridad, no emprenderemos acciones contra quien reporte
        de buena fe, y te acreditaremos si lo deseas.
      </p>

      <h2>8. Lo que aún no tenemos</h2>
      <p>
        Preferimos decirlo nosotros: hoy no contamos con certificación SOC 2 ni ISO 27001
        (somos un producto joven), ni ofrecemos SSO/SAML. Si tu empresa los requiere,
        cuéntanoslo — está en nuestra hoja de ruta y priorizamos por demanda real.
      </p>
    </LegalLayout>
  )
}
