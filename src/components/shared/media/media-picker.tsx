import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Images, Upload } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/shared/admin/empty-state";
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
  const debounced = useDebouncedValue(search.trim(), 300);

  const request = {
    search: debounced,
    page: 1,
    status: MediaStatusFilter.Active,
    order: MediaSort.Newest,
    scope,
    ...(brandId ? { brandId } : {}),
  };
  const query = useQuery({
    queryKey: QueryKey.Media.list({ ...request, picker: true }),
    queryFn: async () => unwrapResult(await listMedia({ data: request })),
    placeholderData: keepPreviousData,
    enabled: open,
  });

  const rows = (query.data?.rows ?? []).filter((row) => !kinds || kinds.includes(row.kind));
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

  return (
    <>
      <Dialog open={open && !uploading} onOpenChange={onOpenChange}>
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
              <Button variant="outline" onClick={() => setUploading(true)}>
                <Upload aria-hidden="true" /> Enviar novos
              </Button>
            ) : null}
          </div>
          <div className="max-h-[50vh] overflow-y-auto">
            {query.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {query.error.message}
              </p>
            ) : null}
            {query.data && rows.length === 0 ? (
              <EmptyState
                title="Nenhum arquivo compatível"
                description="Envie um arquivo novo para usar aqui."
              />
            ) : null}
            {rows.length > 0 ? (
              <MediaGrid
                items={rows}
                selectedIds={selected.map((row) => row.id)}
                onToggle={toggle}
                onOpen={(item) => toggle(item, !selected.some((row) => row.id === item.id))}
                openLabel="Selecionar"
              />
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={confirm} disabled={selected.length === 0}>
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
          onFinished={() => void query.refetch()}
        />
      ) : null}
    </>
  );
}
