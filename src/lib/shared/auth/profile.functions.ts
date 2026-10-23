import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireApprovedServer } from "@/lib/shared/auth/server-guards.server";
import { MIN_PASSWORD_LENGTH } from "@/lib/shared/auth/schemas";
import { logError } from "@/lib/shared/logger";
import { INTERNAL_URL_SECONDS } from "@/lib/shared/media/limits";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";
import { serverStorage } from "@/lib/shared/storage/server-storage.server";

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome.").max(120, "O nome é longo demais."),
});

export const changePasswordSchema = z
  .object({
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`)
      .max(200, "A senha é longa demais."),
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation, {
    message: "As senhas não são iguais.",
    path: ["confirmation"],
  });

export const updateProfile = createServerFn({ method: "POST" })
  .validator(updateProfileSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireApprovedServer();
    if (caller === null) return denied;
    const { error } = await caller.supabase
      .from("profiles")
      .update({ full_name: data.fullName })
      .eq("id", caller.userId);
    if (error) return fail(error);
    return { ok: true };
  });

export const changePassword = createServerFn({ method: "POST" })
  .validator(changePasswordSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireApprovedServer();
    if (caller === null) return denied;
    const { error } = await caller.supabase.auth.updateUser({ password: data.password });
    if (error) {
      logError("password change failed", error.code);
      return fail({ message: "unknown" });
    }
    return { ok: true };
  });

export const setAvatarSchema = z.object({ versionId: z.string().uuid().nullable() });

export const setAvatar = createServerFn({ method: "POST" })
  .validator(setAvatarSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireApprovedServer();
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("profile_set_avatar", {
      p_version: data.versionId,
    });
    if (error) return fail(error);
    return { ok: true };
  });

const MAX_AVATAR_IDS = 100;
const avatarKeysSchema = z.record(z.string(), z.string());

export const getAvatarUrls = createServerFn({ method: "POST" })
  .validator(z.object({ ids: z.array(z.string().uuid()).max(MAX_AVATAR_IDS) }))
  .handler(async ({ data }): Promise<Result<{ urls: Record<string, string> }>> => {
    const caller = await requireApprovedServer();
    if (caller === null) return denied;
    if (data.ids.length === 0) return { ok: true, urls: {} };
    const storage = serverStorage();
    if (storage === null) return { ok: true, urls: {} };
    const { data: row, error } = await caller.supabase.rpc("person_avatar_keys", {
      p_ids: data.ids,
    });
    if (error) return fail(error);
    const keys = parseOutput(z.object({ keys: avatarKeysSchema }), { keys: row });
    if (!keys.ok) return keys;
    const signed = await storage.signUrls(Object.values(keys.keys), INTERNAL_URL_SECONDS);
    const urls: Record<string, string> = {};
    for (const [id, key] of Object.entries(keys.keys)) {
      const url = signed.get(key);
      if (url !== undefined) urls[id] = url;
    }
    return { ok: true, urls };
  });
