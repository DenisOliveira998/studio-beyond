import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  SiteConfigData,
  CarouselItemData,
  AccountRow,
  DbApplication,
  DbWork,
  WorkStats,
} from "@/lib/beyond-db";
import type { AppRole } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/auth";
import { useAuth } from "@/lib/auth";
import {
  ArrowDown,
  ArrowUp,
  Ban,
  CircleDollarSign,
  ClipboardList,
  Eye,
  FileDown,
  FileClock,
  Image,
  LayoutDashboard,
  Mail,
  Plus,
  Save,
  Settings,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import type { EmailEventData } from "@/lib/beyond-db";
import {
  PLATFORM_FEE,
  RATE_PER_CLICK,
  compact,
  money,
  MEDIUM_LABEL,
  type ReviewStatus,
  type Work,
} from "@/lib/beyond-data";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administração — The Beyond" },
      {
        name: "description",
        content:
          "Painel administrativo: visão geral da receita, rankings de obras e gestão de contas da plataforma.",
      },
      { property: "og:title", content: "Administração — The Beyond" },
      {
        property: "og:description",
        content: "Receita total, obras mais populares e gerenciamento de contas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

const FILTERS: Array<{ value: AppRole | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "reader", label: "Leitor" },
  { value: "vip", label: "VIP" },
  { value: "author", label: "Autor" },
  { value: "gerente", label: "Gerente" },
  { value: "admin", label: "Administrador" },
  { value: "owner", label: "Dono" },
];

const LADDER: AppRole[] = ["reader", "vip", "author", "gerente", "admin", "owner"];

const NAV = [
  { id: "visao-geral", label: "Visão Geral", icon: LayoutDashboard },
  { id: "rankings", label: "Rankings", icon: Trophy },
  { id: "candidaturas", label: "Candidaturas", icon: ClipboardList },
  { id: "obras-revisao", label: "Obras em revisão", icon: FileClock },
  { id: "contas", label: "Gestão de Contas", icon: Users },
  { id: "receita", label: "Receita", icon: CircleDollarSign },
  { id: "emails", label: "E-mails", icon: Mail },
  { id: "carrossel", label: "Carrossel", icon: Image },
  { id: "configuracoes", label: "Configurações", icon: Settings },
];

const TYPE_BADGE: Record<AppRole, string> = {
  reader: "border-border bg-muted text-muted-foreground",
  vip: "border-gilt/50 bg-gilt/10 text-gilt",
  author: "border-[color:var(--chart-2)]/50 bg-[color:var(--chart-2)]/10 text-[color:var(--chart-2)]",
  gerente: "border-blue-500/50 bg-blue-500/10 text-blue-400",
  admin: "border-destructive/50 bg-destructive/10 text-destructive",
  owner: "border-purple-500/50 bg-purple-500/10 text-purple-400",
};

const EMPTY_CONFIG: SiteConfigData = {
  instagram: "",
  youtube: "",
  email: "",
  phone: "",
  address: "",
  cnpj: "",
};

function AdminPage() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<AppRole | "all">("all");
  const [appTab, setAppTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [workTab, setWorkTab] = useState<"pending" | "approved" | "changes" | "rejected" | "all">("pending");

  const ADMIN_ROLES_CLIENT = ["owner", "admin", "gerente"] as const;
  const isStaff = !loading && profile && ADMIN_ROLES_CLIENT.includes(profile.role as typeof ADMIN_ROLES_CLIENT[number]);

  useEffect(() => {
    if (!loading && !isStaff) void navigate({ to: "/" });
  }, [loading, isStaff, navigate]);

  const queryClient = useQueryClient();

  // Dados reais do DB
  const { data: accounts = [] } = useQuery<AccountRow[]>({
    queryKey: ["accounts"],
    queryFn: () => fetch("/api/accounts").then((r) => r.json() as Promise<AccountRow[]>),
    staleTime: 30_000,
  });
  const { data: applications = [] } = useQuery<DbApplication[]>({
    queryKey: ["applications"],
    queryFn: () => fetch("/api/applications").then((r) => r.json() as Promise<DbApplication[]>),
    staleTime: 30_000,
  });
  const { data: submissions = [] } = useQuery<DbWork[]>({
    queryKey: ["admin-works"],
    queryFn: () => fetch("/api/admin/works").then((r) => r.json() as Promise<DbWork[]>),
    staleTime: 30_000,
  });
  const { data: allWorks = [] } = useQuery<Work[]>({
    queryKey: ["works"],
    queryFn: () => fetch("/api/works").then((r) => r.json() as Promise<Work[]>),
    staleTime: 30_000,
  });
  const { data: adminStats } = useQuery<WorkStats>({
    queryKey: ["admin-stats"],
    queryFn: () => fetch("/api/admin/stats").then((r) => r.json() as Promise<WorkStats>),
    staleTime: 30_000,
  });

  // Eventos de email (Resend webhooks)
  const { data: emailEvents = [] } = useQuery<EmailEventData[]>({
    queryKey: ["admin-email-events"],
    queryFn: () => fetch("/api/admin/email-events").then((r) => r.json() as Promise<EmailEventData[]>),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  // Pusher — notificações em tempo real para staff
  useEffect(() => {
    if (!isStaff) return;
    const key = import.meta.env["VITE_PUSHER_KEY"] as string | undefined;
    if (!key) return;
    let pusherClient: import("pusher-js").default | null = null;
    void import("pusher-js").then(({ default: PusherJs }) => {
      pusherClient = new PusherJs(key, {
        cluster: (import.meta.env["VITE_PUSHER_CLUSTER"] as string | undefined) ?? "mt1",
      });
      const ch = pusherClient.subscribe("beyond-admin");
      ch.bind("new-application", (d: { artistName: string; email: string }) =>
        toast.info(`Nova candidatura: ${d.artistName} (${d.email})`)
      );
      ch.bind("work-submitted", (d: { title: string; artistName: string }) =>
        toast.info(`Nova obra submetida: "${d.title}" por ${d.artistName}`)
      );
      ch.bind("new-comment", (d: { workSlug: string; author: string }) =>
        toast.info(`Novo comentário em "${d.workSlug}" por ${d.author}`)
      );
      ch.bind("new-donation", (d: { artistName: string; amount: number }) =>
        toast.success(`Doação de R$ ${d.amount.toFixed(2)} para ${d.artistName}`)
      );
    });
    return () => {
      pusherClient?.unsubscribe("beyond-admin");
      pusherClient?.disconnect();
    };
  }, [isStaff]);

  // Configurações do site
  const { data: siteConfig } = useQuery<SiteConfigData>({
    queryKey: ["site-config"],
    queryFn: () => fetch("/api/site-config").then((r) => r.json() as Promise<SiteConfigData>),
    staleTime: 30_000,
  });
  const [cfgDraft, setCfgDraft] = useState<SiteConfigData | null>(null);
  const cfg = cfgDraft ?? siteConfig ?? EMPTY_CONFIG;

  // Carrossel
  const { data: carouselItems = [], refetch: refetchCarousel } = useQuery<CarouselItemData[]>({
    queryKey: ["carousel"],
    queryFn: () => fetch("/api/carousel").then((r) => r.json() as Promise<CarouselItemData[]>),
    staleTime: 30_000,
  });

  const [newSlide, setNewSlide] = useState<Omit<CarouselItemData, "id" | "order">>({
    title: "",
    subtitle: "",
    imageUrl: "",
    linkUrl: "",
    active: true,
  });
  const [uploadingImg, setUploadingImg] = useState(false);

  async function uploadSlideImage(file: File) {
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload falhou");
      const { url } = (await res.json()) as { url: string };
      setNewSlide((p) => ({ ...p, imageUrl: url }));
    } catch {
      toast.error("Erro ao fazer upload da imagem.");
    } finally {
      setUploadingImg(false);
    }
  }

  const createSlide = useMutation({
    mutationFn: () =>
      fetch("/api/carousel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...newSlide, order: carouselItems.length }),
      }),
    onSuccess: () => {
      void refetchCarousel();
      setNewSlide({ title: "", subtitle: "", imageUrl: "", linkUrl: "", active: true });
      toast.success("Slide adicionado.");
    },
    onError: () => toast.error("Erro ao adicionar slide."),
  });

  const toggleSlide = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      fetch(`/api/carousel/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active }),
      }),
    onSuccess: () => void refetchCarousel(),
    onError: () => toast.error("Erro ao atualizar slide."),
  });

  const deleteSlide = useMutation({
    mutationFn: (id: string) => fetch(`/api/carousel/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void refetchCarousel();
      toast.success("Slide removido.");
    },
    onError: () => toast.error("Erro ao remover slide."),
  });

  const reorderSlide = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: 1 | -1 }) => {
      const sorted = [...carouselItems].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((s) => s.id === id);
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= sorted.length) return;
      const ids = sorted.map((s) => s.id);
      const tmp = ids[idx] as string;
      ids[idx] = ids[newIdx] as string;
      ids[newIdx] = tmp;
      await fetch("/api/carousel/reorder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    },
    onSuccess: () => void refetchCarousel(),
    onError: () => toast.error("Erro ao reordenar."),
  });

  const saveCfg = useMutation({
    mutationFn: (data: SiteConfigData) =>
      fetch("/api/site-config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["site-config"] });
      setCfgDraft(null);
      toast.success("Configurações salvas com sucesso.");
    },
    onError: () => toast.error("Erro ao salvar configurações."),
  });

  const patchApplication = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReviewStatus }) =>
      fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["applications"] }),
    onError: () => toast.error("Erro ao atualizar candidatura."),
  });

  const patchWork = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReviewStatus }) =>
      fetch(`/api/admin/works/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-works"] });
      void queryClient.invalidateQueries({ queryKey: ["works"] });
    },
    onError: () => toast.error("Erro ao atualizar obra."),
  });

  const patchAccount = useMutation({
    mutationFn: ({ id, role, suspended }: { id: string; role?: AppRole; suspended?: boolean }) =>
      fetch(`/api/accounts/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, suspended }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["accounts"] }),
    onError: () => toast.error("Erro ao atualizar conta."),
  });

  function decideApplication(id: string, status: ReviewStatus) {
    const app = applications.find((a) => a.id === id);
    if (!app) return;
    toast.success(
      status === "approved"
        ? `${app.artistName} aprovado — e-mail de acesso ao Painel do Autor enviado.`
        : `${app.artistName} recusado — mensagem da curadoria enviada.`,
    );
    patchApplication.mutate({ id, status });
  }

  function decideSubmission(id: string, status: ReviewStatus) {
    const sub = submissions.find((w) => w.id === id);
    if (!sub) return;
    toast.success(
      status === "approved"
        ? `"${sub.title}" aprovada e publicada no feed.`
        : status === "changes"
          ? `Ajustes solicitados ao autor de "${sub.title}".`
          : `"${sub.title}" recusada com comentário do curador.`,
    );
    patchWork.mutate({ id, status });
  }

  function changeRole(id: string, role: AppRole) {
    const account = accounts.find((a) => a.id === id);
    if (!account || role === account.role) return;
    toast.success(`${account.name} agora é ${ROLE_LABEL[role]}.`);
    patchAccount.mutate({ id, role });
  }

  function toggleSuspend(id: string) {
    const account = accounts.find((a) => a.id === id);
    if (!account) return;
    toast.success(account.suspended ? `${account.name} reativado.` : `${account.name} suspenso.`);
    patchAccount.mutate({ id, suspended: !account.suspended });
  }

  const reviewableSubmissions = submissions.filter((w) => w.status !== "draft");
  const pendingApplications = applications.filter((a) => a.status === "pending").length;
  const pendingSubmissions = reviewableSubmissions.filter((w) => w.status === "pending").length;

  const byClicks = useMemo(
    () => [...allWorks].sort((a, b) => b.clicks - a.clicks).slice(0, 5),
    [allWorks],
  );
  const byDonations = useMemo(
    () =>
      [...allWorks]
        .sort((a, b) => (adminStats?.donations[b.slug] ?? 0) - (adminStats?.donations[a.slug] ?? 0))
        .slice(0, 5),
    [allWorks, adminStats],
  );

  const clickGross = allWorks.reduce((s, w) => s + w.clicks * RATE_PER_CLICK, 0);
  const donationGross = Object.values(adminStats?.donations ?? {}).reduce((s, v) => s + v, 0);
  const gross = clickGross + donationGross;
  const platformCut = gross * PLATFORM_FEE;
  const totalClicks = allWorks.reduce((s, w) => s + w.clicks, 0);

  const visible = filter === "all" ? accounts : accounts.filter((a) => a.role === filter);

  if (loading || !isStaff) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="size-6 animate-spin rounded-full border-2 border-border border-t-gilt" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Sidebar fixa */}
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[220px] shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="px-6 pt-8 pb-6">
          <p className="eyebrow">Administração</p>
          <p className="mt-2 font-display text-xl tracking-tight">The Beyond</p>
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
          <p className="text-xs text-muted-foreground">The Beyond · Admin</p>
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
            <Stat label="Receita Bruta" value={money(gross)} note="Cliques + doações" />
            <Stat
              label="Receita por Cliques"
              value={money(clickGross)}
              note={`${compact(totalClicks)} visualizações`}
            />
            <Stat label="Doações Recebidas" value={money(donationGross)} note="Todos os artistas" />
            <Stat
              label="Retido pela Plataforma"
              value={money(platformCut)}
              note="12% de tudo"
              accent
            />
          </div>
        </section>

        {/* Rankings */}
        <section id="rankings" className="mt-16 scroll-mt-24">
          <SectionTitle icon={Trophy}>Rankings</SectionTitle>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Ranking
              title="🏆 Obras mais populares"
              note="Top 5 por cliques/visualizações"
              rows={byClicks.map((w) => ({
                slug: w.slug,
                title: w.title,
                artist: w.artistName ?? "",
                metric: `${compact(w.clicks)} cliques`,
              }))}
            />
            <Ranking
              title="💰 Obras mais apoiadas"
              note="Top 5 por doações recebidas"
              rows={byDonations.map((w) => ({
                slug: w.slug,
                title: w.title,
                artist: w.artistName ?? "",
                metric: money(adminStats?.donations[w.slug] ?? 0),
              }))}
            />
          </div>
        </section>

        {/* Candidaturas */}
        <section id="candidaturas" className="mt-16 scroll-mt-24">
          <SectionTitle icon={ClipboardList}>Candidaturas</SectionTitle>
          <p className="caption mt-4">
            {pendingApplications} pendente(s) · {applications.filter(a => a.status === "approved").length} aprovada(s) · {applications.filter(a => a.status === "rejected").length} recusada(s)
          </p>

          {/* Tabs */}
          <div className="mt-6 flex flex-wrap gap-1">
            {(["pending", "approved", "rejected", "all"] as const).map((tab) => {
              const labels = { pending: "Pendentes", approved: "Aprovadas", rejected: "Recusadas", all: "Todas" };
              const counts = { pending: applications.filter(a => a.status === "pending").length, approved: applications.filter(a => a.status === "approved").length, rejected: applications.filter(a => a.status === "rejected").length, all: applications.length };
              return (
                <button key={tab} onClick={() => setAppTab(tab)}
                  className={`border px-3 py-1.5 text-xs uppercase tracking-[0.18em] transition-colors ${appTab === tab ? "border-gilt text-gilt" : "border-border text-muted-foreground hover:border-gilt/50 hover:text-foreground"}`}>
                  {labels[tab]} ({counts[tab]})
                </button>
              );
            })}
          </div>

          <div className="mt-4 space-y-4">
            {applications
              .filter(a => appTab === "all" || a.status === appTab)
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((a) => (
                <article key={a.id} className="border border-border bg-surface p-6 sm:p-7">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                      <p className="eyebrow">
                        enviada em {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                      <h3 className="mt-2 font-display text-2xl tracking-tight">{a.artistName}</h3>
                      <p className="caption mt-0.5">{a.email}{a.phone ? ` · ${a.phone}` : ""}</p>
                    </div>
                    <ReviewBadge status={a.status} />
                  </div>

                  {a.portfolioCitations && (
                    <blockquote className="mt-4 max-w-2xl border-l-2 border-gilt/40 pl-4 text-sm italic leading-relaxed text-muted-foreground">
                      {a.portfolioCitations}
                    </blockquote>
                  )}

                  {(() => {
                    try {
                      const files: string[] = JSON.parse(a.portfolioFiles || "[]");
                      if (!files.length) return null;
                      return (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {files.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-gilt hover:text-gilt">
                              <FileDown className="size-3.5" strokeWidth={1.5} />
                              Arquivo {i + 1}
                            </a>
                          ))}
                        </div>
                      );
                    } catch { return null; }
                  })()}

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    {a.portfolio && (
                      <a href={a.portfolio} target="_blank" rel="noreferrer"
                        className="btn-type inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-gilt hover:text-gilt">
                        <Eye className="size-3.5" strokeWidth={1.5} /> Ver portfólio
                      </a>
                    )}
                    <div className="ml-auto flex flex-wrap gap-2">
                      {a.status !== "approved" && (
                        <ActionButton onClick={() => decideApplication(a.id, "approved")}>
                          Aprovar
                        </ActionButton>
                      )}
                      {a.status !== "rejected" && (
                        <ActionButton danger onClick={() => decideApplication(a.id, "rejected")}>
                          Recusar
                        </ActionButton>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            {applications.filter(a => appTab === "all" || a.status === appTab).length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma candidatura nesta categoria.</p>
            )}
          </div>
        </section>

        {/* Obras em revisão */}
        <section id="obras-revisao" className="mt-16 scroll-mt-24">
          <SectionTitle icon={FileClock}>Obras</SectionTitle>
          <p className="caption mt-4">
            {pendingSubmissions} pendente(s) · {reviewableSubmissions.filter(w => w.status === "approved").length} aprovada(s) · {reviewableSubmissions.filter(w => w.status === "rejected").length} recusada(s)
          </p>

          {/* Tabs */}
          <div className="mt-6 flex flex-wrap gap-1">
            {(["pending", "approved", "changes", "rejected", "all"] as const).map((tab) => {
              const labels = { pending: "Pendentes", approved: "Aprovadas", changes: "Ajustes", rejected: "Recusadas", all: "Todas" };
              const count = tab === "all" ? reviewableSubmissions.length : reviewableSubmissions.filter(w => w.status === tab).length;
              return (
                <button key={tab} onClick={() => setWorkTab(tab)}
                  className={`border px-3 py-1.5 text-xs uppercase tracking-[0.18em] transition-colors ${workTab === tab ? "border-gilt text-gilt" : "border-border text-muted-foreground hover:border-gilt/50 hover:text-foreground"}`}>
                  {labels[tab]} ({count})
                </button>
              );
            })}
          </div>

          <div className="mt-4 overflow-x-auto border border-border">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <Th>Obra</Th>
                  <Th>Autor</Th>
                  <Th>Enviada em</Th>
                  <Th>PDF</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reviewableSubmissions.filter(w => workTab === "all" || w.status === workTab).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      Nenhuma obra nesta categoria.
                    </td>
                  </tr>
                )}
                {reviewableSubmissions
                  .filter(w => workTab === "all" || w.status === workTab)
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((w) => (
                  <tr key={w.id} className="transition-colors hover:bg-surface/60">
                    <Td>
                      <p className="font-display text-lg leading-tight">{w.title}</p>
                      <p className="caption mt-0.5">{MEDIUM_LABEL[w.medium]}</p>
                      {w.curatorNote && <p className="caption mt-1 text-muted-foreground">Nota: {w.curatorNote}</p>}
                    </Td>
                    <Td className="text-muted-foreground">{w.artistName || "—"}</Td>
                    <Td className="text-muted-foreground">{new Date(w.createdAt).toLocaleDateString("pt-BR")}</Td>
                    <Td>
                      {w.pdfUrl ? (
                        <a href={w.pdfUrl} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs text-gilt transition-colors hover:text-gilt/70">
                          <FileDown className="size-3.5" strokeWidth={1.5} /> Ver PDF
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </Td>
                    <Td><ReviewBadge status={w.status} /></Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        {w.status !== "approved" && (
                          <ActionButton onClick={() => decideSubmission(w.id, "approved")}>
                            Aprovar
                          </ActionButton>
                        )}
                        {w.status !== "changes" && (
                          <ActionButton onClick={() => decideSubmission(w.id, "changes")}>
                            Ajuste
                          </ActionButton>
                        )}
                        {w.status !== "rejected" && (
                          <ActionButton danger onClick={() => decideSubmission(w.id, "rejected")}>
                            Recusar
                          </ActionButton>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Gestão de Contas */}
        <section id="contas" className="mt-16 scroll-mt-24">
          <SectionTitle icon={Users}>Gestão de Contas</SectionTitle>

          <div className="mt-8 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`border px-3 py-1.5 text-xs uppercase tracking-[0.18em] transition-colors ${
                  filter === f.value
                    ? "border-gilt text-gilt"
                    : "border-border text-muted-foreground hover:border-gilt-soft hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="mt-6 overflow-x-auto border border-border">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <Th>Nome</Th>
                  <Th>E-mail</Th>
                  <Th>Tipo de conta</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((a) => (
                  <tr key={a.id} className="transition-colors hover:bg-surface/60">
                    <Td>
                      <p className="font-medium">{a.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        desde {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    </Td>
                    <Td className="text-muted-foreground">{a.email}</Td>
                    <Td>
                      <span
                        className={`inline-block border px-2 py-1 text-xs uppercase tracking-[0.14em] ${TYPE_BADGE[a.role]}`}
                      >
                        {ROLE_LABEL[a.role]}
                      </span>
                    </Td>
                    <Td>
                      {a.suspended ? (
                        <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-destructive">
                          <Ban className="size-3.5" /> Suspenso
                        </span>
                      ) : (
                        <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                          Ativo
                        </span>
                      )}
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          value={a.role}
                          onChange={(e) => changeRole(a.id, e.target.value as AppRole)}
                          className="border border-border bg-surface px-2 py-1.5 text-xs text-foreground focus:border-gilt focus:outline-none"
                        >
                          {LADDER.map((r) => (
                            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                          ))}
                        </select>
                        <ActionButton danger onClick={() => toggleSuspend(a.id)}>
                          <Ban className="size-3.5" />
                          {a.suspended ? "Reativar" : "Suspender"}
                        </ActionButton>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Receita */}
        <section id="receita" className="mt-16 scroll-mt-24">
          <SectionTitle icon={CircleDollarSign}>Receita</SectionTitle>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="border border-gilt/25 bg-background p-8">
              <p className="eyebrow">Composição da receita</p>
              <div className="mt-6 space-y-5">
                <RevenueRow
                  label="Cliques / visualizações"
                  value={clickGross}
                  total={gross}
                />
                <RevenueRow label="Doações diretas" value={donationGross} total={gross} />
              </div>
              <div className="mt-8 border-t border-border pt-6">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm text-muted-foreground">Receita bruta total</p>
                  <p className="font-display text-2xl tracking-tight">{money(gross)}</p>
                </div>
              </div>
            </div>
            <div className="border border-gilt/25 bg-background p-8">
              <p className="eyebrow">Divisão da plataforma</p>
              <div className="mt-6 space-y-5">
                <RevenueRow
                  label={`Retido pela plataforma (${Math.round(PLATFORM_FEE * 100)}%)`}
                  value={platformCut}
                  total={gross}
                />
                <RevenueRow
                  label="Repasse aos artistas"
                  value={gross - platformCut}
                  total={gross}
                />
              </div>
              <div className="mt-8 border-t border-border pt-6">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm text-muted-foreground">Taxa por clique</p>
                  <p className="font-display text-2xl tracking-tight text-gilt">
                    {money(RATE_PER_CLICK)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* E-mails */}
        <section id="emails" className="mt-16 scroll-mt-24">
          <SectionTitle icon={Mail}>E-mails (Resend Webhook)</SectionTitle>
          <p className="caption mt-4">
            Últimos {emailEvents.length} eventos registrados via webhook do Resend
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  <Th>Tipo</Th>
                  <Th>Destinatário</Th>
                  <Th>Assunto</Th>
                  <Th>Data</Th>
                </tr>
              </thead>
              <tbody>
                {emailEvents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-muted-foreground">
                      Nenhum evento registrado ainda. Configure o webhook no painel do Resend.
                    </td>
                  </tr>
                ) : (
                  emailEvents.map((ev) => (
                    <tr key={ev.id} className="border-b border-border/50 hover:bg-surface/50">
                      <td className="py-3 pr-4">
                        <span className={`btn-type inline-block border px-2 py-0.5 text-[0.6rem] ${
                          ev.eventType.includes("delivered") || ev.eventType.includes("sent")
                            ? "border-[color:var(--chart-2)]/40 text-[color:var(--chart-2)]"
                            : ev.eventType.includes("bounce") || ev.eventType.includes("complaint")
                              ? "border-destructive/40 text-destructive"
                              : "border-border text-muted-foreground"
                        }`}>{ev.eventType}</span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">{ev.recipient}</td>
                      <td className="py-3 pr-4 text-xs max-w-[260px] truncate">{ev.subject}</td>
                      <td className="py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(ev.createdAt).toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Carrossel */}
        <section id="carrossel" className="mt-16 scroll-mt-24">
          <SectionTitle icon={Image}>Carrossel</SectionTitle>
          <p className="caption mt-4">
            {carouselItems.filter((s) => s.active).length} slide(s) ativo(s) — aparece na página inicial
          </p>

          {/* Slides existentes */}
          <div className="mt-6 space-y-3">
            {[...carouselItems].sort((a, b) => a.order - b.order).map((slide, idx, arr) => (
              <div key={slide.id} className="flex items-start gap-4 border border-border bg-surface p-4">
                {slide.imageUrl && (
                  <img
                    src={slide.imageUrl}
                    alt={slide.title}
                    className="hidden h-16 w-12 flex-shrink-0 object-cover sm:block border border-border"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base leading-tight">{slide.title}</p>
                  {slide.subtitle && (
                    <p className="caption mt-0.5">{slide.subtitle}</p>
                  )}
                  {slide.linkUrl && (
                    <p className="mt-1 truncate text-xs text-muted-foreground/60">{slide.linkUrl}</p>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <button
                    onClick={() => toggleSlide.mutate({ id: slide.id, active: !slide.active })}
                    className={`border px-2.5 py-1.5 text-xs transition-colors ${
                      slide.active
                        ? "border-gilt/50 text-gilt hover:bg-gilt/10"
                        : "border-border text-muted-foreground hover:border-foreground"
                    }`}
                  >
                    {slide.active ? "Ativo" : "Inativo"}
                  </button>
                  <ActionButton onClick={() => reorderSlide.mutate({ id: slide.id, direction: -1 })} disabled={idx === 0}>
                    <ArrowUp className="size-3.5" />
                  </ActionButton>
                  <ActionButton onClick={() => reorderSlide.mutate({ id: slide.id, direction: 1 })} disabled={idx === arr.length - 1}>
                    <ArrowDown className="size-3.5" />
                  </ActionButton>
                  <ActionButton danger onClick={() => deleteSlide.mutate(slide.id)}>
                    <Trash2 className="size-3.5" />
                  </ActionButton>
                </div>
              </div>
            ))}
            {carouselItems.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum slide cadastrado. O carrossel usará as obras em destaque.</p>
            )}
          </div>

          {/* Adicionar novo slide */}
          <div className="mt-8 border border-gilt/25 bg-background p-6">
            <p className="eyebrow mb-5">Adicionar slide</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="eyebrow text-xs">Título *</label>
                <input
                  type="text"
                  value={newSlide.title}
                  onChange={(e) => setNewSlide((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Ex: Nova Série"
                  className="border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-gilt focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="eyebrow text-xs">Subtítulo</label>
                <input
                  type="text"
                  value={newSlide.subtitle}
                  onChange={(e) => setNewSlide((p) => ({ ...p, subtitle: e.target.value }))}
                  placeholder="Ex: por Nome do Artista"
                  className="border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-gilt focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="eyebrow text-xs">Link de destino</label>
                <input
                  type="text"
                  value={newSlide.linkUrl}
                  onChange={(e) => setNewSlide((p) => ({ ...p, linkUrl: e.target.value }))}
                  placeholder="https://..."
                  className="border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-gilt focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="eyebrow text-xs">Imagem</label>
                <div className="flex items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-2 border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-gilt hover:text-gilt">
                    <Image className="size-3.5" strokeWidth={1.5} />
                    {uploadingImg ? "Enviando…" : newSlide.imageUrl ? "Trocar imagem" : "Selecionar imagem"}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadSlideImage(f);
                      }}
                    />
                  </label>
                  {newSlide.imageUrl && (
                    <img src={newSlide.imageUrl} alt="" className="h-9 w-7 object-cover border border-border" />
                  )}
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={() => createSlide.mutate()}
                disabled={createSlide.isPending || !newSlide.title.trim()}
                className="inline-flex items-center gap-2 bg-gilt px-5 py-2.5 text-sm font-medium text-ink transition-opacity disabled:opacity-50"
              >
                <Plus className="size-4" strokeWidth={1.5} />
                {createSlide.isPending ? "Adicionando…" : "Adicionar slide"}
              </button>
            </div>
          </div>
        </section>

        {/* Configurações do Site */}
        <section id="configuracoes" className="mt-16 scroll-mt-24">
          <SectionTitle icon={Settings}>Configurações do Site</SectionTitle>
          <div className="mt-8 border border-gilt/25 bg-background p-8">
            <p className="text-sm text-muted-foreground mb-6">
              Estas informações aparecem no rodapé do site e nos links das redes sociais.
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              {(
                [
                  { key: "instagram", label: "Instagram (URL completa)", placeholder: "https://instagram.com/thebeyond.art" },
                  { key: "youtube", label: "YouTube (URL completa)", placeholder: "https://youtube.com/@thebeyond" },
                  { key: "email", label: "E-mail de contato", placeholder: "contato@thebeyond.art" },
                  { key: "phone", label: "Telefone", placeholder: "(11) 99999-9999" },
                  { key: "address", label: "Endereço", placeholder: "Rua das Artes, 142 — São Paulo, SP" },
                  { key: "cnpj", label: "CNPJ", placeholder: "00.000.000/0001-00" },
                ] as Array<{ key: keyof SiteConfigData; label: string; placeholder: string }>
              ).map(({ key, label, placeholder }) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className="eyebrow text-xs">{label}</label>
                  <input
                    type="text"
                    value={cfg[key]}
                    placeholder={placeholder}
                    onChange={(e) =>
                      setCfgDraft((prev) => ({ ...(prev ?? cfg), [key]: e.target.value }))
                    }
                    className="border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-gilt focus:outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="mt-8 flex items-center gap-4">
              <button
                onClick={() => saveCfg.mutate(cfg)}
                disabled={saveCfg.isPending || cfgDraft === null}
                className="flex items-center gap-2 bg-gilt px-5 py-2.5 text-sm font-medium text-ink transition-opacity disabled:opacity-50"
              >
                <Save className="size-4" strokeWidth={1.5} />
                {saveCfg.isPending ? "Salvando…" : "Salvar configurações"}
              </button>
              {cfgDraft !== null && (
                <button
                  onClick={() => setCfgDraft(null)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Descartar alterações
                </button>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

type AnyReviewStatus = ReviewStatus | "draft";

const REVIEW_BADGE: Record<AnyReviewStatus, string> = {
  draft: "border-border bg-muted text-muted-foreground",
  pending: "border-gilt/50 bg-gilt/10 text-gilt",
  approved: "border-[color:var(--chart-2)]/50 bg-[color:var(--chart-2)]/10 text-[color:var(--chart-2)]",
  changes: "border-border bg-muted text-muted-foreground",
  rejected: "border-destructive/50 bg-destructive/10 text-destructive",
};

const REVIEW_BADGE_LABEL: Record<AnyReviewStatus, string> = {
  draft: "Rascunho",
  pending: "Em análise",
  approved: "Aprovada",
  changes: "Ajustes",
  rejected: "Recusada",
};

function ReviewBadge({ status }: { status: AnyReviewStatus }) {
  return (
    <span
      className={`btn-type inline-block border px-2 py-1 text-[0.6rem] ${REVIEW_BADGE[status]}`}
    >
      {REVIEW_BADGE_LABEL[status]}
    </span>
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
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-xs transition-colors disabled:pointer-events-none disabled:opacity-40 ${
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
        <div
          className="h-full bg-gilt transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-right text-xs text-muted-foreground">
        {pct.toFixed(1).replace(".", ",")}%
      </p>
    </div>
  );
}

function Ranking({
  title,
  note,
  rows,
}: {
  title: string;
  note: string;
  rows: Array<{ slug: string; title: string; artist: string; metric: string }>;
}) {
  return (
    <div className="border border-gilt/25 bg-background p-8">
      <h3 className="font-display text-2xl tracking-tight">{title}</h3>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
      <div className="mt-6 divide-y divide-border border-y border-border">
        {rows.map((r, i) => (
          <div key={r.slug} className="flex items-baseline justify-between gap-6 py-4">
            <div className="flex min-w-0 items-baseline gap-4">
              <span className="font-display text-lg text-gilt">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <Link
                  to="/work/$slug"
                  params={{ slug: r.slug }}
                  className="rule-hover font-display text-xl"
                >
                  {r.title}
                </Link>
                <p className="mt-1 truncate text-xs text-muted-foreground">{r.artist}</p>
              </div>
            </div>
            <p className="shrink-0 text-sm text-gilt">{r.metric}</p>
          </div>
        ))}
      </div>
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

