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
  channel_archived: {
    category: ErrorCode.Invalid,
    message: "Este canal está arquivado e não aceita novos itens.",
  },
  channel_required: {
    category: ErrorCode.Invalid,
    message: "Escolha ao menos um canal para enviar.",
  },
  date_in_past: {
    category: ErrorCode.Invalid,
    message: "A data escolhida já passou.",
  },
  local_time_nonexistent: {
    category: ErrorCode.Invalid,
    message: "Este horário não existe nesse dia (mudança de horário de verão).",
  },
  local_time_ambiguous: {
    category: ErrorCode.Invalid,
    message: "Este horário acontece duas vezes nesse dia. Escolha qual.",
  },
  slug_taken: {
    category: ErrorCode.Invalid,
    message: "Já existe uma página com este endereço.",
  },
  slug_reserved: {
    category: ErrorCode.Invalid,
    message: "Este endereço é reservado.",
  },
  page_system_protected: {
    category: ErrorCode.Denied,
    message: "Esta página do sistema não pode ser excluída nem mudar de endereço.",
  },
  page_has_history: {
    category: ErrorCode.InUse,
    message: "Esta página já foi publicada ou autorizada. Tire do ar em vez de excluir.",
  },
  publish_checks_failed: {
    category: ErrorCode.Invalid,
    message: "Corrija os itens destacados antes de publicar.",
  },
  draft_changed: {
    category: ErrorCode.Conflict,
    message: "O conteúdo mudou desde a revisão. Revise de novo antes de publicar.",
  },
  nothing_to_publish: {
    category: ErrorCode.Invalid,
    message: "Não há alterações para publicar.",
  },
  case_study_not_authorized: {
    category: ErrorCode.Invalid,
    message: "Este case não tem autorização para ser publicado.",
  },
  redirect_invalid: {
    category: ErrorCode.Invalid,
    message: "Redirecionamento inválido (ciclo, endereço reservado ou destino inválido).",
  },
  contact_consent_required: {
    category: ErrorCode.Invalid,
    message: "É preciso aceitar o consentimento para enviar a mensagem.",
  },
  media_not_published: {
    category: ErrorCode.Invalid,
    message: "Há imagens que ainda não foram publicadas para o site.",
  },
  contact_unavailable: {
    category: ErrorCode.Unavailable,
    message: "O envio de mensagens está indisponível agora. Tente de novo mais tarde.",
  },
  captcha_failed: {
    category: ErrorCode.Invalid,
    message: "Não foi possível confirmar que você não é um robô. Tente de novo.",
  },
  upload_too_large: {
    category: ErrorCode.Invalid,
    message: "O arquivo é maior que o limite permitido.",
  },
  upload_type_not_allowed: {
    category: ErrorCode.Invalid,
    message: "Este tipo de arquivo não é aceito.",
  },
  upload_content_mismatch: {
    category: ErrorCode.Invalid,
    message: "O conteúdo do arquivo não corresponde ao tipo informado.",
  },
  upload_size_mismatch: {
    category: ErrorCode.Invalid,
    message: "O tamanho do arquivo enviado é diferente do esperado.",
  },
  quota_exceeded: {
    category: ErrorCode.Invalid,
    message: "O espaço de armazenamento acabou. Libere espaço ou ajuste o limite.",
  },
  share_invalid: {
    category: ErrorCode.Invalid,
    message: "Confira os dados do link: nome, mensagem e limite de downloads.",
  },
  share_invalid_expiry: {
    category: ErrorCode.Invalid,
    message: "A validade do link precisa ser uma data futura, de até 10 anos.",
  },
  share_target_invalid: {
    category: ErrorCode.Invalid,
    message: "Este item não pode ser compartilhado agora.",
  },
  share_not_found: {
    category: ErrorCode.NotFound,
    message: "Não encontramos este link.",
  },
  share_not_active: {
    category: ErrorCode.Conflict,
    message: "Este link já foi encerrado.",
  },
  password_weak: {
    category: ErrorCode.Invalid,
    message: "A senha do link precisa ter de 8 a 128 caracteres.",
  },
  logo_invalid: {
    category: ErrorCode.Invalid,
    message: "O logo precisa ser uma imagem disponível desta marca.",
  },
  media_in_use: {
    category: ErrorCode.InUse,
    message: "O arquivo tem usos que impedem a exclusão.",
  },
  media_not_available: {
    category: ErrorCode.Invalid,
    message: "Há arquivos que ainda não estão disponíveis.",
  },
  media_version_immutable: {
    category: ErrorCode.Denied,
    message: "Esta versão do arquivo não pode ser alterada.",
  },
  storage_unavailable: {
    category: ErrorCode.Unavailable,
    message: "Não foi possível acessar o armazenamento. Tente novamente.",
  },
  transition_not_allowed: {
    category: ErrorCode.Invalid,
    message: "Esta mudança de estado não é permitida.",
  },
  approver_required: {
    category: ErrorCode.Invalid,
    message: "Ninguém da marca pode aprovar ainda. Convide um aprovador para continuar.",
  },
  channels_not_published: {
    category: ErrorCode.Invalid,
    message: "Registre a publicação de todos os canais antes de marcar o conteúdo como publicado.",
  },
  plan_not_approved: {
    category: ErrorCode.Invalid,
    message: "Aguarde a aprovação do planejamento para enviar as artes.",
  },
  plan_locked: {
    category: ErrorCode.Invalid,
    message:
      "O planejamento já foi aprovado. Reabra o planejamento para mudar canais, formatos ou datas.",
  },
  plan_incomplete: {
    category: ErrorCode.Invalid,
    message: "Para enviar o planejamento, escolha ao menos um canal com data e horário.",
  },
  not_approved: {
    category: ErrorCode.Invalid,
    message: "Só é possível registrar a publicação de uma versão aprovada.",
  },
  requires_new_revision: {
    category: ErrorCode.Invalid,
    message: "Alterar isto exige uma nova versão e nova aprovação.",
  },
  reason_required: { category: ErrorCode.Invalid, message: "Informe o motivo." },
  request_not_pending: {
    category: ErrorCode.Conflict,
    message: "Este pedido não está mais pendente.",
  },
  revision_superseded: {
    category: ErrorCode.Conflict,
    message: "Esta versão foi atualizada. Veja a versão atual.",
  },
  comment_required: {
    category: ErrorCode.Invalid,
    message: "Escreva um comentário para pedir alterações.",
  },
  channel_brand_mismatch: {
    category: ErrorCode.Invalid,
    message: "O canal pertence a outra marca.",
  },
  brand_archived: {
    category: ErrorCode.Invalid,
    message: "Esta marca está arquivada e não aceita novos conteúdos.",
  },
  record_immutable: {
    category: ErrorCode.Denied,
    message: "Este registro não pode ser alterado.",
  },
  content_has_history: {
    category: ErrorCode.InUse,
    message: "Este conteúdo já tem versões ou comentários. Cancele em vez de excluir.",
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
