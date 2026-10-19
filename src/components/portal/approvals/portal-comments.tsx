import { EmptyState } from "@/components/shared/admin/empty-state";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TextAreaField } from "@/components/shared/admin/form-fields";
import { SectionCard } from "@/components/shared/admin/section-card";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { Button } from "@/components/shared/ui/button";
import { Skeleton } from "@/components/shared/ui/skeleton";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { addPortalComment, listPortalComments } from "@/lib/portal/approvals/portal.functions";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { formatDateTime } from "@/lib/shared/format";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

export function PortalComments({ itemId }: { itemId: string }) {
  const auth = useAuth();
  const { run, busy } = useServerAction();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | undefined>();
  const query = useQuery({
    queryKey: QueryKey.Portal.comments(itemId),
    queryFn: async () => unwrapResult(await listPortalComments({ data: { itemId } })).comments,
  });

  async function send() {
    if (busy) return;
    if (body.trim() === "") {
      setError("Escreva o comentário.");
      return;
    }
    setError(undefined);
    const result = await run(() => addPortalComment({ data: { itemId, body } }), {
      invalidate: [QueryKey.Portal.comments(itemId)],
    });
    if (result.ok) {
      setBody("");
      toast.success("Comentário enviado.");
      return;
    }
    setError(result.message);
  }

  return (
    <SectionCard title="Comentários" icon={MessageSquare}>
      {query.isPending ? <Skeleton className="h-16 w-full" /> : null}
      {query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
        </p>
      ) : null}
      {query.data?.length === 0 ? (
        <EmptyState
          compact
          icon={MessageSquare}
          title="Nenhum comentário"
          description="Escreva abaixo se quiser comentar."
        />
      ) : null}
      {query.data && query.data.length > 0 ? (
        <ul className="space-y-2">
          {query.data.map((comment) => (
            <li key={comment.id} className="space-y-1 rounded-xl border border-border p-3">
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {comment.mine ? "Você" : comment.authorName}
                </span>
                <span>{formatDateTime(comment.createdAt)}</span>
                {comment.fromTeam ? (
                  <StatusBadge tone="info" icon={MessageSquare}>
                    Equipe
                  </StatusBadge>
                ) : null}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm">{comment.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {can(auth, Action.Comments.CreateExternal) ? (
        <div className="space-y-3">
          <TextAreaField
            id="portal-comment"
            label="Escrever um comentário"
            value={body}
            onValueChange={setBody}
            maxLength={4000}
            rows={3}
            error={error}
            disabled={busy}
          />
          <Button type="button" loading={busy} disabled={busy} onClick={() => void send()}>
            <Send aria-hidden="true" />
            Comentar
          </Button>
        </div>
      ) : null}
    </SectionCard>
  );
}
