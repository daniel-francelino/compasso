import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Hammer,
  Megaphone,
  RotateCcw,
  Save,
  Send,
  TriangleAlert,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CommentsPanel } from "@/components/marketing/content/comments-panel";
import { PublishDialog } from "@/components/marketing/content/publish-dialog";
import { RevisionHistory } from "@/components/marketing/content/revision-history";
import { SubmitDialog } from "@/components/marketing/content/submit-dialog";
import { VariantFields } from "@/components/marketing/content/variant-fields";
import { RecordUnavailable } from "@/components/shared/admin/record-unavailable";
import { PageHeader } from "@/components/shared/admin/page-header";
import { ReasonDialog } from "@/components/shared/admin/reason-dialog";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { WhyDisabled } from "@/components/shared/admin/why-disabled";
import {
  EditorialStatusBadge,
  PublicationStatusBadge,
} from "@/components/shared/content/status-badges";
import { ChannelPreview } from "@/components/shared/preview/channel-preview";
import { Alert, AlertDescription, AlertTitle } from "@/components/shared/ui/alert";
import { Button } from "@/components/shared/ui/button";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { useSignedUrls } from "@/hooks/shared/use-signed-urls";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import { useVariantDraft } from "@/hooks/marketing/use-variant-draft";
import { saveVariantSchema } from "@/lib/marketing/content/schemas";
import type { VariantDetail } from "@/lib/marketing/content/types";
import {
  cancelVariant,
  getVariant,
  moveVariant,
  reopenVariant,
  saveVariant,
} from "@/lib/marketing/content/variants.functions";
import { Action } from "@/lib/shared/auth/actions";
import { ErrorCode } from "@/lib/shared/auth/errors";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { DirectMoves } from "@/lib/shared/editorial/editorial";
import { EditorialStatus, PublicationStatus } from "@/lib/shared/enums";
import { platformLabels } from "@/lib/shared/labels";
import { MediaVariant } from "@/lib/shared/media/schemas";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { AppRoute } from "@/lib/shared/routes";

const MOVE_LABELS: Partial<Record<EditorialStatus, { label: string; icon: LucideIcon }>> = {
  [EditorialStatus.InProduction]: { label: "Iniciar produção", icon: Hammer },
  [EditorialStatus.InternalReview]: { label: "Enviar para revisão interna", icon: Send },
};

const RESUME_FROM: readonly EditorialStatus[] = [
  EditorialStatus.InternalReview,
  EditorialStatus.ChangesRequested,
];

const SUBMITTABLE: readonly EditorialStatus[] = [
  EditorialStatus.InProduction,
  EditorialStatus.InternalReview,
  EditorialStatus.AwaitingApproval,
];

const moveLabel = (from: EditorialStatus, to: EditorialStatus) =>
  RESUME_FROM.includes(from) && to === EditorialStatus.InProduction
    ? { label: "Retomar produção", icon: Undo2 }
    : MOVE_LABELS[to];

function Banners({ variant }: { variant: VariantDetail }) {
  const overdue =
    variant.plannedAt !== null &&
    new Date(variant.plannedAt).getTime() < Date.now() &&
    variant.publicationStatus === PublicationStatus.Planned &&
    (variant.editorialStatus === EditorialStatus.Approved ||
      variant.editorialStatus === EditorialStatus.AwaitingApproval);
  return (
    <div className="space-y-3">
      {variant.itemCancelled || variant.editorialStatus === EditorialStatus.Cancelled ? (
        <Alert>
          <Ban aria-hidden="true" />
          <AlertTitle>Esta variante foi cancelada</AlertTitle>
          <AlertDescription>
            O histórico foi mantido, mas ela não pode mais ser editada.
          </AlertDescription>
        </Alert>
      ) : null}
      {variant.editorialStatus === EditorialStatus.Approved &&
      variant.publicationStatus !== PublicationStatus.PublishedManually ? (
        <Alert>
          <AlertTitle>Versão aprovada</AlertTitle>
          <AlertDescription>
            Para mudar texto, arquivos ou data, reabra a variante. Isso exige uma nova aprovação.
          </AlertDescription>
        </Alert>
      ) : null}
      {variant.hasUnsentChanges && variant.editorialStatus === EditorialStatus.AwaitingApproval ? (
        <Alert>
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Há alterações que o cliente ainda não viu</AlertTitle>
          <AlertDescription>
            O aprovador vê a versão {variant.nextRevisionNo - 1}. Envie uma nova versão para que ele
            veja as mudanças.
          </AlertDescription>
        </Alert>
      ) : null}
      {overdue ? (
        <Alert>
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Data prevista ultrapassada — replanejar</AlertTitle>
          <AlertDescription>
            A data prevista já passou sem a publicação ser registrada. Reabra a variante para
            replanejar.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function Editor({ variant }: { variant: VariantDetail }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { run, busy: acting } = useServerAction();
  const { formRef, errors, error, busy: saving, submit } = useFormSubmit();
  const draft = useVariantDraft(variant);
  const [conflict, setConflict] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const published = variant.publicationStatus === PublicationStatus.PublishedManually;
  const cancelled = variant.itemCancelled || variant.editorialStatus === EditorialStatus.Cancelled;
  const editable =
    can(auth, Action.Content.Update) &&
    !cancelled &&
    !published &&
    variant.editorialStatus !== EditorialStatus.Approved;
  useUnsavedChanges(draft.dirty && !saving);

  const urls = useSignedUrls(
    draft.files.map((file) => file.mediaVersionId),
    MediaVariant.Display,
  );
  const refresh = [QueryKey.Content.all(), QueryKey.Dashboard.all(), QueryKey.Approvals.all()];
  const reload = () =>
    void queryClient.invalidateQueries({ queryKey: QueryKey.Content.variant(variant.id) });

  const payload = (expectedVersion: number) => ({
    id: variant.id,
    contentItemId: variant.itemId,
    channelId: variant.channelId,
    format: draft.format,
    caption: draft.caption,
    callToAction: draft.callToAction,
    plannedAt: draft.plannedAt,
    plannedTimezone:
      draft.plannedAt === null ? null : (variant.plannedTimezone ?? variant.brandTimezone),
    approvalDueDate: variant.approvalDueDate,
    media: draft.files.map((file) => ({
      mediaVersionId: file.mediaVersionId,
      altText: file.altText,
    })),
    expectedVersion,
  });

  async function save(forceLatest: boolean) {
    const base = forceLatest
      ? unwrapResult(await getVariant({ data: { id: variant.id } })).variant.version
      : variant.version;
    await submit(
      saveVariantSchema,
      payload(base),
      async (data) => {
        const result = await saveVariant({ data });
        setConflict(!result.ok && result.code === ErrorCode.Conflict);
        return result;
      },
      () => {
        setConflict(false);
        toast.success("Variante salva.");
        void queryClient.invalidateQueries({ queryKey: QueryKey.Content.all() });
      },
    );
  }

  async function move(to: EditorialStatus) {
    await run(
      () => moveVariant({ data: { id: variant.id, to, expectedVersion: variant.version } }),
      {
        invalidate: refresh,
        success: "Estado atualizado.",
      },
    );
  }

  const moves =
    can(auth, Action.Content.Update) && !cancelled && !published
      ? DirectMoves[variant.editorialStatus]
      : [];
  const canSubmit =
    can(auth, Action.Content.Submit) &&
    !cancelled &&
    !published &&
    SUBMITTABLE.includes(variant.editorialStatus);
  const canReopen =
    can(auth, Action.Content.Reopen) &&
    !cancelled &&
    !published &&
    (variant.editorialStatus === EditorialStatus.Approved ||
      variant.editorialStatus === EditorialStatus.AwaitingApproval);
  const canPublish =
    can(auth, Action.Content.PublishManual) &&
    variant.editorialStatus === EditorialStatus.Approved &&
    !published;
  const canCancel = can(auth, Action.Content.Cancel) && !cancelled && !published;

  return (
    <form
      ref={formRef}
      noValidate
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        void save(false);
      }}
    >
      <PageHeader
        title={`${platformLabels[variant.platform]} · ${variant.profileName}`}
        description={`${variant.itemTitle} · ${variant.brandName}`}
        breadcrumbs={[{ label: "Conteúdos", to: AppRoute.Content }, { label: variant.itemTitle }]}
        actions={
          <>
            <EditorialStatusBadge status={variant.editorialStatus} />
            <PublicationStatusBadge status={variant.publicationStatus} />
          </>
        }
      />
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Ações da variante"
      >
        {editable ? (
          <Button type="submit" loading={saving} disabled={saving || !draft.dirty}>
            <Save aria-hidden="true" />
            Salvar
          </Button>
        ) : null}
        {moves.map((to) => {
          const meta = moveLabel(variant.editorialStatus, to);
          if (meta === undefined) return null;
          const Icon = meta.icon;
          return (
            <WhyDisabled
              key={to}
              reason={draft.dirty ? "Salve as alterações antes de mudar o estado." : null}
            >
              <Button
                type="button"
                variant="outline"
                disabled={draft.dirty || acting}
                onClick={() => void move(to)}
              >
                <Icon aria-hidden="true" />
                {meta.label}
              </Button>
            </WhyDisabled>
          );
        })}
        {canSubmit ? (
          <Button type="button" onClick={() => setSubmitting(true)} disabled={acting}>
            <Send aria-hidden="true" />
            Enviar para aprovação
          </Button>
        ) : null}
        {canReopen ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setReopening(true)}
            disabled={acting}
          >
            <RotateCcw aria-hidden="true" />
            Reabrir
          </Button>
        ) : null}
        {canPublish ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setPublishing(true)}
            disabled={acting}
          >
            <Megaphone aria-hidden="true" />
            Registrar publicação
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setCancelling(true)}
            disabled={acting}
          >
            <Ban aria-hidden="true" />
            Cancelar
          </Button>
        ) : null}
      </div>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Não foi possível salvar</AlertTitle>
          <AlertDescription>
            {error}
            {conflict ? (
              <span className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => void save(true)} disabled={saving}>
                  <Save aria-hidden="true" />
                  Manter meu texto e salvar por cima
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={reload}>
                  <RotateCcw aria-hidden="true" />
                  Descartar e recarregar
                </Button>
              </span>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      <Banners variant={variant} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <VariantFields
            variant={variant}
            draft={draft}
            errors={errors}
            disabled={!editable || saving}
          />
          <RevisionHistory requests={variant.requests} />
        </div>
        <div className="space-y-6">
          <ChannelPreview
            platform={variant.platform}
            profileName={variant.profileName}
            format={draft.format}
            caption={draft.caption}
            callToAction={draft.callToAction === "" ? null : draft.callToAction}
            showCounter
            media={draft.files.map((file) => ({
              versionId: file.mediaVersionId,
              kind: file.kind,
              altText: file.altText === "" ? null : file.altText,
              url: urls.data?.[file.mediaVersionId] ?? null,
            }))}
          />
          <CommentsPanel variantId={variant.id} />
        </div>
      </div>
      {submitting ? (
        <SubmitDialog
          variant={variant}
          dirty={draft.dirty}
          open
          onOpenChange={(next) => !next && setSubmitting(false)}
          onSubmitted={() =>
            void queryClient.invalidateQueries({ queryKey: QueryKey.Content.all() })
          }
        />
      ) : null}
      {publishing ? (
        <PublishDialog
          variant={variant}
          open
          onOpenChange={(next) => !next && setPublishing(false)}
          onPublished={() =>
            void queryClient.invalidateQueries({ queryKey: QueryKey.Content.all() })
          }
        />
      ) : null}
      <ReasonDialog
        open={reopening}
        onOpenChange={setReopening}
        title="Reabrir variante"
        description="Ela volta para produção e o pedido pendente ao cliente é substituído. Uma nova versão precisará de nova aprovação. O motivo fica registrado."
        confirmLabel="Reabrir"
        icon={RotateCcw}
        onSubmit={async (reason) => {
          const result = await run(() => reopenVariant({ data: { id: variant.id, reason } }), {
            invalidate: refresh,
            success: "Variante reaberta.",
          });
          return result.ok ? null : result.message;
        }}
      />
      <ReasonDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title="Cancelar variante"
        description="O pedido pendente ao cliente também é cancelado. O histórico é mantido."
        confirmLabel="Cancelar variante"
        onSubmit={async (reason) => {
          const result = await run(() => cancelVariant({ data: { id: variant.id, reason } }), {
            invalidate: refresh,
            success: "Variante cancelada.",
          });
          return result.ok ? null : result.message;
        }}
      />
    </form>
  );
}

export function VariantEditorPage({ variantId }: { variantId: string }) {
  const query = useQuery({
    queryKey: QueryKey.Content.variant(variantId),
    queryFn: async () => unwrapResult(await getVariant({ data: { id: variantId } })).variant,
  });
  if (query.isPending) return <PageSkeleton />;
  if (query.isError) {
    return (
      <RecordUnavailable
        title="Variante não encontrada"
        message="Ela não existe ou você não tem acesso."
        backTo={AppRoute.Content}
        backLabel="Voltar para conteúdos"
      />
    );
  }
  return <Editor key={`${query.data.id}-${query.data.version}`} variant={query.data} />;
}
