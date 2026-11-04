import { Ellipsis } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/shared/ui/avatar";
import { Button } from "@/components/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/shared/ui/dropdown-menu";
import { cn } from "@/lib/shared/utils";

export type InstagramHeaderMenu = {
  onOpen?: (() => void) | undefined;
  safeZones?: { checked: boolean; onCheckedChange: (checked: boolean) => void } | undefined;
};

export function InstagramPostHeader({
  profileName,
  brandLogoUrl,
  subtitle,
  ring = false,
  menu,
}: {
  profileName: string;
  brandLogoUrl: string | null | undefined;
  subtitle?: ReactNode;
  ring?: boolean;
  menu?: InstagramHeaderMenu | undefined;
}) {
  const name = profileName.replace(/^@/, "");
  const hasMenu = menu !== undefined && (menu.onOpen !== undefined || menu.safeZones !== undefined);
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
      {hasMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Mais opções">
              <Ellipsis className="size-5" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {menu.onOpen ? (
              <DropdownMenuItem onSelect={() => menu.onOpen?.()}>Ver detalhes</DropdownMenuItem>
            ) : null}
            {menu.safeZones ? (
              <DropdownMenuCheckboxItem
                checked={menu.safeZones.checked}
                onCheckedChange={menu.safeZones.onCheckedChange}
              >
                Mostrar áreas cobertas
              </DropdownMenuCheckboxItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Ellipsis className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
    </div>
  );
}
