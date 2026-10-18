import { z } from "zod";
import { SettingKey } from "@/lib/shared/enums";

export const organizationSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(120, "O nome é longo demais."),
  legalName: z.string().trim().max(160, "A razão social é longa demais.").optional(),
  taxId: z.string().trim().max(30, "O documento é longo demais.").optional(),
  defaultTimezone: z.string().trim().min(1, "Escolha o fuso horário.").max(60),
  contactEmail: z
    .union([z.literal(""), z.string().trim().email("Informe um e-mail válido.").max(254)])
    .optional(),
  expectedVersion: z.number().int().min(1),
});

export type OrganizationInput = z.infer<typeof organizationSchema>;

const days = (label: string, min: number, max: number) =>
  z
    .number({ invalid_type_error: `Informe ${label}.` })
    .int()
    .min(min)
    .max(max);

export const policySchemas = {
  [SettingKey.Approvals]: z.object({ deadlineDays: days("o prazo", 1, 60) }),
  [SettingKey.Calendar]: z.object({ weekStartsOnMonday: z.boolean() }),
  [SettingKey.Uploads]: z.object({
    maxImageMb: days("o limite de imagem", 1, 100),
    maxVideoMb: days("o limite de vídeo", 1, 2000),
    maxDocumentMb: days("o limite de documento", 1, 200),
    quotaMb: days("o espaço total", 100, 1_000_000),
  }),
  [SettingKey.Urls]: z.object({ httpsOnly: z.boolean() }),
  [SettingKey.Retention]: z.object({
    auditMonths: days("a retenção da auditoria", 6, 120),
    notificationDays: days("a retenção dos avisos", 30, 365),
  }),
  [SettingKey.Invitations]: z.object({ expiresDays: days("a validade", 1, 30) }),
  [SettingKey.Security]: z.object({ requireOwnerMfa: z.boolean() }),
  [SettingKey.Email]: z.object({ senderName: z.string().trim().min(1).max(80) }),
} as const;

export const policyDefaults = {
  [SettingKey.Approvals]: { deadlineDays: 3 },
  [SettingKey.Calendar]: { weekStartsOnMonday: true },
  [SettingKey.Uploads]: { maxImageMb: 25, maxVideoMb: 100, maxDocumentMb: 50, quotaMb: 5120 },
  [SettingKey.Urls]: { httpsOnly: true },
  [SettingKey.Retention]: { auditMonths: 24, notificationDays: 90 },
  [SettingKey.Invitations]: { expiresDays: 7 },
  [SettingKey.Security]: { requireOwnerMfa: false },
  [SettingKey.Email]: { senderName: "Compasso" },
} as const;

export const saveSettingSchema = z.object({
  key: z.nativeEnum(SettingKey),
  value: z.record(z.union([z.string(), z.number(), z.boolean()])),
  expectedVersion: z.number().int().min(0),
});

export const policyLabels: Record<SettingKey, string> = {
  [SettingKey.Approvals]: "Aprovações",
  [SettingKey.Calendar]: "Calendário",
  [SettingKey.Uploads]: "Envio de arquivos",
  [SettingKey.Urls]: "Links",
  [SettingKey.Retention]: "Retenção de dados",
  [SettingKey.Invitations]: "Convites",
  [SettingKey.Security]: "Segurança",
  [SettingKey.Email]: "E-mail",
};
