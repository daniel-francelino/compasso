import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/components/shared/settings/profile/profile-page";

export const Route = createFileRoute("/admin/_app/(shared)/profile")({
  component: ProfilePage,
});
