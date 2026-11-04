import { useQuery } from "@tanstack/react-query";
import type { RefObject } from "react";
import { toast } from "sonner";
import { Button } from "@/components/shared/ui/button";
import { Skeleton } from "@/components/shared/ui/skeleton";
import { Textarea } from "@/components/shared/ui/textarea";
import type { DecisionDraft } from "@/hooks/portal/use-decision-draft";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { addPortalComment, listPortalComments } from "@/lib/portal/approvals/portal.functions";
import type { PortalRequest } from "@/lib/portal/approvals/types";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { ApprovalRequestStatus } from "@/lib/shared/enums";
import { formatDateTime } from "@/lib/shared/format";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

type Entry = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  label: string | null;
};

export function FeedComments({
  request,
  open,
  onOpenChange,
  draft,
  fieldRef,
  hint,
  onTextChange,
}: {
  request: PortalRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: DecisionDraft;
  fieldRef: RefObject<HTMLTextAreaElement | null>;
  hint: string | undefined;
  onTextChange: (value: string) => void;
}) {
  const auth = useAuth();
  const { run, busy } = useServerAction();
  const canComment = can(auth, Action.Comments.CreateExternal);
  const canDecide = request.status === ApprovalRequestStatus.Pending && request.canDecide;
  const comments = useQuery({
    queryKey: QueryKey.Portal.comments(request.itemId),
    queryFn: async () =>
      unwrapResult(await listPortalComments({ data: { itemId: request.itemId } })).comments,
    enabled: open,
  });

  const decisionEntry: Entry[] =
    request.status === ApprovalRequestStatus.ChangesRequested && request.decisionComment
      ? [
          {
            id: `decision-${request.id}`,
            author: request.decidedByName ?? "Cliente",
            body: request.decisionComment,
            createdAt: request.decidedAt ?? request.requestedAt,
            label: "Alteração solicitada",
          },
        ]
      : [];
  const entries: Entry[] = [
    ...(comments.data ?? []).map((comment) => ({
      id: comment.id,
      author: comment.mine ? "Você" : comment.authorName,
      body: comment.body,
      createdAt: comment.createdAt,
      label: comment.fromTeam ? "Equipe" : null,
    })),
    ...decisionEntry,
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const total = request.commentCount + decisionEntry.length;

  async function publish() {
    const body = draft.text.trim();
    if (busy || body === "") return;
    const result = await run(() => addPortalComment({ data: { itemId: request.itemId, body } }), {
      invalidate: [QueryKey.Portal.all()],
    });
    if (!result.ok) return;
    draft.clear();
    onOpenChange(true);
    toast.success("Comentário enviado.");
  }

  return (
    <div className="space-y-2 px-3 pb-3">
      {total > 0 || open ? (
        <button
          type="button"
          className="text-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
        >
          {open ? "Ocultar comentários" : `Ver os ${total} comentários`}
        </button>
      ) : null}
      {open && comments.isPending ? <Skeleton className="h-12 w-full" /> : null}
      {open && comments.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {comments.error.message}
        </p>
      ) : null}
      {open && entries.length > 0 ? (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="text-sm">
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{entry.author}</span>
                <span>{formatDateTime(entry.createdAt)}</span>
                {entry.label ? <span className="font-medium">{entry.label}</span> : null}
              </p>
              <p className="whitespace-pre-wrap break-words">{entry.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {canComment || canDecide ? (
        <div className="space-y-1">
          <div className="flex items-end gap-2">
            <Textarea
              ref={fieldRef}
              rows={1}
              maxLength={4000}
              className="min-h-11 flex-1 resize-none"
              placeholder="Adicione um comentário…"
              aria-label="Comentário ou orientação da alteração"
              aria-invalid={hint !== undefined}
              value={draft.text}
              disabled={busy}
              onChange={(event) => onTextChange(event.target.value)}
            />
            {canComment ? (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 text-violet"
                loading={busy}
                disabled={busy || draft.text.trim() === ""}
                onClick={() => void publish()}
              >
                Publicar
              </Button>
            ) : null}
          </div>
          {hint ? (
            <p role="alert" className="text-xs text-destructive">
              {hint}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
