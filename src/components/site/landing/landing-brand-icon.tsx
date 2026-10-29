import { Linkedin } from "lucide-react";
import {
  siFacebook,
  siInstagram,
  siPinterest,
  siThreads,
  siTiktok,
  siWhatsapp,
  siYoutube,
} from "simple-icons";
import { PlatformKey } from "@/components/site/landing/landing-content";
import { cn } from "@/lib/shared/utils";

const brandPaths: Partial<Record<PlatformKey, string>> = {
  [PlatformKey.Instagram]: siInstagram.path,
  [PlatformKey.TikTok]: siTiktok.path,
  [PlatformKey.YouTube]: siYoutube.path,
  [PlatformKey.Pinterest]: siPinterest.path,
  [PlatformKey.Facebook]: siFacebook.path,
  [PlatformKey.Threads]: siThreads.path,
  [PlatformKey.WhatsApp]: siWhatsapp.path,
};

export function LandingBrandIcon({
  platform,
  className,
}: {
  platform: PlatformKey;
  className?: string;
}) {
  const path = brandPaths[platform];
  if (path === undefined) return <Linkedin aria-hidden="true" className={className} />;
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={cn("fill-current", className)}>
      <path d={path} />
    </svg>
  );
}
