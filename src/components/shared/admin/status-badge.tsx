import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/shared/ui/badge";
import { cn } from "@/lib/shared/utils";

export type StatusTone = "success" | "negative" | "draft" | "info" | "warning" | "neutral";

const tones: Record<StatusTone, { box: string; icon: string; text: string }> = {
  success: {
    box: "border-success/40 bg-success/10",
    icon: "text-success",
    text: "text-foreground",
  },
  negative: {
    box: "border-danger/40 bg-danger/10",
    icon: "text-danger",
    text: "text-foreground",
  },
  draft: {
    box: "border-ink-soft/40 bg-ink-soft/10",
    icon: "text-ink-soft",
    text: "text-foreground",
  },
  info: { box: "border-info/40 bg-info/10", icon: "text-info", text: "text-foreground" },
  warning: {
    box: "border-warning/50 bg-warning/10",
    icon: "text-foreground",
    text: "text-foreground",
  },
  neutral: {
    box: "border-border bg-muted",
    icon: "text-muted-foreground",
    text: "text-muted-foreground",
  },
};

export function StatusBadge({
  tone,
  icon: Icon,
  children,
  className,
  iconClassName,
  title,
}: {
  tone: StatusTone;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
  iconClassName?: string;
  title?: string;
}) {
  const style = tones[tone];
  return (
    <Badge
      variant="outline"
      title={title}
      className={cn("gap-1.5", style.box, style.text, className)}
    >
      <Icon className={cn("size-3", style.icon, iconClassName)} aria-hidden="true" />
      {children}
    </Badge>
  );
}
