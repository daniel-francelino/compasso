import { UploadCloud } from "lucide-react";
import { motion } from "motion/react";
import { type ReactNode, useRef, useState } from "react";
import { acceptFor, type MediaKind } from "@/lib/shared/media/limits";
import { cn } from "@/lib/shared/utils";

export function FileDropzone({
  kinds,
  empty,
  disabled,
  full,
  hint,
  onFiles,
  children,
}: {
  kinds: readonly MediaKind[];
  empty: boolean;
  disabled: boolean;
  full: boolean;
  hint: string;
  onFiles: (files: File[]) => void;
  children: (openPicker: () => void) => ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const blocked = disabled || full;
  const openPicker = () => input.current?.click();
  const receive = (files: File[]) => {
    if (files.length > 0) onFiles(files);
  };

  return (
    <div
      className="relative"
      onDragOver={(event) => {
        if (blocked || !event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={(event) => {
        const stillInside =
          event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget);
        if (!stillInside) setOver(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setOver(false);
        if (blocked) return;
        receive(Array.from(event.dataTransfer.files));
      }}
    >
      <input
        ref={input}
        type="file"
        className="sr-only"
        multiple
        tabIndex={-1}
        accept={acceptFor(kinds)}
        aria-label="Escolher arquivos para enviar"
        onChange={(event) => {
          receive(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      {empty ? (
        <button
          type="button"
          disabled={blocked}
          onClick={openPicker}
          className={cn(
            "group flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-input bg-background px-4 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
            !blocked && "hover:border-primary/60 hover:bg-accent/50",
          )}
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-primary transition-colors group-hover:bg-accent">
            <UploadCloud className="size-5" aria-hidden="true" />
          </span>
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">
              Arraste arquivos aqui ou clique para enviar
            </span>
            <span className="block text-xs text-muted-foreground">{hint}</span>
          </span>
        </button>
      ) : (
        children(openPicker)
      )}
      {over ? (
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-accent/85"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <UploadCloud className="size-5 text-primary" />
            Solte para enviar
          </span>
        </motion.div>
      ) : null}
    </div>
  );
}
