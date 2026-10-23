import { createContext, useContext } from "react";
import type { Target, UploadItem } from "@/hooks/shared/use-media-upload";
import type { MediaKind } from "@/lib/shared/media/limits";

export type UploadedFile = { versionId: string; name: string; kind: MediaKind };

export type TrayTask = { id: string; owner: string; item: UploadItem; progress: number };

export type EnqueueInput = {
  owner: string;
  files: File[];
  target: Target;
  onUploaded: (uploaded: UploadedFile) => void;
};

export type UploadTray = {
  tasks: TrayTask[];
  enqueue: (input: EnqueueInput) => void;
  retry: (taskId: string) => void;
  remove: (taskId: string) => void;
  dismiss: () => void;
};

export const UploadTrayContext = createContext<UploadTray | null>(null);

export const useUploadTray = (): UploadTray => {
  const tray = useContext(UploadTrayContext);
  if (tray === null) throw new Error("useUploadTray needs an UploadTrayProvider");
  return tray;
};
