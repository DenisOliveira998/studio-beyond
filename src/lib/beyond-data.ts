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
  visual: "Visual art",
  writing: "Writing",
  music: "Music",
  illustration: "Illustration",
};

export const artists: Artist[] = [
  {
    slug: "mira-okonkwo",
    name: "Mira Okonkwo",
    discipline: "Painter",
    location: "Lisbon",
    initials: "MO",
    supporters: 412,
    bio: "Paints slow, weathered fields of ochre and ink. Works from a former tile factory in Alcântara, one canvas at a time.",
    works: ["gilded-silence", "field-notes-on-yellow"],
  },
  {
    slug: "tomas-reyes",
    name: "Tomás Reyes",
    discipline: "Photographer",
    location: "Mexico City",
    initials: "TR",
    supporters: 288,
    bio: "Photographs cities in the twenty minutes before they wake up. Shoots film only, develops at home.",
    works: ["before-the-city-wakes"],
  },
  {
    slug: "ines-halvorsen",
    name: "Inés Halvorsen",
    discipline: "Illustrator & essayist",
    location: "Oslo",
    initials: "IH",
    supporters: 526,
    bio: "Draws botanical forms in ink and writes short essays about attention. Believes a page can be a quiet room.",
    works: ["a-quiet-taxonomy", "on-looking-longer"],
  },
  {
    slug: "kaveh-noor",
    name: "Kaveh Noor",
    discipline: "Composer",
    location: "Berlin",
    initials: "KN",
    supporters: 197,
    bio: "Builds tape loops and modular drones. Releases one piece a month, unmastered and unhurried.",
    works: ["tape-loop-no-4"],
  },
];

export const works: Work[] = [
  {
    id: "1",
    slug: "gilded-silence",
    title: "Gilded Silence",
    medium: "visual",
    artistSlug: "mira-okonkwo",
    cover: "/images/work-1.jpg",
    excerpt: "Oil and pigment on raw linen, 140 × 95 cm. The fourth study in an ongoing series about erosion.",
    body: [
      "This one began as a mistake — a spill of ink across a ground I had spent three weeks warming into that particular yellow.",
      "I let it stay. Everything after was a negotiation with the accident: where to withhold, where to let the dark keep its territory.",
    ],
    clicks: 18420,
    likes: 1284,
    published: "Aug 2, 2026",
  },
  {
    id: "2",
    slug: "before-the-city-wakes",
    title: "Before the City Wakes",
    medium: "visual",
    artistSlug: "tomas-reyes",
    cover: "/images/work-2.jpg",
    excerpt: "35mm, pushed two stops. Avenida Reforma at 5:40am, when the light belongs to no one.",
    body: [
      "There is a window of about twenty minutes when a city is still an object rather than a crowd.",
      "I have been photographing that window for six years. It is never the same street twice.",
    ],
    clicks: 9310,
    likes: 742,
    published: "Jul 28, 2026",
  },
  {
    id: "3",
    slug: "a-quiet-taxonomy",
    title: "A Quiet Taxonomy",
    medium: "illustration",
    artistSlug: "ines-halvorsen",
    cover: "/images/work-3.jpg",
    excerpt: "Ink on cotton paper. Nine stems, drawn from the same roadside over one summer.",
    body: [
      "Drawing a weed nine times teaches you that it was never one thing.",
      "The line has to slow down to notice. That slowing is the whole point of the exercise.",
    ],
    clicks: 22105,
    likes: 1902,
    published: "Jul 19, 2026",
  },
  {
    id: "4",
    slug: "tape-loop-no-4",
    title: "Tape Loop no. 4",
    medium: "music",
    artistSlug: "kaveh-noor",
    cover: "/images/work-4.jpg",
    audio: true,
    excerpt: "Eleven minutes of decaying tape, one chord, no edits. Recorded in a single pass.",
    body: [
      "The loop is 4.2 seconds long. Each pass across the head removes a little more of the high end.",
      "By minute nine there is almost nothing left but hiss and memory, which is more or less the subject.",
    ],
    clicks: 6740,
    likes: 512,
    published: "Jul 11, 2026",
  },
  {
    id: "5",
    slug: "on-looking-longer",
    title: "On Looking Longer",
    medium: "writing",
    artistSlug: "ines-halvorsen",
    excerpt: "An essay on attention as a craft, and why the internet made it a discipline rather than a habit.",
    body: [
      "Attention used to be the default state of a person with nothing else to do. Now it is a skill you have to train, like a language you learned late.",
      "I keep a rule for myself in galleries: four minutes per work, timed. The first minute is recognition. The second is boredom. The third is where something actually begins.",
      "Most of what we call taste is simply the willingness to stay past the second minute.",
    ],
    readTime: "6 min read",
    clicks: 31480,
    likes: 2410,
    published: "Jul 4, 2026",
  },
  {
    id: "6",
    slug: "field-notes-on-yellow",
    title: "Field Notes on Yellow",
    medium: "writing",
    artistSlug: "mira-okonkwo",
    excerpt: "Notes from a studio journal: mixing a colour that refuses to sit still.",
    body: [
      "Yellow is the only pigment I own that changes its mind depending on what is next to it.",
      "Set it against black and it becomes light. Set it against white and it becomes dirt. The painting is just an argument about which of those it is going to be.",
    ],
    readTime: "3 min read",
    clicks: 12060,
    likes: 866,
    published: "Jun 27, 2026",
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

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export const compact = (n: number) => n.toLocaleString("en-US");

/* ---------- Accounts & platform administration (mock) ---------- */

export type AccountType = "free" | "vip" | "author" | "admin";

export const ACCOUNT_LABEL: Record<AccountType, string> = {
  free: "Gratuito",
  vip: "VIP",
  author: "Autor",
  admin: "Admin",
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
  { id: "u1", name: "Inés Halvorsen", email: "ines@thebeyond.art", type: "author", joined: "Jan 2026", donated: 0 },
  { id: "u2", name: "Mira Okonkwo", email: "mira@thebeyond.art", type: "author", joined: "Feb 2026", donated: 15 },
  { id: "u3", name: "Tomás Reyes", email: "tomas@thebeyond.art", type: "author", joined: "Feb 2026", donated: 0 },
  { id: "u4", name: "Kaveh Noor", email: "kaveh@thebeyond.art", type: "author", joined: "Mar 2026", donated: 40 },
  { id: "u5", name: "A. Ferreira", email: "a.ferreira@mail.com", type: "vip", joined: "Mar 2026", donated: 240 },
  { id: "u6", name: "R. Silva", email: "r.silva@mail.com", type: "vip", joined: "Apr 2026", donated: 410 },
  { id: "u7", name: "M. Lindqvist", email: "m.lind@mail.com", type: "free", joined: "Apr 2026", donated: 25 },
  { id: "u8", name: "J. Okafor", email: "j.okafor@mail.com", type: "free", joined: "May 2026", donated: 5 },
  { id: "u9", name: "L. Beaumont", email: "l.beaumont@mail.com", type: "free", joined: "Jun 2026", donated: 0, suspended: true },
  { id: "u10", name: "Denis Oliveira", email: "denis@thebeyond.art", type: "admin", joined: "Jan 2026", donated: 0 },
];

/** Total donations received per work slug (mock). */
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
