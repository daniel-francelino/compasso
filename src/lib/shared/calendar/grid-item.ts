import type { LucideIcon } from "lucide-react";
import type { StatusTone } from "@/components/shared/admin/status-tones";
import type { ContentFormat, Platform } from "@/lib/shared/enums";

export type GridItem = {
  key: string;
  day: string;
  time: string;
  title: string;
  subtitle: string;
  kindLabel: string;
  statusLabel: string;
  tone: StatusTone;
  icon: LucideIcon;
  movable: boolean;
  platform: Platform | null;
  format: ContentFormat | null;
  muted: boolean;
};

export const itemLabel = (item: GridItem): string =>
  [`${item.kindLabel}: ${item.title}`, item.time, item.subtitle, item.statusLabel]
    .filter((part) => part !== "")
    .join(", ");
