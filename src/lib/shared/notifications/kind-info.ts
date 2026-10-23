import {
  AlarmClock,
  CalendarCheck,
  CalendarClock,
  ClipboardCheck,
  FileWarning,
  Globe,
  Hourglass,
  Mail,
  MailCheck,
  MessageSquare,
  Replace,
  Send,
  Timer,
  TimerOff,
  UserPlus,
  FileUp,
  Bell,
  type LucideIcon,
} from "lucide-react";

export const KindTiming = {
  Before: "before",
  After: "after",
} as const;
export type KindTiming = (typeof KindTiming)[keyof typeof KindTiming];

export type KindInfo = {
  group: string;
  icon: LucideIcon;
  description: string;
  timing?: KindTiming;
};

export const kindGroupOrder = [
  "Aprovações",
  "Produção e publicação",
  "Comentários",
  "Convites",
  "Site",
  "Arquivos",
  "Outros",
] as const;

export const kindInfo: Record<string, KindInfo> = {
  "approval.requested": {
    icon: Send,
    group: "Aprovações",
    description: "Um conteúdo foi enviado e aguarda a decisão de quem aprova.",
  },
  "approval.decided": {
    icon: ClipboardCheck,
    group: "Aprovações",
    description: "Quem aprova aprovou ou pediu alterações no conteúdo enviado.",
  },
  "approval.approved_by_team": {
    icon: ClipboardCheck,
    group: "Aprovações",
    description: "A equipe aprovou no lugar de quem aprova, enquanto havia um pedido aberto.",
  },
  "approval.superseded": {
    icon: Replace,
    group: "Aprovações",
    description: "A versão que ia ser avaliada foi substituída por uma nova.",
  },
  "approval.overdue": {
    icon: AlarmClock,
    group: "Aprovações",
    description: "Uma aprovação passou do prazo sem decisão.",
    timing: KindTiming.After,
  },
  "content.due_soon": {
    icon: Hourglass,
    group: "Produção e publicação",
    description: "O prazo de produção de um conteúdo está chegando.",
    timing: KindTiming.Before,
  },
  "content.overdue": {
    icon: TimerOff,
    group: "Produção e publicação",
    description: "O prazo de produção passou e o conteúdo ainda não está pronto.",
    timing: KindTiming.After,
  },
  "content.publish_due": {
    icon: CalendarCheck,
    group: "Produção e publicação",
    description: "A data planejada passou e a publicação ainda não foi registrada.",
    timing: KindTiming.After,
  },
  "comment.created": {
    icon: MessageSquare,
    group: "Comentários",
    description: "Chegou um comentário em um conteúdo que a pessoa acompanha.",
  },
  "invitation.accepted": {
    icon: MailCheck,
    group: "Convites",
    description: "Alguém aceitou o convite enviado e já pode acessar.",
  },
  "invitation.expiring": {
    icon: Timer,
    group: "Convites",
    description: "Um convite pendente está perto de expirar.",
    timing: KindTiming.Before,
  },
  "site.published": {
    icon: Globe,
    group: "Site",
    description: "Uma versão do site foi publicada ou restaurada.",
  },
  "site.contact_message": {
    icon: Mail,
    group: "Site",
    description: "Chegou uma mensagem pelo formulário de contato do site.",
  },
  "media.upload_failed": {
    icon: FileWarning,
    group: "Arquivos",
    description: "Um envio de arquivo foi recusado na verificação.",
  },
};

export const fallbackKindInfo: KindInfo = { group: "Outros", icon: Bell, description: "" };

export const kindGroupIcons: Record<string, LucideIcon> = {
  Aprovações: ClipboardCheck,
  "Produção e publicação": CalendarClock,
  Comentários: MessageSquare,
  Convites: UserPlus,
  Site: Globe,
  Arquivos: FileUp,
  Outros: Bell,
};
