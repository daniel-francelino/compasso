import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  authorizeSchema,
  entryIdSchema,
  entryKindSchema,
  messagesQuerySchema,
  pageIdSchema,
  saveEntrySchema,
  updateMessageSchema,
} from "@/lib/cms/schemas";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { type Json, toJson } from "@/lib/shared/content/published";
import { entryContentSchemas } from "@/lib/shared/content/schemas";
import type { ContactMessageStatus, SiteEntryKind } from "@/lib/shared/enums";
import {
  type Page,
  type Result,
  denied,
  fail,
  invalid,
  pageOf,
  parseOutput,
  rangeOf,
} from "@/lib/shared/server-utils";

export type EntryRowData = {
  id: string;
  kind: SiteEntryKind;
  content: Json;
  sortOrder: number;
  visible: boolean;
  version: number;
};

export type MessageRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  message: string;
  sourceSlug: string | null;
  status: ContactMessageStatus;
  note: string | null;
  createdAt: string;
};

const savedSchema = z.object({ id: z.string().uuid(), version: z.number().int() });
const MESSAGE_PAGE = 20;

export const listEntries = createServerFn({ method: "GET" })
  .validator(entryKindSchema)
  .handler(async ({ data }): Promise<Result<{ entries: EntryRowData[] }>> => {
    const caller = await requireActionServer(Action.Site.View);
    if (caller === null) return denied;
    const { data: rows, error } = await caller.supabase
      .from("site_entries")
      .select("id, kind, content, sort_order, visible, version")
      .eq("kind", data.kind)
      .order("sort_order")
      .limit(200);
    if (error) return fail(error);
    return {
      ok: true,
      entries: rows.map((row) => ({
        id: row.id,
        kind: row.kind as SiteEntryKind,
        content: toJson(row.content),
        sortOrder: row.sort_order,
        visible: row.visible,
        version: row.version,
      })),
    };
  });

export const saveEntry = createServerFn({ method: "POST" })
  .validator(saveEntrySchema)
  .handler(async ({ data }): Promise<Result<{ id: string; version: number }>> => {
    const caller = await requireActionServer(Action.Site.Edit);
    if (caller === null) return denied;
    const content = entryContentSchemas[data.kind].safeParse(data.content);
    if (!content.success) return invalid("Confira os campos destacados.");
    const { data: row, error } = await caller.supabase.rpc("site_entry_save", {
      p_entry: {
        ...(data.id ? { id: data.id } : {}),
        kind: data.kind,
        content: toJson(content.data),
        sort_order: data.sortOrder,
        visible: data.visible,
        ...(data.version ? { version: data.version } : {}),
      },
    });
    if (error) return fail(error);
    const parsed = parseOutput(savedSchema, row);
    return parsed.ok ? { ok: true, id: parsed.id, version: parsed.version } : parsed;
  });

export const deleteEntry = createServerFn({ method: "POST" })
  .validator(entryIdSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Site.Edit);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("site_entry_delete", { p_entry: data.id });
    if (error) return fail(error);
    return { ok: true };
  });

export const authorizeCaseStudy = createServerFn({ method: "POST" })
  .validator(authorizeSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Site.Edit);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("site_case_study_authorize", {
      p_page: data.pageId,
      p_brand: data.brandId,
      p_consent_note: data.consentNote,
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const withdrawCaseStudy = createServerFn({ method: "POST" })
  .validator(pageIdSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Site.Edit);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("site_case_study_withdraw", {
      p_page: data.pageId,
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const getCaseAuthorization = createServerFn({ method: "GET" })
  .validator(pageIdSchema)
  .handler(
    async ({
      data,
    }): Promise<
      Result<{ authorization: { brandId: string; note: string; authorizedAt: string } | null }>
    > => {
      const caller = await requireActionServer(Action.Site.View);
      if (caller === null) return denied;
      const { data: row, error } = await caller.supabase
        .from("site_case_study_authorizations")
        .select("brand_id, consent_note, authorized_at")
        .eq("page_id", data.pageId)
        .is("withdrawn_at", null)
        .maybeSingle();
      if (error) return fail(error);
      return {
        ok: true,
        authorization:
          row === null
            ? null
            : { brandId: row.brand_id, note: row.consent_note, authorizedAt: row.authorized_at },
      };
    },
  );

export const listMessages = createServerFn({ method: "GET" })
  .validator(messagesQuerySchema)
  .handler(async ({ data }): Promise<Result<Page<MessageRow>>> => {
    const caller = await requireActionServer(Action.Site.View);
    if (caller === null) return denied;
    const [from, to] = rangeOf(data.page, MESSAGE_PAGE);
    let query = caller.supabase
      .from("contact_messages")
      .select("id, name, email, phone, message, source_slug, status, internal_note, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (data.status) query = query.eq("status", data.status);
    const { data: rows, error, count } = await query;
    if (error) return fail(error);
    return {
      ok: true,
      ...pageOf(
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          message: row.message,
          sourceSlug: row.source_slug,
          status: row.status as ContactMessageStatus,
          note: row.internal_note,
          createdAt: row.created_at,
        })),
        count ?? 0,
        { page: data.page, pageSize: MESSAGE_PAGE },
      ),
    };
  });

export const updateMessage = createServerFn({ method: "POST" })
  .validator(updateMessageSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Site.View);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("site_contact_update", {
      p_message: data.id,
      p_status: data.status,
      p_note: data.note ?? "",
    });
    if (error) return fail(error);
    return { ok: true };
  });
