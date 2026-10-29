import { useId } from "react";
import { cn } from "@/lib/shared/utils";

export function Sparkle({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={cn("pointer-events-none absolute size-8 animate-pulse text-orchid", className)}
    >
      <path
        d="M12 0c.8 6.6 4.7 11.2 12 12-7.3.8-11.2 5.4-12 12-.8-6.6-4.7-11.2-12-12C7.3 11.2 11.2 6.6 12 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Ribbon({ className }: { className?: string }) {
  const gradientId = `ribbon-${useId().replace(/:/g, "")}`;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 420 470"
      width={420}
      height={470}
      className={cn("pointer-events-none absolute select-none", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="var(--coral)" />
          <stop offset="0.45" stopColor="var(--orchid)" />
          <stop offset="0.75" stopColor="var(--violet-bright)" />
          <stop offset="1" stopColor="var(--violet)" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M0 100 L135 0 C175 55 215 75 250 90 C300 110 300 150 285 200 C270 250 300 290 345 310 C385 328 405 345 420 370 L290 470 C270 420 235 395 190 370 C140 345 110 300 125 240 C140 180 130 150 90 140 C50 135 20 125 0 100 Z"
      />
    </svg>
  );
}
