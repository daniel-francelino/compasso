import { CircleAlert, CircleCheck, FileUp, Loader2, X, Upload, RotateCw } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog";
import { Progress } from "@/components/shared/ui/progress";
import { type UploadItem, UploadStatus, useMediaUpload } from "@/hooks/shared/use-media-upload";
import type { MediaScope } from "@/lib/shared/enums";
import { formatBytes } from "@/lib/shared/format";
import {
  ACCEPTED_FORMATS_LABEL,
  MAX_FILES_PER_UPLOAD,
  acceptAttribute,
} from "@/lib/shared/media/limits";

const statusLabel: Record<UploadStatus, string> = {
  [UploadStatus.Queued]: "Na fila",
  [UploadStatus.Uploading]: "Enviando…",
  [UploadStatus.Done]: "Enviado",
  [UploadStatus.Failed]: "Falhou",
};

function Row({
  item,
  onRemove,
  disabled,
}: {
  item: UploadItem;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <li className="space-y-1 rounded-md border border-border p-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-medium">{item.file.name}</span>
        <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
          {item.status === UploadStatus.Done ? (
            <CircleCheck className="size-4 text-success" aria-hidden="true" />
          ) : null}
          {item.status === UploadStatus.Failed ? (
            <CircleAlert className="size-4 text-danger" aria-hidden="true" />
          ) : null}
          {item.status === UploadStatus.Uploading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {statusLabel[item.status]} · {formatBytes(item.file.size)}
        </span>
        {item.status === UploadStatus.Done ? null : (
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label={`Remover ${item.file.name} da lista`}
            disabled={disabled && item.status === UploadStatus.Uploading}
            onClick={onRemove}
          >
            <X aria-hidden="true" />
          </Button>
        )}
      </div>
      {item.status === UploadStatus.Uploading ? (
        <Progress value={undefined} aria-label="Enviando" />
      ) : null}
      {item.message ? (
        <p role="alert" className="text-xs text-destructive">
          {item.message}
        </p>
      ) : null}
    </li>
  );
}

export function UploadDialog({
  open,
  onOpenChange,
  scope,
  brandId,
  assetId,
  title = "Enviar arquivos",
  single = false,
  onFinished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: MediaScope;
  brandId?: string | undefined;
  assetId?: string | undefined;
  title?: string;
  single?: boolean;
  onFinished: (items: UploadItem[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useMediaUpload({ scope, brandId, assetId }, onFinished);
  const queued = upload.items.filter((item) => item.status === UploadStatus.Queued).length;
  const failed = upload.items.filter((item) => item.status === UploadStatus.Failed).length;

  const close = (next: boolean) => {
    if (upload.busy) return;
    if (!next) upload.clear();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="size-5 text-muted-foreground" aria-hidden="true" /> {title}
          </DialogTitle>
          <DialogDescription>
            Aceitamos {ACCEPTED_FORMATS_LABEL}. Até {MAX_FILES_PER_UPLOAD} arquivos por vez. Tudo
            começa privado.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={input}
          type="file"
          className="sr-only"
          multiple={!single}
          accept={acceptAttribute}
          aria-label="Escolher arquivos"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            upload.add(single ? files.slice(0, 1) : files);
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="h-24 w-full border-dashed"
          disabled={upload.busy}
          onClick={() => input.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const files = Array.from(event.dataTransfer.files);
            upload.add(single ? files.slice(0, 1) : files);
          }}
        >
          <Upload aria-hidden="true" />
          Escolher arquivos ou soltar aqui
        </Button>

        <ul className="max-h-64 space-y-2 overflow-y-auto" aria-live="polite">
          {upload.items.map((item) => (
            <Row
              key={item.id}
              item={item}
              disabled={upload.busy}
              onRemove={() => upload.remove(item.id)}
            />
          ))}
        </ul>

        <DialogFooter>
          {failed > 0 && !upload.busy ? (
            <Button variant="outline" onClick={upload.retryFailed}>
              <RotateCw aria-hidden="true" />
              Tentar de novo os que falharam
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => close(false)} disabled={upload.busy}>
            <X aria-hidden="true" />
            Fechar
          </Button>
          <Button
            onClick={() => void upload.start()}
            loading={upload.busy}
            disabled={queued === 0 || upload.busy}
          >
            <Upload aria-hidden="true" />
            Enviar {queued > 0 ? `(${queued})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
