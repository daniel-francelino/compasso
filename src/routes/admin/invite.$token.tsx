import { MailX } from "lucide-react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthMessagePage } from "lost-ui/templates/auth/auth-message-page";
import { AuthAside, AuthLogo, AuthTextLink } from "@/components/shared/admin/auth-brand";
import { InvitationForm } from "@/components/shared/admin/invitation-form";
import { previewInvitation } from "@/lib/shared/auth/invitations.functions";
import { homeFor } from "@/lib/shared/auth/redirect";
import { getAuthState } from "@/lib/shared/auth/session.functions";
import { AppRoute } from "@/lib/shared/routes";

export const Route = createFileRoute("/admin/invite/$token")({
  beforeLoad: async () => {
    const auth = await getAuthState();
    if (auth.user !== null) throw redirect({ to: homeFor(auth) });
  },
  loader: async ({ params }) => ({
    preview: await previewInvitation({ data: { token: params.token } }),
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const { preview } = Route.useLoaderData();

  if (!preview.ok) {
    return (
      <AuthMessagePage
        logo={<AuthLogo />}
        aside={<AuthAside />}
        icon={<MailX />}
        title="Convite indisponível"
        description="Este convite expirou ou já foi usado. Peça um novo convite a quem o enviou."
        footer={<AuthTextLink href={AppRoute.Login}>Ir para o login</AuthTextLink>}
      />
    );
  }

  return <InvitationForm token={token} email={preview.email} />;
}
