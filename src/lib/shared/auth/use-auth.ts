import { useRouteContext } from "@tanstack/react-router";

export const useAuth = () => {
  const { auth } = useRouteContext({ strict: false });
  if (auth === undefined) throw new Error("useAuth precisa estar dentro de um layout autenticado.");
  return auth;
};
