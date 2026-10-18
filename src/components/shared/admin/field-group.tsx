import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { InfoTip } from "@/components/shared/admin/info-tip";
import { cn } from "@/lib/shared/utils";

type Variant = "plain" | "section" | "boxed";

type Gap = "sm" | "md";

const gaps: Record<Gap, string> = {
  sm: "space-y-2",
  md: "space-y-4",
};

const fieldsets: Record<Variant, string> = {
  plain: "",
  section: "",
  boxed: "rounded-2xl border border-border px-4 pb-4 pt-1",
};

const legends: Record<Variant, string> = {
  plain: "mb-3 p-0 text-sm font-medium text-foreground",
  section: "mb-3 p-0 heading-card text-foreground",
  boxed: "px-1 text-sm font-semibold text-foreground",
};

export function FieldGroup({
  legend,
  icon: Icon,
  tip,
  hideLegend = false,
  variant = "plain",
  gap = "md",
  disabled,
  className,
  bodyClassName,
  children,
}: {
  legend: ReactNode;
  icon?: LucideIcon;
  tip?: { label: string; content: ReactNode } | undefined;
  hideLegend?: boolean;
  variant?: Variant;
  gap?: Gap;
  disabled?: boolean;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- this is the FieldGroup itself
    <fieldset disabled={disabled} className={cn("min-w-0", fieldsets[variant], className)}>
      <legend
        className={cn(
          hideLegend ? "sr-only" : "flex items-center gap-2",
          !hideLegend && legends[variant],
        )}
      >
        {Icon && !hideLegend ? (
          <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
        ) : null}
        {legend}
        {tip && !hideLegend ? <InfoTip label={tip.label}>{tip.content}</InfoTip> : null}
      </legend>
      <div className={bodyClassName ?? gaps[gap]}>{children}</div>
    </fieldset>
  );
}
