import { useState } from "react";
import { TextField } from "@/components/shared/admin/form-fields";
import { MediaPicker } from "@/components/shared/media/media-picker";
import { Button } from "@/components/shared/ui/button";
import { Checkbox } from "@/components/shared/ui/checkbox";
import { Label } from "@/components/shared/ui/label";
import { useSignedUrls } from "@/hooks/shared/use-signed-urls";
import type { SiteImage } from "@/lib/shared/content/schemas";
import { MediaScope } from "@/lib/shared/enums";
import { MediaKind } from "@/lib/shared/media/limits";
import { MediaVariant } from "@/lib/shared/media/schemas";

const IMAGE_ONLY = [MediaKind.Image] as const;

export function ImageField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: SiteImage;
  onChange: (value: SiteImage) => void;
}) {
  const [picking, setPicking] = useState(false);
  const urls = useSignedUrls(
    value.mediaVersionId ? [value.mediaVersionId] : [],
    MediaVariant.Thumb,
  );
  const preview = value.mediaVersionId ? urls.data?.[value.mediaVersionId] : undefined;

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap items-center gap-3">
        {preview ? (
          <img
            src={preview}
            alt=""
            className="size-16 rounded-md border border-border object-cover"
          />
        ) : null}
        <Button type="button" variant="outline" onClick={() => setPicking(true)}>
          {value.mediaVersionId ? "Trocar imagem" : "Escolher da biblioteca"}
        </Button>
        {value.mediaVersionId ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange({ mediaVersionId: null, alt: "", decorative: false })}
          >
            Remover
          </Button>
        ) : null}
      </div>
      {value.mediaVersionId ? (
        <>
          <TextField
            id={`${id}-alt`}
            label="Texto alternativo"
            value={value.alt}
            onValueChange={(alt) => onChange({ ...value, alt })}
            maxLength={300}
            disabled={value.decorative}
            hint="Descreva a imagem para quem não a vê."
          />
          <div className="flex items-center gap-2">
            <Checkbox
              id={`${id}-decorative`}
              checked={value.decorative}
              onCheckedChange={(checked) => onChange({ ...value, decorative: checked === true })}
            />
            <Label htmlFor={`${id}-decorative`} className="font-normal">
              Imagem decorativa (sem texto alternativo)
            </Label>
          </div>
        </>
      ) : null}
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        scope={MediaScope.Site}
        kinds={IMAGE_ONLY}
        max={1}
        onConfirm={(picked) => {
          const first = picked[0];
          if (first) onChange({ ...value, mediaVersionId: first.versionId });
        }}
      />
    </div>
  );
}
