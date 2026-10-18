import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ImageUp, Images, ScanSearch, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { SelectField } from "@/components/shared/admin/form-fields";
import { ListToolbar } from "@/components/shared/admin/list-toolbar";
import { PageHeader } from "@/components/shared/admin/page-header";
import { PaginationBar } from "@/components/shared/admin/pagination-bar";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { CollectionsPanel } from "@/components/shared/media/collections-panel";
import { MediaGrid } from "@/components/shared/media/media-grid";
import { StorageBar } from "@/components/shared/media/storage-bar";
import { StorageCheckDialog } from "@/components/shared/media/storage-check-dialog";
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
import { useListState } from "@/hooks/shared/use-list-state";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { listBrandOptions } from "@/lib/shared/brands/brand-options.functions";
import { MediaScope } from "@/lib/shared/enums";
import { PAGE_SIZE } from "@/lib/shared/list-search";
import { MediaKind } from "@/lib/shared/media/limits";
import { moveToCollection } from "@/lib/shared/media/collections.functions";
import { listMedia, trashMedia } from "@/lib/shared/media/media.functions";
import { MediaSort, MediaStatusFilter } from "@/lib/shared/media/schemas";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const ALL = "all";

const tabs = [
  { value: MediaStatusFilter.Active, label: "Arquivos" },
  { value: MediaStatusFilter.Trash, label: "Lixeira" },
];

const kindOptions = [
  { value: ALL, label: "Todos os tipos" },
  { value: MediaKind.Image, label: "Imagens" },
  { value: MediaKind.Video, label: "Vídeos" },
  { value: MediaKind.Document, label: "Documentos" },
];

const orderOptions = [
  { value: MediaSort.Newest, label: "Mais recentes" },
  { value: MediaSort.Oldest, label: "Mais antigos" },
  { value: MediaSort.Name, label: "Nome" },
  { value: MediaSort.Size, label: "Tamanho" },
];

const isScope = (value: string | undefined): value is MediaScope =>
  value === MediaScope.Site || value === MediaScope.Brand;
const isKind = (value: string | undefined): value is MediaKind =>
  Object.values(MediaKind).some((kind) => kind === value);
const isOrder = (value: string | undefined): value is (typeof MediaSort)[keyof typeof MediaSort] =>
  Object.values(MediaSort).some((order) => order === value);

export function LibraryPage({ fixedBrandId }: { fixedBrandId?: string }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const list = useListState<string>(MediaStatusFilter.Active);
  const { run, busy } = useServerAction();
  const [selected, setSelected] = useState<string[]>([]);
  const [chooser, setChooser] = useState(false);
  const [uploading, setUploading] = useState<{ scope: MediaScope; brandId?: string } | null>(null);
  const [trashing, setTrashing] = useState(false);
  const [checking, setChecking] = useState(false);

  const scope: MediaScope | undefined = fixedBrandId
    ? MediaScope.Brand
    : isScope(list.filters.scope)
      ? list.filters.scope
      : undefined;
  const brandId = fixedBrandId ?? list.filters.brand;
  const folder = list.filters.folder;
  const kind = isKind(list.filters.kind) ? list.filters.kind : undefined;
  const order = isOrder(list.filters.order) ? list.filters.order : MediaSort.Newest;

  const request = {
    search: list.debouncedSearch,
    page: list.page,
    status: list.status,
    order,
    ...(scope ? { scope } : {}),
    ...(brandId ? { brandId } : {}),
    ...(kind ? { kind } : {}),
    ...(folder ? { collectionId: folder } : {}),
  };

  const brands = useQuery({
    queryKey: QueryKey.Brands.options(),
    queryFn: async () => unwrapResult(await listBrandOptions()).brands,
    enabled: fixedBrandId === undefined,
  });
  const query = useQuery({
    queryKey: QueryKey.Media.list(request),
    queryFn: async () => unwrapResult(await listMedia({ data: request })),
    placeholderData: keepPreviousData,
  });

  const trashView = list.status === MediaStatusFilter.Trash;
  const canUpload = can(auth, Action.Media.Upload);
  const canDelete = can(auth, Action.Media.Delete);
  const invalidate = [QueryKey.Media.all()];
  const collectionsReady =
    scope === MediaScope.Site || (scope === MediaScope.Brand && brandId !== undefined);
  const rows = query.data?.rows ?? [];

  const startUpload = () => {
    if (scope === MediaScope.Site) setUploading({ scope });
    else if (scope === MediaScope.Brand && brandId) setUploading({ scope, brandId });
    else setChooser(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Biblioteca de Mídia"
        description="Imagens, vídeos e PDFs reutilizáveis. Tudo começa privado."
        breadcrumbs={fixedBrandId ? undefined : [{ label: "Biblioteca de Mídia" }]}
        actions={
          <>
            {canDelete ? (
              <Button variant="outline" onClick={() => setChecking(true)}>
                <ScanSearch aria-hidden="true" /> Verificar com o bucket
              </Button>
            ) : null}
            {canUpload ? (
              <Button onClick={startUpload}>
                <Upload aria-hidden="true" /> Enviar arquivos
              </Button>
            ) : null}
          </>
        }
      />
      <StorageBar />

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="space-y-4">
          {collectionsReady && scope ? (
            <CollectionsPanel
              scope={scope}
              brandId={brandId}
              selectedId={folder}
              onSelect={(id) => void list.setFilter("folder", id)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Escolha o site ou uma marca para ver as pastas.
            </p>
          )}
        </aside>

        <div className="space-y-4">
          <ListToolbar
            search={list.search}
            onSearchChange={list.setSearch}
            searchLabel="Buscar por nome ou etiqueta"
            statusOptions={tabs}
            status={list.status}
            onStatusChange={(value) => {
              setSelected([]);
              list.setStatus(value);
            }}
          />
          <div className="grid gap-3 sm:grid-cols-4">
            {fixedBrandId ? null : (
              <SelectField
                id="media-scope"
                label="Origem"
                value={scope ?? ALL}
                onValueChange={(value) => {
                  void list.setFilter("scope", value === ALL ? undefined : value);
                  void list.setFilter("brand", undefined);
                  void list.setFilter("folder", undefined);
                }}
                options={[
                  { value: ALL, label: "Todas" },
                  { value: MediaScope.Brand, label: "Marcas" },
                  { value: MediaScope.Site, label: "Site" },
                ]}
              />
            )}
            {fixedBrandId === undefined && scope === MediaScope.Brand ? (
              <SelectField
                id="media-brand"
                label="Marca"
                value={brandId ?? ALL}
                onValueChange={(value) => {
                  void list.setFilter("brand", value === ALL ? undefined : value);
                  void list.setFilter("folder", undefined);
                }}
                options={[
                  { value: ALL, label: "Todas" },
                  ...(brands.data ?? []).map((brand) => ({ value: brand.id, label: brand.name })),
                ]}
              />
            ) : null}
            <SelectField
              id="media-kind"
              label="Tipo"
              value={kind ?? ALL}
              onValueChange={(value) =>
                void list.setFilter("kind", value === ALL ? undefined : value)
              }
              options={kindOptions}
            />
            <SelectField
              id="media-order"
              label="Ordenar por"
              value={order}
              onValueChange={(value) => void list.setFilter("order", value)}
              options={orderOptions}
            />
          </div>

          {selected.length > 0 ? (
            <div
              className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted p-2 text-sm"
              role="status"
            >
              <span>{selected.length} selecionado(s)</span>
              {collectionsReady &&
              folder === undefined &&
              !trashView &&
              can(auth, Action.Media.Update) ? (
                <span className="text-muted-foreground">Abra uma pasta para mover.</span>
              ) : null}
              {folder && !trashView ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => moveToCollection({ data: { collectionId: null, assetIds: selected } }),
                      {
                        success: "Arquivos tirados das pastas.",
                        invalidate,
                      },
                    ).then(() => setSelected([]))
                  }
                >
                  Tirar das pastas
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => setTrashing(true)}
                >
                  <Trash2 aria-hidden="true" /> {trashView ? "Restaurar" : "Mover para a lixeira"}
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                Limpar seleção
              </Button>
            </div>
          ) : null}

          {query.isPending ? <ListSkeleton rows={3} /> : null}
          {query.isError ? (
            <EmptyState
              icon={Images}
              title="Não foi possível carregar a biblioteca"
              description={query.error.message}
              action={<Button onClick={() => void query.refetch()}>Tentar novamente</Button>}
            />
          ) : null}
          {query.data && rows.length === 0 ? (
            <EmptyState
              icon={ImageUp}
              title={
                list.debouncedSearch
                  ? "Nenhum arquivo encontrado"
                  : trashView
                    ? "A lixeira está vazia"
                    : "Nenhum arquivo ainda"
              }
              description={
                list.debouncedSearch
                  ? "Tente outro termo ou limpe os filtros."
                  : "Envie imagens, vídeos ou PDFs para começar."
              }
            />
          ) : null}
          {rows.length > 0 ? (
            <MediaGrid
              items={rows}
              selectedIds={selected}
              onToggle={(item, checked) =>
                setSelected((current) =>
                  checked ? [...current, item.id] : current.filter((id) => id !== item.id),
                )
              }
              onOpen={(item) =>
                void navigate({ to: "/admin/library/$assetId", params: { assetId: item.id } })
              }
            />
          ) : null}
          {query.data ? (
            <PaginationBar
              page={list.page}
              pageSize={PAGE_SIZE}
              total={query.data.total}
              onPageChange={list.setPage}
              disabled={query.isFetching}
            />
          ) : null}
        </div>
      </div>

      <Dialog open={chooser} onOpenChange={setChooser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Onde guardar os arquivos?</DialogTitle>
            <DialogDescription>
              Escolha o site ou a marca que vai usar estes arquivos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {can(auth, Action.Site.View) ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setChooser(false);
                  setUploading({ scope: MediaScope.Site });
                }}
              >
                Site
              </Button>
            ) : null}
            <SelectField
              id="chooser-brand"
              label="Marca"
              value=""
              onValueChange={(value) => {
                setChooser(false);
                setUploading({ scope: MediaScope.Brand, brandId: value });
              }}
              options={(brands.data ?? []).map((brand) => ({ value: brand.id, label: brand.name }))}
              placeholder="Escolha a marca"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChooser(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {uploading ? (
        <UploadDialog
          open
          onOpenChange={(open) => !open && setUploading(null)}
          scope={uploading.scope}
          brandId={uploading.brandId}
          onFinished={() => void query.refetch()}
        />
      ) : null}

      <ConfirmDialog
        open={trashing}
        onOpenChange={setTrashing}
        title={trashView ? "Restaurar arquivos" : "Mover para a lixeira"}
        description={
          trashView
            ? "Os arquivos voltam para as seleções."
            : "Os arquivos saem das novas seleções, mas continuam nos conteúdos onde já são usados. Ficam 30 dias na lixeira."
        }
        confirmLabel={trashView ? "Restaurar" : "Mover para a lixeira"}
        busy={busy}
        onConfirm={async () => {
          const results = await Promise.all(
            selected.map((id) =>
              run(() => trashMedia({ data: { id, trashed: !trashView } }), { invalidate }),
            ),
          );
          setSelected([]);
          return results.every((result) => result.ok);
        }}
      />

      <StorageCheckDialog open={checking} onOpenChange={setChecking} />
    </div>
  );
}
