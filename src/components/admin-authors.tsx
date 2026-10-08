import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { compact, money } from "@/lib/beyond-data";

export type AuthorRevenueRow = {
  artistSlug: string;
  artistName: string;
  works: number;
  clicks: number;
  clicksWeek: number;
  clickRevenue: number;
  donations: number;
  total: number;
};

type SortKey = "artistName" | "works" | "clicks" | "clicksWeek" | "clickRevenue" | "donations" | "total";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "artistName", label: "Autor", numeric: false },
  { key: "works", label: "Obras", numeric: true },
  { key: "clicks", label: "Cliques (total)", numeric: true },
  { key: "clicksWeek", label: "Cliques (7 dias)", numeric: true },
  { key: "clickRevenue", label: "Receita por cliques", numeric: true },
  { key: "donations", label: "Doações", numeric: true },
  { key: "total", label: "Total gerado", numeric: true },
];

/** Equipe: quanto cada autor gerou, somando todas as obras dele. */
export function AdminAuthors() {
  const { data = [], isLoading } = useQuery<AuthorRevenueRow[]>({
    queryKey: ["admin-autores"],
    queryFn: () => fetch("/api/admin/autores").then((r) => r.json() as Promise<AuthorRevenueRow[]>),
    staleTime: 60_000,
  });
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "total", desc: true });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term ? data.filter((r) => r.artistName.toLowerCase().includes(term)) : [...data];
    list.sort((a, b) => {
      const d = sort.key === "artistName" ? a.artistName.localeCompare(b.artistName, "pt-BR") : a[sort.key] - b[sort.key];
      return sort.desc ? -d : d;
    });
    return list;
  }, [data, q, sort]);

  const cell = (r: AuthorRevenueRow, key: SortKey) => {
    switch (key) {
      case "artistName":
        return (
          <a href={`/autor/${r.artistSlug}`} className="font-medium hover:text-gilt">
            {r.artistName}
          </a>
        );
      case "works":
        return r.works;
      case "clicks":
      case "clicksWeek":
        return compact(r[key]);
      default:
        return money(r[key]);
    }
  };

  return (
    <div className="mt-6">
      <label className="block max-w-xs">
        <span className="sr-only">Buscar autor</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar autor"
          className="w-full border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gilt"
        />
      </label>
      <p className="mt-2 text-xs text-muted-foreground">
        Cliques anteriores a 08/10/2026 foram contados pela regra antiga (toda abertura de página). A coluna de 7 dias já
        usa a regra nova: 1 por pessoa a cada 7 dias.
      </p>
      <div className="mt-4 overflow-x-auto border border-border">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              {COLUMNS.map((c) => (
                <th key={c.key} className={`px-4 py-3 font-normal ${c.numeric ? "text-right" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setSort((s) => ({ key: c.key, desc: s.key === c.key ? !s.desc : c.numeric }))}
                    className={`text-xs ${sort.key === c.key ? "text-gilt" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {c.label}
                    {sort.key === c.key ? (sort.desc ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-6 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhum autor com obra publicada.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.artistSlug}>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className={`px-4 py-3 ${c.numeric ? "text-right tabular-nums" : ""}`}>
                      {cell(r, c.key)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
