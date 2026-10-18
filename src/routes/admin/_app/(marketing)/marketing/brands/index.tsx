import { createFileRoute } from "@tanstack/react-router";
import { BrandsPage } from "@/components/marketing/brands/brands-page";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";
import { listSearchSchema } from "@/lib/shared/list-search";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/brands/")({
  beforeLoad: ({ context }) => requireAction(context, Action.Brands.View),
  validateSearch: listSearchSchema,
  pendingComponent: ListSkeleton,
  component: BrandsPage,
});
