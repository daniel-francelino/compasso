import { useQuery } from "@tanstack/react-query";
import { IconButton } from "@/components/shared/admin/icon-button";
import { Link, useNavigate } from "@tanstack/react-router";
import { Ban, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { RecordUnavailable } from "@/components/shared/admin/record-unavailable";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { PageHeader } from "@/components/shared/admin/page-header";
import { ReasonDialog } from "@/components/shared/admin/reason-dialog";
import { SectionCard } from "@/components/shared/admin/section-card";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import {
  EditorialStatusBadge,
  PublicationStatusBadge,
} from "@/components/shared/content/status-badges";
import { Button } from "@/components/shared/ui/button";
import { ItemFormDialog } from "@/components/marketing/content/item-form-dialog";
import { NewVariantDialog } from "@/components/marketing/content/new-variant-dialog";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { useSignedUrls } from "@/hooks/shared/use-signed-urls";
import {
  type VariantSummary,
  cancelContentItem,
  deleteContentItem,
  getContentItem,
} from "@/lib/marketing/content/content.functions";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { formatDateOnly, formatInZone } from "@/lib/shared/format";
import { contentFormatLabels, platformLabels } from "@/lib/shared/labels";
import { MediaVariant } from "@/lib/shared/media/schemas";
import { RichTextView } from "@/components/shared/admin/rich-text-view";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { AppRoute } from "@/lib/shared/routes";

function VariantCard({
  variant,
  urls,
}: {
  variant: VariantSummary;
  urls: Record<string, string> | undefined;
}) {
  const thumbnail =
    variant.thumbnailVersionId === null ? undefined : urls?.[variant.thumbnailVersionId];
  return (
    <li className="flex gap-3 rounded-xl border border-border bg-card p-3">
      <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-xs text-muted-foreground">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="size-full object-cover" />
        ) : (
          "Sem arquivo"
        )}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <Link
          to="/admin/marketing/variants/$variantId"
          params={{ variantId: variant.id }}
          className="block truncate font-medium text-primary underline-offset-4 hover:underline"
        >
          {platformLabels[variant.platform]} · {variant.profileName}
        </Link>
        <p className="text-xs text-muted-foreground">
          {contentFormatLabels[variant.format]} ·{" "}
          {variant.plannedAt !== null && variant.plannedTimezone !== null
            ? formatInZone(variant.plannedAt, variant.plannedTimezone)
            : "Sem data prevista"}
        </p>
        <div className="flex flex-wrap gap-1">
          <EditorialStatusBadge status={variant.editorialStatus} />
          <PublicationStatusBadge status={variant.publicationStatus} />
        </div>
      </div>
    </li>
  );
}

export function ItemPage({ itemId }: { itemId: string }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const { run, busy } = useServerAction();
  const [editing, setEditing] = useState(false);
  const [addingVariant, setAddingVariant] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const query = useQuery({
    queryKey: QueryKey.Content.item(itemId),
    queryFn: async () => unwrapResult(await getContentItem({ data: { id: itemId } })).item,
  });
  const thumbnails = useSignedUrls(
    (query.data?.variants ?? []).flatMap((variant) =>
      variant.thumbnailVersionId === null ? [] : [variant.thumbnailVersionId],
    ),
    MediaVariant.Thumb,
  );

  if (query.isPending) return <PageSkeleton />;
  if (query.isError) {
    return (
      <RecordUnavailable
        title="Conteúdo não encontrado"
        message="Ele não existe ou você não tem acesso."
        backTo={AppRoute.Content}
        backLabel="Voltar para conteúdos"
      />
    );
  }

  const item = query.data;
  const refresh = [QueryKey.Content.all(), QueryKey.Dashboard.all()];

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.title}
        description={`${item.brandName}${item.assigneeName ? ` · Responsável: ${item.assigneeName}` : ""}`}
        breadcrumbs={[{ label: "Conteúdos", to: AppRoute.Content }, { label: item.title }]}
        actions={
          <>
            {item.cancelled ? (
              <StatusBadge tone="neutral" icon={Ban}>
                Cancelado
              </StatusBadge>
            ) : null}
            {can(auth, Action.Content.Update) && !item.cancelled ? (
              <IconButton
                variant="outline"
                label="Editar conteúdo"
                icon={Pencil}
                onClick={() => setEditing(true)}
              />
            ) : null}
            {can(auth, Action.Content.Cancel) && !item.cancelled ? (
              <IconButton
                variant="outline"
                destructive
                label="Cancelar conteúdo"
                icon={Ban}
                onClick={() => setCancelling(true)}
              />
            ) : null}
            {can(auth, Action.Content.Delete) && item.variants.length === 0 ? (
              <IconButton
                variant="outline"
                destructive
                label="Excluir conteúdo"
                icon={Trash2}
                onClick={() => setDeleting(true)}
              />
            ) : null}
          </>
        }
      />
      <SectionCard title="Sobre o conteúdo">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Prazo de produção</dt>
            <dd>{item.productionDueDate ? formatDateOnly(item.productionDueDate) : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Etiquetas</dt>
            <dd>{item.tags.length > 0 ? item.tags.join(", ") : "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Objetivo</dt>
            <dd className="whitespace-pre-wrap">{item.objective ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Briefing (interno)</dt>
            <dd>
              <RichTextView doc={item.briefing} />
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Notas internas</dt>
            <dd className="whitespace-pre-wrap">{item.internalNotes ?? "—"}</dd>
          </div>
        </dl>
      </SectionCard>
      <SectionCard
        title="Variantes"
        icon={Layers}
        actions={
          can(auth, Action.Content.Create) && !item.cancelled ? (
            <Button size="sm" onClick={() => setAddingVariant(true)}>
              <Plus aria-hidden="true" />
              Adicionar variante
            </Button>
          ) : null
        }
      >
        {item.variants.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="Nenhuma variante ainda"
            description="Crie uma variante para cada canal em que este conteúdo vai sair."
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {item.variants.map((variant) => (
              <VariantCard key={variant.id} variant={variant} urls={thumbnails.data} />
            ))}
          </ul>
        )}
      </SectionCard>
      {editing ? (
        <ItemFormDialog
          open
          item={item}
          onOpenChange={(next) => !next && setEditing(false)}
          onSaved={() => void query.refetch()}
        />
      ) : null}
      {addingVariant ? (
        <NewVariantDialog
          open
          item={item}
          onOpenChange={(next) => !next && setAddingVariant(false)}
          onCreated={(variantId) =>
            void navigate({ to: "/admin/marketing/variants/$variantId", params: { variantId } })
          }
        />
      ) : null}
      <ReasonDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={`Cancelar “${item.title}”`}
        description="As variantes ainda não publicadas serão canceladas e os pedidos pendentes ao cliente também. O histórico é mantido."
        confirmLabel="Cancelar conteúdo"
        onSubmit={async (reason) => {
          const result = await run(() => cancelContentItem({ data: { id: item.id, reason } }), {
            invalidate: refresh,
            success: "Conteúdo cancelado.",
          });
          return result.ok ? null : result.message;
        }}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Excluir “${item.title}”?`}
        description="O conteúdo ainda não tem variantes, então pode ser excluído. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        busy={busy}
        onConfirm={async () => {
          const result = await run(() => deleteContentItem({ data: { id: item.id } }), {
            invalidate: refresh,
            success: "Conteúdo excluído.",
          });
          if (result.ok) void navigate({ to: AppRoute.Content });
          return result.ok;
        }}
      />
    </div>
  );
}
