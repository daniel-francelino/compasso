const MS_PER_DAY = 86_400_000;
const DAY_LENGTH = 10;

export const addDays = (day: string, amount: number): string => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, DAY_LENGTH);
};

export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);

export const eachDay = (from: string, to: string): string[] => {
  const count = daysBetween(from, to) + 1;
  return count > 0 ? Array.from({ length: count }, (_, index) => addDays(from, index)) : [];
};

export const todayIn = (timeZone: string, now: Date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

export const startOfMonth = (day: string): string => `${day.slice(0, 7)}-01`;

export const endOfMonth = (day: string): string =>
  addDays(addDays(startOfMonth(day), 32).slice(0, 7) + "-01", -1);
