import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import {
  type ReportBlock,
  type ReportSnapshot,
  reportBlockSchema,
  reportSnapshotSchema,
} from "@/lib/shared/metrics/report";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";

const brandSchema = z.object({ brandId: z.string().uuid() });
const reportSchema = z.object({ reportId: z.string().uuid() });

const listSchema = z.object({
  reports: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      period_start: z.string(),
      period_end: z.string(),
      published_at: z.string().nullable(),
    }),
  ),
});

const detailSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  message: z.string().nullable(),
  next_steps: z.array(z.string()),
  blocks: z.array(reportBlockSchema),
  period_start: z.string(),
  period_end: z.string(),
  published_at: z.string().nullable(),
  snapshot: z.unknown(),
});

export type PortalReportSummary = {
  id: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  publishedAt: string | null;
};

export type PortalReport = PortalReportSummary & {
  message: string | null;
  nextSteps: string[];
  blocks: ReportBlock[];
  snapshot: ReportSnapshot;
};

export const portalListMetricReports = createServerFn({ method: "GET" })
  .validator(brandSchema)
  .handler(async ({ data }): Promise<Result<{ reports: PortalReportSummary[] }>> => {
    const caller = await requireActionServer(Action.Metrics.PortalView);
    if (caller === null) return denied;
    const { data: rows, error } = await caller.supabase.rpc("portal_metrics_report_list", {
      p_brand: data.brandId,
    });
    if (error) return fail(error);
    const parsed = parseOutput(listSchema, { reports: rows });
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      reports: parsed.reports.map((row) => ({
        id: row.id,
        title: row.title,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        publishedAt: row.published_at,
      })),
    };
  });

export const portalGetMetricReport = createServerFn({ method: "GET" })
  .validator(reportSchema)
  .handler(async ({ data }): Promise<Result<{ report: PortalReport }>> => {
    const caller = await requireActionServer(Action.Metrics.PortalView);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("portal_metrics_report_get", {
      p_report: data.reportId,
    });
    if (error) return fail(error);
    const parsed = parseOutput(detailSchema, row);
    if (!parsed.ok) return parsed;
    const snapshot = reportSnapshotSchema.safeParse(parsed.snapshot);
    if (!snapshot.success) return fail({ message: "unknown" });
    return {
      ok: true,
      report: {
        id: parsed.id,
        title: parsed.title,
        message: parsed.message,
        nextSteps: parsed.next_steps,
        blocks: parsed.blocks,
        periodStart: parsed.period_start,
        periodEnd: parsed.period_end,
        publishedAt: parsed.published_at,
        snapshot: snapshot.data,
      },
    };
  });
