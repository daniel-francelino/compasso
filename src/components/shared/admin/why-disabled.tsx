import type { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shared/ui/tooltip";

export function WhyDisabled({
  reason,
  children,
  inMenu = false,
}: {
  reason: string | null | undefined;
  children: ReactNode;
  inMenu?: boolean;
}) {
  if (!reason) return <>{children}</>;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          {inMenu ? (
            <span className="block cursor-not-allowed">{children}</span>
          ) : (
            <span
              tabIndex={0}
              className="inline-flex rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              {children}
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent side={inMenu ? "left" : "top"} className="max-w-64">
          {reason}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
