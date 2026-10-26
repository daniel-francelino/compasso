import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { formatNumber, formatPercent } from "@/lib/shared/format";
import { type Delta, Trend } from "@/lib/shared/metrics/compute";

const trendWords = {
  [Trend.Up]: "subiu",
  [Trend.Down]: "caiu",
  [Trend.Flat]: "estável",
  [Trend.None]: "",
} as const;

function TrendMark({ delta, unit }: { delta: Delta; unit: string }) {
  if (delta.trend === Trend.None) {
    return <span className="text-xs text-muted-foreground">Sem período para comparar</span>;
  }
  const Icon =
    delta.trend === Trend.Up ? TrendingUp : delta.trend === Trend.Down ? TrendingDown : Minus;
  const change =
    delta.trend === Trend.Flat
      ? ""
      : ` ${delta.absolute > 0 ? "+" : "−"}${formatNumber(Math.abs(delta.absolute))}${unit}${
          delta.percent === null ? "" : ` (${formatPercent(Math.abs(delta.percent))})`
        }`;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
      <Icon className="size-3.5" aria-hidden="true" />
      {trendWords[delta.trend]}
      {change}
    </span>
  );
}

export function StatTile({
  label,
  value,
  caption,
  delta,
  unit = "",
}: {
  label: string;
  value: string | null;
  caption?: string | undefined;
  delta: Delta;
  unit?: string;
}) {
  return (
    <div className="space-y-1 rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold text-foreground">{value ?? "Sem dados"}</p>
      {caption ? <p className="text-xs text-muted-foreground">{caption}</p> : null}
      {value === null ? null : <TrendMark delta={delta} unit={unit} />}
    </div>
  );
}
