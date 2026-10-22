import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import { cn } from "@/lib/shared/utils";

export type StepItem<K extends string> = { key: K; label: string; icon: LucideIcon };

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
  const activeIndex = steps.findIndex((step) => step.key === active);
  return (
    <MotionConfig reducedMotion="user">
      <nav aria-label={label} className="flex items-center justify-center overflow-x-auto py-2">
        {steps.map((step, index) => {
          const current = index === activeIndex;
          const done = index < activeIndex;
          const Icon = done ? Check : step.icon;
          return (
            <div key={step.key} className="flex items-center">
              <button
                type="button"
                className="relative flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-current={current ? "step" : undefined}
                onClick={() => onChange(step.key)}
              >
                {current ? (
                  <motion.span
                    layoutId="step-nav-active"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-accent"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <span
                  className={cn(
                    "relative flex size-7 items-center justify-center rounded-full transition-colors duration-200",
                    current || done
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span
                  className={cn(
                    "relative transition-colors duration-200",
                    current ? "font-medium" : "text-muted-foreground",
                  )}
                >
                  <span className="sr-only">{`Etapa ${index + 1}: `}</span>
                  {step.label}
                </span>
              </button>
              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="relative mx-2 h-px w-8 overflow-hidden bg-border sm:w-16"
                >
                  <motion.span
                    className="absolute inset-0 origin-left bg-primary"
                    initial={false}
                    animate={{ scaleX: done ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                  />
                </span>
              ) : null}
            </div>
          );
        })}
      </nav>
    </MotionConfig>
  );
}
