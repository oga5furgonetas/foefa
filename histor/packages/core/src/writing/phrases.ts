/**
 * Frases del redactor determinista en cada idioma. No son traducciones
 * literales: cada una sigue la convención periodística local
 * ("según", "laut", "selon"…). Añadir idioma = añadir su bloque.
 */

export type Phrases = {
  according: (claim: string, sources: string) => string;
  reports: (sources: string, claim: string) => string;
  confirmedBy: (n: number, list: string) => string;
  /** Cuando hay más fuentes de las que se nombran. */
  confirmedByMany: (n: number, list: string) => string;
  singleSource: (source: string) => string;
  developingNote: string;
  willUpdate: string;
  headings: { known: string; figures: string; unconfirmed: string; next: string; discrepancies: string; timeline: string };
  unconfirmedSuffix: string;
  discrepancy: (field: string, parts: string) => string;
  figureSource: (sources: string) => string;
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
    confirmedBy: (n, l) => (n === 1 ? `Lo confirma ${l}.` : `Lo confirman ${n} fuentes independientes: ${l}.`),
    confirmedByMany: (n, l) => `Lo confirman ${n} fuentes independientes, entre ellas ${l}.`,
    singleSource: (s) => `Por ahora, solo ${s} lo ha publicado; Histor no ha podido confirmarlo de forma independiente.`,
    developingNote: 'Información en desarrollo. Cada dato se atribuye a la fuente que lo publica.',
    willUpdate: 'Histor seguirá actualizando esta información.',
    headings: { known: 'Lo que se sabe', figures: 'Datos clave', unconfirmed: 'Lo que aún no está confirmado', next: 'Qué puede pasar ahora', discrepancies: 'Discrepancias entre fuentes', timeline: 'Cronología' },
    unconfirmedSuffix: 'No se ha podido confirmar de forma independiente.',
    discrepancy: (f, p) => `Las fuentes no coinciden en ${f}: ${p}.`,
    figureSource: (s) => `(según ${s})`,
    method: (n, p) =>
      `Esta información se ha contrastado con ${n} fuente${n === 1 ? '' : 's'} independiente${n === 1 ? '' : 's'}${p ? ', incluida una fuente oficial primaria' : ''}. Solo presentamos como hecho lo que confirman fuentes fiables; el resto se atribuye.`,
    and: 'y',
    units: { deaths: 'Fallecidos', injured: 'Heridos', missing: 'Desaparecidos', evacuated: 'Evacuados', arrested: 'Detenidos', people: 'Personas', homes: 'Viviendas', jobs: 'Empleos', votes: 'Votos', seats: 'Escaños', magnitude: 'Magnitud', km: 'Kilómetros', celsius: 'Temperatura (°C)', percent: 'Porcentaje', vehicles: 'Vehículos', flights: 'Vuelos', hectares: 'Hectáreas', years_old: 'Edad', percentage_points: 'Puntos porcentuales', currency: 'Importe' },
    fieldNames: { number: 'las cifras', date: 'la fecha', place: 'el lugar', quote: 'la autoría de una cita', denial: 'los hechos (hay un desmentido)' },
    quoteIntro: (s) => `${s} declaró:`,
    earthquake: {
      headline: (m, p) => `Terremoto de magnitud ${m} ${p}`,
      lead: (a, t, m, p, d) => `${a} registró a las ${t} un terremoto de magnitud ${m} ${p}, a una profundidad de ${d} km.`,
      tsunami: 'El organismo emitió un indicador de posible tsunami.',
    },
    near: (p) => `cerca de ${p}`,
    timelineItem: (s) => `Publica ${s}`,
  },
  en: {
    according: (c, s) => `${c}, according to ${s}.`,
    reports: (s, c) => `${s} reports that ${c}`,
    confirmedBy: (n, l) => (n === 1 ? `Confirmed by ${l}.` : `Confirmed by ${n} independent sources: ${l}.`),
    confirmedByMany: (n, l) => `Confirmed by ${n} independent sources, including ${l}.`,
    singleSource: (s) => `So far only ${s} has reported this; Histor has not been able to confirm it independently.`,
    developingNote: 'This is a developing story. Each detail is attributed to the source that reported it.',
    willUpdate: 'Histor will keep updating this story.',
    headings: { known: 'What we know', figures: 'Key figures', unconfirmed: 'What is not yet confirmed', next: 'What could happen next', discrepancies: 'Where sources disagree', timeline: 'Timeline' },
    unconfirmedSuffix: 'This could not be independently confirmed.',
    discrepancy: (f, p) => `Sources disagree on ${f}: ${p}.`,
    figureSource: (s) => `(according to ${s})`,
    method: (n, p) =>
      `This story was checked against ${n} independent source${n === 1 ? '' : 's'}${p ? ', including a primary official source' : ''}. We only present as fact what reliable sources confirm; everything else is attributed.`,
    and: 'and',
    units: { deaths: 'Deaths', injured: 'Injured', missing: 'Missing', evacuated: 'Evacuated', arrested: 'Arrested', people: 'People', homes: 'Homes', jobs: 'Jobs', votes: 'Votes', seats: 'Seats', magnitude: 'Magnitude', km: 'Kilometres', celsius: 'Temperature (°C)', percent: 'Percentage', vehicles: 'Vehicles', flights: 'Flights', hectares: 'Hectares', years_old: 'Age', percentage_points: 'Percentage points', currency: 'Amount' },
    fieldNames: { number: 'the figures', date: 'the date', place: 'the location', quote: 'who said a quote', denial: 'the facts (there is a denial)' },
    quoteIntro: (s) => `${s} said:`,
    earthquake: {
      headline: (m, p) => `Magnitude ${m} earthquake ${p}`,
      lead: (a, t, m, p, d) => `${a} recorded a magnitude ${m} earthquake ${p} at ${t}, at a depth of ${d} km.`,
      tsunami: 'The agency flagged a possible tsunami.',
    },
    near: (p) => `near ${p}`,
    timelineItem: (s) => `Reported by ${s}`,
  },
  de: {
    according: (c, s) => `${c}, berichtet ${s}.`,
    reports: (s, c) => `${s} berichtet: ${c}`,
    confirmedBy: (n, l) => (n === 1 ? `Bestätigt von ${l}.` : `Bestätigt von ${n} unabhängigen Quellen: ${l}.`),
    confirmedByMany: (n, l) => `Bestätigt von ${n} unabhängigen Quellen, darunter ${l}.`,
    singleSource: (s) => `Bislang hat nur ${s} darüber berichtet; Histor konnte es nicht unabhängig bestätigen.`,
    developingNote: 'Die Lage entwickelt sich. Jede Angabe wird der Quelle zugeordnet, die sie veröffentlicht hat.',
    willUpdate: 'Histor aktualisiert diesen Bericht fortlaufend.',
    headings: { known: 'Was bekannt ist', figures: 'Zahlen und Fakten', unconfirmed: 'Was noch nicht bestätigt ist', next: 'Wie es weitergehen könnte', discrepancies: 'Widersprüche zwischen Quellen', timeline: 'Chronologie' },
    unconfirmedSuffix: 'Dies konnte nicht unabhängig bestätigt werden.',
    discrepancy: (f, p) => `Die Quellen widersprechen sich bei ${f}: ${p}.`,
    figureSource: (s) => `(laut ${s})`,
    method: (n, p) =>
      `Dieser Bericht wurde mit ${n} unabhängigen Quelle${n === 1 ? '' : 'n'} abgeglichen${p ? ', darunter eine amtliche Primärquelle' : ''}. Als Tatsache stellen wir nur dar, was verlässliche Quellen bestätigen; alles andere wird zugeordnet.`,
    and: 'und',
    units: { deaths: 'Todesopfer', injured: 'Verletzte', missing: 'Vermisste', evacuated: 'Evakuierte', arrested: 'Festnahmen', people: 'Personen', homes: 'Wohnungen', jobs: 'Arbeitsplätze', votes: 'Stimmen', seats: 'Sitze', magnitude: 'Stärke', km: 'Kilometer', celsius: 'Temperatur (°C)', percent: 'Prozent', vehicles: 'Fahrzeuge', flights: 'Flüge', hectares: 'Hektar', years_old: 'Alter', percentage_points: 'Prozentpunkte', currency: 'Betrag' },
    fieldNames: { number: 'den Zahlen', date: 'dem Datum', place: 'dem Ort', quote: 'der Urheberschaft eines Zitats', denial: 'den Fakten (es gibt ein Dementi)' },
    quoteIntro: (s) => `${s} sagte:`,
    earthquake: {
      headline: (m, p) => `Erdbeben der Stärke ${m} ${p}`,
      lead: (a, t, m, p, d) => `${a} registrierte um ${t} ein Erdbeben der Stärke ${m} ${p} in ${d} km Tiefe.`,
      tsunami: 'Die Behörde gab einen möglichen Tsunami-Hinweis aus.',
    },
    near: (p) => `nahe ${p}`,
    timelineItem: (s) => `Bericht von ${s}`,
  },
  fr: {
    according: (c, s) => `${c}, selon ${s}.`,
    reports: (s, c) => `${s} rapporte que ${c}`,
    confirmedBy: (n, l) => (n === 1 ? `Confirmé par ${l}.` : `Confirmé par ${n} sources indépendantes : ${l}.`),
    confirmedByMany: (n, l) => `Confirmé par ${n} sources indépendantes, dont ${l}.`,
    singleSource: (s) => `Pour l'instant, seul ${s} l'a publié ; Histor n'a pas pu le confirmer de façon indépendante.`,
    developingNote: "Information en cours d'actualisation. Chaque élément est attribué à la source qui l'a publié.",
    willUpdate: 'Histor continuera de mettre à jour cette information.',
    headings: { known: 'Ce que l’on sait', figures: 'Chiffres clés', unconfirmed: 'Ce qui n’est pas encore confirmé', next: 'Ce qui pourrait suivre', discrepancies: 'Divergences entre les sources', timeline: 'Chronologie' },
    unconfirmedSuffix: "Cela n'a pas pu être confirmé de façon indépendante.",
    discrepancy: (f, p) => `Les sources divergent sur ${f} : ${p}.`,
    figureSource: (s) => `(selon ${s})`,
    method: (n, p) =>
      `Cette information a été recoupée avec ${n} source${n === 1 ? '' : 's'} indépendante${n === 1 ? '' : 's'}${p ? ', dont une source officielle primaire' : ''}. Nous ne présentons comme fait que ce que confirment des sources fiables ; le reste est attribué.`,
    and: 'et',
    units: { deaths: 'Morts', injured: 'Blessés', missing: 'Disparus', evacuated: 'Évacués', arrested: 'Interpellations', people: 'Personnes', homes: 'Logements', jobs: 'Emplois', votes: 'Voix', seats: 'Sièges', magnitude: 'Magnitude', km: 'Kilomètres', celsius: 'Température (°C)', percent: 'Pourcentage', vehicles: 'Véhicules', flights: 'Vols', hectares: 'Hectares', years_old: 'Âge', percentage_points: 'Points de pourcentage', currency: 'Montant' },
    fieldNames: { number: 'les chiffres', date: 'la date', place: 'le lieu', quote: "l'auteur d'une citation", denial: 'les faits (il existe un démenti)' },
    quoteIntro: (s) => `${s} a déclaré :`,
    earthquake: {
      headline: (m, p) => `Séisme de magnitude ${m} ${p}`,
      lead: (a, t, m, p, d) => `${a} a enregistré à ${t} un séisme de magnitude ${m} ${p}, à ${d} km de profondeur.`,
      tsunami: "L'organisme a signalé un possible tsunami.",
    },
    near: (p) => `près de ${p}`,
    timelineItem: (s) => `Publié par ${s}`,
  },
  it: {
    according: (c, s) => `${c}, secondo ${s}.`,
    reports: (s, c) => `${s} riferisce che ${c}`,
    confirmedBy: (n, l) => (n === 1 ? `Lo conferma ${l}.` : `Lo confermano ${n} fonti indipendenti: ${l}.`),
    confirmedByMany: (n, l) => `Lo confermano ${n} fonti indipendenti, tra cui ${l}.`,
    singleSource: (s) => `Finora solo ${s} ha dato la notizia; Histor non ha potuto confermarla in modo indipendente.`,
    developingNote: 'Notizia in aggiornamento. Ogni dato è attribuito alla fonte che lo ha pubblicato.',
    willUpdate: 'Histor continuerà ad aggiornare questa notizia.',
    headings: { known: 'Cosa sappiamo', figures: 'I numeri', unconfirmed: 'Cosa non è ancora confermato', next: 'Cosa potrebbe succedere', discrepancies: 'Discrepanze tra le fonti', timeline: 'Cronologia' },
    unconfirmedSuffix: 'Non è stato possibile confermarlo in modo indipendente.',
    discrepancy: (f, p) => `Le fonti non concordano su ${f}: ${p}.`,
    figureSource: (s) => `(secondo ${s})`,
    method: (n, p) =>
      `Questa notizia è stata verificata con ${n} font${n === 1 ? 'e' : 'i'} indipendent${n === 1 ? 'e' : 'i'}${p ? ', tra cui una fonte ufficiale primaria' : ''}. Presentiamo come fatto solo ciò che confermano fonti affidabili; il resto viene attribuito.`,
    and: 'e',
    units: { deaths: 'Morti', injured: 'Feriti', missing: 'Dispersi', evacuated: 'Evacuati', arrested: 'Arresti', people: 'Persone', homes: 'Abitazioni', jobs: 'Posti di lavoro', votes: 'Voti', seats: 'Seggi', magnitude: 'Magnitudo', km: 'Chilometri', celsius: 'Temperatura (°C)', percent: 'Percentuale', vehicles: 'Veicoli', flights: 'Voli', hectares: 'Ettari', years_old: 'Età', percentage_points: 'Punti percentuali', currency: 'Importo' },
    fieldNames: { number: 'i numeri', date: 'la data', place: 'il luogo', quote: "l'autore di una citazione", denial: 'i fatti (c’è una smentita)' },
    quoteIntro: (s) => `${s} ha dichiarato:`,
    earthquake: {
      headline: (m, p) => `Terremoto di magnitudo ${m} ${p}`,
      lead: (a, t, m, p, d) => `${a} ha registrato alle ${t} un terremoto di magnitudo ${m} ${p}, a una profondità di ${d} km.`,
      tsunami: "L'ente ha segnalato un possibile tsunami.",
    },
    near: (p) => `vicino a ${p}`,
    timelineItem: (s) => `Pubblica ${s}`,
  },
  pt: {
    according: (c, s) => `${c}, segundo ${s}.`,
    reports: (s, c) => `${s} informa que ${c}`,
    confirmedBy: (n, l) => (n === 1 ? `Confirmado por ${l}.` : `Confirmado por ${n} fontes independentes: ${l}.`),
    confirmedByMany: (n, l) => `Confirmado por ${n} fontes independentes, entre elas ${l}.`,
    singleSource: (s) => `Até agora, apenas ${s} publicou a informação; o Histor não conseguiu confirmá-la de forma independente.`,
    developingNote: 'Informação em atualização. Cada dado é atribuído à fonte que o publicou.',
    willUpdate: 'O Histor continuará atualizando esta informação.',
    headings: { known: 'O que se sabe', figures: 'Números', unconfirmed: 'O que ainda não está confirmado', next: 'O que pode acontecer agora', discrepancies: 'Divergências entre fontes', timeline: 'Cronologia' },
    unconfirmedSuffix: 'Não foi possível confirmar de forma independente.',
    discrepancy: (f, p) => `As fontes divergem sobre ${f}: ${p}.`,
    figureSource: (s) => `(segundo ${s})`,
    method: (n, p) =>
      `Esta informação foi checada com ${n} fonte${n === 1 ? '' : 's'} independente${n === 1 ? '' : 's'}${p ? ', incluindo uma fonte oficial primária' : ''}. Só apresentamos como fato o que fontes confiáveis confirmam; o resto é atribuído.`,
    and: 'e',
    units: { deaths: 'Mortos', injured: 'Feridos', missing: 'Desaparecidos', evacuated: 'Evacuados', arrested: 'Detidos', people: 'Pessoas', homes: 'Moradias', jobs: 'Empregos', votes: 'Votos', seats: 'Cadeiras', magnitude: 'Magnitude', km: 'Quilômetros', celsius: 'Temperatura (°C)', percent: 'Percentual', vehicles: 'Veículos', flights: 'Voos', hectares: 'Hectares', years_old: 'Idade', percentage_points: 'Pontos percentuais', currency: 'Valor' },
    fieldNames: { number: 'os números', date: 'a data', place: 'o local', quote: 'a autoria de uma citação', denial: 'os fatos (há um desmentido)' },
    quoteIntro: (s) => `${s} declarou:`,
    earthquake: {
      headline: (m, p) => `Terremoto de magnitude ${m} ${p}`,
      lead: (a, t, m, p, d) => `${a} registrou às ${t} um terremoto de magnitude ${m} ${p}, a ${d} km de profundidade.`,
      tsunami: 'O órgão emitiu um alerta de possível tsunami.',
    },
    near: (p) => `perto de ${p}`,
    timelineItem: (s) => `Publica ${s}`,
  },
};
