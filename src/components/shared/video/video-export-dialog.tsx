import { Link } from "@tanstack/react-router";
import { CircleCheck, Download, RefreshCw, X } from "lucide-react";
import { Modal } from "lost-ui/elements/modal";
import { Alert, AlertDescription } from "lost-ui/ui/alert";
import { Progress } from "lost-ui/ui/progress";
import { Button } from "@/components/shared/ui/button";
import type { VideoExport } from "@/hooks/shared/video/use-video-export";
import { formatTimecode } from "@/lib/shared/video/timeline";
import { VIDEO_EXPORT_STAGE_LABEL, VideoExportStage } from "@/lib/shared/video/types";

const PERCENT = 100;

export function VideoExportDialog({
  open,
  onOpenChange,
  exporter,
  durationMs,
  onStart,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exporter: VideoExport;
  durationMs: number;
  onStart: () => void;
}) {
  const { stage, busy } = exporter;
  const percent = Math.round(exporter.progress * PERCENT);
  const close = (next: boolean) => {
    if (busy) return;
    if (!next) exporter.reset();
    onOpenChange(next);
  };

  return (
    <Modal
      open={open}
      onOpenChange={close}
      dismissible={!busy}
      title="Exportar vídeo"
      description={`MP4 (H.264 e AAC), 30 quadros por segundo, ${formatTimecode(durationMs)} de duração. O arquivo vai para a biblioteca da marca.`}
      footer={() => (
        <>
          {busy ? (
            <Button
              type="button"
              variant="outline"
              disabled={stage === VideoExportStage.Uploading}
              onClick={exporter.cancel}
            >
              <X aria-hidden="true" />
              Cancelar
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Fechar
            </Button>
          )}
          {exporter.canRetryUpload ? (
            <Button type="button" onClick={exporter.retryUpload}>
              <RefreshCw aria-hidden="true" />
              Tentar enviar de novo
            </Button>
          ) : null}
          {busy || stage === VideoExportStage.Done || exporter.canRetryUpload ? null : (
            <Button type="button" onClick={onStart}>
              <Download aria-hidden="true" />
              {stage === null ? "Exportar" : "Exportar de novo"}
            </Button>
          )}
        </>
      )}
    >
      <div className="space-y-4" aria-live="polite">
        {stage === null ? (
          <p className="text-sm text-muted-foreground">
            Uma versão do projeto é salva antes da exportação. O vídeo é gerado neste navegador:
            mantenha a aba aberta até terminar. Funciona no Chrome e no Edge atualizados.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium">{VIDEO_EXPORT_STAGE_LABEL[stage]}</p>
            {busy ? <Progress value={stage === VideoExportStage.Preparing ? 0 : percent} /> : null}
            {stage === VideoExportStage.Rendering || stage === VideoExportStage.Uploading ? (
              <p className="text-xs text-muted-foreground tabular-nums">{percent}%</p>
            ) : null}
          </div>
        )}
        {exporter.error === null ? null : (
          <Alert variant="destructive">
            <AlertDescription>{exporter.error}</AlertDescription>
          </Alert>
        )}
        {stage === VideoExportStage.Done && exporter.assetId !== null ? (
          <Alert>
            <AlertDescription className="flex flex-wrap items-center gap-2">
              <CircleCheck aria-hidden="true" className="size-4 text-success" />
              <span>
                O vídeo está na biblioteca. Para usar em um conteúdo, escolha o arquivo no editor do
                conteúdo.
              </span>
              <Link
                to="/admin/library/$assetId"
                params={{ assetId: exporter.assetId }}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Abrir na biblioteca
              </Link>
            </AlertDescription>
          </Alert>
        ) : null}
      </div>
    </Modal>
  );
}
