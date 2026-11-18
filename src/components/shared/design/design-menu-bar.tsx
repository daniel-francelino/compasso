import { Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "lost-ui/ui/dropdown-menu";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "lost-ui/ui/menubar";
import { Button } from "@/components/shared/ui/button";
import type { DesignMenu, DesignMenuItem } from "@/hooks/shared/design/use-design-menus";

function ItemText({ item }: { item: DesignMenuItem }) {
  return (
    <span className="flex flex-col">
      {item.label}
      {item.disabledReason === undefined ? null : (
        <span className="text-xs text-muted-foreground">{item.disabledReason}</span>
      )}
    </span>
  );
}

function BarMenu({ menu }: { menu: DesignMenu }) {
  return (
    <MenubarMenu>
      <MenubarTrigger className="min-h-9 px-3 text-sm">{menu.label}</MenubarTrigger>
      <MenubarContent>
        {menu.items.map((item) => (
          <div key={item.id}>
            {item.separatorBefore ? <MenubarSeparator /> : null}
            <MenubarItem disabled={item.disabledReason !== undefined} onSelect={item.onSelect}>
              <ItemText item={item} />
              {item.shortcut === undefined ? null : (
                <MenubarShortcut>{item.shortcut}</MenubarShortcut>
              )}
            </MenubarItem>
          </div>
        ))}
      </MenubarContent>
    </MenubarMenu>
  );
}

function CollapsedMenu({ menus }: { menus: DesignMenu[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="lg:hidden">
          <Menu aria-hidden="true" />
          Menu
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {menus.map((menu) => (
          <DropdownMenuSub key={menu.id}>
            <DropdownMenuSubTrigger>{menu.label}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64">
              {menu.items.map((item) => (
                <div key={item.id}>
                  {item.separatorBefore ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuItem
                    disabled={item.disabledReason !== undefined}
                    onSelect={item.onSelect}
                  >
                    <ItemText item={item} />
                    {item.shortcut === undefined ? null : (
                      <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>
                    )}
                  </DropdownMenuItem>
                </div>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DesignMenuBar({ menus }: { menus: DesignMenu[] }) {
  return (
    <nav
      aria-label="Menu do editor"
      className="flex shrink-0 items-center border-b bg-card px-2 py-0.5"
    >
      <CollapsedMenu menus={menus} />
      <Menubar className="hidden h-auto border-0 bg-transparent p-0 shadow-none lg:flex">
        {menus.map((menu) => (
          <BarMenu key={menu.id} menu={menu} />
        ))}
      </Menubar>
    </nav>
  );
}
