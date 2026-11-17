import { useQuery } from "@tanstack/react-query";
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
import { createDesign, getDesign, listDesigns } from "@/lib/shared/design/design.functions";
import {
  DESIGN_LIMITS,
  DESIGN_PRESET_LABEL,
  DesignPreset,
  type DesignPreset as DesignPresetValue,
  DesignStatusFilter,
} from "@/lib/shared/design/types";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const NO_TEMPLATE = "none";

const presetItems = Object.values(DesignPreset).map((preset) => ({
  value: preset,
  label: DESIGN_PRESET_LABEL[preset],
}));

const isPreset = (value: string): value is DesignPresetValue =>
  presetItems.some((item) => item.value === value);

export function NewDesignDialog({
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
  const [preset, setPreset] = useState<DesignPresetValue>(DesignPreset.FeedPortrait);
  const [templateId, setTemplateId] = useState(NO_TEMPLATE);
  const templatesRequest = { search: "", page: 1, status: DesignStatusFilter.Templates, brandId };
  const templates = useQuery({
    queryKey: QueryKey.Design.list(templatesRequest),
    queryFn: async () => unwrapResult(await listDesigns({ data: templatesRequest })).rows,
    enabled: open && brandId !== "",
  });
  const template = templates.data?.find((row) => row.id === templateId);

  const brandItems = (brands.data ?? []).map((brand) => ({
    value: brand.id,
    label: brand.name,
    description: brand.clientName,
  }));
  const templateItems = [
    { value: NO_TEMPLATE, label: "Página em branco" },
    ...(templates.data ?? []).map((row) => ({
      value: row.id,
      label: row.name,
      description: DESIGN_PRESET_LABEL[row.preset],
    })),
  ];

  function handleSubmit() {
    void send(
      async () => {
        if (template === undefined) return createDesign({ data: { brandId, name, preset } });
        const loaded = await getDesign({ data: { id: template.id } });
        if (!loaded.ok) return loaded;
        return createDesign({
          data: { brandId, name, preset: template.preset, document: loaded.design.document },
        });
      },
      async (result) => {
        toast.success("Design criado.");
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
      open={open}
      onOpenChange={onOpenChange}
      dismissible={!busy}
      title="Novo design"
      description="Escolha a marca, o formato ou um modelo da marca. Você poderá editar o nome depois."
      footer={({ close }) => (
        <>
          <Button type="button" variant="outline" disabled={busy} onClick={close}>
            <ArrowLeft aria-hidden="true" />
            Voltar
          </Button>
          <Button type="submit" form="new-design-form" loading={busy}>
            <Plus aria-hidden="true" />
            Criar design
          </Button>
        </>
      )}
    >
      <Form id="new-design-form" className="space-y-4" onSubmit={handleSubmit}>
        <FormInput
          name="name"
          label="Nome"
          value={name}
          onValueChange={setName}
          required
          hint={`Até ${DESIGN_LIMITS.nameMax} caracteres.`}
          rules={[
            rules.required("Informe o nome do design."),
            rules.maxLength(DESIGN_LIMITS.nameMax, "O nome é longo demais."),
          ]}
          error={errors["name"] !== undefined}
          {...(errors["name"] ? { errorMessage: errors["name"] } : {})}
        />
        <FormSelect
          name="brandId"
          label="Marca"
          value={brandId}
          onValueChange={(value) => {
            setBrandId(value);
            setTemplateId(NO_TEMPLATE);
          }}
          items={brandItems}
          placeholder={brands.isPending ? "Carregando marcas…" : "Escolha a marca"}
          required
          rules={[rules.required("Escolha a marca.")]}
          error={errors["brandId"] !== undefined}
          {...(errors["brandId"] ? { errorMessage: errors["brandId"] } : {})}
        />
        <FormSelect
          name="templateId"
          label="Modelo"
          value={templateId}
          onValueChange={setTemplateId}
          items={templateItems}
          disabled={brandId === ""}
          hint={
            brandId === ""
              ? "Escolha a marca para ver os modelos dela."
              : templates.data?.length === 0
                ? 'Esta marca ainda não tem modelos. Marque um design como "Modelo da marca" no editor.'
                : "Um modelo copia o conteúdo e o formato dele."
          }
        />
        <FormSelect
          name="preset"
          label="Formato"
          value={template?.preset ?? preset}
          onValueChange={(value) => {
            if (isPreset(value)) setPreset(value);
          }}
          items={presetItems}
          disabled={template !== undefined}
          required
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
