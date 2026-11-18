import { CircleAlert, CircleCheck, CloudUpload, LoaderCircle } from "lucide-react";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import type { StatusTone } from "@/components/shared/admin/status-tones";
import { DesignSaveState } from "@/lib/shared/design/types";

const view = {
  [DesignSaveState.Saved]: { tone: "success", icon: CircleCheck, label: "Rascunho salvo" },
  [DesignSaveState.Pending]: { tone: "draft", icon: CloudUpload, label: "Alterações não salvas" },
  [DesignSaveState.Saving]: { tone: "info", icon: LoaderCircle, label: "Salvando…" },
  [DesignSaveState.Conflict]: {
    tone: "warning",
    icon: CircleAlert,
    label: "Alterado em outra aba",
  },
  [DesignSaveState.Failed]: { tone: "negative", icon: CircleAlert, label: "Não foi salvo" },
  [DesignSaveState.Uploading]: { tone: "info", icon: LoaderCircle, label: "Enviando pixels…" },
  [DesignSaveState.UploadFailed]: {
    tone: "negative",
    icon: CircleAlert,
    label: "Pixels não enviados",
  },
} satisfies Record<DesignSaveState, { tone: StatusTone; icon: typeof CircleCheck; label: string }>;

export function DesignSaveStatus({ state }: { state: DesignSaveState }) {
  const current = view[state];
  return (
    <div aria-live="polite">
      <StatusBadge
        tone={current.tone}
        icon={current.icon}
        {...(state === DesignSaveState.Saving || state === DesignSaveState.Uploading
          ? { iconClassName: "motion-safe:animate-spin" }
          : {})}
      >
        {current.label}
      </StatusBadge>
    </div>
  );
}
