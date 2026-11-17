import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { Label } from "@/components/shared/ui/label";
import { cn } from "@/lib/shared/utils";

export type GalleryTab = { value: string; label: string; icon: typeof Search };

export function DesignGalleryHero({
  tabs,
  status,
  onStatusChange,
  search,
  onSearchChange,
  children,
}: {
  tabs: readonly GalleryTab[];
  status: string;
  onStatusChange: (status: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby="design-gallery-title"
      className="rounded-2xl bg-linear-to-br from-info/15 via-surface to-violet/20 px-4 py-8 sm:px-8 sm:py-10"
    >
      <h2
        id="design-gallery-title"
        className="text-center text-3xl font-semibold tracking-tight text-ink sm:text-5xl"
      >
        O que vamos{" "}
        <span className="bg-linear-to-r from-violet to-orchid bg-clip-text text-transparent">
          criar
        </span>{" "}
        hoje?
      </h2>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {tabs.map((tab) => {
          const active = tab.value === status;
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={active}
              onClick={() => onStatusChange(tab.value)}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring sm:min-h-9",
                active
                  ? "border-violet bg-violet/15 text-ink"
                  : "border-line-strong bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="relative mx-auto mt-6 max-w-3xl">
        <Label htmlFor="design-gallery-search" className="sr-only">
          Buscar designs pelo nome
        </Label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id="design-gallery-search"
          type="search"
          value={search}
          maxLength={100}
          placeholder="Buscar designs pelo nome"
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-14 w-full rounded-2xl border-2 border-violet/60 bg-surface pr-5 pl-14 text-base text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:border-violet focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet/20"
        />
      </div>
      <div className="mt-8">{children}</div>
    </section>
  );
}
