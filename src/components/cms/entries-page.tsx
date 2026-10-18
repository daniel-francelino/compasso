import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ImageField } from "@/components/cms/fields/image-field";
import { LinkField } from "@/components/cms/fields/link-field";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { NumberField, TextAreaField, TextField } from "@/components/shared/admin/form-fields";
import { IconButton } from "@/components/shared/admin/icon-button";
import { PageHeader } from "@/components/shared/admin/page-header";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { Button } from "@/components/shared/ui/button";
import { Checkbox } from "@/components/shared/ui/checkbox";
import { Label } from "@/components/shared/ui/label";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import {
  type EntryRowData,
  deleteEntry,
  listEntries,
  saveEntry,
} from "@/lib/cms/content.functions";
import { listPageOptions } from "@/lib/cms/pages.functions";
import { saveEntrySchema } from "@/lib/cms/schemas";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { toJson } from "@/lib/shared/content/published";
import { serviceEntrySchema, testimonialEntrySchema } from "@/lib/shared/content/schemas";
import { SiteEntryKind } from "@/lib/shared/enums";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const titles: Record<SiteEntryKind, { page: string; one: string; empty: string }> = {
  [SiteEntryKind.Service]: {
    page: "Serviços",
    one: "serviço",
    empty: "Cadastre os serviços que aparecem nas seções de serviços.",
  },
  [SiteEntryKind.Testimonial]: {
    page: "Depoimentos",
    one: "depoimento",
    empty: "Cadastre as frases de clientes que aparecem nas seções de depoimentos.",
  },
};

const summaryOf = (entry: EntryRowData): string => {
  const content = entry.content;
  if (typeof content !== "object" || content === null || Array.isArray(content)) return "";
  const text = entry.kind === SiteEntryKind.Service ? content["name"] : content["author"];
  return typeof text === "string" ? text : "";
};

function EntryDialog({
  kind,
  entry,
  nextOrder,
  onOpenChange,
}: {
  kind: SiteEntryKind;
  entry: EntryRowData | null;
  nextOrder: number;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const pages = useQuery({
    queryKey: QueryKey.Site.pageOptions(),
    queryFn: async () => unwrapResult(await listPageOptions()).pages,
  });
  const schema = kind === SiteEntryKind.Service ? serviceEntrySchema : testimonialEntrySchema;
  const [content, setContent] = useState<Record<string, unknown>>(
    schema.parse(entry?.content ?? {}),
  );
  const [order, setOrder] = useState(String(entry?.sortOrder ?? nextOrder));
  const [visible, setVisible] = useState(entry?.visible ?? true);
  const service = serviceEntrySchema.safeParse(content);
  const testimonial = testimonialEntrySchema.safeParse(content);
  const set = (patch: Record<string, unknown>) => setContent({ ...content, ...patch });

  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      icon={Pencil}
      title={entry ? `Editar ${titles[kind].one}` : `Novo ${titles[kind].one}`}
      submitLabel="Salvar"
      busy={busy}
      form={{
        ref: formRef,
        noValidate: true,
        onSubmit: (event) => {
          event.preventDefault();
          void submit(
            saveEntrySchema,
            {
              ...(entry ? { id: entry.id, version: entry.version } : {}),
              kind,
              content: toJson(content),
              sortOrder: Math.max(0, Number(order) || 0),
              visible,
            },
            (data) => saveEntry({ data }),
            async () => {
              toast.success("Salvo.");
              await queryClient.invalidateQueries({ queryKey: QueryKey.Site.all() });
              onOpenChange(false);
            },
          );
        },
      }}
    >
      {kind === SiteEntryKind.Service && service.success ? (
        <>
          <TextField
            id="entry-name"
            label="Nome"
            required
            value={service.data.name}
            onValueChange={(name) => set({ name })}
            maxLength={80}
            counter
          />
          <TextField
            id="entry-icon"
            label="Ícone (nome)"
            value={service.data.icon}
            onValueChange={(icon) => set({ icon })}
            maxLength={40}
          />
          <TextAreaField
            id="entry-description"
            label="Descrição"
            value={service.data.description}
            onValueChange={(description) => set({ description })}
            maxLength={400}
            rows={4}
          />
          <LinkField
            id="entry-link"
            label="Botão “Saiba mais”"
            value={service.data.link}
            pages={pages.data ?? []}
            onChange={(link) => set({ link })}
          />
        </>
      ) : null}
      {kind === SiteEntryKind.Testimonial && testimonial.success ? (
        <>
          <TextAreaField
            id="entry-quote"
            label="Frase"
            value={testimonial.data.quote}
            onValueChange={(quote) => set({ quote })}
            maxLength={400}
            rows={4}
          />
          <TextField
            id="entry-author"
            label="Autor"
            value={testimonial.data.author}
            onValueChange={(author) => set({ author })}
            maxLength={80}
          />
          <TextField
            id="entry-role"
            label="Cargo ou empresa"
            value={testimonial.data.role}
            onValueChange={(role) => set({ role })}
            maxLength={80}
          />
          <ImageField
            id="entry-photo"
            label="Foto"
            value={testimonial.data.photo}
            onChange={(photo) => set({ photo })}
          />
        </>
      ) : null}
      <NumberField
        id="entry-order"
        label="Ordem"
        value={order}
        onValueChange={setOrder}
        error={errors["sortOrder"]}
      />
      <div className="flex items-center gap-2">
        <Checkbox
          id="entry-visible"
          checked={visible}
          onCheckedChange={(checked) => setVisible(checked === true)}
        />
        <Label htmlFor="entry-visible" className="font-normal">
          Mostrar no site
        </Label>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </FormDialog>
  );
}

export function EntriesPage({ kind }: { kind: SiteEntryKind }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const canEdit = can(auth, Action.Site.Edit);
  const [editing, setEditing] = useState<EntryRowData | "new" | null>(null);
  const [deleting, setDeleting] = useState<EntryRowData | null>(null);
  const entries = useQuery({
    queryKey: QueryKey.Site.entries(kind),
    queryFn: async () => unwrapResult(await listEntries({ data: { kind } })).entries,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={titles[kind].page}
        description="Os itens aparecem no site depois que você publica a página que os usa."
        breadcrumbs={[{ label: titles[kind].page }]}
        actions={
          canEdit ? (
            <Button type="button" onClick={() => setEditing("new")}>
              <Plus aria-hidden="true" />
              Novo {titles[kind].one}
            </Button>
          ) : null
        }
      />
      {entries.isPending ? <ListSkeleton rows={3} height="h-14" /> : null}
      {entries.isError ? <p className="text-sm text-danger">{entries.error.message}</p> : null}
      {entries.data && entries.data.length === 0 ? (
        <EmptyState title={`Nenhum ${titles[kind].one} ainda`} description={titles[kind].empty} />
      ) : null}
      {entries.data && entries.data.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {entries.data.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 p-3">
              <span className="min-w-0">
                <span className="block truncate font-medium">{summaryOf(entry) || "Sem nome"}</span>
                <span className="block text-xs text-muted-foreground">
                  Ordem {entry.sortOrder}
                  {entry.visible ? "" : " · oculto"}
                </span>
              </span>
              {canEdit ? (
                <span className="flex gap-1">
                  <IconButton label="Editar" icon={Pencil} onClick={() => setEditing(entry)} />
                  <IconButton
                    label="Excluir"
                    icon={Trash2}
                    destructive
                    onClick={() => setDeleting(entry)}
                  />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {editing !== null ? (
        <EntryDialog
          kind={kind}
          entry={editing === "new" ? null : editing}
          nextOrder={(entries.data?.length ?? 0) + 1}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Excluir «${deleting ? summaryOf(deleting) : ""}»?`}
        description="O item sai das seções na próxima publicação das páginas que o usam."
        confirmLabel="Excluir"
        destructive
        onConfirm={async () => {
          if (deleting === null) return true;
          const result = await deleteEntry({ data: { id: deleting.id } });
          if (!result.ok) {
            toast.error(result.message);
            return false;
          }
          await queryClient.invalidateQueries({ queryKey: QueryKey.Site.all() });
          return true;
        }}
      />
    </div>
  );
}
