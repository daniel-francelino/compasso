import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ErrorCode } from "@/lib/shared/auth/errors";
import { denied, fail, invalid, pageOf, parseOutput, rangeOf } from "@/lib/shared/server-utils";

vi.mock("@/lib/shared/logger", () => ({ logError: vi.fn() }));

describe("fail", () => {
  it("maps a known database code to its category and pt-BR message", () => {
    expect(fail({ message: "conflict" })).toEqual({
      ok: false,
      code: ErrorCode.Conflict,
      message: "Este registro foi alterado por outra pessoa. Recarregue para continuar.",
    });
  });

  it("maps insufficient privilege to denied whatever the text says", () => {
    const result = fail({ message: "permission denied for table x", code: "42501" });
    expect(result.code).toBe(ErrorCode.Denied);
  });

  it("never leaks an unknown database message", () => {
    const result = fail({ message: 'relation "secret_table" does not exist' });
    expect(result.code).toBe(ErrorCode.Unknown);
    expect(result.message).not.toContain("secret_table");
  });

  it("uses the fallback only for unknown errors", () => {
    expect(fail({ message: "boom" }, "Falhou ao salvar").message).toBe("Falhou ao salvar");
    expect(fail({ message: "not_found" }, "Falhou ao salvar").message).toBe(
      "Não encontramos este registro.",
    );
  });
});

describe("denied", () => {
  it("is a failure with the denied category", () => {
    expect(denied.ok).toBe(false);
    expect(denied.code).toBe(ErrorCode.Denied);
  });
});

describe("invalid", () => {
  it("includes fields only when given", () => {
    expect(invalid("Confira os campos.")).toEqual({
      ok: false,
      code: ErrorCode.Invalid,
      message: "Confira os campos.",
    });
    expect(invalid("Confira os campos.", { name: "Obrigatório" }).fields).toEqual({
      name: "Obrigatório",
    });
  });
});

describe("parseOutput", () => {
  const schema = z.object({ requestId: z.string().uuid() });

  it("returns the validated value flattened into the result", () => {
    const id = "6f1c1a52-7a45-4f0d-9d3c-0e4b8a2b7d11";
    expect(parseOutput(schema, { requestId: id })).toEqual({ ok: true, requestId: id });
  });

  it("returns a failure for an unexpected shape", () => {
    const result = parseOutput(schema, { requestId: 1 });
    expect(result.ok).toBe(false);
  });
});

describe("paging helpers", () => {
  it("builds a page", () => {
    expect(pageOf(["a"], 11, { page: 2, pageSize: 10 })).toEqual({
      rows: ["a"],
      total: 11,
      page: 2,
      pageSize: 10,
    });
  });

  it("computes the inclusive range of a page", () => {
    expect(rangeOf(1, 25)).toEqual([0, 24]);
    expect(rangeOf(3, 25)).toEqual([50, 74]);
  });
});
