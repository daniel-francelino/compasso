import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { Alert, AlertDescription } from "lost-ui/ui/alert";
import { DesignBrandPanel } from "@/components/shared/design/design-brand-panel";
import { DesignHistoryPanel } from "@/components/shared/design/design-history-panel";
import { DesignContextBar } from "@/components/shared/design/design-context-bar";
import { DesignFilterDialog } from "@/components/shared/design/design-filter-dialog";
import { DesignExportDialog } from "@/components/shared/design/design-export-dialog";
import { DesignMenuBar } from "@/components/shared/design/design-menu-bar";
import { DesignAdjustmentsPanel } from "@/components/shared/design/design-adjustments-panel";
import { DesignLayersPanel } from "@/components/shared/design/design-layers-panel";
import { DesignPanelDock } from "@/components/shared/design/design-panel-dock";
import { DesignPropertiesTab } from "@/components/shared/design/design-properties-tab";
import { DesignSelectionDialog } from "@/components/shared/design/design-selection-dialog";
import { DesignShortcutsDialog } from "@/components/shared/design/design-shortcuts-dialog";
import { DesignStatusBar } from "@/components/shared/design/design-status-bar";
import { DesignToolRail } from "@/components/shared/design/design-tool-rail";
import { DesignTopBar } from "@/components/shared/design/design-top-bar";
import { DesignVersionsDialog } from "@/components/shared/design/design-versions-dialog";
import { DesignViewport } from "@/components/shared/design/design-viewport";
import { MediaPicker } from "@/components/shared/media/media-picker";
import { Button } from "@/components/shared/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/shared/ui/sheet";
import { useDesignAssets } from "@/hooks/shared/design/use-design-assets";
import { useBrushOptions } from "@/hooks/shared/design/use-brush-options";
import { useDesignClipboard } from "@/hooks/shared/design/use-design-clipboard";
import { useDesignImport } from "@/hooks/shared/design/use-design-import";
import { useDesignCrop } from "@/hooks/shared/design/use-design-crop";
import { useDesignColors } from "@/hooks/shared/design/use-design-colors";
import { useDesignFilter } from "@/hooks/shared/design/use-design-filter";
import { useDesignMask } from "@/hooks/shared/design/use-design-mask";
import { useDesignPaint } from "@/hooks/shared/design/use-design-paint";
import { usePixelHistory } from "@/hooks/shared/design/use-pixel-history";
import { usePixelPersist } from "@/hooks/shared/design/use-pixel-persist";
import { useRasterRelease } from "@/hooks/shared/design/use-raster-release";
import { RASTER_MEMORY_MESSAGE, useRasterStore } from "@/hooks/shared/design/use-raster-store";
import { useDesignAutosave } from "@/hooks/shared/design/use-design-autosave";
import { useDesignEditor } from "@/hooks/shared/design/use-design-editor";
import { designMenus } from "@/hooks/shared/design/use-design-menus";
import { useDesignPanelTab } from "@/hooks/shared/design/use-design-panel-tab";
import { useDesignSelection } from "@/hooks/shared/design/use-design-selection";
import { useDesignShortcuts } from "@/hooks/shared/design/use-design-shortcuts";
import { useDesignTool } from "@/hooks/shared/design/use-design-tool";
import { useDesignViewport } from "@/hooks/shared/design/use-design-viewport";
import { useIsMobile } from "@/hooks/shared/use-mobile";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { type DrawTool, drawnElement, isDrawTool } from "@/lib/shared/design/arrange";
import { type CanvasChrome, imageNaturalSize, readCanvasChrome } from "@/lib/shared/design/browser";
import {
  type DesignDetail,
  getDesignBrandKit,
  renameDesign,
  restoreDesignVersion,
  saveDesignVersion,
  setDesignTemplate,
} from "@/lib/shared/design/design.functions";
import { pageSizeOf } from "@/lib/shared/design/crop";
import { brandFontsOf, createImage } from "@/lib/shared/design/document";
import { rasterizeImage } from "@/lib/shared/design/raster-canvas";
import { rasterizedElement } from "@/lib/shared/design/rasterize";
import type { ImageElement } from "@/lib/shared/design/schemas";
import { SelectionAdjust } from "@/lib/shared/design/selection-state";
import {
  DESIGN_PRESET_LABEL,
  DesignPanel,
  DesignSaveState,
  DesignTool,
} from "@/lib/shared/design/types";
import type { Point } from "@/lib/shared/design/viewport";
import { MediaScope } from "@/lib/shared/enums";
import { MediaKind } from "@/lib/shared/media/limits";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const IMAGE_KINDS = [MediaKind.Image] as const;
const RASTERIZE_UNAVAILABLE =
  "A imagem ainda não terminou de carregar. Aguarde um instante e tente de novo.";
const PIXELS_NOT_SENT =
  "Os pixels das camadas não foram enviados. A versão não foi salva; tente de novo.";
const FULL = "O design chegou ao limite de elementos. Remova algum para adicionar outro.";

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
  const canPaint = canExport;
  const pixels = usePixelHistory();
  const editor = useDesignEditor(design.document, pixels.steps);
  const autosave = useDesignAutosave({
    designId: design.id,
    document: editor.document,
    initialVersion: design.version,
    enabled: editable,
  });
  const assets = useDesignAssets(editor.document);
  const rasters = useRasterStore(editor.document);
  pixels.bind(rasters.store);
  useRasterRelease(rasters.store, editor.historyDocuments, pixels.history);
  const persist = usePixelPersist({
    store: rasters.store,
    revision: rasters.revision,
    document: editor.document,
    enabled: editable && canPaint && autosave.state !== DesignSaveState.Conflict,
    brandId: design.brandId,
    reuseAssets: can(auth, Action.Media.Update),
    onSaved: (entries) => flushSync(() => editor.setPixelsVersions(entries)),
  });
  const pageWidth = pageSizeOf(editor.page, design.preset).width;
  const pageHeight = pageSizeOf(editor.page, design.preset).height;
  const size = useMemo(() => ({ width: pageWidth, height: pageHeight }), [pageWidth, pageHeight]);
  const viewport = useDesignViewport(size);
  const tool = useDesignTool();
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
  const [panelsOpen, setPanelsOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [rulers, setRulers] = useState(true);
  const [adjust, setAdjust] = useState<SelectionAdjust | null>(null);
  const panelTab = useDesignPanelTab();
  const conflict = autosave.state === DesignSaveState.Conflict;
  const canEdit = editable && !conflict;
  const full = editor.canAdd() ? undefined : FULL;
  const swatches = (kit.data?.colors ?? []).map((color) => color.hex);
  const brandFonts = brandFontsOf(kit.data?.fonts ?? []);
  const pageNumber = editor.document.pages.findIndex((page) => page.id === editor.pageId) + 1;

  const colors = useDesignColors(chrome);
  const brush = useBrushOptions();
  const selection = useDesignSelection({
    tool: tool.active,
    pageId: editor.pageId,
    size,
    editor,
    rasters,
    zoom: viewport.view?.zoom ?? 1,
  });
  const masks = useDesignMask({ editor, rasters, pixels, selection });
  const paint = useDesignPaint({
    tool: tool.active,
    editor,
    rasters,
    pixels,
    colors,
    brush,
    size,
    canPaint,
    selection,
    masks,
  });

  const filter = useDesignFilter({ editor, rasters, pixels, selection, canPaint });

  const crop = useDesignCrop({
    tool: tool.active,
    editor,
    size,
    zoom: viewport.view?.zoom ?? 1,
    onDone: tool.reset,
  });
  const clipboard = useDesignClipboard({
    editor,
    rasters,
    paint,
    selection,
    size,
    canPaint,
    editable: canEdit,
  });
  const importer = useDesignImport({ editor, rasters, canPaint });
  const startTransform = () => {
    if (editor.transforming) return;
    tool.setTool(DesignTool.Move);
    editor.beginTransform();
  };
  const changeTool = (next: DesignTool) => {
    if (editor.transforming) editor.commitTransform();
    tool.setTool(next);
  };

  const applyAdjust = (kind: SelectionAdjust, amount: number) => {
    const actions = {
      [SelectionAdjust.Feather]: selection.featherBy,
      [SelectionAdjust.Expand]: selection.grow,
      [SelectionAdjust.Contract]: selection.shrink,
    };
    actions[kind](amount);
    setAdjust(null);
  };

  useDesignShortcuts({
    editor,
    colors,
    brush,
    selection,
    paint,
    crop,
    clipboard,
    tool,
    viewport,
    editable: canEdit,
    onTransform: startTransform,
    onImage: () => {
      if (full === undefined) setPicking(true);
    },
  });
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
    if (!(await persist.flush())) {
      setSavingVersion(false);
      toast.error(PIXELS_NOT_SENT);
      return null;
    }
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

  const draw = (drawTool: DrawTool, start: Point, end: Point | null, shift: boolean) => {
    tool.reset();
    if (chrome === null) return;
    const element = drawnElement({
      tool: drawTool,
      id: editor.newId(),
      preset: design.preset,
      palette: chrome,
      start,
      end,
      shift,
    });
    if (!editor.add(element)) {
      toast.error(FULL);
      return;
    }
    if (drawTool === DesignTool.Text) tool.editText(element.id);
  };

  const addImage = async (versionId: string) => {
    const natural = await imageNaturalSize(versionId);
    if (!editor.add(createImage(editor.newId(), design.preset, versionId, natural))) {
      toast.error(FULL);
    }
  };

  const rasterize = (element: ImageElement) => {
    const image = assets.images.get(element.mediaVersionId);
    if (image === null || image === undefined) {
      toast.error(RASTERIZE_UNAVAILABLE);
      return;
    }
    const layerId = editor.newId();
    const buffer = rasterizeImage(element, image);
    if (buffer === null || !rasters.store.set(layerId, buffer)) {
      toast.error(RASTER_MEMORY_MESSAGE);
      return;
    }
    rasters.store.markChanged(layerId);
    editor.replaceWithRaster(element.id, rasterizedElement(element, layerId));
  };

  const openPanel = (panel: DesignPanel) => {
    panelTab.setTab(panel);
    setPanelsOpen(true);
  };

  const addLayer = (drawTool: DrawTool) =>
    draw(drawTool, { x: size.width / 2, y: size.height / 2 }, null, false);

  const menus = designMenus({
    editor,
    viewport,
    canEdit,
    canExport,
    full,
    rulers,
    onRulers: () => setRulers((current) => !current),
    onSaveVersion: () => void saveVersion(),
    onVersions: () => setVersionsOpen(true),
    onExport: () => setExportOpen(true),
    importer,
    onAddLayer: (layerTool) => {
      if (isDrawTool(layerTool)) addLayer(layerTool);
    },
    onAddRaster: () => void editor.addRaster(size),
    onAddAdjustment: (type) => {
      if (!editor.addAdjustment(type, size)) toast.error(FULL);
      openPanel(DesignPanel.Adjustments);
    },
    onRasterize: rasterize,
    onPanel: openPanel,
    onShortcuts: () => setShortcutsOpen(true),
    selection,
    onAdjust: setAdjust,
    clipboard,
    onTransform: startTransform,
    masks,
    onFilter: filter.open,
    filterReason: filter.reason,
  });

  const panels = {
    [DesignPanel.Layers]: (
      <DesignLayersPanel
        editor={editor}
        editable={canEdit}
        onAddRaster={() => void editor.addRaster(size)}
        onRasterize={rasterize}
        failedIds={rasters.failedIds}
        store={rasters.store}
        masks={masks}
      />
    ),
    [DesignPanel.Properties]: (
      <DesignPropertiesTab
        editor={editor}
        chrome={chrome}
        editable={canEdit}
        swatches={swatches}
        brandFonts={brandFonts}
      />
    ),
    [DesignPanel.Adjustments]: (
      <DesignAdjustmentsPanel editor={editor} editable={canEdit} size={size} />
    ),
    [DesignPanel.History]: (
      <DesignHistoryPanel steps={editor.steps} disabled={!canEdit} onJump={editor.jump} />
    ),
    [DesignPanel.Brand]: (
      <DesignBrandPanel
        editor={editor}
        kit={kit.data}
        loading={kit.isPending}
        preset={design.preset}
        brandFonts={brandFonts}
        editable={canEdit}
      />
    ),
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      <DesignTopBar
        editor={editor}
        name={name}
        meta={`${design.brandName} · ${DESIGN_PRESET_LABEL[design.preset]}`}
        editable={editable}
        canEdit={canEdit}
        canExport={canExport}
        isTemplate={isTemplate}
        saveState={persist.state ?? autosave.state}
        savingVersion={savingVersion}
        showSaveState={editable}
        onRename={rename}
        onTemplate={(value) => void toggleTemplate(value)}
        onVersions={() => setVersionsOpen(true)}
        onSaveVersion={() => void saveVersion()}
        onExport={() => setExportOpen(true)}
        onPanels={() => setPanelsOpen(true)}
      />
      <DesignMenuBar menus={menus} />
      {design.trashed ? (
        <Alert className="rounded-none border-x-0 border-t-0">
          <AlertDescription>
            Este design está na lixeira e só pode ser visto. Restaure na lista de designs para
            editar.
          </AlertDescription>
        </Alert>
      ) : null}
      {isMobile && !design.trashed ? (
        <Alert className="rounded-none border-x-0 border-t-0">
          <AlertDescription>
            A edição de designs está disponível no tablet e no computador. Aqui você só pode ver o
            design.
          </AlertDescription>
        </Alert>
      ) : null}
      {conflict ? (
        <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
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
        <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
          <AlertDescription>{autosave.message}</AlertDescription>
        </Alert>
      ) : null}
      {persist.state === DesignSaveState.UploadFailed && persist.message !== null ? (
        <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{persist.message}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void persist.flush()}>
              <RefreshCw aria-hidden="true" />
              Tentar de novo
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {canEdit ? (
        <DesignContextBar
          editor={editor}
          viewport={viewport}
          tool={tool.active}
          size={size}
          paint={paint}
          selection={selection}
          crop={crop}
        />
      ) : null}
      <div className="flex min-h-0 flex-1">
        {canEdit ? (
          <DesignToolRail
            tool={tool.active}
            onTool={changeTool}
            onImage={() => setPicking(true)}
            full={full}
            colors={colors}
            swatches={swatches}
          />
        ) : null}
        <DesignViewport
          viewport={viewport}
          tool={tool}
          editor={editor}
          size={size}
          images={assets.images}
          rasters={rasters}
          chrome={chrome}
          fontsVersion={assets.fontsVersion}
          editable={canEdit}
          label={`Página ${pageNumber} do design ${name}`}
          rulers={rulers}
          paint={paint}
          selection={selection}
          crop={crop}
          onDraw={draw}
        />
        <aside
          aria-label="Painéis"
          className="hidden w-96 shrink-0 overflow-y-auto border-l bg-card xl:block"
        >
          {panelsOpen ? null : (
            <DesignPanelDock panels={panels} tab={panelTab.tab} onTab={panelTab.setTab} />
          )}
        </aside>
      </div>
      <DesignStatusBar
        editor={editor}
        viewport={viewport}
        editable={canEdit}
        size={size}
        onShortcuts={() => setShortcutsOpen(true)}
      />
      <DesignShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <DesignFilterDialog filter={filter} />
      <DesignSelectionDialog kind={adjust} onApply={applyAdjust} onClose={() => setAdjust(null)} />
      <Sheet open={panelsOpen} onOpenChange={setPanelsOpen}>
        <SheetContent side="right" className="w-96 overflow-y-auto p-0 sm:max-w-96">
          <SheetHeader className="px-4 pt-4">
            <SheetTitle>Painéis</SheetTitle>
          </SheetHeader>
          <DesignPanelDock panels={panels} tab={panelTab.tab} onTab={panelTab.setTab} />
        </SheetContent>
      </Sheet>
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        scope={MediaScope.Brand}
        brandId={design.brandId}
        kinds={IMAGE_KINDS}
        onConfirm={(picked) => {
          const first = picked[0];
          if (first !== undefined) void addImage(first.versionId);
        }}
      />
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
          rasters={{ ...rasters, maskView: null }}
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
