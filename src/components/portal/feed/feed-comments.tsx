import { useQuery } from "@tanstack/react-query";
import { Smile } from "lucide-react";
import type { RefObject } from "react";
import { toast } from "sonner";
import { PersonAvatar } from "@/components/shared/admin/person-avatar";
import { Skeleton } from "@/components/shared/ui/skeleton";
import { Textarea } from "@/components/shared/ui/textarea";
import type { DecisionDraft } from "@/hooks/portal/use-decision-draft";
import { useAvatarUrls } from "@/hooks/shared/use-avatar-urls";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { addPortalComment, listPortalComments } from "@/lib/portal/approvals/portal.functions";
import type { PortalRequest } from "@/lib/portal/approvals/types";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { ApprovalRequestStatus } from "@/lib/shared/enums";
import { formatDateTime, formatSocialTime } from "@/lib/shared/format";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { cn } from "@/lib/shared/utils";

type Entry = {
  id: string;
  authorId: string | null;
  author: string;
  body: string;
  createdAt: string;
  note: string | null;
};

const toggleLabel = (total: number, open: boolean): string => {
  if (open) return "Ocultar comentários";
  return total === 1 ? "Ver 1 comentário" : `Ver os ${total} comentários`;
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
            authorId: null,
            author: request.decidedByName ?? "Cliente",
            body: request.decisionComment,
            createdAt: request.decidedAt ?? request.requestedAt,
            note: "Alteração solicitada",
          },
        ]
      : [];
  const entries: Entry[] = [
    ...(comments.data ?? []).map((comment) => ({
      id: comment.id,
      authorId: comment.authorId,
      author: comment.authorName,
      body: comment.body,
      createdAt: comment.createdAt,
      note: null,
    })),
    ...decisionEntry,
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const avatars = useAvatarUrls(entries.map((entry) => entry.authorId));
  const total = request.commentCount + decisionEntry.length;
  const text = draft.text.trim();

  async function publish() {
    if (busy || text === "") return;
    const result = await run(
      () => addPortalComment({ data: { itemId: request.itemId, body: text } }),
      {
        invalidate: [QueryKey.Portal.all()],
      },
    );
    if (!result.ok) return;
    draft.clear();
    onOpenChange(true);
    toast.success("Comentário enviado.");
  }

  return (
    <div className="space-y-3 pt-1">
      {total > 0 || open ? (
        <button
          type="button"
          className="px-3 text-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
        >
          {toggleLabel(total, open)}
        </button>
      ) : null}
      {open && comments.isPending ? <Skeleton className="mx-3 h-12" /> : null}
      {open && comments.isError ? (
        <p role="alert" className="px-3 text-sm text-destructive">
          {comments.error.message}
        </p>
      ) : null}
      {open && entries.length > 0 ? (
        <ul className="space-y-3 px-3">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3">
              <PersonAvatar
                name={entry.author}
                url={entry.authorId ? avatars[entry.authorId] : undefined}
                size="md"
              />
              <div className="min-w-0 flex-1 text-sm">
                <p className="whitespace-pre-wrap break-words">
                  <span className="font-semibold text-foreground">{entry.author}</span> {entry.body}
                </p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <time dateTime={entry.createdAt} title={formatDateTime(entry.createdAt)}>
                    {formatSocialTime(entry.createdAt)}
                  </time>
                  {entry.note ? <span className="font-medium">{entry.note}</span> : null}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {canComment || canDecide ? (
        <div className="border-t border-border">
          <div className="flex items-center gap-2 px-3">
            <Smile className="size-6 shrink-0 text-foreground" aria-hidden="true" />
            <Textarea
              ref={fieldRef}
              rows={1}
              maxLength={4000}
              className="min-h-11 flex-1 resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 pointer-coarse:min-h-11"
              placeholder="Adicione um comentário…"
              aria-label="Comentário ou orientação da alteração"
              aria-invalid={hint !== undefined}
              value={draft.text}
              disabled={busy}
              onChange={(event) => onTextChange(event.target.value)}
            />
            {canComment ? (
              <button
                type="button"
                className={cn(
                  "min-h-11 shrink-0 px-1 text-sm font-semibold text-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  (busy || text === "") && "opacity-50",
                )}
                disabled={busy || text === ""}
                onClick={() => void publish()}
              >
                Publicar
              </button>
            ) : null}
          </div>
          {hint ? (
            <p role="alert" className="px-3 pb-2 text-xs text-destructive">
              {hint}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
