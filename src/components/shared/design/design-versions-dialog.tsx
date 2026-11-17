import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Modal } from "lost-ui/elements/modal";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { Button } from "@/components/shared/ui/button";
import { Skeleton } from "@/components/shared/ui/skeleton";
import { listDesignVersions } from "@/lib/shared/design/design.functions";
import { formatDateTime } from "@/lib/shared/format";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

export function DesignVersionsDialog({
  open,
  onOpenChange,
  designId,
  timeZone,
  editable,
  onRestore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designId: string;
  timeZone: string;
  editable: boolean;
  onRestore: (versionNo: number) => Promise<boolean>;
}) {
  const [restoring, setRestoring] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: QueryKey.Design.versions(designId),
    queryFn: async () =>
      unwrapResult(await listDesignVersions({ data: { id: designId } })).versions,
    enabled: open,
  });

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Versões"
        description={`As versões salvas nunca mudam. Restaurar copia uma delas para o rascunho. Horários em ${timeZone}.`}
        footer={({ close }) => (
          <Button type="button" variant="outline" onClick={close}>
            <ArrowLeft aria-hidden="true" />
            Voltar
          </Button>
        )}
      >
        {query.isPending ? <Skeleton className="h-32 w-full" /> : null}
        {query.isError ? (
          <div className="space-y-2">
            <p role="alert" className="text-sm">
              {query.error.message}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : null}
        {query.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma versão salva ainda. Use "Salvar versão" para guardar o estado atual.
          </p>
        ) : null}
        {query.data && query.data.length > 0 ? (
          <ul className="divide-y">
            {query.data.map((version) => (
              <li key={version.versionNo} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Versão {version.versionNo}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(version.createdAt, timeZone)}
                    {version.authorName === null ? "" : ` · ${version.authorName}`}
                  </p>
                </div>
                {editable ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRestoring(version.versionNo)}
                  >
                    <RotateCcw aria-hidden="true" />
                    Restaurar no rascunho
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Modal>
      <ConfirmDialog
        open={restoring !== null}
        onOpenChange={(next) => !next && setRestoring(null)}
        title={`Restaurar a versão ${restoring ?? ""}`}
        description="O rascunho atual é substituído pelo conteúdo desta versão. A versão continua salva como está; se quiser guardar o rascunho atual, salve uma versão antes."
        confirmLabel="Restaurar no rascunho"
        busy={busy}
        onConfirm={async () => {
          if (restoring === null) return false;
          setBusy(true);
          const ok = await onRestore(restoring);
          setBusy(false);
          if (ok) {
            setRestoring(null);
            onOpenChange(false);
          }
          return ok;
        }}
      />
    </>
  );
}
