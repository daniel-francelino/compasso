import { useQuery } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Pencil, Plus, Tags } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ContentTypeChip } from "@/components/shared/content/content-type-chip";
import { ContentTypeFields } from "@/components/shared/content/content-type-fields";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { FormError } from "@/components/shared/admin/auth-shell";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { IconButton } from "@/components/shared/admin/icon-button";
import { PageHeader } from "@/components/shared/admin/page-header";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { SectionCard } from "@/components/shared/admin/section-card";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { Button } from "@/components/shared/ui/button";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { useServerAction } from "@/hooks/shared/use-server-action";
import {
  type ContentTypeCatalogRow,
  archiveContentType,
  listContentTypeCatalog,
  saveContentType,
} from "@/lib/shared/content-types/content-types.functions";
import {
  type ContentTypeDraft,
  contentTypeInput,
  emptyContentTypeDraft,
} from "@/lib/shared/content-types/draft";
import { saveContentTypeSchema } from "@/lib/shared/content-types/schemas";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const invalidate = [QueryKey.Content.typeCatalog(), QueryKey.Content.types()];

function TypeDialog({
  editing,
  onClose,
}: {
  editing: ContentTypeDraft | null;
  onClose: () => void;
}) {
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [draft, setDraft] = useState<ContentTypeDraft>(editing ?? emptyContentTypeDraft);
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
            contentTypeInput(draft),
            (data) => run(() => saveContentType({ data }), { invalidate }),
            () => {
              toast.success("Tipo salvo.");
              onClose();
            },
          );
        },
      }}
    >
      <ContentTypeFields draft={draft} onChange={setDraft} errors={errors} />
      <FormError message={error} />
    </FormDialog>
  );
}

export function ContentTypesPage() {
  const { run, busy } = useServerAction();
  const [editing, setContentTypeDraft] = useState<ContentTypeDraft | null>(null);
  const query = useQuery({
    queryKey: QueryKey.Content.typeCatalog(),
    queryFn: async () => unwrapResult(await listContentTypeCatalog()).types,
  });

  const edit = (type: ContentTypeCatalogRow) =>
    setContentTypeDraft({
      id: type.id,
      name: type.name,
      color: type.color,
      emoji: type.emoji ?? "",
    });

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
          <Button onClick={() => setContentTypeDraft(emptyContentTypeDraft)}>
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
        <SectionCard as="div" padding="none">
          <ul className="divide-y divide-border">
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
        </SectionCard>
      ) : null}
      {editing === null ? null : (
        <TypeDialog
          key={editing.id ?? "new"}
          editing={editing}
          onClose={() => setContentTypeDraft(null)}
        />
      )}
    </div>
  );
}
