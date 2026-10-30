import LegalLayout from '../LegalLayout'
import { COMPANY, PROCESSORS } from '../config'

/* The Security page in English (30-10-2026): the same content as legal/Seguridad.jsx. Only what is true today and
   can be shown (code, infrastructure or CI) goes here: every line is a commercial promise. */
export default function SecurityEn() {
  return (
    <LegalLayout title="Security">
      <p>
        At {COMPANY.brand} we manage operational fleet data: vehicles, drivers, inspection photographs and documents.
        This page explains, without hype, how we protect it. If you are evaluating {COMPANY.brand} for your company and
        need more detail, write to <a href={`mailto:${COMPANY.contactEmail}`}>{COMPANY.contactEmail}</a>.
      </p>

      <h2>1. Isolation per customer (multi-tenant)</h2>
      <ul>
        <li>Each organisation has its own <strong>physically separate database</strong>. One company’s data does not share tables with another’s.</li>
        <li>Isolation is checked with an <strong>automatic test on every code change</strong>: if an organisation could see another’s vehicle, continuous integration blocks the deployment.</li>
      </ul>

      <h2>2. Encryption and authentication</h2>
      <ul>
        <li>All traffic is encrypted with <strong>enforced HTTPS</strong> (HSTS on). Nothing is served in the clear.</li>
        <li>Passwords are stored as <strong>bcrypt hashes</strong> — never in the clear; not even we can read them.</li>
        <li>Sessions use <strong>expiring JWT tokens</strong> with revocation: when a user is deleted, their active sessions stop working.</li>
        <li>Role-based access control (owner, administrator, driver) with different permissions per role.</li>
      </ul>

      <h2>3. Infrastructure</h2>
      <ul>
        <li>Backend hosted in the European Union (Paris region). Database on MongoDB Atlas (EU).</li>
        <li>Frontend served by Cloudflare’s global network, with security headers (CSP) and an origin allow-list (CORS).</li>
        <li>Rate limiting on public endpoints to curb abuse.</li>
        <li>Payments are processed by Stripe (and Google Play inside the Play app): <strong>we never see or store cards</strong>. Their notifications are verified with a cryptographic signature and rejected if unsigned.</li>
      </ul>

      <h2>4. Backups and continuity</h2>
      <ul>
        <li><strong>Automatic daily backup</strong> of every database, transferred encrypted to independent storage.</li>
        <li>A staging environment separate from production: risky changes are validated before reaching customers.</li>
        <li>Service health check every 30 seconds with automatic restart if something fails.</li>
      </ul>

      <h2>5. Development lifecycle</h2>
      <ul>
        <li>Every change goes through continuous integration: build, API tests against a real database, cross-customer isolation tests and contract checkers.</li>
        <li>Application errors are reported to the team automatically the moment they happen.</li>
      </ul>

      <h2>6. Processors</h2>
      <p>Providers that process data on our behalf, all with GDPR safeguards:</p>
      <ul>
        {PROCESSORS.map((p) => (
          <li key={p.name}><strong>{p.name}</strong> — {p.purposeEn || p.purpose} ({p.countryEn || p.country}).</li>
        ))}
      </ul>
      <p>Full details are in the <a href="/privacidad">Privacy Policy</a>.</p>

      <h2>7. Reporting vulnerabilities</h2>
      <p>
        If you find a security flaw, write to{' '}
        <a href={`mailto:${COMPANY.contactEmail}`}>{COMPANY.contactEmail}</a> with the subject
        “Security”. We respond with priority, we will not take action against anyone who reports in good faith,
        and we will credit you if you wish.
      </p>

      <h2>8. What we do not have yet</h2>
      <p>
        We would rather say it ourselves: today we hold no SOC 2 or ISO 27001 certification (we are a young
        product), and we do not offer SSO/SAML. If your company requires them, tell us — they are on our roadmap
        and we prioritise by real demand.
      </p>
    </LegalLayout>
  )
}
