import { Smile } from "lucide-react";
import { Suspense, lazy } from "react";
import { Button } from "@/components/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shared/ui/popover";
import { Skeleton } from "@/components/shared/ui/skeleton";

const EmojiPickerPanel = lazy(() =>
  import("@/components/shared/admin/emoji-picker-panel").then((module) => ({
    default: module.EmojiPickerPanel,
  })),
);

export function EmojiPopover({
  onSelect,
  disabled = false,
}: {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 transition-[transform,opacity] hover:bg-transparent hover:text-foreground hover:opacity-60 active:scale-90 [&_svg]:size-6"
          aria-label="Inserir emoji"
          disabled={disabled}
        >
          <Smile aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        collisionPadding={8}
        className="border-0 p-0"
        style={{ width: "min(20rem, calc(100vw - 1rem))" }}
      >
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <EmojiPickerPanel width="100%" onSelect={onSelect} />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}
