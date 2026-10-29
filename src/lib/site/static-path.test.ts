import { describe, expect, it } from "vitest";
import { isStaticAssetPath } from "@/lib/site/static-path";

describe("isStaticAssetPath", () => {
  it("recognizes build assets and files with an extension", () => {
    expect(isStaticAssetPath("assets/index-DF9sBd6R.js")).toBe(true);
    expect(isStaticAssetPath("assets/(site)-GfXd1oyr.js")).toBe(true);
    expect(isStaticAssetPath("landing/rayana.webp")).toBe(true);
    expect(isStaticAssetPath("favicon.ico")).toBe(true);
  });

  it("leaves CMS page slugs alone", () => {
    expect(isStaticAssetPath("")).toBe(false);
    expect(isStaticAssetPath("servicos")).toBe(false);
    expect(isStaticAssetPath("portfolio/caso-um")).toBe(false);
  });
});
