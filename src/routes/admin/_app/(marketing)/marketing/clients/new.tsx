import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ClientForm } from "@/components/marketing/clients/client-form";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SectionCard } from "@/components/shared/admin/section-card";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";
import { AppRoute } from "@/lib/shared/routes";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/clients/new")({
  beforeLoad: ({ context }) => requireAction(context, Action.Clients.Create),
  component: NewClientPage,
});

function NewClientPage() {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo cliente"
        breadcrumbs={[{ label: "Clientes", to: AppRoute.Clients }, { label: "Novo cliente" }]}
      />
      <SectionCard as="div" className="max-w-2xl">
        <ClientForm
          onCancel={() => router.history.back()}
          onSaved={(saved) =>
            void router.navigate({
              to: "/admin/marketing/clients/$clientId",
              params: { clientId: saved.id },
            })
          }
        />
      </SectionCard>
    </div>
  );
}
