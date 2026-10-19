import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import {
  acceptInvitationWithPassword,
  findPendingInvitation,
} from "@/lib/shared/auth/invitations/accept.server";
import { newInvitationToken } from "@/lib/shared/auth/invitations/token.server";
import {
  acceptInvitationSchema,
  createInvitationSchema,
  invitationIdSchema,
  resendInvitationSchema,
  invitationTokenSchema,
} from "@/lib/shared/auth/schemas";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { sendEmail } from "@/lib/shared/email/email.server";
import { invitationEmail } from "@/lib/shared/email/templates";
import { AppRoute } from "@/lib/shared/routes";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";
import { siteOrigin } from "@/lib/shared/site-url.server";

const INVITATION_DAYS = 7;
const DAY_MS = 86_400_000;
const FALLBACK_INVITER = "Alguém da equipe";

const createdSchema = z.object({ id: z.string().uuid() });

const grantRowSchema = z.array(
  z.object({ brand_id: z.string().uuid(), can_decide: z.boolean().optional() }),
);

const grantsToJson = (grants: { brandId: string; canDecide: boolean }[]) =>
  grants.map((grant) => ({ brand_id: grant.brandId, can_decide: grant.canDecide }));

const inviteLink = (token: string): string => `${siteOrigin()}${AppRoute.Admin}/invite/${token}`;

const expiresAt = (): string => new Date(Date.now() + INVITATION_DAYS * DAY_MS).toISOString();

type Delivery = { id: string; link: string; expiresAt: string; emailSent: boolean };

const deliver = async (input: {
  id: string;
  token: string;
  to: string;
  inviterName: string;
  sendEmail: boolean;
  expiresAt: string;
}): Promise<Delivery> => {
  const link = inviteLink(input.token);
  const sent = input.sendEmail
    ? await sendEmail(
        invitationEmail({
          to: input.to,
          link,
          inviterName: input.inviterName,
          days: INVITATION_DAYS,
        }),
      )
    : null;
  return { id: input.id, link, expiresAt: input.expiresAt, emailSent: sent?.ok === true };
};

export const createInvitation = createServerFn({ method: "POST" })
  .validator(createInvitationSchema)
  .handler(async ({ data }): Promise<Result<Delivery>> => {
    const caller = await requireActionServer(Action.Invitations.Create);
    if (caller === null) return denied;

    const { token, hash } = newInvitationToken();
    const expires = expiresAt();
    const { data: row, error } = await caller.supabase.rpc("invitation_create", {
      p_email: data.email,
      p_role: data.roleId,
      p_grants: grantsToJson(data.grants),
      p_token_hash: hash,
      p_expires_at: expires,
    });
    if (error) return fail(error);
    const created = parseOutput(createdSchema, row);
    if (!created.ok) return created;

    const { data: inviter } = await caller.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", caller.userId)
      .maybeSingle();
    const delivery = await deliver({
      id: created.id,
      token,
      to: data.email,
      inviterName: inviter?.full_name ?? FALLBACK_INVITER,
      sendEmail: data.sendEmail,
      expiresAt: expires,
    });
    return { ok: true, ...delivery };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .validator(invitationIdSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Invitations.Create);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("invitation_revoke", { p_invitation: data.id });
    if (error) return fail(error);
    return { ok: true };
  });

export const resendInvitation = createServerFn({ method: "POST" })
  .validator(resendInvitationSchema)
  .handler(async ({ data }): Promise<Result<Delivery>> => {
    const caller = await requireActionServer(Action.Invitations.Create);
    if (caller === null) return denied;

    const { data: old, error: readError } = await caller.supabase
      .from("invitations")
      .select("email, role_id, grants, status")
      .eq("id", data.id)
      .maybeSingle();
    if (readError) return fail(readError);
    if (old === null || old.status === "accepted") return fail({ message: "not_found" });

    const grants = grantRowSchema.safeParse(old.grants);
    if (!grants.success) return fail({ message: "unknown" });

    const { token, hash } = newInvitationToken();
    const expires = expiresAt();
    const { data: row, error } = await caller.supabase.rpc("invitation_create", {
      p_email: old.email,
      p_role: old.role_id,
      p_grants: grants.data,
      p_token_hash: hash,
      p_expires_at: expires,
    });
    if (error) return fail(error);
    const created = parseOutput(createdSchema, row);
    if (!created.ok) return created;

    const delivery = await deliver({
      id: created.id,
      token,
      to: old.email,
      inviterName: FALLBACK_INVITER,
      sendEmail: data.sendEmail,
      expiresAt: expires,
    });
    return { ok: true, ...delivery };
  });

export const previewInvitation = createServerFn({ method: "GET" })
  .validator(invitationTokenSchema)
  .handler(async ({ data }): Promise<Result<{ email: string; roleName: string }>> => {
    const preview = await findPendingInvitation(data.token);
    if (preview === null) return fail({ message: "invitation_invalid" });
    return { ok: true, ...preview };
  });

export const acceptInvitation = createServerFn({ method: "POST" })
  .validator(acceptInvitationSchema)
  .handler(async ({ data }): Promise<Result<{ kind: string }>> =>
    acceptInvitationWithPassword(data),
  );
