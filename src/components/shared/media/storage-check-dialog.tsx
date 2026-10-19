import { useQuery } from "@tanstack/react-query";
import { HardDrive, RotateCw, ScanSearch, X } from "lucide-react";
import { useState } from "react";
import { StorageBar } from "@/components/shared/media/storage-bar";
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
  canCheck,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canCheck: boolean;
}) {
  const [checking, setChecking] = useState(false);
  const query = useQuery({
    queryKey: QueryKey.Media.check(),
    queryFn: async () => unwrapResult(await checkStorage()).report,
    enabled: open && checking,
    staleTime: 0,
    gcTime: 0,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setChecking(false);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="size-5 text-muted-foreground" aria-hidden="true" />
            Armazenamento
          </DialogTitle>
          <DialogDescription>
            O espaço usado pela biblioteca. O limite padrão é de 10 GB, o plano gratuito do R2.
          </DialogDescription>
        </DialogHeader>
        <StorageBar />
        {canCheck ? (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Compara o que está guardado no bucket com a biblioteca. Só leitura: nada é alterado.
            </p>
            {query.isFetching ? (
              <p className="text-sm text-muted-foreground">Verificando…</p>
            ) : null}
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
            <Button
              variant="outline"
              onClick={() => (checking ? void query.refetch() : setChecking(true))}
              disabled={query.isFetching}
            >
              {checking ? <RotateCw aria-hidden="true" /> : <ScanSearch aria-hidden="true" />}
              {checking ? "Verificar de novo" : "Verificar com o bucket"}
            </Button>
          </div>
        ) : null}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            <X aria-hidden="true" />
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
