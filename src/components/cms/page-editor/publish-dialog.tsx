import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Rocket } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/admin/auth-shell";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { TextField } from "@/components/shared/admin/form-fields";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { ProblemList } from "@/components/cms/page-editor/problem-list";
import { checkPublish, publishSitePage } from "@/lib/cms/publish.functions";
import { hasErrors } from "@/lib/shared/content/resolve";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

export function PublishDialog({
  pageId,
  hasUnsaved,
  onOpenChange,
}: {
  pageId: string;
  hasUnsaved: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = useQuery({
    queryKey: QueryKey.Site.check(pageId),
    queryFn: async () => unwrapResult(await checkPublish({ data: { pageId } })).check,
    gcTime: 0,
  });

  const blocked = hasUnsaved || check.data === undefined || hasErrors(check.data.problems);

  async function publish() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await publishSitePage({ data: { pageId, note } });
      if (!result.ok) {
        setError(result.message);
        void check.refetch();
        return;
      }
      toast.success(`Versão ${result.revisionNo} publicada.`);
      await queryClient.invalidateQueries({ queryKey: QueryKey.Site.all() });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      icon={Rocket}
      title="Publicar página"
      description="Confira a lista antes de colocar a página no ar. Erros bloqueiam; avisos não."
      submitLabel="Publicar"
      busy={busy}
      submitDisabled={blocked}
      onSubmit={publish}
    >
      {hasUnsaved ? (
        <p role="alert" className="text-sm text-danger">
          Há alterações sem salvar. Salve a página antes de publicar.
        </p>
      ) : null}
      {check.isPending ? <ListSkeleton rows={2} height="h-6" /> : null}
      {check.isError ? <p className="text-sm text-danger">{check.error.message}</p> : null}
      {check.data ? (
        check.data.problems.length === 0 ? (
          <p className="text-sm">Tudo certo: nenhum item para corrigir.</p>
        ) : (
          <ProblemList problems={check.data.problems} />
        )
      ) : null}
      <TextField
        id="publish-note"
        label="Nota da versão (opcional)"
        value={note}
        onValueChange={setNote}
        maxLength={500}
      />
      <FormError message={error} />
    </FormDialog>
  );
}
