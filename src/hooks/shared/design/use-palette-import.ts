import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { addDesignBrandColors } from "@/lib/shared/design/brand-colors.functions";
import { PALETTE_COPY } from "@/lib/shared/design/import/messages";
import type { ImportPalette, ImportSwatch } from "@/lib/shared/design/import/types";
import { logError } from "@/lib/shared/logger";
import { QueryKey } from "@/lib/shared/query-keys";

export type PaletteImporter = {
  palette: ImportPalette | null;
  saving: boolean;
  receive: (palette: ImportPalette) => void;
  close: () => void;
  apply: (swatches: readonly ImportSwatch[]) => void;
};

export const usePaletteImport = ({
  designId,
  brandId,
}: {
  designId: string;
  brandId: string;
}): PaletteImporter => {
  const queryClient = useQueryClient();
  const [palette, setPalette] = useState<ImportPalette | null>(null);
  const [saving, setSaving] = useState(false);

  const apply = (swatches: readonly ImportSwatch[]): void => {
    if (saving || swatches.length === 0) return;
    setSaving(true);
    const colors = swatches.map((swatch) => ({ name: swatch.name, hex: swatch.hex }));
    addDesignBrandColors({ data: { designId, colors } })
      .then((result) => {
        if (!result.ok) {
          logError("palette apply refused", result.code);
          toast.error(PALETTE_COPY.saveFailed);
          return;
        }
        toast.success(PALETTE_COPY.saved(result.added));
        void queryClient.invalidateQueries({ queryKey: QueryKey.Design.brandKit(brandId) });
        setPalette(null);
      })
      .catch((error: unknown) => {
        logError("palette apply failed", error instanceof Error ? error.name : "unknown");
        toast.error(PALETTE_COPY.saveFailed);
      })
      .finally(() => setSaving(false));
  };

  return { palette, saving, receive: setPalette, close: () => setPalette(null), apply };
};
