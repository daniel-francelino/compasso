import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import type { SettingKey } from "@/lib/shared/enums";
import {
  organizationSchema,
  policyDefaults,
  policySchemas,
  saveSettingSchema,
} from "@/lib/shared/settings/schemas";
import { type Result, denied, fail, invalid, parseOutput } from "@/lib/shared/server-utils";

export type OrganizationRecord = {
  name: string;
  legalName: string | null;
  taxId: string | null;
  defaultTimezone: string;
  contactEmail: string | null;
  version: number;
};

export type SettingRecord = {
  key: SettingKey;
  value: Record<string, string | number | boolean>;
  version: number;
};

const versionSchema = z.object({ version: z.number().int() });

export const getOrganization = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ organization: OrganizationRecord }>> => {
    const caller = await requireActionServer(Action.Settings.Manage);
    if (caller === null) return denied;
    const { data, error } = await caller.supabase
      .from("organizations")
      .select("name, legal_name, tax_id, default_timezone, contact_email, version")
      .single();
    if (error) return fail(error);
    return {
      ok: true,
      organization: {
        name: data.name,
        legalName: data.legal_name,
        taxId: data.tax_id,
        defaultTimezone: data.default_timezone,
        contactEmail: data.contact_email,
        version: data.version,
      },
    };
  },
);

export const saveOrganization = createServerFn({ method: "POST" })
  .validator(organizationSchema)
  .handler(async ({ data }): Promise<Result<{ version: number }>> => {
    const caller = await requireActionServer(Action.Settings.Manage);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("organization_save", {
      p_organization: {
        name: data.name,
        legal_name: data.legalName ?? null,
        tax_id: data.taxId ?? null,
        default_timezone: data.defaultTimezone,
        contact_email: data.contactEmail ?? null,
        expected_version: data.expectedVersion,
      },
    });
    if (error) return fail(error);
    return parseOutput(versionSchema, row);
  });

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
