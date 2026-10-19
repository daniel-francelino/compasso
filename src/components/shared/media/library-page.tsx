import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BrandSelect } from "@/components/shared/admin/brand-select";
import { useBrandOptions } from "@/hooks/shared/use-brand-options";
import { IconButton } from "@/components/shared/admin/icon-button";
import { useNavigate } from "@tanstack/react-router";
import {
  Eraser,
  Files,
  FolderMinus,
  Globe,
  HardDrive,
  ImageUp,
  Images,
  MoreVertical,
  Pencil,
  RotateCw,
  Share2,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { SelectField } from "@/components/shared/admin/form-fields";
import { ListToolbar } from "@/components/shared/admin/list-toolbar";
import { PageHeader } from "@/components/shared/admin/page-header";
import { PaginationBar } from "@/components/shared/admin/pagination-bar";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { CollectionsGrid } from "@/components/shared/media/collections-grid";
import { MediaGrid } from "@/components/shared/media/media-grid";
import { ShareDialog, type ShareTarget } from "@/components/shared/media/share-dialog";
import { StorageCheckDialog } from "@/components/shared/media/storage-check-dialog";
import { UploadDialog } from "@/components/shared/media/upload-dialog";
import { Button } from "@/components/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shared/ui/dropdown-menu";
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
import { MediaScope, ShareKind } from "@/lib/shared/enums";
import { PAGE_SIZE } from "@/lib/shared/list-search";
import { MediaKind } from "@/lib/shared/media/limits";
import { moveToCollection } from "@/lib/shared/media/collections.functions";
import { listMedia, trashMedia } from "@/lib/shared/media/media.functions";
import { MediaSort, MediaStatusFilter } from "@/lib/shared/media/schemas";
import { listShareTargets } from "@/lib/shared/media/sharing.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const ALL = "all";

const tabs = [
  { value: MediaStatusFilter.Active, label: "Arquivos", icon: Files },
  { value: MediaStatusFilter.Trash, label: "Lixeira", icon: Trash2 },
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
  const [sharing, setSharing] = useState<ShareTarget | null>(null);

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

  const brands = useBrandOptions(fixedBrandId === undefined);
  const query = useQuery({
    queryKey: QueryKey.Media.list(request),
    queryFn: async () => unwrapResult(await listMedia({ data: request })),
    placeholderData: keepPreviousData,
  });

  const targets = useQuery({
    queryKey: QueryKey.Media.shareTargets(),
    queryFn: async () => unwrapResult(await listShareTargets()).targets,
  });
  const sharedAssetIds = new Set(
    (targets.data ?? [])
      .filter((item) => item.kind === ShareKind.Asset)
      .map((item) => item.targetId),
  );
  const sharedCollectionIds = new Set(
    (targets.data ?? [])
      .filter((item) => item.kind === ShareKind.Collection)
      .map((item) => item.targetId),
  );
  const canShare = can(auth, Action.Media.Share);
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
            <IconButton
              variant="outline"
              label="Armazenamento"
              icon={HardDrive}
              onClick={() => setChecking(true)}
            />
            {canUpload ? (
              <Button onClick={startUpload}>
                <Upload aria-hidden="true" /> Enviar arquivos
              </Button>
            ) : null}
          </>
        }
      />

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
            <BrandSelect
              id="media-brand"
              value={brandId ?? ALL}
              onValueChange={(value) => {
                void list.setFilter("brand", value === ALL ? undefined : value);
                void list.setFilter("folder", undefined);
              }}
              brands={brands.data}
              allLabel="Todas"
              allValue={ALL}
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

        <section
          aria-label="Arquivos"
          className="space-y-4 rounded-2xl border border-border bg-muted/40 p-4 sm:p-5"
        >
          {collectionsReady && scope ? (
            <CollectionsGrid
              scope={scope}
              brandId={brandId}
              selectedId={folder}
              sharedIds={sharedCollectionIds}
              onSelect={(id) => void list.setFilter("folder", id)}
              onShare={
                canShare
                  ? (collection) =>
                      setSharing({
                        kind: ShareKind.Collection,
                        id: collection.id,
                        name: collection.name,
                      })
                  : undefined
              }
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Escolha o site ou uma marca para ver as pastas.
            </p>
          )}
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
                  <FolderMinus aria-hidden="true" />
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
                <Eraser aria-hidden="true" />
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
              action={
                <Button onClick={() => void query.refetch()}>
                  <RotateCw aria-hidden="true" />
                  Tentar novamente
                </Button>
              }
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
              sharedIds={sharedAssetIds}
              renderMenu={(item) => (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 bg-surface/90"
                      aria-label={`Ações de ${item.name}`}
                    >
                      <MoreVertical aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() =>
                        void navigate({
                          to: "/admin/library/$assetId",
                          params: { assetId: item.id },
                        })
                      }
                    >
                      <Pencil aria-hidden="true" />
                      Detalhes
                    </DropdownMenuItem>
                    {canShare && !trashView ? (
                      <DropdownMenuItem
                        onSelect={() =>
                          setSharing({ kind: ShareKind.Asset, id: item.id, name: item.name })
                        }
                      >
                        <Share2 aria-hidden="true" />
                        Compartilhar
                      </DropdownMenuItem>
                    ) : null}
                    {canDelete ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className={trashView ? undefined : "text-destructive"}
                          onSelect={() => {
                            setSelected([item.id]);
                            setTrashing(true);
                          }}
                        >
                          {trashView ? <Undo2 aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
                          {trashView ? "Restaurar" : "Mover para a lixeira"}
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
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
        </section>
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
                <Globe aria-hidden="true" />
                Site
              </Button>
            ) : null}
            <BrandSelect
              id="chooser-brand"
              value=""
              onValueChange={(value) => {
                setChooser(false);
                setUploading({ scope: MediaScope.Brand, brandId: value });
              }}
              brands={brands.data}
              placeholder="Escolha a marca"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChooser(false)}>
              <X aria-hidden="true" />
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

      <StorageCheckDialog open={checking} onOpenChange={setChecking} canCheck={canDelete} />

      <ShareDialog target={sharing} onClose={() => setSharing(null)} />
    </div>
  );
}
