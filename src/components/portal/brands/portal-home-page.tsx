import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "@tanstack/react-router";
import { Building2, TriangleAlert, RotateCw } from "lucide-react";
import { BrandAvatar } from "@/components/shared/admin/brand-avatar";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { SectionCard } from "@/components/shared/admin/section-card";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { Button } from "@/components/shared/ui/button";
import { listPortalBrands } from "@/lib/portal/approvals/portal.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

export function PortalHomePage() {
  const query = useQuery({
    queryKey: QueryKey.Portal.brands(),
    queryFn: async () => unwrapResult(await listPortalBrands()).brands,
  });

  if (query.isPending) return <ListSkeleton rows={2} />;
  if (query.isError) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Não foi possível carregar suas marcas"
        description={query.error.message}
        action={
          <Button onClick={() => void query.refetch()}>
            <RotateCw aria-hidden="true" />
            Tentar novamente
          </Button>
        }
      />
    );
  }
  const brands = query.data;
  if (brands.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="Nenhuma marca liberada para você"
        description="Peça à equipe para liberar o seu acesso a uma marca."
      />
    );
  }
  const [only] = brands;
  if (brands.length === 1 && only !== undefined) {
    return <Navigate to="/portal/brands/$brandId" params={{ brandId: only.id }} replace />;
  }

  return (
    <section className="space-y-4">
      <h1 className="heading-page">Escolha a marca</h1>
      <ul className="grid gap-3 sm:grid-cols-2">
        {brands.map((brand) => (
          <SectionCard key={brand.id} as="li" padding="sm">
            <Link
              to="/portal/brands/$brandId"
              params={{ brandId: brand.id }}
              className="block min-h-11 rounded-md hover:underline"
            >
              <span className="flex items-center gap-3">
                <BrandAvatar name={brand.name} logoUrl={brand.logoUrl} size="lg" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{brand.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {brand.clientName}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {brand.pendingCount === 0
                      ? "Nada pendente"
                      : `${brand.pendingCount} aguardando você`}
                  </span>
                </span>
              </span>
            </Link>
          </SectionCard>
        ))}
      </ul>
    </section>
  );
}
