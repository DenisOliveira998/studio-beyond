/**
 * Transforma o texto de um PDF em blocos de leitura (parágrafos e títulos),
 * para o "modo Texto" do leitor: a letra se ajusta à tela, sem zoom.
 * Funciona bem com PDFs exportados de editores de texto; PDF escaneado
 * (só imagem) não tem texto, e o leitor volta para a página original.
 */
export type TextBlock = { kind: "p" | "h" | "center"; text: string };

type Item = { str: string; x: number; y: number; h: number; w: number; eol: boolean };
type Line = { text: string; x: number; right: number; y: number; h: number };

const END_PUNCT = /[.!?…:;"”»)\]]$/;

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

function toLines(items: Item[]): Line[] {
  const lines: Line[] = [];
  let cur: Line | null = null;
  for (const it of items) {
    if (!it.str && !it.eol) continue;
    const sameLine = cur && Math.abs(it.y - cur.y) < Math.max(cur.h, it.h, 1) * 0.5;
    if (!cur || !sameLine) {
      if (cur && cur.text.trim()) lines.push(cur);
      cur = { text: it.str, x: it.x, right: it.x + it.w, y: it.y, h: it.h };
    } else {
      // Espaço entre pedaços da mesma linha quando há distância visível entre eles
      const gap = it.x - cur.right;
      const needsSpace = gap > it.h * 0.15 && !cur.text.endsWith(" ") && !it.str.startsWith(" ");
      cur.text += (needsSpace ? " " : "") + it.str;
      cur.right = Math.max(cur.right, it.x + it.w);
      cur.h = Math.max(cur.h, it.h);
    }
    if (it.eol && cur) {
      if (cur.text.trim()) lines.push(cur);
      cur = null;
    }
  }
  if (cur && cur.text.trim()) lines.push(cur);
  return lines.map((l) => ({ ...l, text: l.text.replace(/\s+/g, " ").trim() }));
}

function joinLine(prev: string, next: string): string {
  // Palavra quebrada com hífen no fim da linha: "conti-" + "nuou" → "continuou"
  if (/[A-Za-zÀ-ÿ]-$/.test(prev) && /^[a-zà-ÿ]/.test(next)) return prev.slice(0, -1) + next;
  return `${prev} ${next}`;
}

/** Blocos de uma página, a partir dos itens de texto do pdf.js (`page.getTextContent()`). */
export function pageBlocks(
  raw: { str: string; transform: number[]; width: number; height: number; hasEOL?: boolean }[],
  pageWidth: number,
): TextBlock[] {
  const items: Item[] = raw.map((r) => ({
    str: r.str,
    x: r.transform[4] ?? 0,
    y: r.transform[5] ?? 0,
    h: Math.abs(r.height || r.transform[3] || 0),
    w: r.width,
    eol: !!r.hasEOL,
  }));
  const lines = toLines(items).filter((l) => !/^\d{1,4}$/.test(l.text)); // número de página
  if (!lines.length) return [];

  const bodyH = median(lines.map((l) => l.h)) || 10;
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const d = lines[i - 1]!.y - lines[i]!.y;
    if (d > 0) gaps.push(d);
  }
  const lineGap = median(gaps) || bodyH * 1.3;
  const left = median(lines.map((l) => l.x));
  const widest = Math.max(...lines.map((l) => l.right - l.x));

  // Página de rosto / dedicatória: quase todas as linhas centralizadas
  const centeredLines = lines.filter((l) => Math.abs((l.x + l.right) / 2 - pageWidth / 2) < pageWidth * 0.06);
  if (lines.length <= 12 && centeredLines.length >= lines.length * 0.6) {
    return lines.map((l) => ({ kind: l.h > bodyH * 1.25 ? ("h" as const) : ("center" as const), text: l.text }));
  }

  const blocks: TextBlock[] = [];
  let para: string | null = null;
  let prev: Line | null = null;
  const flush = () => {
    if (para && para.trim()) blocks.push({ kind: "p", text: para.trim() });
    para = null;
  };

  for (const line of lines) {
    const width = line.right - line.x;
    const center = (line.x + line.right) / 2;
    const isHeading = line.h > bodyH * 1.25;
    const isCentered = width < widest * 0.7 && Math.abs(center - pageWidth / 2) < pageWidth * 0.06 && line.x > left + bodyH;
    if (isHeading || isCentered) {
      flush();
      const kind = isHeading ? "h" : "center";
      const last = blocks[blocks.length - 1];
      // Título em várias linhas seguidas vira um bloco só
      if (last && last.kind === kind && prev && prev.y - line.y < lineGap * 1.6) last.text = joinLine(last.text, line.text);
      else blocks.push({ kind, text: line.text });
      prev = line;
      continue;
    }
    const gap = prev ? prev.y - line.y : 0;
    const indented = line.x > left + bodyH * 0.8;
    const prevShort = prev ? prev.right - prev.x < widest * 0.8 && END_PUNCT.test(prev.text) : false;
    const newPara = para === null || gap > lineGap * 1.45 || gap < 0 || indented || prevShort;
    if (newPara) {
      flush();
      para = line.text;
    } else {
      para = joinLine(para ?? "", line.text);
    }
    prev = line;
  }
  flush();
  return blocks;
}

/** Junta as páginas: um parágrafo cortado no fim da página continua no começo da próxima. */
export function mergePages(pages: TextBlock[][]): TextBlock[] {
  const out: TextBlock[] = [];
  for (const blocks of pages) {
    blocks.forEach((b, i) => {
      const last = out[out.length - 1];
      if (i === 0 && b.kind === "p" && last?.kind === "p" && !END_PUNCT.test(last.text) && /^[a-zà-ÿ,;]/.test(b.text)) {
        last.text = joinLine(last.text, b.text);
      } else {
        out.push({ ...b });
      }
    });
  }
  return out;
}
