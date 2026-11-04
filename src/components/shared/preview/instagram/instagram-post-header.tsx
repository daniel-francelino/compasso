import { Ellipsis } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/shared/ui/avatar";
import { cn } from "@/lib/shared/utils";

export function InstagramPostHeader({
  profileName,
  brandLogoUrl,
  subtitle,
  ring = false,
}: {
  profileName: string;
  brandLogoUrl: string | null | undefined;
  subtitle?: ReactNode;
  ring?: boolean;
}) {
  const name = profileName.replace(/^@/, "");
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <span className={cn("rounded-full p-0.5", ring && "ring-2 ring-platform-instagram")}>
        <Avatar className="size-9">
          {brandLogoUrl ? (
            <AvatarImage src={brandLogoUrl} alt="" className="object-contain" />
          ) : null}
          <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
            {name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
        {subtitle ? <span className="block text-xs text-muted-foreground">{subtitle}</span> : null}
      </span>
      <Ellipsis className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </div>
  );
}
