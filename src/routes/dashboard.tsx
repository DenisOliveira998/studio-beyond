import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChapterManager } from "@/components/chapter-manager";
import { useEffect, useRef, useState } from "react";
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
      { title: "Painel do autor | Go Beyondd" },
      { name: "robots", content: "noindex, nofollow" },
      {
        name: "description",
        content:
          "Acompanhe a receita por cliques, as doações recebidas, publique novas obras e gerencie seu perfil de autor.",
      },
      { property: "og:title", content: "Painel do autor — Go Beyondd" },
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

const WORK_TYPES = ["Livro", "Mangá", "HQ", "Conto", "Novel", "Manhwa", "Manhua"];

const GENRE_TAGS = [
  "Ação", "Aventura", "Comédia", "Drama", "Fantasia",
  "Ficção Científica", "Horror", "Mistério", "Romance",
  "Suspense", "Slice of Life", "Sobrenatural", "Distopia",
  "Histórico", "Policial", "Ensaio", "Poesia", "Biografia",
  "Mangá Brasileiro", "Psicológico",
];


type DashboardData = {
  works: Work[];
  stats: WorkStats;
  donations: DonationRow[];
};

function Dashboard() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!loading && !user && !profile) void navigate({ to: "/entrar" });
  }, [user, profile, loading, navigate]);
  const displayName = profile?.name ?? user?.name ?? "Autor";
  const initials = displayName.slice(0, 2).toUpperCase();

  useEffect(() => {
    if (displayName && displayName !== "Autor") {
      setArtistNameInput((prev) => prev || displayName);
    }
  }, [displayName]);

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
  const [savingEdit, setSavingEdit] = useState(false);

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
  useEffect(() => {
    if (myDbWorks.length > 0) {
      const state: Record<string, boolean> = {};
      for (const w of myDbWorks) state[w.id] = w.status === "approved";
      setPublished(state);
    }
  }, [myDbWorks]);
  const queue = myDbWorks
    .filter((w) => w.status !== "approved" && w.status !== "draft")
    .map((w) => ({
      id: w.id,
      title: w.title,
      type: MEDIUM_LABEL[w.medium],
      submitted: new Date(w.createdAt).toLocaleDateString("pt-BR"),
      note: w.curatorNote ?? undefined,
      status: w.status,
    }));

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editProfileName, setEditProfileName] = useState("");

  const [editingWork, setEditingWork] = useState<Work | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);

  const DRAFT_KEY = "beyond_dashboard_draft_v1";

  const [title, setTitle] = useState(() => {
    try { return (JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as { title?: string }).title ?? ""; } catch { return ""; }
  });
  const [artistNameInput, setArtistNameInput] = useState("");
  const [workType, setWorkType] = useState(WORK_TYPES[0]);
  const [synopsis, setSynopsis] = useState(() => {
    try { return (JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as { synopsis?: string }).synopsis ?? ""; } catch { return ""; }
  });
  const [body, setBody] = useState(() => {
    try { return (JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as { body?: string }).body ?? ""; } catch { return ""; }
  });
  const [showPreview, setShowPreview] = useState(false);
  const [tags, setTags] = useState<string[]>(() => {
    try { return (JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as { tags?: string[] }).tags ?? []; } catch { return []; }
  });
  const [coverName, setCoverName] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<"idle" | "cover" | "pdf" | "work">("idle");
  const [pdfProgress, setPdfProgress] = useState<{ message: string; percent: number } | null>(null);
  const [firstChapter, setFirstChapter] = useState("1");
  const [firstChapterTitle, setFirstChapterTitle] = useState("");
  const [chaptersOf, setChaptersOf] = useState<{ id: string; title: string; medium: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  // Auto-save rascunho no localStorage
  useEffect(() => {
    if (!title && !synopsis && !body && !tags.length) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, synopsis, body, tags })); } catch {}
  }, [title, synopsis, body, tags, DRAFT_KEY]);

  // Aviso ao sair com conteúdo não salvo
  useEffect(() => {
    if (!title && !synopsis && !body) return;
    function onBeforeUnload(e: BeforeUnloadEvent) { e.preventDefault(); e.returnValue = ""; }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [title, synopsis, body]);

  async function togglePublish(id: string, workTitle: string) {
    const isLive = published[id];
    const newStatus = isLive ? "draft" : "pending";
    try {
      const res = await fetch(`/api/works/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      setPublished((prev) => ({ ...prev, [id]: !isLive }));
      void queryClient.invalidateQueries({ queryKey: ["works-mine"] });
      void refetchDash();
      toast.success(isLive ? `"${workTitle}" despublicada.` : `"${workTitle}" enviada para revisão.`);
    } catch {
      toast.error("Erro ao alterar status da obra.");
    }
  }

  async function submit(kind: "publish" | "draft") {
    if (!title.trim()) {
      toast.error("Informe o título da obra.");
      return;
    }
    if (!synopsis.trim()) {
      toast.error("A sinopse é obrigatória.");
      return;
    }
    if (synopsis.trim().length < 73) {
      toast.error("A sinopse precisa ter pelo menos 73 caracteres.");
      return;
    }
    if (synopsis.trim().length > 280) {
      toast.error("A sinopse não pode passar de 280 caracteres.");
      return;
    }
    if (tags.length === 0) {
      toast.error("Escolha pelo menos um gênero para a obra.");
      return;
    }
    if (!coverFile) {
      toast.error("A imagem de capa é obrigatória.");
      return;
    }
    if (!pdfFile) {
      toast.error("O arquivo da obra é obrigatório.");
      return;
    }
    setUploading(true);
    setUploadStep("idle");
    let pdfUrl: string | null = null;
    let previewUrl: string | null = null;
    let pdfPages: number | null = null;
    let coverUrl: string | null = null;
    try {
      // Se tiver capa selecionada, faz upload primeiro
      if (coverFile) {
        setUploadStep("cover");
        const fd = new FormData();
        fd.append("file", coverFile);
        fd.append("purpose", "cover");
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          toast.error(data.error ?? "Erro ao enviar a capa.");
          setUploading(false);
          setUploadStep("idle");
          return;
        }
        coverUrl = data.url;
      }
      // PDF: comprime no navegador e envia direto para o armazenamento (até 100 MB)
      if (pdfFile) {
        setUploadStep("pdf");
        try {
          const { optimizePdf, formatBytes } = await import("@/lib/pdf-optimize");
          const { uploadPresigned } = await import("@vercel/blob/client");
          const comic = ["Mangá", "HQ", "Manhwa", "Manhua"].includes(workType ?? "");
          const opt = await optimizePdf(pdfFile, {
            comic,
            onProgress: (message, percent) => setPdfProgress({ message, percent: Math.round(percent * 0.5) }),
          });
          if (opt.full.size > 100 * 1024 * 1024) throw new Error("O PDF passa de 100 MB mesmo depois de comprimido.");
          const base = pdfFile.name.replace(/\.[^.]*$/, "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60) || "obra";
          const sent = await uploadPresigned(`obras/${base}.pdf`, opt.full, {
            access: "private",
            handleUploadUrl: "/api/upload/presign",
            contentType: "application/pdf",
            multipart: opt.full.size > 8 * 1024 * 1024,
            onUploadProgress: (e) => setPdfProgress({ message: `Enviando ${formatBytes(opt.full.size)}…`, percent: 50 + Math.round(e.percentage * 0.45) }),
          });
          const sentPreview = await uploadPresigned(`obras/${base}-previa.pdf`, opt.preview, {
            access: "private",
            handleUploadUrl: "/api/upload/presign",
            contentType: "application/pdf",
          });
          pdfUrl = sent.url;
          previewUrl = sentPreview.url;
          pdfPages = opt.pages;
          setPdfProgress({ message: "PDF enviado", percent: 100 });
          if (opt.finalBytes < opt.originalBytes) {
            toast.success(`PDF comprimido de ${formatBytes(opt.originalBytes)} para ${formatBytes(opt.finalBytes)}.`);
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Erro ao enviar o PDF.");
          setUploading(false);
          setUploadStep("idle");
          setPdfProgress(null);
          return;
        }
      }
      setUploadStep("work");

      const mediumMap: Record<string, string> = {
        Livro: "livro", Mangá: "manga", HQ: "hq", Conto: "conto",
        Novel: "lightnovel", Manhwa: "manhwa", Manhua: "manhua",
      };
      const medium = mediumMap[workType ?? "Livro"] ?? "livro";
      await fetch("/api/works", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          medium,
          artistName: artistNameInput.trim() || displayName,
          excerpt: synopsis.trim(),
          tags: tags.join(", "),
          pdfUrl,
          previewUrl,
          pdfPages,
          chapterNumber: Number(firstChapter.replace(",", ".")) || 1,
          chapterTitle: firstChapterTitle.trim(),
          coverUrl,
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
      setSynopsis("");
      setBody("");
      setTags([]);
      setCoverName(null);
      setCoverFile(null);
      setPdfName(null);
      setPdfFile(null);
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
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
              value={String(initialWorks.filter((w) => !["pending", "draft", "rejected", "changes"].includes((w as unknown as { status?: string }).status ?? "")).length)}
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
                          to="/obra/$slug"
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
                              setEditTags(w.tags ?? []);
                            }}
                          >
                            <Pencil className="size-3.5" /> Editar
                          </ActionButton>
                          {live && (
                            <ActionButton onClick={() => setChaptersOf({ id: w.id, title: w.title, medium: w.medium })}>
                              Capítulos
                            </ActionButton>
                          )}
                          <ActionButton danger onClick={() => void togglePublish(w.id, w.title)}>
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

        {chaptersOf && (
          <ChapterManager workId={chaptersOf.id} title={chaptersOf.title} medium={chaptersOf.medium} onClose={() => setChaptersOf(null)} />
        )}

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
              <Field label="Título da obra *" htmlFor="obra-titulo">
                <input
                  id="obra-titulo"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Uma Taxonomia Silenciosa"
                  className="w-full border border-border bg-transparent px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-gilt"
                />
              </Field>

              <Field label="Nome do autor" htmlFor="obra-artista">
                <input
                  id="obra-artista"
                  value={artistNameInput}
                  onChange={(e) => setArtistNameInput(e.target.value)}
                  placeholder={displayName}
                  className="w-full border border-border bg-transparent px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-gilt"
                />
                <p className="mt-1 text-xs text-muted-foreground/50">Preenchido com seu nome de perfil. Edite se quiser usar um nome artístico diferente.</p>
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

              <Field label="Sinopse *" htmlFor="obra-sinopse">
                <textarea
                  id="obra-sinopse"
                  required
                  rows={3}
                  maxLength={280}
                  value={synopsis}
                  onChange={(e) => setSynopsis(e.target.value)}
                  placeholder="Breve descrição da obra exibida no feed e na página pública (73–280 caracteres)"
                  className="w-full resize-y border border-border bg-transparent px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-gilt"
                />
                <p className={`mt-1 text-right text-xs ${synopsis.length < 73 ? "text-amber-500" : synopsis.length > 280 ? "text-red-500" : "text-muted-foreground/50"}`}>
                  {synopsis.length}/280{synopsis.length < 73 && ` (mín. 73)`}
                </p>
              </Field>


              <Field label="Imagem de capa *" htmlFor="obra-capa">
                <input
                  ref={fileRef}
                  id="obra-capa"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setCoverName(f?.name ?? null);
                    setCoverFile(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className={`flex w-full items-center justify-center gap-3 border border-dashed px-4 py-10 text-sm transition-colors hover:border-gilt hover:text-gilt ${coverFile ? "border-gilt/50 text-gilt" : "border-border text-muted-foreground"}`}
                >
                  <ImagePlus className="size-5 text-gilt" strokeWidth={1.5} />
                  {coverName ?? "Clique para enviar a capa (obrigatório)"}
                </button>
              </Field>

              <Field label="Capítulo deste PDF" htmlFor="obra-cap">
                <div className="flex flex-wrap gap-3">
                  <input
                    id="obra-cap"
                    type="text"
                    inputMode="decimal"
                    aria-label="Número do capítulo"
                    value={firstChapter}
                    onChange={(e) => setFirstChapter(e.target.value)}
                    className="w-24 border border-border bg-transparent px-4 py-2 text-sm outline-none focus:border-gilt"
                  />
                  <input
                    type="text"
                    aria-label="Nome do capítulo (opcional)"
                    maxLength={120}
                    value={firstChapterTitle}
                    onChange={(e) => setFirstChapterTitle(e.target.value)}
                    placeholder="Nome do capítulo (opcional)"
                    className="min-w-[220px] flex-1 border border-border bg-transparent px-4 py-2 text-sm outline-none focus:border-gilt"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Normalmente 1. Use 0 para prólogo. Depois da aprovação, os próximos capítulos entram pelo botão Capítulos.
                </p>
              </Field>

              <Field label="Arquivo da obra *" htmlFor="obra-pdf">
                <input
                  ref={pdfRef}
                  id="obra-pdf"
                  type="file"
                  accept="application/pdf,.pdf"
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
                  className={`flex w-full items-center justify-center gap-3 border border-dashed px-4 py-8 text-sm transition-colors hover:border-gilt hover:text-gilt ${pdfFile ? "border-gilt/50 text-gilt" : "border-border text-muted-foreground"}`}
                >
                  <FileUp className="size-5 text-gilt" strokeWidth={1.5} />
                  {pdfName ?? "Clique para enviar o arquivo (obrigatório)"}
                </button>
                {pdfProgress && (
                  <div className="mt-3" role="status" aria-live="polite">
                    <div className="h-1.5 overflow-hidden rounded-full bg-border">
                      <div className="h-full rounded-full bg-gilt transition-all" style={{ width: `${pdfProgress.percent}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">{pdfProgress.message}</p>
                  </div>
                )}
                <p className="mt-2 text-xs text-muted-foreground/60">
                  Formato aceito: PDF, até 100 MB. O arquivo é comprimido antes do envio, e os leitores leem a obra
                  dentro do site, sem opção de download.
                </p>
              </Field>

              <Field label="Gêneros (escolha pelo menos um)" htmlFor="obra-tags">
                <div className="flex flex-wrap gap-2">
                  {GENRE_TAGS.map((g) => {
                    const active = tags.includes(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() =>
                          setTags((prev) =>
                            prev.includes(g) ? prev.filter((t) => t !== g) : [...prev, g],
                          )
                        }
                        className={`px-3 py-1.5 text-xs uppercase tracking-[0.1em] border transition-colors ${
                          active
                            ? "border-gilt bg-gilt/10 text-gilt"
                            : "border-border text-muted-foreground hover:border-gilt/50 hover:text-foreground"
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
                {tags.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground/60">
                    Selecionado: {tags.join(", ")}
                  </p>
                )}
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
                    {tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {tags.map((t) => (
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
                    {uploadStep === "cover" && "Enviando capa…"}
                    {uploadStep === "pdf" && "Enviando arquivo da obra…"}
                    {uploadStep === "work" && "Salvando obra…"}
                    {uploadStep === "idle" && "Preparando…"}
                  </span>
                  <span className="animate-pulse text-gilt">●</span>
                </div>
                <div className="h-0.5 w-full overflow-hidden bg-border">
                  <div
                    className="h-full bg-gilt transition-all duration-500"
                    style={{ width: uploadStep === "cover" ? "30%" : uploadStep === "pdf" ? "60%" : uploadStep === "work" ? "85%" : "10%" }}
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
                      {q.note && (
                        <p className="mt-2 border-l-2 border-gilt/50 pl-2.5 text-xs leading-relaxed text-muted-foreground">
                          <span className="font-medium text-foreground">Curadoria: </span>{q.note}
                        </p>
                      )}
                    </Td>
                    <Td className="text-muted-foreground">{q.type}</Td>
                    <Td className="text-muted-foreground">{q.submitted}</Td>
                    <Td className="text-right">
                      <span
                        className={`btn-type inline-block border px-2 py-1 text-[0.6rem] ${
                          q.status === "rejected"
                            ? "border-destructive/50 bg-destructive/10 text-destructive"
                            : q.status === "changes"
                            ? "border-border bg-muted text-muted-foreground"
                            : "border-gilt/50 bg-gilt/10 text-gilt"
                        }`}
                      >
                        {q.status === "rejected" ? "Recusada" : q.status === "changes" ? "Ajustes solicitados" : "Em revisão"}
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

          {(() => {
            type LogEntry = { date: string; work: string; action: string; type: LogType };
            const entries: LogEntry[] = [];
            for (const w of myDbWorks) {
              entries.push({
                date: new Date(w.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }),
                work: w.title,
                action: "Enviado para revisão da curadoria.",
                type: "submit",
              });
              if (w.status === "approved" && w.publishedAt) {
                entries.push({
                  date: new Date(w.publishedAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }),
                  work: w.title,
                  action: "Publicada no feed após aprovação da curadoria.",
                  type: "publish",
                });
              }
              if ((w.status === "changes" || w.status === "rejected") && w.curatorNote) {
                entries.push({
                  date: new Date(w.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }),
                  work: w.title,
                  action: `Curadoria: ${w.curatorNote}`,
                  type: "review",
                });
              }
            }
            entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            if (!entries.length) {
              return (
                <div className="mt-8 border border-border bg-surface/40 px-6 py-10 text-center">
                  <p className="text-sm text-muted-foreground">Nenhuma atividade ainda. Publique sua primeira obra.</p>
                </div>
              );
            }
            return (
              <div className="relative ml-3 mt-8">
                <div className="absolute bottom-2 left-2 top-2 w-px bg-border" />
                <div className="space-y-0">
                  {entries.map((entry, i) => (
                    <div key={i} className="relative flex gap-6 pb-8 pl-9">
                      <div className={`absolute left-0 top-1 size-4 shrink-0 rounded-[2px] border ${LOG_DOT[entry.type]}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-3">
                          <span className="caption whitespace-nowrap">{entry.date}</span>
                          <span className={`inline-block border px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.14em] ${LOG_DOT[entry.type]} opacity-80`}>
                            {LOG_LABEL[entry.type]}
                          </span>
                        </div>
                        <p className="mt-1 font-display text-lg leading-snug">{entry.work}</p>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{entry.action}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
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
                  <p className="text-sm text-muted-foreground">Acumulado estimado</p>
                  <p className="font-display text-2xl tracking-tight text-gilt">{money(net)}</p>
                </div>
                <p className="mt-2 text-right text-xs text-muted-foreground">
                  Repasse ativado quando o sistema de pagamentos for configurado.
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
                    <td colSpan={5} className="px-4 py-4 text-muted-foreground">Nenhuma doação recebida ainda.</td>
                  </tr>
                ) : donations.map((d) => (
                  <tr key={d.id} className="transition-colors hover:bg-surface/60">
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {new Date(d.createdAt).toLocaleDateString("pt-BR")}
                    </Td>
                    <Td>{initialWorks.find((w) => w.slug === d.workSlug)?.title ?? d.workSlug}</Td>
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

              <div className="mt-5">
                <span className="eyebrow">Gêneros (pelo menos um)</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[...new Set([...GENRE_TAGS, ...editTags])].map((g) => {
                    const active = editTags.includes(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setEditTags((prev) => (prev.includes(g) ? prev.filter((t) => t !== g) : [...prev, g]))}
                        className={`border px-3 py-1.5 text-xs transition-colors ${
                          active ? "border-gilt bg-gilt/10 text-gilt" : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  disabled={savingEdit}
                  onClick={() => void (async () => {
                    if (!editingWork) return;
                    if (editTags.length === 0) {
                      toast.error("Escolha pelo menos um gênero.");
                      return;
                    }
                    setSavingEdit(true);
                    try {
                      const mediumMap: Record<string, string> = { Livro: "livro", Mangá: "manga", HQ: "hq", Conto: "conto", Novel: "lightnovel", Manhwa: "manhwa", Manhua: "manhua" };
                      const res = await fetch(`/api/works/${editingWork.id}`, {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        // Só manda o que mudou: nome e formato passam pela curadoria, gêneros entram direto
                        body: JSON.stringify({
                          ...(editTitle !== editingWork.title ? { title: editTitle } : {}),
                          ...((mediumMap[editType] ?? "livro") !== editingWork.medium ? { medium: mediumMap[editType] ?? "livro" } : {}),
                          tags: editTags.join(", "),
                        }),
                      });
                      if (!res.ok) throw new Error();
                      const out = (await res.json().catch(() => ({}))) as { review?: boolean };
                      void refetchDash();
                      toast.success(
                        out.review
                          ? "Alteração enviada para a curadoria. A versão atual continua no ar até a aprovação."
                          : `Alterações em "${editTitle}" salvas.`,
                      );
                      setEditingWork(null);
                    } catch {
                      toast.error("Erro ao salvar alterações.");
                    } finally {
                      setSavingEdit(false);
                    }
                  })()}
                  className="bg-gilt px-6 py-2.5 text-xs uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {savingEdit ? "Salvando…" : "Salvar alterações"}
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

        {/* Modal editar perfil */}
        {showEditProfile && (
          <AuthorProfileEditor
            initialName={editProfileName}
            onClose={() => setShowEditProfile(false)}
            onSaved={() => {
              void queryClient.invalidateQueries({ queryKey: ["author-dashboard"] });
              void queryClient.invalidateQueries({ queryKey: ["me"] });
              setShowEditProfile(false);
            }}
          />
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
                    onClick={() => { setEditProfileName(displayName); setShowEditProfile(true); }}
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

// ── Editor do perfil público do autor (nome, bio, foto, cidade, redes) ──────

type AuthorBioForm = { bio: string; avatarUrl: string; city: string; instagram: string; website: string };

function AuthorProfileEditor({
  initialName,
  onClose,
  onSaved,
}: {
  initialName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [form, setForm] = useState<AuthorBioForm>({ bio: "", avatarUrl: "", city: "", instagram: "", website: "" });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/profile/author-bio")
      .then((r) => (r.ok ? (r.json() as Promise<AuthorBioForm>) : null))
      .then((data) => { if (data) setForm(data); })
      .catch(() => {});
  }, []);

  const set = (key: keyof AuthorBioForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const { url } = (await res.json()) as { url: string };
      setForm((prev) => ({ ...prev, avatarUrl: url }));
      toast.success("Foto enviada. Salve para aplicar.");
    } catch {
      toast.error("Erro ao enviar a foto.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const [nameRes, bioRes] = await Promise.all([
        fetch("/api/profile", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        }),
        fetch("/api/profile/author-bio", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form),
        }),
      ]);
      if (!nameRes.ok || !bioRes.ok) throw new Error();
      toast.success("Perfil atualizado.");
      onSaved();
    } catch {
      toast.error("Erro ao atualizar perfil.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/80 px-5 py-10 backdrop-blur-sm">
      <div className="w-full max-w-lg border border-gilt/30 bg-background p-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl tracking-tight">Editar perfil</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors hover:text-foreground" aria-label="Fechar">
            <X className="size-5" strokeWidth={1.5} />
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Essas informações aparecem na sua página pública de autor.</p>
        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="eyebrow">Nome de exibição</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className={inputCls} />
          </label>
          <label className="block">
            <span className="eyebrow">Bio</span>
            <textarea
              rows={4}
              maxLength={1200}
              value={form.bio}
              onChange={set("bio")}
              placeholder="Quem você é, o que escreve ou desenha, onde já publicou."
              className={`${inputCls} resize-y`}
            />
            <span className="caption mt-1 block text-right">{form.bio.length}/1200</span>
          </label>
          <div>
            <span className="eyebrow block">Foto</span>
            <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 border border-dashed border-border bg-background px-4 py-4 text-sm text-muted-foreground transition-colors hover:border-gilt hover:text-gilt">
              {uploading ? "Enviando…" : form.avatarUrl ? "Foto enviada — trocar" : "Selecionar foto"}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" hidden onChange={(e) => void handleAvatar(e)} />
            </label>
          </div>
          <label className="block">
            <span className="eyebrow">Cidade</span>
            <input value={form.city} onChange={set("city")} placeholder="Ex.: Recife, PE" className={inputCls} />
          </label>
          <label className="block">
            <span className="eyebrow">Instagram</span>
            <input value={form.instagram} onChange={set("instagram")} placeholder="@seuperfil" className={inputCls} />
          </label>
          <label className="block">
            <span className="eyebrow">Site</span>
            <input value={form.website} onChange={set("website")} placeholder="https://seusite.com" className={inputCls} />
          </label>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            disabled={saving || uploading || !name.trim()}
            onClick={() => void save()}
            className="bg-gilt px-6 py-2.5 text-xs uppercase tracking-[0.18em] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
          <button
            onClick={onClose}
            className="border border-border px-6 py-2.5 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-gilt hover:text-gilt"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
