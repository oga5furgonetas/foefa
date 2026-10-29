import { idioma, tx } from '../lib/idioma'

const BADGE_LANG = { es: 'es', en: 'en', pt: 'pt', fr: 'fr', it: 'it', de: 'de' }
export const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.flotadsp.flota'

export default function GooglePlayBadge({ onClick, className = '' }) {
  const lang = BADGE_LANG[idioma()] || 'en'
  return (
    <a
      href={GOOGLE_PLAY_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={tx('Descargar la app en Google Play')}
      onClick={onClick}
      className={`inline-flex rounded-[7px] transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 ${className}`}
    >
      <img
        src={`/google-play-badges/${lang}.png`}
        alt="Google Play"
        width="258"
        height="100"
        className="h-[62px] w-auto"
      />
    </a>
  )
}
