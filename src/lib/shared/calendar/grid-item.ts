import type { LucideIcon } from "lucide-react";
import type { StatusTone } from "@/components/shared/admin/status-tones";

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
};

export const itemLabel = (item: GridItem): string =>
  [`${item.kindLabel}: ${item.title}`, item.time, item.subtitle, item.statusLabel, ...item.alerts]
    .filter((part) => part !== "")
    .join(", ");
