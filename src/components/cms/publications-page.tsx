import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { SelectField } from "@/components/shared/admin/form-fields";
import { PageHeader } from "@/components/shared/admin/page-header";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { Button } from "@/components/shared/ui/button";
import { listSitePages } from "@/lib/cms/pages.functions";
import {
  type RevisionRow,
  listRevisions,
  rollbackSitePage,
  unpublishSitePage,
} from "@/lib/cms/publish.functions";
import { SitePageStatus } from "@/lib/shared/enums";
import { formatDateTime } from "@/lib/shared/format";
import { sitePageKindLabels } from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

function Revisions({ pageId, status }: { pageId: string; status: SitePageStatus }) {
  const queryClient = useQueryClient();
  const [restoring, setRestoring] = useState<RevisionRow | null>(null);
  const [unpublishing, setUnpublishing] = useState(false);
  const revisions = useQuery({
    queryKey: QueryKey.Site.revisions(pageId),
    queryFn: async () => unwrapResult(await listRevisions({ data: { pageId } })).revisions,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: QueryKey.Site.all() });

  if (revisions.isPending) return <ListSkeleton rows={3} height="h-12" />;
  if (revisions.isError) return <p className="text-sm text-danger">{revisions.error.message}</p>;
  if (revisions.data.length === 0) {
    return (
      <EmptyState
        title="Esta página ainda não foi publicada"
        description="As versões aparecem aqui depois da primeira publicação."
      />
    );
  }
  return (
    <div className="space-y-4">
      {status === SitePageStatus.Published ? (
        <Button type="button" variant="outline" onClick={() => setUnpublishing(true)}>
          Tirar do ar
        </Button>
      ) : null}
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {revisions.data.map((revision) => (
          <li
            key={revision.id}
            className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
          >
            <span className="min-w-0">
              <span className="block font-medium">
                Versão {revision.revisionNo}
                {revision.fromRevisionNo ? ` (volta à versão ${revision.fromRevisionNo})` : ""}
              </span>
              <span className="block text-xs text-muted-foreground">
                {formatDateTime(revision.publishedAt)}
                {revision.note ? ` · ${revision.note}` : ""}
              </span>
            </span>
            <span className="flex items-center gap-2">
              {revision.current ? (
                <StatusBadge tone="success" icon={Undo2}>
                  No ar
                </StatusBadge>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRestoring(revision)}
                >
                  <Undo2 aria-hidden="true" /> Voltar para esta
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={restoring !== null}
        onOpenChange={(open) => !open && setRestoring(null)}
        title={`Voltar para a versão ${restoring?.revisionNo ?? ""}?`}
        description="O conteúdo dessa versão é publicado de novo, como uma versão nova, e vira o rascunho atual. O histórico continua inteiro."
        confirmLabel="Voltar para esta versão"
        onConfirm={async () => {
          if (restoring === null) return true;
          const result = await rollbackSitePage({ data: { pageId, revisionId: restoring.id } });
          if (!result.ok) {
            toast.error(result.message);
            return false;
          }
          toast.success(`Versão ${result.revisionNo} publicada.`);
          await refresh();
          return true;
        }}
      />
      <ConfirmDialog
        open={unpublishing}
        onOpenChange={setUnpublishing}
        title="Tirar a página do ar?"
        description="A página deixa de aparecer no site e no mapa do site. Você pode publicar de novo quando quiser."
        confirmLabel="Tirar do ar"
        destructive
        onConfirm={async () => {
          const result = await unpublishSitePage({ data: { pageId } });
          if (!result.ok) {
            toast.error(result.message);
            return false;
          }
          toast.success("Página fora do ar.");
          await refresh();
          return true;
        }}
      />
    </div>
  );
}

export function PublicationsPage() {
  const [pageId, setPageId] = useState("");
  const pages = useQuery({
    queryKey: QueryKey.Site.pages(),
    queryFn: async () => unwrapResult(await listSitePages()).pages,
  });
  const selected = pages.data?.find((page) => page.id === pageId) ?? null;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Publicações"
        description="O histórico de versões de cada página e a volta a uma versão anterior."
        breadcrumbs={[{ label: "Publicações" }]}
      />
      <SelectField
        id="publications-page"
        label="Página"
        value={pageId}
        onValueChange={setPageId}
        placeholder="Escolha uma página"
        options={(pages.data ?? []).map((page) => ({
          value: page.id,
          label: `${page.title || sitePageKindLabels[page.kind]} (${page.slug === "" ? "/" : `/${page.slug}`})`,
        }))}
      />
      {selected ? (
        <Revisions key={selected.id} pageId={selected.id} status={selected.status} />
      ) : null}
    </div>
  );
}
