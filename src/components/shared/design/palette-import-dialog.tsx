import { useState } from "react";
import { BRAND_COLOR_LIMIT } from "@/lib/shared/design/brand-colors.functions";
import { Button } from "@/components/shared/ui/button";
import { Checkbox } from "@/components/shared/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog";
import { Label } from "@/components/shared/ui/label";
import { PALETTE_COPY, describeImportNotes } from "@/lib/shared/design/import/messages";
import type { ImportPalette, ImportSwatch } from "@/lib/shared/design/import/types";

function PaletteBody({
  palette,
  existing,
  canEdit,
  saving,
  onApply,
  onClose,
}: {
  palette: ImportPalette;
  existing: readonly string[];
  canEdit: boolean;
  saving: boolean;
  onApply: (swatches: readonly ImportSwatch[]) => void;
  onClose: () => void;
}) {
  const free = Math.max(0, BRAND_COLOR_LIMIT - existing.length);
  const candidates = palette.swatches.filter((swatch) => !existing.includes(swatch.hex));
  const [selected, setSelected] = useState<readonly string[]>(
    candidates.slice(0, free).map((swatch) => swatch.hex),
  );
  const toggle = (hex: string, on: boolean): void =>
    setSelected((current) =>
      on && current.length < free ? [...current, hex] : current.filter((value) => value !== hex),
    );
  const chosen = candidates.filter((swatch) => selected.includes(swatch.hex));
  const notes = describeImportNotes(palette.notes);
  return (
    <>
      <DialogHeader>
        <DialogTitle>{PALETTE_COPY.title}</DialogTitle>
        <DialogDescription>
          {free === 0 ? PALETTE_COPY.brandFull : PALETTE_COPY.slots(free)}
        </DialogDescription>
      </DialogHeader>
      <h3 className="text-sm font-medium">{PALETTE_COPY.heading}</h3>
      {notes === "" ? null : <p className="text-xs text-muted-foreground">{notes}</p>}
      <ul className="grid max-h-72 gap-2 overflow-y-auto">
        {candidates.map((swatch) => (
          <li key={swatch.hex} className="flex items-center gap-2">
            <Checkbox
              id={`palette-${swatch.hex}`}
              checked={selected.includes(swatch.hex)}
              disabled={!canEdit || free === 0}
              onCheckedChange={(on) => toggle(swatch.hex, on === true)}
            />
            <span
              aria-hidden="true"
              className="size-5 shrink-0 rounded border"
              style={{ backgroundColor: swatch.hex }}
            />
            <Label htmlFor={`palette-${swatch.hex}`} className="cursor-pointer">
              {swatch.name}
              <span className="ml-2 font-mono text-xs text-muted-foreground">{swatch.hex}</span>
            </Label>
          </li>
        ))}
      </ul>
      {canEdit ? null : (
        <p className="text-xs text-muted-foreground">{PALETTE_COPY.permissionReason}</p>
      )}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          {PALETTE_COPY.cancelLabel}
        </Button>
        <Button
          type="button"
          disabled={!canEdit || saving || chosen.length === 0}
          onClick={() => onApply(chosen)}
        >
          {PALETTE_COPY.confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}

export function PaletteImportDialog({
  palette,
  existing,
  canEdit,
  saving,
  onApply,
  onClose,
}: {
  palette: ImportPalette | null;
  existing: readonly string[];
  canEdit: boolean;
  saving: boolean;
  onApply: (swatches: readonly ImportSwatch[]) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={palette !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        {palette === null ? null : (
          <PaletteBody
            palette={palette}
            existing={existing}
            canEdit={canEdit}
            saving={saving}
            onApply={onApply}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
