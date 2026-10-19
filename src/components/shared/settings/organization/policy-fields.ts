import {
  Archive,
  CalendarDays,
  ClipboardCheck,
  HardDrive,
  Link2,
  Mail,
  ShieldCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { SettingKey } from "@/lib/shared/enums";

export type PolicyField = {
  name: string;
  label: string;
  type: "number" | "boolean" | "text";
  description?: string;
  unit?: string;
};

export type PolicyGroup = {
  icon: LucideIcon;
  description: string;
};

export const policyGroups: Record<SettingKey, PolicyGroup> = {
  [SettingKey.Approvals]: {
    icon: ClipboardCheck,
    description: "Prazo que vale quando quem envia não define um.",
  },
  [SettingKey.Calendar]: {
    icon: CalendarDays,
    description: "Como o calendário aparece para toda a equipe.",
  },
  [SettingKey.Uploads]: {
    icon: HardDrive,
    description: "Limites dos arquivos enviados para a biblioteca.",
  },
  [SettingKey.Urls]: {
    icon: Link2,
    description: "Regras para links digitados nos conteúdos.",
  },
  [SettingKey.Retention]: {
    icon: Archive,
    description: "Por quanto tempo o histórico e os avisos lidos ficam guardados.",
  },
  [SettingKey.Invitations]: {
    icon: UserPlus,
    description: "Por quanto tempo um link de acesso continua valendo.",
  },
  [SettingKey.Security]: {
    icon: ShieldCheck,
    description: "Proteções extras para as contas com mais poder.",
  },
  [SettingKey.Email]: {
    icon: Mail,
    description: "Como os e-mails do Compasso se apresentam.",
  },
};

export const policyFields: Record<SettingKey, PolicyField[]> = {
  [SettingKey.Approvals]: [
    {
      name: "deadlineDays",
      label: "Prazo padrão para aprovar",
      type: "number",
      unit: "dias",
      description: "Entre 1 e 60 dias, contados a partir do envio.",
    },
  ],
  [SettingKey.Calendar]: [
    { name: "weekStartsOnMonday", label: "A semana começa na segunda-feira", type: "boolean" },
  ],
  [SettingKey.Uploads]: [
    { name: "maxImageMb", label: "Tamanho máximo de imagem", type: "number", unit: "MB" },
    { name: "maxVideoMb", label: "Tamanho máximo de vídeo", type: "number", unit: "MB" },
    { name: "maxDocumentMb", label: "Tamanho máximo de documento", type: "number", unit: "MB" },
    {
      name: "quotaMb",
      label: "Espaço total de armazenamento",
      type: "number",
      unit: "MB",
      description: "10240 MB equivalem a 10 GB.",
    },
  ],
  [SettingKey.Urls]: [
    {
      name: "httpsOnly",
      label: "Aceitar apenas links https",
      type: "boolean",
      description: "Links sem https são recusados.",
    },
  ],
  [SettingKey.Retention]: [
    { name: "auditMonths", label: "Guardar a auditoria por", type: "number", unit: "meses" },
    { name: "notificationDays", label: "Guardar avisos lidos por", type: "number", unit: "dias" },
  ],
  [SettingKey.Invitations]: [
    { name: "expiresDays", label: "Validade do link de acesso", type: "number", unit: "dias" },
  ],
  [SettingKey.Security]: [
    {
      name: "requireOwnerMfa",
      label: "Exigir verificação em duas etapas dos Proprietários",
      type: "boolean",
    },
  ],
  [SettingKey.Email]: [
    {
      name: "senderName",
      label: "Nome do remetente dos e-mails",
      type: "text",
      description: "É o nome que a pessoa vê na caixa de entrada.",
    },
  ],
};
