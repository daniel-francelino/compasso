import { createFileRoute, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { BrandCreateForm } from "@/components/marketing/brands/brand-create-form";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SectionCard } from "@/components/shared/admin/section-card";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";
import { AppRoute } from "@/lib/shared/routes";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/brands/new")({
  beforeLoad: ({ context }) => requireAction(context, Action.Brands.Create),
  validateSearch: z.object({ clientId: z.string().uuid().optional().catch(undefined) }),
  component: NewBrandPage,
});

function NewBrandPage() {
  const router = useRouter();
  const search = Route.useSearch();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Nova marca"
        breadcrumbs={[{ label: "Marcas", to: AppRoute.Brands }, { label: "Nova marca" }]}
      />
      <SectionCard as="div" className="max-w-2xl">
        <BrandCreateForm
          initialClientId={search.clientId}
          onCancel={() => router.history.back()}
          onSaved={(id) =>
            void router.navigate({
              to: "/admin/marketing/brands/$brandId",
              params: { brandId: id },
            })
          }
        />
      </SectionCard>
    </div>
  );
}
