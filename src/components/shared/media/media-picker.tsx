import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Images, Upload, X, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { PaginationBar } from "@/components/shared/admin/pagination-bar";
import { MediaGrid } from "@/components/shared/media/media-grid";
import { UploadDialog } from "@/components/shared/media/upload-dialog";
import { Button } from "@/components/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog";
import { Input } from "@/components/shared/ui/input";
import { Skeleton } from "@/components/shared/ui/skeleton";
import { useDebouncedValue } from "@/hooks/shared/use-debounced-value";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import type { MediaScope } from "@/lib/shared/enums";
import type { MediaKind } from "@/lib/shared/media/limits";
import { type MediaRow, listMedia } from "@/lib/shared/media/media.functions";
import { MediaSort, MediaStatusFilter } from "@/lib/shared/media/schemas";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

export type PickedMedia = {
  assetId: string;
  versionId: string;
  name: string;
  kind: MediaKind;
};

export function MediaPicker({
  open,
  onOpenChange,
  scope,
  brandId,
  kinds,
  max = 1,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: MediaScope;
  brandId?: string | undefined;
  kinds?: readonly MediaKind[];
  max?: number;
  onConfirm: (items: PickedMedia[]) => void;
}) {
  const auth = useAuth();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MediaRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search.trim(), 300);
  const kindsKey = kinds?.join("|") ?? "all";

  useEffect(() => setPage(1), [brandId, debounced, kindsKey, scope]);

  const request = {
    search: debounced,
    page,
    status: MediaStatusFilter.Active,
    order: MediaSort.Newest,
    scope,
    ...(brandId ? { brandId } : {}),
  };
  const query = useQuery({
    queryKey: QueryKey.Media.list({
      ...request,
      kinds: kindsKey,
      picker: true,
    }),
    queryFn: async () =>
      unwrapResult(
        await listMedia({
          data: { ...request, ...(kinds === undefined ? {} : { kinds: [...kinds] }) },
        }),
      ),
    placeholderData: keepPreviousData,
    enabled: open && (kinds === undefined || kinds.length > 0),
  });

  const rows = query.data?.rows ?? [];
  const canUpload = can(auth, Action.Media.Upload);

  const toggle = (item: MediaRow, checked: boolean) =>
    setSelected((current) => {
      if (!checked) return current.filter((row) => row.id !== item.id);
      return max === 1 ? [item] : [...current, item].slice(0, max);
    });

  const confirm = () => {
    onConfirm(
      selected.map((row) => ({
        assetId: row.id,
        versionId: row.currentVersionId,
        name: row.name,
        kind: row.kind,
      })),
    );
    setSelected([]);
    onOpenChange(false);
  };

  const closePicker = (next: boolean) => {
    if (!next) setSelected([]);
    onOpenChange(next);
  };

  const uploadFinished = () => {
    setPage(1);
    void query.refetch();
  };

  return (
    <>
      <Dialog open={open && !uploading} onOpenChange={closePicker}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Images className="size-5 text-muted-foreground" aria-hidden="true" /> Escolher
              arquivos
            </DialogTitle>
            <DialogDescription>
              {max === 1 ? "Escolha um arquivo." : `Escolha até ${max} arquivos.`} Cancelar não
              associa nada.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou etiqueta"
              aria-label="Buscar arquivos"
              className="h-11 flex-1 md:h-10"
            />
            {canUpload ? (
              <Button type="button" variant="outline" onClick={() => setUploading(true)}>
                <Upload aria-hidden="true" /> Enviar novos
              </Button>
            ) : null}
          </div>
          <div className="max-h-[50vh] overflow-y-auto">
            {query.isError ? (
              <EmptyState
                icon={Images}
                title="Não foi possível carregar os arquivos"
                description="Tente carregar a biblioteca novamente."
                action={
                  <Button type="button" variant="outline" onClick={() => void query.refetch()}>
                    Tentar novamente
                  </Button>
                }
              />
            ) : null}
            {query.isPending && kinds?.length !== 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {Array.from({ length: 10 }, (_, index) => (
                  <Skeleton key={index} className="aspect-square rounded-xl" />
                ))}
              </div>
            ) : null}
            {!query.isError && ((query.data && rows.length === 0) || kinds?.length === 0) ? (
              <EmptyState
                icon={Images}
                title={
                  kinds?.length === 0
                    ? "Os formatos dos canais não são compatíveis"
                    : debounced === ""
                      ? "Nenhum arquivo compatível"
                      : "Nenhum arquivo encontrado"
                }
                description={
                  kinds?.length === 0
                    ? "Os formatos dos canais não aceitam um tipo de arquivo em comum."
                    : debounced === ""
                      ? "Envie um arquivo compatível para adicionar à biblioteca."
                      : "Altere os termos da busca para encontrar um arquivo."
                }
              />
            ) : null}
            {!query.isError && rows.length > 0 ? (
              <MediaGrid
                items={rows}
                selectedIds={selected.map((row) => row.id)}
                onToggle={toggle}
                onOpen={(item) => toggle(item, !selected.some((row) => row.id === item.id))}
                openLabel="Selecionar"
              />
            ) : null}
          </div>
          {!query.isError && query.data && query.data.total > query.data.pageSize ? (
            <PaginationBar
              page={query.data.page}
              pageSize={query.data.pageSize}
              total={query.data.total}
              onPageChange={setPage}
              disabled={query.isFetching}
            />
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => closePicker(false)}>
              <X aria-hidden="true" />
              Cancelar
            </Button>
            <Button type="button" onClick={confirm} disabled={selected.length === 0}>
              <Check aria-hidden="true" />
              Usar {selected.length > 0 ? `(${selected.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {uploading ? (
        <UploadDialog
          open
          scope={scope}
          brandId={brandId}
          onOpenChange={(next) => !next && setUploading(false)}
          onFinished={uploadFinished}
        />
      ) : null}
    </>
  );
}
