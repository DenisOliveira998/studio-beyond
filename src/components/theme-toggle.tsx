import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

// Claro é o azul royal (padrão). Escuro é o azul-marinho, ligado pela classe "marinho".
const BAR_COLOR: Record<Theme, string> = { light: "#1C47C3", dark: "#0A1633" };

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("marinho", theme === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR_COLOR[theme]);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem("beyond-theme") as Theme | null;
    const initial: Theme = stored ?? "light";
    setTheme(initial);
    applyTheme(initial);
  }, []);

  function toggle() {
    const next: Theme = document.documentElement.classList.contains("marinho") ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem("beyond-theme", next);
    applyTheme(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
      className="border border-border p-1.5 text-muted-foreground transition-colors hover:border-gilt hover:text-gilt"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
