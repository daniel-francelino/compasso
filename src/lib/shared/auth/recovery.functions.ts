import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "@/lib/shared/auth/schemas";
import { logError } from "@/lib/shared/logger";
import { AppRoute } from "@/lib/shared/routes";
import { type Result, fail } from "@/lib/shared/server-utils";
import { siteOrigin } from "@/lib/shared/site-url.server";
import { serverClient } from "@/lib/shared/supabase/server-client.server";

export const recoverPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe o e-mail.")
    .email("Informe um e-mail válido.")
    .max(254, "O e-mail é longo demais."),
});

export const resetPasswordSchema = z
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

const codeSchema = z.object({ code: z.string().min(8).max(200) });

export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator(recoverPasswordSchema)
  .handler(async ({ data }): Promise<Result> => {
    const redirectTo = `${siteOrigin()}${AppRoute.Callback}?next=${AppRoute.ResetPassword}`;
    const { error } = await serverClient().auth.resetPasswordForEmail(data.email, { redirectTo });
    if (error) logError("password reset request failed", error.code);
    return { ok: true };
  });

export const exchangeAuthCode = createServerFn({ method: "POST" })
  .validator(codeSchema)
  .handler(async ({ data }): Promise<Result> => {
    const { error } = await serverClient().auth.exchangeCodeForSession(data.code);
    if (error) return fail({ message: "auth_link_invalid" });
    return { ok: true };
  });

export const resetPassword = createServerFn({ method: "POST" })
  .validator(resetPasswordSchema)
  .handler(async ({ data }): Promise<Result> => {
    const supabase = serverClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user === null) return fail({ message: "auth_link_invalid" });
    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) {
      logError("password reset failed", error.code);
      return fail({ message: "unknown" });
    }
    return { ok: true };
  });
