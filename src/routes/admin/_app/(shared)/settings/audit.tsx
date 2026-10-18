import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AuditPage } from "@/components/shared/settings/audit/audit-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

const auditSearchSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).optional().catch(undefined),
  domain: z.string().max(40).optional().catch(undefined),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute("/admin/_app/(shared)/settings/audit")({
  beforeLoad: ({ context }) => requireAction(context, Action.Audit.View),
  validateSearch: auditSearchSchema,
  component: AuditPage,
});
