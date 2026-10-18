import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe o e-mail.")
    .email("Informe um e-mail válido.")
    .max(254, "O e-mail é longo demais."),
  password: z.string().min(1, "Informe a senha.").max(200, "A senha é longa demais."),
});

export type LoginInput = z.infer<typeof loginSchema>;
