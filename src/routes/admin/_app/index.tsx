import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared/admin/page-header";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { AppRoute } from "@/lib/shared/routes";

const MARKETING_ACTIONS = [Action.Brands.View, Action.Content.View, Action.Approvals.View];

export const Route = createFileRoute("/admin/_app/")({
  beforeLoad: ({ context }) => {
    if (MARKETING_ACTIONS.some((action) => can(context.auth, action))) {
      throw redirect({ to: AppRoute.Marketing });
    }
  },
  component: HomePage,
});

function HomePage() {
  const { auth } = Route.useRouteContext();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Início"
        description={`Olá, ${auth.profile?.name ?? ""}. Escolha uma área no menu.`}
      />
    </div>
  );
}
