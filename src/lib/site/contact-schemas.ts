import { z } from "zod";

const emailShape = z.string().email();

export const contactMessageSchema = z
  .object({
    name: z.string().trim().min(1, "Informe seu nome.").max(120),
    email: z.string().trim().max(200),
    phone: z.string().trim().max(40),
    message: z.string().trim().min(1, "Escreva a mensagem.").max(4000),
    consent: z.boolean(),
    website: z.string().max(200),
    turnstileToken: z.string().max(4096),
    slug: z.string().max(200),
  })
  .superRefine((value, context) => {
    if (value.email === "" && value.phone === "") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Informe um e-mail ou um telefone para a resposta.",
      });
    }
    if (value.email !== "" && !emailShape.safeParse(value.email).success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Informe um e-mail válido.",
      });
    }
    if (!value.consent) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["consent"],
        message: "É preciso aceitar o consentimento para enviar a mensagem.",
      });
    }
  });

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
