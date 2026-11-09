import LegalLayout from '../LegalLayout'
import { COMPANY } from '../config'
import { hayPixel, abrirAvisoCookies } from '../../lib/metaPixel'
import { sinPagos } from '../../lib/plataforma'

/* The Cookie Policy in English (30-10-2026): the same content as legal/Cookies.jsx, which is the version that applies.
   02-11-2026: lo que manda nuestro servidor a Meta con ese permiso y «Change my cookies», como en la versión española. */
export default function CookiesEn() {
  return (
    <LegalLayout title="Cookie Policy" lastUpdate="2026-11-02">
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
          {!sinPagos() && <tr className="border-b border-dark-800/60"><td className="py-1.5"><code>flota_plan</code></td><td>Remember the plan chosen during sign-up</td><td>Session</td><td>Necessary</td></tr>}
          <tr className="border-b border-dark-800/60"><td className="py-1.5"><code>cookie_consent</code></td><td>Remember that you have seen this notice{hayPixel() ? ' and what you chose' : ''}</td><td>12 months</td><td>Necessary</td></tr>
          {hayPixel() && <tr className="border-b border-dark-800/60"><td className="py-1.5"><code>_fbp</code>, <code>_fbc</code> (Meta)</td><td>Measure Facebook and Instagram ads: visits, sign-ups, trials and subscriptions (with the sign-up, also from our server)</td><td>3 months</td><td>Marketing (only if you accept)</td></tr>}
          {hayPixel() && <tr><td className="py-1.5"><code>_ttp</code>, <code>_tt_enable_cookie</code>, <code>ttcsid</code> (TikTok)</td><td>Measure TikTok ads: visits, sign-ups, trials and subscriptions</td><td>Up to 13 months</td><td>Marketing (only if you accept)</td></tr>}
        </tbody>
      </table>

      {/* In the iPhone app (09-11-2026) there is no checkout or Stripe: the third-party section only shows with the pixels (never in the app). */}
      {(!sinPagos() || hayPixel()) && <h2>3. Third-party cookies</h2>}
      {!sinPagos() && <p>During checkout you will be redirected to <strong>Stripe</strong>, which may set its own cookies needed to process the payment. See its policy at <a href="https://stripe.com/privacy" target="_blank" rel="noreferrer">stripe.com/privacy</a>.</p>}
      {hayPixel() && <>
        <p>If you accept ad measurement, <strong>from your browser</strong>, <strong>Meta Platforms Ireland</strong> and <strong>TikTok Technology Limited</strong> (Ireland) receive through their pixels the page visited and the events (sign-up, trial, subscription, gift).</p>
        <p>With that same permission, if you sign up to deliver on your own, <strong>from our server</strong> (Meta’s Conversions API) we tell <strong>Meta</strong> about your sign-up, the first time you open the app and your first route, during the 30 days after you sign up. Each of them carries your hashed email (SHA-256), your IP address, your browser, a hashed identifier of your account and the <code>_fbp</code> and <code>_fbc</code> cookies. Never your name or your phone, nor the addresses or the customers of your deliveries: about your deliveries, only that you have done your first route. We send nothing to TikTok from the server.</p>
        <p>See their policies at <a href="https://www.facebook.com/privacy/policy" target="_blank" rel="noreferrer">facebook.com/privacy/policy</a> and <a href="https://www.tiktok.com/legal/page/eea/privacy-policy/en" target="_blank" rel="noreferrer">tiktok.com/legal</a>.</p>
      </>}

      <h2>4. Management and consent</h2>
      {hayPixel()
        ? <>
          <p>The Meta and TikTok pixels are only loaded, and our server only tells Meta anything, if you press “Accept” in the notice; “Only necessary” is just as easy and loads and sends nothing.</p>
          <p>You can change your mind at any time: <button type="button" onClick={abrirAvisoCookies} className="font-semibold text-sky-400 hover:underline">Change my cookies</button>. If you withdraw your permission, the pixels stop measuring, we delete their cookies from this browser and we record it in your account (straight away if you are signed in; otherwise, the next time you sign in from this browser): from then on our server tells Meta nothing more.</p>
        </>
        : <p>As we only use strictly necessary storage, no prior consent is required under the Spanish Data Protection Agency’s guidance; even so, we show you an informative notice when you arrive. You can clear the storage from your browser settings at any time (this will sign you out).</p>}

      <h2>5. Changes</h2>
      <p>If we add analytics or marketing cookies in the future, we will ask for your explicit prior consent and update this page.</p>
    </LegalLayout>
  )
}
