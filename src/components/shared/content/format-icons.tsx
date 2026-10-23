import { FileText, Shapes, Type } from "lucide-react";
import type { ReactNode } from "react";
import { ContentFormat } from "@/lib/shared/enums";

export type FormatIconProps = { className?: string; "aria-hidden"?: boolean | "true" | "false" };

export type FormatIcon = (props: FormatIconProps) => ReactNode;

function glyph(children: ReactNode): FormatIcon {
  return function Glyph({ className, "aria-hidden": ariaHidden }) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden={ariaHidden}
      >
        {children}
      </svg>
    );
  };
}

const PostIcon = glyph(
  <>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <circle cx="8.5" cy="8.5" r="1.6" />
    <path d="m3.5 16 4.5-4.5a1.5 1.5 0 0 1 2.1 0L16 17.5m-2-2.5 1.5-1.5a1.5 1.5 0 0 1 2.1 0L21 16.5" />
  </>,
);

const CarouselIcon = glyph(
  <>
    <rect x="7" y="7" width="14" height="14" rx="3.5" />
    <path d="M17 3.5H8A4.5 4.5 0 0 0 3.5 8v9" />
  </>,
);

const VideoIcon = glyph(
  <>
    <rect x="3" y="4.5" width="18" height="15" rx="4" />
    <path d="M10.5 9.2v5.6l4.6-2.8-4.6-2.8Z" />
  </>,
);

const StoryIcon = glyph(
  <>
    <circle cx="12" cy="12" r="9.2" strokeDasharray="3.2 2.6" />
    <path d="M12 8.5v7M8.5 12h7" />
  </>,
);

const ReelIcon = glyph(
  <>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <path d="M3.5 8.5h17M8.5 3.3l3 5.2M14 3.3l3 5.2M10.5 12.6v5l4.4-2.5-4.4-2.5Z" />
  </>,
);

export const formatIcons: Record<ContentFormat, FormatIcon> = {
  [ContentFormat.Image]: PostIcon,
  [ContentFormat.Carousel]: CarouselIcon,
  [ContentFormat.Video]: VideoIcon,
  [ContentFormat.Text]: Type,
  [ContentFormat.Story]: StoryIcon,
  [ContentFormat.Reel]: ReelIcon,
  [ContentFormat.Article]: FileText,
  [ContentFormat.Other]: Shapes,
};
