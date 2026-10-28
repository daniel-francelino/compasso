import { z } from "zod";
import { ContentTypeColor } from "@/lib/shared/enums";

export const CONTENT_TYPE_NAME_MAX = 40;
export const CONTENT_TYPE_EMOJI_MAX = 8;

export const saveContentTypeSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Informe o nome do tipo.")
    .max(CONTENT_TYPE_NAME_MAX, "O nome é longo demais."),
  color: z.nativeEnum(ContentTypeColor, { errorMap: () => ({ message: "Escolha uma cor." }) }),
  emoji: z.string().trim().max(CONTENT_TYPE_EMOJI_MAX, "Use só um emoji.").optional(),
});

export type SaveContentTypeInput = z.infer<typeof saveContentTypeSchema>;

export const archiveContentTypeSchema = z.object({
  id: z.string().uuid(),
  archived: z.boolean(),
});
