import { Plus, Trash2 } from "lucide-react";
import { FormInputNumber } from "lost-ui/forms/form-input-number";
import { FormSelect } from "lost-ui/forms/form-select";
import { FormSlider } from "lost-ui/forms/form-slider";
import { useState } from "react";
import { Button } from "@/components/shared/ui/button";
import {
  type CurveAxis,
  addCurvePoint,
  removeCurvePoint,
  setCurvePoint,
} from "@/lib/shared/design/adjustment-layers";
import type {
  AdjustmentParams,
  ColorShift,
  LevelsChannelParams,
} from "@/lib/shared/design/raster/adjustment-schemas";
import {
  AdjustmentType,
  CHANNEL_TARGET_LABEL,
  ChannelTarget,
  MAX_CURVE_POINTS,
  MIN_CURVE_POINTS,
  TONE_RANGE_LABEL,
  ToneRange,
} from "@/lib/shared/design/raster/adjustment-types";

type Change = (next: AdjustmentParams) => void;
type Of<T extends AdjustmentType> = Extract<AdjustmentParams, { type: T }>;
type Props<T extends AdjustmentType> = { params: Of<T>; disabled: boolean; onChange: Change };

const first = (value: number | number[]) => (Array.isArray(value) ? (value[0] ?? 0) : value);

type SlideProps = {
  name: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled: boolean;
  onChange: (value: number) => void;
};

function Slide({ name, label, value, min, max, step = 1, disabled, onChange }: SlideProps) {
  return (
    <FormSlider
      name={name}
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      showValue
      disabled={disabled}
      onValueChange={(next) => onChange(first(next))}
    />
  );
}

function Selector<T extends string>({
  name,
  label,
  values,
  labels,
  value,
  onChange,
}: {
  name: string;
  label: string;
  values: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
}) {
  const items = values.map((item) => ({ value: item, label: labels[item] }));
  return (
    <FormSelect
      name={name}
      label={label}
      value={value}
      items={items}
      onValueChange={(next) => {
        const found = values.find((item) => item === next);
        if (found !== undefined) onChange(found);
      }}
    />
  );
}

function ChannelSelector({
  name,
  value,
  onChange,
}: {
  name: string;
  value: ChannelTarget;
  onChange: (value: ChannelTarget) => void;
}) {
  return (
    <Selector
      name={name}
      label="Canal"
      values={Object.values(ChannelTarget)}
      labels={CHANNEL_TARGET_LABEL}
      value={value}
      onChange={onChange}
    />
  );
}

function BrightnessContrastControls({ params, disabled, onChange }: Props<"brightness_contrast">) {
  return (
    <>
      <Slide
        name="adj-brightness"
        label="Brilho"
        value={params.brightness}
        min={-100}
        max={100}
        disabled={disabled}
        onChange={(brightness) => onChange({ ...params, brightness })}
      />
      <Slide
        name="adj-contrast"
        label="Contraste"
        value={params.contrast}
        min={-100}
        max={100}
        disabled={disabled}
        onChange={(contrast) => onChange({ ...params, contrast })}
      />
    </>
  );
}

const LEVEL_FIELDS: readonly {
  key: keyof LevelsChannelParams;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: "inputBlack", label: "Entrada: preto", min: 0, max: 255, step: 1 },
  { key: "gamma", label: "Gama", min: 0.1, max: 10, step: 0.05 },
  { key: "inputWhite", label: "Entrada: branco", min: 0, max: 255, step: 1 },
  { key: "outputBlack", label: "Saída: preto", min: 0, max: 255, step: 1 },
  { key: "outputWhite", label: "Saída: branco", min: 0, max: 255, step: 1 },
];

function LevelsControls({ params, disabled, onChange }: Props<"levels">) {
  const [channel, setChannel] = useState<ChannelTarget>(ChannelTarget.Rgb);
  const current = params.channels[channel];
  return (
    <>
      <ChannelSelector name="adj-levels-channel" value={channel} onChange={setChannel} />
      {LEVEL_FIELDS.map((field) => (
        <Slide
          key={field.key}
          name={`adj-levels-${field.key}`}
          label={field.label}
          value={current[field.key]}
          min={field.min}
          max={field.max}
          step={field.step}
          disabled={disabled}
          onChange={(value) =>
            onChange({
              ...params,
              channels: { ...params.channels, [channel]: { ...current, [field.key]: value } },
            })
          }
        />
      ))}
    </>
  );
}

const CURVE_AXES: readonly { axis: CurveAxis; label: string }[] = [
  { axis: "x", label: "Entrada" },
  { axis: "y", label: "Saída" },
];

function CurvesControls({ params, disabled, onChange }: Props<"curves">) {
  const [channel, setChannel] = useState<ChannelTarget>(ChannelTarget.Rgb);
  const points = params.channels[channel];
  const update = (next: typeof points) =>
    onChange({ ...params, channels: { ...params.channels, [channel]: next } });
  return (
    <>
      <ChannelSelector name="adj-curves-channel" value={channel} onChange={setChannel} />
      <ul className="space-y-2" aria-label="Pontos da curva">
        {points.map((point, index) => (
          <li key={`${channel}-${index}`} className="flex items-end gap-2">
            {CURVE_AXES.map(({ axis, label }) => (
              <FormInputNumber
                key={axis}
                name={`adj-curve-${index}-${axis}`}
                label={`${label} ${index + 1}`}
                value={point[axis]}
                min={0}
                max={255}
                step={1}
                disabled={disabled}
                className="w-24"
                onValueChange={(next) => {
                  if (next !== null) update(setCurvePoint(points, index, axis, next));
                }}
              />
            ))}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remover ponto ${index + 1}`}
              disabled={disabled || points.length <= MIN_CURVE_POINTS}
              onClick={() => update(removeCurvePoint(points, index))}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || points.length >= MAX_CURVE_POINTS}
        onClick={() => update(addCurvePoint(points))}
      >
        <Plus aria-hidden="true" />
        Adicionar ponto
      </Button>
    </>
  );
}

function HueSaturationControls({ params, disabled, onChange }: Props<"hue_saturation">) {
  return (
    <>
      <Slide
        name="adj-hue"
        label="Matiz"
        value={params.hue}
        min={-180}
        max={180}
        disabled={disabled}
        onChange={(hue) => onChange({ ...params, hue })}
      />
      <Slide
        name="adj-saturation"
        label="Saturação"
        value={params.saturation}
        min={-100}
        max={100}
        disabled={disabled}
        onChange={(saturation) => onChange({ ...params, saturation })}
      />
      <Slide
        name="adj-lightness"
        label="Luminosidade"
        value={params.lightness}
        min={-100}
        max={100}
        disabled={disabled}
        onChange={(lightness) => onChange({ ...params, lightness })}
      />
    </>
  );
}

const SHIFT_FIELDS: readonly { key: keyof ColorShift; label: string }[] = [
  { key: "cyanRed", label: "Ciano / vermelho" },
  { key: "magentaGreen", label: "Magenta / verde" },
  { key: "yellowBlue", label: "Amarelo / azul" },
];

function ColorBalanceControls({ params, disabled, onChange }: Props<"color_balance">) {
  const [tone, setTone] = useState<ToneRange>(ToneRange.Midtones);
  const shift = params[tone];
  return (
    <>
      <Selector
        name="adj-balance-tone"
        label="Tons"
        values={Object.values(ToneRange)}
        labels={TONE_RANGE_LABEL}
        value={tone}
        onChange={setTone}
      />
      {SHIFT_FIELDS.map((field) => (
        <Slide
          key={field.key}
          name={`adj-balance-${field.key}`}
          label={field.label}
          value={shift[field.key]}
          min={-100}
          max={100}
          disabled={disabled}
          onChange={(value) => onChange({ ...params, [tone]: { ...shift, [field.key]: value } })}
        />
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={params.preserveLuminosity}
        disabled={disabled}
        onClick={() => onChange({ ...params, preserveLuminosity: !params.preserveLuminosity })}
      >
        Preservar luminosidade
      </Button>
    </>
  );
}

const BLACK_WHITE_FIELDS = [
  { key: "reds", label: "Vermelhos" },
  { key: "yellows", label: "Amarelos" },
  { key: "greens", label: "Verdes" },
  { key: "cyans", label: "Cianos" },
  { key: "blues", label: "Azuis" },
  { key: "magentas", label: "Magentas" },
] as const;

function BlackWhiteControls({ params, disabled, onChange }: Props<"black_white">) {
  return (
    <>
      {BLACK_WHITE_FIELDS.map((field) => (
        <Slide
          key={field.key}
          name={`adj-bw-${field.key}`}
          label={field.label}
          value={params[field.key]}
          min={-200}
          max={300}
          disabled={disabled}
          onChange={(value) => onChange({ ...params, [field.key]: value })}
        />
      ))}
    </>
  );
}

function ThresholdControls({ params, disabled, onChange }: Props<"threshold">) {
  return (
    <Slide
      name="adj-threshold"
      label="Nível"
      value={params.level}
      min={0}
      max={255}
      disabled={disabled}
      onChange={(level) => onChange({ ...params, level })}
    />
  );
}

export function AdjustmentControls({
  params,
  disabled,
  onChange,
}: {
  params: AdjustmentParams;
  disabled: boolean;
  onChange: Change;
}) {
  switch (params.type) {
    case AdjustmentType.BrightnessContrast:
      return <BrightnessContrastControls params={params} disabled={disabled} onChange={onChange} />;
    case AdjustmentType.Levels:
      return <LevelsControls params={params} disabled={disabled} onChange={onChange} />;
    case AdjustmentType.Curves:
      return <CurvesControls params={params} disabled={disabled} onChange={onChange} />;
    case AdjustmentType.HueSaturation:
      return <HueSaturationControls params={params} disabled={disabled} onChange={onChange} />;
    case AdjustmentType.ColorBalance:
      return <ColorBalanceControls params={params} disabled={disabled} onChange={onChange} />;
    case AdjustmentType.BlackWhite:
      return <BlackWhiteControls params={params} disabled={disabled} onChange={onChange} />;
    case AdjustmentType.Threshold:
      return <ThresholdControls params={params} disabled={disabled} onChange={onChange} />;
    case AdjustmentType.Invert:
      return <p className="text-sm text-muted-foreground">Este ajuste não tem parâmetros.</p>;
  }
}
