/**
 * Seed de obras de teste — 10 por categoria (livro, manga, hq, conto)
 * Execute: npx tsx scripts/seed-test-works.ts
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Carrega .env sem depender do pacote dotenv
const envFile = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
try {
  for (const line of readFileSync(envFile, "utf-8").split("\n")) {
    const m = line.match(/^([^#=\s]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
} catch {}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeSlug(title: string, idx: number) {
  return `${slugify(title)}-${idx.toString(36)}`;
}

const p = (text: string) => `<p>${text}</p>`;
const body = (...pars: string[]) => pars.map(p).join("\n");

// ─── Obras ────────────────────────────────────────────────────────────────────

const WORKS = [
  // ── LIVROS ────────────────────────────────────────────────────────
  {
    medium: "livro",
    title: "O Último Arrebol",
    artistName: "Mariana Luz",
    genre: "Ficção Literária",
    tags: "drama, contemplativo",
    workStatus: "finalizado",
    excerpt: "No dia em que o sol não nasceu, Elisa percebeu que havia esquecido o som da própria voz.",
    body: body(
      "No dia em que o sol não nasceu, Elisa percebeu que havia esquecido o som da própria voz. Três semanas, talvez quatro. O apartamento acumulava silêncio nos cantos como pó.",
      "Ela abriu a janela de qualquer jeito. A cidade lá embaixo seguia seu ritmo surdo — buzinas, passos, a britadeira que sempre começava cedo demais. Mas o céu era uma lona cinza sem emendas, como se alguém tivesse apagado o horizonte com um pano úmido.",
      "O bilhete ainda estava na geladeira. Ela não lera desde a segunda semana. Não precisava: conhecia cada palavra na ordem certa, como uma música que cola no crânio sem pedir licença.",
      "— Você vai ao mercado hoje? — perguntou a vizinha através da parede. Sempre aquela voz penetrante, sempre aquela pergunta.",
      "Elisa respirou fundo. O som que saiu da garganta foi pequeno, como o de um pássaro com medo, mas era um som. Era um começo.",
    ),
  },
  {
    medium: "livro",
    title: "A Cidade Sem Sombras",
    artistName: "Rafael Drummond",
    genre: "Distopia",
    tags: "distopia, ficção científica",
    workStatus: "andamento",
    excerpt: "Em Lumiar, proibir a sombra foi a forma mais elegante de proibir a mentira — e, com ela, a memória.",
    body: body(
      "Em Lumiar, proibir a sombra foi a forma mais elegante de proibir a mentira — e, com ela, a memória. As ruas eram banhadas por luz artificial a cada centímetro, e os cidadãos aprenderam a caminhar olhando para frente, nunca para baixo.",
      "Caio tinha sete anos quando viu a primeira sombra de verdade. Foi embaixo de uma mesa, num quarto de hotel decadente na Zona Cinza. Sua mãe cobriu os olhos dele com a mão, mas já era tarde.",
      "— O que é isso? — ele sussurrou.",
      "— Nada — ela respondeu. — Um defeito no piso.",
      "Ele não acreditou. Sombras não mentem: elas repetem exatamente o que você é, sem ornamento nenhum. Foi isso que o governo entendeu cedo demais.",
      "Vinte anos depois, Caio trabalhava no Departamento de Superfícies Reflectivas. Seu trabalho era garantir que nenhuma sombra persistisse por mais de 0,3 segundos em qualquer ponto da cidade. Era bom no que fazia. Por isso mesmo começou a duvidar de tudo.",
    ),
  },
  {
    medium: "livro",
    title: "Sertão Profundo",
    artistName: "Catarina Vale",
    genre: "Histórico",
    tags: "histórico, drama",
    workStatus: "finalizado",
    excerpt: "Minha avó dizia que o sertão não é um lugar — é um estado da alma que a seca vai revelando aos poucos.",
    body: body(
      "Minha avó dizia que o sertão não é um lugar — é um estado da alma que a seca vai revelando aos poucos. Eu não entendia quando tinha dez anos. Entendia ainda menos quando fiz trinta e voltei para enterrá-la.",
      "A casa de taipa estava de pé, teimosa como ela sempre foi. O teto havia cedido num canto, e pelas telhas quebradas entrava uma lasca de sol às três da tarde, exatamente sobre o lugar onde ela costumava sentar para remendar roupas.",
      "Encontrei as cartas numa lata de biscoito enferrujada debaixo da cama. Duzentas e tantas, todas amarradas com barbante, todas escritas para um homem chamado Benedito que, segundo minha mãe, jamais existiu.",
      "Abri a primeira com cuidado de arqueólogo. A letra era miúda e determinada, sem floreios — a letra de quem aprendeu sozinha, à luz de candeeiro, depois que todos dormiam.",
    ),
  },
  {
    medium: "livro",
    title: "Entre Dois Mares",
    artistName: "Lucas Viana",
    genre: "Aventura",
    tags: "aventura, romance",
    workStatus: "andamento",
    excerpt: "A balsa tinha nome de mulher e cheiro de diesel, e era nela que Tomás carregava tudo que lhe restava.",
    body: body(
      "A balsa tinha nome de mulher e cheiro de diesel, e era nela que Tomás carregava tudo que lhe restava: um baú de ferragens enferrujadas, três mudas de roupa e a fotografia plastificada de uma costa que ninguém mais sabia nomear.",
      "O rio Araguaia estava alto naquele ano. As margens haviam sumido sob um espelho barrento que refletia um céu de novembro. Tomás segurou o leme com as duas mãos e não olhou para trás.",
      "— Quanto falta? — perguntou a menina. Ela tinha aparecido na balsa três dias antes, sem explicação nem bagagem, e ele havia deixado ficar porque seu olhar era do tipo que não aceita não.",
      "— Depende do que você chama de lá — disse ele.",
      "Ela olhou para o horizonte fluvial. O sol estava caindo de lado, tingindo a água de laranja podre.",
      "— Qualquer lugar que não seja aqui — respondeu ela.",
    ),
  },
  {
    medium: "livro",
    title: "O Peso do Silêncio",
    artistName: "Ana Fortuna",
    genre: "Psicológico",
    tags: "psicológico, suspense",
    workStatus: "finalizado",
    excerpt: "Há dois tipos de silêncio: o que existe antes das palavras e o que sobra depois delas. O de Diana era do segundo tipo.",
    body: body(
      "Há dois tipos de silêncio: o que existe antes das palavras e o que sobra depois delas. O de Diana era do segundo tipo — denso, pesado, com bordas afiadas.",
      "O médico chamava de mutismo seletivo. Ela chamava de autopreservação. Havia uma diferença fundamental entre não poder falar e não querer — e ninguém, até então, havia se dado ao trabalho de perguntar de qual dos dois ela sofria.",
      "Na sala de espera da clínica, ela observava os outros pacientes. Uma mulher tricotava com fios vermelhos. Um rapaz balançava o joelho no ritmo de alguma música interna. Um homem mais velho dormia com o queixo no peito.",
      "Todos carregavam algo que não aparecia nas fichas de anamnese. Diana sabia disso porque era psicóloga. Ou havia sido, antes.",
    ),
  },
  {
    medium: "livro",
    title: "Flores de Novembro",
    artistName: "Beatriz Serrano",
    genre: "Contemporâneo",
    tags: "slice of life, drama",
    workStatus: "finalizado",
    excerpt: "Em novembro, tudo florescia na casa dos Serrano — menos os seus moradores.",
    body: body(
      "Em novembro, tudo florescia na casa dos Serrano — menos os seus moradores. A bougainvillea subia pelo muro com entusiasmo tropical. O jardim se enchia de cores que contrastavam com os silêncios à mesa do jantar.",
      "Eram quatro irmãos, dois pais, e um número indefinido de mágoas acumuladas ao longo de décadas. Toda família tem a sua gramática particular — a dos Serrano era feita de não-ditos e de assuntos que migravam de conversa em conversa sem nunca pousar de verdade.",
      "Juliana, a mais nova, voltou de São Paulo num sábado de chuva fina. Trouxe mala pequena e expressão de quem não sabe se ficará muito tempo. A mãe abriu a porta antes que ela tocasse a campainha.",
      "— Eu sabia que você vinha — disse a mãe, como se isso fosse uma acusação.",
    ),
  },
  {
    medium: "livro",
    title: "A Última Profecia",
    artistName: "Marcos Câmara",
    genre: "Fantasia",
    tags: "fantasia, aventura",
    workStatus: "andamento",
    excerpt: "A profecia dizia que o escolhido chegaria às portas de Serran com poeira nos sapatos e dúvida nos olhos. Ninguém esperava que fosse uma entregadora de comida.",
    body: body(
      "A profecia dizia que o escolhido chegaria às portas de Serran com poeira nos sapatos e dúvida nos olhos. Ninguém esperava que fosse uma entregadora de comida.",
      "Laís parou a moto na frente do que o aplicativo indicava como o restaurante, mas o que havia ali era uma torre de pedra cinzenta com janelas em arco. Ela verificou o endereço três vezes.",
      "— Seu pedido? — disse uma voz grave.",
      "Ela ergueu os olhos. Um homem com robe cor de musgo e barba que chegava ao cinto estava no portal.",
      "— Aqui está. Dois hambúrgueres com batata e uma limonada sem açúcar. — Ela estendeu a sacola.",
      "O homem olhou para ela com expressão de quem vê o cumprimento de um destino inevitável.",
      "— A Portadora chegou — sussurrou ele.",
      "— Mais ou menos. Você vai confirmar o recebimento ou não?",
    ),
  },
  {
    medium: "livro",
    title: "Pele de Chuva",
    artistName: "Sofia Matos",
    genre: "Poesia em Prosa",
    tags: "poesia, contemplativo",
    workStatus: "finalizado",
    excerpt: "Escrevo sobre a chuva porque a chuva nunca pede explicação. Ela chega. Ela ensopa. Ela vai embora.",
    body: body(
      "Escrevo sobre a chuva porque a chuva nunca pede explicação. Ela chega. Ela ensopa. Ela vai embora. Se há promessa no trovão é porque o trovão não sabe mentir.",
      "Você me perguntou uma vez por que eu guardo tanta coisa molhada — cartas, fotografias, a passagem de ônibus do dia em que te conheci. Eu disse que não sabia. Sabia.",
      "Toda água carrega o mapa de onde esteve. A que caiu no seu ombro aquela tarde de março ainda existe em algum lugar — na terra, no rio, no ar que respiro agora sem te ver.",
      "Há uma palavra em guarani para a chuva que precede o amanhecer. Aprendi tarde demais para te ensinar. Mas às vezes, quando chove antes do sol, eu a digo em voz alta para ninguém.",
    ),
  },
  {
    medium: "livro",
    title: "Nenhum Passo Atrás",
    artistName: "Diego Antunes",
    genre: "Thriller",
    tags: "suspense, ação",
    workStatus: "andamento",
    excerpt: "O protocolo era claro: se o alvo sumia por mais de 48 horas, o arquivo era encerrado. Fazia 47 horas e trinta e dois minutos.",
    body: body(
      "O protocolo era claro: se o alvo sumia por mais de 48 horas, o arquivo era encerrado. Fazia 47 horas e trinta e dois minutos.",
      "Bruna fechou o notebook e olhou para o mapa estendido sobre a mesa. Três cidades, dois estados, um buraco negro no meio onde a trilha simplesmente parava.",
      "Ela havia rastreado contraventores, lavadores, informantes que moravam em dois países ao mesmo tempo. Nunca havia perdido a trilha assim — de uma hora para outra, como se o sujeito tivesse sido apagado.",
      "Ou como se soubesse que estava sendo seguido.",
      "Seu telefone vibrou. Número desconhecido.",
      "— Você vai parar agora — disse a voz. — Ou não vai parar nunca mais.",
      "Ela desligou. Reabriu o notebook. Continuou.",
    ),
  },
  {
    medium: "livro",
    title: "O Jardim dos Esquecidos",
    artistName: "Isabela Ramos",
    genre: "Fantasia Literária",
    tags: "fantasia, drama",
    workStatus: "paralisado",
    excerpt: "Diz a lenda que no fundo do jardim havia uma porta que só abria para quem havia perdido algo de verdade.",
    body: body(
      "Diz a lenda que no fundo do jardim havia uma porta que só abria para quem havia perdido algo de verdade. Não objeto — perda de verdade é outra coisa. A que dói de manhã antes de você lembrar por quê.",
      "Félix tinha onze anos quando encontrou a porta pela primeira vez. Estava procurando o gato do vizinho num dia de julho. A porta estava entre duas paineiras velhas, pequena demais para um adulto, grande demais para ser ignorada.",
      "Ela era de madeira escura com dobradiças de bronze. Não havia maçaneta — apenas um arco entalhado com flores que ele não soube nomear.",
      "Félix pôs a mão na madeira. A porta aqueceu sob os seus dedos como um animal vivo.",
      "— Você perdeu alguma coisa? — perguntou a porta.",
      "Ele pensou na mãe. Não disse nada. A porta abriu.",
    ),
  },

  // ── MANGÁS ────────────────────────────────────────────────────────
  {
    medium: "manga",
    title: "Sombra e Neon",
    artistName: "Kenji Tavares",
    genre: "Cyberpunk",
    tags: "ação, ficção científica",
    workStatus: "andamento",
    excerpt: "Na Baixada Sintética, quem não tem implante não existe. Riku existia do jeito errado.",
    body: body(
      "Na Baixada Sintética, quem não tem implante não existe. Riku existia do jeito errado — sem chip neural, sem rastreador ótico, sem crédito cirúrgico. Só carne e cabelo mal cortado.",
      "As ruas de neon refletiam na poça de óleo à sua frente. Ele contou as câmeras: sete no cruzamento, duas nos postes laterais, uma móvel no drone que zumbiu sobre sua cabeça e foi embora sem alertar nada.",
      "Sorte. Ou descuido dos deles.",
      "O ponto de encontro era um bar no subsolo que não aparecia em nenhum mapa oficial. A senha era uma música dos anos 2030 que ninguém mais tocava. Ele cantarolou os primeiros quatro compassos para o porteiro.",
      "O porteiro olhou para ele por cinco segundos inteiros.",
      "— Entre — disse finalmente. — E não toque em nada que brilhe.",
    ),
  },
  {
    medium: "manga",
    title: "Horizonte Partido",
    artistName: "Yuki Santos",
    genre: "Drama Escolar",
    tags: "drama, slice of life",
    workStatus: "andamento",
    excerpt: "Toda escola tem um lugar onde os invisíveis se reúnem. No Colégio Horizonte, era a escada de emergência do terceiro andar.",
    body: body(
      "Toda escola tem um lugar onde os invisíveis se reúnem. No Colégio Horizonte, era a escada de emergência do terceiro andar — aquela com a lâmpada queimada e o corrimão frouxo que a manutenção nunca vinha consertar.",
      "Hana descobriu o lugar no primeiro dia de aula, quando fugiu de uma rodada de apresentações na sala. Estava lá: um espaço de silêncio entre barulhos, com vista para o estacionamento e cheiro de tinta velha.",
      "Na segunda semana, encontrou outro habitante. Ele se chamava Tomio, lia quadrinhos com lanterna mesmo de dia e não perguntou o nome dela por três dias seguidos.",
      "Era exatamente o tipo de amizade de que ela precisava.",
    ),
  },
  {
    medium: "manga",
    title: "Dragão do Mangue",
    artistName: "Enzo Nakamura",
    genre: "Fantasia",
    tags: "fantasia, aventura",
    workStatus: "andamento",
    excerpt: "Os pescadores de Corumbá diziam que havia um dragão no mangue. Ninguém acreditava — até que os barcos começaram a afundar de dentro para fora.",
    body: body(
      "Os pescadores de Corumbá diziam que havia um dragão no mangue. Ninguém acreditava — até que os barcos começaram a afundar de dentro para fora.",
      "Kaito tinha dezesseis anos e uma herança indesejada: seu avô havia sido o guardião oficial do mangue, o que, descobriu tarde demais, era um cargo real com responsabilidades reais.",
      "A criatura não era exatamente um dragão. Era mais como um jacaré do tamanho de um ônibus, com escamas que mudavam de cor ao entardecer e olhos que pareciam saber mais do que qualquer animal deveria saber.",
      "— Por que você? — perguntou a criatura na primeira vez que se encontraram. Não com palavras — com um peso que Kaito sentiu atrás dos olhos.",
      "— Meu avô morreu — foi a resposta que ele encontrou.",
      "A criatura fechou os olhos enormes. Pareceu aceitar isso.",
    ),
  },
  {
    medium: "manga",
    title: "Batidas do Asfalto",
    artistName: "Ami Ferreira",
    genre: "Slice of Life Urbano",
    tags: "slice of life, drama",
    workStatus: "finalizado",
    excerpt: "Crescer no subúrbio de São Paulo tem um ritmo próprio — igual ao do trem das 6h17, que atrasa sempre os mesmos três minutos.",
    body: body(
      "Crescer no subúrbio de São Paulo tem um ritmo próprio — igual ao do trem das 6h17, que atrasa sempre os mesmos três minutos. Nina sabia disso de cor, assim como sabia o nome de cada vendedor ambulante da plataforma.",
      "Ela estudava música por conta própria num tablet rachado, usando fones que tampavam só um ouvido. O outro ficava livre para o mundo — o botequim na esquina, a briga de casal no quarto andar, o motoboy que assobiava sempre a mesma música.",
      "Aos dezessete anos, Nina escrevia letras sobre o que via. Ninguém havia pedido. Ninguém ainda havia ouvido. Mas ela escrevia como quem precisa respirar — sem opção, sem aplausos, só por pura necessidade orgânica.",
    ),
  },
  {
    medium: "manga",
    title: "O Mestre das Lâminas",
    artistName: "Ryu Cardoso",
    genre: "Ação Histórica",
    tags: "ação, histórico",
    workStatus: "andamento",
    excerpt: "Na Escola do Vento do Sul, havia uma regra: a lâmina que mata o mestre pertence ao discípulo. Ninguém havia sobrevivido para reclamá-la.",
    body: body(
      "Na Escola do Vento do Sul, havia uma regra: a lâmina que mata o mestre pertence ao discípulo. Ninguém havia sobrevivido para reclamá-la em trezentos anos.",
      "Isso mudou quando Shiro apareceu com doze anos, descalço e sem recomendações, e pediu para ser aceito. O mestre Tanjiro o avaliou por três minutos em silêncio.",
      "— Você não sabe lutar — disse Tanjiro.",
      "— Ainda não — respondeu Shiro.",
      "Havia algo no tom — não arrogância, mas certeza quieta, o tipo que não precisa de plateia. Tanjiro o aceitou naquela tarde. Nunca havia se arrependido. Ainda não havia tido tempo.",
    ),
  },
  {
    medium: "manga",
    title: "Fios de Prata",
    artistName: "Hana Pereira",
    genre: "Romance Sobrenatural",
    tags: "romance, sobrenatural",
    workStatus: "finalizado",
    excerpt: "Todo mundo nasce com um fio de prata no pulso. Só algumas pessoas conseguem ver os fios dos outros.",
    body: body(
      "Todo mundo nasce com um fio de prata no pulso. Só algumas pessoas conseguem ver os fios dos outros. Misaki era uma delas — e preferia não ser.",
      "Os fios se entrelaçavam, se rompiam, mudavam de cor conforme a história das pessoas. O de sua mãe estava cinza-escuro há anos. O de seu pai havia desaparecido quando ela tinha oito anos, de uma forma que ela ainda não entendia direito.",
      "Na escola nova, na primeira semana, ela viu o fio de um colega brilhando com uma cor que ela nunca havia encontrado: dourado-âmbar, como o sol pelas venezianas.",
      "Ela olhou para o dono do fio. Ele a olhou de volta.",
      "— Você pode ver — disse ele. Não era uma pergunta.",
      "Misaki ergueu a mochila no ombro e foi embora sem responder. Mas voltou no dia seguinte.",
    ),
  },
  {
    medium: "manga",
    title: "Último Checkpoint",
    artistName: "Daisuke Lima",
    genre: "Aventura",
    tags: "ação, comédia",
    workStatus: "andamento",
    excerpt: "O jogo dizia que a masmorra final era impossível. Kazuo discordava. Tinha tentado 247 vezes para provar esse ponto.",
    body: body(
      "O jogo dizia que a masmorra final era impossível. Kazuo discordava. Tinha tentado 247 vezes para provar esse ponto.",
      "Na 248ª tentativa, algo diferente aconteceu: a tela não congelou no chefe final. Em vez disso, o dragão abaixou a cabeça, olhou direto para ele através da tela e disse:",
      "— Você de novo.",
      "Kazuo soltou o controle. O controle bateu no chão. O dragão esperou com uma paciência que não estava no código.",
      "— Ei — disse o draguo. — Eu sei que você está aí. Podemos conversar como adultos sobre essa situação?",
      "Kazuo pegou o controle devagar. Havia algo muito errado com a versão 2.4.1 do patch.",
    ),
  },
  {
    medium: "manga",
    title: "Espelhos Partidos",
    artistName: "Mizuki Torres",
    genre: "Psicológico",
    tags: "psicológico, horror",
    workStatus: "andamento",
    excerpt: "A primeira vez que Rei viu seu reflexo se mover antes dela, pensou que estava dormindo em pé.",
    body: body(
      "A primeira vez que Rei viu seu reflexo se mover antes dela, pensou que estava dormindo em pé. A segunda vez, pensou que precisava de óculos. Na terceira, comprou um martelo.",
      "O espelho do banheiro resistiu melhor do que ela esperava. Os cacos ficaram espalhados pelo piso de granito, cada um refletindo um fragmento diferente do seu rosto.",
      "Num dos cacos, o fragmento do seu olho piscou.",
      "Ela saiu do apartamento sem calçar os sapatos. Desceu as escadas em vez do elevador. Ficou do lado de fora por vinte minutos no frio, respirando devagar.",
      "Depois subiu de volta. Porque era seu apartamento, seus espelhos, e ela havia decidido há muito tempo que não fugiria de nada que usasse o próprio rosto.",
    ),
  },
  {
    medium: "manga",
    title: "A Tribo dos Ventos",
    artistName: "Kaito Oliveira",
    genre: "Aventura",
    tags: "aventura, fantasia",
    workStatus: "andamento",
    excerpt: "Há povos que vivem no chão, na água, nas árvores. A Tribo dos Ventos vivia entre — e ninguém no mapa sabia que ela existia.",
    body: body(
      "Há povos que vivem no chão, na água, nas árvores. A Tribo dos Ventos vivia entre — e ninguém no mapa sabia que ela existia.",
      "Sora caiu do céu literalmente: sua asa-delta teve uma pane sobre o Pantanal e ela aterrou no meio de um campo que não devia estar ali. O campo tinha pessoas. As pessoas tinham asas.",
      "Não asas mecânicas. Asas de verdade — membranas translúcidas que dobravam contra o corpo quando não usadas e se abriam com um som de vento ao decolar.",
      "— Você não deveria estar aqui — disse uma menina da mesma idade, com asas cor de entardecer.",
      "— Eu sei — respondeu Sora. — Mas estou.",
      "A menina considerou isso por um momento.",
      "— Você tem fome?",
    ),
  },
  {
    medium: "manga",
    title: "Flores na Névoa",
    artistName: "Sakura Alves",
    genre: "Romance",
    tags: "romance, drama",
    workStatus: "finalizado",
    excerpt: "Eles se conheceram num aplicativo de botânica — ele identificando flores silvestres, ela corrigindo os erros dele.",
    body: body(
      "Eles se conheceram num aplicativo de botânica — ele identificando flores silvestres, ela corrigindo os erros dele. Por três meses, só texto. Sem foto, sem nome, só nomes científicos e discussões sobre polinização.",
      "— Essa não é uma Cattleya labiata — ela escreveu uma terça-feira de madrugada. — É uma Laelia purpurata. A diferença é óbvia se você olhar os sépalos.",
      "— Eu não tenho certeza se sei o que são sépalos — respondeu ele.",
      "— Então aprenda. Plantas merecem ser conhecidas pelo nome certo.",
      "Ele aprendeu. Três meses depois, sabia distinguir trinta espécies de orquídeas nativas. Ainda não sabia o nome dela.",
      "— Por que você nunca pergunta? — ela disse um dia.",
      "— Por que você nunca conta?",
      "Silêncio de cinco minutos. Depois:",
      "— Me chamo Yua. E você erra menos agora.",
    ),
  },

  // ── HQS ───────────────────────────────────────────────────────────
  {
    medium: "hq",
    title: "Concreto",
    artistName: "Bruno Neves",
    genre: "Noir Urbano",
    tags: "suspense, drama",
    workStatus: "finalizado",
    excerpt: "São Paulo não dorme — ela apenas muda de roupa às três da manhã e finge que está bem.",
    body: body(
      "São Paulo não dorme — ela apenas muda de roupa às três da manhã e finge que está bem. Detetive Carla Souza conhecia essa roupa de trás para frente.",
      "O corpo havia sido encontrado no Viaduto do Chá, dobrado sobre o parapeito como um casaco esquecido. Sem documentos, sem sapatos, sem nenhum sinal de violência visível.",
      "— Como a perícia explicou a morte? — perguntou ela ao assistente.",
      "— Não explicou ainda. — Ele consultou o tablet. — Está na lista de espera.",
      "Ela olhou para a cidade espalhada abaixo do viaduto. Oito milhões de pessoas, seis milhões de histórias não contadas, e uma que terminava aqui sem aviso.",
      "— Alguém o colocou aqui — ela disse. — Pessoas mortas não se dobram assim.",
    ),
  },
  {
    medium: "hq",
    title: "A Última Fronteira",
    artistName: "Camila Freire",
    genre: "Ficção Científica",
    tags: "ficção científica, aventura",
    workStatus: "andamento",
    excerpt: "A fronteira entre os dois mundos não era uma linha — era uma faixa de silêncio onde os pássaros não iam.",
    body: body(
      "A fronteira entre os dois mundos não era uma linha — era uma faixa de silêncio onde os pássaros não iam. Os cientistas chamavam de Zona de Transição. Os locais chamavam de onde a sombra começa.",
      "A missão era simples no papel: atravessar, coletar amostras, voltar. Ninguém havia mencionado que a gravidade do outro lado funcionava 23 graus inclinada para o leste.",
      "— Está tudo bem? — perguntou o controle pela radio.",
      "— Defina 'tudo bem' — respondeu Dra. Ventura, ajoelhada num chão de cristal lilás que repicava como vidro a cada passo.",
      "Do outro lado do horizonte, algo se movia. Grande. E claramente curioso.",
    ),
  },
  {
    medium: "hq",
    title: "Sangue e Tinta",
    artistName: "Pedro Valente",
    genre: "Horror",
    tags: "horror, suspense",
    workStatus: "finalizado",
    excerpt: "O quadrinista acordou e descobriu que seus personagens haviam saído das páginas — e estavam furiosos.",
    body: body(
      "O quadrinista acordou e descobriu que seus personagens haviam saído das páginas — e estavam furiosos.",
      "Eram três: o vilão que ele matara no capítulo 12, a heroína que relegara a papel secundário, e um personagem de fundo que aparecera por dois quadros em 2019 e nunca mais.",
      "— Você sabe o que fez — disse o vilão, sentado na poltrona de couro que não era dele.",
      "Marcus olhou para o rascunho na mesa. Páginas e páginas de histórias que ele havia controlado com um lápis.",
      "— É ficção — disse ele.",
      "— Também achávamos — respondeu a heroína.",
    ),
  },
  {
    medium: "hq",
    title: "Diário de Uma Cidade",
    artistName: "Fernanda Costa",
    genre: "Autobiográfico",
    tags: "drama, slice of life",
    workStatus: "finalizado",
    excerpt: "Comecei a desenhar o bairro quando percebi que estava mudando rápido demais para ser lembrado corretamente.",
    body: body(
      "Comecei a desenhar o bairro quando percebi que estava mudando rápido demais para ser lembrado corretamente. A padaria da Dona Zita virou uma clínica de estética. O campo de futebol virou um estacionamento. O bar do Seu Jurandir ainda está lá, mas não por muito tempo.",
      "Nesses cadernos não há heroínas nem vilões. Há o entregador que passa todo dia às 7h21. Há a senhora que rega as plantas da varanda com um regador cor-de-rosa. Há o cachorro que late para o vento mas faz amizade com estranhos.",
      "É sobre isso, no fim das contas. O que a cidade faz conosco sem pedir permissão. E o que a gente faz com ela em troca, em silêncio, sem perceber.",
    ),
  },
  {
    medium: "hq",
    title: "Operação Fantasma",
    artistName: "Rodrigo Bastos",
    genre: "Espionagem",
    tags: "ação, suspense",
    workStatus: "andamento",
    excerpt: "A missão não existia em nenhum arquivo. O agente que a executaria também não.",
    body: body(
      "A missão não existia em nenhum arquivo. O agente que a executaria também não.",
      "Ghost — esse era o nome no briefing que ela nunca deveria ter lido — havia operado por onze anos sem identidade registrada, sem endereço, sem histórico médico. A única prova de sua existência era uma sequência de operações bem-sucedidas e mal atribuídas.",
      "Agora alguém a estava procurando. E esse alguém usava os mesmos métodos que ela.",
      "— Espelho — disse seu contato pelo rádio.",
      "— Fale.",
      "— Você tem um problema. Seu problema tem seu rosto.",
    ),
  },
  {
    medium: "hq",
    title: "A Fabulosa Máquina",
    artistName: "Laís Guerreiro",
    genre: "Steampunk",
    tags: "fantasia, aventura",
    workStatus: "finalizado",
    excerpt: "A máquina prometia fazer qualquer coisa. Íris pediu que trouxesse sua avó de volta. A máquina considerou por três semanas.",
    body: body(
      "A máquina prometia fazer qualquer coisa. Íris pediu que trouxesse sua avó de volta. A máquina considerou por três semanas antes de responder.",
      "— Tecnicamente possível — disse ela, com sua voz de vapor e bronze. — Eticamente complexo.",
      "— Você não tem ética — disse Íris. — Você é uma máquina.",
      "— Tenho protocolos, que é a versão mecânica da ética. — Uma engrenagem girou pensativa. — O problema não é trazê-la de volta. É o que ela vai encontrar quando chegar.",
      "Íris olhou pela janela do ateliê. A cidade de ferro e fumaça se espalhava até o horizonte.",
      "— Você acha que ela não ia gostar?",
      "— Acho que ela ia amar. E esse é o verdadeiro problema.",
    ),
  },
  {
    medium: "hq",
    title: "Olhos de Lobo",
    artistName: "Tadeu Pires",
    genre: "Faroeste",
    tags: "ação, histórico",
    workStatus: "finalizado",
    excerpt: "No sertão de 1887, a lei chegava a cavalo e saía mais depressa ainda. O que ficava era o povo.",
    body: body(
      "No sertão de 1887, a lei chegava a cavalo e saía mais depressa ainda. O que ficava era o povo — e o povo aprendia a resolver seus problemas com os meios disponíveis.",
      "Tereza não havia escolhido ser rastreadora. Havia escolhido sobreviver, que dava no mesmo nessa parte do mundo.",
      "O coronel Figueiroa pagava bem e perguntava pouco sobre métodos. Era o tipo de empregador que ela aceitava sem reservas morais.",
      "O alvo desta vez era um homem que havia desaparecido com quarenta cabeças de gado e a dignidade do coronel, nessa ordem de importância.",
      "Ela estudou o rastro no chão seco por menos de um minuto.",
      "— Três dias — disse para o capanga ao lado. — Ele está com três dias de vantagem e está indo na direção errada.",
      "— Por que errada?",
      "— Porque eu estou na certa.",
    ),
  },
  {
    medium: "hq",
    title: "Memórias da Orla",
    artistName: "Juliana Melo",
    genre: "Drama",
    tags: "drama, contemplativo",
    workStatus: "finalizado",
    excerpt: "Cada verão deixava uma marca diferente na casa da praia. O problema era distinguir quais marcas eram das marés e quais eram nossas.",
    body: body(
      "Cada verão deixava uma marca diferente na casa da praia. O problema era distinguir quais marcas eram das marés e quais eram nossas.",
      "A família Mendonça alugava a mesma casa há vinte e dois anos. Três gerações, seis sobrinhos, uma avó que insistia em entrar no mar até a cintura mesmo com artrite no joelho.",
      "Neste verão, a avó havia dito que seria o último. Ninguém comentou. Todos sabiam.",
      "A neta mais velha, que tinha agora a mesma idade que a avó quando alugaram a casa pela primeira vez, sentou na varanda com ela uma manhã e tentou encontrar as palavras certas.",
      "Não encontrou. A avó tomou seu café devagar e disse:",
      "— O mar ainda está lá. Isso é suficiente por hoje.",
    ),
  },
  {
    medium: "hq",
    title: "Circuito Fechado",
    artistName: "Henrique Brum",
    genre: "Cyberpunk",
    tags: "ficção científica, ação",
    workStatus: "andamento",
    excerpt: "A cidade era um circuito — e alguém havia inserido um vírus no coração dela.",
    body: body(
      "A cidade era um circuito — e alguém havia inserido um vírus no coração dela.",
      "Os semáforos pararam de funcionar às 3h42 de uma quinta-feira. Os sistemas de água automatizados rodavam em loop. As câmeras de segurança mostravam imagens de seis horas atrás.",
      "A técnica Vera foi chamada às 4h15. Encontrou o ponto de entrada às 6h. Era elegante — não pela sofisticação técnica, mas pela audácia: alguém havia hackeado o sistema usando as câmeras como antenas.",
      "— Quem faria isso? — perguntou o diretor de segurança.",
      "Vera olhou para as imagens congeladas nas telas. Uma delas mostrava a si mesma, entrando no prédio seis horas antes, com uma expressão que ela não reconhecia no próprio rosto.",
      "— Alguém que conhece o sistema muito bem — respondeu ela devagar.",
    ),
  },
  {
    medium: "hq",
    title: "Vozes da Periferia",
    artistName: "Tais Carvalho",
    genre: "Documental",
    tags: "drama, histórico",
    workStatus: "finalizado",
    excerpt: "Esta é uma história composta de outras histórias. Os nomes foram trocados, mas as cicatrizes são verdadeiras.",
    body: body(
      "Esta é uma história composta de outras histórias. Os nomes foram trocados, mas as cicatrizes são verdadeiras.",
      "Cresci no Jardim Ângela numa época em que o bairro aparecia nos jornais por uma razão só. Aprendi cedo que estatística tem rosto e endereço.",
      "Esse trabalho começou como um diário pessoal e virou outra coisa no processo — parte memória, parte homenagem, parte acerto de contas com uma cidade que consome seus periféricos e nunca agradece.",
      "Para as pessoas nestas páginas: vocês existem aqui de verdade, mesmo sem os nomes verdadeiros.",
    ),
  },

  // ── CONTOS ────────────────────────────────────────────────────────
  {
    medium: "conto",
    title: "A Noite em que o Rio Parou",
    artistName: "Carmen Sousa",
    genre: "Realismo Mágico",
    tags: "sobrenatural, drama",
    workStatus: "finalizado",
    excerpt: "O Rio Paraná parou de fluir numa terça-feira às 22h, e ninguém na cidade de Guaíra dormiu naquela noite.",
    body: body(
      "O Rio Paraná parou de fluir numa terça-feira às 22h, e ninguém na cidade de Guaíra dormiu naquela noite.",
      "O fenômeno não tinha explicação hidrológica. A água simplesmente ficou parada, lisinha como espelho, sem onda nem corrente nem o barulho constante que os moradores mais velhos diziam já não ouvir de tanto estar lá.",
      "Uma criança perguntou para a avó se o rio havia morrido.",
      "— Rios não morrem — a avó respondeu. — Às vezes eles param para ouvir.",
      "Às 3h47 da manhã, o Paraná voltou a correr. Mas deixou alguma coisa na margem: uma camada fina de silte prateado que nenhum geólogo conseguiu classificar. E, de acordo com quem estava lá, o cheiro de flores de março no meio de julho.",
      "Dez anos depois, as flores crescem todos os anos naquele trecho de margem. Sem razão. Sem estação. Como se o rio ainda estivesse pagando uma dívida.",
    ),
  },
  {
    medium: "conto",
    title: "Carta para Ninguém",
    artistName: "Eduardo Lima",
    genre: "Drama",
    tags: "drama, contemplativo",
    workStatus: "finalizado",
    excerpt: "Escrevo esta carta sabendo que não vai chegar. Escrevo do mesmo jeito.",
    body: body(
      "Escrevo esta carta sabendo que não vai chegar. Escrevo do mesmo jeito.",
      "Você está morto há quatro anos, e eu ainda não aprendi a falar no passado quando falo de você. Minha terapeuta diz que isso é normal. Eu digo que normal é uma palavra para coisas que têm solução.",
      "Ontem vi um homem na padaria que tinha o mesmo jeito de dobrar o jornal. Fiquei dois minutos parado na calçada como um idiota antes de lembrar.",
      "Lembrar é a palavra errada. Eu sempre sei. É só que o corpo esquece antes da cabeça.",
      "Hoje está frio. Você odiava frio. Sempre roubava o cobertor e depois me culpava.",
      "Eu deixava.",
      "Estou bem. Às vezes.",
    ),
  },
  {
    medium: "conto",
    title: "O Último Trem das Seis",
    artistName: "Verônica Duarte",
    genre: "Suspense",
    tags: "suspense, horror",
    workStatus: "finalizado",
    excerpt: "O trem das seis sempre chegava pontual. Exceto na noite em que Paulo precisava que ele chegasse.",
    body: body(
      "O trem das seis sempre chegava pontual. Exceto na noite em que Paulo precisava que ele chegasse.",
      "Eram 18h12. A plataforma estava vazia. Não apenas sem pessoas — vazia de uma forma que a plataforma da estação Carandiru nunca estava: sem som, sem vento, sem os pardais que viviam nas vigas.",
      "Paulo olhou para o relógio. Para o trilho. Para o escuro do túnel que engolia a linha em ambas as direções.",
      "A tela de informações mostrava: TREM 6 - 17h58 - CHEGANDO.",
      "Havia chegado. Há quatorze minutos. Mas a plataforma estava vazia.",
      "Algo se mexeu no fundo do túnel. Paulo não tinha lanterna. Mas tinha a certeza absoluta, do tipo que dispensa evidência, de que o que estava ali sabia que ele estava aqui.",
    ),
  },
  {
    medium: "conto",
    title: "Três Perguntas para o Abismo",
    artistName: "André Pessoa",
    genre: "Fantasia Filosófica",
    tags: "fantasia, psicológico",
    workStatus: "finalizado",
    excerpt: "A lenda dizia que o abismo respondia três perguntas por vida. Ninguém sabia o que acontecia com quem perguntava quatro.",
    body: body(
      "A lenda dizia que o abismo respondia três perguntas por vida. Ninguém sabia o que acontecia com quem perguntava quatro.",
      "Eleonora havia guardado as suas com cuidado durante vinte e dois anos. Havia visto vizinhos desperdiçarem as deles em trivialidades — onde estão as chaves, vai chover amanhã, ele me ama.",
      "Sua primeira pergunta foi aos quarenta e um anos: — O que eu deveria ter feito diferente?",
      "O abismo ficou em silêncio por uma hora. Depois respondeu com outra pergunta:",
      "— Diferente do quê?",
      "Eleonora percebeu que havia desperdiçado a primeira.",
    ),
  },
  {
    medium: "conto",
    title: "Café com Memórias",
    artistName: "Rita Barros",
    genre: "Slice of Life",
    tags: "slice of life, romance",
    workStatus: "finalizado",
    excerpt: "O café ficava na esquina há quarenta anos e guardava segredos como xícara guarda calor — por um tempo, com cuidado, até que esfria.",
    body: body(
      "O café ficava na esquina há quarenta anos e guardava segredos como xícara guarda calor — por um tempo, com cuidado, até que esfria.",
      "Marta era garçonete há dezoito anos. Sabia o pedido de todo cliente regular antes de chegar à mesa. O senhor da janela queria café coado, sem açúcar, com o jornal do dia. A professora da tarde queria chá de camomila e uma fatia de torta de limão, mas só se houvesse.",
      "E havia Pedro, que vinha toda terça e quinta, sempre sozinho, sempre com um livro que nunca terminava no café.",
      "Um dia ele perguntou:",
      "— Você sabe o que eu vou pedir antes de eu chegar?",
      "— Café com leite quente e um croissant — ela respondeu. — Desde 2019.",
      "Ele fechou o livro.",
      "— Eu deveria ser mais imprevisível.",
      "— Ou não — disse Marta, trazendo o pedido sem precisar anotar.",
    ),
  },
  {
    medium: "conto",
    title: "A Caça",
    artistName: "Nelson Primo",
    genre: "Thriller Rural",
    tags: "suspense, ação",
    workStatus: "finalizado",
    excerpt: "No cerrado, a regra é simples: você caça ou é caçado. O problema começa quando o caçador não sabe que virou presa.",
    body: body(
      "No cerrado, a regra é simples: você caça ou é caçado. O problema começa quando o caçador não sabe que virou presa.",
      "Armando havia entrado na reserva ilegal com dois comparsas e equipamento que custava mais do que a maioria das casas da cidade mais próxima. Havia saído sozinho, sem equipamento, descalço.",
      "Ele não sabia dizer exatamente quando os outros dois haviam sumido. Não havia barulho, não havia luta. Apenas um momento em que estavam lá e um momento em que não estavam mais.",
      "A floresta tinha sons. Tinha sempre sons, era isso que as pessoas que não a conheciam não entendiam. O silêncio na floresta era o sinal de perigo.",
      "Estava muito silencioso.",
    ),
  },
  {
    medium: "conto",
    title: "Quando a Maré Vira",
    artistName: "Patricia Leal",
    genre: "Drama",
    tags: "drama, contemplativo",
    workStatus: "finalizado",
    excerpt: "Vovó dizia que quando a maré virava, era hora de largar o que não queria mais carregar.",
    body: body(
      "Vovó dizia que quando a maré virava, era hora de largar o que não queria mais carregar.",
      "Éramos três na praia naquela tarde — eu, minha irmã, e a memória dela entre nós como uma terceira pessoa que não precisava de cadeira.",
      "A maré estava baixando. Você podia ver as pedras que ficavam escondidas durante o dia inteiro, cobertas por água morena e algas. Feias de perto, mas essenciais à lógica do lugar.",
      "Minha irmã jogou uma pedra n'água. Depois outra. Depois parou e ficou olhando para o horizonte por tanto tempo que eu comecei a me preocupar.",
      "— Você está bem? — perguntei.",
      "— Estou pensando — ela disse. — Às vezes precisamos de maré alta para não ver certas coisas.",
      "Fiquei em silêncio. Achei que entendia.",
    ),
  },
  {
    medium: "conto",
    title: "Equinócio",
    artistName: "Sérgio Braga",
    genre: "Ficção Científica",
    tags: "ficção científica, psicológico",
    workStatus: "finalizado",
    excerpt: "Na data exata do equinócio, por exatos doze minutos, era possível ouvir o que os outros pensavam. O problema era que ninguém queria.",
    body: body(
      "Na data exata do equinócio, por exatos doze minutos, era possível ouvir o que os outros pensavam. O problema era que ninguém queria.",
      "O fenômeno tinha sido descoberto em 2031 por acidente, como quase tudo que muda o mundo. Uma pesquisadora de ondas cerebrais havia deixado o equipamento ligado durante uma tempestade geomagnética e voltado para encontrar dados que não faziam sentido em nenhum modelo existente.",
      "Agora, toda primavera, as cidades esvaziavam. As pessoas ficavam em casa, com fones de ouvido, com música no volume máximo, com qualquer coisa que preenchesse os doze minutos.",
      "Exceto os que ficavam nas praças públicas de propósito. Que chegavam cedo, encontravam um banco, e ouviam.",
      "Todos tinham seus motivos. A pesquisadora dizia que era o único momento em que a humanidade era completamente honesta consigo mesma.",
      "— E o que você ouve? — alguém sempre perguntava.",
      "— Medo — ela dizia. — Medo de todo o tipo. Mas também, às vezes, um barulho muito parecido com alívio.",
    ),
  },
  {
    medium: "conto",
    title: "O Dom dos Loucos",
    artistName: "Celeste Rocha",
    genre: "Fantasia",
    tags: "fantasia, sobrenatural",
    workStatus: "finalizado",
    excerpt: "Dizem que os loucos veem o que os outros não querem ver. Bernardete preferia acreditar que via o que os outros ainda não podiam.",
    body: body(
      "Dizem que os loucos veem o que os outros não querem ver. Bernardete preferia acreditar que via o que os outros ainda não podiam.",
      "As criaturas haviam começado a aparecer aos sete anos — não assustadoras, apenas presentes, como vizinhos que você aprende a cumprimentar sem perguntar muito sobre a vida deles.",
      "Havia um ser pequeno que vivia na horta da escola e roía as folhas de couve com expressão culpada quando a notavam. Havia uma figura translúcida que acompanhava o padre nas missas de domingo e parecia se entediar tanto quanto Bernardete.",
      "Havia, principalmente, uma mulher de cabelo branco que aparecia toda vez que alguém ia morrer. Bernardete a chamava de Dona Irene. Não sabia por quê. O nome simplesmente parecia certo.",
      "Dona Irene havia aparecido três vezes este mês. Bernardete comprou flores para os três.",
    ),
  },
  {
    medium: "conto",
    title: "Nós, os Restantes",
    artistName: "Fábio Monteiro",
    genre: "Distopia",
    tags: "distopia, ficção científica",
    workStatus: "finalizado",
    excerpt: "Depois que os outros foram embora, nós que ficamos tivemos que decidir o que fazer com os silêncios que deixaram.",
    body: body(
      "Depois que os outros foram embora, nós que ficamos tivemos que decidir o que fazer com os silêncios que deixaram.",
      "O êxodo havia sido gradual — isso ninguém esperava. Não havia sido uma catástrofe nem um evento claro. Havia sido uma soma de decisões individuais que, na retrospectiva, formava um padrão óbvio.",
      "Primeiro foram os que tinham recurso para ir. Depois os que tinham motivo urgente. Depois todos que conseguiram uma razão qualquer.",
      "Nós, os restantes, ficamos por razões que não sabíamos nomear. Amor ao lugar, inércia, falta de dinheiro, teimosia — tudo misturado de uma forma que seria humilhante analisar de perto.",
      "Ficamos. E o silêncio foi enorme no começo.",
      "Mas os silêncios, descobrimos, também têm ritmo. E ritmo é a base de tudo que é possível construir.",
    ),
  },
] as const;

// ─── Execução ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🌱 Inserindo ${WORKS.length} obras de teste...`);

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < WORKS.length; i++) {
    const w = WORKS[i];
    const slug = makeSlug(w.title, i);

    // Pula se já existir
    const exists = await prisma.work.findUnique({ where: { slug } });
    if (exists) {
      console.log(`  ⏩ ${w.title} (já existe)`);
      skipped++;
      continue;
    }

    await prisma.work.create({
      data: {
        slug,
        title: w.title,
        medium: w.medium as "livro" | "manga" | "hq" | "conto",
        artistName: w.artistName,
        artistSlug: slugify(w.artistName),
        excerpt: w.excerpt,
        body: w.body,
        genre: w.genre,
        tags: w.tags,
        status: "approved",
        workStatus: w.workStatus as "andamento" | "finalizado" | "paralisado",
        publishedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000), // datas escalonadas
      },
    });

    console.log(`  ✓ [${w.medium.toUpperCase()}] ${w.title}`);
    created++;
  }

  console.log(`\n✅ Concluído: ${created} criadas, ${skipped} ignoradas.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
