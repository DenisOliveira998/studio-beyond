// Importador do Wikisource: obras em domínio público entram como obras normais do site,
// com um PDF por capítulo (para a "Página original") e o texto já guardado (modo Texto).
// Roda só no servidor e só para a equipe (admin).
import { parse, type HTMLElement } from "node-html-parser";
import type { TextBlock } from "./pdf-text";

const UA = "GoBeyonddImporter/1.0 (contato@gobeyondd.com.br)";

export type WikiRef = { host: string; page: string };

/** Aceita o endereço da página ("https://pt.wikisource.org/wiki/Dom_Casmurro") ou só o título. */
export function parseWikiRef(input: string): WikiRef | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      return null;
    }
    // Só o Wikisource (qualquer idioma); nada de outro endereço
    if (u.protocol !== "https:" || !/^[a-z]{2,3}(-[a-z]+)?\.wikisource\.org$/.test(u.hostname)) return null;
    const m = u.pathname.match(/^\/wiki\/(.+)$/);
    const title = m ? decodeURIComponent(m[1]!) : u.searchParams.get("title");
    if (!title) return null;
    return { host: u.hostname, page: title.replace(/ /g, "_") };
  }
  return { host: "pt.wikisource.org", page: raw.replace(/ /g, "_") };
}

export function wikiPageUrl(ref: WikiRef): string {
  return `https://${ref.host}/wiki/${encodeURI(ref.page)}`;
}

async function fetchParsed(ref: WikiRef): Promise<{ title: string; html: string }> {
  const qs = new URLSearchParams({
    action: "parse",
    page: ref.page,
    prop: "text|displaytitle",
    format: "json",
    formatversion: "2",
    disableeditsection: "1",
    redirects: "1",
  });
  const res = await fetch(`https://${ref.host}/w/api.php?${qs}`, { headers: { "User-Agent": UA, accept: "application/json" } });
  if (!res.ok) throw new Error(`O Wikisource respondeu ${res.status}. Tente de novo em instantes.`);
  const data = (await res.json()) as { parse?: { title: string; text: string }; error?: { info?: string } };
  if (!data.parse) throw new Error(data.error?.info?.includes("doesn't exist") ? "Página não encontrada no Wikisource." : "Não foi possível ler essa página do Wikisource.");
  return { title: data.parse.title, html: data.parse.text };
}

function text(el: HTMLElement | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

export type WikiIndex = {
  page: string;
  url: string;
  title: string;
  author: string;
  year: string;
  chapters: { page: string; title: string }[];
};

/** Lê a página principal da obra: título, autor e a lista de capítulos (subpáginas, na ordem). */
export async function fetchWikiIndex(ref: WikiRef): Promise<WikiIndex> {
  const { title, html } = await fetchParsed(ref);
  const root = parse(html);
  const author = text(root.querySelector("#ws-author")) || text(root.querySelector("#header_author_text"));
  const year = text(root.querySelector("#ws-year"));
  const headTitle = text(root.querySelector("#header_title_text")) || title.split("/").pop() || title;
  // Tira o cabeçalho de navegação (ele tem links de "anterior/próximo")
  for (const el of root.querySelectorAll(".ws-noexport, .noprint, #ws-data, .headertemplate")) el.remove();
  const base = title.replace(/ /g, "_");
  const seen = new Set<string>();
  const chapters: { page: string; title: string }[] = [];
  for (const a of root.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href") ?? "";
    const m = href.match(/^\/wiki\/([^#?]+)/);
    if (!m) continue;
    let target: string;
    try {
      target = decodeURIComponent(m[1]!).replace(/ /g, "_");
    } catch {
      continue;
    }
    if (!target.startsWith(`${base}/`)) continue;
    const linkTitle = text(a).slice(0, 120);
    if (seen.has(target)) {
      // O índice do Wikisource às vezes aponta dois capítulos para a mesma página
      // (ex.: Dom Casmurro, CXXI duas vezes). Com capítulos numerados, o certo é o seguinte ao anterior.
      const prev = chapters.at(-1);
      const earlier = chapters.find((c) => c.page === target);
      const guess = prev ? nextNumbered(prev.page) : null;
      if (!guess || seen.has(guess) || earlier?.title === linkTitle) continue;
      target = guess;
    }
    seen.add(target);
    chapters.push({ page: target, title: linkTitle || target.slice(base.length + 1).replace(/_/g, " ") });
  }
  // Sem subpáginas: a obra inteira está numa página só (conto, poema), com o nome da própria página
  if (!chapters.length) {
    chapters.push({ page: base, title: "" });
    return { page: base, url: wikiPageUrl({ host: ref.host, page: base }), title: title.split("/").pop() || title, author, year, chapters };
  }
  return { page: base, url: wikiPageUrl({ host: ref.host, page: base }), title: headTitle, author, year, chapters };
}

const ROMAN: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
function toRoman(n: number): string {
  let out = "";
  for (const [v, r] of ROMAN) while (n >= v) (out += r), (n -= v);
  return out;
}
function fromRoman(s: string): number | null {
  if (!/^[MDCLXVI]+$/.test(s)) return null;
  let n = 0;
  let rest = s;
  for (const [v, r] of ROMAN) while (rest.startsWith(r)) (n += v), (rest = rest.slice(r.length));
  return rest || toRoman(n) !== s ? null : n;
}
/** "Obra/CXXI" → "Obra/CXXII"; "Obra/Capítulo_3" → "Obra/Capítulo_4". */
function nextNumbered(page: string): string | null {
  const m = page.match(/^(.*?)([MDCLXVI]+|\d+)$/);
  if (!m) return null;
  const roman = fromRoman(m[2]!);
  if (roman != null) return m[1] + toRoman(roman + 1);
  return /^\d+$/.test(m[2]!) ? m[1] + String(Number(m[2]) + 1) : null;
}

const BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "DD", "BLOCKQUOTE"]);

/** HTML de um capítulo do Wikisource → blocos de leitura (parágrafo, título, centralizado). */
export function wikiHtmlToBlocks(html: string): TextBlock[] {
  const root = parse(html);
  for (const el of root.querySelectorAll(
    ".ws-noexport, .noprint, #ws-data, .headertemplate, #navigationHeader, #navigationNotes, .mw-editsection, .pagenum, .ws-pagenum, style, script, .mw-empty-elt, .wst-dhr, .reference-text-only, #modernizar, .metadata, table.ambox, figure, .thumb, img",
  )) {
    el.remove();
  }
  const out: TextBlock[] = [];
  const push = (kind: TextBlock["kind"], t: string) => {
    const clean = t.replace(/[­​]/g, "").replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{2,}/g, "\n").trim();
    if (clean) out.push({ kind, text: clean });
  };
  const centered = (el: HTMLElement) => {
    const style = (el.getAttribute("style") ?? "").replace(/\s/g, "").toLowerCase();
    const cls = el.getAttribute("class") ?? "";
    return style.includes("text-align:center") || /\b(center|tiInherit|wst-center|ws-center)\b/.test(cls) || el.tagName === "CENTER";
  };
  // Texto do elemento mantendo as quebras de verso (<br>); as quebras do código-fonte viram espaço
  const lines = (el: HTMLElement) => {
    el.querySelectorAll("br").forEach((br) => br.replaceWith("\u2028"));
    return (el.textContent ?? "").replace(/[ \t\r\n]+/g, " ").replace(/ ?\u2028 ?/g, "\n").trim();
  };
  const walk = (el: HTMLElement, inCenter: boolean) => {
    for (const node of el.childNodes) {
      if (node.nodeType !== 1) {
        const t = (node.textContent ?? "").trim();
        if (t) push(inCenter ? "center" : "p", t);
        continue;
      }
      const child = node as HTMLElement;
      const tag = child.tagName;
      const cls = child.getAttribute("class") ?? "";
      if (/^H[1-6]$/.test(tag)) {
        push("h", text(child));
      } else if (cls.includes("poem")) {
        // Poema: uma estrofe por bloco, versos em linhas separadas
        const stanzas = child.querySelectorAll("p");
        if (stanzas.length) stanzas.forEach((p) => push(inCenter ? "center" : "p", lines(p).replace(/\s*\n\s*/g, "\n")));
        else push(inCenter ? "center" : "p", lines(child).replace(/\s*\n\s*/g, "\n"));
      } else if (tag === "OL" && cls.includes("references")) {
        const notes = child.querySelectorAll("li");
        if (notes.length) {
          push("h", "Notas");
          notes.forEach((li, i) => push("p", `${i + 1}. ${text(li).replace(/^\^\s*/, "")}`));
        }
      } else if (BLOCK_TAGS.has(tag)) {
        const isCenter = inCenter || centered(child);
        const t = child.querySelector("br") ? lines(child).replace(/\s*\n\s*/g, "\n") : text(child);
        push(isCenter ? "center" : "p", t);
      } else if (tag === "UL" || tag === "OL" || tag === "DL" || tag === "DIV" || tag === "SECTION" || tag === "CENTER" || tag === "SPAN" || tag === "TABLE" || tag === "TBODY" || tag === "TR" || tag === "TD") {
        // Div com texto solto (sem parágrafos dentro): vira um bloco só
        const hasBlocks = child.querySelector("p, h1, h2, h3, h4, h5, h6, li, div, dd, blockquote, table");
        if (!hasBlocks && tag !== "TABLE") {
          const t = child.querySelector("br") ? lines(child).replace(/\s*\n\s*/g, "\n") : text(child);
          push(inCenter || centered(child) ? "center" : "p", t);
        } else {
          walk(child, inCenter || centered(child));
        }
      } else {
        const t = text(child);
        if (t) push(inCenter ? "center" : "p", t);
      }
    }
  };
  walk(root, false);
  // Linhas de espaço ou só pontuação solta não contam
  return out.filter((b) => /[\p{L}\p{N}]/u.test(b.text));
}

/** Busca um capítulo e devolve os blocos de texto. */
export async function fetchWikiChapter(ref: WikiRef): Promise<TextBlock[]> {
  const { html } = await fetchParsed(ref);
  return wikiHtmlToBlocks(html);
}

/* ---------- PDF do capítulo (A5, Times, texto justificado) ---------- */

// Fontes padrão do PDF só têm o alfabeto latino (WinAnsi): o resto é trocado ou removido
const SWAP: Record<string, string> = { " ": " ", " ": " ", " ": " ", " ": " ", " ": " ", "‑": "-", "‒": "–", "―": "—", "′": "'", "″": '"', "­": "" };

export async function blocksToPdf(blocks: TextBlock[], meta: { title: string; author: string }): Promise<{ bytes: Uint8Array; pages: number }> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle(meta.title);
  doc.setAuthor(meta.author);
  doc.setProducer("Go Beyondd");
  doc.setCreator("Go Beyondd (texto do Wikisource, domínio público)");
  const regular = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);

  const okChar = new Map<string, boolean>();
  const clean = (s: string) =>
    [...s]
      .map((ch) => {
        if (ch === "\n") return ch;
        const c = SWAP[ch] ?? ch;
        if (!c) return "";
        let ok = okChar.get(c);
        if (ok === undefined) {
          try {
            regular.encodeText(c);
            ok = true;
          } catch {
            ok = false;
          }
          okChar.set(c, ok);
        }
        return ok ? c : "";
      })
      .join("");

  const W = 420;
  const H = 595;
  const M = 48;
  const TOP = H - 54;
  const BOTTOM = 56;
  const maxW = W - M * 2;
  const color = rgb(0.1, 0.1, 0.1);

  let page = doc.addPage([W, H]);
  let y = TOP;
  const newPage = () => {
    page = doc.addPage([W, H]);
    y = TOP;
  };

  const wrap = (words: string[], font: typeof regular, size: number, firstIndent: number) => {
    const out: { words: string[]; indent: number }[] = [];
    let cur: string[] = [];
    let indent = firstIndent;
    let width = 0;
    const space = font.widthOfTextAtSize(" ", size);
    for (const w of words) {
      const ww = font.widthOfTextAtSize(w, size);
      const next = cur.length ? width + space + ww : ww;
      if (cur.length && next > maxW - indent) {
        out.push({ words: cur, indent });
        cur = [w];
        width = ww;
        indent = 0;
      } else {
        cur.push(w);
        width = next;
      }
    }
    if (cur.length) out.push({ words: cur, indent });
    return out;
  };

  const drawBlock = (b: TextBlock) => {
    const isH = b.kind === "h";
    const font = isH ? bold : regular;
    const size = isH ? 15 : 11;
    const lead = isH ? 20 : 15.5;
    const center = b.kind !== "p";
    if (isH) y -= y < TOP ? 18 : 6;
    const verses = clean(b.text).split("\n");
    const verse = verses.length > 1;
    verses.forEach((part, vi) => {
      const words = part.split(/\s+/).filter(Boolean);
      const rows = wrap(words, font, size, !center && !verse && vi === 0 ? 16 : 0);
      rows.forEach((row, ri) => {
        if (y < BOTTOM) newPage();
        const line = row.words.join(" ");
        const lw = font.widthOfTextAtSize(line, size);
        const last = ri === rows.length - 1;
        if (center) {
          page.drawText(line, { x: (W - lw) / 2, y, size, font, color });
        } else if (!last && !verse && row.words.length > 1) {
          // Justificado: distribui a sobra entre as palavras
          const gap = (maxW - row.indent - row.words.reduce((n, w) => n + font.widthOfTextAtSize(w, size), 0)) / (row.words.length - 1);
          let x = M + row.indent;
          for (const w of row.words) {
            page.drawText(w, { x, y, size, font, color });
            x += font.widthOfTextAtSize(w, size) + gap;
          }
        } else {
          page.drawText(line, { x: M + row.indent + (verse ? 12 : 0), y, size, font, color });
        }
        y -= lead;
      });
    });
    y -= isH ? 10 : verse ? 8 : 3;
  };

  for (const b of blocks) drawBlock(b);

  // Número da página no rodapé
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = String(i + 1);
    p.drawText(label, { x: (W - regular.widthOfTextAtSize(label, 9)) / 2, y: 30, size: 9, font: regular, color: rgb(0.45, 0.45, 0.45) });
  });
  return { bytes: await doc.save(), pages: pages.length };
}
