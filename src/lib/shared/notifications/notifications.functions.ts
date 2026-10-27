import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireApprovedServer } from "@/lib/shared/auth/server-guards.server";
import type { NotificationSeverity } from "@/lib/shared/enums";
import { PAGE_SIZE } from "@/lib/shared/list-search";
import { type Page, type Result, denied, fail, pageOf, rangeOf } from "@/lib/shared/server-utils";
import { nowIso } from "@/lib/shared/dates";

export const NotificationFilter = {
  All: "all",
  Unread: "unread",
  Snoozed: "snoozed",
} as const;

export type NotificationFilter = (typeof NotificationFilter)[keyof typeof NotificationFilter];

export type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  severity: NotificationSeverity;
  readAt: string | null;
  snoozedUntil: string | null;
  createdAt: string;
};

export type PreferenceRow = {
  kind: string;
  title: string;
  schedulable: boolean;
  enabled: boolean;
  email: boolean;
  leadDays: number[] | null;
  defaultLeadDays: number[] | null;
};

const columns = "id, kind, title, body, link, severity, read_at, snoozed_until, created_at";

const listSchema = z.object({
  filter: z.nativeEnum(NotificationFilter).default(NotificationFilter.All),
  page: z.number().int().min(1).max(10000).default(1),
});

const idsSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) });
const snoozeSchema = z.object({ id: z.string().uuid(), until: z.string().datetime() });
const preferenceSchema = z.object({
  kind: z.string().max(60),
  enabled: z.boolean(),
  email: z.boolean(),
  leadDays: z.array(z.number().int().min(0).max(30)).max(5).nullable(),
});

const toRow = (row: {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  severity: string;
  read_at: string | null;
  snoozed_until: string | null;
  created_at: string;
}): NotificationRow => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  body: row.body,
  link: row.link,
  severity: row.severity as NotificationSeverity,
  readAt: row.read_at,
  snoozedUntil: row.snoozed_until,
  createdAt: row.created_at,
});

export const listNotifications = createServerFn({ method: "GET" })
  .validator(listSchema)
  .handler(async ({ data }): Promise<Result<Page<NotificationRow>>> => {
    const caller = await requireApprovedServer();
    if (caller === null) return denied;

    const now = nowIso();
    const [from, to] = rangeOf(data.page, PAGE_SIZE);
    let query = caller.supabase
      .from("notifications")
      .select(columns, { count: "exact" })
      .eq("status", "active");
    if (data.filter === NotificationFilter.Snoozed) query = query.gt("snoozed_until", now);
    else query = query.or(`snoozed_until.is.null,snoozed_until.lte.${now}`);
    if (data.filter === NotificationFilter.Unread) query = query.is("read_at", null);

    const {
      data: rows,
      count,
      error,
    } = await query.order("created_at", { ascending: false }).range(from, to);
    if (error) return fail(error);
    return {
      ok: true,
      ...pageOf((rows ?? []).map(toRow), count ?? 0, { page: data.page, pageSize: PAGE_SIZE }),
    };
  });

export const countUnread = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ count: number }>> => {
    const caller = await requireApprovedServer();
    if (caller === null) return denied;
    const now = nowIso();
    const { count, error } = await caller.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .is("read_at", null)
      .or(`snoozed_until.is.null,snoozed_until.lte.${now}`);
    if (error) return fail(error);
    return { ok: true, count: count ?? 0 };
  },
);

export const markRead = createServerFn({ method: "POST" })
  .validator(idsSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireApprovedServer();
    if (caller === null) return denied;
    const { error } = await caller.supabase
      .from("notifications")
      .update({ read_at: nowIso() })
      .in("id", data.ids);
    if (error) return fail(error);
    return { ok: true };
  });

export const markAllRead = createServerFn({ method: "POST" }).handler(async (): Promise<Result> => {
  const caller = await requireApprovedServer();
  if (caller === null) return denied;
  const { error } = await caller.supabase
    .from("notifications")
    .update({ read_at: nowIso() })
    .is("read_at", null);
  if (error) return fail(error);
  return { ok: true };
});

export const snoozeNotification = createServerFn({ method: "POST" })
  .validator(snoozeSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireApprovedServer();
    if (caller === null) return denied;
    const { error } = await caller.supabase
      .from("notifications")
      .update({ read_at: null, snoozed_until: data.until })
      .eq("id", data.id);
    if (error) return fail(error);
    return { ok: true };
  });

export const listPreferences = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ preferences: PreferenceRow[] }>> => {
    const caller = await requireApprovedServer();
    if (caller === null) return denied;

    const [kinds, prefs, actions] = await Promise.all([
      caller.supabase
        .from("notification_kinds")
        .select("kind, title, required_action, schedulable, default_lead_days, default_email")
        .eq("available", true)
        .order("kind"),
      caller.supabase.from("notification_preferences").select("kind, enabled, email, lead_days"),
      caller.supabase.rpc("my_actions"),
    ]);
    if (kinds.error) return fail(kinds.error);
    if (prefs.error) return fail(prefs.error);
    if (actions.error) return fail(actions.error);

    const stored = new Map(prefs.data.map((row) => [row.kind, row]));
    const mine = new Set(actions.data);
    const preferences = kinds.data
      .filter((kind) => mine.has(kind.required_action))
      .map((kind) => {
        const row = stored.get(kind.kind);
        return {
          kind: kind.kind,
          title: kind.title,
          schedulable: kind.schedulable,
          enabled: row?.enabled ?? true,
          email: row?.email ?? kind.default_email,
          leadDays: row?.lead_days ?? null,
          defaultLeadDays: kind.default_lead_days,
        };
      });
    return { ok: true, preferences };
  },
);

export const savePreference = createServerFn({ method: "POST" })
  .validator(preferenceSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireApprovedServer();
    if (caller === null) return denied;

    const values = { enabled: data.enabled, email: data.email, lead_days: data.leadDays };
    const updated = await caller.supabase
      .from("notification_preferences")
      .update(values)
      .eq("user_id", caller.userId)
      .eq("kind", data.kind)
      .select("kind");
    if (updated.error) return fail(updated.error);
    if (updated.data.length > 0) return { ok: true };

    const inserted = await caller.supabase
      .from("notification_preferences")
      .insert({ user_id: caller.userId, kind: data.kind, ...values });
    if (inserted.error) return fail(inserted.error);
    return { ok: true };
  });
