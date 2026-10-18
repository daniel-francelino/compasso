import { FormDialog } from "@/components/shared/admin/form-dialog";
import { LayoutTemplate } from "lucide-react";
import { SectionCategory, componentRegistry } from "@/lib/shared/content/registry";
import { SectionKind } from "@/lib/shared/enums";

const categoryLabels: Record<SectionCategory, string> = {
  [SectionCategory.Opening]: "Abertura",
  [SectionCategory.Text]: "Texto",
  [SectionCategory.Image]: "Imagem",
  [SectionCategory.Collection]: "Coleções",
  [SectionCategory.Invite]: "Convite",
};

export function AddSectionDialog({
  onPick,
  onOpenChange,
}: {
  onPick: (kind: SectionKind) => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      icon={LayoutTemplate}
      title="Adicionar seção"
      description="Escolha o tipo de seção. O conteúdo você preenche depois."
      submitLabel="Fechar"
      onSubmit={() => onOpenChange(false)}
    >
      {Object.values(SectionCategory).map((category) => {
        const items = Object.values(SectionKind).filter(
          (kind) => componentRegistry[kind].category === category,
        );
        if (items.length === 0) return null;
        return (
          <section key={category} aria-label={categoryLabels[category]} className="space-y-2">
            <h3 className="text-sm font-semibold">{categoryLabels[category]}</h3>
            <ul className="space-y-2">
              {items.map((kind) => (
                <li key={kind}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-border p-3 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={() => {
                      onPick(kind);
                      onOpenChange(false);
                    }}
                  >
                    <span className="block font-medium">{componentRegistry[kind].label}</span>
                    <span className="block text-sm text-muted-foreground">
                      {componentRegistry[kind].description}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </FormDialog>
  );
}
