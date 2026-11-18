import { type KeyboardEvent, useRef, useState } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "lost-ui/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "lost-ui/ui/tooltip";
import { DESIGN_TOOL_ICON } from "@/components/shared/design/design-tool-icons";
import { Button } from "@/components/shared/ui/button";
import { DESIGN_TOOL_KEY, DESIGN_TOOL_LABEL, type DesignTool } from "@/lib/shared/design/types";
import { cn } from "@/lib/shared/utils";

const LONG_PRESS_MS = 450;

const FLYOUT_STEP: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

type ButtonShared = {
  buttonRef: (node: HTMLButtonElement | null) => void;
  tabIndex: number;
  onFocus: () => void;
  disabledReason: string | undefined;
};

const titleOf = (tool: DesignTool) =>
  `${DESIGN_TOOL_LABEL[tool]} (${DESIGN_TOOL_KEY[tool].toUpperCase()})`;

export function RailActionButton({
  label,
  shortcut,
  icon: Icon,
  buttonRef,
  tabIndex,
  onFocus,
  disabledReason,
  onClick,
}: ButtonShared & {
  label: string;
  shortcut: string;
  icon: (typeof DESIGN_TOOL_ICON)[DesignTool];
  onClick: () => void;
}) {
  const title = `${label} (${shortcut})`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={buttonRef}
          type="button"
          variant="ghost"
          size="icon"
          tabIndex={tabIndex}
          aria-label={disabledReason === undefined ? title : `${title}. ${disabledReason}`}
          disabled={disabledReason !== undefined}
          className="size-11"
          onFocus={onFocus}
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

export function RailToolGroup({
  tools,
  shown,
  active,
  buttonRef,
  tabIndex,
  onFocus,
  disabledReasonOf,
  onTool,
}: Omit<ButtonShared, "disabledReason"> & {
  tools: readonly DesignTool[];
  shown: DesignTool;
  active: DesignTool;
  disabledReasonOf: (tool: DesignTool) => string | undefined;
  onTool: (tool: DesignTool) => void;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressed = useRef(false);
  const own = useRef<HTMLButtonElement | null>(null);
  const more = tools.length > 1;
  const Icon = DESIGN_TOOL_ICON[shown];
  const disabledReason = disabledReasonOf(shown);
  const title = titleOf(shown);

  const setRef = (node: HTMLButtonElement | null) => {
    own.current = node;
    buttonRef(node);
  };

  const clearTimer = () => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
  };

  const startPress = () => {
    if (!more) return;
    clearTimer();
    timer.current = setTimeout(() => {
      pressed.current = true;
      setOpen(true);
    }, LONG_PRESS_MS);
  };

  const click = () => {
    clearTimer();
    if (pressed.current) {
      pressed.current = false;
      return;
    }
    onTool(shown);
  };

  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!more || !event.altKey || event.key !== "ArrowDown") return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  };

  const flyoutKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
    const index = items.findIndex((item) => item === document.activeElement);
    const step = FLYOUT_STEP[event.key];
    if (step === undefined) return;
    event.preventDefault();
    items[(index + step + items.length) % items.length]?.focus();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <PopoverAnchor asChild>
          <div className="relative">
            <TooltipTrigger asChild>
              <Button
                ref={setRef}
                type="button"
                variant="ghost"
                size="icon"
                tabIndex={tabIndex}
                aria-label={disabledReason === undefined ? title : `${title}. ${disabledReason}`}
                aria-pressed={tools.includes(active)}
                aria-haspopup={more ? "true" : undefined}
                aria-expanded={more ? open : undefined}
                disabled={disabledReason !== undefined}
                className={cn(
                  "size-11",
                  tools.includes(active) && "bg-accent text-accent-foreground",
                )}
                onFocus={onFocus}
                onClick={click}
                onPointerDown={startPress}
                onPointerUp={clearTimer}
                onPointerLeave={clearTimer}
                onPointerCancel={clearTimer}
                onKeyDown={keyDown}
                onContextMenu={(event) => {
                  if (!more) return;
                  event.preventDefault();
                  setOpen(true);
                }}
              >
                <Icon aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            {more ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-1 right-1 size-0 border-4 border-transparent border-b-muted-foreground border-r-muted-foreground"
              />
            ) : null}
          </div>
        </PopoverAnchor>
        <TooltipContent side="right" className="max-w-64">
          {disabledReason ?? (more ? `${title}. Alt+Seta para baixo: mais ferramentas` : title)}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-auto min-w-52 p-1"
        onKeyDown={flyoutKey}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          own.current?.focus();
        }}
      >
        <div role="group" aria-label="Mais ferramentas" className="flex flex-col">
          {tools.map((tool) => {
            const ToolIcon = DESIGN_TOOL_ICON[tool];
            const reason = disabledReasonOf(tool);
            return (
              <Button
                key={tool}
                type="button"
                variant="ghost"
                aria-pressed={active === tool}
                disabled={reason !== undefined}
                className={cn(
                  "h-11 justify-start gap-2 px-3 text-sm",
                  active === tool && "bg-accent text-accent-foreground",
                )}
                onClick={() => {
                  setOpen(false);
                  onTool(tool);
                }}
              >
                <ToolIcon aria-hidden="true" />
                <span className="flex-1 text-left">{DESIGN_TOOL_LABEL[tool]}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {DESIGN_TOOL_KEY[tool].toUpperCase()}
                </span>
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
