import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadAnalysis } from "@/lib/marketing/metrics/analysis.server";
import {
  analysisSchemaInput,
  brandOnlySchema,
  markIdSchema,
  publishReportSchema,
  reportIdSchema,
  reportRowSchema,
  saveMarkSchema,
  saveReportSchema,
} from "@/lib/marketing/metrics/schemas";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { MetricReportStatus } from "@/lib/shared/enums";
import { buildHighlights, summarySentence } from "@/lib/shared/metrics/highlights";
import { bestFormatOf, bestPostOf, bestSlotOf } from "@/lib/shared/metrics/insights";
import { periodLabel } from "@/lib/shared/metrics/period";
import { PostRanking } from "@/lib/shared/metrics/ranking";
import {
  type Analysis,
  type ReportBlock,
  type ReportSnapshot,
  reportSnapshotSchema,
} from "@/lib/shared/metrics/report";
import { type Result, denied, fail, invalid, parseOutput } from "@/lib/shared/server-utils";

const accountsSchema = z.array(
  z.object({
    channel_id: z.string(),
    username: z.string(),
    followers_count: z.number().nullable(),
  }),
);
const savedSchema = z.object({ id: z.string().uuid(), version: z.number().int() });
const listSchema = z.object({ reports: z.array(reportRowSchema) });
const dueSchema = z.object({
  items: z.array(
    z.object({
      brand_id: z.string().uuid(),
      brand_name: z.string(),
      channel_id: z.string().uuid(),
      month_start: z.string(),
      month_end: z.string(),
    }),
  ),
});

export type MetricReport = {
  id: string;
  brandId: string;
  channelId: string;
  periodStart: string;
  periodEnd: string;
  compareMode: z.infer<typeof reportRowSchema>["compare_mode"];
  title: string;
  message: string | null;
  nextSteps: string[];
  blocks: ReportBlock[];
  status: MetricReportStatus;
  version: number;
  previousReportId: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

export type ReportDue = {
  brandId: string;
  brandName: string;
  channelId: string;
  monthStart: string;
  monthEnd: string;
};

const statusOf = (value: string): MetricReportStatus =>
  Object.values(MetricReportStatus).find((status) => status === value) ?? MetricReportStatus.Draft;

const toReport = (row: z.infer<typeof reportRowSchema>): MetricReport => ({
  id: row.id,
  brandId: row.brand_id,
  channelId: row.channel_id,
  periodStart: row.period_start,
  periodEnd: row.period_end,
  compareMode: row.compare_mode,
  title: row.title,
  message: row.message,
  nextSteps: row.next_steps,
  blocks: row.blocks,
  status: statusOf(row.status),
  version: row.version,
  previousReportId: row.previous_report_id,
  publishedAt: row.published_at,
  updatedAt: row.updated_at,
});

export const getMetricsAnalysis = createServerFn({ method: "GET" })
  .validator(analysisSchemaInput)
  .handler(async ({ data }): Promise<Result<{ analysis: Analysis }>> => {
    const caller = await requireActionServer(Action.Metrics.View);
    if (caller === null) return denied;
    return loadAnalysis(caller.supabase, data);
  });

export const saveMetricMark = createServerFn({ method: "POST" })
  .validator(saveMarkSchema)
  .handler(async ({ data }): Promise<Result<{ id: string; version: number }>> => {
    const caller = await requireActionServer(Action.Metrics.Report);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("metric_mark_save", {
      p_mark: {
        ...(data.id === undefined ? {} : { id: data.id }),
        brand_id: data.brandId,
        channel_id: data.channelId ?? null,
        kind: data.kind,
        label: data.label,
        starts_on: data.startsOn,
        ends_on: data.endsOn || null,
        content_item_id: data.contentItemId ?? null,
        ...(data.expectedVersion === undefined ? {} : { expected_version: data.expectedVersion }),
      },
    });
    if (error) return fail(error);
    const saved = parseOutput(savedSchema, row);
    return saved.ok ? { ok: true, id: saved.id, version: saved.version } : saved;
  });

export const deleteMetricMark = createServerFn({ method: "POST" })
  .validator(markIdSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Metrics.Report);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("metric_mark_delete", { p_mark: data.id });
    if (error) return fail(error);
    return { ok: true };
  });

export const listMetricReports = createServerFn({ method: "GET" })
  .validator(brandOnlySchema)
  .handler(async ({ data }): Promise<Result<{ reports: MetricReport[] }>> => {
    const caller = await requireActionServer(Action.Metrics.View);
    if (caller === null) return denied;
    const { data: rows, error } = await caller.supabase.rpc("metrics_report_list", {
      p_brand: data.brandId,
    });
    if (error) return fail(error);
    const parsed = parseOutput(listSchema, { reports: rows });
    return parsed.ok ? { ok: true, reports: parsed.reports.map(toReport) } : parsed;
  });

export const getMetricReport = createServerFn({ method: "GET" })
  .validator(reportIdSchema)
  .handler(
    async ({
      data,
    }): Promise<Result<{ report: MetricReport; snapshot: ReportSnapshot | null }>> => {
      const caller = await requireActionServer(Action.Metrics.View);
      if (caller === null) return denied;
      const { data: row, error } = await caller.supabase.rpc("metrics_report_get", {
        p_report: data.reportId,
      });
      if (error) return fail(error);
      const parsed = parseOutput(reportRowSchema.extend({ snapshot: z.unknown() }), row);
      if (!parsed.ok) return parsed;
      const { snapshot, ...rest } = parsed;
      const frozen = reportSnapshotSchema.safeParse(snapshot);
      return {
        ok: true,
        report: toReport({ ...rest }),
        snapshot: frozen.success ? frozen.data : null,
      };
    },
  );

export const saveMetricReport = createServerFn({ method: "POST" })
  .validator(saveReportSchema)
  .handler(async ({ data }): Promise<Result<{ id: string; version: number }>> => {
    const caller = await requireActionServer(Action.Metrics.Report);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("metrics_report_save", {
      p_report: {
        ...(data.id === undefined ? {} : { id: data.id }),
        brand_id: data.brandId,
        channel_id: data.channelId,
        period_start: data.periodStart,
        period_end: data.periodEnd,
        compare_mode: data.compareMode,
        title: data.title,
        message: data.message ?? null,
        next_steps: data.nextSteps,
        blocks: data.blocks,
        ...(data.expectedVersion === undefined ? {} : { expected_version: data.expectedVersion }),
      },
    });
    if (error) return fail(error);
    const saved = parseOutput(savedSchema, row);
    return saved.ok ? { ok: true, id: saved.id, version: saved.version } : saved;
  });

export const newMetricReportVersion = createServerFn({ method: "POST" })
  .validator(reportIdSchema)
  .handler(async ({ data }): Promise<Result<{ id: string }>> => {
    const caller = await requireActionServer(Action.Metrics.Report);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("metrics_report_new_version", {
      p_report: data.reportId,
    });
    if (error) return fail(error);
    const saved = parseOutput(savedSchema, row);
    return saved.ok ? { ok: true, id: saved.id } : saved;
  });

export const deleteMetricReport = createServerFn({ method: "POST" })
  .validator(reportIdSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Metrics.Report);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("metrics_report_delete", {
      p_report: data.reportId,
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const withdrawMetricReport = createServerFn({ method: "POST" })
  .validator(reportIdSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Metrics.Report);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("metrics_report_withdraw", {
      p_report: data.reportId,
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const publishMetricReport = createServerFn({ method: "POST" })
  .validator(publishReportSchema)
  .handler(async ({ data }): Promise<Result<{ id: string }>> => {
    const caller = await requireActionServer(Action.Metrics.Report);
    if (caller === null) return denied;

    const { data: row, error } = await caller.supabase.rpc("metrics_report_get", {
      p_report: data.reportId,
    });
    if (error) return fail(error);
    const report = reportRowSchema.safeParse(row);
    if (!report.success) return fail({ message: "unknown" });
    if (report.data.version !== data.expectedVersion) return fail({ message: "conflict" });

    const loaded = await loadAnalysis(caller.supabase, {
      brandId: report.data.brand_id,
      channelId: report.data.channel_id,
      from: report.data.period_start,
      to: report.data.period_end,
      compare: report.data.compare_mode,
      granularity: "week",
      rankBy: PostRanking.Reach,
    });
    if (!loaded.ok) return loaded;

    const { data: connections } = await caller.supabase.rpc("channel_connection_list", {
      p_brand: report.data.brand_id,
    });
    const account = accountsSchema
      .safeParse(connections)
      .data?.find((item) => item.channel_id === report.data.channel_id);
    const username = account?.username ?? "";
    const followers = account?.followers_count ?? null;

    const analysis = loaded.analysis;
    const label = periodLabel({ from: report.data.period_start, to: report.data.period_end });
    const zone = analysis.overview.timezone;
    const highlights = buildHighlights({
      overview: analysis.overview,
      periodLabel: label,
      bestPost: bestPostOf(analysis.topPosts, PostRanking.Reach, zone),
      bestFormat: bestFormatOf(analysis.formats),
      bestSlot: bestSlotOf(analysis.weekdays, analysis.hours),
    });
    const snapshot: ReportSnapshot = {
      version: 1,
      generatedAt: new Date().toISOString(),
      account: { username, followers },
      periodLabel: label,
      compare: report.data.compare_mode,
      summary: summarySentence(analysis.overview, label),
      highlights: highlights.map(({ id, text, tone }) => ({ id, text, tone })),
      analysis,
    };
    if (Object.keys(analysis.overview.totals).length === 0) {
      return invalid("Ainda não há dados neste período para publicar.");
    }

    const { data: published, error: publishError } = await caller.supabase.rpc(
      "metrics_report_publish",
      { p_report: data.reportId, p_expected_version: data.expectedVersion, p_snapshot: snapshot },
    );
    if (publishError) return fail(publishError);
    const saved = parseOutput(savedSchema, published);
    return saved.ok ? { ok: true, id: saved.id } : saved;
  });

export const getReportsDue = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ items: ReportDue[] }>> => {
    const caller = await requireActionServer(Action.Metrics.Report);
    if (caller === null) return denied;
    const { data: rows, error } = await caller.supabase.rpc("dashboard_metrics_report_due", {});
    if (error) return fail(error);
    const parsed = parseOutput(dueSchema, { items: rows });
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      items: parsed.items.map((item) => ({
        brandId: item.brand_id,
        brandName: item.brand_name,
        channelId: item.channel_id,
        monthStart: item.month_start,
        monthEnd: item.month_end,
      })),
    };
  },
);
