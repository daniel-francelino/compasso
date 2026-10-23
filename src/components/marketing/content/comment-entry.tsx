import { AnimatePresence, motion } from "motion/react";
import { Check, Globe, MessageSquareReply, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ActivityEntry } from "@/components/marketing/content/activity-entry";
import { FormActions } from "@/components/shared/admin/form-actions";
import { TextAreaField } from "@/components/shared/admin/form-fields";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { Button } from "@/components/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/shared/ui/dropdown-menu";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { editComment } from "@/lib/marketing/content/comments.functions";
import type { CommentRow } from "@/lib/marketing/content/types";
import { CommentVisibility } from "@/lib/shared/enums";
import { formatDateTime } from "@/lib/shared/format";
import { commentVisibilityLabels } from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";

const MAX_COMMENT = 4000;

const swap = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15 },
};

function EditForm({
  comment,
  itemId,
  onDone,
}: {
  comment: CommentRow;
  itemId: string;
  onDone: () => void;
}) {
  const { run, busy } = useServerAction();
  const [body, setBody] = useState(comment.body);
  const [error, setError] = useState<string | undefined>();

  async function save() {
    if (busy) return;
    if (body.trim() === "") {
      setError("Escreva o comentário.");
      return;
    }
    const result = await run(() => editComment({ data: { id: comment.id, itemId, body } }), {
      invalidate: [QueryKey.Content.comments(itemId)],
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    toast.success("Comentário atualizado.");
    onDone();
  }

  return (
    <motion.div key="edit" className="space-y-3 p-0.5" {...swap}>
      <TextAreaField
        id={`comment-edit-${comment.id}`}
        label="Editar comentário"
        value={body}
        onValueChange={setBody}
        maxLength={MAX_COMMENT}
        rows={3}
        error={error}
        disabled={busy}
      />
      <FormActions>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onDone}>
          <X aria-hidden="true" />
          Cancelar
        </Button>
        <Button type="button" size="sm" loading={busy} disabled={busy} onClick={() => void save()}>
          <Check aria-hidden="true" />
          Salvar
        </Button>
      </FormActions>
    </motion.div>
  );
}

export function CommentEntry({
  comment,
  itemId,
  avatarUrl,
  size = "md",
  canReply,
  onReply,
  onDelete,
}: {
  comment: CommentRow;
  itemId: string;
  avatarUrl: string | undefined;
  size?: "md" | "sm";
  canReply: boolean;
  onReply: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (comment.deleted) {
    return (
      <ActivityEntry name={comment.authorName} avatarUrl={avatarUrl} size={size}>
        <p className="text-sm italic text-muted-foreground">Comentário removido</p>
      </ActivityEntry>
    );
  }

  return (
    <ActivityEntry name={comment.authorName} avatarUrl={avatarUrl} size={size}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="text-sm font-medium text-foreground">{comment.authorName}</span>
        <span>{formatDateTime(comment.createdAt)}</span>
        {comment.editedAt !== null ? <span>· editado</span> : null}
        {comment.revisionNo !== null ? <span>Versão {comment.revisionNo}</span> : null}
        {comment.visibility === CommentVisibility.External ? (
          <StatusBadge tone="info" icon={Globe}>
            {commentVisibilityLabels[comment.visibility]}
          </StatusBadge>
        ) : null}
        {comment.mine && !editing ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto size-7"
                aria-label="Ações do comentário"
              >
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={onDelete}
              >
                <Trash2 aria-hidden="true" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <AnimatePresence initial={false} mode="wait">
        {editing ? (
          <EditForm key="edit" comment={comment} itemId={itemId} onDone={() => setEditing(false)} />
        ) : (
          <motion.p key="text" className="whitespace-pre-wrap wrap-break-word text-sm" {...swap}>
            {comment.body}
          </motion.p>
        )}
      </AnimatePresence>
      {canReply && !editing ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 h-auto px-2 py-1 text-xs text-muted-foreground"
          onClick={onReply}
        >
          <MessageSquareReply aria-hidden="true" />
          Responder
        </Button>
      ) : null}
    </ActivityEntry>
  );
}
