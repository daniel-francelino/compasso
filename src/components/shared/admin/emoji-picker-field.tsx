import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import { Smile, X } from "lucide-react";
import { useState } from "react";
import { Label } from "@/components/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shared/ui/popover";
import { cn } from "@/lib/shared/utils";

export function EmojiPickerField({
  id,
  label,
  value,
  onValueChange,
  hint,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  hint?: string;
  error?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const hasValue = value !== "";
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-3">
        <div className="relative">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                id={id}
                type="button"
                aria-label={hasValue ? `${label}: ${value}. Trocar emoji` : `Escolher ${label}`}
                aria-describedby={describedBy}
                aria-invalid={error ? true : undefined}
                className={cn(
                  "flex size-16 cursor-pointer items-center justify-center rounded-full border border-border bg-muted text-3xl transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  error && "border-destructive",
                )}
              >
                {hasValue ? (
                  <span aria-hidden="true">{value}</span>
                ) : (
                  <Smile className="size-7 text-muted-foreground" aria-hidden="true" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto border-0 p-0">
              <EmojiPicker
                theme={Theme.LIGHT}
                emojiStyle={EmojiStyle.NATIVE}
                lazyLoadEmojis
                skinTonesDisabled
                width={320}
                height={380}
                searchPlaceholder="Buscar emoji"
                previewConfig={{ showPreview: false }}
                onEmojiClick={(emoji) => {
                  onValueChange(emoji.emoji);
                  setOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          {hasValue ? (
            <button
              type="button"
              aria-label="Remover emoji"
              onClick={() => onValueChange("")}
              className="absolute -right-1 -top-1 flex size-6 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {hint ? (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
