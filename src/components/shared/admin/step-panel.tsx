import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type ReactNode, useState } from "react";
import type { StepItem } from "@/components/shared/admin/step-nav";
import { Button } from "@/components/shared/ui/button";

const SLIDE = 24;

const variants = {
  enter: (direction: number) => ({ opacity: 0, x: SLIDE * direction }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: -SLIDE * direction }),
};

export function StepPanel<K extends string>({
  steps,
  active,
  onChange,
  hideNav = false,
  children,
}: {
  steps: readonly StepItem<K>[];
  active: K;
  onChange: (key: K) => void;
  hideNav?: boolean;
  children: ReactNode;
}) {
  const index = steps.findIndex((step) => step.key === active);
  const [seen, setSeen] = useState(index);
  const [direction, setDirection] = useState(1);
  if (seen !== index) {
    setDirection(index > seen ? 1 : -1);
    setSeen(index);
  }
  const previous = steps[index - 1];
  const next = steps[index + 1];
  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-6">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={active}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="space-y-6"
          >
            {children}
          </motion.div>
        </AnimatePresence>
        {hideNav ? null : (
          <div className="flex items-center justify-between gap-3">
            {previous ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange(previous.key)}
              >
                <ChevronLeft aria-hidden="true" />
                {previous.label}
              </Button>
            ) : (
              <span />
            )}
            {next ? (
              <Button type="button" variant="outline" size="sm" onClick={() => onChange(next.key)}>
                {next.label}
                <ChevronRight aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
