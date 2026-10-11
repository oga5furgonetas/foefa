/* GUIA «COMO GANHAR MAIS COMO ENTREGADOR» (11-10-2026). A versão do Brasil de guia-ganar-mas-repartidor.js.
 * Sem números de salário (mudam por empresa e região). Modelo em functions_lib/guia.js. */
import { respuestaGuia } from '../functions_lib/guia.js'

const GUIA = {
  ruta: '/guia-ganhar-mais-entregador', lang: 'pt-BR', utm: 'guia_ganhar_ptbr',
  alternas: [['es', '/guia-ganar-mas-repartidor']],
  titulo: 'Como ganhar mais como entregador: 8 dicas',
  descripcion: 'Como saber quanto sobra de verdade por dia e por hora, e o que mudar para ganhar mais entregando: menos quilômetros, menos entregas frustradas e mais paradas por hora.',
  h1: 'Como ganhar mais como entregador',
  entradilla: 'O valor por pacote quase nunca é você que decide. O que está na sua mão é quanto tempo você leva, quantos quilômetros roda e quantas entregas ficam sem fazer. A diferença está aí.',
  secciones: [
    ['1. Faça as suas contas de verdade', 'Quanto você recebe por entrega (ou por dia), menos o combustível e o que o veículo custa. Dividido pelas horas na rua. Esse é o seu ganho real por hora, e é esse número que você precisa aumentar.'],
    ['2. Menos quilômetros por parada', 'Cada quilômetro a mais é combustível e tempo que ninguém paga. Agrupe as paradas por bairro e organize por tempo, não pela ordem em que recebeu os pacotes. Veja o <a href="/guia-rota-de-entregas">guia para organizar a rota</a> passo a passo.'],
    ['3. Menos minutos em cada parada', 'Carregue na ordem inversa (o último no fundo) e separe por trechos. Procurar pacote no carro ou na moto é tempo perdido: num dia com muitas paradas, isso pesa no fim.'],
    ['4. Menos entregas frustradas', 'Um «não estava» é uma parada feita duas vezes. Avise o cliente antes de chegar com o seu horário aproximado e, se ele não estiver, deixe para o fim do bairro em vez de voltar.'],
    ['5. Horários primeiro', 'Coloque primeiro as entregas com faixa de horário e organize o resto em volta. Chegar atrasado numa faixa costuma virar nova tentativa no dia seguinte.'],
    ['6. Cuide do gasto do veículo', 'Pneus calibrados, manutenção em dia e direção suave: o consumo cai e as quebras também. Uma quebra no meio da rota é o dia perdido.'],
    ['7. Anote o seu dia', 'Paradas, quilômetros, horas e quanto ganhou. Com uma semana de dados você sabe quais rotas ou dias compensam e quais não.'],
    ['8. Negocie com dados', 'Sabendo as suas paradas por hora e o seu custo por quilômetro, você compara ofertas de verdade e pode pedir valor melhor para as regiões que dão prejuízo.'],
  ],
  caja: {
    titulo: 'Um app que ajuda com tudo isso',
    intro: 'O <b>FDS</b> é um app para entregadores que trabalham por conta própria:',
    puntos: [
      'Foto da etiqueta ou leitura do código: o endereço entra sozinho.',
      'Organiza as paradas por tempo, com o trânsito típico de cada hora.',
      '«Meu dinheiro hoje»: quanto você já ganhou, o combustível e o que sobra, em reais.',
      'Guia por voz e, no Android, com mãos livres: você diz «entregue» e continua dirigindo.',
    ],
    boton: 'Experimentar o FDS grátis',
  },
  oferta: {
    promo: 'Grátis e sem limite até 31 de dezembro de 2026, sem cartão. Depois, grátis até 15 paradas por dia.',
    siempre: 'Grátis até 15 paradas por dia, sem cartão.',
  },
  titPreguntas: 'Perguntas frequentes',
  preguntas: [
    ['Quanto ganha um entregador por pacote?', 'Depende da empresa, da região e do tipo de entrega, então o único número que vale é o seu: quanto você recebe por entrega, menos o que gasta por quilômetro e os custos fixos.'],
    ['Como sei se uma rota compensa?', 'Veja quanto sobra por hora nessa rota (o recebido menos o combustível, dividido pelas horas) e compare com as outras. Bairro com muitos quilômetros entre paradas é o que mais custa.'],
    ['O que mais faz perder tempo?', 'Normalmente três coisas: rodar sem a rota organizada, procurar o pacote em cada parada e as entregas frustradas que precisam ser repetidas.'],
  ],
  pie: { legal: 'Aviso legal', privacidad: 'Privacidade', otros: [['En español', '/guia-ganar-mas-repartidor', 'es'], ['Como organizar a rota', '/guia-rota-de-entregas']] },
}

export async function onRequestGet() {
  return respuestaGuia(GUIA)
}
