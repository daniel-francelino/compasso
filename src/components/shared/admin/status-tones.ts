export type StatusTone = "success" | "negative" | "draft" | "info" | "warning" | "neutral";

export const statusTones: Record<StatusTone, { box: string; icon: string; text: string }> = {
  success: {
    box: "border-success/40 bg-success/10",
    icon: "text-success",
    text: "text-foreground",
  },
  negative: {
    box: "border-danger/40 bg-danger/10",
    icon: "text-danger",
    text: "text-foreground",
  },
  draft: {
    box: "border-ink-soft/40 bg-ink-soft/10",
    icon: "text-ink-soft",
    text: "text-foreground",
  },
  info: { box: "border-info/40 bg-info/10", icon: "text-info", text: "text-foreground" },
  warning: {
    box: "border-warning/50 bg-warning/10",
    icon: "text-foreground",
    text: "text-foreground",
  },
  neutral: {
    box: "border-border bg-muted",
    icon: "text-muted-foreground",
    text: "text-muted-foreground",
  },
};
