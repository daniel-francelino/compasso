import { EmptyState } from "@/components/shared/admin/empty-state";
import { ArrowDown, ArrowUp, Film, FileText, Images, Trash2 } from "lucide-react";
import { useState } from "react";
import { FieldGroup } from "@/components/shared/admin/field-group";
import { FieldMessage } from "@/components/shared/admin/form-fields";
import { MediaPicker } from "@/components/shared/media/media-picker";
import { Button } from "@/components/shared/ui/button";
import { Input } from "@/components/shared/ui/input";
import { Label } from "@/components/shared/ui/label";
import { useSignedUrls } from "@/hooks/shared/use-signed-urls";
import type { FileItem } from "@/lib/marketing/content/types";
import { formatRules } from "@/lib/shared/editorial/editorial";
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

export function FileStrip({
  items,
  onChange,
  brandId,
  format,
  disabled,
  error,
}: {
  items: FileItem[];
  onChange: (items: FileItem[]) => void;
  brandId: string;
  format: ContentFormat;
  disabled: boolean;
  error?: string | undefined;
}) {
  const [picking, setPicking] = useState(false);
  const rule = formatRules[format];
  const urls = useSignedUrls(
    items.map((item) => item.mediaVersionId),
    MediaVariant.Thumb,
  );

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    if (moved === undefined) return;
    next.splice(target, 0, moved);
    onChange(next);
  };

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
        <ol className="space-y-2">
          {items.map((item, index) => (
            <li
              key={item.mediaVersionId}
              className="flex gap-3 rounded-xl border border-border p-2"
            >
              <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                <Thumb item={item} url={urls.data?.[item.mediaVersionId]} />
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
                  onChange={(event) =>
                    onChange(
                      items.map((candidate) =>
                        candidate.mediaVersionId === item.mediaVersionId
                          ? { ...candidate, altText: event.target.value }
                          : candidate,
                      ),
                    )
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label={`Mover ${item.name} para cima`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label={`Mover ${item.name} para baixo`}
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label={`Remover ${item.name}`}
                  onClick={() =>
                    onChange(
                      items.filter((candidate) => candidate.mediaVersionId !== item.mediaVersionId),
                    )
                  }
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
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
