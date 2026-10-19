import { Link } from "@tanstack/react-router";
import { LayoutGrid } from "lucide-react";
import { useState } from "react";
import type { AdminSpace, SpaceEntry } from "@/components/shared/admin/nav-config";
import { Button } from "@/components/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shared/ui/popover";
import { Space } from "@/lib/shared/enums";
import { cn } from "@/lib/shared/utils";

const tileTone: Record<AdminSpace, string> = {
  [Space.Marketing]: "bg-primary text-primary-foreground",
  [Space.Cms]: "bg-secondary text-secondary-foreground",
};

export function SpaceSwitcher({ spaces, current }: { spaces: SpaceEntry[]; current: AdminSpace }) {
  const [open, setOpen] = useState(false);

  if (spaces.length < 2) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Trocar de espaço">
          <LayoutGrid aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 max-w-[calc(100vw-2rem)] p-3">
        <p className="px-1 pb-2 text-sm font-medium text-foreground">Espaços</p>
        <ul className="grid grid-cols-2 gap-2">
          {spaces.map((space) => (
            <li key={space.key}>
              <Link
                to={space.to}
                aria-current={space.key === current ? "page" : undefined}
                className={cn(
                  "flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-xl p-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  space.key === current && "bg-accent",
                )}
                onClick={() => setOpen(false)}
              >
                <span
                  className={cn(
                    "flex size-12 items-center justify-center rounded-2xl",
                    tileTone[space.key],
                  )}
                >
                  <space.icon className="size-6" aria-hidden="true" />
                </span>
                <span className="text-center text-xs font-medium leading-tight text-foreground">
                  {space.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
