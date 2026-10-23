import { AnimatePresence, motion } from "motion/react";
import { MessageSquare } from "lucide-react";
import { useState } from "react";
import { CommentComposer } from "@/components/marketing/content/comment-composer";
import { CommentEntry } from "@/components/marketing/content/comment-entry";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { Skeleton } from "@/components/shared/ui/skeleton";
import { useContentComments } from "@/hooks/marketing/use-content-comments";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { deleteComment } from "@/lib/marketing/content/comments.functions";
import type { CommentRow } from "@/lib/marketing/content/types";
import { QueryKey } from "@/lib/shared/query-keys";

const growth = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
} as const;

const byDate = (a: CommentRow, b: CommentRow): number => a.createdAt.localeCompare(b.createdAt);

export function CommentsPanel({
  itemId,
  avatars,
  ownAvatarUrl,
}: {
  itemId: string;
  avatars: Record<string, string>;
  ownAvatarUrl: string | undefined;
}) {
  const { run, busy } = useServerAction();
  const [removing, setRemoving] = useState<CommentRow | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const query = useContentComments(itemId);
  const all = query.data ?? [];
  const roots = all
    .filter((comment) => comment.parentId === null)
    .sort(byDate)
    .reverse();
  const repliesOf = (rootId: string): CommentRow[] =>
    all.filter((comment) => comment.parentId === rootId).sort(byDate);

  return (
    <div className="space-y-5">
      <CommentComposer itemId={itemId} avatarUrl={ownAvatarUrl} />
      {query.isPending ? <Skeleton className="h-16 w-full" /> : null}
      {query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
        </p>
      ) : null}
      {query.data && roots.length === 0 ? (
        <EmptyState
          compact
          icon={MessageSquare}
          title="Nenhum comentário"
          description="Seja a primeira pessoa a comentar."
        />
      ) : null}
      <ul className="space-y-5">
        <AnimatePresence initial={false}>
          {roots.map((root) => {
            const replies = repliesOf(root.id);
            return (
              <motion.li key={root.id} layout="position" className="space-y-3" {...growth}>
                <ul>
                  <CommentEntry
                    comment={root}
                    itemId={itemId}
                    avatarUrl={avatars[root.authorId]}
                    canReply={!root.deleted && replyingTo !== root.id}
                    onReply={() => setReplyingTo(root.id)}
                    onDelete={() => setRemoving(root)}
                  />
                </ul>
                {replies.length > 0 || replyingTo === root.id ? (
                  <div className="ml-4 space-y-4 border-l-2 border-border pl-4">
                    <ul className="space-y-4">
                      <AnimatePresence initial={false}>
                        {replies.map((reply) => (
                          <CommentEntry
                            key={reply.id}
                            comment={reply}
                            itemId={itemId}
                            avatarUrl={avatars[reply.authorId]}
                            size="sm"
                            canReply={false}
                            onReply={() => undefined}
                            onDelete={() => setRemoving(reply)}
                          />
                        ))}
                      </AnimatePresence>
                    </ul>
                    <AnimatePresence initial={false}>
                      {replyingTo === root.id ? (
                        <motion.div key="reply" className="overflow-hidden" {...growth}>
                          <CommentComposer
                            itemId={itemId}
                            avatarUrl={ownAvatarUrl}
                            reply={{ id: root.id, visibility: root.visibility }}
                            onClose={() => setReplyingTo(null)}
                          />
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                ) : null}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
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
