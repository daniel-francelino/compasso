import {
  ChevronDown,
  CircleAlert,
  CircleCheck,
  FileText,
  Film,
  ImageIcon,
  Loader2,
  RotateCw,
  X,
} from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useState } from "react";
import { IconButton } from "@/components/shared/admin/icon-button";
import { Progress } from "@/components/shared/ui/progress";
import { type UploadItem, UploadStatus } from "@/hooks/shared/use-media-upload";
import type { TrayTask } from "@/hooks/shared/use-upload-tray";
import { formatBytes } from "@/lib/shared/format";
import { MediaKind, kindOfMime, mimeOfFile } from "@/lib/shared/media/limits";
import { cn } from "@/lib/shared/utils";

const kindIcons = {
  [MediaKind.Image]: ImageIcon,
  [MediaKind.Video]: Film,
  [MediaKind.Document]: FileText,
};

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

const summaryOf = (items: UploadItem[]): string => {
  const active = items.filter(
    (item) => item.status === UploadStatus.Queued || item.status === UploadStatus.Uploading,
  ).length;
  const failed = items.filter((item) => item.status === UploadStatus.Failed).length;
  if (active > 0) return `Enviando ${plural(active, "arquivo", "arquivos")}`;
  if (failed > 0) return `${plural(failed, "envio falhou", "envios falharam")}`;
  return `${plural(items.length, "arquivo enviado", "arquivos enviados")}`;
};

function StatusIcon({ status }: { status: UploadStatus }) {
  if (status === UploadStatus.Done) {
    return <CircleCheck className="size-4 text-success" aria-hidden="true" />;
  }
  if (status === UploadStatus.Failed) {
    return <CircleAlert className="size-4 text-danger" aria-hidden="true" />;
  }
  if (status === UploadStatus.Uploading) {
    return <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />;
  }
  return null;
}

function TaskRow({
  task,
  onRetry,
  onRemove,
}: {
  task: TrayTask;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const { item } = task;
  const Icon = kindIcons[kindOfMime(mimeOfFile(item.file)) ?? MediaKind.Document];
  const uploading = item.status === UploadStatus.Uploading;
  const queued = item.status === UploadStatus.Queued;
  const failed = item.status === UploadStatus.Failed;
  const percent = Math.round(task.progress * 100);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 px-3 py-2"
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
          failed && "bg-destructive/10 text-danger",
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-medium">{item.file.name}</p>
        {uploading ? (
          <Progress value={percent} className="h-1.5" aria-label={`Enviando ${item.file.name}`} />
        ) : null}
        <p
          role={failed ? "alert" : undefined}
          className={cn("truncate text-xs text-muted-foreground", failed && "text-danger")}
        >
          {failed && item.message ? item.message : null}
          {uploading ? `Enviando… ${percent}%` : null}
          {queued ? `Na fila · ${formatBytes(item.file.size)}` : null}
          {item.status === UploadStatus.Done
            ? `Na biblioteca · ${formatBytes(item.file.size)}`
            : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center">
        <StatusIcon status={item.status} />
        {failed ? (
          <IconButton
            label={`Tentar de novo ${item.file.name}`}
            icon={RotateCw}
            onClick={onRetry}
          />
        ) : null}
        {uploading ? null : (
          <IconButton label={`Tirar ${item.file.name} da lista`} icon={X} onClick={onRemove} />
        )}
      </div>
    </motion.li>
  );
}

export function UploadTrayPanel({
  tasks,
  onRetry,
  onRemove,
  onDismiss,
}: {
  tasks: TrayTask[];
  onRetry: (taskId: string) => void;
  onRemove: (taskId: string) => void;
  onDismiss: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const items = tasks.map((task) => task.item);
  const busy = items.some(
    (item) => item.status === UploadStatus.Queued || item.status === UploadStatus.Uploading,
  );
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {tasks.length > 0 ? (
          <motion.section
            key="upload-tray"
            aria-label="Envio de arquivos"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed right-4 bottom-4 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl"
          >
            <header className="flex items-center gap-2 border-b border-border bg-muted px-3 py-2">
              <p className="flex-1 text-sm font-medium" aria-live="polite">
                {summaryOf(items)}
              </p>
              <IconButton
                label={collapsed ? "Mostrar envios" : "Recolher envios"}
                icon={ChevronDown}
                onClick={() => setCollapsed((current) => !current)}
              />
              <IconButton
                label="Fechar lista de envios"
                icon={X}
                disabled={busy}
                disabledReason={busy ? "Espere os envios terminarem." : undefined}
                onClick={onDismiss}
              />
            </header>
            <AnimatePresence initial={false}>
              {collapsed ? null : (
                <motion.ul
                  key="list"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="max-h-72 divide-y divide-border overflow-y-auto"
                >
                  <AnimatePresence initial={false}>
                    {tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onRetry={() => onRetry(task.id)}
                        onRemove={() => onRemove(task.id)}
                      />
                    ))}
                  </AnimatePresence>
                </motion.ul>
              )}
            </AnimatePresence>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </MotionConfig>
  );
}
