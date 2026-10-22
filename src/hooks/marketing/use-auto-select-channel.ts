import { useEffect, useRef } from "react";
import type { ChannelRow } from "@/lib/marketing/channels/channels.functions";

export const useAutoSelectChannel = ({
  enabled,
  brandId,
  channels,
  hasSelection,
  onSelect,
}: {
  enabled: boolean;
  brandId: string;
  channels: ChannelRow[];
  hasSelection: boolean;
  onSelect: (channelId: string) => void;
}) => {
  const handledBrand = useRef<string | null>(null);
  const only = channels.length === 1 ? channels[0] : undefined;
  useEffect(() => {
    if (!enabled || brandId === "" || only === undefined) return;
    if (handledBrand.current === brandId) return;
    handledBrand.current = brandId;
    if (!hasSelection) onSelect(only.id);
  }, [enabled, brandId, only, hasSelection, onSelect]);
};
