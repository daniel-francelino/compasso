import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  CircleCheck,
  Clock,
  ClipboardCheck,
  List,
  RotateCw,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FeedPost } from "@/components/portal/feed/feed-post";
import { FeedSkeleton } from "@/components/portal/feed/feed-skeleton";
import { PortalBrandHeader } from "@/components/portal/brands/portal-brand-header";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { RecordUnavailable } from "@/components/shared/admin/record-unavailable";
import { Button } from "@/components/shared/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/shared/ui/tabs";
import { usePortalBrand } from "@/hooks/portal/use-portal-brand";
import { useListState } from "@/hooks/shared/use-list-state";
import { shouldLoadMore } from "@/lib/portal/approvals/feed";
import { listPortalApprovals } from "@/lib/portal/approvals/portal.functions";
import { PortalApprovalFilter } from "@/lib/portal/approvals/schemas";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { AppRoute } from "@/lib/shared/routes";

const ESTIMATED_POST_PX = 720;
const OVERSCAN_POSTS = 2;

const tabs = [
  { value: PortalApprovalFilter.All, label: "Todos", icon: List },
  { value: PortalApprovalFilter.Pending, label: "Pendentes", icon: Clock },
  { value: PortalApprovalFilter.Approved, label: "Aprovados", icon: CircleCheck },
  { value: PortalApprovalFilter.ChangesRequested, label: "Alterações solicitadas", icon: Undo2 },
];

export function PortalFeedPage({ brandId }: { brandId: string }) {
  const list = useListState<string>(PortalApprovalFilter.All);
  const request = { brandId, status: list.status };
  const brand = usePortalBrand(brandId);
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

  const listRef = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);
  const measure = useCallback(() => {
    const top = (listRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
    setMargin((current) => (Math.abs(current - top) < 1 ? current : top));
  }, []);
  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [measure]);
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ESTIMATED_POST_PX,
    overscan: OVERSCAN_POSTS,
    scrollMargin: margin,
    getItemKey: (index) => rows[index]?.id ?? index,
  });
  const items = virtualizer.getVirtualItems();
  const lastVisibleIndex = items.at(-1)?.index ?? -1;
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = query;

  useEffect(() => {
    const load = shouldLoadMore({
      lastVisibleIndex,
      loaded: rows.length,
      hasNextPage,
      fetching: isFetchingNextPage,
      failed: isFetchNextPageError,
    });
    if (load) void fetchNextPage();
  }, [
    lastVisibleIndex,
    rows.length,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  ]);

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
      {query.isError && rows.length === 0 ? (
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
        <div>
          <div
            ref={listRef}
            role="list"
            aria-label="Conteúdos da marca"
            className="relative"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {items.map((item) => {
              const row = rows[item.index];
              if (row === undefined) return null;
              return (
                <div
                  key={item.key}
                  ref={virtualizer.measureElement}
                  data-index={item.index}
                  role="listitem"
                  aria-posinset={item.index + 1}
                  aria-setsize={rows.length}
                  className="absolute left-0 top-0 w-full pb-4"
                  style={{ transform: `translateY(${item.start - margin}px)` }}
                >
                  <FeedPost request={row} brandId={brandId} logoUrl={brand.data?.logoUrl ?? null} />
                </div>
              );
            })}
          </div>
          {isFetchingNextPage ? <FeedSkeleton rows={1} /> : null}
          {isFetchNextPageError ? (
            <div className="flex flex-col items-center gap-2 py-4" role="alert">
              <p className="text-sm text-muted-foreground">Não foi possível carregar mais.</p>
              <Button variant="outline" className="min-h-11" onClick={() => void fetchNextPage()}>
                <RotateCw aria-hidden="true" />
                Tentar novamente
              </Button>
            </div>
          ) : null}
          {!hasNextPage && !isFetchingNextPage ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Você viu todos os conteúdos.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
