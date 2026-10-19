import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AudioLines,
  Building2,
  Clock3,
  LoaderCircle,
  PanelsTopLeft,
  Target,
  UsersRound,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ClientForm } from "@/components/marketing/clients/client-form";
import { SectionCard } from "@/components/shared/admin/section-card";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { Button } from "@/components/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog";
import { useBrand } from "@/hooks/marketing/use-brand";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { getClient } from "@/lib/marketing/clients/clients.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const fields = [
  ["description", "Sobre a marca", Building2],
  ["targetAudience", "Público", UsersRound],
  ["toneOfVoice", "Tom de voz", AudioLines],
  ["objectives", "Objetivos", Target],
] as const;

export function BrandOverviewTab({ brandId }: { brandId: string }) {
  const query = useBrand(brandId);
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [editingClient, setEditingClient] = useState(false);
  const clientQuery = useQuery({
    queryKey: QueryKey.Clients.detail(query.data?.clientId ?? ""),
    queryFn: async () =>
      unwrapResult(await getClient({ data: { id: query.data?.clientId ?? "" } })).client,
    enabled: editingClient && query.data !== undefined,
  });

  if (!query.data) return <PageSkeleton rows={2} />;
  const brand = query.data;
  const canUpdateClient = can(auth, Action.Clients.Update);

  return (
    <div className="grid items-start gap-4 md:grid-cols-2">
      <SectionCard as="div" title="Resumo" icon={Building2}>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <Building2 className="size-3.5" aria-hidden="true" />
              Cliente
            </dt>
            <dd>
              {canUpdateClient ? (
                <button
                  type="button"
                  className="text-primary underline-offset-4 hover:underline"
                  onClick={() => setEditingClient(true)}
                >
                  {brand.clientName}
                </button>
              ) : (
                <Link
                  to="/admin/marketing/clients/$clientId"
                  params={{ clientId: brand.clientId }}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {brand.clientName}
                </Link>
              )}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <Clock3 className="size-3.5" aria-hidden="true" />
              Fuso horário
            </dt>
            <dd>{brand.timezone.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <PanelsTopLeft className="size-3.5" aria-hidden="true" />
              Canais
            </dt>
            <dd>{brand.channelCount}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <UsersRound className="size-3.5" aria-hidden="true" />
              Membros
            </dt>
            <dd>{brand.memberCount}</dd>
          </div>
        </dl>
      </SectionCard>
      <SectionCard as="div" title="Identidade" icon={AudioLines}>
        {fields.map(([key, label, Icon]) => (
          <div key={key} className="text-sm">
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </p>
            <p className="whitespace-pre-wrap">{brand[key] ?? "—"}</p>
          </div>
        ))}
      </SectionCard>
      <Dialog open={editingClient} onOpenChange={setEditingClient}>
        <DialogContent className="h-dvh max-h-dvh w-screen max-w-none rounded-none border-0 p-5 sm:max-w-none sm:rounded-none sm:p-8">
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
            <DialogDescription>Altere os dados do cliente.</DialogDescription>
          </DialogHeader>
          {clientQuery.data ? (
            <ClientForm
              key={clientQuery.data.id}
              client={clientQuery.data}
              onCancel={() => setEditingClient(false)}
              onSaved={() => {
                setEditingClient(false);
                void queryClient.invalidateQueries({ queryKey: QueryKey.Clients.all() });
                void queryClient.invalidateQueries({ queryKey: QueryKey.Brands.detail(brandId) });
              }}
            />
          ) : clientQuery.isError ? (
            <div className="space-y-3">
              <p role="alert" className="text-sm text-destructive">
                Não foi possível carregar os dados do cliente.
              </p>
              <Button variant="outline" onClick={() => void clientQuery.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Carregando cliente…
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
