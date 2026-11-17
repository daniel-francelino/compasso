import { Download, Film, Image, Music, Redo2, Scissors, Trash2, Type, Undo2 } from "lucide-react";
import { useState } from "react";
import { MediaPicker, type PickedMedia } from "@/components/shared/media/media-picker";
import { Button } from "@/components/shared/ui/button";
import type { VideoEditor } from "@/hooks/shared/video/use-video-editor";
import { MediaScope } from "@/lib/shared/enums";
import { MediaKind } from "@/lib/shared/media/limits";

const CLIP_KINDS = [MediaKind.Video, MediaKind.Image] as const;
const IMAGE_KINDS = [MediaKind.Image] as const;
const VIDEO_KINDS = [MediaKind.Video] as const;
const MAX_CLIPS_AT_ONCE = 10;

const Picker = {
  Clips: "clips",
  Overlay: "overlay",
  Audio: "audio",
} as const;
type Picker = (typeof Picker)[keyof typeof Picker];

export function VideoToolbar({
  editor,
  brandId,
  editable,
  adding,
  canSplit,
  canExport,
  exportHint,
  onAddClips,
  onAddOverlay,
  onAddText,
  onAddAudio,
  onSplit,
  onExport,
}: {
  editor: VideoEditor;
  brandId: string;
  editable: boolean;
  adding: boolean;
  canSplit: boolean;
  canExport: boolean;
  exportHint: string | null;
  onAddClips: (items: PickedMedia[]) => void;
  onAddOverlay: (items: PickedMedia[]) => void;
  onAddText: () => void;
  onAddAudio: (items: PickedMedia[]) => void;
  onSplit: () => void;
  onExport: () => void;
}) {
  const [picker, setPicker] = useState<Picker | null>(null);
  const disabled = !editable || adding;

  const confirm = (items: PickedMedia[]) => {
    if (picker === Picker.Clips) onAddClips(items);
    if (picker === Picker.Overlay) onAddOverlay(items);
    if (picker === Picker.Audio) onAddAudio(items);
    setPicker(null);
  };

  return (
    <div
      role="toolbar"
      aria-label="Ferramentas do vídeo"
      className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        loading={adding}
        onClick={() => setPicker(Picker.Clips)}
      >
        <Film aria-hidden="true" />
        Clipe
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setPicker(Picker.Overlay)}
      >
        <Image aria-hidden="true" />
        Imagem
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onAddText}>
        <Type aria-hidden="true" />
        Texto
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setPicker(Picker.Audio)}
      >
        <Music aria-hidden="true" />
        Música
      </Button>
      <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled || !canSplit}
        onClick={onSplit}
        aria-keyshortcuts="S"
      >
        <Scissors aria-hidden="true" />
        Dividir
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled || editor.selected === null}
        onClick={() => editor.selected !== null && editor.remove(editor.selected)}
        aria-keyshortcuts="Delete"
      >
        <Trash2 aria-hidden="true" />
        Excluir
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={!editable || !editor.canUndo}
        onClick={editor.undo}
        aria-label="Desfazer"
        aria-keyshortcuts="Control+Z"
      >
        <Undo2 aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={!editable || !editor.canRedo}
        onClick={editor.redo}
        aria-label="Refazer"
        aria-keyshortcuts="Control+Shift+Z"
      >
        <Redo2 aria-hidden="true" />
      </Button>
      <div className="ml-auto flex items-center gap-2">
        {exportHint === null ? null : (
          <span className="text-xs text-muted-foreground">{exportHint}</span>
        )}
        <Button type="button" size="sm" disabled={!canExport} onClick={onExport}>
          <Download aria-hidden="true" />
          Exportar
        </Button>
      </div>
      <MediaPicker
        open={picker !== null}
        onOpenChange={(open) => !open && setPicker(null)}
        scope={MediaScope.Brand}
        brandId={brandId}
        kinds={
          picker === Picker.Clips ? CLIP_KINDS : picker === Picker.Audio ? VIDEO_KINDS : IMAGE_KINDS
        }
        max={picker === Picker.Clips ? MAX_CLIPS_AT_ONCE : 1}
        onConfirm={confirm}
      />
    </div>
  );
}
