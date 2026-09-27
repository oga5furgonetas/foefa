import { slugify } from '../text/normalize';

export type RegionDef = {
  code: string; // ISO 3166-2
  countryCode: string;
  names: Record<string, string>;
  slugs: Record<string, string>;
  aliases: string[];
};

type R = [code: string, local: string, translations?: Partial<Record<'es' | 'en' | 'de' | 'fr' | 'it' | 'pt', string>>, aliases?: string[]];

const LANGS = ['es', 'en', 'de', 'fr', 'it', 'pt'] as const;

const ES: R[] = [
  ['ES-AN', 'Andalucía', { en: 'Andalusia', de: 'Andalusien', fr: 'Andalousie', it: 'Andalusia', pt: 'Andaluzia' }],
  ['ES-AR', 'Aragón', { pt: 'Aragão' }],
  ['ES-AS', 'Asturias', {}],
  ['ES-IB', 'Illes Balears', { es: 'Islas Baleares', en: 'Balearic Islands', de: 'Balearen', fr: 'Îles Baléares', it: 'Isole Baleari', pt: 'Ilhas Baleares' }, ['Baleares', 'Mallorca']],
  ['ES-CN', 'Canarias', { en: 'Canary Islands', de: 'Kanarische Inseln', fr: 'Îles Canaries', it: 'Isole Canarie', pt: 'Canárias' }, ['Islas Canarias']],
  ['ES-CB', 'Cantabria', { fr: 'Cantabrie' }],
  ['ES-CL', 'Castilla y León', { en: 'Castile and León', de: 'Kastilien und León', fr: 'Castille-et-León', it: 'Castiglia e León', pt: 'Castela e Leão' }],
  ['ES-CM', 'Castilla-La Mancha', { en: 'Castilla–La Mancha', de: 'Kastilien-La Mancha', fr: 'Castille-La Manche', it: 'Castiglia-La Mancia', pt: 'Castela-Mancha' }],
  ['ES-CT', 'Cataluña', { en: 'Catalonia', de: 'Katalonien', fr: 'Catalogne', it: 'Catalogna', pt: 'Catalunha' }, ['Catalunya']],
  ['ES-EX', 'Extremadura', { fr: 'Estrémadure' }],
  ['ES-GA', 'Galicia', { de: 'Galicien', fr: 'Galice', it: 'Galizia', pt: 'Galiza' }, ['Galiza']],
  ['ES-MD', 'Comunidad de Madrid', { en: 'Community of Madrid', de: 'Autonome Gemeinschaft Madrid', fr: 'Communauté de Madrid', it: 'Comunità di Madrid', pt: 'Comunidade de Madrid' }],
  ['ES-MC', 'Región de Murcia', { en: 'Region of Murcia', de: 'Region Murcia', fr: 'Région de Murcie', it: 'Regione di Murcia', pt: 'Região de Múrcia' }],
  ['ES-NC', 'Navarra', { en: 'Navarre', de: 'Navarra', fr: 'Navarre', pt: 'Navarra' }, ['Nafarroa']],
  ['ES-PV', 'País Vasco', { en: 'Basque Country', de: 'Baskenland', fr: 'Pays basque', it: 'Paesi Baschi', pt: 'País Basco' }, ['Euskadi']],
  ['ES-RI', 'La Rioja', {}],
  ['ES-VC', 'Comunitat Valenciana', { es: 'Comunidad Valenciana', en: 'Valencian Community', de: 'Valencianische Gemeinschaft', fr: 'Communauté valencienne', it: 'Comunità Valenzana', pt: 'Comunidade Valenciana' }],
  ['ES-CE', 'Ceuta', {}],
  ['ES-ML', 'Melilla', {}],
];

const US: R[] = [
  ['US-AL', 'Alabama'], ['US-AK', 'Alaska'], ['US-AZ', 'Arizona'], ['US-AR', 'Arkansas', { es: 'Arkansas' }],
  ['US-CA', 'California', { de: 'Kalifornien', fr: 'Californie', pt: 'Califórnia' }], ['US-CO', 'Colorado'],
  ['US-CT', 'Connecticut'], ['US-DE', 'Delaware'], ['US-DC', 'District of Columbia', { es: 'Distrito de Columbia', de: 'District of Columbia', fr: 'District de Columbia', it: 'Distretto di Columbia', pt: 'Distrito de Colúmbia' }, ['Washington, D.C.', 'Washington DC']],
  ['US-FL', 'Florida', { fr: 'Floride', pt: 'Flórida' }], ['US-GA', 'Georgia', { fr: 'Géorgie', pt: 'Geórgia' }],
  ['US-HI', 'Hawaii', { es: 'Hawái', fr: 'Hawaï', pt: 'Havaí' }], ['US-ID', 'Idaho'], ['US-IL', 'Illinois'], ['US-IN', 'Indiana'],
  ['US-IA', 'Iowa'], ['US-KS', 'Kansas'], ['US-KY', 'Kentucky'], ['US-LA', 'Louisiana', { es: 'Luisiana', fr: 'Louisiane', pt: 'Luisiana' }],
  ['US-ME', 'Maine'], ['US-MD', 'Maryland'], ['US-MA', 'Massachusetts'], ['US-MI', 'Michigan'], ['US-MN', 'Minnesota'],
  ['US-MS', 'Mississippi', { es: 'Misisipi' }], ['US-MO', 'Missouri', { es: 'Misuri' }], ['US-MT', 'Montana'], ['US-NE', 'Nebraska'],
  ['US-NV', 'Nevada'], ['US-NH', 'New Hampshire', { es: 'Nuevo Hampshire' }], ['US-NJ', 'New Jersey', { es: 'Nueva Jersey' }],
  ['US-NM', 'New Mexico', { es: 'Nuevo México', de: 'New Mexico', fr: 'Nouveau-Mexique', it: 'Nuovo Messico', pt: 'Novo México' }],
  ['US-NY', 'New York State', { es: 'Estado de Nueva York', de: 'Bundesstaat New York', fr: 'État de New York', it: 'Stato di New York', pt: 'Estado de Nova York' }],
  ['US-NC', 'North Carolina', { es: 'Carolina del Norte', de: 'North Carolina', fr: 'Caroline du Nord', it: 'Carolina del Nord', pt: 'Carolina do Norte' }],
  ['US-ND', 'North Dakota', { es: 'Dakota del Norte', fr: 'Dakota du Nord', it: 'Dakota del Nord', pt: 'Dakota do Norte' }],
  ['US-OH', 'Ohio'], ['US-OK', 'Oklahoma'], ['US-OR', 'Oregon', { es: 'Oregón' }], ['US-PA', 'Pennsylvania', { es: 'Pensilvania', fr: 'Pennsylvanie', it: 'Pennsylvania', pt: 'Pensilvânia' }],
  ['US-RI', 'Rhode Island'], ['US-SC', 'South Carolina', { es: 'Carolina del Sur', fr: 'Caroline du Sud', it: 'Carolina del Sud', pt: 'Carolina do Sul' }],
  ['US-SD', 'South Dakota', { es: 'Dakota del Sur', fr: 'Dakota du Sud', it: 'Dakota del Sud', pt: 'Dakota do Sul' }],
  ['US-TN', 'Tennessee'], ['US-TX', 'Texas'], ['US-UT', 'Utah'], ['US-VT', 'Vermont'], ['US-VA', 'Virginia', { fr: 'Virginie', pt: 'Virgínia' }],
  ['US-WA', 'Washington State', { es: 'Estado de Washington', de: 'Bundesstaat Washington', fr: 'État de Washington', it: 'Stato di Washington', pt: 'Estado de Washington' }],
  ['US-WV', 'West Virginia', { es: 'Virginia Occidental', fr: 'Virginie-Occidentale', it: 'Virginia Occidentale', pt: 'Virgínia Ocidental' }],
  ['US-WI', 'Wisconsin'], ['US-WY', 'Wyoming'],
];

const DE: R[] = [
  ['DE-BW', 'Baden-Württemberg'],
  ['DE-BY', 'Bayern', { es: 'Baviera', en: 'Bavaria', fr: 'Bavière', it: 'Baviera', pt: 'Baviera' }],
  ['DE-BE', 'Berlin', { es: 'Berlín', it: 'Berlino', pt: 'Berlim' }],
  ['DE-BB', 'Brandenburg', { es: 'Brandeburgo', fr: 'Brandebourg', it: 'Brandeburgo', pt: 'Brandemburgo' }],
  ['DE-HB', 'Bremen', { fr: 'Brême', it: 'Brema' }],
  ['DE-HH', 'Hamburg', { es: 'Hamburgo', fr: 'Hambourg', it: 'Amburgo', pt: 'Hamburgo' }],
  ['DE-HE', 'Hessen', { es: 'Hesse', en: 'Hesse', fr: 'Hesse', it: 'Assia', pt: 'Hesse' }],
  ['DE-MV', 'Mecklenburg-Vorpommern', { es: 'Mecklemburgo-Pomerania Occidental', en: 'Mecklenburg-Western Pomerania', fr: 'Mecklembourg-Poméranie-Occidentale', it: 'Meclemburgo-Pomerania Anteriore', pt: 'Meclemburgo-Pomerânia Ocidental' }],
  ['DE-NI', 'Niedersachsen', { es: 'Baja Sajonia', en: 'Lower Saxony', fr: 'Basse-Saxe', it: 'Bassa Sassonia', pt: 'Baixa Saxônia' }],
  ['DE-NW', 'Nordrhein-Westfalen', { es: 'Renania del Norte-Westfalia', en: 'North Rhine-Westphalia', fr: 'Rhénanie-du-Nord-Westphalie', it: 'Renania Settentrionale-Vestfalia', pt: 'Renânia do Norte-Vestfália' }, ['NRW']],
  ['DE-RP', 'Rheinland-Pfalz', { es: 'Renania-Palatinado', en: 'Rhineland-Palatinate', fr: 'Rhénanie-Palatinat', it: 'Renania-Palatinato', pt: 'Renânia-Palatinado' }],
  ['DE-SL', 'Saarland', { es: 'Sarre', fr: 'Sarre', it: 'Saarland', pt: 'Sarre' }],
  ['DE-SN', 'Sachsen', { es: 'Sajonia', en: 'Saxony', fr: 'Saxe', it: 'Sassonia', pt: 'Saxônia' }],
  ['DE-ST', 'Sachsen-Anhalt', { es: 'Sajonia-Anhalt', en: 'Saxony-Anhalt', fr: 'Saxe-Anhalt', it: 'Sassonia-Anhalt', pt: 'Saxônia-Anhalt' }],
  ['DE-SH', 'Schleswig-Holstein', { es: 'Schleswig-Holstein' }],
  ['DE-TH', 'Thüringen', { es: 'Turingia', en: 'Thuringia', fr: 'Thuringe', it: 'Turingia', pt: 'Turíngia' }],
];

const FR: R[] = [
  ['FR-ARA', 'Auvergne-Rhône-Alpes'], ['FR-BFC', 'Bourgogne-Franche-Comté', { es: 'Borgoña-Franco Condado', en: 'Burgundy-Franche-Comté', it: 'Borgogna-Franca Contea', pt: 'Borgonha-Franco-Condado' }],
  ['FR-BRE', 'Bretagne', { es: 'Bretaña', en: 'Brittany', it: 'Bretagna', pt: 'Bretanha' }], ['FR-CVL', 'Centre-Val de Loire', { es: 'Centro-Valle de Loira', it: 'Centro-Valle della Loira', pt: 'Centro-Vale do Loire' }],
  ['FR-COR', 'Corse', { es: 'Córcega', en: 'Corsica', de: 'Korsika', it: 'Corsica', pt: 'Córsega' }], ['FR-GES', 'Grand Est'],
  ['FR-HDF', 'Hauts-de-France'], ['FR-IDF', 'Île-de-France', { es: 'Isla de Francia' }], ['FR-NOR', 'Normandie', { es: 'Normandía', en: 'Normandy', it: 'Normandia', pt: 'Normandia' }],
  ['FR-NAQ', 'Nouvelle-Aquitaine', { es: 'Nueva Aquitania', en: 'New Aquitaine', it: 'Nuova Aquitania', pt: 'Nova Aquitânia' }], ['FR-OCC', 'Occitanie', { es: 'Occitania', en: 'Occitania', it: 'Occitania', pt: 'Occitânia' }],
  ['FR-PDL', 'Pays de la Loire', { es: 'Países del Loira', it: 'Paesi della Loira', pt: 'País do Loire' }], ['FR-PAC', "Provence-Alpes-Côte d'Azur", { es: 'Provenza-Alpes-Costa Azul', it: "Provenza-Alpi-Costa Azzurra", pt: 'Provença-Alpes-Costa Azul' }],
];

const GB: R[] = [
  ['GB-ENG', 'England', { es: 'Inglaterra', fr: 'Angleterre', it: 'Inghilterra', pt: 'Inglaterra' }],
  ['GB-SCT', 'Scotland', { es: 'Escocia', de: 'Schottland', fr: 'Écosse', it: 'Scozia', pt: 'Escócia' }],
  ['GB-WLS', 'Wales', { es: 'Gales', fr: 'Pays de Galles', it: 'Galles', pt: 'País de Gales' }],
  ['GB-NIR', 'Northern Ireland', { es: 'Irlanda del Norte', de: 'Nordirland', fr: 'Irlande du Nord', it: 'Irlanda del Nord', pt: 'Irlanda do Norte' }],
];

const IT: R[] = [
  ['IT-65', 'Abruzzo'], ['IT-77', 'Basilicata'], ['IT-78', 'Calabria'], ['IT-72', 'Campania'], ['IT-45', 'Emilia-Romagna'],
  ['IT-36', 'Friuli-Venezia Giulia'], ['IT-62', 'Lazio', { es: 'Lacio', fr: 'Latium', de: 'Latium', pt: 'Lácio' }], ['IT-42', 'Liguria', { fr: 'Ligurie', de: 'Ligurien' }],
  ['IT-25', 'Lombardia', { es: 'Lombardía', en: 'Lombardy', de: 'Lombardei', fr: 'Lombardie', pt: 'Lombardia' }], ['IT-57', 'Marche'], ['IT-67', 'Molise'],
  ['IT-21', 'Piemonte', { es: 'Piamonte', en: 'Piedmont', de: 'Piemont', fr: 'Piémont', pt: 'Piemonte' }], ['IT-75', 'Puglia', { es: 'Apulia', en: 'Apulia', de: 'Apulien', fr: 'Pouilles', pt: 'Apúlia' }],
  ['IT-88', 'Sardegna', { es: 'Cerdeña', en: 'Sardinia', de: 'Sardinien', fr: 'Sardaigne', pt: 'Sardenha' }], ['IT-82', 'Sicilia', { en: 'Sicily', de: 'Sizilien', fr: 'Sicile', pt: 'Sicília' }],
  ['IT-52', 'Toscana', { en: 'Tuscany', de: 'Toskana', fr: 'Toscane' }], ['IT-32', 'Trentino-Alto Adige', { de: 'Trentino-Südtirol' }], ['IT-55', 'Umbria', { fr: 'Ombrie', de: 'Umbrien' }],
  ['IT-23', "Valle d'Aosta", { es: 'Valle de Aosta', en: 'Aosta Valley', de: 'Aostatal', fr: "Vallée d'Aoste", pt: 'Vale de Aosta' }], ['IT-34', 'Veneto', { fr: 'Vénétie', de: 'Venetien' }],
];

function build(country: string, rows: R[]): RegionDef[] {
  return rows.map(([code, local, tr, aliases]) => {
    const names: Record<string, string> = {};
    const slugs: Record<string, string> = {};
    for (const l of LANGS) {
      names[l] = tr?.[l] ?? local;
      slugs[l] = slugify(names[l]);
    }
    return { code, countryCode: country, names, slugs, aliases: [local, ...(aliases ?? [])] };
  });
}

export const REGIONS: RegionDef[] = [
  ...build('ES', ES),
  ...build('US', US),
  ...build('DE', DE),
  ...build('FR', FR),
  ...build('GB', GB),
  ...build('IT', IT),
];

export function regionByCode(code: string): RegionDef | undefined {
  return REGIONS.find((r) => r.code === code);
}
