import { timingSafeEqual } from "node:crypto";

export const isAuthorizedCron = (header: string | null): boolean => {
  const secret = process.env["CRON_SECRET"];
  if (!secret || header === null) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
};
