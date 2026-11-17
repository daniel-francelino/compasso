import { useDraftAutosave } from "@/hooks/shared/use-draft-autosave";
import { saveDesignDraft } from "@/lib/shared/design/design.functions";
import { isTooLarge } from "@/lib/shared/design/document";
import type { DesignDocument } from "@/lib/shared/design/schemas";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

const TOO_LARGE = "Este design ficou grande demais. Remova alguns elementos para salvar.";

export const useDesignAutosave = ({
  designId,
  document,
  initialVersion,
  enabled,
}: {
  designId: string;
  document: DesignDocument;
  initialVersion: number;
  enabled: boolean;
}) =>
  useDraftAutosave({
    document,
    initialVersion,
    enabled,
    delayMs: DESIGN_LIMITS.autosaveMs,
    tooLarge: (target) => (isTooLarge(target) ? TOO_LARGE : null),
    save: (target, expectedVersion) =>
      saveDesignDraft({ data: { id: designId, document: target, expectedVersion } }),
  });
