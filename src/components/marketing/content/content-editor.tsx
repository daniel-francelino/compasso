import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { RotateCcw, Save, UserCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ALL_TAB } from "@/components/marketing/content/caption-section";
import { ActivitySection } from "@/components/marketing/content/activity-section";
import { ContentActions } from "@/components/marketing/content/content-actions";
import { ContentBanners } from "@/components/marketing/content/content-banners";
import { ContentStep } from "@/components/marketing/content/content-step";
import { EditorPreview } from "@/components/marketing/content/editor-preview";
import { PlanScheduleFields } from "@/components/marketing/content/plan-schedule-fields";
import { PlanningStep } from "@/components/marketing/content/planning-step";
import { PublishDialog } from "@/components/marketing/content/publish-dialog";
import { SubmitDialog } from "@/components/marketing/content/submit-dialog";
import { FormError } from "@/components/shared/admin/auth-shell";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { FormActions } from "@/components/shared/admin/form-actions";
import { PageHeader } from "@/components/shared/admin/page-header";
import { ReasonDialog } from "@/components/shared/admin/reason-dialog";
import { StepNav } from "@/components/shared/admin/step-nav";
import { StepPanel } from "@/components/shared/admin/step-panel";
import { EditorialStatusBadge } from "@/components/shared/content/status-badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/shared/ui/alert";
import { Button } from "@/components/shared/ui/button";
import {
  type DraftRow,
  type DraftValues,
  useContentDraft,
} from "@/hooks/marketing/use-content-draft";
import { useAutoSelectChannel } from "@/hooks/marketing/use-auto-select-channel";
import { useAutoSelectAssignee } from "@/hooks/marketing/use-auto-select-assignee";
import { useBrand } from "@/hooks/marketing/use-brand";
import { useContentTypeOptions } from "@/hooks/marketing/use-content-type-options";
import { useBrandOptions } from "@/hooks/shared/use-brand-options";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import { listChannels } from "@/lib/marketing/channels/channels.functions";
import {
  cancelContentItem,
  getContentItem,
  listAssigneeOptions,
  duplicateContentItem,
  saveContentItem,
} from "@/lib/marketing/content/content.functions";
import {
  EditorStep,
  editorSteps,
  initialStep,
  stepToShow,
  stepsWithErrors,
} from "@/lib/marketing/content/editor-steps";
import { draftPayload } from "@/lib/marketing/content/draft-payload";
import { followPublishDate, plannedOnDay } from "@/lib/marketing/content/publish-date";
import { saveContentSchema } from "@/lib/marketing/content/schemas";
import { stageStateOf } from "@/lib/marketing/content/stage-state";
import type { ContentDetail } from "@/lib/marketing/content/types";
import {
  cancelContentChannel,
  moveContent,
  reopenContent,
  approveOnBehalf,
  publishContent,
} from "@/lib/marketing/content/workflow.functions";
import { Action } from "@/lib/shared/auth/actions";
import { ErrorCode } from "@/lib/shared/auth/errors";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { platformFormats } from "@/lib/shared/editorial/editorial";
import { ApprovalStage, EditorialStatus } from "@/lib/shared/enums";
import { platformLabels } from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";
import { focusFirstInvalid } from "@/lib/shared/forms";
import { unwrapResult } from "@/lib/shared/result-client";
import { AppRoute } from "@/lib/shared/routes";
import { cn } from "@/lib/shared/utils";

const FALLBACK_ZONE = "America/Sao_Paulo";
const STEP_FOCUS_DELAY_MS = 350;

export function ContentEditor({
  content,
  seed,
  sourceNote,
  onSaved,
}: {
  content: ContentDetail | undefined;
  seed: DraftValues;
  sourceNote: string | undefined;
  onSaved?: (() => void) | undefined;
}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { run, busy: acting } = useServerAction();
  const draft = useContentDraft(seed);
  const { values } = draft;
  const [step, setStep] = useState<EditorStep>(() => initialStep(seed));
  const focusPending = useRef(false);
  const {
    formRef,
    errors,
    error,
    busy: saving,
    submit,
  } = useFormSubmit({
    onInvalid: (fields) => {
      const target = stepToShow(fields, values.rows.length > 0, step);
      if (target === null) return;
      focusPending.current = true;
      setStep(target);
    },
  });
  const [conflict, setConflict] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState<DraftRow | null>(null);
  const [cancellingRow, setCancellingRow] = useState<DraftRow | null>(null);
  const [reopening, setReopening] = useState<ApprovalStage | null>(null);
  const [approvingStage, setApprovingStage] = useState<ApprovalStage | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmingPublish, setConfirmingPublish] = useState(false);
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
  const typeOptions = useContentTypeOptions(content?.types ?? []);

  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    const timer = setTimeout(() => focusFirstInvalid(formRef.current), STEP_FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [step, formRef]);

  const selected = new Set(values.rows.map((row) => row.channelId));
  const locked = new Set(values.rows.filter((row) => row.published).map((row) => row.channelId));
  const refresh = [QueryKey.Content.all(), QueryKey.Dashboard.all(), QueryKey.Approvals.all()];
  const reload = () => {
    if (content === undefined) return;
    void queryClient.invalidateQueries({ queryKey: QueryKey.Content.item(content.id) });
  };

  function toggleChannel(channelId: string, automatic = false) {
    const apply = automatic ? draft.setAutomatic : draft.set;
    if (selected.has(channelId)) {
      apply(
        "rows",
        values.rows.filter((row) => row.channelId !== channelId || row.published),
      );
      return;
    }
    const channel = channels.find((candidate) => candidate.id === channelId);
    const format = channel ? platformFormats[channel.platform][0] : undefined;
    if (channel === undefined || format === undefined) return;
    const plannedAt = plannedOnDay(values.publishDate, zone);
    apply("rows", [
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

  function changePublishDate(day: string | null) {
    draft.set("rows", followPublishDate(values.rows, values.publishDate, day, zone));
    draft.set("publishDate", day);
  }

  useAutoSelectChannel({
    enabled: isNew && editable,
    brandId: values.brandId,
    channels,
    hasSelection: values.rows.length > 0,
    onSelect: (channelId) => toggleChannel(channelId, true),
  });

  useAutoSelectAssignee({
    enabled: isNew && editable,
    brandId: values.brandId,
    assignees: assignees.data ?? [],
    selected: values.assigneeId,
    onSelect: (assigneeId) => draft.setAutomatic("assigneeId", assigneeId),
  });

  const payload = (expectedVersion: number | undefined) =>
    draftPayload(values, zone, { contentId: content?.id, sourceNote, expectedVersion });

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
        if (onSaved) void queryClient.invalidateQueries({ queryKey: QueryKey.Calendar.all() });
        if (isNew && onSaved) {
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

  async function saveScheduleBeforeApproval(stage: ApprovalStage): Promise<number | string> {
    if (content === undefined) return "Salve o conteúdo antes de aprovar.";
    if (stage !== ApprovalStage.Plan || !draft.dirty) return content.version;
    const parsed = saveContentSchema.safeParse(payload(content.version));
    if (!parsed.success) return "Confira as datas e os horários antes de aprovar.";
    const saved = await saveContentItem({ data: parsed.data });
    if (!saved.ok) return saved.message;
    draft.markSaved();
    void queryClient.invalidateQueries({ queryKey: QueryKey.Content.all() });
    return saved.version;
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
  const allPublished = hasPublished && values.rows.every((row) => row.published);
  const canPublish = can(auth, Action.Content.PublishManual) && approved && !cancelled;
  const canAutomate = can(auth, Action.Content.PublishManual) && !cancelled;
  const canCancel = content !== undefined && can(auth, Action.Content.Cancel) && !cancelled;

  const duplicate = async () => {
    if (content === undefined) return;
    const result = await run(() => duplicateContentItem({ data: { id: content.id } }), {
      invalidate: refresh,
      success: "Conteúdo duplicado. Ajuste o nome e as datas.",
    });
    if (!result.ok) return;
    void navigate({ to: "/admin/marketing/content/$itemId", params: { itemId: result.id } });
  };

  const labelOf = (row: DraftRow) => {
    const channel = channels.find((candidate) => candidate.id === row.channelId);
    return channel ? `${platformLabels[channel.platform]} · ${channel.profileName}` : "o canal";
  };
  const settingsDisabled = !canWrite || cancelled || saving;
  const hasSide = step === EditorStep.Content;
  const stepBar = (
    <StepNav
      label="Etapas do conteúdo"
      steps={editorSteps}
      active={step}
      onChange={setStep}
      invalid={stepsWithErrors(errors, values.rows.length > 0)}
      className="justify-start py-0"
    />
  );
  const actionsBar = (
    <ContentActions
      status={editorialStatus}
      state={state}
      isNew={isNew}
      cancelled={cancelled}
      hasPublished={hasPublished}
      canMarkPublished={allPublished && !draft.dirty}
      onPublish={() => setConfirmingPublish(true)}
      hasContent={content !== undefined}
      editable={editable}
      dirty={draft.dirty}
      saving={saving}
      acting={acting}
      onMove={(to) => void move(to)}
      onSubmit={() => setSubmitting(true)}
      onApproveOnBehalf={setApprovingStage}
      onReopen={setReopening}
      onCancel={() => setCancelling(true)}
      onDuplicate={() => void duplicate()}
    />
  );

  return (
    <form
      ref={formRef}
      noValidate
      className="mx-auto w-full max-w-7xl space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (event.target !== event.currentTarget) return;
        void save(false);
      }}
    >
      {onSaved ? (
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="sr-only">{isNew ? "Novo conteúdo" : values.title || "Conteúdo"}</h1>
          {stepBar}
          {actionsBar}
        </header>
      ) : (
        <PageHeader
          compact
          title={isNew ? "Novo conteúdo" : values.title || "Conteúdo"}
          middle={stepBar}
          breadcrumbs={[
            { label: "Conteúdos", to: AppRoute.Content },
            { label: isNew ? "Novo conteúdo" : values.title || "Conteúdo" },
          ]}
          actions={
            <>
              {content ? <EditorialStatusBadge status={editorialStatus} /> : null}
              {actionsBar}
            </>
          }
        />
      )}
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
      <div
        className={cn("grid items-start gap-6", hasSide && "xl:grid-cols-[minmax(0,1fr)_24rem]")}
      >
        <StepPanel steps={editorSteps} active={step} onChange={setStep}>
          {step === EditorStep.Planning ? (
            <PlanningStep
              draft={draft}
              isNew={isNew}
              brands={brands.data}
              channels={channels}
              channelsLoading={channelsQuery.isLoading}
              selected={selected}
              locked={locked}
              assignees={assignees.data ?? []}
              state={state}
              editable={editable}
              settingsDisabled={settingsDisabled}
              saving={saving}
              errors={errors}
              typeOptions={typeOptions}
              onPublishDateChange={changePublishDate}
              onToggleChannel={toggleChannel}
            />
          ) : null}
          {step === EditorStep.Content ? (
            <ContentStep
              draft={draft}
              channels={channels}
              zone={zone}
              state={state}
              tab={tab}
              onTab={setTab}
              editable={editable}
              saving={saving}
              canPublish={canPublish}
              canCancelRow={canCancel && editorialStatus !== EditorialStatus.AwaitingApproval}
              itemId={content?.id}
              canAutomate={canAutomate}
              errors={errors}
              onPublishRow={setPublishing}
              onCancelRow={setCancellingRow}
            />
          ) : null}
          <FormError message={error} />
        </StepPanel>
        {hasSide ? (
          <div className="space-y-6 xl:sticky xl:top-4">
            {step === EditorStep.Content ? (
              <EditorPreview
                draft={draft}
                channels={channels}
                tab={tab}
                brandLogoUrl={brand.data?.logoUrl ?? null}
              />
            ) : null}
          </div>
        ) : null}
      </div>
      {content ? <ActivitySection itemId={content.id} requests={content.requests} /> : null}
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
      <ConfirmDialog
        open={confirmingPublish}
        onOpenChange={setConfirmingPublish}
        title="Marcar como publicado"
        description="Depois de marcar como publicado, os originais e os arquivos do planejamento são apagados. Ficam só as prévias. Vídeos continuam guardados por enquanto. Não dá para desfazer."
        confirmLabel="Marcar como publicado"
        busy={acting}
        onConfirm={async () => {
          if (content === undefined) return false;
          const result = await run(
            () => publishContent({ data: { id: content.id, expectedVersion: content.version } }),
            { invalidate: refresh, success: "Conteúdo marcado como publicado." },
          );
          return result.ok;
        }}
      />
      <ReasonDialog
        open={approvingStage !== null}
        onOpenChange={(next) => !next && setApprovingStage(null)}
        title="Aprovar no lugar do cliente"
        description="Você está registrando a aprovação do cliente. Isto fica no histórico com o seu nome. Se houver um pedido aberto, ele será encerrado e o cliente será avisado."
        confirmLabel={
          approvingStage === ApprovalStage.Plan ? "Aprovar planejamento" : "Aprovar arte"
        }
        icon={UserCheck}
        optional
        onSubmit={async (reason) => {
          if (content === undefined || approvingStage === null) return null;
          const stage = approvingStage;
          const saved = await saveScheduleBeforeApproval(stage);
          if (typeof saved === "string") return saved;
          const result = await run(
            () =>
              approveOnBehalf({
                data: {
                  id: content.id,
                  stage,
                  expectedVersion: saved,
                  ...(reason === "" ? {} : { reason }),
                },
              }),
            { invalidate: refresh, success: "Aprovação registrada." },
          );
          return result.ok ? null : result.message;
        }}
      >
        {approvingStage === ApprovalStage.Plan ? (
          <PlanScheduleFields
            draft={draft}
            channels={channels}
            zone={zone}
            disabled={!editable || acting}
            errors={errors}
          />
        ) : null}
      </ReasonDialog>
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
