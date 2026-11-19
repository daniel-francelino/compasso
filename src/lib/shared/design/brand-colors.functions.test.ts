import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/shared/auth/server-guards.server", () => ({ requireActionServer: vi.fn() }));

const { BRAND_COLOR_LIMIT, addDesignBrandColorsSchema } =
  await import("@/lib/shared/design/brand-colors.functions");

const DESIGN_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const color = (index: number) => ({ name: `c${index}`, hex: "#0a0b0c" });
const parse = (colors: unknown[], designId: string = DESIGN_ID) =>
  addDesignBrandColorsSchema.safeParse({ designId, colors });

describe("addDesignBrandColors input schema", () => {
  it("accepts one color up to the brand limit and refuses one more", () => {
    expect(parse([color(0)]).success).toBe(true);
    expect(parse(Array.from({ length: BRAND_COLOR_LIMIT }, (_, i) => color(i))).success).toBe(true);
    expect(parse(Array.from({ length: BRAND_COLOR_LIMIT + 1 }, (_, i) => color(i))).success).toBe(
      false,
    );
  });

  it("refuses an empty list and a design id that is not a uuid", () => {
    expect(parse([]).success).toBe(false);
    expect(parse([color(0)], "not-a-uuid").success).toBe(false);
  });

  it("refuses unknown keys on the input and on a color", () => {
    expect(
      addDesignBrandColorsSchema.safeParse({ designId: DESIGN_ID, colors: [color(0)], x: 1 })
        .success,
    ).toBe(false);
    expect(parse([{ ...color(0), extra: true }]).success).toBe(false);
  });

  it("accepts only six-digit hex colors with a leading hash", () => {
    for (const hex of ["#abcdef", "#ABCDEF", "#012345"]) {
      expect(parse([{ name: "a", hex }]).success).toBe(true);
    }
    for (const hex of ["abcdef", "#abc", "#abcdeg", "#abcdef0", " #abcdef", "red", ""]) {
      expect(parse([{ name: "a", hex }]).success).toBe(false);
    }
  });

  it("refuses an empty name and a name above 400 characters", () => {
    expect(parse([{ name: "", hex: "#abcdef" }]).success).toBe(false);
    expect(parse([{ name: "x".repeat(400), hex: "#abcdef" }]).success).toBe(true);
    expect(parse([{ name: "x".repeat(401), hex: "#abcdef" }]).success).toBe(false);
  });
});
