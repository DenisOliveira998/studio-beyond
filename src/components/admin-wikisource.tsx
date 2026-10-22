import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { uploadImage } from "@/lib/image-upload";

type Preview = {
  page: string;
  url: string;
  title: string;
  author: string;
  year: string;
  chapters: { page: string; title: string }[];
  existing: { id: string; slug: string; status: string; chapters: number[] } | null;
};

type Imported = { id: string; slug: string; title: string; artistName: string; medium: string; status: string; source: string | null; chapters: number };

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const out = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(out.error ?? "Erro");
  return out;
}

// Capa de texto (título e autor) para quando não houver imagem própria
const COVER_COLORS = [
  ["#1f3a5f", "#f3e9d2"],
  ["#5a1e2b", "#f6e7c8"],
  ["#20402f", "#efe6cf"],
  ["#3b2f63", "#f1e8d6"],
  ["#6b3b12", "#fbeedd"],
];
async function drawCover(title: string, author: string): Promise<File> {
  const c = document.createElement("canvas");
  c.width = 800;
  c.height = 1200;
  const g = c.getContext("2d")!;
  const [bg, fg] = COVER_COLORS[[...title].reduce((n, ch) => n + ch.charCodeAt(0), 0) % COVER_COLORS.length]!;
  g.fillStyle = bg!;
  g.fillRect(0, 0, 800, 1200);
  g.strokeStyle = fg!;
  g.globalAlpha = 0.5;
  g.lineWidth = 3;
  g.strokeRect(48, 48, 704, 1104);
  g.globalAlpha = 1;
  g.fillStyle = fg!;
  g.textAlign = "center";
  // Quebra o título em linhas que cabem na largura
  const wrap = (text: string, font: string, max: number) => {
    g.font = font;
    const out: string[] = [];
    let line = "";
    for (const w of text.split(/\s+/)) {
      const next = line ? `${line} ${w}` : w;
      if (line && g.measureText(next).width > max) {
        out.push(line);
        line = w;
      } else line = next;
    }
    if (line) out.push(line);
    return out;
  };
  const size = title.length > 40 ? 64 : title.length > 20 ? 80 : 96;
  const lines = wrap(title, `bold ${size}px Georgia, serif`, 620);
  const top = 520 - (lines.length * size * 1.15) / 2;
  lines.forEach((l, i) => g.fillText(l, 400, top + i * size * 1.15));
  g.font = "italic 44px Georgia, serif";
  g.fillText(author, 400, 1000);
  g.font = "26px Georgia, serif";
  g.globalAlpha = 0.7;
  g.fillText("Domínio público", 400, 1080);
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"));
  return new File([blob], "capa.png", { type: "image/png" });
}

/** Importar obras em domínio público do Wikisource: um PDF por capítulo + texto para o modo Texto. */
export function AdminWikisource() {
  const qc = useQueryClient();
  const { data: imported = [] } = useQuery<Imported[]>({
    queryKey: ["admin-wikisource"],
    queryFn: () => fetch("/api/admin/wikisource").then((r) => r.json()),
    staleTime: 30_000,
  });
  const [pagina, setPagina] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ titulo: "", autor: "", categoria: "livro", classificacao: "L", generos: "Clássico", sinopse: "" });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; error?: string | undefined; workId?: string | undefined; slug?: string | undefined } | null>(null);
  const stopRef = useRef(false);
  const running = !!progress && progress.done < progress.total && !progress.error && !stopRef.current;

  async function buscar() {
    setLoading(true);
    setProgress(null);
    try {
      const p = await post<Preview>("/api/admin/wikisource/previa", { pagina });
      setPreview(p);
      setSkip(new Set());
      setForm((f) => ({ ...f, titulo: p.title, autor: p.author, categoria: p.chapters.length === 1 ? "conto" : "livro" }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }

  async function importar() {
    if (!preview) return;
    const list = preview.chapters.filter((c) => !skip.has(c.page));
    if (!list.length) return toast.error("Escolha pelo menos um capítulo.");
    stopRef.current = false;
    try {
      let workId = preview.existing?.id;
      let slug = preview.existing?.slug;
      if (!workId) {
        const file = coverFile ?? (await drawCover(form.titulo, form.autor));
        const coverUrl = await uploadImage(file, "cover", 1600);
        const w = await post<{ id: string; slug: string }>("/api/admin/wikisource/obra", { pagina: preview.url, ...form, coverUrl });
        workId = w.id;
        slug = w.slug;
        setPreview({ ...preview, existing: { id: w.id, slug: w.slug, status: "draft", chapters: [] } });
      }
      setProgress({ done: 0, total: list.length, workId, slug });
      // Um capítulo por pedido: cada chamada do servidor tem tempo curto
      for (let i = 0; i < list.length; i++) {
        if (stopRef.current) return setProgress((p) => p && { ...p, error: "Pausado. Clique em Importar para continuar." });
        const c = list[i]!;
        let tries = 0;
        for (;;) {
          try {
            await post("/api/admin/wikisource/capitulo", { obraId: workId, pagina: c.page, numero: i + 1, titulo: c.title });
            break;
          } catch (e) {
            if (++tries >= 3) throw new Error(`Capítulo ${i + 1} (${c.title || c.page}): ${e instanceof Error ? e.message : "erro"}`);
            await new Promise((r) => setTimeout(r, 1500 * tries));
          }
        }
        setProgress({ done: i + 1, total: list.length, workId, slug });
      }
      toast.success("Capítulos importados. Confira e publique.");
    } catch (e) {
      setProgress((p) => ({ done: p?.done ?? 0, total: p?.total ?? list.length, error: e instanceof Error ? e.message : "Erro", ...(p?.workId ? { workId: p.workId } : {}), ...(p?.slug ? { slug: p.slug } : {}) }));
    } finally {
      void qc.invalidateQueries({ queryKey: ["admin-wikisource"] });
    }
  }

  async function publicar(id: string, publicar: boolean) {
    try {
      await post("/api/admin/wikisource/publicar", { obraId: id, publicar });
      toast.success(publicar ? "Obra no ar." : "Obra tirada do ar (rascunho).");
      void qc.invalidateQueries({ queryKey: ["admin-wikisource"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  const field = "w-full rounded border border-border bg-background px-3 py-2 text-sm";
  const chosen = preview ? preview.chapters.length - skip.size : 0;

  return (
    <div className="mt-6 space-y-6 text-sm">
      <p className="max-w-2xl text-muted-foreground">
        Cole o endereço da página principal da obra no Wikisource. Cada capítulo vira um PDF (para a página original) e o texto fica guardado
        para o modo Texto. A obra entra como rascunho e só vai ao ar quando você publicar.
      </p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void buscar();
        }}
      >
        <input value={pagina} onChange={(e) => setPagina(e.target.value)} placeholder="https://pt.wikisource.org/wiki/Dom_Casmurro" className={`${field} min-w-0 flex-1`} />
        <button disabled={loading || !pagina.trim()} className="rounded bg-gilt px-4 py-2 font-bold text-ink disabled:opacity-50">
          {loading ? "Buscando…" : "Buscar"}
        </button>
      </form>

      {preview && (
        <div className="space-y-5 rounded border border-border bg-background p-5">
          <div>
            <p className="font-bold">
              {preview.title} {preview.author ? `, de ${preview.author}` : ""} {preview.year ? `(${preview.year})` : ""}
            </p>
            <a href={preview.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline">
              {preview.url}
            </a>
            {preview.existing && (
              <p className="mt-2 rounded bg-surface px-3 py-2 text-xs">
                Esta obra já foi importada ({preview.existing.chapters.length} capítulos, {preview.existing.status === "approved" ? "no ar" : "rascunho"}).
                Importar de novo só completa os capítulos que faltam (mantenha a mesma seleção de capítulos).
              </p>
            )}
          </div>

          {!preview.existing && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Título</span>
                <input className={field} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Autor</span>
                <input className={field} value={form.autor} onChange={(e) => setForm({ ...form, autor: e.target.value })} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Categoria</span>
                <select className={field} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                  <option value="livro">Livro (romance, coletânea)</option>
                  <option value="conto">Conto</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Classificação indicativa</span>
                <select className={field} value={form.classificacao} onChange={(e) => setForm({ ...form, classificacao: e.target.value })}>
                  <option value="L">Livre</option>
                  <option value="10">10 anos</option>
                  <option value="12">12 anos</option>
                  <option value="14">14 anos</option>
                  <option value="16">16 anos</option>
                </select>
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-muted-foreground">Gêneros (separados por vírgula)</span>
                <input className={field} value={form.generos} onChange={(e) => setForm({ ...form, generos: e.target.value })} />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-muted-foreground">Sinopse (até 280 letras)</span>
                <textarea rows={3} maxLength={280} className={field} value={form.sinopse} onChange={(e) => setForm({ ...form, sinopse: e.target.value })} />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-muted-foreground">Capa (opcional; sem imagem, geramos uma capa com título e autor)</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} className="block text-xs" />
              </label>
            </div>
          )}

          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground">
              {chosen} de {preview.chapters.length} capítulos selecionados (confira a ordem e desmarque o que não é capítulo)
            </summary>
            <ol className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-2">
              {preview.chapters.map((c, i) => (
                <li key={c.page} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!skip.has(c.page)}
                    disabled={running}
                    onChange={(e) => {
                      const next = new Set(skip);
                      if (e.target.checked) next.delete(c.page);
                      else next.add(c.page);
                      setSkip(next);
                    }}
                  />
                  <span className="text-muted-foreground">{i + 1}.</span> {c.title || c.page}
                </li>
              ))}
            </ol>
          </details>

          <div className="flex flex-wrap items-center gap-3">
            {running ? (
              <button onClick={() => (stopRef.current = true)} className="rounded border border-border px-4 py-2">
                Pausar
              </button>
            ) : (
              <button onClick={() => void importar()} className="rounded bg-gilt px-4 py-2 font-bold text-ink">
                {preview.existing ? "Completar importação" : "Importar"}
              </button>
            )}
            {progress && (
              <span className="text-muted-foreground">
                {progress.done} de {progress.total} capítulos
              </span>
            )}
          </div>
          {progress && (
            <div className="h-2 overflow-hidden rounded bg-surface">
              <div className="h-full bg-gilt transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
            </div>
          )}
          {progress?.error && <p className="text-destructive">{progress.error}</p>}
        </div>
      )}

      {imported.length > 0 && (
        <div>
          <p className="mb-2 font-bold">Obras importadas</p>
          <ul className="divide-y divide-border rounded border border-border">
            {imported.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <Link to="/obra/$slug" params={{ slug: w.slug }} className="font-bold hover:text-gilt">
                    {w.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {w.artistName}, {w.medium === "conto" ? "Conto" : "Livro"}, {w.chapters} capítulos, {w.status === "approved" ? "no ar" : "rascunho"}
                  </p>
                </div>
                <button
                  onClick={() => void publicar(w.id, w.status !== "approved")}
                  className={w.status === "approved" ? "rounded border border-border px-3 py-1.5 text-xs" : "rounded bg-gilt px-3 py-1.5 text-xs font-bold text-ink"}
                >
                  {w.status === "approved" ? "Tirar do ar" : "Publicar"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
