import { slugify } from '../text/normalize';

export type CityDef = {
  key: string; // país-slug local, estable
  countryCode: string;
  regionCode: string | null;
  names: Record<string, string>;
  slugs: Record<string, string>;
  aliases: string[];
  lat: number;
  lon: number;
  /** Población aproximada (orden de magnitud; solo para priorizar). */
  population: number;
};

type C = [
  country: string,
  region: string | null,
  local: string,
  lat: number,
  lon: number,
  population: number,
  translations?: Partial<Record<'es' | 'en' | 'de' | 'fr' | 'it' | 'pt', string>>,
  aliases?: string[],
];

const LANGS = ['es', 'en', 'de', 'fr', 'it', 'pt'] as const;

const ROWS: C[] = [
  // España
  ['ES', 'ES-MD', 'Madrid', 40.4168, -3.7038, 3300000],
  ['ES', 'ES-CT', 'Barcelona', 41.3874, 2.1686, 1640000],
  ['ES', 'ES-VC', 'Valencia', 39.4699, -0.3763, 800000, { it: 'Valencia', fr: 'Valence' }, ['València']],
  ['ES', 'ES-AN', 'Sevilla', 37.3891, -5.9845, 685000, { en: 'Seville', de: 'Sevilla', fr: 'Séville', it: 'Siviglia', pt: 'Sevilha' }],
  ['ES', 'ES-AR', 'Zaragoza', 41.6488, -0.8891, 675000, { fr: 'Saragosse', it: 'Saragozza', pt: 'Saragoça' }],
  ['ES', 'ES-AN', 'Málaga', 36.7213, -4.4214, 580000],
  ['ES', 'ES-MC', 'Murcia', 37.9922, -1.1307, 460000, { fr: 'Murcie' }],
  ['ES', 'ES-IB', 'Palma', 39.5696, 2.6502, 420000, {}, ['Palma de Mallorca']],
  ['ES', 'ES-PV', 'Bilbao', 43.263, -2.935, 345000, {}, ['Bilbo']],
  ['ES', 'ES-GA', 'Vigo', 42.2406, -8.7207, 295000],
  ['ES', 'ES-GA', 'A Coruña', 43.3623, -8.4115, 247000, { es: 'A Coruña', en: 'A Coruña', fr: 'La Corogne', it: 'La Coruña', pt: 'Corunha' }, ['La Coruña', 'Coruña']],
  ['ES', 'ES-GA', 'Santiago de Compostela', 42.8782, -8.5448, 98000, {}, ['Santiago']],
  ['ES', 'ES-GA', 'Ourense', 42.3358, -7.8639, 105000, {}, ['Orense']],
  ['ES', 'ES-GA', 'Lugo', 43.0097, -7.556, 98000],
  ['ES', 'ES-GA', 'Pontevedra', 42.431, -8.6444, 83000],
  ['ES', 'ES-AS', 'Gijón', 43.5322, -5.6611, 270000, {}, ['Xixón']],
  ['ES', 'ES-AS', 'Oviedo', 43.3614, -5.8494, 220000, {}, ['Uviéu']],
  ['ES', 'ES-CL', 'Valladolid', 41.6523, -4.7245, 298000],
  ['ES', 'ES-CN', 'Las Palmas de Gran Canaria', 28.1235, -15.4363, 380000],
  ['ES', 'ES-CN', 'Santa Cruz de Tenerife', 28.4636, -16.2518, 209000],
  ['ES', 'ES-VC', 'Alicante', 38.3452, -0.481, 350000, {}, ['Alacant']],
  ['ES', 'ES-AN', 'Córdoba', 37.8882, -4.7794, 320000, { fr: 'Cordoue', it: 'Cordova', pt: 'Córdova' }],
  ['ES', 'ES-AN', 'Granada', 37.1773, -3.5986, 230000, { fr: 'Grenade' }],
  ['ES', 'ES-NC', 'Pamplona', 42.8125, -1.6458, 205000, { fr: 'Pampelune' }, ['Iruña']],
  ['ES', 'ES-PV', 'San Sebastián', 43.3183, -1.9812, 188000, { fr: 'Saint-Sébastien' }, ['Donostia']],
  // Estados Unidos
  ['US', 'US-NY', 'New York City', 40.7128, -74.006, 8300000, { es: 'Nueva York', de: 'New York City', fr: 'New York', it: 'New York', pt: 'Nova York' }, ['New York', 'NYC', 'Nueva York', 'Manhattan', 'Brooklyn']],
  ['US', 'US-CA', 'Los Angeles', 34.0522, -118.2437, 3800000, { es: 'Los Ángeles' }, ['L.A.']],
  ['US', 'US-IL', 'Chicago', 41.8781, -87.6298, 2700000],
  ['US', 'US-TX', 'Houston', 29.7604, -95.3698, 2300000],
  ['US', 'US-AZ', 'Phoenix', 33.4484, -112.074, 1650000],
  ['US', 'US-PA', 'Philadelphia', 39.9526, -75.1652, 1550000, { es: 'Filadelfia', fr: 'Philadelphie', it: 'Filadelfia', pt: 'Filadélfia' }],
  ['US', 'US-TX', 'San Antonio', 29.4241, -98.4936, 1450000],
  ['US', 'US-CA', 'San Diego', 32.7157, -117.1611, 1380000],
  ['US', 'US-TX', 'Dallas', 32.7767, -96.797, 1300000],
  ['US', 'US-CA', 'San Francisco', 37.7749, -122.4194, 810000],
  ['US', 'US-WA', 'Seattle', 47.6062, -122.3321, 750000],
  ['US', 'US-MA', 'Boston', 42.3601, -71.0589, 650000],
  ['US', 'US-FL', 'Miami', 25.7617, -80.1918, 450000],
  ['US', 'US-DC', 'Washington', 38.9072, -77.0369, 690000, { es: 'Washington', pt: 'Washington' }, ['Washington, D.C.', 'Washington DC']],
  ['US', 'US-GA', 'Atlanta', 33.749, -84.388, 500000],
  ['US', 'US-TX', 'Austin', 30.2672, -97.7431, 980000],
  ['US', 'US-CO', 'Denver', 39.7392, -104.9903, 715000],
  // Alemania
  ['DE', 'DE-BE', 'Berlin', 52.52, 13.405, 3700000, { es: 'Berlín', it: 'Berlino', pt: 'Berlim' }],
  ['DE', 'DE-HH', 'Hamburg', 53.5511, 9.9937, 1850000, { es: 'Hamburgo', fr: 'Hambourg', it: 'Amburgo', pt: 'Hamburgo' }],
  ['DE', 'DE-BY', 'München', 48.1351, 11.582, 1500000, { es: 'Múnich', en: 'Munich', fr: 'Munich', it: 'Monaco di Baviera', pt: 'Munique' }, ['Muenchen', 'Munich', 'Múnich']],
  ['DE', 'DE-NW', 'Köln', 50.9375, 6.9603, 1080000, { es: 'Colonia', en: 'Cologne', fr: 'Cologne', it: 'Colonia', pt: 'Colônia' }, ['Koeln', 'Cologne']],
  ['DE', 'DE-HE', 'Frankfurt am Main', 50.1109, 8.6821, 770000, { es: 'Fráncfort', en: 'Frankfurt', fr: 'Francfort', it: 'Francoforte', pt: 'Frankfurt' }, ['Frankfurt']],
  ['DE', 'DE-BW', 'Stuttgart', 48.7758, 9.1829, 630000, { es: 'Stuttgart', it: 'Stoccarda' }],
  ['DE', 'DE-NW', 'Düsseldorf', 51.2277, 6.7735, 620000, {}, ['Duesseldorf']],
  ['DE', 'DE-SN', 'Leipzig', 51.3397, 12.3731, 610000, { es: 'Leipzig', fr: 'Leipzig', it: 'Lipsia' }],
  ['DE', 'DE-SN', 'Dresden', 51.0504, 13.7373, 560000, { es: 'Dresde', fr: 'Dresde', it: 'Dresda', pt: 'Dresden' }],
  ['DE', 'DE-HB', 'Bremen', 53.0793, 8.8017, 570000, { fr: 'Brême', it: 'Brema' }],
  ['DE', 'DE-NI', 'Hannover', 52.3759, 9.732, 540000, { es: 'Hannover', en: 'Hanover', fr: 'Hanovre', it: 'Hannover', pt: 'Hanôver' }],
  ['DE', 'DE-BY', 'Nürnberg', 49.4521, 11.0767, 520000, { es: 'Núremberg', en: 'Nuremberg', fr: 'Nuremberg', it: 'Norimberga', pt: 'Nuremberga' }, ['Nuernberg']],
  // Francia
  ['FR', 'FR-IDF', 'Paris', 48.8566, 2.3522, 2100000, { es: 'París', it: 'Parigi', pt: 'Paris' }],
  ['FR', 'FR-PAC', 'Marseille', 43.2965, 5.3698, 870000, { es: 'Marsella', en: 'Marseille', it: 'Marsiglia', pt: 'Marselha' }],
  ['FR', 'FR-ARA', 'Lyon', 45.764, 4.8357, 520000, { es: 'Lyon', it: 'Lione', pt: 'Lyon' }],
  ['FR', 'FR-OCC', 'Toulouse', 43.6047, 1.4442, 500000, { es: 'Toulouse', it: 'Tolosa' }],
  ['FR', 'FR-PAC', 'Nice', 43.7102, 7.262, 340000, { es: 'Niza', it: 'Nizza', pt: 'Nice' }],
  ['FR', 'FR-PDL', 'Nantes', 47.2184, -1.5536, 320000],
  ['FR', 'FR-GES', 'Strasbourg', 48.5734, 7.7521, 290000, { es: 'Estrasburgo', en: 'Strasbourg', de: 'Straßburg', it: 'Strasburgo', pt: 'Estrasburgo' }],
  ['FR', 'FR-NAQ', 'Bordeaux', 44.8378, -0.5792, 260000, { es: 'Burdeos', it: 'Bordeaux', pt: 'Bordéus' }],
  ['FR', 'FR-HDF', 'Lille', 50.6292, 3.0573, 235000],
  // Reino Unido
  ['GB', 'GB-ENG', 'London', 51.5074, -0.1278, 8900000, { es: 'Londres', fr: 'Londres', it: 'Londra', pt: 'Londres' }],
  ['GB', 'GB-ENG', 'Birmingham', 52.4862, -1.8904, 1150000],
  ['GB', 'GB-ENG', 'Manchester', 53.4808, -2.2426, 550000, { es: 'Mánchester' }],
  ['GB', 'GB-ENG', 'Liverpool', 53.4084, -2.9916, 490000],
  ['GB', 'GB-SCT', 'Glasgow', 55.8642, -4.2518, 630000, { es: 'Glasgow' }],
  ['GB', 'GB-SCT', 'Edinburgh', 55.9533, -3.1883, 520000, { es: 'Edimburgo', de: 'Edinburgh', fr: 'Édimbourg', it: 'Edimburgo', pt: 'Edimburgo' }],
  ['GB', 'GB-WLS', 'Cardiff', 51.4816, -3.1791, 360000],
  ['GB', 'GB-NIR', 'Belfast', 54.5973, -5.9301, 345000],
  ['GB', 'GB-ENG', 'Leeds', 53.8008, -1.5491, 810000],
  ['GB', 'GB-ENG', 'Bristol', 51.4545, -2.5879, 470000],
  // Italia
  ['IT', 'IT-62', 'Roma', 41.9028, 12.4964, 2750000, { en: 'Rome', de: 'Rom', fr: 'Rome' }],
  ['IT', 'IT-25', 'Milano', 45.4642, 9.19, 1370000, { es: 'Milán', en: 'Milan', de: 'Mailand', fr: 'Milan', pt: 'Milão' }],
  ['IT', 'IT-72', 'Napoli', 40.8518, 14.2681, 910000, { es: 'Nápoles', en: 'Naples', de: 'Neapel', fr: 'Naples', pt: 'Nápoles' }],
  ['IT', 'IT-21', 'Torino', 45.0703, 7.6869, 850000, { es: 'Turín', en: 'Turin', de: 'Turin', fr: 'Turin', pt: 'Turim' }],
  ['IT', 'IT-82', 'Palermo', 38.1157, 13.3615, 630000],
  ['IT', 'IT-42', 'Genova', 44.4056, 8.9463, 560000, { es: 'Génova', en: 'Genoa', de: 'Genua', fr: 'Gênes', pt: 'Génova' }],
  ['IT', 'IT-45', 'Bologna', 44.4949, 11.3426, 390000, { es: 'Bolonia', de: 'Bologna', fr: 'Bologne', pt: 'Bolonha' }],
  ['IT', 'IT-52', 'Firenze', 43.7696, 11.2558, 360000, { es: 'Florencia', en: 'Florence', de: 'Florenz', fr: 'Florence', pt: 'Florença' }],
  ['IT', 'IT-34', 'Venezia', 45.4408, 12.3155, 255000, { es: 'Venecia', en: 'Venice', de: 'Venedig', fr: 'Venise', pt: 'Veneza' }],
  // Portugal
  ['PT', null, 'Lisboa', 38.7223, -9.1393, 545000, { en: 'Lisbon', de: 'Lissabon', fr: 'Lisbonne', it: 'Lisbona' }],
  ['PT', null, 'Porto', 41.1579, -8.6291, 232000, { es: 'Oporto', en: 'Porto', fr: 'Porto', it: 'Porto' }, ['Oporto']],
  // Latinoamérica
  ['MX', null, 'Ciudad de México', 19.4326, -99.1332, 9200000, { en: 'Mexico City', de: 'Mexiko-Stadt', fr: 'Mexico', it: 'Città del Messico', pt: 'Cidade do México' }, ['CDMX', 'México D. F.']],
  ['MX', null, 'Guadalajara', 20.6597, -103.3496, 1400000],
  ['MX', null, 'Monterrey', 25.6866, -100.3161, 1140000],
  ['AR', null, 'Buenos Aires', -34.6037, -58.3816, 3100000],
  ['AR', null, 'Córdoba (Argentina)', -31.4201, -64.1888, 1400000, { es: 'Córdoba (Argentina)' }],
  ['CO', null, 'Bogotá', 4.711, -74.0721, 7900000, { pt: 'Bogotá' }],
  ['CO', null, 'Medellín', 6.2442, -75.5812, 2500000],
  ['CL', null, 'Santiago de Chile', -33.4489, -70.6693, 6300000, {}, ['Santiago']],
  ['PE', null, 'Lima', -12.0464, -77.0428, 9700000],
  ['BR', null, 'São Paulo', -23.5505, -46.6333, 11400000, { es: 'São Paulo', fr: 'São Paulo' }, ['Sao Paulo', 'San Pablo']],
  ['BR', null, 'Rio de Janeiro', -22.9068, -43.1729, 6200000, { es: 'Río de Janeiro' }],
  ['BR', null, 'Brasília', -15.7939, -47.8828, 2800000, { es: 'Brasilia', en: 'Brasília' }, ['Brasilia']],
];

export const CITIES: CityDef[] = ROWS.map(([country, region, local, lat, lon, population, tr, aliases]) => {
  const names: Record<string, string> = {};
  const slugs: Record<string, string> = {};
  for (const l of LANGS) {
    names[l] = tr?.[l] ?? local;
    slugs[l] = slugify(names[l]);
  }
  return {
    key: `${country.toLowerCase()}-${slugify(local)}`,
    countryCode: country,
    regionCode: region,
    names,
    slugs,
    aliases: [local, ...(aliases ?? [])],
    lat,
    lon,
    population,
  };
});
