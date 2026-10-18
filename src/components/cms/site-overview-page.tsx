import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SectionCard } from "@/components/shared/admin/section-card";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { Button } from "@/components/shared/ui/button";
import { getSiteOverview } from "@/lib/cms/pages.functions";
import { formatDateTime } from "@/lib/shared/format";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="space-y-1 rounded-xl border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SiteOverviewPage() {
  const overview = useQuery({
    queryKey: QueryKey.Site.overview(),
    queryFn: async () => unwrapResult(await getSiteOverview()).overview,
  });

  if (overview.isPending) return <PageSkeleton rows={3} />;
  if (overview.isError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-danger">{overview.error.message}</p>
        <Button type="button" variant="outline" onClick={() => void overview.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }
  const data = overview.data;
  return (
    <div className="space-y-6">
      <PageHeader title="Site" description="O que está no ar e o que falta publicar." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Páginas no ar"
          value={`${data.pagesPublished} de ${data.pagesTotal}`}
          hint={
            data.lastPublishedAt
              ? `Última publicação em ${formatDateTime(data.lastPublishedAt)}`
              : "Nada foi publicado ainda"
          }
        />
        <Stat
          label="Alterações por publicar"
          value={String(data.pagesWithChanges)}
          hint="Páginas no ar com edições novas"
        />
        <Stat
          label="Configurações"
          value={data.settingsDirty ? "Por publicar" : "No ar"}
          hint="Contatos, menu e SEO padrão"
        />
        <Stat label="Mensagens novas" value={String(data.messagesNew)} />
      </div>
      {data.withdrawnCases > 0 ? (
        <SectionCard as="div" title="Atenção">
          <p className="text-sm">
            {data.withdrawnCases === 1
              ? "Um case perdeu a autorização e já saiu do ar."
              : `${data.withdrawnCases} cases perderam a autorização e já saíram do ar.`}{" "}
            Revise a página para publicar de novo ou tirá-la do ar.
          </p>
        </SectionCard>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/admin/site/pages">Ver páginas</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/admin/site/messages">Ver mensagens</Link>
        </Button>
        <Button asChild variant="outline">
          <a href="/" target="_blank" rel="noopener noreferrer">
            Ver site
          </a>
        </Button>
      </div>
    </div>
  );
}
