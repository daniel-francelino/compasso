import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FormSwitch } from "lost-ui/forms/form-switch";
import { Alert, AlertDescription } from "lost-ui/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "lost-ui/ui/tabs";
import { PageHeader } from "@/components/shared/admin/page-header";
import { DesignBrandPanel } from "@/components/shared/design/design-brand-panel";
import { DesignExportDialog } from "@/components/shared/design/design-export-dialog";
import { DesignLayersPanel } from "@/components/shared/design/design-layers-panel";
import { DesignNameField } from "@/components/shared/design/design-name-field";
import { DesignPagesStrip } from "@/components/shared/design/design-pages-strip";
import { DesignPropertiesPanel } from "@/components/shared/design/design-properties-panel";
import { DesignSaveStatus } from "@/components/shared/design/design-save-status";
import { DesignToolbar } from "@/components/shared/design/design-toolbar";
import { DesignVersionsDialog } from "@/components/shared/design/design-versions-dialog";
import { Button } from "@/components/shared/ui/button";
import { Skeleton } from "@/components/shared/ui/skeleton";
import { useDesignAssets } from "@/hooks/shared/design/use-design-assets";
import { useDesignAutosave } from "@/hooks/shared/design/use-design-autosave";
import { useDesignEditor } from "@/hooks/shared/design/use-design-editor";
import { useDesignShortcuts } from "@/hooks/shared/design/use-design-shortcuts";
import { useIsMobile } from "@/hooks/shared/use-mobile";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { type CanvasChrome, readCanvasChrome } from "@/lib/shared/design/browser";
import {
  type DesignDetail,
  getDesignBrandKit,
  renameDesign,
  restoreDesignVersion,
  saveDesignVersion,
  setDesignTemplate,
} from "@/lib/shared/design/design.functions";
import { brandFontsOf } from "@/lib/shared/design/document";
import {
  DESIGN_PRESET_LABEL,
  DESIGN_PRESET_SIZE,
  DesignSaveState,
} from "@/lib/shared/design/types";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { AppRoute } from "@/lib/shared/routes";

const DesignCanvas = lazy(() => import("@/components/shared/design/design-canvas"));

const CHECKER = {
  backgroundImage: "repeating-conic-gradient(var(--line) 0% 25%, var(--surface) 0% 50%)",
  backgroundSize: "24px 24px",
};
const MAX_VIEWPORT_SHARE = 0.7;
const PanelTab = { Properties: "properties", Layers: "layers", Brand: "brand" } as const;

const useFitScale = (page: { width: number; height: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (node === null) return undefined;
    const measure = () => {
      const byWidth = node.clientWidth / page.width;
      const byHeight = (window.innerHeight * MAX_VIEWPORT_SHARE) / page.height;
      setScale(Math.max(0.05, Math.min(1, byWidth, byHeight)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [page.width, page.height]);

  return { ref, scale };
};

export function DesignWorkspace({
  design,
  onReload,
}: {
  design: DesignDetail;
  onReload: () => void;
}) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const editable = can(auth, Action.Design.Update) && !design.trashed && !isMobile;
  const canExport = can(auth, Action.Media.Upload);
  const editor = useDesignEditor(design.document);
  const autosave = useDesignAutosave({
    designId: design.id,
    document: editor.document,
    initialVersion: design.version,
    enabled: editable,
  });
  const assets = useDesignAssets(editor.document);
  const size = DESIGN_PRESET_SIZE[design.preset];
  const fit = useFitScale(size);
  const kit = useQuery({
    queryKey: QueryKey.Design.brandKit(design.brandId),
    queryFn: async () =>
      unwrapResult(await getDesignBrandKit({ data: { brandId: design.brandId } })).kit,
  });
  const [chrome, setChrome] = useState<CanvasChrome | null>(null);
  const [name, setName] = useState(design.name);
  const [isTemplate, setIsTemplate] = useState(design.isTemplate);
  const [savingVersion, setSavingVersion] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const conflict = autosave.state === DesignSaveState.Conflict;
  const canEdit = editable && !conflict;
  const swatches = (kit.data?.colors ?? []).map((color) => color.hex);
  const brandFonts = brandFontsOf(kit.data?.fonts ?? []);

  useDesignShortcuts(editor, canEdit);
  useEffect(() => setChrome(readCanvasChrome()), []);

  const refreshList = () => queryClient.invalidateQueries({ queryKey: QueryKey.Design.lists() });

  const rename = async (next: string) => {
    const result = await autosave.withVersion((expectedVersion) =>
      renameDesign({ data: { id: design.id, name: next, expectedVersion } }),
    );
    if (result === null || !result.ok) return false;
    setName(next);
    void refreshList();
    return true;
  };

  const saveVersion = async (): Promise<number | null> => {
    setSavingVersion(true);
    const result = await autosave.withVersion((expectedVersion) =>
      saveDesignVersion({ data: { id: design.id, expectedVersion } }),
    );
    setSavingVersion(false);
    if (result === null || !result.ok) return null;
    toast.success(`Versão ${result.versionNo} salva.`);
    void refreshList();
    void queryClient.invalidateQueries({ queryKey: QueryKey.Design.versions(design.id) });
    return result.versionNo;
  };

  const restore = async (versionNo: number) => {
    const result = await autosave.withVersion((expectedVersion) =>
      restoreDesignVersion({ data: { id: design.id, versionNo, expectedVersion } }),
    );
    if (result === null || !result.ok) return false;
    toast.success(`Versão ${versionNo} restaurada no rascunho.`);
    onReload();
    return true;
  };

  const toggleTemplate = async (template: boolean) => {
    const result = await autosave.withVersion((expectedVersion) =>
      setDesignTemplate({ data: { id: design.id, template, expectedVersion } }),
    );
    if (result === null || !result.ok) return;
    setIsTemplate(template);
    toast.success(
      template ? "Design marcado como modelo da marca." : "Design deixou de ser modelo.",
    );
    void refreshList();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={name}
        description={`${design.brandName} · ${DESIGN_PRESET_LABEL[design.preset]}`}
        breadcrumbs={[{ label: "Designs", to: AppRoute.Designs }, { label: name }]}
        actions={editable ? <DesignSaveStatus state={autosave.state} /> : null}
      />
      {design.trashed ? (
        <Alert>
          <AlertDescription>
            Este design está na lixeira e só pode ser visto. Restaure na lista de designs para
            editar.
          </AlertDescription>
        </Alert>
      ) : null}
      {isMobile && !design.trashed ? (
        <Alert>
          <AlertDescription>
            A edição de designs está disponível no tablet e no computador. Aqui você só pode ver o
            design.
          </AlertDescription>
        </Alert>
      ) : null}
      {conflict ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Este design foi alterado em outra aba ou por outra pessoa. As suas últimas alterações
              continuam na tela, mas não foram salvas.
            </span>
            <Button type="button" variant="outline" size="sm" onClick={onReload}>
              <RefreshCw aria-hidden="true" />
              Recarregar design
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {autosave.state === DesignSaveState.Failed && autosave.message !== null ? (
        <Alert variant="destructive">
          <AlertDescription>{autosave.message}</AlertDescription>
        </Alert>
      ) : null}
      {isMobile ? null : (
        <div className="flex flex-wrap items-center gap-4">
          <DesignNameField name={name} disabled={!canEdit} onRename={rename} />
          <FormSwitch
            name="isTemplate"
            label="Modelo da marca"
            value={isTemplate}
            disabled={!canEdit}
            onValueChange={(value) => void toggleTemplate(value)}
          />
        </div>
      )}
      {isMobile ? null : (
        <DesignToolbar
          editor={editor}
          preset={design.preset}
          brandId={design.brandId}
          chrome={chrome}
          editable={canEdit}
          canExport={canExport}
          savingVersion={savingVersion}
          onSaveVersion={() => void saveVersion()}
          onVersions={() => setVersionsOpen(true)}
          onExport={() => setExportOpen(true)}
        />
      )}
      <DesignPagesStrip editor={editor} editable={canEdit} />
      <div className="flex flex-col gap-4 lg:flex-row">
        <div ref={fit.ref} className="min-w-0 flex-1">
          <div
            className="mx-auto w-fit overflow-hidden rounded-md border shadow-sm"
            style={CHECKER}
          >
            {chrome === null || fit.scale === 0 ? (
              <Skeleton className="h-96 w-72" />
            ) : (
              <Suspense fallback={<Skeleton className="h-96 w-72" />}>
                <DesignCanvas
                  page={editor.page}
                  size={size}
                  scale={fit.scale}
                  selectedIds={editor.selectedIds}
                  images={assets.images}
                  chrome={chrome}
                  fontsVersion={assets.fontsVersion}
                  editable={canEdit}
                  label={`Página ${editor.document.pages.findIndex((page) => page.id === editor.pageId) + 1} do design ${name}`}
                  onSelect={editor.select}
                  onCommit={editor.patchMany}
                  onMeasure={editor.measure}
                />
              </Suspense>
            )}
          </div>
          {canEdit ? (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Shift+clique seleciona vários · Setas movem (Shift para 10 px) · Delete exclui ·
              Ctrl+D duplica · Ctrl+G agrupa · Esc limpa a seleção
            </p>
          ) : null}
        </div>
        {isMobile ? null : (
          <aside className="w-full shrink-0 rounded-lg border bg-card p-4 lg:w-80">
            <Tabs defaultValue={PanelTab.Properties}>
              <TabsList className="w-full">
                <TabsTrigger value={PanelTab.Properties}>Propriedades</TabsTrigger>
                <TabsTrigger value={PanelTab.Layers}>Camadas</TabsTrigger>
                <TabsTrigger value={PanelTab.Brand}>Marca</TabsTrigger>
              </TabsList>
              <TabsContent value={PanelTab.Properties} className="mt-4">
                <DesignPropertiesPanel
                  editor={editor}
                  chrome={chrome}
                  editable={canEdit}
                  swatches={swatches}
                  brandFonts={brandFonts}
                />
              </TabsContent>
              <TabsContent value={PanelTab.Layers} className="mt-4">
                <DesignLayersPanel editor={editor} editable={canEdit} />
              </TabsContent>
              <TabsContent value={PanelTab.Brand} className="mt-4">
                <DesignBrandPanel
                  editor={editor}
                  kit={kit.data}
                  loading={kit.isPending}
                  preset={design.preset}
                  brandFonts={brandFonts}
                  editable={canEdit}
                />
              </TabsContent>
            </Tabs>
          </aside>
        )}
      </div>
      <DesignVersionsDialog
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        designId={design.id}
        timeZone={design.brandTimezone}
        editable={canEdit}
        onRestore={restore}
      />
      {chrome === null ? null : (
        <DesignExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          document={editor.document}
          preset={design.preset}
          chrome={chrome}
          designId={design.id}
          designName={name}
          brandId={design.brandId}
          reuseAssets={can(auth, Action.Media.Update)}
          saveVersion={saveVersion}
        />
      )}
    </div>
  );
}
