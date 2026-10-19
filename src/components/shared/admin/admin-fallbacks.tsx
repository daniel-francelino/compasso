import { Link, type ErrorComponentProps } from "@tanstack/react-router";
import { FileQuestion, TriangleAlert, House, RotateCw } from "lucide-react";
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
          <Link to={AppRoute.Admin}>
            <House aria-hidden="true" />
            Voltar ao início
          </Link>
        </Button>
      }
    />
  );
}

export function AdminErrorPage({ error, reset }: ErrorComponentProps) {
  logError(error);
  return (
    <section
      role="alert"
      className="flex min-h-[calc(100dvh-12rem)] items-center justify-center px-4 py-8"
    >
      <div className="flex w-full max-w-xl flex-col items-center rounded-3xl border border-border bg-card px-6 py-10 text-center shadow-sm sm:px-10 sm:py-12">
        <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <TriangleAlert className="size-7" aria-hidden="true" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          A página não abriu
        </p>
        <h1 className="mt-2 heading-section font-semibold tracking-tight text-foreground sm:text-3xl">
          Algo deu errado
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          Não foi possível carregar esta página. Tente novamente; se o problema continuar, fale com
          a equipe.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>
            <RotateCw aria-hidden="true" />
            Tentar novamente
          </Button>
          <Button asChild variant="outline">
            <Link to={AppRoute.Admin}>
              <House aria-hidden="true" />
              Voltar ao início
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
