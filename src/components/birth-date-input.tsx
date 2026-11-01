import { useState } from "react";
import { ageFromBirthDate } from "@/lib/age";

/** Máscara DD/MM/AAAA: mantém só os dígitos e coloca as barras enquanto a pessoa digita. */
function maskBirthDate(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
}

/** "25/03/2001" → "2001-03-25"; vazio enquanto a data estiver incompleta. */
function toIsoDate(masked: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(masked);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

/**
 * Campo de data de nascimento digitado, com teclado numérico no celular. O seletor
 * nativo (type="date") abre no mês atual e obriga a voltar anos até a data certa.
 * Devolve a data em "YYYY-MM-DD", ou "" enquanto não estiver completa.
 */
export function BirthDateInput({ id, onChange }: { id?: string; onChange: (isoDate: string) => void }) {
  const [text, setText] = useState("");
  const iso = toIsoDate(text);
  const age = iso ? ageFromBirthDate(iso) : null;
  const invalid = text.length === 10 && (age === null || age > 120);

  return (
    <>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        required
        placeholder="DD/MM/AAAA"
        maxLength={10}
        value={text}
        aria-invalid={invalid}
        onChange={(e) => {
          const masked = maskBirthDate(e.target.value);
          setText(masked);
          onChange(toIsoDate(masked));
        }}
        className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-gilt"
      />
      {invalid && (
        <span className="mt-2 block text-xs text-destructive">Data inválida. Confira o dia, o mês e o ano.</span>
      )}
    </>
  );
}
