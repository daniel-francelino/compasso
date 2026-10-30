import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  type ContentModalChrome,
  ContentEditor,
} from "@/components/marketing/content/content-editor";
import { ContentEditorSkeleton } from "@/components/marketing/content/content-editor-skeleton";
import { RecordUnavailable } from "@/components/shared/admin/record-unavailable";
import { draftOf, emptyDraft } from "@/hooks/marketing/use-content-draft";
import { getCalendarNote } from "@/lib/marketing/calendar/notes.functions";
import { getContentItem } from "@/lib/marketing/content/content.functions";
import { CalendarNoteKind } from "@/lib/shared/enums";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { richDocFromPlain } from "@/lib/shared/rich-text/types";
import { AppRoute } from "@/lib/shared/routes";
import { StoredKey, readStored } from "@/lib/shared/stored-keys";
import { z } from "zod";

function ExistingContent({
  itemId,
  onSaved,
  modal,
}: {
  itemId: string;
  onSaved?: (() => void) | undefined;
  modal?: ContentModalChrome | undefined;
}) {
  const existing = useQuery({
    queryKey: QueryKey.Content.item(itemId),
    queryFn: async () => unwrapResult(await getContentItem({ data: { id: itemId } })).item,
  });
  if (existing.isPending) return <ContentEditorSkeleton />;
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
      onSaved={onSaved}
      modal={modal}
    />
  );
}

function NewContent({
  brandId,
  sourceNoteId,
  day,
  onSaved,
  modal,
}: {
  brandId: string | undefined;
  sourceNoteId: string | undefined;
  day: string | undefined;
  onSaved?: (() => void) | undefined;
  modal?: ContentModalChrome | undefined;
}) {
  const note = useQuery({
    queryKey: QueryKey.Calendar.note(sourceNoteId ?? ""),
    queryFn: async () =>
      unwrapResult(await getCalendarNote({ data: { id: sourceNoteId ?? "" } })).note,
    enabled: sourceNoteId !== undefined,
  });
  const [rememberedBrand, setRememberedBrand] = useState<string | null>(null);
  useEffect(() => {
    setRememberedBrand(readStored(StoredKey.CalendarBrand, z.string().uuid(), ""));
  }, []);
  if (rememberedBrand === null) return <ContentEditorSkeleton isNew />;
  if (sourceNoteId !== undefined && note.isPending) return <ContentEditorSkeleton isNew />;
  const seed = emptyDraft(note.data?.brandId ?? brandId ?? rememberedBrand);
  if (note.data) {
    seed.title = note.data.title;
    seed.planSummary = richDocFromPlain(note.data.description ?? "");
  }
  const noteDay = note.data?.kind === CalendarNoteKind.Date ? note.data.noteDate : undefined;
  seed.publishDate = day ?? noteDay ?? null;
  return (
    <ContentEditor
      key={`new-${sourceNoteId ?? ""}`}
      content={undefined}
      seed={seed}
      sourceNote={note.data?.id}
      onSaved={onSaved}
      modal={modal}
    />
  );
}

export function ContentEditorPage({
  itemId,
  brandId,
  sourceNoteId,
  day,
  onSaved,
  modal,
}: {
  itemId?: string | undefined;
  brandId?: string | undefined;
  sourceNoteId?: string | undefined;
  day?: string | undefined;
  onSaved?: (() => void) | undefined;
  modal?: ContentModalChrome | undefined;
}) {
  if (itemId !== undefined)
    return <ExistingContent itemId={itemId} onSaved={onSaved} modal={modal} />;
  return (
    <NewContent
      brandId={brandId}
      sourceNoteId={sourceNoteId}
      day={day}
      onSaved={onSaved}
      modal={modal}
    />
  );
}
