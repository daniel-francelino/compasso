import type { LucideIcon } from "lucide-react";
import type { FormEvent, HTMLAttributes, ReactNode, Ref } from "react";
import { InfoTip } from "@/components/shared/admin/info-tip";
import { cn } from "@/lib/shared/utils";

type Padding = "lg" | "md" | "sm" | "xs" | "none";

const paddings: Record<Padding, string> = {
  lg: "p-6",
  md: "p-5",
  sm: "p-4",
  xs: "p-3",
  none: "",
};

export function SectionCard({
  title,
  icon: Icon,
  tip,
  actions,
  padding = "md",
  as: Tag = "section",
  ref,
  onSubmit,
  className,
  children,
  ...rest
}: {
  title?: string;
  icon?: LucideIcon;
  tip?: { label: string; content: ReactNode };
  actions?: ReactNode;
  padding?: Padding;
  as?: "section" | "div" | "form" | "aside" | "figure" | "p" | "li" | "dl" | "article";
  children?: ReactNode;
  noValidate?: boolean;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => unknown;
  ref?: Ref<HTMLElement> | Ref<HTMLFormElement>;
} & Omit<HTMLAttributes<HTMLElement>, "title">) {
  const Element = Tag as "section";
  return (
    <Element
      ref={ref as never}
      onSubmit={onSubmit as never}
      className={cn(
        "rounded-2xl border border-border bg-card",
        paddings[padding],
        title ? "space-y-3" : "",
        className,
      )}
      {...rest}
    >
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {Icon ? <Icon className="size-5 text-muted-foreground" aria-hidden="true" /> : null}
            <h2 className="heading-card text-foreground">{title}</h2>
            {tip ? <InfoTip label={tip.label}>{tip.content}</InfoTip> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </Element>
  );
}
