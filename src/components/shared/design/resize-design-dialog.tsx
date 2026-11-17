import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Scaling } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "lost-ui/elements/modal";
import { Form } from "lost-ui/forms/form";
import { FormInput } from "lost-ui/forms/form-input";
import { FormSelect } from "lost-ui/forms/form-select";
import { rules } from "lost-ui/forms/rules";
import { Alert, AlertDescription } from "lost-ui/ui/alert";
import { Button } from "@/components/shared/ui/button";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { type DesignRow, createDesign, getDesign } from "@/lib/shared/design/design.functions";
import { resizeDocument } from "@/lib/shared/design/document";
import {
  DESIGN_LIMITS,
  DESIGN_PRESET_LABEL,
  DesignPreset,
  type DesignPreset as DesignPresetValue,
} from "@/lib/shared/design/types";

const asPreset = (value: string) => Object.values(DesignPreset).find((preset) => preset === value);

export function ResizeDesignDialog({
  source,
  onOpenChange,
}: {
  source: DesignRow;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { errors, error, busy, send } = useFormSubmit();
  const others = Object.values(DesignPreset).filter((preset) => preset !== source.preset);
  const [preset, setPreset] = useState<DesignPresetValue>(others[0] ?? DesignPreset.Story);
  const [name, setName] = useState(
    `${source.name} (${DESIGN_PRESET_LABEL[preset].split(" (")[0] ?? ""})`.slice(
      0,
      DESIGN_LIMITS.nameMax,
    ),
  );

  function handleSubmit() {
    void send(
      async () => {
        const loaded = await getDesign({ data: { id: source.id } });
        if (!loaded.ok) return loaded;
        return createDesign({
          data: {
            brandId: source.brandId,
            name,
            preset,
            document: resizeDocument(loaded.design.document, source.preset, preset),
          },
        });
      },
      async (result) => {
        toast.success("Cópia criada no novo formato. Confira as posições antes de usar.");
        onOpenChange(false);
        await navigate({
          to: "/admin/marketing/designs/$designId",
          params: { designId: result.id },
        });
      },
    );
  }

  return (
    <Modal
      open
      onOpenChange={onOpenChange}
      dismissible={!busy}
      title="Redimensionar"
      description={`Cria uma cópia de "${source.name}" em outro formato. O design original não muda.`}
      footer={({ close }) => (
        <>
          <Button type="button" variant="outline" disabled={busy} onClick={close}>
            <ArrowLeft aria-hidden="true" />
            Voltar
          </Button>
          <Button type="submit" form="resize-design-form" loading={busy}>
            <Scaling aria-hidden="true" />
            Criar cópia
          </Button>
        </>
      )}
    >
      <Form id="resize-design-form" className="space-y-4" onSubmit={handleSubmit}>
        <FormSelect
          name="preset"
          label="Novo formato"
          value={preset}
          items={others.map((item) => ({ value: item, label: DESIGN_PRESET_LABEL[item] }))}
          required
          onValueChange={(value) => {
            const next = asPreset(value);
            if (next !== undefined) setPreset(next);
          }}
        />
        <FormInput
          name="name"
          label="Nome da cópia"
          value={name}
          onValueChange={setName}
          required
          rules={[
            rules.required("Informe o nome do design."),
            rules.maxLength(DESIGN_LIMITS.nameMax, "O nome é longo demais."),
          ]}
          error={errors["name"] !== undefined}
          {...(errors["name"] ? { errorMessage: errors["name"] } : {})}
        />
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </Form>
    </Modal>
  );
}
