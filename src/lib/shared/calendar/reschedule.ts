import { instantToLocalInput, localInputOccurrences } from "@/lib/shared/format";

export const LocalTimeProblem = {
  Nonexistent: "nonexistent",
  Ambiguous: "ambiguous",
} as const;
export type LocalTimeProblem = (typeof LocalTimeProblem)[keyof typeof LocalTimeProblem];

export type LocalTimeResolution =
  | { ok: true; instant: Date }
  | { ok: false; problem: typeof LocalTimeProblem.Nonexistent }
  | { ok: false; problem: typeof LocalTimeProblem.Ambiguous; options: [Date, Date] };

export const resolveLocalTime = (local: string, zone: string): LocalTimeResolution => {
  const found = localInputOccurrences(local, zone);
  const [first, second] = found;
  if (first === undefined) return { ok: false, problem: LocalTimeProblem.Nonexistent };
  if (second === undefined) return { ok: true, instant: first };
  return { ok: false, problem: LocalTimeProblem.Ambiguous, options: [first, second] };
};

export const moveToDay = (at: string, targetDay: string, zone: string): LocalTimeResolution =>
  resolveLocalTime(`${targetDay}${instantToLocalInput(at, zone).slice(10)}`, zone);
