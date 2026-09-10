import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  FileClock,
  CircleDollarSign,
  Eye,
  EyeOff,
  FileText,
  FileUp,
  Heart,
  ImagePlus,
  LayoutDashboard,
  Library,
  Pencil,
  Send,
  UserRound,
} from "lucide-react";
import {
  PLATFORM_FEE,
  RATE_PER_CLICK,
  compact,
  getArtist,
  money,
  workDonations,
  worksByArtist,
} from "@/lib/beyond-data";

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
  { id: "ganhos", label: "Ganhos", icon: CircleDollarSign },
  { id: "perfil", label: "Meu Perfil", icon: UserRound },
];

const WORK_TYPES = ["Livro", "Mangá", "HQ", "Conto"];

const HISTORY = [
  { date: "28 ago 2026", work: "O Barulho das Coisas Quietas", type: "Doação", from: "A. Ferreira", amount: 40 },
  { date: "26 ago 2026", work: "Antes que a Maré Mude", type: "Doação", from: "Anônimo", amount: 15 },
  { date: "25 ago 2026", work: "O Barulho das Coisas Quietas", type: "Cliques", from: "67.230 visualizações", amount: 67230 * RATE_PER_CLICK },
  { date: "21 ago 2026", work: "O Barulho das Coisas Quietas", type: "Doação", from: "R. Silva", amount: 100 },
  { date: "18 ago 2026", work: "Antes que a Maré Mude", type: "Doação", from: "M. Lindqvist", amount: 5 },
  { date: "12 ago 2026", work: "Antes que a Maré Mude", type: "Cliques", from: "38.900 visualizações", amount: 38900 * RATE_PER_CLICK },
];

function Dashboard() {
  const artist = getArtist("leticia-voss")!;
  const initialWorks = worksByArtist(artist.slug);
  const [published, setPublished] = useState<Record<string, boolean>>(
    Object.fromEntries(initialWorks.map((w) => [w.id, true])),
  );

  const clicks = initialWorks.reduce((s, w) => s + w.clicks, 0);
  const donationsTotal = initialWorks.reduce((s, w) => s + workDonations(w.slug), 0);
  const clickGross = clicks * RATE_PER_CLICK;
  const donationGross = HISTORY.filter((h) => h.type === "Doação").reduce(
    (s, d) => s + d.amount,
    0,
  );
  const gross = clickGross + donationGross;
  const fee = gross * PLATFORM_FEE;
  const net = gross - fee;

  const [title, setTitle] = useState("");
  const [workType, setWorkType] = useState(WORK_TYPES[0]);
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [coverName, setCoverName] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<
    Array<{ id: string; title: string; type: string; submitted: string; note?: string }>
  >([
    {
      id: "q0",
      title: "O Barulho das Coisas Quietas — Cap. 13",
      type: "Livro",
      submitted: "30 ago 2026",
    },
    {
      id: "qn",
      title: "O Barulho das Coisas Quietas — Cap. 12 (revisão)",
      type: "Livro",
      submitted: "22 ago 2026",
      note: "Curadoria pediu ajuste: revisar consistência de voz no segundo parágrafo.",
    },
  ]);

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
    let pdfUrl: string | null = null;
    try {
      // Se tiver PDF selecionado, faz upload primeiro
      if (pdfFile) {
        const fd = new FormData();
        fd.append("file", pdfFile);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          toast.error(data.error ?? "Erro ao enviar o PDF.");
          setUploading(false);
          return;
        }
        pdfUrl = data.url;
      }

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
          artistName: artist.name,
          excerpt: body.slice(0, 240),
          body,
          tags,
          pdfUrl,
          status: kind === "publish" ? "pending" : "draft",
        }),
      });

      if (kind === "publish") {
        setQueue((prev) => [
          { id: `q${prev.length + 1}`, title: title.trim(), type: workType ?? "Texto", submitted: "hoje" },
          ...prev,
        ]);
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
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Sidebar fixa */}
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[220px] shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="px-6 pt-8 pb-6">
          <p className="eyebrow">Painel do autor</p>
          <p className="mt-2 font-display text-xl tracking-tight">{artist.name}</p>
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
          <p className="text-xs text-muted-foreground">Agosto 2026 · dados mockados</p>
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
              value={compact(clicks)}
              note="Todas as obras"
            />
            <Stat
              label="Doações Recebidas"
              value={money(donationsTotal)}
              note="Apoio direto de leitores"
            />
            <Stat
              label="Obras Publicadas"
              value={String(initialWorks.length)}
              note={`${compact(initialWorks.reduce((s, w) => s + w.likes, 0))} curtidas no total`}
            />
            <Stat
              label="Seguidores"
              value={compact(artist.supporters)}
              note="Apoiadores da sua página"
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
                      <Td className="text-gilt">{money(workDonations(w.slug))}</Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-2">
                          <ActionButton
                            onClick={() => toast.success(`Edição de "${w.title}" aberta (demo).`)}
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
                <textarea
                  id="obra-conteudo"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  placeholder="Escreva ou descreva sua obra aqui…"
                  className="w-full resize-y border border-border bg-transparent px-4 py-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-gilt"
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

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
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
                {HISTORY.map((h, i) => (
                  <tr key={i} className="transition-colors hover:bg-surface/60">
                    <Td className="whitespace-nowrap text-muted-foreground">{h.date}</Td>
                    <Td>{h.work}</Td>
                    <Td>
                      <span
                        className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs uppercase tracking-[0.14em] ${
                          h.type === "Doação"
                            ? "border-gilt/50 bg-gilt/10 text-gilt"
                            : "border-border bg-muted text-muted-foreground"
                        }`}
                      >
                        {h.type === "Doação" ? (
                          <Heart className="size-3" />
                        ) : (
                          <Eye className="size-3" />
                        )}
                        {h.type}
                      </span>
                    </Td>
                    <Td className="text-muted-foreground">{h.from}</Td>
                    <Td className="text-right text-gilt">{money(h.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Meu Perfil */}
        <section id="perfil" className="mt-16 scroll-mt-24">
          <SectionTitle icon={UserRound}>Meu Perfil</SectionTitle>
          <div className="mt-8 border border-gilt/25 bg-background p-8 sm:p-10">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
              <div className="flex size-20 shrink-0 items-center justify-center border border-gilt/40 font-display text-2xl text-gilt">
                {artist.initials}
              </div>
              <div className="min-w-0">
                <p className="font-display text-2xl tracking-tight">{artist.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {artist.discipline} · {artist.location}
                </p>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  {artist.bio}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to="/artist/$slug"
                    params={{ slug: artist.slug }}
                    className="border border-border px-5 py-2.5 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-gilt hover:text-gilt"
                  >
                    Ver página pública
                  </Link>
                  <button
                    onClick={() => toast.success("Edição de perfil disponível em breve (demo).")}
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
