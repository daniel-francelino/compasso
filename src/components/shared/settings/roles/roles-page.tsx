import { useQuery } from "@tanstack/react-query";
import { Copy, Pencil, Plus, ShieldCheck, Trash2, Users, RotateCw } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SectionCard } from "@/components/shared/admin/section-card";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { RoleEditor } from "@/components/shared/settings/roles/role-editor";
import { Button } from "@/components/shared/ui/button";
import { useEditorSheet } from "@/hooks/shared/use-editor-sheet";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { ROLE_DESCRIPTION_LABELS } from "@/lib/shared/auth/role-matrix";
import { type RoleRow, deleteRole, listRoles } from "@/lib/shared/auth/roles.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

type EditorItem = { role?: RoleRow; duplicateOf?: RoleRow };

export function RolesPage() {
  const sheet = useEditorSheet<EditorItem>(QueryKey.Roles.all());
  const { run, busy } = useServerAction();
  const [deleting, setDeleting] = useState<RoleRow | null>(null);

  const query = useQuery({
    queryKey: QueryKey.Roles.list(),
    queryFn: async () => unwrapResult(await listRoles()),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Perfis"
        description="Cada perfil reúne as ações que uma pessoa pode fazer. Combine com as marcas às quais ela está ligada."
        breadcrumbs={[{ label: "Configurações" }, { label: "Perfis" }]}
        actions={
          <Button onClick={() => sheet.open({})}>
            <Plus aria-hidden="true" />
            Novo perfil
          </Button>
        }
      />

      {query.isPending ? <ListSkeleton /> : null}
      {query.isError ? (
        <EmptyState
          icon={ShieldCheck}
          title="Não foi possível carregar os perfis"
          description={query.error.message}
          action={
            <Button onClick={() => void query.refetch()}>
              <RotateCw aria-hidden="true" />
              Tentar novamente
            </Button>
          }
        />
      ) : null}

      <ul className="grid gap-4 md:grid-cols-2">
        {(query.data?.roles ?? []).map((role) => (
          <li key={role.id}>
            <SectionCard
              as="div"
              title={role.name}
              icon={ShieldCheck}
              actions={
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`${role.isSystem ? "Ver" : "Editar"} ${role.name}`}
                    onClick={() => sheet.open({ role })}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`Duplicar ${role.name}`}
                    onClick={() => sheet.open({ duplicateOf: role })}
                  >
                    <Copy aria-hidden="true" />
                  </Button>
                  {role.isSystem ? null : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 text-destructive"
                      aria-label={`Excluir ${role.name}`}
                      disabled={role.userCount > 0}
                      title={
                        role.userCount > 0
                          ? "Perfil em uso: troque o perfil das pessoas antes."
                          : undefined
                      }
                      onClick={() => setDeleting(role)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  )}
                </div>
              }
            >
              {role.description ? (
                <p className="text-sm text-muted-foreground">
                  {ROLE_DESCRIPTION_LABELS[role.key] ?? role.description}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {role.isSystem ? (
                  <StatusBadge tone="info" icon={ShieldCheck}>
                    Sistema · acesso total
                  </StatusBadge>
                ) : (
                  <span>{role.actions.length} ações</span>
                )}
                {role.portalOnly ? (
                  <StatusBadge tone="draft" icon={Users}>
                    Portal do cliente
                  </StatusBadge>
                ) : null}
                <span className="text-muted-foreground">
                  {role.userCount} {role.userCount === 1 ? "pessoa" : "pessoas"}
                </span>
              </div>
            </SectionCard>
          </li>
        ))}
      </ul>

      {sheet.editor && query.data ? (
        <RoleEditor
          open
          role={sheet.editor.item?.role}
          duplicateOf={sheet.editor.item?.duplicateOf}
          catalog={query.data.catalog}
          onClose={() => void sheet.close()}
          onDirtyChange={sheet.setFormState}
          onSaved={() => void sheet.saved()}
          restoreFocus={sheet.restoreFocus}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir perfil"
        description={`O perfil “${deleting?.name ?? ""}” deixa de existir. Ninguém usa este perfil.`}
        confirmLabel="Excluir"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (deleting === null) return false;
          const result = await run(() => deleteRole({ data: { id: deleting.id } }), {
            success: "Perfil excluído.",
            invalidate: [QueryKey.Roles.all()],
          });
          return result.ok;
        }}
      />
    </div>
  );
}
