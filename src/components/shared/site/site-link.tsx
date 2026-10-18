import type { ReactNode } from "react";
import type { ResolvedCta } from "@/lib/shared/content/published";

export function SiteButton({
  cta,
  variant = "primary",
}: {
  cta: ResolvedCta | undefined;
  variant?: "primary" | "secondary";
}): ReactNode {
  if (!cta || cta.label === "" || cta.href === "") return null;
  const style =
    variant === "primary"
      ? "bg-violet text-ivory hover:bg-violet-deep"
      : "border border-violet text-violet hover:bg-cream";
  return (
    <a
      href={cta.href}
      {...(cta.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`inline-flex min-h-11 items-center rounded-full px-6 py-2 text-sm font-medium transition-colors ${style}`}
    >
      {cta.label}
    </a>
  );
}
