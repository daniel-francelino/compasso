# Authentication, invitations and accounts

> How a person gets an account in Compasso, how access is granted, and how the session and guards work. It applies to both internal users (team) and external users (clients who approve content in the portal). Access is verified **in the database** (RLS) and on the server, never only on screen. The mechanics (Supabase Auth, profiles with roles, account statuses, guards, audit) come from the Memoria Print project; Compasso differs in being **invitation only**, **email login only** and **brand-scoped**. Companion documents: [roles-and-actions.md](roles-and-actions.md), [notifications.md](notifications.md) and `technical-architecture-v0.1.md` (sections 7 and 8). UI texts are Brazilian Portuguese; everything else is English.

## 1. Goals

- **Nobody signs up on their own.** Public sign-up is disabled in Supabase Auth; every account is born from an invitation sent by someone with permission.
- An account has **no access to anything** until it is `approved` with a role. An invitation creates the account already `approved` with the invited role and brand links.
- Access is verified **in the database** (RLS) and on the server: hiding a button is never security.
- Internal and external users share one identity pool; they differ by **role** (set of actions) and **brand links**.

## 2. Flow summary

```
Invite (email, role, brands)
       │  link /admin/invite/<token>  (expires, single use)
       ▼
Open link ──▶ email shown ──▶ set password ──▶ account approved with role + brand links
                                                        │
                           internal → /admin     external → /portal
```

Revoked or expired invitations stop working. A suspended account loses access immediately (new operations are refused; already issued signed file URLs expire by themselves within minutes).

## 3. Account statuses

Stored in `profiles.status`:

| Status | Meaning | What the person sees |
|---|---|---|
| `pending` | Account exists but has no decision (only for accounts created outside the invitation flow) | Screen "Seu acesso está sendo analisado" |
| `approved` | Active, with an assigned role | Back office or portal, according to the role |
| `rejected` | Access refused | Screen "Não foi possível aprovar o acesso" |
| `suspended` | Access removed after being approved | Screen "Acesso suspenso" |

Rules:

- Only `approved` with a defined `role` gives access to data.
- An account **without a role cannot be approved**.
- Status and role only change through administration (section 6).
- `profiles.kind` is `internal` or `external` and must match the kind of the brand links and of the role (an external role only contains portal actions).

## 4. Invitations

Own table `invitations` (not only Supabase's `inviteUserByEmail`), because we need to grant specific brands, expire, revoke and control use.

1. Whoever has `invitations.create` fills in: email, role, brands and, for external users, whether they may **decide** approvals (`can_decide`).
2. The server creates a random 32-byte token (base64url), stores **only its SHA-256 hash**, sets `expires_at` (7 days) and returns the link `/admin/invite/<token>` to the person who invited. Sending the email is **optional** (a switch in the dialog, off by default): with it off, the person copies the link and hands it to the invitee through any channel (for example WhatsApp). The link is shown only once, in the "Link de acesso" dialog, because only the hash is stored.
3. The recipient opens the page: the server validates the hash, the expiry and the `pending` status, and shows the invited email.
4. They set a password (minimum 10 characters). Acceptance requires the **authenticated email to equal the invited email**.
5. In one transaction (RPC `accept_invitation`): mark the invitation `accepted`, create the profile `approved` with the role, create the `brand_members`, write the audit event, notify the inviter (`invitation.accepted`).
6. Revoking an invitation makes it `revoked`. An accepted invitation cannot be reused. Re-inviting the same email creates a new invitation and revokes the previous pending one.

Email delivery failure never blocks the process. The invitation stays visible in Settings with two actions that issue a **new** link (the previous pending invitation is revoked): "Gerar novo link" (shows it to copy, no email) and "Reenviar por e-mail" (sends it and also shows it).

## 5. Screens

All under `/admin` (the portal uses the same login), in Brazilian Portuguese and with the Compasso design system.

| Route | Who | Description |
|---|---|---|
| `/admin/login` | Public | Email + password. Link to recover the password. No sign-up link |
| `/admin/invite/$token` | Public, with a valid token | Accept the invitation and set the password |
| `/admin/confirm-email` | Public | Message "Verifique seu e-mail" (when email confirmation is required) |
| `/admin/recover-password` | Public | Asks for an email to receive a recovery link |
| `/admin/reset-password` | With a valid link | Sets a new password |
| `/admin/pending` | Authenticated, `pending` | Request status; sign-out button |
| `/admin/access-denied` | Authenticated, `rejected`/`suspended` | Message suited to the status |
| `/admin/settings/users` | `users.view`; specific actions to manage | List of users and invitations; invite (copyable link, optional email), new link, resend by email, revoke, change role, change brand links, suspend, reactivate |
| `/admin/profile` | Approved | Change name and password |

### "Users" screen (Settings)

- Tabs: **Ativos**, **Convites pendentes** (with counter), **Suspensos**.
- Each row: name, email, creation date, status, role, brands.
- Actions: **Invite** (generates the access link; email optional), **New link**, **Resend by email**, **Revoke invitation**, **Change role**, **Edit brand links** (`brands.manage_members`), **Suspend**, **Reactivate**.
- Protections: nobody changes their **own role** or suspends themselves; the system **never removes or suspends the last active Owner**.
- Each decision is recorded (who, when, what) in `profile_audit`.

## 6. Data model and protection

The executable source is the authentication migration of Compasso (derived from the Memoria Print one). Do not copy snippets from documents into the SQL Editor.

| Entity | Responsibility |
|---|---|
| `profiles` | Identity, email, status, `kind`, `role_id`; approval requires a role |
| `roles` / `actions` / `role_actions` | Roles, permission catalog and dependencies ([roles-and-actions.md](roles-and-actions.md)) |
| `brand_members` | Brand links (`kind`, `can_decide`, `status`) |
| `invitations` | Invitations with hashed token, expiry and status |
| `profile_audit` / `role_audit` | History of access decisions and role changes |

`is_admin()`, `has_action(p_action)`, `my_actions()`, `can_access_brand(p_brand)` and `is_external_brand_member(p_brand, p_must_decide)` resolve authorization from the approved account, its role and its brand links.

| Operation on profiles | Rule |
|---|---|
| Read | Own profile, or `users.view` for the others |
| Edit own data | Allowed personal fields; never status/role/kind through this path |
| Invite / revoke | `invitations.create` (and `users.view`) |
| Change role, suspend, reactivate | `users.manage`, with self-change and last-Owner protections |
| Insert/delete by the client | Not allowed; creation through the invitation flow only |

Row policies and triggers protect columns, transitions and audit. Server functions check actions before writing. Changing permissions affects new server checks immediately; screens and caches must reflect the change, without confusing already displayed data with authorization for new operations.

## 7. First Owner (bootstrap)

The first `owner` is **not** created by a migration with a password. The script `scripts/seed-owner.mjs` reads `OWNER_EMAIL` and `OWNER_PASSWORD` from the environment, creates the user through the Supabase Admin API (email confirmed), and promotes the profile to `approved` with the `owner` role. It is idempotent: if the email already exists, it does not change the password; it only guarantees the approved `owner` profile.

- The variables exist only at seed time and are never versioned.
- There is no route or "secret" key for anyone to become Owner through the application.
- After the first sign-in, change the password in Profile and **invite a second Owner**, so access is never lost.

## 8. Implementation (TanStack Start + Supabase)

### Dependencies and configuration

- `@supabase/supabase-js` and `@supabase/ssr` (session in cookies, so the server can read the user).
- Environment variables:

| Variable | Where | Note |
|---|---|---|
| `VITE_SUPABASE_URL` | Client + server | Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Client + server | Public key; safe **because** RLS is on |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Invitation acceptance, jobs, audit; never with the `VITE_` prefix, never on the client or in the repository |

- Versioned SQL migrations in `supabase/migrations/`; `.env*` files outside git.

### Structure

```
src/
  lib/shared/supabase/      client.ts (browser) · server-client.server.ts (cookies) · anon-client.server.ts · admin.server.ts (service role) · database.types.ts
  lib/shared/               env.ts (public) · env.server.ts (secrets)
  lib/shared/auth/          types.ts · actions.ts (Action.*) · schemas.ts · redirect.ts · errors.ts
                            session.functions.ts (getAuthState) · login.functions.ts (signIn, signOut) · users.functions.ts · invitations.functions.ts
                            guards.ts (requireAction) · server-guards.server.ts (requireActionServer returns the caller or null) · permissions.ts (can) · use-sign-out.ts
  components/shared/admin/  auth-shell.tsx
  routes/admin/             login · invite.$token · recover-password · reset-password · callback
                            confirm-email · pending · access-denied
  routes/admin/_app.tsx     protected layout (guard)
  routes/portal/_app.tsx    portal layout (guard for portal.view)
```

### Route guards

The protected layouts use `beforeLoad` to decide the destination:

| Situation | Destination |
|---|---|
| No session | `/admin/login` (keeping the requested route) |
| `pending` | `/admin/pending` |
| `rejected` / `suspended` | `/admin/access-denied` |
| `approved`, back office actions | `/admin` |
| `approved`, only portal actions | `/portal` |

Guards **improve the experience**; the real protection is in RLS and in the server functions. `requireAction(context, Action.X.Y)` guards each restricted page.

### Administration actions

Invite, revoke, change role, suspend and reactivate are **server functions** that: (1) validate the input with zod; (2) confirm on the server the required action and let the database validate the transition and the assignable role; (3) write with the user's client (RLS and triggers validate), using the service role only where indicated; (4) return clear errors in Brazilian Portuguese.

### Security

- **Mandatory email confirmation** and **minimum password of 10 characters**; enable the leaked-password protection of Supabase.
- **Request limits** on Auth endpoints and on invitation acceptance; consider CAPTCHA (Turnstile) on public forms.
- **Generic messages** on login ("E-mail ou senha incorretos"), without revealing whether the email exists.
- **CSRF protection** in `src/start.ts` for server functions.
- **Redirect URLs**: configure the allowed redirect URLs (production and preview) in Supabase.
- **Sign-out** clears the cookies and the TanStack Query cache.
- No `service_role` in the browser; no `user_metadata` for access decisions.
- **MFA (TOTP)** for Owners in phase 6; optional for others later.
- **SMTP of its own** in production (the default Supabase email service has low limits); Auth emails customized in Brazilian Portuguese.

## 9. Screen texts (UI copy, proposals in Brazilian Portuguese)

Tone: calm and direct.

| Screen | Text |
|---|---|
| Invitation | "Você foi convidado(a) para acessar o Compasso. Defina uma senha para entrar." |
| Invalid or expired invitation | "Este convite expirou ou já foi usado. Peça um novo convite a quem o enviou." |
| Pending | "Seu acesso está sendo analisado pela equipe. Assim que for aprovado, você poderá entrar." |
| Refused | "Não foi possível aprovar o acesso a esta conta. Se acha que é um engano, fale com a equipe." |
| Suspended | "O acesso desta conta está suspenso. Fale com a equipe para reativá-lo." |
| Invalid login | "E-mail ou senha incorretos." |
| Recovery sent | "Enviamos um link para o seu e-mail. Abra-o para criar uma nova senha." |

## 10. Manual configuration (Supabase panel; not stored in the repository)

- [ ] **Public sign-up disabled** (`enable_signup = false`).
- [ ] **Email confirmation** enabled; minimum password 10; leaked-password protection on.
- [ ] **Redirect URLs**: `http://localhost:<port>/admin/callback` plus production and preview equivalents; **Site URL** set.
- [ ] **Rate limits** reviewed.
- [ ] **Own SMTP** configured and templates customized.
- [ ] **Owner seed** executed (section 7); second Owner invited.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set only in server secrets; `VITE_*` set in production and preview.

### Known limitations

- Confirmation and recovery links only work in the **same browser** where they were requested (PKCE flow). Opened elsewhere, the `callback` screen shows "Link inválido" and a new one must be requested.
- Signed file URLs already issued stay valid until they expire (a few minutes), even after access is revoked.

## 11. Acceptance criteria

- [ ] There is no public sign-up route; a direct call to the sign-up endpoint is refused.
- [ ] An invitation accepted with a different email is refused; an expired, revoked or used invitation does not work.
- [ ] An accepted invitation creates exactly the role and brand links of the invitation.
- [ ] A `pending` account reads **zero data** through the public API (test with the public key).
- [ ] A person **cannot change their own role or status**, even by calling the API directly.
- [ ] Changing a role, revoking a brand link or suspending an account **takes effect immediately**, even with an open session.
- [ ] The last active Owner cannot be removed or suspended; nobody can change their own role.
- [ ] An external user is redirected to `/portal` and cannot open `/admin` routes.
- [ ] All access decisions are recorded in `profile_audit`.
- [ ] Password recovery works end to end.
- [ ] The `service_role` key does not appear in client code or in the repository; no password exists in any migration.

## 12. Open questions

1. How many Owners at the start? (At least two are recommended.)
2. Is an extra pre-created role needed right away (for example a read-only role for an accountant)?
3. Should external approvers also be required to use MFA?
4. What session duration is acceptable on shared devices?
5. Should the team receive an email when an invitation is accepted, besides the in-app notification?

## Implementation status

Phase 0 (2026-10-18). Done: migration `20261018100100_auth_roles_profiles.sql` (roles, actions, role_actions, profiles, access audit, guards, `is_admin`/`has_action`/`my_actions`, seeds), `Action` constants, `getAuthState`, `signIn`/`signOut`, route guards, `/admin/login`, `/admin/pending`, `/admin/access-denied`, `/admin/forbidden`, `/admin` and `/portal` layouts, `scripts/seed-owner.mjs`, pgTAP file `supabase/tests/01_auth_roles_profiles.test.sql` (61 assertions).

Validation performed: 61 SQL assertions on PGlite (`npm run db:verify`); typecheck and lint; 3 Playwright tests for the unauthenticated flows. **Not tested**: login with a real Supabase, authenticated redirects, `seed-owner` against a real project, `supabase test db` (see [../pending-external-setup.md](../pending-external-setup.md) V1, V3–V5). **Pending**: invitations, users and roles screens (P1-01, P1-02), password recovery and reset screens, MFA (P6-01).
