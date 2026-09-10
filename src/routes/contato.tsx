import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Instagram, Mail, MapPin, Phone, Send } from "lucide-react";
import { toast } from "sonner";
import type { SiteConfigData } from "@/lib/beyond-db";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato | The Beyond — Fale Conosco" },
      {
        name: "description",
        content:
          "Entre em contato com o The Beyond: dúvidas, parcerias, imprensa ou suporte. Estamos disponíveis por e-mail, telefone e redes sociais.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Contato | The Beyond" },
      {
        property: "og:description",
        content: "Fale com a equipe do The Beyond: dúvidas, parcerias e suporte.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

const DEFAULT_CFG: SiteConfigData = {
  instagram: "https://instagram.com/thebeyond.art",
  youtube: "",
  email: "contato@thebeyond.art",
  phone: "(11) 99999-9999",
  address: "Rua das Artes, 142 — São Paulo, SP",
  cnpj: "00.000.000/0001-00",
};

type Field = "name" | "email" | "subject" | "message";

const SUBJECTS = [
  "Dúvida geral",
  "Candidatura de autor",
  "Parceria ou imprensa",
  "Problema técnico",
  "Sugestão",
  "Outro",
];

function ContactPage() {
  const { data: cfg = DEFAULT_CFG } = useQuery<SiteConfigData>({
    queryKey: ["site-config"],
    queryFn: () => fetch("/api/site-config").then((r) => r.json() as Promise<SiteConfigData>),
    staleTime: 5 * 60 * 1000,
  });

  const [form, setForm] = useState<Record<Field, string>>({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  function set(field: Field, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error("Preencha nome, e-mail e mensagem.");
      return;
    }
    setSending(true);
    // Simulação — integrar com Resend quando pronto
    await new Promise((r) => setTimeout(r, 1200));
    setSending(false);
    setSent(true);
    toast.success("Mensagem enviada! Respondemos em até 2 dias úteis.");
  }

  const igHandle = cfg.instagram
    ? cfg.instagram.replace(/.*instagram\.com\//i, "").replace(/\/$/, "")
    : null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      {/* Cabeçalho */}
      <p className="eyebrow">Fale conosco</p>
      <h1 className="hero-type mt-5 text-5xl tracking-tight">
        Contato
      </h1>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
        Dúvidas, parcerias, imprensa ou sugestões — manda uma mensagem e a gente retorna em até
        dois dias úteis.
      </p>

      <div className="mt-16 grid gap-16 lg:grid-cols-[1fr_380px]">
        {/* Formulário */}
        {sent ? (
          <div className="flex flex-col justify-center gap-4 border border-gilt/25 bg-background p-10">
            <p className="font-display text-3xl tracking-tight">Mensagem recebida ✓</p>
            <p className="text-muted-foreground">
              Obrigado por entrar em contato. Respondemos em até 2 dias úteis no e-mail informado.
            </p>
            <button
              onClick={() => {
                setSent(false);
                setForm({ name: "", email: "", subject: "", message: "" });
              }}
              className="mt-4 self-start border border-border px-4 py-2 text-sm transition-colors hover:border-gilt hover:text-gilt"
            >
              Enviar outra mensagem
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="eyebrow text-xs">Nome *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Seu nome"
                  required
                  className="border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-gilt focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="eyebrow text-xs">E-mail *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-gilt focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="eyebrow text-xs">Assunto</label>
              <select
                value={form.subject}
                onChange={(e) => set("subject", e.target.value)}
                className="border border-border bg-surface px-4 py-3 text-sm text-foreground focus:border-gilt focus:outline-none"
              >
                <option value="">Selecione um assunto…</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="eyebrow text-xs">Mensagem *</label>
              <textarea
                value={form.message}
                onChange={(e) => set("message", e.target.value)}
                placeholder="Descreva sua dúvida ou proposta…"
                required
                rows={6}
                className="resize-none border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-gilt focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="flex w-fit items-center gap-2 bg-gilt px-6 py-3 text-sm font-medium text-ink transition-opacity disabled:opacity-60"
            >
              <Send className="size-4" strokeWidth={1.5} />
              {sending ? "Enviando…" : "Enviar mensagem"}
            </button>
          </form>
        )}

        {/* Info de contato */}
        <aside className="flex flex-col gap-8">
          <div className="border border-border/70 bg-surface/60 p-8">
            <p className="eyebrow mb-6">Informações</p>
            <ul className="flex flex-col gap-5 text-sm text-muted-foreground">
              {cfg.email && (
                <li className="flex items-start gap-3">
                  <Mail className="mt-0.5 size-4 shrink-0 text-gilt" strokeWidth={1.5} />
                  <a
                    href={`mailto:${cfg.email}`}
                    className="break-all transition-colors hover:text-foreground"
                  >
                    {cfg.email}
                  </a>
                </li>
              )}
              {cfg.phone && (
                <li className="flex items-start gap-3">
                  <Phone className="mt-0.5 size-4 shrink-0 text-gilt" strokeWidth={1.5} />
                  <a
                    href={`tel:${cfg.phone.replace(/\D/g, "")}`}
                    className="transition-colors hover:text-foreground"
                  >
                    {cfg.phone}
                  </a>
                </li>
              )}
              {cfg.address && (
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-gilt" strokeWidth={1.5} />
                  <span>{cfg.address}</span>
                </li>
              )}
              {igHandle && (
                <li className="flex items-start gap-3">
                  <Instagram className="mt-0.5 size-4 shrink-0 text-gilt" strokeWidth={1.5} />
                  <a
                    href={cfg.instagram}
                    target="_blank"
                    rel="noreferrer"
                    className="transition-colors hover:text-foreground"
                  >
                    @{igHandle}
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div className="border border-border/70 bg-surface/60 p-8">
            <p className="eyebrow mb-3">Tempo de resposta</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Respondemos todos os contatos em até <strong className="text-foreground">2 dias úteis</strong>.
              Para candidaturas de autor, o prazo de análise é de até 15 dias.
            </p>
          </div>

          {cfg.cnpj && (
            <p className="text-xs text-muted-foreground/60">CNPJ {cfg.cnpj}</p>
          )}
        </aside>
      </div>
    </div>
  );
}
