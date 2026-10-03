import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";

// Retorno da assinatura (back_url do preapproval). A situação vem do servidor, que consulta o Mercado Pago.
export const Route = createFileRoute("/planos/retorno")({
  validateSearch: (s: Record<string, unknown>): { preapproval_id?: string | number } =>
    typeof s["preapproval_id"] === "string" || typeof s["preapproval_id"] === "number"
      ? { preapproval_id: s["preapproval_id"] as string | number }
      : {},
  head: () => ({ meta: [{ title: "Assinatura | Go Beyondd" }, { name: "robots", content: "noindex" }] }),
  component: PlanosRetorno,
});

type SubStatus = { status: string; plan: string; priceCents: number };

function PlanosRetorno() {
  const { preapproval_id } = Route.useSearch();
  const id = String(preapproval_id ?? "");
  const { user, loading } = useAuth();
  const { data, isLoading } = useQuery<SubStatus | null>({
    queryKey: ["assinatura-status", id, user?.id],
    queryFn: () =>
      fetch(`/api/pagamentos/assinatura/status?preapproval_id=${encodeURIComponent(id)}`).then((r) =>
        r.ok ? (r.json() as Promise<SubStatus>) : null,
      ),
    enabled: !!id && !!user,
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 5000 : false),
  });

  const name = data?.plan === "superfa" ? "Super Fã" : "Fã";
  let icon = <Clock className="size-10 text-muted-foreground" strokeWidth={1.5} />;
  let title = "Conferindo a assinatura…";
  let text = "Isso leva alguns segundos.";
  if (!loading && !user) {
    title = "Entre na sua conta";
    text = "Entre com a mesma conta usada para assinar e confira o plano na página de planos.";
  } else if (!id || (!isLoading && !data && !!user)) {
    title = "Não encontramos essa assinatura";
    text = "Se a cobrança foi autorizada, o plano aparece em alguns minutos na página de planos.";
  } else if (data?.status === "authorized") {
    icon = <CheckCircle2 className="size-10 text-emerald-500" strokeWidth={1.5} />;
    title = `Bem-vindo ao plano ${name}`;
    text = "Sua assinatura está ativa: leitura sem anúncios e sem limite diário. Boa leitura!";
  } else if (data?.status === "pending") {
    title = "Assinatura em análise";
    text = "O Mercado Pago está confirmando a autorização. Esta página atualiza sozinha.";
  } else if (data) {
    icon = <XCircle className="size-10 text-red-400" strokeWidth={1.5} />;
    title = "A assinatura não foi ativada";
    text = "Nada foi cobrado. Você pode tentar de novo pela página de planos.";
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-5 py-24 text-center">
      {icon}
      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">{text}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/explorar" className="rounded-full bg-gilt px-6 py-2.5 text-sm font-bold text-ink">
          Ir para as obras
        </Link>
        <Link to="/planos" className="rounded-full border border-border px-6 py-2.5 text-sm">
          Ver meu plano
        </Link>
      </div>
    </div>
  );
}
