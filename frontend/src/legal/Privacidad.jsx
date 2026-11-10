import LegalLayout, { legalEnIngles } from './LegalLayout'
import PrivacyEn from './en/PrivacyEn'
import { useIdioma } from '../lib/idioma'
import { COMPANY, PROCESSORS, MAP_SERVICES, LEGAL_NOTES } from './config'
import { hayPixel } from '../lib/metaPixel'
import { sinPagos } from '../lib/plataforma'

/* 02-11-2026 (revisiones del servidor y de la app): con el permiso del aviso de cookies nuestro servidor también avisa a
   Meta (API de conversiones, backend/meta_capi.py), y esta política no lo decía. Meta va como destinatario, con su
   finalidad, su base (el consentimiento) y cómo retirarlo; y entre los encargados, CartoCiudad (legal/config.js).
   03-11-2026 (el revisor: «encargados del tratamiento bajo contrato» y «al amparo del DPF o Cláusulas Contractuales Tipo»
   no eran ciertas para todos): el §5 separa los encargados con contrato, los servicios de mapas a los que se pregunta sin
   contrato, Telegram (la integración de cada empresa, ya no un encargado nuestro) y los avisos del navegador, cada uno
   con su frase (LEGAL_NOTES en legal/config.js, las mismas en Encargo y Seguridad).
   10-11-2026: bloquear a una persona en el mercadillo (§2, §3 y §4: a quién bloqueas y cuándo, quién lo ve y cuándo se
   borra); y dentro de la app de iPhone no sale «Datos fiscales: 6 años» (§4): allí no se cobra ni se factura nada.
   10-11-2026 (ampliación): cuándo aceptaste las normas del mercadillo; si se te quita el acceso, el motivo y la fecha (solo
   lo ve quien modera, hasta que se devuelve o hasta la baja); y el filtro automático de palabras (§2, §3 y §4).
   10-11-2026 (tercera tanda): en el registro de auditoría queda, además, que se tomó la decisión de quitar el acceso y cuándo
   (§4). Qué apunta ese registro de cada decisión lo pone el servidor (`mercadillo_expulsar` y `mercadillo_readmitir`).
   10-11-2026 (cuarta tanda), §4, para que diga lo que hace el servidor: los bloqueos, las normas aceptadas y el motivo de
   quitar el acceso no se borran al PEDIR la baja (una baja se puede deshacer, y con ella volvería quien fue expulsado) sino
   cuando se borran los datos de la cuenta; el motivo queda también en los anuncios retirados por eso, hasta que se borran a
   los 60 días; y el registro de auditoría apunta sobre qué cuenta y con qué motivo. Las mismas frases, en en/PrivacyEn.jsx;
   las vigila, letra por letra, e2e/ios-sin-pagos.spec.js (`CONSERVACION_ES` y `CONSERVACION_EN`). */
export default function Privacidad() {
  useIdioma()
  // Fuera de España (30-10-2026): la traducción de cortesía al inglés; el español es la versión que vale.
  if (legalEnIngles()) return <PrivacyEn />
  return (
    <LegalLayout title="Política de Privacidad" lastUpdate="2026-11-10">
      <p>En {COMPANY.brand} tratamos los datos personales conforme al Reglamento (UE) 2016/679 (RGPD) y la legislación nacional aplicable. Esta política explica qué datos recogemos, para qué los usamos, con quién los compartimos y cómo puedes ejercer tus derechos.</p>

      <h2>1. Responsable del tratamiento</h2>
      <ul>
        <li><strong>{COMPANY.legalName}</strong>{COMPANY.cif ? `, NIF ${COMPANY.cif}` : ''}.</li>
        {COMPANY.address && <li>Domicilio: {COMPANY.address}.</li>}
        <li>Contacto en materia de privacidad: <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>.</li>
      </ul>

      <h2>2. Datos que tratamos</h2>
      <ul>
        <li><strong>Cuenta de cliente (empresa):</strong> nombre de la empresa, nombre y apellidos del titular, correo electrónico, contraseña (en hash){sinPagos() ? '.' : ', datos de facturación.'}</li>
        <li><strong>Conductores dados de alta por el cliente:</strong> nombre, correo, teléfono, DNI (si lo aporta), centro/estación, fotografía de perfil (opcional).</li>
        <li><strong>Vehículos:</strong> matrícula, marca, modelo, VIN, kilometraje, fechas de ITV y renting, documentos.</li>
        <li><strong>Inspecciones:</strong> fotografías del vehículo, fecha y hora, análisis de la IA (daños detectados), comentarios.</li>
        <li><strong>Reparto (si la empresa lo usa):</strong> datos de los clientes de la empresa a los que se entrega (nombre, teléfono, dirección y qué lleva el pedido) y la <strong>ubicación del conductor solo durante la jornada</strong> que él mismo empieza y termina en su móvil, tras haber leído un aviso.</li>
        <li><strong>Candidaturas de empleo:</strong> datos del formulario y, si marcas la casilla opcional, el registro de tu autorización para recibir novedades de FDS y su fecha.</li>
        <li><strong>Uso del servicio:</strong> registros técnicos (logs) imprescindibles para la seguridad y el funcionamiento.</li>
        <li><strong>Mercadillo de repartidores:</strong> lo que publicas (texto, precio, zona y fotos, a las que al subirlas quitamos la ubicación y los demás datos que guarda el móvil), tu nombre con la inicial del apellido, que es lo único que ven los demás de ti, los mensajes con quien compra o vende y los avisos o denuncias. Tu teléfono, tu correo y tu empresa no se enseñan a nadie: el correo lo usamos solo para avisarte de que tienes un mensaje o de que se ha revisado tu anuncio. Si bloqueas a alguien, guardamos a quién has bloqueado, cuándo y desde qué anuncio o conversación: aparte de ti, solo lo ve quien modera el mercadillo, y a la persona bloqueada no se le avisa. Guardamos también cuándo aceptaste las normas del mercadillo y qué versión de ellas. Y si te quitamos el acceso al mercadillo, guardamos el motivo que te damos y la fecha: aparte de ti, solo lo ve quien modera.{!sinPagos() && ' Si activas los avisos al móvil, guardamos esa elección y la suscripción de tu navegador para mandártelos; el aviso dice quién te escribe y sobre qué anuncio, nunca el mensaje.'}</li>
        {/* En la app de iPhone (09-11-2026) no salen las menciones a «Invita y gana», cartera, pagos ni suscripciones (docs/APP_STORE.md). */}
        {!sinPagos() && <li><strong>Programa «Invita y gana»:</strong> quién invitó a quién, el saldo de la cartera y, si pides cobrarlo, el nombre del titular y el teléfono de Bizum, el IBAN o el email de PayPal. En la cartera individual del portal guardamos también el identificador del conductor, su email de empresa y la empresa asociada a su enlace. Para evitar trampas guardamos una huella cifrada de la red desde la que se crea cada cuenta (no la dirección IP), que solo sirve para comparar dos altas.</li>}
      </ul>
      <p>No recogemos categorías especiales de datos (salud, ideología, etc.). La ubicación solo existe en el módulo de reparto y solo en jornada: fuera de ella no se guarda ningún punto.</p>
      <p><strong>Quién decide sobre cada dato.</strong> De los datos de la propia cuenta {sinPagos() ? '(la empresa y su titular)' : '(la empresa, su titular, la facturación)'} somos responsables. De los datos que la empresa mete de <em>sus</em> personas —conductores, empleados y, en el reparto, sus clientes— la responsable es la empresa y {COMPANY.brand} es su <strong>encargado del tratamiento</strong>, según el <a href="/encargo">Acuerdo de Encargo del Tratamiento</a>.{!sinPagos() && <> La cartera individual de referidos es una función separada gestionada por {COMPANY.brand}; la empresa no ve el saldo ni los datos de cobro del conductor.</>} Si eres conductor o cliente de una de esas empresas, dirígete a ella para ejercer tus derechos sobre los datos de su servicio; te ayudaremos a atenderlos.</p>

      <h2>3. Finalidades y base jurídica</h2>
      <ul>
        <li><strong>Prestar el servicio</strong> (alta de empresa, gestión de flota, inspecciones, análisis IA): ejecución del contrato (art. 6.1.b RGPD).</li>
        {!sinPagos() && <li><strong>Facturación y pagos, incluidos los premios de «Invita y gana»:</strong> ejecución de las condiciones del programa y cumplimiento de las obligaciones contables y fiscales aplicables.</li>}
        <li><strong>Seguridad y prevención de fraude</strong>{sinPagos() ? '' : ' (también en «Invita y gana»)'}: interés legítimo (art. 6.1.f).</li>
        {!sinPagos() && <li><strong>Pagar el saldo de «Invita y gana»:</strong> ejecución de las condiciones del programa (art. 6.1.b) y obligaciones contables y fiscales (art. 6.1.c).</li>}
        <li><strong>Comunicaciones del servicio</strong> (avisos, soporte): ejecución del contrato.</li>
        <li><strong>Mercadillo:</strong> publicar tus anuncios, hacerte llegar los mensajes, aplicar los bloqueos que hagas y avisarte, en ejecución de sus condiciones (art. 6.1.b); revisar los anuncios, pasar un filtro automático de palabras ofensivas por los anuncios y los mensajes antes de enviarlos, atender denuncias, ver los bloqueos para detectar a quien abusa y quitar el acceso a quien incumple, por interés legítimo y por obligación legal (Reglamento (UE) 2022/2065 de Servicios Digitales, art. 6.1.c y f). Los mensajes solo los lee una persona si alguien los denuncia.</li>
        <li><strong>Novedades de FDS para candidatos:</strong> consentimiento opcional, separado de la candidatura y revocable en cualquier momento. No marcarlo no afecta a la candidatura.</li>
        <li><strong>Mejora del modelo de IA (anonimizado / agregado):</strong> interés legítimo; nunca se publican imágenes ni se identifican personas.</li>
        {hayPixel() && <li><strong>Medir los anuncios</strong> (qué anuncios nos traen visitas, altas y repartidores), solo si lo aceptas en el aviso de cookies: tu consentimiento (art. 6.1.a RGPD), que puedes retirar cuando quieras con «Cambiar mis cookies» en la <a href="/cookies">Política de Cookies</a>, sin que afecte a lo anterior. Qué se comunica y a quién, en el apartado 5.</li>}
      </ul>

      <h2>4. Conservación</h2>
      <ul>
        <li>Datos de cuenta: durante la vigencia del contrato y hasta 1 año tras la baja, para responder reclamaciones.</li>
        <li>Inspecciones y fotos: durante la vigencia del contrato; el cliente puede solicitar su eliminación en cualquier momento.</li>
        <li>Reparto: los datos personales de cada pedido se borran solos a los días que fije la empresa (por defecto 30, máximo 90); los recorridos de ubicación, a los 30 días; los enlaces de seguimiento que recibe el cliente dejan de funcionar al día siguiente del reparto y no muestran datos personales.</li>
        <li>Mercadillo: los anuncios y sus fotos se borran solos 60 días después de acabar (vendido, caducado, quitado o retirado); las conversaciones, 6 meses después del último mensaje; los avisos y las denuncias ya resueltas, a los 6 meses. Las fotos que no llegan a publicarse, a los 2 días. Los bloqueos se borran cuando desbloqueas a la persona o cuando se borran los datos de tu cuenta. Cuándo aceptaste las normas se guarda hasta que se borran los datos de tu cuenta. Si se te quita el acceso al mercadillo, el motivo y la fecha se guardan hasta que se te devuelve o hasta que se borran los datos de tu cuenta; en los anuncios que se retiraron por eso queda el motivo hasta que se borran, 60 días después. En el registro de auditoría queda apuntado, además, que se tomó esa decisión, sobre qué cuenta, con qué motivo y cuándo.</li>
        {/* En la app de iPhone (10-11-2026) no sale: allí no se cobra ni se factura nada (docs/APP_STORE.md). La web, igual. */}
        {!sinPagos() && <li>Datos fiscales: 6 años (art. 30 Código de Comercio). Los pagos de «Invita y gana» (titular, importe y cuenta o Bizum) se guardan ese mismo plazo.</li>}
        <li>Datos de candidaturas: hasta 12 meses. La elección sobre novedades se conserva junto con la candidatura durante ese plazo o hasta que se retire el consentimiento y se solicite la supresión cuando proceda.</li>
      </ul>

      <h2>5. A quién comunicamos datos</h2>
      <p><strong>Encargados del tratamiento.</strong> Para prestar el servicio nos apoyamos en estos proveedores, que tratan los datos por encargo nuestro y con contrato:</p>
      <ul>
        {PROCESSORS.map((p) => (
          <li key={p.name}><strong>{p.name}</strong> — {p.purpose} <span className="text-dark-500">({p.country})</span></li>
        ))}
      </ul>
      <p><strong>Servicios de mapas y de búsqueda de direcciones.</strong> {LEGAL_NOTES.es.mapServices}</p>
      <ul>
        {MAP_SERVICES.map((p) => (
          <li key={p.name}><strong>{p.name}</strong> — {p.purpose} <span className="text-dark-500">({p.country})</span></li>
        ))}
      </ul>
      <p><strong>Avisos por Telegram.</strong> {LEGAL_NOTES.es.telegram}</p>
      <p><strong>Avisos en el navegador.</strong> {LEGAL_NOTES.es.browserPush}</p>
      {hayPixel() && <p><strong>Meta, también como destinatario.</strong> Solo si aceptas la medición de anuncios en el aviso de cookies, <strong>Meta Platforms Ireland Ltd.</strong> (Irlanda; con transferencias a EEUU al amparo del EU-US Data Privacy Framework) recibe: desde tu navegador, a través de su píxel, la página visitada y los eventos (alta, prueba, suscripción, regalo); y desde nuestro servidor, si te das de alta para repartir por tu cuenta, tu alta, la primera vez que entras en la app y tu primera ruta, durante los 30 días siguientes al alta, con tu correo cifrado (SHA-256), tu dirección IP, tu navegador, un identificador cifrado de tu cuenta y las cookies del píxel. Nunca tu nombre ni tu teléfono, ni las direcciones o los clientes de tus entregas. <strong>Finalidad:</strong> medir qué anuncios nos traen altas y repartidores. <strong>Base jurídica:</strong> tu consentimiento en el aviso de cookies (art. 6.1.a RGPD). <strong>Puedes retirarlo</strong> cuando quieras con «Cambiar mis cookies» en la <a href="/cookies">Política de Cookies</a>: desde entonces no se le comunica nada más. Meta trata esos datos también según su propia <a href="https://www.facebook.com/privacy/policy" target="_blank" rel="noreferrer">política de privacidad</a>.</p>}
      <p>{LEGAL_NOTES.es.transfers}</p>

      <h2>6. Tus derechos</h2>
      <p>Puedes ejercer en cualquier momento los derechos de <strong>acceso, rectificación, supresión, oposición, limitación y portabilidad</strong>, así como retirar tu consentimiento, escribiéndonos a <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>. Si consideras que no atendemos correctamente tu solicitud, puedes presentar una reclamación ante la <a href="https://www.aepd.es" target="_blank" rel="noreferrer">Agencia Española de Protección de Datos (AEPD)</a>.</p>

      <h2>7. Seguridad</h2>
      <p>Aplicamos medidas técnicas y organizativas razonables: cifrado en tránsito (HTTPS/TLS), control de acceso por roles, contraseñas con hash (bcrypt), copias de seguridad periódicas, y registros de auditoría.</p>

      <h2>8. Menores</h2>
      <p>El servicio está dirigido a empresas. No tratamos conscientemente datos de menores de 14 años.</p>

      <h2>9. Cambios</h2>
      <p>Podemos actualizar esta política; te avisaremos por correo o en el panel cuando los cambios sean sustanciales. La versión vigente es siempre la publicada en esta página.</p>
    </LegalLayout>
  )
}
