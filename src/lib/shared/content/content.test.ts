import { describe, expect, it } from "vitest";
import { LinkProblem, type PageRef, resolveLink } from "@/lib/shared/content/links";
import { publicKeys, publicUrls } from "@/lib/shared/content/media-urls";
import { publishedPageSchema } from "@/lib/shared/content/published";
import { componentRegistry, newSection } from "@/lib/shared/content/registry";
import { type ResolveContext, hasErrors, resolveDraftPage } from "@/lib/shared/content/resolve";
import { resolveSettings } from "@/lib/shared/content/resolve-settings";
import { parseRichText } from "@/lib/shared/content/rich-text";
import {
  LinkKind,
  ProblemSeverity,
  SectionKind,
  SiteEntryKind,
  SitePageKind,
  SitePageStatus,
} from "@/lib/shared/enums";

const PAGE_A = "00000000-0000-0000-0000-00000000000a";
const PAGE_B = "00000000-0000-0000-0000-00000000000b";
const IMAGE = "00000000-0000-0000-0000-0000000000f1";

const pageRef = (patch: Partial<PageRef> = {}): PageRef => ({
  id: PAGE_B,
  kind: SitePageKind.Services,
  slug: "servicos",
  status: SitePageStatus.Published,
  authorized: false,
  title: "Serviços",
  anchors: { s1: "lista" },
  ...patch,
});

const context = (patch: Partial<ResolveContext> = {}): ResolveContext => ({
  page: { id: PAGE_A, kind: SitePageKind.Generic, slug: "sobre", hasPublished: true },
  pages: [pageRef()],
  entries: [],
  settings: { contacts: { whatsapp: "5511999990000", email: "oi@example.test", phone: "" } },
  media: { [IMAGE]: { checksum: "a".repeat(64), width: 800, height: 600, published: true } },
  mediaBaseUrl: "https://media.example.test",
  ...patch,
});

const linkContext = () => ({
  selfId: PAGE_A,
  pages: [pageRef()],
  contacts: { whatsapp: "5511999990000", email: "oi@example.test", phone: "+55 11 3333-4444" },
  pageTitle: "Sobre",
});

const draft = (sections: unknown[], seo = { title: "Título", description: "Descrição" }) => ({
  title: "Sobre",
  seo,
  sections,
});

const section = (kind: SectionKind, content: Record<string, unknown>, extra = {}) => ({
  ...newSection(kind, `${kind}-1`),
  content,
  ...extra,
});

describe("links", () => {
  it("resolve a page, an anchor and a case study to final addresses", () => {
    expect(resolveLink({ kind: LinkKind.Page, pageId: PAGE_B }, linkContext()).link).toEqual({
      href: "/servicos",
      newTab: false,
    });
    expect(
      resolveLink({ kind: LinkKind.Anchor, pageId: PAGE_B, sectionId: "s1" }, linkContext()).link
        ?.href,
    ).toBe("/servicos#lista");
  });

  it("report a page that is gone, unpublished or an unknown anchor", () => {
    const ctx = linkContext();
    expect(resolveLink({ kind: LinkKind.Page, pageId: PAGE_A + "x" }, ctx).problem).toBe(
      LinkProblem.MissingPage,
    );
    const unpublished = { ...ctx, pages: [pageRef({ status: SitePageStatus.Draft })] };
    expect(resolveLink({ kind: LinkKind.Page, pageId: PAGE_B }, unpublished).problem).toBe(
      LinkProblem.UnpublishedPage,
    );
    expect(
      resolveLink({ kind: LinkKind.Anchor, pageId: PAGE_B, sectionId: "nope" }, ctx).problem,
    ).toBe(LinkProblem.MissingAnchor);
  });

  it("refuse a case study without authorization", () => {
    const ctx = {
      ...linkContext(),
      pages: [pageRef({ kind: SitePageKind.CaseStudy, authorized: false })],
    };
    expect(resolveLink({ kind: LinkKind.CaseStudy, pageId: PAGE_B }, ctx).problem).toBe(
      LinkProblem.UnauthorizedCase,
    );
  });

  it("allow only https or internal addresses and open external ones in a new tab", () => {
    const ctx = linkContext();
    expect(resolveLink({ kind: LinkKind.Url, url: "https://example.test" }, ctx).link?.newTab).toBe(
      true,
    );
    expect(resolveLink({ kind: LinkKind.Url, url: "/contato" }, ctx).link?.newTab).toBe(false);
    expect(resolveLink({ kind: LinkKind.Url, url: "http://example.test" }, ctx).problem).toBe(
      LinkProblem.InvalidUrl,
    );
    expect(resolveLink({ kind: LinkKind.Url, url: "//evil.test" }, ctx).problem).toBe(
      LinkProblem.InvalidUrl,
    );
    expect(resolveLink({ kind: LinkKind.Url, url: "javascript:alert(1)" }, ctx).problem).toBe(
      LinkProblem.InvalidUrl,
    );
  });

  it("build WhatsApp, email and phone links from the settings", () => {
    const ctx = linkContext();
    expect(
      resolveLink({ kind: LinkKind.Whatsapp, message: "Oi, vim por {{page}}" }, ctx).link?.href,
    ).toBe("https://wa.me/5511999990000?text=Oi%2C%20vim%20por%20Sobre");
    expect(resolveLink({ kind: LinkKind.Email, subject: "Orçamento" }, ctx).link?.href).toBe(
      "mailto:oi@example.test?subject=Or%C3%A7amento",
    );
    expect(resolveLink({ kind: LinkKind.Phone }, ctx).link?.href).toBe("tel:+551133334444");
    const empty = { ...ctx, contacts: { whatsapp: "", email: "", phone: "" } };
    expect(resolveLink({ kind: LinkKind.Whatsapp, message: "" }, empty).problem).toBe(
      LinkProblem.MissingContact,
    );
  });
});

describe("public media names", () => {
  it("are derived from the content hash and never from the original", () => {
    const keys = publicKeys("a".repeat(64));
    expect(keys.small).toBe(`site/${"a".repeat(32)}-400.webp`);
    expect(keys.large).toBe(`site/${"a".repeat(32)}-1600.webp`);
    expect(publicUrls("a".repeat(64), "https://media.example.test/").large).toBe(
      `https://media.example.test/site/${"a".repeat(32)}-1600.webp`,
    );
  });
});

describe("rich text", () => {
  it("reads headings, paragraphs and lists", () => {
    expect(parseRichText("# Título\nTexto\n\nOutro parágrafo\n\n- um\n- dois")).toEqual([
      { type: "heading", text: "Título" },
      { type: "paragraph", text: "Texto" },
      { type: "paragraph", text: "Outro parágrafo" },
      { type: "list", items: ["um", "dois"] },
    ]);
  });

  it("never produces markup", () => {
    expect(parseRichText("<script>alert(1)</script>")).toEqual([
      { type: "paragraph", text: "<script>alert(1)</script>" },
    ]);
  });
});

describe("registry", () => {
  it("describes every section kind and gives each one valid defaults", () => {
    for (const kind of Object.values(SectionKind)) {
      expect(componentRegistry[kind].label.length).toBeGreaterThan(0);
      expect(newSection(kind, "x").content).toBeTypeOf("object");
    }
  });
});

describe("resolveDraftPage", () => {
  it("publishes a valid page with final links and public image names", () => {
    const result = resolveDraftPage(
      draft([
        section(
          SectionKind.Hero,
          {
            headline: "Estratégia",
            image: { mediaVersionId: IMAGE, alt: "Mesa de trabalho" },
            primaryCta: { label: "Ver serviços", link: { kind: LinkKind.Page, pageId: PAGE_B } },
          },
          { anchor: "topo" },
        ),
      ]),
      context(),
    );
    expect(result.problems).toEqual([]);
    const hero = result.published.page.sections[0];
    expect(hero?.content["primaryCta"]).toEqual({
      label: "Ver serviços",
      href: "/servicos",
      newTab: false,
    });
    expect(result.published.media[IMAGE]?.large).toBe(
      `https://media.example.test/site/${"a".repeat(32)}-1600.webp`,
    );
    expect(publishedPageSchema.safeParse(result.published).success).toBe(true);
  });

  it("leaves hidden sections out of the published version", () => {
    const result = resolveDraftPage(
      draft([
        section(SectionKind.RichText, { body: "Texto" }),
        section(SectionKind.Faq, {}, { id: "faq-1", visible: false }),
      ]),
      context(),
    );
    expect(result.published.page.sections.map((item) => item.component)).toEqual([
      SectionKind.RichText,
    ]);
  });

  it("blocks a missing required field, a missing alt text and an unpublished image", () => {
    const result = resolveDraftPage(
      draft([
        section(SectionKind.Hero, { headline: "", image: { mediaVersionId: IMAGE, alt: "" } }),
      ]),
      context({
        media: { [IMAGE]: { checksum: "a".repeat(64), width: 1, height: 1, published: false } },
      }),
    );
    const codes = result.problems.map((problem) => problem.code);
    expect(codes).toContain("required_missing");
    expect(codes).toContain("image_alt_missing");
    expect(codes).toContain("image_not_published");
    expect(hasErrors(result.problems)).toBe(true);
    expect(Object.keys(result.published.media)).toEqual([]);
  });

  it("accepts a decorative image without alt text", () => {
    const result = resolveDraftPage(
      draft([
        section(SectionKind.ImageText, {
          title: "Quem sou",
          image: { mediaVersionId: IMAGE, alt: "", decorative: true },
        }),
      ]),
      context(),
    );
    expect(result.problems.map((problem) => problem.code)).not.toContain("image_alt_missing");
  });

  it("blocks a page without SEO and a repeated anchor", () => {
    const result = resolveDraftPage(
      draft(
        [
          section(SectionKind.RichText, { body: "A" }, { id: "a", anchor: "topo" }),
          section(SectionKind.RichText, { body: "B" }, { id: "b", anchor: "topo" }),
        ],
        { title: "", description: "" },
      ),
      context(),
    );
    const codes = result.problems.map((problem) => problem.code);
    expect(codes).toContain("seo_missing");
    expect(codes).toContain("anchor_duplicate");
  });

  it("treats an empty home page as an error only on the first publication", () => {
    const home = { id: PAGE_A, kind: SitePageKind.Home, slug: "" };
    const first = resolveDraftPage(draft([]), context({ page: { ...home, hasPublished: false } }));
    expect(first.problems.find((problem) => problem.code === "home_empty")?.severity).toBe(
      ProblemSeverity.Error,
    );
    const later = resolveDraftPage(draft([]), context({ page: { ...home, hasPublished: true } }));
    expect(later.problems.find((problem) => problem.code === "page_empty")?.severity).toBe(
      ProblemSeverity.Warning,
    );
  });

  it("blocks a button that points to an unpublished page", () => {
    const result = resolveDraftPage(
      draft([
        section(SectionKind.ImageText, {
          title: "Oi",
          cta: { label: "Ir", link: { kind: LinkKind.Page, pageId: PAGE_B } },
        }),
      ]),
      context({ pages: [pageRef({ status: SitePageStatus.Draft })] }),
    );
    expect(result.problems.map((problem) => problem.code)).toContain("link_unpublished_page");
  });

  it("freezes only the visible entries, in order and within the limit", () => {
    const entry = (name: string, sortOrder: number, visible: boolean) => ({
      kind: SiteEntryKind.Service,
      content: { name, description: "d" },
      sortOrder,
      visible,
    });
    const result = resolveDraftPage(
      draft([section(SectionKind.ServicesGrid, { limit: 2 })]),
      context({
        entries: [
          entry("C", 3, true),
          entry("A", 1, true),
          entry("Oculto", 2, false),
          entry("B", 4, true),
        ],
      }),
    );
    const items = result.published.page.sections[0]?.content["items"] as { name: string }[];
    expect(items.map((item) => item.name)).toEqual(["A", "C"]);
  });

  it("never publishes the recipient email of the contact form", () => {
    const result = resolveDraftPage(
      draft([
        section(SectionKind.ContactForm, {
          recipientEmail: "segredo@example.test",
          consentText: "Concordo",
          successMessage: "Enviado",
        }),
      ]),
      context(),
    );
    expect(JSON.stringify(result.published)).not.toContain("segredo@example.test");
  });

  it("builds the card of a case study from the first image and the description", () => {
    const result = resolveDraftPage(
      draft([
        section(SectionKind.Hero, {
          headline: "Aurora",
          image: { mediaVersionId: IMAGE, alt: "x" },
        }),
      ]),
      context({
        page: {
          id: PAGE_A,
          kind: SitePageKind.CaseStudy,
          slug: "casos/aurora",
          hasPublished: false,
        },
      }),
    );
    expect(result.published.page.card).toEqual({
      title: "Sobre",
      summary: "Descrição",
      imageVersionId: IMAGE,
    });
    expect(result.mediaIds).toContain(IMAGE);
  });
});

describe("resolveSettings", () => {
  it("resolves the menu and warns about an empty one", () => {
    const empty = resolveSettings({}, { siteId: "s", pages: [], media: {}, mediaBaseUrl: null });
    expect(empty.problems.map((problem) => problem.code)).toContain("menu_empty");
    const filled = resolveSettings(
      {
        navigation: {
          header: [
            { label: "Serviços", link: { kind: LinkKind.Page, pageId: PAGE_B }, children: [] },
          ],
          footer: [],
        },
      },
      { siteId: "s", pages: [pageRef()], media: {}, mediaBaseUrl: null },
    );
    expect(filled.published.navigation.header[0]?.link?.href).toBe("/servicos");
    expect(filled.problems).toEqual([]);
  });

  it("blocks a menu entry that points to a page that is not live and an unpublished share image", () => {
    const result = resolveSettings(
      {
        navigation: {
          header: [{ label: "X", link: { kind: LinkKind.Page, pageId: PAGE_B }, children: [] }],
          footer: [],
        },
        seo_defaults: { title: "t", description: "d", ogImage: IMAGE },
      },
      {
        siteId: "s",
        pages: [pageRef({ status: SitePageStatus.Draft })],
        media: { [IMAGE]: { checksum: null, width: null, height: null, published: false } },
        mediaBaseUrl: null,
      },
    );
    const codes = result.problems.map((problem) => problem.code);
    expect(codes).toContain("link_unpublished_page");
    expect(codes).toContain("image_not_published");
  });
});
