import { useQueryClient } from "@tanstack/react-query";
import type Konva from "konva";
import { useCallback, useEffect, useRef, useState } from "react";
import { newItem, sendUpload } from "@/hooks/shared/use-media-upload";
import { fileSlug } from "@/lib/shared/file-name";
import { logError } from "@/lib/shared/logger";
import { recordDesignExport } from "@/lib/shared/design/design.functions";
import { DESIGN_EXPORT_MIME, DESIGN_LIMITS, DesignExportFormat } from "@/lib/shared/design/types";
import { MediaScope } from "@/lib/shared/enums";
import { DEFAULT_LIMITS_MB } from "@/lib/shared/media/limits";
import { QueryKey } from "@/lib/shared/query-keys";

export type ExportScale = 1 | 2;

export type ExportResult = { pageNo: number; assetId: string };

export type ExportJob = {
  versionNo: number;
  format: DesignExportFormat;
  scale: ExportScale;
  index: number;
  total: number;
  results: ExportResult[];
};

type Options = {
  designId: string;
  designName: string;
  brandId: string;
  previousAssets: ReadonlyMap<number, string>;
  reuseAssets: boolean;
  assetsReady: boolean;
  opaque: boolean;
};

const RENDER_FAILED =
  "Não foi possível gerar a imagem. Confira se o armazenamento permite a leitura das imagens (CORS) e tente de novo.";

const JPEG_FALLBACK_NOTICE =
  "O PNG ficou maior que o limite de arquivos da biblioteca e as páginas grandes foram exportadas em JPEG.";

const MAX_EXPORT_BYTES = DEFAULT_LIMITS_MB.image * 1024 * 1024;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const render = async (stage: Konva.Stage, format: DesignExportFormat): Promise<Blob | null> => {
  await nextFrame();
  await nextFrame();
  try {
    const blob = await stage.toBlob({
      mimeType: DESIGN_EXPORT_MIME[format],
      quality: DESIGN_LIMITS.jpegQuality,
      pixelRatio: 1,
    });
    return blob instanceof Blob ? blob : null;
  } catch (error) {
    logError(error);
    return null;
  }
};

export const useDesignExport = (options: Options) => {
  const queryClient = useQueryClient();
  const [job, setJob] = useState<ExportJob | null>(null);
  const [done, setDone] = useState<ExportResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stageVersion, setStageVersion] = useState(0);
  const stageRef = useRef<Konva.Stage | null>(null);
  const latest = useRef(options);
  latest.current = options;

  const onStage = useCallback((stage: Konva.Stage | null) => {
    stageRef.current = stage;
    if (stage !== null) setStageVersion((value) => value + 1);
  }, []);

  const upload = async (current: ExportJob, blob: Blob): Promise<ExportResult | string> => {
    const { designId, designName, brandId, previousAssets, reuseAssets } = latest.current;
    const pageNo = current.index + 1;
    const extension = current.format === DesignExportFormat.Png ? "png" : "jpg";
    const file = new File(
      [blob],
      `${fileSlug(designName, "design")}-pagina-${pageNo}.${extension}`,
      {
        type: DESIGN_EXPORT_MIME[current.format],
      },
    );
    const previous = reuseAssets ? previousAssets.get(pageNo) : undefined;
    const target = { scope: MediaScope.Brand, brandId };
    const first = await sendUpload(newItem(file), { ...target, assetId: previous });
    const sent =
      first.ok || previous === undefined ? first : await sendUpload(newItem(file), target);
    if (!sent.ok) return sent.message;
    const recorded = await recordDesignExport({
      data: {
        id: designId,
        versionNo: current.versionNo,
        pageNo,
        format: current.format,
        scale: current.scale,
        mediaVersionId: sent.versionId,
      },
    });
    return recorded.ok ? { pageNo, assetId: sent.assetId } : recorded.message;
  };

  const uploadRef = useRef(upload);
  uploadRef.current = upload;
  const designId = options.designId;

  useEffect(() => {
    const stage = stageRef.current;
    if (job === null || stage === null || stageVersion === 0 || !options.assetsReady) {
      return undefined;
    }
    let active = true;
    void (async () => {
      const first = await render(stage, job.format);
      const oversize =
        first !== null &&
        job.format === DesignExportFormat.Png &&
        latest.current.opaque &&
        first.size > MAX_EXPORT_BYTES;
      const fallback = oversize ? await render(stage, DesignExportFormat.Jpeg) : null;
      const blob = fallback ?? first;
      const sent = fallback === null ? job : { ...job, format: DesignExportFormat.Jpeg };
      const outcome = blob === null ? RENDER_FAILED : await uploadRef.current(sent, blob);
      if (fallback !== null && active) setNotice(JPEG_FALLBACK_NOTICE);
      if (!active) return;
      if (typeof outcome === "string") {
        setError(outcome);
        setJob(null);
        return;
      }
      const results = [...job.results, outcome];
      if (job.index + 1 < job.total) {
        setJob({ ...job, index: job.index + 1, results });
        return;
      }
      setDone(results);
      setJob(null);
      void queryClient.invalidateQueries({ queryKey: QueryKey.Design.exports(designId) });
      void queryClient.invalidateQueries({ queryKey: QueryKey.Media.all() });
    })();
    return () => {
      active = false;
    };
  }, [job, stageVersion, options.assetsReady, queryClient, designId]);

  return {
    job,
    done,
    error,
    notice,
    onStage,
    running: job !== null,
    start: (versionNo: number, total: number, format: DesignExportFormat, scale: ExportScale) => {
      setError(null);
      setNotice(null);
      setDone(null);
      setJob({ versionNo, format, scale, index: 0, total, results: [] });
    },
    reset: () => {
      setError(null);
      setNotice(null);
      setDone(null);
      setJob(null);
    },
  };
};
