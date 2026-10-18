import type { SiteLink } from "@/lib/shared/content/schemas";
import { LinkKind, SitePageKind, SitePageStatus } from "@/lib/shared/enums";

export type PageRef = {
  id: string;
  kind: SitePageKind;
  slug: string;
  status: SitePageStatus;
  authorized: boolean;
  title: string;
  anchors: Record<string, string>;
};

export type ResolvedLink = { href: string; newTab: boolean };

export const LinkProblem = {
  MissingPage: "missing_page",
  UnpublishedPage: "unpublished_page",
  MissingAnchor: "missing_anchor",
  UnauthorizedCase: "unauthorized_case",
  InvalidUrl: "invalid_url",
  MissingContact: "missing_contact",
} as const;
export type LinkProblem = (typeof LinkProblem)[keyof typeof LinkProblem];

export type LinkContext = {
  selfId: string;
  pages: PageRef[];
  contacts: { whatsapp: string; email: string; phone: string };
  pageTitle: string;
};

type Outcome = { link: ResolvedLink | null; problem: LinkProblem | null };

const ok = (href: string, newTab: boolean): Outcome => ({ link: { href, newTab }, problem: null });
const bad = (problem: LinkProblem): Outcome => ({ link: null, problem });

export const pagePath = (slug: string): string => (slug === "" ? "/" : `/${slug}`);

const internalTarget = (link: Extract<SiteLink, { pageId: string }>, ctx: LinkContext) => {
  const target = ctx.pages.find((page) => page.id === link.pageId);
  if (target === undefined) return { target: null, problem: LinkProblem.MissingPage };
  if (target.id !== ctx.selfId && target.status !== SitePageStatus.Published) {
    return { target: null, problem: LinkProblem.UnpublishedPage };
  }
  if (target.kind === SitePageKind.CaseStudy && !target.authorized) {
    return { target: null, problem: LinkProblem.UnauthorizedCase };
  }
  return { target, problem: null };
};

const isExternal = (url: string): boolean => url.startsWith("https://");

const isInternalPath = (url: string): boolean => url.startsWith("/") && !url.startsWith("//");

const urlOutcome = (link: Extract<SiteLink, { kind: "url" }>): Outcome => {
  if (isExternal(link.url)) return ok(link.url, link.newTab ?? true);
  return isInternalPath(link.url)
    ? ok(link.url, link.newTab ?? false)
    : bad(LinkProblem.InvalidUrl);
};

const whatsappOutcome = (
  link: Extract<SiteLink, { kind: "whatsapp" }>,
  ctx: LinkContext,
): Outcome => {
  if (ctx.contacts.whatsapp === "") return bad(LinkProblem.MissingContact);
  const message = link.message.replaceAll("{{page}}", ctx.pageTitle);
  const query = message === "" ? "" : `?text=${encodeURIComponent(message)}`;
  return ok(`https://wa.me/${ctx.contacts.whatsapp}${query}`, link.newTab ?? true);
};

const emailOutcome = (link: Extract<SiteLink, { kind: "email" }>, ctx: LinkContext): Outcome => {
  if (ctx.contacts.email === "") return bad(LinkProblem.MissingContact);
  const subject = link.subject ? `?subject=${encodeURIComponent(link.subject)}` : "";
  return ok(`mailto:${ctx.contacts.email}${subject}`, false);
};

const phoneOutcome = (ctx: LinkContext): Outcome => {
  const digits = ctx.contacts.phone.replace(/[^\d+]/g, "");
  return digits === "" ? bad(LinkProblem.MissingContact) : ok(`tel:${digits}`, false);
};

const pageOutcome = (link: Extract<SiteLink, { pageId: string }>, ctx: LinkContext): Outcome => {
  const { target, problem } = internalTarget(link, ctx);
  if (target === null) return bad(problem ?? LinkProblem.MissingPage);
  if (link.kind !== LinkKind.Anchor) return ok(pagePath(target.slug), link.newTab ?? false);
  const anchor = target.anchors[link.sectionId];
  return anchor === undefined
    ? bad(LinkProblem.MissingAnchor)
    : ok(`${pagePath(target.slug)}#${anchor}`, link.newTab ?? false);
};

export const resolveLink = (link: SiteLink, ctx: LinkContext): Outcome => {
  switch (link.kind) {
    case LinkKind.Url:
      return urlOutcome(link);
    case LinkKind.Whatsapp:
      return whatsappOutcome(link, ctx);
    case LinkKind.Email:
      return emailOutcome(link, ctx);
    case LinkKind.Phone:
      return phoneOutcome(ctx);
    default:
      return pageOutcome(link, ctx);
  }
};
