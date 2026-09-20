/**
 * Seed de obras de teste — 5 por nova categoria (lightnovel, manhwa, manhua)
 * Execute: npx tsx scripts/seed-new-categories.ts
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

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

// Webtoon: body é um JSON array de URLs de imagem (formato portrait 800×1200)
function webtoonBody(seed: string, count = 12): string {
  const urls = Array.from(
    { length: count },
    (_, i) => `https://picsum.photos/seed/${seed}-${i}/800/1200`,
  );
  return JSON.stringify(urls);
}

// Offset: obras existentes ocupam índices 0–39
const BASE = 40;

const WORKS = [
  // ── LIGHT NOVELS ─────────────────────────────────────────────────
  {
    medium: "lightnovel",
    title: "Renascida no Mundo Errado",
    artistName: "Akemi Costa",
    genre: "Isekai",
    tags: "aventura, fantasia",
    workStatus: "andamento",
    excerpt:
      "Ela morreu atropelada por um caminhão e acordou com o status de 'Heroína Invocada'. O problema era que o sistema havia cometido um erro de cadastro.",
    body: body(
      "Ela morreu atropelada por um caminhão de entregas e acordou com o status de 'Heroína Invocada'. O problema era que o sistema havia cometido um erro de cadastro.",
      "STATUS DO PERSONAGEM",
      "Nome: Miyabi Fujiwara | Classe: Heroína (ERRO: tipo incorreto) | Nível: 1 | Habilidades: [Culinária Lv. 9] [Gestão de Orçamento Lv. 7] [Resistência ao Caos Lv. MAX]",
      "— Este sistema é uma piada — disse ela para o nada.",
      "— CONFIRMADO — respondeu o nada.",
      "— Você acabou de falar.",
      "— AFIRMATIVO. SOU O SISTEMA DE SUPORTE DA HEROÍNA. ESTOU OPERACIONAL EM 37% DE CAPACIDADE APÓS O ERRO DE INVOCAÇÃO.",
      "Miyabi ficou sentada num campo de grama roxa por um longo momento. O céu era dois tons de verde. Ao longe, havia o que parecia ser um castelo, ou talvez um cogumelo muito grande.",
      "— Ok — disse ela. — Vamos resolver isso de forma organizada.",
      "— INESPERADO. PROCESSANDO.",
    ),
  },
  {
    medium: "lightnovel",
    title: "O Cavaleiro que Nunca Dormia",
    artistName: "Shin Braga",
    genre: "Fantasia",
    tags: "ação, aventura",
    workStatus: "andamento",
    excerpt:
      "A maldição era simples: ele nunca dormiria. A consequência não era — quem nunca dorme vê tudo que as pessoas escondem na escuridão.",
    body: body(
      "A maldição era simples: ele nunca dormiria. A consequência não era — quem nunca dorme vê tudo que as pessoas escondem na escuridão.",
      "Aldric havia recebido a maldição aos dezoito anos por insultar uma feiticeira em momento de mau humor. Vinte anos depois, havia aprendido a apreciar os benefícios.",
      "As batalhas eram mais fáceis quando você não precisava de guarda noturna. Os planos inimigos revelavam-se todos na hora em que os arquitetos desses planos cochilavam.",
      "O problema eram os sonhos.",
      "Não os seus — ele não tinha. Eram os sonhos das outras pessoas, que às vezes vazavam. O cavaleiro da guarda que sonhava com a mãe que havia abandonado. A rainha que sonhava com o reino que havia destruído. O rei que sonhava, toda noite, com a mesma escolha que não havia feito.",
      "Aldric caminhava pelos corredores noturnos e carregava segredos que não lhe pertenciam, como um arquivo que não havia pedido para guardar.",
    ),
  },
  {
    medium: "lightnovel",
    title: "Acadêmica de Magia: Ano Zero",
    artistName: "Rin Oliveira",
    genre: "Fantasia Escolar",
    tags: "fantasia, drama",
    workStatus: "andamento",
    excerpt:
      "A Acadêmica Helios eliminava 90% dos candidatos no exame de admissão. O que tornava Sora suspeita era que ela havia passado sem usar magia nenhuma.",
    body: body(
      "A Acadêmica Helios tinha uma tradição: o exame de admissão eliminava 90% dos candidatos. O que tornava Sora suspeita era que ela havia passado sem usar magia nenhuma.",
      "— Como você explica isso? — perguntou o examinador, olhando para a ficha dela com expressão de quem encontrou um erro de cálculo que não deveria existir.",
      "— Sorte — disse Sora.",
      "— A prova de manipulação elemental marcou zero de aptidão mágica. E mesmo assim você completou todos os desafios.",
      "— Qual foi seu método para atravessar o labirinto de fogo?",
      "— Esperei até o controlador do labirinto precisar ir ao banheiro. Entrei nesse intervalo.",
      "— Você esperou seis horas e meia por uma janela de quatro minutos?",
      "— Três minutos e quarenta e dois segundos — ela corrigiu. — Eu tinha cronômetro.",
      "O examinador fez uma anotação. Depois outra. Fechou o caderno.",
      "— Sua admissão foi aprovada por razões que ainda estou processando.",
    ),
  },
  {
    medium: "lightnovel",
    title: "A Biblioteca do Fim do Mundo",
    artistName: "Yomi Carvalho",
    genre: "Mistério",
    tags: "mistério, fantasia",
    workStatus: "finalizado",
    excerpt:
      "A biblioteca existia no espaço entre dois segundos — onde todo livro já escrito existia, incluindo os que ninguém havia escrito ainda.",
    body: body(
      "A biblioteca existia no espaço entre dois segundos — um lugar onde todo livro já escrito existia, incluindo os que ninguém havia escrito ainda.",
      "Hana descobriu a entrada por acidente: uma rachadura de luz entre a estante de história medieval e a de ficção científica da biblioteca pública do bairro.",
      "Do outro lado havia corredores que iam até o infinito em todas as direções. As prateleiras chegavam até um teto que não tinha.",
      "Uma criatura pequena, com óculos redondos e aparência de ter dormido mal por três séculos, olhou para ela de cima dos óculos.",
      "— Você não deveria estar aqui.",
      "— Onde é aqui?",
      "— Onde todos os livros são. Os que foram, os que são, os que serão escritos, os que poderiam ter sido escritos se as circunstâncias fossem outras.",
      "— Esses últimos são os mais trágicos? — Hana perguntou.",
      "O guardião parou. Olhou para ela com nova atenção.",
      "— A maioria dos visitantes pergunta se pode ficar. Você pergunta sobre os livros.",
      "— Os livros são mais interessantes do que eu.",
      "— — disse o guardião. — Talvez você possa ficar.",
    ),
  },
  {
    medium: "lightnovel",
    title: "O Sistema do Vilão",
    artistName: "Kuro Silva",
    genre: "Isekai",
    tags: "fantasia, comédia",
    workStatus: "andamento",
    excerpt:
      "Ele acordou como o vilão do romance que havia lido na semana passada. O vilão morria no capítulo 12. Ele estava no capítulo 3.",
    body: body(
      "Ele acordou como o vilão do romance que havia lido na semana passada. O problema era que o vilão morria no capítulo 12, e ele estava no capítulo 3.",
      "MISSÃO DO SISTEMA: COMPLETAR O ARCO DO VILÃO",
      "STATUS: Ren Blackwood | Nível 15 | Carisma: 87 | Crueldade: MÍNIMA (INCOMPATÍVEL) | Reputação: Temido e Odiado | Sentimento pessoal: PAVOR",
      "— Por que minha crueldade está em mínima? — Ren perguntou ao espelho do quarto suntuoso que não era seu.",
      "— PORQUE VOCÊ PASSOU OS ÚLTIMOS TRÊS DIAS DANDO FOLGA AOS SERVOS E PEDINDO DESCULPA POR TUDO.",
      "— Eles trabalham muito.",
      "— VOCÊ É SUPOSTAMENTE O TERROR DO CONTINENTE.",
      "Tenho nove capítulos para não morrer — disse Ren. — Vou precisar de um plano que não envolva ser cruel com ninguém.",
      "— TECNICAMENTE POSSÍVEL. CALCULANDO PROBABILIDADES.",
      "— E?",
      "— BAIXAS. MAS VOCÊ É O ÚNICO USUÁRIO QUE JÁ PERGUNTOU 'E' EM VEZ DE 'QUANTO'. PROCESSANDO NOVA ESTRATÉGIA.",
    ),
  },

  // ── MANHWA ────────────────────────────────────────────────────────
  {
    medium: "manhwa",
    title: "Quando o Verão Acabar",
    artistName: "Ji-Soo Han",
    genre: "Romance",
    tags: "romance, drama",
    workStatus: "andamento",
    excerpt:
      "Cada verão na cidade litorânea de Sora era igual ao anterior — até que ele voltou após sete anos, sem avisar, como se o tempo não existisse entre eles.",
    body: webtoonBody("manhwa-summer", 14),
  },
  {
    medium: "manhwa",
    title: "O Rei dos Ladrões",
    artistName: "Park Min-Joon",
    genre: "Ação",
    tags: "ação, aventura",
    workStatus: "andamento",
    excerpt:
      "No submundo de Seul, havia uma regra: ninguém rouba do Rei. O problema era que ninguém havia dito isso para ela.",
    body: webtoonBody("manhwa-thief", 13),
  },
  {
    medium: "manhwa",
    title: "Três Vidas, Uma Memória",
    artistName: "Kim Ye-Jin",
    genre: "Fantasia",
    tags: "fantasia, romance",
    workStatus: "finalizado",
    excerpt:
      "Ela havia morrido nas mãos dele em duas vidas anteriores. Na terceira, decidiu lembrar.",
    body: webtoonBody("manhwa-lives", 15),
  },
  {
    medium: "manhwa",
    title: "Café às 2h da Manhã",
    artistName: "Lee Soo-Yeon",
    genre: "Slice of Life",
    tags: "slice of life, romance",
    workStatus: "andamento",
    excerpt:
      "O café só abria das 22h às 4h. Os clientes tinham em comum o fato de não terem onde mais ir.",
    body: webtoonBody("manhwa-cafe", 12),
  },
  {
    medium: "manhwa",
    title: "A Guardiã do Portal",
    artistName: "Choi Hana",
    genre: "Fantasia",
    tags: "fantasia, ação",
    workStatus: "andamento",
    excerpt:
      "O portal entre mundos estava aberto há mil anos. Ela era a última guardiã — e a primeira que preferia fechar a porta.",
    body: webtoonBody("manhwa-portal", 13),
  },

  // ── MANHUA ────────────────────────────────────────────────────────
  {
    medium: "manhua",
    title: "A Imperatriz de Jade",
    artistName: "Wei Xian-Yue",
    genre: "Fantasia Histórica",
    tags: "fantasia, drama",
    workStatus: "andamento",
    excerpt:
      "Ela foi enviada ao palácio como concubina de terceira classe. Em cinco anos, seria a mulher mais temida do Império.",
    body: webtoonBody("manhua-empress", 15),
  },
  {
    medium: "manhua",
    title: "O Mestre das Cinco Artes",
    artistName: "Chen Bo-Lin",
    genre: "Wuxia",
    tags: "ação, aventura",
    workStatus: "andamento",
    excerpt:
      "Nas Montanhas do Norte havia um mestre que ensinava apenas cinco alunos por geração. Desta vez aceitou seis. O sexto não estava na lista.",
    body: webtoonBody("manhua-wuxia", 14),
  },
  {
    medium: "manhua",
    title: "Reencarnada como a Inimiga",
    artistName: "Lin Mei-Hua",
    genre: "Romance Histórico",
    tags: "romance, fantasia",
    workStatus: "andamento",
    excerpt:
      "Na vida anterior, ela havia destruído o clã rival sem hesitação. Nesta vida, havia nascido como filha desse clã. O karma tinha senso de humor cruel.",
    body: webtoonBody("manhua-reborn", 13),
  },
  {
    medium: "manhua",
    title: "O Demônio do Lago Espelho",
    artistName: "Zhao Fei-Long",
    genre: "Fantasia",
    tags: "fantasia, sobrenatural",
    workStatus: "finalizado",
    excerpt:
      "O lago só refletia o que você era, não o que você parecia. Na aldeia, ninguém olhava para ele há cem anos. A forasteira foi a primeira a tentar.",
    body: webtoonBody("manhua-lake", 12),
  },
  {
    medium: "manhua",
    title: "Filha do Vento Norte",
    artistName: "Huang Xiao-Ling",
    genre: "Aventura",
    tags: "aventura, ação",
    workStatus: "andamento",
    excerpt:
      "Ela cresceu nas estepes, livre. Quando o Imperador a chamou para a corte como 'presente diplomático', ela foi — mas não como presente.",
    body: webtoonBody("manhua-steppe", 14),
  },
];

// ─── Execução ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🌱 Inserindo ${WORKS.length} obras (lightnovel, manhwa, manhua)...`);

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < WORKS.length; i++) {
    const w = WORKS[i];
    const globalIdx = BASE + i;
    const slug = makeSlug(w.title, globalIdx);
    const coverUrl = `https://picsum.photos/seed/beyond-${globalIdx}/600/900`;

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
        medium: w.medium as "lightnovel" | "manhwa" | "manhua",
        artistName: w.artistName,
        artistSlug: slugify(w.artistName),
        excerpt: w.excerpt,
        body: w.body,
        genre: w.genre,
        tags: w.tags,
        coverUrl,
        status: "approved",
        workStatus: w.workStatus as "andamento" | "finalizado" | "paralisado",
        publishedAt: new Date(Date.now() - globalIdx * 24 * 60 * 60 * 1000),
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
