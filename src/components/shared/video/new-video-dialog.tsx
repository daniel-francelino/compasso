import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "lost-ui/elements/modal";
import { Form } from "lost-ui/forms/form";
import { FormInput } from "lost-ui/forms/form-input";
import { FormSelect } from "lost-ui/forms/form-select";
import { rules } from "lost-ui/forms/rules";
import { Alert, AlertDescription } from "lost-ui/ui/alert";
import { Button } from "@/components/shared/ui/button";
import { useBrandOptions } from "@/hooks/shared/use-brand-options";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { readCanvasChrome } from "@/lib/shared/design/browser";
import {
  DESIGN_PRESET_LABEL,
  DesignPreset,
  type DesignPreset as DesignPresetValue,
} from "@/lib/shared/design/types";
import { emptyVideoDocument } from "@/lib/shared/video/timeline";
import { VIDEO_LIMITS } from "@/lib/shared/video/types";
import { createVideoProject } from "@/lib/shared/video/video.functions";

const presetItems = Object.values(DesignPreset).map((preset) => ({
  value: preset,
  label: DESIGN_PRESET_LABEL[preset],
}));

const isPreset = (value: string): value is DesignPresetValue =>
  presetItems.some((item) => item.value === value);

const NO_COLORS = "Não foi possível ler as cores do tema. Recarregue a página e tente de novo.";

export function NewVideoDialog({
  open,
  onOpenChange,
  defaultBrandId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBrandId: string | undefined;
}) {
  const navigate = useNavigate();
  const brands = useBrandOptions(open);
  const { errors, error, busy, send } = useFormSubmit();
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState(defaultBrandId ?? "");
  const [preset, setPreset] = useState<DesignPresetValue>(DesignPreset.Story);

  const brandItems = (brands.data ?? []).map((brand) => ({
    value: brand.id,
    label: brand.name,
    description: brand.clientName,
  }));

  function handleSubmit() {
    const chrome = readCanvasChrome();
    if (chrome === null) {
      toast.error(NO_COLORS);
      return;
    }
    void send(
      () =>
        createVideoProject({
          data: { brandId, name, preset, document: emptyVideoDocument(chrome.ink) },
        }),
      async (result) => {
        toast.success("Vídeo criado.");
        onOpenChange(false);
        await navigate({
          to: "/admin/marketing/videos/$projectId",
          params: { projectId: result.id },
        });
      },
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      dismissible={!busy}
      title="Novo vídeo"
      description="Escolha a marca e o formato. Você poderá editar o nome depois."
      footer={({ close }) => (
        <>
          <Button type="button" variant="outline" disabled={busy} onClick={close}>
            <ArrowLeft aria-hidden="true" />
            Voltar
          </Button>
          <Button type="submit" form="new-video-form" loading={busy}>
            <Plus aria-hidden="true" />
            Criar vídeo
          </Button>
        </>
      )}
    >
      <Form id="new-video-form" className="space-y-4" onSubmit={handleSubmit}>
        <FormInput
          name="name"
          label="Nome"
          value={name}
          onValueChange={setName}
          required
          hint={`Até ${VIDEO_LIMITS.nameMax} caracteres.`}
          rules={[
            rules.required("Informe o nome do vídeo."),
            rules.maxLength(VIDEO_LIMITS.nameMax, "O nome é longo demais."),
          ]}
          error={errors["name"] !== undefined}
          {...(errors["name"] ? { errorMessage: errors["name"] } : {})}
        />
        <FormSelect
          name="brandId"
          label="Marca"
          value={brandId}
          onValueChange={setBrandId}
          items={brandItems}
          placeholder={brands.isPending ? "Carregando marcas…" : "Escolha a marca"}
          required
          rules={[rules.required("Escolha a marca.")]}
          error={errors["brandId"] !== undefined}
          {...(errors["brandId"] ? { errorMessage: errors["brandId"] } : {})}
        />
        <FormSelect
          name="preset"
          label="Formato"
          value={preset}
          onValueChange={(value) => {
            if (isPreset(value)) setPreset(value);
          }}
          items={presetItems}
          required
          hint="Até 90 segundos, a 30 quadros por segundo."
          error={errors["preset"] !== undefined}
          {...(errors["preset"] ? { errorMessage: errors["preset"] } : {})}
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
