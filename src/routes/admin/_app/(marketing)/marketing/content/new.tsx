import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ContentEditorPage } from "@/components/marketing/content/content-editor-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

const searchSchema = z.object({
  brand: z.string().uuid().optional().catch(undefined),
  note: z.string().uuid().optional().catch(undefined),
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/content/new")({
  beforeLoad: ({ context }) => requireAction(context, Action.Content.Create),
  validateSearch: searchSchema,
  component: NewContentRoute,
});

function NewContentRoute() {
  const search = Route.useSearch();
  return <ContentEditorPage brandId={search.brand} sourceNoteId={search.note} day={search.day} />;
}
