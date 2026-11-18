import { renderAiFile } from "@/lib/shared/design/ai-import";
import {
  DESIGN_IMPORT_LIMITS,
  DESIGN_IMPORT_MESSAGE,
  DesignImportFormat,
  type ImportedDesign,
  inspectImportFile,
} from "@/lib/shared/design/design-import";
import { readPsdFile } from "@/lib/shared/design/psd-import";
import { logError } from "@/lib/shared/logger";
import { type Result, invalid } from "@/lib/shared/server-utils";

const readBytes = async (file: File): Promise<Uint8Array | null> => {
  try {
    return new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    logError("import file read failed", error);
    return null;
  }
};

export const readDesignFile = async (
  file: File,
  newId: () => string,
): Promise<Result<{ design: ImportedDesign }>> => {
  if (file.size > DESIGN_IMPORT_LIMITS.maxBytes) return invalid(DESIGN_IMPORT_MESSAGE.tooLarge);
  const bytes = await readBytes(file);
  if (bytes === null) return invalid(DESIGN_IMPORT_MESSAGE.readFailed);
  const inspected = inspectImportFile(file.name, bytes);
  if (!inspected.ok) return inspected;
  if (inspected.format === DesignImportFormat.Psd) return readPsdFile(bytes, newId);
  return renderAiFile(bytes, file.name, newId);
};
