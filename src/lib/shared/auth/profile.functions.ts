import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireApprovedServer } from "@/lib/shared/auth/server-guards.server";
import { MIN_PASSWORD_LENGTH } from "@/lib/shared/auth/schemas";
import { logError } from "@/lib/shared/logger";
import { type Result, denied, fail } from "@/lib/shared/server-utils";

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
