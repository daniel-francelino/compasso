import { Avatar, AvatarFallback, AvatarImage } from "@/components/shared/ui/avatar";
import { cn } from "@/lib/shared/utils";

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter((part) => part !== "")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

const sizes = {
  sm: "size-6 text-[0.625rem]",
  md: "size-8 text-xs",
  lg: "size-12 text-sm",
  xl: "size-16 text-lg",
} as const;

export function BrandAvatar({
  name,
  logoUrl,
  size = "md",
  className,
}: {
  name: string;
  logoUrl: string | null | undefined;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <Avatar className={cn("rounded-lg", sizes[size], className)}>
      {logoUrl ? <AvatarImage src={logoUrl} alt="" className="max-w-full object-contain" /> : null}
      <AvatarFallback className="rounded-lg bg-secondary font-medium text-secondary-foreground">
        {initialsOf(name)}
      </AvatarFallback>
    </Avatar>
  );
}
