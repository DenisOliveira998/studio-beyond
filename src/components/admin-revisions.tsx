import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type Revision = {
  id: string;
  kind: "work" | "chapter" | "new_chapter";
  createdAt: string;
  data: Record<string, unknown>;
  work: { id: string; slug: string; title: string; excerpt: string; coverUrl: string | null; medium: string; artistName: string; tags?: string | null } | null;
  chapterNumber: number | null;
  chapterTitle: string | null;
};

const strip = (s: string) => s.replace(/<[^>]*>/g, "");
const SITUACAO: Record<string, string> = { andamento: "Em andamento", finalizado: "Finalizada", paralisado: "Pausada" };

/** Alterações que autores pediram em obras já aprovadas: nome, sinopse, capa, formato ou PDF de capítulo. */
export function AdminRevisions() {
  const qc = useQueryClient();
  const { data = [] } = useQuery<Revision[]>({
    queryKey: ["admin-revisoes"],
    queryFn: () => fetch("/api/admin/revisoes").then((r) => r.json() as Promise<Revision[]>),
    staleTime: 30_000,
  });

  async function decide(id: string, aprovar: boolean) {
    const nota = aprovar ? null : window.prompt("Motivo da recusa (o autor vai ver):") ?? null;
    if (!aprovar && nota === null) return;
    const res = await fetch(`/api/admin/revisoes/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ aprovar, nota }),
    });
    if (!res.ok) {
      toast.error("Não foi possível registrar a decisão.");
      return;
    }
    toast.success(aprovar ? "Alteração aprovada e aplicada." : "Alteração recusada.");
    void qc.invalidateQueries({ queryKey: ["admin-revisoes"] });
  }

  if (data.length === 0) return <p className="mt-6 text-sm text-muted-foreground">Nenhuma alteração esperando revisão.</p>;

  return (
    <ul className="mt-6 space-y-4">
      {data.map((r) => (
        <li key={r.id} className="rounded border border-border bg-background p-5 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-bold">
                {r.work ? strip(r.work.title) : "Obra removida"}
                {r.chapterNumber != null && (
                  <span className="font-normal text-muted-foreground">
                    {r.kind === "new_chapter" ? ". Capítulo novo: " : ". "}Capítulo {String(r.chapterNumber).replace(".", ",")}
                    {r.kind === "new_chapter" && typeof r.data["title"] === "string" && r.data["title"] ? ` - ${r.data["title"]}` : ""}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {r.work?.artistName}. Pedido em {new Date(r.createdAt).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => void decide(r.id, true)} className="rounded-full bg-gilt px-4 py-1.5 text-xs font-bold text-ink">
                Aprovar
              </button>
              <button type="button" onClick={() => void decide(r.id, false)} className="rounded-full border border-border px-4 py-1.5 text-xs">
                Recusar
              </button>
            </div>
          </div>
          <dl className="mt-4 grid gap-2">
            {r.kind === "new_chapter" && (
              <div>
                <dt className="text-xs text-muted-foreground">Capítulo novo, entra no ar ao aprovar</dt>
                <dd>
                  {typeof r.data["pdfPages"] === "number" ? `${r.data["pdfPages"]} páginas.` : "Número de páginas desconhecido."}{" "}
                  <a
                    href={`/api/blob-proxy?url=${encodeURIComponent(String(r.data["pdfUrl"] ?? ""))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                  >
                    Abrir o PDF
                  </a>
                </dd>
              </div>
            )}
            {r.kind === "chapter" && "title" in r.data && (
              <div>
                <dt className="text-xs text-muted-foreground">Nome do capítulo</dt>
                <dd>
                  <span className="text-muted-foreground line-through">{r.chapterTitle ?? "sem nome"}</span> → {String(r.data["title"] ?? "") || "sem nome"}
                </dd>
              </div>
            )}
            {r.kind === "new_chapter" ? null : r.kind === "chapter" && typeof r.data["pdfUrl"] !== "string" ? null : r.kind === "chapter" ? (
              <div>
                <dt className="text-xs text-muted-foreground">Troca do PDF do capítulo</dt>
                <dd>
                  Arquivo novo com {typeof r.data["pdfPages"] === "number" ? `${r.data["pdfPages"]} páginas` : "número de páginas desconhecido"}.{" "}
                  <a
                    href={`/api/blob-proxy?url=${encodeURIComponent(String(r.data["pdfUrl"] ?? ""))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                  >
                    Abrir o PDF novo
                  </a>
                </dd>
              </div>
            ) : (
              <>
                {typeof r.data["title"] === "string" && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Nome</dt>
                    <dd>
                      <span className="text-muted-foreground line-through">{r.work ? strip(r.work.title) : ""}</span> → {String(r.data["title"])}
                    </dd>
                  </div>
                )}
                {typeof r.data["excerpt"] === "string" && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Sinopse nova</dt>
                    <dd>{String(r.data["excerpt"])}</dd>
                  </div>
                )}
                {typeof r.data["medium"] === "string" && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Formato</dt>
                    <dd>
                      {r.work?.medium} → {String(r.data["medium"])}
                    </dd>
                  </div>
                )}
                {r.data["unpublish"] === true && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Despublicar</dt>
                    <dd>O autor pediu para tirar a obra do ar.</dd>
                  </div>
                )}
                {typeof r.data["tags"] === "string" && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Gêneros</dt>
                    <dd>
                      {r.work?.tags ? <span className="text-muted-foreground line-through">{r.work.tags}</span> : <span className="text-muted-foreground">sem gêneros</span>} → {String(r.data["tags"])}
                    </dd>
                  </div>
                )}
                {typeof r.data["workStatus"] === "string" && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Situação da obra</dt>
                    <dd>{SITUACAO[String(r.data["workStatus"])] ?? String(r.data["workStatus"])}</dd>
                  </div>
                )}
                {typeof r.data["coverUrl"] === "string" && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Capa nova</dt>
                    <dd>
                      <img
                        src={`/api/blob-proxy?url=${encodeURIComponent(String(r.data["coverUrl"]))}`}
                        alt="Capa nova"
                        className="mt-1 h-32 rounded object-cover"
                      />
                    </dd>
                  </div>
                )}
              </>
            )}
          </dl>
        </li>
      ))}
    </ul>
  );
}
