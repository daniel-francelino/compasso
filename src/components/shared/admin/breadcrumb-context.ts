import { createContext, useContext } from "react";
import type { FileRoutesByTo } from "@/routeTree.gen";

export type Crumb = { label: string; to?: keyof FileRoutesByTo };

export const BreadcrumbItemsContext = createContext<Crumb[]>([]);
export const SetBreadcrumbsContext = createContext<((items: Crumb[]) => void) | null>(null);

export const useBreadcrumbItems = (): Crumb[] => useContext(BreadcrumbItemsContext);
