import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/shared/ui/progress";
import { formatBytes } from "@/lib/shared/format";
import { QUOTA_ALERT_RATIO, QUOTA_WARN_RATIO } from "@/lib/shared/media/limits";
import { getStorageSummary } from "@/lib/shared/media/media.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

export function StorageBar() {
  const query = useQuery({
    queryKey: QueryKey.Media.storage(),
    queryFn: async () => unwrapResult(await getStorageSummary()),
  });
  if (!query.data) return null;

  const ratio = query.data.quotaBytes > 0 ? query.data.usedBytes / query.data.quotaBytes : 0;
  const message =
    ratio >= QUOTA_ALERT_RATIO
      ? "O espaço está quase no fim. Novos envios podem ser recusados."
      : ratio >= QUOTA_WARN_RATIO
        ? "O espaço está acabando."
        : null;

  return (
    <div className="space-y-1" aria-live="polite">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Espaço usado</span>
        <span>
          {formatBytes(query.data.usedBytes)} de {formatBytes(query.data.quotaBytes)}
        </span>
      </div>
      <Progress
        value={Math.min(100, Math.round(ratio * 100))}
        aria-label="Espaço de armazenamento usado"
      />
      {message ? <p className="text-xs font-medium text-warning">{message}</p> : null}
    </div>
  );
}
