import LegalLayout from '../LegalLayout'
import { COMPANY, PROCESSORS } from '../config'

/* The Data Processing Agreement in English (30-10-2026): the same content as legal/Encargo.jsx, which is the version
   that applies. */
export default function ProcessingEn() {
  return (
    <LegalLayout title="Data Processing Agreement" lastUpdate="2026-10-03">
      <p>This agreement forms part of the <a href="/terminos">Terms and Conditions</a> and is accepted with them when the account is created. It governs the processing of personal data that {COMPANY.brand} carries out <strong>on behalf of the customer</strong>, in accordance with article 28 of Regulation (EU) 2016/679 (GDPR) and Spanish Organic Law 3/2018 (LOPDGDD).</p>

      <h2>1. Parties and roles</h2>
      <ul>
        <li><strong>Controller:</strong> the customer company that holds the account. It decides what data it enters, for what purpose and for how long.</li>
        <li><strong>Processor:</strong> {COMPANY.legalName}{COMPANY.cif ? ` (tax ID ${COMPANY.cif})` : ''}, which provides {COMPANY.brand}.</li>
      </ul>

      <h2>2. Subject matter, duration and nature</h2>
      <p>Hosting and processing the data the customer enters to manage its fleet, its team and, if it uses it, its deliveries. It lasts as long as the subscription. The operations are: recording, storage, consultation, route sorting, map location, communication to the users the customer authorises, and erasure.</p>

      <h2>3. Data and data subjects</h2>
      <ul>
        <li><strong>The customer’s drivers and staff:</strong> identification, contact details, employment documents the customer uploads, inspection photographs, shifts and, in the delivery module, <strong>location during the working day</strong>, which the driver starts and ends.</li>
        <li><strong>The customer’s customers (delivery module):</strong> name, phone, delivery address and order contents.</li>
      </ul>
      <p>No special categories of data are processed. The customer must not enter them.</p>

      <h2>4. Obligations of {COMPANY.brand} as processor</h2>
      <ol>
        <li>To process the data <strong>only on the customer’s documented instructions</strong>, which are the use it makes of the platform and its settings. Never for its own purposes.</li>
        <li><strong>Not to access</strong> the data of end customers or the location of drivers. When support enters an account to help, that data is shown masked.</li>
        <li>To ensure that whoever works with the data has committed to confidentiality.</li>
        <li>To apply the security measures of article 32 GDPR: encryption in transit, role-based and per-company access control (separate databases), hashed passwords, encrypted backups and audit logs.</li>
        <li>To use only the <strong>sub-processors</strong> listed below, under a contract imposing the same obligations on them. Any change will be notified 15 days in advance so that the customer can object.</li>
        <li>To help the customer respond to data subjects’ rights (access, rectification, erasure, objection, restriction and portability) and with impact assessments if it needs them.</li>
        <li>To notify the customer <strong>without undue delay, and within 48 hours at most</strong>, of any personal data breach it becomes aware of.</li>
        <li>When the service ends, to <strong>return</strong> the data (export) or <strong>delete</strong> it, at the customer’s choice, except where there is a legal obligation to keep it.</li>
        <li>To make available to the customer the information needed to demonstrate compliance and to allow reasonable audits.</li>
      </ol>

      <h2>5. Obligations of the customer as controller</h2>
      <ul>
        <li>To have a legal basis for the data it enters and to <strong>inform</strong> the data subjects: its customers, that it manages deliveries with this tool; its drivers, about photo inspections and location during the working day (art. 90 LOPDGDD).</li>
        <li>To choose appropriate retention periods. In deliveries, the personal data of orders is deleted automatically after the number of days the customer configures (30 by default) and location tracks after 30 days.</li>
        <li>To decide whether to enable features that share data with third parties (for example, reading receipts with AI).</li>
      </ul>

      <h2>6. Authorised sub-processors</h2>
      <ul>
        {PROCESSORS.map((p) => (
          <li key={p.name}><strong>{p.name}</strong> — {p.purposeEn || p.purpose} <span className="text-dark-500">({p.countryEn || p.country})</span></li>
        ))}
      </ul>
      <p>Transfers outside the European Economic Area rely on the EU-US Data Privacy Framework, adequacy decisions or Standard Contractual Clauses.</p>

      <h2>7. Contact</h2>
      <p>For any question about this agreement: {COMPANY.privacyEmail
        ? <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>
        : 'the platform’s contact channel'}.</p>
    </LegalLayout>
  )
}
