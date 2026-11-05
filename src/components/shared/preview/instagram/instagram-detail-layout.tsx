import type { ReactNode } from "react";

export function InstagramDetailLayout({ media, side }: { media: ReactNode; side: ReactNode }) {
  return (
    <div className="grid w-full max-w-5xl overflow-hidden rounded-lg bg-surface lg:max-h-[92dvh] lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex items-center justify-center bg-ink lg:min-h-0">{media}</div>
      <div className="flex min-h-0 flex-col lg:max-h-[92dvh]">{side}</div>
    </div>
  );
}
