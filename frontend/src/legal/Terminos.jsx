import LegalLayout from './LegalLayout'
import { COMPANY } from './config'

export default function Terminos() {
  return (
    <LegalLayout title="Términos y Condiciones de Uso">
      <p>Al registrarte o usar {COMPANY.brand} (en adelante, "el Servicio"), aceptas estas condiciones. Si no estás de acuerdo, no uses el Servicio.</p>

      <h2>1. Quiénes somos</h2>
      <p>El Servicio es prestado por {COMPANY.legalName}{COMPANY.cif ? ` (NIF ${COMPANY.cif})` : ''}{COMPANY.address ? `, con domicilio en ${COMPANY.address}` : ''}. Contacto: <a href={`mailto:${COMPANY.contactEmail}`}>{COMPANY.contactEmail}</a>.</p>

      <h2>2. Objeto del Servicio</h2>
      <p>{COMPANY.brand} es una plataforma web SaaS para gestionar flotas de vehículos, conductores e inspecciones, incluyendo el análisis automático de fotografías mediante inteligencia artificial, y el reparto de pedidos (rutas, escaneo de bultos y seguimiento en jornada).</p>

      <h2>3. Cuenta y responsabilidad del cliente</h2>
      <ul>
        <li>El cliente garantiza que los datos aportados son veraces y que tiene base legal para tratar los datos de sus conductores y vehículos.</li>
        <li>El cliente es responsable de la custodia de sus credenciales y de la actividad realizada bajo su cuenta.</li>
        <li>Está prohibido usar el Servicio para fines ilícitos, vulnerar derechos de terceros o intentar comprometer su seguridad.</li>
      </ul>

      <h2>4. Inteligencia Artificial — alcance y límites</h2>
      <p><strong>Los análisis generados por la IA son una asistencia automatizada y no sustituyen la revisión humana.</strong> {COMPANY.brand} no garantiza que la detección de daños, severidad o coste estimado sea exacta en todos los casos. El cliente es responsable de validar los resultados antes de utilizarlos en disputas con terceros (talleres, conductores, aseguradoras, etc.).</p>
      <p>El Servicio se encuentra en desarrollo activo y mejora de forma continua. Las correcciones y validaciones realizadas por los usuarios (de forma anonimizada y agregada) contribuyen a calibrar y perfeccionar el sistema con el tiempo. {COMPANY.brand} no garantiza un nivel de precisión específico de la IA, pero se compromete a mejorar progresivamente la calidad del análisis.</p>
      <p><strong>Ventaja para clientes fundadores:</strong> los clientes que contraten el Servicio durante su fase inicial recibirán acceso prioritario a nuevas funciones y mejoras de la IA antes que el resto de usuarios.</p>

      <h2>5. Suscripción, prueba y pagos</h2>
      <ul>
        <li>El alta incluye un periodo de prueba gratuito de <strong>14 días</strong> (<strong>7 días</strong> en el plan Repartidor).</li>
        <li><strong>Plan Repartidor:</strong> para darse de alta no se pide tarjeta. Sin suscripción se usa gratis con un máximo de <strong>15 paradas nuevas al día</strong>; sin ese límite cuesta <strong>9,99 € al mes o 99 € al año</strong>, y solo se cobra si te suscribes tú.</li>
        <li><strong>Promoción «gratis y sin límite»:</strong> hasta el <strong>31 de diciembre de 2026</strong> (incluido), el plan Repartidor es gratis y sin límite de paradas para todas las cuentas registradas, sin tarjeta. Al terminar, cada cuenta pasa sola al uso gratis con el máximo de paradas diarias indicado arriba; no se cobra nada si no te suscribes.</li>
        <li>Los pagos con tarjeta se procesan con <strong>Stripe</strong>; dentro de la app instalada desde Google Play, con <strong>Google Play</strong>.</li>
        <li><strong>Regalos:</strong> se pagan una sola vez y no se renuevan. El código se puede usar una vez, en los 12 meses siguientes a la compra, y suma su duración a la cuenta que lo canjea; si esa cuenta ya paga con tarjeta, su siguiente cobro se retrasa lo regalado. Mientras no se haya canjeado, puedes pedir su devolución en los 14 días siguientes a la compra escribiendo a {COMPANY.contactEmail}.</li>
        <li>Las suscripciones se <strong>renuevan automáticamente</strong> al final de cada periodo facturable, salvo cancelación previa.</li>
        <li>Puedes <strong>cancelar en cualquier momento</strong> desde el panel o escribiendo a {COMPANY.contactEmail}. La cancelación es efectiva al final del periodo ya pagado; no procede reembolso del periodo en curso salvo error técnico imputable a {COMPANY.brand} o derecho legal de desistimiento aplicable a consumidores (no aplica a clientes empresariales).</li>
        <li>Los precios pueden actualizarse con aviso previo de al menos 30 días.</li>
      </ul>

      <h2 id="invita">5 bis. Programa «Invita y gana» (plan Repartidor)</h2>
      <ul>
        <li>Cada cuenta del plan Repartidor tiene un enlace de invitación. Por cada persona que se registre con él y <strong>use la app de verdad</strong> —al menos <strong>20 entregas</strong> en <strong>2 días distintos</strong> durante sus primeros <strong>30 días</strong>— quien invita gana <strong>2,50 €</strong> en su cartera. Las cuentas creadas antes del <strong>12 de octubre de 2026</strong>, que se dieron de alta cuando la oferta era de 5 €, siguen ganando <strong>5 €</strong> por invitado.</li>
        <li>No cuentan las cuentas propias o duplicadas, las creadas para conseguir el premio ni las entregas de ejemplo. Si la persona invitada se registra desde la misma red que quien invita, el premio queda en revisión. Como máximo se premian 20 invitaciones al mes por cuenta.</li>
        <li>El saldo se puede cobrar desde <strong>10 €</strong>, por Bizum o transferencia a una cuenta a nombre de quien invita. Revisamos cada solicitud y la pagamos normalmente en un plazo de 7 días hábiles; si los datos no son correctos te avisamos y el saldo vuelve a tu cartera.</li>
        <li>Si detectamos trampas o un uso contrario a estas condiciones podemos anular el saldo afectado y cerrar la participación en el programa.</li>
        <li>Lo que cobres es un ingreso tuyo: declararlo, si corresponde, es responsabilidad de quien lo recibe. Podemos pedirte tu NIF antes de pagarte si la normativa fiscal lo exige.</li>
        <li>Podemos cambiar o terminar el programa avisando con 15 días; el saldo ya ganado se respeta y se puede cobrar.</li>
      </ul>

      <h2>6. Disponibilidad del Servicio</h2>
      <p>{COMPANY.brand} hace esfuerzos razonables para mantener el Servicio disponible 24/7, pero no garantiza un nivel de servicio (SLA) específico salvo acuerdo separado. Pueden producirse interrupciones por mantenimiento o causas ajenas (fallos de proveedores, fuerza mayor).</p>

      <h2>7. Propiedad intelectual</h2>
      <p>El software, marca, diseño y código del Servicio son propiedad de {COMPANY.legalName}. El cliente conserva la titularidad de los datos y fotografías que sube, y otorga a {COMPANY.brand} una licencia limitada para alojarlos y procesarlos con el único fin de prestar el Servicio (incluido el análisis IA y la mejora anonimizada del modelo).</p>

      <h2>8. Limitación de responsabilidad</h2>
      <p>En la máxima medida permitida por la ley, {COMPANY.brand} no responderá por daños indirectos, lucro cesante, pérdida de datos o reclamaciones de terceros derivadas del uso del Servicio. La responsabilidad agregada quedará limitada al importe pagado por el cliente en los 12 meses anteriores al hecho que motive la reclamación.</p>

      <h2>9. Suspensión y baja</h2>
      <p>{COMPANY.brand} podrá suspender o cancelar cuentas que incumplan estos términos, que impaguen suscripciones, o ante actividad fraudulenta. Se notificará por email cuando sea posible.</p>

      <h2>10. Protección de datos</h2>
      <p>El tratamiento de datos personales se rige por la <a href="/privacidad">Política de Privacidad</a>. Los datos que el cliente introduce de sus empleados, conductores o clientes los tratamos como <strong>encargado del tratamiento</strong> según el <a href="/encargo">Acuerdo de Encargo del Tratamiento</a>, que forma parte de estos términos y se acepta con ellos.</p>

      <h2>11. Ley aplicable y jurisdicción</h2>
      <p>Estos términos se rigen por la {COMPANY.governingLaw}. Las controversias se someterán a los Juzgados y Tribunales de {COMPANY.jurisdiction}, salvo norma imperativa en contrario para consumidores.</p>

      <h2>12. Cambios</h2>
      <p>Podemos actualizar estos términos; los cambios sustanciales se notificarán con al menos 15 días de antelación. Si no estás de acuerdo, podrás cancelar tu cuenta antes de que entren en vigor.</p>
    </LegalLayout>
  )
}
