import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { BrandAvatar } from "@/components/shared/admin/brand-avatar";
import { Button } from "@/components/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shared/ui/popover";
import { Skeleton } from "@/components/shared/ui/skeleton";
import { listPortalBrands } from "@/lib/portal/approvals/portal.functions";
import type { PortalBrand } from "@/lib/portal/approvals/types";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { cn } from "@/lib/shared/utils";

const BRANDS_STALE_MS = 60_000;

function BrandIdentity({ brand }: { brand: PortalBrand }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5 text-left">
      <BrandAvatar name={brand.name} logoUrl={brand.logoUrl} size="md" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-tight text-foreground">
          {brand.name}
        </span>
        <span className="block truncate text-xs leading-tight text-muted-foreground">
          {brand.clientName}
        </span>
      </span>
    </span>
  );
}

export function PortalBrandSwitcher() {
  const [open, setOpen] = useState(false);
  const { brandId } = useParams({ strict: false });
  const query = useQuery({
    queryKey: QueryKey.Portal.brands(),
    queryFn: async () => unwrapResult(await listPortalBrands()).brands,
    staleTime: BRANDS_STALE_MS,
  });

  if (query.isPending) return <Skeleton className="h-10 w-48" />;
  const brands = query.data ?? [];
  const current = brands.find((brand) => brand.id === brandId);
  const [only] = brands;

  if (brands.length === 1 && only !== undefined) {
    return (
      <div className="px-2">
        <BrandIdentity brand={only} />
      </div>
    );
  }
  if (brands.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-auto min-h-11 max-w-72 justify-between gap-3 px-2 py-1.5"
          aria-label="Trocar de marca"
        >
          {current ? (
            <BrandIdentity brand={current} />
          ) : (
            <span className="text-sm font-medium">Escolher marca</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] p-2">
        <p className="px-2 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Suas marcas
        </p>
        <ul className="space-y-0.5">
          {brands.map((brand) => (
            <li key={brand.id}>
              <Link
                to="/portal/brands/$brandId"
                params={{ brandId: brand.id }}
                aria-current={brand.id === brandId ? "true" : undefined}
                className={cn(
                  "flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  brand.id === brandId && "bg-accent",
                )}
                onClick={() => setOpen(false)}
              >
                <BrandIdentity brand={brand} />
                <span className="flex shrink-0 items-center gap-2">
                  {brand.pendingCount > 0 ? (
                    <span className="rounded-full bg-violet px-1.5 text-xs font-medium text-primary-foreground">
                      {brand.pendingCount}
                      <span className="sr-only"> aguardando você</span>
                    </span>
                  ) : null}
                  {brand.id === brandId ? (
                    <Check className="size-4 text-foreground" aria-hidden="true" />
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
