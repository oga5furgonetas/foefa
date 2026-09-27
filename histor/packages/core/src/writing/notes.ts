/** Textos públicos de actualizaciones, correcciones y retiradas, por idioma. */

type Notes = {
  retraction: (reason: string) => string;
  retractionReasonDenial: string;
  retractionReasonConfidence: string;
  updateNewSources: (names: string) => string;
  updateFigure: (label: string, from: string, to: string) => string;
  updateNewFacts: string;
  updateStatusVerified: string;
  updateGeneric: string;
  underReview: string;
};

export const NOTES: Record<string, Notes> = {
  es: {
    retraction: (r) => `Histor ha retirado esta información: ${r}. Mantenemos el texto original visible, marcado como retirado, por transparencia.`,
    retractionReasonDenial: 'una fuente oficial primaria la ha desmentido y la confianza en ella ha caído por debajo de nuestro umbral',
    retractionReasonConfidence: 'las nuevas fuentes la contradicen',
    updateNewSources: (n) => `Nuevas fuentes: ${n}.`,
    updateFigure: (l, a, b) => `Actualizado el dato «${l}»: de ${a} a ${b}.`,
    updateNewFacts: 'Se añaden datos confirmados.',
    updateStatusVerified: 'La información ya está confirmada por fuentes independientes.',
    updateGeneric: 'Texto actualizado con la información más reciente.',
    underReview: 'Esta información está en revisión: han aparecido datos que la contradicen.',
  },
  en: {
    retraction: (r) => `Histor has retracted this story: ${r}. The original text remains visible, marked as retracted, for transparency.`,
    retractionReasonDenial: 'a primary official source has denied it and our confidence in it has fallen below our threshold',
    retractionReasonConfidence: 'new sources contradict it',
    updateNewSources: (n) => `New sources: ${n}.`,
    updateFigure: (l, a, b) => `Updated “${l}”: from ${a} to ${b}.`,
    updateNewFacts: 'New confirmed details added.',
    updateStatusVerified: 'The information is now confirmed by independent sources.',
    updateGeneric: 'Updated with the latest information.',
    underReview: 'This story is under review: new information contradicts it.',
  },
  de: {
    retraction: (r) => `Histor hat diesen Bericht zurückgezogen: ${r}. Der ursprüngliche Text bleibt aus Transparenzgründen sichtbar und ist als zurückgezogen markiert.`,
    retractionReasonDenial: 'eine amtliche Primärquelle hat ihn dementiert und unser Vertrauen ist unter die Schwelle gefallen',
    retractionReasonConfidence: 'neue Quellen widersprechen ihm',
    updateNewSources: (n) => `Neue Quellen: ${n}.`,
    updateFigure: (l, a, b) => `Aktualisiert „${l}“: von ${a} auf ${b}.`,
    updateNewFacts: 'Neue bestätigte Angaben ergänzt.',
    updateStatusVerified: 'Die Angaben sind jetzt von unabhängigen Quellen bestätigt.',
    updateGeneric: 'Mit den neuesten Informationen aktualisiert.',
    underReview: 'Dieser Bericht wird überprüft: neue Angaben widersprechen ihm.',
  },
  fr: {
    retraction: (r) => `Histor a retiré cette information : ${r}. Le texte original reste visible, marqué comme retiré, par souci de transparence.`,
    retractionReasonDenial: "une source officielle primaire l'a démentie et notre confiance est tombée sous notre seuil",
    retractionReasonConfidence: 'de nouvelles sources la contredisent',
    updateNewSources: (n) => `Nouvelles sources : ${n}.`,
    updateFigure: (l, a, b) => `Mise à jour « ${l} » : de ${a} à ${b}.`,
    updateNewFacts: 'Nouveaux éléments confirmés ajoutés.',
    updateStatusVerified: "L'information est désormais confirmée par des sources indépendantes.",
    updateGeneric: 'Mis à jour avec les dernières informations.',
    underReview: "Cette information est en cours de vérification : de nouveaux éléments la contredisent.",
  },
  it: {
    retraction: (r) => `Histor ha ritirato questa notizia: ${r}. Il testo originale resta visibile, segnalato come ritirato, per trasparenza.`,
    retractionReasonDenial: "una fonte ufficiale primaria l'ha smentita e la nostra fiducia è scesa sotto la soglia",
    retractionReasonConfidence: 'nuove fonti la contraddicono',
    updateNewSources: (n) => `Nuove fonti: ${n}.`,
    updateFigure: (l, a, b) => `Aggiornato «${l}»: da ${a} a ${b}.`,
    updateNewFacts: 'Aggiunti nuovi dati confermati.',
    updateStatusVerified: "L'informazione è ora confermata da fonti indipendenti.",
    updateGeneric: 'Aggiornato con le informazioni più recenti.',
    underReview: 'Questa notizia è in revisione: nuovi dati la contraddicono.',
  },
  pt: {
    retraction: (r) => `O Histor retirou esta informação: ${r}. O texto original continua visível, marcado como retirado, por transparência.`,
    retractionReasonDenial: 'uma fonte oficial primária a desmentiu e nossa confiança caiu abaixo do limite',
    retractionReasonConfidence: 'novas fontes a contradizem',
    updateNewSources: (n) => `Novas fontes: ${n}.`,
    updateFigure: (l, a, b) => `Atualizado “${l}”: de ${a} para ${b}.`,
    updateNewFacts: 'Novos dados confirmados adicionados.',
    updateStatusVerified: 'A informação agora está confirmada por fontes independentes.',
    updateGeneric: 'Atualizado com as informações mais recentes.',
    underReview: 'Esta informação está em revisão: novos dados a contradizem.',
  },
};

export function notesFor(lang: string): Notes {
  return NOTES[lang] ?? NOTES.en;
}
