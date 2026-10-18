import {
  BrandMemberStatus,
  InvitationStatus,
  Platform,
  ProfileKind,
  ProfileStatus,
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
