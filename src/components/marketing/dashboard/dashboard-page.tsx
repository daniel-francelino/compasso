import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ClipboardCheck, TriangleAlert, UserRound, Workflow, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SelectField } from "@/components/shared/admin/form-fields";
import { SectionCard } from "@/components/shared/admin/section-card";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { RequestStatusBadge } from "@/components/shared/content/status-badges";
import { Button } from "@/components/shared/ui/button";
import { Skeleton } from "@/components/shared/ui/skeleton";
import { useListState } from "@/hooks/shared/use-list-state";
import { listApprovals } from "@/lib/marketing/approvals/approvals.functions";
import { ApprovalFilter } from "@/lib/marketing/approvals/schemas";
import {
  getAttention,
  getMyItems,
  getStatusCounts,
} from "@/lib/marketing/dashboard/dashboard.functions";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { listBrandOptions } from "@/lib/shared/brands/brand-options.functions";
import { EditorialStatus } from "@/lib/shared/enums";
import { formatDateOnly } from "@/lib/shared/format";
import { dashboardReasonLabels, editorialStatusLabels, platformLabels } from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { AppRoute } from "@/lib/shared/routes";

const ALL = "all";
const STALE_MS = 30_000;
const PENDING_ROWS = 6;

function Block({
  title,
  icon,
  loading,
  error,
  onRetry,
  children,
}: {
  title: string;
  icon: LucideIcon;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: ReactNode;
}) {
  return (
    <SectionCard title={title} icon={icon}>
      {loading ? <Skeleton className="h-24 w-full" /> : null}
      {error ? (
        <div role="alert" className="space-y-2 text-sm">
          <p className="text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      ) : null}
      {loading || error ? null : children}
    </SectionCard>
  );
}

function AttentionBlock({ brandId }: { brandId: string | undefined }) {
  const query = useQuery({
    queryKey: QueryKey.Dashboard.attention(brandId),
    queryFn: async () =>
      unwrapResult(await getAttention({ data: brandId ? { brandId } : {} })).items,
    staleTime: STALE_MS,
  });
  return (
    <Block
      title="Precisa de atenção"
      icon={TriangleAlert}
      loading={query.isPending}
      error={query.error?.message ?? null}
      onRetry={() => void query.refetch()}
    >
      {query.data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada precisa de atenção agora.</p>
      ) : (
        <ul className="space-y-2">
          {query.data?.map((item) => (
            <li key={item.variantId} className="space-y-1 rounded-xl border border-border p-3">
              <Link
                to="/admin/marketing/variants/$variantId"
                params={{ variantId: item.variantId }}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {item.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                {item.brandName} · {item.channel}
              </p>
              <div className="flex flex-wrap gap-1">
                {item.reasons.map((reason) => (
                  <StatusBadge key={reason} tone="warning" icon={TriangleAlert}>
                    {dashboardReasonLabels[reason]}
                  </StatusBadge>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

function PendingBlock({ brandId }: { brandId: string | undefined }) {
  const filters = {
    page: 1,
    search: "",
    status: ApprovalFilter.Pending,
    ...(brandId ? { brandId } : {}),
  };
  const query = useQuery({
    queryKey: QueryKey.Dashboard.pending(brandId),
    queryFn: async () => unwrapResult(await listApprovals({ data: filters })),
    staleTime: STALE_MS,
  });
  return (
    <Block
      title="Aprovações pendentes"
      icon={ClipboardCheck}
      loading={query.isPending}
      error={query.error?.message ?? null}
      onRetry={() => void query.refetch()}
    >
      {query.data?.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pedido aguardando o cliente.</p>
      ) : (
        <ul className="space-y-2">
          {query.data?.rows.slice(0, PENDING_ROWS).map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="min-w-0">
                <Link
                  to="/admin/marketing/approvals/$requestId"
                  params={{ requestId: row.id }}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {row.title}
                </Link>
                <span className="block text-xs text-muted-foreground">
                  {row.brandName} · {platformLabels[row.platform]} ·{" "}
                  {row.dueDate ? `prazo ${formatDateOnly(row.dueDate)}` : "sem prazo"}
                </span>
              </span>
              {row.overdue ? (
                <StatusBadge tone="negative" icon={TriangleAlert}>
                  Atrasada
                </StatusBadge>
              ) : (
                <RequestStatusBadge status={row.status} />
              )}
            </li>
          ))}
        </ul>
      )}
      {(query.data?.total ?? 0) > PENDING_ROWS ? (
        <Button asChild variant="outline" size="sm">
          <Link to={AppRoute.Approvals}>Ver todas ({query.data?.total})</Link>
        </Button>
      ) : null}
    </Block>
  );
}

function CountsBlock({ brandId }: { brandId: string | undefined }) {
  const query = useQuery({
    queryKey: QueryKey.Dashboard.counts(brandId),
    queryFn: async () =>
      unwrapResult(await getStatusCounts({ data: brandId ? { brandId } : {} })).counts,
    staleTime: STALE_MS,
  });
  const statuses = Object.values(EditorialStatus).filter(
    (status) => status !== EditorialStatus.Cancelled,
  );
  return (
    <Block
      title="Conteúdos por estado"
      icon={Workflow}
      loading={query.isPending}
      error={query.error?.message ?? null}
      onRetry={() => void query.refetch()}
    >
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {statuses.map((status) => (
          <li key={status} className="rounded-xl border border-border p-3">
            <Link
              to={AppRoute.Content}
              search={{ editorial: status, ...(brandId ? { brand: brandId } : {}) }}
              className="block text-primary underline-offset-4 hover:underline"
            >
              <span className="block text-2xl font-semibold text-foreground">
                {query.data?.[status] ?? 0}
              </span>
              <span className="text-xs">{editorialStatusLabels[status]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Block>
  );
}

function MineBlock() {
  const query = useQuery({
    queryKey: QueryKey.Dashboard.mine(),
    queryFn: async () => unwrapResult(await getMyItems()).items,
    staleTime: STALE_MS,
  });
  return (
    <Block
      title="Minhas tarefas"
      icon={UserRound}
      loading={query.isPending}
      error={query.error?.message ?? null}
      onRetry={() => void query.refetch()}
    >
      {query.data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">Você não é responsável por nenhum conteúdo.</p>
      ) : (
        <ul className="space-y-2">
          {query.data?.map((item) => (
            <li key={item.itemId} className="text-sm">
              <Link
                to="/admin/marketing/content/$itemId"
                params={{ itemId: item.itemId }}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {item.title}
              </Link>
              <span className="block text-xs text-muted-foreground">
                {item.brandName} · {item.openVariants} variante(s) em aberto
                {item.productionDueDate ? ` · prazo ${formatDateOnly(item.productionDueDate)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

export function DashboardPage() {
  const auth = useAuth();
  const list = useListState<string>("");
  const brandId = list.filters.brand;
  const brands = useQuery({
    queryKey: QueryKey.Brands.options(),
    queryFn: async () => unwrapResult(await listBrandOptions()).brands,
    enabled: can(auth, Action.Brands.View),
  });
  const content = can(auth, Action.Content.View);
  const approvals = can(auth, Action.Approvals.View);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão geral"
        description={`Olá, ${auth.profile?.name ?? ""}. O que precisa de você hoje.`}
        breadcrumbs={[{ label: "Visão geral" }]}
      />
      {can(auth, Action.Brands.View) ? (
        <div className="max-w-xs">
          <SelectField
            id="dashboard-brand"
            label="Marca"
            value={brandId ?? ALL}
            onValueChange={(value) =>
              void list.setFilter("brand", value === ALL ? undefined : value)
            }
            options={[
              { value: ALL, label: "Todas as marcas" },
              ...(brands.data ?? []).map((brand) => ({ value: brand.id, label: brand.name })),
            ]}
          />
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        {content ? <AttentionBlock brandId={brandId} /> : null}
        {approvals ? <PendingBlock brandId={brandId} /> : null}
        {content ? <CountsBlock brandId={brandId} /> : null}
        {content ? <MineBlock /> : null}
      </div>
    </div>
  );
}
