import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { LoginPage } from "lost-ui/templates/auth/login-page";
import { z } from "zod";
import { AuthAside, AuthLogo } from "@/components/shared/admin/auth-brand";
import { AuthImage } from "@/components/shared/admin/auth-images";
import { renderAuthLink } from "@/components/shared/admin/render-auth-link";
import { signIn } from "@/lib/shared/auth/login.functions";
import { safeRedirect } from "@/lib/shared/auth/redirect";
import { getAuthState } from "@/lib/shared/auth/session.functions";
import { AppRoute } from "@/lib/shared/routes";
import { failureMessage } from "@/lib/shared/server-utils";

export const Route = createFileRoute("/admin/login")({
  validateSearch: z.object({ redirect: z.string().optional().catch(undefined) }),
  beforeLoad: async () => {
    const auth = await getAuthState();
    if (auth.user !== null) throw redirect({ to: AppRoute.Admin });
  },
  component: LoginRoute,
});

function LoginRoute() {
  const router = useRouter();
  const search = Route.useSearch();

  return (
    <LoginPage
      logo={<AuthLogo />}
      aside={<AuthAside image={AuthImage.Social} />}
      title="Entrar"
      description="Use o e-mail do seu convite para acessar a Aura Creative."
      identifier="email"
      identifierLabel="E-mail"
      forgotPasswordHref={AppRoute.RecoverPassword}
      renderLink={renderAuthLink}
      onSubmit={async ({ identifier, password }) => {
        const result = await signIn({ data: { email: identifier, password } });
        if (result.ok) router.history.push(safeRedirect(search.redirect));
        return failureMessage(result);
      }}
    />
  );
}
