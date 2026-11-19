import { describe, expect, it } from "vitest";
import { gateSvg } from "@/lib/shared/design/import/handlers/svg-gate";
import {
  SVG_NS,
  encodeText,
  svg,
  testSvgParser,
} from "@/lib/shared/design/import/handlers/svg-fixtures";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { SVG_LIMITS } from "@/lib/shared/design/import/limits";

const gate = (text: string) => gateSvg(encodeText(text), testSvgParser);

const failureOf = (text: string): string => {
  const result = gate(text);
  if (result.ok) throw new Error("expected a refusal");
  return result.message;
};

const BLOCKED = DESIGN_IMPORT_MESSAGE.svgBlockedContent;
const BOM = String.fromCharCode(0xfeff);

describe("gateSvg accepts", () => {
  it("a benign logo with a gradient, a fragment use and an embedded png", () => {
    const body =
      '<defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient></defs>' +
      '<rect fill="url(#g)" width="10" height="10"/><use href="#g"/>' +
      '<image href="data:image/png;base64,AAAA" width="1" height="1"/><text>Aura</text>';
    const result = gate(svg(body));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.svg.size).toEqual({ width: 100, height: 100 });
      expect(result.svg.explicitSize).toBe(true);
      expect(result.svg.textCount).toBe(1);
    }
  });

  it("a plain DOCTYPE without internal subset and a BOM", () => {
    const doctype =
      '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">';
    expect(gate(`${BOM}<?xml version="1.0"?>${doctype}${svg()}`).ok).toBe(true);
  });

  it("a viewBox-only file, with an implicit size", () => {
    const result = gate(svg("", 'viewBox="0 0 200 100"'));
    expect(result.ok && result.svg.size).toEqual({ width: 200, height: 100 });
    expect(result.ok && result.svg.explicitSize).toBe(false);
  });

  it("percent width falls back to the viewBox and one side keeps the aspect", () => {
    expect(gate(svg("", 'width="100%" height="100%" viewBox="0 0 80 40"')).ok).toBe(true);
    const half = gate(svg("", 'width="50" viewBox="0 0 100 200"'));
    expect(half.ok && half.svg.size).toEqual({ width: 50, height: 100 });
  });
});

describe("gateSvg refuses content (svgBlockedContent)", () => {
  const cases: [string, string][] = [
    ["script element", svg("<script>alert(1)</script>")],
    ["onload attribute", svg("", 'width="9" height="9" onload="x()"')],
    ["onclick attribute", svg('<rect onclick="x()"/>')],
    ["foreignObject", svg("<foreignObject><div>hi</div></foreignObject>")],
    ["external image href", svg('<image href="https://example.test/a.png"/>')],
    ["xlink image href", svg('<image xlink:href="http://example.test/a.png"/>')],
    ["external use href", svg('<use href="http://example.test/a.svg#a"/>')],
    ["css import in style element", svg("<style>@import url(http://example.test/a.css);</style>")],
    ["css url in style element", svg("<style>rect{fill:url(https://example.test/x)}</style>")],
    ["css url in style attribute", svg('<rect style="fill:url(https://example.test/x)"/>')],
    ["css url in presentation attribute", svg('<rect fill="url(https://example.test/x)"/>')],
    ["css escape hiding url", svg('<rect style="fill:\\75rl(https://example.test/x)"/>')],
    ["expression", svg('<rect style="width:expression(alert(1))"/>')],
    ["feImage", svg('<filter><feImage href="#a"/></filter>')],
    ["javascript: in href", svg('<a href="javascript:alert(1)"><rect/></a>')],
    ["javascript: with entity", svg('<a href="&#106;avascript:alert(1)"><rect/></a>')],
    ["javascript: with tab and case", svg('<a href="Java&#9;Script:alert(1)"><rect/></a>')],
    ["javascript: in a plain attribute", svg('<rect data-x="javascript:1"/>')],
    ["svg data uri in href", svg('<image href="data:image/svg+xml;base64,AAAA"/>')],
    ["html data uri in href", svg('<image href="data:text/html;base64,AAAA"/>')],
    ["animation element", svg('<animate attributeName="href" to="x"/>')],
    ["set element", svg('<set attributeName="href" to="x"/>')],
    ["iframe, object, embed", svg("<iframe/><object/><embed/>")],
    ["xml:base", svg("", 'width="9" height="9" xml:base="http://example.test/"')],
    ["entity declaration", `<!DOCTYPE svg [<!ENTITY lol "lol">]>${svg("<text>&lol;</text>")}`],
    ["billion laughs", `<!DOCTYPE svg [<!ENTITY a "aa"><!ENTITY b "&a;&a;">]>${svg()}`],
    ["doctype with subset only", `<!DOCTYPE svg [ ]>${svg()}`],
    ["xml-stylesheet", `<?xml-stylesheet href="http://example.test/a.css"?>${svg()}`],
  ];
  it.each(cases)("%s", (_name, text) => {
    expect(failureOf(text)).toBe(BLOCKED);
  });
});

describe("gateSvg refuses shape, size and limits", () => {
  it("refuses NUL bytes, invalid UTF-8 and empty input as invalid", () => {
    const withNul = new Uint8Array([...encodeText(svg()), 0]);
    const nul = gateSvg(withNul, testSvgParser);
    expect(!nul.ok && nul.message).toBe(DESIGN_IMPORT_MESSAGE.svgInvalid);
    const badUtf8 = new Uint8Array([...encodeText(svg()), 0xff, 0xfe]);
    expect(gateSvg(badUtf8, testSvgParser).ok).toBe(false);
    expect(failureOf("")).toBe(DESIGN_IMPORT_MESSAGE.svgInvalid);
  });

  it("refuses a file over the cap without parsing it", () => {
    let parsed = false;
    const result = gateSvg(new Uint8Array(SVG_LIMITS.maxFileBytes + 1), () => {
      parsed = true;
      return null;
    });
    expect(result.ok).toBe(false);
    expect(parsed).toBe(false);
  });

  it("refuses malformed XML, a wrong root and a wrong namespace", () => {
    expect(failureOf("<svg")).toBe(DESIGN_IMPORT_MESSAGE.svgInvalid);
    expect(failureOf(`<html xmlns="${SVG_NS}"></html>`)).toBe(DESIGN_IMPORT_MESSAGE.svgInvalid);
    expect(failureOf('<svg width="9" height="9"></svg>')).toBe(DESIGN_IMPORT_MESSAGE.svgInvalid);
  });

  it("refuses more than 5000 elements and more than 50 use elements", () => {
    const many = "<g/>".repeat(SVG_LIMITS.maxElements);
    expect(failureOf(svg(many))).toBe(DESIGN_IMPORT_MESSAGE.svgTooComplex);
    const uses = '<use href="#a"/>'.repeat(SVG_LIMITS.maxUse + 1);
    expect(failureOf(svg(uses))).toBe(DESIGN_IMPORT_MESSAGE.svgTooComplex);
    expect(gate(svg('<use href="#a"/>'.repeat(SVG_LIMITS.maxUse))).ok).toBe(true);
  });

  it("refuses nesting deeper than the cap", () => {
    const deep = "<g>".repeat(SVG_LIMITS.maxDepth) + "</g>".repeat(SVG_LIMITS.maxDepth);
    expect(failureOf(svg(deep))).toBe(DESIGN_IMPORT_MESSAGE.svgTooComplex);
  });

  it("refuses sizes it cannot trust", () => {
    const noSize = DESIGN_IMPORT_MESSAGE.svgNoSize;
    expect(failureOf(svg("", ""))).toBe(noSize);
    expect(failureOf(svg("", 'width="1e9" height="1e9"'))).toBe(noSize);
    expect(failureOf(svg("", 'width="-5" height="10"'))).toBe(noSize);
    expect(failureOf(svg("", 'width="NaN" height="10"'))).toBe(noSize);
    expect(failureOf(svg("", 'width="10em" height="10em"'))).toBe(noSize);
    expect(failureOf(svg("", 'viewBox="0 0 0 10"'))).toBe(noSize);
    expect(failureOf(svg("", 'viewBox="0 0 10"'))).toBe(noSize);
  });
});
