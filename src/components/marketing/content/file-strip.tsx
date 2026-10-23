import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { FileText, Film, GripVertical, Loader2, Trash2 } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { FieldGroup } from "@/components/shared/admin/field-group";
import { FieldMessage } from "@/components/shared/admin/form-fields";
import { FileDropzone } from "@/components/shared/media/file-dropzone";
import { MediaPicker } from "@/components/shared/media/media-picker";
import { Button } from "@/components/shared/ui/button";
import { Input } from "@/components/shared/ui/input";
import { Label } from "@/components/shared/ui/label";
import { Progress } from "@/components/shared/ui/progress";
import { UploadStatus, rejectionFor } from "@/hooks/shared/use-media-upload";
import { useSignedUrls } from "@/hooks/shared/use-signed-urls";
import { type UploadedFile, useUploadTray } from "@/hooks/shared/use-upload-tray";
import type { FileItem } from "@/lib/marketing/content/types";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { combinedRule } from "@/lib/shared/editorial/editorial";
import { type ContentFormat, MediaScope } from "@/lib/shared/enums";
import { MediaKind, kindOfMime } from "@/lib/shared/media/limits";
import { MediaVariant } from "@/lib/shared/media/schemas";
import { cn } from "@/lib/shared/utils";

const kindLabels: Record<MediaKind, string> = {
  [MediaKind.Image]: "imagens",
  [MediaKind.Video]: "vídeos",
  [MediaKind.Document]: "PDFs",
};

const itemMotion = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: { duration: 0.2 },
};

function Thumb({
  item,
  url,
  loading,
}: {
  item: FileItem;
  url: string | undefined;
  loading: boolean;
}) {
  if (url !== undefined && item.kind !== MediaKind.Video) {
    return (
      <motion.img
        src={url}
        alt=""
        className="size-full object-cover"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      />
    );
  }
  const Icon = item.kind === MediaKind.Video ? Film : FileText;
  return (
    <Icon
      className={cn("size-6 text-muted-foreground", loading && "animate-pulse")}
      aria-hidden="true"
    />
  );
}

function SortableMediaItem({
  item,
  index,
  url,
  loading,
  disabled,
  onAltTextChange,
  onRemove,
}: {
  item: FileItem;
  index: number;
  url: string | undefined;
  loading: boolean;
  disabled: boolean;
  onAltTextChange: (altText: string) => void;
  onRemove: () => void;
}) {
  const { ref, handleRef, isDragging, isDropping, isDropTarget } = useSortable({
    id: item.mediaVersionId,
    index,
    disabled,
    transition: { duration: 220, easing: "cubic-bezier(0.2, 0, 0, 1)", idle: true },
  });

  return (
    <motion.li layout="position" {...itemMotion}>
      <div
        ref={ref}
        className={cn(
          "flex gap-3 rounded-xl border border-border bg-card p-2 transition-[border-color,box-shadow] duration-200 hover:border-primary/40 hover:shadow-sm",
          isDragging && "z-10 opacity-70 shadow-lg",
          isDropping && "transition-shadow",
          isDropTarget && "ring-2 ring-primary/40",
        )}
      >
        <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
          <Thumb item={item} url={url} loading={loading} />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="truncate text-sm font-medium">
            {index + 1}. {item.name}
          </p>
          <Label htmlFor={`alt-${item.mediaVersionId}`} className="sr-only">
            Texto alternativo de {item.name}
          </Label>
          <Input
            id={`alt-${item.mediaVersionId}`}
            value={item.altText}
            maxLength={300}
            placeholder="Texto alternativo (descreva a imagem)"
            disabled={disabled}
            onChange={(event) => onAltTextChange(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Button
            ref={handleRef}
            type="button"
            variant="ghost"
            size="icon"
            className="cursor-grab touch-none active:cursor-grabbing"
            aria-label={`Reordenar ${item.name}`}
            disabled={disabled}
          >
            <GripVertical aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hover:text-destructive"
            aria-label={`Remover ${item.name}`}
            disabled={disabled}
            onClick={onRemove}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
    </motion.li>
  );
}

function PendingItem({
  name,
  progress,
  queued,
}: {
  name: string;
  progress: number;
  queued: boolean;
}) {
  const percent = Math.round(progress * 100);
  return (
    <motion.li {...itemMotion}>
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-primary/40 bg-accent/40 p-2">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="truncate text-sm font-medium">{name}</p>
          {queued ? null : (
            <Progress value={percent} className="h-1.5" aria-label={`Enviando ${name}`} />
          )}
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {queued ? "Na fila" : `Enviando… ${percent}%`}
          </p>
        </div>
      </div>
    </motion.li>
  );
}

export function FileStrip({
  items,
  onChange,
  brandId,
  formats,
  disabled,
  error,
  maxItems,
}: {
  items: FileItem[];
  onChange: (items: FileItem[]) => void;
  brandId: string;
  formats: readonly ContentFormat[];
  disabled: boolean;
  error?: string | undefined;
  maxItems?: number;
}) {
  const owner = useId();
  const auth = useAuth();
  const tray = useUploadTray();
  const [picking, setPicking] = useState(false);
  const itemsRef = useRef(items);
  const mounted = useRef(true);
  const formatRule = combinedRule(formats);
  const rule = maxItems === undefined ? formatRule : { ...formatRule, max: maxItems };
  const urls = useSignedUrls(
    items.map((item) => item.mediaVersionId),
    MediaVariant.Thumb,
  );
  const pending = tray.tasks.filter(
    (task) =>
      task.owner === owner &&
      (task.item.status === UploadStatus.Queued || task.item.status === UploadStatus.Uploading),
  );
  const slots = rule.max - items.length - pending.length;
  const canUpload = can(auth, Action.Media.Upload) && brandId !== "";

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const move = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    if (moved === undefined) return;
    next.splice(toIndex, 0, moved);
    onChange(next);
  };

  function handleDragEnd(event: DragEndEvent) {
    if (event.canceled || !isSortable(event.operation.source)) return;
    const { initialIndex, index } = event.operation.source;
    move(initialIndex, index);
  }

  const attach = (uploaded: UploadedFile) => {
    if (!mounted.current) {
      toast.info(`"${uploaded.name}" foi para a biblioteca, mas não foi anexado a este conteúdo.`);
      return;
    }
    const current = itemsRef.current;
    if (current.some((item) => item.mediaVersionId === uploaded.versionId)) return;
    if (current.length >= rule.max) {
      toast.error(
        `"${uploaded.name}" foi para a biblioteca, mas o limite de arquivos foi atingido.`,
      );
      return;
    }
    const next = [
      ...current,
      { mediaVersionId: uploaded.versionId, altText: "", name: uploaded.name, kind: uploaded.kind },
    ];
    itemsRef.current = next;
    onChange(next);
  };

  const receive = (files: File[]) => {
    const wrongKind = files.filter((file) => {
      const kind = kindOfMime(file.type);
      return kind !== null && !rule.kinds.includes(kind);
    });
    if (wrongKind.length > 0) {
      toast.error(
        `${wrongKind.map((file) => file.name).join(", ")}: tipo não aceito neste formato.`,
      );
    }
    const candidates = files.filter((file) => !wrongKind.includes(file));
    const valid = candidates.filter((file) => rejectionFor(file) === null);
    const invalid = candidates.filter((file) => rejectionFor(file) !== null);
    const allowed = valid.slice(0, Math.max(0, slots));
    if (allowed.length < valid.length) {
      toast.error(`Este formato aceita até ${rule.max} arquivos.`);
    }
    if (allowed.length + invalid.length === 0) return;
    tray.enqueue({
      owner,
      files: [...allowed, ...invalid],
      target: { scope: MediaScope.Brand, brandId },
      onUploaded: attach,
    });
  };

  const hint = `${rule.kinds.map((kind) => kindLabels[kind]).join(", ")} · até ${rule.max} ${
    rule.max === 1 ? "arquivo" : "arquivos"
  }`;

  return (
    <MotionConfig reducedMotion="user">
      <FieldGroup legend={`Arquivos (${items.length}/${rule.max})`} gap="sm" disabled={disabled}>
        {items.length + pending.length > 0 ? (
          <DragDropProvider onDragEnd={handleDragEnd}>
            <ol className="space-y-2">
              <AnimatePresence initial={false}>
                {items.map((item, index) => (
                  <SortableMediaItem
                    key={item.mediaVersionId}
                    item={item}
                    index={index}
                    url={urls.data?.[item.mediaVersionId]}
                    loading={urls.isLoading}
                    disabled={disabled}
                    onAltTextChange={(altText) =>
                      onChange(
                        items.map((candidate) =>
                          candidate.mediaVersionId === item.mediaVersionId
                            ? { ...candidate, altText }
                            : candidate,
                        ),
                      )
                    }
                    onRemove={() =>
                      onChange(
                        items.filter(
                          (candidate) => candidate.mediaVersionId !== item.mediaVersionId,
                        ),
                      )
                    }
                  />
                ))}
                {pending.map((task) => (
                  <PendingItem
                    key={task.id}
                    name={task.item.file.name}
                    progress={task.progress}
                    queued={task.item.status === UploadStatus.Queued}
                  />
                ))}
              </AnimatePresence>
            </ol>
          </DragDropProvider>
        ) : null}
        <FileDropzone
          kinds={rule.kinds}
          compact={items.length + pending.length > 0}
          disabled={disabled}
          full={slots <= 0}
          canUpload={canUpload}
          hint={hint}
          onFiles={receive}
          onLibrary={() => setPicking(true)}
        />
        <FieldMessage error={error} />
        <MediaPicker
          open={picking}
          onOpenChange={setPicking}
          scope={MediaScope.Brand}
          brandId={brandId}
          kinds={rule.kinds}
          max={Math.max(1, rule.max - items.length)}
          onConfirm={(picked) =>
            onChange([
              ...items,
              ...picked
                .filter((file) => !items.some((item) => item.mediaVersionId === file.versionId))
                .map((file) => ({
                  mediaVersionId: file.versionId,
                  altText: "",
                  name: file.name,
                  kind: file.kind,
                })),
            ])
          }
        />
      </FieldGroup>
    </MotionConfig>
  );
}
