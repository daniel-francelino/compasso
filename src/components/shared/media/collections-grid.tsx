import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreVertical,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { TextField } from "@/components/shared/admin/form-fields";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { Button } from "@/components/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shared/ui/dropdown-menu";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import type { MediaScope } from "@/lib/shared/enums";
import {
  type CollectionRow,
  deleteCollection,
  listCollections,
  saveCollection,
} from "@/lib/shared/media/collections.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { cn } from "@/lib/shared/utils";

const MAX_DEPTH = 3;

type Dialog =
  | { kind: "create"; parentId: string | undefined }
  | { kind: "rename"; collection: CollectionRow }
  | { kind: "delete"; collection: CollectionRow };

const depthOf = (rows: CollectionRow[], id: string): number => {
  let depth = 1;
  let cursor = rows.find((row) => row.id === id)?.parentId ?? null;
  while (cursor !== null) {
    depth += 1;
    cursor = rows.find((row) => row.id === cursor)?.parentId ?? null;
  }
  return depth;
};

const trailOf = (rows: CollectionRow[], id: string | undefined): CollectionRow[] => {
  const trail: CollectionRow[] = [];
  let cursor = id === undefined ? undefined : rows.find((row) => row.id === id);
  while (cursor !== undefined) {
    trail.unshift(cursor);
    const parent: string | null = cursor.parentId;
    cursor = parent === null ? undefined : rows.find((row) => row.id === parent);
  }
  return trail;
};

export function CollectionsGrid({
  scope,
  brandId,
  selectedId,
  sharedIds,
  onSelect,
  onShare,
}: {
  scope: MediaScope;
  brandId: string | undefined;
  selectedId: string | undefined;
  sharedIds: ReadonlySet<string>;
  onSelect: (id: string | undefined) => void;
  onShare?: ((collection: CollectionRow) => void) | undefined;
}) {
  const auth = useAuth();
  const { run, busy } = useServerAction();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [name, setName] = useState("");

  const query = useQuery({
    queryKey: QueryKey.Media.collections(scope, brandId),
    queryFn: async () =>
      unwrapResult(await listCollections({ data: { scope, ...(brandId ? { brandId } : {}) } }))
        .collections,
  });

  const rows = query.data ?? [];
  const canWrite = can(auth, Action.Media.Update) && (scope === "site" || brandId !== undefined);
  const canDelete = can(auth, Action.Media.Delete);
  const invalidate = [QueryKey.Media.all()];
  const trail = trailOf(rows, selectedId);
  const children = rows.filter((row) => row.parentId === (selectedId ?? null));
  const canNest = selectedId === undefined || depthOf(rows, selectedId) < MAX_DEPTH;

  const open = (next: Dialog) => {
    setName(next.kind === "rename" ? next.collection.name : "");
    setDialog(next);
  };

  return (
    <section aria-label="Pastas" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Caminho da pasta" className="flex min-w-0 flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => onSelect(undefined)}
            aria-current={selectedId === undefined ? "page" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-sm hover:bg-accent",
              selectedId === undefined && "font-medium",
            )}
          >
            <FolderOpen className="size-4" aria-hidden="true" />
            Todos os arquivos
          </button>
          {trail.map((item) => (
            <span key={item.id} className="inline-flex items-center gap-1">
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={item.id === selectedId ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-md px-2 text-sm hover:bg-accent",
                  item.id === selectedId && "font-medium",
                )}
              >
                {item.name}
              </button>
            </span>
          ))}
        </nav>
        {canWrite && canNest ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => open({ kind: "create", parentId: selectedId })}
          >
            <FolderPlus aria-hidden="true" />
            Nova pasta
          </Button>
        ) : null}
      </div>

      {query.isError ? (
        <p role="alert" className="text-xs text-destructive">
          {query.error.message}
        </p>
      ) : null}

      {children.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {children.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-1 rounded-xl border border-border bg-card pr-1 hover:bg-accent/40"
            >
              <button
                type="button"
                onClick={() => onSelect(row.id)}
                className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Folder className="size-6 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{row.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {row.itemCount === 1 ? "1 arquivo" : `${row.itemCount} arquivos`}
                  </span>
                </span>
              </button>
              {sharedIds.has(row.id) ? (
                <StatusBadge tone="info" icon={Share2}>
                  Compartilhada
                </StatusBadge>
              ) : null}
              {onShare || canWrite || canDelete ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Ações da pasta ${row.name}`}>
                      <MoreVertical aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onShare ? (
                      <DropdownMenuItem onSelect={() => onShare(row)}>
                        <Share2 aria-hidden="true" />
                        Compartilhar
                      </DropdownMenuItem>
                    ) : null}
                    {canWrite && depthOf(rows, row.id) < MAX_DEPTH ? (
                      <DropdownMenuItem onSelect={() => open({ kind: "create", parentId: row.id })}>
                        <FolderPlus aria-hidden="true" />
                        Nova subpasta
                      </DropdownMenuItem>
                    ) : null}
                    {canWrite ? (
                      <DropdownMenuItem onSelect={() => open({ kind: "rename", collection: row })}>
                        <Pencil aria-hidden="true" />
                        Renomear
                      </DropdownMenuItem>
                    ) : null}
                    {canDelete ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onSelect={() => open({ kind: "delete", collection: row })}
                        >
                          <Trash2 aria-hidden="true" />
                          Excluir
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <FormDialog
        open={dialog?.kind === "create" || dialog?.kind === "rename"}
        onOpenChange={(next) => !next && setDialog(null)}
        icon={Folder}
        title={dialog?.kind === "rename" ? "Renomear pasta" : "Nova pasta"}
        submitLabel="Salvar"
        busy={busy}
        submitDisabled={name.trim() === ""}
        onSubmit={async () => {
          if (dialog === null || dialog.kind === "delete") return;
          const result = await run(
            () =>
              saveCollection({
                data: {
                  ...(dialog.kind === "rename" ? { id: dialog.collection.id } : {}),
                  scope,
                  ...(brandId ? { brandId } : {}),
                  ...(dialog.kind === "create" && dialog.parentId
                    ? { parentId: dialog.parentId }
                    : {}),
                  name,
                },
              }),
            { success: "Pasta salva.", invalidate },
          );
          if (result.ok) setDialog(null);
        }}
      >
        <TextField
          id="collection-name"
          label="Nome da pasta"
          required
          value={name}
          onValueChange={setName}
          maxLength={80}
          hint="Até 3 níveis. O nome não pode repetir no mesmo nível."
        />
      </FormDialog>

      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(next) => !next && setDialog(null)}
        title="Excluir pasta"
        description={`A pasta “${dialog?.kind === "delete" ? dialog.collection.name : ""}” só pode ser excluída se estiver vazia. Os arquivos nunca são apagados junto.`}
        confirmLabel="Excluir"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (dialog?.kind !== "delete") return false;
          const result = await run(() => deleteCollection({ data: { id: dialog.collection.id } }), {
            success: "Pasta excluída.",
            invalidate,
          });
          if (result.ok && dialog.collection.id === selectedId) onSelect(undefined);
          return result.ok;
        }}
      />
    </section>
  );
}
