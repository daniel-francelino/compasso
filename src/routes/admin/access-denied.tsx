import { LogOut, ShieldAlert } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthMessagePage } from "lost-ui/templates/auth/auth-message-page";
import { AuthAside, AuthLogo } from "@/components/shared/admin/auth-brand";
import { Button } from "@/components/shared/ui/button";
import { getAuthState } from "@/lib/shared/auth/session.functions";
import { useSignOut } from "@/lib/shared/auth/use-sign-out";
import { ProfileStatus } from "@/lib/shared/enums";

export const Route = createFileRoute("/admin/access-denied")({
  loader: async () => ({ auth: await getAuthState() }),
  component: AccessDeniedPage,
});

function AccessDeniedPage() {
  const { auth } = Route.useLoaderData();
  const signOut = useSignOut();
  const suspended = auth.profile?.status === ProfileStatus.Suspended;
  return (
    <AuthMessagePage
      logo={<AuthLogo />}
      aside={<AuthAside />}
      icon={<ShieldAlert />}
      title={suspended ? "Acesso suspenso" : "Não foi possível aprovar o acesso"}
      description={
        suspended
          ? "O acesso desta conta está suspenso. Fale com a equipe para reativá-lo."
          : "Se acha que é um engano, fale com a equipe."
      }
      actions={
        <Button variant="outline" className="h-11 md:h-10" onClick={signOut}>
          <LogOut aria-hidden="true" />
          Sair
        </Button>
      }
    />
  );
}
