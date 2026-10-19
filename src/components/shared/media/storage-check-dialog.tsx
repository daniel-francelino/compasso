import { useQuery } from "@tanstack/react-query";
import { ScanSearch, RotateCw, X } from "lucide-react";
import { Button } from "@/components/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog";
import { formatBytes } from "@/lib/shared/format";
import { checkStorage } from "@/lib/shared/media/media.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

export function StorageCheckDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const query = useQuery({
    queryKey: QueryKey.Media.check(),
    queryFn: async () => unwrapResult(await checkStorage()).report,
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanSearch className="size-5 text-muted-foreground" aria-hidden="true" /> Verificar com
            o bucket
          </DialogTitle>
          <DialogDescription>
            Compara o que está guardado no armazenamento com a biblioteca. Só leitura: nada é
            alterado.
          </DialogDescription>
        </DialogHeader>
        {query.isFetching ? <p className="text-sm text-muted-foreground">Verificando…</p> : null}
        {query.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {query.error.message}
          </p>
        ) : null}
        {query.data && !query.isFetching ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Objetos no bucket</dt>
              <dd>{query.data.bucketObjects}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tamanho real</dt>
              <dd>{formatBytes(query.data.bucketBytes)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Objetos desconhecidos</dt>
              <dd>{query.data.unknownCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Registros sem objeto</dt>
              <dd>{query.data.missingCount}</dd>
            </div>
            {query.data.truncated ? (
              <p className="col-span-2 text-warning">
                A lista do bucket foi cortada: o resultado é parcial.
              </p>
            ) : null}
          </dl>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RotateCw aria-hidden="true" />
            Verificar de novo
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            <X aria-hidden="true" />
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
