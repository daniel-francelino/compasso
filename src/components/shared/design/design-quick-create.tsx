import { LayoutTemplate, RectangleVertical, Smartphone, Square } from "lucide-react";
import { DESIGN_PRESET_LABEL, DesignPreset } from "@/lib/shared/design/types";
import { cn } from "@/lib/shared/utils";

const PRESET_VIEW: Record<DesignPreset, { icon: typeof Square; circle: string; label: string }> = {
  [DesignPreset.FeedSquare]: { icon: Square, circle: "bg-violet", label: "Feed quadrado" },
  [DesignPreset.FeedPortrait]: {
    icon: RectangleVertical,
    circle: "bg-coral",
    label: "Feed retrato",
  },
  [DesignPreset.Story]: { icon: Smartphone, circle: "bg-orchid", label: "Story ou Reel" },
};

function Circle({
  icon: Icon,
  label,
  description,
  circle,
  disabledReason,
  onClick,
}: {
  icon: typeof Square;
  label: string;
  description: string;
  circle: string;
  disabledReason?: string | undefined;
  onClick: () => void;
}) {
  return (
    <li className="shrink-0">
      <button
        type="button"
        title={disabledReason ?? description}
        disabled={disabledReason !== undefined}
        onClick={onClick}
        className="group disabled:opacity-50 flex w-24 flex-col items-center gap-2 rounded-xl p-1 text-center focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span
          className={cn(
            "flex size-14 items-center justify-center rounded-full text-primary-foreground shadow-sm transition-transform group-hover:-translate-y-0.5 motion-reduce:transition-none",
            circle,
          )}
        >
          <Icon aria-hidden="true" className="size-6" />
        </span>
        <span className="text-xs font-medium text-foreground">{label}</span>
      </button>
    </li>
  );
}

export function DesignQuickCreate({
  canCreate,
  disabledReason,
  onCreate,
  onTemplates,
}: {
  canCreate: boolean;
  disabledReason: string | undefined;
  onCreate: (preset: DesignPreset) => void;
  onTemplates: () => void;
}) {
  return (
    <nav aria-label="Criar design rápido">
      <ul className="flex justify-start gap-2 overflow-x-auto pb-1 sm:justify-center">
        <Circle
          icon={LayoutTemplate}
          label="Modelos"
          description="Ver os modelos das marcas"
          circle="bg-ink-soft"
          onClick={onTemplates}
        />
        {canCreate
          ? Object.values(DesignPreset).map((preset) => (
              <Circle
                key={preset}
                icon={PRESET_VIEW[preset].icon}
                label={PRESET_VIEW[preset].label}
                description={`Criar e abrir: ${DESIGN_PRESET_LABEL[preset]}`}
                circle={PRESET_VIEW[preset].circle}
                disabledReason={disabledReason}
                onClick={() => onCreate(preset)}
              />
            ))
          : null}
      </ul>
    </nav>
  );
}
