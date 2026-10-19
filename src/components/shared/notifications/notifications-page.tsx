import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Bell, CheckCheck, RotateCw, BellDot, List, AlarmClockOff } from "lucide-react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { ListToolbar } from "@/components/shared/admin/list-toolbar";
import { PageHeader } from "@/components/shared/admin/page-header";
import { PaginationBar } from "@/components/shared/admin/pagination-bar";
import { SectionCard } from "@/components/shared/admin/section-card";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { NotificationItem } from "@/components/shared/notifications/notification-item";
import { Button } from "@/components/shared/ui/button";
import { useListState } from "@/hooks/shared/use-list-state";
import { useNotificationActions } from "@/hooks/shared/use-notification-actions";
import { PAGE_SIZE } from "@/lib/shared/list-search";
import {
  NotificationFilter,
  listNotifications,
} from "@/lib/shared/notifications/notifications.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const tabs = [
  { value: NotificationFilter.All, label: "Todas", icon: List },
  { value: NotificationFilter.Unread, label: "Não lidas", icon: BellDot },
  { value: NotificationFilter.Snoozed, label: "Adiadas", icon: AlarmClockOff },
];

const isFilter = (value: string): value is NotificationFilter =>
  Object.values(NotificationFilter).some((filter) => filter === value);

export function NotificationsPage() {
  const list = useListState<string>(NotificationFilter.All);
  const actions = useNotificationActions();
  const filter = isFilter(list.status) ? list.status : NotificationFilter.All;
  const request = { filter, page: list.page };

  const query = useQuery({
    queryKey: QueryKey.Notifications.list(request),
    queryFn: async () => unwrapResult(await listNotifications({ data: request })),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Avisos"
        description="O que precisa da sua atenção."
        actions={
          <Button variant="outline" onClick={() => void actions.readAll()} disabled={actions.busy}>
            <CheckCheck aria-hidden="true" />
            Marcar todos como lidos
          </Button>
        }
      />
      <ListToolbar
        search=""
        onSearchChange={() => undefined}
        searchLabel="Buscar avisos"
        statusOptions={tabs}
        status={list.status}
        onStatusChange={list.setStatus}
        hideSearch
      />
      {query.isPending ? <ListSkeleton /> : null}
      {query.isError ? (
        <EmptyState
          icon={Bell}
          title="Não foi possível carregar os avisos"
          description={query.error.message}
          action={
            <Button onClick={() => void query.refetch()}>
              <RotateCw aria-hidden="true" />
              Tentar novamente
            </Button>
          }
        />
      ) : null}
      {query.data?.rows.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nada por aqui"
          description="Quando houver avisos, eles aparecem nesta lista."
        />
      ) : null}
      {query.data && query.data.rows.length > 0 ? (
        <SectionCard as="div" padding="none">
          <ul>
            {query.data.rows.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onOpen={(item) => void actions.open(item)}
                onRead={(item) => void actions.read(item)}
                onSnooze={(item) => void actions.snooze(item)}
              />
            ))}
          </ul>
        </SectionCard>
      ) : null}
      {query.data ? (
        <PaginationBar
          page={list.page}
          pageSize={PAGE_SIZE}
          total={query.data.total}
          onPageChange={list.setPage}
          disabled={query.isFetching}
        />
      ) : null}
    </div>
  );
}
