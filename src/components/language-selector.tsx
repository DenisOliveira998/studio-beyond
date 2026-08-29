import { Check, Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGUAGES, useLanguage } from "@/lib/i18n";

export function LanguageSelector() {
  const { language, option, setLanguage } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Escolher idioma"
        className="inline-flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-gilt hover:text-gilt"
      >
        <Globe className="h-3.5 w-3.5" />
        {option.short}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Idioma
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            disabled={!l.available}
            onSelect={() => setLanguage(l.code)}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span>{l.label}</span>
            {l.code === language ? (
              <Check className="h-3.5 w-3.5 text-gilt" />
            ) : !l.available ? (
              <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                em breve
              </span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
