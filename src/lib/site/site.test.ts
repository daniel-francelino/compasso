import { beforeEach, describe, expect, it, vi } from "vitest";
import { withinRateLimit } from "@/lib/site/contact.server";
import { buildHead, robotsText, sitemapXml } from "@/lib/site/seo";
import type { PublishedPage, PublishedSettings } from "@/lib/shared/content/published";
import { SitePageKind } from "@/lib/shared/enums";

const rpc = vi.fn();

vi.mock("@/lib/shared/supabase/anon.server", () => ({
  anonClient: () => ({ rpc: (...args: unknown[]) => ({ abortSignal: () => rpc(...args) }) }),
}));
vi.mock("@/lib/shared/logger", () => ({ logError: vi.fn() }));

const page = (patch: Partial<PublishedPage["page"]> = {}): PublishedPage => ({
  format: 1,
  page: {
    id: "p1",
    slug: "servicos",
    kind: SitePageKind.Services,
    title: "Serviços",
    seo: { title: "", description: "Descrição" },
    sections: [],
    ...patch,
  },
  media: {},
});

const settings = (patch: Partial<PublishedSettings> = {}): PublishedSettings => ({
  site_id: "00000000-0000-0000-0000-000000000001",
  contacts: { whatsapp: "", email: "oi@example.test", phone: "" },
  social: { instagram: "https://instagram.com/aurora", other: "http://insecure.test" },
  seo_defaults: { title: "Aurora", description: "Padrão" },
  navigation: { header: [], footer: [] },
  announcement: { enabled: false, text: "", link: null },
  media: {},
  ...patch,
});

describe("buildHead", () => {
  it("falls back from the page SEO title to the page title and builds the canonical address", () => {
    const head = buildHead(page(), settings(), "https://site.example.test/");
    expect(head.meta).toContainEqual({ title: "Serviços" });
    expect(head.links).toEqual([{ rel: "canonical", href: "https://site.example.test/servicos" }]);
  });

  it("marks noindex pages and adds the share image when there is one", () => {
    const withImage = page({
      seo: {
        title: "T",
        description: "D",
        ogImage: "00000000-0000-0000-0000-0000000000aa",
        noindex: true,
      },
    });
    withImage.media = {
      "00000000-0000-0000-0000-0000000000aa": {
        small: "s",
        large: "https://media.example.test/l.webp",
        width: 1,
        height: 1,
      },
    };
    const head = buildHead(withImage, settings(), "https://site.example.test");
    expect(head.meta).toContainEqual({ name: "robots", content: "noindex" });
    expect(head.meta).toContainEqual({
      property: "og:image",
      content: "https://media.example.test/l.webp",
    });
  });

  it("describes the organization only on the home page and keeps only secure social links", () => {
    expect(buildHead(page(), settings(), "https://x.test").jsonLd).toBeNull();
    const home = buildHead(
      page({ kind: SitePageKind.Home, slug: "" }),
      settings(),
      "https://x.test",
    );
    const data = JSON.parse(home.jsonLd ?? "{}");
    expect(data["@type"]).toBe("Organization");
    expect(data.sameAs).toEqual(["https://instagram.com/aurora"]);
  });
});

describe("robots and sitemap", () => {
  it("blocks everything while nothing is published", () => {
    expect(robotsText(false, "https://x.test")).toBe("User-agent: *\nDisallow: /\n");
    expect(robotsText(true, "https://x.test/")).toContain("Sitemap: https://x.test/sitemap.xml");
    expect(robotsText(true, "https://x.test")).toContain("Disallow: /admin");
  });

  it("lists only the given pages and escapes the addresses", () => {
    const xml = sitemapXml(
      [
        { slug: "", updated_at: "2026-10-18T10:00:00Z" },
        { slug: "a&b", updated_at: "2026-10-19T10:00:00Z" },
      ],
      "https://x.test",
    );
    expect(xml).toContain("<loc>https://x.test/</loc>");
    expect(xml).toContain("<loc>https://x.test/a&amp;b</loc>");
    expect(xml).toContain("<lastmod>2026-10-19</lastmod>");
    expect(sitemapXml([], "https://x.test")).not.toContain("<url>");
  });
});

describe("contact rate limit", () => {
  it("allows a few attempts per window and then refuses until the window passes", () => {
    const now = 1_000_000;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(withinRateLimit("1.2.3.4", now + attempt)).toBe(true);
    }
    expect(withinRateLimit("1.2.3.4", now + 10)).toBe(false);
    expect(withinRateLimit("5.6.7.8", now + 10)).toBe(true);
    expect(withinRateLimit("1.2.3.4", now + 11 * 60 * 1000)).toBe(true);
  });
});

describe("public reader", () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.resetModules();
  });

  const okAnswer = {
    status: "ok",
    kind: SitePageKind.Services,
    content: page(),
    case_studies: [],
  };

  it("answers none when nothing was ever published and never invents a page", async () => {
    rpc.mockResolvedValue({ data: { status: "none" }, error: null });
    const { readPublicPage } = await import("@/lib/site/public-reader.server");
    const read = await readPublicPage("");
    expect(read).toEqual({ kind: "answer", answer: { status: "none" } });
  });

  it("serves the last good version when a later read fails, but only for that address", async () => {
    const { readPublicPage } = await import("@/lib/site/public-reader.server");
    rpc.mockResolvedValueOnce({ data: okAnswer, error: null });
    expect((await readPublicPage("servicos")).kind).toBe("answer");
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "down" } });
    const stale = await readPublicPage("servicos");
    expect(stale.kind === "answer" && stale.answer.status).toBe("ok");
    expect((await readPublicPage("outra")).kind).toBe("error");
  });

  it("reports an error, not a missing page, when the read fails with nothing in memory", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "down" } });
    const { readPublicPage } = await import("@/lib/site/public-reader.server");
    expect(await readPublicPage("servicos")).toEqual({ kind: "error" });
  });

  it("treats an unknown format as an error", async () => {
    rpc.mockResolvedValue({
      data: { ...okAnswer, content: { ...page(), format: 2 } },
      error: null,
    });
    const { readPublicPage } = await import("@/lib/site/public-reader.server");
    expect(await readPublicPage("servicos")).toEqual({ kind: "error" });
  });

  it("never caches an error as a settings answer", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "down" } });
    const { readPublicSettings } = await import("@/lib/site/public-reader.server");
    expect(await readPublicSettings()).toEqual({ kind: "error" });
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await readPublicSettings()).toEqual({ kind: "none" });
  });
});
