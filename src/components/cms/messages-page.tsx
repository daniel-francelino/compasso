import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Check, Save, RotateCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { TextAreaField } from "@/components/shared/admin/form-fields";
import { PageHeader } from "@/components/shared/admin/page-header";
import { PaginationBar } from "@/components/shared/admin/pagination-bar";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { Button } from "@/components/shared/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/shared/ui/tabs";
import { type MessageRow, listMessages, updateMessage } from "@/lib/cms/content.functions";
import { ContactMessageStatus } from "@/lib/shared/enums";
import { formatDateTime } from "@/lib/shared/format";
import { contactMessageStatusLabels } from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const ALL = "all";
const PAGE_SIZE = 20;

function MessageCard({ message }: { message: MessageRow }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState(message.note ?? "");
  const [busy, setBusy] = useState(false);

  async function set(status: ContactMessageStatus) {
    if (busy) return;
    setBusy(true);
    const result = await updateMessage({ data: { id: message.id, status, note } });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Mensagem atualizada.");
    await queryClient.invalidateQueries({ queryKey: QueryKey.Site.all() });
  }

  return (
    <li className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{message.name}</p>
          <p className="text-sm text-muted-foreground">
            {[message.email, message.phone].filter(Boolean).join(" · ")} ·{" "}
            {formatDateTime(message.createdAt)}
            {message.sourceSlug ? ` · pela página /${message.sourceSlug}` : ""}
          </p>
        </div>
        <StatusBadge
          tone={message.status === ContactMessageStatus.New ? "warning" : "neutral"}
          icon={Mail}
        >
          {contactMessageStatusLabels[message.status]}
        </StatusBadge>
      </div>
      <p className="whitespace-pre-wrap text-sm">{message.message}</p>
      <TextAreaField
        id={`note-${message.id}`}
        label="Nota interna"
        value={note}
        onValueChange={setNote}
        maxLength={1000}
        rows={2}
      />
      <div className="flex flex-wrap gap-2">
        {Object.values(ContactMessageStatus)
          .filter((status) => status !== message.status)
          .map((status) => (
            <Button
              key={status}
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void set(status)}
            >
              <Check aria-hidden="true" />
              Marcar como {contactMessageStatusLabels[status].toLowerCase()}
            </Button>
          ))}
        {note !== (message.note ?? "") ? (
          <Button type="button" size="sm" disabled={busy} onClick={() => void set(message.status)}>
            <Save aria-hidden="true" />
            Salvar nota
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function MessagesPage() {
  const [status, setStatus] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const filters = { status: status === ALL ? undefined : (status as ContactMessageStatus), page };
  const messages = useQuery({
    queryKey: QueryKey.Site.messages(filters),
    queryFn: async () => unwrapResult(await listMessages({ data: filters })),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mensagens"
        description="O que visitantes enviaram pelo formulário de contato."
        breadcrumbs={[{ label: "Mensagens" }]}
      />
      <Tabs
        value={status}
        onValueChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
      >
        <TabsList>
          <TabsTrigger value={ALL}>Todas</TabsTrigger>
          {Object.values(ContactMessageStatus).map((value) => (
            <TabsTrigger key={value} value={value}>
              {contactMessageStatusLabels[value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {messages.isPending ? <ListSkeleton rows={3} height="h-28" /> : null}
      {messages.isError ? (
        <div className="space-y-3">
          <p className="text-sm text-danger">{messages.error.message}</p>
          <Button type="button" variant="outline" onClick={() => void messages.refetch()}>
            <RotateCw aria-hidden="true" />
            Tentar novamente
          </Button>
        </div>
      ) : null}
      {messages.data && messages.data.rows.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Nenhuma mensagem"
          description="Quando alguém escrever pelo site, aparece aqui."
        />
      ) : null}
      {messages.data && messages.data.rows.length > 0 ? (
        <>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {messages.data.rows.map((message) => (
              <MessageCard key={`${message.id}-${message.status}`} message={message} />
            ))}
          </ul>
          <PaginationBar
            page={page}
            pageSize={PAGE_SIZE}
            total={messages.data.total}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </div>
  );
}
