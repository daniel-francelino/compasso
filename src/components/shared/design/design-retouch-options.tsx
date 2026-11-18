import {
  BrushOptionsBar,
  OptionField,
  ToggleButton,
} from "@/components/shared/design/design-paint-options";
import type { ToolOptionsProps } from "@/components/shared/design/design-tool-options";
import { CLONE_SOURCE_HINT } from "@/lib/shared/design/paint";
import { TONE_RANGE_LABEL, ToneRange } from "@/lib/shared/design/raster/adjustment-types";

const EXPOSURE_MIN = 1;
const EXPOSURE_MAX = 100;

export function CloneOptionsBar(props: ToolOptionsProps) {
  const { retouch } = props.paint;
  return (
    <>
      <BrushOptionsBar {...props} />
      <ToggleButton
        label="Alinhado"
        pressed={retouch.options.aligned}
        onToggle={() => retouch.setOptions({ aligned: !retouch.options.aligned })}
      />
      <p role="status" className="shrink-0 text-sm text-muted-foreground">
        {retouch.hasSource ? "Origem definida." : CLONE_SOURCE_HINT}
      </p>
    </>
  );
}

export function ToneOptionsBar(props: ToolOptionsProps) {
  const { retouch } = props.paint;
  return (
    <>
      <BrushOptionsBar {...props} />
      <div role="group" aria-label="Intervalo" className="flex shrink-0 items-center gap-1">
        <span className="mr-1 text-sm">Intervalo</span>
        {Object.values(ToneRange).map((range) => (
          <ToggleButton
            key={range}
            label={TONE_RANGE_LABEL[range]}
            pressed={retouch.options.range === range}
            onToggle={() => retouch.setOptions({ range })}
          />
        ))}
      </div>
      <OptionField
        name="retouch-exposure"
        label="Exposição"
        value={retouch.options.exposure}
        min={EXPOSURE_MIN}
        max={EXPOSURE_MAX}
        onChange={(exposure) => retouch.setOptions({ exposure })}
      />
    </>
  );
}
