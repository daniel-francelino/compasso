import { z } from "zod";

export type NewBrandColor = { name: string; hex: string };

const storedColorsSchema = z.object({ colors: z.array(z.record(z.string(), z.unknown())) });

export const appendBrandColors = (
  stored: unknown,
  added: readonly NewBrandColor[],
): Record<string, unknown> => {
  const base =
    typeof stored === "object" && stored !== null && !Array.isArray(stored)
      ? Object.fromEntries(Object.entries(stored))
      : {};
  const parsed = storedColorsSchema.safeParse(base);
  const kept = parsed.success ? parsed.data.colors : [];
  return { ...base, colors: [...kept, ...added] };
};
