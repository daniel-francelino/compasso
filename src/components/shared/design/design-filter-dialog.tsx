import { OptionField, ToggleButton } from "@/components/shared/design/design-paint-options";
import { Button } from "@/components/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog";
import type { FilterController } from "@/hooks/shared/design/use-design-filter";
import {
  DESIGN_FILTER_LABEL,
  DesignFilter,
  FILTER_FAILED_MESSAGE,
  FILTER_LIMITS,
  FILTER_WORKING_MESSAGE,
  type FilterParams,
} from "@/lib/shared/design/raster/filter-types";

type Change = (next: FilterParams) => void;

function FilterFields({ params, onChange }: { params: FilterParams; onChange: Change }) {
  if (params.filter === DesignFilter.GaussianBlur) {
    return (
      <OptionField
        name="filter-radius"
        label="Raio (px)"
        value={params.radius}
        {...FILTER_LIMITS.blurRadius}
        onChange={(radius) => onChange({ ...params, radius })}
      />
    );
  }
  if (params.filter === DesignFilter.Sharpen) {
    return (
      <>
        <OptionField
          name="filter-amount"
          label="Quantidade (%)"
          value={params.amount}
          {...FILTER_LIMITS.sharpenAmount}
          onChange={(amount) => onChange({ ...params, amount })}
        />
        <OptionField
          name="filter-radius"
          label="Raio (px)"
          value={params.radius}
          {...FILTER_LIMITS.sharpenRadius}
          onChange={(radius) => onChange({ ...params, radius })}
        />
        <OptionField
          name="filter-threshold"
          label="Limiar"
          value={params.threshold}
          {...FILTER_LIMITS.sharpenThreshold}
          onChange={(threshold) => onChange({ ...params, threshold })}
        />
      </>
    );
  }
  if (params.filter === DesignFilter.Noise) {
    return (
      <>
        <OptionField
          name="filter-amount"
          label="Quantidade (%)"
          value={params.amount}
          {...FILTER_LIMITS.noiseAmount}
          onChange={(amount) => onChange({ ...params, amount })}
        />
        <ToggleButton
          label="Monocromático"
          pressed={params.monochrome}
          onToggle={() => onChange({ ...params, monochrome: !params.monochrome })}
        />
      </>
    );
  }
  return (
    <OptionField
      name="filter-cell"
      label="Tamanho da célula (px)"
      value={params.cell}
      {...FILTER_LIMITS.pixelateCell}
      onChange={(cell) => onChange({ ...params, cell })}
    />
  );
}

export function DesignFilterDialog({ filter }: { filter: FilterController }) {
  const { state } = filter;
  return (
    <Dialog
      open={state !== null}
      modal={false}
      onOpenChange={(open) => (open ? undefined : filter.cancel())}
    >
      <DialogContent
        className="left-auto right-4 top-24 translate-x-0 translate-y-0 sm:max-w-sm"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{state === null ? "" : DESIGN_FILTER_LABEL[state.filter]}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {state === null ? null : (
            <FilterFields params={state.params} onChange={filter.setParams} />
          )}
          <p role="status" className="min-h-5 text-sm text-muted-foreground">
            {state?.failed === true ? FILTER_FAILED_MESSAGE : null}
            {state?.working === true && !state.failed ? FILTER_WORKING_MESSAGE : null}
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={filter.cancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={state?.working === true}
            onClick={() => void filter.apply()}
          >
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
