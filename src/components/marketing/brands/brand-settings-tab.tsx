import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Archive, Trash2, Undo2, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/admin/auth-shell";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { SelectField, TextField } from "@/components/shared/admin/form-fields";
import { SectionCard } from "@/components/shared/admin/section-card";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { Button } from "@/components/shared/ui/button";
import { useBrand } from "@/hooks/marketing/use-brand";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import {
  type BrandDetail,
  deleteBrand,
  saveBrand,
  setBrandArchived,
} from "@/lib/marketing/brands/brands.functions";
import { saveBrandSchema } from "@/lib/marketing/brands/schemas";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { QueryKey } from "@/lib/shared/query-keys";
import { AppRoute } from "@/lib/shared/routes";
import { timezoneOptions } from "@/lib/shared/timezones";

function SettingsForm({ brand }: { brand: BrandDetail }) {
  const queryClient = useQueryClient();
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [name, setName] = useState(brand.name);
  const [timezone, setTimezone] = useState(brand.timezone);
  const zones = useMemo(() => timezoneOptions(), []);
  const dirty = name !== brand.name || timezone !== brand.timezone;
  useUnsavedChanges(dirty && !busy);

  return (
    <SectionCard
      as="form"
      ref={formRef}
      noValidate
      title="Dados da marca"
      className="max-w-2xl"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(
          saveBrandSchema,
          {
            id: brand.id,
            clientId: brand.clientId,
            name,
            timezone,
            expectedVersion: brand.version,
            description: brand.description ?? "",
            targetAudience: brand.targetAudience ?? "",
            toneOfVoice: brand.toneOfVoice ?? "",
            objectives: brand.objectives ?? "",
            referencesNotes: brand.referencesNotes ?? "",
            visualIdentity: brand.visualIdentity,
          },
          (data) => saveBrand({ data }),
          async () => {
            toast.success("Marca salva.");
            await queryClient.invalidateQueries({ queryKey: QueryKey.Brands.all() });
          },
        );
      }}
    >
      <TextField
        id="settings-name"
        label="Nome"
        required
        value={name}
        onValueChange={setName}
        maxLength={120}
        error={errors["name"]}
      />
      <SelectField
        id="settings-timezone"
        label="Fuso horário"
        required
        value={timezone}
        onValueChange={setTimezone}
        options={zones}
        error={errors["timezone"]}
      />
      {timezone !== brand.timezone ? (
        <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm">
          Mudar o fuso vale para os próximos planejamentos. O que já foi agendado mantém o horário
          em que foi marcado.
        </p>
      ) : null}
      <FormError message={error} />
      <Button type="submit" loading={busy} disabled={busy || !dirty}>
        <Save aria-hidden="true" />
        Salvar
      </Button>
    </SectionCard>
  );
}

export function BrandSettingsTab({ brandId }: { brandId: string }) {
  const auth = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useBrand(brandId);
  const { run, busy } = useServerAction();
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!query.data) return <PageSkeleton rows={2} />;
  const brand = query.data;
  const invalidate = [QueryKey.Brands.all()];

  return (
    <div className="space-y-6">
      <SettingsForm key={brand.version} brand={brand} />
      <SectionCard as="div" title="Arquivar ou excluir" className="max-w-2xl">
        <p className="text-sm text-muted-foreground">
          Arquivar bloqueia novos conteúdos e planejamentos, mas guarda todo o histórico. Só é
          possível excluir marcas sem canais e sem histórico.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setArchiving(true)}>
            {brand.archived ? <Undo2 aria-hidden="true" /> : <Archive aria-hidden="true" />}
            {brand.archived ? "Reativar marca" : "Arquivar marca"}
          </Button>
          {can(auth, Action.Brands.Delete) ? (
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => setDeleting(true)}
            >
              <Trash2 aria-hidden="true" /> Excluir marca
            </Button>
          ) : null}
        </div>
      </SectionCard>

      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title={brand.archived ? "Reativar marca" : "Arquivar marca"}
        description={
          brand.archived
            ? "A marca volta a aceitar novos conteúdos."
            : "A marca deixa de aceitar novos conteúdos. O histórico continua disponível."
        }
        confirmLabel={brand.archived ? "Reativar" : "Arquivar"}
        busy={busy}
        onConfirm={async () => {
          const result = await run(
            () => setBrandArchived({ data: { id: brand.id, archived: !brand.archived } }),
            { success: brand.archived ? "Marca reativada." : "Marca arquivada.", invalidate },
          );
          return result.ok;
        }}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Excluir marca"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        busy={busy}
        onConfirm={async () => {
          const result = await run(() => deleteBrand({ data: { id: brand.id } }), {
            success: "Marca excluída.",
            invalidate,
          });
          if (!result.ok) return false;
          queryClient.removeQueries({ queryKey: QueryKey.Brands.detail(brand.id) });
          await router.navigate({ to: AppRoute.Brands });
          return true;
        }}
      />
    </div>
  );
}
