import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { FilePlus, Trash2, LayoutTemplate, RotateCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { SelectField, TextField } from "@/components/shared/admin/form-fields";
import { IconButton } from "@/components/shared/admin/icon-button";
import { PageHeader } from "@/components/shared/admin/page-header";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { Button } from "@/components/shared/ui/button";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { createPageSchema } from "@/lib/cms/schemas";
import {
  type SitePageRow,
  createSitePage,
  deleteSitePage,
  listSitePages,
} from "@/lib/cms/pages.functions";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { SitePageKind, SitePageStatus } from "@/lib/shared/enums";
import { formatDateTime } from "@/lib/shared/format";
import { sitePageKindLabels } from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const CREATABLE = Object.values(SitePageKind).filter((kind) => kind !== SitePageKind.Home);

function stateOf(page: SitePageRow): {
  label: string;
  tone: "success" | "warning" | "neutral" | "negative";
} {
  if (page.status !== SitePageStatus.Published) return { label: "Fora do site", tone: "neutral" };
  if (page.kind === SitePageKind.CaseStudy && !page.authorized) {
    return { label: "Sai na próxima publicação", tone: "negative" };
  }
  return page.hasChanges
    ? { label: "No ar, com alterações por publicar", tone: "warning" }
    : { label: "No ar", tone: "success" };
}

function CreateDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [kind, setKind] = useState<SitePageKind>(SitePageKind.Generic);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      icon={FilePlus}
      title="Nova página"
      submitLabel="Criar página"
      busy={busy}
      form={{
        ref: formRef,
        noValidate: true,
        onSubmit: (event) => {
          event.preventDefault();
          void submit(
            createPageSchema,
            { kind, slug, title },
            (data) => createSitePage({ data }),
            async (result) => {
              await queryClient.invalidateQueries({ queryKey: QueryKey.Site.all() });
              onOpenChange(false);
              void navigate({ to: "/admin/site/pages/$pageId", params: { pageId: result.id } });
            },
          );
        },
      }}
    >
      <SelectField
        id="new-page-kind"
        label="Tipo"
        value={kind}
        onValueChange={(value) => setKind(value as SitePageKind)}
        options={CREATABLE.map((value) => ({ value, label: sitePageKindLabels[value] }))}
      />
      <TextField
        id="new-page-title"
        label="Título"
        required
        value={title}
        onValueChange={setTitle}
        maxLength={120}
        error={errors["title"]}
      />
      <TextField
        id="new-page-slug"
        label="Endereço"
        required
        value={slug}
        onValueChange={setSlug}
        maxLength={120}
        error={errors["slug"]}
        hint="Letras minúsculas, números e hífens. Ex.: servicos ou casos/cafe-aurora"
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </FormDialog>
  );
}

export function PagesListPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<SitePageRow | null>(null);
  const pages = useQuery({
    queryKey: QueryKey.Site.pages(),
    queryFn: async () => unwrapResult(await listSitePages()).pages,
  });
  const canStructure = can(auth, Action.Site.Structure);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Páginas"
        description="As páginas do site e o que cada uma mostra."
        breadcrumbs={[{ label: "Páginas" }]}
        actions={
          canStructure ? (
            <Button type="button" onClick={() => setCreating(true)}>
              <FilePlus aria-hidden="true" />
              Nova página
            </Button>
          ) : null
        }
      />
      {pages.isPending ? <ListSkeleton rows={4} height="h-14" /> : null}
      {pages.isError ? (
        <div className="space-y-3">
          <p className="text-sm text-danger">{pages.error.message}</p>
          <Button type="button" variant="outline" onClick={() => void pages.refetch()}>
            <RotateCw aria-hidden="true" />
            Tentar novamente
          </Button>
        </div>
      ) : null}
      {pages.data && pages.data.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="Nenhuma página ainda"
          description="Crie a primeira página do site."
        />
      ) : null}
      {pages.data && pages.data.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {pages.data.map((page) => {
            const state = stateOf(page);
            return (
              <li key={page.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0 space-y-1">
                  <Link
                    to="/admin/site/pages/$pageId"
                    params={{ pageId: page.id }}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {page.title || sitePageKindLabels[page.kind]}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {sitePageKindLabels[page.kind]} · {page.slug === "" ? "/" : `/${page.slug}`} ·
                    atualizada em {formatDateTime(page.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={state.tone} icon={FilePlus}>
                    {state.label}
                  </StatusBadge>
                  {canStructure && !page.isSystem ? (
                    <IconButton
                      label={`Excluir a página ${page.title || page.slug}`}
                      icon={Trash2}
                      destructive
                      onClick={() => setDeleting(page)}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {creating ? <CreateDialog onOpenChange={(open) => !open && setCreating(false)} /> : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Excluir «${deleting?.title ?? ""}»?`}
        description="A página some do CMS. Páginas que já foram publicadas não podem ser excluídas: tire-as do ar."
        confirmLabel="Excluir página"
        destructive
        onConfirm={async () => {
          if (deleting === null) return true;
          const result = await deleteSitePage({ data: { pageId: deleting.id } });
          if (!result.ok) {
            toast.error(result.message);
            return false;
          }
          toast.success("Página excluída.");
          await queryClient.invalidateQueries({ queryKey: QueryKey.Site.all() });
          return true;
        }}
      />
    </div>
  );
}
