import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";

type Notif = { id: string; type: string; title: string; body: string; link: string; read: boolean; createdAt: string };
type NotifData = { unread: number; items: Notif[] };

function ago(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 60) return `há ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

/** Sino do header: capítulos novos de quem você segue e respostas da curadoria. */
export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useQuery<NotifData>({
    queryKey: ["notificacoes"],
    queryFn: () => fetch("/api/notificacoes").then((r) => r.json() as Promise<NotifData>),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const unread = data?.unread ?? 0;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    // Ao abrir, marca tudo como lido
    if (next && unread > 0) {
      void fetch("/api/notificacoes", { method: "POST" })
        .then((r) => r.json() as Promise<NotifData>)
        .then((d) => qc.setQueryData(["notificacoes"], { ...d, items: data?.items ?? d.items }));
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Notificações, ${unread} novas` : "Notificações"}
        aria-expanded={open}
        className="relative flex size-8 items-center justify-center text-white/80 transition-colors hover:text-gilt"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 max-w-[calc(100vw-2rem)] rounded border border-border bg-ink shadow-lg">
          <p className="border-b border-border/60 px-4 py-2.5 text-sm font-bold text-white">Notificações</p>
          {!data?.items.length ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Siga autores e favorite obras para saber quando sair capítulo novo.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-border/40 overflow-y-auto">
              {data.items.map((n) => (
                <li key={n.id}>
                  <a
                    href={n.link || "#"}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-3 text-sm transition-colors hover:bg-white/5 ${n.read ? "text-white/60" : "text-white"}`}
                  >
                    <span className="block font-bold">{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-xs text-white/60">{n.body}</span>}
                    <span className="mt-1 block text-[11px] text-white/40">{ago(n.createdAt)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
