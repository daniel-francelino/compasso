import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Rocket, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { LinkField } from "@/components/cms/fields/link-field";
import { ProblemList } from "@/components/cms/page-editor/problem-list";
import { TextField } from "@/components/shared/admin/form-fields";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SectionCard } from "@/components/shared/admin/section-card";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { Button } from "@/components/shared/ui/button";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import { type PageOption, listPageOptions } from "@/lib/cms/pages.functions";
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
import { type SiteLink, settingsSchemas } from "@/lib/shared/content/schemas";
import { SiteSettingsGroup } from "@/lib/shared/enums";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

type Item = { label: string; link: SiteLink | null };
type HeaderItem = Item & { children: Item[] };
type Navigation = { header: HeaderItem[]; footer: Item[] };

const blank = (): Item => ({ label: "", link: null });

function ItemFields({
  id,
  item,
  pages,
  canEdit,
  onChange,
  onRemove,
}: {
  id: string;
  item: Item;
  pages: PageOption[];
  canEdit: boolean;
  onChange: (item: Item) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <TextField
        id={`${id}-label`}
        label="Texto"
        value={item.label}
        onValueChange={(label) => onChange({ ...item, label })}
        maxLength={60}
        disabled={!canEdit}
      />
      <LinkField
        id={`${id}-link`}
        label="Destino"
        value={item.link}
        pages={pages}
        onChange={(link) => onChange({ ...item, link })}
      />
      {canEdit ? (
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 aria-hidden="true" /> Remover
        </Button>
      ) : null}
    </div>
  );
}

function NavigationEditor({ data, pages }: { data: SettingsData; pages: PageOption[] }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { run, busy } = useServerAction();
  const canEdit = can(auth, Action.Site.Settings);
  const canPublish = can(auth, Action.Site.Publish);
  const stored = settingsSchemas[SiteSettingsGroup.Navigation].parse(
    typeof data.settings === "object" && data.settings !== null && !Array.isArray(data.settings)
      ? (data.settings[SiteSettingsGroup.Navigation] ?? {})
      : {},
  ) as Navigation;
  const [nav, setNav] = useState<Navigation>(stored);
  const dirty = JSON.stringify(nav) !== JSON.stringify(stored);
  useUnsavedChanges(dirty);

  const setHeader = (header: HeaderItem[]) => setNav({ ...nav, header });
  const setFooter = (footer: Item[]) => setNav({ ...nav, footer });

  async function save() {
    const result = await run(
      () =>
        saveSettings({
          data: {
            group: SiteSettingsGroup.Navigation,
            value: toJson(nav) as Record<string, Json>,
            expectedVersion: data.version,
          },
        }),
      { success: "Menu salvo." },
    );
    if (result.ok) await queryClient.invalidateQueries({ queryKey: QueryKey.Site.all() });
  }

  async function publish() {
    const result = await run(() => publishSettings({ data: { expectedVersion: data.version } }), {
      success: "Menu publicado.",
    });
    if (result.ok) await queryClient.invalidateQueries({ queryKey: QueryKey.Site.all() });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menu e rodapé"
        description="Os links do cabeçalho (até dois níveis) e do rodapé."
        breadcrumbs={[{ label: "Menu" }]}
        actions={
          <div className="flex gap-2">
            {canEdit ? (
              <Button type="button" onClick={() => void save()} loading={busy} disabled={!dirty}>
                <Save aria-hidden="true" /> Salvar
              </Button>
            ) : null}
            {canPublish ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void publish()}
                loading={busy}
                disabled={dirty || hasErrors(data.problems)}
              >
                <Rocket aria-hidden="true" /> Publicar
              </Button>
            ) : null}
          </div>
        }
      />
      <ProblemList problems={data.problems} />
      <SectionCard as="div" title="Cabeçalho">
        {nav.header.map((item, index) => (
          <div key={index} className="space-y-3">
            <ItemFields
              id={`header-${index}`}
              item={item}
              pages={pages}
              canEdit={canEdit}
              onChange={(next) =>
                setHeader(
                  nav.header.map((current, at) =>
                    at === index ? { ...current, ...next } : current,
                  ),
                )
              }
              onRemove={() => setHeader(nav.header.filter((_, at) => at !== index))}
            />
            <div className="ml-4 space-y-3 border-l border-border pl-4">
              {item.children.map((child, childIndex) => (
                <ItemFields
                  key={childIndex}
                  id={`header-${index}-${childIndex}`}
                  item={child}
                  pages={pages}
                  canEdit={canEdit}
                  onChange={(next) =>
                    setHeader(
                      nav.header.map((current, at) =>
                        at === index
                          ? {
                              ...current,
                              children: current.children.map((entry, i) =>
                                i === childIndex ? next : entry,
                              ),
                            }
                          : current,
                      ),
                    )
                  }
                  onRemove={() =>
                    setHeader(
                      nav.header.map((current, at) =>
                        at === index
                          ? {
                              ...current,
                              children: current.children.filter((_, i) => i !== childIndex),
                            }
                          : current,
                      ),
                    )
                  }
                />
              ))}
              {canEdit && item.children.length < 8 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setHeader(
                      nav.header.map((current, at) =>
                        at === index
                          ? { ...current, children: [...current.children, blank()] }
                          : current,
                      ),
                    )
                  }
                >
                  <Plus aria-hidden="true" /> Adicionar subitem
                </Button>
              ) : null}
            </div>
          </div>
        ))}
        {canEdit && nav.header.length < 8 ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setHeader([...nav.header, { ...blank(), children: [] }])}
          >
            <Plus aria-hidden="true" /> Adicionar item
          </Button>
        ) : null}
      </SectionCard>
      <SectionCard as="div" title="Rodapé">
        {nav.footer.map((item, index) => (
          <ItemFields
            key={index}
            id={`footer-${index}`}
            item={item}
            pages={pages}
            canEdit={canEdit}
            onChange={(next) =>
              setFooter(nav.footer.map((current, at) => (at === index ? next : current)))
            }
            onRemove={() => setFooter(nav.footer.filter((_, at) => at !== index))}
          />
        ))}
        {canEdit && nav.footer.length < 12 ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setFooter([...nav.footer, blank()])}
          >
            <Plus aria-hidden="true" /> Adicionar link
          </Button>
        ) : null}
      </SectionCard>
    </div>
  );
}

export function NavigationPage() {
  const settings = useQuery({
    queryKey: QueryKey.Site.settings(),
    queryFn: async () => unwrapResult(await getSettings()),
  });
  const pages = useQuery({
    queryKey: QueryKey.Site.pageOptions(),
    queryFn: async () => unwrapResult(await listPageOptions()).pages,
  });
  if (settings.isPending || pages.isPending) return <PageSkeleton rows={3} />;
  if (settings.isError) return <p className="text-sm text-danger">{settings.error.message}</p>;
  return (
    <NavigationEditor key={settings.data.version} data={settings.data} pages={pages.data ?? []} />
  );
}
