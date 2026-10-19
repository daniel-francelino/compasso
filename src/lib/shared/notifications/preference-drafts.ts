import type { PreferenceRow } from "@/lib/shared/notifications/notifications.functions";

export type PreferenceDraft = { enabled: boolean; email: boolean; days: string };

export const parseLeadDays = (text: string): number[] | null => {
  const days = text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map(Number);
  if (days.length === 0 || days.length > 5) return null;
  return days.every((day) => Number.isInteger(day) && day >= 0 && day <= 30) ? days : null;
};

export const draftOf = (row: PreferenceRow): PreferenceDraft => ({
  enabled: row.enabled,
  email: row.email,
  days: (row.leadDays ?? row.defaultLeadDays ?? []).join(", "),
});

export const draftChanged = (row: PreferenceRow, draft: PreferenceDraft | undefined): boolean => {
  if (draft === undefined) return false;
  const initial = draftOf(row);
  return (
    draft.enabled !== initial.enabled ||
    draft.email !== initial.email ||
    (row.schedulable && draft.days !== initial.days)
  );
};

export const draftInvalid = (row: PreferenceRow, draft: PreferenceDraft | undefined): boolean =>
  row.schedulable &&
  draft !== undefined &&
  draft.days.trim() !== "" &&
  parseLeadDays(draft.days) === null;

export const draftLeadDays = (row: PreferenceRow, draft: PreferenceDraft): number[] | null => {
  if (!row.schedulable) return row.leadDays;
  return draft.days.trim() === "" ? null : parseLeadDays(draft.days);
};
