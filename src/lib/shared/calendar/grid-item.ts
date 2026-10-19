import type { LucideIcon } from "lucide-react";
import type { StatusTone } from "@/components/shared/admin/status-tones";
import type { Platform } from "@/lib/shared/enums";
import type { ValueOf } from "@/lib/shared/utils";

export const StatusMark = {
  Published: "published",
  Scheduled: "scheduled",
  Converted: "converted",
} as const;
export type StatusMark = ValueOf<typeof StatusMark>;

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
  alerts: string[];
  platform: Platform | null;
  mark: StatusMark | null;
  muted: boolean;
};

export const itemLabel = (item: GridItem): string =>
  [`${item.kindLabel}: ${item.title}`, item.time, item.subtitle, item.statusLabel, ...item.alerts]
    .filter((part) => part !== "")
    .join(", ");
