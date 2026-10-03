import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { money } from "@/lib/beyond-data";

// Retorno do Checkout Pro do Mercado Pago (back_urls). A situação real vem do servidor,
// que confere o pagamento direto no Mercado Pago (o parâmetro da URL não é confiável).
export const Route = createFileRoute("/apoio/retorno")({
  validateSearch: (s: Record<string, unknown>) => ({
    ref: typeof s["external_reference"] === "string" ? (s["external_reference"] as string) : "",
    mp: typeof s["payment_id"] === "string" || typeof s["payment_id"] === "number" ? String(s["payment_id"]) : "",
  }),
  head: () => ({
    meta: [{ title: "Apoio | Go Beyondd" }, { name: "robots", content: "noindex" }],
  }),
  component: ApoioRetorno,
});

type Status = { status: string; artistName: string; artistSlug: string; workSlug: string | null; grossCents: number };

function ApoioRetorno() {
  const { ref, mp } = Route.useSearch();
  const { data, isLoading } = useQuery<Status | null>({
    queryKey: ["apoio-status", ref, mp],
    queryFn: () =>
      fetch(`/api/pagamentos/status?ref=${encodeURIComponent(ref)}${mp && mp !== "null" ? `&payment_id=${encodeURIComponent(mp)}` : ""}`).then((r) =>
        r.ok ? (r.json() as Promise<Status>) : null,
      ),
    enabled: !!ref,
    // Enquanto estiver pendente, confere de novo a cada 5 s (Pix e boleto podem demorar)
    refetchInterval: (q) => (q.state.data && ["pending", "in_process"].includes(q.state.data.status) ? 5000 : false),
  });

  const back = data?.workSlug ? (
    <Link to="/work/$slug" params={{ slug: data.workSlug }} className="rounded-full bg-gilt px-6 py-2.5 text-sm font-bold text-ink">
      Voltar à obra
    </Link>
  ) : data?.artistSlug ? (
    <Link to="/artist/$slug" params={{ slug: data.artistSlug }} className="rounded-full bg-gilt px-6 py-2.5 text-sm font-bold text-ink">
      Voltar ao perfil de {data.artistName}
    </Link>
  ) : (
    <Link to="/" className="rounded-full bg-gilt px-6 py-2.5 text-sm font-bold text-ink">
      Voltar ao início
    </Link>
  );

  let icon = <Clock className="size-10 text-muted-foreground" strokeWidth={1.5} />;
  let title = "Conferindo o pagamento…";
  let text = "Isso leva alguns segundos.";
  if (!ref || (!isLoading && !data)) {
    title = "Não encontramos esse pagamento";
    text = "Se você pagou, o comprovante do Mercado Pago chega no seu e-mail. Qualquer dúvida, fale com a gente pela página de contato.";
  } else if (data?.status === "approved") {
    icon = <CheckCircle2 className="size-10 text-emerald-500" strokeWidth={1.5} />;
    title = `Obrigado por apoiar ${data.artistName}`;
    text = `Recebemos ${money(data.grossCents / 100)}. O comprovante foi enviado pelo Mercado Pago para o seu e-mail.`;
  } else if (data && ["pending", "in_process"].includes(data.status)) {
    title = "Pagamento em análise";
    text = "Pix e boleto podem levar alguns minutos para confirmar. Esta página atualiza sozinha.";
  } else if (data) {
    icon = <XCircle className="size-10 text-red-400" strokeWidth={1.5} />;
    title = "O pagamento não foi concluído";
    text = "Nada foi cobrado. Você pode tentar de novo com outra forma de pagamento.";
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-5 py-24 text-center">
      {icon}
      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">{text}</p>
      <div className="mt-8">{back}</div>
    </div>
  );
}
