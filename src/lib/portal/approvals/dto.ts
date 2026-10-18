import { z } from "zod";
import { ApprovalOutcome, ApprovalRequestStatus } from "@/lib/shared/enums";

export const portalRequestRowSchema = z.object({
  id: z.string().uuid(),
  variant_id: z.string().uuid(),
  status: z.nativeEnum(ApprovalRequestStatus),
  title: z.string(),
  format: z.string(),
  platform: z.string(),
  profile_name: z.string(),
  planned_at: z.string().nullable(),
  planned_timezone: z.string().nullable(),
  brand_timezone: z.string().nullable(),
  revision_no: z.number().int(),
  due_date: z.string().nullable(),
  requested_at: z.string(),
  decided_at: z.string().nullable(),
  is_mine: z.boolean(),
  approver_name: z.string().nullable(),
});

export type PortalRequestRow = z.infer<typeof portalRequestRowSchema>;

export const portalBrandsSchema = z.object({
  list: z.array(
    z.object({ id: z.string().uuid(), name: z.string(), pending_count: z.number().int() }),
  ),
});

export const portalPendingSchema = z.object({ list: z.array(portalRequestRowSchema) });

export const portalPageSchema = z.object({
  total: z.number().int(),
  rows: z.array(portalRequestRowSchema),
});

export const portalApprovalSchema = z.object({
  request: portalRequestRowSchema,
  brand_id: z.string().uuid(),
  brand_name: z.string(),
  message: z.string().nullable(),
  caption: z.object({ text: z.string() }).nullable(),
  call_to_action: z.string().nullable(),
  revision_id: z.string().uuid(),
  is_current: z.boolean(),
  current_request_id: z.string().uuid().nullable(),
  is_designated: z.boolean(),
  can_decide: z.boolean(),
  media: z.array(
    z.object({
      version_id: z.string().uuid(),
      position: z.number().int(),
      alt_text: z.string().nullable(),
      mime_type: z.string(),
      width: z.number().int().nullable(),
      height: z.number().int().nullable(),
      name: z.string(),
      has_thumb: z.boolean(),
      has_display: z.boolean(),
    }),
  ),
  decision: z
    .object({
      outcome: z.nativeEnum(ApprovalOutcome),
      comment: z.string().nullable(),
      decided_at: z.string(),
      decided_by_name: z.string().nullable(),
    })
    .nullable(),
  history: z.array(
    z.object({
      request_id: z.string().uuid(),
      revision_no: z.number().int(),
      status: z.nativeEnum(ApprovalRequestStatus),
      requested_at: z.string(),
      decided_at: z.string().nullable(),
      comment: z.string().nullable(),
    }),
  ),
});

export const portalCommentsSchema = z.object({
  list: z.array(
    z.object({
      id: z.string().uuid(),
      body: z.string(),
      created_at: z.string(),
      author_name: z.string(),
      mine: z.boolean(),
      from_team: z.boolean(),
      revision_no: z.number().int().nullable(),
    }),
  ),
});

export const portalMediaKeysSchema = z.object({
  list: z.array(
    z.object({
      version_id: z.string().uuid(),
      storage_key: z.string(),
      thumb_key: z.string().nullable(),
      display_key: z.string().nullable(),
      mime_type: z.string(),
      name: z.string(),
    }),
  ),
});
