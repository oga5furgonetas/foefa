import LegalLayout from './LegalLayout'
import { COMPANY, PROCESSORS } from './config'

export default function Privacidad() {
  return (
    <LegalLayout title="Política de Privacidad">
      <p>En {COMPANY.brand} tratamos los datos personales conforme al Reglamento (UE) 2016/679 (RGPD) y la legislación nacional aplicable. Esta política explica qué datos recogemos, para qué los usamos, con quién los compartimos y cómo puedes ejercer tus derechos.</p>

      <h2>1. Responsable del tratamiento</h2>
      <ul>
        <li><strong>{COMPANY.legalName}</strong>{COMPANY.cif ? `, NIF ${COMPANY.cif}` : ''}.</li>
        {COMPANY.address && <li>Domicilio: {COMPANY.address}.</li>}
        <li>Contacto en materia de privacidad: <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>.</li>
      </ul>

      <h2>2. Datos que tratamos</h2>
      <ul>
        <li><strong>Cuenta de cliente (empresa):</strong> nombre de la empresa, nombre y apellidos del titular, correo electrónico, contraseña (en hash), datos de facturación.</li>
        <li><strong>Conductores dados de alta por el cliente:</strong> nombre, correo, teléfono, DNI (si lo aporta), centro/estación, fotografía de perfil (opcional).</li>
        <li><strong>Vehículos:</strong> matrícula, marca, modelo, VIN, kilometraje, fechas de ITV y renting, documentos.</li>
        <li><strong>Inspecciones:</strong> fotografías del vehículo, fecha y hora, análisis de la IA (daños detectados), comentarios.</li>
        <li><strong>Reparto (si la empresa lo usa):</strong> datos de los clientes de la empresa a los que se entrega (nombre, teléfono, dirección y qué lleva el pedido) y la <strong>ubicación del conductor solo durante la jornada</strong> que él mismo empieza y termina en su móvil, tras haber leído un aviso.</li>
        <li><strong>Candidaturas de empleo:</strong> datos del formulario y, si marcas la casilla opcional, el registro de tu autorización para recibir novedades de FDS y su fecha.</li>
        <li><strong>Uso del servicio:</strong> registros técnicos (logs) imprescindibles para la seguridad y el funcionamiento.</li>
        <li><strong>Mercadillo de repartidores:</strong> lo que publicas (texto, precio, zona y fotos, a las que al subirlas quitamos la ubicación y los demás datos que guarda el móvil), tu nombre con la inicial del apellido, que es lo único que ven los demás de ti, los mensajes con quien compra o vende y los avisos o denuncias. Tu teléfono, tu correo y tu empresa no se enseñan a nadie: el correo lo usamos solo para avisarte de que tienes un mensaje o de que se ha revisado tu anuncio. Si activas los avisos al móvil, guardamos esa elección y la suscripción de tu navegador para mandártelos; el aviso dice quién te escribe y sobre qué anuncio, nunca el mensaje.</li>
        <li><strong>Programa «Invita y gana»:</strong> quién invitó a quién, el saldo de la cartera y, si pides cobrarlo, el nombre del titular y el teléfono de Bizum, el IBAN o el email de PayPal. En la cartera individual del portal guardamos también el identificador del conductor, su email de empresa y la empresa asociada a su enlace. Para evitar trampas guardamos una huella cifrada de la red desde la que se crea cada cuenta (no la dirección IP), que solo sirve para comparar dos altas.</li>
      </ul>
      <p>No recogemos categorías especiales de datos (salud, ideología, etc.). La ubicación solo existe en el módulo de reparto y solo en jornada: fuera de ella no se guarda ningún punto.</p>
      <p><strong>Quién decide sobre cada dato.</strong> De los datos de la propia cuenta (la empresa, su titular, la facturación) somos responsables. De los datos que la empresa mete de <em>sus</em> personas —conductores, empleados y, en el reparto, sus clientes— la responsable es la empresa y {COMPANY.brand} es su <strong>encargado del tratamiento</strong>, según el <a href="/encargo">Acuerdo de Encargo del Tratamiento</a>. La cartera individual de referidos es una función separada gestionada por {COMPANY.brand}; la empresa no ve el saldo ni los datos de cobro del conductor. Si eres conductor o cliente de una de esas empresas, dirígete a ella para ejercer tus derechos sobre los datos de su servicio; te ayudaremos a atenderlos.</p>

      <h2>3. Finalidades y base jurídica</h2>
      <ul>
        <li><strong>Prestar el servicio</strong> (alta de empresa, gestión de flota, inspecciones, análisis IA): ejecución del contrato (art. 6.1.b RGPD).</li>
        <li><strong>Facturación y pagos, incluidos los premios de «Invita y gana»:</strong> ejecución de las condiciones del programa y cumplimiento de las obligaciones contables y fiscales aplicables.</li>
        <li><strong>Seguridad y prevención de fraude</strong> (también en «Invita y gana»): interés legítimo (art. 6.1.f).</li>
        <li><strong>Pagar el saldo de «Invita y gana»:</strong> ejecución de las condiciones del programa (art. 6.1.b) y obligaciones contables y fiscales (art. 6.1.c).</li>
        <li><strong>Comunicaciones del servicio</strong> (avisos, soporte): ejecución del contrato.</li>
        <li><strong>Mercadillo:</strong> publicar tus anuncios, hacerte llegar los mensajes y avisarte, en ejecución de sus condiciones (art. 6.1.b); revisar los anuncios y atender denuncias, por interés legítimo y por obligación legal (Reglamento (UE) 2022/2065 de Servicios Digitales, art. 6.1.c y f). Los mensajes solo se revisan si alguien los denuncia.</li>
        <li><strong>Novedades de FDS para candidatos:</strong> consentimiento opcional, separado de la candidatura y revocable en cualquier momento. No marcarlo no afecta a la candidatura.</li>
        <li><strong>Mejora del modelo de IA (anonimizado / agregado):</strong> interés legítimo; nunca se publican imágenes ni se identifican personas.</li>
      </ul>

      <h2>4. Conservación</h2>
      <ul>
        <li>Datos de cuenta: durante la vigencia del contrato y hasta 1 año tras la baja, para responder reclamaciones.</li>
        <li>Inspecciones y fotos: durante la vigencia del contrato; el cliente puede solicitar su eliminación en cualquier momento.</li>
        <li>Reparto: los datos personales de cada pedido se borran solos a los días que fije la empresa (por defecto 30, máximo 90); los recorridos de ubicación, a los 30 días; los enlaces de seguimiento que recibe el cliente dejan de funcionar al día siguiente del reparto y no muestran datos personales.</li>
        <li>Mercadillo: los anuncios y sus fotos se borran solos 60 días después de acabar (vendido, caducado, quitado o retirado); las conversaciones, 6 meses después del último mensaje; los avisos y las denuncias ya resueltas, a los 6 meses. Las fotos que no llegan a publicarse, a los 2 días.</li>
        <li>Datos fiscales: 6 años (art. 30 Código de Comercio). Los pagos de «Invita y gana» (titular, importe y cuenta o Bizum) se guardan ese mismo plazo.</li>
        <li>Datos de candidaturas: hasta 12 meses. La elección sobre novedades se conserva junto con la candidatura durante ese plazo o hasta que se retire el consentimiento y se solicite la supresión cuando proceda.</li>
      </ul>

      <h2>5. Encargados del tratamiento (a quién comunicamos datos)</h2>
      <p>Para prestar el servicio nos apoyamos en proveedores que actúan como encargados del tratamiento bajo contrato:</p>
      <ul>
        {PROCESSORS.map((p) => (
          <li key={p.name}><strong>{p.name}</strong> — {p.purpose} <span className="text-dark-500">({p.country})</span></li>
        ))}
      </ul>
      <p>Cuando hay transferencias internacionales, se realizan al amparo del EU-US Data Privacy Framework o Cláusulas Contractuales Tipo.</p>

      <h2>6. Tus derechos</h2>
      <p>Puedes ejercer en cualquier momento los derechos de <strong>acceso, rectificación, supresión, oposición, limitación y portabilidad</strong>, así como retirar tu consentimiento, escribiéndonos a <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>. Si consideras que no atendemos correctamente tu solicitud, puedes presentar una reclamación ante la <a href="https://www.aepd.es" target="_blank" rel="noreferrer">Agencia Española de Protección de Datos (AEPD)</a>.</p>

      <h2>7. Seguridad</h2>
      <p>Aplicamos medidas técnicas y organizativas razonables: cifrado en tránsito (HTTPS/TLS), control de acceso por roles, contraseñas con hash (bcrypt), copias de seguridad periódicas, y registros de auditoría.</p>

      <h2>8. Menores</h2>
      <p>El servicio está dirigido a empresas. No tratamos conscientemente datos de menores de 14 años.</p>

      <h2>9. Usuarios en China</h2>
      <p>Si usas {COMPANY.brand} desde la República Popular China, tus datos personales y los de tus clientes que introduzcas se tratan <strong>fuera de China, en la Unión Europea</strong> (y con los encargados del apartado 5), para prestarte el servicio. Lo hacemos solo con tu <strong>consentimiento expreso y separado</strong>, que se pide al crear la cuenta y queda registrado con su fecha, conforme a la Ley de Protección de Información Personal de China (PIPL). Quién trata los datos, para qué, qué datos y cómo ejercer tus derechos (acceso, copia, rectificación, supresión y retirada del consentimiento) es lo que explica esta política; escríbenos a <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>. Retirar el consentimiento implica dejar de usar el servicio y que borremos la cuenta.</p>
      <p lang="zh-CN">如果你在中华人民共和国境内使用 {COMPANY.brand}，你的个人信息以及你录入的客户信息将为提供服务而在<strong>中国境外（欧盟）</strong>处理（以及第 5 节所列的受托处理方）。我们仅在取得你<strong>单独、明确的同意</strong>后进行处理：该同意在注册时取得并记录日期，符合《中华人民共和国个人信息保护法》。处理者身份、处理目的、信息种类以及如何行使你的权利（查阅、复制、更正、删除及撤回同意），均见本政策；请发送邮件至 <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>。撤回同意意味着停止使用本服务并删除账号。</p>

      <h2>10. Cambios</h2>
      <p>Podemos actualizar esta política; te avisaremos por correo o en el panel cuando los cambios sean sustanciales. La versión vigente es siempre la publicada en esta página.</p>
    </LegalLayout>
  )
}
