import { Loader2, Send, CheckCircle2, Mail } from 'lucide-react'
import LegalLayout from '../LegalLayout'
import { COMPANY } from '../config'

/* The Contact page in English (30-10-2026): the form state lives in legal/Contacto.jsx (which renders this when the
   app is not in Spanish); here only the texts. */
export default function ContactEn({ form, setForm, busy, done, err, submit }) {
  return (
    <LegalLayout title="Contact">
      {done ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
          <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
          <p className="font-semibold text-emerald-200">Message sent!</p>
          <p className="mt-1 text-sm text-dark-300">We will reply to {form.email} within 24 working hours.</p>
        </div>
      ) : (
        <>
          <p>Questions, want a demo or need help? Write to us and we reply within 24 working hours.</p>
          <div className="mb-6 mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-dark-800 bg-dark-900 p-3"><div className="mb-1 flex items-center gap-1 text-xs text-dark-500"><Mail size={12} /> Support</div><a href={`mailto:${COMPANY.contactEmail}`} className="text-sm">{COMPANY.contactEmail}</a></div>
            <div className="rounded-lg border border-dark-800 bg-dark-900 p-3"><div className="mb-1 flex items-center gap-1 text-xs text-dark-500"><Mail size={12} /> Privacy</div><a href={`mailto:${COMPANY.privacyEmail}`} className="text-sm">{COMPANY.privacyEmail}</a></div>
            <div className="rounded-lg border border-dark-800 bg-dark-900 p-3"><div className="mb-1 flex items-center gap-1 text-xs text-dark-500">{COMPANY.personaFisica ? 'Owner' : 'Company'}</div><div className="text-sm">{COMPANY.legalName}</div></div>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="label">Company</label><input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            </div>
            <div><label className="label">Email *</label><input type="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Subject</label><input className="input" placeholder="Demo / Support / Sales…" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
            <div><label className="label">Message</label><textarea rows={5} className="input" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
            {err && <p className="text-sm text-red-400">{err}</p>}
            <button disabled={busy} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {busy ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />} Send message
            </button>
            <p className="text-xs text-dark-500">By sending this form you accept the processing of your data under the <a href="/privacidad" className="text-sky-400">Privacy Policy</a>.</p>
          </form>
        </>
      )}
    </LegalLayout>
  )
}
