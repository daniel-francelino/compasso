import {
  ApprovalOutcome,
  ApprovalRequestStatus,
  ApprovalStage,
  BrandMemberStatus,
  CalendarAlert,
  CalendarEntryKind,
  CalendarEventType,
  CalendarNoteKind,
  CalendarNoteRepeat,
  CalendarView,
  CommentVisibility,
  ContactMessageStatus,
  ContentFormat,
  ContentTypeColor,
  DashboardReason,
  EditorialStatus,
  InvitationStatus,
  LinkKind,
  MediaShareStatus,
  Platform,
  ProfileKind,
  ProfileStatus,
  PublicShareState,
  PublicationStatus,
  SectionAccent,
  SectionBackground,
  SectionSpacing,
  SitePageKind,
  SitePageStatus,
} from "@/lib/shared/enums";

export const profileStatusLabels: Record<ProfileStatus, string> = {
  [ProfileStatus.Pending]: "Em análise",
  [ProfileStatus.Approved]: "Ativo",
  [ProfileStatus.Rejected]: "Recusado",
  [ProfileStatus.Suspended]: "Suspenso",
};

export const profileKindLabels: Record<ProfileKind, string> = {
  [ProfileKind.Internal]: "Equipe",
  [ProfileKind.External]: "Cliente",
};

export const invitationStatusLabels: Record<InvitationStatus, string> = {
  [InvitationStatus.Pending]: "Pendente",
  [InvitationStatus.Accepted]: "Aceito",
  [InvitationStatus.Revoked]: "Revogado",
  [InvitationStatus.Expired]: "Expirado",
};

export const brandMemberStatusLabels: Record<BrandMemberStatus, string> = {
  [BrandMemberStatus.Active]: "Ativo",
  [BrandMemberStatus.Revoked]: "Revogado",
};

export const platformLabels: Record<Platform, string> = {
  [Platform.Instagram]: "Instagram",
  [Platform.Facebook]: "Facebook",
  [Platform.Linkedin]: "LinkedIn",
  [Platform.Tiktok]: "TikTok",
  [Platform.Youtube]: "YouTube",
  [Platform.X]: "X",
  [Platform.Pinterest]: "Pinterest",
  [Platform.Threads]: "Threads",
  [Platform.Email]: "E-mail",
  [Platform.Blog]: "Blog",
  [Platform.Other]: "Outro",
};

export const editorialStatusLabels: Record<EditorialStatus, string> = {
  [EditorialStatus.Draft]: "Rascunho",
  [EditorialStatus.Planning]: "Em planejamento",
  [EditorialStatus.AwaitingPlanApproval]: "Planejamento em aprovação",
  [EditorialStatus.PlanChangesRequested]: "Alterações no planejamento",
  [EditorialStatus.PlanApproved]: "Planejamento aprovado",
  [EditorialStatus.InProduction]: "Em produção",
  [EditorialStatus.InternalReview]: "Em revisão interna",
  [EditorialStatus.AwaitingApproval]: "Aguardando aprovação",
  [EditorialStatus.ChangesRequested]: "Alterações solicitadas",
  [EditorialStatus.Approved]: "Aprovado",
  [EditorialStatus.Published]: "Publicado",
  [EditorialStatus.Cancelled]: "Cancelado",
};

export const approvalStageLabels: Record<ApprovalStage, string> = {
  [ApprovalStage.Plan]: "Planejamento",
  [ApprovalStage.Art]: "Artes",
};

export const publicationStatusLabels: Record<PublicationStatus, string> = {
  [PublicationStatus.Unplanned]: "Não planejada",
  [PublicationStatus.Planned]: "Planejada",
  [PublicationStatus.PublishedManually]: "Publicada",
  [PublicationStatus.Cancelled]: "Cancelada",
};

export const contentFormatLabels: Record<ContentFormat, string> = {
  [ContentFormat.Image]: "Post",
  [ContentFormat.Carousel]: "Carrossel",
  [ContentFormat.Video]: "Vídeo",
  [ContentFormat.Text]: "Texto",
  [ContentFormat.Story]: "Story",
  [ContentFormat.Reel]: "Reel",
  [ContentFormat.Article]: "Artigo",
  [ContentFormat.Other]: "Outro",
};

export const approvalRequestStatusLabels: Record<ApprovalRequestStatus, string> = {
  [ApprovalRequestStatus.Pending]: "Pendente",
  [ApprovalRequestStatus.Approved]: "Aprovada",
  [ApprovalRequestStatus.ChangesRequested]: "Alterações solicitadas",
  [ApprovalRequestStatus.Superseded]: "Substituída",
  [ApprovalRequestStatus.Cancelled]: "Cancelada",
};

export const approvalOutcomeLabels: Record<ApprovalOutcome, string> = {
  [ApprovalOutcome.Approved]: "Aprovado",
  [ApprovalOutcome.ChangesRequested]: "Alterações solicitadas",
};

export const commentVisibilityLabels: Record<CommentVisibility, string> = {
  [CommentVisibility.Internal]: "Interno",
  [CommentVisibility.External]: "Externo",
};

export const dashboardReasonLabels: Record<DashboardReason, string> = {
  [DashboardReason.ApprovalOverdue]: "Aprovação atrasada",
  [DashboardReason.ChangesRequested]: "Alterações solicitadas",
  [DashboardReason.ProductionOverdue]: "Prazo de produção vencido",
  [DashboardReason.PlannedDatePassed]: "Data prevista ultrapassada",
  [DashboardReason.ApproverWithoutAccess]: "Ninguém pode aprovar",
};

export const calendarViewLabels: Record<CalendarView, string> = {
  [CalendarView.Month]: "Mês",
  [CalendarView.Week]: "Semana",
  [CalendarView.List]: "Lista",
};

export const calendarEntryKindLabels: Record<CalendarEntryKind, string> = {
  [CalendarEntryKind.Publication]: "Publicação planejada",
  [CalendarEntryKind.Published]: "Publicado",
  [CalendarEntryKind.ApprovalDeadline]: "Prazo de aprovação",
  [CalendarEntryKind.ProductionDeadline]: "Prazo de produção",
  [CalendarEntryKind.Idea]: "Ideia",
  [CalendarEntryKind.Date]: "Data",
  [CalendarEntryKind.Event]: "Evento",
};

export const calendarNoteKindLabels: Record<CalendarNoteKind, string> = {
  [CalendarNoteKind.Idea]: "Ideia",
  [CalendarNoteKind.Date]: "Data",
  [CalendarNoteKind.Event]: "Evento",
};

export const calendarEventTypeLabels: Record<CalendarEventType, string> = {
  [CalendarEventType.Shoot]: "Captação",
  [CalendarEventType.Meeting]: "Reunião",
  [CalendarEventType.Other]: "Outro evento",
};

export const calendarNoteRepeatLabels: Record<CalendarNoteRepeat, string> = {
  [CalendarNoteRepeat.None]: "Não repetir",
  [CalendarNoteRepeat.Weekly]: "Toda semana",
  [CalendarNoteRepeat.Monthly]: "Todo mês",
  [CalendarNoteRepeat.Yearly]: "Todo ano",
};

export const contentTypeColorLabels: Record<ContentTypeColor, string> = {
  [ContentTypeColor.Violet]: "Violeta",
  [ContentTypeColor.Orchid]: "Orquídea",
  [ContentTypeColor.Rose]: "Rosa",
  [ContentTypeColor.Peach]: "Pêssego",
  [ContentTypeColor.Coral]: "Coral",
  [ContentTypeColor.Sage]: "Sálvia",
  [ContentTypeColor.Cactus]: "Cacto",
  [ContentTypeColor.InkSoft]: "Azul-marinho",
};

export const calendarAlertLabels: Record<CalendarAlert, string> = {
  [CalendarAlert.TooManyOnDay]: "Muitas publicações neste canal no mesmo dia",
  [CalendarAlert.TooClose]: "Outra publicação neste canal em menos de 30 minutos",
  [CalendarAlert.NotApprovedYet]: "Ainda não aprovado",
  [CalendarAlert.DatePassed]: "A data já passou e a publicação não foi registrada",
};

export const sitePageKindLabels: Record<SitePageKind, string> = {
  [SitePageKind.Home]: "Início",
  [SitePageKind.About]: "Sobre",
  [SitePageKind.Services]: "Serviços",
  [SitePageKind.Portfolio]: "Portfólio",
  [SitePageKind.CaseStudy]: "Case",
  [SitePageKind.Contact]: "Contato",
  [SitePageKind.BlogPost]: "Artigo",
  [SitePageKind.Generic]: "Página livre",
};

export const linkKindLabels: Record<LinkKind, string> = {
  [LinkKind.Page]: "Uma página do site",
  [LinkKind.Anchor]: "Uma seção de uma página",
  [LinkKind.CaseStudy]: "Um case",
  [LinkKind.Url]: "Um endereço",
  [LinkKind.Whatsapp]: "WhatsApp",
  [LinkKind.Email]: "E-mail",
  [LinkKind.Phone]: "Telefone",
};

export const contactMessageStatusLabels: Record<ContactMessageStatus, string> = {
  [ContactMessageStatus.New]: "Nova",
  [ContactMessageStatus.Answered]: "Respondida",
  [ContactMessageStatus.Discarded]: "Descartada",
};

export const sectionBackgroundLabels: Record<SectionBackground, string> = {
  [SectionBackground.Ivory]: "Marfim",
  [SectionBackground.Cream]: "Creme",
  [SectionBackground.Peach]: "Pêssego",
};

export const sectionSpacingLabels: Record<SectionSpacing, string> = {
  [SectionSpacing.Small]: "Compacto",
  [SectionSpacing.Medium]: "Médio",
  [SectionSpacing.Large]: "Amplo",
};

export const sectionAccentLabels: Record<SectionAccent, string> = {
  [SectionAccent.Violet]: "Violeta",
  [SectionAccent.Coral]: "Coral",
  [SectionAccent.Orchid]: "Orquídea",
};

export const sitePageStatusLabels: Record<SitePageStatus, string> = {
  [SitePageStatus.Draft]: "Fora do site",
  [SitePageStatus.Published]: "No ar",
  [SitePageStatus.Unpublished]: "Despublicada",
};

export const mediaShareStatusLabels: Record<MediaShareStatus, string> = {
  [MediaShareStatus.Active]: "Ativo",
  [MediaShareStatus.Revoked]: "Encerrado",
  [MediaShareStatus.TargetDeleted]: "Arquivo removido",
};

export const publicShareStateMessages: Record<
  Exclude<PublicShareState, typeof PublicShareState.Ok | typeof PublicShareState.PasswordRequired>,
  { title: string; description: string }
> = {
  [PublicShareState.NotFound]: {
    title: "Link não encontrado",
    description: "Confira o endereço ou peça um novo link a quem compartilhou.",
  },
  [PublicShareState.Revoked]: {
    title: "Link encerrado",
    description: "Quem compartilhou encerrou este link.",
  },
  [PublicShareState.Unavailable]: {
    title: "Arquivo indisponível",
    description: "O que foi compartilhado não existe mais.",
  },
  [PublicShareState.Expired]: {
    title: "Link expirado",
    description: "A validade deste link terminou. Peça um novo a quem compartilhou.",
  },
  [PublicShareState.Locked]: {
    title: "Acesso bloqueado por alguns minutos",
    description: "Houve tentativas demais com senha errada. Tente de novo mais tarde.",
  },
  [PublicShareState.Exhausted]: {
    title: "Limite de downloads atingido",
    description: "Este link não aceita mais downloads. Peça um novo a quem compartilhou.",
  },
  [PublicShareState.WrongPassword]: {
    title: "Senha incorreta",
    description: "Confira a senha e tente de novo.",
  },
  [PublicShareState.DownloadDisabled]: {
    title: "Download desativado",
    description: "Este link permite só visualizar.",
  },
};
