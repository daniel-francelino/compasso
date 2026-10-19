import { Link } from "@tanstack/react-router";
import { House } from "lucide-react";
import {
  Fragment,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/shared/ui/breadcrumb";
import { AppRoute } from "@/lib/shared/routes";
import type { FileRoutesByTo } from "@/routeTree.gen";

export type Crumb = { label: string; to?: keyof FileRoutesByTo };

const BreadcrumbItemsContext = createContext<Crumb[]>([]);
const SetBreadcrumbsContext = createContext<((items: Crumb[]) => void) | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Crumb[]>([]);
  return (
    <SetBreadcrumbsContext.Provider value={setItems}>
      <BreadcrumbItemsContext.Provider value={items}>{children}</BreadcrumbItemsContext.Provider>
    </SetBreadcrumbsContext.Provider>
  );
}

export function AppBreadcrumbs() {
  const items = useContext(BreadcrumbItemsContext);
  if (items.length === 0) return <div className="min-w-0 flex-1" />;

  return (
    <Breadcrumb aria-label="Localização na aplicação" className="min-w-0 flex-1 overflow-hidden">
      <BreadcrumbList className="flex-nowrap gap-x-1 overflow-hidden whitespace-nowrap sm:gap-x-2">
        {items.map((crumb, index) => {
          const current = index === items.length - 1;
          return (
            <Fragment key={`${crumb.to ?? crumb.label}-${index}`}>
              {index > 0 ? <BreadcrumbSeparator className="shrink-0" /> : null}
              <BreadcrumbItem className="min-w-0 max-w-[35%] shrink">
                {current ? (
                  <BreadcrumbPage className="block truncate py-2 font-medium text-foreground">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : crumb.to ? (
                  <BreadcrumbLink
                    asChild
                    className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2 text-violet-deep underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Link to={crumb.to}>
                      {crumb.to === AppRoute.Admin ? (
                        <House className="size-4 shrink-0" aria-hidden="true" />
                      ) : null}
                      <span className="truncate">{crumb.label}</span>
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <span className="truncate py-2">{crumb.label}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  leading,
}: {
  title: string;
  description?: string | undefined;
  breadcrumbs?: Crumb[] | undefined;
  actions?: ReactNode;
  leading?: ReactNode;
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
