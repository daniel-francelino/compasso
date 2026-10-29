import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { InfoTip } from "@/components/shared/admin/info-tip";

export const propertyControlClass =
  "border-transparent bg-transparent shadow-none hover:bg-muted/60 data-[state=open]:bg-muted/60";

export function PropertyRow({
  icon: Icon,
  label,
  tip,
  children,
}: {
  icon: LucideIcon;
  label: string;
  tip?: { label: string; content: ReactNode };
  children: ReactNode;
}) {
  return (
    <div className="grid gap-x-4 gap-y-1 rounded-md py-1 sm:grid-cols-[11rem_minmax(0,1fr)]">
      <div className="flex min-h-10 items-center gap-2 text-sm text-muted-foreground">
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        <span>{label}</span>
        {tip ? <InfoTip label={tip.label}>{tip.content}</InfoTip> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
