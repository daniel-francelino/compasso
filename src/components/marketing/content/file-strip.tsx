import { EmptyState } from "@/components/shared/admin/empty-state";
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { Film, FileText, GripVertical, Images, Trash2 } from "lucide-react";
import { useState } from "react";
import { FieldGroup } from "@/components/shared/admin/field-group";
import { FieldMessage } from "@/components/shared/admin/form-fields";
import { MediaPicker } from "@/components/shared/media/media-picker";
import { Button } from "@/components/shared/ui/button";
import { Input } from "@/components/shared/ui/input";
import { Label } from "@/components/shared/ui/label";
import { useSignedUrls } from "@/hooks/shared/use-signed-urls";
import type { FileItem } from "@/lib/marketing/content/types";
import { combinedRule } from "@/lib/shared/editorial/editorial";
import { type ContentFormat, MediaScope } from "@/lib/shared/enums";
import { MediaKind } from "@/lib/shared/media/limits";
import { MediaVariant } from "@/lib/shared/media/schemas";

function Thumb({ item, url }: { item: FileItem; url: string | undefined }) {
  if (url !== undefined && item.kind !== MediaKind.Video) {
    return <img src={url} alt="" className="size-full object-cover" />;
  }
  const Icon = item.kind === MediaKind.Video ? Film : FileText;
  return <Icon className="size-6 text-muted-foreground" aria-hidden="true" />;
}

function SortableMediaItem({
  item,
  index,
  url,
  disabled,
  onAltTextChange,
  onRemove,
}: {
  item: FileItem;
  index: number;
  url: string | undefined;
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
    <li
      ref={ref}
      className={
        "flex gap-3 rounded-xl border border-border bg-card p-2 " +
        (isDragging ? "z-10 opacity-70 shadow-lg " : "") +
        (isDropping ? "transition-shadow " : "") +
        (isDropTarget ? "ring-2 ring-primary/40 " : "")
      }
    >
      <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
        <Thumb item={item} url={url} />
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
          aria-label={`Remover ${item.name}`}
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
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
}: {
  items: FileItem[];
  onChange: (items: FileItem[]) => void;
  brandId: string;
  formats: readonly ContentFormat[];
  disabled: boolean;
  error?: string | undefined;
}) {
  const [picking, setPicking] = useState(false);
  const rule = combinedRule(formats);
  const urls = useSignedUrls(
    items.map((item) => item.mediaVersionId),
    MediaVariant.Thumb,
  );

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

  return (
    <FieldGroup legend={`Arquivos (${items.length}/${rule.max})`} gap="sm" disabled={disabled}>
      {items.length === 0 ? (
        <EmptyState
          compact
          icon={Images}
          title="Nenhum arquivo"
          description="Anexe imagens ou vídeos da biblioteca."
        />
      ) : (
        <DragDropProvider onDragEnd={handleDragEnd}>
          <ol className="space-y-2">
            {items.map((item, index) => (
              <SortableMediaItem
                key={item.mediaVersionId}
                item={item}
                index={index}
                url={urls.data?.[item.mediaVersionId]}
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
                    items.filter((candidate) => candidate.mediaVersionId !== item.mediaVersionId),
                  )
                }
              />
            ))}
          </ol>
        </DragDropProvider>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={items.length >= rule.max}
        onClick={() => setPicking(true)}
      >
        <Images aria-hidden="true" />
        Adicionar da biblioteca
      </Button>
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
  );
}
