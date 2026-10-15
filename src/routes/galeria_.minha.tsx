import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AgeBadge } from "@/components/age-badge";
import { ARTWORK_KINDS, type ArtworkKind } from "@/lib/gallery-kinds";
import { AGE_RATINGS, AGE_RATINGS_ALLOWED, type AgeRating } from "@/lib/beyond-data";

type Mine = {
  artist: { name: string; slug: string };
  artworks: { id: string; title: string; kind: string; status: string; curatorNote: string | null; cover: string; imageCount: number; createdAt: string }[];
};

export const Route = createFileRoute("/galeria_/minha")({
  head: () => ({ meta: [{ title: "Minha galeria | Go Beyondd" }, { name: "robots", content: "noindex" }] }),
  component: MyGalleryPage,
});

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Esperando a curadoria", cls: "text-amber-400" },
  approved: { label: "Publicada", cls: "text-emerald-400" },
  rejected: { label: "Não aprovada", cls: "text-red-400" },
};

function MyGalleryPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery<Mine>({
    queryKey: ["galeria-minha"],
    queryFn: async () => {
      const r = await fetch("/api/galeria/minha");
      const out = (await r.json().catch(() => ({}))) as Mine & { error?: string };
      if (!r.ok) throw new Error(out.error ?? "Erro");
      return out;
    },
    enabled: !!user,
    retry: false,
  });
  const { data: works = [] } = useQuery<{ slug: string; title: string }[]>({
    queryKey: ["works-lista-fanart"],
    queryFn: () => fetch("/api/works").then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<ArtworkKind>("ilustracao");
  const [rating, setRating] = useState<AgeRating | null>(null);
  const [related, setRelated] = useState("");
  const [images, setImages] = useState<{ url: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (loading || (user && isLoading)) {
    return (
      <div className="flex justify-center py-32">
        <span className="size-6 animate-spin rounded-full border-2 border-border border-t-gilt" />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="px-5 py-24 text-center">
        <p className="font-display text-3xl">Entre para acessar sua galeria</p>
        <a href="/entrar?redirect=%2Fgaleria%2Fminha" className="mt-6 inline-block rounded-full bg-gilt px-6 py-2.5 text-sm font-bold text-ink">
          Entrar
        </a>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="px-5 py-24 text-center">
        <p className="font-display text-3xl">Só artistas aprovados publicam na Galeria</p>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">Envie sua candidatura de artista. A curadoria avalia e responde por e-mail.</p>
        <Link to="/candidatura-autor" search={{ tipo: "artista" }} className="mt-6 inline-block rounded-full bg-gilt px-6 py-2.5 text-sm font-bold text-ink">
          Candidatar-me como artista
        </Link>
      </div>
    );
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, 20 - images.length);
    if (!list.length) {
      toast.error("Cada publicação tem no máximo 20 imagens.");
      return;
    }
    setUploading(true);
    const { uploadImage } = await import("@/lib/image-upload");
    for (const f of list) {
      try {
        const url = await uploadImage(f, "gallery");
        setImages((prev) => [...prev, { url, preview: URL.createObjectURL(f) }]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao enviar a imagem.");
      }
    }
    setUploading(false);
  }

  async function publish() {
    if (!title.trim()) { toast.error("Dê um título à publicação."); return; }
    if (!images.length) { toast.error("Envie pelo menos uma imagem."); return; }
    if (!rating) { toast.error("Escolha a classificação indicativa."); return; }
    if (kind === "fanart" && !related) { toast.error("Escolha de qual obra é a fan art."); return; }
    setSending(true);
    try {
      const res = await fetch("/api/galeria/minha", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          kind,
          ageRating: rating,
          images: images.map((i) => i.url),
          ...(kind === "fanart" && related ? { relatedWorkSlug: related } : {}),
        }),
      });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(out.error ?? "Não foi possível publicar.");
      toast.success("Enviada para a curadoria. Você recebe um aviso quando for aprovada.");
      setTitle("");
      setDescription("");
      setImages([]);
      setRating(null);
      setRelated("");
      void qc.invalidateQueries({ queryKey: ["galeria-minha"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível publicar.");
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string, t: string) {
    if (!window.confirm(`Tirar "${t}" da Galeria? Essa ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/galeria/minha/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Não foi possível remover."); return; }
    toast.success("Publicação removida.");
    void qc.invalidateQueries({ queryKey: ["galeria-minha"] });
  }

  const input = "mt-1 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-gilt";

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:px-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-4xl tracking-tight">Minha galeria</h1>
        <Link to="/galeria/artista/$slug" params={{ slug: data.artist.slug }} className="text-sm text-gilt hover:underline">
          Ver minha página de artista
        </Link>
      </div>

      <section className="mt-8 border border-border bg-surface p-6">
        <h2 className="font-display text-2xl">Nova publicação</h2>
        <p className="mt-1 text-sm text-muted-foreground">Uma imagem ou um álbum de até 20. Passa pela curadoria antes de aparecer.</p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="block text-sm">
            Título *
            <input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} className={input} />
          </label>
          <label className="block text-sm">
            Tipo *
            <select value={kind} onChange={(e) => setKind(e.target.value as ArtworkKind)} className={input}>
              {(Object.keys(ARTWORK_KINDS) as ArtworkKind[]).map((k) => (
                <option key={k} value={k}>
                  {ARTWORK_KINDS[k]}
                </option>
              ))}
            </select>
          </label>
          {kind === "fanart" && (
            <label className="block text-sm sm:col-span-2">
              Fan art de qual obra? *
              <select value={related} onChange={(e) => setRelated(e.target.value)} className={input}>
                <option value="">Escolha a obra</option>
                {works.map((w) => (
                  <option key={w.slug} value={w.slug}>
                    {w.title.replace(/<[^>]*>/g, "")}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-sm sm:col-span-2">
            Descrição
            <textarea value={description} maxLength={2000} rows={3} onChange={(e) => setDescription(e.target.value)} className={`${input} resize-y`} />
          </label>
        </div>

        <div className="mt-5">
          <p className="text-sm">Classificação indicativa *</p>
          <div role="radiogroup" aria-label="Classificação indicativa" className="mt-2 flex flex-wrap gap-2">
            {AGE_RATINGS.map((r) => {
              const blocked = !AGE_RATINGS_ALLOWED.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={rating === r}
                  disabled={blocked}
                  title={blocked ? "Conteúdo para maiores de 18 anos não é aceito no momento" : undefined}
                  onClick={() => setRating(r)}
                  className={`flex items-center gap-2 border px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${
                    rating === r ? "border-gilt bg-gilt/10 text-gilt" : "border-border text-muted-foreground"
                  }`}
                >
                  <AgeBadge rating={r} /> {r === "L" ? "Livre" : `${r} anos`}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-sm">Imagens * ({images.length}/20)</p>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {images.map((img, i) => (
              <div key={img.url} className="relative aspect-square overflow-hidden rounded bg-background">
                <img src={img.preview} alt={`Imagem ${i + 1}`} className="size-full object-cover" />
                <button
                  type="button"
                  aria-label={`Tirar a imagem ${i + 1}`}
                  onClick={() => setImages((prev) => prev.filter((x) => x.url !== img.url))}
                  className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
            {images.length < 20 && (
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded border border-dashed border-border text-xs text-muted-foreground hover:border-gilt hover:text-gilt disabled:opacity-50"
              >
                <ImagePlus className="size-5" />
                {uploading ? "Enviando…" : "Adicionar"}
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <p className="mt-2 text-xs text-muted-foreground">JPG, PNG ou WebP. Imagens grandes são reduzidas automaticamente.</p>
        </div>

        <button
          type="button"
          disabled={sending || uploading}
          onClick={() => void publish()}
          className="mt-6 rounded-full bg-gilt px-6 py-2.5 text-sm font-bold text-ink disabled:opacity-50"
        >
          {sending ? "Enviando…" : "Enviar para a curadoria"}
        </button>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Minhas publicações</h2>
        {data.artworks.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nenhuma publicação ainda.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border border border-border">
            {data.artworks.map((a) => (
              <li key={a.id} className="flex items-center gap-4 p-3">
                {a.cover ? <img src={a.cover} alt="" className="size-16 shrink-0 rounded object-cover" /> : <span className="size-16 shrink-0 rounded bg-surface" />}
                <div className="min-w-0 flex-1">
                  <Link to="/galeria/obra/$id" params={{ id: a.id }} className="font-display text-lg hover:text-gilt">
                    {a.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {ARTWORK_KINDS[a.kind as ArtworkKind] ?? a.kind}
                    {a.imageCount > 1 ? `, ${a.imageCount} imagens` : ""}
                    {". "}
                    <span className={STATUS[a.status]?.cls}>{STATUS[a.status]?.label ?? a.status}</span>
                  </p>
                  {a.status === "rejected" && a.curatorNote && <p className="mt-1 text-xs text-red-400">Curadoria: {a.curatorNote}</p>}
                </div>
                <button type="button" onClick={() => void remove(a.id, a.title)} aria-label={`Remover ${a.title}`} className="p-2 text-muted-foreground hover:text-red-400">
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
