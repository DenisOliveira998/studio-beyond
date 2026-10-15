import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AgeBadge } from "@/components/age-badge";
import { ARTWORK_KINDS, type ArtworkKind } from "@/lib/gallery-kinds";
import type { AgeRating } from "@/lib/beyond-data";

type Pending = {
  id: string;
  title: string;
  kind: string;
  description: string;
  ageRating: string;
  relatedWorkSlug: string | null;
  images: string[];
  artist: string;
  artistSlug: string;
  createdAt: string;
};

/** Curadoria da Galeria: cada publicação só aparece depois de aprovada aqui. */
export function AdminGallery() {
  const qc = useQueryClient();
  const { data = [] } = useQuery<Pending[]>({
    queryKey: ["admin-galeria"],
    queryFn: () => fetch("/api/admin/galeria").then((r) => r.json()),
    staleTime: 30_000,
  });
  const [ratings, setRatings] = useState<Record<string, string>>({});

  async function decide(p: Pending, aprovar: boolean) {
    const nota = aprovar ? null : window.prompt("Motivo da recusa (o artista vai ver):") ?? null;
    if (!aprovar && nota === null) return;
    const res = await fetch(`/api/admin/galeria/${p.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ aprovar, nota, ...(ratings[p.id] ? { ageRating: ratings[p.id] } : {}) }),
    });
    if (!res.ok) { toast.error("Não foi possível registrar a decisão."); return; }
    toast.success(aprovar ? "Publicação aprovada e no ar." : "Publicação recusada.");
    void qc.invalidateQueries({ queryKey: ["admin-galeria"] });
  }

  if (!data.length) return <p className="mt-6 text-sm text-muted-foreground">Nenhuma publicação esperando a curadoria.</p>;

  return (
    <ul className="mt-6 space-y-4">
      {data.map((p) => (
        <li key={p.id} className="rounded border border-border bg-background p-5 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-bold">{p.title}</p>
              <p className="text-xs text-muted-foreground">
                {ARTWORK_KINDS[p.kind as ArtworkKind] ?? p.kind}, por {p.artist}. Enviada em {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                {p.relatedWorkSlug ? `. Fan art de /obra/${p.relatedWorkSlug}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <AgeBadge rating={(ratings[p.id] ?? p.ageRating) as AgeRating} />
              <select
                aria-label="Classificação"
                value={ratings[p.id] ?? p.ageRating}
                onChange={(e) => setRatings((r) => ({ ...r, [p.id]: e.target.value }))}
                className="border border-input bg-background px-2 py-1 text-xs"
              >
                <option value="L">Livre</option>
                <option value="10">10 anos</option>
                <option value="12">12 anos</option>
                <option value="14">14 anos</option>
                <option value="16">16 anos</option>
              </select>
              <button type="button" onClick={() => void decide(p, true)} className="rounded-full bg-gilt px-4 py-1.5 text-xs font-bold text-ink">
                Aprovar
              </button>
              <button type="button" onClick={() => void decide(p, false)} className="rounded-full border border-border px-4 py-1.5 text-xs">
                Recusar
              </button>
            </div>
          </div>
          {p.description && <p className="mt-3 whitespace-pre-line text-muted-foreground">{p.description}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {p.images.map((src, i) => (
              <a key={src} href={src} target="_blank" rel="noreferrer">
                <img src={src} alt={`Imagem ${i + 1}`} className="h-32 rounded object-cover" />
              </a>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
