import { describe, expect, it } from "vitest";
import { rgbToHex } from "@/lib/shared/design/document";
import {
  GRADIENT,
  ICON,
  ILLUSTRATOR,
  PATH_COMMANDS,
  RADIAL,
  SVG_NS,
  USE_REUSE,
  wrap,
} from "@/lib/shared/design/import/handlers/svg-vector-fixtures";
import { parseSvgVector } from "@/lib/shared/design/import/handlers/svg-vector";
import {
  SvgFallback,
  type SvgVectorDocument,
  type SvgVectorResult,
} from "@/lib/shared/design/import/handlers/svg-vector-types";
import { DesignPathFillRule, DesignPathPaintKind } from "@/lib/shared/design/types";

const RED = rgbToHex(255, 0, 0);
const BLUE = rgbToHex(0, 0, 255);
const LIME = rgbToHex(0, 255, 0);
const BLACK = rgbToHex(0, 0, 0);
const BOM = String.fromCharCode(0xfeff);

const reasonOf = (result: SvgVectorResult): string | null =>
  result.ok ? null : (result as { reason: string }).reason;

const parsed = (source: string | Uint8Array): SvgVectorDocument => {
  const result = parseSvgVector(source);
  if (!result.ok) throw new Error(`unexpected fallback ${reasonOf(result)}`);
  return result;
};

const expectFallback = (source: string | Uint8Array, reason: string): void => {
  expect(reasonOf(parseSvgVector(source))).toBe(reason);
};

const square = '<rect width="1" height="1"/>';

describe("parseSvgVector accepted files", () => {
  it("reads an icon with a stroke and currentColor", () => {
    const document = parsed(ICON);
    expect(document.width).toBe(24);
    expect(document.shapes).toHaveLength(2);
    const [line, circle] = document.shapes;
    expect(line?.fill).toBeNull();
    expect(line?.stroke).toMatchObject({ color: BLACK, width: 2, cap: "round", join: "round" });
    expect(line?.name).toBe("mark");
    expect(line?.d).toBe("M4 12L20 12");
    expect(circle?.bounds).toEqual({ minX: 4, minY: 4, maxX: 20, maxY: 20 });
  });

  it("converts a solid fill and keeps the fill rule", () => {
    const result = parsed(
      wrap('<rect x="2" y="3" width="10" height="5" fill="rgb(255,0,0)" fill-rule="evenodd"/>'),
    );
    expect(result.shapes[0]).toMatchObject({
      fill: { kind: DesignPathPaintKind.Solid, color: RED },
      stroke: null,
      fillRule: DesignPathFillRule.EvenOdd,
      opacity: 1,
      bounds: { minX: 2, minY: 3, maxX: 12, maxY: 8 },
    });
  });

  it("converts an object bounding box linear gradient to fractions", () => {
    const fill = parsed(GRADIENT).shapes[0]?.fill;
    expect(fill).toMatchObject({ kind: DesignPathPaintKind.Linear, x1: 0, y1: 0, x2: 1, y2: 0 });
    expect(fill && "stops" in fill ? fill.stops.map((stop) => stop.color) : []).toEqual([
      RED,
      BLUE,
    ]);
  });

  it("converts a user space radial gradient with stop opacity", () => {
    const fill = parsed(RADIAL).shapes[0]?.fill;
    expect(fill).toMatchObject({ kind: DesignPathPaintKind.Radial, cx: 0.5, cy: 0.5, r: 0.5 });
    expect(fill && "stops" in fill ? fill.stops[1]?.alpha : 0).toBe(0.5);
  });

  it("turns arcs into cubics and expands relative H V S T commands", () => {
    const [shape] = parsed(PATH_COMMANDS).shapes;
    expect(shape?.d).toMatch(/^M/);
    expect(shape?.d).not.toMatch(/[AaHhVvSsTtqlcz]/);
    expect(shape?.commandCount).toBeGreaterThan(8);
  });

  it("bakes transforms with skew and rotation", () => {
    const skewed = parsed(wrap('<g transform="skewX(45)"><rect width="10" height="10"/></g>'));
    expect(skewed.shapes[0]?.bounds).toEqual({ minX: 0, minY: 0, maxX: 20, maxY: 10 });
    const moved = parsed(
      wrap('<g transform="translate(5 5) scale(2)"><rect width="2" height="2"/></g>'),
    );
    expect(moved.shapes[0]?.bounds).toEqual({ minX: 5, minY: 5, maxX: 9, maxY: 9 });
    const turned = parsed(wrap('<rect width="10" height="4" transform="rotate(90)"/>'));
    expect(turned.shapes[0]?.bounds).toEqual({ minX: -4, minY: 0, maxX: 0, maxY: 10 });
  });

  it("expands use of a defs element", () => {
    const document = parsed(USE_REUSE);
    expect(document.shapes).toHaveLength(2);
    expect(document.shapes[0]?.bounds).toEqual({ minX: 2, minY: 2, maxX: 6, maxY: 6 });
    expect(document.shapes[1]?.fill).toMatchObject({ color: RED });
  });

  it("keeps fill none with a stroke", () => {
    const source = wrap('<path d="M1 1L9 9" fill="none" stroke="navy" stroke-width="3"/>');
    const [shape] = parsed(source).shapes;
    expect(shape?.fill).toBeNull();
    expect(shape?.stroke?.width).toBe(3);
  });

  it("applies the style element class export", () => {
    const document = parsed(ILLUSTRATOR);
    expect(document.width).toBe(40);
    expect(document.shapes[0]?.fill).toMatchObject({ color: RED });
    expect(document.shapes[1]).toMatchObject({ fill: null, stroke: { color: LIME, width: 2 } });
  });

  it("applies id selectors and style attributes with the right precedence", () => {
    const source = wrap(
      '<style>#a{fill:red}.b{fill:blue}</style><rect id="a" class="b" width="4" height="4"/><rect class="b" width="4" height="4" style="fill:lime"/>',
    );
    const [first, second] = parsed(source).shapes;
    expect(first?.fill).toMatchObject({ color: RED });
    expect(second?.fill).toMatchObject({ color: LIME });
  });

  it("accepts a BOM, comments, CDATA, numeric references and the xml declaration", () => {
    const source = `${BOM}<?xml version="1.0"?><!-- c -->${wrap(
      '<style><![CDATA[.a{fill:red}]]></style><metadata><x:y xmlns:x="u">z</x:y></metadata><rect id="&#97;&#x62;" class="a" width="2" height="2"/>',
    )}`;
    const [shape] = parsed(source).shapes;
    expect(shape?.name).toBe("ab");
    expect(shape?.fill).toMatchObject({ color: RED });
  });

  it("accepts utf-8 bytes with a BOM", () => {
    const bytes = new TextEncoder().encode(`${BOM}${wrap('<rect width="3" height="3"/>')}`);
    expect(parsed(bytes).shapes).toHaveLength(1);
  });

  it("folds group opacity and fill opacity into the shape opacity", () => {
    const [shape] = parsed(
      wrap('<g opacity="0.5"><rect width="4" height="4" fill="red" fill-opacity="0.5"/></g>'),
    ).shapes;
    expect(shape?.opacity).toBe(0.25);
  });

  it("keeps stop offsets monotonic when they are unsorted", () => {
    const source = wrap(
      '<linearGradient id="g"><stop offset="0.8" stop-color="red"/><stop offset="0.2" stop-color="blue"/><stop offset="1" stop-color="lime"/></linearGradient><rect width="24" height="24" fill="url(#g)"/>',
    );
    const fill = parsed(source).shapes[0]?.fill;
    const offsets = fill && "stops" in fill ? fill.stops.map((stop) => stop.offset) : [];
    expect(offsets).toEqual([0.8, 0.8, 1]);
  });

  it("follows a gradient href chain for stops", () => {
    const source = wrap(
      '<linearGradient id="base"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient><linearGradient id="g" href="#base" x2="0" y2="1"/><rect width="24" height="24" fill="url(#g)"/>',
    );
    expect(parsed(source).shapes[0]?.fill).toMatchObject({ kind: "linear", x2: 0, y2: 1 });
  });

  it("turns a one stop gradient into a solid fill", () => {
    const source = wrap(
      '<linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient><rect width="4" height="4" fill="url(#g)"/>',
    );
    expect(parsed(source).shapes[0]?.fill).toEqual({ kind: "solid", color: RED });
  });

  it("scales by the width and height attributes when the aspect matches the viewBox", () => {
    const source = wrap(
      '<rect width="12" height="12"/>',
      'width="48" height="48" viewBox="0 0 24 24"',
    );
    const document = parsed(source);
    expect(document.width).toBe(48);
    expect(document.shapes[0]?.bounds).toEqual({ minX: 0, minY: 0, maxX: 24, maxY: 24 });
  });

  it("builds rounded rectangles, ellipses, lines, polylines and polygons", () => {
    const document = parsed(
      wrap(
        '<rect width="10" height="10" rx="2"/><ellipse cx="5" cy="5" rx="4" ry="2"/><line x1="0" y1="0" x2="5" y2="5" stroke="red"/><polyline points="0,0 5,5 9,0" fill="none" stroke="red"/><polygon points="0,0 5,5 9,0"/>',
      ),
    );
    expect(document.shapes).toHaveLength(5);
    expect(document.shapes[0]?.d).toContain("C");
    expect(document.shapes[4]?.d.endsWith("Z")).toBe(true);
  });

  it("sanitizes the layer name taken from an id", () => {
    const long = "n".repeat(200);
    const [shape] = parsed(wrap(`<rect id="${long}" width="2" height="2"/>`)).shapes;
    expect(shape?.name?.length).toBe(80);
    const marked = parsed(wrap('<rect id="&#8238;" width="2" height="2"/>'));
    expect(marked.shapes[0]?.name).toBeNull();
  });

  it("never copies source text into the output", () => {
    const source = wrap(
      '<rect id="x" class="hostile" data-evil="payload" width="2" height="2" fill="red"/>',
    );
    const text = JSON.stringify(parsed(source).shapes.map(({ name: _name, ...rest }) => rest));
    expect(text).not.toMatch(/hostile|payload|evil/);
  });
});

describe("parseSvgVector fallbacks", () => {
  it.each([
    ["utf-16 bytes", new Uint8Array([0xff, 0xfe, 0x3c, 0x00]), SvgFallback.Unsupported],
    ["truncated xml", wrap('<rect width="2"').slice(0, 60), SvgFallback.Malformed],
    ["no closing tag", `<svg xmlns="${SVG_NS}" viewBox="0 0 1 1"><g>`, SvgFallback.Malformed],
    [
      "mismatched tag",
      `<svg xmlns="${SVG_NS}" viewBox="0 0 1 1"><g></h></svg>`,
      SvgFallback.Malformed,
    ],
    ["two roots", `${wrap("")}${wrap("")}`, SvgFallback.Malformed],
    ["text outside root", `hello${wrap("")}`, SvgFallback.Malformed],
    ["duplicate attribute", wrap('<rect width="1" width="2" height="2"/>'), SvgFallback.Malformed],
    [
      "duplicate id",
      wrap('<rect id="a" width="1" height="1"/><rect id="a" width="1" height="1"/>'),
      SvgFallback.Malformed,
    ],
    ["not svg", "<html></html>", SvgFallback.Unsupported],
    ["empty", "", SvgFallback.Malformed],
    ["no shapes", wrap("<g/>"), SvgFallback.Unsupported],
    [
      "only invisible shape",
      wrap('<rect width="2" height="2" fill="none"/>'),
      SvgFallback.Unsupported,
    ],
  ])("%s", (_name, source, reason) => {
    expectFallback(source, reason);
  });

  it.each([
    ["script", wrap(`<script>alert(1)</script>${square}`)],
    ["onload", wrap('<rect onload="x()" width="1" height="1"/>')],
    [
      "onclick on the root",
      `<svg xmlns="${SVG_NS}" viewBox="0 0 1 1" onclick="x()">${square}</svg>`,
    ],
    ["javascript in style", wrap('<rect width="1" height="1" style="fill:javascript:alert(1)"/>')],
    ["javascript href", wrap(`<a href="javascript:alert(1)">${square}</a>`)],
    ["external use", wrap('<use href="http://example.com/a.svg#x"/>')],
    ["data href", wrap('<use href="data:image/svg+xml;base64,AA=="/>')],
    ["external url fill", wrap('<rect width="1" height="1" fill="url(http://example.com/g)"/>')],
    [
      "external url in style",
      wrap('<rect width="1" height="1" style="fill:url(https://example.com/g)"/>'),
    ],
    ["import rule", wrap(`<style>@import url(http://example.com/a.css);</style>${square}`)],
    ["expression", wrap('<rect width="1" height="1" style="width:expression(alert(1))"/>')],
    [
      "foreignObject",
      wrap(`<foreignObject width="1" height="1"><div>hi</div></foreignObject>${square}`),
    ],
    ["image", wrap('<image href="#x" width="1" height="1"/>')],
    ["filter", wrap('<rect width="1" height="1" filter="url(#f)"/>')],
    ["mask", wrap('<rect width="1" height="1" style="mask:url(#m)"/>')],
    ["clip-path", wrap('<rect width="1" height="1" clip-path="url(#c)"/>')],
    ["text", wrap(`<text>hello</text>${square}`)],
    ["animate", wrap('<rect width="1" height="1"><animate attributeName="x" to="2"/></rect>')],
    ["prefixed element", wrap('<svg:rect width="1" height="1"/>')],
    ["inkscape element", wrap(`<sodipodi:namedview id="n"/>${square}`)],
    ["nested svg", wrap(`<svg>${square}</svg>`)],
    [
      "foreign default namespace",
      `<svg xmlns="http://www.w3.org/1999/xhtml" viewBox="0 0 1 1">${square}</svg>`,
    ],
    ["combinator selector", wrap(`<style>g rect{fill:red}</style>${square}`)],
    ["pseudo class", wrap(`<style>rect:hover{fill:red}</style>${square}`)],
    ["attribute selector", wrap(`<style>rect[id]{fill:red}</style>${square}`)],
    ["media rule", wrap(`<style>@media print{rect{fill:red}}</style>${square}`)],
    ["millimetres", wrap('<rect width="1mm" height="1" />')],
    ["percent length", wrap('<rect width="50%" height="1" />')],
    ["rgba color", wrap('<rect width="1" height="1" fill="rgba(1,2,3,0.5)"/>')],
    ["unknown color", wrap('<rect width="1" height="1" fill="rebeccapurple"/>')],
    [
      "gradient stroke",
      wrap(
        '<linearGradient id="g"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient><rect width="1" height="1" fill="none" stroke="url(#g)"/>',
      ),
    ],
    [
      "different fill and stroke opacity",
      wrap('<rect width="1" height="1" fill="red" stroke="blue" fill-opacity="0.5"/>'),
    ],
    ["different viewBox aspect", wrap(square, 'width="10" height="20" viewBox="0 0 10 10"')],
    ["other encoding", `<?xml version="1.0" encoding="ISO-8859-1"?>${wrap(square)}`],
    ["no size", `<svg xmlns="${SVG_NS}">${square}</svg>`],
  ])("%s falls back as unsupported", (_name, source) => {
    expectFallback(source, SvgFallback.Unsupported);
  });

  it("rejects a DOCTYPE with an entity bomb before expanding anything", () => {
    const bomb = `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;"><!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">]><svg xmlns="${SVG_NS}" viewBox="0 0 1 1"><text>&c;</text></svg>`;
    expectFallback(bomb, SvgFallback.Unsupported);
    expectFallback(wrap(`${square}&xxe;`), SvgFallback.Unsupported);
  });

  it("rejects a processing instruction other than the xml declaration", () => {
    expectFallback(`<?xml-stylesheet href="a.css"?>${wrap("")}`, SvgFallback.Unsupported);
    expectFallback(wrap(`<?php echo 1 ?>${square}`), SvgFallback.Unsupported);
  });

  it("falls back on a gradient with a missing id", () => {
    expectFallback(
      wrap('<rect width="4" height="4" fill="url(#nowhere)"/>'),
      SvgFallback.Unsupported,
    );
  });

  it("falls back on a reference to a non gradient or a gradient loop", () => {
    expectFallback(
      wrap('<g id="x"/><rect width="4" height="4" fill="url(#x)"/>'),
      SvgFallback.Unsupported,
    );
    expectFallback(
      wrap(
        '<linearGradient id="a" href="#b"/><linearGradient id="b" href="#a"/><rect width="4" height="4" fill="url(#a)"/>',
      ),
      SvgFallback.Malformed,
    );
  });

  it("falls back on a radial gradient with a focal point", () => {
    const source = wrap(
      '<radialGradient id="r" fx="0.1"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></radialGradient><circle cx="12" cy="12" r="12" fill="url(#r)"/>',
    );
    expectFallback(source, SvgFallback.Unsupported);
  });

  it("falls back on more gradient stops than the limit", () => {
    const stops = Array.from(
      { length: 9 },
      (_v, index) => `<stop offset="${index / 10}" stop-color="red"/>`,
    ).join("");
    const source = wrap(
      `<linearGradient id="g">${stops}</linearGradient><rect width="4" height="4" fill="url(#g)"/>`,
    );
    expectFallback(source, SvgFallback.ParseLimit);
  });
});

describe("parseSvgVector use expansion", () => {
  it("rejects a use that references itself and a longer cycle", () => {
    expectFallback(wrap('<g id="a"><use href="#a"/></g>'), SvgFallback.Malformed);
    expectFallback(
      wrap('<g id="a"><use href="#b"/></g><g id="b"><use href="#a"/></g><use href="#a"/>'),
      SvgFallback.Malformed,
    );
    expectFallback(wrap('<use href="#missing"/>'), SvgFallback.Unsupported);
  });

  it("rejects a fan out that expands past the use limit without building it", () => {
    const levels = Array.from({ length: 12 }, (_v, index) =>
      index === 0
        ? '<rect id="l0" width="1" height="1"/>'
        : `<g id="l${index}"><use href="#l${index - 1}"/><use href="#l${index - 1}"/></g>`,
    ).join("");
    expectFallback(wrap(`<defs>${levels}</defs><use href="#l11"/>`), SvgFallback.ParseLimit);
  });

  it("accepts exactly the use limit and rejects one more", () => {
    const uses = Array.from(
      { length: 200 },
      (_v, index) => `<use href="#p" x="${index % 20}"/>`,
    ).join("");
    const defs = '<defs><rect id="p" width="1" height="1"/></defs>';
    expect(parseSvgVector(wrap(`${defs}${uses}`)).ok).toBe(true);
    expectFallback(wrap(`${defs}${uses}<use href="#p"/>`), SvgFallback.ParseLimit);
  });
});

describe("parseSvgVector caps and numbers", () => {
  it("rejects nesting beyond the depth cap while tokenizing", () => {
    expectFallback(wrap(`${"<g>".repeat(10000)}${"</g>".repeat(10000)}`), SvgFallback.ParseLimit);
  });

  it("rejects more nodes than the node cap", () => {
    expectFallback(wrap(square.repeat(50000)), SvgFallback.ParseLimit);
  });

  it("rejects a file above the byte cap", () => {
    const cap = 5 * 1024 * 1024;
    expectFallback(`${wrap("")}${" ".repeat(cap)}`, SvgFallback.ParseLimit);
    expectFallback(new Uint8Array(cap + 1), SvgFallback.ParseLimit);
  });

  it.each([
    ["1e308 coordinate", wrap('<path d="M0 0L1e308 5"/>'), SvgFallback.TooLarge],
    ["1e308 attribute", wrap('<rect width="1e308" height="1"/>'), SvgFallback.TooLarge],
    ["above one million", wrap('<rect width="1000001" height="1"/>'), SvgFallback.TooLarge],
    ["1e999", wrap('<rect width="1e999" height="1"/>'), SvgFallback.TooLarge],
    ["NaN attribute", wrap('<rect width="NaN" height="1"/>'), SvgFallback.Malformed],
    ["Infinity attribute", wrap('<rect width="Infinity" height="1"/>'), SvgFallback.Malformed],
    ["NaN path", wrap('<path d="M0 0L NaN 5"/>'), SvgFallback.Malformed],
    [
      "Infinity transform",
      wrap('<rect width="1" height="1" transform="translate(Infinity)"/>'),
      SvgFallback.Malformed,
    ],
    [
      "too many transform functions",
      wrap(`<rect width="1" height="1" transform="${"scale(1e6) ".repeat(65)}"/>`),
      SvgFallback.ParseLimit,
    ],
    [
      "transform product overflow",
      wrap(`<rect width="1" height="1" transform="${"scale(1e6) ".repeat(60)}"/>`),
      SvgFallback.TooLarge,
    ],
    [
      "page above the editor size",
      wrap(square, 'width="40000" height="40000" viewBox="0 0 40000 40000"'),
      SvgFallback.TooLarge,
    ],
    [
      "shape above the editor size",
      wrap('<rect width="25000" height="10"/>'),
      SvgFallback.TooLarge,
    ],
    [
      "bad transform",
      wrap('<rect width="1" height="1" transform="rotate()"/>'),
      SvgFallback.Malformed,
    ],
  ])("%s", (_name, source, reason) => {
    expectFallback(source, reason);
  });

  it("falls back on path data above the element data cap", () => {
    const d = `M0 0${"L1 1L2 2".repeat(2500)}`;
    expectFallback(wrap(`<path d="${d}"/>`), SvgFallback.VectorLimit);
  });

  it("falls back past the element cap and past the import byte cap", () => {
    const many = Array.from(
      { length: 201 },
      (_v, index) => `<rect x="${index % 20}" width="1" height="1"/>`,
    ).join("");
    expectFallback(wrap(many), SvgFallback.VectorLimit);
    const piece = `M0 0${"L1 1L2 3".repeat(1500)}`;
    const heavy = Array.from({ length: 12 }, () => `<path d="${piece}"/>`).join("");
    expectFallback(wrap(heavy), SvgFallback.VectorLimit);
  });
});

describe("parseSvgVector time budget", () => {
  const stepping = (step: number) => {
    let now = 0;
    return () => {
      now += step;
      return now;
    };
  };

  it("returns a timeout result when the injected clock passes the deadline", () => {
    const result = parseSvgVector(wrap(square.repeat(300)), {
      now: stepping(100),
      budgetMs: 500,
    });
    expect(reasonOf(result)).toBe(SvgFallback.Timeout);
  });

  it("finishes when the clock stays inside the budget", () => {
    expect(parseSvgVector(ICON, { now: () => 0, budgetMs: 1 }).ok).toBe(true);
  });

  it("times out while tokenizing a large flat file", () => {
    const result = parseSvgVector(wrap("<!-- x -->".repeat(2000)), {
      now: stepping(50),
      budgetMs: 1000,
    });
    expect(reasonOf(result)).toBe(SvgFallback.Timeout);
  });
});
