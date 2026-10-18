import { describe, expect, it } from "vitest";
import { notificationEmail } from "@/lib/shared/email/templates";
import {
  MAX_EMAIL_ATTEMPTS,
  backoffMinutes,
  nextAttemptAt,
  outboxPayloadSchema,
  statusAfterFailure,
} from "@/lib/shared/email/outbox";

describe("email outbox rules", () => {
  it("backs off exponentially from five minutes", () => {
    expect([1, 2, 3, 4].map(backoffMinutes)).toEqual([5, 10, 20, 40]);
    expect(nextAttemptAt(2, new Date("2026-10-18T10:00:00Z")).toISOString()).toBe(
      "2026-10-18T10:10:00.000Z",
    );
  });

  it("keeps the email queued until the last attempt, then marks it failed", () => {
    expect(statusAfterFailure(MAX_EMAIL_ATTEMPTS - 1)).toBe("queued");
    expect(statusAfterFailure(MAX_EMAIL_ATTEMPTS)).toBe("failed");
  });

  it("accepts only internal links in the payload", () => {
    expect(
      outboxPayloadSchema.safeParse({ title: "Aviso", link: "/portal/brands/1" }).success,
    ).toBe(true);
    expect(outboxPayloadSchema.safeParse({ title: "Aviso", link: "//evil.test" }).success).toBe(
      false,
    );
    expect(
      outboxPayloadSchema.safeParse({ title: "Aviso", link: "https://evil.test" }).success,
    ).toBe(false);
  });
});

describe("notificationEmail", () => {
  it("carries only the title and one link to the product", () => {
    const message = notificationEmail({
      to: "cliente@example.test",
      title: "Nova aprovação pendente",
      link: "/portal/brands/b1/approvals/r1",
      origin: "https://app.example.test",
    });
    expect(message.subject).toBe("Nova aprovação pendente");
    expect(message.text).toContain("https://app.example.test/portal/brands/b1/approvals/r1");
    expect(message.html).toContain('href="https://app.example.test/portal/brands/b1/approvals/r1"');
  });

  it("escapes the title in the HTML body", () => {
    const message = notificationEmail({
      to: "a@example.test",
      title: "<script>x</script>",
      link: null,
      origin: "https://app.example.test",
    });
    expect(message.html).not.toContain("<script>");
  });
});
