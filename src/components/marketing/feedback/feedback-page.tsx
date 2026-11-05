import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CircleCheck, Hourglass, MessageSquareHeart } from "lucide-react";
import { useMemo, useState } from "react";
import { FeedbackCard } from "@/components/marketing/feedback/feedback-card";
import { FeedbackDetailSheet } from "@/components/marketing/feedback/feedback-detail-sheet";
import { FeedbackSummary } from "@/components/marketing/feedback/feedback-summary";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { ListFilters } from "@/components/shared/admin/list-filters";
import { ListToolbar } from "@/components/shared/admin/list-toolbar";
import { PageHeader } from "@/components/shared/admin/page-header";
import { PaginationBar } from "@/components/shared/admin/pagination-bar";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { Button } from "@/components/shared/ui/button";
import { useBrandOptions } from "@/hooks/shared/use-brand-options";
import { useListState } from "@/hooks/shared/use-list-state";
import {
  type FeedbackCard as FeedbackCardData,
  getFeedbackSummary,
  listFeedback,
} from "@/lib/marketing/feedback/feedback.functions";
import { browserTimeZone, todayInZone } from "@/lib/shared/dates";
import { FEEDBACK_PAGE_SIZE } from "@/lib/shared/feedback/limits";
import {
  periodFromParam,
  periodLabel,
  periodToParam,
  previousClosedMonth,
  shiftPeriod,
} from "@/lib/shared/feedback/period";
import { FeedbackListStatus } from "@/lib/shared/feedback/types";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const ALL = "all";
const ATTENTION = "1";
const PERIOD_OPTIONS = 12;

const tabs = [
  { value: FeedbackListStatus.Answered, label: "Respondidos", icon: CircleCheck },
  { value: FeedbackListStatus.Pending, label: "Sem resposta", icon: Hourglass },
];

export function FeedbackPage() {
  const list = useListState<string>(FeedbackListStatus.Answered);
  const [selected, setSelected] = useState<FeedbackCardData | null>(null);
  const brands = useBrandOptions();

  const latest = useMemo(() => previousClosedMonth(todayInZone(browserTimeZone())), []);
  const period = periodFromParam(list.filters.period) ?? latest;
  const status =
    list.status === FeedbackListStatus.Pending
      ? FeedbackListStatus.Pending
      : FeedbackListStatus.Answered;
  const attention = list.filters.attention === ATTENTION;
  const brandId = list.filters.brand;
  const filters = {
    ...(brandId ? { brandId } : {}),
    periodMonth: period,
    status,
    attention,
    page: list.page,
  };
  const summaryFilters = { ...(brandId ? { brandId } : {}), periodMonth: period };

  const cards = useQuery({
    queryKey: QueryKey.Feedback.list(filters),
    queryFn: async () => unwrapResult(await listFeedback({ data: filters })),
    placeholderData: keepPreviousData,
  });
  const summary = useQuery({
    queryKey: QueryKey.Feedback.summary(summaryFilters),
    queryFn: async () => unwrapResult(await getFeedbackSummary({ data: summaryFilters })).summary,
  });

  const logos = useMemo(
    () => new Map((brands.data ?? []).map((brand) => [brand.id, brand.logoUrl])),
    [brands.data],
  );
  const periods = Array.from({ length: PERIOD_OPTIONS }, (_, index) => shiftPeriod(latest, -index));
  const rows = cards.data?.rows ?? [];
  const filtered = brandId !== undefined || attention;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedbacks"
        description="Como os clientes avaliam o trabalho de cada mês. A pesquisa abre no portal do cliente."
        breadcrumbs={[{ label: "Feedbacks" }]}
      />
      <ListToolbar
        search=""
        onSearchChange={() => undefined}
        searchLabel="Buscar"
        hideSearch
        statusOptions={tabs}
        status={status}
        onStatusChange={list.setStatus}
        extra={
          <ListFilters
            groups={[
              {
                id: "period",
                label: "Mês avaliado",
                value: periodToParam(period),
                defaultValue: periodToParam(latest),
                options: periods.map((item) => ({
                  value: periodToParam(item),
                  label: periodLabel(item),
                })),
                onChange: (value) =>
                  void list.setFilter(
                    "period",
                    value === periodToParam(latest) ? undefined : value,
                  ),
              },
              {
                id: "brand",
                label: "Marca",
                value: brandId ?? ALL,
                defaultValue: ALL,
                emptyText: brands.data?.length === 0 ? "Nenhuma marca cadastrada" : undefined,
                options: [
                  { value: ALL, label: "Todas" },
                  ...(brands.data ?? []).map((brand) => ({ value: brand.id, label: brand.name })),
                ],
                onChange: (value) =>
                  void list.setFilter("brand", value === ALL ? undefined : value),
              },
              {
                id: "attention",
                label: "Notas",
                value: attention ? ATTENTION : ALL,
                defaultValue: ALL,
                options: [
                  { value: ALL, label: "Todas" },
                  { value: ATTENTION, label: "Só as que pedem atenção" },
                ],
                onChange: (value) =>
                  void list.setFilter("attention", value === ATTENTION ? ATTENTION : undefined),
              },
            ]}
          />
        }
      />
      {summary.data ? <FeedbackSummary summary={summary.data} /> : null}
      {cards.isPending ? (
        <ListSkeleton rows={3} height="h-56" />
      ) : cards.isError ? (
        <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
          <p>Não foi possível carregar os feedbacks.</p>
          <Button variant="outline" onClick={() => void cards.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={MessageSquareHeart}
          title={
            filtered
              ? "Nenhum resultado"
              : status === FeedbackListStatus.Pending
                ? "Todos responderam"
                : "Nenhum feedback neste período"
          }
          description={
            filtered
              ? "Tente outra marca ou tire os filtros."
              : status === FeedbackListStatus.Pending
                ? "Não há contatos esperando para responder neste mês."
                : "A pesquisa abre no portal depois que a marca completa um mês."
          }
          action={
            filtered ? (
              <Button
                variant="outline"
                onClick={() => {
                  void list.setFilter("brand", undefined);
                  void list.setFilter("attention", undefined);
                }}
              >
                Limpar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy={cards.isFetching}>
          {rows.map((card) => (
            <FeedbackCard
              key={card.id ?? `${card.brandId}:${card.respondentId}`}
              card={card}
              logoUrl={logos.get(card.brandId) ?? null}
              onOpen={setSelected}
            />
          ))}
        </div>
      )}
      <PaginationBar
        page={list.page}
        pageSize={FEEDBACK_PAGE_SIZE}
        total={cards.data?.total ?? 0}
        onPageChange={list.setPage}
        disabled={cards.isFetching}
      />
      <FeedbackDetailSheet card={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
