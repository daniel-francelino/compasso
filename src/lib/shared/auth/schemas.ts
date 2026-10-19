import { z } from "zod";
import { ProfileStatus } from "@/lib/shared/enums";

export const MIN_PASSWORD_LENGTH = 10;

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

export const invitationGrantSchema = z.object({
  brandId: z.string().uuid(),
  canDecide: z.boolean(),
});

export const createInvitationSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe o e-mail.")
    .email("Informe um e-mail válido.")
    .max(254, "O e-mail é longo demais."),
  roleId: z.string().uuid("Escolha um perfil."),
  grants: z.array(invitationGrantSchema).max(50),
  sendEmail: z.boolean(),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const invitationIdSchema = z.object({ id: z.string().uuid() });

export const resendInvitationSchema = z.object({
  id: z.string().uuid(),
  sendEmail: z.boolean(),
});

export const invitationTokenSchema = z.object({ token: z.string().min(20).max(100) });

export const acceptInvitationSchema = z.object({
  token: z.string().min(20).max(100),
  fullName: z.string().trim().min(2, "Informe seu nome.").max(120, "O nome é longo demais."),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`)
    .max(200, "A senha é longa demais."),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const setAccessSchema = z.object({
  profileId: z.string().uuid(),
  status: z.nativeEnum(ProfileStatus),
  roleId: z.string().uuid().optional(),
});

export const saveRoleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Informe o nome do perfil.").max(60, "O nome é longo demais."),
  description: z.string().trim().max(300, "A descrição é longa demais.").optional(),
  portalOnly: z.boolean(),
  actions: z.array(z.string().max(60)).max(200),
});

export type SaveRoleInput = z.infer<typeof saveRoleSchema>;

export const roleIdSchema = z.object({ id: z.string().uuid() });
