import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import type { SettingKey } from "@/lib/shared/enums";
import { policyDefaults, policySchemas, saveSettingSchema } from "@/lib/shared/settings/schemas";
import { type Result, denied, fail, invalid, parseOutput } from "@/lib/shared/server-utils";

export type SettingRecord = {
  key: SettingKey;
  value: Record<string, string | number | boolean>;
  version: number;
};

const versionSchema = z.object({ version: z.number().int() });

export const listSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ settings: SettingRecord[] }>> => {
    const caller = await requireActionServer(Action.Settings.Manage);
    if (caller === null) return denied;
    const { data, error } = await caller.supabase
      .from("organization_settings")
      .select("key, value, version");
    if (error) return fail(error);

    const stored = new Map(data.map((row) => [row.key, row]));
    const settings = (Object.keys(policySchemas) as SettingKey[]).map((key) => {
      const row = stored.get(key);
      const parsed = policySchemas[key].safeParse(row?.value);
      return {
        key,
        value: parsed.success ? parsed.data : { ...policyDefaults[key] },
        version: row?.version ?? 0,
      };
    });
    return { ok: true, settings };
  },
);

export const saveSetting = createServerFn({ method: "POST" })
  .validator(saveSettingSchema)
  .handler(async ({ data }): Promise<Result<{ version: number }>> => {
    const caller = await requireActionServer(Action.Settings.Manage);
    if (caller === null) return denied;

    const parsed = policySchemas[data.key].safeParse(data.value);
    if (!parsed.success) return invalid("Confira os campos destacados.");

    const { data: row, error } = await caller.supabase.rpc("organization_setting_save", {
      p_key: data.key,
      p_value: parsed.data,
      p_expected_version: data.expectedVersion,
    });
    if (error) return fail(error);
    return parseOutput(versionSchema, row);
  });
