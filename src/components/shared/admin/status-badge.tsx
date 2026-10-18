import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { type StatusTone, statusTones } from "@/components/shared/admin/status-tones";
import { Badge } from "@/components/shared/ui/badge";
import { cn } from "@/lib/shared/utils";

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
  const style = statusTones[tone];
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
