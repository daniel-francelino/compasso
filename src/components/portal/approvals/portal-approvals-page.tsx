import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { PaginationBar } from "@/components/shared/admin/pagination-bar";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { Button } from "@/components/shared/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/shared/ui/tabs";
import { RequestCard } from "@/components/portal/approvals/request-card";
import { useListState } from "@/hooks/shared/use-list-state";
import { listPortalApprovals } from "@/lib/portal/approvals/portal.functions";
import { PORTAL_PAGE_SIZE, PortalApprovalFilter } from "@/lib/portal/approvals/schemas";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const tabs = [
  { value: PortalApprovalFilter.All, label: "Todas" },
  { value: PortalApprovalFilter.Pending, label: "Pendentes" },
  { value: PortalApprovalFilter.Approved, label: "Aprovadas" },
  { value: PortalApprovalFilter.ChangesRequested, label: "Alterações solicitadas" },
  { value: PortalApprovalFilter.Superseded, label: "Substituídas" },
];

export function PortalApprovalsPage({ brandId }: { brandId: string }) {
  const list = useListState<string>(PortalApprovalFilter.All);
  const request = { brandId, status: list.status, page: list.page };
  const query = useQuery({
    queryKey: QueryKey.Portal.approvals(brandId, request),
    queryFn: async () => unwrapResult(await listPortalApprovals({ data: request })),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="heading-page">Aprovações</h1>
        <Button asChild variant="ghost">
          <Link to="/portal/brands/$brandId" params={{ brandId }}>
            <ArrowLeft aria-hidden="true" />
            Painel
          </Link>
        </Button>
      </div>
      <Tabs value={list.status} onValueChange={list.setStatus}>
        <TabsList className="h-auto flex-wrap">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="min-h-11">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {query.isPending ? <ListSkeleton rows={3} /> : null}
      {query.isError ? (
        <EmptyState
          title="Não foi possível carregar as aprovações"
          description={query.error.message}
          action={<Button onClick={() => void query.refetch()}>Tentar novamente</Button>}
        />
      ) : null}
      {query.data && query.data.rows.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nada por aqui"
          description="Quando houver conteúdo para você avaliar, ele aparece nesta lista."
        />
      ) : null}
      {query.data && query.data.rows.length > 0 ? (
        <>
          <ul className="space-y-3">
            {query.data.rows.map((row) => (
              <RequestCard key={row.id} request={row} brandId={brandId} />
            ))}
          </ul>
          <PaginationBar
            page={list.page}
            pageSize={PORTAL_PAGE_SIZE}
            total={query.data.total}
            onPageChange={list.setPage}
          />
        </>
      ) : null}
    </div>
  );
}
