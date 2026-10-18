import { z } from "zod";
import { listRequestSchema } from "@/lib/shared/list-search";

export const ApprovalFilter = {
  Pending: "pending",
  Overdue: "overdue",
  Approved: "approved",
  ChangesRequested: "changes_requested",
  Superseded: "superseded",
} as const;

export const listApprovalsSchema = listRequestSchema.extend({
  brandId: z.string().uuid().optional(),
  approverId: z.string().uuid().optional(),
});

export const requestIdSchema = z.object({ id: z.string().uuid() });

export const reassignSchema = z.object({
  id: z.string().uuid(),
  approverId: z.string().uuid({ message: "Escolha quem vai aprovar." }),
});

export const cancelRequestSchema = z.object({
  id: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(3, "Informe o motivo (ao menos 3 letras).")
    .max(500, "O motivo é longo demais."),
});
