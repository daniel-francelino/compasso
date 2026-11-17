import { FormColorPicker } from "lost-ui/forms/form-color-picker";
import { FormInputNumber } from "lost-ui/forms/form-input-number";
import { FormSelect } from "lost-ui/forms/form-select";
import { FormSlider } from "lost-ui/forms/form-slider";
import { VideoTextProperties } from "@/components/shared/video/video-text-properties";
import { VideoTimingFields } from "@/components/shared/video/video-timing-fields";
import type { VideoEditor } from "@/hooks/shared/video/use-video-editor";
import { inRange, normalizeColor } from "@/lib/shared/design/document";
import type { AudioClip, MainClip, OverlayClip } from "@/lib/shared/video/schemas";
import { findTimed } from "@/lib/shared/video/timeline";
import {
  VIDEO_FIT_LABEL,
  VIDEO_LIMITS,
  VIDEO_TRACK_LABEL,
  VideoClipKind,
  VideoFit,
  VideoTrack,
} from "@/lib/shared/video/types";

const PERCENT = 100;
const first = (value: number | number[]) => (Array.isArray(value) ? (value[0] ?? 0) : value);
const fitItems = Object.values(VideoFit).map((fit) => ({
  value: fit,
  label: VIDEO_FIT_LABEL[fit],
}));
const asFit = (value: string) => fitItems.find((item) => item.value === value)?.value;

function PercentSlider({
  name,
  label,
  value,
  disabled,
  onChange,
}: {
  name: string;
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <FormSlider
      name={name}
      label={label}
      value={Math.round(value * PERCENT)}
      min={0}
      max={PERCENT}
      step={1}
      showValue
      disabled={disabled}
      onValueChange={(next) => onChange(first(next) / PERCENT)}
    />
  );
}

function FadeField({
  name,
  label,
  value,
  max,
  disabled,
  onChange,
}: {
  name: string;
  label: string;
  value: number;
  max: number;
  disabled: boolean;
  onChange: (ms: number) => void;
}) {
  return (
    <FormInputNumber
      name={name}
      label={label}
      value={Math.round(value / 100) / 10}
      min={0}
      max={max / 1000}
      step={0.1}
      disabled={disabled}
      onValueChange={(seconds) => {
        if (inRange(seconds, 0, max / 1000)) onChange(Math.round(seconds * 1000));
      }}
    />
  );
}

function MainProperties({ clip, editor, disabled }: PropsOf<MainClip>) {
  return (
    <>
      <FormSelect
        name="fit"
        label="Enquadramento"
        value={clip.fit}
        items={fitItems}
        disabled={disabled}
        hint="Preencher corta as bordas; Ajustar mostra tudo sobre a cor de fundo."
        onValueChange={(value) => {
          const fit = asFit(value);
          if (fit !== undefined) editor.patchMain(clip.id, { fit });
        }}
      />
      {clip.kind === VideoClipKind.Video ? (
        <PercentSlider
          name="volume"
          label="Volume"
          value={clip.volume}
          disabled={disabled}
          onChange={(volume) => editor.patchMain(clip.id, { volume }, `volume:${clip.id}`)}
        />
      ) : null}
    </>
  );
}

function OverlayProperties({ clip, editor, disabled }: PropsOf<OverlayClip>) {
  const patch = (value: Partial<OverlayClip>, field: string) =>
    editor.patchOverlay(clip.id, value, `${field}:${clip.id}`);
  const fields = [
    { key: "x", label: "X", min: -VIDEO_LIMITS.maxCoordinate, max: VIDEO_LIMITS.maxCoordinate },
    { key: "y", label: "Y", min: -VIDEO_LIMITS.maxCoordinate, max: VIDEO_LIMITS.maxCoordinate },
    { key: "width", label: "Largura", min: VIDEO_LIMITS.minSize, max: VIDEO_LIMITS.maxSize },
    { key: "height", label: "Altura", min: VIDEO_LIMITS.minSize, max: VIDEO_LIMITS.maxSize },
  ] as const;
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {fields.map((field) => (
          <FormInputNumber
            key={field.key}
            name={`overlay-${field.key}`}
            label={field.label}
            value={Math.round(clip[field.key])}
            min={field.min}
            max={field.max}
            showControls={false}
            disabled={disabled}
            onValueChange={(value) => {
              if (inRange(value, field.min, field.max)) patch({ [field.key]: value }, field.key);
            }}
          />
        ))}
      </div>
      <PercentSlider
        name="opacity"
        label="Opacidade"
        value={clip.opacity}
        disabled={disabled}
        onChange={(opacity) => patch({ opacity }, "opacity")}
      />
    </>
  );
}

function AudioProperties({ clip, editor, disabled }: PropsOf<AudioClip>) {
  const patch = (value: Partial<AudioClip>, field: string) =>
    editor.patchAudio(clip.id, value, `${field}:${clip.id}`);
  return (
    <>
      <PercentSlider
        name="audioVolume"
        label="Volume"
        value={clip.volume}
        disabled={disabled}
        onChange={(volume) => patch({ volume }, "volume")}
      />
      <div className="grid grid-cols-2 gap-2">
        <FadeField
          name="audioFadeIn"
          label="Aparecer (s)"
          value={clip.fadeInMs}
          max={VIDEO_LIMITS.maxAudioFadeMs}
          disabled={disabled}
          onChange={(fadeInMs) => patch({ fadeInMs }, "fadeIn")}
        />
        <FadeField
          name="audioFadeOut"
          label="Desaparecer (s)"
          value={clip.fadeOutMs}
          max={VIDEO_LIMITS.maxAudioFadeMs}
          disabled={disabled}
          onChange={(fadeOutMs) => patch({ fadeOutMs }, "fadeOut")}
        />
      </div>
    </>
  );
}

type PropsOf<T> = { clip: T; editor: VideoEditor; disabled: boolean };

function ProjectProperties({ editor, disabled }: { editor: VideoEditor; disabled: boolean }) {
  const { document } = editor;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Nada selecionado. Escolha um clipe na linha do tempo ou na aba Clipes.
      </p>
      <FormColorPicker
        name="projectBackground"
        label="Cor de fundo"
        value={document.background}
        disabled={disabled}
        hint="Aparece atrás de clipes ajustados e nas transições de entrada e saída."
        onValueChange={(value) => {
          const background = normalizeColor(value);
          if (background !== null) editor.patchProject({ background }, "background");
        }}
      />
      <div className="grid grid-cols-2 gap-2">
        <FadeField
          name="projectFadeIn"
          label="Aparecer (s)"
          value={document.fadeInMs}
          max={VIDEO_LIMITS.maxProjectFadeMs}
          disabled={disabled}
          onChange={(fadeInMs) => editor.patchProject({ fadeInMs }, "fadeIn")}
        />
        <FadeField
          name="projectFadeOut"
          label="Desaparecer (s)"
          value={document.fadeOutMs}
          max={VIDEO_LIMITS.maxProjectFadeMs}
          disabled={disabled}
          onChange={(fadeOutMs) => editor.patchProject({ fadeOutMs }, "fadeOut")}
        />
      </div>
    </div>
  );
}

export function VideoPropertiesPanel({
  editor,
  disabled,
  sourceDurations,
  textBackground,
}: {
  editor: VideoEditor;
  disabled: boolean;
  sourceDurations: ReadonlyMap<string, number>;
  textBackground: string;
}) {
  const ref = editor.selected;
  const timed = ref === null ? undefined : findTimed(editor.document, ref);
  if (ref === null || timed === undefined) {
    return <ProjectProperties editor={editor} disabled={disabled} />;
  }
  const main = editor.document.main.find((clip) => clip.id === ref.id);
  const overlay = editor.document.overlays.find((clip) => clip.id === ref.id);
  const text = editor.document.texts.find((clip) => clip.id === ref.id);
  const audio = editor.document.audio.find((clip) => clip.id === ref.id);
  const mediaId = main?.mediaVersionId ?? audio?.mediaVersionId;
  const sourceIn =
    main?.kind === VideoClipKind.Video ? main.sourceInMs : (audio?.sourceInMs ?? null);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{VIDEO_TRACK_LABEL[ref.track]}</h3>
      <VideoTimingFields
        clip={timed}
        sourceInMs={sourceIn}
        sourceDurationMs={
          mediaId === undefined || main?.kind === VideoClipKind.Image
            ? null
            : (sourceDurations.get(mediaId) ?? null)
        }
        editor={editor}
        disabled={disabled}
      />
      {ref.track === VideoTrack.Main && main !== undefined ? (
        <MainProperties clip={main} editor={editor} disabled={disabled} />
      ) : null}
      {overlay === undefined ? null : (
        <OverlayProperties clip={overlay} editor={editor} disabled={disabled} />
      )}
      {text === undefined ? null : (
        <VideoTextProperties
          clip={text}
          editor={editor}
          disabled={disabled}
          defaultBackground={textBackground}
        />
      )}
      {audio === undefined ? null : (
        <AudioProperties clip={audio} editor={editor} disabled={disabled} />
      )}
    </div>
  );
}
