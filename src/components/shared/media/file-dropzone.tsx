import { Images, UploadCloud } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { Button } from "@/components/shared/ui/button";
import { acceptFor, type MediaKind } from "@/lib/shared/media/limits";
import { cn } from "@/lib/shared/utils";

export function FileDropzone({
  kinds,
  compact,
  disabled,
  full,
  canUpload,
  hint,
  onFiles,
  onLibrary,
}: {
  kinds: readonly MediaKind[];
  compact: boolean;
  disabled: boolean;
  full: boolean;
  canUpload: boolean;
  hint: string;
  onFiles: (files: File[]) => void;
  onLibrary: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const blocked = disabled || full;
  const receive = (files: File[]) => {
    if (files.length > 0) onFiles(files);
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border-2 border-dashed bg-background transition-colors duration-200",
        over ? "border-primary bg-accent" : "border-input",
        !over && !blocked && "hover:border-primary/60",
        blocked && "opacity-60",
      )}
      onDragOver={(event) => {
        if (!canUpload || blocked) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={(event) => {
        const stillInside =
          event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget);
        if (!stillInside) setOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (!canUpload || blocked) return;
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
      {canUpload ? (
        <button
          type="button"
          disabled={blocked}
          onClick={() => input.current?.click()}
          className={cn(
            "group flex w-full cursor-pointer items-center justify-center gap-3 px-4 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-not-allowed",
            compact ? "flex-row py-3" : "flex-col py-8",
            !over && !blocked && "hover:bg-accent/50",
          )}
        >
          <motion.span
            animate={{ y: over ? -4 : 0, scale: over ? 1.1 : 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full bg-muted text-primary transition-colors group-hover:bg-accent",
              compact ? "size-9" : "size-12",
            )}
          >
            <UploadCloud className={compact ? "size-4" : "size-5"} aria-hidden="true" />
          </motion.span>
          <span className={cn("space-y-0.5", compact && "text-left")}>
            <span className="block text-sm font-medium">
              {full ? "Limite de arquivos atingido" : null}
              {!full && over ? "Solte para enviar" : null}
              {!full && !over ? "Arraste arquivos aqui ou clique para enviar" : null}
            </span>
            <span className="block text-xs text-muted-foreground">{hint}</span>
          </span>
        </button>
      ) : null}
      <div
        className={cn(
          "flex items-center justify-end px-3 py-2",
          canUpload && "border-t border-dashed border-input",
        )}
      >
        <Button type="button" variant="outline" size="sm" disabled={blocked} onClick={onLibrary}>
          <Images aria-hidden="true" />
          Adicionar da biblioteca
        </Button>
      </div>
    </div>
  );
}
