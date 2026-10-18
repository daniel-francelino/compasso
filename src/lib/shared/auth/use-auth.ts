import { getRouteApi } from "@tanstack/react-router";

const layoutRoute = getRouteApi("/admin/_app");

export const useAuth = () => layoutRoute.useRouteContext().auth;
