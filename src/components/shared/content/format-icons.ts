import { Circle, Clapperboard, FileText, Image, Images, Shapes, Type, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ContentFormat } from "@/lib/shared/enums";

export const formatIcons: Record<ContentFormat, LucideIcon> = {
  [ContentFormat.Image]: Image,
  [ContentFormat.Carousel]: Images,
  [ContentFormat.Video]: Video,
  [ContentFormat.Text]: Type,
  [ContentFormat.Story]: Circle,
  [ContentFormat.Reel]: Clapperboard,
  [ContentFormat.Article]: FileText,
  [ContentFormat.Other]: Shapes,
};
