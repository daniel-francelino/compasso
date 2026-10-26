import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { InstagramCallbackPage } from "@/components/marketing/channels/instagram-callback-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

const callbackSearchSchema = z.object({
  code: z.string().max(2000).optional(),
  state: z.string().max(1000).optional(),
  error: z.string().max(200).optional(),
});

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/instagram/callback")({
  beforeLoad: ({ context }) => requireAction(context, Action.Channels.Connect),
  validateSearch: callbackSearchSchema,
  component: CallbackRoute,
});

function CallbackRoute() {
  const search = Route.useSearch();
  return <InstagramCallbackPage code={search.code} state={search.state} error={search.error} />;
}
