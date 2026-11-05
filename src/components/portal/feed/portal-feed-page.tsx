import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import {
  CircleCheck,
  Clock,
  ClipboardCheck,
  List,
  RotateCw,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { FeedPost } from "@/components/portal/feed/feed-post";
import { FeedSkeleton } from "@/components/portal/feed/feed-skeleton";
import { PortalBrandHeader } from "@/components/portal/brands/portal-brand-header";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { RecordUnavailable } from "@/components/shared/admin/record-unavailable";
import { Button } from "@/components/shared/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/shared/ui/tabs";
import { useListState } from "@/hooks/shared/use-list-state";
import { listPortalApprovals } from "@/lib/portal/approvals/portal.functions";
import { PortalApprovalFilter } from "@/lib/portal/approvals/schemas";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { AppRoute } from "@/lib/shared/routes";

const tabs = [
  { value: PortalApprovalFilter.All, label: "Todos", icon: List },
  { value: PortalApprovalFilter.Pending, label: "Pendentes", icon: Clock },
  { value: PortalApprovalFilter.Approved, label: "Aprovados", icon: CircleCheck },
  { value: PortalApprovalFilter.ChangesRequested, label: "Alterações solicitadas", icon: Undo2 },
];

export function PortalFeedPage({ brandId }: { brandId: string }) {
  const list = useListState<string>(PortalApprovalFilter.All);
  const request = { brandId, status: list.status };
  const query = useInfiniteQuery({
    queryKey: QueryKey.Portal.approvals(brandId, request),
    queryFn: async ({ pageParam }) =>
      unwrapResult(await listPortalApprovals({ data: { ...request, page: pageParam } })),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    placeholderData: keepPreviousData,
  });
  const rows = query.data?.pages.flatMap((page) => page.rows) ?? [];
  const filtered = list.status !== PortalApprovalFilter.All;

  if (query.isError && rows.length === 0 && !filtered) {
    return (
      <RecordUnavailable
        title="Você não tem acesso a esta marca"
        message="Escolha outra marca ou peça à equipe para liberar o acesso."
        backTo={AppRoute.Portal}
        backLabel="Voltar"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PortalBrandHeader brandId={brandId} />
      <Tabs value={list.status} onValueChange={list.setStatus} className="flex justify-center">
        <TabsList className="h-auto flex-wrap justify-center pointer-coarse:h-auto">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="h-8 gap-1 px-2.5 py-0 text-xs pointer-coarse:h-11 pointer-coarse:px-3 [&_svg]:size-3.5"
            >
              <tab.icon aria-hidden="true" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {query.isPending ? <FeedSkeleton /> : null}
      {query.isError ? (
        <EmptyState
          icon={TriangleAlert}
          title="Não foi possível carregar os conteúdos"
          description={query.error.message}
          action={
            <Button onClick={() => void query.refetch()}>
              <RotateCw aria-hidden="true" />
              Tentar novamente
            </Button>
          }
        />
      ) : null}
      {query.data && rows.length === 0 && !filtered ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nada por aqui ainda"
          description="Quando a equipe enviar um conteúdo, ele aparece aqui."
        />
      ) : null}
      {query.data && rows.length === 0 && filtered ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nenhum conteúdo neste filtro"
          description="Tente outro filtro para ver os demais conteúdos."
          action={
            <Button variant="outline" onClick={() => list.setStatus(PortalApprovalFilter.All)}>
              Limpar filtro
            </Button>
          }
        />
      ) : null}
      {rows.length > 0 ? (
        <>
          <ul className="space-y-4" aria-label="Conteúdos da marca">
            {rows.map((row) => (
              <li key={row.id}>
                <FeedPost request={row} brandId={brandId} />
              </li>
            ))}
          </ul>
          {query.hasNextPage ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                loading={query.isFetchingNextPage}
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                Carregar mais
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
