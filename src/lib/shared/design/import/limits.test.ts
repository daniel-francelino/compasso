import { describe, expect, it } from "vitest";
import { DESIGN_IMPORT_LIMITS, sizeFitsPage } from "@/lib/shared/design/import/limits";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";

describe("sizeFitsPage", () => {
  it("enforces the page limits", () => {
    expect(sizeFitsPage(1080, 1350).ok).toBe(true);
    expect(sizeFitsPage(64, 4096).ok).toBe(true);
    const large = sizeFitsPage(4097, 100);
    expect(!large.ok && large.message).toBe(
      DESIGN_IMPORT_MESSAGE.canvasTooLarge(DESIGN_IMPORT_LIMITS.maxPageSide),
    );
    const small = sizeFitsPage(63, 100);
    expect(!small.ok && small.message).toBe(
      DESIGN_IMPORT_MESSAGE.canvasTooSmall(DESIGN_IMPORT_LIMITS.minPageSide),
    );
  });
});
