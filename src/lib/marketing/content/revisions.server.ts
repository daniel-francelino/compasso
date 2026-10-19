import { z } from "zod";
import type { Caller } from "@/lib/shared/auth/server-guards.server";
import type { ContentFormat, Platform } from "@/lib/shared/enums";
import { kindOfMime } from "@/lib/shared/media/limits";
import type { ContentMedia, RevisionRow } from "@/lib/marketing/content/types";

type Supabase = Caller["supabase"];

const captionSchema = z.object({ text: z.string() }).nullable().optional();

const snapshotSchema = z.object({
  title: z.string(),
  caption: captionSchema,
  call_to_action: z.string().nullable().optional(),
  channels: z.array(
    z.object({
      row_id: z.string(),
      platform: z.string(),
      profile_name: z.string(),
      format: z.string(),
      caption: captionSchema,
      planned_at: z.string().nullable().optional(),
      planned_timezone: z.string().nullable().optional(),
    }),
  ),
});

export const REVISION_SELECT =
  "id, revision_no, created_at, snapshot, content_revision_media(media_version_id, position, alt_text)";

export type RevisionQueryRow = {
  id: string;
  revision_no: number;
  created_at: string;
  snapshot: unknown;
  content_revision_media: { media_version_id: string; position: number; alt_text: string | null }[];
};

export const loadMedia = async (
  supabase: Supabase,
  refs: { id: string; alt: string | null }[],
): Promise<ContentMedia[]> => {
  if (refs.length === 0) return [];
  const { data } = await supabase
    .from("media_versions")
    .select("id, original_filename, mime_type, status, media_assets(display_name, trashed_at)")
    .in(
      "id",
      refs.map((ref) => ref.id),
    );
  const byId = new Map((data ?? []).map((row) => [row.id, row]));
  return refs.map((ref) => {
    const row = byId.get(ref.id);
    return {
      mediaVersionId: ref.id,
      altText: ref.alt,
      name: row?.media_assets?.display_name ?? row?.original_filename ?? "Arquivo removido",
      mimeType: row?.mime_type ?? "",
      kind: row === undefined ? null : kindOfMime(row.mime_type),
      available: row?.status === "available" && row.media_assets?.trashed_at === null,
    };
  });
};

export const toRevision = async (
  supabase: Supabase,
  revision: RevisionQueryRow,
): Promise<RevisionRow | null> => {
  const snapshot = snapshotSchema.safeParse(revision.snapshot);
  if (!snapshot.success) return null;
  const refs = [...revision.content_revision_media]
    .sort((a, b) => a.position - b.position)
    .map((item) => ({ id: item.media_version_id, alt: item.alt_text }));
  return {
    id: revision.id,
    revisionNo: revision.revision_no,
    createdAt: revision.created_at,
    snapshot: {
      title: snapshot.data.title,
      caption: snapshot.data.caption?.text ?? "",
      callToAction: snapshot.data.call_to_action ?? null,
      channels: snapshot.data.channels.map((channel) => ({
        rowId: channel.row_id,
        platform: channel.platform as Platform,
        profileName: channel.profile_name,
        format: channel.format as ContentFormat,
        caption: channel.caption?.text ?? null,
        plannedAt: channel.planned_at ?? null,
        plannedTimezone: channel.planned_timezone ?? null,
      })),
    },
    media: await loadMedia(supabase, refs),
  };
};
