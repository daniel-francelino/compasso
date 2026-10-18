import { createFileRoute } from "@tanstack/react-router";
import { AuthShell } from "@/components/shared/admin/auth-shell";
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
    <AuthShell
      title={suspended ? "Acesso suspenso" : "Não foi possível aprovar o acesso"}
      description={
        suspended
          ? "O acesso desta conta está suspenso. Fale com a equipe para reativá-lo."
          : "Se acha que é um engano, fale com a equipe."
      }
    >
      <Button variant="outline" className="h-11 w-full md:h-10" onClick={signOut}>
        Sair
      </Button>
    </AuthShell>
  );
}
