import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  ExternalLink,
  FileText,
  Megaphone,
  Share2,
  Target,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { BrandAvatar } from "@/components/shared/admin/brand-avatar";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { IconTile } from "@/components/shared/admin/icon-tile";
import { SectionCard } from "@/components/shared/admin/section-card";
import { PlatformIcon } from "@/components/shared/preview/platform-icon";
import { Skeleton } from "@/components/shared/ui/skeleton";
import { getPortalBrand } from "@/lib/portal/approvals/portal.functions";
import type { PortalBrandProfile } from "@/lib/portal/approvals/types";
import type { Platform } from "@/lib/shared/enums";
import { platformLabels } from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

type Detail = { icon: LucideIcon; label: string; value: string | null };

const detailsOf = (brand: PortalBrandProfile): Detail[] => {
  const all: Detail[] = [
    { icon: FileText, label: "Sobre a marca", value: brand.description },
    { icon: UsersRound, label: "Público-alvo", value: brand.targetAudience },
    { icon: Megaphone, label: "Tom de voz", value: brand.toneOfVoice },
    { icon: Target, label: "Objetivos", value: brand.objectives },
  ];
  return all.filter((detail) => detail.value !== null && detail.value.trim() !== "");
};

function ChannelList({ brand }: { brand: PortalBrandProfile }) {
  return (
    <div className="flex items-start gap-3">
      <IconTile icon={Share2} size="sm" />
      <div className="min-w-0 space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Canais</h2>
        <ul className="space-y-1.5">
          {brand.channels.map((channel) => (
            <li
              key={`${channel.platform}-${channel.profileName}`}
              className="flex items-center gap-2 text-sm"
            >
              <PlatformIcon
                platform={channel.platform as Platform}
                className="size-4 shrink-0 text-muted-foreground"
              />
              <span className="font-medium text-foreground">
                {platformLabels[channel.platform as Platform] ?? channel.platform}
              </span>
              {channel.profileUrl ? (
                <a
                  href={channel.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-6 items-center gap-1 text-primary underline-offset-4 hover:underline"
                >
                  {channel.profileName}
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              ) : (
                <span className="text-muted-foreground">{channel.profileName}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function PortalBrandHeader({ brandId }: { brandId: string }) {
  const query = useQuery({
    queryKey: QueryKey.Portal.brand(brandId),
    queryFn: async () => unwrapResult(await getPortalBrand({ data: { brandId } })).brand,
  });

  if (query.isPending) return <Skeleton className="h-28 w-full rounded-2xl" />;
  if (query.isError) return null;
  const brand = query.data;
  const details = detailsOf(brand);

  return (
    <SectionCard as="section" padding="lg" className="space-y-6" aria-label="Dados da marca">
      <div className="flex flex-wrap items-center gap-4">
        <BrandAvatar name={brand.name} logoUrl={brand.logoUrl} size="xl" className="rounded-xl" />
        <div className="min-w-0 space-y-1">
          <h1 className="heading-page truncate">{brand.name}</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{brand.clientName}</span>
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden="true" />
              {brand.timezone}
            </span>
          </p>
        </div>
      </div>

      {details.length === 0 && brand.channels.length === 0 ? (
        <EmptyState
          compact
          icon={FileText}
          title="Os dados da marca ainda não foram preenchidos"
          description="Quando a equipe cadastrar descrição, público e canais, eles aparecem aqui."
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {details.map((detail) => (
            <div key={detail.label} className="flex items-start gap-3">
              <IconTile icon={detail.icon} size="sm" />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">{detail.label}</h2>
                <p className="whitespace-pre-line text-sm text-muted-foreground">{detail.value}</p>
              </div>
            </div>
          ))}
          {brand.channels.length > 0 ? <ChannelList brand={brand} /> : null}
        </div>
      )}
    </SectionCard>
  );
}
