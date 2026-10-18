import { RenderPage } from "@/components/shared/site/render-page";
import type { ContactPayload, SiteRenderContext } from "@/components/shared/site/site-context";
import { SiteLayout } from "@/components/shared/site/site-layout";
import { PublicSiteState } from "@/lib/shared/enums";
import { submitContactMessage, type PublicSiteResult } from "@/lib/site/public.functions";

export function PreparingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-ivory px-6 text-center text-ink">
      <h1 className="heading-page">Site em preparação</h1>
      <p className="text-ink-soft">Volte em alguns instantes.</p>
    </main>
  );
}

export function PublicSitePage({ result, slug }: { result: PublicSiteResult; slug: string }) {
  if (result.state === PublicSiteState.None) return <PreparingPage />;
  if (result.state === PublicSiteState.Redirect) return null;
  if (result.state === PublicSiteState.NotFound) {
    return (
      <SiteLayout settings={result.settings}>
        <div className="mx-auto max-w-3xl space-y-3 px-6 py-24 text-center">
          <h1 className="heading-page">Página não encontrada</h1>
          <p className="text-ink-soft">O endereço não existe ou saiu do ar.</p>
          <a href="/" className="underline">
            Ir para o início
          </a>
        </div>
      </SiteLayout>
    );
  }

  const ctx: SiteRenderContext = {
    media: { ...(result.settings?.media ?? {}), ...result.page.media },
    caseStudies: result.caseStudies,
    siteId: result.settings?.site_id ?? null,
    pageSlug: slug,
    turnstileSiteKey: result.turnstileSiteKey,
    preview: false,
    submitContact: async (payload: ContactPayload) => {
      const outcome = await submitContactMessage({ data: { ...payload, slug } });
      return outcome.ok ? { ok: true } : { ok: false, message: outcome.message };
    },
  };
  return (
    <SiteLayout settings={result.settings}>
      <RenderPage page={result.page} ctx={ctx} />
    </SiteLayout>
  );
}
