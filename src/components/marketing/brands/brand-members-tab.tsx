import { useQuery } from "@tanstack/react-query";
import { Ban, Check, MailPlus, Plus, UserMinus, Users } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import {
  type DataTableAction,
  type DataTableColumn,
  DataTable,
} from "@/components/shared/admin/data-table";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { InviteDialog } from "@/components/shared/settings/users/invite-dialog";
import { Button } from "@/components/shared/ui/button";
import { Input } from "@/components/shared/ui/input";
import { Label } from "@/components/shared/ui/label";
import { useDebouncedValue } from "@/hooks/shared/use-debounced-value";
import { useServerAction } from "@/hooks/shared/use-server-action";
import {
  type MemberRow,
  listBrandMembers,
  listMemberCandidates,
  setBrandMember,
} from "@/lib/marketing/brands/brands.functions";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { BrandMemberStatus, ProfileKind } from "@/lib/shared/enums";
import { brandMemberStatusLabels, profileKindLabels } from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

function AddMemberDialog({
  brandId,
  open,
  onOpenChange,
}: {
  brandId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { run, busy } = useServerAction();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim(), 300);
  const [pickedId, setPickedId] = useState("");

  const people = useQuery({
    queryKey: QueryKey.Brands.candidates(brandId, debounced),
    queryFn: async () =>
      unwrapResult(await listMemberCandidates({ data: { brandId, search: debounced } })).people,
    enabled: open,
  });
  const picked = people.data?.find((person) => person.id === pickedId);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Plus}
      title="Adicionar membro existente"
      description="Escolha uma pessoa que já tem conta. Para quem ainda não tem, use “Convidar”."
      submitLabel="Adicionar"
      busy={busy}
      submitDisabled={picked === undefined}
      onSubmit={async () => {
        if (picked === undefined) return;
        const result = await run(
          () =>
            setBrandMember({
              data: {
                brandId,
                userId: picked.id,
                kind: picked.kind,
                canDecide: false,
                status: BrandMemberStatus.Active,
              },
            }),
          { success: "Membro adicionado.", invalidate: [QueryKey.Brands.members(brandId)] },
        );
        if (result.ok) onOpenChange(false);
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="member-search">Buscar pessoa</Label>
        <Input
          id="member-search"
          className="h-11 md:h-10"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Nome ou e-mail"
        />
      </div>
      <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
        {(people.data ?? []).map((person) => (
          <li key={person.id}>
            <button
              type="button"
              aria-pressed={pickedId === person.id}
              className="flex w-full items-center justify-between gap-2 p-2 text-left text-sm hover:bg-accent aria-pressed:bg-accent"
              onClick={() => setPickedId(person.id)}
            >
              <span>
                {person.name}
                <span className="block text-xs text-muted-foreground">{person.email}</span>
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {profileKindLabels[person.kind]}
                {pickedId === person.id ? <Check className="size-4" aria-hidden="true" /> : null}
              </span>
            </button>
          </li>
        ))}
        {people.data?.length === 0 ? (
          <li className="p-3 text-sm text-muted-foreground">Ninguém encontrado.</li>
        ) : null}
      </ul>
    </FormDialog>
  );
}

export function BrandMembersTab({ brandId }: { brandId: string }) {
  const auth = useAuth();
  const { run, busy } = useServerAction();
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [revoking, setRevoking] = useState<MemberRow | null>(null);

  const query = useQuery({
    queryKey: QueryKey.Brands.members(brandId),
    queryFn: async () => unwrapResult(await listBrandMembers({ data: { id: brandId } })).members,
  });

  const canManage = can(auth, Action.Brands.ManageMembers);
  const invalidate = [QueryKey.Brands.members(brandId), QueryKey.Brands.detail(brandId)];

  const columns: DataTableColumn<MemberRow>[] = [
    {
      id: "name",
      label: "Nome",
      cell: (row) => <span className="font-medium">{row.name || "—"}</span>,
    },
    { id: "email", label: "E-mail", cell: (row) => row.email || "—" },
    { id: "kind", label: "Tipo", cell: (row) => profileKindLabels[row.kind] },
    {
      id: "decide",
      label: "Pode aprovar",
      cell: (row) => (row.kind === ProfileKind.External ? (row.canDecide ? "Sim" : "Não") : "—"),
    },
    {
      id: "status",
      label: "Situação",
      cell: (row) => (
        <StatusBadge
          tone={row.status === BrandMemberStatus.Active ? "success" : "neutral"}
          icon={row.status === BrandMemberStatus.Active ? Check : Ban}
        >
          {brandMemberStatusLabels[row.status]}
        </StatusBadge>
      ),
    },
  ];

  const actions = (row: MemberRow): DataTableAction<MemberRow>[] => {
    if (!canManage) return [];
    const list: DataTableAction<MemberRow>[] = [];
    if (row.kind === ProfileKind.External && row.status === BrandMemberStatus.Active) {
      list.push({
        id: "decide",
        label: row.canDecide ? "Tirar permissão de aprovar" : "Permitir aprovar",
        icon: Check,
        onSelect: (item) =>
          void run(
            () =>
              setBrandMember({
                data: {
                  brandId,
                  userId: item.userId,
                  kind: item.kind,
                  canDecide: !item.canDecide,
                  status: BrandMemberStatus.Active,
                },
              }),
            { success: "Permissão atualizada.", invalidate },
          ),
      });
    }
    if (row.status === BrandMemberStatus.Active) {
      list.push({
        id: "revoke",
        label: "Remover da marca",
        icon: UserMinus,
        destructive: true,
        onSelect: setRevoking,
      });
    }
    return list;
  };

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" /> Adicionar membro
          </Button>
          {can(auth, Action.Invitations.Create) ? (
            <Button variant="outline" onClick={() => setInviting(true)}>
              <MailPlus aria-hidden="true" /> Convidar
            </Button>
          ) : null}
        </div>
      ) : null}
      <DataTable
        caption="Membros da marca"
        rows={query.data ?? []}
        columns={columns}
        rowKey={(row) => row.userId}
        rowLabel={(row) => row.name || row.email}
        actions={actions}
        loading={query.isPending}
        error={query.error?.message ?? null}
        onRetry={() => void query.refetch()}
        empty={<EmptyState icon={Users} title="Nenhum membro" />}
      />
      {adding ? <AddMemberDialog brandId={brandId} open onOpenChange={setAdding} /> : null}
      {inviting ? (
        <InviteDialog open onOpenChange={setInviting} onCreated={() => void query.refetch()} />
      ) : null}
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title="Remover da marca"
        description={`${revoking?.name ?? ""} perde o acesso a esta marca agora. O histórico fica guardado.`}
        confirmLabel="Remover"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (revoking === null) return false;
          const result = await run(
            () =>
              setBrandMember({
                data: {
                  brandId,
                  userId: revoking.userId,
                  kind: revoking.kind,
                  canDecide: false,
                  status: BrandMemberStatus.Revoked,
                },
              }),
            { success: "Membro removido.", invalidate },
          );
          return result.ok;
        }}
      />
    </div>
  );
}
