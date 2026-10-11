/* PORTUGUÉS DE BRASIL DE VERDAD EN EL EMBUDO (11-10-2026). Los textos en portugués son de Portugal y la
   capa de palabras de idioma.js (senha, celular, cadastro…) no cambia la gramática: en Brasil la portada
   seguía diciendo «guia-o por voz», «a app», «Ganha… que a use». A quien llega de un anuncio o de un grupo
   brasileño eso le suena de fuera. Aquí van, escritas para Brasil (você, «o app», endereço, escaneie),
   las frases que ve antes de su primera ruta: portada, «Empezar», alta, primera pantalla, recorrido y
   aviso de la mañana. La clave es el texto en español, como en textosRuta; si una frase no está aquí,
   sale la de Portugal con la capa de palabras. Lo vigila scripts/check-textos-ruta.mjs (claves que
   existen y mismas variables). */
export const BR = {
  // Portada /repartidores
  'Paquetería': 'Encomendas',
  'Súper a domicilio': 'Supermercado delivery',
  'Foto a la etiqueta: la dirección y el teléfono entran solos': 'Foto da etiqueta: o endereço e o telefone entram sozinhos',
  'La ruta se ordena sola por tiempo, con el tráfico típico': 'A rota se organiza sozinha por tempo, com o trânsito de cada hora',
  'Te guía con voz hasta cada puerta, dentro de la app': 'Te guia por voz até cada porta, dentro do app',
  'Manos libres en Android: di «entregado» y sigue conduciendo': 'Mãos livres no Android: diga «entregue» e continue dirigindo',
  'Cuánto llevas ganado hoy y la gasolina, en tu moneda': 'Quanto você já ganhou hoje e o combustível, na sua moeda',
  'Avisa al cliente con tu hora de llegada': 'Avise o cliente com o seu horário de chegada',
  'Escanea los paquetes al cargar y sabes dónde va cada uno': 'Escaneie os pacotes ao carregar e saiba onde vai cada um',
  '¿Sirve con los paquetes de mi agencia?': 'Funciona com os pacotes da minha transportadora?',
  'Sí. Escaneas el código de la etiqueta o le haces una foto y la app intenta leer la dirección (si no la lee, la escribes tú), o pegas tu lista de direcciones. No necesita conectarse con tu agencia.':
    'Sim. Você escaneia o código da etiqueta ou tira uma foto e o app tenta ler o endereço (se não conseguir, você digita), ou cola a sua lista de endereços. Não precisa se conectar com a sua transportadora.',
  '¿Qué hacéis con mis datos y mi ubicación?': 'O que vocês fazem com os meus dados e a minha localização?',
  'La foto de la etiqueta se lee en tu móvil. Tu ubicación solo se usa para guiarte y no se guarda. Los datos de tus clientes se borran solos a los días que tú fijes.':
    'A foto da etiqueta é lida no seu celular. A sua localização só é usada para te guiar e não é guardada. Os dados dos seus clientes se apagam sozinhos depois dos dias que você definir.',
  '¿Cuánto cuesta?': 'Quanto custa?',
  'Gratis y sin límite hasta el 31 de diciembre, sin tarjeta. Después sigues gratis con hasta 15 paradas al día, o sin tope por 9,99 € al mes o 99 € al año. Cancelas cuando quieras desde la propia app.':
    'Grátis e sem limite até 31 de dezembro, sem cartão. Depois continua grátis com até 15 paradas por dia, ou sem limite por 9,99 € por mês ou 99 € por ano. Você cancela quando quiser no próprio app.',
  'Gratis para siempre hasta 15 paradas al día, sin tarjeta. Sin tope: 9,99 € al mes o 99 € al año, y los 7 primeros días van sin tope. Cancelas cuando quieras desde la propia app.':
    'Grátis para sempre até 15 paradas por dia, sem cartão. Sem limite: 9,99 € por mês ou 99 € por ano, e os 7 primeiros dias são sem limite. Você cancela quando quiser no próprio app.',
  '¿Tengo que instalar algo?': 'Preciso instalar alguma coisa?',
  'Funciona en el navegador de cualquier móvil, Android o iPhone: la añades a tu pantalla de inicio y se abre como una app. La app de Google Play y la de App Store llegarán próximamente.':
    'Funciona no navegador de qualquer celular, Android ou iPhone: você adiciona à tela inicial e ele abre como um app. Os apps da Google Play e da App Store chegam em breve.',
  'Sin conexión': 'Sem conexão',
  'Probarla ahora, sin registrarme': 'Testar agora, sem cadastro',
  'Sirve igual si repartes para una agencia, una plataforma o un súper:': 'Serve do mesmo jeito se você entrega para uma transportadora, uma plataforma ou um supermercado:',
  'Marcas de sus dueños, sin relación con ellas. Tú metes los paquetes y la app ordena la ruta.':
    'Marcas dos respectivos donos, sem relação conosco. Você coloca os pacotes e o app organiza a rota.',
  '{n} días gratis · sin tarjeta · cancelas cuando quieras': '{n} dias grátis · sem cartão · cancele quando quiser',
  'Gratis y sin límite hasta el {fecha} · sin tarjeta': 'Grátis e sem limite até {fecha} · sem cartão',
  'Gratis hasta {n} paradas al día · sin tarjeta': 'Grátis até {n} paradas por dia · sem cartão',
  'Con 8 paradas de ejemplo. Sin datos ni tarjeta: pruébala en 1 minuto.': 'Com 8 paradas de exemplo. Sem dados nem cartão: teste em 1 minuto.',
  'Vídeo de la app': 'Vídeo do app',
  'Te ha invitado un compañero · gratis y sin límite hasta el {fecha}': 'Um colega te convidou · grátis e sem limite até {fecha}',
  'Te ha invitado un compañero: {n} días gratis': 'Um colega te convidou: {n} dias grátis',
  'Para quien reparte solo': 'Para quem entrega por conta própria',
  'Tu ruta de reparto, ordenada sola.': 'Sua rota de entregas, organizada sozinha.',
  'Haz una foto a la etiqueta o escanea el paquete: la app ordena las paradas por tiempo y te lleva con voz hasta cada puerta.':
    'Tire uma foto da etiqueta ou escaneie o pacote: o app organiza as paradas por tempo e te leva por voz até cada porta.',
  'Gana {euros} por cada compañero que la use.': 'Ganhe {euros} por cada colega que usar o app.',
  'Crear mi cuenta gratis': 'Criar minha conta grátis',
  '¿Te convence? Créate la cuenta': 'Gostou? Crie sua conta',
  'Gratis y sin límite hasta el {fecha}': 'Grátis e sem limite até {fecha}',
  'Después, gratis hasta {n} paradas al día, o sin tope por 9,99 €/mes': 'Depois, grátis até {n} paradas por dia, ou sem limite por 9,99 €/mês',
  'Sin tarjeta: te registras y empiezas ya': 'Sem cartão: você se cadastra e já começa',
  'Gratis para siempre hasta {n} paradas al día': 'Grátis para sempre até {n} paradas por dia',
  'Sin tope: 9,99 €/mes o 99 €/año, con 7 días de prueba': 'Sem limite: 9,99 €/mês ou 99 €/ano, com 7 dias de teste',
  'Cancelas cuando quieras desde la app': 'Cancele quando quiser pelo app',
  'Sin tarjeta: la prueba empieza ya y hoy no pagas nada': 'Sem cartão: o teste começa agora e hoje você não paga nada',
  'Crear mi cuenta': 'Criar minha conta',
  '¿Ya tienes cuenta?': 'Já tem conta?',
  'Guía: cómo ordenar la ruta': 'Guia: como organizar a rota',

  // «Empezar» (/app sin sesión)
  'Soy repartidor de una empresa': 'Sou entregador de uma empresa',
  'Mi empresa ya usa Flota y me ha dado acceso. Entro con mi correo.': 'Minha empresa já usa o Flota e me deu acesso. Entro com meu e-mail.',
  'Gestiono una empresa': 'Gerencio uma empresa',
  'Supermercado, distribución, mensajería, paquetería… El panel de la oficina.': 'Supermercado, distribuição, entregas, encomendas… O painel do escritório.',
  'Ya tengo cuenta': 'Já tenho conta',
  'Soy de una empresa': 'Sou de uma empresa',
  'Repartidor': 'Entregador',
  'Repartir yo mismo': 'Entregar por conta própria',

  // Alta
  'Dinos tu nombre.': 'Diga o seu nome.',
  'Introduce un email válido.': 'Digite um e-mail válido.',
  'La contraseña debe tener al menos 8 caracteres.': 'A senha precisa ter pelo menos 8 caracteres.',
  'Las contraseñas no coinciden.': 'As senhas não coincidem.',
  'Debes aceptar los Términos y la Política de Privacidad para continuar.': 'Você precisa aceitar os Termos e a Política de Privacidade para continuar.',
  'No se pudo crear la cuenta. Prueba con otro correo.': 'Não foi possível criar a conta. Tente com outro e-mail.',
  'Sin conexión con el servidor. Revisa tu red e inténtalo de nuevo.': 'Sem conexão com o servidor. Verifique sua internet e tente de novo.',
  '¡Cuenta creada!': 'Conta criada!',
  'Plan {plan} · {n} días gratis': 'Plano {plan} · {n} dias grátis',
  'Hemos enviado un email de bienvenida a': 'Enviamos um e-mail de boas-vindas para',
  'Ya puedes escanear tus primeros paquetes.': 'Você já pode escanear seus primeiros pacotes.',
  'Empezar mi ruta →': 'Começar minha rota →',
  'Después, gratis hasta {n} paradas al día, o sin tope por {precio} €/mes.': 'Depois, grátis até {n} paradas por dia, ou sem limite por {precio} €/mês.',
  'Sin tope: {precio} €/mes, y los {n} primeros días ya van sin tope.': 'Sem limite: {precio} €/mês, e os {n} primeiros dias já são sem limite.',
  'Plan elegido': 'Plano escolhido',
  '{precio} €/mes, todo incluido · {n} días gratis': '{precio} €/mês, tudo incluído · {n} dias grátis',
  'Gratis · sin tarjeta · hoy 0 €': 'Grátis · sem cartão · hoje 0 €',
  'Tu nombre': 'Seu nome',
  'Tu correo': 'Seu e-mail',
  '¿Querías decir {correo}?': 'Você quis dizer {correo}?',
  'Entrarás con tu correo y esta contraseña.': 'Você vai entrar com seu e-mail e esta senha.',
  'Contraseña': 'Senha',
  'Ocultar contraseña': 'Ocultar senha',
  'Mostrar contraseña': 'Mostrar senha',
  'Repetir contraseña': 'Repetir senha',
  'Repite la contraseña': 'Repita a senha',
  'Las contraseñas no coinciden': 'As senhas não coincidem',
  'Acepto los [Términos], el [Acuerdo de Encargo del Tratamiento] y la [Política de Privacidad].':
    'Aceito os [Termos], o [Acordo de Tratamento de Dados] e a [Política de Privacidade].',
  'Gratis y sin límite hasta el {fecha}. Después sigues gratis con hasta {p} paradas al día; sin tarjeta no se cobra nunca. Sin tope: plan {plan} ({precio} €/mes).':
    'Grátis e sem limite até {fecha}. Depois continua grátis com até {p} paradas por dia; sem cartão nunca é cobrado nada. Sem limite: plano {plan} ({precio} €/mês).',
  '{n} días sin tope y gratis. Después sigues gratis con hasta {p} paradas al día; sin tarjeta no se cobra nunca. Sin tope: plan {plan} ({precio} €/mes).':
    '{n} dias grátis e sem limite. Depois continua grátis com até {p} paradas por dia; sem cartão nunca é cobrado nada. Sem limite: plano {plan} ({precio} €/mês).',
  'Prueba gratuita de {n} días. Hoy no se cobra nada y sin tarjeta no se cobra nunca: al acabar eliges si seguir con el plan {plan} ({precio} €/mes).':
    'Teste grátis de {n} dias. Hoje não é cobrado nada e sem cartão nunca é cobrado: no final você escolhe se continua com o plano {plan} ({precio} €/mês).',
  'Creando cuenta…': 'Criando conta…',
  'Crear cuenta con plan {plan}': 'Criar conta com plano {plan}',

  // Primera pantalla de la ruta
  'Ajustes': 'Configurações',
  'Plan gratis: hasta {n} paradas nuevas al día.': 'Plano grátis: até {n} paradas novas por dia.',
  'Mi cartera': 'Minha carteira',
  'Foto etiqueta': 'Foto da etiqueta',
  'o escribe el código': 'ou digite o código',
  'Buscar': 'Buscar',
  'Cargar paquetes: uno tras otro': 'Carregar pacotes: um atrás do outro',
  '{n} por entregar': '{n} para entregar',
  'Escanea cada paquete o hazle una foto a la etiqueta: la dirección y el teléfono entran solos. Luego «Ordenar ruta».':
    'Escaneie cada pacote ou tire uma foto da etiqueta: o endereço e o telefone entram sozinhos. Depois, «Ordenar rota».',
  'Verlo en acción con 3 paradas de ejemplo': 'Ver funcionando com 3 paradas de exemplo',
  'Invitar a un compañero': 'Convidar um colega',
  '1. Mete tus paquetes': '1. Coloque seus pacotes',
  'Escanea el código o haz una foto a la etiqueta: la dirección y el teléfono entran solos. También puedes escribirla o pegar una lista.':
    'Escaneie o código ou tire uma foto da etiqueta: o endereço e o telefone entram sozinhos. Você também pode digitar ou colar uma lista.',
  '2. Ordena la ruta': '2. Organize a rota',
  'Pulsa «Ordenar ruta»: la app pone las paradas en el orden que menos tardas, con el tráfico de cada hora y la hora de llegada a cada una.':
    'Toque em «Ordenar rota»: o app coloca as paradas na ordem mais rápida, com o trânsito de cada hora e o horário de chegada em cada uma.',
  '3. Navega y entrega': '3. Navegue e entregue',
  'Pulsa «Empezar a navegar»: te lleva con voz a cada puerta. Al llegar, «Entregado» con foto o firma, y pasa a la siguiente.':
    'Toque em «Começar a navegar»: o app te leva por voz até cada porta. Ao chegar, «Entregue» com foto ou assinatura, e vai para a próxima.',
  'Siguiente': 'Próximo',

  // Aviso de la mañana
  'Aviso por la mañana': 'Aviso de manhã',
  '¿Te aviso por la mañana para cargar tu ruta?': 'Quer um aviso de manhã para carregar sua rota?',
  'Un aviso a las 8:00, de lunes a sábado, solo si aún no has metido paquetes.': 'Um aviso às 8:00, de segunda a sábado, só se você ainda não tiver colocado pacotes.',
  'Sí, avísame': 'Sim, me avise',
  'No, gracias': 'Não, obrigado',
  'Listo: te aviso a las 8:00 los días que aún no tengas paquetes.': 'Pronto: te aviso às 8:00 nos dias em que você ainda não tiver pacotes.',
  'El móvil no ha dado permiso para avisos. Puedes activarlo en los ajustes del navegador.': 'O celular não deu permissão para avisos. Você pode ativar nas configurações do navegador.',
  'No se han podido activar los avisos en este móvil.': 'Não foi possível ativar os avisos neste celular.',
}
