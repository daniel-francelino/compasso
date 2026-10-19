import type { PortalRequest } from "@/lib/portal/approvals/types";

export const nextPlanned = (request: PortalRequest): { at: string; timezone: string } | null => {
  const planned = request.channels
    .filter((channel) => channel.plannedAt !== null)
    .sort((a, b) => (a.plannedAt ?? "").localeCompare(b.plannedAt ?? ""))[0];
  if (planned?.plannedAt === null || planned === undefined) return null;
  return {
    at: planned.plannedAt,
    timezone: planned.plannedTimezone ?? request.brandTimezone ?? "America/Sao_Paulo",
  };
};
