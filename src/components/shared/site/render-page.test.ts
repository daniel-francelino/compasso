import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RenderPage } from "@/components/shared/site/render-page";
import type { SiteRenderContext } from "@/components/shared/site/site-context";
import type { PublishedPage } from "@/lib/shared/content/published";
import { SectionKind, SitePageKind } from "@/lib/shared/enums";

const ctx: SiteRenderContext = {
  media: {},
  caseStudies: [],
  siteId: null,
  pageSlug: "",
  turnstileSiteKey: null,
  preview: false,
  submitContact: null,
};

const pageOf = (sections: PublishedPage["page"]["sections"]): PublishedPage => ({
  format: 1,
  page: {
    id: "p",
    slug: "",
    kind: SitePageKind.Home,
    title: "Início",
    seo: { title: "", description: "" },
    sections,
  },
  media: {},
});

const html = (page: PublishedPage) =>
  renderToStaticMarkup(createElement(RenderPage, { page, ctx }));

describe("RenderPage", () => {
  it("renders every kind of section with empty data without throwing and without content", () => {
    for (const kind of Object.values(SectionKind)) {
      const markup = html(pageOf([{ id: kind, component: kind, content: {}, appearance: {} }]));
      expect(markup).not.toContain("undefined");
      expect(markup).not.toContain("null");
      expect(markup.replace(/<[^>]*>/g, "").trim()).toBe("");
    }
  });

  it("omits a section of an unknown kind and keeps the others", () => {
    const markup = html(
      pageOf([
        { id: "x", component: "does_not_exist", content: { title: "Fantasma" }, appearance: {} },
        {
          id: "t",
          component: SectionKind.RichText,
          content: { blocks: [{ type: "paragraph", text: "Olá" }] },
          appearance: {},
        },
      ]),
    );
    expect(markup).not.toContain("Fantasma");
    expect(markup).toContain("Olá");
  });

  it("escapes text instead of injecting markup", () => {
    const markup = html(
      pageOf([
        {
          id: "t",
          component: SectionKind.RichText,
          content: { blocks: [{ type: "paragraph", text: "<img src=x onerror=alert(1)>" }] },
          appearance: {},
        },
      ]),
    );
    expect(markup).toContain("&lt;img");
    expect(markup).not.toContain("<img");
  });

  it("draws no button when the link is missing and no image when none was chosen", () => {
    const markup = html(
      pageOf([
        {
          id: "h",
          component: SectionKind.Hero,
          content: { headline: "Estratégia", primaryCta: null, image: null },
          appearance: {},
        },
      ]),
    );
    expect(markup).toContain("Estratégia");
    expect(markup).not.toContain("<a ");
    expect(markup).not.toContain("<img");
  });

  it("uses only named appearance choices and ignores free values", () => {
    const markup = html(
      pageOf([
        {
          id: "r",
          component: SectionKind.RichText,
          content: { blocks: [{ type: "paragraph", text: "x" }] },
          appearance: { background: "red; background:url(x)", spacing: "xl" },
          anchor: "topo",
        },
      ]),
    );
    expect(markup).not.toContain("url(x)");
    expect(markup).toContain('id="topo"');
  });

  it("shows portfolio cards only for the case studies it was given", () => {
    const content = { title: "Cases", source: "all", caseStudyIds: [], limit: 6 };
    const section = { id: "p", component: SectionKind.PortfolioGrid, content, appearance: {} };
    expect(
      html(pageOf([section]))
        .replace(/<[^>]*>/g, "")
        .trim(),
    ).toBe("");
    const withCase = renderToStaticMarkup(
      createElement(RenderPage, {
        page: pageOf([section]),
        ctx: {
          ...ctx,
          caseStudies: [
            {
              page_id: "c1",
              slug: "casos/aurora",
              card: { title: "Aurora", summary: "", imageVersionId: null },
              media: {},
            },
          ],
        },
      }),
    );
    expect(withCase).toContain("Aurora");
    expect(withCase).toContain('href="/casos/aurora"');
  });
});
