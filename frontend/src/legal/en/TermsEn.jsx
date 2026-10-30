import LegalLayout from '../LegalLayout'
import { COMPANY } from '../config'

/* The Terms and Conditions in English (30-10-2026, outside Spain): the same content as legal/Terminos.jsx, which is
   the version that applies. Keep both in step. */
export default function TermsEn() {
  return (
    <LegalLayout title="Terms and Conditions of Use">
      <p>By registering for or using {COMPANY.brand} (hereinafter, “the Service”), you accept these terms. If you do not agree, do not use the Service.</p>

      <h2>1. Who we are</h2>
      <p>The Service is provided by {COMPANY.legalName}{COMPANY.cif ? ` (tax ID ${COMPANY.cif})` : ''}{COMPANY.address ? `, with address at ${COMPANY.address}` : ''}. Contact: <a href={`mailto:${COMPANY.contactEmail}`}>{COMPANY.contactEmail}</a>.</p>

      <h2>2. Purpose of the Service</h2>
      <p>{COMPANY.brand} is a web SaaS platform to manage vehicle fleets, drivers and inspections, including the automatic analysis of photographs by artificial intelligence, and the delivery of orders (routes, parcel scanning and tracking during the working day).</p>

      <h2>3. Account and customer responsibility</h2>
      <ul>
        <li>The customer warrants that the data provided is true and that it has a legal basis to process the data of its drivers and vehicles.</li>
        <li>The customer is responsible for safeguarding its credentials and for the activity carried out under its account.</li>
        <li>Using the Service for unlawful purposes, infringing third-party rights or attempting to compromise its security is forbidden.</li>
      </ul>

      <h2>4. Artificial Intelligence — scope and limits</h2>
      <p><strong>AI-generated analyses are automated assistance and do not replace human review.</strong> {COMPANY.brand} does not guarantee that the detection of damage, severity or estimated cost is accurate in every case. The customer is responsible for validating the results before using them in disputes with third parties (workshops, drivers, insurers, etc.).</p>
      <p>The Service is under active development and improves continuously. The corrections and validations made by users (anonymised and aggregated) help to calibrate and refine the system over time. {COMPANY.brand} does not guarantee a specific level of AI accuracy, but undertakes to progressively improve the quality of the analysis.</p>
      <p><strong>Founding customers’ advantage:</strong> customers who contract the Service during its initial phase get priority access to new features and AI improvements before other users.</p>

      <h2>5. Subscription, trial and payments</h2>
      <ul>
        <li>Sign-up includes a free trial of <strong>14 days</strong> (<strong>7 days</strong> on the Courier plan).</li>
        <li><strong>Courier plan:</strong> no card is required to sign up. Without a subscription it is used free with a maximum of <strong>15 new stops a day</strong>; without that limit it costs <strong>€9.99 a month or €99 a year</strong> (or the equivalent shown in your currency), and you are only charged if you subscribe yourself.</li>
        <li><strong>“Free and unlimited” promotion:</strong> until <strong>31 December 2026</strong> (inclusive), the Courier plan is free and without a stop limit for every registered account, with no card. When it ends, each account moves automatically to the free use with the daily stop limit stated above; nothing is charged if you do not subscribe.</li>
        <li>Card payments are processed by <strong>Stripe</strong>; inside the app installed from Google Play, by <strong>Google Play</strong>.</li>
        <li><strong>Gifts:</strong> are paid once and do not renew. The code can be used once, within 12 months of purchase, and adds its duration to the account that redeems it; if that account already pays by card, its next charge is postponed by the gifted period. While it has not been redeemed, you may request a refund within 14 days of purchase by writing to {COMPANY.contactEmail}.</li>
        <li>Subscriptions <strong>renew automatically</strong> at the end of each billing period unless cancelled beforehand.</li>
        <li>You can <strong>cancel at any time</strong> from the panel or by writing to {COMPANY.contactEmail}. Cancellation takes effect at the end of the period already paid; no refund is due for the current period except for a technical error attributable to {COMPANY.brand} or a statutory right of withdrawal applicable to consumers (it does not apply to business customers).</li>
        <li>Prices may be updated with at least 30 days’ notice.</li>
      </ul>

      <h2 id="invita">5 bis. “Invite and earn” programme (Courier plan)</h2>
      <ul>
        <li>Available to Courier plan accounts in every country where the app is available. In <strong>Spain</strong> payouts are made by Bizum or bank transfer to a Spanish account; outside Spain, by <strong>PayPal</strong> (to an account in the inviter’s name). Each account has an invitation link. For every person who signs up with it and <strong>really uses the app</strong> —at least <strong>20 deliveries</strong> to different addresses, on <strong>2 different days</strong> and spread across each day, during their first <strong>30 days</strong>— the inviter earns <strong>€2.50</strong> in their wallet. Accounts created before <strong>12 October 2026</strong>, which signed up when the offer was €5, keep earning <strong>€5</strong> per invitee. <strong>Promotion</strong>: for every person who signs up with the link <strong>up to and including 31 December 2026</strong> (Spanish time) and meets the above, the reward is <strong>€10</strong>, whenever their last delivery within their first 30 days takes place. (Until 17 October 2026 this promotion ended on 31 October; it has been extended.)</li>
        <li><strong>Welcome bonus</strong> (promotion): Courier plan accounts created up to and including <strong>31 December 2026</strong> (Spanish time) earn <strong>€25</strong> in their wallet when they complete their first real route with the app: at least <strong>20 deliveries</strong> to different addresses, on <strong>2 different days</strong> and spread across each day, during their first <strong>30 days</strong> (for accounts created before 17 October 2026, counted from that date). Once per person. Sample deliveries, duplicate accounts and accounts created to obtain the bonus do not count; if the account is registered from the same network as another that already received it, it is placed under review. It is paid out under the same rules as the rest of the balance.</li>
        <li><strong>Balance gift</strong> (17 October 2026): Courier plan accounts that existed on that day receive <strong>€10</strong> as a gift in their wallet, once per account. It is separate from the welcome bonus and is paid out under the same rules as the rest of the balance.</li>
        <li>Own or duplicate accounts, accounts created to obtain the reward and sample deliveries do not count. If the invited person signs up from the same network as the inviter, the reward is placed under review. At most 20 invitations a month per account are rewarded.</li>
        <li>The balance can be withdrawn from <strong>€60</strong>, by Bizum or transfer to an account in the inviter’s name (outside Spain, by PayPal). We review every request and normally pay within 7 working days; if the details are wrong we let you know and the balance returns to your wallet.</li>
        <li>If we detect cheating or use contrary to these terms we may cancel the affected balance and end participation in the programme.</li>
        <li>What you receive is your own income: declaring it, where applicable, is the responsibility of the recipient. We may ask for your tax ID before paying if tax rules require it.</li>
        <li>We may change or end the programme with 15 days’ notice; balance already earned is honoured and can be withdrawn.</li>
      </ul>

      <h2 id="invita-conductor">5 ter. Drivers’ individual wallet</h2>
      <ul>
        <li>Drivers with real access to the portal can generate a personal link to recommend the app to external couriers. The recommendation is personal and does not imply that the company the driver works for sponsors or recommends the app.</li>
        <li>The reward of <strong>€2.50</strong> (<strong>€10</strong> for every person who signs up up to and including 31 December 2026, promotion) is paid only into the individual wallet of the driver whose access and company email generated the link. The company does not receive that balance. There is no monthly limit on rewards. Only a new independent account that signs up with that link and completes, in its first 30 days, 20 real deliveries to different addresses, on at least 2 different days and spread across each working day, counts. Demos, duplicates, self-referrals and sample deliveries do not count; sign-ups from the same network may be placed under review.</li>
        <li>The driver may request payment from <strong>€60</strong>, in their own name, by Bizum or transfer in Spain and by PayPal in the countries where it is available. The request is reviewed manually and normally resolved within 7 working days. If it is rejected for wrong details, the balance returns to the wallet; if fraud is confirmed, it may be cancelled.</li>
        <li>The driver is responsible for providing a payment method of their own and for declaring the income where applicable. We may ask for the tax information needed before paying. The company email identifies the wallet but is not in itself the payment method.</li>
      </ul>

      <h2 id="mercadillo">5 quater. Couriers’ marketplace</h2>
      <ul>
        <li><strong>What it is.</strong> A board inside the app and the driver portal where couriers with an account can list things of their own they no longer use and talk to each other by private messages. It is strictly between private individuals: professional sales, shops and resale are not allowed.</li>
        <li><strong>{COMPANY.brand} is not a party to the sale.</strong> It does not sell, does not buy, charges no commission, takes no part in payment or delivery and does not guarantee the items. The deal is between the seller and the buyer, who agree the price, the payment and the handover. We recommend meeting in person, checking the item before paying and never paying in advance.</li>
        <li><strong>Review before publishing.</strong> We review every listing before it goes live. We may decline to publish it or remove it if it breaks these rules; in that case we explain the reason to whoever posted it, who can correct it or ask us to review it again by writing to {COMPANY.contactEmail}.</li>
        <li><strong>Not allowed:</strong> weapons and replicas; drugs, medicines and medical products; alcohol, tobacco and vaping products; counterfeits; stolen items or items of doubtful origin; equipment belonging to the company you work for, to the platform you deliver for or to their customers (scanners, work phones, uniforms, parcels…); animals; documents, accounts, routes or delivery identifiers; services, jobs or money; sexual, offensive or discriminatory content; and anything whose sale is illegal.</li>
        <li><strong>The seller warrants</strong> that the item is theirs, that the description and the photos are true and that the sale is legal, and takes care of whatever falls to them (for example, the change of ownership of a vehicle at the traffic authority and, where applicable, taxes).</li>
        <li><strong>Limits.</strong> Up to 3 active listings per person. Each listing lasts 30 days; afterwards it can be submitted again.</li>
        <li><strong>Messages.</strong> Conversations are private between the two people. We do not read them unless one of them reports them or the law requires it. Harassment, insults, advertising and requests for bank details or advance payments are not allowed.</li>
        <li><strong>Reporting.</strong> Any user can flag a listing or a conversation with the “Report” button, stating the reason. We confirm receipt, a person reviews it and we communicate the decision to whoever reported it and, if action is taken, also to whoever posted it, with the reason. If several people report the same listing, it is hidden while under review. Authorities may contact {COMPANY.contactEmail}.</li>
        <li><strong>Consequences.</strong> We may remove listings, close conversations and, for serious or repeated breaches, remove access to the marketplace.</li>
        <li><strong>Company drivers.</strong> For them the marketplace is voluntary and unrelated to their job. The company may ask us not to show it to its drivers.</li>
      </ul>

      <h2>6. Availability of the Service</h2>
      <p>{COMPANY.brand} makes reasonable efforts to keep the Service available 24/7, but does not guarantee a specific service level (SLA) unless agreed separately. Interruptions may occur due to maintenance or external causes (provider failures, force majeure).</p>

      <h2>7. Intellectual property</h2>
      <p>The software, brand, design and code of the Service are the property of {COMPANY.legalName}. The customer keeps ownership of the data and photographs it uploads, and grants {COMPANY.brand} a limited licence to host and process them for the sole purpose of providing the Service (including AI analysis and anonymised model improvement).</p>

      <h2>8. Limitation of liability</h2>
      <p>To the maximum extent permitted by law, {COMPANY.brand} shall not be liable for indirect damages, loss of profit, loss of data or third-party claims arising from the use of the Service. Aggregate liability is limited to the amount paid by the customer in the 12 months preceding the event giving rise to the claim.</p>

      <h2>9. Suspension and termination</h2>
      <p>{COMPANY.brand} may suspend or cancel accounts that breach these terms, fail to pay subscriptions, or in the event of fraudulent activity. Notice will be given by email where possible.</p>

      <h2>10. Data protection</h2>
      <p>The processing of personal data is governed by the <a href="/privacidad">Privacy Policy</a>. The data the customer enters about its employees, drivers or customers is processed by us as a <strong>processor</strong> under the <a href="/encargo">Data Processing Agreement</a>, which forms part of these terms and is accepted with them.</p>

      <h2>11. Governing law and jurisdiction</h2>
      <p>These terms are governed by Spanish law. Disputes shall be submitted to the Courts and Tribunals of Spain, except where mandatory rules provide otherwise for consumers.</p>

      <h2>12. Changes</h2>
      <p>We may update these terms; substantial changes will be notified at least 15 days in advance. If you do not agree, you may cancel your account before they take effect.</p>
    </LegalLayout>
  )
}
