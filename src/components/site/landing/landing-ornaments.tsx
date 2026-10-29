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

export function Blob({ className }: { className?: string }) {
  const gradientId = useId();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 200"
      className={cn("pointer-events-none absolute", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--coral)" }} />
          <stop offset="100%" style={{ stopColor: "var(--violet-bright)" }} />
        </linearGradient>
      </defs>
      <path
        d="M44 20c27-24 76-12 104 6s44 56 28 92-60 70-104 62S2 128 8 86c3-27 9-48 36-66Z"
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
}
