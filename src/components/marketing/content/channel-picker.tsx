import { Link } from "@tanstack/react-router";
import { Radio } from "lucide-react";
import { PlatformIcon } from "@/components/shared/preview/platform-icon";
import { EmptyState } from "@/components/shared/admin/empty-state";
import type { ChannelRow } from "@/lib/marketing/channels/channels.functions";
import { platformLabels } from "@/lib/shared/labels";
import { cn } from "@/lib/shared/utils";

export function ChannelPicker({
  brandId,
  channels,
  selected,
  locked,
  disabled,
  onToggle,
  error,
}: {
  brandId: string;
  channels: ChannelRow[];
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
          return (
            <li key={channel.id}>
              <button
                type="button"
                aria-pressed={isSelected}
                disabled={disabled || isLocked}
                title={
                  isLocked
                    ? "Este canal já tem uma publicação registrada."
                    : `${platformLabels[channel.platform]} · ${channel.profileName}`
                }
                onClick={() => onToggle(channel.id)}
                className={cn(
                  "flex w-24 flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                  isSelected
                    ? "border-primary bg-accent text-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent/50",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}
                >
                  <PlatformIcon platform={channel.platform} className="size-5" />
                </span>
                <span className="w-full truncate font-medium text-foreground">
                  {platformLabels[channel.platform]}
                </span>
                <span className="w-full truncate">{channel.profileName}</span>
              </button>
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
