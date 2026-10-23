import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Film,
  Image,
  Images,
  Loader2,
  MoreVertical,
  Plus,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { FieldGroup } from "@/components/shared/admin/field-group";
import { FieldMessage } from "@/components/shared/admin/form-fields";
import { FileDropzone } from "@/components/shared/media/file-dropzone";
import { MediaPicker } from "@/components/shared/media/media-picker";
import { Button } from "@/components/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/shared/ui/dropdown-menu";
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

const kindIcons: Record<MediaKind, LucideIcon> = {
  [MediaKind.Image]: Image,
  [MediaKind.Video]: Film,
  [MediaKind.Document]: FileText,
};

const itemMotion = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.94 },
  transition: { duration: 0.18 },
};

const cardClass =
  "rounded-xl border border-border bg-card p-2 transition-[border-color,box-shadow] duration-200";

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
        draggable={false}
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
      className={cn("size-8 text-muted-foreground", loading && "animate-pulse")}
      aria-hidden="true"
    />
  );
}

function SortableMediaItem({
  item,
  index,
  total,
  url,
  loading,
  disabled,
  onMove,
  onRemove,
}: {
  item: FileItem;
  index: number;
  total: number;
  url: string | undefined;
  loading: boolean;
  disabled: boolean;
  onMove: (toIndex: number) => void;
  onRemove: () => void;
}) {
  const { ref, handleRef, isDragging, isDropping, isDropTarget } = useSortable({
    id: item.mediaVersionId,
    index,
    disabled,
    transition: { duration: 220, easing: "cubic-bezier(0.2, 0, 0, 1)", idle: true },
  });
  const KindIcon = item.kind === null ? FileText : kindIcons[item.kind];

  return (
    <li ref={ref}>
      <motion.div {...itemMotion}>
        <div
          className={cn(
            cardClass,
            "relative hover:border-primary/40 hover:shadow-sm",
            isDragging && "z-10 opacity-70 shadow-lg",
            isDropping && "transition-shadow",
            isDropTarget && "ring-2 ring-primary/40",
          )}
        >
          <div
            ref={handleRef}
            className={cn(!disabled && "cursor-grab touch-none active:cursor-grabbing")}
          >
            <div className="flex items-center gap-2 pr-9 pb-2 pl-1">
              <KindIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="min-w-0 flex-1 truncate text-sm font-medium" title={item.name}>
                {item.name}
              </p>
            </div>
            <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-muted">
              <Thumb item={item} url={url} loading={loading} />
              <span className="absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded-full bg-foreground/80 text-[0.625rem] font-medium text-background">
                {index + 1}
              </span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1.5 right-1.5 size-8"
                disabled={disabled}
                aria-label={`Ações de ${item.name}`}
              >
                <MoreVertical aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(index - 1)}>
                <ArrowLeft aria-hidden="true" />
                Mover para antes
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index === total - 1} onSelect={() => onMove(index + 1)}>
                <ArrowRight aria-hidden="true" />
                Mover para depois
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={onRemove}
              >
                <Trash2 aria-hidden="true" />
                Remover
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>
    </li>
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
      <div className={cn(cardClass, "border-dashed border-primary/40 bg-accent/40")}>
        <p className="truncate pb-2 pl-1 text-sm font-medium" title={name}>
          {name}
        </p>
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg bg-muted px-4">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
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

function AddTile({
  disabled,
  hint,
  onClick,
}: {
  disabled: boolean;
  hint: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="flex h-full min-h-40 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-background p-3 text-center transition-colors hover:border-primary/60 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-muted text-primary">
          <Plus className="size-4" aria-hidden="true" />
        </span>
        <span className="text-sm font-medium">Adicionar arquivos</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </button>
    </li>
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
  label = "Arquivos",
}: {
  items: FileItem[];
  onChange: (items: FileItem[]) => void;
  brandId: string;
  formats: readonly ContentFormat[];
  disabled: boolean;
  error?: string | undefined;
  maxItems?: number;
  label?: string;
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

  const total = items.length + pending.length;

  const grid = (openPicker: () => void) => (
    <DragDropProvider onDragEnd={handleDragEnd}>
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
        <AnimatePresence initial={false}>
          {items.map((item, index) => (
            <SortableMediaItem
              key={item.mediaVersionId}
              item={item}
              index={index}
              total={items.length}
              url={urls.data?.[item.mediaVersionId]}
              loading={urls.isLoading}
              disabled={disabled}
              onMove={(toIndex) => move(index, toIndex)}
              onRemove={() =>
                onChange(
                  items.filter((candidate) => candidate.mediaVersionId !== item.mediaVersionId),
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
        {canUpload && slots > 0 ? (
          <AddTile disabled={disabled} hint={hint} onClick={openPicker} />
        ) : null}
      </ol>
    </DragDropProvider>
  );

  return (
    <MotionConfig reducedMotion="user">
      <FieldGroup legend={label} hideLegend gap="sm" disabled={disabled}>
        <div className="flex items-center justify-between gap-2">
          <span aria-hidden="true" className="text-sm font-medium text-foreground">
            {label}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || slots <= 0}
            onClick={() => setPicking(true)}
          >
            <Images aria-hidden="true" />
            Adicionar da biblioteca
          </Button>
        </div>
        {canUpload ? (
          <FileDropzone
            kinds={rule.kinds}
            empty={total === 0}
            disabled={disabled}
            full={slots <= 0}
            hint={hint}
            onFiles={receive}
          >
            {grid}
          </FileDropzone>
        ) : total > 0 ? (
          grid(() => undefined)
        ) : null}
        <FieldMessage
          error={error}
          hint={`${items.length}/${rule.max} ${rule.max === 1 ? "arquivo" : "arquivos"}`}
        />
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
