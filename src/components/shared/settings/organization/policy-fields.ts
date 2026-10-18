import { SettingKey } from "@/lib/shared/enums";

export type PolicyField = {
  name: string;
  label: string;
  type: "number" | "boolean" | "text";
  hint?: string;
};

export const policyFields: Record<SettingKey, PolicyField[]> = {
  [SettingKey.Approvals]: [
    {
      name: "deadlineDays",
      label: "Prazo padrão para aprovar (dias)",
      type: "number",
      hint: "Entre 1 e 60 dias.",
    },
  ],
  [SettingKey.Calendar]: [
    { name: "weekStartsOnMonday", label: "A semana começa na segunda-feira", type: "boolean" },
  ],
  [SettingKey.Uploads]: [
    { name: "maxImageMb", label: "Tamanho máximo de imagem (MB)", type: "number" },
    { name: "maxVideoMb", label: "Tamanho máximo de vídeo (MB)", type: "number" },
    { name: "maxDocumentMb", label: "Tamanho máximo de documento (MB)", type: "number" },
    { name: "quotaMb", label: "Espaço total de armazenamento (MB)", type: "number" },
  ],
  [SettingKey.Urls]: [{ name: "httpsOnly", label: "Aceitar apenas links https", type: "boolean" }],
  [SettingKey.Retention]: [
    { name: "auditMonths", label: "Guardar auditoria por (meses)", type: "number" },
    { name: "notificationDays", label: "Guardar avisos lidos por (dias)", type: "number" },
  ],
  [SettingKey.Invitations]: [
    { name: "expiresDays", label: "Validade do convite (dias)", type: "number" },
  ],
  [SettingKey.Security]: [
    {
      name: "requireOwnerMfa",
      label: "Exigir verificação em duas etapas dos Proprietários",
      type: "boolean",
    },
  ],
  [SettingKey.Email]: [
    { name: "senderName", label: "Nome do remetente dos e-mails", type: "text" },
  ],
};
