import { Globe, MessageSquare, Trash2 } from "lucide-react";
import { useState } from "react";
import { ActivityEntry } from "@/components/marketing/content/activity-entry";
import { CommentComposer } from "@/components/marketing/content/comment-composer";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { Button } from "@/components/shared/ui/button";
import { Skeleton } from "@/components/shared/ui/skeleton";
import { useContentComments } from "@/hooks/marketing/use-content-comments";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { deleteComment } from "@/lib/marketing/content/comments.functions";
import type { CommentRow } from "@/lib/marketing/content/types";
import { CommentVisibility } from "@/lib/shared/enums";
import { formatDateTime } from "@/lib/shared/format";
import { commentVisibilityLabels } from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";

export function CommentsPanel({
  itemId,
  newestFirst,
  avatars,
  ownAvatarUrl,
}: {
  itemId: string;
  newestFirst: boolean;
  avatars: Record<string, string>;
  ownAvatarUrl: string | undefined;
}) {
  const { run, busy } = useServerAction();
  const [removing, setRemoving] = useState<CommentRow | null>(null);
  const query = useContentComments(itemId);
  const ordered = query.data ?? [];
  const comments = newestFirst ? [...ordered].reverse() : ordered;

  return (
    <div className="space-y-5">
      <CommentComposer itemId={itemId} avatarUrl={ownAvatarUrl} />
      {query.isPending ? <Skeleton className="h-16 w-full" /> : null}
      {query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
        </p>
      ) : null}
      {query.data && query.data.length === 0 ? (
        <EmptyState
          compact
          icon={MessageSquare}
          title="Nenhum comentário"
          description="Seja a primeira pessoa a comentar."
        />
      ) : null}
      {comments.length > 0 ? (
        <ul className="space-y-5">
          {comments.map((comment) => (
            <ActivityEntry
              key={comment.id}
              name={comment.authorName}
              avatarUrl={avatars[comment.authorId]}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="text-sm font-medium text-foreground">{comment.authorName}</span>
                <span>{formatDateTime(comment.createdAt)}</span>
                {comment.revisionNo !== null ? <span>Versão {comment.revisionNo}</span> : null}
                {comment.visibility === CommentVisibility.External ? (
                  <StatusBadge tone="info" icon={Globe}>
                    {commentVisibilityLabels[comment.visibility]}
                  </StatusBadge>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm">{comment.body}</p>
              {comment.mine ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-auto px-2 py-1 text-xs text-muted-foreground"
                  onClick={() => setRemoving(comment)}
                  aria-label="Excluir este comentário"
                >
                  <Trash2 aria-hidden="true" />
                  Excluir
                </Button>
              ) : null}
            </ActivityEntry>
          ))}
        </ul>
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(next) => !next && setRemoving(null)}
        title="Excluir comentário?"
        description="O comentário deixa de aparecer. A exclusão fica registrada na auditoria."
        confirmLabel="Excluir"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (removing === null) return true;
          const result = await run(() => deleteComment({ data: { id: removing.id, itemId } }), {
            invalidate: [QueryKey.Content.comments(itemId)],
            success: "Comentário excluído.",
          });
          return result.ok;
        }}
      />
    </div>
  );
}
