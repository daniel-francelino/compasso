import {
  Circle,
  Hand,
  Images,
  type LucideIcon,
  Minus,
  MousePointer2,
  Square,
  Type,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/shared/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shared/ui/tooltip";
import { isDrawTool } from "@/lib/shared/design/arrange";
import {
  DESIGN_IMAGE_KEY,
  DESIGN_TOOL_KEY,
  DESIGN_TOOL_LABEL,
  DesignTool,
} from "@/lib/shared/design/types";
import { cn } from "@/lib/shared/utils";

const ICONS: Record<DesignTool, LucideIcon> = {
  [DesignTool.Move]: MousePointer2,
  [DesignTool.Text]: Type,
  [DesignTool.Rect]: Square,
  [DesignTool.Ellipse]: Circle,
  [DesignTool.Line]: Minus,
  [DesignTool.Hand]: Hand,
  [DesignTool.Zoom]: ZoomIn,
};

const GROUPS: DesignTool[][] = [
  [DesignTool.Move],
  [DesignTool.Text, DesignTool.Rect, DesignTool.Ellipse, DesignTool.Line],
  [DesignTool.Hand, DesignTool.Zoom],
];

function RailButton({
  label,
  shortcut,
  icon: Icon,
  pressed,
  disabledReason,
  onClick,
}: {
  label: string;
  shortcut: string;
  icon: LucideIcon;
  pressed?: boolean;
  disabledReason?: string | undefined;
  onClick: () => void;
}) {
  const title = `${label} (${shortcut.toUpperCase()})`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={disabledReason === undefined ? title : `${title}. ${disabledReason}`}
          aria-pressed={pressed}
          disabled={disabledReason !== undefined}
          className={cn("size-11", pressed && "bg-accent text-accent-foreground")}
          onClick={onClick}
        >
          <Icon aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-64">
        {disabledReason ?? title}
      </TooltipContent>
    </Tooltip>
  );
}

export function DesignToolRail({
  tool,
  onTool,
  onImage,
  full,
}: {
  tool: DesignTool;
  onTool: (tool: DesignTool) => void;
  onImage: () => void;
  full: string | undefined;
}) {
  return (
    <TooltipProvider delayDuration={250}>
      <div
        role="toolbar"
        aria-label="Ferramentas"
        aria-orientation="vertical"
        className="flex w-14 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r bg-card py-2"
      >
        {GROUPS.map((group, index) => (
          <div
            key={group.join("-")}
            className={cn("flex flex-col items-center gap-1", index > 0 && "border-t pt-1")}
          >
            {group.map((item) => (
              <RailButton
                key={item}
                label={DESIGN_TOOL_LABEL[item]}
                shortcut={DESIGN_TOOL_KEY[item]}
                icon={ICONS[item]}
                pressed={tool === item}
                disabledReason={isDrawTool(item) ? full : undefined}
                onClick={() => onTool(item)}
              />
            ))}
            {index === 1 ? (
              <RailButton
                label="Imagem"
                shortcut={DESIGN_IMAGE_KEY}
                icon={Images}
                disabledReason={full}
                onClick={onImage}
              />
            ) : null}
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
