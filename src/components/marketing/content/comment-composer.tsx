import { Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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

export function CommentComposer({
  itemId,
  avatarUrl,
}: {
  itemId: string;
  avatarUrl: string | undefined;
}) {
  const auth = useAuth();
  const { run, busy } = useServerAction();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<CommentVisibility>(CommentVisibility.Internal);
  const [error, setError] = useState<string | undefined>();

  const canInternal = can(auth, Action.Comments.CreateInternal);
  const canExternal = can(auth, Action.Comments.CreateExternal);
  if (!canInternal && !canExternal) return null;

  const close = () => {
    setOpen(false);
    setBody("");
    setError(undefined);
  };

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
    if (!result.ok) {
      setError(result.message);
      return;
    }
    close();
    toast.success("Comentário enviado.");
  }

  const name = auth.profile?.name ?? "";
  return (
    <div className="flex gap-3">
      <PersonAvatar name={name} url={avatarUrl} size="md" className="mt-0.5" />
      {open ? (
        <div className="min-w-0 flex-1 space-y-3">
          <TextAreaField
            id="comment-body"
            label="Novo comentário"
            value={body}
            onValueChange={setBody}
            maxLength={MAX_COMMENT}
            rows={4}
            placeholder="Escreva um comentário"
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
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              loading={busy}
              disabled={busy}
              onClick={() => void send()}
            >
              <Send aria-hidden="true" />
              Comentar
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={close}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-10 flex-1 cursor-pointer rounded-md border border-input bg-background px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Adicionar um comentário…
        </button>
      )}
    </div>
  );
}
