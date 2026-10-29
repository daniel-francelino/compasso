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

export function Ribbon({ className, eager }: { className?: string; eager?: boolean }) {
  return (
    <img
      src="/landing/ribbon.webp"
      alt=""
      aria-hidden="true"
      width={420}
      height={470}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={cn("pointer-events-none absolute select-none", className)}
    />
  );
}
