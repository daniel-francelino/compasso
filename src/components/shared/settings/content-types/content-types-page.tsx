import { useQuery } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Pencil, Plus, Tags } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ContentTypeChip } from "@/components/shared/content/content-type-chip";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { FormError } from "@/components/shared/admin/auth-shell";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { TextField } from "@/components/shared/admin/form-fields";
import { IconButton } from "@/components/shared/admin/icon-button";
import { PageHeader } from "@/components/shared/admin/page-header";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { Button } from "@/components/shared/ui/button";
import { Label } from "@/components/shared/ui/label";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { useServerAction } from "@/hooks/shared/use-server-action";
import {
  type ContentTypeCatalogRow,
  archiveContentType,
  listContentTypeCatalog,
  saveContentType,
} from "@/lib/shared/content-types/content-types.functions";
import {
  CONTENT_TYPE_EMOJI_MAX,
  CONTENT_TYPE_NAME_MAX,
  saveContentTypeSchema,
} from "@/lib/shared/content-types/schemas";
import { ContentTypeColor } from "@/lib/shared/enums";
import { contentTypeColorLabels } from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { cn } from "@/lib/shared/utils";

type Editing = { id: string | undefined; name: string; color: ContentTypeColor; emoji: string };

const emptyEditing: Editing = {
  id: undefined,
  name: "",
  color: ContentTypeColor.Violet,
  emoji: "",
};

const invalidate = [QueryKey.Content.typeCatalog(), QueryKey.Content.types()];

function TypeDialog({ editing, onClose }: { editing: Editing | null; onClose: () => void }) {
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [draft, setDraft] = useState<Editing>(editing ?? emptyEditing);
  const { run } = useServerAction();

  return (
    <FormDialog
      open={editing !== null}
      onOpenChange={(open) => !open && onClose()}
      title={editing?.id === undefined ? "Novo tipo de conteúdo" : "Editar tipo de conteúdo"}
      icon={Tags}
      busy={busy}
      submitLabel="Salvar"
      form={{
        ref: formRef,
        noValidate: true,
        onSubmit: (event) => {
          event.preventDefault();
          void submit(
            saveContentTypeSchema,
            {
              ...(draft.id === undefined ? {} : { id: draft.id }),
              name: draft.name,
              color: draft.color,
              emoji: draft.emoji,
            },
            (data) => run(() => saveContentType({ data }), { invalidate }),
            () => {
              toast.success("Tipo salvo.");
              onClose();
            },
          );
        },
      }}
    >
      <TextField
        id="content-type-name"
        label="Nome"
        required
        value={draft.name}
        maxLength={CONTENT_TYPE_NAME_MAX}
        onValueChange={(name) => setDraft({ ...draft, name })}
        error={errors["name"]}
      />
      <TextField
        id="content-type-emoji"
        label="Emoji"
        value={draft.emoji}
        maxLength={CONTENT_TYPE_EMOJI_MAX}
        placeholder="Opcional"
        hint="Aparece antes do nome. Deixe em branco para usar só a cor."
        onValueChange={(emoji) => setDraft({ ...draft, emoji })}
        error={errors["emoji"]}
      />
      <fieldset className="space-y-1.5">
        <Label asChild>
          <legend>Cor</legend>
        </Label>
        <div className="flex flex-wrap gap-2">
          {Object.values(ContentTypeColor).map((color) => (
            <button
              key={color}
              type="button"
              aria-pressed={draft.color === color}
              aria-label={contentTypeColorLabels[color]}
              onClick={() => setDraft({ ...draft, color })}
              className={cn(
                "cursor-pointer rounded-md p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                draft.color === color && "ring-2 ring-primary",
              )}
            >
              <ContentTypeChip
                type={{ name: contentTypeColorLabels[color], color, emoji: null }}
                className="min-h-8"
              />
            </button>
          ))}
        </div>
        {errors["color"] ? <p className="text-xs text-destructive">{errors["color"]}</p> : null}
      </fieldset>
      <FormError message={error} />
    </FormDialog>
  );
}

export function ContentTypesPage() {
  const { run, busy } = useServerAction();
  const [editing, setEditing] = useState<Editing | null>(null);
  const query = useQuery({
    queryKey: QueryKey.Content.typeCatalog(),
    queryFn: async () => unwrapResult(await listContentTypeCatalog()).types,
  });

  const edit = (type: ContentTypeCatalogRow) =>
    setEditing({ id: type.id, name: type.name, color: type.color, emoji: type.emoji ?? "" });

  const toggleArchived = (type: ContentTypeCatalogRow) =>
    run(() => archiveContentType({ data: { id: type.id, archived: !type.archived } }), {
      invalidate,
      success: type.archived ? "Tipo reativado." : "Tipo arquivado.",
    });

  const types = query.data ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        title="Tipos de conteúdo"
        description="Os tipos que a equipe escolhe em cada conteúdo, como Atmosfera, Produto ou CTA."
        breadcrumbs={[{ label: "Configurações", to: "/admin/settings" }, { label: "Tipos" }]}
        actions={
          <Button onClick={() => setEditing(emptyEditing)}>
            <Plus aria-hidden="true" />
            Novo tipo
          </Button>
        }
      />
      {query.isPending ? <ListSkeleton rows={4} height="h-14" /> : null}
      {query.isError ? (
        <EmptyState
          title="Não foi possível carregar os tipos"
          description={query.error.message}
          action={
            <Button variant="outline" onClick={() => void query.refetch()}>
              Tentar de novo
            </Button>
          }
        />
      ) : null}
      {query.isSuccess && types.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Nenhum tipo ainda"
          description="Crie o primeiro tipo para classificar os conteúdos."
        />
      ) : null}
      {types.length > 0 ? (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {types.map((type) => (
            <li
              key={type.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <ContentTypeChip type={type} />
                {type.archived ? (
                  <StatusBadge tone="neutral" icon={Archive}>
                    Arquivado
                  </StatusBadge>
                ) : null}
                <span className="text-sm text-muted-foreground">
                  {type.contentCount === 1 ? "1 conteúdo" : `${type.contentCount} conteúdos`}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <IconButton
                  label={`Editar ${type.name}`}
                  icon={Pencil}
                  onClick={() => edit(type)}
                />
                <IconButton
                  label={`${type.archived ? "Reativar" : "Arquivar"} ${type.name}`}
                  icon={type.archived ? ArchiveRestore : Archive}
                  disabled={busy}
                  onClick={() => void toggleArchived(type)}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {editing === null ? null : (
        <TypeDialog key={editing.id ?? "new"} editing={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
