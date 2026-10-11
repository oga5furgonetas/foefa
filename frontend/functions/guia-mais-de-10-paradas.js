/* GUIA «ROTA COM MAIS DE 10 PARADAS» (11-10-2026). A versão do Brasil de guia-mas-de-10-paradas.js, com os
 * dados da ajuda oficial do navegador (até 10 pontos; a ordem se muda arrastando; o horário de saída só
 * conta com um destino). Modelo em functions_lib/guia.js. */
import { respuestaGuia, enPromo } from '../functions_lib/guia.js'

const AJUDA = 'https://support.google.com/maps/answer/144339?hl=pt-BR'

const guia = () => ({
  ruta: '/guia-mais-de-10-paradas', lang: 'pt-BR', utm: 'guia_10paradas_ptbr',
  alternas: [['es', '/guia-mas-de-10-paradas']],
  titulo: 'Rota com mais de 10 paradas: como fazer e organizar sozinha',
  descripcion: 'O Google Maps aceita no máximo 10 pontos por rota e não organiza as paradas para você. Como planejar um dia de entregas com muito mais paradas, grátis ou com um app.',
  h1: 'Como fazer uma rota com mais de 10 paradas',
  entradilla: 'O Google Maps deixa colocar no máximo 10 pontos numa rota (a saída e 9 paradas), segue a ordem em que você digitou e, com várias paradas, não calcula a rota pelo horário de saída. Para um dia de entregas com dezenas de pacotes, não dá. Estas são as saídas.',
  secciones: [
    ['1. O que o Google Maps permite', `Segundo a <a href="${AJUDA}" rel="nofollow">própria ajuda</a>: até 10 pontos por rota contando a saída, a ordem é você que muda arrastando cada parada e a previsão pelo horário de saída só funciona com um único destino. Serve para três endereços; para entregar, não.`],
    ['2. Grátis: dividir a rota em trechos de 9', 'Agrupe os pacotes por bairro e monte uma rota por bairro, de 9 em 9. Terminou um trecho, abre o próximo. Funciona, mas a ordem de cada trecho é você que decide, e se o cliente não estiver ou algo mudar, tem que refazer na mão.'],
    ['3. Organizar na mão sem perder tempo', 'Comece pelo bairro mais longe ou pelo mais perto, mas não pule de um para outro. Dentro de cada bairro, percorra as ruas num só sentido, sem voltar. Entregas com horário primeiro, e o resto em volta. O passo a passo está no <a href="/guia-rota-de-entregas">guia para organizar a rota de entregas</a>.'],
    ['4. Com um app que organiza as paradas', 'Você coloca todos os endereços do dia de uma vez (lendo o código, com uma foto da etiqueta ou colando a lista) e o app calcula a ordem por tempo, não só por distância. Se algo muda no meio da rota, reorganiza o que falta com um toque. É isso que faz diferença quando passa de 30 ou 40 paradas.'],
    ['5. O que olhar antes de escolher um app', 'Que não tenha limite de paradas ou que o limite sobre; que organize por tempo com o trânsito de cada hora; que respeite os horários de entrega; que funcione só com o celular, sem computador; e quanto custa de verdade quando acaba o teste.'],
    ['6. E na hora de carregar', 'Carregue na ordem inversa: o último da rota, no fundo. Assim cada pacote está à mão quando você chega na porta e não perde minutos procurando em cada parada.'],
  ],
  caja: {
    titulo: 'Um app para entregar com todas as suas paradas',
    intro: 'O <b>FDS</b> é um app para entregadores que trabalham por conta própria:',
    puntos: [
      'Foto da etiqueta ou leitura do código: o endereço entra sozinho.',
      'Organiza todas as paradas por tempo, com o trânsito típico de cada hora.',
      'Guia por voz até cada porta e, no Android, com mãos livres: você diz «entregue» e continua.',
      '«Meu dinheiro hoje»: quanto você já ganhou, o combustível e o que sobra, em reais.',
    ],
    boton: 'Experimentar o FDS grátis',
  },
  oferta: {
    promo: 'Grátis e sem limite de paradas até 31 de dezembro de 2026, sem cartão. Depois, grátis até 15 paradas por dia.',
    siempre: 'Grátis até 15 paradas por dia, sem cartão.',
  },
  titPreguntas: 'Perguntas frequentes',
  preguntas: [
    ['Quantas paradas o Google Maps permite?', 'Até 10 pontos por rota: o ponto de saída e mais 9 paradas, sendo a última o destino final.'],
    ['O Google Maps organiza as paradas para a rota ficar mais curta?', 'Não. Ele segue a ordem em que você digitou; dá para arrastar e mudar, mas a melhor ordem é você que tem que decidir.'],
    ['Quantas paradas o FDS aceita?', enPromo()
      ? 'Até 31 de dezembro de 2026, quantas você quiser e grátis. Depois, o plano grátis permite 15 paradas novas por dia e o pago não tem limite.'
      : 'O plano grátis permite 15 paradas novas por dia e o pago não tem limite.'],
  ],
  pie: { legal: 'Aviso legal', privacidad: 'Privacidade', otros: [['En español', '/guia-mas-de-10-paradas', 'es'], ['Como organizar a rota', '/guia-rota-de-entregas']] },
})

export async function onRequestGet() {
  return respuestaGuia(guia())
}
