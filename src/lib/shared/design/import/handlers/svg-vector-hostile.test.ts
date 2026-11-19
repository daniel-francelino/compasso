import { describe, expect, it } from "vitest";
import { expectValidShapes } from "@/lib/shared/design/import/handlers/svg-vector-check-fixtures";
import { wrap } from "@/lib/shared/design/import/handlers/svg-vector-fixtures";
import { parseSvgVector } from "@/lib/shared/design/import/handlers/svg-vector";
import {
  SvgFallback,
  type SvgVectorResult,
} from "@/lib/shared/design/import/handlers/svg-vector-types";

const REAL_TIME_BOUND_MS = 1500;
const MEGABYTE = 1024 * 1024;
const HASH = String.fromCharCode(35);
const PROTOTYPE_KEYS = ["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf"];

const reasonOf = (result: SvgVectorResult): string | null =>
  result.ok ? null : (result as { reason: string }).reason;

const timed = (source: string): SvgVectorResult => {
  const started = performance.now();
  const result = parseSvgVector(source);
  expect(performance.now() - started).toBeLessThan(REAL_TIME_BOUND_MS);
  expect(reasonOf(result)).not.toBe(SvgFallback.Internal);
  expect(reasonOf(result)).not.toBe(SvgFallback.Timeout);
  if (result.ok) expectValidShapes(result);
  return result;
};

const square = (attributes: string): string => wrap(`<rect width="4" height="4" ${attributes}/>`);

describe("parseSvgVector large hostile inputs", () => {
  const digits = (count: number): string => "1".repeat(count);

  it.each([
    ["width", (run: string) => wrap(`<rect width="${run}x" height="4"/>`)],
    ["transform", (run: string) => square(`transform="translate(${run}x)"`)],
    ["viewBox", (run: string) => wrap('<rect width="4" height="4"/>', `viewBox="0 0 ${run}x 24"`)],
    [
      "stop offset",
      (run: string) =>
        wrap(
          `<linearGradient id="g"><stop offset="${run}x"/><stop offset="1"/></linearGradient><rect width="4" height="4" fill="url(${HASH}g)"/>`,
        ),
    ],
    ["opacity", (run: string) => square(`opacity="${run}x"`)],
  ])("rejects a long digit run in %s quickly", (_name, build) => {
    for (const length of [3000, 4000, 100000]) {
      expect(timed(build(digits(length))).ok).toBe(false);
    }
  });

  it("rejects a 100k digit run in points quickly", () => {
    const source = wrap(`<polygon points="${digits(100000)}x 1"/>`);
    expect(reasonOf(timed(source))).toBe(SvgFallback.Malformed);
  });

  it("rejects long space runs in style attributes and style elements", () => {
    const spaces = " ".repeat(400);
    expect(timed(square(`style="fill:red${spaces}!${spaces}important"`)).ok).toBe(true);
    expect(timed(square(`style="fill:red${spaces}!${spaces}"`)).ok).toBe(false);
    expect(timed(square(`style="fill:red${spaces}!important"`)).ok).toBe(true);
    const sheet = `<style>rect{fill:red${" ".repeat(90000)}!}</style>`;
    expect(timed(wrap(`${sheet}<rect width="4" height="4"/>`)).ok).toBe(false);
  });

  it("rejects an unterminated run of comment openers quickly", () => {
    const source = wrap(`<style>${"/*".repeat(40000)}</style><rect width="4" height="4"/>`);
    expect(reasonOf(timed(source))).toBe(SvgFallback.Malformed);
  });

  it("rejects the selector times declaration bomb with few nodes", () => {
    const selectors = Array.from({ length: 1500 }, () => "rect").join(",");
    const declarations = Array.from({ length: 30 }, () => "fill:red").join(";");
    const sheet = `<style>${selectors}{${declarations}}</style>`;
    const rects = '<rect width="4" height="4"/>'.repeat(20);
    expect(reasonOf(timed(wrap(`${sheet}${rects}`)))).toBe(SvgFallback.ParseLimit);
  });

  it("rejects many rules with a few declarations", () => {
    const rules = Array.from({ length: 2100 }, (_v, index) => `.c${index}{fill:red}`).join("");
    expect(reasonOf(timed(wrap(`<style>${rules}</style><rect width="4" height="4"/>`)))).toBe(
      SvgFallback.ParseLimit,
    );
  });

  it("rejects 100k attributes on one element", () => {
    const attributes = Array.from({ length: 100000 }, (_v, index) => `a${index}="1"`).join(" ");
    expect(reasonOf(timed(wrap(`<rect width="4" height="4" ${attributes}/>`)))).toBe(
      SvgFallback.ParseLimit,
    );
  });

  it("rejects a 4 MB inline style", () => {
    const style = `fill:red;${"a:b;".repeat(MEGABYTE)}`;
    expect(reasonOf(timed(square(`style="${style}"`)))).toBe(SvgFallback.ParseLimit);
  });

  it("rejects a very long attribute value", () => {
    expect(reasonOf(timed(square(`data-x="${"a".repeat(5000)}"`)))).toBe(SvgFallback.ParseLimit);
  });
});

describe("parseSvgVector work budget", () => {
  it("stops empty rules with repeated class tokens by the work cap, not the clock", () => {
    const rules = ".a{}".repeat(1500);
    const classes = Array.from({ length: 32 }, () => "a").join(" ");
    const rects = `<rect class="${classes}" width="1" height="1" fill="red"/>`.repeat(4000);
    const result = parseSvgVector(wrap(`<style>${rules}</style>${rects}`), {
      budgetMs: 600_000,
    });
    expect(reasonOf(result)).toBe(SvgFallback.ParseLimit);
  });

  it("charges empty rules against the stylesheet pair cap", () => {
    const rules = Array.from({ length: 1900 }, (_v, index) => `.c${index}{}`).join("");
    const grouped = `${Array.from({ length: 200 }, () => "rect").join(",")}{}`;
    const result = parseSvgVector(
      wrap(`<style>${rules}${grouped}</style><rect width="1" height="1"/>`),
      {
        budgetMs: 600_000,
      },
    );
    expect(reasonOf(result)).toBe(SvgFallback.ParseLimit);
  });
});

describe("parseSvgVector prototype keys", () => {
  const properties = ["fill", "stroke", "stroke-linecap", "stroke-linejoin", "fill-rule", "color"];

  for (const key of PROTOTYPE_KEYS) {
    it.each(properties)(`treats ${key} as a value of %s as unsupported`, (property) => {
      const own = property === "fill" || property === "stroke" ? "" : 'fill="red" stroke="blue"';
      const attribute = timed(square(`${own} ${property}="${key}"`));
      const style = timed(square(`${own} style="${property}:${key}"`));
      expect(reasonOf(attribute)).toBe(SvgFallback.Unsupported);
      expect(reasonOf(style)).toBe(SvgFallback.Unsupported);
    });

    it(`treats ${key} as a stop color, display, id and class name`, () => {
      const gradient = `<linearGradient id="g"><stop offset="0" stop-color="${key}"/><stop offset="1"/></linearGradient><rect width="4" height="4" fill="url(${HASH}g)"/>`;
      expect(reasonOf(timed(wrap(gradient)))).toBe(SvgFallback.Unsupported);
      expect(timed(square(`fill="red" display="${key}"`)).ok).toBe(true);
      expect(timed(square(`id="${key}" class="${key}" fill="red"`)).ok).toBe(true);
      const sheet = `<style>.${key}{fill:lime}${HASH}${key}{stroke:blue}</style>`;
      const styled = timed(wrap(`${sheet}<rect id="${key}" class="${key}" width="4" height="4"/>`));
      expect(styled.ok).toBe(true);
    });
  }

  it("rejects a selector made of a prototype key", () => {
    const sheet = "<style>__proto__{fill:red}</style>";
    expect(reasonOf(timed(wrap(`${sheet}<rect width="4" height="4"/>`)))).toBe(
      SvgFallback.Unsupported,
    );
    const tag = "<style>constructor{fill:red}</style>";
    expect(timed(wrap(`${tag}<rect width="4" height="4"/>`)).ok).toBe(true);
  });
});

describe("parseSvgVector layer names", () => {
  it("removes C1 controls and unassigned code points from a name", () => {
    const result = timed(square('id="&#x85;&#xFFFE;ab&#x9F;" fill="red"'));
    expect(result.ok && result.shapes[0]?.name).toBe("ab");
  });

  it("gives no name when nothing printable is left", () => {
    const result = timed(square('id="&#xFFFE;&#x85;" fill="red"'));
    expect(result.ok && result.shapes[0]?.name).toBeNull();
  });
});

describe("parseSvgVector strict colors", () => {
  it.each([
    "rgb(1,2,3) garbage",
    "rgb(1,2,3",
    "rgb(300,0,0)",
    `${HASH}ff00`,
    "rgb(1,2)",
    "red blue",
  ])("rejects %s", (value) => {
    expect(reasonOf(timed(square(`fill="${value}"`)))).toBe(SvgFallback.Unsupported);
  });

  it.each(["rgb(1,2,3)", "rgb(1 2 3)", "rgb( 1 , 2 , 3 )", "RED", `${HASH}abc`])(
    "accepts %s",
    (value) => {
      expect(timed(square(`fill="${value}"`)).ok).toBe(true);
    },
  );
});
