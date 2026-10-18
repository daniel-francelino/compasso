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

export const errorCatalogCodes = (): string[] => Object.keys(catalog);
