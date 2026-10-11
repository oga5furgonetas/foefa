/* GUIA «COMO ORGANIZAR SUA ROTA DE ENTREGAS» (11-10-2026). A versão do Brasil de guia-ruta-de-reparto.js:
 * mesma ideia (conselhos de verdade e, no fim, o app), em português do Brasil e HTML completo para o Google.
 * A oferta «sem limite» só aparece enquanto vale (PROMO_HASTA, a mesma data de src/lib/precios.js). */
const BASE = 'https://flotadsp.com'
const RUTA = '/guia-rota-de-entregas'
const PROMO_HASTA = '2026-12-31'
const TITULO = 'Como organizar sua rota de entregas: guia prático para entregadores'
const DESCRIPCION = 'Como agrupar as paradas, carregar os pacotes, encaixar os horários e não perder tempo na rota de entregas. Dicas para entregadores e um app grátis que organiza a rota sozinho.'

const PREGUNTAS = [
  ['Em que ordem eu carrego os pacotes?',
    'Ao contrário da ordem de entrega: o último da rota vai no fundo; o primeiro, à mão. Separando por trechos (sacolas ou caixas por bairro), cada parada leva segundos em vez de minutos.'],
  ['É melhor organizar as paradas por distância ou por tempo?',
    'Por tempo. Duas paradas perto no mapa podem ficar longe se for preciso dar a volta por uma rua de mão única ou atravessar uma avenida no horário de pico. O que conta é quanto você demora para chegar em cada uma.'],
  ['O que faço com os pacotes que têm horário?',
    'Coloque-os dentro da faixa de horário e organize o resto em volta. Se não for dar tempo, avise o cliente antes: é melhor do que uma entrega frustrada.'],
  ['E se o cliente não estiver?',
    'Deixe para o fim daquele mesmo bairro e siga em frente. Voltar no meio da rota é o que mais faz perder tempo. Anote o que aconteceu (foto, observação) caso perguntem depois.'],
]

const enPromo = () => new Date().toISOString().slice(0, 10) <= PROMO_HASTA

function pagina() {
  const enlace = `/repartidores?utm_source=guia&utm_content=guia_ptbr`
  const oferta = enPromo()
    ? 'Grátis e sem limite até 31 de dezembro de 2026, sem cartão. Depois, grátis até 15 paradas por dia.'
    : 'Grátis até 15 paradas por dia, sem cartão.'
  const faq = {
    '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: 'pt-BR',
    mainEntity: PREGUNTAS.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  }
  const articulo = {
    '@context': 'https://schema.org', '@type': 'Article', headline: TITULO, description: DESCRIPCION, inLanguage: 'pt-BR',
    datePublished: '2026-10-11', dateModified: '2026-10-11', mainEntityOfPage: `${BASE}${RUTA}`,
    publisher: { '@type': 'Organization', name: 'FDS', url: BASE },
  }
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${TITULO}</title>
  <meta name="description" content="${DESCRIPCION}" />
  <link rel="canonical" href="${BASE}${RUTA}" />
  <link rel="alternate" hreflang="pt-BR" href="${BASE}${RUTA}" />
  <link rel="alternate" hreflang="es" href="${BASE}/guia-ruta-de-reparto" />
  <link rel="icon" href="/favicon.svg" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${TITULO}" />
  <meta property="og:description" content="${DESCRIPCION}" />
  <meta property="og:url" content="${BASE}${RUTA}" />
  <meta property="og:image" content="${BASE}/og-repartidores.png?v=promo1231" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${JSON.stringify(articulo)}</script>
  <script type="application/ld+json">${JSON.stringify(faq)}</script>
  <style>
    :root { color-scheme: dark; --fondo:#05141a; --tarjeta:#0b2329; --marca:#14e7d8; --texto:#e6f2f3; --suave:#a9c2c6; --amarillo:#ffd43b }
    * { box-sizing: border-box }
    body { margin:0; background:var(--fondo); color:var(--texto); font:17px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif }
    main { max-width: 720px; margin: 0 auto; padding: 28px 16px 64px }
    a { color: var(--marca) }
    .marca { display:flex; align-items:center; gap:10px; font-weight:800; color:var(--texto); text-decoration:none }
    .marca img { width:32px; height:32px }
    h1 { font-size: clamp(28px, 6vw, 40px); line-height:1.1; margin: 28px 0 12px }
    h2 { font-size: 22px; margin: 34px 0 8px; color: var(--marca) }
    .entradilla { color: var(--suave); font-size: 18px }
    ul li { margin: 6px 0 }
    .caja { background: var(--tarjeta); border: 1px solid #16414a; border-radius: 16px; padding: 20px; margin: 30px 0 }
    .boton { display:inline-block; margin-top:12px; background: var(--marca); color:#04121a; font-weight:800; text-decoration:none; padding: 14px 22px; border-radius: 14px }
    .oferta { color: var(--amarillo); font-weight: 700 }
    details { border-top: 1px solid #16414a; padding: 12px 0 }
    summary { cursor: pointer; font-weight: 700 }
    footer { margin-top: 40px; color: var(--suave); font-size: 14px }
  </style>
</head>
<body>
<main>
  <a class="marca" href="/repartidores?utm_source=guia&utm_content=guia_ptbr_logo"><img src="/favicon.svg" alt="" />FDS</a>
  <h1>Como organizar sua rota de entregas</h1>
  <p class="entradilla">Um guia prático para entregadores: como agrupar as paradas, carregar os pacotes, encaixar os
  horários e terminar mais cedo. Serve com 20 paradas ou com 150.</p>

  <h2>1. Antes de sair: confira todas as etiquetas</h2>
  <p>Revise as etiquetas antes de carregar. Separe três grupos: os que têm <b>horário</b>, os que precisam de
  <b>cobrança</b> e o resto. Se encontrar um endereço incompleto ou estranho, anote agora: na rua é tarde.</p>

  <h2>2. Agrupe por bairro, não pela ordem de chegada</h2>
  <p>Junte os pacotes por bairro ou CEP. Cada bairro é um trecho da rota. Assim você não atravessa a cidade duas vezes
  pelo mesmo lugar.</p>

  <h2>3. Organize por tempo, não só por distância</h2>
  <p>O que importa é quanto você demora para chegar em cada parada. Contam a mão das ruas, as conversões proibidas, o
  trânsito naquela hora (saída de escola, feiras, horário de pico) e o tempo em cada portaria. Duas paradas juntas no
  mapa podem estar a dez minutos.</p>

  <h2>4. Carregue ao contrário</h2>
  <p>O último que você vai entregar vai no fundo; o primeiro, à mão. Uma sacola ou caixa por trecho economiza minutos
  em cada parada, e num dia de 100 paradas isso dá mais de uma hora.</p>

  <h2>5. Os que têm horário, na sua faixa</h2>
  <p>Coloque primeiro as entregas com horário e organize o resto em volta. Se perceber que não vai dar, avise o cliente
  antes: uma ligação ou mensagem evita uma entrega frustrada e uma nova tentativa amanhã.</p>

  <h2>6. Avise antes de chegar</h2>
  <p>Uma mensagem com o horário aproximado («chego em 10 minutos») reduz muito os «não estava». Deixe o texto pronto
  para não perder tempo.</p>

  <h2>7. Se não estiver, no fim do bairro</h2>
  <p>Não volte no meio da rota. Deixe a nova tentativa para o fim daquele trecho e siga. Tire uma foto ou anote o que
  aconteceu caso perguntem depois.</p>

  <h2>8. Faça as contas do dia</h2>
  <p>Paradas feitas, quilômetros, combustível e quanto você ganha por entrega. Com esses quatro números você sabe se
  uma rota compensa ou não.</p>

  <div class="caja">
    <h2 style="margin-top:0">Fazer isso com um app</h2>
    <p>A parte mais trabalhosa disso tudo o <b>FDS</b> faz por você, um app para entregadores que trabalham por conta própria:</p>
    <ul>
      <li>Você tira uma foto da etiqueta ou escaneia o código e o endereço entra sozinho.</li>
      <li>Organiza as paradas por tempo, com o trânsito típico de cada hora, e mostra a que horas você chega em cada uma.</li>
      <li>Te guia por voz até cada porta e, no Android, com mãos livres: você diz «entregue» e continua dirigindo.</li>
      <li>Mostra quanto você já ganhou no dia e quanto foi de combustível, em reais.</li>
    </ul>
    <p class="oferta">${oferta}</p>
    <a class="boton" href="${enlace}">Experimentar o FDS grátis</a>
  </div>

  <h2>Perguntas frequentes</h2>
  ${PREGUNTAS.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('\n  ')}

  <footer>FDS · <a href="/aviso-legal">Aviso legal</a> · <a href="/privacidad">Privacidade</a> ·
  <a href="/guia-ruta-de-reparto" hreflang="es">En español</a></footer>
</main>
</body>
</html>`
}

export async function onRequestGet() {
  return new Response(pagina(), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=300' },
  })
}
