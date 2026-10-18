import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { type Result, denied, fail } from "@/lib/shared/server-utils";

export type KindDefaults = {
  kind: string;
  title: string;
  schedulable: boolean;
  defaultLeadDays: number[] | null;
  defaultEmail: boolean;
};

export const saveKindDefaultsSchema = z.object({
  kind: z.string().max(60),
  defaultLeadDays: z.array(z.number().int().min(0).max(30)).min(1).max(5).nullable(),
  defaultEmail: z.boolean(),
});

export const listKindDefaults = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ kinds: KindDefaults[] }>> => {
    const caller = await requireActionServer(Action.Notifications.Configure);
    if (caller === null) return denied;
    const { data, error } = await caller.supabase
      .from("notification_kinds")
      .select("kind, title, schedulable, default_lead_days, default_email")
      .eq("available", true)
      .order("kind");
    if (error) return fail(error);
    return {
      ok: true,
      kinds: data.map((row) => ({
        kind: row.kind,
        title: row.title,
        schedulable: row.schedulable,
        defaultLeadDays: row.default_lead_days,
        defaultEmail: row.default_email,
      })),
    };
  },
);

export const saveKindDefaults = createServerFn({ method: "POST" })
  .validator(saveKindDefaultsSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Notifications.Configure);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("notification_kind_save", {
      p_kind: data.kind,
      p_default_lead_days: data.defaultLeadDays,
      p_default_email: data.defaultEmail,
    });
    if (error) return fail(error);
    return { ok: true };
  });
