import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { MIN_AGE, ageFromBirthDate } from "@/lib/age";

/**
 * Para contas de leitor que ainda não informaram a data de nascimento (ex.: criadas
 * antes da regra de idade). Sem ela, o servidor bloqueia curtir, salvar, seguir e
 * comentar — por isso a janela só fecha ao confirmar ou ao sair da conta.
 */
export function BirthdatePrompt() {
  const { user, profile, loading, refresh, signOut } = useAuth();
  const [birthDate, setBirthDate] = useState("");
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const needsBirthDate = !loading && !!user && !!profile && profile.hasBirthDate === false;
  if (!needsBirthDate) return null;

  const age = birthDate ? ageFromBirthDate(birthDate) : null;
  const tooYoung = age !== null && age < MIN_AGE;
  const isMinor = age !== null && age >= MIN_AGE && age < 18;
  const ageOk = age !== null && age >= MIN_AGE && age <= 120 && (!isMinor || guardianConsent);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!ageOk) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profile/birthdate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ birthDate, guardianConsent }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Não foi possível salvar agora.");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar agora.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/85 px-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="birth-title"
    >
      <form onSubmit={(e) => void save(e)} className="w-full max-w-md border border-gilt/30 bg-surface p-8">
        <p className="eyebrow">Só falta isso</p>
        <h2 id="birth-title" className="mt-3 font-display text-2xl tracking-tight">
          Confirme sua data de nascimento
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Para curtir, salvar, seguir e comentar, precisamos confirmar sua idade. Usamos esse dado só
          para cumprir as regras de proteção a menores.
        </p>
        <label className="mt-6 block">
          <span className="eyebrow">Data de nascimento</span>
          <input
            id="birthdate-prompt-date"
            type="date"
            required
            value={birthDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => {
              setBirthDate(e.target.value);
              setGuardianConsent(false);
            }}
            className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-gilt"
          />
        </label>
        {tooYoung && (
          <p className="mt-3 text-xs text-red-400">
            É preciso ter pelo menos {MIN_AGE} anos para usar uma conta na Go Beyondd. Você ainda pode
            ler sem conta.
          </p>
        )}
        {isMinor && (
          <label className="mt-4 flex items-start gap-3 text-sm text-muted-foreground">
            <input
              id="birthdate-prompt-consent"
              type="checkbox"
              checked={guardianConsent}
              onChange={(e) => setGuardianConsent(e.target.checked)}
              className="mt-1 size-4 shrink-0 accent-[var(--gilt)]"
            />
            <span>Tenho menos de 18 anos e meus pais ou responsáveis autorizaram minha conta.</span>
          </label>
        )}
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={!ageOk || saving}
            className="btn-type flex-1 bg-gilt px-5 py-3 text-xs font-bold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Confirmar"}
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="btn-type flex-1 border border-border px-5 py-3 text-xs text-muted-foreground transition-colors hover:border-gilt hover:text-gilt"
          >
            Sair da conta
          </button>
        </div>
      </form>
    </div>
  );
}
