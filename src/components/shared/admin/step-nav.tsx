import { cn } from "@/lib/shared/utils";

export type StepItem<K extends string> = { key: K; label: string };

export function StepNav<K extends string>({
  steps,
  active,
  onChange,
  label,
}: {
  steps: readonly StepItem<K>[];
  active: K;
  onChange: (key: K) => void;
  label: string;
}) {
  return (
    <nav aria-label={label} className="flex items-center justify-center overflow-x-auto py-2">
      {steps.map((step, index) => {
        const current = step.key === active;
        return (
          <div key={step.key} className="flex items-center">
            <button
              type="button"
              className="flex shrink-0 items-center gap-2 rounded-full px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-current={current ? "step" : undefined}
              onClick={() => onChange(step.key)}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-xs",
                  current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {index + 1}
              </span>
              <span className={current ? "font-medium" : "text-muted-foreground"}>
                {step.label}
              </span>
            </button>
            {index < steps.length - 1 ? (
              <span aria-hidden="true" className="mx-2 h-px w-10 bg-border sm:w-20" />
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
