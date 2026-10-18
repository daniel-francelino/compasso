import type { ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/shared/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shared/ui/tooltip";
import { cn } from "@/lib/shared/utils";

export function IconButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  disabledReason,
  destructive = false,
  variant = "ghost",
  delayDuration = 250,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean | undefined;
  disabledReason?: string | undefined;
  destructive?: boolean;
  variant?: ComponentProps<typeof Button>["variant"];
  delayDuration?: number;
}) {
  const button = (
    <Button
      type="button"
      variant={variant}
      size="icon"
      aria-label={disabledReason ? `${label}. ${disabledReason}` : label}
      disabled={disabled || !!disabledReason}
      className={cn(destructive && "text-destructive hover:text-destructive")}
      onClick={onClick}
    >
      <Icon aria-hidden="true" />
    </Button>
  );

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>
          {disabledReason ? (
            <span tabIndex={0} className="inline-flex rounded-md">
              {button}
            </span>
          ) : (
            button
          )}
        </TooltipTrigger>
        <TooltipContent className="max-w-64">{disabledReason ?? label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
