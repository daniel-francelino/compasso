import { useQuery } from "@tanstack/react-query";
import { BrandSelect } from "@/components/shared/admin/brand-select";
import { useBrandOptions } from "@/hooks/shared/use-brand-options";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  CircleCheck,
  ClipboardCheck,
  Megaphone,
  TriangleAlert,
  UserRound,
  Workflow,
  type LucideIcon,
  RotateCw,
  ArrowRight,
} from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SectionCard } from "@/components/shared/admin/section-card";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { editorialStyle } from "@/components/shared/content/status-styles";
import { RequestStatusBadge } from "@/components/shared/content/status-badges";
import { Button } from "@/components/shared/ui/button";
import { Skeleton } from "@/components/shared/ui/skeleton";
import { useListState } from "@/hooks/shared/use-list-state";
import { listApprovals } from "@/lib/marketing/approvals/approvals.functions";
import { ApprovalFilter } from "@/lib/marketing/approvals/schemas";
import {
  getAttention,
  getMyItems,
  getPublicationPending,
  getStatusCounts,
} from "@/lib/marketing/dashboard/dashboard.functions";
import { getReportsDue } from "@/lib/marketing/metrics/metrics.functions";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { EditorialStatus } from "@/lib/shared/enums";
import { formatDateOnly, formatInZone, formatMonthYear } from "@/lib/shared/format";
import { PeriodPreset } from "@/lib/shared/metrics/period";
import { dashboardReasonLabels, editorialStatusLabels, platformLabels } from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { AppRoute } from "@/lib/shared/routes";

const ALL = "all";
const DEFAULT_ZONE = "America/Sao_Paulo";
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
            <RotateCw aria-hidden="true" />
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
        <EmptyState
          compact
          icon={CircleCheck}
          title="Tudo em dia"
          description="Nada precisa de atenção agora."
        />
      ) : (
        <ul className="space-y-2">
          {query.data?.map((item) => (
            <li key={item.itemId} className="space-y-1 rounded-xl border border-border p-3">
              <Link
                to="/admin/marketing/content/$itemId"
                params={{ itemId: item.itemId }}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {item.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                {item.brandName} · {item.channels.join(", ") || "sem canais"}
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

function PublicationReminderBlock({ brandId }: { brandId: string | undefined }) {
  const query = useQuery({
    queryKey: QueryKey.Dashboard.publicationPending(brandId),
    queryFn: async () =>
      unwrapResult(await getPublicationPending({ data: brandId ? { brandId } : {} })).items,
    staleTime: STALE_MS,
  });
  return (
    <Block
      title="Marcar como publicado"
      icon={Megaphone}
      loading={query.isPending}
      error={query.error?.message ?? null}
      onRetry={() => void query.refetch()}
    >
      <p className="text-sm text-muted-foreground">
        Ao marcar como publicado, a biblioteca guarda só a pré-visualização e libera o espaço dos
        arquivos de produção.
      </p>
      {query.data?.length === 0 ? (
        <EmptyState
          compact
          icon={CircleCheck}
          title="Nada a marcar"
          description="Nenhum conteúdo aprovado passou da data de publicação."
        />
      ) : (
        <ul className="space-y-2">
          {query.data?.map((item) => (
            <li
              key={item.itemId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
            >
              <span className="min-w-0">
                <Link
                  to="/admin/marketing/content/$itemId"
                  params={{ itemId: item.itemId }}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {item.title}
                </Link>
                <span className="block text-xs text-muted-foreground">
                  {item.brandName} · {item.channels.join(", ")} · {item.pendingRows}{" "}
                  {item.pendingRows === 1 ? "publicação" : "publicações"} · desde{" "}
                  {formatInZone(item.oldestPlannedAt, DEFAULT_ZONE)}
                  {item.failedRows > 0
                    ? ` · ${item.failedRows} ${item.failedRows === 1 ? "falhou" : "falharam"} na publicação automática`
                    : ""}
                </span>
              </span>
              <Button asChild size="sm" variant="outline">
                <Link to="/admin/marketing/content/$itemId" params={{ itemId: item.itemId }}>
                  Registrar publicação
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

function ReportDueBlock() {
  const query = useQuery({
    queryKey: QueryKey.Metrics.reportDue(),
    queryFn: async () => unwrapResult(await getReportsDue()).items,
    staleTime: STALE_MS,
  });
  return (
    <Block
      title="Relatórios de resultados"
      icon={BarChart3}
      loading={query.isPending}
      error={query.error?.message ?? null}
      onRetry={() => void query.refetch()}
    >
      {query.data?.length === 0 ? (
        <EmptyState
          compact
          icon={CircleCheck}
          title="Tudo enviado"
          description="Os relatórios do mês passado já foram publicados para os clientes."
        />
      ) : (
        <ul className="space-y-2">
          {query.data?.map((item) => (
            <li
              key={item.channelId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
            >
              <span className="min-w-0 text-sm">
                <span className="block font-medium text-foreground">{item.brandName}</span>
                <span className="block text-xs text-muted-foreground">
                  Relatório de {formatMonthYear(item.monthStart)} ainda não enviado
                </span>
              </span>
              <Button asChild size="sm" variant="outline">
                <Link
                  to="/admin/marketing/brands/$brandId/metrics"
                  params={{ brandId: item.brandId }}
                  search={{ channel: item.channelId, preset: PeriodPreset.LastMonth }}
                >
                  Preparar
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
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
        <EmptyState
          compact
          icon={ClipboardCheck}
          title="Nenhum pedido pendente"
          description="Nenhum pedido aguardando o cliente."
        />
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
                  {row.brandName} ·{" "}
                  {row.channels.map((channel) => platformLabels[channel.platform]).join(", ")} ·{" "}
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
          <Link to={AppRoute.Approvals}>
            <ArrowRight aria-hidden="true" />
            Ver todas ({query.data?.total})
          </Link>
        </Button>
      ) : null}
    </Block>
  );
}

function StatusIcon({ status }: { status: EditorialStatus }) {
  const Icon = editorialStyle(status).icon;
  return <Icon className="size-3.5 shrink-0" aria-hidden="true" />;
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
              <span className="flex items-center gap-1.5 text-xs">
                <StatusIcon status={status} />
                {editorialStatusLabels[status]}
              </span>
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
        <EmptyState
          compact
          icon={UserRound}
          title="Nada com você"
          description="Você não é responsável por nenhum conteúdo."
        />
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
                {item.brandName} · {editorialStatusLabels[item.editorialStatus]}
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
  const brands = useBrandOptions(can(auth, Action.Brands.View));
  const content = can(auth, Action.Content.View);
  const approvals = can(auth, Action.Approvals.View);
  const publish = can(auth, Action.Content.PublishManual);
  const reports = can(auth, Action.Metrics.Report);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão geral"
        description={`Olá, ${auth.profile?.name ?? ""}. O que precisa de você hoje.`}
        breadcrumbs={[{ label: "Visão geral" }]}
      />
      {can(auth, Action.Brands.View) ? (
        <div className="max-w-xs">
          <BrandSelect
            id="dashboard-brand"
            value={brandId ?? ALL}
            onValueChange={(value) =>
              void list.setFilter("brand", value === ALL ? undefined : value)
            }
            brands={brands.data}
            allLabel="Todas as marcas"
            allValue={ALL}
          />
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        {publish ? <PublicationReminderBlock brandId={brandId} /> : null}
        {content ? <AttentionBlock brandId={brandId} /> : null}
        {approvals ? <PendingBlock brandId={brandId} /> : null}
        {content ? <CountsBlock brandId={brandId} /> : null}
        {content ? <MineBlock /> : null}
        {reports ? <ReportDueBlock /> : null}
      </div>
    </div>
  );
}
