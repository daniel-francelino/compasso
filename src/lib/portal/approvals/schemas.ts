import { z } from "zod";
import { ApprovalOutcome, ApprovalRequestStatus } from "@/lib/shared/enums";
import { MediaVariant } from "@/lib/shared/media/schemas";

export const PortalApprovalFilter = {
  All: "all",
  Pending: ApprovalRequestStatus.Pending,
  Approved: ApprovalRequestStatus.Approved,
  ChangesRequested: ApprovalRequestStatus.ChangesRequested,
  Superseded: ApprovalRequestStatus.Superseded,
} as const;

export const portalBrandSchema = z.object({ brandId: z.string().uuid() });

export const portalListSchema = z.object({
  brandId: z.string().uuid(),
  status: z.string().max(30).optional(),
  page: z.number().int().min(1).max(10000).default(1),
});

export const portalRequestSchema = z.object({ id: z.string().uuid() });

export const MIN_CHANGE_COMMENT = 5;

export const decideSchema = z
  .object({
    id: z.string().uuid(),
    outcome: z.nativeEnum(ApprovalOutcome),
    comment: z.string().trim().max(4000, "O comentário é longo demais.").optional(),
  })
  .refine(
    (value) =>
      value.outcome !== ApprovalOutcome.ChangesRequested ||
      (value.comment ?? "").length >= MIN_CHANGE_COMMENT,
    {
      message: "Escreva um comentário para pedir alterações (ao menos 5 letras).",
      path: ["comment"],
    },
  );

export type DecideInput = z.infer<typeof decideSchema>;

export const portalCommentSchema = z.object({
  itemId: z.string().uuid(),
  body: z.string().trim().min(1, "Escreva o comentário.").max(4000, "O comentário é longo demais."),
});

export const portalItemSchema = z.object({ itemId: z.string().uuid() });

export const signPortalSchema = z.object({
  revisionId: z.string().uuid(),
  versionIds: z.array(z.string().uuid()).min(1).max(20),
  variant: z.nativeEnum(MediaVariant),
});

export const signPortalPreviewSchema = z.object({
  requests: z
    .array(
      z.object({
        revisionId: z.string().uuid(),
        versionIds: z.array(z.string().uuid()).min(1).max(20),
      }),
    )
    .max(50),
});

export const PORTAL_PAGE_SIZE = 20;
