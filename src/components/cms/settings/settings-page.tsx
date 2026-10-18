import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Rocket, Save } from "lucide-react";
import { useState } from "react";
import { ImageField } from "@/components/cms/fields/image-field";
import { LinkField } from "@/components/cms/fields/link-field";
import { ProblemList } from "@/components/cms/page-editor/problem-list";
import { TextAreaField, TextField } from "@/components/shared/admin/form-fields";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SectionCard } from "@/components/shared/admin/section-card";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { Button } from "@/components/shared/ui/button";
import { Checkbox } from "@/components/shared/ui/checkbox";
import { Label } from "@/components/shared/ui/label";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { listPageOptions } from "@/lib/cms/pages.functions";
import {
  type SettingsData,
  getSettings,
  publishSettings,
  saveSettings,
} from "@/lib/cms/settings.functions";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { type Json, toJson } from "@/lib/shared/content/published";
import { hasErrors } from "@/lib/shared/content/resolve";
import { linkSchema, settingsSchemas } from "@/lib/shared/content/schemas";
import { SiteSettingsGroup } from "@/lib/shared/enums";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

export const SettingsMode = {
  General: "general",
  Seo: "seo",
} as const;
export type SettingsMode = (typeof SettingsMode)[keyof typeof SettingsMode];

function GroupCard({
  group,
  title,
  data,
  canEdit,
  children,
}: {
  group: SiteSettingsGroup;
  title: string;
  data: SettingsData;
  canEdit: boolean;
  children: (
    value: Record<string, unknown>,
    set: (patch: Record<string, unknown>) => void,
  ) => React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const { run, busy } = useServerAction();
  const stored =
    typeof data.settings === "object" && data.settings !== null && !Array.isArray(data.settings)
      ? data.settings[group]
      : undefined;
  const [value, setValue] = useState<Record<string, unknown>>(
    settingsSchemas[group].parse(stored ?? {}),
  );
  const [errors, setErrors] = useState<string | null>(null);
  const dirty =
    JSON.stringify(value) !== JSON.stringify(settingsSchemas[group].parse(stored ?? {}));

  async function save() {
    const parsed = settingsSchemas[group].safeParse(value);
    if (!parsed.success) {
      setErrors(parsed.error.issues[0]?.message ?? "Confira os campos.");
      return;
    }
    setErrors(null);
    const result = await run(
      () =>
        saveSettings({
          data: {
            group,
            value: toJson(parsed.data) as Record<string, Json>,
            expectedVersion: data.version,
          },
        }),
      { success: "Configurações salvas." },
    );
    if (result.ok) await queryClient.invalidateQueries({ queryKey: QueryKey.Site.all() });
  }

  return (
    <SectionCard as="div" title={title}>
      {children(value, (patch) => setValue({ ...value, ...patch }))}
      {errors ? (
        <p role="alert" className="text-sm text-danger">
          {errors}
        </p>
      ) : null}
      {canEdit ? (
        <Button type="button" onClick={() => void save()} loading={busy} disabled={!dirty}>
          <Save aria-hidden="true" />
          Salvar
        </Button>
      ) : null}
    </SectionCard>
  );
}

const text = (value: Record<string, unknown>, key: string): string =>
  typeof value[key] === "string" ? (value[key] as string) : "";

export function SettingsPage({ mode }: { mode: SettingsMode }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { run, busy } = useServerAction();
  const canEdit = can(auth, Action.Site.Settings);
  const canPublish = can(auth, Action.Site.Publish);
  const settings = useQuery({
    queryKey: QueryKey.Site.settings(),
    queryFn: async () => unwrapResult(await getSettings()),
  });
  const pages = useQuery({
    queryKey: QueryKey.Site.pageOptions(),
    queryFn: async () => unwrapResult(await listPageOptions()).pages,
  });

  if (settings.isPending) return <PageSkeleton rows={3} />;
  if (settings.isError) return <p className="text-sm text-danger">{settings.error.message}</p>;
  const data = settings.data;
  const keyed = (group: SiteSettingsGroup) => `${group}-${data.version}`;

  async function publish() {
    const result = await run(() => publishSettings({ data: { expectedVersion: data.version } }), {
      success: "Configurações publicadas.",
    });
    if (result.ok) await queryClient.invalidateQueries({ queryKey: QueryKey.Site.all() });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={mode === SettingsMode.Seo ? "SEO" : "Configurações do site"}
        description={
          mode === SettingsMode.Seo
            ? "Textos e imagem usados quando uma página não tem os seus."
            : "Contatos, redes sociais, aviso e mensagens prontas."
        }
        breadcrumbs={[{ label: mode === SettingsMode.Seo ? "SEO" : "Configurações" }]}
        actions={
          canPublish ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void publish()}
              loading={busy}
              disabled={hasErrors(data.problems)}
            >
              <Rocket aria-hidden="true" />
              Publicar configurações
            </Button>
          ) : null
        }
      />
      <ProblemList problems={data.problems} />
      {mode === SettingsMode.General ? (
        <>
          <GroupCard
            key={keyed(SiteSettingsGroup.Contacts)}
            group={SiteSettingsGroup.Contacts}
            title="Contatos"
            data={data}
            canEdit={canEdit}
          >
            {(value, set) => (
              <>
                <TextField
                  id="contacts-whatsapp"
                  label="WhatsApp"
                  value={text(value, "whatsapp")}
                  onValueChange={(whatsapp) => set({ whatsapp })}
                  maxLength={15}
                  inputMode="numeric"
                  hint="Só números, com o código do país. Ex.: 5511999990000"
                  disabled={!canEdit}
                />
                <TextField
                  id="contacts-email"
                  label="E-mail"
                  value={text(value, "email")}
                  onValueChange={(email) => set({ email })}
                  maxLength={200}
                  disabled={!canEdit}
                />
                <TextField
                  id="contacts-phone"
                  label="Telefone"
                  value={text(value, "phone")}
                  onValueChange={(phone) => set({ phone })}
                  maxLength={40}
                  disabled={!canEdit}
                />
              </>
            )}
          </GroupCard>
          <GroupCard
            key={keyed(SiteSettingsGroup.Social)}
            group={SiteSettingsGroup.Social}
            title="Redes sociais"
            data={data}
            canEdit={canEdit}
          >
            {(value, set) => (
              <>
                {(["instagram", "linkedin", "facebook", "youtube"] as const).map((network) => (
                  <TextField
                    key={network}
                    id={`social-${network}`}
                    label={network.charAt(0).toUpperCase() + network.slice(1)}
                    value={text(value, network)}
                    onValueChange={(next) => set({ [network]: next })}
                    maxLength={200}
                    hint="Endereço completo, começando com https://"
                    disabled={!canEdit}
                  />
                ))}
              </>
            )}
          </GroupCard>
          <GroupCard
            key={keyed(SiteSettingsGroup.Announcement)}
            group={SiteSettingsGroup.Announcement}
            title="Faixa de aviso"
            data={data}
            canEdit={canEdit}
          >
            {(value, set) => (
              <>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="announcement-enabled"
                    checked={value["enabled"] === true}
                    disabled={!canEdit}
                    onCheckedChange={(checked) => set({ enabled: checked === true })}
                  />
                  <Label htmlFor="announcement-enabled" className="font-normal">
                    Mostrar a faixa no topo do site
                  </Label>
                </div>
                <TextField
                  id="announcement-text"
                  label="Texto"
                  value={text(value, "text")}
                  onValueChange={(next) => set({ text: next })}
                  maxLength={160}
                  counter
                  disabled={!canEdit}
                />
                <LinkField
                  id="announcement-link"
                  label="Destino (opcional)"
                  value={linkSchema
                    .nullable()
                    .catch(null)
                    .parse(value["link"] ?? null)}
                  pages={pages.data ?? []}
                  onChange={(link) => set({ link })}
                />
              </>
            )}
          </GroupCard>
          <GroupCard
            key={keyed(SiteSettingsGroup.MessageTemplates)}
            group={SiteSettingsGroup.MessageTemplates}
            title="Mensagens prontas"
            data={data}
            canEdit={canEdit}
          >
            {(value, set) => (
              <TextAreaField
                id="templates-whatsapp"
                label="Mensagem padrão do WhatsApp"
                value={text(value, "whatsapp")}
                onValueChange={(whatsapp) => set({ whatsapp })}
                maxLength={300}
                rows={3}
                disabled={!canEdit}
              />
            )}
          </GroupCard>
        </>
      ) : (
        <GroupCard
          key={keyed(SiteSettingsGroup.SeoDefaults)}
          group={SiteSettingsGroup.SeoDefaults}
          title="SEO padrão"
          data={data}
          canEdit={canEdit}
        >
          {(value, set) => (
            <>
              <TextField
                id="seo-default-title"
                label="Título"
                value={text(value, "title")}
                onValueChange={(title) => set({ title })}
                maxLength={70}
                counter
                disabled={!canEdit}
              />
              <TextAreaField
                id="seo-default-description"
                label="Descrição"
                value={text(value, "description")}
                onValueChange={(description) => set({ description })}
                maxLength={170}
                rows={3}
                disabled={!canEdit}
              />
              <ImageField
                id="seo-default-og"
                label="Imagem de compartilhamento"
                value={{
                  mediaVersionId: typeof value["ogImage"] === "string" ? value["ogImage"] : null,
                  alt: "",
                  decorative: true,
                }}
                onChange={(image) => set({ ogImage: image.mediaVersionId })}
              />
            </>
          )}
        </GroupCard>
      )}
    </div>
  );
}
