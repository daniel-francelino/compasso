import { useQuery } from "@tanstack/react-query";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { RenderPage } from "@/components/shared/site/render-page";
import type { SiteRenderContext } from "@/components/shared/site/site-context";
import { useSignedUrls } from "@/hooks/shared/use-signed-urls";
import { getPreview } from "@/lib/cms/publish.functions";
import type { PublishedMedia } from "@/lib/shared/content/published";
import { MediaVariant } from "@/lib/shared/media/schemas";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

export function PreviewPage({ pageId }: { pageId: string }) {
  const preview = useQuery({
    queryKey: QueryKey.Site.preview(pageId),
    queryFn: async () => unwrapResult(await getPreview({ data: { pageId } })),
    gcTime: 0,
  });
  const urls = useSignedUrls(preview.data?.mediaIds ?? [], MediaVariant.Display);

  if (preview.isPending) return <PageSkeleton rows={3} />;
  if (preview.isError) return <p className="p-6 text-sm text-danger">{preview.error.message}</p>;

  const media: PublishedMedia = {};
  for (const id of preview.data.mediaIds) {
    const url = urls.data?.[id];
    if (url) media[id] = { small: url, large: url, width: null, height: null };
  }
  const ctx: SiteRenderContext = {
    media,
    caseStudies: [],
    siteId: null,
    pageSlug: preview.data.slug,
    turnstileSiteKey: null,
    preview: true,
    submitContact: null,
  };
  return (
    <div className="min-h-screen bg-ivory text-ink">
      <p className="bg-warning/20 px-6 py-2 text-center text-sm">
        Pré-visualização do rascunho salvo. Esta página não é pública.
      </p>
      <RenderPage page={preview.data.page} ctx={ctx} />
    </div>
  );
}
