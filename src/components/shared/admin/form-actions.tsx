import type { ReactNode } from "react";
import { cn } from "@/lib/shared/utils";

export function FormActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap justify-end gap-2", className)}>{children}</div>;
}
