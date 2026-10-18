import { createHash, randomBytes } from "node:crypto";

export const newInvitationToken = (): { token: string; hash: string } => {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInvitationToken(token) };
};

export const hashInvitationToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
