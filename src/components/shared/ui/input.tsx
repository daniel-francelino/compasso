import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/shared/utils";

const inputClass =
  "flex h-9 w-full pointer-coarse:h-11 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pointer-fine:text-sm";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    if (type === "search") {
      return (
        <div className={cn("relative w-full", className)}>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input type={type} className={cn(inputClass, "pl-9")} ref={ref} {...props} />
        </div>
      );
    }

    return <input type={type} className={cn(inputClass, className)} ref={ref} {...props} />;
  },
);
Input.displayName = "Input";

export { Input };
