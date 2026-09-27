import type { ClaimKind, ClaimStatus, Modality, SourceType, StoryFlag, StoryState } from '../domain';
import type { ExtractedDate } from '../text/dates';
import type { ExtractedNumber } from '../text/numbers';

/** Lo que el motor necesita saber de una fuente. */
export type VSource = {
  id: number;
  slug: string;
  name: string;
  sourceType: SourceType;
  ownershipGroup: string | null;
  isSatire: boolean;
  countryCode: string | null;
  /** Posterior Beta de acierto histórico. */
  reliability: { alpha: number; beta: number };
  homepageUrl: string;
  /**
   * Solo corrobora: boletines oficiales y alertas automáticas (BOE, GDACS, GOV.UK…)
   * publican cientos de piezas al día; sirven de prueba, pero una historia que solo
   * tiene fuentes así no se publica hasta que otra fuente independiente la recoge.
   */
  corroborateOnly?: boolean;
};

export type VPlace = { kind: 'country' | 'region' | 'city'; countryCode: string; regionCode: string | null; cityKey: string | null; name: string };

/** Una pieza (artículo, comunicado, publicación) ya normalizada. */
export type VItem = {
  id: number;
  sourceId: number;
  url: string;
  title: string;
  summary: string | null;
  text: string | null;
  language: string | null;
  publishedAt: Date | null;
  fetchedAt: Date;
  attributedTo: string | null;
  minhash: number[] | null;
  imageUrl: string | null;
  imagePhash?: string | null;
  places: VPlace[];
  /** Datos estructurados (API oficial): magnitud, profundidad… */
  structured?: Record<string, unknown> | null;
  /** El editor se reserva el uso (TDM o `ai-input=no`): la historia no pasa por la IA. */
  reserved?: boolean;
};

export type VClaim = {
  /** id temporal (índice) hasta que se guarda. */
  key: string;
  itemId: number;
  language: string;
  text: string;
  kind: ClaimKind;
  modality: Modality;
  attributedTo: string | null;
  entities: string[]; // claves de entidad plegadas
  entityNames: string[];
  numbers: ExtractedNumber[];
  dates: ExtractedDate[];
  places: string[]; // claves de lugar: country:ES, region:ES-GA, city:es-vigo
  quote: { text: string; speaker: string | null } | null;
  isHeadline: boolean;
};

export type VEvidence = {
  claimKey: string;
  itemId: number;
  sourceId: number;
  relation: 'supports' | 'contradicts' | 'mentions';
  score: number;
  independenceKey: string;
  isPrimary: boolean;
  matched: Record<string, unknown>;
  excerpt: string | null;
};

export type VContradiction = {
  field: 'number' | 'date' | 'place' | 'quote' | 'denial';
  severity: 'minor' | 'major' | 'critical';
  claimKeys: string[];
  detail: Record<string, unknown>;
};

export type IndependenceGroup = {
  key: string;
  itemIds: number[];
  sourceIds: number[];
  /** Mejor tipo de fuente del grupo (define su peso). */
  bestType: SourceType;
  weight: number;
  credible: boolean;
  /** Pieza más antigua del grupo: probable original. */
  originalItemId: number;
  isPrimary: boolean;
};

export type ClaimAssessment = {
  claimKey: string;
  status: ClaimStatus;
  supportScore: number;
  supportingGroups: string[];
  contradictingGroups: string[];
};

export type ConfidenceBreakdown = {
  sources: number;
  quality: number;
  primary: number;
  corroboration: number;
  documents: number;
  temporal: number;
  geo: number;
  factual: number;
  age: number;
  base: number;
  cap: number | null;
  capReason: string | null;
  independentCredible: number;
  independentTotal: number;
};

export type MomentumBreakdown = {
  velocity: number;
  sourceSpread: number;
  countrySpread: number;
  recency: number;
  readerInterest: number;
  itemsLastHour: number;
  itemsLast6h: number;
};

export type Decision = 'publish' | 'publish_developing' | 'hold' | 'reject' | 'update' | 'retract' | 'review' | 'none';

export type StoryAnalysis = {
  groups: IndependenceGroup[];
  itemGroup: Record<number, { key: string; isCopy: boolean; copyOf: number | null }>;
  claims: VClaim[];
  evidence: VEvidence[];
  contradictions: VContradiction[];
  assessments: ClaimAssessment[];
  flags: StoryFlag[];
  confidence: number;
  confidenceBreakdown: ConfidenceBreakdown;
  momentum: number;
  momentumBreakdown: MomentumBreakdown;
  decision: Decision;
  nextState: StoryState;
  /** La evidencia alcanza el nivel de «verificada» (umbral + fuentes independientes + hecho principal respaldado). */
  verifiedLevel: boolean;
  reasons: string[];
  probableOriginalItemId: number | null;
  eventTime: Date | null;
  primaryPlace: VPlace | null;
  isBreaking: boolean;
};
