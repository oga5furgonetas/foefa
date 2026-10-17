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
        <li>Disponible para las cuentas del plan Repartidor de todos los países donde está la app salvo China. En <strong>España</strong> se cobra por Bizum o transferencia a una cuenta española; fuera de España, por <strong>PayPal</strong> (a una cuenta a nombre de quien invita). Cada cuenta tiene un enlace de invitación. Por cada persona que se registre con él y <strong>use la app de verdad</strong> —al menos <strong>20 entregas</strong> a direcciones distintas, en <strong>2 días distintos</strong> y repartidas a lo largo de cada día, durante sus primeros <strong>30 días</strong>— quien invita gana <strong>2,50 €</strong> en su cartera. Las cuentas creadas antes del <strong>12 de octubre de 2026</strong>, que se dieron de alta cuando la oferta era de 5 €, siguen ganando <strong>5 €</strong> por invitado. <strong>Promoción</strong>: por cada persona que se registre con el enlace <strong>hasta el 31 de diciembre de 2026 incluido</strong> (hora de España) y cumpla lo anterior, el premio es de <strong>10 €</strong>, cuente cuando cuente la última entrega dentro de sus primeros 30 días. (Hasta el 17 de octubre de 2026 esta promoción acababa el 31 de octubre; se ha alargado.)</li>
        <li><strong>Bono de bienvenida</strong> (promoción): las cuentas del plan Repartidor dadas de alta hasta el <strong>31 de diciembre de 2026</strong> incluido (hora de España) ganan <strong>10 €</strong> en su cartera cuando hacen su primera ruta de verdad con la app: al menos <strong>20 entregas</strong> a direcciones distintas, en <strong>2 días distintos</strong> y repartidas a lo largo de cada día, durante sus primeros <strong>30 días</strong> (para las cuentas creadas antes del 17 de octubre de 2026, contados desde esa fecha). Una vez por persona y fuera de China. No cuentan las entregas de ejemplo, las cuentas duplicadas ni las creadas para conseguir el bono; si la cuenta se registra desde la misma red que otra que ya lo cobró, queda en revisión. Se cobra con las mismas reglas que el resto del saldo.</li>
        <li><strong>Regalo de saldo</strong> (17 de octubre de 2026): las cuentas del plan Repartidor que existían ese día reciben <strong>10 €</strong> de regalo en su cartera, una vez por cuenta y fuera de China. Es aparte del bono de bienvenida y se cobra con las mismas reglas que el resto del saldo.</li>
        <li>No cuentan las cuentas propias o duplicadas, las creadas para conseguir el premio ni las entregas de ejemplo. Si la persona invitada se registra desde la misma red que quien invita, el premio queda en revisión. Como máximo se premian 20 invitaciones al mes por cuenta.</li>
        <li>El saldo se puede cobrar desde <strong>60 €</strong>, por Bizum o transferencia a una cuenta a nombre de quien invita (fuera de España, por PayPal). Revisamos cada solicitud y la pagamos normalmente en un plazo de 7 días hábiles; si los datos no son correctos te avisamos y el saldo vuelve a tu cartera.</li>
        <li>Si detectamos trampas o un uso contrario a estas condiciones podemos anular el saldo afectado y cerrar la participación en el programa.</li>
        <li>Lo que cobres es un ingreso tuyo: declararlo, si corresponde, es responsabilidad de quien lo recibe. Podemos pedirte tu NIF antes de pagarte si la normativa fiscal lo exige.</li>
        <li>Podemos cambiar o terminar el programa avisando con 15 días; el saldo ya ganado se respeta y se puede cobrar.</li>
      </ul>

      <h2 id="invita-conductor">5 ter. Cartera individual de conductores</h2>
      <ul>
        <li>Los conductores con acceso real al portal pueden generar un enlace personal para recomendar la app Flota a repartidores externos. La recomendación es personal y no implica que la empresa para la que trabaja el conductor patrocine o recomiende Flota.</li>
        <li>El premio de <strong>2,50 €</strong> (<strong>10 €</strong> por cada persona que se registre hasta el 31 de diciembre de 2026 incluido, promoción) se abona únicamente en la cartera individual del conductor cuyo acceso y email de empresa generaron el enlace. La empresa no recibe ese saldo. No hay un límite mensual de premios. Solo cuenta una nueva cuenta autónoma que se registre con ese enlace y complete, en sus primeros 30 días, 20 entregas reales a direcciones distintas, en al menos 2 días distintos y repartidas durante cada jornada. No cuentan demos, duplicados, autocitas ni entregas de ejemplo; las altas desde la misma red pueden quedar en revisión.</li>
        <li>El conductor puede solicitar el pago desde <strong>60 €</strong>, a su nombre, por Bizum o transferencia en España y por PayPal en los países donde esté disponible. La solicitud se revisa manualmente; normalmente se resuelve en 7 días hábiles. Si se rechaza por datos incorrectos, el saldo vuelve a su cartera; si se confirma fraude, puede anularse.</li>
        <li>El conductor es responsable de facilitar un medio de cobro propio y de declarar los ingresos cuando corresponda. Podemos pedir información fiscal necesaria antes de pagar. El email de empresa identifica la cartera, pero no es por sí mismo el medio de pago.</li>
      </ul>

      <h2 id="mercadillo">5 quater. Mercadillo de repartidores</h2>
      <ul>
        <li><strong>Qué es.</strong> Un tablón dentro de la app y del portal del conductor donde los repartidores con cuenta pueden anunciar cosas suyas que ya no usan y hablar entre ellos por mensajes privados. Es solo entre particulares: no se admiten ventas profesionales, tiendas ni reventa.</li>
        <li><strong>{COMPANY.brand} no es parte de la venta.</strong> No vende, no compra, no cobra comisión, no interviene en el pago ni en la entrega y no garantiza los artículos. El trato es entre quien vende y quien compra, que acuerdan el precio, el pago y la entrega. Recomendamos quedar en persona, revisar el artículo antes de pagar y no pagar nunca por adelantado.</li>
        <li><strong>Revisión antes de publicar.</strong> Revisamos cada anuncio antes de que salga. Podemos no publicarlo o retirarlo si incumple estas normas; en ese caso explicamos el motivo a quien lo publicó, que puede corregirlo o pedirnos que lo revisemos otra vez escribiendo a {COMPANY.contactEmail}.</li>
        <li><strong>No se puede anunciar:</strong> armas y réplicas; drogas, medicamentos y productos sanitarios; alcohol, tabaco y productos de vapeo; falsificaciones; objetos robados o de procedencia dudosa; material de la empresa para la que trabajas, de la plataforma para la que repartes o de sus clientes (escáneres, móviles de trabajo, uniformes, paquetes…); animales; documentos, cuentas, rutas o identificadores de reparto; servicios, empleo o dinero; contenido sexual, ofensivo o discriminatorio; y cualquier cosa cuya venta sea ilegal.</li>
        <li><strong>Quien vende garantiza</strong> que el artículo es suyo, que lo que cuenta y las fotos son verdad y que la venta es legal, y se ocupa de lo que le toque (por ejemplo, el cambio de titular de un vehículo en Tráfico y, si corresponde, los impuestos).</li>
        <li><strong>Límites.</strong> Hasta 3 anuncios activos por persona. Cada anuncio dura 30 días; después se puede volver a enviar.</li>
        <li><strong>Mensajes.</strong> Las conversaciones son privadas entre las dos personas. No las leemos salvo que una de ellas las denuncie o lo exija la ley. No se permite acosar, insultar, mandar publicidad ni pedir datos bancarios o pagos por adelantado.</li>
        <li><strong>Denunciar.</strong> Cualquier usuario puede avisar de un anuncio o de una conversación con el botón «Denunciar», diciendo el motivo. Confirmamos que lo hemos recibido, lo revisa una persona y comunicamos la decisión a quien avisó y, si se actúa, también a quien publicó, con el motivo. Si varias personas avisan del mismo anuncio, se oculta mientras se revisa. Las autoridades pueden dirigirse a {COMPANY.contactEmail}.</li>
        <li><strong>Consecuencias.</strong> Podemos retirar anuncios, cerrar conversaciones y, ante incumplimientos graves o repetidos, quitar el acceso al mercadillo.</li>
        <li><strong>Conductores de una empresa.</strong> Para ellos el mercadillo es voluntario y ajeno a su trabajo. La empresa puede pedirnos que no se muestre a sus conductores.</li>
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
