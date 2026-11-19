import type { DesignDocument } from "@/lib/shared/design/schemas";

const encoder = new TextEncoder();

const structuralSeparators = (json: string): number => {
  let count = 0;
  let inString = false;
  let escaped = false;
  for (const char of json) {
    const separator = !inString && (char === "," || char === ":");
    count += separator ? 1 : 0;
    const closes: boolean = inString && !escaped && char === '"';
    const opens: boolean = !inString && char === '"';
    escaped = inString && !escaped && char === "\\";
    inString = opens || (inString && !closes);
  }
  return count;
};

export const databaseDocumentBytes = (document: DesignDocument): number => {
  const json = JSON.stringify(document);
  return encoder.encode(json).length + structuralSeparators(json);
};
