import { useQuery } from "@tanstack/react-query";
import { Folder, FolderOpen, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { TextField } from "@/components/shared/admin/form-fields";
import { Button } from "@/components/shared/ui/button";
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

function Branch({
  rows,
  parentId,
  level,
  selectedId,
  canWrite,
  canDelete,
  onSelect,
  onDialog,
}: {
  rows: CollectionRow[];
  parentId: string | null;
  level: number;
  selectedId: string | undefined;
  canWrite: boolean;
  canDelete: boolean;
  onSelect: (id: string | undefined) => void;
  onDialog: (dialog: Dialog) => void;
}) {
  const children = rows.filter((row) => row.parentId === parentId);
  if (children.length === 0) return null;
  return (
    <ul className={cn(level > 0 && "ml-3 border-l border-border pl-2")}>
      {children.map((row) => {
        const active = row.id === selectedId;
        const Icon = active ? FolderOpen : Folder;
        return (
          <li key={row.id}>
            <div className="group flex items-center gap-1">
              <button
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => onSelect(active ? undefined : row.id)}
                className={cn(
                  "flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-accent",
                  active && "bg-accent font-medium",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{row.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{row.itemCount}</span>
              </button>
              {canWrite && depthOf(rows, row.id) < MAX_DEPTH ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label={`Nova subpasta em ${row.name}`}
                  onClick={() => onDialog({ kind: "create", parentId: row.id })}
                >
                  <FolderPlus aria-hidden="true" />
                </Button>
              ) : null}
              {canWrite ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label={`Renomear ${row.name}`}
                  onClick={() => onDialog({ kind: "rename", collection: row })}
                >
                  <Pencil aria-hidden="true" />
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 text-destructive"
                  aria-label={`Excluir ${row.name}`}
                  onClick={() => onDialog({ kind: "delete", collection: row })}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              ) : null}
            </div>
            <Branch
              rows={rows}
              parentId={row.id}
              level={level + 1}
              selectedId={selectedId}
              canWrite={canWrite}
              canDelete={canDelete}
              onSelect={onSelect}
              onDialog={onDialog}
            />
          </li>
        );
      })}
    </ul>
  );
}

export function CollectionsPanel({
  scope,
  brandId,
  selectedId,
  onSelect,
}: {
  scope: MediaScope;
  brandId: string | undefined;
  selectedId: string | undefined;
  onSelect: (id: string | undefined) => void;
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

  const canWrite = can(auth, Action.Media.Update) && (scope === "site" || brandId !== undefined);
  const canDelete = can(auth, Action.Media.Delete);
  const invalidate = [QueryKey.Media.all()];

  const open = (next: Dialog) => {
    setName(next.kind === "rename" ? next.collection.name : "");
    setDialog(next);
  };

  return (
    <section aria-label="Pastas" className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Pastas</h2>
        {canWrite ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => open({ kind: "create", parentId: undefined })}
          >
            <FolderPlus aria-hidden="true" /> Nova
          </Button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onSelect(undefined)}
        aria-current={selectedId === undefined ? "true" : undefined}
        className={cn(
          "flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-accent",
          selectedId === undefined && "bg-accent font-medium",
        )}
      >
        <Folder className="size-4" aria-hidden="true" /> Todos os arquivos
      </button>
      {query.isError ? (
        <p role="alert" className="text-xs text-destructive">
          {query.error.message}
        </p>
      ) : null}
      <Branch
        rows={query.data ?? []}
        parentId={null}
        level={0}
        selectedId={selectedId}
        canWrite={canWrite}
        canDelete={canDelete}
        onSelect={onSelect}
        onDialog={open}
      />

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
