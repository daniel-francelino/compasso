import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { PageHeader } from "@/components/shared/admin/page-header";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { listSitePages } from "@/lib/cms/pages.functions";
import { SitePageKind, SitePageStatus } from "@/lib/shared/enums";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

export function PortfolioPage() {
  const pages = useQuery({
    queryKey: QueryKey.Site.pages(),
    queryFn: async () => unwrapResult(await listSitePages()).pages,
  });
  const cases = (pages.data ?? []).filter((page) => page.kind === SitePageKind.CaseStudy);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfólio"
        description="Cada case é uma página. Só entra no site com a autorização do cliente registrada na própria página."
        breadcrumbs={[{ label: "Portfólio" }]}
      />
      {pages.isPending ? <ListSkeleton rows={3} height="h-14" /> : null}
      {pages.isError ? <p className="text-sm text-danger">{pages.error.message}</p> : null}
      {pages.data && cases.length === 0 ? (
        <EmptyState
          title="Nenhum case ainda"
          description="Crie uma página do tipo “Case” em Páginas e registre a autorização do cliente nela."
        />
      ) : null}
      {cases.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {cases.map((page) => (
            <li key={page.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <Link
                to="/admin/site/pages/$pageId"
                params={{ pageId: page.id }}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {page.title || page.slug}
              </Link>
              <span className="flex gap-2">
                <StatusBadge tone={page.authorized ? "success" : "negative"} icon={BadgeCheck}>
                  {page.authorized ? "Autorizado" : "Sem autorização"}
                </StatusBadge>
                <StatusBadge
                  tone={
                    page.status === SitePageStatus.Published && page.authorized
                      ? "success"
                      : "neutral"
                  }
                  icon={BadgeCheck}
                >
                  {page.status === SitePageStatus.Published && page.authorized
                    ? "No ar"
                    : "Fora do site"}
                </StatusBadge>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
