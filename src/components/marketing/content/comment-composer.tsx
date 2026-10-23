import { AnimatePresence, motion } from "motion/react";
import { Send, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FormActions } from "@/components/shared/admin/form-actions";
import { SelectField, TextAreaField } from "@/components/shared/admin/form-fields";
import { PersonAvatar } from "@/components/shared/admin/person-avatar";
import { Button } from "@/components/shared/ui/button";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { addComment } from "@/lib/marketing/content/comments.functions";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { CommentVisibility } from "@/lib/shared/enums";
import { QueryKey } from "@/lib/shared/query-keys";

const MAX_COMMENT = 4000;

const expand = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.22, ease: "easeOut" },
} as const;

export type ReplyTarget = { id: string; visibility: CommentVisibility };

export function CommentComposer({
  itemId,
  avatarUrl,
  reply,
  onClose,
}: {
  itemId: string;
  avatarUrl: string | undefined;
  reply?: ReplyTarget | undefined;
  onClose?: (() => void) | undefined;
}) {
  const auth = useAuth();
  const { run, busy } = useServerAction();
  const [open, setOpen] = useState(reply !== undefined);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<CommentVisibility>(CommentVisibility.Internal);
  const [error, setError] = useState<string | undefined>();

  const canInternal = can(auth, Action.Comments.CreateInternal);
  const canExternal = can(auth, Action.Comments.CreateExternal);
  const allowed =
    reply === undefined
      ? canInternal || canExternal
      : reply.visibility === CommentVisibility.Internal
        ? canInternal
        : canExternal;
  if (!allowed) return null;

  const close = () => {
    setOpen(false);
    setBody("");
    setError(undefined);
    onClose?.();
  };

  async function send() {
    if (busy) return;
    if (body.trim() === "") {
      setError("Escreva o comentário.");
      return;
    }
    setError(undefined);
    const result = await run(
      () =>
        addComment({
          data: {
            itemId,
            visibility: reply?.visibility ?? visibility,
            body,
            ...(reply === undefined ? {} : { parentId: reply.id }),
          },
        }),
      { invalidate: [QueryKey.Content.comments(itemId)] },
    );
    if (!result.ok) {
      setError(result.message);
      return;
    }
    close();
    toast.success(reply === undefined ? "Comentário enviado." : "Resposta enviada.");
  }

  const idSuffix = reply?.id ?? "new";
  const name = auth.profile?.name ?? "";
  return (
    <div className="flex gap-3">
      <PersonAvatar
        name={name}
        url={avatarUrl}
        size={reply === undefined ? "md" : "sm"}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <AnimatePresence initial={false} mode="wait">
          {open ? (
            <motion.div key="open" className="space-y-3 overflow-hidden p-0.5" {...expand}>
              <TextAreaField
                id={`comment-body-${idSuffix}`}
                label={reply === undefined ? "Novo comentário" : "Sua resposta"}
                value={body}
                onValueChange={setBody}
                maxLength={MAX_COMMENT}
                rows={reply === undefined ? 4 : 3}
                placeholder={reply === undefined ? "Escreva um comentário" : "Escreva uma resposta"}
                error={error}
                disabled={busy}
              />
              {reply === undefined && canInternal && canExternal ? (
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
              <FormActions>
                <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={close}>
                  <X aria-hidden="true" />
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  loading={busy}
                  disabled={busy}
                  onClick={() => void send()}
                >
                  <Send aria-hidden="true" />
                  {reply === undefined ? "Comentar" : "Responder"}
                </Button>
              </FormActions>
            </motion.div>
          ) : (
            <motion.button
              key="closed"
              type="button"
              onClick={() => setOpen(true)}
              className="min-h-10 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...expand}
            >
              Adicionar um comentário…
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
