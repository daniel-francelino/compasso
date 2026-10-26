import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Eye, Save, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FormError } from "@/components/shared/admin/auth-shell";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { SelectField, TextAreaField, TextField } from "@/components/shared/admin/form-fields";
import { IconButton } from "@/components/shared/admin/icon-button";
import { SectionCard } from "@/components/shared/admin/section-card";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { ReportView } from "@/components/shared/metrics/report-view";
import { Button } from "@/components/shared/ui/button";
import { Checkbox } from "@/components/shared/ui/checkbox";
import { DatePickerField } from "@/components/shared/ui/date-picker-field";
import { Label } from "@/components/shared/ui/label";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import {
  getMetricReport,
  getMetricsAnalysis,
  publishMetricReport,
  saveMetricReport,
} from "@/lib/marketing/metrics/metrics.functions";
import { saveReportSchema } from "@/lib/marketing/metrics/schemas";
import { MetricCompare, MetricGranularity, MetricReportStatus } from "@/lib/shared/enums";
import { buildHighlights, summarySentence } from "@/lib/shared/metrics/highlights";
import { bestFormatOf, bestPostOf, bestSlotOf } from "@/lib/shared/metrics/insights";
import { periodLabel } from "@/lib/shared/metrics/period";
import { PostRanking } from "@/lib/shared/metrics/ranking";
import {
  MetricBlockKind,
  type ReportBlock,
  type ReportSnapshot,
  metricBlockLabels,
} from "@/lib/shared/metrics/report";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

type Entry = { kind: MetricBlockKind; enabled: boolean; title: string; comment: string };

const compareOptions = [
  { value: MetricCompare.Previous, label: "Período anterior" },
  { value: MetricCompare.Year, label: "Mesmo período do ano passado" },
  { value: MetricCompare.None, label: "Sem comparação" },
];

const entriesOf = (blocks: ReportBlock[]): Entry[] => {
  const chosen = blocks.map((block) => ({
    kind: block.kind,
    enabled: true,
    title: block.title ?? "",
    comment: block.comment ?? "",
  }));
  const rest = Object.values(MetricBlockKind)
    .filter((kind) => !blocks.some((block) => block.kind === kind))
    .map((kind) => ({ kind, enabled: false, title: "", comment: "" }));
  return [...chosen, ...rest];
};

const blocksOf = (entries: Entry[]): ReportBlock[] =>
  entries
    .filter((entry) => entry.enabled)
    .map((entry) => ({
      kind: entry.kind,
      ...(entry.title.trim() ? { title: entry.title.trim() } : {}),
      ...(entry.comment.trim() ? { comment: entry.comment.trim() } : {}),
    }));

const sameJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

export function ReportBuilderPage({ brandId, reportId }: { brandId: string; reportId: string }) {
  const navigate = useNavigate();
  const { run, busy } = useServerAction();
  const { formRef, errors, error, busy: saving, submit } = useFormSubmit();
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const query = useQuery({
    queryKey: QueryKey.Metrics.report(reportId),
    queryFn: async () => unwrapResult(await getMetricReport({ data: { reportId } })),
  });
  const report = query.data?.report;

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [steps, setSteps] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [compare, setCompare] = useState<string>(MetricCompare.Previous);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);

  useEffect(() => {
    if (!report || loadedVersion === report.version) return;
    setTitle(report.title);
    setMessage(report.message ?? "");
    setSteps(report.nextSteps.join("\n"));
    setFrom(report.periodStart);
    setTo(report.periodEnd);
    setCompare(report.compareMode);
    setEntries(entriesOf(report.blocks));
    setLoadedVersion(report.version);
  }, [report, loadedVersion]);

  const stepList = steps
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const blocks = blocksOf(entries);
  const dirty =
    report !== undefined &&
    loadedVersion === report.version &&
    (title !== report.title ||
      message !== (report.message ?? "") ||
      from !== report.periodStart ||
      to !== report.periodEnd ||
      compare !== report.compareMode ||
      !sameJson(stepList, report.nextSteps) ||
      !sameJson(blocks, report.blocks));
  useUnsavedChanges(dirty);

  const compareMode =
    Object.values(MetricCompare).find((item) => item === compare) ?? MetricCompare.Previous;
  const draftValues = {
    id: reportId,
    brandId,
    channelId: report?.channelId ?? "",
    periodStart: from,
    periodEnd: to,
    compareMode,
    title,
    message,
    nextSteps: stepList,
    blocks,
    expectedVersion: report?.version ?? 1,
  };

  const preview = useQuery({
    queryKey: QueryKey.Metrics.overview(brandId, { reportId, from, to, compare }),
    enabled: previewing && report !== undefined && from !== "" && to !== "",
    queryFn: async () =>
      unwrapResult(
        await getMetricsAnalysis({
          data: {
            brandId,
            channelId: report?.channelId ?? "",
            from,
            to,
            compare: compareMode,
            granularity: MetricGranularity.Week,
            rankBy: PostRanking.Reach,
          },
        }),
      ).analysis,
  });

  const snapshot = useMemo<ReportSnapshot | null>(() => {
    if (!preview.data) return null;
    const analysis = preview.data;
    const label = periodLabel({ from, to });
    const highlights = buildHighlights({
      overview: analysis.overview,
      periodLabel: label,
      bestPost: bestPostOf(analysis.topPosts, PostRanking.Reach, analysis.overview.timezone),
      bestFormat: bestFormatOf(analysis.formats),
      bestSlot: bestSlotOf(analysis.weekdays, analysis.hours),
    });
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      account: { username: "", followers: null },
      periodLabel: label,
      compare: compareMode,
      summary: summarySentence(analysis.overview, label),
      highlights: highlights.map(({ id, text, tone }) => ({ id, text, tone })),
      analysis,
    };
  }, [preview.data, from, to, compareMode]);

  const refresh = [QueryKey.Metrics.reports(brandId), QueryKey.Metrics.report(reportId)];

  const save = () =>
    submit(
      saveReportSchema,
      draftValues,
      (data) =>
        run(() => saveMetricReport({ data }), {
          invalidate: refresh,
          success: "Rascunho salvo.",
        }),
      () => setLoadedVersion(null),
    );

  const publish = async () => {
    if (!report) return false;
    const saved = await run(() => saveMetricReport({ data: saveReportSchema.parse(draftValues) }), {
      invalidate: refresh,
    });
    if (!saved.ok) return false;
    const published = await run(
      () => publishMetricReport({ data: { reportId, expectedVersion: saved.version } }),
      { invalidate: refresh, success: "Relatório publicado para o cliente." },
    );
    if (!published.ok) return false;
    void navigate({
      to: "/admin/marketing/brands/$brandId/metrics",
      params: { brandId },
      search: { view: "reports" },
    });
    return true;
  };

  const move = (index: number, direction: number) =>
    setEntries((current) => {
      const target = index + direction;
      const moved = current[index];
      const other = current[target];
      if (moved === undefined || other === undefined) return current;
      return current.map((entry, position) => {
        if (position === index) return other;
        return position === target ? moved : entry;
      });
    });

  const patchEntry = (index: number, patch: Partial<Entry>) =>
    setEntries((current) =>
      current.map((entry, position) => (position === index ? { ...entry, ...patch } : entry)),
    );

  if (query.isPending) return <PageSkeleton />;
  if (query.isError || !report) {
    return (
      <EmptyState
        title="Relatório não encontrado"
        description="Ele não existe ou você não tem acesso."
      />
    );
  }

  if (report.status !== MetricReportStatus.Draft) {
    return query.data.snapshot ? (
      <ReportView
        title={report.title}
        message={report.message}
        nextSteps={report.nextSteps}
        blocks={report.blocks}
        snapshot={query.data.snapshot}
        linkContent
      />
    ) : (
      <EmptyState title="Este relatório não tem dados guardados" />
    );
  }

  return (
    <form
      ref={formRef}
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <FormError message={error} />
      <SectionCard title="Período e mensagem">
        <div className="grid gap-3 sm:grid-cols-2">
          <DatePickerField
            id="report-from"
            label="De"
            required
            value={from}
            onChange={setFrom}
            error={errors["periodStart"]}
          />
          <DatePickerField
            id="report-to"
            label="Até"
            required
            value={to}
            minDate={from}
            onChange={setTo}
            error={errors["periodEnd"]}
          />
        </div>
        <SelectField
          id="report-compare"
          label="Comparar com"
          value={compare}
          onValueChange={setCompare}
          options={compareOptions}
        />
        <TextField
          id="report-title"
          label="Título"
          required
          value={title}
          onValueChange={setTitle}
          maxLength={140}
          error={errors["title"]}
        />
        <TextAreaField
          id="report-message"
          label="Mensagem para o cliente"
          value={message}
          onValueChange={setMessage}
          maxLength={2000}
          rows={4}
          placeholder="Conte em poucas linhas o que aconteceu no período."
          error={errors["message"]}
        />
        <TextAreaField
          id="report-steps"
          label="Próximos passos (um por linha, até 5)"
          value={steps}
          onValueChange={setSteps}
          maxLength={1000}
          rows={4}
          error={errors["nextSteps"]}
        />
      </SectionCard>

      <SectionCard title="O que o cliente vai ver">
        <p className="text-sm text-muted-foreground">
          Marque os blocos, ajuste a ordem e, se quiser, escreva um comentário curto em cada um.
        </p>
        <ul className="space-y-3">
          {entries.map((entry, index) => (
            <li key={entry.kind} className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`block-${entry.kind}`}
                    checked={entry.enabled}
                    onCheckedChange={(checked) => patchEntry(index, { enabled: checked === true })}
                  />
                  <Label htmlFor={`block-${entry.kind}`}>{metricBlockLabels[entry.kind]}</Label>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton
                    label="Subir bloco"
                    icon={ArrowUp}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  />
                  <IconButton
                    label="Descer bloco"
                    icon={ArrowDown}
                    disabled={index === entries.length - 1}
                    onClick={() => move(index, 1)}
                  />
                </div>
              </div>
              {entry.enabled ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <TextField
                    id={`block-title-${entry.kind}`}
                    label="Título (opcional)"
                    value={entry.title}
                    onValueChange={(value) => patchEntry(index, { title: value })}
                    maxLength={140}
                  />
                  <TextAreaField
                    id={`block-comment-${entry.kind}`}
                    label="Comentário (opcional)"
                    value={entry.comment}
                    onValueChange={(value) => patchEntry(index, { comment: value })}
                    maxLength={1000}
                    rows={2}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {errors["blocks"] ? <p className="text-sm text-destructive">{errors["blocks"]}</p> : null}
      </SectionCard>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={saving} disabled={busy}>
          <Save aria-hidden="true" />
          Salvar rascunho
        </Button>
        <Button type="button" variant="outline" onClick={() => setPreviewing(true)}>
          <Eye aria-hidden="true" />
          Ver prévia
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || saving || blocks.length === 0}
          onClick={() => setConfirming(true)}
        >
          <Send aria-hidden="true" />
          Publicar para o cliente
        </Button>
      </div>

      {previewing ? (
        <SectionCard title="Prévia: como o cliente vai ver">
          {preview.isPending ? <PageSkeleton /> : null}
          {snapshot ? (
            <ReportView
              title={title}
              message={message.trim() || null}
              nextSteps={stepList}
              blocks={blocks}
              snapshot={snapshot}
              linkContent={false}
            />
          ) : null}
        </SectionCard>
      ) : null}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Publicar para o cliente"
        description="Os números deste período ficam congelados e o cliente recebe um aviso. Para mudar depois, será preciso criar uma correção."
        confirmLabel="Publicar"
        busy={busy}
        onConfirm={publish}
      />
    </form>
  );
}
