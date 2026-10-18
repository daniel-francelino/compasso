import { createFileRoute } from "@tanstack/react-router";
import { PortalHomePage } from "@/components/portal/brands/portal-home-page";

export const Route = createFileRoute("/portal/_app/")({
  component: PortalHomePage,
});
