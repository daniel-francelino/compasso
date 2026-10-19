import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/shared/utils";

export function IconTile({ icon: Icon, size = "md" }: { icon: LucideIcon; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground",
        size === "md" ? "size-10 [&_svg]:size-5" : "size-8 [&_svg]:size-4",
      )}
    >
      <Icon />
    </span>
  );
}
