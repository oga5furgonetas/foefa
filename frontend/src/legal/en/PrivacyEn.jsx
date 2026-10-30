import LegalLayout from '../LegalLayout'
import { COMPANY, PROCESSORS } from '../config'

/* The Privacy Policy in English (30-10-2026, outside Spain): the same content as legal/Privacidad.jsx, which is the
   version that applies. Keep both in step. */
export default function PrivacyEn() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>At {COMPANY.brand} we process personal data in accordance with Regulation (EU) 2016/679 (GDPR) and the applicable national legislation. This policy explains what data we collect, what we use it for, who we share it with and how you can exercise your rights.</p>

      <h2>1. Data controller</h2>
      <ul>
        <li><strong>{COMPANY.legalName}</strong>{COMPANY.cif ? `, tax ID ${COMPANY.cif}` : ''}.</li>
        {COMPANY.address && <li>Address: {COMPANY.address}.</li>}
        <li>Privacy contact: <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>.</li>
      </ul>

      <h2>2. Data we process</h2>
      <ul>
        <li><strong>Customer account (company):</strong> company name, name and surname of the account holder, email, password (hashed), billing details.</li>
        <li><strong>Drivers registered by the customer:</strong> name, email, phone, ID document (if provided), depot/station, profile photo (optional).</li>
        <li><strong>Vehicles:</strong> registration plate, make, model, VIN, mileage, inspection and leasing dates, documents.</li>
        <li><strong>Inspections:</strong> photographs of the vehicle, date and time, AI analysis (detected damage), comments.</li>
        <li><strong>Deliveries (if the company uses them):</strong> the data of the company’s own customers being delivered to (name, phone, address and what the order contains) and the <strong>driver’s location only during the working day</strong>, which the driver starts and ends on their own phone after reading a notice.</li>
        <li><strong>Job applications:</strong> the form data and, if you tick the optional box, the record of your consent to receive news from FDS and its date.</li>
        <li><strong>Use of the service:</strong> technical logs essential for security and operation.</li>
        <li><strong>Couriers’ marketplace:</strong> what you post (text, price, area and photos, from which we strip the location and the other data the phone stores when you upload them), your name with the initial of your surname, which is all others see of you, the messages with whoever buys or sells, and the notices or reports. Your phone, your email and your company are never shown to anyone: the email is used only to tell you that you have a message or that your listing has been reviewed. If you turn on notifications, we store that choice and your browser’s subscription to send them; the notice says who writes to you and about which listing, never the message.</li>
        <li><strong>“Invite and earn” programme:</strong> who invited whom, the wallet balance and, if you request a payout, the holder’s name and the Bizum phone number, the IBAN or the PayPal email. In the individual wallet of the driver portal we also store the driver identifier, their company email and the company linked to their link. To prevent cheating we store an encrypted fingerprint of the network from which each account is created (not the IP address), used only to compare two sign-ups.</li>
      </ul>
      <p>We do not collect special categories of data (health, ideology, etc.). Location exists only in the delivery module and only during the working day: outside it, no point is stored.</p>
      <p><strong>Who decides about each piece of data.</strong> We are the controller of the data of the account itself (the company, its holder, billing). For the data the company enters about <em>its</em> people (drivers, employees and, in deliveries, its customers) the company is the controller and {COMPANY.brand} is its <strong>processor</strong>, under the <a href="/encargo">Data Processing Agreement</a>. The individual referral wallet is a separate feature run by {COMPANY.brand}; the company does not see the driver’s balance or payout details. If you are a driver or a customer of one of those companies, contact it to exercise your rights over the data of its service; we will help it respond.</p>

      <h2>3. Purposes and legal basis</h2>
      <ul>
        <li><strong>Providing the service</strong> (company sign-up, fleet management, inspections, AI analysis): performance of the contract (art. 6.1.b GDPR).</li>
        <li><strong>Billing and payments, including the “Invite and earn” rewards:</strong> performance of the programme terms and compliance with the applicable accounting and tax obligations.</li>
        <li><strong>Security and fraud prevention</strong> (also in “Invite and earn”): legitimate interest (art. 6.1.f).</li>
        <li><strong>Paying out the “Invite and earn” balance:</strong> performance of the programme terms (art. 6.1.b) and accounting and tax obligations (art. 6.1.c).</li>
        <li><strong>Service communications</strong> (notices, support): performance of the contract.</li>
        <li><strong>Marketplace:</strong> publishing your listings, delivering your messages and notifying you, in performance of its terms (art. 6.1.b); reviewing listings and handling reports, on the basis of legitimate interest and legal obligation (Regulation (EU) 2022/2065, the Digital Services Act; art. 6.1.c and f). Messages are reviewed only if someone reports them.</li>
        <li><strong>FDS news for applicants:</strong> optional consent, separate from the application and revocable at any time. Not ticking it does not affect the application.</li>
        <li><strong>Improving the AI model (anonymised / aggregated):</strong> legitimate interest; images are never published and people are never identified.</li>
      </ul>

      <h2>4. Retention</h2>
      <ul>
        <li>Account data: for the duration of the contract and up to 1 year after termination, to answer claims.</li>
        <li>Inspections and photos: for the duration of the contract; the customer can request their deletion at any time.</li>
        <li>Deliveries: the personal data of each order is deleted automatically after the number of days the company sets (30 by default, 90 at most); location tracks, after 30 days; the tracking links the customer receives stop working the day after the delivery and show no personal data.</li>
        <li>Marketplace: listings and their photos are deleted automatically 60 days after they end (sold, expired, withdrawn or removed); conversations, 6 months after the last message; notices and resolved reports, after 6 months. Photos that never get published, after 2 days.</li>
        <li>Tax data: 6 years (art. 30 of the Spanish Commercial Code). “Invite and earn” payouts (holder, amount and account or Bizum) are kept for that same period.</li>
        <li>Job application data: up to 12 months. The choice about news is kept with the application for that period or until consent is withdrawn and deletion is requested where applicable.</li>
      </ul>

      <h2>5. Processors (who we share data with)</h2>
      <p>To provide the service we rely on providers that act as processors under contract:</p>
      <ul>
        {PROCESSORS.map((p) => (
          <li key={p.name}><strong>{p.name}</strong> — {p.purposeEn || p.purpose} <span className="text-dark-500">({p.countryEn || p.country})</span></li>
        ))}
      </ul>
      <p>Where international transfers take place, they rely on the EU-US Data Privacy Framework or Standard Contractual Clauses.</p>

      <h2>6. Your rights</h2>
      <p>You can exercise at any time your rights of <strong>access, rectification, erasure, objection, restriction and portability</strong>, and withdraw your consent, by writing to <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>. If you consider that we have not handled your request properly, you can lodge a complaint with the <a href="https://www.aepd.es" target="_blank" rel="noreferrer">Spanish Data Protection Agency (AEPD)</a> or with the supervisory authority of your country.</p>

      <h2>7. Security</h2>
      <p>We apply reasonable technical and organisational measures: encryption in transit (HTTPS/TLS), role-based access control, hashed passwords (bcrypt), regular backups and audit logs.</p>

      <h2>8. Minors</h2>
      <p>The service is aimed at companies and professionals. We do not knowingly process data of children under 14.</p>

      <h2>9. Changes</h2>
      <p>We may update this policy; we will notify you by email or in the panel when the changes are substantial. The version in force is always the one published on this page.</p>
    </LegalLayout>
  )
}
