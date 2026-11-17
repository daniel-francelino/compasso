import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useBrandOptions } from "@/hooks/shared/use-brand-options";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { type DesignRow, createDesign, getDesign } from "@/lib/shared/design/design.functions";
import type { DesignPreset } from "@/lib/shared/design/types";
import { QueryKey } from "@/lib/shared/query-keys";
import { StoredKey, readStored } from "@/lib/shared/stored-keys";

const UNTITLED = "Design sem título";
const NO_BRAND = "Cadastre uma marca antes de criar um design.";

export const useCreateDesign = (enabled: boolean) => {
  const navigate = useNavigate();
  const brands = useBrandOptions(enabled);
  const { run, busy } = useServerAction();
  const available = brands.data ?? [];

  const brandId = (): string | undefined => {
    const remembered = readStored(StoredKey.CalendarBrand, z.string().uuid(), "");
    return (available.find((brand) => brand.id === remembered) ?? available[0])?.id;
  };

  const openEditor = (id: string) =>
    navigate({ to: "/admin/marketing/designs/$designId", params: { designId: id } });

  const fromPreset = async (preset: DesignPreset) => {
    const brand = brandId();
    if (brand === undefined) return;
    const result = await run(
      () => createDesign({ data: { brandId: brand, name: UNTITLED, preset } }),
      {
        invalidate: [QueryKey.Design.lists()],
      },
    );
    if (result.ok) await openEditor(result.id);
  };

  const fromTemplate = async (template: DesignRow) => {
    const result = await run(
      async () => {
        const loaded = await getDesign({ data: { id: template.id } });
        if (!loaded.ok) return loaded;
        return createDesign({
          data: {
            brandId: loaded.design.brandId,
            name: template.name,
            preset: loaded.design.preset,
            document: loaded.design.document,
          },
        });
      },
      { invalidate: [QueryKey.Design.lists()] },
    );
    if (result.ok) await openEditor(result.id);
  };

  return {
    busy,
    loadingBrands: brands.isPending,
    noBrand: brands.isSuccess && available.length === 0 ? NO_BRAND : undefined,
    fromPreset,
    fromTemplate,
  };
};
