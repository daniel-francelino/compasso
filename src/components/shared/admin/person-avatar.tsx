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
  xs: "size-5 text-[0.5rem]",
  sm: "size-6 text-[0.625rem]",
  md: "size-8 text-xs",
  lg: "size-12 text-sm",
  xl: "size-20 text-xl",
} as const;

export type PersonAvatarSize = keyof typeof sizes;

export function PersonAvatar({
  name,
  url,
  size = "md",
  className,
}: {
  name: string;
  url: string | null | undefined;
  size?: PersonAvatarSize;
  className?: string;
}) {
  return (
    <Avatar className={cn(sizes[size], className)}>
      {url ? <AvatarImage src={url} alt="" className="object-cover" /> : null}
      <AvatarFallback
        aria-hidden="true"
        className="bg-secondary font-medium text-secondary-foreground"
      >
        {initialsOf(name)}
      </AvatarFallback>
    </Avatar>
  );
}
