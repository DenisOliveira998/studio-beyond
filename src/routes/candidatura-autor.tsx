import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import { useEffect, useRef, useState } from "react";
import { Clock, Hammer, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { CANDIDATURAS_ABERTAS } from "@/lib/features";

export const Route = createFileRoute("/candidatura-autor")({
  head: () => ({
    meta: [
      { title: "Candidatura de Autor | The Beyond — Publique sua Obra" },
      {
        name: "description",
        content:
          "Quer publicar livros, mangás, HQs ou contos no The Beyond? As candidaturas de autor abrem em breve — entre na lista de espera. Seleção por curadoria humana.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Candidatura de Autor | The Beyond" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/candidatura-autor` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/candidatura-autor` }],
  }),
  component: ApplicationPage,
});

function ApplicationPage() {
  const { user, loading, isStaff } = useAuth();
  const applicationsOpen = CANDIDATURAS_ABERTAS || isStaff;

  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const [realName, setRealName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  useEffect(() => {
    if (user) {
      setRealName((prev) => prev || (user.name ?? ""));
      setEmail((prev) => prev || (user.email ?? ""));
    }
  }, [user]);
  const [phone, setPhone] = useState("");
  const [portfolioLink, setPortfolioLink] = useState("");
  const [portfolioCitations, setPortfolioCitations] = useState("");
  const [fileUrls, setFileUrls] = useState<{ name: string; url: string }[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 5 - fileUrls.length);
    if (!files.length) return;
    setUploadingFile(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) { toast.error(`Erro ao enviar ${file.name}.`); continue; }
        const { url } = (await res.json()) as { url: string };
        setFileUrls((prev) => [...prev, { name: file.name, url }]);
      }
    } finally {
      setUploadingFile(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!realName.trim() || !email.trim() || !phone.trim()) {
      toast.error("Preencha nome, e-mail e número.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/candidatura", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          artistName: realName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          portfolio: portfolioLink.trim(),
          portfolioFiles: JSON.stringify(fileUrls.map((f) => f.url)),
          portfolioCitations: portfolioCitations.trim(),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Erro ${res.status}`);
      }
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 sm:px-8">
        <div className="border border-gilt/30 bg-surface p-10">
          <p className="eyebrow flex items-center gap-2">
            <Clock className="size-3.5 text-gilt" strokeWidth={1.5} /> Status da candidatura
          </p>
          <h1 className="hero-type mt-5 text-4xl tracking-tight">Candidatura em análise</h1>
          <p className="mt-5 leading-relaxed text-muted-foreground">
            Recebemos a candidatura de <span className="text-foreground">{realName}</span>. A
            curadoria avalia por ordem de chegada e responde para{" "}
            <span className="text-foreground">{email}</span>.
          </p>
          <p className="caption mt-6">
            Prazo: até <strong className="text-foreground">15 dias úteis</strong>. Autores
            aprovados recebem acesso imediato ao Painel do Autor.
          </p>
          <Link
            to="/"
            className="btn-type mt-8 inline-block border border-border px-5 py-2.5 text-xs transition-colors hover:border-gilt hover:text-gilt"
          >
            Voltar ao feed
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-16 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1fr_1.2fr]">
      <div>
        {!CANDIDATURAS_ABERTAS && (
          <div className="mb-10 flex items-center gap-3 border border-gilt/40 bg-gilt/5 px-4 py-3 text-xs">
            <Hammer className="size-4 shrink-0 text-gilt" strokeWidth={1.5} />
            <span>
              <strong className="uppercase tracking-[0.18em] text-gilt">Em construção</strong>
              <span className="text-muted-foreground">
                {" "}— as candidaturas de autor abrem em breve, por etapas. Entre na lista de espera e avisamos você.
              </span>
            </span>
          </div>
        )}
        <p className="eyebrow">Autor · candidatura com aprovação</p>
        <h1 className="hero-type mt-5 text-5xl tracking-tight">
          A entrada é por curadoria, não por cadastro.
        </h1>
        <p className="mt-6 max-w-md leading-relaxed text-muted-foreground">
          Envie seu portfólio e a curadoria avalia à mão. Toda candidatura recebe resposta —
          aprovação ou recusa comentada.
        </p>
        <ol className="mt-10 space-y-4 border-t border-border pt-8 text-sm text-muted-foreground">
          <li>1 — Você envia a candidatura e ela entra na fila da curadoria.</li>
          <li>2 — O status fica "Em análise" até a decisão.</li>
          <li>3 — Aprovado, seu perfil é promovido e você acessa o Painel do Autor.</li>
          <li>4 — Cada obra publicada passa por revisão antes de aparecer no feed.</li>
        </ol>
        <p className="mt-6 text-xs text-muted-foreground/70">
          Prazo: <strong className="text-muted-foreground">até 15 dias úteis</strong>. Nenhuma cobrança.
        </p>

        <div className="mt-10 border border-gilt/30 bg-surface p-7">
          <h2 className="eyebrow">Como você ganha</h2>
          <ul className="mt-5 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <li>
              <strong className="text-foreground">Leituras:</strong> R$ 0,004 por visualização.
            </li>
            <li>
              <strong className="text-foreground">Apoio direto</strong> dos leitores, no valor que eles escolherem.
            </li>
            <li>
              <strong className="text-foreground">88% é seu.</strong> A plataforma fica com 12% para se manter.
            </li>
            <li>
              <strong className="text-foreground">Repasse semanal</strong>, sem valor mínimo.
            </li>
            <li>
              <strong className="text-foreground">A obra continua sua.</strong> O The Beyond só tem licença para exibi-la.
            </li>
          </ul>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center border border-border bg-surface">
          <span className="size-6 animate-spin rounded-full border-2 border-border border-t-gilt" />
        </div>
      ) : !applicationsOpen ? (
        <AuthorWaitlist defaultEmail={user?.email ?? ""} />
      ) : !user ? (
        <div className="self-start border border-border bg-surface p-7 sm:p-9">
          <p className="eyebrow">Antes de enviar</p>
          <h2 className="mt-4 font-display text-3xl tracking-tight">Entre ou crie sua conta.</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            A candidatura fica ligada à sua conta — é por ela que você acompanha a resposta e, se
            aprovado, acessa o Painel do Autor. Leva menos de um minuto.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/criar"
              search={{ redirect: "/candidatura-autor" }}
              className="btn-type flex-1 bg-primary px-5 py-3 text-center text-xs text-primary-foreground transition-opacity hover:opacity-90"
            >
              Criar conta
            </Link>
            <Link
              to="/entrar"
              search={{ redirect: "/candidatura-autor" }}
              className="btn-type flex-1 border border-border px-5 py-3 text-center text-xs transition-colors hover:border-gilt hover:text-gilt"
            >
              Entrar
            </Link>
          </div>
          <p className="caption mt-6">Candidatar-se não custa nada.</p>
        </div>
      ) : (
      <form
        className="border border-border bg-surface p-7 sm:p-9"
        onSubmit={(e) => void handleSubmit(e)}
      >
        <div className="space-y-5">
          {/* Nome real */}
          <label className="block">
            <span className="eyebrow">Nome real *</span>
            <input
              required
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              placeholder="Seu nome completo"
              className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
            />
          </label>

          {/* E-mail */}
          <label className="block">
            <span className="eyebrow">E-mail *</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
            />
          </label>

          {/* Telefone */}
          <label className="block">
            <span className="eyebrow">Número de telefone *</span>
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
            />
          </label>

          {/* Portfólio — link */}
          <label className="block">
            <span className="eyebrow">Link do portfólio</span>
            <input
              type="url"
              value={portfolioLink}
              onChange={(e) => setPortfolioLink(e.target.value)}
              placeholder="https://seusite.com ou Behance, Instagram…"
              className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
            />
          </label>

          {/* Portfólio — citações */}
          <label className="block">
            <span className="eyebrow">Citações ou trechos de obras</span>
            <textarea
              rows={4}
              maxLength={1500}
              value={portfolioCitations}
              onChange={(e) => setPortfolioCitations(e.target.value)}
              placeholder="Cole aqui trechos de textos, diálogos, descrições de cenas ou o que melhor representa seu trabalho."
              className="mt-2 w-full resize-y border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
            />
            <span className="caption mt-1 block text-right">{portfolioCitations.length}/1500</span>
          </label>

          {/* Portfólio — arquivos */}
          <div>
            <span className="eyebrow block">Arquivos (imagens ou PDF, até 5)</span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingFile || fileUrls.length >= 5}
              className="mt-2 flex w-full items-center justify-center gap-2 border border-dashed border-border bg-background px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-gilt hover:text-gilt disabled:opacity-50"
            >
              <Upload className="size-4" strokeWidth={1.5} />
              {uploadingFile ? "Enviando…" : "Selecionar arquivos"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              hidden
              onChange={(e) => void handleFileChange(e)}
            />
            {fileUrls.length > 0 && (
              <ul className="mt-3 space-y-2">
                {fileUrls.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 border border-border bg-background px-3 py-2 text-xs">
                    <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                      <Paperclip className="size-3.5 shrink-0 text-gilt" strokeWidth={1.5} />
                      <span className="truncate">{f.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setFileUrls((prev) => prev.filter((_, j) => j !== i))}
                      className="shrink-0 text-muted-foreground/50 transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.5} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={sending}
          className="btn-type mt-8 w-full bg-primary py-3 text-xs text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {sending ? "Enviando…" : "Enviar candidatura"}
        </button>
        <p className="caption mt-4">
          Resposta em até 15 dias úteis. Nenhuma cobrança envolvida.
        </p>
      </form>
      )}
    </div>
  );
}

// ── Lista de espera de autores (enquanto as candidaturas estão fechadas) ───

function AuthorWaitlist({ defaultEmail }: { defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [sending, setSending] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), plan: "author" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Não foi possível entrar na lista agora.");
      }
      setJoined(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar na lista agora.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="self-start border border-border bg-surface p-7 sm:p-9">
      <p className="eyebrow">Lista de espera · Autores</p>
      {joined ? (
        <>
          <h2 className="mt-4 font-display text-3xl tracking-tight">Você está na lista.</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Avisamos <span className="text-foreground">{email.trim()}</span> quando as candidaturas
            abrirem. Enquanto isso, prepare seu portfólio: links, trechos e até 5 arquivos.
          </p>
          <Link
            to="/explorar"
            className="btn-type mt-8 inline-block border border-border px-5 py-2.5 text-xs transition-colors hover:border-gilt hover:text-gilt"
          >
            Explorar o acervo
          </Link>
        </>
      ) : (
        <form onSubmit={(e) => void handleJoin(e)}>
          <h2 className="mt-4 font-display text-3xl tracking-tight">As candidaturas abrem em breve.</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            A entrada vai acontecer por etapas. Deixe seu e-mail e avisamos quando for a sua vez de
            enviar o portfólio.
          </p>
          <label className="mt-8 block">
            <span className="eyebrow">E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
            />
          </label>
          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={sending}
            className="btn-type mt-6 w-full bg-primary py-3 text-xs text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {sending ? "Enviando…" : "Quero ser avisado"}
          </button>
          <p className="caption mt-4">Nenhuma cobrança. Seus dados não são vendidos.</p>
        </form>
      )}
    </div>
  );
}
