import { Toaster as Sonner } from "sonner";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { CSSProperties } from "react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      richColors
      style={
        {
          "--success-bg": "var(--success)",
          "--success-border": "var(--success)",
          "--success-text": "var(--ivory)",
          "--error-bg": "var(--danger)",
          "--error-border": "var(--danger)",
          "--error-text": "var(--ivory)",
          "--info-bg": "var(--violet-deep)",
          "--info-border": "var(--violet-deep)",
          "--info-text": "var(--ivory)",
          "--warning-bg": "var(--warning)",
          "--warning-border": "var(--warning)",
          "--warning-text": "var(--ivory)",
        } as CSSProperties
      }
      icons={{
        success: <CircleCheck className="size-4 text-ivory" aria-hidden="true" />,
        error: <CircleAlert className="size-4 text-ivory" aria-hidden="true" />,
        info: <Info className="size-4 text-ivory" aria-hidden="true" />,
        warning: <TriangleAlert className="size-4 text-ivory" aria-hidden="true" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-inherit",
          actionButton: "group-[.toast]:bg-ivory group-[.toast]:text-ink",
          cancelButton: "group-[.toast]:bg-ivory group-[.toast]:text-ink",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
