import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { seriesColors } from "@/components/shared/metrics/chart-colors";
import { formatCompact, formatDateOnly, formatNumber } from "@/lib/shared/format";
import type { MetricPoint } from "@/lib/shared/metrics/compute";

const CHART_HEIGHT = 240;
const BAR_ROW_HEIGHT = 40;
const AXIS_WIDTH = 52;
const GRID = "var(--chart-grid)";
const AXIS_TEXT = { fill: "var(--ink-soft)", fontSize: 12 };

const dayLabel = (start: string): string => formatDateOnly(start).slice(0, 5);

export type ChartMark = { start: string; label: string };

type GrowthPoint = { start: string; current: number | null; previous: number | null };

const merge = (current: MetricPoint[], previous: MetricPoint[] | null): GrowthPoint[] =>
  current.map((point, index) => ({
    start: point.start,
    current: point.value,
    previous: previous?.[index]?.value ?? null,
  }));

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <svg width="22" height="8" aria-hidden="true">
            <line
              x1="0"
              y1="4"
              x2="22"
              y2="4"
              stroke={item.color}
              strokeWidth="3"
              strokeDasharray={item.dashed ? "4 3" : undefined}
            />
          </svg>
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function GrowthChart({
  current,
  previous,
  marks,
  label,
  description,
  color = seriesColors[0],
}: {
  current: MetricPoint[];
  previous: MetricPoint[] | null;
  marks: ChartMark[];
  label: string;
  description: string;
  color?: string;
}) {
  const data = merge(current, previous);
  return (
    <figure className="space-y-2" role="img" aria-label={description}>
      <Legend
        items={[
          { label, color },
          ...(previous
            ? [{ label: "Período anterior", color: "var(--chart-compare)", dashed: true }]
            : []),
        ]}
      />
      <div style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="start" tickFormatter={dayLabel} tick={AXIS_TEXT} minTickGap={24} />
            <YAxis
              width={AXIS_WIDTH}
              tickFormatter={(value: number) => formatCompact(value)}
              tick={AXIS_TEXT}
              domain={["auto", "auto"]}
            />
            <Tooltip
              labelFormatter={(value) => formatDateOnly(String(value))}
              formatter={(value, name) => [
                formatNumber(Number(value)),
                name === "previous" ? "Período anterior" : label,
              ]}
            />
            {marks.map((mark) => (
              <ReferenceLine
                key={`${mark.start}-${mark.label}`}
                x={mark.start}
                stroke="var(--ink-soft)"
                strokeDasharray="2 2"
                label={{
                  value: mark.label,
                  position: "top",
                  fontSize: 11,
                  fill: "var(--ink-soft)",
                }}
              />
            ))}
            <Area
              type="monotone"
              dataKey="current"
              stroke={color}
              strokeWidth={2.5}
              fill="var(--chart-fill)"
              fillOpacity={0.7}
              isAnimationActive={false}
              dot={data.length <= 14}
              connectNulls
            />
            {previous ? (
              <Line
                type="monotone"
                dataKey="previous"
                stroke="var(--chart-compare)"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export type StackSeries = { key: string; label: string; color: string };

export function StackedBars({
  data,
  series,
  description,
}: {
  data: Record<string, number | string>[];
  series: StackSeries[];
  description: string;
}) {
  return (
    <figure className="space-y-2" role="img" aria-label={description}>
      <Legend items={series.map(({ label, color }) => ({ label, color }))} />
      <div style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="start" tickFormatter={dayLabel} tick={AXIS_TEXT} minTickGap={24} />
            <YAxis
              width={AXIS_WIDTH}
              tickFormatter={(value: number) => formatCompact(value)}
              tick={AXIS_TEXT}
            />
            <Tooltip
              labelFormatter={(value) => formatDateOnly(String(value))}
              formatter={(value, name) => [
                formatNumber(Number(value)),
                series.find((item) => item.key === name)?.label ?? String(name),
              ]}
            />
            {series.map((item) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                stackId="stack"
                fill={item.color}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export type RankItem = { key: string; label: string; value: number; note?: string };

export function RankBars({
  items,
  description,
  valueLabel,
  format = formatNumber,
}: {
  items: RankItem[];
  description: string;
  valueLabel: string;
  format?: (value: number) => string;
}) {
  const data = items.map((item) => ({ ...item, shown: item.value }));
  return (
    <figure className="space-y-1" role="img" aria-label={description}>
      <div style={{ height: Math.max(items.length, 1) * BAR_ROW_HEIGHT + 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 56, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              width={132}
              tick={AXIS_TEXT}
              tickLine={false}
              interval={0}
            />
            <Tooltip
              formatter={(value) => [format(Number(value)), valueLabel]}
              labelFormatter={(value) => String(value)}
            />
            <Bar
              dataKey="shown"
              fill="var(--chart-1)"
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="shown"
                position="right"
                formatter={(value) => format(Number(value))}
                style={{ fill: "var(--ink)", fontSize: 12 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export function ColumnBars({
  items,
  description,
  valueLabel,
  format = formatNumber,
}: {
  items: RankItem[];
  description: string;
  valueLabel: string;
  format?: (value: number) => string;
}) {
  return (
    <figure className="space-y-1" role="img" aria-label={description}>
      <div style={{ height: CHART_HEIGHT - 40 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={items} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TEXT} interval={0} />
            <YAxis
              width={AXIS_WIDTH}
              tickFormatter={(value: number) => formatCompact(value)}
              tick={AXIS_TEXT}
            />
            <Tooltip formatter={(value) => [format(Number(value)), valueLabel]} />
            <Bar
              dataKey="value"
              fill="var(--chart-1)"
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
