import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/shared/ui/breadcrumb";
import { getPortalBrand } from "@/lib/portal/approvals/portal.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { useQuery } from "@tanstack/react-query";

export function PortalBreadcrumbs() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const params = useParams({ strict: false });
  const brandId = "brandId" in params ? params.brandId : undefined;
  const brand = useQuery({
    queryKey: QueryKey.Portal.brand(brandId ?? ""),
    queryFn: async () =>
      unwrapResult(await getPortalBrand({ data: { brandId: brandId ?? "" } })).brand,
    enabled: brandId !== undefined,
  });
  const paths = pathname.split("/").filter(Boolean);
  const page = paths.at(-1);
  const requestDetail =
    page !== undefined && page !== "calendar" && page !== "approvals" && page !== brandId;
  const crumbs = brandId
    ? [
        { label: "Início", to: "/portal" as const },
        {
          label: brand.data?.name ?? "Marca",
          to: "/portal/brands/$brandId" as const,
          params: { brandId },
        },
        ...(page === "calendar"
          ? [{ label: "Calendário" }]
          : page === "approvals"
            ? [{ label: "Aprovações" }]
            : requestDetail
              ? [
                  {
                    label: "Aprovações",
                    to: "/portal/brands/$brandId/approvals" as const,
                    params: { brandId },
                  },
                  { label: "Revisão" },
                ]
              : [{ label: "Painel" }]),
      ]
    : page === "notifications"
      ? [{ label: "Início", to: "/portal" as const }, { label: "Avisos" }]
      : page === "profile"
        ? [{ label: "Início", to: "/portal" as const }, { label: "Meu perfil" }]
        : [{ label: "Início" }];

  return (
    <Breadcrumb
      aria-label="Localização no portal do cliente"
      className="min-w-0 flex-1 overflow-hidden"
    >
      <BreadcrumbList className="flex-nowrap gap-x-1 overflow-hidden whitespace-nowrap sm:gap-x-2">
        {crumbs.map((crumb, index) => {
          const current = index === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              {index > 0 ? <BreadcrumbSeparator className="shrink-0" /> : null}
              <BreadcrumbItem className="min-w-0 max-w-[35%] shrink">
                {current ? (
                  <BreadcrumbPage className="block truncate py-2 font-medium text-foreground">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : crumb.to === "/portal/brands/$brandId" ? (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.to} params={crumb.params}>
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                ) : crumb.to ? (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.to}>{crumb.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
