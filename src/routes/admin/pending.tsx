import { Clock, LogOut } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthMessagePage } from "lost-ui/templates/auth/auth-message-page";
import { AuthAside, AuthLogo } from "@/components/shared/admin/auth-brand";
import { Button } from "@/components/shared/ui/button";
import { useSignOut } from "@/lib/shared/auth/use-sign-out";

export const Route = createFileRoute("/admin/pending")({
  component: PendingPage,
});

function PendingPage() {
  const signOut = useSignOut();
  return (
    <AuthMessagePage
      logo={<AuthLogo />}
      aside={<AuthAside />}
      icon={<Clock />}
      title="Seu acesso está sendo analisado"
      description="Assim que a equipe aprovar, você poderá entrar."
      actions={
        <Button variant="outline" className="h-11 md:h-10" onClick={signOut}>
          <LogOut aria-hidden="true" />
          Sair
        </Button>
      }
    />
  );
}
