import { useQueryClient } from "@tanstack/react-query";
import { Images, Trash2 } from "lucide-react";
import { useState } from "react";
import { BrandAvatar } from "@/components/shared/admin/brand-avatar";
import { SectionCard } from "@/components/shared/admin/section-card";
import { MediaPicker } from "@/components/shared/media/media-picker";
import { Button } from "@/components/shared/ui/button";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { type BrandDetail, setBrandLogo } from "@/lib/marketing/brands/brands.functions";
import { MediaScope } from "@/lib/shared/enums";
import { MediaKind } from "@/lib/shared/media/limits";
import { QueryKey } from "@/lib/shared/query-keys";

const IMAGE_ONLY = [MediaKind.Image] as const;

export function BrandLogoField({ brand, canEdit }: { brand: BrandDetail; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const { run, busy } = useServerAction();
  const [picking, setPicking] = useState(false);

  const save = async (versionId: string | null, success: string) => {
    const result = await run(() => setBrandLogo({ data: { brandId: brand.id, versionId } }), {
      success,
      invalidate: [QueryKey.Brands.all()],
    });
    if (result.ok) await queryClient.invalidateQueries({ queryKey: QueryKey.Media.all() });
  };

  return (
    <SectionCard as="div" title="Logo">
      <div className="flex flex-wrap items-center gap-4">
        <BrandAvatar name={brand.name} logoUrl={brand.logoUrl} size="lg" />
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setPicking(true)}
            >
              <Images aria-hidden="true" />
              {brand.logoVersionId ? "Trocar logo" : "Escolher logo"}
            </Button>
            {brand.logoVersionId ? (
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => void save(null, "Logo removido.")}
              >
                <Trash2 aria-hidden="true" />
                Remover
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {picking ? (
        <MediaPicker
          open
          onOpenChange={setPicking}
          scope={MediaScope.Brand}
          brandId={brand.id}
          kinds={IMAGE_ONLY}
          onConfirm={(items) => {
            const picked = items[0];
            if (picked !== undefined) void save(picked.versionId, "Logo atualizado.");
          }}
        />
      ) : null}
    </SectionCard>
  );
}
