import LegalLayout from '../LegalLayout'
import { COMPANY } from '../config'
import { hayPixel } from '../../lib/metaPixel'

/* The Cookie Policy in English (30-10-2026): the same content as legal/Cookies.jsx, which is the version that applies. */
export default function CookiesEn() {
  return (
    <LegalLayout title="Cookie Policy">
      <h2>1. What are cookies?</h2>
      <p>Cookies (and similar technologies such as <em>localStorage</em>) are small files that a website stores on your device so that it works properly or to remember information between visits.</p>

      <h2>2. Cookies used by {COMPANY.brand}</h2>
      {hayPixel()
        ? <p>{COMPANY.brand} uses storage that is strictly necessary for the Service to work and, <strong>only if you accept it</strong> in the cookie notice, the Meta and TikTok pixels to measure which ads bring us visits, sign-ups and subscriptions. If you choose “Only necessary”, none of them is loaded.</p>
        : <p>Currently {COMPANY.brand} uses <strong>only strictly necessary storage</strong> for the Service to work. We use no advertising tracking cookies or third-party analytics.</p>}
      <table className="w-full text-xs">
        <thead><tr className="border-b border-dark-800 text-left text-dark-500"><th className="py-1">Name</th><th>Purpose</th><th>Duration</th><th>Type</th></tr></thead>
        <tbody className="text-dark-300">
          <tr className="border-b border-dark-800/60"><td className="py-1.5"><code>flota_token</code></td><td>Keep you signed in</td><td>Until you sign out</td><td>Necessary</td></tr>
          <tr className="border-b border-dark-800/60"><td className="py-1.5"><code>flota_admin</code>, <code>flota_inicio</code></td><td>Remember your account, your permissions and which screen the app opens on</td><td>Until you sign out</td><td>Necessary</td></tr>
          <tr className="border-b border-dark-800/60"><td className="py-1.5"><code>panel_tab</code>, <code>panel_center</code></td><td>Remember your active tab and depot</td><td>Until you clear the browser</td><td>Preference</td></tr>
          <tr className="border-b border-dark-800/60"><td className="py-1.5"><code>flota_plan</code></td><td>Remember the plan chosen during sign-up</td><td>Session</td><td>Necessary</td></tr>
          <tr className="border-b border-dark-800/60"><td className="py-1.5"><code>cookie_consent</code></td><td>Remember that you have seen this notice{hayPixel() ? ' and what you chose' : ''}</td><td>12 months</td><td>Necessary</td></tr>
          {hayPixel() && <tr className="border-b border-dark-800/60"><td className="py-1.5"><code>_fbp</code> (Meta)</td><td>Measure Facebook and Instagram ads: visits, sign-ups, trials and subscriptions</td><td>3 months</td><td>Marketing (only if you accept)</td></tr>}
          {hayPixel() && <tr><td className="py-1.5"><code>_ttp</code>, <code>_tt_enable_cookie</code>, <code>ttcsid</code> (TikTok)</td><td>Measure TikTok ads: visits, sign-ups, trials and subscriptions</td><td>Up to 13 months</td><td>Marketing (only if you accept)</td></tr>}
        </tbody>
      </table>

      <h2>3. Third-party cookies</h2>
      <p>During checkout you will be redirected to <strong>Stripe</strong>, which may set its own cookies needed to process the payment. See its policy at <a href="https://stripe.com/privacy" target="_blank" rel="noreferrer">stripe.com/privacy</a>.</p>
      {hayPixel() && <p>If you accept ad measurement, <strong>Meta Platforms Ireland</strong> and <strong>TikTok Technology Limited</strong> (Ireland) receive through their pixels the page visited and the events (sign-up, trial, subscription, gift), without your email or your delivery data. See their policies at <a href="https://www.facebook.com/privacy/policy" target="_blank" rel="noreferrer">facebook.com/privacy/policy</a> and <a href="https://www.tiktok.com/legal/page/eea/privacy-policy/en" target="_blank" rel="noreferrer">tiktok.com/legal</a>.</p>}

      <h2>4. Management and consent</h2>
      {hayPixel()
        ? <p>The Meta and TikTok pixels are only loaded if you press “Accept” in the notice; “Only necessary” is just as easy and loads nothing. You can change your mind by clearing the browser storage (the notice will appear again; it will also sign you out).</p>
        : <p>As we only use strictly necessary storage, no prior consent is required under the Spanish Data Protection Agency’s guidance; even so, we show you an informative notice when you arrive. You can clear the storage from your browser settings at any time (this will sign you out).</p>}

      <h2>5. Changes</h2>
      <p>If we add analytics or marketing cookies in the future, we will ask for your explicit prior consent and update this page.</p>
    </LegalLayout>
  )
}
