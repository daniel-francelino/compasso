import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Plus, Rocket, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AddSectionDialog } from "@/components/cms/page-editor/add-section-dialog";
import { CaseAuthorizationPanel } from "@/components/cms/page-editor/case-authorization-panel";
import { PageFields } from "@/components/cms/page-editor/page-fields";
import { PublishDialog } from "@/components/cms/page-editor/publish-dialog";
import { SectionForm } from "@/components/cms/page-editor/section-form";
import { SectionList } from "@/components/cms/page-editor/section-list";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { SelectField, TextField } from "@/components/shared/admin/form-fields";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SectionCard } from "@/components/shared/admin/section-card";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { Button } from "@/components/shared/ui/button";
import { Checkbox } from "@/components/shared/ui/checkbox";
import { Label } from "@/components/shared/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shared/ui/tabs";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import {
  type PageEditorData,
  type PageOption,
  getPageEditor,
  listPageOptions,
  saveSitePage,
} from "@/lib/cms/pages.functions";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { type Json, toJson } from "@/lib/shared/content/published";
import { componentRegistry, newSection } from "@/lib/shared/content/registry";
import { type DraftPage, type DraftSection, draftPageSchema } from "@/lib/shared/content/schemas";
import {
  type SectionAccent,
  type SectionBackground,
  type SectionKind,
  type SectionSpacing,
  SitePageKind,
  SitePageStatus,
} from "@/lib/shared/enums";
import {
  sectionAccentLabels,
  sectionBackgroundLabels,
  sectionSpacingLabels,
  sitePageKindLabels,
  sitePageStatusLabels,
} from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { AppRoute } from "@/lib/shared/routes";

const PAGE_TAB = "page";
const DEFAULT = "default";

function SectionMeta({
  section,
  canEdit,
  onChange,
}: {
  section: DraftSection;
  canEdit: boolean;
  onChange: (section: DraftSection) => void;
}) {
  const appearance = section.appearance;
  const set = (patch: Partial<DraftSection["appearance"]>) =>
    onChange({ ...section, appearance: { ...appearance, ...patch } });
  const option = <T extends string>(labels: Record<T, string>) => [
    { value: DEFAULT, label: "Padrão" },
    ...(Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] })),
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField
        id={`${section.id}-anchor`}
        label="Âncora"
        value={section.anchor ?? ""}
        disabled={!canEdit}
        onValueChange={(value) =>
          onChange({ ...section, ...(value === "" ? { anchor: undefined } : { anchor: value }) })
        }
        maxLength={40}
        hint="Letras minúsculas, números e hífens. Serve para links como /pagina#anchor."
      />
      <SelectField
        id={`${section.id}-background`}
        label="Fundo"
        value={appearance.background ?? DEFAULT}
        disabled={!canEdit}
        onValueChange={(value) =>
          set({ background: value === DEFAULT ? undefined : (value as SectionBackground) })
        }
        options={option(sectionBackgroundLabels)}
      />
      <SelectField
        id={`${section.id}-spacing`}
        label="Espaçamento"
        value={appearance.spacing ?? DEFAULT}
        disabled={!canEdit}
        onValueChange={(value) =>
          set({ spacing: value === DEFAULT ? undefined : (value as SectionSpacing) })
        }
        options={option(sectionSpacingLabels)}
      />
      <SelectField
        id={`${section.id}-accent`}
        label="Destaque"
        value={appearance.accent ?? DEFAULT}
        disabled={!canEdit}
        onValueChange={(value) =>
          set({ accent: value === DEFAULT ? undefined : (value as SectionAccent) })
        }
        options={option(sectionAccentLabels)}
      />
    </div>
  );
}

function PageEditor({ data, pages }: { data: PageEditorData; pages: PageOption[] }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { run, busy } = useServerAction();
  const canEdit = can(auth, Action.Site.Edit);
  const canStructure = can(auth, Action.Site.Structure);
  const canPublish = can(auth, Action.Site.Publish);

  const initial = draftPageSchema.parse(data.draft);
  const [draft, setDraft] = useState<DraftPage>(initial);
  const [slug, setSlug] = useState(data.slug);
  const [selected, setSelected] = useState<string>(initial.sections[0]?.id ?? PAGE_TAB);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial) || slug !== data.slug;
  useUnsavedChanges(dirty);

  const section = draft.sections.find((item) => item.id === selected) ?? null;
  const setSections = (sections: DraftSection[]) => setDraft({ ...draft, sections });
  const replace = (next: DraftSection) =>
    setSections(draft.sections.map((item) => (item.id === next.id ? next : item)));

  function move(id: string, delta: -1 | 1) {
    const index = draft.sections.findIndex((item) => item.id === id);
    const target = index + delta;
    const next = [...draft.sections];
    const [moved] = next.splice(index, 1);
    if (moved === undefined || target < 0 || target > draft.sections.length - 1) return;
    next.splice(target, 0, moved);
    setSections(next);
  }

  function duplicate(id: string) {
    const index = draft.sections.findIndex((item) => item.id === id);
    const original = draft.sections[index];
    if (original === undefined) return;
    const copy: DraftSection = { ...original, id: crypto.randomUUID() };
    delete copy.anchor;
    const next = [...draft.sections];
    next.splice(index + 1, 0, copy);
    setSections(next);
    setSelected(copy.id);
  }

  function add(kind: SectionKind) {
    const created = newSection(kind, crypto.randomUUID());
    setSections([...draft.sections, created]);
    setSelected(created.id);
  }

  async function save() {
    const result = await run(
      () =>
        saveSitePage({
          data: {
            pageId: data.id,
            slug,
            kind: data.kind,
            draft: toJson(draft) as Record<string, Json>,
            expectedVersion: data.version,
          },
        }),
      { success: "Página salva." },
    );
    if (result.ok) await queryClient.invalidateQueries({ queryKey: QueryKey.Site.all() });
  }

  const status =
    data.status === SitePageStatus.Published ? sitePageStatusLabels[data.status] : "Fora do site";

  return (
    <div className="space-y-4">
      <PageHeader
        title={draft.title || sitePageKindLabels[data.kind]}
        description={`${sitePageKindLabels[data.kind]} · ${status} · endereço ${slug === "" ? "/" : `/${slug}`}`}
        breadcrumbs={[
          { label: "Páginas", to: AppRoute.SitePages },
          { label: draft.title || "Página" },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/admin/site/preview/$pageId" params={{ pageId: data.id }} target="_blank">
                <ExternalLink aria-hidden="true" />
                Pré-visualizar
              </Link>
            </Button>
            {canEdit ? (
              <Button type="button" onClick={() => void save()} loading={busy} disabled={!dirty}>
                <Save aria-hidden="true" />
                Salvar
              </Button>
            ) : null}
            {canPublish ? (
              <Button type="button" variant="outline" onClick={() => setPublishing(true)}>
                <Rocket aria-hidden="true" />
                Publicar…
              </Button>
            ) : null}
          </div>
        }
      />
      {dirty ? (
        <p role="status" className="text-sm text-muted-foreground">
          Há alterações sem salvar.
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <SectionCard as="div" title="Seções">
          <SectionList
            sections={draft.sections}
            selectedId={selected}
            canEdit={canEdit}
            onSelect={setSelected}
            onMove={move}
            onToggle={(id) =>
              setSections(
                draft.sections.map((item) =>
                  item.id === id ? { ...item, visible: !item.visible } : item,
                ),
              )
            }
            onDuplicate={duplicate}
            onRemove={setRemoving}
          />
          {canEdit ? (
            <Button type="button" variant="outline" onClick={() => setAdding(true)}>
              <Plus aria-hidden="true" />
              Adicionar seção
            </Button>
          ) : null}
          <Button
            type="button"
            variant={selected === PAGE_TAB ? "default" : "ghost"}
            onClick={() => setSelected(PAGE_TAB)}
          >
            Configurações da página
          </Button>
        </SectionCard>
        <div className="space-y-4">
          <Tabs defaultValue="fields">
            <TabsList>
              <TabsTrigger value="fields">Campos</TabsTrigger>
              <TabsTrigger value="preview">Pré-visualização</TabsTrigger>
            </TabsList>
            <TabsContent value="fields" className="space-y-4">
              {selected === PAGE_TAB || section === null ? (
                <SectionCard as="div" title="Configurações da página">
                  <PageFields
                    draft={draft}
                    slug={slug}
                    slugLocked={!canStructure || data.isSystem}
                    canEdit={canEdit}
                    onDraft={setDraft}
                    onSlug={setSlug}
                  />
                </SectionCard>
              ) : (
                <SectionCard as="div" title={componentRegistry[section.component].label}>
                  <SectionForm
                    key={section.id}
                    sectionId={section.id}
                    kind={section.component}
                    content={section.content}
                    pages={pages}
                    onChange={(content) => replace({ ...section, content })}
                  />
                  <SectionMeta section={section} canEdit={canEdit} onChange={replace} />
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`${section.id}-visible`}
                      checked={section.visible}
                      disabled={!canEdit}
                      onCheckedChange={(checked) =>
                        replace({ ...section, visible: checked === true })
                      }
                    />
                    <Label htmlFor={`${section.id}-visible`} className="font-normal">
                      Mostrar esta seção no site
                    </Label>
                  </div>
                </SectionCard>
              )}
              {data.kind === SitePageKind.CaseStudy ? (
                <CaseAuthorizationPanel pageId={data.id} canEdit={canEdit} />
              ) : null}
            </TabsContent>
            <TabsContent value="preview">
              <iframe
                key={data.version}
                title="Pré-visualização da página salva"
                src={`/admin/site/preview/${data.id}`}
                className="h-[36rem] w-full rounded-xl border border-border bg-surface"
              />
              <p className="text-xs text-muted-foreground">
                Mostra a última versão salva. Salve para atualizar.
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      {adding ? (
        <AddSectionDialog onPick={add} onOpenChange={(open) => !open && setAdding(false)} />
      ) : null}
      {publishing ? (
        <PublishDialog
          pageId={data.id}
          hasUnsaved={dirty}
          onOpenChange={(open) => !open && setPublishing(false)}
        />
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Excluir a seção?"
        description="A seção sai da página no próximo salvamento. Você pode descartar as alterações antes de salvar."
        confirmLabel="Excluir seção"
        destructive
        onConfirm={() => {
          if (removing === null) return true;
          setSections(draft.sections.filter((item) => item.id !== removing));
          setSelected(PAGE_TAB);
          toast.success("Seção removida da página (falta salvar).");
          return true;
        }}
      />
    </div>
  );
}

export function PageEditorPage({ pageId }: { pageId: string }) {
  const page = useQuery({
    queryKey: QueryKey.Site.page(pageId),
    queryFn: async () => unwrapResult(await getPageEditor({ data: { pageId } })).page,
  });
  const options = useQuery({
    queryKey: QueryKey.Site.pageOptions(),
    queryFn: async () => unwrapResult(await listPageOptions()).pages,
  });
  if (page.isPending || options.isPending) return <PageSkeleton rows={4} />;
  if (page.isError) return <p className="text-sm text-danger">{page.error.message}</p>;
  return <PageEditor key={page.data.version} data={page.data} pages={options.data ?? []} />;
}
