import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";

type ChapterInfo = { id: string; number: number; pdfPages: number | null; publishedAt: string; earlyUntil: string | null; free: boolean };
type ChaptersData = {
  status: string;
  chapters: ChapterInfo[];
  pending: { kind: string; chapterId: string | null; createdAt: string }[];
};

const label = (n: number) => `Capítulo ${String(n).replace(".", ",")}`;

/** Capítulos de uma obra no painel do autor: publicar o próximo e trocar o PDF de um existente. */
export function ChapterManager({ workId, title, medium, onClose }: { workId: string; title: string; medium: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<ChaptersData>({
    queryKey: ["chapters-mine", workId],
    queryFn: () => fetch(`/api/works/${workId}/capitulos`).then((r) => r.json() as Promise<ChaptersData>),
  });
  const chapters = data?.chapters ?? [];
  const nextNumber = chapters.length ? Math.floor(Math.max(...chapters.map((c) => c.number))) + 1 : 1;

  const [number, setNumber] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null); // "novo" ou id do capítulo
  const [progress, setProgress] = useState<{ message: string; percent: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<ChapterInfo | null>(null);

  async function upload(file: File) {
    const { uploadWorkPdf, } = await import("@/lib/pdf-upload");
    const { formatBytes } = await import("@/lib/pdf-optimize");
    const r = await uploadWorkPdf(file, { medium, onProgress: (message, percent) => setProgress({ message, percent }) });
    if (r.finalBytes < r.originalBytes) toast.success(`PDF comprimido de ${formatBytes(r.originalBytes)} para ${formatBytes(r.finalBytes)}.`);
    return r;
  }

  async function publishNext(file: File) {
    const n = Number((number || String(nextNumber)).replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Informe um número de capítulo válido (0, 1, 2, 1,5…).");
      return;
    }
    if (chapters.some((c) => c.number === n)) {
      toast.error(`Já existe o ${label(n)}. Use "Trocar PDF" nele ou escolha outro número.`);
      return;
    }
    setBusy("novo");
    try {
      const r = await upload(file);
      const res = await fetch(`/api/works/${workId}/capitulos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ number: n, pdfUrl: r.pdfUrl, previewUrl: r.previewUrl, pdfPages: r.pages }),
      });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(out.error ?? "Não foi possível publicar o capítulo.");
      toast.success(`${label(n)} publicado. Quem segue você foi avisado.`);
      setNumber("");
      void qc.invalidateQueries({ queryKey: ["chapters-mine", workId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao publicar.");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  async function replacePdf(ch: ChapterInfo, file: File) {
    setBusy(ch.id);
    try {
      const r = await upload(file);
      const res = await fetch(`/api/capitulos/${ch.id}/revisao`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pdfUrl: r.pdfUrl, previewUrl: r.previewUrl, pdfPages: r.pages }),
      });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(out.error ?? "Não foi possível enviar.");
      toast.success(`PDF novo do ${label(ch.number)} enviado para a curadoria. O atual continua no ar até a aprovação.`);
      void qc.invalidateQueries({ queryKey: ["chapters-mine", workId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar.");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  const pendingFor = (id: string) => data?.pending.some((p) => p.kind === "chapter" && p.chapterId === id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Capítulos de ${title}`}
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded border border-border bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} aria-label="Fechar" className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
        <h2 className="font-display text-xl font-bold">Capítulos</h2>
        <p className="mt-1 text-sm text-muted-foreground">{title}</p>

        {isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Carregando…</p>
        ) : data?.status !== "approved" ? (
          <p className="mt-6 text-sm text-muted-foreground">A obra precisa ser aprovada pela curadoria antes de receber capítulos.</p>
        ) : (
          <>
            <ol className="mt-5 divide-y divide-border rounded border border-border">
              {chapters.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">Nenhum capítulo ainda.</li>}
              {chapters.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span>
                    <strong>{label(c.number)}</strong>
                    <span className="text-muted-foreground">
                      {c.pdfPages ? `. ${c.pdfPages} páginas` : ""}
                      {c.free ? ". Grátis" : ""}
                      {c.earlyUntil ? `. Super Fã até ${new Date(c.earlyUntil).toLocaleDateString("pt-BR")}` : ""}
                    </span>
                  </span>
                  {pendingFor(c.id) ? (
                    <span className="text-xs text-amber-400">Troca em análise</span>
                  ) : (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => {
                        replaceTarget.current = c;
                        replaceRef.current?.click();
                      }}
                      className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
                    >
                      {busy === c.id ? "Enviando…" : "Trocar PDF"}
                    </button>
                  )}
                </li>
              ))}
            </ol>
            <input
              ref={replaceRef}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f && replaceTarget.current) void replacePdf(replaceTarget.current, f);
              }}
            />

            <div className="mt-6 rounded border border-border p-4">
              <p className="text-sm font-bold">Próximo capítulo</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Sugerimos o {label(nextNumber)}. Pode trocar o número para encaixar um capítulo esquecido: 0 para prólogo, 1,5
                para um extra. A lista é ordenada pelo número. O capítulo vai direto ao ar e fica 3 dias só para Super Fãs.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="text-sm">
                  <span className="block text-muted-foreground">Número</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={number}
                    placeholder={String(nextNumber)}
                    onChange={(e) => setNumber(e.target.value)}
                    className="mt-1 w-24 rounded border border-input bg-background px-3 py-2"
                  />
                </label>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => fileRef.current?.click()}
                  className="rounded-full bg-gilt px-5 py-2 text-sm font-bold text-ink disabled:opacity-50"
                >
                  {busy === "novo" ? "Publicando…" : "Escolher PDF e publicar"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void publishNext(f);
                  }}
                />
              </div>
            </div>

            {progress && (
              <div className="mt-4" role="status" aria-live="polite">
                <div className="h-1.5 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full bg-gilt transition-all" style={{ width: `${progress.percent}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{progress.message}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
