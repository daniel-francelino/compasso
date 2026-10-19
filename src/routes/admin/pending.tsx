import { LogOut } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthShell } from "@/components/shared/admin/auth-shell";
import { Button } from "@/components/shared/ui/button";
import { useSignOut } from "@/lib/shared/auth/use-sign-out";

export const Route = createFileRoute("/admin/pending")({
  component: PendingPage,
});

function PendingPage() {
  const signOut = useSignOut();
  return (
    <AuthShell
      title="Seu acesso está sendo analisado"
      description="Assim que a equipe aprovar, você poderá entrar."
    >
      <Button variant="outline" className="h-11 w-full md:h-10" onClick={signOut}>
        <LogOut aria-hidden="true" />
        Sair
      </Button>
    </AuthShell>
  );
}
