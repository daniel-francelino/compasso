import { describe, expect, it } from "vitest";
import { contactMessageSchema } from "@/lib/site/contact-schemas";

const valid = {
  name: "Ana",
  email: "ana@example.com",
  phone: "",
  message: "Olá",
  consent: true,
  website: "",
  turnstileToken: "token",
  slug: "home",
};

const messagesFor = (value: unknown): string[] => {
  const result = contactMessageSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("contactMessageSchema", () => {
  it("accepts a complete message", () => {
    expect(contactMessageSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a phone without an e-mail", () => {
    expect(
      contactMessageSchema.safeParse({ ...valid, email: "", phone: "11 99999-0000" }).success,
    ).toBe(true);
  });

  it("requires an e-mail or a phone", () => {
    expect(messagesFor({ ...valid, email: "", phone: "" })).toContain(
      "Informe um e-mail ou um telefone para a resposta.",
    );
  });

  it("rejects a malformed e-mail", () => {
    expect(messagesFor({ ...valid, email: "ana@" })).toContain("Informe um e-mail válido.");
  });

  it("requires consent", () => {
    expect(messagesFor({ ...valid, consent: false })).toContain(
      "É preciso aceitar o consentimento para enviar a mensagem.",
    );
  });

  it("requires the anti-bot token", () => {
    expect(messagesFor({ ...valid, turnstileToken: "" })).toContain(
      "Confirme que você não é um robô.",
    );
  });

  it("rejects an over-long message", () => {
    expect(messagesFor({ ...valid, message: "a".repeat(4001) }).length).toBeGreaterThan(0);
  });
});
