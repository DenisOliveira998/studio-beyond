import { formatMoney, formatNumber } from "@/lib/i18n";

export type Medium = "livro" | "manga" | "hq" | "conto";

export type Work = {
  id: string;
  slug: string;
  title: string;
  medium: Medium;
  artistSlug: string;
  cover?: string;
  excerpt: string;
  body: string[];
  audio?: boolean;
  clicks: number;
  likes: number;
  published: string;
  readTime?: string;
  genre?: string;
  pages?: number;
};

export type Artist = {
  slug: string;
  name: string;
  discipline: string;
  location: string;
  bio: string;
  initials: string;
  supporters: number;
  works: string[];
};

export const MEDIUM_LABEL: Record<Medium, string> = {
  livro: "Livro",
  manga: "Mangá",
  hq: "HQ",
  conto: "Conto",
};

export const artists: Artist[] = [
  {
    slug: "ana-kiyomi",
    name: "Ana Kiyomi Watanabe",
    discipline: "Mangakista",
    location: "São Paulo",
    initials: "AK",
    supporters: 634,
    bio: "Desenha histórias de vida comum em traço limpo e silêncio. Nascida em São Paulo, filha de imigrantes japoneses, usa o mangá para retratar o cotidiano nipo-brasileiro sem romantismo.",
    works: ["tokiwa-23h", "os-meses-sem-nome"],
  },
  {
    slug: "rafael-bravo",
    name: "Rafael Bravo",
    discipline: "Quadrinista",
    location: "Recife",
    initials: "RB",
    supporters: 411,
    bio: "Cria HQs de viés noir e documental sobre o Nordeste. Trabalha com nanquim e aquarela preta, uma página por semana, sem assistente.",
    works: ["a-ultima-linha", "pedra-e-luz"],
  },
  {
    slug: "leticia-voss",
    name: "Letícia Voss",
    discipline: "Escritora",
    location: "Porto Alegre",
    initials: "LV",
    supporters: 892,
    bio: "Escreve ficção literária sobre herança, silêncio e memória de família. Publicou dois romances por selos independentes; o terceiro nasce aqui, capítulo por capítulo.",
    works: ["o-barulho-das-coisas-quietas", "antes-que-a-mare-mude"],
  },
  {
    slug: "tome-omolade",
    name: "Tomé Omolade",
    discipline: "Contista",
    location: "Salvador",
    initials: "TO",
    supporters: 318,
    bio: "Escreve contos sobre o Sul da Bahia, memória e o que as pessoas carregam quando partem. Acredita que o conto é a forma mais honesta de dizer uma coisa de vez.",
    works: ["sete-historias-para-nao-dormir", "o-fim-de-todas-as-partidas"],
  },
];

export const works: Work[] = [
  /* ── Mangá ─ Ana Kiyomi ── */
  {
    id: "1",
    slug: "tokiwa-23h",
    title: "Tokiwa 23h",
    medium: "manga",
    artistSlug: "ana-kiyomi",
    genre: "Slice of life",
    readTime: "18 capítulos",
    excerpt:
      "Mangá sobre insônia, ônibus noturnos e o tipo de conversa que só acontece quando a cidade já desistiu de ser bonita.",
    body: [
      "Começou como um diário de rascunhos. Eu pegava o 5028-10 às 23h toda quinta, e a cada semana o mesmo vagão, os mesmos rostos exaustos — e ninguém se olhava.",
      "Decidi que esses rostos mereciam nomes. Tokiwa é o ônibus, a linha, a hora. As histórias são deles.",
      "Cada capítulo tem dezesseis páginas e uma única personagem nova. O ônibus é o que conecta.",
    ],
    clicks: 44210,
    likes: 3820,
    published: "3 de agosto de 2026",
  },
  {
    id: "2",
    slug: "os-meses-sem-nome",
    title: "Os Meses Sem Nome",
    medium: "manga",
    artistSlug: "ana-kiyomi",
    genre: "Drama familiar",
    readTime: "6 capítulos",
    excerpt:
      "Uma jovem volta para a casa da avó depois de doze anos. O mangá é sobre o que não foi dito nesse tempo.",
    body: [
      "Minha avó falava japonês e português com a mesma hesitação. Ela dizia que algumas palavras não cabiam nas línguas que ela sabia.",
      "Esse mangá é sobre esse espaço entre as línguas — e entre as gerações que nunca se explicaram direito.",
    ],
    clicks: 19850,
    likes: 1740,
    published: "15 de julho de 2026",
  },

  /* ── HQ ─ Rafael Bravo ── */
  {
    id: "3",
    slug: "a-ultima-linha",
    title: "A Última Linha",
    medium: "hq",
    artistSlug: "rafael-bravo",
    genre: "Noir",
    readTime: "3 volumes",
    excerpt:
      "HQ de detetive ambientada no Recife de 1978. Aquarela preta, sombra dura, diálogos secos.",
    body: [
      "Cresci ouvindo meu pai falar de um Recife que não existe mais. Becos que viraram viadutos, cortiços que viraram estacionamentos.",
      "Trouxe esse Recife de volta no papel — não como nostalgia, mas como acerto de contas. A Última Linha é uma história de detetive, mas o crime real é o que foi feito com a cidade.",
      "O traço é intencional: aquarela só em preto, como fotografia antiga. A cor chegaria depois, mas decidi que não chegaria.",
    ],
    clicks: 28640,
    likes: 2310,
    published: "22 de julho de 2026",
  },
  {
    id: "4",
    slug: "pedra-e-luz",
    title: "Pedra e Luz",
    medium: "hq",
    artistSlug: "rafael-bravo",
    genre: "Documental",
    readTime: "Obra única · 80 págs.",
    pages: 80,
    excerpt:
      "Uma HQ sobre pedreiros que constroem um teatro que nunca vão poder entrar. Baseada em história real.",
    body: [
      "Conheci os filhos dos homens que construíram o Teatro Popular do Nordeste em 1959. Nenhum deles pisou dentro depois da inauguração.",
      "Pedra e Luz é a história deles — os nomes, os rostos, as mãos. Não o teatro.",
    ],
    clicks: 12480,
    likes: 1022,
    published: "9 de julho de 2026",
  },

  /* ── Livro ─ Letícia Voss ── */
  {
    id: "5",
    slug: "o-barulho-das-coisas-quietas",
    title: "O Barulho das Coisas Quietas",
    medium: "livro",
    artistSlug: "leticia-voss",
    genre: "Ficção literária",
    readTime: "12 cap · em andamento",
    excerpt:
      "Romance sobre três irmãs que não se falam há seis anos e precisam esvaziar a casa da mãe morta num fim de semana.",
    body: [
      "Eu escrevi esse livro porque minha família nunca esvaziou nada. As coisas ficam. As pessoas ficam também, mesmo quando partem.",
      "As três irmãs são inventadas, mas o silêncio entre elas é real. Todo mundo conhece esse silêncio.",
      "Publico um capítulo por quinzena. Você lê ao mesmo tempo em que eu escrevo.",
    ],
    clicks: 67230,
    likes: 5810,
    published: "1 de agosto de 2026",
  },
  {
    id: "6",
    slug: "antes-que-a-mare-mude",
    title: "Antes que a Maré Mude",
    medium: "livro",
    artistSlug: "leticia-voss",
    genre: "Ficção histórica",
    readTime: "Completo · 287 págs.",
    pages: 287,
    excerpt:
      "Romance sobre uma comunidade de pescadores na costa gaúcha nos anos 1940, e a mulher que decidiu não partir quando todos partiram.",
    body: [
      "Passei três invernos pesquisando o litoral norte do Rio Grande do Sul antes de escrever uma linha.",
      "O livro não é sobre pescadores. É sobre ficar — a escolha de não seguir quando o mundo inteiro diz que é hora de ir.",
      "A maré como metáfora aparece só uma vez, no último parágrafo. Queria que o leitor chegasse lá sem saber que estava sendo levado.",
    ],
    clicks: 38900,
    likes: 3440,
    published: "14 de junho de 2026",
  },

  /* ── Conto ─ Tomé Omolade ── */
  {
    id: "7",
    slug: "sete-historias-para-nao-dormir",
    title: "Sete Histórias para Não Dormir",
    medium: "conto",
    artistSlug: "tome-omolade",
    genre: "Realismo mágico",
    readTime: "7 contos · 40 min",
    excerpt:
      "Uma coleção de contos sobre o interior da Bahia: mortes que não chegaram, amores que não foram e portas que ninguém deveria abrir.",
    body: [
      "Cresci ouvindo histórias que minha avó chamava de 'causos'. Ela nunca usou a palavra ficção.",
      "Esses sete contos são dela. Eu só passei a limpo.",
      "O sétimo conto foi escrito por último, mas devia ser o primeiro. Sugiro ler fora de ordem.",
    ],
    clicks: 23180,
    likes: 2040,
    published: "28 de julho de 2026",
  },
  {
    id: "8",
    slug: "o-fim-de-todas-as-partidas",
    title: "O Fim de Todas as Partidas",
    medium: "conto",
    artistSlug: "tome-omolade",
    genre: "Conto literário",
    readTime: "1 conto · 18 min",
    excerpt:
      "Um árbitro de futebol apita a última partida de sua vida sem que ninguém saiba. Um conto sobre autoridade silenciosa e despedidas invisíveis.",
    body: [
      "Meu pai foi árbitro por vinte e dois anos. Nunca vi ninguém aplaudir no final de um jogo pelo árbitro.",
      "Esse conto é sobre ele — não ele, mas ele.",
    ],
    clicks: 14720,
    likes: 1280,
    published: "3 de julho de 2026",
  },
];

export const PLATFORM_FEE = 0.12;
export const RATE_PER_CLICK = 0.004;

export function getArtist(slug: string) {
  return artists.find((a) => a.slug === slug);
}

export function getWork(slug: string) {
  return works.find((w) => w.slug === slug);
}

export function worksByArtist(slug: string) {
  return works.filter((w) => w.artistSlug === slug);
}

export const money = (n: number) => formatMoney(n);

export const compact = (n: number) => formatNumber(n);

/* ---------- Contas e administração da plataforma (dados mockados) ---------- */

export type AccountType = "free" | "vip" | "author" | "admin";

export const ACCOUNT_LABEL: Record<AccountType, string> = {
  free: "Gratuito",
  vip: "VIP",
  author: "Autor",
  admin: "Administrador",
};

export type Account = {
  id: string;
  name: string;
  email: string;
  type: AccountType;
  joined: string;
  donated: number;
  suspended?: boolean;
};

export const accounts: Account[] = [
  { id: "u1", name: "Ana Kiyomi Watanabe", email: "ana@thebeyond.art", type: "author", joined: "jan 2026", donated: 0 },
  { id: "u2", name: "Rafael Bravo", email: "rafael@thebeyond.art", type: "author", joined: "fev 2026", donated: 20 },
  { id: "u3", name: "Letícia Voss", email: "leticia@thebeyond.art", type: "author", joined: "fev 2026", donated: 0 },
  { id: "u4", name: "Tomé Omolade", email: "tome@thebeyond.art", type: "author", joined: "mar 2026", donated: 35 },
  { id: "u5", name: "A. Ferreira", email: "a.ferreira@mail.com", type: "vip", joined: "mar 2026", donated: 240 },
  { id: "u6", name: "R. Silva", email: "r.silva@mail.com", type: "vip", joined: "abr 2026", donated: 410 },
  { id: "u7", name: "M. Lindqvist", email: "m.lind@mail.com", type: "free", joined: "abr 2026", donated: 25 },
  { id: "u8", name: "J. Okafor", email: "j.okafor@mail.com", type: "free", joined: "mai 2026", donated: 5 },
  { id: "u9", name: "L. Beaumont", email: "l.beaumont@mail.com", type: "free", joined: "jun 2026", donated: 0, suspended: true },
  { id: "u10", name: "Denis Oliveira", email: "denis@thebeyond.art", type: "admin", joined: "jan 2026", donated: 0 },
];

/** Total de doações recebidas por obra (mockado). */
export const donationsByWork: Record<string, number> = {
  "tokiwa-23h": 520,
  "os-meses-sem-nome": 210,
  "a-ultima-linha": 380,
  "pedra-e-luz": 145,
  "o-barulho-das-coisas-quietas": 840,
  "antes-que-a-mare-mude": 390,
  "sete-historias-para-nao-dormir": 260,
  "o-fim-de-todas-as-partidas": 130,
};

export function workDonations(slug: string) {
  return donationsByWork[slug] ?? 0;
}

/* ---------- Curadoria: candidaturas de autor e obras em revisão (mockado) ---------- */

export type ReviewStatus = "pending" | "approved" | "rejected" | "changes";

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  pending: "Em análise",
  approved: "Aprovada",
  rejected: "Recusada",
  changes: "Ajustes solicitados",
};

export type AuthorApplication = {
  id: string;
  artistName: string;
  email: string;
  field: string;
  bio: string;
  portfolio: string;
  samples: number;
  message?: string;
  submitted: string;
  status: ReviewStatus;
};

export const authorApplications: AuthorApplication[] = [
  {
    id: "c1",
    artistName: "Priya Menezes",
    email: "priya@menezes.art",
    field: "Mangá",
    bio: "Desenho mangá de horror psicológico com influências de J-horror e literatura brasileira. Tenho uma série de 30 páginas inédita.",
    portfolio: "https://priyamenezes.cargo.site",
    samples: 3,
    message: "A série se chama 'Saudade Gótica' — espero que o nome diga tudo.",
    submitted: "24 de agosto de 2026",
    status: "pending",
  },
  {
    id: "c2",
    artistName: "Bruno Falcão",
    email: "bruno@falcaoquadrinhos.com.br",
    field: "HQ",
    bio: "Quadrinhos sobre ciência ficção periférica. Ambientado em 2040, numa São Paulo que sobreviveu às enchentes.",
    portfolio: "https://falcaoquadrinhos.com.br",
    samples: 2,
    submitted: "26 de agosto de 2026",
    status: "pending",
  },
  {
    id: "c3",
    artistName: "Camila Bezerra",
    email: "camila.b@mail.com",
    field: "Livro",
    bio: "Escrevo ficção científica social. Meu romance em andamento acompanha três gerações de uma família nordestina em Marte.",
    portfolio: "https://camilabezerra.substack.com",
    samples: 1,
    message: "Posso enviar os primeiros três capítulos para leitura.",
    submitted: "29 de agosto de 2026",
    status: "pending",
  },
  {
    id: "c4",
    artistName: "Yusuf Adler",
    email: "yusuf@adlerwrites.net",
    field: "Conto",
    bio: "Escrevo contos de especulação literária. Cada história tem exatamente 2.000 palavras — é uma restrição formal que me impus há quatro anos.",
    portfolio: "https://adlerwrites.net",
    samples: 3,
    submitted: "30 de agosto de 2026",
    status: "pending",
  },
];

export type WorkSubmission = {
  id: string;
  title: string;
  artistSlug: string;
  medium: Medium;
  submitted: string;
  status: ReviewStatus;
  note?: string;
};

export const workSubmissions: WorkSubmission[] = [
  {
    id: "s1",
    title: "Tokiwa 23h — Cap. 19",
    artistSlug: "ana-kiyomi",
    medium: "manga",
    submitted: "27 de agosto de 2026",
    status: "pending",
  },
  {
    id: "s2",
    title: "A Sombra do Trapiche",
    artistSlug: "rafael-bravo",
    medium: "hq",
    submitted: "28 de agosto de 2026",
    status: "pending",
  },
  {
    id: "s3",
    title: "O Barulho das Coisas Quietas — Cap. 13",
    artistSlug: "leticia-voss",
    medium: "livro",
    submitted: "30 de agosto de 2026",
    status: "pending",
  },
  {
    id: "s4",
    title: "O Homem que Colecionava Esquecimentos",
    artistSlug: "tome-omolade",
    medium: "conto",
    submitted: "31 de agosto de 2026",
    status: "changes",
    note: "Ajustar o final do segundo parágrafo para consistência de voz com os contos anteriores.",
  },
];

export type SearchHit =
  | { kind: "work"; slug: string; title: string; category: string; cover?: string | undefined }
  | { kind: "artist"; slug: string; title: string; category: string; initials: string };

export function searchAll(query: string): { works: SearchHit[]; artists: SearchHit[] } {
  const q = query.trim().toLowerCase();
  if (!q) return { works: [], artists: [] };

  const w = works
    .filter((work) =>
      [work.title, MEDIUM_LABEL[work.medium], work.genre ?? "", getArtist(work.artistSlug)?.name ?? "", work.excerpt]
        .join(" ")
        .toLowerCase()
        .includes(q),
    )
    .slice(0, 5)
    .map<SearchHit>((work) => ({
      kind: "work",
      slug: work.slug,
      title: work.title,
      category: MEDIUM_LABEL[work.medium],
      cover: work.cover,
    }));

  const a = artists
    .filter((artist) =>
      [artist.name, artist.discipline, artist.location, artist.bio]
        .join(" ")
        .toLowerCase()
        .includes(q),
    )
    .slice(0, 4)
    .map<SearchHit>((artist) => ({
      kind: "artist",
      slug: artist.slug,
      title: artist.name,
      category: artist.discipline,
      initials: artist.initials,
    }));

  return { works: w, artists: a };
}
