import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "lost-ui/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "lost-ui/ui/tabs";
import { PageHeader } from "@/components/shared/admin/page-header";
import { DesignNameField } from "@/components/shared/design/design-name-field";
import { DesignSaveStatus } from "@/components/shared/design/design-save-status";
import { VideoClipList } from "@/components/shared/video/video-clip-list";
import { VideoExportDialog } from "@/components/shared/video/video-export-dialog";
import { VideoPlayer } from "@/components/shared/video/video-player";
import { VideoPropertiesPanel } from "@/components/shared/video/video-properties-panel";
import { VideoTimeline } from "@/components/shared/video/video-timeline";
import { VideoToolbar } from "@/components/shared/video/video-toolbar";
import { Button } from "@/components/shared/ui/button";
import { useDraftAutosave } from "@/hooks/shared/use-draft-autosave";
import { useIsDesktop } from "@/hooks/shared/video/use-is-desktop";
import { useVideoAdders } from "@/hooks/shared/video/use-video-adders";
import { useVideoEditor } from "@/hooks/shared/video/use-video-editor";
import { useVideoExport } from "@/hooks/shared/video/use-video-export";
import { useVideoPlayback } from "@/hooks/shared/video/use-video-playback";
import { useVideoShortcuts } from "@/hooks/shared/video/use-video-shortcuts";
import { useVideoSources } from "@/hooks/shared/video/use-video-sources";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { readCanvasChrome } from "@/lib/shared/design/browser";
import {
  DESIGN_PRESET_LABEL,
  DESIGN_PRESET_SIZE,
  DesignSaveState,
} from "@/lib/shared/design/types";
import { QueryKey } from "@/lib/shared/query-keys";
import { AppRoute } from "@/lib/shared/routes";
import { canExportInBrowser } from "@/lib/shared/video/probe";
import { previewScale } from "@/lib/shared/video/preview";
import { canSplit, clipRefAt, isTooLarge, projectDuration } from "@/lib/shared/video/timeline";
import { VIDEO_LIMITS, VideoTrack } from "@/lib/shared/video/types";
import {
  type VideoProjectDetail,
  renameVideoProject,
  saveVideoProjectDraft,
  saveVideoProjectVersion,
} from "@/lib/shared/video/video.functions";

const TOO_LARGE = "Este projeto tem clipes demais. Remova alguns para salvar.";
const SPLIT_HINT =
  "Para dividir, coloque o cursor dentro de um clipe, a pelo menos 0,1 s das bordas.";
const PanelTab = { Properties: "properties", Clips: "clips" } as const;

const exportHintOf = (
  supported: boolean | null,
  canUpload: boolean,
  durationMs: number,
): string | null => {
  if (!canUpload) return "Sem permissão para enviar arquivos à biblioteca.";
  if (supported === false) return "Este navegador não exporta vídeo. Use o Chrome ou o Edge.";
  return durationMs === 0 ? "Adicione um clipe para exportar." : null;
};

export function VideoWorkspace({
  project,
  onReload,
}: {
  project: VideoProjectDetail;
  onReload: () => void;
}) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const desktop = useIsDesktop();
  const editable = can(auth, Action.Video.Update) && !project.trashed && desktop === true;
  const canUpload = can(auth, Action.Media.Upload);
  const editor = useVideoEditor(project.document);
  const autosave = useDraftAutosave({
    document: editor.document,
    initialVersion: project.version,
    enabled: editable,
    delayMs: VIDEO_LIMITS.autosaveMs,
    tooLarge: (target) => (isTooLarge(target) ? TOO_LARGE : null),
    save: (target, expectedVersion) =>
      saveVideoProjectDraft({ data: { id: project.id, document: target, expectedVersion } }),
  });
  const size = DESIGN_PRESET_SIZE[project.preset];
  const scale = previewScale(size);
  const durationMs = projectDuration(editor.document);
  const sources = useVideoSources(editor.document);
  const playback = useVideoPlayback({
    document: editor.document,
    preset: project.preset,
    durationMs,
    urls: sources.data,
    scale,
  });
  const [name, setName] = useState(project.name);
  const [zoom, setZoom] = useState<number>(VIDEO_LIMITS.defaultZoom);
  const [exportOpen, setExportOpen] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [textBackground, setTextBackground] = useState<string>(project.document.background);
  const exporter = useVideoExport({
    projectId: project.id,
    projectName: name,
    brandId: project.brandId,
    preset: project.preset,
  });
  const adders = useVideoAdders({ editor, preset: project.preset, playheadMs: playback.clock.get });
  const conflict = autosave.state === DesignSaveState.Conflict;
  const canEdit = editable && !conflict && !exporter.busy;
  const exportHint = exportHintOf(supported, canUpload, durationMs);

  useVideoShortcuts(editor, playback, canEdit);

  useEffect(() => {
    let active = true;
    void canExportInBrowser(size.width, size.height).then((value) => active && setSupported(value));
    const chrome = readCanvasChrome();
    if (chrome !== null) setTextBackground(chrome.ink);
    return () => {
      active = false;
    };
  }, [size.width, size.height]);

  const rename = async (next: string) => {
    const result = await autosave.withVersion((expectedVersion) =>
      renameVideoProject({ data: { id: project.id, name: next, expectedVersion } }),
    );
    if (result === null || !result.ok) return false;
    setName(next);
    void queryClient.invalidateQueries({ queryKey: QueryKey.Video.all() });
    return true;
  };

  const split = () => {
    const timeMs = playback.clock.get();
    const target = editor.selected ?? clipRefAt(editor.document, VideoTrack.Main, timeMs);
    if (target === undefined || !canSplit(editor.document, target, timeMs)) {
      toast.info(SPLIT_HINT);
      return;
    }
    editor.split(target, timeMs);
  };

  const startExport = async () => {
    playback.pause();
    const saved = await autosave.withVersion((expectedVersion) =>
      saveVideoProjectVersion({ data: { id: project.id, expectedVersion } }),
    );
    if (saved === null || !saved.ok) return;
    void queryClient.invalidateQueries({ queryKey: QueryKey.Video.all() });
    await exporter.start(editor.document, durationMs, saved.versionNo);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={name}
        description={`${project.brandName} · ${DESIGN_PRESET_LABEL[project.preset]} · até 90 segundos`}
        breadcrumbs={[{ label: "Vídeos", to: AppRoute.Videos }, { label: name }]}
        actions={editable ? <DesignSaveStatus state={autosave.state} /> : null}
      />
      {project.trashed ? (
        <Alert>
          <AlertDescription>
            Este vídeo está na lixeira e só pode ser visto. Restaure na lista de vídeos para editar.
          </AlertDescription>
        </Alert>
      ) : null}
      {desktop === false && !project.trashed ? (
        <Alert>
          <AlertDescription>
            O editor de vídeo funciona no computador (tela a partir de 1024 px). Aqui você só pode
            assistir ao projeto.
          </AlertDescription>
        </Alert>
      ) : null}
      {conflict ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Este vídeo foi alterado em outra aba ou por outra pessoa. As suas últimas alterações
              continuam na tela, mas não foram salvas.
            </span>
            <Button type="button" variant="outline" size="sm" onClick={onReload}>
              <RefreshCw aria-hidden="true" />
              Recarregar vídeo
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {autosave.state === DesignSaveState.Failed && autosave.message !== null ? (
        <Alert variant="destructive">
          <AlertDescription>{autosave.message}</AlertDescription>
        </Alert>
      ) : null}
      {sources.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            Não foi possível carregar os arquivos dos clipes. Verifique sua conexão e recarregue a
            página.
          </AlertDescription>
        </Alert>
      ) : null}
      {desktop === true ? (
        <>
          <DesignNameField
            name={name}
            disabled={!canEdit}
            onRename={rename}
            label="Nome do vídeo"
            inputId="video-name"
          />
          <VideoToolbar
            editor={editor}
            brandId={project.brandId}
            editable={canEdit}
            adding={adders.busy}
            canSplit={durationMs > 0}
            canExport={canUpload && supported === true && durationMs > 0 && !conflict}
            exportHint={exportHint}
            onAddClips={(items) => void adders.addClips(items)}
            onAddOverlay={(items) => void adders.addOverlay(items)}
            onAddText={adders.addText}
            onAddAudio={(items) => void adders.addAudio(items)}
            onSplit={split}
            onExport={() => setExportOpen(true)}
          />
        </>
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <VideoPlayer
            playback={playback}
            size={size}
            scale={scale}
            durationMs={durationMs}
            label={`Prévia do vídeo ${name}`}
          />
          {canEdit ? (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Espaço reproduz · Setas andam um quadro (Shift: 1 s) ou movem o clipe selecionado · S
              divide · Delete exclui · Ctrl+Z desfaz · Esc limpa a seleção
            </p>
          ) : null}
        </div>
        {desktop === true ? (
          <aside className="w-full shrink-0 rounded-lg border bg-card p-4 lg:w-80">
            <Tabs defaultValue={PanelTab.Properties}>
              <TabsList className="w-full">
                <TabsTrigger value={PanelTab.Properties}>Propriedades</TabsTrigger>
                <TabsTrigger value={PanelTab.Clips}>Clipes</TabsTrigger>
              </TabsList>
              <TabsContent value={PanelTab.Properties} className="mt-4">
                <VideoPropertiesPanel
                  editor={editor}
                  disabled={!canEdit}
                  sourceDurations={playback.sourceDurations}
                  textBackground={textBackground}
                />
              </TabsContent>
              <TabsContent value={PanelTab.Clips} className="mt-4">
                <VideoClipList editor={editor} editable={canEdit} onSeek={playback.seek} />
              </TabsContent>
            </Tabs>
          </aside>
        ) : null}
      </div>
      {desktop === true ? (
        <VideoTimeline
          editor={editor}
          playback={playback}
          durationMs={durationMs}
          editable={canEdit}
          sourceDurations={playback.sourceDurations}
          zoom={zoom}
          onZoom={setZoom}
        />
      ) : null}
      <VideoExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        exporter={exporter}
        durationMs={durationMs}
        onStart={() => void startExport()}
      />
    </div>
  );
}
