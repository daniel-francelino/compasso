import { useQuery } from "@tanstack/react-query";
import { ContentEditor } from "@/components/marketing/content/content-editor";
import { RecordUnavailable } from "@/components/shared/admin/record-unavailable";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { draftOf, emptyDraft } from "@/hooks/marketing/use-content-draft";
import { getCalendarNote } from "@/lib/marketing/calendar/notes.functions";
import { getContentItem } from "@/lib/marketing/content/content.functions";
import { CalendarNoteKind } from "@/lib/shared/enums";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { richDocFromPlain } from "@/lib/shared/rich-text/types";
import { AppRoute } from "@/lib/shared/routes";

function ExistingContent({ itemId }: { itemId: string }) {
  const existing = useQuery({
    queryKey: QueryKey.Content.item(itemId),
    queryFn: async () => unwrapResult(await getContentItem({ data: { id: itemId } })).item,
  });
  if (existing.isPending) return <PageSkeleton />;
  if (existing.isError) {
    return (
      <RecordUnavailable
        title="Conteúdo não encontrado"
        message="Ele não existe ou você não tem acesso."
        backTo={AppRoute.Content}
        backLabel="Voltar para conteúdos"
      />
    );
  }
  return (
    <ContentEditor
      key={`${existing.data.id}-${existing.data.version}`}
      content={existing.data}
      seed={draftOf(existing.data)}
      sourceNote={undefined}
      defaultDay={undefined}
    />
  );
}

function NewContent({
  brandId,
  sourceNoteId,
  day,
}: {
  brandId: string | undefined;
  sourceNoteId: string | undefined;
  day: string | undefined;
}) {
  const note = useQuery({
    queryKey: QueryKey.Calendar.note(sourceNoteId ?? ""),
    queryFn: async () =>
      unwrapResult(await getCalendarNote({ data: { id: sourceNoteId ?? "" } })).note,
    enabled: sourceNoteId !== undefined,
  });
  if (sourceNoteId !== undefined && note.isPending) return <PageSkeleton />;
  const seed = emptyDraft(note.data?.brandId ?? brandId ?? "");
  if (note.data) {
    seed.title = note.data.title;
    seed.briefing = richDocFromPlain(note.data.description ?? "");
  }
  const noteDay = note.data?.kind === CalendarNoteKind.Date ? note.data.noteDate : undefined;
  return (
    <ContentEditor
      key={`new-${sourceNoteId ?? ""}`}
      content={undefined}
      seed={seed}
      sourceNote={note.data?.id}
      defaultDay={day ?? noteDay}
    />
  );
}

export function ContentEditorPage({
  itemId,
  brandId,
  sourceNoteId,
  day,
}: {
  itemId?: string | undefined;
  brandId?: string | undefined;
  sourceNoteId?: string | undefined;
  day?: string | undefined;
}) {
  if (itemId !== undefined) return <ExistingContent itemId={itemId} />;
  return <NewContent brandId={brandId} sourceNoteId={sourceNoteId} day={day} />;
}
