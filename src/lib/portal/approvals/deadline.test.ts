import { describe, expect, it } from "vitest";
import { DeadlineUrgency, responseDeadline } from "@/lib/portal/approvals/deadline";
import type { PortalRequest } from "@/lib/portal/approvals/types";
import { ApprovalRequestStatus, ApprovalStage } from "@/lib/shared/enums";
import { addDaysToDate, todayInZone } from "@/lib/shared/dates";

const ZONE = "America/Sao_Paulo";

const request = (overrides: Partial<PortalRequest>): PortalRequest => ({
  id: "r1",
  itemId: "i1",
  revisionId: "v1",
  stage: ApprovalStage.Plan,
  status: ApprovalRequestStatus.Pending,
  title: "Teste",
  channels: [],
  media: [],
  brandTimezone: ZONE,
  revisionNo: 1,
  dueDate: null,
  requestedAt: "2026-10-01T10:00:00Z",
  decidedAt: null,
  canDecide: true,
  decidedByName: null,
  decidedOnBehalf: false,
  planSummary: null,
  ...overrides,
});

const inDays = (days: number): string => addDaysToDate(todayInZone(ZONE), days);

describe("responseDeadline", () => {
  it("has no badge without a due date", () => {
    expect(responseDeadline(request({}))).toBeNull();
  });

  it("has no badge once the request is decided", () => {
    const decided = request({ status: ApprovalRequestStatus.Approved, dueDate: inDays(3) });
    expect(responseDeadline(decided)).toBeNull();
  });

  it("flags a past deadline as overdue with the days late", () => {
    const result = responseDeadline(request({ dueDate: inDays(-2) }));
    expect(result?.urgency).toBe(DeadlineUrgency.Overdue);
    expect(result?.label).toBe("Prazo vencido há 2 dias");
  });

  it("uses the singular for one day late", () => {
    expect(responseDeadline(request({ dueDate: inDays(-1) }))?.label).toBe(
      "Prazo vencido há 1 dia",
    );
  });

  it("marks today and tomorrow as soon", () => {
    const today = responseDeadline(request({ dueDate: inDays(0) }));
    const tomorrow = responseDeadline(request({ dueDate: inDays(1) }));
    expect(today).toEqual({ urgency: DeadlineUrgency.Soon, label: "Responder até hoje" });
    expect(tomorrow).toEqual({ urgency: DeadlineUrgency.Soon, label: "Responder até amanhã" });
  });

  it("shows the date when there is time", () => {
    const result = responseDeadline(request({ dueDate: inDays(5) }));
    expect(result?.urgency).toBe(DeadlineUrgency.Later);
    expect(result?.label.startsWith("Responder até ")).toBe(true);
  });
});
