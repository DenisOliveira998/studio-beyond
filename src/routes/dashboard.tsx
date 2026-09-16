import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { RichEditor } from "@/components/RichEditor";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileClock,
  CircleDollarSign,
  Eye,
  EyeOff,
  FileText,
  FileUp,
  Heart,
  History,
  ImagePlus,
  LayoutDashboard,
  Library,
  Pencil,
  Send,
  UserRound,
  X,
} from "lucide-react";
import type { Work } from "@/lib/beyond-data";
import { PLATFORM_FEE, RATE_PER_CLICK, compact, money, MEDIUM_LABEL } from "@/lib/beyond-data";
import type { DonationRow, WorkStats, DbWork } from "@/lib/beyond-db";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel do autor — The Beyond" },
      {
        name: "description",
        content:
          "Acompanhe a receita por cliques, as doações recebidas, publique novas obras e gerencie seu perfil de autor.",
      },
      { property: "og:title", content: "Painel do autor — The Beyond" },
      {
        property: "og:description",
        content: "Uma visão direta do que sua obra rendeu neste mês.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const NAV = [
  { id: "visao-geral", label: "Visão Geral", icon: LayoutDashboard },
  { id: "minhas-obras", label: "Minhas Obras", icon: Library },
  { id: "publicar", label: "Publicar Obra", icon: Send },
  { id: "em-revisao", label: "Em revisão", icon: FileClock },
  { id: "historico", label: "Histórico", icon: History },
  { id: "ganhos", label: "Ganhos", icon: CircleDollarSign },
  { id: "perfil", label: "Meu Perfil", icon: UserRound },
];

type LogType = "submit" | "donation" | "edit" | "publish" | "unpublish" | "review";

const CHANGELOG: Array<{
  date: string;
  work: string;
  action: string;
  type: LogType;
}> = [
  { date: "30 ago 2026", work: "O Barulho das Coisas Quietas — Cap. 13", action: "Enviado para revisão da curadoria", type: "submit" },
  { date: "28 ago 2026", work: "Antes que a Maré Mude", action: "Doação recebida: R$ 15,00 — Anônimo", type: "donation" },
  { date: "22 ago 2026", work: "O Barulho das Coisas Quietas — Cap. 12", action: "Curadoria solicitou ajustes: revisar consistência de voz no 2º parágrafo", type: "review" },
  { date: "14 ago 2026", work: "Antes que a Maré Mude", action: "Título atualizado para a versão atual", type: "edit" },
  { date: "10 ago 2026", work: "Antes que a Maré Mude", action: "Publicada no feed após aprovação da curadoria", type: "publish" },
  { date: "05 ago 2026", work: "O Barulho das Coisas Quietas", action: "Imagem de capa substituída", type: "edit" },
  { date: "21 jul 2026", work: "Antes que a Maré Mude", action: "Enviado para revisão da curadoria", type: "submit" },
  { date: "15 jul 2026", work: "O Barulho das Coisas Quietas", action: "Publicada no feed após aprovação da curadoria", type: "publish" },
];

const LOG_DOT: Record<LogType, string> = {
  submit:   "bg-gilt/70 border-gilt/50",
  donation: "bg-gilt border-gilt",
  edit:     "bg-border border-border",
  publish:  "bg-[var(--chart-2)]/70 border-[var(--chart-2)]/50",
  unpublish:"bg-destructive/50 border-destructive/30",
  review:   "bg-muted-foreground/40 border-muted-foreground/30",
};

const LOG_LABEL: Record<LogType, string> = {
  submit:   "Envio",
  donation: "Doação",
  edit:     "Edição",
  publish:  "Publicação",
  unpublish:"Despublicação",
  review:   "Revisão",
};

const WORK_TYPES = ["Livro", "Mangá", "HQ", "Conto"];


type DashboardData = {
  works: Work[];
  stats: WorkStats;
  donations: DonationRow[];
};

function Dashboard() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const displayName = profile?.name ?? user?.name ?? "Autor";
  const initials = displayName.slice(0, 2).toUpperCase();

  const { data: dashData, refetch: refetchDash } = useQuery<DashboardData>({
    queryKey: ["author-dashboard"],
    queryFn: () => fetch("/api/author/dashboard").then((r) => r.json() as Promise<DashboardData>),
    enabled: !!user,
    staleTime: 30_000,
  });

  const initialWorks: Work[] = dashData?.works ?? [];
  const donations: DonationRow[] = dashData?.donations ?? [];
  const stats: WorkStats = dashData?.stats ?? { views: {}, donations: {}, supporters: {} };

  const [published, setPublished] = useState<Record<string, boolean>>({});

  const totalViews = Object.entries(stats.views)
    .filter(([slug]) => initialWorks.some((w) => w.slug === slug))
    .reduce((s, [, v]) => s + v, 0);
  const clickGross = totalViews * RATE_PER_CLICK;
  const donationGross = donations.reduce((s, d) => s + d.amount, 0);
  const gross = clickGross + donationGross;
  const fee = gross * PLATFORM_FEE;
  const net = gross - fee;

  const { data: myDbWorks = [] } = useQuery<DbWork[]>({
    queryKey: ["works-mine"],
    queryFn: () => fetch("/api/works/mine").then((r) => r.json() as Promise<DbWork[]>),
    enabled: !!user,
    staleTime: 30_000,
  });
  const queue = myDbWorks
    .filter((w) => w.status !== "approved" && w.status !== "draft")
    .map((w) => ({
      id: w.id,
      title: w.title,
      type: MEDIUM_LABEL[w.medium],
      submitted: new Date(w.createdAt).toLocaleDateString("pt-BR"),
      note: w.curatorNote ?? undefined,
    }));

  const [editingWork, setEditingWork] = useState<Work | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState("");

  const [title, setTitle] = useState("");
  const [workType, setWorkType] = useState(WORK_TYPES[0]);
  const [body, setBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [tags, setTags] = useState("");
  const [coverName, setCoverName] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<"idle" | "pdf" | "work">("idle");
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  function togglePublish(id: string, workTitle: string) {
    setPublished((prev) => {
      const next = !prev[id];
      toast.success(next ? `"${workTitle}" republicada.` : `"${workTitle}" despublicada.`);
      return { ...prev, [id]: next };
    });
  }

  async function submit(kind: "publish" | "draft") {
    if (!title.trim()) {
      toast.error("Informe o título da obra antes de continuar.");
      return;
    }
    setUploading(true);
    setUploadStep("idle");
    let pdfUrl: string | null = null;
    try {
      // Se tiver PDF selecionado, faz upload primeiro
      if (pdfFile) {
        setUploadStep("pdf");
        const fd = new FormData();
        fd.append("file", pdfFile);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          toast.error(data.error ?? "Erro ao enviar o PDF.");
          setUploading(false);
          setUploadStep("idle");
          return;
        }
        pdfUrl = data.url;
      }
      setUploadStep("work");

      const mediumMap: Record<string, string> = {
        Livro: "livro", Mangá: "manga", HQ: "hq", Conto: "conto",
      };
      const medium = mediumMap[workType ?? "Livro"] ?? "livro";
      await fetch("/api/works", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          medium,
          artistName: displayName,
          excerpt: body.slice(0, 240),
          body,
          tags,
          pdfUrl,
          status: kind === "publish" ? "pending" : "draft",
        }),
      });

      if (kind === "publish") {
        void queryClient.invalidateQueries({ queryKey: ["works-mine"] });
        void refetchDash();
      }
      toast.success(
        kind === "publish"
          ? `"${title}" enviada para revisão da curadoria.`
          : `Rascunho de "${title}" salvo.`,
      );
      setTitle("");
      setBody("");
      setTags("");
      setCoverName(null);
      setPdfName(null);
      setPdfFile(null);
    } catch {
      toast.error("Erro ao enviar a obra. Tente novamente.");
    } finally {
      setUploading(false);
      setUploadStep("idle");
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Sidebar fixa */}
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[220px] shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="px-6 pt-8 pb-6">
          <p className="eyebrow">Painel do autor</p>
          <p className="mt-2 font-display text-xl tracking-tight">{displayName}</p>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <item.icon className="size-4 text-gilt" strokeWidth={1.5} />
              {item.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto px-6 pb-8">
          <p className="text-xs text-muted-foreground">{user?.email ?? ""}</p>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="min-w-0 flex-1 px-5 py-12 sm:px-10 lg:px-14">
        {/* Navegação mobile */}
        <nav className="mb-10 flex flex-wrap gap-2 md:hidden">
          {NAV.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="flex items-center gap-2 border border-border px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground"
            >
              <item.icon className="size-3.5 text-gilt" strokeWidth={1.5} />
              {item.label}
            </a>
          ))}
        </nav>

        {/* Visão Geral */}
        <section id="visao-geral" className="scroll-mt-24">
          <SectionTitle icon={LayoutDashboard}>Visão Geral</SectionTitle>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Total de Visualizações"
              value={compact(totalViews)}
              note="Todas as obras"
            />
            <Stat
              label="Doações Recebidas"
              value={money(donationGross)}
              note="Apoio direto de leitores"
            />
            <Stat
              label="Obras Publicadas"
              value={String(initialWorks.filter((w) => !["pending", "draft", "rejected"].includes((w as unknown as { status?: string }).status ?? "")).length || initialWorks.length)}
              note="No feed público"
            />
            <Stat
              label="Receita Líquida"
              value={money(net)}
              note={`Após ${Math.round(PLATFORM_FEE * 100)}% da plataforma`}
              accent
            />
          </div>
        </section>

        {/* Minhas Obras */}
        <section id="minhas-obras" className="mt-16 scroll-mt-24">
          <SectionTitle icon={Library}>Minhas Obras</SectionTitle>
          <div className="mt-8 overflow-x-auto border border-border">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <Th>Obra</Th>
                  <Th>Publicação</Th>
                  <Th>Visualizações</Th>
                  <Th>Doações</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {initialWorks.map((w) => {
                  const live = published[w.id];
                  return (
                    <tr key={w.id} className="transition-colors hover:bg-surface/60">
                      <Td>
                        <Link
                          to="/work/$slug"
                          params={{ slug: w.slug }}
                          className="rule-hover font-display text-lg"
                        >
                          {w.title}
                        </Link>
                        {!live && (
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-destructive">
                            Despublicada
                          </p>
                        )}
                      </Td>
                      <Td className="text-muted-foreground">{w.published}</Td>
                      <Td>{compact(w.clicks)}</Td>
                      <Td className="text-gilt">{money(donations.filter((d) => d.workSlug === w.slug).reduce((s, d) => s + d.amount, 0))}</Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-2">
                          <ActionButton
                            onClick={() => {
                              setEditingWork(w);
                              setEditTitle(w.title);
                              setEditType(WORK_TYPES.find((t) => t.toLowerCase() === w.medium) ?? WORK_TYPES[0] ?? "Livro");
                            }}
                          >
                            <Pencil className="size-3.5" /> Editar
                          </ActionButton>
                          <ActionButton danger onClick={() => togglePublish(w.id, w.title)}>
                            {live ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                            {live ? "Despublicar" : "Republicar"}
                          </ActionButton>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Publicar Obra */}
        <section id="publicar" className="mt-16 scroll-mt-24">
          <SectionTitle icon={Send}>Publicar Obra</SectionTitle>
          <form
            className="mt-8 border border-gilt/25 bg-background p-8 sm:p-10"
            onSubmit={(e) => {
              e.preventDefault();
              void submit("publish");
            }}
          >
            <div className="grid gap-8">
              <Field label="Título da obra" htmlFor="obra-titulo">
                <input
                  id="obra-titulo"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Uma Taxonomia Silenciosa"
                  className="w-full border border-border bg-transparent px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-gilt"
                />
              </Field>

              <Field label="Tipo de obra" htmlFor="obra-tipo">
                <select
                  id="obra-tipo"
                  value={workType}
                  onChange={(e) => setWorkType(e.target.value)}
                  className="w-full border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-gilt"
                >
                  {WORK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Descrição / conteúdo" htmlFor="obra-conteudo">
                <RichEditor
                  value={body}
                  onChange={setBody}
                  placeholder="Escreva ou descreva sua obra aqui…"
                />
              </Field>

              <Field label="Imagem de capa" htmlFor="obra-capa">
                <input
                  ref={fileRef}
                  id="obra-capa"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setCoverName(e.target.files?.[0]?.name ?? null)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center justify-center gap-3 border border-dashed border-border px-4 py-10 text-sm text-muted-foreground transition-colors hover:border-gilt hover:text-gilt"
                >
                  <ImagePlus className="size-5 text-gilt" strokeWidth={1.5} />
                  {coverName ?? "Clique para enviar uma imagem de capa"}
                </button>
              </Field>

              <Field label="Arquivo PDF (opcional)" htmlFor="obra-pdf">
                <input
                  ref={pdfRef}
                  id="obra-pdf"
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setPdfFile(f);
                    setPdfName(f?.name ?? null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => pdfRef.current?.click()}
                  className="flex w-full items-center justify-center gap-3 border border-dashed border-border px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-gilt hover:text-gilt"
                >
                  <FileUp className="size-5 text-gilt" strokeWidth={1.5} />
                  {pdfName ?? "Clique para enviar o PDF da obra"}
                </button>
                <p className="mt-2 text-xs text-muted-foreground/60">
                  Opcional. Leitores verão um botão de download na página da obra.
                </p>
              </Field>

              <Field label="Tags / categorias" htmlFor="obra-tags">
                <input
                  id="obra-tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="Ex.: ensaio, atenção, nanquim"
                  className="w-full border border-border bg-transparent px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-gilt"
                />
              </Field>
            </div>

            {/* Pré-visualização (item 25-26) */}
            {showPreview && (
              <div className="mt-8 rounded-[2px] border border-gilt/30 bg-background p-6">
                <p className="eyebrow mb-4 flex items-center gap-2 text-gilt">
                  <Eye className="size-3.5" strokeWidth={1.5} /> Pré-visualização
                </p>
                {title ? (
                  <>
                    <p className="eyebrow text-muted-foreground">{workType}</p>
                    <h3 className="mt-2 font-display text-2xl tracking-tight">{title}</h3>
                    {body && (
                      <div
                        className="prose mt-4 max-w-none text-sm text-muted-foreground"
                        dangerouslySetInnerHTML={{ __html: body.slice(0, 800) + (body.length > 800 ? "…" : "") }}
                      />
                    )}
                    {tags && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                          <span key={t} className="border border-border px-2 py-0.5 text-xs text-muted-foreground">{t}</span>
                        ))}
                      </div>
                    )}
                    {coverName && (
                      <p className="mt-3 text-xs text-muted-foreground">Capa: {coverName}</p>
                    )}
                    {pdfName && (
                      <p className="mt-1 text-xs text-muted-foreground">PDF: {pdfName}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground/60">Preencha o título para ver a pré-visualização.</p>
                )}
              </div>
            )}

            {/* Barra de progresso do upload */}
            {uploading && (
              <div className="mt-8">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>
                    {uploadStep === "pdf" && "Enviando PDF…"}
                    {uploadStep === "work" && "Salvando obra…"}
                    {uploadStep === "idle" && "Preparando…"}
                  </span>
                  <span className="animate-pulse text-gilt">●</span>
                </div>
                <div className="h-0.5 w-full overflow-hidden bg-border">
                  <div
                    className="h-full bg-gilt transition-all duration-500"
                    style={{ width: uploadStep === "pdf" ? "40%" : uploadStep === "work" ? "80%" : "10%" }}
                  />
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="submit"
                disabled={uploading}
                className="inline-flex items-center justify-center gap-2 bg-gilt px-8 py-3.5 text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                <Send className="size-4" /> {uploading ? "Enviando…" : "Enviar para revisão"}
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={() => void submit("draft")}
                className="inline-flex items-center justify-center gap-2 border border-border px-8 py-3.5 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-gilt hover:text-gilt disabled:opacity-60"
              >
                <FileText className="size-4" /> Salvar rascunho
              </button>
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className="inline-flex items-center justify-center gap-2 border border-border px-6 py-3.5 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-gilt hover:text-gilt"
              >
                {showPreview ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                {showPreview ? "Fechar prévia" : "Pré-visualizar"}
              </button>
            </div>
          </form>
        </section>

        {/* Em revisão */}
        <section id="em-revisao" className="mt-16 scroll-mt-24">
          <SectionTitle icon={FileClock}>Em revisão</SectionTitle>
          <p className="caption mt-4">
            Toda obra enviada entra como "Em revisão". Ela aparece nas Obras apenas depois da
            aprovação da curadoria.
          </p>
          <div className="mt-6 overflow-x-auto border border-border">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <Th>Obra</Th>
                  <Th>Tipo</Th>
                  <Th>Enviada em</Th>
                  <Th className="text-right">Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {queue.length === 0 && (
                  <tr>
                    <Td className="text-muted-foreground">Nenhuma obra na fila da curadoria.</Td>
                    <Td>—</Td>
                    <Td>—</Td>
                    <Td className="text-right">—</Td>
                  </tr>
                )}
                {queue.map((q) => (
                  <tr key={q.id} className="transition-colors hover:bg-surface/60">
                    <Td>
                      <p className="font-display text-lg leading-tight">{q.title}</p>
                      {q.note && <p className="caption mt-1">{q.note}</p>}
                    </Td>
                    <Td className="text-muted-foreground">{q.type}</Td>
                    <Td className="text-muted-foreground">{q.submitted}</Td>
                    <Td className="text-right">
                      <span
                        className={`btn-type inline-block border px-2 py-1 text-[0.6rem] ${
                          q.note
                            ? "border-border bg-muted text-muted-foreground"
                            : "border-gilt/50 bg-gilt/10 text-gilt"
                        }`}
                      >
                        {q.note ? "Ajustes solicitados" : "Em revisão"}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Histórico de alterações */}
        <section id="historico" className="mt-16 scroll-mt-24">
          <SectionTitle icon={History}>Histórico de alterações</SectionTitle>
          <p className="caption mt-4">
            Todas as ações realizadas nas suas obras, por ordem cronológica.
          </p>

          <div className="relative ml-3 mt-8">
            {/* Linha vertical */}
            <div className="absolute bottom-2 left-2 top-2 w-px bg-border" />

            <div className="space-y-0">
              {CHANGELOG.map((entry, i) => (
                <div key={i} className="relative flex gap-6 pb-8 pl-9">
                  {/* Dot */}
                  <div
                    className={`absolute left-0 top-1 size-4 shrink-0 rounded-[2px] border ${LOG_DOT[entry.type]}`}
                  />

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-3">
                      <span className="caption whitespace-nowrap">{entry.date}</span>
                      <span
                        className={`inline-block border px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.14em] ${LOG_DOT[entry.type]} opacity-80`}
                      >
                        {LOG_LABEL[entry.type]}
                      </span>
                    </div>
                    <p className="mt-1 font-display text-lg leading-snug">{entry.work}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {entry.action}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Ganhos */}
        <section id="ganhos" className="mt-16 scroll-mt-24">
          <SectionTitle icon={CircleDollarSign}>Ganhos</SectionTitle>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="border border-gilt/25 bg-background p-8">
              <p className="eyebrow">Composição dos ganhos</p>
              <div className="mt-6 space-y-5">
                <RevenueRow
                  label="Receita por cliques"
                  value={clickGross}
                  total={gross}
                />
                <RevenueRow label="Doações recebidas" value={donationGross} total={gross} />
              </div>
              <div className="mt-8 border-t border-border pt-6">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm text-muted-foreground">Total bruto</p>
                  <p className="font-display text-2xl tracking-tight">{money(gross)}</p>
                </div>
              </div>
            </div>
            <div className="border border-gilt/25 bg-background p-8">
              <p className="eyebrow">Seu repasse</p>
              <div className="mt-6 space-y-5">
                <RevenueRow label={`Taxa da plataforma (${Math.round(PLATFORM_FEE * 100)}%)`} value={fee} total={gross} />
                <RevenueRow label="Valor líquido" value={net} total={gross} />
              </div>
              <div className="mt-8 border-t border-border pt-6">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm text-muted-foreground">Próximo pagamento</p>
                  <p className="font-display text-2xl tracking-tight text-gilt">{money(net)}</p>
                </div>
                <p className="mt-2 text-right text-xs text-muted-foreground">
                  Pago na sexta-feira · contador simulado
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 overflow-x-auto border border-border">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <Th>Data</Th>
                  <Th>Obra</Th>
                  <Th>Tipo</Th>
                  <Th>Origem</Th>
                  <Th className="text-right">Valor</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {donations.length === 0 ? (
                  <tr>
                    <Td className="text-muted-foreground" colSpan={5}>Nenhuma doação recebida ainda.</Td>
                  </tr>
                ) : donations.map((d) => (
                  <tr key={d.id} className="transition-colors hover:bg-surface/60">
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {new Date(d.createdAt).toLocaleDateString("pt-BR")}
                    </Td>
                    <Td>{d.workSlug}</Td>
                    <Td>
                      <span className="inline-flex items-center gap-1.5 border px-2 py-1 text-xs uppercase tracking-[0.14em] border-gilt/50 bg-gilt/10 text-gilt">
                        <Heart className="size-3" />
                        Doação
                      </span>
                    </Td>
                    <Td className="text-muted-foreground">{d.donorName}</Td>
                    <Td className="text-right text-gilt">{money(d.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Modal de edição de obra (item 9) */}
        {editingWork && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="w-full max-w-lg border border-gilt/40 bg-surface p-8 shadow-[var(--shadow-gallery)]">
              <div className="flex items-center justify-between">
                <p className="font-display text-xl tracking-tight">Editar obra</p>
                <button
                  onClick={() => setEditingWork(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Fechar"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-6 grid gap-4">
                <label className="block">
                  <span className="eyebrow">Título</span>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-gilt"
                  />
                </label>
                <label className="block">
                  <span className="eyebrow">Tipo de obra</span>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-gilt"
                  >
                    {WORK_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    toast.success(`Alterações em "${editTitle}" salvas.`);
                    setEditingWork(null);
                  }}
                  className="bg-gilt px-6 py-2.5 text-xs uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Salvar alterações
                </button>
                <button
                  onClick={() => setEditingWork(null)}
                  className="border border-border px-6 py-2.5 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-gilt hover:text-gilt"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Meu Perfil */}
        <section id="perfil" className="mt-16 scroll-mt-24">
          <SectionTitle icon={UserRound}>Meu Perfil</SectionTitle>
          <div className="mt-8 border border-gilt/25 bg-background p-8 sm:p-10">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
              <div className="flex size-20 shrink-0 items-center justify-center border border-gilt/40 font-display text-2xl text-gilt">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="font-display text-2xl tracking-tight">{displayName}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {user?.email ?? ""}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  {initialWorks.length > 0 && (
                    <Link
                      to="/artist/$slug"
                      params={{ slug: initialWorks[0]!.artistSlug }}
                      className="border border-border px-5 py-2.5 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-gilt hover:text-gilt"
                    >
                      Ver página pública
                    </Link>
                  )}
                  <button
                    onClick={() => toast.success("Edição de perfil disponível em breve.")}
                    className="border border-border px-5 py-2.5 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-gilt hover:text-gilt"
                  >
                    Editar perfil
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <Icon className="size-5 text-gilt" strokeWidth={1.5} />
        <h2 className="font-display text-3xl tracking-tight">{children}</h2>
      </div>
      <div className="mt-4 h-px w-full bg-gradient-to-r from-gilt/60 via-gilt/25 to-transparent" />
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="eyebrow">
        {label}
      </label>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-4 align-middle ${className}`}>{children}</td>;
}

function ActionButton({
  children,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-xs transition-colors ${
        danger
          ? "border-border text-muted-foreground hover:border-destructive hover:text-destructive"
          : "border-border text-muted-foreground hover:border-gilt hover:text-gilt"
      }`}
    >
      {children}
    </button>
  );
}

function RevenueRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-display text-xl tracking-tight">{money(value)}</p>
      </div>
      <div className="mt-2 h-1 w-full bg-muted">
        <div className="h-full bg-gilt transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-right text-xs text-muted-foreground">
        {pct.toFixed(1).replace(".", ",")}%
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className="border border-gilt/25 bg-background p-7">
      <p className="eyebrow">{label}</p>
      <p
        className={`mt-4 font-display text-4xl tracking-tight ${accent ? "text-gilt" : ""}`}
      >
        {value}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
