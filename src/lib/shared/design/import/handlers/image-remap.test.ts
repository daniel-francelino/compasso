import { describe, expect, it } from "vitest";
import { remapImageFailure } from "@/lib/shared/design/import/handlers/image-remap";
import { codedFailure } from "@/lib/shared/design/import/refusal";
import { DesignImportFailure } from "@/lib/shared/design/import/types";
import { invalid } from "@/lib/shared/server-utils";

const messages = { corrupt: "mapped corrupt", tooLarge: "mapped too large" };

describe("remapImageFailure", () => {
  it("maps on the failure code, whatever sentence the catalog uses", () => {
    const corrupt = codedFailure(DesignImportFailure.Corrupt, "any sentence at all");
    const large = codedFailure(DesignImportFailure.ImageTooLarge, "another sentence", [9, 9]);
    expect(remapImageFailure(corrupt, messages)).toEqual(invalid(messages.corrupt));
    expect(remapImageFailure(large, messages)).toEqual(invalid(messages.tooLarge));
  });

  it("leaves an uncoded failure and a different code untouched", () => {
    const plain = invalid("sentence");
    const memory = codedFailure(DesignImportFailure.Memory, "m");
    expect(remapImageFailure(plain, messages)).toBe(plain);
    expect(remapImageFailure(memory, messages)).toBe(memory);
  });
});
