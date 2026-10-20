import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Calendar,
  ClipboardList,
  FileImage,
  Radio,
  RotateCcw,
  Save,
  Settings2,
  Type,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CaptionSection, ALL_TAB } from "@/components/marketing/content/caption-section";
import { ChannelPicker } from "@/components/marketing/content/channel-picker";
import { ChannelRowsSection } from "@/components/marketing/content/channel-rows-section";
import { CommentsPanel } from "@/components/marketing/content/comments-panel";
import { ContentSettingsSection } from "@/components/marketing/content/content-settings-section";
import { FileStrip } from "@/components/marketing/content/file-strip";
import { PublishDialog } from "@/components/marketing/content/publish-dialog";
import { RevisionHistory } from "@/components/marketing/content/revision-history";
import { ContentActions } from "@/components/marketing/content/content-actions";
import { ContentBanners } from "@/components/marketing/content/content-banners";
import { PlanSection } from "@/components/marketing/content/plan-section";
import { SubmitDialog } from "@/components/marketing/content/submit-dialog";
import { BrandSelect } from "@/components/shared/admin/brand-select";
import { FormError } from "@/components/shared/admin/auth-shell";
import { FormActions } from "@/components/shared/admin/form-actions";
import { PageHeader } from "@/components/shared/admin/page-header";
import { ReasonDialog } from "@/components/shared/admin/reason-dialog";
import { SectionCard } from "@/components/shared/admin/section-card";
import { EditorialStatusBadge } from "@/components/shared/content/status-badges";
import { ChannelPreview } from "@/components/shared/preview/channel-preview";
import { Alert, AlertDescription, AlertTitle } from "@/components/shared/ui/alert";
import { Button } from "@/components/shared/ui/button";
import {
  type DraftRow,
  type DraftValues,
  useContentDraft,
} from "@/hooks/marketing/use-content-draft";
import { useBrand } from "@/hooks/marketing/use-brand";
import { useBrandOptions } from "@/hooks/shared/use-brand-options";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { useSignedUrls } from "@/hooks/shared/use-signed-urls";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import { listChannels } from "@/lib/marketing/channels/channels.functions";
import {
  cancelContentItem,
  getContentItem,
  listAssigneeOptions,
  saveContentItem,
} from "@/lib/marketing/content/content.functions";
import { saveContentSchema } from "@/lib/marketing/content/schemas";
import { stageStateOf } from "@/lib/marketing/content/stage-state";
import type { ContentDetail } from "@/lib/marketing/content/types";
import {
  cancelContentChannel,
  moveContent,
  reopenContent,
} from "@/lib/marketing/content/workflow.functions";
import { Action } from "@/lib/shared/auth/actions";
import { ErrorCode } from "@/lib/shared/auth/errors";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { resolveLocalTime } from "@/lib/shared/calendar/reschedule";
import { mediaProblem, platformFormats } from "@/lib/shared/editorial/editorial";
import { type ApprovalStage, EditorialStatus } from "@/lib/shared/enums";
import { platformLabels } from "@/lib/shared/labels";
import { MediaVariant } from "@/lib/shared/media/schemas";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { AppRoute } from "@/lib/shared/routes";

const DEFAULT_HOUR = "09:00";
const FALLBACK_ZONE = "America/Sao_Paulo";

const defaultPlanned = (day: string | undefined, zone: string): string | null => {
  if (day === undefined) return null;
  const resolved = resolveLocalTime(`${day}T${DEFAULT_HOUR}`, zone);
  return resolved.ok ? resolved.instant.toISOString() : null;
};

export function ContentEditor({
  content,
  seed,
  sourceNote,
  defaultDay,
  onSaved,
}: {
  content: ContentDetail | undefined;
  seed: DraftValues;
  sourceNote: string | undefined;
  defaultDay: string | undefined;
  onSaved?: (() => void) | undefined;
}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { run, busy: acting } = useServerAction();
  const { formRef, errors, error, busy: saving, submit } = useFormSubmit();
  const draft = useContentDraft(seed);
  const { values } = draft;
  const [conflict, setConflict] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState<DraftRow | null>(null);
  const [cancellingRow, setCancellingRow] = useState<DraftRow | null>(null);
  const [reopening, setReopening] = useState<ApprovalStage | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [tab, setTab] = useState(ALL_TAB);

  const isNew = content === undefined;
  const editorialStatus = content?.editorialStatus ?? EditorialStatus.Draft;
  const cancelled = content?.cancelled ?? false;
  const approved = editorialStatus === EditorialStatus.Approved;
  const canWrite = can(auth, isNew ? Action.Content.Create : Action.Content.Update);
  const editable = canWrite && !cancelled && !approved;
  const state = stageStateOf(
    content?.planRequired ?? true,
    content?.planApprovedRevisionId ?? null,
  );
  useUnsavedChanges(draft.dirty && !saving);

  const brands = useBrandOptions(isNew);
  const brand = useBrand(values.brandId, values.brandId !== "");
  const zone = content?.brandTimezone ?? brand.data?.timezone ?? FALLBACK_ZONE;
  const channelsQuery = useQuery({
    queryKey: QueryKey.Channels.list(values.brandId, { status: "active" }),
    queryFn: async () =>
      unwrapResult(await listChannels({ data: { brandId: values.brandId } })).channels,
    enabled: values.brandId !== "" && can(auth, Action.Channels.View),
  });
  const assignees = useQuery({
    queryKey: QueryKey.Content.assignees(values.brandId),
    queryFn: async () =>
      unwrapResult(await listAssigneeOptions({ data: { brandId: values.brandId } })).people,
    enabled: values.brandId !== "",
  });
  const channels = channelsQuery.data ?? [];
  const urls = useSignedUrls(
    values.files.map((file) => file.mediaVersionId),
    MediaVariant.Display,
  );

  const formats = values.rows.map((row) => row.format);
  const selected = new Set(values.rows.map((row) => row.channelId));
  const locked = new Set(values.rows.filter((row) => row.published).map((row) => row.channelId));
  const refresh = [QueryKey.Content.all(), QueryKey.Dashboard.all(), QueryKey.Approvals.all()];
  const reload = () => {
    if (content === undefined) return;
    void queryClient.invalidateQueries({ queryKey: QueryKey.Content.item(content.id) });
  };

  function toggleChannel(channelId: string) {
    if (selected.has(channelId)) {
      draft.set(
        "rows",
        values.rows.filter((row) => row.channelId !== channelId || row.published),
      );
      return;
    }
    const channel = channels.find((candidate) => candidate.id === channelId);
    const format = channel ? platformFormats[channel.platform][0] : undefined;
    if (channel === undefined || format === undefined) return;
    const plannedAt = defaultPlanned(defaultDay, zone);
    draft.set("rows", [
      ...values.rows,
      {
        key: draft.nextKey(),
        id: undefined,
        channelId,
        format,
        caption: "",
        plannedAt,
        plannedTimezone: plannedAt === null ? null : zone,
        published: false,
        version: undefined,
      },
    ]);
  }

  const payload = (expectedVersion: number | undefined) => ({
    ...(content === undefined ? {} : { id: content.id }),
    brandId: values.brandId,
    title: values.title,
    objectiveKind: values.objectiveKind,
    objective: values.objective,
    briefing: values.briefing,
    internalNotes: values.internalNotes,
    assigneeId: values.assigneeId,
    tags: values.tags,
    productionDueDate: values.productionDueDate,
    planSummary: values.planSummary,
    planMedia: values.planFiles.map((file) => ({
      mediaVersionId: file.mediaVersionId,
      altText: file.altText,
    })),
    caption: values.caption,
    callToAction: values.callToAction,
    media: values.files.map((file) => ({
      mediaVersionId: file.mediaVersionId,
      altText: file.altText,
    })),
    channels: values.rows.map((row) => ({
      ...(row.id === undefined ? {} : { id: row.id }),
      channelId: row.channelId,
      format: row.format,
      caption: row.caption,
      plannedAt: row.plannedAt,
      plannedTimezone: row.plannedAt === null ? null : (row.plannedTimezone ?? zone),
    })),
    ...(sourceNote === undefined || content !== undefined ? {} : { sourceNote }),
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
  });

  async function save(forceLatest: boolean) {
    const base =
      forceLatest && content !== undefined
        ? unwrapResult(await getContentItem({ data: { id: content.id } })).item.version
        : content?.version;
    await submit(
      saveContentSchema,
      payload(base),
      async (data) => {
        const result = await saveContentItem({ data });
        setConflict(!result.ok && result.code === ErrorCode.Conflict);
        return result;
      },
      (result) => {
        setConflict(false);
        draft.markSaved();
        toast.success("Conteúdo salvo.");
        void queryClient.invalidateQueries({ queryKey: QueryKey.Content.all() });
        if (isNew && onSaved) {
          void queryClient.invalidateQueries({ queryKey: QueryKey.Calendar.all() });
          onSaved();
          return;
        }
        if (isNew) {
          void navigate({
            to: "/admin/marketing/content/$itemId",
            params: { itemId: result.id },
            replace: true,
          });
        }
      },
    );
  }

  async function move(to: EditorialStatus) {
    if (content === undefined) return;
    await run(
      () => moveContent({ data: { id: content.id, to, expectedVersion: content.version } }),
      {
        invalidate: refresh,
        success: "Estado atualizado.",
      },
    );
  }

  const hasPublished = values.rows.some((row) => row.published);
  const canPublish = can(auth, Action.Content.PublishManual) && approved && !cancelled;
  const canCancel = content !== undefined && can(auth, Action.Content.Cancel) && !cancelled;

  const labelOf = (row: DraftRow) => {
    const channel = channels.find((candidate) => candidate.id === row.channelId);
    return channel ? `${platformLabels[channel.platform]} · ${channel.profileName}` : "o canal";
  };
  const previewRow = values.rows.find((row) => row.key === tab) ?? values.rows[0];
  const previewChannel = channels.find((channel) => channel.id === previewRow?.channelId);
  const fileProblem = mediaProblem(formats, values.files.length);

  return (
    <form
      ref={formRef}
      noValidate
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (event.target !== event.currentTarget) return;
        void save(false);
      }}
    >
      {onSaved ? (
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="heading-page text-foreground">
              {isNew ? "Novo conteúdo" : values.title || "Conteúdo"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Escreva uma vez e escolha onde vai sair. Cada canal só muda o que for diferente.
            </p>
          </div>
        </header>
      ) : (
        <PageHeader
          title={isNew ? "Novo conteúdo" : values.title || "Conteúdo"}
          description={
            isNew
              ? "Escreva uma vez e escolha onde vai sair. Cada canal só muda o que for diferente."
              : (content?.brandName ?? "")
          }
          breadcrumbs={[
            { label: "Conteúdos", to: AppRoute.Content },
            { label: isNew ? "Novo conteúdo" : values.title || "Conteúdo" },
          ]}
          actions={content ? <EditorialStatusBadge status={editorialStatus} /> : null}
        />
      )}
      <ContentActions
        status={editorialStatus}
        state={state}
        isNew={isNew}
        cancelled={cancelled}
        hasPublished={hasPublished}
        hasContent={content !== undefined}
        editable={editable}
        dirty={draft.dirty}
        saving={saving}
        acting={acting}
        onMove={(to) => void move(to)}
        onSubmit={() => setSubmitting(true)}
        onReopen={setReopening}
        onCancel={() => setCancelling(true)}
      />
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Não foi possível salvar</AlertTitle>
          <AlertDescription>
            {error}
            {conflict ? (
              <FormActions className="mt-2">
                <Button type="button" size="sm" onClick={() => void save(true)} disabled={saving}>
                  <Save aria-hidden="true" />
                  Manter meu texto e salvar por cima
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={reload}>
                  <RotateCcw aria-hidden="true" />
                  Descartar e recarregar
                </Button>
              </FormActions>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {content ? <ContentBanners content={content} /> : null}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          {isNew ? (
            <SectionCard title="Marca" icon={Radio}>
              <BrandSelect
                id="content-brand"
                required
                value={values.brandId}
                onValueChange={(value) => {
                  draft.set("brandId", value);
                  draft.set("rows", []);
                  draft.set("assigneeId", null);
                }}
                placeholder="Escolha a marca"
                brands={brands.data}
                error={errors["brandId"]}
              />
            </SectionCard>
          ) : null}
          <SectionCard title="1. Selecione os canais" icon={Radio}>
            <ChannelPicker
              brandId={values.brandId}
              channels={channels}
              selected={selected}
              locked={locked}
              disabled={!editable || state.planLocked}
              onToggle={toggleChannel}
              error={errors["channels"]}
            />
          </SectionCard>
          {state.planRequired ? (
            <SectionCard
              title="2. Planejamento"
              icon={ClipboardList}
              tip={{
                label: "Sobre o planejamento",
                content:
                  "O cliente aprova primeiro o planejamento. Depois da aprovação, canais, formatos e datas ficam travados e começam as artes.",
              }}
            >
              <PlanSection
                draft={draft}
                disabled={!editable || saving || state.planLocked}
                errors={errors}
              />
            </SectionCard>
          ) : null}
          <SectionCard title="3. Texto do post" icon={Type}>
            <CaptionSection
              draft={draft}
              channels={channels}
              active={tab}
              onActive={setTab}
              disabled={!editable || saving}
              errors={errors}
            />
          </SectionCard>
          <SectionCard title="4. Artes e mídias" icon={FileImage}>
            <FileStrip
              items={values.files}
              onChange={(items) => draft.set("files", items)}
              brandId={values.brandId}
              formats={formats}
              disabled={!editable || saving || values.brandId === ""}
              error={errors["media"] ?? (values.files.length > 0 ? fileProblem : null) ?? undefined}
            />
          </SectionCard>
          <SectionCard title="5. Data e horário das publicações" icon={Calendar}>
            <ChannelRowsSection
              draft={draft}
              channels={channels}
              brandTimezone={zone}
              disabled={!editable || saving || state.planLocked}
              errors={errors}
              canPublish={canPublish}
              canCancel={canCancel && editorialStatus !== EditorialStatus.AwaitingApproval}
              onPublish={setPublishing}
              onCancelRow={setCancellingRow}
            />
          </SectionCard>
          <SectionCard title="6. Configurações" icon={Settings2}>
            <ContentSettingsSection
              draft={draft}
              assignees={assignees.data ?? []}
              disabled={!canWrite || cancelled || saving}
              objectiveLocked={state.planLocked}
              errors={errors}
            />
          </SectionCard>
          <FormError message={error} />
        </div>
        <div className="space-y-6 xl:sticky xl:top-4">
          {previewRow && previewChannel ? (
            <ChannelPreview
              platform={previewChannel.platform}
              profileName={previewChannel.profileName}
              format={previewRow.format}
              caption={previewRow.caption === "" ? values.caption : previewRow.caption}
              callToAction={values.callToAction === "" ? null : values.callToAction}
              brandLogoUrl={brand.data?.logoUrl ?? null}
              showCounter
              media={(state.stage === "plan" ? values.planFiles : values.files).map((file) => ({
                versionId: file.mediaVersionId,
                kind: file.kind,
                altText: file.altText === "" ? null : file.altText,
                url: urls.data?.[file.mediaVersionId] ?? null,
              }))}
            />
          ) : (
            <SectionCard title="Pré-visualização">
              <p className="text-sm text-muted-foreground">
                Escolha um canal e escreva o texto para ver como o post vai aparecer.
              </p>
            </SectionCard>
          )}
          {content ? (
            <>
              <RevisionHistory requests={content.requests} />
              <CommentsPanel itemId={content.id} />
            </>
          ) : null}
        </div>
      </div>
      {submitting && content ? (
        <SubmitDialog
          content={content}
          dirty={draft.dirty}
          open
          onOpenChange={(next) => !next && setSubmitting(false)}
          onSubmitted={() =>
            void queryClient.invalidateQueries({ queryKey: QueryKey.Content.all() })
          }
        />
      ) : null}
      {publishing && content ? (
        <PublishDialog
          channelRowId={publishing.id ?? ""}
          channelLabel={labelOf(publishing)}
          brandId={content.brandId}
          brandTimezone={content.brandTimezone}
          open
          onOpenChange={(next) => !next && setPublishing(null)}
          onPublished={() =>
            void queryClient.invalidateQueries({ queryKey: QueryKey.Content.all() })
          }
        />
      ) : null}
      <ReasonDialog
        open={reopening !== null}
        onOpenChange={(next) => !next && setReopening(null)}
        title={reopening === "plan" ? "Reabrir planejamento" : "Reabrir artes"}
        description={
          reopening === "plan"
            ? "O conteúdo volta para o planejamento, o pedido pendente é substituído e as duas aprovações são limpas. As artes e o histórico ficam guardados. O motivo fica registrado."
            : "Ele volta para produção e o pedido pendente ao cliente é substituído. Uma nova versão das artes precisará de nova aprovação. O motivo fica registrado."
        }
        confirmLabel="Reabrir"
        icon={RotateCcw}
        onSubmit={async (reason) => {
          if (content === undefined || reopening === null) return null;
          const scope = reopening;
          const result = await run(
            () => reopenContent({ data: { id: content.id, reason, scope } }),
            { invalidate: refresh, success: "Conteúdo reaberto." },
          );
          return result.ok ? null : result.message;
        }}
      />
      <ReasonDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title="Cancelar conteúdo"
        description="Os canais ainda não publicados e o pedido pendente ao cliente também são cancelados. O histórico é mantido."
        confirmLabel="Cancelar conteúdo"
        onSubmit={async (reason) => {
          if (content === undefined) return null;
          const result = await run(() => cancelContentItem({ data: { id: content.id, reason } }), {
            invalidate: refresh,
            success: "Conteúdo cancelado.",
          });
          return result.ok ? null : result.message;
        }}
      />
      <ReasonDialog
        open={cancellingRow !== null}
        onOpenChange={(next) => !next && setCancellingRow(null)}
        title={`Cancelar ${cancellingRow ? labelOf(cancellingRow) : "o canal"}`}
        description="Só este canal deixa de ser publicado. Os outros continuam. O histórico é mantido."
        confirmLabel="Cancelar canal"
        onSubmit={async (reason) => {
          if (cancellingRow?.id === undefined) return null;
          const id = cancellingRow.id;
          const result = await run(() => cancelContentChannel({ data: { id, reason } }), {
            invalidate: refresh,
            success: "Canal cancelado.",
          });
          return result.ok ? null : result.message;
        }}
      />
    </form>
  );
}
