import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ClipboardCheck,
  TriangleAlert,
  RotateCw,
  Clock,
  Undo2,
  CircleCheck,
  Layers,
  List,
} from "lucide-react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { PaginationBar } from "@/components/shared/admin/pagination-bar";
import { Button } from "@/components/shared/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/shared/ui/tabs";
import { RequestCard, RequestListSkeleton } from "@/components/portal/approvals/request-card";
import { usePortalPreviewUrls } from "@/hooks/portal/use-portal-preview-urls";
import { useListState } from "@/hooks/shared/use-list-state";
import { listPortalApprovals } from "@/lib/portal/approvals/portal.functions";
import { PORTAL_PAGE_SIZE, PortalApprovalFilter } from "@/lib/portal/approvals/schemas";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const tabs = [
  { value: PortalApprovalFilter.All, label: "Todas", icon: List },
  { value: PortalApprovalFilter.Pending, label: "Pendentes", icon: Clock },
  { value: PortalApprovalFilter.Approved, label: "Aprovadas", icon: CircleCheck },
  { value: PortalApprovalFilter.ChangesRequested, label: "Alterações solicitadas", icon: Undo2 },
  { value: PortalApprovalFilter.Superseded, label: "Substituídas", icon: Layers },
];

export function PortalApprovalsPage({ brandId }: { brandId: string }) {
  const list = useListState<string>(PortalApprovalFilter.All);
  const request = { brandId, status: list.status, page: list.page };
  const query = useQuery({
    queryKey: QueryKey.Portal.approvals(brandId, request),
    queryFn: async () => unwrapResult(await listPortalApprovals({ data: request })),
    placeholderData: keepPreviousData,
  });
  const previewUrls = usePortalPreviewUrls(query.data?.rows ?? []);

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
              <tab.icon aria-hidden="true" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {query.isPending ? <RequestListSkeleton rows={3} /> : null}
      {query.isError ? (
        <EmptyState
          icon={TriangleAlert}
          title="Não foi possível carregar as aprovações"
          description={query.error.message}
          action={
            <Button onClick={() => void query.refetch()}>
              <RotateCw aria-hidden="true" />
              Tentar novamente
            </Button>
          }
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
              <RequestCard
                key={row.id}
                request={row}
                brandId={brandId}
                mediaUrls={previewUrls.data}
              />
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
