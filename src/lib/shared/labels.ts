import {
  ApprovalOutcome,
  ApprovalRequestStatus,
  BrandMemberStatus,
  CommentVisibility,
  ContentFormat,
  DashboardReason,
  EditorialStatus,
  InvitationStatus,
  Platform,
  ProfileKind,
  ProfileStatus,
  PublicationStatus,
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
  [EditorialStatus.InProduction]: "Em produção",
  [EditorialStatus.InternalReview]: "Em revisão interna",
  [EditorialStatus.AwaitingApproval]: "Aguardando aprovação",
  [EditorialStatus.ChangesRequested]: "Alterações solicitadas",
  [EditorialStatus.Approved]: "Aprovado",
  [EditorialStatus.Cancelled]: "Cancelado",
};

export const publicationStatusLabels: Record<PublicationStatus, string> = {
  [PublicationStatus.Unplanned]: "Não planejada",
  [PublicationStatus.Planned]: "Planejada",
  [PublicationStatus.PublishedManually]: "Publicada manualmente",
  [PublicationStatus.Cancelled]: "Cancelada",
};

export const contentFormatLabels: Record<ContentFormat, string> = {
  [ContentFormat.Image]: "Imagem",
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
  [DashboardReason.ApproverWithoutAccess]: "Aprovador sem acesso",
};
