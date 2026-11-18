import { Images } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";
import { TooltipProvider } from "lost-ui/ui/tooltip";
import { DesignColorChips } from "@/components/shared/design/design-color-chips";
import { RailActionButton, RailToolGroup } from "@/components/shared/design/design-rail-button";
import type { DesignColors } from "@/hooks/shared/design/use-design-colors";
import { isDrawTool } from "@/lib/shared/design/arrange";
import {
  DESIGN_ENABLED_TOOLS,
  DESIGN_IMAGE_SHORTCUT_LABEL,
  type DesignTool,
  DesignToolGroup,
  type VisibleToolGroup,
  visibleToolGroups,
} from "@/lib/shared/design/types";

type Entry = { kind: "group"; item: VisibleToolGroup } | { kind: "image" };

type Remembered = Partial<Record<DesignToolGroup, DesignTool>>;

const entriesOf = (groups: readonly VisibleToolGroup[]): Entry[] =>
  groups.flatMap((item): Entry[] =>
    item.group === DesignToolGroup.Shapes
      ? [{ kind: "group", item }, { kind: "image" }]
      : [{ kind: "group", item }],
  );

const nextStop = (key: string, at: number, count: number): number | null => {
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowDown") return (at + 1) % count;
  if (key === "ArrowUp") return (at - 1 + count) % count;
  return null;
};

export function DesignToolRail({
  tool,
  onTool,
  onImage,
  full,
  colors,
  swatches,
}: {
  tool: DesignTool;
  onTool: (tool: DesignTool) => void;
  onImage: () => void;
  full: string | undefined;
  colors: DesignColors;
  swatches: string[];
}) {
  const groups = visibleToolGroups(DESIGN_ENABLED_TOOLS);
  const entries = entriesOf(groups);
  const [remembered, setRemembered] = useState<Remembered>({});
  const [focusIndex, setFocusIndex] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const owner = groups.find((item) => item.tools.includes(tool));
  if (owner !== undefined && remembered[owner.group] !== tool) {
    setRemembered({ ...remembered, [owner.group]: tool });
  }

  const reasonOf = (candidate: DesignTool) => (isDrawTool(candidate) ? full : undefined);

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey) return;
    const enabled = buttons.current.filter(
      (node): node is HTMLButtonElement => node !== null && !node.disabled,
    );
    const at = enabled.findIndex((node) => node === document.activeElement);
    const target = nextStop(event.key, at, enabled.length);
    if (target === null || enabled.length === 0) return;
    event.preventDefault();
    enabled[target]?.focus();
  };

  const stopProps = (index: number) => ({
    buttonRef: (node: HTMLButtonElement | null) => {
      buttons.current[index] = node;
    },
    tabIndex: focusIndex === index ? 0 : -1,
    onFocus: () => setFocusIndex(index),
  });

  return (
    <TooltipProvider delayDuration={250}>
      <div
        role="toolbar"
        aria-label="Ferramentas"
        aria-orientation="vertical"
        className="flex w-14 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r bg-card py-2"
        onKeyDown={move}
      >
        {entries.map((entry, index) => {
          if (entry.kind === "image") {
            return (
              <RailActionButton
                key="image"
                label="Imagem"
                shortcut={DESIGN_IMAGE_SHORTCUT_LABEL}
                icon={Images}
                disabledReason={full}
                onClick={onImage}
                {...stopProps(index)}
              />
            );
          }
          const { group, tools } = entry.item;
          const last = remembered[group];
          return (
            <RailToolGroup
              key={group}
              tools={tools}
              shown={last !== undefined && tools.includes(last) ? last : (tools[0] ?? tool)}
              active={tool}
              disabledReasonOf={reasonOf}
              onTool={onTool}
              {...stopProps(index)}
            />
          );
        })}
        <DesignColorChips colors={colors} swatches={swatches} />
      </div>
    </TooltipProvider>
  );
}
