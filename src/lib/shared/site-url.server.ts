import { getRequestUrl } from "@tanstack/react-start/server";

export const siteOrigin = (): string => {
  const configured = process.env["SITE_URL"];
  if (configured) return configured.replace(/\/+$/, "");
  return getRequestUrl().origin;
};
