import LegalLayout from './LegalLayout'
import { COMPANY, PROCESSORS } from './config'

/* CONTRATO DE ENCARGO DEL TRATAMIENTO (art. 28.3 RGPD), como anexo de los
   términos. Lo exige la ley en cuanto una empresa mete en la plataforma datos
   de SUS personas (conductores, y con el reparto, sus clientes): ella es la
   responsable y nosotros su encargado. Se acepta al registrarse, igual que
   los términos; no hace falta firmarlo aparte (art. 28.9 admite el formato
   electrónico). */
export default function Encargo() {
  return (
    <LegalLayout title="Acuerdo de Encargo del Tratamiento" lastUpdate="2026-10-03">
      <p>Este acuerdo forma parte de los <a href="/terminos">Términos y Condiciones</a> y se acepta con ellos al crear la cuenta. Regula el tratamiento de datos personales que {COMPANY.brand} realiza <strong>por cuenta del cliente</strong>, conforme al artículo 28 del Reglamento (UE) 2016/679 (RGPD) y a la Ley Orgánica 3/2018 (LOPDGDD).</p>

      <h2>1. Partes y papeles</h2>
      <ul>
        <li><strong>Responsable del tratamiento:</strong> la empresa cliente titular de la cuenta. Decide qué datos mete, para qué y durante cuánto tiempo.</li>
        <li><strong>Encargado del tratamiento:</strong> {COMPANY.legalName}{COMPANY.cif ? ` (CIF ${COMPANY.cif})` : ''}, que presta {COMPANY.brand}.</li>
      </ul>

      <h2>2. Objeto, duración y naturaleza</h2>
      <p>Alojar y procesar los datos que el cliente introduce para gestionar su flota, su equipo y, si lo usa, su reparto. Dura lo que dure la suscripción. Las operaciones son: registro, conservación, consulta, ordenación de rutas, ubicación en mapa, comunicación a los usuarios que el cliente autoriza y supresión.</p>

      <h2>3. Datos e interesados</h2>
      <ul>
        <li><strong>Conductores y personal del cliente:</strong> identificación, contacto, documentación laboral que el cliente suba, fotografías de inspecciones, turnos y, en el módulo de reparto, <strong>ubicación durante la jornada</strong> que el propio conductor inicia y termina.</li>
        <li><strong>Clientes del cliente (módulo de reparto):</strong> nombre, teléfono, dirección de entrega y contenido del pedido.</li>
      </ul>
      <p>No se tratan categorías especiales de datos. El cliente no debe introducirlas.</p>

      <h2>4. Obligaciones de {COMPANY.brand} como encargado</h2>
      <ol>
        <li>Tratar los datos <strong>solo siguiendo las instrucciones documentadas del cliente</strong>, que son el uso que hace de la plataforma y sus ajustes. Nunca para fines propios.</li>
        <li><strong>No acceder</strong> a los datos de los clientes finales ni a la ubicación de los conductores. Cuando el soporte entra en una cuenta para ayudar, esos datos se muestran ocultos.</li>
        <li>Garantizar que quien trabaja con los datos se ha comprometido a la confidencialidad.</li>
        <li>Aplicar las medidas de seguridad del artículo 32 RGPD: cifrado en tránsito, control de acceso por roles y por empresa (bases de datos separadas), contraseñas con hash, copias de seguridad cifradas y registros de auditoría.</li>
        <li>Recurrir solo a los <strong>subencargados</strong> listados abajo, con contrato que les imponga las mismas obligaciones. Cualquier cambio se avisará con 15 días de antelación para que el cliente pueda oponerse.</li>
        <li>Ayudar al cliente a atender los derechos de los interesados (acceso, rectificación, supresión, oposición, limitación y portabilidad) y en las evaluaciones de impacto si las necesita.</li>
        <li>Notificar al cliente <strong>sin dilación, y como máximo en 48 horas</strong>, cualquier violación de la seguridad de los datos de la que tenga conocimiento.</li>
        <li>Al terminar el servicio, <strong>devolver</strong> los datos (exportación) o <strong>suprimirlos</strong>, a elección del cliente, salvo obligación legal de conservarlos.</li>
        <li>Poner a disposición del cliente la información necesaria para demostrar el cumplimiento y permitir auditorías razonables.</li>
      </ol>

      <h2>5. Obligaciones del cliente como responsable</h2>
      <ul>
        <li>Tener base jurídica para los datos que introduce e <strong>informar</strong> a los interesados: a sus clientes, de que gestiona el reparto con esta herramienta; a sus conductores, de las inspecciones con foto y de la ubicación en jornada (art. 90 LOPDGDD).</li>
        <li>Elegir plazos de conservación adecuados. En el reparto, los datos personales de los pedidos se borran solos a los días que el cliente configure (por defecto 30) y los recorridos a los 30 días.</li>
        <li>Decidir si activa funciones que comunican datos a terceros (por ejemplo, la lectura de tickets con IA).</li>
      </ul>

      <h2>6. Subencargados autorizados</h2>
      <ul>
        {PROCESSORS.map((p) => (
          <li key={p.name}><strong>{p.name}</strong> — {p.purpose} <span className="text-dark-500">({p.country})</span></li>
        ))}
      </ul>
      <p>Las transferencias fuera del Espacio Económico Europeo se amparan en el EU-US Data Privacy Framework, decisiones de adecuación o Cláusulas Contractuales Tipo.</p>

      <h2>7. Contacto</h2>
      <p>Para cualquier cuestión sobre este acuerdo: {COMPANY.privacyEmail
        ? <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>
        : 'el canal de contacto de la plataforma'}.</p>
    </LegalLayout>
  )
}
