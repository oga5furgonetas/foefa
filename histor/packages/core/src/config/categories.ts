/**
 * Secciones del periódico. "Última hora", "Últimas", "Tendencias" y
 * "Local" no son categorías: son vistas (se calculan) y viven en routes.ts.
 *
 * keywords: vocabulario del clasificador determinista, ya "plegado"
 * (minúsculas y sin tildes). Un '*' final = prefijo ("elecci*" casa con
 * "elecciones"). Se amplía desde el panel (categorías → palabras clave).
 */
import { slugify } from '../text/normalize';

export type CategoryDef = {
  id: string;
  names: Record<string, string>;
  slugs: Record<string, string>;
  sort: number;
  isOpinion?: boolean;
  keywords: Record<string, string[]>;
};

type Names = [es: string, en: string, de: string, fr: string, it: string, pt: string];
const LANGS = ['es', 'en', 'de', 'fr', 'it', 'pt'] as const;

function def(id: string, sort: number, names: Names, keywords: Record<string, string[]>, extra: Partial<CategoryDef> = {}): CategoryDef {
  const n: Record<string, string> = {};
  const s: Record<string, string> = {};
  LANGS.forEach((l, i) => {
    n[l] = names[i];
    s[l] = slugify(names[i]);
  });
  return { id, sort, names: n, slugs: s, keywords, ...extra };
}

export const CATEGORIES: CategoryDef[] = [
  def('politics', 10, ['Política', 'Politics', 'Politik', 'Politique', 'Politica', 'Política'], {
    es: ['gobierno', 'ministr*', 'parlamento', 'congreso', 'senado', 'elecci*', 'electoral', 'partido', 'diputad*', 'presidente del gobierno', 'oposicion', 'votacion', 'ley', 'decreto', 'alcald*', 'coalicion', 'moncloa', 'campana electoral', 'escano*'],
    en: ['government', 'minister*', 'parliament', 'congress', 'senate', 'election*', 'electoral', 'party', 'lawmaker*', 'president', 'opposition', 'vote', 'bill', 'legislation', 'mayor', 'coalition', 'white house', 'campaign', 'governor', 'democrat*', 'republican*'],
    de: ['regierung', 'minister*', 'bundestag', 'parlament', 'wahl*', 'partei*', 'abgeordnet*', 'kanzler*', 'opposition', 'abstimmung', 'gesetz*', 'burgermeister*', 'koalition', 'bundesrat', 'landtag'],
    fr: ['gouvernement', 'ministr*', 'parlement', 'assemblee nationale', 'senat', 'election*', 'electoral', 'parti', 'depute*', 'president', 'opposition', 'vote', 'projet de loi', 'loi', 'maire', 'coalition', 'elysee', 'matignon'],
    it: ['governo', 'ministr*', 'parlamento', 'camera dei deputati', 'senato', 'elezion*', 'elettoral*', 'partito', 'deputat*', 'premier', 'opposizione', 'voto', 'legge', 'decreto', 'sindaco', 'coalizione', 'palazzo chigi'],
    pt: ['governo', 'ministr*', 'parlamento', 'congresso', 'senado', 'eleic*', 'eleitoral', 'partido', 'deputad*', 'presidente', 'oposicao', 'votacao', 'lei', 'decreto', 'prefeit*', 'coligacao', 'planalto', 'assembleia da republica'],
  }),
  def('economy', 20, ['Economía', 'Economy', 'Wirtschaft', 'Économie', 'Economia', 'Economia'], {
    es: ['economia', 'inflacion', 'pib', 'paro', 'desempleo', 'banco central', 'bce', 'tipos de interes', 'deficit', 'deuda publica', 'impuesto*', 'presupuesto*', 'salario*', 'pension*', 'ipc', 'recesion', 'crecimiento economico', 'bolsa', 'ibex', 'euribor'],
    en: ['economy', 'economic', 'inflation', 'gdp', 'unemployment', 'jobs report', 'federal reserve', 'central bank', 'interest rate*', 'deficit', 'debt', 'tax*', 'budget', 'wage*', 'pension*', 'recession', 'growth', 'stock market', 'dow jones', 's&p 500', 'nasdaq', 'treasury'],
    de: ['wirtschaft*', 'inflation', 'bip', 'bruttoinlandsprodukt', 'arbeitslos*', 'ezb', 'zentralbank', 'bundesbank', 'zins*', 'defizit', 'schulden', 'steuer*', 'haushalt', 'lohn*', 'rente*', 'rezession', 'wachstum', 'borse', 'dax'],
    fr: ['economi*', 'inflation', 'pib', 'chomage', 'bce', 'banque centrale', 'taux d interet', 'deficit', 'dette', 'impot*', 'budget', 'salaire*', 'retraite*', 'recession', 'croissance', 'bourse', 'cac 40', 'insee'],
    it: ['economia', 'inflazione', 'pil', 'disoccupazione', 'bce', 'banca centrale', 'tassi di interesse', 'deficit', 'debito pubblico', 'tasse', 'bilancio', 'salari*', 'pension*', 'recessione', 'crescita', 'borsa', 'ftse mib', 'istat', 'spread'],
    pt: ['economia', 'inflacao', 'pib', 'desemprego', 'banco central', 'taxa de juros', 'selic', 'deficit', 'divida publica', 'imposto*', 'orcamento', 'salario*', 'pensao', 'aposentadoria', 'recessao', 'crescimento', 'bolsa', 'ibovespa', 'ibge'],
  }),
  def('business', 30, ['Negocios', 'Business', 'Unternehmen', 'Entreprises', 'Imprese', 'Negócios'], {
    es: ['empresa*', 'beneficio*', 'resultados trimestrales', 'facturacion', 'adquisicion', 'fusion', 'consejero delegado', 'accionista*', 'startup*', 'despido*', 'ere', 'cotizada', 'salida a bolsa', 'ventas'],
    en: ['company', 'companies', 'earnings', 'revenue', 'profit*', 'acquisition', 'merger', 'ceo', 'shareholder*', 'startup*', 'layoff*', 'ipo', 'quarterly results', 'sales', 'retail'],
    de: ['unternehmen', 'konzern*', 'gewinn*', 'umsatz', 'ubernahme', 'fusion', 'vorstandschef', 'aktionar*', 'startup*', 'stellenabbau', 'borsengang', 'quartalszahlen'],
    fr: ['entreprise*', 'benefice*', 'chiffre d affaires', 'acquisition', 'fusion', 'pdg', 'actionnaire*', 'start-up*', 'licenciement*', 'introduction en bourse', 'resultats trimestriels'],
    it: ['aziend*', 'impres*', 'utile', 'utili', 'fatturato', 'acquisizione', 'fusione', 'amministratore delegato', 'azionist*', 'startup', 'licenziament*', 'quotazione', 'ricavi'],
    pt: ['empresa*', 'lucro*', 'receita', 'faturamento', 'aquisicao', 'fusao', 'presidente-executivo', 'ceo', 'acionista*', 'startup*', 'demiss*', 'ipo', 'resultado trimestral'],
  }),
  def('technology', 40, ['Tecnología', 'Technology', 'Technologie', 'Technologie', 'Tecnologia', 'Tecnologia'], {
    es: ['tecnologia', 'inteligencia artificial', 'software', 'app*', 'aplicacion', 'ciberataque', 'ciberseguridad', 'hacker*', 'chip*', 'semiconductor*', 'smartphone', 'internet', 'red social', 'datos personales', 'algoritmo*', 'robot*', 'nube'],
    en: ['technology', 'tech', 'artificial intelligence', 'ai model', 'software', 'app', 'apps', 'cyberattack', 'cybersecurity', 'hacker*', 'chip*', 'semiconductor*', 'smartphone', 'internet', 'social media', 'data breach', 'algorithm*', 'robot*', 'cloud'],
    de: ['technologie', 'kunstliche intelligenz', 'ki', 'software', 'app*', 'cyberangriff', 'cybersicherheit', 'hacker*', 'chip*', 'halbleiter*', 'smartphone', 'internet', 'soziale medien', 'datenleck', 'algorithm*', 'roboter*'],
    fr: ['technologie', 'intelligence artificielle', 'ia', 'logiciel', 'application*', 'cyberattaque', 'cybersecurite', 'pirate*', 'puce*', 'semi-conducteur*', 'smartphone', 'internet', 'reseaux sociaux', 'fuite de donnees', 'algorithme*', 'robot*'],
    it: ['tecnologia', 'intelligenza artificiale', 'software', 'app', 'applicazion*', 'attacco informatico', 'cybersicurezza', 'hacker', 'chip', 'semiconduttor*', 'smartphone', 'internet', 'social network', 'algoritm*', 'robot'],
    pt: ['tecnologia', 'inteligencia artificial', 'software', 'aplicativo*', 'app*', 'ataque hacker', 'ciberseguranca', 'hacker*', 'chip*', 'semicondutor*', 'smartphone', 'celular', 'internet', 'rede social', 'vazamento de dados', 'algoritmo*', 'robo*'],
  }),
  def('science', 50, ['Ciencia', 'Science', 'Wissenschaft', 'Sciences', 'Scienza', 'Ciência'], {
    es: ['ciencia', 'cientific*', 'investigador*', 'estudio publicado', 'revista nature', 'science', 'nasa', 'esa', 'espacio', 'astronom*', 'telescopio', 'fisica', 'biologia', 'genetica', 'fosil*', 'terremoto', 'sismo', 'volcan', 'clima global'],
    en: ['science', 'scientist*', 'researcher*', 'study published', 'nature journal', 'nasa', 'space', 'astronom*', 'telescope', 'physics', 'biology', 'genetic*', 'fossil*', 'earthquake', 'volcano', 'quake', 'magnitude'],
    de: ['wissenschaft*', 'forsch*', 'studie', 'nasa', 'esa', 'weltraum', 'astronom*', 'teleskop', 'physik', 'biologie', 'genetik', 'fossil*', 'erdbeben', 'vulkan'],
    fr: ['science*', 'scientifique*', 'chercheur*', 'etude publiee', 'nasa', 'espace', 'astronom*', 'telescope', 'physique', 'biologie', 'genetique', 'fossile*', 'seisme', 'tremblement de terre', 'volcan'],
    it: ['scienza', 'scienziat*', 'ricercator*', 'studio pubblicato', 'nasa', 'spazio', 'astronom*', 'telescopio', 'fisica', 'biologia', 'genetica', 'fossil*', 'terremoto', 'sisma', 'vulcano', 'ingv'],
    pt: ['ciencia', 'cientista*', 'pesquisador*', 'estudo publicado', 'nasa', 'espaco', 'astronom*', 'telescopio', 'fisica', 'biologia', 'genetica', 'fossil', 'fosseis', 'terremoto', 'sismo', 'vulcao'],
  }),
  def('health', 60, ['Salud', 'Health', 'Gesundheit', 'Santé', 'Salute', 'Saúde'], {
    es: ['salud', 'sanidad', 'hospital*', 'medic*', 'vacuna*', 'virus', 'brote', 'epidemia', 'pandemia', 'oms', 'enfermedad*', 'cancer', 'tratamiento', 'farmac*', 'pacientes', 'contagio*', 'ministerio de sanidad'],
    en: ['health', 'hospital*', 'doctor*', 'medic*', 'vaccine*', 'virus', 'outbreak', 'epidemic', 'pandemic', 'who', 'disease*', 'cancer', 'treatment', 'drug*', 'patients', 'infection*', 'cdc', 'fda'],
    de: ['gesundheit*', 'krankenhaus', 'klinik*', 'arzt', 'arzte', 'impf*', 'virus', 'ausbruch', 'epidemie', 'pandemie', 'who', 'krankheit*', 'krebs', 'behandlung', 'medikament*', 'patient*', 'infektion*', 'rki'],
    fr: ['sante', 'hopita*', 'medecin*', 'vaccin*', 'virus', 'epidemie', 'pandemie', 'oms', 'maladie*', 'cancer', 'traitement', 'medicament*', 'patients', 'infection*', 'contamination*'],
    it: ['salute', 'sanita', 'ospedal*', 'medic*', 'vaccin*', 'virus', 'focolaio', 'epidemia', 'pandemia', 'oms', 'malatti*', 'cancro', 'tumore', 'terapia', 'farmac*', 'pazienti', 'contagi*'],
    pt: ['saude', 'hospita*', 'medic*', 'vacina*', 'virus', 'surto', 'epidemia', 'pandemia', 'oms', 'doenca*', 'cancer', 'tratamento', 'remedio*', 'pacientes', 'infeccao', 'contagio*', 'sus', 'anvisa'],
  }),
  def('sports', 70, ['Deportes', 'Sports', 'Sport', 'Sport', 'Sport', 'Esportes'], {
    es: ['futbol', 'liga', 'laliga', 'partido', 'gol*', 'entrenador', 'jugador*', 'champions', 'mundial', 'baloncesto', 'nba', 'tenis', 'formula 1', 'f1', 'motogp', 'ciclismo', 'olimpic*', 'seleccion', 'fichaje*', 'real madrid', 'barcelona fc', 'atletico'],
    en: ['football', 'soccer', 'league', 'match', 'goal*', 'coach', 'player*', 'champions league', 'world cup', 'basketball', 'nba', 'nfl', 'mlb', 'nhl', 'tennis', 'formula 1', 'f1', 'olympic*', 'premier league', 'transfer', 'playoff*', 'super bowl'],
    de: ['fussball', 'bundesliga', 'spiel', 'tor*', 'trainer', 'spieler*', 'champions league', 'weltmeisterschaft', 'wm', 'em', 'basketball', 'tennis', 'formel 1', 'olympi*', 'nationalmannschaft', 'transfer', 'dfb'],
    fr: ['football', 'ligue 1', 'match', 'but*', 'entraineur', 'joueur*', 'ligue des champions', 'coupe du monde', 'basket', 'nba', 'tennis', 'formule 1', 'roland-garros', 'olympi*', 'equipe de france', 'mercato', 'rugby', 'tour de france'],
    it: ['calcio', 'serie a', 'partita', 'gol', 'allenatore', 'giocator*', 'champions league', 'mondiali', 'basket', 'nba', 'tennis', 'formula 1', 'olimpi*', 'nazionale', 'calciomercato', 'juventus', 'inter', 'milan', 'giro d italia'],
    pt: ['futebol', 'campeonato', 'brasileirao', 'partida', 'jogo', 'gol*', 'tecnico', 'treinador', 'jogador*', 'champions', 'copa do mundo', 'basquete', 'nba', 'tenis', 'formula 1', 'olimpi*', 'selecao', 'transferencia', 'flamengo', 'benfica', 'porto'],
  }),
  def('entertainment', 80, ['Entretenimiento', 'Entertainment', 'Unterhaltung', 'Divertissement', 'Spettacoli', 'Entretenimento'], {
    es: ['cine', 'pelicula*', 'serie*', 'netflix', 'actor', 'actriz', 'estreno', 'taquilla', 'oscar*', 'goya', 'television', 'musica', 'concierto*', 'cantante', 'album', 'festival', 'famos*'],
    en: ['film', 'movie*', 'series', 'netflix', 'actor', 'actress', 'premiere', 'box office', 'oscar*', 'emmy*', 'grammy*', 'television', 'tv show', 'music', 'concert*', 'singer', 'album', 'festival', 'celebrit*', 'hollywood'],
    de: ['kino', 'film*', 'serie*', 'netflix', 'schauspieler*', 'premiere', 'oscar*', 'fernsehen', 'musik', 'konzert*', 'sanger*', 'album', 'festival', 'promi*'],
    fr: ['cinema', 'film*', 'serie*', 'netflix', 'acteur', 'actrice', 'sortie en salles', 'box-office', 'cesar', 'oscar*', 'television', 'musique', 'concert*', 'chanteu*', 'album', 'festival', 'cannes'],
    it: ['cinema', 'film', 'serie tv', 'netflix', 'attor*', 'attrice', 'uscita', 'box office', 'oscar', 'televisione', 'musica', 'concert*', 'cantant*', 'album', 'festival', 'sanremo', 'venezia'],
    pt: ['cinema', 'filme*', 'serie*', 'novela', 'netflix', 'ator', 'atriz', 'estreia', 'bilheteria', 'oscar*', 'televisao', 'musica', 'show', 'cantor*', 'album', 'festival', 'famos*'],
  }),
  def('culture', 90, ['Cultura', 'Culture', 'Kultur', 'Culture', 'Cultura', 'Cultura'], {
    es: ['cultura', 'libro*', 'novela', 'escritor*', 'premio cervantes', 'museo*', 'exposicion', 'arte', 'pintor*', 'teatro', 'patrimonio', 'arqueolog*', 'literatura', 'poesia', 'opera'],
    en: ['culture', 'book*', 'novel', 'writer*', 'author*', 'museum*', 'exhibition', 'art', 'painter*', 'theatre', 'theater', 'heritage', 'archaeolog*', 'literature', 'poetry', 'opera', 'booker'],
    de: ['kultur', 'buch', 'bucher', 'roman', 'schriftsteller*', 'museum', 'museen', 'ausstellung', 'kunst', 'maler*', 'theater', 'kulturerbe', 'archaolog*', 'literatur', 'oper'],
    fr: ['culture', 'livre*', 'roman', 'ecrivain*', 'musee*', 'exposition', 'art', 'peintre*', 'theatre', 'patrimoine', 'archeolog*', 'litterature', 'poesie', 'opera', 'goncourt'],
    it: ['cultura', 'libr*', 'romanzo', 'scrittor*', 'muse*', 'mostra', 'arte', 'pittor*', 'teatro', 'patrimonio', 'archeolog*', 'letteratura', 'poesia', 'opera', 'strega'],
    pt: ['cultura', 'livro*', 'romance', 'escritor*', 'museu*', 'exposicao', 'arte', 'pintor*', 'teatro', 'patrimonio', 'arqueolog*', 'literatura', 'poesia', 'opera', 'premio camoes'],
  }),
  def('society', 100, ['Sociedad', 'Society', 'Gesellschaft', 'Société', 'Società', 'Sociedade'], {
    es: ['sociedad', 'educacion', 'colegio*', 'universidad*', 'vivienda', 'alquiler', 'inmigra*', 'migrant*', 'igualdad', 'violencia de genero', 'tribunal', 'juicio', 'detenid*', 'policia', 'guardia civil', 'accidente', 'incendio', 'sucesos', 'huelga', 'manifestacion'],
    en: ['society', 'education', 'school*', 'universit*', 'housing', 'rent', 'immigra*', 'migrant*', 'equality', 'court', 'trial', 'arrest*', 'police', 'accident', 'fire', 'strike', 'protest*', 'crime'],
    de: ['gesellschaft', 'bildung', 'schule*', 'universitat*', 'wohnung*', 'miete', 'migration', 'migrant*', 'gleichstellung', 'gericht', 'prozess', 'festgenommen', 'polizei', 'unfall', 'brand', 'streik', 'protest*', 'demonstration'],
    fr: ['societe', 'education', 'ecole*', 'universite*', 'logement', 'loyer', 'immigra*', 'migrant*', 'egalite', 'tribunal', 'proces', 'interpelle*', 'police', 'gendarmerie', 'accident', 'incendie', 'greve', 'manifestation*'],
    it: ['societa', 'istruzione', 'scuol*', 'universit*', 'casa', 'affitt*', 'immigra*', 'migrant*', 'parita', 'tribunale', 'processo', 'arrestat*', 'polizia', 'carabinieri', 'incidente', 'incendio', 'sciopero', 'manifestazion*', 'cronaca'],
    pt: ['sociedade', 'educacao', 'escola*', 'universidade*', 'moradia', 'habitacao', 'aluguel', 'imigra*', 'migrante*', 'igualdade', 'tribunal', 'julgamento', 'pres*', 'policia', 'acidente', 'incendio', 'greve', 'protesto*', 'manifestacao'],
  }),
  def('world', 110, ['Internacional', 'World', 'International', 'International', 'Esteri', 'Internacional'], {
    es: ['onu', 'otan', 'union europea', 'bruselas', 'guerra', 'conflicto', 'ataque', 'misil*', 'alto el fuego', 'diplomac*', 'cumbre', 'sanciones', 'refugiados', 'embajad*', 'ucrania', 'rusia', 'gaza', 'israel', 'china'],
    en: ['united nations', 'un security council', 'nato', 'european union', 'brussels', 'war', 'conflict', 'attack', 'missile*', 'ceasefire', 'diplomac*', 'summit', 'sanctions', 'refugees', 'embass*', 'ukraine', 'russia', 'gaza', 'israel', 'china'],
    de: ['uno', 'vereinte nationen', 'nato', 'europaische union', 'eu', 'brussel', 'krieg', 'konflikt', 'angriff', 'rakete*', 'waffenruhe', 'diplomat*', 'gipfel', 'sanktionen', 'fluchtlinge', 'botschaft', 'ukraine', 'russland', 'gaza', 'israel', 'china'],
    fr: ['onu', 'otan', 'union europeenne', 'bruxelles', 'guerre', 'conflit', 'attaque', 'missile*', 'cessez-le-feu', 'diplomat*', 'sommet', 'sanctions', 'refugies', 'ambassade', 'ukraine', 'russie', 'gaza', 'israel', 'chine'],
    it: ['onu', 'nato', 'unione europea', 'bruxelles', 'guerra', 'conflitto', 'attacco', 'missil*', 'cessate il fuoco', 'diplomazi*', 'vertice', 'sanzioni', 'rifugiati', 'ambasciat*', 'ucraina', 'russia', 'gaza', 'israele', 'cina'],
    pt: ['onu', 'otan', 'uniao europeia', 'bruxelas', 'guerra', 'conflito', 'ataque', 'missil', 'misseis', 'cessar-fogo', 'diplomac*', 'cupula', 'sancoes', 'refugiados', 'embaixad*', 'ucrania', 'russia', 'gaza', 'israel', 'china'],
  }),
  def('weather', 120, ['Clima', 'Weather', 'Wetter', 'Météo', 'Meteo', 'Clima'], {
    es: ['tiempo', 'aemet', 'lluvia*', 'tormenta*', 'temporal', 'ola de calor', 'temperaturas', 'nieve', 'granizo', 'inundacion*', 'dana', 'alerta roja', 'alerta naranja', 'huracan', 'sequia', 'cambio climatico', 'emisiones'],
    en: ['weather', 'forecast', 'rain', 'storm*', 'heatwave', 'heat wave', 'temperatures', 'snow', 'hail', 'flood*', 'hurricane', 'tornado*', 'drought', 'wildfire*', 'climate change', 'emissions', 'national weather service'],
    de: ['wetter', 'dwd', 'regen', 'unwetter', 'sturm', 'hitzewelle', 'temperatur*', 'schnee', 'hagel', 'hochwasser', 'uberschwemmung*', 'orkan', 'durre', 'waldbrand*', 'klimawandel', 'emission*'],
    fr: ['meteo', 'meteo-france', 'pluie*', 'orage*', 'tempete', 'canicule', 'temperatures', 'neige', 'grele', 'inondation*', 'crue*', 'ouragan', 'secheresse', 'incendie de foret', 'rechauffement climatique', 'emissions'],
    it: ['meteo', 'pioggia', 'temporal*', 'maltempo', 'ondata di calore', 'temperature', 'neve', 'grandine', 'alluvion*', 'allerta rossa', 'uragano', 'siccita', 'incendi boschivi', 'cambiamento climatico', 'emissioni'],
    pt: ['previsao do tempo', 'chuva*', 'tempestade*', 'temporal', 'onda de calor', 'temperaturas', 'neve', 'granizo', 'enchente*', 'inundac*', 'furacao', 'seca', 'queimada*', 'mudanca climatica', 'emissoes', 'inmet', 'ipma'],
  }),
  def('travel', 130, ['Viajes', 'Travel', 'Reisen', 'Voyage', 'Viaggi', 'Viagem'], {
    es: ['viaje*', 'turismo', 'turistas', 'vuelo*', 'aerolinea*', 'aeropuerto*', 'hotel*', 'destino*', 'vacaciones', 'crucero*', 'renfe', 'aena'],
    en: ['travel', 'tourism', 'tourists', 'flight*', 'airline*', 'airport*', 'hotel*', 'destination*', 'vacation', 'holiday*', 'cruise*', 'passport'],
    de: ['reise*', 'tourismus', 'touristen', 'flug', 'fluge', 'fluggesellschaft*', 'flughafen', 'hotel*', 'urlaub', 'kreuzfahrt*', 'deutsche bahn'],
    fr: ['voyage*', 'tourisme', 'touristes', 'vol', 'vols', 'compagnie aerienne', 'aeroport*', 'hotel*', 'destination*', 'vacances', 'croisiere*', 'sncf'],
    it: ['viaggi*', 'turismo', 'turisti', 'volo', 'voli', 'compagnia aerea', 'aeroport*', 'hotel', 'destinazion*', 'vacanz*', 'crociera', 'trenitalia'],
    pt: ['viage*', 'turismo', 'turistas', 'voo', 'voos', 'companhia aerea', 'aeroporto*', 'hote*', 'destino*', 'ferias', 'cruzeiro*', 'passaporte'],
  }),
  def('lifestyle', 140, ['Estilo de vida', 'Lifestyle', 'Leben', 'Art de vivre', 'Stile di vita', 'Estilo de vida'], {
    es: ['gastronomia', 'receta*', 'restaurante*', 'moda', 'bienestar', 'nutricion', 'dieta', 'ejercicio', 'familia', 'mascotas', 'consumo', 'hogar'],
    en: ['food', 'recipe*', 'restaurant*', 'fashion', 'wellbeing', 'wellness', 'nutrition', 'diet', 'fitness', 'family', 'pets', 'home'],
    de: ['essen', 'rezept*', 'restaurant*', 'mode', 'wohlbefinden', 'ernahrung', 'diat', 'fitness', 'familie', 'haustier*', 'verbraucher'],
    fr: ['gastronomie', 'recette*', 'restaurant*', 'mode', 'bien-etre', 'nutrition', 'regime', 'fitness', 'famille', 'animaux de compagnie', 'consommation'],
    it: ['cucina', 'ricett*', 'ristorant*', 'moda', 'benessere', 'nutrizione', 'dieta', 'fitness', 'famiglia', 'animali domestici', 'consumi'],
    pt: ['gastronomia', 'receita*', 'restaurante*', 'moda', 'bem-estar', 'nutricao', 'dieta', 'exercicio', 'familia', 'pets', 'consumo'],
  }),
  def('opinion', 150, ['Opinión', 'Opinion', 'Meinung', 'Opinion', 'Opinioni', 'Opinião'], {}, { isOpinion: true }),
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export function category(id: string | null | undefined): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function categoryBySlug(lang: string, slug: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.slugs[lang] === slug);
}
