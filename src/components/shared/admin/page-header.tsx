import { useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BreadcrumbItemsContext,
  SetBreadcrumbsContext,
  type Crumb,
} from "@/components/shared/admin/breadcrumb-context";
import { AppRoute } from "@/lib/shared/routes";

export type { Crumb };

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Crumb[]>([]);
  return (
    <SetBreadcrumbsContext.Provider value={setItems}>
      <BreadcrumbItemsContext.Provider value={items}>{children}</BreadcrumbItemsContext.Provider>
    </SetBreadcrumbsContext.Provider>
  );
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  leading,
  compact = false,
  middle,
}: {
  title: string;
  description?: string | undefined;
  breadcrumbs?: Crumb[] | undefined;
  actions?: ReactNode;
  leading?: ReactNode;
  compact?: boolean;
  middle?: ReactNode;
}) {
  const setItems = useContext(SetBreadcrumbsContext);
  const stableItems = useMemo((): Crumb[] => {
    const trail = breadcrumbs ?? [{ label: title }];
    return trail.length > 0 && trail[0]?.to !== AppRoute.Admin
      ? [{ label: "Início", to: AppRoute.Admin }, ...trail]
      : trail;
  }, [title, breadcrumbs]);
  useEffect(() => {
    setItems?.(stableItems);
    return () => setItems?.([]);
  }, [setItems, stableItems]);

  if (compact) {
    return (
      <header>
        <h1 className="sr-only">{title}</h1>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">{middle}</div>
          {actions ? (
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{actions}</div>
          ) : null}
        </div>
      </header>
    );
  }

  return (
    <header>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-72 items-center gap-3">
          {leading}
          <div className="min-w-0">
            <h1 className="heading-page text-foreground">{title}</h1>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
