import { Link } from "@tanstack/react-router";
import { Check, Radio } from "lucide-react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { PlatformMark } from "@/components/shared/preview/platform-mark";
import { Skeleton } from "@/components/shared/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shared/ui/tooltip";
import type { ChannelRow } from "@/lib/marketing/channels/channels.functions";
import { platformLabels } from "@/lib/shared/labels";
import { cn } from "@/lib/shared/utils";

const SKELETON_COUNT = 3;

export function ChannelPicker({
  brandId,
  channels,
  loading,
  selected,
  locked,
  disabled,
  onToggle,
  error,
}: {
  brandId: string;
  channels: ChannelRow[];
  loading: boolean;
  selected: ReadonlySet<string>;
  locked: ReadonlySet<string>;
  disabled: boolean;
  onToggle: (channelId: string) => void;
  error?: string | undefined;
}) {
  if (brandId === "") {
    return (
      <p className="text-sm text-muted-foreground">Escolha a marca para ver os canais dela.</p>
    );
  }
  if (loading) {
    return (
      <div
        className="flex flex-wrap gap-3"
        role="status"
        aria-busy="true"
        aria-label="Carregando canais"
      >
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <Skeleton key={index} className="size-11 rounded-full" />
        ))}
      </div>
    );
  }
  if (channels.length === 0) {
    return (
      <EmptyState
        compact
        icon={Radio}
        title="Esta marca ainda não tem canais ativos"
        description="Cadastre o perfil de cada rede antes de planejar um conteúdo."
        action={
          <Link
            to="/admin/marketing/brands/$brandId/channels"
            params={{ brandId }}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Cadastrar canais
          </Link>
        }
      />
    );
  }
  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-3" aria-label="Canais da marca">
        {channels.map((channel) => {
          const isSelected = selected.has(channel.id);
          const isLocked = locked.has(channel.id);
          const inactive = disabled || isLocked;
          const name = `${platformLabels[channel.platform]} · ${channel.profileName}`;
          return (
            <li key={channel.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={name}
                    aria-pressed={isSelected}
                    aria-disabled={inactive}
                    onClick={() => {
                      if (!inactive) onToggle(channel.id);
                    }}
                    className={cn(
                      "relative flex size-11 cursor-pointer items-center justify-center rounded-full transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      isSelected
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "opacity-50 grayscale hover:scale-105 hover:opacity-100 hover:grayscale-0",
                      inactive && "cursor-not-allowed hover:scale-100",
                    )}
                  >
                    <PlatformMark
                      platform={channel.platform}
                      className="size-11"
                      iconClassName="size-5"
                    />
                    {isSelected ? (
                      <span
                        aria-hidden="true"
                        className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full border border-background bg-foreground text-background"
                      >
                        <Check className="size-3" />
                      </span>
                    ) : null}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  {isLocked ? `${name}. Este canal já tem uma publicação registrada.` : name}
                </TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
