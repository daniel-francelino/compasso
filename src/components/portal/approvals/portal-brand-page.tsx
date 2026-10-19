import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CircleCheck,
  ClipboardCheck,
  Hourglass,
  type LucideIcon,
} from "lucide-react";
import { PortalBrandHeader } from "@/components/portal/brands/portal-brand-header";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { RecordUnavailable } from "@/components/shared/admin/record-unavailable";
import { RequestCard, RequestListSkeleton } from "@/components/portal/approvals/request-card";
import { usePortalPreviewUrls } from "@/hooks/portal/use-portal-preview-urls";
import { listPortalApprovals, listPortalPending } from "@/lib/portal/approvals/portal.functions";
import { nextPlanned } from "@/lib/portal/approvals/planned";
import { PortalApprovalFilter } from "@/lib/portal/approvals/schemas";
import type { PortalRequest } from "@/lib/portal/approvals/types";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { AppRoute } from "@/lib/shared/routes";

const RECENT = 5;

function Section({
  title,
  icon: Icon,
  brandId,
  requests,
  emptyTitle,
  emptyDescription,
  count,
  loading = false,
}: {
  title: string;
  icon: LucideIcon;
  brandId: string;
  requests: PortalRequest[];
  emptyTitle: string;
  emptyDescription: string;
  count?: number;
  loading?: boolean;
}) {
  const previewUrls = usePortalPreviewUrls(requests);
  return (
    <section className="space-y-3" aria-label={title}>
      <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
        {title}
        {count !== undefined && count > 0 ? (
          <span className="rounded-full bg-violet px-2 text-xs font-medium text-primary-foreground">
            {count}
          </span>
        ) : null}
      </h2>
      {loading ? (
        <RequestListSkeleton rows={2} />
      ) : requests.length === 0 ? (
        <EmptyState icon={Icon} title={emptyTitle} description={emptyDescription} />
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              brandId={brandId}
              mediaUrls={previewUrls.data}
            />
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

  if (pending.isError) {
    return (
      <RecordUnavailable
        title="Você não tem acesso a esta marca"
        message="Escolha outra marca ou peça à equipe para liberar o acesso."
        backTo={AppRoute.Portal}
        backLabel="Voltar"
      />
    );
  }

  const requests = pending.data ?? [];
  const mine = requests.filter((request) => request.isMine);
  const others = requests.filter((request) => !request.isMine);
  const upcoming = (approved.data ?? [])
    .filter((request) => {
      const planned = nextPlanned(request);
      return planned !== null && new Date(planned.at).getTime() > Date.now();
    })
    .slice(0, RECENT);
  const recent = [...(approved.data ?? []), ...(decided.data ?? [])]
    .sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""))
    .slice(0, RECENT);

  return (
    <div className="space-y-8">
      <PortalBrandHeader brandId={brandId} />
      <Section
        title="Aguardando você"
        icon={ClipboardCheck}
        count={mine.length}
        brandId={brandId}
        requests={mine}
        emptyTitle="Nada pendente por aqui"
        emptyDescription="Quando a equipe enviar um conteúdo para a sua decisão, ele aparece aqui."
        loading={pending.isPending}
      />
      {others.length > 0 ? (
        <Section
          title="Pendentes com outras pessoas"
          icon={Hourglass}
          brandId={brandId}
          requests={others}
          emptyTitle=""
          emptyDescription=""
          loading={pending.isPending}
        />
      ) : null}
      <Section
        title="Próximas publicações"
        icon={CalendarClock}
        brandId={brandId}
        requests={upcoming}
        emptyTitle="Nenhuma publicação com data futura"
        emptyDescription="Os conteúdos aprovados com data marcada aparecem aqui."
        loading={approved.isPending}
      />
      <Section
        title="Decisões recentes"
        icon={CircleCheck}
        brandId={brandId}
        requests={recent}
        emptyTitle="Ainda não há decisões"
        emptyDescription="As aprovações e os pedidos de alteração ficam registrados aqui."
        loading={approved.isPending || decided.isPending}
      />
    </div>
  );
}
