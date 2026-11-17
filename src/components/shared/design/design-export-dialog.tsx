import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Download } from "lucide-react";
import { Suspense, lazy, useEffect, useState } from "react";
import { Modal } from "lost-ui/elements/modal";
import { FormSelect } from "lost-ui/forms/form-select";
import { Alert, AlertDescription } from "lost-ui/ui/alert";
import { Progress } from "lost-ui/ui/progress";
import { Button } from "@/components/shared/ui/button";
import { useDesignAssets } from "@/hooks/shared/design/use-design-assets";
import { type ExportScale, useDesignExport } from "@/hooks/shared/design/use-design-export";
import type { CanvasChrome } from "@/lib/shared/design/browser";
import { listDesignExports } from "@/lib/shared/design/design.functions";
import type { DesignDocument } from "@/lib/shared/design/schemas";
import {
  DESIGN_EXPORT_FORMAT_LABEL,
  DESIGN_PRESET_SIZE,
  DesignExportFormat,
  type DesignPreset,
} from "@/lib/shared/design/types";
import { MediaVariant } from "@/lib/shared/media/schemas";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const DesignCanvas = lazy(() => import("@/components/shared/design/design-canvas"));

const formatItems = Object.values(DesignExportFormat).map((format) => ({
  value: format,
  label: DESIGN_EXPORT_FORMAT_LABEL[format],
}));
const scaleItems = [
  { value: "1", label: "1x (tamanho do formato)" },
  { value: "2", label: "2x (o dobro, para telas de alta densidade)" },
];
const NO_IDS: string[] = [];

const asFormat = (value: string) => formatItems.find((item) => item.value === value)?.value;

function ExportJobView({
  document,
  preset,
  chrome,
  designId,
  designName,
  brandId,
  reuseAssets,
  saveVersion,
  onBusyChange,
}: {
  document: DesignDocument;
  preset: DesignPreset;
  chrome: CanvasChrome;
  designId: string;
  designName: string;
  brandId: string;
  reuseAssets: boolean;
  saveVersion: () => Promise<number | null>;
  onBusyChange: (busy: boolean) => void;
}) {
  const [format, setFormat] = useState<DesignExportFormat>(DesignExportFormat.Png);
  const [scale, setScale] = useState<ExportScale>(1);
  const [preparing, setPreparing] = useState(false);
  const assets = useDesignAssets(document, MediaVariant.Original);
  const previous = useQuery({
    queryKey: QueryKey.Design.exports(designId),
    queryFn: async () => unwrapResult(await listDesignExports({ data: { id: designId } })).exports,
  });
  const previousAssets = new Map<number, string>();
  for (const row of [...(previous.data ?? [])].reverse()) {
    previousAssets.set(row.pageNo, row.mediaAssetId);
  }
  const exporter = useDesignExport({
    designId,
    designName,
    brandId,
    previousAssets,
    reuseAssets,
    assetsReady: assets.ready,
  });
  const transparent = document.pages.some((page) => page.background === null);
  const jpegBlocked = format === DesignExportFormat.Jpeg && transparent;
  const busy = preparing || exporter.running;
  const total = document.pages.length;
  const page = exporter.job === null ? undefined : document.pages[exporter.job.index];
  const size = DESIGN_PRESET_SIZE[preset];

  const start = async () => {
    setPreparing(true);
    const versionNo = await saveVersion();
    setPreparing(false);
    if (versionNo === null) return;
    exporter.start(versionNo, total, format, scale);
  };

  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);

  return (
    <div className="space-y-4">
      <FormSelect
        name="format"
        label="Formato do arquivo"
        value={format}
        items={formatItems}
        disabled={busy}
        onValueChange={(value) => {
          const next = asFormat(value);
          if (next !== undefined) setFormat(next);
        }}
        error={jpegBlocked}
        {...(jpegBlocked
          ? {
              errorMessage:
                "JPEG não tem transparência: escolha uma cor de fundo em todas as páginas.",
            }
          : {})}
      />
      <FormSelect
        name="scale"
        label="Tamanho"
        value={String(scale)}
        items={scaleItems}
        disabled={busy}
        onValueChange={(value) => setScale(value === "2" ? 2 : 1)}
      />
      <p className="text-sm text-muted-foreground">
        Uma versão do design é salva antes. Cada página vira um arquivo da marca na biblioteca (
        {total} {total === 1 ? "arquivo" : "arquivos"}).
        {reuseAssets ? " Uma página exportada de novo vira uma nova versão do mesmo arquivo." : ""}
      </p>
      {exporter.job === null ? null : (
        <div className="space-y-2" aria-live="polite">
          <p className="text-sm">
            Exportando a página {exporter.job.index + 1} de {exporter.job.total}…
          </p>
          <Progress value={(exporter.job.index / exporter.job.total) * 100} />
        </div>
      )}
      {exporter.error === null ? null : (
        <Alert variant="destructive">
          <AlertDescription>{exporter.error}</AlertDescription>
        </Alert>
      )}
      {exporter.done === null ? null : (
        <Alert>
          <AlertDescription className="space-y-2">
            <p>
              Pronto. Os arquivos estão na biblioteca da marca. Para usar em um conteúdo, abra o
              conteúdo e escolha os arquivos na etapa de arte.
            </p>
            <ul className="list-inside list-disc">
              {exporter.done.map((result) => (
                <li key={result.pageNo}>
                  <Link
                    to="/admin/library/$assetId"
                    params={{ assetId: result.assetId }}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Página {result.pageNo}
                  </Link>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <Button
        type="button"
        loading={busy}
        disabled={jpegBlocked || assets.failed}
        onClick={() => void start()}
      >
        <Download aria-hidden="true" />
        {exporter.done === null ? "Exportar" : "Exportar de novo"}
      </Button>
      {page === undefined ? null : (
        <div aria-hidden="true" className="pointer-events-none fixed -left-full top-0 opacity-0">
          <Suspense fallback={null}>
            <DesignCanvas
              page={page}
              size={size}
              scale={exporter.job?.scale ?? 1}
              selectedIds={NO_IDS}
              images={assets.images}
              chrome={chrome}
              fontsVersion={assets.fontsVersion}
              editable={false}
              interactive={false}
              label="Exportação"
              onStage={exporter.onStage}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}

export function DesignExportDialog({
  open,
  onOpenChange,
  ...props
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DesignDocument;
  preset: DesignPreset;
  chrome: CanvasChrome;
  designId: string;
  designName: string;
  brandId: string;
  reuseAssets: boolean;
  saveVersion: () => Promise<number | null>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      dismissible={!busy}
      title="Exportar"
      description="Gera arquivos PNG ou JPEG de todas as páginas, a partir dos arquivos originais."
      footer={({ close }) => (
        <Button type="button" variant="outline" disabled={busy} onClick={close}>
          <ArrowLeft aria-hidden="true" />
          Voltar
        </Button>
      )}
    >
      {open ? <ExportJobView {...props} onBusyChange={setBusy} /> : null}
    </Modal>
  );
}
