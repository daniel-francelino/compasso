import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UploadTrayPanel } from "@/components/shared/media/upload-tray-panel";
import {
  type Target,
  type UploadItem,
  UploadStatus,
  newItem,
  rejectionFor,
  sendUpload,
} from "@/hooks/shared/use-media-upload";
import {
  type EnqueueInput,
  type TrayTask,
  type UploadTray,
  UploadTrayContext,
} from "@/hooks/shared/use-upload-tray";
import { MediaKind, kindOfMime, mimeOfFile } from "@/lib/shared/media/limits";
import { QueryKey } from "@/lib/shared/query-keys";

type Job = { item: UploadItem; target: Target; onUploaded: EnqueueInput["onUploaded"] };

const isActive = (task: TrayTask): boolean =>
  task.item.status === UploadStatus.Queued || task.item.status === UploadStatus.Uploading;

export function UploadTrayProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [tasks, setTasks] = useState<TrayTask[]>([]);
  const jobs = useRef(new Map<string, Job>());
  const queue = useRef<string[]>([]);
  const running = useRef(false);

  const patch = useCallback((id: string, change: Partial<TrayTask>) => {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...change } : task)));
  }, []);

  const patchItem = useCallback((id: string, change: Partial<UploadItem>) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, item: { ...task.item, ...change } } : task,
      ),
    );
  }, []);

  const runOne = useCallback(
    async (id: string) => {
      const job = jobs.current.get(id);
      if (job === undefined) return;
      patchItem(id, { status: UploadStatus.Uploading, message: null });
      const outcome = await sendUpload(job.item, job.target, (fraction) =>
        patch(id, { progress: fraction }),
      );
      if (!outcome.ok) {
        patchItem(id, { status: UploadStatus.Failed, message: outcome.message });
        return;
      }
      patch(id, { progress: 1 });
      patchItem(id, {
        status: UploadStatus.Done,
        assetId: outcome.assetId,
        versionId: outcome.versionId,
      });
      job.onUploaded({
        versionId: outcome.versionId,
        name: job.item.file.name,
        kind: kindOfMime(mimeOfFile(job.item.file)) ?? MediaKind.Image,
      });
      void queryClient.invalidateQueries({ queryKey: QueryKey.Media.all() });
    },
    [patch, patchItem, queryClient],
  );

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    for (let id = queue.current.shift(); id !== undefined; id = queue.current.shift()) {
      await runOne(id);
    }
    running.current = false;
  }, [runOne]);

  const enqueue = useCallback(
    ({ owner, files, target, onUploaded }: EnqueueInput) => {
      const created: TrayTask[] = files.map((file) => ({
        id: crypto.randomUUID(),
        owner,
        item: newItem(file),
        progress: 0,
      }));
      for (const task of created) {
        jobs.current.set(task.id, { item: task.item, target, onUploaded });
        if (task.item.status === UploadStatus.Queued) queue.current.push(task.id);
      }
      setTasks((current) => [...current, ...created]);
      void pump();
    },
    [pump],
  );

  const retry = useCallback(
    (taskId: string) => {
      const job = jobs.current.get(taskId);
      if (job === undefined || rejectionFor(job.item.file) !== null) return;
      const item = newItem(job.item.file);
      jobs.current.set(taskId, { ...job, item });
      queue.current.push(taskId);
      patch(taskId, { item, progress: 0 });
      void pump();
    },
    [patch, pump],
  );

  const remove = useCallback((taskId: string) => {
    jobs.current.delete(taskId);
    queue.current = queue.current.filter((id) => id !== taskId);
    setTasks((current) => current.filter((task) => task.id !== taskId));
  }, []);

  const dismiss = useCallback(() => {
    setTasks((current) => {
      current.filter((task) => !isActive(task)).forEach((task) => jobs.current.delete(task.id));
      return current.filter(isActive);
    });
  }, []);

  const hasActive = tasks.some(isActive);
  useEffect(() => {
    if (!hasActive) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasActive]);

  const value = useMemo<UploadTray>(
    () => ({ tasks, enqueue, retry, remove, dismiss }),
    [tasks, enqueue, retry, remove, dismiss],
  );

  return (
    <UploadTrayContext.Provider value={value}>
      {children}
      <UploadTrayPanel tasks={tasks} onRetry={retry} onRemove={remove} onDismiss={dismiss} />
    </UploadTrayContext.Provider>
  );
}
