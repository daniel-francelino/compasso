import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { Button } from "@/components/shared/ui/button";
import { RequestCard } from "@/components/portal/approvals/request-card";
import { listPortalApprovals, listPortalPending } from "@/lib/portal/approvals/portal.functions";
import { PortalApprovalFilter } from "@/lib/portal/approvals/schemas";
import type { PortalRequest } from "@/lib/portal/approvals/types";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { AppRoute } from "@/lib/shared/routes";

const RECENT = 5;

function Section({
  title,
  brandId,
  requests,
  empty,
}: {
  title: string;
  brandId: string;
  requests: PortalRequest[];
  empty: string;
}) {
  return (
    <section className="space-y-3" aria-label={title}>
      <h2 className="heading-card">{title}</h2>
      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => (
            <RequestCard key={request.id} request={request} brandId={brandId} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function PortalBrandPage({ brandId }: { brandId: string }) {
  const pending = useQuery({
    queryKey: QueryKey.Portal.pending(brandId),
    queryFn: async () => unwrapResult(await listPortalPending({ data: { brandId } })).requests,
  });
  const approved = useQuery({
    queryKey: QueryKey.Portal.approvals(brandId, { status: PortalApprovalFilter.Approved }),
    queryFn: async () =>
      unwrapResult(
        await listPortalApprovals({
          data: { brandId, status: PortalApprovalFilter.Approved, page: 1 },
        }),
      ).rows,
  });
  const decided = useQuery({
    queryKey: QueryKey.Portal.approvals(brandId, { status: PortalApprovalFilter.ChangesRequested }),
    queryFn: async () =>
      unwrapResult(
        await listPortalApprovals({
          data: { brandId, status: PortalApprovalFilter.ChangesRequested, page: 1 },
        }),
      ).rows,
  });

  if (pending.isPending) return <ListSkeleton rows={3} />;
  if (pending.isError) {
    return (
      <EmptyState
        title="Você não tem acesso a esta marca"
        description="Escolha outra marca ou peça à equipe para liberar o acesso."
        action={
          <Button asChild>
            <Link to={AppRoute.Portal}>Voltar</Link>
          </Button>
        }
      />
    );
  }

  const mine = pending.data.filter((request) => request.isMine);
  const others = pending.data.filter((request) => !request.isMine);
  const upcoming = (approved.data ?? [])
    .filter(
      (request) => request.plannedAt !== null && new Date(request.plannedAt).getTime() > Date.now(),
    )
    .slice(0, RECENT);
  const recent = [...(approved.data ?? []), ...(decided.data ?? [])]
    .sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""))
    .slice(0, RECENT);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="heading-page">Painel</h1>
        <Button asChild variant="outline">
          <Link to="/portal/brands/$brandId/approvals" params={{ brandId }}>
            Ver todas as aprovações
          </Link>
        </Button>
      </div>
      <Section
        title={`Aguardando você (${mine.length})`}
        brandId={brandId}
        requests={mine}
        empty="Nada pendente por aqui."
      />
      {others.length > 0 ? (
        <Section
          title="Pendentes com outras pessoas"
          brandId={brandId}
          requests={others}
          empty=""
        />
      ) : null}
      <Section
        title="Próximas publicações"
        brandId={brandId}
        requests={upcoming}
        empty="Nenhuma publicação aprovada com data futura."
      />
      <Section
        title="Decisões recentes"
        brandId={brandId}
        requests={recent}
        empty="Ainda não há decisões."
      />
      <Button asChild variant="ghost">
        <Link to={AppRoute.Portal}>
          <ArrowLeft aria-hidden="true" />
          Trocar de marca
        </Link>
      </Button>
    </div>
  );
}
