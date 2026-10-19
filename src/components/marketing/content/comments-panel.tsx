import { EmptyState } from "@/components/shared/admin/empty-state";
import { useQuery } from "@tanstack/react-query";
import { Globe, MessageSquare, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { SelectField, TextAreaField } from "@/components/shared/admin/form-fields";
import { SectionCard } from "@/components/shared/admin/section-card";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { Button } from "@/components/shared/ui/button";
import { Skeleton } from "@/components/shared/ui/skeleton";
import { useServerAction } from "@/hooks/shared/use-server-action";
import {
  addComment,
  deleteComment,
  listComments,
} from "@/lib/marketing/content/comments.functions";
import type { CommentRow } from "@/lib/marketing/content/types";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { CommentVisibility } from "@/lib/shared/enums";
import { formatDateTime } from "@/lib/shared/format";
import { commentVisibilityLabels } from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

function CommentItem({ comment, onDelete }: { comment: CommentRow; onDelete: () => void }) {
  return (
    <li className="space-y-1 rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{comment.authorName}</span>
        <span>{formatDateTime(comment.createdAt)}</span>
        {comment.revisionNo !== null ? <span>Versão {comment.revisionNo}</span> : null}
        {comment.visibility === CommentVisibility.External ? (
          <StatusBadge tone="info" icon={Globe}>
            {commentVisibilityLabels[comment.visibility]}
          </StatusBadge>
        ) : null}
        {comment.mine ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={onDelete}
            aria-label="Excluir este comentário"
          >
            <Trash2 aria-hidden="true" />
            Excluir
          </Button>
        ) : null}
      </div>
      <p className="whitespace-pre-wrap break-words text-sm">{comment.body}</p>
    </li>
  );
}

export function CommentsPanel({ itemId }: { itemId: string }) {
  const auth = useAuth();
  const { run, busy } = useServerAction();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<CommentVisibility>(CommentVisibility.Internal);
  const [error, setError] = useState<string | undefined>();
  const [removing, setRemoving] = useState<CommentRow | null>(null);

  const canInternal = can(auth, Action.Comments.CreateInternal);
  const canExternal = can(auth, Action.Comments.CreateExternal);
  const query = useQuery({
    queryKey: QueryKey.Content.comments(itemId),
    queryFn: async () => unwrapResult(await listComments({ data: { itemId } })).comments,
  });

  async function send() {
    if (busy) return;
    if (body.trim() === "") {
      setError("Escreva o comentário.");
      return;
    }
    setError(undefined);
    const result = await run(() => addComment({ data: { itemId, visibility, body } }), {
      invalidate: [QueryKey.Content.comments(itemId)],
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
      {query.data && query.data.length === 0 ? (
        <EmptyState
          compact
          icon={MessageSquare}
          title="Nenhum comentário"
          description="Seja a primeira pessoa a comentar."
        />
      ) : null}
      {query.data && query.data.length > 0 ? (
        <ul className="space-y-2">
          {query.data.map((comment) => (
            <CommentItem key={comment.id} comment={comment} onDelete={() => setRemoving(comment)} />
          ))}
        </ul>
      ) : null}
      {canInternal || canExternal ? (
        <div className="space-y-3">
          <TextAreaField
            id="comment-body"
            label="Novo comentário"
            value={body}
            onValueChange={setBody}
            maxLength={4000}
            rows={3}
            error={error}
            disabled={busy}
          />
          {canInternal && canExternal ? (
            <SelectField
              id="comment-visibility"
              label="Quem vê"
              value={visibility}
              onValueChange={(value) =>
                setVisibility(
                  value === CommentVisibility.External
                    ? CommentVisibility.External
                    : CommentVisibility.Internal,
                )
              }
              options={Object.values(CommentVisibility).map((value) => ({
                value,
                label:
                  value === CommentVisibility.Internal
                    ? "Interno (só a equipe)"
                    : "Externo (o cliente também vê)",
              }))}
            />
          ) : null}
          <Button type="button" loading={busy} disabled={busy} onClick={() => void send()}>
            <Send aria-hidden="true" />
            Comentar
          </Button>
        </div>
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
    </SectionCard>
  );
}
