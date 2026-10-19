import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { hintTip } from "@/components/shared/admin/field-tip";
import { FieldLabel, FieldMessage } from "@/components/shared/admin/form-fields";
import { Input } from "@/components/shared/ui/input";

export function TagInputField({
  id,
  label,
  value,
  onValueChange,
  maxItems,
  maxLength,
  error,
}: {
  id: string;
  label: string;
  value: string[];
  onValueChange: (value: string[]) => void;
  maxItems: number;
  maxLength: number;
  error?: string | undefined;
}) {
  const [draft, setDraft] = useState("");
  const isFull = value.length >= maxItems;
  const addTag = () => {
    const tag = draft.trim();
    if (tag === "" || value.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      setDraft("");
      return;
    }
    if (isFull) return;
    onValueChange([...value, tag]);
    setDraft("");
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addTag();
  };

  return (
    <div className="space-y-1.5">
      <FieldLabel
        htmlFor={id}
        tip={hintTip(label, `Até ${maxItems} etiquetas. Digite e pressione Enter para adicionar.`)}
      >
        {label}
      </FieldLabel>
      <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-ring">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-sm text-secondary-foreground"
          >
            {tag}
            <button
              type="button"
              className="inline-flex size-5 items-center justify-center rounded-sm hover:bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label={`Remover etiqueta ${tag}`}
              onClick={() => onValueChange(value.filter((item) => item !== tag))}
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </span>
        ))}
        <Input
          id={id}
          name={id}
          value={draft}
          maxLength={maxLength}
          placeholder={isFull ? "Limite de etiquetas atingido" : "Digite e pressione Enter"}
          disabled={isFull}
          className="h-7 min-w-32 flex-1 border-0 px-0 shadow-none focus-visible:ring-0"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-message` : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <FieldMessage error={error} />
    </div>
  );
}
