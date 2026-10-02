/**
 * Frases del redactor determinista en cada idioma. No son traducciones
 * literales: cada una sigue la convención periodística local
 * ("según", "laut", "selon"…). Añadir idioma = añadir su bloque.
 */

export type Phrases = {
  according: (claim: string, sources: string) => string;
  reports: (sources: string, claim: string) => string;
  /** Bajo el titular de una noticia verificada: cuántas fuentes, sin nombrarlas (los medios van en el recuadro de fuentes). */
  confirmedBy: (n: number) => string;
  developingNote: string;
  willUpdate: string;
  headings: { known: string; figures: string; unconfirmed: string; next: string; discrepancies: string; timeline: string };
  unconfirmedSuffix: string;
  discrepancy: (field: string, parts: string) => string;
  method: (independent: number, primary: boolean) => string;
  and: string;
  units: Record<string, string>;
  fieldNames: Record<string, string>;
  quoteIntro: (speaker: string) => string;
  earthquake: {
    headline: (mag: string, place: string) => string;
    lead: (agency: string, time: string, mag: string, place: string, depth: string) => string;
    tsunami: string;
  };
  near: (place: string) => string;
  timelineItem: (source: string) => string;
};

const joinList = (items: string[], and: string) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;

export function listJoin(lang: string, items: string[]): string {
  return joinList(items, PHRASES[lang]?.and ?? 'and');
}

export const PHRASES: Record<string, Phrases> = {
  es: {
    according: (c, s) => `${c}, según ${s}.`,
    reports: (s, c) => `${s} informa de que ${c}`,
    confirmedBy: (n) => (n === 1 ? 'Información verificada.' : `Verificada con ${n} fuentes independientes.`),
    developingNote: 'Información en desarrollo: todavía no la confirman dos fuentes independientes.',
    willUpdate: 'Histor seguirá actualizando esta información.',
    headings: { known: 'Lo que se sabe', figures: 'Datos clave', unconfirmed: 'Lo que aún no está confirmado', next: 'Qué puede pasar ahora', discrepancies: 'Discrepancias entre fuentes', timeline: 'Cronología' },
    unconfirmedSuffix: 'No se ha podido confirmar de forma independiente.',
    discrepancy: (f, p) => `Las fuentes no coinciden en ${f}: ${p}.`,
    method: (n, p) =>
      `Esta información se ha contrastado con ${n} fuente${n === 1 ? '' : 's'} independiente${n === 1 ? '' : 's'}${p ? ', incluida una fuente oficial primaria' : ''}. Solo damos como hecho lo que confirman fuentes fiables; lo que aún no está confirmado se indica como tal.`,
    and: 'y',
    units: { deaths: 'Fallecidos', injured: 'Heridos', missing: 'Desaparecidos', evacuated: 'Evacuados', arrested: 'Detenidos', people: 'Personas', homes: 'Viviendas', jobs: 'Empleos', votes: 'Votos', seats: 'Escaños', magnitude: 'Magnitud', km: 'Kilómetros', celsius: 'Temperatura (°C)', percent: 'Porcentaje', vehicles: 'Vehículos', flights: 'Vuelos', hectares: 'Hectáreas', years_old: 'Edad', percentage_points: 'Puntos porcentuales', currency: 'Importe' },
    fieldNames: { number: 'las cifras', date: 'la fecha', place: 'el lugar', quote: 'la autoría de una cita', denial: 'los hechos (hay un desmentido)' },
    quoteIntro: (s) => `${s} declaró:`,
    earthquake: {
      headline: (m, p) => `Terremoto de magnitud ${m} ${p}`,
      lead: (a, t, m, p, d) => `${a} registró el ${t} un terremoto de magnitud ${m} ${p}, a una profundidad de ${d} km.`,
      tsunami: 'El organismo emitió un indicador de posible tsunami.',
    },
    near: (p) => `cerca de ${p}`,
    timelineItem: (s) => `Publica ${s}`,
  },
  en: {
    according: (c, s) => `${c}, according to ${s}.`,
    reports: (s, c) => `${s} reports that ${c}`,
    confirmedBy: (n) => (n === 1 ? 'Verified information.' : `Verified with ${n} independent sources.`),
    developingNote: 'Developing story: not yet confirmed by two independent sources.',
    willUpdate: 'Histor will keep updating this story.',
    headings: { known: 'What we know', figures: 'Key figures', unconfirmed: 'What is not yet confirmed', next: 'What could happen next', discrepancies: 'Where sources disagree', timeline: 'Timeline' },
    unconfirmedSuffix: 'This could not be independently confirmed.',
    discrepancy: (f, p) => `Sources disagree on ${f}: ${p}.`,
    method: (n, p) =>
      `This story was checked against ${n} independent source${n === 1 ? '' : 's'}${p ? ', including a primary official source' : ''}. We only report as fact what reliable sources confirm; anything not yet confirmed is flagged as such.`,
    and: 'and',
    units: { deaths: 'Deaths', injured: 'Injured', missing: 'Missing', evacuated: 'Evacuated', arrested: 'Arrested', people: 'People', homes: 'Homes', jobs: 'Jobs', votes: 'Votes', seats: 'Seats', magnitude: 'Magnitude', km: 'Kilometres', celsius: 'Temperature (°C)', percent: 'Percentage', vehicles: 'Vehicles', flights: 'Flights', hectares: 'Hectares', years_old: 'Age', percentage_points: 'Percentage points', currency: 'Amount' },
    fieldNames: { number: 'the figures', date: 'the date', place: 'the location', quote: 'who said a quote', denial: 'the facts (there is a denial)' },
    quoteIntro: (s) => `${s} said:`,
    earthquake: {
      headline: (m, p) => `Magnitude ${m} earthquake ${p}`,
      lead: (a, t, m, p, d) => `${a} recorded a magnitude ${m} earthquake ${p} on ${t}, at a depth of ${d} km.`,
      tsunami: 'The agency flagged a possible tsunami.',
    },
    near: (p) => `near ${p}`,
    timelineItem: (s) => `Reported by ${s}`,
  },
  de: {
    according: (c, s) => `${c}, berichtet ${s}.`,
    reports: (s, c) => `${s} berichtet: ${c}`,
    confirmedBy: (n) => (n === 1 ? 'Geprüfte Information.' : `Geprüft mit ${n} unabhängigen Quellen.`),
    developingNote: 'Die Lage entwickelt sich: noch nicht von zwei unabhängigen Quellen bestätigt.',
    willUpdate: 'Histor aktualisiert diesen Bericht fortlaufend.',
    headings: { known: 'Was bekannt ist', figures: 'Zahlen und Fakten', unconfirmed: 'Was noch nicht bestätigt ist', next: 'Wie es weitergehen könnte', discrepancies: 'Widersprüche zwischen Quellen', timeline: 'Chronologie' },
    unconfirmedSuffix: 'Dies konnte nicht unabhängig bestätigt werden.',
    discrepancy: (f, p) => `Die Quellen widersprechen sich bei ${f}: ${p}.`,
    method: (n, p) =>
      `Dieser Bericht wurde mit ${n} unabhängigen Quelle${n === 1 ? '' : 'n'} abgeglichen${p ? ', darunter eine amtliche Primärquelle' : ''}. Als Tatsache berichten wir nur, was verlässliche Quellen bestätigen; noch Unbestätigtes wird als solches gekennzeichnet.`,
    and: 'und',
    units: { deaths: 'Todesopfer', injured: 'Verletzte', missing: 'Vermisste', evacuated: 'Evakuierte', arrested: 'Festnahmen', people: 'Personen', homes: 'Wohnungen', jobs: 'Arbeitsplätze', votes: 'Stimmen', seats: 'Sitze', magnitude: 'Stärke', km: 'Kilometer', celsius: 'Temperatur (°C)', percent: 'Prozent', vehicles: 'Fahrzeuge', flights: 'Flüge', hectares: 'Hektar', years_old: 'Alter', percentage_points: 'Prozentpunkte', currency: 'Betrag' },
    fieldNames: { number: 'den Zahlen', date: 'dem Datum', place: 'dem Ort', quote: 'der Urheberschaft eines Zitats', denial: 'den Fakten (es gibt ein Dementi)' },
    quoteIntro: (s) => `${s} sagte:`,
    earthquake: {
      headline: (m, p) => `Erdbeben der Stärke ${m} ${p}`,
      lead: (a, t, m, p, d) => `${a} registrierte am ${t} ein Erdbeben der Stärke ${m} ${p} in ${d} km Tiefe.`,
      tsunami: 'Die Behörde gab einen möglichen Tsunami-Hinweis aus.',
    },
    near: (p) => `nahe ${p}`,
    timelineItem: (s) => `Bericht von ${s}`,
  },
  fr: {
    according: (c, s) => `${c}, selon ${s}.`,
    reports: (s, c) => `${s} rapporte que ${c}`,
    confirmedBy: (n) => (n === 1 ? 'Information vérifiée.' : `Vérifiée auprès de ${n} sources indépendantes.`),
    developingNote: "Information en cours d'actualisation : pas encore confirmée par deux sources indépendantes.",
    willUpdate: 'Histor continuera de mettre à jour cette information.',
    headings: { known: 'Ce que l’on sait', figures: 'Chiffres clés', unconfirmed: 'Ce qui n’est pas encore confirmé', next: 'Ce qui pourrait suivre', discrepancies: 'Divergences entre les sources', timeline: 'Chronologie' },
    unconfirmedSuffix: "Cela n'a pas pu être confirmé de façon indépendante.",
    discrepancy: (f, p) => `Les sources divergent sur ${f} : ${p}.`,
    method: (n, p) =>
      `Cette information a été recoupée avec ${n} source${n === 1 ? '' : 's'} indépendante${n === 1 ? '' : 's'}${p ? ', dont une source officielle primaire' : ''}. Nous ne présentons comme fait que ce que confirment des sources fiables ; ce qui n'est pas encore confirmé est signalé comme tel.`,
    and: 'et',
    units: { deaths: 'Morts', injured: 'Blessés', missing: 'Disparus', evacuated: 'Évacués', arrested: 'Interpellations', people: 'Personnes', homes: 'Logements', jobs: 'Emplois', votes: 'Voix', seats: 'Sièges', magnitude: 'Magnitude', km: 'Kilomètres', celsius: 'Température (°C)', percent: 'Pourcentage', vehicles: 'Véhicules', flights: 'Vols', hectares: 'Hectares', years_old: 'Âge', percentage_points: 'Points de pourcentage', currency: 'Montant' },
    fieldNames: { number: 'les chiffres', date: 'la date', place: 'le lieu', quote: "l'auteur d'une citation", denial: 'les faits (il existe un démenti)' },
    quoteIntro: (s) => `${s} a déclaré :`,
    earthquake: {
      headline: (m, p) => `Séisme de magnitude ${m} ${p}`,
      lead: (a, t, m, p, d) => `${a} a enregistré le ${t} un séisme de magnitude ${m} ${p}, à ${d} km de profondeur.`,
      tsunami: "L'organisme a signalé un possible tsunami.",
    },
    near: (p) => `près de ${p}`,
    timelineItem: (s) => `Publié par ${s}`,
  },
  it: {
    according: (c, s) => `${c}, secondo ${s}.`,
    reports: (s, c) => `${s} riferisce che ${c}`,
    confirmedBy: (n) => (n === 1 ? 'Notizia verificata.' : `Verificata con ${n} fonti indipendenti.`),
    developingNote: 'Notizia in aggiornamento: non ancora confermata da due fonti indipendenti.',
    willUpdate: 'Histor continuerà ad aggiornare questa notizia.',
    headings: { known: 'Cosa sappiamo', figures: 'I numeri', unconfirmed: 'Cosa non è ancora confermato', next: 'Cosa potrebbe succedere', discrepancies: 'Discrepanze tra le fonti', timeline: 'Cronologia' },
    unconfirmedSuffix: 'Non è stato possibile confermarlo in modo indipendente.',
    discrepancy: (f, p) => `Le fonti non concordano su ${f}: ${p}.`,
    method: (n, p) =>
      `Questa notizia è stata verificata con ${n} font${n === 1 ? 'e' : 'i'} indipendent${n === 1 ? 'e' : 'i'}${p ? ', tra cui una fonte ufficiale primaria' : ''}. Presentiamo come fatto solo ciò che confermano fonti affidabili; ciò che non è ancora confermato viene segnalato.`,
    and: 'e',
    units: { deaths: 'Morti', injured: 'Feriti', missing: 'Dispersi', evacuated: 'Evacuati', arrested: 'Arresti', people: 'Persone', homes: 'Abitazioni', jobs: 'Posti di lavoro', votes: 'Voti', seats: 'Seggi', magnitude: 'Magnitudo', km: 'Chilometri', celsius: 'Temperatura (°C)', percent: 'Percentuale', vehicles: 'Veicoli', flights: 'Voli', hectares: 'Ettari', years_old: 'Età', percentage_points: 'Punti percentuali', currency: 'Importo' },
    fieldNames: { number: 'i numeri', date: 'la data', place: 'il luogo', quote: "l'autore di una citazione", denial: 'i fatti (c’è una smentita)' },
    quoteIntro: (s) => `${s} ha dichiarato:`,
    earthquake: {
      headline: (m, p) => `Terremoto di magnitudo ${m} ${p}`,
      lead: (a, t, m, p, d) => `${a} ha registrato il ${t} un terremoto di magnitudo ${m} ${p}, a una profondità di ${d} km.`,
      tsunami: "L'ente ha segnalato un possibile tsunami.",
    },
    near: (p) => `vicino a ${p}`,
    timelineItem: (s) => `Pubblica ${s}`,
  },
  pt: {
    according: (c, s) => `${c}, segundo ${s}.`,
    reports: (s, c) => `${s} informa que ${c}`,
    confirmedBy: (n) => (n === 1 ? 'Informação verificada.' : `Verificada com ${n} fontes independentes.`),
    developingNote: 'Informação em atualização: ainda não confirmada por duas fontes independentes.',
    willUpdate: 'O Histor continuará atualizando esta informação.',
    headings: { known: 'O que se sabe', figures: 'Números', unconfirmed: 'O que ainda não está confirmado', next: 'O que pode acontecer agora', discrepancies: 'Divergências entre fontes', timeline: 'Cronologia' },
    unconfirmedSuffix: 'Não foi possível confirmar de forma independente.',
    discrepancy: (f, p) => `As fontes divergem sobre ${f}: ${p}.`,
    method: (n, p) =>
      `Esta informação foi checada com ${n} fonte${n === 1 ? '' : 's'} independente${n === 1 ? '' : 's'}${p ? ', incluindo uma fonte oficial primária' : ''}. Só apresentamos como fato o que fontes confiáveis confirmam; o que ainda não está confirmado é sinalizado.`,
    and: 'e',
    units: { deaths: 'Mortos', injured: 'Feridos', missing: 'Desaparecidos', evacuated: 'Evacuados', arrested: 'Detidos', people: 'Pessoas', homes: 'Moradias', jobs: 'Empregos', votes: 'Votos', seats: 'Cadeiras', magnitude: 'Magnitude', km: 'Quilômetros', celsius: 'Temperatura (°C)', percent: 'Percentual', vehicles: 'Veículos', flights: 'Voos', hectares: 'Hectares', years_old: 'Idade', percentage_points: 'Pontos percentuais', currency: 'Valor' },
    fieldNames: { number: 'os números', date: 'a data', place: 'o local', quote: 'a autoria de uma citação', denial: 'os fatos (há um desmentido)' },
    quoteIntro: (s) => `${s} declarou:`,
    earthquake: {
      headline: (m, p) => `Terremoto de magnitude ${m} ${p}`,
      lead: (a, t, m, p, d) => `${a} registrou em ${t} um terremoto de magnitude ${m} ${p}, a ${d} km de profundidade.`,
      tsunami: 'O órgão emitiu um alerta de possível tsunami.',
    },
    near: (p) => `perto de ${p}`,
    timelineItem: (s) => `Publica ${s}`,
  },
};
