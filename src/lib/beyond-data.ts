export type Medium = "visual" | "writing" | "music" | "illustration";

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
  visual: "Arte visual",
  writing: "Escrita",
  music: "Música",
  illustration: "Ilustração",
};

export const artists: Artist[] = [
  {
    slug: "mira-okonkwo",
    name: "Mira Okonkwo",
    discipline: "Pintora",
    location: "Lisboa",
    initials: "MO",
    supporters: 412,
    bio: "Pinta campos lentos e desgastados de ocre e tinta. Trabalha numa antiga fábrica de azulejos em Alcântara, uma tela por vez.",
    works: ["gilded-silence", "field-notes-on-yellow"],
  },
  {
    slug: "tomas-reyes",
    name: "Tomás Reyes",
    discipline: "Fotógrafo",
    location: "Cidade do México",
    initials: "TR",
    supporters: 288,
    bio: "Fotografa cidades nos vinte minutos antes de elas acordarem. Só fotografa em filme e revela em casa.",
    works: ["before-the-city-wakes"],
  },
  {
    slug: "ines-halvorsen",
    name: "Inés Halvorsen",
    discipline: "Ilustradora e ensaísta",
    location: "Oslo",
    initials: "IH",
    supporters: 526,
    bio: "Desenha formas botânicas a nanquim e escreve ensaios curtos sobre atenção. Acredita que uma página pode ser um quarto silencioso.",
    works: ["a-quiet-taxonomy", "on-looking-longer"],
  },
  {
    slug: "kaveh-noor",
    name: "Kaveh Noor",
    discipline: "Compositor",
    location: "Berlim",
    initials: "KN",
    supporters: 197,
    bio: "Constrói loops de fita e drones modulares. Lança uma peça por mês, sem masterização e sem pressa.",
    works: ["tape-loop-no-4"],
  },
];

export const works: Work[] = [
  {
    id: "1",
    slug: "gilded-silence",
    title: "Silêncio Dourado",
    medium: "visual",
    artistSlug: "mira-okonkwo",
    cover: "/images/work-1.jpg",
    excerpt:
      "Óleo e pigmento sobre linho cru, 140 × 95 cm. O quarto estudo de uma série contínua sobre erosão.",
    body: [
      "Esta obra começou como um erro — um borrão de nanquim sobre um fundo que passei três semanas aquecendo até aquele amarelo específico.",
      "Deixei que ficasse. Tudo depois disso foi uma negociação com o acidente: onde conter, onde deixar o escuro manter o seu território.",
    ],
    clicks: 18420,
    likes: 1284,
    published: "2 de agosto de 2026",
  },
  {
    id: "2",
    slug: "before-the-city-wakes",
    title: "Antes de a Cidade Acordar",
    medium: "visual",
    artistSlug: "tomas-reyes",
    cover: "/images/work-2.jpg",
    excerpt:
      "35 mm, forçado dois pontos. Avenida Reforma às 5h40, quando a luz não pertence a ninguém.",
    body: [
      "Existe uma janela de cerca de vinte minutos em que uma cidade ainda é um objeto, e não uma multidão.",
      "Fotografo essa janela há seis anos. Nunca é a mesma rua duas vezes.",
    ],
    clicks: 9310,
    likes: 742,
    published: "28 de julho de 2026",
  },
  {
    id: "3",
    slug: "a-quiet-taxonomy",
    title: "Uma Taxonomia Silenciosa",
    medium: "illustration",
    artistSlug: "ines-halvorsen",
    cover: "/images/work-3.jpg",
    excerpt:
      "Nanquim sobre papel de algodão. Nove hastes, desenhadas da mesma beira de estrada ao longo de um verão.",
    body: [
      "Desenhar uma erva nove vezes ensina que ela nunca foi uma só coisa.",
      "A linha precisa desacelerar para perceber. Essa desaceleração é todo o sentido do exercício.",
    ],
    clicks: 22105,
    likes: 1902,
    published: "19 de julho de 2026",
  },
  {
    id: "4",
    slug: "tape-loop-no-4",
    title: "Loop de Fita nº 4",
    medium: "music",
    artistSlug: "kaveh-noor",
    cover: "/images/work-4.jpg",
    audio: true,
    excerpt:
      "Onze minutos de fita em decomposição, um acorde, nenhum corte. Gravado em uma única passagem.",
    body: [
      "O loop tem 4,2 segundos. Cada passagem pela cabeça de leitura remove um pouco mais dos agudos.",
      "No nono minuto quase não resta nada além de ruído e memória, que é mais ou menos o assunto.",
    ],
    clicks: 6740,
    likes: 512,
    published: "11 de julho de 2026",
  },
  {
    id: "5",
    slug: "on-looking-longer",
    title: "Sobre Olhar Por Mais Tempo",
    medium: "writing",
    artistSlug: "ines-halvorsen",
    excerpt:
      "Um ensaio sobre a atenção como ofício, e por que a internet a transformou em disciplina em vez de hábito.",
    body: [
      "A atenção costumava ser o estado padrão de quem não tinha mais nada a fazer. Hoje é uma habilidade que precisa de treino, como um idioma aprendido tarde.",
      "Mantenho uma regra em galerias: quatro minutos por obra, cronometrados. O primeiro minuto é reconhecimento. O segundo é tédio. O terceiro é onde algo realmente começa.",
      "A maior parte do que chamamos de gosto é apenas a disposição de permanecer depois do segundo minuto.",
    ],
    readTime: "6 min de leitura",
    clicks: 31480,
    likes: 2410,
    published: "4 de julho de 2026",
  },
  {
    id: "6",
    slug: "field-notes-on-yellow",
    title: "Notas de Campo sobre o Amarelo",
    medium: "writing",
    artistSlug: "mira-okonkwo",
    excerpt: "Notas de um diário de ateliê: misturar uma cor que se recusa a ficar quieta.",
    body: [
      "O amarelo é o único pigmento que tenho que muda de opinião conforme o que está ao lado dele.",
      "Contra o preto, torna-se luz. Contra o branco, torna-se terra. A pintura é apenas uma discussão sobre qual dos dois ele vai ser.",
    ],
    readTime: "3 min de leitura",
    clicks: 12060,
    likes: 866,
    published: "27 de junho de 2026",
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
  { id: "u1", name: "Inés Halvorsen", email: "ines@thebeyond.art", type: "author", joined: "jan 2026", donated: 0 },
  { id: "u2", name: "Mira Okonkwo", email: "mira@thebeyond.art", type: "author", joined: "fev 2026", donated: 15 },
  { id: "u3", name: "Tomás Reyes", email: "tomas@thebeyond.art", type: "author", joined: "fev 2026", donated: 0 },
  { id: "u4", name: "Kaveh Noor", email: "kaveh@thebeyond.art", type: "author", joined: "mar 2026", donated: 40 },
  { id: "u5", name: "A. Ferreira", email: "a.ferreira@mail.com", type: "vip", joined: "mar 2026", donated: 240 },
  { id: "u6", name: "R. Silva", email: "r.silva@mail.com", type: "vip", joined: "abr 2026", donated: 410 },
  { id: "u7", name: "M. Lindqvist", email: "m.lind@mail.com", type: "free", joined: "abr 2026", donated: 25 },
  { id: "u8", name: "J. Okafor", email: "j.okafor@mail.com", type: "free", joined: "mai 2026", donated: 5 },
  { id: "u9", name: "L. Beaumont", email: "l.beaumont@mail.com", type: "free", joined: "jun 2026", donated: 0, suspended: true },
  { id: "u10", name: "Denis Oliveira", email: "denis@thebeyond.art", type: "admin", joined: "jan 2026", donated: 0 },
];

/** Total de doações recebidas por obra (mockado). */
export const donationsByWork: Record<string, number> = {
  "gilded-silence": 310,
  "before-the-city-wakes": 145,
  "a-quiet-taxonomy": 620,
  "tape-loop-no-4": 95,
  "on-looking-longer": 480,
  "field-notes-on-yellow": 130,
};

export function workDonations(slug: string) {
  return donationsByWork[slug] ?? 0;
}
