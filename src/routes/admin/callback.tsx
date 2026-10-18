import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { AuthShell } from "@/components/shared/admin/auth-shell";
import { exchangeAuthCode } from "@/lib/shared/auth/recovery.functions";
import { safeRedirect } from "@/lib/shared/auth/redirect";
import { AppRoute } from "@/lib/shared/routes";

export const Route = createFileRoute("/admin/callback")({
  validateSearch: z.object({
    code: z.string().max(200).optional().catch(undefined),
    next: z.string().max(200).optional().catch(undefined),
  }),
  loaderDeps: ({ search }) => ({ code: search.code, next: search.next }),
  loader: async ({ deps }) => {
    if (deps.code === undefined) return { valid: false };
    const result = await exchangeAuthCode({ data: { code: deps.code } });
    if (result.ok) throw redirect({ to: safeRedirect(deps.next) });
    return { valid: false };
  },
  component: CallbackPage,
});

function CallbackPage() {
  return (
    <AuthShell
      title="Link inválido"
      description="Este link não vale mais, ou foi aberto em outro navegador. Peça um novo."
      footer={
        <Link
          to={AppRoute.RecoverPassword}
          className="text-primary underline-offset-4 hover:underline"
        >
          Pedir novo link
        </Link>
      }
    >
      <span />
    </AuthShell>
  );
}
