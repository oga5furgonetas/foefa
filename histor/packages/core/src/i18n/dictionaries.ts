/**
 * Textos de la interfaz. El español es la referencia de claves; cada idioma
 * se escribe con sus convenciones (no traducción literal). Para añadir un
 * idioma: copiar un bloque, traducirlo y activarlo en config/languages.ts.
 * Interpolación: {n}, {time}, {q}…
 */

const es = {
  tagline: 'Noticias verificadas, sin atajos',
  nav: {
    home: 'Portada', latest: 'Últimas', breaking: 'Última hora', trending: 'Tendencias', forYou: 'Para ti', local: 'Local', search: 'Buscar',
    subscribe: 'Suscríbete', login: 'Entrar', account: 'Mi cuenta', logout: 'Salir', newsletters: 'Newsletters', saved: 'Guardadas', menu: 'Menú', close: 'Cerrar',
    sections: 'Secciones', edition: 'Edición', language: 'Idioma', skip: 'Saltar al contenido',
  },
  label: {
    breaking: 'Última hora', developing: 'En desarrollo', verified: 'Verificada', updated: 'Actualizada', updatedAt: 'Actualizado a las {time}', publishedAt: 'Publicado el {date}',
    retracted: 'Retirada', correction: 'Corrección', clarification: 'Aclaración', update: 'Actualización', demo: 'DEMO', readingTime: '{n} min de lectura', sources: '{n} fuentes', by: 'Por',
    premium: 'Premium', live: 'En directo', underReview: 'En revisión',
  },
  demoBanner: 'MODO DEMO — Estas noticias son ficticias y sirven solo para mostrar cómo funciona Histor. No son noticias reales.',
  article: {
    sources: 'Fuentes', sourcesIntro: 'Esta noticia se ha elaborado a partir de estas fuentes. Enlazamos siempre al original.', primary: 'Fuente primaria',
    howWeVerified: 'Cómo verificamos esta noticia', confirmed: 'Confirmado', attributed: 'Atribuido (sin confirmación independiente)', unconfirmed: 'Aún sin confirmar', discrepancies: 'Discrepancias entre fuentes', confirmedBy: 'lo confirma: {list}',
    related: 'Noticias relacionadas', timeline: 'Cronología', history: 'Historial de cambios', version: 'Versión {n}', viewVersion: 'Ver versión', reportError: 'Informar de un error',
    share: 'Compartir', save: 'Guardar', saved: 'Guardada', copyLink: 'Copiar enlace', copied: 'Enlace copiado', entities: 'En esta noticia', location: 'Lugar', tags: 'Temas', writtenBy: 'Elaborada por {author}',
    automated: 'Texto elaborado con un sistema automatizado a partir de fuentes contrastadas y revisado por controles editoriales.', retractedNotice: 'Esta noticia ha sido retirada', otherLanguages: 'También en', imageCredit: 'Imagen: {credit}', illustrative: 'Imagen ilustrativa, no del acontecimiento', aiImage: 'Imagen generada por IA',
    corrections: 'Correcciones y actualizaciones', noImage: 'Sin fotografía verificada',
  },
  home: {
    topStory: 'Lo principal', latest: 'Últimas noticias', trending: 'Lo que más crece', local: 'Cerca de ti', world: 'Internacional', forYou: 'Para ti',
    forYouExplain: 'Según los temas que sigues y lo que lees. Incluimos otras noticias importantes para que no te pierdas nada.', empty: 'Todavía no hay noticias verificadas aquí. Publicamos solo lo que podemos confirmar.',
    personalize: 'Personalizar', seeAll: 'Ver todo', breakingNow: 'Ahora mismo', trustLine: 'Cada noticia muestra qué está confirmado, quién lo confirma y qué no.',
  },
  list: { latest: 'Últimas noticias', breaking: 'Última hora', trending: 'Tendencias', forYou: 'Para ti', more: 'Cargar más', empty: 'No hay noticias que mostrar.' },
  search: { title: 'Buscar', placeholder: 'Buscar noticias, temas, lugares…', results: '{n} resultados para «{q}»', none: 'Sin resultados para «{q}».', submit: 'Buscar', filters: 'Filtros', anyCategory: 'Todas las secciones', anyTime: 'Cualquier fecha', lastDay: 'Últimas 24 horas', lastWeek: 'Última semana' },
  entity: { topic: 'Tema', follow: 'Seguir', following: 'Siguiendo', coverage: 'Cobertura de Histor', articlesAbout: 'Noticias sobre {name}' },
  source: { title: 'Fuente', type: 'Tipo', reliability: 'Historial', country: 'País', articles: 'Noticias en las que aparece', typeNames: { primary_official: 'Fuente oficial primaria', official: 'Institución oficial', wire_agency: 'Agencia de noticias', reputable_media: 'Medio de comunicación', identified_journalist: 'Periodista identificado', academic: 'Fuente académica', company: 'Empresa', witness: 'Testigo', social_media: 'Red social (pista, no evidencia)', ugc: 'Contenido de usuarios', blog: 'Blog', aggregator: 'Agregador', anonymous: 'Anónima', unverifiable: 'No verificable' }, directory: 'Nuestras fuentes', directoryIntro: 'Las fuentes que consulta Histor, cómo las clasificamos y cuánto pesa cada una en la verificación.' },
  author: { desk: 'Mesa de redacción automatizada', notAPerson: 'No es una persona: es una mesa de redacción automatizada de Histor.' },
  footer: {
    about: 'Histor es un periódico digital que publica solo lo que puede verificar.', automation: 'Usamos automatización con controles editoriales.', howItWorks: 'Cómo funciona', editorialPolicy: 'Política editorial',
    corrections: 'Correcciones', privacy: 'Privacidad', cookies: 'Cookies', terms: 'Términos', subscriptionTerms: 'Condiciones de suscripción', contact: 'Contacto', legalNotice: 'Aviso legal', report: 'Informar de un error', sources: 'Nuestras fuentes', rights: '© {year} Histor', cookieSettings: 'Preferencias de cookies',
  },
  cookies: {
    title: 'Tu privacidad', text: 'Usamos cookies necesarias para que la web funcione. Con tu permiso, también para medir la audiencia sin identificarte y para personalizar tu portada. No vendemos tus datos.',
    acceptAll: 'Aceptar todo', rejectAll: 'Rechazar todo', customize: 'Configurar', save: 'Guardar preferencias',
    categories: { necessary: ['Necesarias', 'Sesión, seguridad y tus preferencias de idioma. Siempre activas.'], preferences: ['Preferencias', 'Recordar tu edición y tus ajustes de lectura.'], analytics: ['Medición', 'Estadísticas agregadas de uso, sin publicidad ni perfiles comerciales.'], personalization: ['Personalización', 'Aprender qué temas te interesan para ordenar tu portada.'], marketing: ['Publicidad', 'Anuncios (solo en la versión gratuita). Desactivado por defecto.'] },
  },
  account: {
    email: 'Correo electrónico', password: 'Contraseña', name: 'Nombre (opcional)', login: 'Entrar', register: 'Crear cuenta', forgot: '¿Has olvidado la contraseña?', reset: 'Restablecer contraseña', newPassword: 'Nueva contraseña',
    save: 'Guardar', saved: 'Guardado', preferences: 'Preferencias', language: 'Idioma', country: 'País de tu edición', region: 'Región', city: 'Ciudad', topics: 'Temas que sigues', newsletters: 'Newsletters', alerts: 'Alertas de última hora',
    alertsMax: 'Máximo de alertas al día', quietHours: 'Sin alertas entre las {from} y las {to}', subscription: 'Suscripción', manage: 'Gestionar suscripción y facturas', exportData: 'Descargar mis datos', deleteAccount: 'Eliminar mi cuenta',
    deleteConfirm: 'Esta acción borra tu cuenta y tus datos de forma permanente. Escribe ELIMINAR para confirmar.', twoFactor: 'Verificación en dos pasos', logout: 'Cerrar sesión', google: 'Continuar con Google', apple: 'Continuar con Apple', or: 'o',
    haveAccount: '¿Ya tienes cuenta?', noAccount: '¿No tienes cuenta?', passwordHint: 'Mínimo 10 caracteres.', verifySent: 'Te hemos enviado un correo para confirmar tu dirección.', resetSent: 'Si existe una cuenta con ese correo, te hemos enviado un enlace para restablecer la contraseña.',
    resetDone: 'Contraseña cambiada. Ya puedes entrar.', personalization: 'Personalizar mi portada según lo que leo', marketing: 'Quiero recibir novedades de Histor', history: 'Historial de lectura', savedEmpty: 'No has guardado ninguna noticia.', free: 'Gratuita', premium: 'Premium', plan: 'Plan',
    errors: { invalid: 'Correo o contraseña incorrectos.', taken: 'Ya existe una cuenta con ese correo.', weak: 'La contraseña es demasiado corta.', rate: 'Demasiados intentos. Espera unos minutos.', generic: 'Algo ha fallado. Inténtalo de nuevo.', token: 'El enlace ha caducado o no es válido.', totp: 'Código incorrecto.' },
    totpCode: 'Código de verificación', welcome: 'Hola, {name}',
  },
  subscribe: {
    title: 'Histor Premium', subtitle: 'Periodismo verificado, a tu medida. Sin publicidad.', monthly: 'Mensual', yearly: 'Anual', perMonth: '/mes', perYear: '/año', trial: '{n} días gratis', save: 'Ahorra un {n} %',
    features: ['Sin publicidad', 'Alertas de última hora a tu medida', 'Newsletters locales y temáticas', 'Seguimiento de temas, empresas, equipos y ciudades', 'Archivo completo y análisis', 'Personalización avanzada de la portada'],
    freeTitle: 'Gratis', freeFeatures: ['Todas las noticias verificadas', 'Newsletter diaria de tu edición', 'Publicidad no invasiva'], cta: 'Suscribirme', ctaTrial: 'Empezar prueba gratuita',
    notConfigured: 'Las suscripciones todavía no están activas. Vuelve pronto.', already: 'Ya eres Premium. ¡Gracias!', cancelAnytime: 'Cancela cuando quieras desde tu cuenta.', taxes: 'Impuestos incluidos según tu país cuando corresponda.', loginFirst: 'Crea una cuenta o entra para suscribirte.',
    success: '¡Bienvenido a Premium! Tu suscripción ya está activa.', canceled: 'No se ha completado el pago.',
  },
  newsletter: { title: 'Newsletters', intro: 'Resúmenes de noticias verificadas, cuando tú quieras leerlas.', subscribe: 'Suscribirme', email: 'Tu correo', confirmSent: 'Revisa tu correo para confirmar la suscripción.', confirmed: 'Suscripción confirmada.', unsubscribed: 'Te has dado de baja.', premiumOnly: 'Solo Premium', daily: 'Cada día a las {h}:00' },
  report: {
    title: 'Informar de un error', intro: 'Si crees que una noticia contiene un error, una fuente incorrecta o vulnera derechos, cuéntanoslo. Cada aviso se convierte en una tarea de revisión.',
    kind: 'Tipo de problema', kinds: { factual_error: 'Error en un dato', incorrect_content: 'Contenido incorrecto o engañoso', copyright: 'Derechos de autor', privacy: 'Privacidad', wrong_source: 'Fuente incorrecta', other: 'Otro' },
    url: 'Enlace de la noticia', description: 'Explica el problema', name: 'Nombre (opcional)', email: 'Correo (opcional, para responderte)', submit: 'Enviar', thanks: 'Gracias. Lo revisaremos y, si procede, publicaremos una corrección.',
  },
  notFound: { title: 'No encontramos esta página', text: 'Puede que la dirección haya cambiado o que la noticia no exista.', back: 'Volver a la portada' },
  error: { title: 'Algo ha fallado', text: 'Estamos trabajando en ello. Inténtalo de nuevo en un momento.' },
  common: { loading: 'Cargando…', back: 'Volver', next: 'Siguiente', prev: 'Anterior', or: 'o', yes: 'Sí', no: 'No', send: 'Enviar', required: 'Obligatorio' },
};

export type Dict = typeof es;

const en: Dict = {
  tagline: 'Verified news, no shortcuts',
  nav: {
    home: 'Home', latest: 'Latest', breaking: 'Breaking', trending: 'Trending', forYou: 'For you', local: 'Local', search: 'Search',
    subscribe: 'Subscribe', login: 'Sign in', account: 'My account', logout: 'Sign out', newsletters: 'Newsletters', saved: 'Saved', menu: 'Menu', close: 'Close',
    sections: 'Sections', edition: 'Edition', language: 'Language', skip: 'Skip to content',
  },
  label: {
    breaking: 'Breaking', developing: 'Developing', verified: 'Verified', updated: 'Updated', updatedAt: 'Updated at {time}', publishedAt: 'Published {date}',
    retracted: 'Retracted', correction: 'Correction', clarification: 'Clarification', update: 'Update', demo: 'DEMO', readingTime: '{n} min read', sources: '{n} sources', by: 'By',
    premium: 'Premium', live: 'Live', underReview: 'Under review',
  },
  demoBanner: 'DEMO MODE — These stories are fictional and only show how Histor works. They are not real news.',
  article: {
    sources: 'Sources', sourcesIntro: 'This story is based on the following sources. We always link to the original.', primary: 'Primary source',
    howWeVerified: 'How we verified this story', confirmed: 'Confirmed', attributed: 'Attributed (not independently confirmed)', unconfirmed: 'Not yet confirmed', discrepancies: 'Where sources disagree', confirmedBy: 'confirmed by: {list}',
    related: 'Related stories', timeline: 'Timeline', history: 'Change history', version: 'Version {n}', viewVersion: 'View version', reportError: 'Report an error',
    share: 'Share', save: 'Save', saved: 'Saved', copyLink: 'Copy link', copied: 'Link copied', entities: 'In this story', location: 'Location', tags: 'Topics', writtenBy: 'Produced by {author}',
    automated: 'Written by an automated system from cross-checked sources and passed through editorial controls.', retractedNotice: 'This story has been retracted', otherLanguages: 'Also in', imageCredit: 'Image: {credit}', illustrative: 'Illustrative image, not of the event', aiImage: 'AI-generated image',
    corrections: 'Corrections and updates', noImage: 'No verified photograph',
  },
  home: {
    topStory: 'Top story', latest: 'Latest news', trending: 'Gaining momentum', local: 'Near you', world: 'World', forYou: 'For you',
    forYouExplain: 'Based on topics you follow and what you read. We also include other important stories so you miss nothing.', empty: 'No verified stories here yet. We only publish what we can confirm.',
    personalize: 'Personalise', seeAll: 'See all', breakingNow: 'Right now', trustLine: 'Every story shows what is confirmed, who confirms it and what is not.',
  },
  list: { latest: 'Latest news', breaking: 'Breaking news', trending: 'Trending', forYou: 'For you', more: 'Load more', empty: 'No stories to show.' },
  search: { title: 'Search', placeholder: 'Search news, topics, places…', results: '{n} results for “{q}”', none: 'No results for “{q}”.', submit: 'Search', filters: 'Filters', anyCategory: 'All sections', anyTime: 'Any time', lastDay: 'Last 24 hours', lastWeek: 'Last week' },
  entity: { topic: 'Topic', follow: 'Follow', following: 'Following', coverage: 'Histor coverage', articlesAbout: 'Stories about {name}' },
  source: { title: 'Source', type: 'Type', reliability: 'Track record', country: 'Country', articles: 'Stories citing this source', typeNames: { primary_official: 'Primary official source', official: 'Official institution', wire_agency: 'News agency', reputable_media: 'News outlet', identified_journalist: 'Named journalist', academic: 'Academic source', company: 'Company', witness: 'Witness', social_media: 'Social media (a lead, not evidence)', ugc: 'User-generated content', blog: 'Blog', aggregator: 'Aggregator', anonymous: 'Anonymous', unverifiable: 'Unverifiable' }, directory: 'Our sources', directoryIntro: 'The sources Histor monitors, how we classify them and how much each one counts in verification.' },
  author: { desk: 'Automated news desk', notAPerson: 'Not a person: this is one of Histor’s automated news desks.' },
  footer: {
    about: 'Histor is a digital newspaper that only publishes what it can verify.', automation: 'We use automation with editorial controls.', howItWorks: 'How it works', editorialPolicy: 'Editorial policy',
    corrections: 'Corrections', privacy: 'Privacy', cookies: 'Cookies', terms: 'Terms', subscriptionTerms: 'Subscription terms', contact: 'Contact', legalNotice: 'Legal notice', report: 'Report an error', sources: 'Our sources', rights: '© {year} Histor', cookieSettings: 'Cookie settings',
  },
  cookies: {
    title: 'Your privacy', text: 'We use necessary cookies to run the site. With your permission, we also measure audiences without identifying you and personalise your front page. We never sell your data.',
    acceptAll: 'Accept all', rejectAll: 'Reject all', customize: 'Customise', save: 'Save preferences',
    categories: { necessary: ['Necessary', 'Session, security and your language settings. Always on.'], preferences: ['Preferences', 'Remember your edition and reading settings.'], analytics: ['Measurement', 'Aggregated usage statistics, no advertising profiles.'], personalization: ['Personalisation', 'Learn which topics interest you to order your front page.'], marketing: ['Advertising', 'Ads (free version only). Off by default.'] },
  },
  account: {
    email: 'Email', password: 'Password', name: 'Name (optional)', login: 'Sign in', register: 'Create account', forgot: 'Forgot your password?', reset: 'Reset password', newPassword: 'New password',
    save: 'Save', saved: 'Saved', preferences: 'Preferences', language: 'Language', country: 'Your edition', region: 'Region', city: 'City', topics: 'Topics you follow', newsletters: 'Newsletters', alerts: 'Breaking news alerts',
    alertsMax: 'Maximum alerts per day', quietHours: 'No alerts between {from} and {to}', subscription: 'Subscription', manage: 'Manage subscription and invoices', exportData: 'Download my data', deleteAccount: 'Delete my account',
    deleteConfirm: 'This permanently deletes your account and data. Type DELETE to confirm.', twoFactor: 'Two-step verification', logout: 'Sign out', google: 'Continue with Google', apple: 'Continue with Apple', or: 'or',
    haveAccount: 'Already have an account?', noAccount: 'No account yet?', passwordHint: 'At least 10 characters.', verifySent: 'We sent you an email to confirm your address.', resetSent: 'If an account exists for that email, we sent a link to reset your password.',
    resetDone: 'Password changed. You can sign in now.', personalization: 'Personalise my front page based on what I read', marketing: 'Send me news about Histor', history: 'Reading history', savedEmpty: 'You have not saved any stories.', free: 'Free', premium: 'Premium', plan: 'Plan',
    errors: { invalid: 'Wrong email or password.', taken: 'An account with that email already exists.', weak: 'Password is too short.', rate: 'Too many attempts. Please wait a few minutes.', generic: 'Something went wrong. Please try again.', token: 'This link has expired or is invalid.', totp: 'Incorrect code.' },
    totpCode: 'Verification code', welcome: 'Hello, {name}',
  },
  subscribe: {
    title: 'Histor Premium', subtitle: 'Verified journalism, tailored to you. No ads.', monthly: 'Monthly', yearly: 'Yearly', perMonth: '/month', perYear: '/year', trial: '{n}-day free trial', save: 'Save {n}%',
    features: ['No advertising', 'Breaking news alerts tailored to you', 'Local and topic newsletters', 'Follow topics, companies, teams and cities', 'Full archive and analysis', 'Advanced front page personalisation'],
    freeTitle: 'Free', freeFeatures: ['Every verified story', 'Daily newsletter for your edition', 'Non-intrusive advertising'], cta: 'Subscribe', ctaTrial: 'Start free trial',
    notConfigured: 'Subscriptions are not live yet. Check back soon.', already: 'You are Premium. Thank you!', cancelAnytime: 'Cancel anytime from your account.', taxes: 'Taxes included where applicable in your country.', loginFirst: 'Create an account or sign in to subscribe.',
    success: 'Welcome to Premium! Your subscription is active.', canceled: 'The payment was not completed.',
  },
  newsletter: { title: 'Newsletters', intro: 'Briefings of verified news, when you want to read them.', subscribe: 'Subscribe', email: 'Your email', confirmSent: 'Check your inbox to confirm your subscription.', confirmed: 'Subscription confirmed.', unsubscribed: 'You have been unsubscribed.', premiumOnly: 'Premium only', daily: 'Every day at {h}:00' },
  report: {
    title: 'Report an error', intro: 'If you think a story contains an error, a wrong source or infringes rights, tell us. Every report becomes a review task.',
    kind: 'Type of problem', kinds: { factual_error: 'Factual error', incorrect_content: 'Incorrect or misleading content', copyright: 'Copyright', privacy: 'Privacy', wrong_source: 'Wrong source', other: 'Other' },
    url: 'Link to the story', description: 'Describe the problem', name: 'Name (optional)', email: 'Email (optional, so we can reply)', submit: 'Send', thanks: 'Thank you. We will review it and, if needed, publish a correction.',
  },
  notFound: { title: 'We could not find this page', text: 'The address may have changed or the story may not exist.', back: 'Back to the front page' },
  error: { title: 'Something went wrong', text: 'We are working on it. Please try again in a moment.' },
  common: { loading: 'Loading…', back: 'Back', next: 'Next', prev: 'Previous', or: 'or', yes: 'Yes', no: 'No', send: 'Send', required: 'Required' },
};

const de: Dict = {
  tagline: 'Geprüfte Nachrichten, ohne Abkürzungen',
  nav: {
    home: 'Startseite', latest: 'Neueste', breaking: 'Eilmeldungen', trending: 'Trends', forYou: 'Für dich', local: 'Lokal', search: 'Suche',
    subscribe: 'Abonnieren', login: 'Anmelden', account: 'Mein Konto', logout: 'Abmelden', newsletters: 'Newsletter', saved: 'Gemerkt', menu: 'Menü', close: 'Schließen',
    sections: 'Ressorts', edition: 'Ausgabe', language: 'Sprache', skip: 'Zum Inhalt springen',
  },
  label: {
    breaking: 'Eilmeldung', developing: 'Lage entwickelt sich', verified: 'Geprüft', updated: 'Aktualisiert', updatedAt: 'Aktualisiert um {time}', publishedAt: 'Veröffentlicht am {date}',
    retracted: 'Zurückgezogen', correction: 'Korrektur', clarification: 'Klarstellung', update: 'Aktualisierung', demo: 'DEMO', readingTime: '{n} Min. Lesezeit', sources: '{n} Quellen', by: 'Von',
    premium: 'Premium', live: 'Live', underReview: 'Wird geprüft',
  },
  demoBanner: 'DEMO-MODUS — Diese Meldungen sind erfunden und zeigen nur, wie Histor funktioniert. Es sind keine echten Nachrichten.',
  article: {
    sources: 'Quellen', sourcesIntro: 'Dieser Bericht beruht auf den folgenden Quellen. Wir verlinken immer auf das Original.', primary: 'Primärquelle',
    howWeVerified: 'So haben wir diese Meldung geprüft', confirmed: 'Bestätigt', attributed: 'Zugeordnet (nicht unabhängig bestätigt)', unconfirmed: 'Noch nicht bestätigt', discrepancies: 'Widersprüche zwischen Quellen', confirmedBy: 'bestätigt von: {list}',
    related: 'Verwandte Meldungen', timeline: 'Chronologie', history: 'Änderungsverlauf', version: 'Version {n}', viewVersion: 'Version ansehen', reportError: 'Fehler melden',
    share: 'Teilen', save: 'Merken', saved: 'Gemerkt', copyLink: 'Link kopieren', copied: 'Link kopiert', entities: 'In dieser Meldung', location: 'Ort', tags: 'Themen', writtenBy: 'Erstellt von {author}',
    automated: 'Von einem automatisierten System aus geprüften Quellen erstellt und durch redaktionelle Kontrollen geprüft.', retractedNotice: 'Diese Meldung wurde zurückgezogen', otherLanguages: 'Auch auf', imageCredit: 'Bild: {credit}', illustrative: 'Symbolbild, nicht vom Ereignis', aiImage: 'KI-generiertes Bild',
    corrections: 'Korrekturen und Aktualisierungen', noImage: 'Kein geprüftes Foto',
  },
  home: {
    topStory: 'Das Wichtigste', latest: 'Neueste Meldungen', trending: 'Wachsendes Interesse', local: 'In deiner Nähe', world: 'Ausland', forYou: 'Für dich',
    forYouExplain: 'Nach deinen Themen und deiner Lektüre. Wichtige andere Meldungen zeigen wir trotzdem, damit dir nichts entgeht.', empty: 'Hier gibt es noch keine geprüften Meldungen. Wir veröffentlichen nur, was wir bestätigen können.',
    personalize: 'Anpassen', seeAll: 'Alle ansehen', breakingNow: 'Gerade eben', trustLine: 'Jede Meldung zeigt, was bestätigt ist, wer es bestätigt und was nicht.',
  },
  list: { latest: 'Neueste Meldungen', breaking: 'Eilmeldungen', trending: 'Trends', forYou: 'Für dich', more: 'Mehr laden', empty: 'Keine Meldungen vorhanden.' },
  search: { title: 'Suche', placeholder: 'Nachrichten, Themen, Orte suchen…', results: '{n} Ergebnisse für „{q}“', none: 'Keine Ergebnisse für „{q}“.', submit: 'Suchen', filters: 'Filter', anyCategory: 'Alle Ressorts', anyTime: 'Beliebiger Zeitraum', lastDay: 'Letzte 24 Stunden', lastWeek: 'Letzte Woche' },
  entity: { topic: 'Thema', follow: 'Folgen', following: 'Folge ich', coverage: 'Berichterstattung von Histor', articlesAbout: 'Meldungen über {name}' },
  source: { title: 'Quelle', type: 'Typ', reliability: 'Bilanz', country: 'Land', articles: 'Meldungen mit dieser Quelle', typeNames: { primary_official: 'Amtliche Primärquelle', official: 'Offizielle Stelle', wire_agency: 'Nachrichtenagentur', reputable_media: 'Medium', identified_journalist: 'Namentlich bekannter Journalist', academic: 'Wissenschaftliche Quelle', company: 'Unternehmen', witness: 'Augenzeuge', social_media: 'Soziales Netzwerk (Hinweis, kein Beleg)', ugc: 'Nutzerinhalte', blog: 'Blog', aggregator: 'Aggregator', anonymous: 'Anonym', unverifiable: 'Nicht überprüfbar' }, directory: 'Unsere Quellen', directoryIntro: 'Die Quellen, die Histor auswertet, wie wir sie einstufen und wie stark jede bei der Prüfung zählt.' },
  author: { desk: 'Automatisierte Redaktion', notAPerson: 'Keine Person: eine automatisierte Redaktion von Histor.' },
  footer: {
    about: 'Histor ist eine digitale Zeitung, die nur veröffentlicht, was sie überprüfen kann.', automation: 'Wir nutzen Automatisierung mit redaktionellen Kontrollen.', howItWorks: 'So arbeiten wir', editorialPolicy: 'Redaktionelle Grundsätze',
    corrections: 'Korrekturen', privacy: 'Datenschutz', cookies: 'Cookies', terms: 'Nutzungsbedingungen', subscriptionTerms: 'Abo-Bedingungen', contact: 'Kontakt', legalNotice: 'Impressum', report: 'Fehler melden', sources: 'Unsere Quellen', rights: '© {year} Histor', cookieSettings: 'Cookie-Einstellungen',
  },
  cookies: {
    title: 'Deine Privatsphäre', text: 'Wir verwenden notwendige Cookies für den Betrieb der Seite. Mit deiner Zustimmung messen wir außerdem die Nutzung, ohne dich zu identifizieren, und personalisieren deine Startseite. Wir verkaufen keine Daten.',
    acceptAll: 'Alle akzeptieren', rejectAll: 'Alle ablehnen', customize: 'Einstellungen', save: 'Auswahl speichern',
    categories: { necessary: ['Notwendig', 'Sitzung, Sicherheit und Spracheinstellungen. Immer aktiv.'], preferences: ['Präferenzen', 'Deine Ausgabe und Leseeinstellungen merken.'], analytics: ['Messung', 'Zusammengefasste Nutzungsstatistiken, keine Werbeprofile.'], personalization: ['Personalisierung', 'Lernen, welche Themen dich interessieren, um deine Startseite zu ordnen.'], marketing: ['Werbung', 'Anzeigen (nur Gratisversion). Standardmäßig aus.'] },
  },
  account: {
    email: 'E-Mail', password: 'Passwort', name: 'Name (optional)', login: 'Anmelden', register: 'Konto erstellen', forgot: 'Passwort vergessen?', reset: 'Passwort zurücksetzen', newPassword: 'Neues Passwort',
    save: 'Speichern', saved: 'Gespeichert', preferences: 'Einstellungen', language: 'Sprache', country: 'Deine Ausgabe', region: 'Region', city: 'Stadt', topics: 'Deine Themen', newsletters: 'Newsletter', alerts: 'Eilmeldungen',
    alertsMax: 'Höchstens Meldungen pro Tag', quietHours: 'Keine Meldungen zwischen {from} und {to} Uhr', subscription: 'Abonnement', manage: 'Abo und Rechnungen verwalten', exportData: 'Meine Daten herunterladen', deleteAccount: 'Konto löschen',
    deleteConfirm: 'Damit werden dein Konto und deine Daten dauerhaft gelöscht. Gib LÖSCHEN ein, um zu bestätigen.', twoFactor: 'Zwei-Faktor-Anmeldung', logout: 'Abmelden', google: 'Mit Google fortfahren', apple: 'Mit Apple fortfahren', or: 'oder',
    haveAccount: 'Schon ein Konto?', noAccount: 'Noch kein Konto?', passwordHint: 'Mindestens 10 Zeichen.', verifySent: 'Wir haben dir eine E-Mail zur Bestätigung geschickt.', resetSent: 'Falls ein Konto mit dieser Adresse existiert, haben wir einen Link zum Zurücksetzen geschickt.',
    resetDone: 'Passwort geändert. Du kannst dich jetzt anmelden.', personalization: 'Startseite anhand meiner Lektüre personalisieren', marketing: 'Neuigkeiten von Histor erhalten', history: 'Leseverlauf', savedEmpty: 'Du hast noch nichts gemerkt.', free: 'Kostenlos', premium: 'Premium', plan: 'Tarif',
    errors: { invalid: 'E-Mail oder Passwort falsch.', taken: 'Mit dieser E-Mail gibt es bereits ein Konto.', weak: 'Das Passwort ist zu kurz.', rate: 'Zu viele Versuche. Bitte warte ein paar Minuten.', generic: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.', token: 'Der Link ist abgelaufen oder ungültig.', totp: 'Falscher Code.' },
    totpCode: 'Bestätigungscode', welcome: 'Hallo, {name}',
  },
  subscribe: {
    title: 'Histor Premium', subtitle: 'Geprüfter Journalismus, auf dich zugeschnitten. Ohne Werbung.', monthly: 'Monatlich', yearly: 'Jährlich', perMonth: '/Monat', perYear: '/Jahr', trial: '{n} Tage gratis testen', save: '{n} % sparen',
    features: ['Ohne Werbung', 'Eilmeldungen nach deinen Interessen', 'Lokale und thematische Newsletter', 'Themen, Unternehmen, Vereinen und Städten folgen', 'Vollständiges Archiv und Analysen', 'Erweiterte Personalisierung der Startseite'],
    freeTitle: 'Kostenlos', freeFeatures: ['Alle geprüften Meldungen', 'Täglicher Newsletter deiner Ausgabe', 'Unaufdringliche Werbung'], cta: 'Abonnieren', ctaTrial: 'Gratis testen',
    notConfigured: 'Abonnements sind noch nicht freigeschaltet. Schau bald wieder vorbei.', already: 'Du bist Premium. Danke!', cancelAnytime: 'Jederzeit in deinem Konto kündbar.', taxes: 'Steuern je nach Land inklusive.', loginFirst: 'Erstelle ein Konto oder melde dich an, um zu abonnieren.',
    success: 'Willkommen bei Premium! Dein Abo ist aktiv.', canceled: 'Die Zahlung wurde nicht abgeschlossen.',
  },
  newsletter: { title: 'Newsletter', intro: 'Zusammenfassungen geprüfter Nachrichten, wann du willst.', subscribe: 'Abonnieren', email: 'Deine E-Mail', confirmSent: 'Bitte bestätige dein Abo über den Link in der E-Mail.', confirmed: 'Abo bestätigt.', unsubscribed: 'Du bist abgemeldet.', premiumOnly: 'Nur Premium', daily: 'Täglich um {h}:00 Uhr' },
  report: {
    title: 'Fehler melden', intro: 'Wenn du glaubst, dass eine Meldung einen Fehler, eine falsche Quelle oder eine Rechtsverletzung enthält, sag es uns. Jede Meldung wird zu einer Prüfaufgabe.',
    kind: 'Art des Problems', kinds: { factual_error: 'Sachlicher Fehler', incorrect_content: 'Falscher oder irreführender Inhalt', copyright: 'Urheberrecht', privacy: 'Datenschutz', wrong_source: 'Falsche Quelle', other: 'Sonstiges' },
    url: 'Link zur Meldung', description: 'Beschreibe das Problem', name: 'Name (optional)', email: 'E-Mail (optional, für eine Antwort)', submit: 'Senden', thanks: 'Danke. Wir prüfen es und veröffentlichen gegebenenfalls eine Korrektur.',
  },
  notFound: { title: 'Seite nicht gefunden', text: 'Die Adresse hat sich vielleicht geändert oder die Meldung existiert nicht.', back: 'Zur Startseite' },
  error: { title: 'Etwas ist schiefgelaufen', text: 'Wir arbeiten daran. Bitte versuche es gleich noch einmal.' },
  common: { loading: 'Lädt…', back: 'Zurück', next: 'Weiter', prev: 'Zurück', or: 'oder', yes: 'Ja', no: 'Nein', send: 'Senden', required: 'Pflichtfeld' },
};

const fr: Dict = {
  tagline: 'Des informations vérifiées, sans raccourcis',
  nav: {
    home: 'Accueil', latest: 'Dernières', breaking: 'Alertes', trending: 'Tendances', forYou: 'Pour vous', local: 'Local', search: 'Rechercher',
    subscribe: "S'abonner", login: 'Connexion', account: 'Mon compte', logout: 'Déconnexion', newsletters: 'Newsletters', saved: 'Sauvegardés', menu: 'Menu', close: 'Fermer',
    sections: 'Rubriques', edition: 'Édition', language: 'Langue', skip: 'Aller au contenu',
  },
  label: {
    breaking: 'Alerte', developing: "En cours d'actualisation", verified: 'Vérifié', updated: 'Mis à jour', updatedAt: 'Mis à jour à {time}', publishedAt: 'Publié le {date}',
    retracted: 'Retiré', correction: 'Correction', clarification: 'Précision', update: 'Mise à jour', demo: 'DÉMO', readingTime: '{n} min de lecture', sources: '{n} sources', by: 'Par',
    premium: 'Premium', live: 'En direct', underReview: 'En vérification',
  },
  demoBanner: 'MODE DÉMO — Ces articles sont fictifs et servent uniquement à montrer le fonctionnement de Histor. Ce ne sont pas de vraies informations.',
  article: {
    sources: 'Sources', sourcesIntro: 'Cet article s’appuie sur les sources suivantes. Nous renvoyons toujours vers l’original.', primary: 'Source primaire',
    howWeVerified: 'Comment nous avons vérifié cette information', confirmed: 'Confirmé', attributed: 'Attribué (non confirmé de façon indépendante)', unconfirmed: 'Pas encore confirmé', discrepancies: 'Divergences entre les sources', confirmedBy: 'confirmé par : {list}',
    related: 'À lire aussi', timeline: 'Chronologie', history: 'Historique des modifications', version: 'Version {n}', viewVersion: 'Voir la version', reportError: 'Signaler une erreur',
    share: 'Partager', save: 'Sauvegarder', saved: 'Sauvegardé', copyLink: 'Copier le lien', copied: 'Lien copié', entities: 'Dans cet article', location: 'Lieu', tags: 'Sujets', writtenBy: 'Produit par {author}',
    automated: 'Texte produit par un système automatisé à partir de sources recoupées et soumis à des contrôles éditoriaux.', retractedNotice: 'Cet article a été retiré', otherLanguages: 'Aussi en', imageCredit: 'Image : {credit}', illustrative: "Image d'illustration, pas de l'événement", aiImage: 'Image générée par IA',
    corrections: 'Corrections et mises à jour', noImage: 'Pas de photographie vérifiée',
  },
  home: {
    topStory: "L'essentiel", latest: 'Dernières informations', trending: 'En progression', local: 'Près de chez vous', world: 'International', forYou: 'Pour vous',
    forYouExplain: 'Selon les sujets que vous suivez et vos lectures. Nous ajoutons d’autres informations importantes pour que vous ne manquiez rien.', empty: 'Aucune information vérifiée ici pour l’instant. Nous ne publions que ce que nous pouvons confirmer.',
    personalize: 'Personnaliser', seeAll: 'Tout voir', breakingNow: 'En ce moment', trustLine: 'Chaque article indique ce qui est confirmé, par qui, et ce qui ne l’est pas.',
  },
  list: { latest: 'Dernières informations', breaking: 'Alertes', trending: 'Tendances', forYou: 'Pour vous', more: 'Voir plus', empty: 'Aucun article à afficher.' },
  search: { title: 'Rechercher', placeholder: 'Rechercher des articles, sujets, lieux…', results: '{n} résultats pour « {q} »', none: 'Aucun résultat pour « {q} ».', submit: 'Rechercher', filters: 'Filtres', anyCategory: 'Toutes les rubriques', anyTime: 'Toutes les dates', lastDay: 'Dernières 24 heures', lastWeek: 'Dernière semaine' },
  entity: { topic: 'Sujet', follow: 'Suivre', following: 'Suivi', coverage: 'Couverture de Histor', articlesAbout: 'Articles sur {name}' },
  source: { title: 'Source', type: 'Type', reliability: 'Historique', country: 'Pays', articles: 'Articles citant cette source', typeNames: { primary_official: 'Source officielle primaire', official: 'Institution officielle', wire_agency: 'Agence de presse', reputable_media: 'Média', identified_journalist: 'Journaliste identifié', academic: 'Source académique', company: 'Entreprise', witness: 'Témoin', social_media: 'Réseau social (piste, pas preuve)', ugc: 'Contenu d’utilisateurs', blog: 'Blog', aggregator: 'Agrégateur', anonymous: 'Anonyme', unverifiable: 'Invérifiable' }, directory: 'Nos sources', directoryIntro: 'Les sources suivies par Histor, leur classement et leur poids dans la vérification.' },
  author: { desk: 'Rédaction automatisée', notAPerson: "Ce n'est pas une personne : c'est un pôle de rédaction automatisé de Histor." },
  footer: {
    about: 'Histor est un journal numérique qui ne publie que ce qu’il peut vérifier.', automation: 'Nous utilisons l’automatisation avec des contrôles éditoriaux.', howItWorks: 'Comment ça marche', editorialPolicy: 'Charte éditoriale',
    corrections: 'Corrections', privacy: 'Confidentialité', cookies: 'Cookies', terms: 'Conditions', subscriptionTerms: "Conditions d'abonnement", contact: 'Contact', legalNotice: 'Mentions légales', report: 'Signaler une erreur', sources: 'Nos sources', rights: '© {year} Histor', cookieSettings: 'Gestion des cookies',
  },
  cookies: {
    title: 'Votre vie privée', text: 'Nous utilisons des cookies nécessaires au fonctionnement du site. Avec votre accord, nous mesurons aussi l’audience sans vous identifier et personnalisons votre page d’accueil. Nous ne vendons pas vos données.',
    acceptAll: 'Tout accepter', rejectAll: 'Tout refuser', customize: 'Personnaliser', save: 'Enregistrer mes choix',
    categories: { necessary: ['Nécessaires', 'Session, sécurité et langue. Toujours actifs.'], preferences: ['Préférences', 'Mémoriser votre édition et vos réglages de lecture.'], analytics: ['Mesure', "Statistiques d'usage agrégées, sans profilage publicitaire."], personalization: ['Personnalisation', 'Apprendre les sujets qui vous intéressent pour ordonner votre accueil.'], marketing: ['Publicité', 'Publicités (version gratuite uniquement). Désactivé par défaut.'] },
  },
  account: {
    email: 'E-mail', password: 'Mot de passe', name: 'Nom (facultatif)', login: 'Se connecter', register: 'Créer un compte', forgot: 'Mot de passe oublié ?', reset: 'Réinitialiser le mot de passe', newPassword: 'Nouveau mot de passe',
    save: 'Enregistrer', saved: 'Enregistré', preferences: 'Préférences', language: 'Langue', country: 'Votre édition', region: 'Région', city: 'Ville', topics: 'Sujets suivis', newsletters: 'Newsletters', alerts: 'Alertes',
    alertsMax: "Nombre maximal d'alertes par jour", quietHours: "Pas d'alertes entre {from} h et {to} h", subscription: 'Abonnement', manage: "Gérer l'abonnement et les factures", exportData: 'Télécharger mes données', deleteAccount: 'Supprimer mon compte',
    deleteConfirm: 'Cette action supprime définitivement votre compte et vos données. Tapez SUPPRIMER pour confirmer.', twoFactor: 'Validation en deux étapes', logout: 'Se déconnecter', google: 'Continuer avec Google', apple: 'Continuer avec Apple', or: 'ou',
    haveAccount: 'Déjà un compte ?', noAccount: 'Pas encore de compte ?', passwordHint: '10 caractères minimum.', verifySent: 'Nous vous avons envoyé un e-mail pour confirmer votre adresse.', resetSent: 'Si un compte existe avec cet e-mail, nous vous avons envoyé un lien de réinitialisation.',
    resetDone: 'Mot de passe modifié. Vous pouvez vous connecter.', personalization: 'Personnaliser mon accueil selon mes lectures', marketing: 'Recevoir les nouveautés de Histor', history: 'Historique de lecture', savedEmpty: "Vous n'avez sauvegardé aucun article.", free: 'Gratuit', premium: 'Premium', plan: 'Formule',
    errors: { invalid: 'E-mail ou mot de passe incorrect.', taken: 'Un compte existe déjà avec cet e-mail.', weak: 'Mot de passe trop court.', rate: 'Trop de tentatives. Patientez quelques minutes.', generic: "Une erreur s'est produite. Réessayez.", token: 'Ce lien a expiré ou n’est pas valide.', totp: 'Code incorrect.' },
    totpCode: 'Code de vérification', welcome: 'Bonjour, {name}',
  },
  subscribe: {
    title: 'Histor Premium', subtitle: 'Du journalisme vérifié, à votre mesure. Sans publicité.', monthly: 'Mensuel', yearly: 'Annuel', perMonth: '/mois', perYear: '/an', trial: '{n} jours offerts', save: 'Économisez {n} %',
    features: ['Sans publicité', 'Alertes sur mesure', 'Newsletters locales et thématiques', 'Suivi de sujets, entreprises, clubs et villes', 'Archives complètes et analyses', "Personnalisation avancée de l'accueil"],
    freeTitle: 'Gratuit', freeFeatures: ['Toutes les informations vérifiées', 'Newsletter quotidienne de votre édition', 'Publicité non intrusive'], cta: "S'abonner", ctaTrial: "Commencer l'essai gratuit",
    notConfigured: 'Les abonnements ne sont pas encore ouverts. Revenez bientôt.', already: 'Vous êtes Premium. Merci !', cancelAnytime: 'Résiliable à tout moment depuis votre compte.', taxes: 'Taxes incluses selon votre pays.', loginFirst: 'Créez un compte ou connectez-vous pour vous abonner.',
    success: 'Bienvenue dans Premium ! Votre abonnement est actif.', canceled: "Le paiement n'a pas abouti.",
  },
  newsletter: { title: 'Newsletters', intro: 'Des synthèses d’informations vérifiées, quand vous voulez.', subscribe: "S'abonner", email: 'Votre e-mail', confirmSent: 'Vérifiez votre boîte mail pour confirmer.', confirmed: 'Abonnement confirmé.', unsubscribed: 'Vous êtes désabonné.', premiumOnly: 'Réservé Premium', daily: 'Chaque jour à {h} h' },
  report: {
    title: 'Signaler une erreur', intro: 'Si un article contient selon vous une erreur, une mauvaise source ou porte atteinte à des droits, dites-le-nous. Chaque signalement devient une tâche de vérification.',
    kind: 'Type de problème', kinds: { factual_error: 'Erreur factuelle', incorrect_content: 'Contenu inexact ou trompeur', copyright: "Droit d'auteur", privacy: 'Vie privée', wrong_source: 'Mauvaise source', other: 'Autre' },
    url: "Lien de l'article", description: 'Décrivez le problème', name: 'Nom (facultatif)', email: 'E-mail (facultatif, pour vous répondre)', submit: 'Envoyer', thanks: 'Merci. Nous allons vérifier et, si nécessaire, publier une correction.',
  },
  notFound: { title: 'Page introuvable', text: "L'adresse a peut-être changé ou l'article n'existe pas.", back: "Retour à l'accueil" },
  error: { title: "Une erreur s'est produite", text: 'Nous y travaillons. Réessayez dans un instant.' },
  common: { loading: 'Chargement…', back: 'Retour', next: 'Suivant', prev: 'Précédent', or: 'ou', yes: 'Oui', no: 'Non', send: 'Envoyer', required: 'Obligatoire' },
};

const it: Dict = {
  tagline: 'Notizie verificate, senza scorciatoie',
  nav: {
    home: 'Home', latest: 'Ultime', breaking: 'Ultima ora', trending: 'Tendenze', forYou: 'Per te', local: 'Locale', search: 'Cerca',
    subscribe: 'Abbonati', login: 'Accedi', account: 'Il mio account', logout: 'Esci', newsletters: 'Newsletter', saved: 'Salvati', menu: 'Menu', close: 'Chiudi',
    sections: 'Sezioni', edition: 'Edizione', language: 'Lingua', skip: 'Vai al contenuto',
  },
  label: {
    breaking: 'Ultima ora', developing: 'In aggiornamento', verified: 'Verificata', updated: 'Aggiornata', updatedAt: 'Aggiornato alle {time}', publishedAt: 'Pubblicato il {date}',
    retracted: 'Ritirata', correction: 'Correzione', clarification: 'Precisazione', update: 'Aggiornamento', demo: 'DEMO', readingTime: '{n} min di lettura', sources: '{n} fonti', by: 'Di',
    premium: 'Premium', live: 'In diretta', underReview: 'In revisione',
  },
  demoBanner: 'MODALITÀ DEMO — Queste notizie sono inventate e servono solo a mostrare come funziona Histor. Non sono notizie reali.',
  article: {
    sources: 'Fonti', sourcesIntro: 'Questa notizia si basa sulle fonti seguenti. Rimandiamo sempre all’originale.', primary: 'Fonte primaria',
    howWeVerified: 'Come abbiamo verificato questa notizia', confirmed: 'Confermato', attributed: 'Attribuito (senza conferma indipendente)', unconfirmed: 'Non ancora confermato', discrepancies: 'Discrepanze tra le fonti', confirmedBy: 'lo conferma: {list}',
    related: 'Notizie correlate', timeline: 'Cronologia', history: 'Cronologia delle modifiche', version: 'Versione {n}', viewVersion: 'Vedi versione', reportError: 'Segnala un errore',
    share: 'Condividi', save: 'Salva', saved: 'Salvato', copyLink: 'Copia link', copied: 'Link copiato', entities: 'In questa notizia', location: 'Luogo', tags: 'Argomenti', writtenBy: 'Prodotto da {author}',
    automated: 'Testo prodotto da un sistema automatizzato a partire da fonti verificate e sottoposto a controlli editoriali.', retractedNotice: 'Questa notizia è stata ritirata', otherLanguages: 'Anche in', imageCredit: 'Immagine: {credit}', illustrative: "Immagine illustrativa, non dell'evento", aiImage: "Immagine generata dall'IA",
    corrections: 'Correzioni e aggiornamenti', noImage: 'Nessuna fotografia verificata',
  },
  home: {
    topStory: 'In primo piano', latest: 'Ultime notizie', trending: 'In crescita', local: 'Vicino a te', world: 'Esteri', forYou: 'Per te',
    forYouExplain: 'In base agli argomenti che segui e a ciò che leggi. Aggiungiamo altre notizie importanti per non farti perdere nulla.', empty: 'Ancora nessuna notizia verificata qui. Pubblichiamo solo ciò che possiamo confermare.',
    personalize: 'Personalizza', seeAll: 'Vedi tutto', breakingNow: 'Adesso', trustLine: 'Ogni notizia mostra cosa è confermato, chi lo conferma e cosa no.',
  },
  list: { latest: 'Ultime notizie', breaking: 'Ultima ora', trending: 'Tendenze', forYou: 'Per te', more: 'Carica altro', empty: 'Nessuna notizia da mostrare.' },
  search: { title: 'Cerca', placeholder: 'Cerca notizie, argomenti, luoghi…', results: '{n} risultati per «{q}»', none: 'Nessun risultato per «{q}».', submit: 'Cerca', filters: 'Filtri', anyCategory: 'Tutte le sezioni', anyTime: 'Qualsiasi data', lastDay: 'Ultime 24 ore', lastWeek: 'Ultima settimana' },
  entity: { topic: 'Argomento', follow: 'Segui', following: 'Segui già', coverage: 'La copertura di Histor', articlesAbout: 'Notizie su {name}' },
  source: { title: 'Fonte', type: 'Tipo', reliability: 'Affidabilità storica', country: 'Paese', articles: 'Notizie che citano questa fonte', typeNames: { primary_official: 'Fonte ufficiale primaria', official: 'Istituzione ufficiale', wire_agency: 'Agenzia di stampa', reputable_media: 'Testata giornalistica', identified_journalist: 'Giornalista identificato', academic: 'Fonte accademica', company: 'Azienda', witness: 'Testimone', social_media: 'Social network (indizio, non prova)', ugc: 'Contenuti degli utenti', blog: 'Blog', aggregator: 'Aggregatore', anonymous: 'Anonima', unverifiable: 'Non verificabile' }, directory: 'Le nostre fonti', directoryIntro: 'Le fonti che Histor consulta, come le classifichiamo e quanto pesa ciascuna nella verifica.' },
  author: { desk: 'Redazione automatizzata', notAPerson: 'Non è una persona: è un desk redazionale automatizzato di Histor.' },
  footer: {
    about: 'Histor è un giornale digitale che pubblica solo ciò che può verificare.', automation: "Usiamo l'automazione con controlli editoriali.", howItWorks: 'Come funziona', editorialPolicy: 'Linee guida editoriali',
    corrections: 'Correzioni', privacy: 'Privacy', cookies: 'Cookie', terms: 'Termini', subscriptionTerms: "Condizioni d'abbonamento", contact: 'Contatti', legalNotice: 'Note legali', report: 'Segnala un errore', sources: 'Le nostre fonti', rights: '© {year} Histor', cookieSettings: 'Preferenze cookie',
  },
  cookies: {
    title: 'La tua privacy', text: 'Usiamo cookie necessari al funzionamento del sito. Con il tuo consenso, misuriamo anche il pubblico senza identificarti e personalizziamo la tua home. Non vendiamo i tuoi dati.',
    acceptAll: 'Accetta tutto', rejectAll: 'Rifiuta tutto', customize: 'Personalizza', save: 'Salva preferenze',
    categories: { necessary: ['Necessari', 'Sessione, sicurezza e lingua. Sempre attivi.'], preferences: ['Preferenze', 'Ricordare la tua edizione e le impostazioni di lettura.'], analytics: ['Misurazione', "Statistiche d'uso aggregate, senza profili pubblicitari."], personalization: ['Personalizzazione', 'Capire quali argomenti ti interessano per ordinare la home.'], marketing: ['Pubblicità', 'Annunci (solo versione gratuita). Disattivato di default.'] },
  },
  account: {
    email: 'Email', password: 'Password', name: 'Nome (facoltativo)', login: 'Accedi', register: 'Crea account', forgot: 'Password dimenticata?', reset: 'Reimposta password', newPassword: 'Nuova password',
    save: 'Salva', saved: 'Salvato', preferences: 'Preferenze', language: 'Lingua', country: 'La tua edizione', region: 'Regione', city: 'Città', topics: 'Argomenti seguiti', newsletters: 'Newsletter', alerts: 'Avvisi ultima ora',
    alertsMax: 'Massimo di avvisi al giorno', quietHours: 'Nessun avviso tra le {from} e le {to}', subscription: 'Abbonamento', manage: 'Gestisci abbonamento e fatture', exportData: 'Scarica i miei dati', deleteAccount: 'Elimina il mio account',
    deleteConfirm: 'Questa azione elimina definitivamente account e dati. Scrivi ELIMINA per confermare.', twoFactor: 'Verifica in due passaggi', logout: 'Esci', google: 'Continua con Google', apple: 'Continua con Apple', or: 'oppure',
    haveAccount: 'Hai già un account?', noAccount: 'Non hai un account?', passwordHint: 'Almeno 10 caratteri.', verifySent: "Ti abbiamo inviato un'email per confermare l'indirizzo.", resetSent: "Se esiste un account con quell'email, ti abbiamo inviato un link per reimpostare la password.",
    resetDone: 'Password cambiata. Ora puoi accedere.', personalization: 'Personalizza la home in base a ciò che leggo', marketing: 'Ricevi novità da Histor', history: 'Cronologia di lettura', savedEmpty: 'Non hai salvato nessuna notizia.', free: 'Gratuito', premium: 'Premium', plan: 'Piano',
    errors: { invalid: 'Email o password errate.', taken: "Esiste già un account con quest'email.", weak: 'La password è troppo corta.', rate: 'Troppi tentativi. Attendi qualche minuto.', generic: 'Qualcosa non ha funzionato. Riprova.', token: 'Il link è scaduto o non è valido.', totp: 'Codice errato.' },
    totpCode: 'Codice di verifica', welcome: 'Ciao, {name}',
  },
  subscribe: {
    title: 'Histor Premium', subtitle: 'Giornalismo verificato, su misura per te. Senza pubblicità.', monthly: 'Mensile', yearly: 'Annuale', perMonth: '/mese', perYear: '/anno', trial: '{n} giorni gratis', save: 'Risparmia il {n}%',
    features: ['Senza pubblicità', 'Avvisi di ultima ora su misura', 'Newsletter locali e tematiche', 'Segui argomenti, aziende, squadre e città', 'Archivio completo e analisi', 'Personalizzazione avanzata della home'],
    freeTitle: 'Gratis', freeFeatures: ['Tutte le notizie verificate', 'Newsletter quotidiana della tua edizione', 'Pubblicità non invasiva'], cta: 'Abbonati', ctaTrial: 'Inizia la prova gratuita',
    notConfigured: 'Gli abbonamenti non sono ancora attivi. Torna presto.', already: 'Sei già Premium. Grazie!', cancelAnytime: 'Disdici quando vuoi dal tuo account.', taxes: 'Imposte incluse secondo il tuo paese.', loginFirst: 'Crea un account o accedi per abbonarti.',
    success: 'Benvenuto in Premium! Il tuo abbonamento è attivo.', canceled: 'Il pagamento non è stato completato.',
  },
  newsletter: { title: 'Newsletter', intro: 'Sintesi di notizie verificate, quando vuoi leggerle.', subscribe: 'Iscriviti', email: 'La tua email', confirmSent: "Controlla la posta per confermare l'iscrizione.", confirmed: 'Iscrizione confermata.', unsubscribed: 'Disiscrizione completata.', premiumOnly: 'Solo Premium', daily: 'Ogni giorno alle {h}:00' },
  report: {
    title: 'Segnala un errore', intro: 'Se pensi che una notizia contenga un errore, una fonte sbagliata o violi dei diritti, faccelo sapere. Ogni segnalazione diventa un’attività di revisione.',
    kind: 'Tipo di problema', kinds: { factual_error: 'Errore nei fatti', incorrect_content: 'Contenuto errato o fuorviante', copyright: "Diritto d'autore", privacy: 'Privacy', wrong_source: 'Fonte sbagliata', other: 'Altro' },
    url: 'Link alla notizia', description: 'Descrivi il problema', name: 'Nome (facoltativo)', email: 'Email (facoltativa, per risponderti)', submit: 'Invia', thanks: 'Grazie. La esamineremo e, se necessario, pubblicheremo una correzione.',
  },
  notFound: { title: 'Pagina non trovata', text: "L'indirizzo potrebbe essere cambiato o la notizia non esiste.", back: 'Torna alla home' },
  error: { title: 'Qualcosa non ha funzionato', text: 'Ci stiamo lavorando. Riprova tra un momento.' },
  common: { loading: 'Caricamento…', back: 'Indietro', next: 'Avanti', prev: 'Indietro', or: 'oppure', yes: 'Sì', no: 'No', send: 'Invia', required: 'Obbligatorio' },
};

const pt: Dict = {
  tagline: 'Notícias checadas, sem atalhos',
  nav: {
    home: 'Início', latest: 'Últimas', breaking: 'Urgente', trending: 'Em alta', forYou: 'Para você', local: 'Local', search: 'Buscar',
    subscribe: 'Assine', login: 'Entrar', account: 'Minha conta', logout: 'Sair', newsletters: 'Newsletters', saved: 'Salvos', menu: 'Menu', close: 'Fechar',
    sections: 'Editorias', edition: 'Edição', language: 'Idioma', skip: 'Pular para o conteúdo',
  },
  label: {
    breaking: 'Urgente', developing: 'Em atualização', verified: 'Checada', updated: 'Atualizada', updatedAt: 'Atualizado às {time}', publishedAt: 'Publicado em {date}',
    retracted: 'Retirada', correction: 'Correção', clarification: 'Esclarecimento', update: 'Atualização', demo: 'DEMO', readingTime: '{n} min de leitura', sources: '{n} fontes', by: 'Por',
    premium: 'Premium', live: 'Ao vivo', underReview: 'Em revisão',
  },
  demoBanner: 'MODO DEMO — Estas notícias são fictícias e servem apenas para mostrar como o Histor funciona. Não são notícias reais.',
  article: {
    sources: 'Fontes', sourcesIntro: 'Esta notícia foi elaborada a partir destas fontes. Sempre linkamos o original.', primary: 'Fonte primária',
    howWeVerified: 'Como checamos esta notícia', confirmed: 'Confirmado', attributed: 'Atribuído (sem confirmação independente)', unconfirmed: 'Ainda não confirmado', discrepancies: 'Divergências entre fontes', confirmedBy: 'confirmado por: {list}',
    related: 'Notícias relacionadas', timeline: 'Cronologia', history: 'Histórico de alterações', version: 'Versão {n}', viewVersion: 'Ver versão', reportError: 'Reportar erro',
    share: 'Compartilhar', save: 'Salvar', saved: 'Salvo', copyLink: 'Copiar link', copied: 'Link copiado', entities: 'Nesta notícia', location: 'Local', tags: 'Temas', writtenBy: 'Produzido por {author}',
    automated: 'Texto produzido por um sistema automatizado a partir de fontes checadas e submetido a controles editoriais.', retractedNotice: 'Esta notícia foi retirada', otherLanguages: 'Também em', imageCredit: 'Imagem: {credit}', illustrative: 'Imagem ilustrativa, não do acontecimento', aiImage: 'Imagem gerada por IA',
    corrections: 'Correções e atualizações', noImage: 'Sem fotografia verificada',
  },
  home: {
    topStory: 'Destaque', latest: 'Últimas notícias', trending: 'Ganhando força', local: 'Perto de você', world: 'Internacional', forYou: 'Para você',
    forYouExplain: 'Com base nos temas que você segue e no que lê. Incluímos outras notícias importantes para você não perder nada.', empty: 'Ainda não há notícias checadas aqui. Só publicamos o que conseguimos confirmar.',
    personalize: 'Personalizar', seeAll: 'Ver tudo', breakingNow: 'Agora', trustLine: 'Cada notícia mostra o que está confirmado, quem confirma e o que não está.',
  },
  list: { latest: 'Últimas notícias', breaking: 'Urgente', trending: 'Em alta', forYou: 'Para você', more: 'Carregar mais', empty: 'Nenhuma notícia para mostrar.' },
  search: { title: 'Buscar', placeholder: 'Buscar notícias, temas, lugares…', results: '{n} resultados para “{q}”', none: 'Nenhum resultado para “{q}”.', submit: 'Buscar', filters: 'Filtros', anyCategory: 'Todas as editorias', anyTime: 'Qualquer data', lastDay: 'Últimas 24 horas', lastWeek: 'Última semana' },
  entity: { topic: 'Tema', follow: 'Seguir', following: 'Seguindo', coverage: 'Cobertura do Histor', articlesAbout: 'Notícias sobre {name}' },
  source: { title: 'Fonte', type: 'Tipo', reliability: 'Histórico', country: 'País', articles: 'Notícias que citam esta fonte', typeNames: { primary_official: 'Fonte oficial primária', official: 'Instituição oficial', wire_agency: 'Agência de notícias', reputable_media: 'Veículo de imprensa', identified_journalist: 'Jornalista identificado', academic: 'Fonte acadêmica', company: 'Empresa', witness: 'Testemunha', social_media: 'Rede social (pista, não evidência)', ugc: 'Conteúdo de usuários', blog: 'Blog', aggregator: 'Agregador', anonymous: 'Anônima', unverifiable: 'Não verificável' }, directory: 'Nossas fontes', directoryIntro: 'As fontes que o Histor acompanha, como as classificamos e quanto pesa cada uma na checagem.' },
  author: { desk: 'Redação automatizada', notAPerson: 'Não é uma pessoa: é uma editoria automatizada do Histor.' },
  footer: {
    about: 'O Histor é um jornal digital que só publica o que consegue checar.', automation: 'Usamos automação com controles editoriais.', howItWorks: 'Como funciona', editorialPolicy: 'Política editorial',
    corrections: 'Correções', privacy: 'Privacidade', cookies: 'Cookies', terms: 'Termos', subscriptionTerms: 'Termos da assinatura', contact: 'Contato', legalNotice: 'Aviso legal', report: 'Reportar erro', sources: 'Nossas fontes', rights: '© {year} Histor', cookieSettings: 'Preferências de cookies',
  },
  cookies: {
    title: 'Sua privacidade', text: 'Usamos cookies necessários para o site funcionar. Com sua permissão, também medimos a audiência sem identificar você e personalizamos sua página inicial. Não vendemos seus dados.',
    acceptAll: 'Aceitar tudo', rejectAll: 'Recusar tudo', customize: 'Configurar', save: 'Salvar preferências',
    categories: { necessary: ['Necessários', 'Sessão, segurança e idioma. Sempre ativos.'], preferences: ['Preferências', 'Lembrar sua edição e ajustes de leitura.'], analytics: ['Medição', 'Estatísticas de uso agregadas, sem perfis publicitários.'], personalization: ['Personalização', 'Entender os temas que interessam a você para ordenar sua página.'], marketing: ['Publicidade', 'Anúncios (só na versão gratuita). Desativado por padrão.'] },
  },
  account: {
    email: 'E-mail', password: 'Senha', name: 'Nome (opcional)', login: 'Entrar', register: 'Criar conta', forgot: 'Esqueceu a senha?', reset: 'Redefinir senha', newPassword: 'Nova senha',
    save: 'Salvar', saved: 'Salvo', preferences: 'Preferências', language: 'Idioma', country: 'Sua edição', region: 'Região', city: 'Cidade', topics: 'Temas que você segue', newsletters: 'Newsletters', alerts: 'Alertas urgentes',
    alertsMax: 'Máximo de alertas por dia', quietHours: 'Sem alertas entre {from}h e {to}h', subscription: 'Assinatura', manage: 'Gerenciar assinatura e faturas', exportData: 'Baixar meus dados', deleteAccount: 'Excluir minha conta',
    deleteConfirm: 'Esta ação exclui sua conta e seus dados de forma permanente. Digite EXCLUIR para confirmar.', twoFactor: 'Verificação em duas etapas', logout: 'Sair', google: 'Continuar com Google', apple: 'Continuar com Apple', or: 'ou',
    haveAccount: 'Já tem conta?', noAccount: 'Ainda não tem conta?', passwordHint: 'No mínimo 10 caracteres.', verifySent: 'Enviamos um e-mail para confirmar seu endereço.', resetSent: 'Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha.',
    resetDone: 'Senha alterada. Você já pode entrar.', personalization: 'Personalizar minha página com base no que leio', marketing: 'Quero receber novidades do Histor', history: 'Histórico de leitura', savedEmpty: 'Você não salvou nenhuma notícia.', free: 'Gratuito', premium: 'Premium', plan: 'Plano',
    errors: { invalid: 'E-mail ou senha incorretos.', taken: 'Já existe uma conta com esse e-mail.', weak: 'A senha é curta demais.', rate: 'Muitas tentativas. Aguarde alguns minutos.', generic: 'Algo deu errado. Tente novamente.', token: 'O link expirou ou é inválido.', totp: 'Código incorreto.' },
    totpCode: 'Código de verificação', welcome: 'Olá, {name}',
  },
  subscribe: {
    title: 'Histor Premium', subtitle: 'Jornalismo checado, do seu jeito. Sem anúncios.', monthly: 'Mensal', yearly: 'Anual', perMonth: '/mês', perYear: '/ano', trial: '{n} dias grátis', save: 'Economize {n}%',
    features: ['Sem anúncios', 'Alertas urgentes sob medida', 'Newsletters locais e temáticas', 'Siga temas, empresas, times e cidades', 'Arquivo completo e análises', 'Personalização avançada da página inicial'],
    freeTitle: 'Grátis', freeFeatures: ['Todas as notícias checadas', 'Newsletter diária da sua edição', 'Publicidade não invasiva'], cta: 'Assinar', ctaTrial: 'Começar teste grátis',
    notConfigured: 'As assinaturas ainda não estão ativas. Volte em breve.', already: 'Você já é Premium. Obrigado!', cancelAnytime: 'Cancele quando quiser pela sua conta.', taxes: 'Impostos incluídos conforme seu país.', loginFirst: 'Crie uma conta ou entre para assinar.',
    success: 'Bem-vindo ao Premium! Sua assinatura está ativa.', canceled: 'O pagamento não foi concluído.',
  },
  newsletter: { title: 'Newsletters', intro: 'Resumos de notícias checadas, quando você quiser ler.', subscribe: 'Inscrever-me', email: 'Seu e-mail', confirmSent: 'Confira seu e-mail para confirmar a inscrição.', confirmed: 'Inscrição confirmada.', unsubscribed: 'Inscrição cancelada.', premiumOnly: 'Só Premium', daily: 'Todo dia às {h}h' },
  report: {
    title: 'Reportar erro', intro: 'Se você acha que uma notícia tem um erro, uma fonte errada ou viola direitos, conte para nós. Cada aviso vira uma tarefa de revisão.',
    kind: 'Tipo de problema', kinds: { factual_error: 'Erro de fato', incorrect_content: 'Conteúdo incorreto ou enganoso', copyright: 'Direitos autorais', privacy: 'Privacidade', wrong_source: 'Fonte errada', other: 'Outro' },
    url: 'Link da notícia', description: 'Descreva o problema', name: 'Nome (opcional)', email: 'E-mail (opcional, para respondermos)', submit: 'Enviar', thanks: 'Obrigado. Vamos analisar e, se for o caso, publicar uma correção.',
  },
  notFound: { title: 'Página não encontrada', text: 'O endereço pode ter mudado ou a notícia não existe.', back: 'Voltar para o início' },
  error: { title: 'Algo deu errado', text: 'Estamos trabalhando nisso. Tente de novo em instantes.' },
  common: { loading: 'Carregando…', back: 'Voltar', next: 'Próximo', prev: 'Anterior', or: 'ou', yes: 'Sim', no: 'Não', send: 'Enviar', required: 'Obrigatório' },
};

export const DICTIONARIES: Record<string, Dict> = { es, en, de, fr, it, pt };

export function dict(lang: string): Dict {
  return DICTIONARIES[lang] ?? en;
}

/** Sustituye {clave} por su valor. */
export function t(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] != null ? String(vars[k]) : m));
}
