import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";

export const AUDIT_PAGE_SIZE = 50;

export const auditFiltersSchema = z.object({
  from: z.string().max(40).optional(),
  to: z.string().max(40).optional(),
  actorId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  domain: z.string().max(40).optional(),
  entityType: z.string().max(40).optional(),
  entityId: z.string().uuid().optional(),
});

export const listAuditSchema = z.object({
  filters: auditFiltersSchema,
  page: z.number().int().min(1).max(10000),
});

const rowSchema = z.object({
  id: z.number(),
  occurred_at: z.string(),
  actor_id: z.string().nullable(),
  actor_name: z.string().nullable(),
  actor_kind: z.string(),
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.string().nullable(),
  brand_id: z.string().nullable(),
  brand_name: z.string().nullable(),
  request_id: z.string().nullable(),
  metadata: z.unknown(),
});

const listSchema = z.object({ total: z.number().int(), rows: z.array(rowSchema) });

export type AuditRow = {
  id: number;
  occurredAt: string;
  actorName: string | null;
  actorKind: string;
  action: string;
  entityType: string;
  entityId: string | null;
  brandId: string | null;
  brandName: string | null;
  requestId: string | null;
  metadataText: string;
};

const toFilters = (filters: z.infer<typeof auditFiltersSchema>) => ({
  from: filters.from ?? null,
  to: filters.to ?? null,
  actor_id: filters.actorId ?? null,
  brand_id: filters.brandId ?? null,
  domain: filters.domain ?? null,
  entity_type: filters.entityType ?? null,
  entity_id: filters.entityId ?? null,
});

const toRow = (row: z.infer<typeof rowSchema>): AuditRow => ({
  id: row.id,
  occurredAt: row.occurred_at,
  actorName: row.actor_name,
  actorKind: row.actor_kind,
  action: row.action,
  entityType: row.entity_type,
  entityId: row.entity_id,
  brandId: row.brand_id,
  brandName: row.brand_name,
  requestId: row.request_id,
  metadataText: JSON.stringify(row.metadata ?? {}, null, 2),
});

export const listAuditEvents = createServerFn({ method: "GET" })
  .validator(listAuditSchema)
  .handler(
    async ({ data }): Promise<Result<{ total: number; rows: AuditRow[]; pageSize: number }>> => {
      const caller = await requireActionServer(Action.Audit.View);
      if (caller === null) return denied;
      const { data: result, error } = await caller.supabase.rpc("audit_list", {
        p_filters: toFilters(data.filters),
        p_page: data.page,
      });
      if (error) return fail(error);
      const parsed = parseOutput(listSchema, result);
      if (!parsed.ok) return parsed;
      return {
        ok: true,
        total: parsed.total,
        rows: parsed.rows.map(toRow),
        pageSize: AUDIT_PAGE_SIZE,
      };
    },
  );

const csvCell = (value: string | null): string => {
  const text = value ?? "";
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

export const exportAudit = createServerFn({ method: "POST" })
  .validator(auditFiltersSchema)
  .handler(async ({ data }): Promise<Result<{ csv: string; total: number }>> => {
    const caller = await requireActionServer(Action.Audit.View);
    if (caller === null) return denied;
    const { data: result, error } = await caller.supabase.rpc("audit_list", {
      p_filters: toFilters(data),
      p_page: 1,
      p_export: true,
    });
    if (error) return fail(error);
    const parsed = parseOutput(listSchema, result);
    if (!parsed.ok) return parsed;

    const header = ["data", "pessoa", "ação", "entidade", "marca", "requisição"].join(",");
    const lines = parsed.rows.map((row) =>
      [
        row.occurred_at,
        row.actor_name ?? row.actor_kind,
        row.action,
        `${row.entity_type}:${row.entity_id ?? ""}`,
        row.brand_name,
        row.request_id,
      ]
        .map((cell) => csvCell(cell))
        .join(","),
    );
    return { ok: true, csv: [header, ...lines].join("\n"), total: parsed.total };
  });
