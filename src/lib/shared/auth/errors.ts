import type { ValueOf } from "@/lib/shared/utils";

export const ErrorCode = {
  Denied: "denied",
  NotFound: "not_found",
  Conflict: "conflict",
  InUse: "in_use",
  Invalid: "invalid",
  Unavailable: "unavailable",
  Unknown: "unknown",
} as const;
export type ErrorCode = ValueOf<typeof ErrorCode>;

type CatalogEntry = { category: ErrorCode; message: string };

const catalog: Record<string, CatalogEntry> = {
  denied: { category: ErrorCode.Denied, message: "Você não tem permissão para fazer isso." },
  not_found: { category: ErrorCode.NotFound, message: "Não encontramos este registro." },
  conflict: {
    category: ErrorCode.Conflict,
    message: "Este registro foi alterado por outra pessoa. Recarregue para continuar.",
  },
  invalid_input: { category: ErrorCode.Invalid, message: "Confira os campos destacados." },
  rate_limited: {
    category: ErrorCode.Unavailable,
    message: "Muitas tentativas. Tente novamente em alguns minutos.",
  },
  unknown: { category: ErrorCode.Unknown, message: "Algo deu errado. Tente novamente." },
  invalid_credentials: { category: ErrorCode.Denied, message: "E-mail ou senha incorretos." },
  last_owner: {
    category: ErrorCode.Invalid,
    message: "Precisa existir ao menos um Proprietário ativo.",
  },
  self_change_forbidden: {
    category: ErrorCode.Denied,
    message: "Você não pode alterar o seu próprio acesso.",
  },
  role_in_use: {
    category: ErrorCode.InUse,
    message: "Este perfil está atribuído a pessoas e não pode ser excluído.",
  },
  role_system_protected: {
    category: ErrorCode.Denied,
    message: "Este perfil do sistema não pode ser alterado.",
  },
  role_not_assignable: {
    category: ErrorCode.Denied,
    message: "Você não pode atribuir este perfil.",
  },
  action_requires_read: {
    category: ErrorCode.Invalid,
    message: "Uma ação de escrita exige a ação de leitura correspondente.",
  },
  portal_role_internal_action: {
    category: ErrorCode.Invalid,
    message: "Perfis do portal só podem ter ações do portal.",
  },
  admin_only_action: {
    category: ErrorCode.Denied,
    message: "Esta ação é exclusiva do Proprietário.",
  },
  client_has_brands: {
    category: ErrorCode.InUse,
    message: "Este cliente tem marcas. Arquive em vez de excluir.",
  },
  contact_email_invalid: {
    category: ErrorCode.Invalid,
    message: "E-mail do contato inválido.",
  },
  brand_name_taken: {
    category: ErrorCode.Invalid,
    message: "Já existe uma marca com este nome neste cliente.",
  },
  brand_not_empty: {
    category: ErrorCode.InUse,
    message: "Esta marca tem histórico. Arquive em vez de excluir.",
  },
  member_kind_mismatch: {
    category: ErrorCode.Invalid,
    message: "O tipo do vínculo não corresponde ao tipo do usuário.",
  },
  last_internal_member: {
    category: ErrorCode.Invalid,
    message: "A marca precisa manter ao menos um membro interno.",
  },
  channel_duplicate: {
    category: ErrorCode.Invalid,
    message: "Este perfil já está cadastrado nesta marca.",
  },
  channel_in_use: {
    category: ErrorCode.InUse,
    message: "Este canal já foi usado. Arquive em vez de excluir.",
  },
  platform_change_forbidden: {
    category: ErrorCode.Invalid,
    message: "A plataforma de um canal em uso não pode ser alterada.",
  },
  auth_link_invalid: {
    category: ErrorCode.Invalid,
    message: "Este link não vale mais. Peça um novo.",
  },
  invitation_invalid: {
    category: ErrorCode.Invalid,
    message: "Este convite expirou ou já foi usado. Peça um novo convite.",
  },
  invitation_email_mismatch: {
    category: ErrorCode.Invalid,
    message: "O e-mail desta conta não é o do convite.",
  },
  approver_without_access: {
    category: ErrorCode.Invalid,
    message: "O aprovador designado não tem mais acesso. Escolha outro.",
  },
  channel_archived: {
    category: ErrorCode.Invalid,
    message: "Este canal está arquivado e não aceita novos itens.",
  },
  audit_immutable: {
    category: ErrorCode.Denied,
    message: "Registros de auditoria não podem ser alterados.",
  },
};

const POSTGRES_INSUFFICIENT_PRIVILEGE = "42501";

export type DatabaseError = { message: string; code?: string | undefined };

const entryOf = (error: DatabaseError): CatalogEntry => {
  if (error.code === POSTGRES_INSUFFICIENT_PRIVILEGE) return catalog["denied"] as CatalogEntry;
  return catalog[error.message.trim()] ?? (catalog["unknown"] as CatalogEntry);
};

export const dbErrorCode = (error: DatabaseError): ErrorCode => entryOf(error).category;

export const dbErrorMessage = (error: DatabaseError, fallback?: string): string => {
  const entry = entryOf(error);
  return entry.category === ErrorCode.Unknown ? (fallback ?? entry.message) : entry.message;
};
