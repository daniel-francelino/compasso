import type { z } from "zod";
import {
  type DatabaseError,
  ErrorCode,
  dbErrorCode,
  dbErrorMessage,
} from "@/lib/shared/auth/errors";
import { logError } from "@/lib/shared/logger";

export type Failure = {
  ok: false;
  code: ErrorCode;
  message: string;
  fields?: Record<string, string>;
};

export type Result<T extends object = object> = ({ ok: true } & T) | Failure;

export type Page<T> = { rows: T[]; total: number; page: number; pageSize: number };

export const pageOf = <T>(
  rows: T[],
  total: number,
  paging: { page: number; pageSize: number },
): Page<T> => ({ rows, total, page: paging.page, pageSize: paging.pageSize });

export const fail = (error: DatabaseError, fallback?: string): Failure => ({
  ok: false,
  code: dbErrorCode(error),
  message: dbErrorMessage(error, fallback),
});

export const denied: Failure = fail({ message: "denied" });

export const invalid = (message: string, fields?: Record<string, string>): Failure =>
  fields === undefined
    ? { ok: false, code: ErrorCode.Invalid, message }
    : { ok: false, code: ErrorCode.Invalid, message, fields };

export const parseOutput = <T extends object>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  data: unknown,
): Result<T> => {
  const parsed = schema.safeParse(data);
  if (parsed.success) return { ok: true, ...parsed.data };
  logError("unexpected database output", parsed.error.issues.slice(0, 5));
  return fail({ message: "unknown" });
};

export const cleanSearch = (search: string | undefined): string =>
  (search ?? "").replace(/[,()%*\\_]/g, " ").trim();

export const rangeOf = (page: number, pageSize: number) =>
  [(page - 1) * pageSize, page * pageSize - 1] as const;
