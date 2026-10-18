import type { Result } from "@/lib/shared/server-utils";

export class ResultError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export const unwrapResult = <T extends object>(result: Result<T>): Omit<{ ok: true } & T, "ok"> => {
  if (!result.ok) throw new ResultError(result.message, result.code);
  const { ok: _ok, ...rest } = result;
  return rest;
};
