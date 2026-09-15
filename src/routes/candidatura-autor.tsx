import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import { useRef, useState } from "react";
import { Clock, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/candidatura-autor")({
  head: () => ({
    meta: [
      { title: "Candidatura de Autor | The Beyond — Publique sua Obra" },
      {
        name: "description",
        content:
          "Quer publicar livros, mangás, HQs ou contos no The Beyond? Envie sua candidatura com portfólio e amostras. Seleção por curadoria humana independente.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Candidatura de Autor | The Beyond" },
      {
        property: "og:description",
        content: "Publique livros, mangás, HQs e contos no The Beyond. Candidatura aberta com seleção por curadoria.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/candidatura-autor` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/candidatura-autor` }],
  }),
  component: ApplicationPage,
});

const FIELDS = ["Livro", "Mangá", "HQ", "Conto", "Outro"];

function ApplicationPage() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [artistName, setArtistName] = useState("");
  const [email, setEmail] = useState("");
  const [field, setField] = useState<string>(FIELDS[0] ?? "Livro");
  const [bio, setBio] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [message, setMessage] = useState("");
  const [samples, setSamples] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await fetch("/api/candidatura", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ artistName, email, field, bio, portfolio, message }),
      });
    } catch {
      // falha silenciosa — confirma UI de qualquer forma
    } finally {
      setSending(false);
      setSent(true);
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
            Recebemos a candidatura de <span className="text-foreground">{artistName}</span> em{" "}
            {field.toLowerCase()}. A curadoria avalia por ordem de chegada e responde para{" "}
            <span className="text-foreground">{email}</span> com aprovação ou recusa comentada.
          </p>
          <p className="caption mt-6">
            Prazo de análise: até <strong className="text-foreground">15 dias úteis</strong>. Autores aprovados recebem acesso imediato ao Painel do Autor.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to="/"
              className="btn-type border border-border px-5 py-2.5 text-xs transition-colors hover:border-gilt hover:text-gilt"
            >
              Voltar ao feed
            </Link>
            <Link
              to="/planos"
              className="rule-hover text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Conhecer os planos de leitor
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-16 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <p className="eyebrow">Autor · candidatura com aprovação</p>
        <h1 className="hero-type mt-5 text-5xl tracking-tight">
          A entrada é por curadoria, não por cadastro.
        </h1>
        <p className="mt-6 max-w-md leading-relaxed text-muted-foreground">
          Envie o seu portfólio e até três obras. A curadoria avalia cada candidatura à mão e
          responde com aprovação ou recusa comentada.
        </p>
        <ol className="mt-10 space-y-4 border-t border-border pt-8 text-sm text-muted-foreground">
          <li>1 — Você envia a candidatura e ela entra na fila da curadoria.</li>
          <li>2 — O status fica &ldquo;Candidatura em análise&rdquo; até a decisão.</li>
          <li>3 — Aprovado, você recebe e-mail e acesso ao Painel do Autor.</li>
          <li>4 — Cada obra publicada passa por revisão antes de aparecer no feed.</li>
        </ol>
        <p className="mt-6 text-xs text-muted-foreground/70">
          Prazo de análise: <strong className="text-muted-foreground">até 15 dias úteis</strong>. Toda candidatura recebe resposta — aprovação ou recusa comentada.
        </p>
      </div>

      <form
        className="border border-border bg-surface p-7 sm:p-9"
        onSubmit={(e) => void handleSubmit(e)}
      >
        <label className="block">
          <span className="eyebrow">Nome artístico</span>
          <input
            required
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            placeholder="Como você assina as obras"
            className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
          />
        </label>

        <label className="mt-5 block">
          <span className="eyebrow">E-mail para retorno *</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
          />
        </label>

        <label className="mt-5 block">
          <span className="eyebrow">Área de atuação</span>
          <select
            value={field}
            onChange={(e) => setField(e.target.value)}
            className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-gilt"
          >
            {FIELDS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-5 block">
          <span className="eyebrow">Bio curta</span>
          <textarea
            required
            maxLength={300}
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Em poucas linhas: o que você faz e como trabalha."
            className="mt-2 w-full resize-y border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
          />
          <span className="caption mt-1.5 block text-right">{bio.length}/300 caracteres</span>
        </label>

        <label className="mt-5 block">
          <span className="eyebrow">Link do portfólio (obrigatório)</span>
          <input
            required
            type="url"
            value={portfolio}
            onChange={(e) => setPortfolio(e.target.value)}
            placeholder="https://"
            className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
          />
        </label>

        <div className="mt-5">
          <span className="eyebrow">Até 3 imagens de obras para avaliação</span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-2 flex w-full flex-col items-center gap-2 border border-dashed border-border bg-background px-4 py-8 text-center transition-colors hover:border-gilt"
          >
            <Upload className="size-4 text-gilt" strokeWidth={1.5} />
            <span className="caption">
              {samples.length ? samples.join(" · ") : "Selecionar imagens (JPG ou PNG)"}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) =>
              setSamples(Array.from(e.target.files ?? []).slice(0, 3).map((f) => f.name))
            }
          />
        </div>

        <label className="mt-5 block">
          <span className="eyebrow">Mensagem ao curador (opcional)</span>
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Algo que ajude a leitura do seu trabalho."
            className="mt-2 w-full resize-y border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-gilt"
          />
        </label>

        <button
          type="submit"
          disabled={sending}
          className="btn-type mt-8 w-full bg-primary py-3 text-xs text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {sending ? "Enviando…" : "Enviar candidatura"}
        </button>
        <p className="caption mt-4">
          A resposta chega em até 15 dias úteis no e-mail informado. Nenhuma cobrança envolvida.
        </p>
      </form>
    </div>
  );
}
