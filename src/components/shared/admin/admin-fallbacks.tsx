import { Link, type ErrorComponentProps } from "@tanstack/react-router";
import { FileQuestion, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { Button } from "@/components/shared/ui/button";
import { logError } from "@/lib/shared/logger";
import { AppRoute } from "@/lib/shared/routes";

export function AdminNotFoundPage() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="Página não encontrada"
      description="Esta página não existe ou foi movida."
      action={
        <Button asChild>
          <Link to={AppRoute.Admin}>Voltar ao início</Link>
        </Button>
      }
    />
  );
}

export function AdminErrorPage({ error, reset }: ErrorComponentProps) {
  logError(error);
  return (
    <EmptyState
      icon={TriangleAlert}
      title="A página não abriu"
      description="Algo deu errado do nosso lado. Tente de novo ou volte ao início."
      action={<Button onClick={reset}>Tentar novamente</Button>}
    />
  );
}
