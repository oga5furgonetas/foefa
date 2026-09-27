/**
 * Datos del titular. Histor NO inventa datos legales: lo que no esté
 * configurado se muestra como marcador visible [PENDIENTE: …] para que el
 * propietario lo complete antes del lanzamiento.
 */
import { env } from '../env';

export type LegalVars = Record<'entity' | 'address' | 'taxId' | 'registry' | 'representative' | 'editor' | 'dpo' | 'contact' | 'site', string>;

const PENDING: Record<string, Record<keyof LegalVars, string>> = {
  es: { entity: '[PENDIENTE: razón social del titular]', address: '[PENDIENTE: domicilio social]', taxId: '[PENDIENTE: NIF/CIF]', registry: '[PENDIENTE: datos registrales]', representative: '[PENDIENTE: representante legal]', editor: '[PENDIENTE: responsable editorial]', dpo: '[PENDIENTE: correo de protección de datos]', contact: '[PENDIENTE: correo de contacto]', site: '' },
  en: { entity: '[PENDING: legal entity name]', address: '[PENDING: registered address]', taxId: '[PENDING: tax ID]', registry: '[PENDING: company registry details]', representative: '[PENDING: legal representative]', editor: '[PENDING: editor in charge]', dpo: '[PENDING: data protection email]', contact: '[PENDING: contact email]', site: '' },
  de: { entity: '[AUSSTEHEND: Firmenname]', address: '[AUSSTEHEND: Anschrift]', taxId: '[AUSSTEHEND: USt-IdNr.]', registry: '[AUSSTEHEND: Registergericht und -nummer]', representative: '[AUSSTEHEND: Vertretungsberechtigte Person]', editor: '[AUSSTEHEND: Verantwortlich i. S. d. § 18 Abs. 2 MStV]', dpo: '[AUSSTEHEND: Datenschutz-E-Mail]', contact: '[AUSSTEHEND: Kontakt-E-Mail]', site: '' },
  fr: { entity: '[À COMPLÉTER : raison sociale]', address: '[À COMPLÉTER : siège social]', taxId: '[À COMPLÉTER : numéro de TVA / SIREN]', registry: '[À COMPLÉTER : RCS]', representative: '[À COMPLÉTER : représentant légal]', editor: '[À COMPLÉTER : directeur de la publication]', dpo: '[À COMPLÉTER : e-mail données personnelles]', contact: '[À COMPLÉTER : e-mail de contact]', site: '' },
  it: { entity: '[DA COMPLETARE: ragione sociale]', address: '[DA COMPLETARE: sede legale]', taxId: '[DA COMPLETARE: partita IVA]', registry: '[DA COMPLETARE: registro imprese]', representative: '[DA COMPLETARE: legale rappresentante]', editor: '[DA COMPLETARE: direttore responsabile]', dpo: '[DA COMPLETARE: email privacy]', contact: '[DA COMPLETARE: email di contatto]', site: '' },
  pt: { entity: '[PENDENTE: razão social]', address: '[PENDENTE: sede]', taxId: '[PENDENTE: número fiscal]', registry: '[PENDENTE: registro comercial]', representative: '[PENDENTE: representante legal]', editor: '[PENDENTE: responsável editorial]', dpo: '[PENDENTE: e-mail de proteção de dados]', contact: '[PENDENTE: e-mail de contato]', site: '' },
};

export function legalVars(lang: string): LegalVars {
  const e = env();
  const p = PENDING[lang] ?? PENDING.en;
  return {
    entity: e.LEGAL_ENTITY_NAME ?? p.entity,
    address: e.LEGAL_ADDRESS ?? p.address,
    taxId: e.LEGAL_TAX_ID ?? p.taxId,
    registry: e.LEGAL_REGISTRY ?? p.registry,
    representative: e.LEGAL_REPRESENTATIVE ?? p.representative,
    editor: e.LEGAL_EDITOR_IN_CHARGE ?? p.editor,
    dpo: e.DPO_EMAIL ?? e.CONTACT_EMAIL ?? p.dpo,
    contact: e.CONTACT_EMAIL ?? p.contact,
    site: e.PUBLIC_BASE_URL,
  };
}

export function fillVars(text: string, v: LegalVars): string {
  return text.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in v ? v[k as keyof LegalVars] : m));
}

export function isPending(value: string): boolean {
  return /^\[(PENDIENTE|PENDING|AUSSTEHEND|À COMPLÉTER|DA COMPLETARE|PENDENTE)/.test(value);
}
