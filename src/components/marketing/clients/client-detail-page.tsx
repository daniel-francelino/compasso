import { useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import {
  Archive,
  MailPlus,
  Pencil,
  Plus,
  Trash2,
  Undo2,
  History,
  Tag,
  Users,
  StickyNote,
} from "lucide-react";
import { useState } from "react";
import { ClientForm } from "@/components/marketing/clients/client-form";
import { ContactDialog } from "@/components/marketing/clients/contact-dialog";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { type DataTableColumn, DataTable } from "@/components/shared/admin/data-table";
import { RecordUnavailable } from "@/components/shared/admin/record-unavailable";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { IconButton } from "@/components/shared/admin/icon-button";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SectionCard } from "@/components/shared/admin/section-card";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { InviteDialog } from "@/components/shared/settings/users/invite-dialog";
import { Button } from "@/components/shared/ui/button";
import { Checkbox } from "@/components/shared/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog";
import { Label } from "@/components/shared/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shared/ui/tabs";
import { useServerAction } from "@/hooks/shared/use-server-action";
import {
  type ClientDetail,
  type ContactRow,
  deleteClient,
  deleteClientContact,
  getClient,
  setClientArchived,
} from "@/lib/marketing/clients/clients.functions";
import { listAuditEvents } from "@/lib/shared/audit/audit.functions";
import { auditActionLabels } from "@/lib/shared/audit/labels";
import type { AuditActionKey } from "@/lib/shared/audit/actions";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { formatDateTime } from "@/lib/shared/format";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { AppRoute } from "@/lib/shared/routes";

const portalAccessLabel = (access: ContactRow["portalAccess"]): string => {
  if (access === null || access === undefined) return "—";
  if (access.state === "pending") return "Convite pendente";
  if (access.state === "active") {
    return access.brands === 1 ? "Com acesso a 1 marca" : `Com acesso a ${access.brands} marcas`;
  }
  return "Sem acesso";
};

function ActivityTab({ clientId }: { clientId: string }) {
  const filters = { entityType: "client", entityId: clientId };
  const query = useQuery({
    queryKey: QueryKey.Audit.list({ ...filters, page: 1 }),
    queryFn: async () => unwrapResult(await listAuditEvents({ data: { filters, page: 1 } })),
  });
  if (query.isPending) return <PageSkeleton rows={2} />;
  if (query.isError)
    return (
      <p role="alert" className="text-sm text-destructive">
        {query.error.message}
      </p>
    );
  if (query.data.rows.length === 0) {
    return <EmptyState icon={History} title="Sem atividade registrada" />;
  }
  return (
    <ul className="divide-y divide-border">
      {query.data.rows.map((row) => (
        <li key={row.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
          <span>{auditActionLabels[row.action as AuditActionKey] ?? row.action}</span>
          <span className="text-muted-foreground">
            {row.actorName ?? "Sistema"} · {formatDateTime(row.occurredAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ClientDetailPage({ clientId }: { clientId: string }) {
  const auth = useAuth();
  const router = useRouter();
  const { run, busy } = useServerAction();
  const [editing, setEditing] = useState(false);
  const [contactDialog, setContactDialog] = useState<{ contact?: ContactRow } | null>(null);
  const [deletingContact, setDeletingContact] = useState<ContactRow | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveBrands, setArchiveBrands] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [inviting, setInviting] = useState<ContactRow | null>(null);

  const query = useQuery({
    queryKey: QueryKey.Clients.detail(clientId),
    queryFn: async () => unwrapResult(await getClient({ data: { id: clientId } })).client,
  });

  const refresh = () => query.refetch();
  const invalidate = [QueryKey.Clients.all()];

  if (query.isPending) return <PageSkeleton />;
  if (query.isError) {
    return (
      <RecordUnavailable
        title="Cliente não encontrado"
        message="Ele não existe ou você não tem acesso."
        backTo={AppRoute.Clients}
        backLabel="Voltar para clientes"
      />
    );
  }

  const client: ClientDetail = query.data;
  const canUpdate = can(auth, Action.Clients.Update);
  const canInvite = can(auth, Action.Invitations.Create) && can(auth, Action.Brands.ManageMembers);

  const contactColumns: DataTableColumn<ContactRow>[] = [
    {
      id: "name",
      label: "Nome",
      cell: (row) => (
        <span className="font-medium">
          {row.name}{" "}
          {row.isPrimary ? (
            <StatusBadge tone="info" icon={Plus}>
              Principal
            </StatusBadge>
          ) : null}
        </span>
      ),
    },
    { id: "email", label: "E-mail", cell: (row) => row.email ?? "—" },
    { id: "phone", label: "Telefone", cell: (row) => row.phone ?? "—" },
    { id: "role", label: "Cargo", cell: (row) => row.roleTitle ?? "—" },
    {
      id: "portal",
      label: "Portal",
      cell: (row) => portalAccessLabel(row.portalAccess),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        description={
          client.archived
            ? "Cliente arquivado"
            : client.ownerName
              ? `Responsável: ${client.ownerName}`
              : undefined
        }
        breadcrumbs={[{ label: "Clientes", to: AppRoute.Clients }, { label: client.name }]}
        actions={
          canUpdate ? (
            <>
              <IconButton
                variant="outline"
                label="Editar cliente"
                icon={Pencil}
                onClick={() => setEditing(true)}
              />
              <IconButton
                variant="outline"
                label={client.archived ? "Reativar cliente" : "Arquivar cliente"}
                icon={client.archived ? Undo2 : Archive}
                onClick={() => setArchiving(true)}
              />
              {can(auth, Action.Clients.Delete) && client.brands.length === 0 ? (
                <IconButton
                  variant="outline"
                  destructive
                  label="Excluir cliente"
                  icon={Trash2}
                  onClick={() => setDeleting(true)}
                />
              ) : null}
            </>
          ) : null
        }
      />

      <Tabs defaultValue="brands">
        <TabsList>
          <TabsTrigger value="brands">
            <Tag aria-hidden="true" />
            Marcas
          </TabsTrigger>
          <TabsTrigger value="contacts">
            <Users aria-hidden="true" />
            Contatos
          </TabsTrigger>
          {can(auth, Action.Audit.View) ? (
            <TabsTrigger value="activity">
              <History aria-hidden="true" />
              Atividade
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="notes">
            <StickyNote aria-hidden="true" />
            Notas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="brands" className="space-y-3">
          <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 pt-2">
            <p className="text-sm text-muted-foreground">
              {client.brands.length === 1 ? "1 marca" : `${client.brands.length} marcas`}
            </p>
            {can(auth, Action.Brands.Create) && !client.archived ? (
              <Button asChild>
                <Link to={`${AppRoute.Brands}/new`} search={{ clientId: client.id }}>
                  <Plus aria-hidden="true" /> Nova marca
                </Link>
              </Button>
            ) : null}
          </div>
          {client.brands.length === 0 ? (
            <EmptyState
              icon={Tag}
              title="Este cliente ainda não tem marcas"
              description="A marca é a unidade do trabalho editorial."
            />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {client.brands.map((brand) => (
                <li key={brand.id} className="flex items-center justify-between p-3">
                  <Link
                    to="/admin/marketing/brands/$brandId"
                    params={{ brandId: brand.id }}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {brand.name}
                  </Link>
                  {brand.archived ? (
                    <StatusBadge tone="neutral" icon={Archive}>
                      Arquivada
                    </StatusBadge>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="contacts" className="space-y-3">
          <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 pt-2">
            <p className="text-sm text-muted-foreground">
              {client.contacts.length === 1 ? "1 contato" : `${client.contacts.length} contatos`}
            </p>
            {canUpdate ? (
              <Button onClick={() => setContactDialog({})}>
                <Plus aria-hidden="true" /> Novo contato
              </Button>
            ) : null}
          </div>
          <DataTable
            caption="Contatos"
            rows={client.contacts}
            columns={contactColumns}
            rowKey={(row) => row.id}
            rowLabel={(row) => row.name}
            actions={(row) => [
              ...(canUpdate
                ? [
                    {
                      id: "edit",
                      label: "Editar",
                      icon: Pencil,
                      onSelect: (item: ContactRow) => setContactDialog({ contact: item }),
                    },
                    {
                      id: "delete",
                      label: "Excluir",
                      icon: Trash2,
                      destructive: true,
                      onSelect: setDeletingContact,
                    },
                  ]
                : []),
              ...(canInvite && row.email
                ? [
                    {
                      id: "invite",
                      label: "Convidar para o portal",
                      icon: MailPlus,
                      onSelect: setInviting,
                    },
                  ]
                : []),
            ]}
            empty={
              <EmptyState
                icon={Users}
                title="Nenhum contato"
                description="Cadastre as pessoas com quem você conversa."
              />
            }
          />
        </TabsContent>

        {can(auth, Action.Audit.View) ? (
          <TabsContent value="activity">
            <ActivityTab clientId={client.id} />
          </TabsContent>
        ) : null}

        <TabsContent value="notes">
          <SectionCard as="div" title="Notas internas">
            <p className="whitespace-pre-wrap text-sm">{client.internalNotes ?? "Sem notas."}</p>
            {client.tags.length > 0 ? (
              <p className="text-sm text-muted-foreground">Etiquetas: {client.tags.join(", ")}</p>
            ) : null}
          </SectionCard>
        </TabsContent>
      </Tabs>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
            <DialogDescription>Altere os dados do cliente.</DialogDescription>
          </DialogHeader>
          <ClientForm
            client={client}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              void refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      {contactDialog ? (
        <ContactDialog
          open
          clientId={client.id}
          contact={contactDialog.contact}
          onOpenChange={(open) => !open && setContactDialog(null)}
          onSaved={() => void refresh()}
        />
      ) : null}

      {inviting ? (
        <InviteDialog
          open
          initialEmail={inviting.email ?? ""}
          onOpenChange={(open) => !open && setInviting(null)}
          onCreated={() => setInviting(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deletingContact !== null}
        onOpenChange={(open) => !open && setDeletingContact(null)}
        title="Excluir contato"
        description={`${deletingContact?.name ?? ""} será removido deste cliente.`}
        confirmLabel="Excluir"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (deletingContact === null) return false;
          const result = await run(
            () => deleteClientContact({ data: { id: deletingContact.id } }),
            {
              success: "Contato excluído.",
              invalidate,
            },
          );
          if (result.ok) await refresh();
          return result.ok;
        }}
      />

      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title={client.archived ? "Reativar cliente" : "Arquivar cliente"}
        description={
          <div className="space-y-3">
            <p>
              {client.archived
                ? "O cliente volta para as listas e seletores."
                : "O cliente sai das listas e seletores. Nada é apagado."}
            </p>
            {!client.archived && client.brands.some((brand) => !brand.archived) ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="archive-brands"
                  checked={archiveBrands}
                  onCheckedChange={(checked) => setArchiveBrands(checked === true)}
                />
                <Label htmlFor="archive-brands">
                  Arquivar também as marcas ativas deste cliente
                </Label>
              </div>
            ) : null}
          </div>
        }
        confirmLabel={client.archived ? "Reativar" : "Arquivar"}
        busy={busy}
        onConfirm={async () => {
          const result = await run(
            () =>
              setClientArchived({
                data: { id: client.id, archived: !client.archived, archiveBrands },
              }),
            { success: client.archived ? "Cliente reativado." : "Cliente arquivado.", invalidate },
          );
          if (result.ok) await refresh();
          return result.ok;
        }}
      />

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Excluir cliente"
        description="Esta ação não pode ser desfeita. Só é possível excluir clientes sem marcas."
        confirmLabel="Excluir"
        destructive
        busy={busy}
        onConfirm={async () => {
          const result = await run(() => deleteClient({ data: { id: client.id } }), {
            success: "Cliente excluído.",
            invalidate,
          });
          if (result.ok) await router.navigate({ to: AppRoute.Clients });
          return result.ok;
        }}
      />
    </div>
  );
}
